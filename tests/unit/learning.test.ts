import { describe, expect, it } from "vitest";

import {
  learningConcepts,
  searchLearningConcepts,
} from "../../site/src/learning.js";

describe("searchLearningConcepts", () => {
  it("finds an exact concept alias", () => {
    expect(searchLearningConcepts("idempotency")[0]?.id).toBe(
      "safe-and-idempotent",
    );
  });

  it("normalizes protocol terminology", () => {
    expect(searchLearningConcepts("Retry-After")[0]?.id).toBe(
      "server-directed-delay",
    );
  });

  it("finds concepts by explanatory content", () => {
    expect(searchLearningConcepts("several layers multiply")[0]?.id).toBe(
      "retry-budgets",
    );
  });

  it.each(["p-retry", "Tenacity", "Resilience4j", "Polly", "gRPC retry"])(
    "finds library guidance for %s",
    (query) => {
      expect(searchLearningConcepts(query)[0]?.id).toBe("retry-libraries");
    },
  );

  it("does not return concepts for blank or unrelated queries", () => {
    expect(searchLearningConcepts(" ")).toEqual([]);
    expect(searchLearningConcepts("smtp mailbox quota")).toEqual([]);
  });

  it("keeps concept identifiers and references unique", () => {
    expect(new Set(learningConcepts.map((concept) => concept.id)).size).toBe(
      learningConcepts.length,
    );

    for (const concept of learningConcepts) {
      const referenceUrls = concept.references.map(
        (reference) => reference.url,
      );
      expect(new Set(referenceUrls).size).toBe(referenceUrls.length);
    }
  });
});
