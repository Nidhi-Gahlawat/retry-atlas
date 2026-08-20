# Policy authoring

A Retry Atlas policy documents a decision, not a universal retry configuration. Keep each entry narrow enough that its failure classification and safety advice remain true.

## Required evidence

- Cite an RFC, protocol specification, official service documentation, or established engineering reference over an unsourced blog post.
- Explain why the failure is transient, permanent, state-dependent, or an ambiguous outcome.
- State what changes before another attempt. Waiting is a change only when there is a reason to expect recovery or server-directed timing.
- Identify whether the first operation may have succeeded despite the observed failure.
- Address idempotency, duplicate side effects, retry amplification, and circuit breaking.
- Name telemetry that can distinguish logical requests from individual attempts.

## Classifications

| Classification                  | Meaning                                                      |
| ------------------------------- | ------------------------------------------------------------ |
| `transient`                     | A temporary condition can clear without changing the request |
| `persistent_until_state_change` | Repeating identical state cannot succeed                     |
| `permanent`                     | Waiting or replaying does not correct the failure            |
| `ambiguous_outcome`             | The caller cannot tell whether the operation completed       |

## Strategy rules

- `maxRetries` excludes the initial request and must remain bounded.
- A retryable policy must require a caller deadline.
- Jitter is valid only with exponential backoff.
- Prefer server-provided delay guidance such as `Retry-After` when the protocol defines it.
- Do not imply that the catalog's sample limits are correct for every latency budget or dependency.
- Avoid nested retries across layers; they multiply downstream attempts.

## Review checklist

1. Does the policy say whether the identical request can succeed?
2. If state must change, is that prerequisite explicit and actionable?
3. Could the first operation have succeeded, and is reconciliation described?
4. Is retry traffic bounded by attempts and a caller deadline?
5. Does the entry address overload and synchronized retries?
6. Are status codes and error codes narrow enough to avoid conflating causes?
7. Are all references authoritative HTTPS URLs?
8. Do `pnpm catalog:validate`, `pnpm schema:check`, and `pnpm test` pass?
