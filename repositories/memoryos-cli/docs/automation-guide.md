# CLI Automation Guide

## Purpose

MemoryOS CLI provides deterministic, non-interactive access to the public SDK for scripts and CI.

## Automation contract

- Every input is explicit.
- Every command terminates without a prompt.
- Standard output contains only requested success output or raw export bytes.
- Standalone errors are written to standard error.
- Session JSON mode emits ordered JSON Lines to standard output.
- Process exit codes are stable and documented.
- JSON contains no timestamps, colors, randomness, or presentation state.

## CI verification

```sh
memoryos verify artifacts/investigation.mip --json > artifacts/verification.json
memoryos inspect artifacts/investigation.mip --json > artifacts/investigation.json
```

Treat any non-zero exit code as failure. Do not parse human-readable output in automation.

## Package pipelines

On byte-preserving POSIX shells:

```sh
memoryos export source.mip --output - | memoryos verify - --json
```

For shells whose redirection may transcode native-process bytes, use an explicit file:

```powershell
memoryos export source.mip --output exported.mip --json
if ($LASTEXITCODE -ne 0) { exit $LASTEXITCODE }
memoryos verify exported.mip --json
if ($LASTEXITCODE -ne 0) { exit $LASTEXITCODE }
```

## Replay and comparison

Stateless Replay requires the exact Trace selector:

```sh
memoryos replay investigation.mip --trace trace-observation-b --action next --json
```

Repeated `--action` options are applied in command-line order. Comparison also requires the exact Trace and authored Evolution:

```sh
memoryos compare investigation.mip \
  --trace trace-observation-b \
  --evolution evolution-observation-a-observation-b \
  --json
```

The CLI applies the explicit Trace, completes finite SDK Replay, and enters the explicit Evolution. It never compares package files, constructs an Evolution, or infers a selector.

## Cognitive regression

Regression accepts two explicit package inputs and delegates the complete comparison to the SDK:

```sh
memoryos regression baseline.mip candidate.mip --json > regression.json
```

The command exits with `0` when the deterministic analysis completes, including when `regressionDetected` is `true`. Automation should inspect the report rather than reinterpret process status:

```sh
memoryos regression baseline.mip candidate.mip --json > regression.json
node -e 'const value = JSON.parse(require("fs").readFileSync("regression.json", "utf8")); process.exit(value.result.regressionDetected ? 1 : 0)'
```

The CLI preserves SDK category and difference order. It adds no heuristic score, explanation, timestamp, or source-path metadata. At most one package operand may be `-`, because one process has one standard-input byte stream.

## Stateful JSON Lines workflow

Use `session` when later operations must consume the exact live SDK binding or opaque Checkpoint created earlier.

```jsonl
{"command":"import","package":"investigation.mip"}
{"command":"checkpoint","name":"baseline"}
{"command":"restore","name":"baseline"}
{"command":"trace","reflection":"trace-observation-b"}
{"command":"replay","action":"open"}
{"command":"replay","action":"next"}
{"command":"inspect"}
```

```sh
memoryos session workflow.memoryos --json > workflow-results.jsonl
```

The process owns one SDK instance. `checkpoint` stores the actual SDK object in memory under `baseline`; `restore` passes that same object to that binding. The name is not portable, and neither the object nor its state is serialized. Checkpoints are integrity-bound rather than rollback snapshots, so restore succeeds only while authoritative transition history still matches. A second process, or the same process after another transition, cannot use a stale Checkpoint to roll state back.

Session execution is ordered and fail-fast. Use separate session processes for independent workflows.

## Reproducibility check

```sh
memoryos inspect investigation.mip --json > first.json
memoryos inspect investigation.mip --json > second.json
cmp first.json second.json
```

PowerShell equivalent:

```powershell
memoryos inspect investigation.mip --json | Set-Content first.json
memoryos inspect investigation.mip --json | Set-Content second.json
if ((Get-FileHash first.json).Hash -ne (Get-FileHash second.json).Hash) {
    throw "Non-deterministic CLI output"
}
```
