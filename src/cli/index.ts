#!/usr/bin/env node

import { resolve } from "node:path";

import { Command, InvalidArgumentError } from "commander";

import { resolveDefaultCatalogDirectory } from "../catalog/default-directory.js";
import { loadCatalog } from "../catalog/loader.js";
import { searchPolicies } from "../catalog/search.js";
import {
  formatDiagnostic,
  formatPolicy,
  formatSearchResults,
  formatPolicySummary,
} from "../output/human.js";
import type { Policy } from "../schema/policy.js";

const program = new Command();

program
  .name("retry-atlas")
  .description(
    "Decide whether a failure should be retried and what must change.",
  )
  .version("0.0.0")
  .showSuggestionAfterError();

program
  .command("search")
  .description("Search retry policies")
  .argument("[query]", "failure, status, error code, or policy name")
  .option("--status <code>", "HTTP status code", parseStatus)
  .option("--code <code>", "protocol or runtime error code")
  .option("--domain <domain>", "authentication, http, or network", parseDomain)
  .option("--json", "emit JSON")
  .action(async (query: string | undefined, options: SearchCommandOptions) => {
    const policies = await builtInCatalog();
    const matches = searchPolicies(policies, { query, ...options });
    writeData(options.json, matches, formatSearchResults(matches, query));
  });

program
  .command("show")
  .description("Show one retry policy")
  .argument("<id>", "policy ID or exact alias")
  .option("--json", "emit JSON")
  .action(async (id: string, options: JsonOptions) => {
    const policies = await builtInCatalog();
    const normalizedId = id.toLowerCase();
    const policy = policies.find((candidate) => {
      return (
        candidate.id.toLowerCase() === normalizedId ||
        candidate.aliases.some((alias) => alias.toLowerCase() === normalizedId)
      );
    });

    if (!policy) {
      console.error(`Policy not found: ${id}`);
      process.exitCode = 3;
      return;
    }

    writeData(options.json, policy, formatPolicy(policy));
  });

program
  .command("list")
  .description("List retry policies")
  .option("--domain <domain>", "authentication, http, or network", parseDomain)
  .option("--decision <decision>", "yes, no, or conditional", parseDecision)
  .option("--json", "emit JSON")
  .action(async (options: ListCommandOptions) => {
    const policies = (await builtInCatalog()).filter((policy) => {
      return (
        (options.domain === undefined || policy.domain === options.domain) &&
        (options.decision === undefined ||
          policy.decision.retry === options.decision)
      );
    });
    writeData(
      options.json,
      policies,
      policies.map(formatPolicySummary).join("\n"),
    );
  });

program
  .command("validate")
  .description("Validate a Retry Atlas catalog")
  .argument("[path]", "catalog directory")
  .option("--json", "emit JSON")
  .action(async (path: string | undefined, options: JsonOptions) => {
    const directory = path
      ? resolve(path)
      : await resolveDefaultCatalogDirectory();
    const result = await loadCatalog(directory);

    if (options.json) {
      console.log(JSON.stringify(result, null, 2));
    } else if (result.diagnostics.length > 0) {
      for (const diagnostic of result.diagnostics) {
        console.error(formatDiagnostic(diagnostic));
      }
    } else {
      console.log(`Validated ${result.policies.length} policies.`);
    }

    if (result.diagnostics.length > 0) process.exitCode = 1;
  });

program.parseAsync().catch((error: unknown) => {
  console.error(error instanceof Error ? error.message : "Unexpected error");
  process.exitCode = 1;
});

interface JsonOptions {
  json?: boolean;
}

interface SearchCommandOptions extends JsonOptions {
  status?: number;
  code?: string;
  domain?: Policy["domain"];
}

interface ListCommandOptions extends JsonOptions {
  domain?: Policy["domain"];
  decision?: Policy["decision"]["retry"];
}

async function builtInCatalog(): Promise<Policy[]> {
  const result = await loadCatalog(await resolveDefaultCatalogDirectory());
  if (result.diagnostics.length > 0) {
    throw new Error(result.diagnostics.map(formatDiagnostic).join("\n"));
  }
  return result.policies;
}

function writeData(
  json: boolean | undefined,
  value: unknown,
  human: string,
): void {
  console.log(json ? JSON.stringify(value, null, 2) : human);
}

function parseStatus(value: string): number {
  const status = Number(value);
  if (!Number.isInteger(status) || status < 100 || status > 599) {
    throw new InvalidArgumentError("status must be an integer from 100 to 599");
  }
  return status;
}

function parseDomain(value: string): Policy["domain"] {
  if (value === "authentication" || value === "http" || value === "network") {
    return value;
  }
  throw new InvalidArgumentError(
    "domain must be authentication, http, or network",
  );
}

function parseDecision(value: string): Policy["decision"]["retry"] {
  if (value === "yes" || value === "no" || value === "conditional")
    return value;
  throw new InvalidArgumentError("decision must be yes, no, or conditional");
}
