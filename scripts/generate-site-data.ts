import { mkdir, writeFile } from "node:fs/promises";
import { dirname, resolve } from "node:path";

import { loadCatalog } from "../src/catalog/loader.js";

const catalog = await loadCatalog(resolve("catalog"));

if (catalog.diagnostics.length > 0) {
  throw new Error(
    catalog.diagnostics
      .map((diagnostic) => {
        const location = diagnostic.path
          ? `${diagnostic.file}:${diagnostic.path}`
          : diagnostic.file;
        return `${location}: ${diagnostic.message}`;
      })
      .join("\n"),
  );
}

const outputPath = resolve("site/public/catalog.json");
await mkdir(dirname(outputPath), { recursive: true });
await writeFile(outputPath, `${JSON.stringify(catalog.policies, null, 2)}\n`);

console.log(`Generated site data for ${catalog.policies.length} policies.`);
