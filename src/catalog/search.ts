import type { Policy } from "../schema/policy.js";

export interface SearchOptions {
  query?: string | undefined;
  status?: number;
  code?: string;
  domain?: Policy["domain"];
}

interface RankedPolicy {
  policy: Policy;
  score: number;
}

export function searchPolicies(
  policies: Policy[],
  options: SearchOptions,
): Policy[] {
  const query = normalize(options.query ?? "");
  const tokens = query.split(" ").filter(Boolean);

  return policies
    .filter((policy) => {
      return (
        (options.status === undefined ||
          policy.signals.httpStatuses?.includes(options.status)) &&
        (options.code === undefined ||
          policy.signals.errorCodes?.some(
            (code) => normalize(code) === normalize(options.code ?? ""),
          )) &&
        (options.domain === undefined || policy.domain === options.domain)
      );
    })
    .map((policy): RankedPolicy => ({
      policy,
      score: scorePolicy(policy, query, tokens),
    }))
    .filter((result) => query.length === 0 || result.score > 0)
    .sort((left, right) => {
      return (
        right.score - left.score ||
        left.policy.id.localeCompare(right.policy.id)
      );
    })
    .map((result) => result.policy);
}

function scorePolicy(policy: Policy, query: string, tokens: string[]): number {
  if (!query) return 1;

  const exactKeys = [
    policy.id,
    ...policy.aliases,
    ...(policy.signals.errorCodes ?? []),
    ...(policy.signals.httpStatuses?.map(String) ?? []),
  ].map(normalize);

  if (exactKeys.includes(query)) return 100;

  const title = normalize(policy.title);
  if (title.includes(query)) return 60;

  const searchable = normalize(
    [
      policy.id,
      policy.title,
      policy.summary,
      ...policy.aliases,
      ...policy.tags,
      ...(policy.signals.errorCodes ?? []),
      ...(policy.signals.httpStatuses?.map(String) ?? []),
    ].join(" "),
  );

  if (!tokens.every((token) => searchable.includes(token))) return 0;

  return tokens.reduce(
    (score, token) => score + (searchable.includes(token) ? 10 : 0),
    0,
  );
}

function normalize(value: string): string {
  return value.toLowerCase().replace(/[_-]+/g, " ").replace(/\s+/g, " ").trim();
}
