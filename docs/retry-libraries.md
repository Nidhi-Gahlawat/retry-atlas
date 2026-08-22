# Implementing retries with libraries

A retry library supplies execution mechanics: attempt counting, delay calculation, cancellation, and hooks. It cannot decide whether repeating an operation is correct. Make the retry decision first, then encode that decision in the narrowest layer that owns the dependency call.

Before selecting a library, write down:

- the exact failures that are transient;
- the failures that must stop immediately;
- whether the operation is read-only, idempotent, or protected by an idempotency key;
- the maximum total attempts and end-to-end deadline;
- how server-directed delay such as `Retry-After` is handled;
- which metrics and trace attributes identify each logical request and attempt.

Use [Retry fundamentals](retry-fundamentals.md) to make those decisions. The examples below show wiring, not universal production values.

## Prefer the retry mechanism closest to the transport

Before adding a general-purpose wrapper, inspect the client already making the call. Cloud SDKs, database drivers, message clients, and RPC frameworks often retry internally. Adding another retry layer can multiply attempts and obscure the actual budget.

Prefer, in order:

1. A built-in client or protocol policy when it correctly classifies the service's errors and exposes limits, cancellation, and telemetry.
2. A shared resilience pipeline at the boundary that owns calls to one dependency.
3. A general-purpose function wrapper when no transport-aware mechanism exists.

Do not wrap a retrying SDK with another retry library unless one layer is explicitly configured for a single total attempt. Count every physical attempt, including transparent and built-in retries.

## Library map

