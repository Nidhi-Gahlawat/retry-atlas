export interface LearningReference {
  title: string;
  url: string;
}

export interface LearningConcept {
  id: string;
  title: string;
  summary: string;
  explanation: string;
  checks: string[];
  aliases: string[];
  references: LearningReference[];
}

const rfcSafeMethods: LearningReference = {
  title: "RFC 9110, Section 9.2.1 - Safe Methods",
  url: "https://www.rfc-editor.org/rfc/rfc9110#section-9.2.1",
};

const rfcIdempotentMethods: LearningReference = {
  title: "RFC 9110, Section 9.2.2 - Idempotent Methods",
  url: "https://www.rfc-editor.org/rfc/rfc9110#section-9.2.2",
};

const rfcRetryAfter: LearningReference = {
  title: "RFC 9110, Section 10.2.3 - Retry-After",
  url: "https://www.rfc-editor.org/rfc/rfc9110#section-10.2.3",
};

const googleCascadingFailures: LearningReference = {
  title: "Google SRE - Addressing Cascading Failures",
  url: "https://sre.google/sre-book/addressing-cascading-failures/",
};

const awsRetries: LearningReference = {
  title: "AWS Builders' Library - Timeouts, retries, and backoff with jitter",
  url: "https://aws.amazon.com/builders-library/timeouts-retries-and-backoff-with-jitter/",
};

const grpcRetries: LearningReference = {
  title: "gRPC - Retry",
  url: "https://grpc.io/docs/guides/retry/",
};

const retryLibrariesGuide: LearningReference = {
  title: "Retry Atlas - Implementing retries with libraries",
  url: "https://github.com/Nidhi-Gahlawat/retry-atlas/blob/main/docs/retry-libraries.md",
};

