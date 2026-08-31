# Deterministic JSON Output Specification

## Purpose

`--json` provides stable, machine-readable CLI output without presentation-only state.

## Encoding and framing

- UTF-8 JSON
- one compact JSON object followed by one line-feed
- recursively lexicographically sorted object keys
- array order preserved exactly as returned by the SDK
- no ANSI color, timestamps, random values, progress output, or locale-dependent formatting

Each standalone command writes one success object to standard output or one
error object to standard error. `memoryos session --json` keeps its ordered
JSON Lines stream on standard output: one object for every successfully
processed input record, followed by at most one error object.

## Success envelope

```json
{"command":"verify","ok":true,"result":{"diagnosticCount":0,"diagnostics":[],"status":"passed","valid":true},"schemaVersion":"1.0"}
```

| Field | Type | Meaning |
|---|---|---|
| `command` | string | Executed CLI command or session action. |
| `ok` | boolean | Always `true` for success. |
| `result` | object | Command-specific deterministic projection. |
| `schemaVersion` | string | CLI JSON envelope version, currently `1.0`. |

## Error envelope

```json
{"command":"verify","error":{"code":"VERIFICATION_FAILED","details":[],"exitCode":3,"message":"Memory Investigation Package verification failed."},"ok":false,"schemaVersion":"1.0"}
```

`error` contains `code`, deterministically ordered `details`, `exitCode`, and `message`.

## Command results

- `version`: `cliVersion`, `sdkVersion`
- `help`: `topic`, `usage`
- `observe`, `trace`, `import`, `inspect`: Investigation metadata
- `replay`: Investigation metadata plus `cursor`, `replayIdentifier`, `replayStatus`
- `compare`: Investigation metadata plus `evolutionIdentifier`, `replaySteps`, `stage`
- `verify`: `diagnosticCount`, `diagnostics`, `status`, `valid`
- `export`: `byteLength`, `output`, `packageKind`, `packageVersion`

Investigation metadata contains `availability`, `identifier`, `lifecycle`, `phase`, `sourceKind`, `transitionCount`, `transitionLogDigest`, and `workspaceIdentifier`.

Session-only `checkpoint` returns the caller-assigned `name` and `stored: true`. It never emits the opaque Checkpoint object, internal state, or a restoration credential.

## Determinism boundary

The CLI preserves SDK arrays and values; it only canonicalizes output object key order. It does not reorder cognitive data, recompute digests, infer selections, summarize content, or add presentation metadata. Equivalent inputs and SDK state therefore produce byte-identical JSON output.

Raw package bytes from `export --output -` are not JSON and cannot be combined with `--json`.
