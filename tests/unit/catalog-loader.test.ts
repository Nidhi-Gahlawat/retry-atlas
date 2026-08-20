import { mkdtemp, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";

import { describe, expect, it } from "vitest";

import { loadCatalog } from "../../src/catalog/loader.js";

describe("loadCatalog", () => {
  it("loads the built-in catalog without diagnostics", async () => {
    const result = await loadCatalog(join(process.cwd(), "catalog"));

    expect(result.diagnostics).toEqual([]);
    expect(result.policies).toHaveLength(10);
    expect(result.policies.map((policy) => policy.id)).toContain(
      "network-read-timeout",
    );
  });

  it("reports malformed YAML against its source file", async () => {
    const directory = await mkdtemp(join(tmpdir(), "retry-atlas-"));
    await writeFile(join(directory, "broken.yaml"), "decision: [\n", "utf8");

    const result = await loadCatalog(directory);

    expect(result.diagnostics[0]?.file).toBe("broken.yaml");
    expect(result.policies).toEqual([]);
  });
});
