import { access } from "node:fs/promises";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";

export async function resolveDefaultCatalogDirectory(): Promise<string> {
  const moduleDirectory = dirname(fileURLToPath(import.meta.url));
  const candidates = [
    resolve(moduleDirectory, "../../catalog"),
    resolve(moduleDirectory, "../catalog"),
  ];

  for (const candidate of candidates) {
    try {
      await access(candidate);
      return candidate;
    } catch {
      // Try the packaged layout after the source-tree layout.
    }
  }

  throw new Error("Unable to locate the bundled Retry Atlas catalog");
}
