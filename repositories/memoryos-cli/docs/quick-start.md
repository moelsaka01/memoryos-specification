# CLI Quick Start

## Purpose

This guide runs the official MemoryOS CLI as a standalone consumer of the public MemoryOS SDK.

## Prerequisites

- Node.js 20 or later
- A Workspace descriptor containing an explicit `identifier`
- A deterministic observation snapshot for `observe`
- A valid Memory Investigation Package for package-backed commands

No network access or third-party runtime package is required.

## Install the executable

From the workspace root, use the production entry point directly:

```sh
node repositories/memoryos-cli/bin/memoryos.js version
```

An optional local link preserves the sibling-SDK relationship in this checkout:

```sh
npm link ./repositories/memoryos-cli
npx --no-install memoryos version
```

The CLI is not documented as a separately packed artifact because its JavaScript SDK facade remains in sibling repository `cca-studio`. All following examples use `memoryos` for readability; substitute `node repositories/memoryos-cli/bin/memoryos.js` for the direct checkout invocation, or prefix `memoryos` with `npx --no-install` after creating the local link.

## Observe explicit input

Create `workspace.json`:

```json
{"identifier":"workspace-memoryos-release"}
```

Provide a complete SDK-supported snapshot in `snapshot.json`, then run:

```sh
memoryos observe \
  --workspace workspace.json \
  --snapshot snapshot.json \
  --id investigation-local
```

There is no parameterless observation. The CLI never invents a Workspace, snapshot, Reflection, or Investigation identifier.

## Inspect and verify a package

```sh
memoryos verify investigation.mip
memoryos inspect investigation.mip
memoryos inspect investigation.mip --json
```

`verify` delegates package verification to the SDK. `inspect` imports the package and returns deterministic Investigation metadata.

## Trace, replay, and compare

```sh
memoryos trace investigation.mip --reflection trace-observation-b

memoryos replay investigation.mip \
  --trace trace-observation-b \
  --action next \
  --action next

memoryos compare investigation.mip \
  --trace trace-observation-b \
  --evolution evolution-observation-a-observation-b
```

These stateless commands begin with a fresh SDK instance. Consequently, `replay` and `compare` require the exact `--trace` selector needed to establish the frozen SDK lifecycle. The selector is not inferred. `compare` operates on one Investigation containing the named Evolution; two-package comparison is intentionally unsupported.

## Export an existing package

```sh
memoryos export investigation.mip --output investigation-copy.mip
memoryos verify investigation-copy.mip
```

Export preserves the exact canonical package bytes. A native observation without MIP backing cannot be exported and fails safely through the SDK.

To write package bytes to standard output:

```sh
memoryos export investigation.mip --output - > investigation-copy.mip
```

Raw package output cannot be combined with `--json`.

## Run a live session

Session input is newline-delimited JSON. It is the only CLI mode that preserves one live SDK binding across multiple actions.

```jsonl
{"command":"import","package":"investigation.mip"}
{"command":"checkpoint","name":"before-trace"}
{"command":"restore","name":"before-trace"}
{"command":"trace","reflection":"trace-observation-b"}
{"command":"replay","action":"open"}
{"command":"replay","action":"next"}
{"command":"inspect"}
```

```sh
memoryos session workflow.memoryos --json
```

Checkpoint values are opaque, integrity-bound SDK objects held only in that running process. They are not rollback snapshots: restoration succeeds only in the same SDK session while authoritative transition history still matches, so this example restores immediately before making another transition. The stream contains a caller-assigned lookup name, never serialized state or a portable credential.

## Run the canonical examples

```sh
npm run test:examples
```

The runner uses the approved complete MIP fixture and released Studio `referenceSnapshot`, invokes all eleven top-level commands, and checks session-only checkpoint/restore behavior.
