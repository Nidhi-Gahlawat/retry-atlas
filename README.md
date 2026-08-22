# Retry Atlas

Retry Atlas is a cited decision catalog for answering a deceptively hard question:

> If this fails again, what exactly will be different on the next attempt?

It is not a retry implementation library and its policy values are not drop-in production configuration. It helps engineers classify failures, identify required state changes, account for idempotency and load amplification, and choose whether a bounded retry is defensible.

## Try it locally

Requires Node.js 20 or newer. The repository pins pnpm through `packageManager`; when pnpm is not installed globally, prefix commands with `npx pnpm@10.15.0`.

```bash
pnpm install
pnpm dev search "stale token"
pnpm dev search --status 429
pnpm dev show auth-expired-access-token
pnpm dev validate
```

Machine-readable output is available on every data command:

```bash
pnpm dev search --code ECONNRESET --json
pnpm dev list --domain network --json
pnpm dev validate --json
```

## Web interface

The static interface searches the same validated catalog and uses the same
ranking logic as the CLI.

```bash
pnpm site:dev
```

Build the deployable site in `site-dist` with:

```bash
pnpm site:build
pnpm site:preview
```

The Pages workflow deploys that output after a push to `main`. In the GitHub
repository settings, set **Pages > Build and deployment > Source** to
**GitHub Actions** before the first deployment.

## The review questions

Every catalog entry must answer three questions:

1. Why did the first request fail?
2. What makes another attempt more likely to succeed?
3. What happens if the first request actually succeeded?

An expired access token, for example, is not fixed by repeating the same request. The credential must be invalidated and refreshed first, concurrent refreshes should be coordinated, and replaying the original operation still requires an idempotency decision.

## Commands

| Command                       | Purpose                                                 |
| ----------------------------- | ------------------------------------------------------- |
| `retry-atlas search [query]`  | Search by text, status, error code, or domain           |
| `retry-atlas show <id>`       | Explain one policy, led by its retry decision           |
| `retry-atlas list`            | List policies with optional domain and decision filters |
| `retry-atlas validate [path]` | Validate the bundled or an external YAML catalog        |

Use `retry-atlas <command> --help` for complete options. Exit code `0` means success, including no search matches; `1` means a runtime or invalid-catalog failure; Commander uses a nonzero usage error for invalid arguments; and `3` means a requested policy was not found.

## Catalog

The 16-policy catalog covers authentication failures, HTTP client and server errors, overload and timeout responses, connection failures, and DNS resolution. HTTP coverage includes bad requests, conflicts, validation failures, internal errors, bad gateways, and gateway timeouts. Policies live in [`catalog`](catalog), follow the generated [`retry-policy.schema.json`](schemas/retry-policy.schema.json), and cite standards or authoritative operational guidance.

See [`docs/policy-authoring.md`](docs/policy-authoring.md) before proposing a policy.

## Development

```bash
pnpm catalog:validate
pnpm schema:check
pnpm typecheck
pnpm test
pnpm build
```

Retry Atlas is deliberately local and deterministic: normal searches and validation do not make network requests. Reference availability should be checked separately so transient network failures cannot make ordinary validation flaky.
