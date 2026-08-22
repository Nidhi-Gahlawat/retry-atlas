# Retry glossary

These terms describe retry decisions in the catalog. They are not promises that a particular attempt will succeed.

| Term                          | Meaning                                                                                                                                                          |
| ----------------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Attempt                       | One physical transmission or execution of an operation. The initial attempt is not a retry.                                                                      |
| Logical request               | The user or system operation that can contain an initial attempt and zero or more retries.                                                                       |
| Safe operation                | An operation intended to be read-only. Safety and idempotency are related but distinct.                                                                          |
| Idempotent operation          | An operation whose intended server effect is the same after one or multiple identical applications.                                                              |
| Idempotency key               | A stable caller-supplied identifier used by a service to recognize duplicate submissions and return the original outcome.                                        |
| Duplicate side effect         | Additional state change caused by replaying work, such as creating two orders or charging twice.                                                                 |
| Reconciliation                | Discovering the authoritative result of an operation before deciding whether to replay it.                                                                       |
| Ambiguous outcome             | A failure where the caller cannot tell whether the operation completed, often because the response was lost or timed out.                                        |
| Transient failure             | A temporary condition that can clear without changing the request.                                                                                               |
| Persistent until state change | A condition that remains until credentials, resource state, routing, or another prerequisite changes.                                                            |
| Permanent failure             | A condition that delay or replay cannot correct.                                                                                                                 |
| Caller deadline               | The latest time at which the complete logical request remains useful. All attempts and delays must fit inside it.                                                |
| Per-attempt timeout           | The maximum duration of one attempt. It must leave time for handling and any justified later attempt.                                                            |
| Retry budget                  | A bound on retry traffic across a request, process, client population, or service.                                                                               |
| Exponential backoff           | Increasing the delay between attempts, usually up to a cap.                                                                                                      |
| Jitter                        | Random variation added to retry timing to prevent synchronized clients from retrying together.                                                                   |
| Server-directed delay         | Timing supplied by the server, such as HTTP `Retry-After`.                                                                                                       |
| Retry amplification           | Extra dependency load produced by retries, especially when several layers retry the same logical request.                                                        |
| Retry storm                   | A feedback loop where failures trigger enough retries to prolong or worsen an outage.                                                                            |
| Single-flight                 | Coordinating concurrent callers so one shared operation, such as token refresh, runs while others await its result.                                              |
| Circuit breaker               | A control that temporarily fails fast after a dependency crosses a failure threshold, allowing recovery and limiting wasted work.                                |
| Load shedding                 | Rejecting work early when capacity is exhausted so the service can continue useful work and recover.                                                             |
| Failover                      | Directing work to a different endpoint or failure domain. Failover can still amplify load and does not remove replay risk.                                       |
| Fallback                      | Returning a cheaper, cached, partial, or degraded result instead of repeating the original operation.                                                            |
| Hedging                       | Starting an additional concurrent attempt before the first one fails. It can reduce tail latency but increases load and requires cancellation and replay safety. |
| Polling                       | Checking for state or completion over time. Polling is not replaying the original mutation.                                                                      |

For the decision process and practical examples, read [Retry fundamentals](retry-fundamentals.md). To encode those decisions in application code, see [Implementing retries with libraries](retry-libraries.md).

## References

- [RFC 9110, Section 9.2 - Common Method Properties](https://www.rfc-editor.org/rfc/rfc9110#section-9.2)
- [RFC 9110, Section 10.2.3 - Retry-After](https://www.rfc-editor.org/rfc/rfc9110#section-10.2.3)
- [Google SRE - Addressing Cascading Failures](https://sre.google/sre-book/addressing-cascading-failures/)
- [gRPC - Retry](https://grpc.io/docs/guides/retry/)
