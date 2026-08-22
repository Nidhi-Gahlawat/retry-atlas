import type { CatalogDiagnostic } from "../catalog/loader.js";
import type { Policy } from "../schema/policy.js";

export function formatPolicySummary(policy: Policy): string {
  return `${policy.id.padEnd(32)} ${policy.decision.retry.padEnd(11)} ${policy.title}`;
}

export function formatSearchResults(
  policies: Policy[],
  query: string | undefined,
): string {
  if (policies.length === 0) {
    const target =
      query === undefined ? "the search criteria" : JSON.stringify(query);
    return [
      `No policies matched ${target}.`,
      "Try `retry-atlas search --status <code>`, `retry-atlas search --code <code>`, or `retry-atlas list`.",
    ].join("\n");
  }

  const results = [
    `${"POLICY".padEnd(32)} ${"RETRY".padEnd(11)} DESCRIPTION`,
    ...policies.map(formatPolicySummary),
  ];
  const firstPolicy = policies[0];

  if (policies.length === 1 && firstPolicy) {
    results.push(
      "",
      `Run \`retry-atlas show ${firstPolicy.id}\` for full guidance.`,
    );
  }

  return results.join("\n");
}

export function formatPolicy(policy: Policy): string {
  const commonCauses = policy.diagnosis.commonCauses
    .map((item) => `  - ${item}`)
    .join("\n");
  const checks = policy.diagnosis.checks
    .map((item) => `  - ${item}`)
    .join("\n");
  const immediateResolution = policy.resolution.immediate
    .map((item) => `  - ${item}`)
    .join("\n");
  const longTermResolution = policy.resolution.longTerm
    .map((item) => `  - ${item}`)
    .join("\n");
  const prerequisites = policy.decision.prerequisites
    .map((item) => `  - ${item}`)
    .join("\n");
  const guidance = policy.safety.guidance
    .map((item) => `  - ${item}`)
    .join("\n");
  const references = policy.references
    .map((reference) => `  - ${reference.title}\n    ${reference.url}`)
    .join("\n");

  return [
    policy.title,
    "=".repeat(policy.title.length),
    `Decision: ${policy.decision.retry.toUpperCase()}`,
    `Retry identical request: ${policy.decision.retrySameRequest ? "yes" : "no"}`,
    `Classification: ${policy.classification}`,
    "",
    policy.summary,
    policy.decision.rationale,
    "",
    "Common meaning",
    policy.diagnosis.meaning,
    "",
    "Common causes",
    commonCauses,
    "",
    "Checks",
    checks,
    "",
    `Resolution owner: ${policy.resolution.owner}`,
    "Immediate resolution",
    immediateResolution,
    "",
    "Long-term resolution",
    longTermResolution,
    "",
    "What must change",
    prerequisites || "  - Nothing; observe the bounded strategy.",
    "",
    "Safety",
    `  Idempotency: ${policy.safety.idempotency}`,
    `  Duplicate side-effect risk: ${policy.safety.duplicateSideEffectRisk}`,
    `  Retry amplification risk: ${policy.safety.retryAmplificationRisk}`,
    guidance,
    "",
    `Telemetry: ${policy.telemetry.join(", ")}`,
    "",
    "References",
    references,
  ].join("\n");
}

export function formatDiagnostic(diagnostic: CatalogDiagnostic): string {
  const location = diagnostic.path
    ? `${diagnostic.file}:${diagnostic.path}`
    : diagnostic.file;
  return `${location}: ${diagnostic.message}`;
}
