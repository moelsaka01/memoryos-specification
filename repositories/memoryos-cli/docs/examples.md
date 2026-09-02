# CLI Examples

## Purpose

These examples use explicit identifiers and files. They never inject controller state, derive a package, or infer a semantic selection. Assume `investigation.mip` contains Trace `trace-observation-b` and Evolution `evolution-observation-a-observation-b`.

## Version and help

```sh
memoryos version
memoryos version --json
memoryos help
memoryos help replay
```

## Observe

```sh
memoryos observe \
  --workspace workspace.json \
  --snapshot snapshot.json \
  --id observation-example
```

Optional observation inputs remain explicit:

```sh
memoryos observe \
  --workspace workspace.json \
  --snapshot snapshot.json \
  --query query.json \
  --operation Observe \
  --result-code OK \
  --json
```

## Trace

```sh
memoryos trace investigation.mip \
  --reflection trace-observation-b \
  --json
```

## Replay

Open Replay without advancing it:

```sh
memoryos replay investigation.mip --trace trace-observation-b
```

Apply explicit SDK actions in order:

```sh
memoryos replay investigation.mip \
  --trace trace-observation-b \
  --action next \
  --action pause \
  --action play \
  --json
```

## Compare

```sh
memoryos compare investigation.mip \
  --trace trace-observation-b \
  --evolution evolution-observation-a-observation-b \
  --json
```

This is single-Investigation comparison. `memoryos compare left.mip right.mip` is unsupported because the frozen SDK does not combine investigations.

## Cognitive regression

Compare two complete investigations:

```sh
memoryos regression baseline.mip candidate.mip
memoryos regression baseline.mip candidate.mip --json
```

The SDK returns observed differences in Replay, Reflection, Evidence, Retrieval, Evolution, Verification, transition history, and lifecycle. The CLI renders that report without interpreting it. The `compare` command remains the single-Investigation Evolution workflow; `regression` is the explicit two-Investigation analysis.

## Verify, import, export, and inspect

```sh
memoryos verify investigation.mip
memoryos verify investigation.mip --json
memoryos import investigation.mip --id imported-example --json
memoryos export investigation.mip --output exported.mip
memoryos verify exported.mip
memoryos inspect investigation.mip
memoryos inspect investigation.mip --json
```

POSIX byte stream:

```sh
memoryos export investigation.mip --output - | memoryos verify -
```

Export is byte-identical to the package returned by the SDK. The CLI does not serialize a native Investigation into a new MIP.

## Session and checkpoint restoration

Create `workflow.memoryos`:

```jsonl
{"command":"import","package":"investigation.mip","identifier":"session-example"}
{"command":"checkpoint","name":"imported"}
{"command":"restore","name":"imported"}
{"command":"trace","reflection":"trace-observation-b"}
{"command":"replay","action":"open"}
{"command":"replay","action":"next"}
{"command":"inspect"}
```

```sh
memoryos session workflow.memoryos --json
memoryos session --json < workflow.memoryos
```

`imported` is a process-local lookup name, not serialized Checkpoint data. The actual opaque object never leaves the live process. A Checkpoint is integrity-bound rather than a rollback snapshot; after another authoritative transition, restoring the stale Checkpoint is rejected by the Core.

## Executable conformance example

From `repositories/memoryos-cli`:

```sh
npm run test:examples
```

[`../examples/run-cli-examples.mjs`](../examples/run-cli-examples.mjs) materializes temporary inputs from the released `referenceSnapshot` and approved complete MIP fixture, runs all twelve top-level commands, verifies exact export bytes, and exercises checkpoint/restore in one live session.
