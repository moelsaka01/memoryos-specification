# MemoryOS CLI Command Reference

## Purpose

This reference defines the complete MO-1205 command surface. Options appear after the command. Every command is non-interactive.

## `memoryos version`

```text
memoryos version [--json]
```

Returns the CLI and public SDK versions.

## `memoryos help`

```text
memoryos help [COMMAND] [--json]
```

Returns complete help or exact syntax for one supported command. Unknown topics fail with exit code `1`.

## `memoryos observe`

```text
memoryos observe --workspace FILE --snapshot FILE [OPTIONS]
```

Required:

- `--workspace FILE`: JSON object with a non-empty `identifier` string.
- `--snapshot FILE`: complete deterministic observation snapshot JSON object.

Optional:

- `--id ID`: explicit Investigation identifier.
- `--operation NAME`: explicit observation operation.
- `--query FILE`: JSON object passed as the SDK observation query.
- `--result-code CODE`: explicit result code.
- `--json`: deterministic JSON output.

The command opens the exact Workspace and delegates observation to the SDK. It does not infer missing input. Native observations are not automatically package-backed.

## `memoryos trace`

```text
memoryos trace PACKAGE --reflection ID [--id ID] [--json]
```

Imports `PACKAGE`, then passes `ID` unchanged to the SDK Trace operation. For an imported package, `ID` is the exact authored Trace selector accepted by the SDK. `--id` explicitly assigns the local imported Investigation identifier.

## `memoryos replay`

```text
memoryos replay PACKAGE --trace ID [--action ACTION ...] [--id ID] [--json]
```

Imports `PACKAGE`, applies the exact Trace selector, opens Replay, and applies each requested action in argument order. Supported actions are `play`, `pause`, `restart`, `previous`, `next`, and `advance`.

With no `--action`, the command returns the SDK Replay state immediately after Replay is opened. `--trace` is mandatory because each top-level invocation has a fresh SDK lifecycle; the CLI does not infer or persist a previous Trace selection.

## `memoryos compare`

```text
memoryos compare PACKAGE --trace ID --evolution ID [--id ID] [--json]
```

Imports one package, applies its exact Trace selector, advances that finite Replay through SDK actions until complete, and enters the exact authored Evolution. The result reports `replaySteps` as an automation fact.

Comparison never accepts two package operands and never constructs, merges, or infers Evolution data. Both `--trace` and `--evolution` are mandatory because they are frozen SDK lifecycle inputs.

## `memoryos regression`

```text
memoryos regression BASELINE CANDIDATE [--json]
```

Imports the two MIP inputs through one SDK binding and passes the resulting Investigations directly to `MemoryOS.regression()`. The CLI assigns deterministic process-local role identifiers to avoid an import collision; the SDK compares package source truth rather than those aliases.

The operation reports the fixed SDK categories `replay`, `reflection`, `evidence`, `retrieval`, `evolution`, `verification`, `transition`, and `lifecycle`. It does not explain, infer, summarize, rank, or modify either Investigation. `BASELINE` and `CANDIDATE` may each be a file path; at most one may be `-` for standard input.

Regression detection is a successful analysis and returns exit code `0`. Invalid package transport or import remains a package error, and cross-Workspace inputs are rejected by the SDK as a validation failure.

## `memoryos investigate`

```text
memoryos investigate REPORT [--category CATEGORY] [--reflection ID] [--transition TRANSITION] [--json]
```

Reads a raw Regression Report or the successful JSON envelope produced by `memoryos regression --json`, then passes it and the explicit query directly to `MemoryOS.investigate()`.

`--category` accepts `replay`, `reflection`, `evidence`, `retrieval`, `evolution`, `verification`, `transition`, or `lifecycle`. `--reflection` selects an exact Reflection identifier. `--transition` selects an exact transition token using the SDK's deterministic normalization. Reflection and transition selectors are mutually exclusive. A Reflection selector may only be combined with category `reflection`; a transition selector may only be combined with category `transition` or `lifecycle`. These constraints and all matching behavior are SDK-owned.

With no selector, the result contains every observed Regression difference in SDK order. A valid query with no matches succeeds with status `empty`. Use `-` to read the JSON report from standard input.

## `memoryos verify`

```text
memoryos verify PACKAGE [--json]
```

Delegates package verification to the SDK. Use `-` for package bytes from standard input. Invalid packages return exit code `3` and deterministic diagnostics.

## `memoryos import`

```text
memoryos import PACKAGE [--id ID] [--json]
```

Imports a valid MIP through the SDK and reports deterministic Investigation metadata. Use `-` to read package bytes from standard input.

## `memoryos export`

```text
memoryos export PACKAGE --output FILE|- [--id ID] [--json]
```

Imports the package, asks the SDK to export its backing MIP, and writes the exact returned bytes. `--output -` writes raw package bytes to standard output and cannot be combined with `--json`. Native observations without a valid MIP artifact are not fabricated into packages.

## `memoryos inspect`

```text
memoryos inspect PACKAGE [--id ID] [--json]
```

Imports a package and displays deterministic metadata: availability, identifier, lifecycle, phase, source kind, transition count, transition log digest, and Workspace identifier.

## `memoryos session`

```text
memoryos session [WORKFLOW.memoryos] [--json]
```

Executes one JSON object per non-empty input line. Without a file, input is read from standard input. Processing stops on the first error and returns its deterministic exit code.

| `command` | Required fields | Meaning |
|---|---|---|
| `version` | none | Report CLI and SDK versions. |
| `observe` | `workspace`, `snapshot` | Observe explicit files in the live SDK binding. |
| `import` | `package` | Import a package as the current Investigation. |
| `trace` | `reflection` | Apply an exact Trace selection. |
| `replay` | `action` | Open or advance the current Replay. |
| `compare` | `evolution` | Enter an exact Evolution after Replay completion. |
| `checkpoint` | `name` | Store an opaque SDK Checkpoint under a session-local name. |
| `restore` | `name` | Restore that exact object through the same SDK binding. |
| `verify` | none or `package` | Verify the current Investigation or an explicit package. |
| `export` | `output` | Export the current package-backed Investigation. |
| `inspect` | none | Report current Investigation metadata. |

Replay session actions are `open`, `play`, `pause`, `restart`, `previous`, `next`, and `advance`. A session never serializes Checkpoints. The caller-supplied `name` is only a key in the process-local object map. Checkpoints are integrity-bound, not rollback snapshots: restore is valid only in the same SDK binding while authoritative transition history still matches.

Regression is a standalone two-package command. It is not a session record and does not change the session's one-current-Investigation contract.

Regression Report investigation is also a standalone command and is not a session record.

## Common option

`--json` selects the deterministic JSON envelope documented in [JSON Output Specification](json-output-specification.md). There are no colors, timestamps, prompts, progress spinners, or random values in either output mode.
