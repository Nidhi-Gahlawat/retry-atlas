import { z } from "zod";

const referenceSchema = z.object({
  title: z.string().min(1),
  url: z.url().refine((url) => url.startsWith("https://"), {
    message: "Reference URLs must use HTTPS",
  }),
});

const retryStrategySchema = z.object({
  mechanism: z.enum([
    "immediate_after_state_change",
    "server_directed",
    "exponential_backoff",
  ]),
  maxRetries: z.number().int().min(1).max(10),
  requiresCallerDeadline: z.literal(true),
  jitter: z.enum(["none", "full", "equal", "decorrelated"]).optional(),
  baseDelayMs: z.number().int().positive().optional(),
  maxDelayMs: z.number().int().positive().optional(),
});

export const policySchema = z
  .object({
    schemaVersion: z.literal("1.0.0"),
    id: z.string().regex(/^[a-z0-9]+(?:-[a-z0-9]+)*$/),
    title: z.string().min(1),
    summary: z.string().min(1),
    domain: z.enum(["authentication", "http", "network"]),
    classification: z.enum([
      "transient",
      "persistent_until_state_change",
      "permanent",
      "ambiguous_outcome",
    ]),
    signals: z.object({
      httpStatuses: z.array(z.number().int().min(100).max(599)).optional(),
      errorCodes: z.array(z.string().min(1)).optional(),
    }),
    decision: z.object({
      retry: z.enum(["yes", "no", "conditional"]),
      retrySameRequest: z.boolean(),
      rationale: z.string().min(1),
      prerequisites: z.array(z.string().min(1)).default([]),
    }),
    strategy: retryStrategySchema.optional(),
    safety: z.object({
      idempotency: z.enum(["not_required", "required", "operation_dependent"]),
      duplicateSideEffectRisk: z.enum(["none", "low", "high", "unknown"]),
      retryAmplificationRisk: z.enum(["low", "medium", "high"]),
      circuitBreaker: z.enum(["not_needed", "consider", "recommended"]),
      reconciliation: z.string().min(1).optional(),
      guidance: z.array(z.string().min(1)).min(1),
    }),
    telemetry: z.array(z.string().min(1)).min(1),
    tags: z.array(z.string().min(1)).min(1),
    aliases: z.array(z.string().min(1)).default([]),
    references: z.array(referenceSchema).min(1),
  })
  .superRefine((policy, context) => {
    if (policy.decision.retry === "no" && policy.strategy) {
      context.addIssue({
        code: "custom",
        path: ["strategy"],
        message: "A no-retry policy cannot define a retry strategy",
      });
    }

    if (
      !policy.decision.retrySameRequest &&
      policy.decision.prerequisites.length === 0
    ) {
      context.addIssue({
        code: "custom",
        path: ["decision", "prerequisites"],
        message: "A changed request must describe what changes before retry",
      });
    }

    if (policy.decision.retry !== "no" && !policy.strategy) {
      context.addIssue({
        code: "custom",
        path: ["strategy"],
        message: "A retryable policy must define a bounded strategy",
      });
    }

    if (
      policy.strategy?.baseDelayMs !== undefined &&
      policy.strategy.maxDelayMs !== undefined &&
      policy.strategy.baseDelayMs > policy.strategy.maxDelayMs
    ) {
      context.addIssue({
        code: "custom",
        path: ["strategy", "maxDelayMs"],
        message: "Maximum delay must be at least the base delay",
      });
    }

    if (
      policy.strategy?.jitter !== undefined &&
      policy.strategy.jitter !== "none" &&
      policy.strategy.mechanism !== "exponential_backoff"
    ) {
      context.addIssue({
        code: "custom",
        path: ["strategy", "jitter"],
        message: "Jitter is only valid with exponential backoff",
      });
    }
  });

export type Policy = z.infer<typeof policySchema>;
