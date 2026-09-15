# Deterministic JSON Output Specification

## Purpose

`--json` provides stable, machine-readable CLI output without presentation-only state. Existing CLI commands retain envelope schema `1.0`; the additive `policy` namespace uses schema `1.1`.

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
- `regression`: the complete immutable SDK Regression Report
- `investigate`: the complete immutable SDK Cognitive Investigation result
- `verify`: `diagnosticCount`, `diagnostics`, `status`, `valid`
- `export`: `byteLength`, `output`, `packageKind`, `packageVersion`

Investigation metadata contains `availability`, `identifier`, `lifecycle`, `phase`, `sourceKind`, `transitionCount`, `transitionLogDigest`, and `workspaceIdentifier`.

Session-only `checkpoint` returns the caller-assigned `name` and `stored: true`. It never emits the opaque Checkpoint object, internal state, or a restoration credential.

The Regression result contains `kind`, `version`, `identifier`, `baseline`, `candidate`, `categories`, `regressionDetected`, and `overall`. Categories remain in the SDK-defined order: Replay, Reflection, Evidence, Retrieval, Evolution, Verification, transition, and lifecycle. Difference arrays remain in SDK order and contain only `change`, `subject`, `beforeDigest`, and `afterDigest`. The CLI performs no regression calculation or report transformation.

The Investigation result contains `kind`, `version`, `identifier`, `regressionIdentifier`, `workspaceIdentifier`, `query`, `status`, `matchCount`, and `matches`. Each match contains its deterministic `index`, `category`, `change`, opaque `subject`, and nullable `baseline` and `candidate` evidence endpoints. The CLI preserves SDK match order and performs no filtering, pointer construction, transition normalization, or identifier matching.

## Determinism boundary

The CLI preserves SDK arrays and values; it only canonicalizes output object key order. It does not reorder cognitive data, recompute digests, infer selections, summarize content, or add presentation metadata. Equivalent inputs and SDK state therefore produce byte-identical JSON output.

Raw package bytes from `export --output -` are not JSON and cannot be combined with `--json`.

## Policy schema 1.1

Policy success uses this closed envelope:

```json
{"command":"policy validate","ok":true,"result":{"artifactKind":"MemoryOSInvestigationPolicy","artifactVersion":"1.0.0","valid":true},"schemaVersion":"1.1"}
```

The error envelope may carry presentation diagnostics, but its normative
semantic projection is exactly:

```json
{"command":"policy validate","error":{"artifactKind":null,"code":"INVALID_ARGUMENTS","exitCode":1,"failureClass":"usage","limitIdentifier":null,"phase":null},"ok":false,"schemaVersion":"1.1"}
```

The emitted full `error` object also contains `message` and `details`. Those two
fields are excluded from semantic equality, cross-language byte parity, CI
decisions, and digests. They never replace the stable machine fields.

Policy envelope object members use restricted-JCS ordering and the full record
is followed by exactly one LF. A successful envelope containing only normative
fields is byte-identical across conforming implementations apart from that
frozen LF transport framing.

Policy result shapes are closed by command: validation returns kind/version and
`valid`; digest returns kind/version and both digests; detached inspection
returns `authority: "inspectionOnly"` plus the applicable identity; evaluation
returns decision, `evaluationIdentityDigest`, and `outcomeDigest`; verification
returns `verified`, scope, applicable digests, and applicable decision;
`identities` returns the frozen `MemoryOSPolicyContractIdentities` object.

`policy evaluate --outcome -` is not a JSON mode. It writes only the evaluator's
exact canonical normative outcome bytes, with no envelope or trailing LF.
