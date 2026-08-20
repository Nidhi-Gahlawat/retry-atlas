import { resolve } from "node:path";

import { loadCatalog } from "../src/catalog/loader.js";

const directory = resolve(process.argv[2] ?? "catalog");
const result = await loadCatalog(directory);

if (result.diagnostics.length > 0) {
  for (const diagnostic of result.diagnostics) {
    const location = diagnostic.path
      ? `${diagnostic.file}:${diagnostic.path}`
      : diagnostic.file;
    console.error(`${location}: ${diagnostic.message}`);
  }
  process.exitCode = 1;
} else {
  console.log(`Validated ${result.policies.length} policies.`);
}
