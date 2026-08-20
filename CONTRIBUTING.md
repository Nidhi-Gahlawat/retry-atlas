# Contributing to Retry Atlas

Policy contributions are welcome when they make a retry decision more precise and verifiable.

1. Read [`docs/policy-authoring.md`](docs/policy-authoring.md).
2. Add or update a narrowly scoped YAML file in [`catalog`](catalog).
3. Name the file exactly after its policy `id`.
4. Include authoritative references and explain state change, idempotency, and load risk.
5. Add a focused test when changing schema or search behavior.
6. Run the project checks documented in the README.

Please keep framework-specific generators, source scanners, and new public extension points out of policy pull requests. Those features need separate design discussion after the core schema has real-world usage.
