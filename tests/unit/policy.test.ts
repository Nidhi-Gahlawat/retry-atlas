import { describe, expect, it } from "vitest";

import { policySchema } from "../../src/schema/policy.js";

const expiredTokenPolicy = {
  schemaVersion: "1.1.0",
  id: "auth-expired-access-token",
  title: "Expired access token",
  summary: "Refresh the credential before retrying the request.",
  domain: "authentication",
  classification: "persistent_until_state_change",
  signals: { httpStatuses: [401], errorCodes: ["invalid_token"] },
  diagnosis: {
    meaning: "The access token presented to the API is no longer valid.",
    commonCauses: ["The token reached its expiry time."],
    checks: ["Inspect the authentication challenge and token expiry claim."],
  },
  resolution: {
    owner: "caller",
    immediate: ["Refresh the token before rebuilding the request."],
    longTerm: [
      "Refresh tokens before expiry and coordinate concurrent refreshes.",
    ],
  },
  decision: {
    retry: "conditional",
    retrySameRequest: false,
    rationale: "The expired credential will fail until it is replaced.",
    prerequisites: ["Refresh the token and rebuild the authorization header."],
  },
  strategy: {
    mechanism: "immediate_after_state_change",
    maxRetries: 1,
    requiresCallerDeadline: true,
  },
  safety: {
    idempotency: "operation_dependent",
    duplicateSideEffectRisk: "unknown",
    retryAmplificationRisk: "high",
    circuitBreaker: "consider",
    guidance: ["Coordinate concurrent refreshes with single-flight locking."],
  },
  telemetry: ["token_age_at_failure", "refresh_outcome", "retry_outcome"],
  tags: ["auth", "token", "http-401"],
  aliases: ["expired token", "stale token"],
  references: [
    {
      title: "RFC 6750, Section 3.1",
      url: "https://www.rfc-editor.org/rfc/rfc6750#section-3.1",
    },
  ],
} as const;

describe("policySchema", () => {
  it("accepts a retry that changes stale state first", () => {
    expect(policySchema.parse(expiredTokenPolicy).id).toBe(
      "auth-expired-access-token",
    );
  });

  it("rejects repeating unchanged stale state", () => {
    const result = policySchema.safeParse({
      ...expiredTokenPolicy,
      decision: {
        ...expiredTokenPolicy.decision,
        prerequisites: [],
      },
    });

    expect(result.success).toBe(false);
  });

  it("rejects a policy without actionable diagnostic checks", () => {
    const result = policySchema.safeParse({
      ...expiredTokenPolicy,
      diagnosis: { ...expiredTokenPolicy.diagnosis, checks: [] },
    });

    expect(result.success).toBe(false);
  });
});
