import { execFile } from "node:child_process";
import { mkdir, mkdtemp, readdir, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join, resolve } from "node:path";
import { promisify } from "node:util";

const execFileAsync = promisify(execFile);
const projectDirectory = process.cwd();
const temporaryDirectory = await mkdtemp(
  join(tmpdir(), "retry-atlas-package-"),
);
const pnpmCli = process.env.npm_execpath;

if (!pnpmCli) throw new Error("package:smoke must run through pnpm");

await execFileAsync(
  process.execPath,
  [pnpmCli, "pack", "--pack-destination", temporaryDirectory],
  { cwd: projectDirectory },
);

const archive = (await readdir(temporaryDirectory)).find((file) =>
  file.endsWith(".tgz"),
);
if (!archive) throw new Error("pnpm pack did not produce an archive");

const consumerDirectory = join(temporaryDirectory, "consumer");
await mkdir(consumerDirectory);
await writeFile(
  join(consumerDirectory, "package.json"),
  JSON.stringify({ private: true }),
  "utf8",
);
await execFileAsync(
  process.execPath,
  [pnpmCli, "add", "--ignore-scripts", resolve(temporaryDirectory, archive)],
  { cwd: consumerDirectory },
);

const executable = join(
  consumerDirectory,
  "node_modules",
  "retry-atlas",
  "dist",
  "index.js",
);
const search = await execFileAsync(
  process.execPath,
  [executable, "search", "stale token", "--json"],
  { cwd: consumerDirectory },
);
const policies = JSON.parse(search.stdout) as Array<{ id: string }>;
if (policies[0]?.id !== "auth-expired-access-token") {
  throw new Error("Installed CLI did not return the expired-token policy");
}

const validation = await execFileAsync(
  process.execPath,
  [executable, "validate"],
  {
    cwd: consumerDirectory,
  },
);
if (!validation.stdout.includes("Validated 16 policies.")) {
  throw new Error("Installed CLI could not validate its bundled catalog");
}

console.log("Package smoke test passed.");
