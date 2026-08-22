import { describe, expect, it } from "vitest";

import { loadCatalog } from "../../src/catalog/loader.js";
import { searchPolicies } from "../../src/catalog/search.js";

const catalog = await loadCatalog("catalog");

describe("searchPolicies", () => {
  it("ranks an exact status match", () => {
    const matches = searchPolicies(catalog.policies, { query: "429" });
    expect(matches[0]?.id).toBe("http-429-rate-limited");
  });

  it("finds a policy by natural-language alias", () => {
    const matches = searchPolicies(catalog.policies, { query: "stale token" });
    expect(matches[0]?.id).toBe("auth-expired-access-token");
  });

  it("finds a policy by diagnostic content", () => {
    const matches = searchPolicies(catalog.policies, {
      query: "clock skew",
    });
    expect(matches[0]?.id).toBe("auth-expired-access-token");
  });

  it("combines structured filters", () => {
    const matches = searchPolicies(catalog.policies, {
      status: 401,
      code: "invalid_token",
      domain: "authentication",
    });
    expect(matches.map((policy) => policy.id)).toEqual([
      "auth-expired-access-token",
    ]);
  });
});
