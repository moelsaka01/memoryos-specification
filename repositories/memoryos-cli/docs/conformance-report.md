# MO-1205 Conformance Report

## Purpose

This report maps the MemoryOS CLI deliverable to the approved MO-1205 boundary.

## Architecture conformance

| Requirement | Evidence | Status |
|---|---|---|
| Standalone SDK consumer | Production commands import the public `MemoryOS` SDK facade. | Conformant |
| No direct Runtime access | CLI source has no Runtime import or Runtime protocol. | Conformant |
| No direct Investigation Core access | CLI source does not import `investigation-core.js`. | Conformant |
| No direct MIP access | Package import, export, and verification invoke SDK methods; the CLI performs byte transport only. | Conformant |
| Zero investigation semantics | Trace, Replay, comparison, verification, and restoration are SDK calls. CLI logic is argument validation, ordered automation, I/O, and output projection. | Conformant |

## Command conformance

At MO-1205 release, the executable exposed exactly eleven required top-level commands: `version`, `help`, `observe`, `trace`, `replay`, `compare`, `verify`, `import`, `export`, `inspect`, and `session`. MO-1206 adds the SDK-backed `regression` command, and MO-1207 adds SDK-backed Regression Report investigation, without changing that released command behavior.

`checkpoint` and `restore` are intentionally session records rather than portable top-level commands. Their values remain opaque, integrity-bound objects in one live SDK binding; they are not rollback snapshots.

## Determinism and input conformance

- Observation requires explicit Workspace and snapshot files.
- Trace requires an exact selector.
- Stateless Replay and comparison require an exact Trace selector.
- Comparison accepts one package and one authored Evolution identifier.
- Package verification, import, and export delegate to the SDK.
- Export returns only SDK-provided package bytes and cannot fabricate a native package.
- JSON object keys are canonicalized recursively while SDK array ordering is preserved.
- Human and JSON output contain no timestamps, colors, randomness, prompts, or presentation metadata.

## Automation conformance

- Commands are non-interactive.
- Package bytes may be read from standard input where `PACKAGE` is `-`.
- Raw package export may be written to standard output.
- Session mode accepts JSON Lines from a file or standard input.
- Exit codes `0` through `5` have one documented meaning each.
- Session execution is ordered and fail-fast.

## Executable evidence

`examples/run-cli-examples.mjs` uses the released Studio `referenceSnapshot` and approved complete MIP fixture. It invokes the eleven MO-1205 commands plus the additive MO-1206 Regression and MO-1207 Investigation commands, checks deterministic JSON envelopes, compares exported bytes with the source package, and verifies session-only Checkpoint restoration through the production executable.

```sh
npm test
npm run test:examples
```

## Deviations

None. Cross-package comparison and portable Checkpoint serialization are not implemented because neither exists in the frozen SDK contract.