| Ecosystem             | Option                                                                                            | Best fit                                                       | Verify before adoption                                                                                                   |
| --------------------- | ------------------------------------------------------------------------------------------------- | -------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------ |
| JavaScript/TypeScript | [`p-retry`](https://github.com/sindresorhus/p-retry)                                              | Promise-returning operations                                   | Runtime support, `shouldRetry`, `maxRetryTime`, `AbortSignal`, and whether `randomize` matches the required jitter model |
| Python                | [Tenacity](https://tenacity.readthedocs.io/en/latest/)                                            | Sync or async functions with composable stop and wait policies | Defaults retry indefinitely with no wait; always configure stop, wait, and a narrow retry predicate                      |
| Java                  | [Resilience4j Retry](https://resilience4j.readme.io/docs/retry)                                   | Named, reusable resilience policies around dependency calls    | `maxAttempts` includes the initial call; define result and exception predicates explicitly                               |
| .NET                  | [Polly Retry](https://www.pollydocs.org/strategies/retry.html)                                    | Typed resilience pipelines and `HttpClient` integration        | `MaxRetryAttempts` counts retries after the original call; pass cancellation and configure `ShouldHandle`                |
| Go                    | [`cenkalti/backoff`](https://pkg.go.dev/github.com/cenkalti/backoff/v7)                           | Small generic retry loops using `context.Context`              | Use the current major-version import path, mark permanent errors, and combine a context deadline with attempt limits     |
| Rust                  | [Tower Retry](https://docs.rs/tower/latest/tower/retry/)                                          | Middleware around Tower `Service` implementations              | Requests must be cloneable for replay; implement a `Policy` and include Tower's retry budget when appropriate            |
| gRPC                  | [Service Config retry policy](https://grpc.io/docs/guides/retry/)                                 | Per-method RPC policies understood by the gRPC client          | Account for transparent retries, use retry throttling, and retry only selected status codes                              |
| AWS SDKs              | [SDK retry behavior](https://docs.aws.amazon.com/sdkref/latest/guide/feature-retry-behavior.html) | Calls made through an AWS SDK                                  | Prefer standard mode, confirm SDK-version behavior, and remember `max_attempts` includes the initial request             |

This list is representative, not an endorsement or a dependency of Retry Atlas. Check maintenance status, release notes, runtime compatibility, and security policy before adopting any package.

## JavaScript and TypeScript with `p-retry`

Install the version compatible with the application's Node.js runtime:

```bash
npm install p-retry
```

Keep classification in a named predicate and propagate the caller's abort signal:

```ts
import pRetry, { AbortError } from "p-retry";

const response = await pRetry(
  async () => {
    const response = await fetch(url, { signal });

    if (response.status >= 400 && response.status < 500) {
      throw new AbortError(`non-retryable HTTP ${response.status}`);
    }
    if (!response.ok) {
      throw new TransientDependencyError(response.status);
    }

    return response;
  },
  {
    retries: 2,
    factor: 2,
    minTimeout: 200,
    maxTimeout: 2_000,
    maxRetryTime: 5_000,
    randomize: true,
    signal,
    shouldRetry: ({ error }) => error instanceof TransientDependencyError,
    onFailedAttempt: ({ attemptNumber, retryDelay }) => {
      recordRetryAttempt({ attemptNumber, retryDelay });
    },
  },
);
```

`retries: 2` means one initial attempt plus at most two retries. The enclosing request still needs an end-to-end deadline; `maxRetryTime` bounds only the wrapped operation.

## Python with Tenacity

```bash
python -m pip install tenacity
```

Tenacity's unconstrained decorator retries forever without waiting. Configure all three decisions: what to retry, when to stop, and how to wait.

```python
from tenacity import (
    retry,
    retry_if_exception_type,
    stop_after_attempt,
    stop_after_delay,
    wait_random_exponential,
)


@retry(
    retry=retry_if_exception_type(TransientDependencyError),
    stop=(stop_after_attempt(3) | stop_after_delay(5)),
    wait=wait_random_exponential(multiplier=0.2, max=2),
    reraise=True,
    before_sleep=record_retry_attempt,
)
def fetch_dependency():
    return client.fetch(timeout=PER_ATTEMPT_TIMEOUT)
```

`stop_after_attempt(3)` counts the initial call, so this permits at most two retries. For asynchronous code, Tenacity also supports coroutines and `AsyncRetrying`. Preserve the caller deadline separately and make each in-flight operation cancellable.

## Java with Resilience4j

Add the `resilience4j-retry` module using the version managed by the application, then create a named policy for one dependency:

```java
RetryConfig config = RetryConfig.custom()
    .maxAttempts(3)
    .waitDuration(Duration.ofMillis(200))
    .retryOnException(error -> error instanceof TransientDependencyException)
    .ignoreExceptions(InvalidRequestException.class)
    .build();

Retry retry = Retry.of("inventory-read", config);
CheckedSupplier<Inventory> call = Retry.decorateCheckedSupplier(
    retry,
    () -> inventoryClient.fetch(request)
);

Inventory inventory = call.get();
```

Resilience4j's `maxAttempts` includes the initial call. Use an `IntervalFunction` or `IntervalBiFunction` when the policy requires exponential or result-aware delay, and subscribe to retry events for metrics. Keep deadline enforcement in the client or an adjacent time-limiter policy.

## .NET with Polly

Add the current `Polly.Core` package, then build a typed pipeline:

```csharp
var pipeline = new ResiliencePipelineBuilder<HttpResponseMessage>()
    .AddRetry(new RetryStrategyOptions<HttpResponseMessage>
    {
        ShouldHandle = new PredicateBuilder<HttpResponseMessage>()
            .Handle<HttpRequestException>()
            .HandleResult(response =>
                response.StatusCode is HttpStatusCode.RequestTimeout or
                    HttpStatusCode.TooManyRequests or
                    HttpStatusCode.ServiceUnavailable),
        MaxRetryAttempts = 2,
        Delay = TimeSpan.FromMilliseconds(200),
        BackoffType = DelayBackoffType.Exponential,
        UseJitter = true,
        OnRetry = args =>
        {
            RecordRetryAttempt(args.AttemptNumber, args.RetryDelay);
            return default;
        }
    })
    .Build();

HttpResponseMessage response = await pipeline.ExecuteAsync(
    token => httpClient.SendAsync(request, token),
    cancellationToken);
```

Polly's `MaxRetryAttempts` counts retries after the original call. The example intentionally names handled statuses rather than treating every failure as transient. For HTTP applications, also evaluate the official resilience handler integration so policies are registered once per client rather than rebuilt per request.

## Go with `cenkalti/backoff`

```bash
go get github.com/cenkalti/backoff/v7
```

Use a context deadline to interrupt waits and cooperative in-flight work. Mark known permanent failures explicitly:

```go
ctx, cancel := context.WithTimeout(parent, 5*time.Second)
defer cancel()

result, err := backoff.Retry(ctx, func() (Result, error) {
	result, err := callDependency(ctx)
	if errors.Is(err, ErrInvalidRequest) {
		return Result{}, backoff.Permanent(err)
	}
	return result, err
}, backoff.WithMaxTries(3))
```

`WithMaxTries(3)` permits three total calls. The library's maximum elapsed time limits retry scheduling but does not interrupt an in-flight operation; the context deadline is the authoritative caller bound.

## Rust with Tower

Tower's retry middleware fits clients already modeled as a `Service`. Implement `tower::retry::Policy` to classify each result and produce the next policy state. The policy's `clone_request` method must return a fresh request for every replay; return `None` when a body or mutation cannot be cloned safely.

Enable Tower's `retry` feature and combine the retry layer with timeout, load-shed, and concurrency layers according to the dependency boundary. Tower also provides a retry budget module so retry traffic can be limited over time. Because middleware order changes which work each attempt repeats, test the complete `ServiceBuilder` stack rather than each layer in isolation.

## gRPC service configuration

gRPC supports per-method retry policies in Service Config:

```json
{
  "methodConfig": [
    {
      "name": [{ "service": "inventory.v1.Inventory" }],
      "retryPolicy": {
        "maxAttempts": 3,
        "initialBackoff": "0.2s",
        "maxBackoff": "2s",
        "backoffMultiplier": 2,
        "retryableStatusCodes": ["UNAVAILABLE"]
      }
    }
  ],
  "retryThrottling": {
    "maxTokens": 10,
    "tokenRatio": 0.1
  }
}
```

Here `maxAttempts` includes the original RPC. gRPC applies jitter and can perform limited transparent retries even without an explicit policy, so do not add an application wrapper without including those attempts in the budget. Set and propagate an RPC deadline, and avoid retrying application-generated statuses unless the method contract is replay-safe.

## AWS SDK configuration

AWS SDKs have built-in classification, jittered backoff, and a retry quota. Configure the SDK instead of wrapping each call:

```bash
export AWS_RETRY_MODE=standard
export AWS_MAX_ATTEMPTS=3
```

`AWS_MAX_ATTEMPTS=3` means one initial request and at most two retries. Standard mode is the general default. Adaptive mode can delay initial requests and shares rate-limiting state within an SDK client, so use it only for the documented single-resource, throttling-heavy case. AWS retry behavior is versioned; confirm the current SDK guide and any required feature opt-in during upgrades.

## Production integration checklist

- Centralize one policy per dependency and operation class; do not create ad hoc wrappers at call sites.
- Derive the retry predicate from typed errors, protocol status, and operation phase rather than message text.
- Keep total attempts small and inside the propagated caller deadline.
- Pass cancellation through delays and every attempt.
- Honor valid server-directed timing without exceeding the deadline.
- Rebuild credentials or request state only when that state change is the reason another attempt can succeed.
- Preserve one logical request ID and record attempt number, delay, failure class, and final outcome.
- Expose exhaustion separately from the last dependency error.
- Test success, permanent failure, transient recovery, ambiguous mutation outcome, cancellation during delay, deadline expiry, and retry-budget exhaustion.
- Load-test the full call chain to detect nested retries and recovery spikes.

Library defaults are starting points, not evidence that an operation is retryable. The policy should remain reviewable even if the implementation library changes.
