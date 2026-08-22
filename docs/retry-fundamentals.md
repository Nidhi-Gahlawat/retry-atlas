# Retry fundamentals

Retrying is not the act of sending the same request again. It is a decision that another attempt has a defensible chance of succeeding without causing unacceptable duplicate work or additional load.

Start with three questions:

1. Why did the first attempt fail?
2. What will be different before the next attempt?
3. What if the first attempt actually succeeded?

If those questions do not have concrete answers, stop and diagnose the failure instead of adding a retry.

## Locate the failure

The observed error describes where the caller noticed a problem, not necessarily where the problem began. Determine how far the operation might have progressed:

| Observation                            | What might be true                                | First action                                              |
| -------------------------------------- | ------------------------------------------------- | --------------------------------------------------------- |
| Connection could not be established    | The server probably did not receive the request   | Verify the endpoint and network path                      |
| Request was explicitly rejected        | The server understood enough to return a decision | Read the status, response details, and server guidance    |
| Connection reset or response timed out | The server might have completed the operation     | Reconcile the outcome before replaying a mutation         |
| Service reported overload              | More traffic can delay recovery                   | Respect server guidance and preserve a small retry budget |

This distinction is why a connection timeout and a read timeout need different policies even when both appear as `ETIMEDOUT`.

## Safe is not the same as idempotent

A safe operation is intended to be read-only. An idempotent operation has the same intended server effect when the identical request is applied more than once.

HTTP defines `GET`, `HEAD`, `OPTIONS`, and `TRACE` as safe. It defines safe methods, `PUT`, and `DELETE` as idempotent. Application behavior still matters: a nominally idempotent method can call non-idempotent downstream work, and a `POST` can be made replay-safe through an idempotency key or stable operation identifier.

Do not automatically replay a mutation merely because its transport failed. Use one of these controls:

- Give the operation a stable identifier and query its outcome before replaying it.
- Use an idempotency key whose result is stored and returned for duplicate submissions.
- Prove that repeating the operation has the same intended effect.

See `http-408-request-timeout`, `http-500-internal-server-error`, and `network-connection-reset` for ambiguous mutation examples.

## Bound attempts by a deadline

Retry Atlas uses `maxRetries` for attempts after the initial request:

```text
total attempts = 1 + maxRetries
```

An attempt limit alone is insufficient. Every retryable operation also needs an end-to-end caller deadline. Before another attempt, reserve time for its delay, connection setup, request processing, response transfer, and any caller-side cleanup.

Propagate the remaining deadline through downstream calls. A lower service should not begin work that can only finish after the original caller has stopped waiting. Propagate cancellation as well when the request is no longer useful.

## Choose the reason for waiting

Retry Atlas distinguishes three strategy mechanisms:

| Mechanism                    | Use when                                              | Example                                                   |
| ---------------------------- | ----------------------------------------------------- | --------------------------------------------------------- |
| Immediate after state change | The request cannot succeed until local state changes  | Refresh an expired access token, then rebuild the request |
| Server directed              | The server states when another attempt is appropriate | Honor `Retry-After` for overload or maintenance           |
| Exponential backoff          | A transient distributed condition may clear           | Retry a temporary DNS or connection failure with jitter   |

Exponential backoff spaces repeated attempts. Jitter randomizes their timing so many clients do not return simultaneously. Backoff and jitter do not make a permanent error retryable, repair an invalid request, or make a mutation idempotent.

`Retry-After` can contain either a number of delay seconds or an HTTP date. Treat it as a lower bound only when another attempt still fits the caller deadline and the operation is replay-safe.

## Keep one retry owner

Retries at multiple layers multiply. If three layers each allow four total attempts, one logical request can produce:

```text
4 x 4 x 4 = 64 downstream attempts
```

Choose one layer to own retries for a dependency call. Count attempts per logical request, not only errors per physical request. During overload, enforce a process or service retry budget so retries cannot consume all available capacity.

A circuit breaker serves a different purpose: it stops new attempts while a dependency is persistently failing. Load shedding rejects work the service cannot sustain. Failover sends work to another failure domain. None of these mechanisms makes an unsafe replay safe.

## Before enabling a retry

- Identify the exact status, runtime code, and phase of failure.
- Decide whether the outcome is known or ambiguous.
- Prove the operation is safe, idempotent, or protected against duplicates.
- State what changes before another attempt.
- Set a small attempt limit inside an end-to-end deadline.
- Honor server-directed timing and otherwise use bounded jittered backoff.
- Assign retry ownership to one layer in the call path.
- Record the logical request ID, attempt number, delay, failure signal, and final outcome.
- Test permanent failures, partial failures, overload, deadline expiry, and recovery.

Once the decision is reviewable, [Implementing retries with libraries](retry-libraries.md) shows how to encode it with transport-native mechanisms or representative ecosystem libraries.

## References

- [RFC 9110, Section 9.2.1 - Safe Methods](https://www.rfc-editor.org/rfc/rfc9110#section-9.2.1)
- [RFC 9110, Section 9.2.2 - Idempotent Methods](https://www.rfc-editor.org/rfc/rfc9110#section-9.2.2)
- [RFC 9110, Section 10.2.3 - Retry-After](https://www.rfc-editor.org/rfc/rfc9110#section-10.2.3)
- [AWS Builders' Library - Timeouts, retries, and backoff with jitter](https://aws.amazon.com/builders-library/timeouts-retries-and-backoff-with-jitter/)
- [Google SRE - Addressing Cascading Failures](https://sre.google/sre-book/addressing-cascading-failures/)
- [gRPC - Retry](https://grpc.io/docs/guides/retry/)