export const learningConcepts: LearningConcept[] = [
  {
    id: "safe-and-idempotent",
    title: "Safe and idempotent operations",
    summary:
      "Safety means read-only intent; idempotency means repeated application has the same intended effect.",
    explanation:
      "A safe operation is intended not to change server state. An idempotent operation can be applied repeatedly with the same intended server effect as one application. A mutation still needs an idempotency key, stable operation ID, reconciliation, or a proven idempotent design before automatic replay.",
    checks: [
      "Classify the application operation, not only its HTTP method.",
      "Identify every side effect that a duplicate attempt could repeat.",
      "Protect a mutation with an idempotency key or queryable operation ID.",
    ],
    aliases: [
      "safe request",
      "idempotency",
      "idempotent",
      "idempotency key",
      "duplicate side effect",
    ],
    references: [rfcSafeMethods, rfcIdempotentMethods],
  },
  {
    id: "ambiguous-outcome",
    title: "Ambiguous outcomes and reconciliation",
    summary:
      "A timeout or lost response can hide a completed operation, so failure to observe success is not proof of failure.",
    explanation:
      "When the caller cannot tell whether the server committed a mutation, replay can duplicate work. Reconciliation means querying authoritative state by a stable operation identifier before deciding whether another mutation is needed.",
    checks: [
      "Determine whether the request reached application logic.",
      "Query the operation result or resulting resource before replaying.",
      "Record one logical request ID across the original attempt and retries.",
    ],
    aliases: [
      "unknown outcome",
      "response lost",
      "reconciliation",
      "query before replay",
      "mutation safety",
    ],
    references: [rfcIdempotentMethods],
  },
  {
    id: "deadlines-and-timeouts",
    title: "Deadlines and per-attempt timeouts",
    summary:
      "The caller deadline bounds the whole logical request; a per-attempt timeout bounds only one attempt.",
    explanation:
      "Every delay and attempt must fit inside the remaining caller deadline. Propagating that deadline and cancellation prevents downstream services from continuing work after the result is no longer useful.",
    checks: [
      "Reserve time for delay, connection setup, processing, and response transfer.",
      "Propagate the remaining deadline instead of resetting it at each service hop.",
      "Stop before another attempt when too little useful time remains.",
    ],
    aliases: [
      "deadline",
      "timeout",
      "caller deadline",
      "per attempt timeout",
      "cancellation",
    ],
    references: [googleCascadingFailures, grpcRetries],
  },
  {
    id: "backoff-and-jitter",
    title: "Exponential backoff and jitter",
    summary:
      "Backoff spaces attempts; jitter prevents many recovering clients from retrying in lockstep.",
    explanation:
      "Increasing delays reduce repeated pressure during transient failure. Randomized jitter spreads clients across each delay window. Neither mechanism repairs a permanent error, makes a mutation idempotent, or replaces a caller deadline.",
    checks: [
      "Apply backoff only to a failure with a reason to recover.",
      "Cap both delay and total attempts inside the caller deadline.",
      "Use randomized timing when many clients can fail together.",
    ],
    aliases: [
      "backoff",
      "jitter",
      "exponential backoff",
      "full jitter",
      "retry delay",
    ],
    references: [awsRetries, googleCascadingFailures, grpcRetries],
  },
  {
    id: "server-directed-delay",
    title: "Server-directed delay and Retry-After",
    summary:
      "When a server supplies recovery timing, prefer it to an invented client delay.",
    explanation:
      "HTTP Retry-After can be either delay seconds or an HTTP date. Waiting is still justified only when the operation is replay-safe and another attempt fits the caller deadline.",
    checks: [
      "Parse both valid Retry-After forms and reject malformed values safely.",
      "Treat the value as server guidance, not permission for an unsafe replay.",
      "Stop when the requested delay exceeds the remaining deadline.",
    ],
    aliases: [
      "retry after",
      "retry-after",
      "server directed",
      "rate limit delay",
      "http date",
    ],
    references: [rfcRetryAfter],
  },
  {
    id: "retry-budgets",
    title: "Retry budgets and amplification",
    summary:
      "Retries consume capacity, and retries at several layers multiply downstream attempts.",
    explanation:
      "Attempt limits bound one logical request. A process or service retry budget bounds aggregate retry traffic during an outage. If several layers each retry, the worst-case downstream attempts are the product of each layer's total attempts.",
    checks: [
      "Choose one layer to own retries for each dependency call.",
      "Measure attempts per logical request and aggregate retry traffic.",
      "Pause retries when the shared budget is exhausted.",
    ],
    aliases: [
      "retry budget",
      "amplification",
      "retry storm",
      "nested retries",
      "cascading failure",
    ],
    references: [googleCascadingFailures, awsRetries],
  },
  {
    id: "circuit-breaking",
    title: "Circuit breakers and load shedding",
    summary:
      "Circuit breakers fail fast during persistent dependency failure; load shedding rejects work a service cannot sustain.",
    explanation:
      "These controls protect capacity and recovery. They complement retries but do not make unsafe operations replayable. A breaker also needs a bounded recovery probe so every caller does not test the dependency at once.",
    checks: [
      "Base breaker state on a meaningful failure and recovery signal.",
      "Fail fast while open instead of spending the caller deadline.",
      "Limit recovery probes and monitor rejected work.",
    ],
    aliases: [
      "circuit breaker",
      "fail fast",
      "load shedding",
      "overload",
      "recovery probe",
    ],
    references: [googleCascadingFailures, awsRetries],
  },
  {
    id: "recovery-patterns",
    title: "Retry, failover, fallback, polling, and hedging",
    summary:
      "Related recovery patterns solve different problems and carry different load and replay risks.",
    explanation:
      "Retry repeats after failure. Failover uses another failure domain. Fallback returns a cheaper or degraded result. Polling checks state without replaying the mutation. Hedging starts a concurrent attempt before the first fails and therefore requires strict cancellation, replay safety, and load control.",
    checks: [
      "Choose the pattern that changes the failed condition.",
      "Include alternate endpoints and concurrent attempts in the same load budget.",
      "Propagate cancellation when another attempt already produced the result.",
    ],
    aliases: [
      "failover",
      "fallback",
      "polling",
      "hedging",
      "request hedging",
      "recovery pattern",
    ],
    references: [grpcRetries, googleCascadingFailures],
  },
  {
    id: "retry-libraries",
    title: "Implementing retries with libraries",
    summary:
      "Use a transport-native retry mechanism or a bounded library policy after deciding which operations and failures are retryable.",
    explanation:
      "A library supplies mechanics, not permission. Prefer the mechanism already built into an SDK, driver, or RPC client; otherwise keep one shared policy at the dependency boundary. Configure a narrow failure predicate, total attempt and deadline bounds, jitter or server timing, cancellation, and attempt telemetry.",
    checks: [
      "Inspect the client for built-in retries before adding a wrapper.",
      "Confirm whether the library counts total attempts or only retries.",
      "Test cancellation, exhaustion, permanent errors, and nested retry behavior.",
    ],
    aliases: [
      "retry library",
      "retry libraries",
      "p-retry",
      "tenacity",
      "resilience4j",
      "polly",
      "cenkalti backoff",
      "tower retry",
      "grpc retry",
      "aws sdk retries",
      "how to add retries",
    ],
    references: [retryLibrariesGuide],
  },
];

export function searchLearningConcepts(query: string): LearningConcept[] {
  const normalizedQuery = normalize(query);
  if (normalizedQuery.length < 2) return [];

  const queryTerms = normalizedQuery.split(" ").filter(Boolean);

  return learningConcepts
    .map((concept) => ({ concept, score: scoreConcept(concept) }))
    .filter((match) => match.score > 0)
    .sort(
      (left, right) =>
        right.score - left.score ||
        left.concept.title.localeCompare(right.concept.title),
    )
    .slice(0, 2)
    .map((match) => match.concept);

  function scoreConcept(concept: LearningConcept): number {
    const normalizedTitle = normalize(concept.title);
    const normalizedAliases = concept.aliases.map(normalize);
    const searchable = normalize(
      [
        concept.id,
        concept.title,
        concept.summary,
        concept.explanation,
        ...concept.aliases,
      ].join(" "),
    );

    if (
      normalizedTitle === normalizedQuery ||
      normalizedAliases.includes(normalizedQuery)
    ) {
      return 100;
    }
    if (normalizedTitle.includes(normalizedQuery)) return 80;
    if (searchable.includes(normalizedQuery)) return 60;
    if (queryTerms.every((term) => searchable.includes(term))) return 40;
    return 0;
  }
}

function normalize(value: string): string {
  return value
    .toLowerCase()
    .replaceAll(/[^a-z0-9]+/g, " ")
    .trim();
}
