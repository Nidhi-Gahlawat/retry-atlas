import { mkdir, readFile, writeFile } from "node:fs/promises";
import { dirname, resolve } from "node:path";

import prettier from "prettier";
import { z } from "zod";

import { policySchema } from "../src/schema/policy.js";

const outputPath = resolve("schemas/retry-policy.schema.json");
const generated = await prettier.format(
  JSON.stringify({
    $id: "https://retry-atlas.dev/schemas/retry-policy.schema.json",
    title: "Retry Atlas policy",
    ...z.toJSONSchema(policySchema),
  }),
  { parser: "json" },
);

if (process.argv.includes("--check")) {
  let existing = "";
  try {
    existing = await readFile(outputPath, "utf8");
  } catch {
    // The comparison below provides the actionable error.
  }

  if (existing !== generated) {
    console.error("JSON Schema is stale. Run pnpm schema:generate.");
    process.exitCode = 1;
  } else {
    console.log("JSON Schema is up to date.");
  }
} else {
  await mkdir(dirname(outputPath), { recursive: true });
  await writeFile(outputPath, generated, "utf8");
  console.log(`Generated ${outputPath}`);
}
