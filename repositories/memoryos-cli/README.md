# MemoryOS CLI

The official command-line client for the MemoryOS SDK. It exposes deterministic investigation workflows to terminals, scripts, and CI without reimplementing Runtime, Investigation Core, or Memory Investigation Package (MIP) behavior.

```text
MemoryOS Runtime
        |
Investigation Core
        |
MemoryOS SDK
        |
MemoryOS CLI
```

The CLI is deliberately thin: it validates command input, invokes the public SDK, and renders deterministic human-readable or JSON output. All investigation state transitions, trace construction, replay, comparison, cognitive regression, package verification, and checkpoint validity remain SDK-owned.

## Install

MemoryOS CLI requires Node.js 20 or later and has no third-party runtime dependencies.

From the workspace root, invoke the production entry point directly:

```sh
node repositories/memoryos-cli/bin/memoryos.js version
```

An optional local npm link keeps the executable connected to this workspace checkout:

```sh
cd repositories/memoryos-cli
npm link
memoryos version
```

## Quick example

```sh
memoryos verify investigation.mip
memoryos inspect investigation.mip --json
memoryos trace investigation.mip --reflection trace-observation-b
memoryos replay investigation.mip --trace trace-observation-b --action next
memoryos compare investigation.mip --trace trace-observation-b \
  --evolution evolution-observation-a-observation-b
memoryos regression baseline.mip candidate.mip --json
```

The stateless `replay` and `compare` commands require an exact `--trace` selector because the frozen SDK requires the Trace lifecycle transition before Replay. `compare` enters authored Evolution within one package. `regression` separately asks the SDK to compare two complete investigations and never computes differences in the CLI.

## Commands

| Command | Purpose |
|---|---|
| `version` | Report CLI and SDK versions. |
| `help` | Display complete or command-specific usage. |
| `observe` | Observe an explicit Workspace snapshot. |
| `trace` | Select an exact Reflection or package Trace. |
| `replay` | Open Replay and apply explicit Replay actions. |
| `compare` | Enter an authored Evolution in one package. |
| `regression` | Report deterministic cognitive differences between two investigations. |
| `verify` | Delegate MIP verification to the SDK. |
| `import` | Import a deterministic MIP. |
| `export` | Export the exact package backing an Investigation. |
| `inspect` | Display deterministic Investigation metadata. |
| `session` | Execute a live JSON Lines SDK session. |

Checkpoint and restore are session actions, not portable top-level commands. A checkpoint is an opaque, integrity-bound SDK object kept in the current process and never serialized. It is not a rollback snapshot: restore succeeds only while authoritative transition history still matches.

## Documentation

- [CLI Quick Start](docs/quick-start.md)
- [Command Reference](docs/command-reference.md)
- [Examples](docs/examples.md)
- [Exit Code Reference](docs/exit-code-reference.md)
- [Deterministic JSON Output](docs/json-output-specification.md)
- [Automation Guide](docs/automation-guide.md)
- [MO-1205 Conformance Report](docs/conformance-report.md)
- [MO-1206 Regression Conformance Report](docs/regression-conformance-report.md)

## Validate

```sh
npm test
npm run test:examples
```

The example runner creates temporary inputs from the released `referenceSnapshot` and approved complete MIP fixture, invokes every top-level command through `bin/memoryos.js`, verifies byte-exact export, and exercises live-session checkpoint restoration.
