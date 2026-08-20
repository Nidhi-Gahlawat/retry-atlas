import { execFile } from "node:child_process";
import { promisify } from "node:util";

import { describe, expect, it } from "vitest";

const execFileAsync = promisify(execFile);
const cliArguments = ["--import", "tsx", "src/cli/index.ts"];

async function runCli(...arguments_: string[]) {
  return execFileAsync(process.execPath, [...cliArguments, ...arguments_], {
    cwd: process.cwd(),
  });
}

describe("retry-atlas CLI", () => {
  it("labels human search results and points to full guidance", async () => {
    const { stdout, stderr } = await runCli("search", "service unavailable");

    expect(stderr).toBe("");
    expect(stdout).toContain("POLICY");
    expect(stdout).toContain("RETRY");
    expect(stdout).toContain("DESCRIPTION");
    expect(stdout).toContain("http-503-service-unavailable");
    expect(stdout).toContain("retry-atlas show http-503-service-unavailable");
  });

  it("searches by HTTP status as JSON", async () => {
    const { stdout, stderr } = await runCli(
      "search",
      "--status",
      "429",
      "--json",
    );
    const policies = JSON.parse(stdout) as Array<{ id: string }>;

    expect(stderr).toBe("");
    expect(policies.map((policy) => policy.id)).toEqual([
      "http-429-rate-limited",
    ]);
  });

  it("explains what changes before an expired-token retry", async () => {
    const { stdout } = await runCli("show", "auth-expired-access-token");

    expect(stdout).toContain("Retry identical request: no");
    expect(stdout).toContain("What must change");
    expect(stdout).toContain("refresh it once");
  });

  it("returns an empty JSON array when a search has no matches", async () => {
    const { stdout } = await runCli("search", "not-a-real-failure", "--json");
    expect(JSON.parse(stdout)).toEqual([]);
  });

  it("explains when a human search has no matches", async () => {
    const { stdout, stderr } = await runCli("search", "gateway failure");

    expect(stderr).toBe("");
    expect(stdout).toContain('No policies matched "gateway failure".');
    expect(stdout).toContain("retry-atlas list");
  });
});
