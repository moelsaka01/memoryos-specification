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

The CLI is deliberately thin: it validates command input, invokes the public SDK, and renders deterministic human-readable or JSON output. All investigation state transitions, trace construction, replay, comparison, cognitive regression, Regression Report navigation, package verification, checkpoint validity, and Investigation Policy semantics remain SDK-owned.

CCA-MEMORYOS-1.0 standardizes the released automation boundary. CLI 1.1.0
adds the MO-1301 `policy` namespace without changing CLI 1.0 commands or their
schema-1.0 envelopes. The Policy, evaluator, fact-model, and outcome contracts
remain normative version 1.0.0 and are reported separately by `policy identities`.

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
memoryos investigate regression.json --reflection reflection-001 --json
memoryos policy validate --policy investigation.memoryos-policy.json --json
memoryos policy evaluate --policy investigation.memoryos-policy.json \
  --package investigation.mip \
  --outcome evaluation.memoryos-policy-evaluation-outcome.json
```

The stateless `replay` and `compare` commands require an exact `--trace` selector because the frozen SDK requires the Trace lifecycle transition before Replay. `compare` enters authored Evolution within one package. `regression` separately asks the SDK to compare two complete investigations. `investigate` navigates the resulting deterministic report through the SDK. Neither command computes differences or navigation in the CLI.

## Commands

| Command | Purpose |
|---|---|
| `policy` | Validate, digest, inspect, evaluate, and verify Investigation Policy artifacts. |
| `version` | Report CLI and SDK versions. |
| `help` | Display complete or command-specific usage. |
| `observe` | Observe an explicit Workspace snapshot. |
| `trace` | Select an exact Reflection or package Trace. |
| `replay` | Open Replay and apply explicit Replay actions. |
| `compare` | Enter an authored Evolution in one package. |
| `regression` | Report deterministic cognitive differences between two investigations. |
| `investigate` | Navigate exact facts in a deterministic Regression Report. |
| `verify` | Delegate MIP verification to the SDK. |
| `import` | Import a deterministic MIP. |
| `export` | Export the exact package backing an Investigation. |
| `inspect` | Display deterministic Investigation metadata. |
| `session` | Execute a live JSON Lines SDK session. |

Checkpoint and restore are session actions, not portable top-level commands. A checkpoint is an opaque, integrity-bound SDK object kept in the current process and never serialized. It is not a rollback snapshot: restore succeeds only while authoritative transition history still matches.

## Documentation

- [CLI Quick Start](docs/quick-start.md)
- [Investigation Policy CLI Guide](docs/policy-guide.md)
- [MO-1301 CLI 1.1 Conformance Report](docs/policy-conformance-report.md)
- [Command Reference](docs/command-reference.md)
- [Examples](docs/examples.md)
- [Exit Code Reference](docs/exit-code-reference.md)
- [Deterministic JSON Output](docs/json-output-specification.md)
- [Automation Guide](docs/automation-guide.md)
- [MO-1205 Conformance Report](docs/conformance-report.md)
- [MO-1206 Regression Conformance Report](docs/regression-conformance-report.md)
- [Regression Investigation Guide](docs/investigation-guide.md)
- [MO-1207 Investigation Conformance Report](docs/investigation-conformance-report.md)
- [Official MemoryOS Standard conformance suite](../cca-conformance/README.md)

## Validate

```sh
npm test
npm run test:examples
```

The example runner creates temporary inputs from the released `referenceSnapshot` and approved complete MIP fixture, invokes every top-level command through `bin/memoryos.js`, verifies byte-exact export, and exercises live-session checkpoint restoration.
