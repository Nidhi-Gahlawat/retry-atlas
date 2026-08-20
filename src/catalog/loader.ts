import { readdir, readFile } from "node:fs/promises";
import { basename, extname, join } from "node:path";

import { parse } from "yaml";

import { type Policy, policySchema } from "../schema/policy.js";

export interface CatalogDiagnostic {
  file: string;
  path: string;
  message: string;
}

export interface CatalogResult {
  policies: Policy[];
  diagnostics: CatalogDiagnostic[];
}

const policyFileExtensions = new Set([".yaml", ".yml"]);

export async function loadCatalog(directory: string): Promise<CatalogResult> {
  const files = (await readdir(directory))
    .filter((file) => {
      return !file.startsWith("_") && policyFileExtensions.has(extname(file));
    })
    .sort();

  const policies: Policy[] = [];
  const diagnostics: CatalogDiagnostic[] = [];

  for (const file of files) {
    const filePath = join(directory, file);
    let input: unknown;

    try {
      input = parse(await readFile(filePath, "utf8"));
    } catch (error) {
      diagnostics.push({
        file,
        path: "",
        message:
          error instanceof Error ? error.message : "Unable to parse YAML",
      });
      continue;
    }

    const result = policySchema.safeParse(input);
    if (!result.success) {
      for (const issue of result.error.issues) {
        diagnostics.push({
          file,
          path: issue.path.join("."),
          message: issue.message,
        });
      }
      continue;
    }

    if (basename(file, extname(file)) !== result.data.id) {
      diagnostics.push({
        file,
        path: "id",
        message: `Filename must match policy ID "${result.data.id}"`,
      });
      continue;
    }

    policies.push(result.data);
  }

  validateUniqueKeys(policies, diagnostics);
  return { policies, diagnostics };
}

function validateUniqueKeys(
  policies: Policy[],
  diagnostics: CatalogDiagnostic[],
): void {
  const owners = new Map<string, string>();

  for (const policy of policies) {
    for (const key of [policy.id, ...policy.aliases]) {
      const normalized = key.toLowerCase();
      const owner = owners.get(normalized);
      if (owner) {
        diagnostics.push({
          file: `${policy.id}.yaml`,
          path: key === policy.id ? "id" : "aliases",
          message: `Catalog key "${key}" is already used by "${owner}"`,
        });
      } else {
        owners.set(normalized, policy.id);
      }
    }
  }
}
