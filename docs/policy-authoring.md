# Policy authoring

A Retry Atlas policy documents a decision, not a universal retry configuration. Keep each entry narrow enough that its failure classification and safety advice remain true.

## Required evidence

- Cite an RFC, protocol specification, official service documentation, or established engineering reference over an unsourced blog post.
- Explain why the failure is transient, permanent, state-dependent, or an ambiguous outcome.
- In `diagnosis`, define what the signal means, list plausible causes as hypotheses, and provide checks that distinguish them.
- In `resolution`, identify the owner and separate immediate mitigation from the long-term correction.
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

1. Does the diagnosis distinguish plausible causes with concrete checks?
2. Does the resolution name an owner and separate immediate from long-term action?
3. Does the policy say whether the identical request can succeed?
4. If state must change, is that prerequisite explicit and actionable?
5. Could the first operation have succeeded, and is reconciliation described?
6. Is retry traffic bounded by attempts and a caller deadline?
7. Does the entry address overload and synchronized retries?
8. Are status codes and error codes narrow enough to avoid conflating causes?
9. Are all references authoritative HTTPS URLs?
10. Do `pnpm catalog:validate`, `pnpm schema:check`, and `pnpm test` pass?
