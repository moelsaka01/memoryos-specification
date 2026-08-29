# Investigation Core conformance evidence

## Purpose

This document maps the MO-1203 acceptance boundary to the implementation and
automated evidence. It supplements, and does not modify, the released MemoryOS
1.1 semantics or frozen MIP-001 contract.

## Authority map

| Acceptance condition | Implementation surface | Evidence |
| --- | --- | --- |
| One execution authority | `web/js/investigation-core.js` | `tests/investigation_core_test.mjs` exercises all commands through `InvestigationCore`; architecture assertions keep the module headless. |
| Required operations | `create`, `load`, `restore`, `archive`, `replay`, `compare`, `verify`, `checkpoint`, `export`, `import` | Operation, invalid-input, invalid-transition, and atomic-failure cases in the Core suite. |
| Native investigation semantics are unchanged | Existing Trace, Replay, Evolution, and Comparative modules are invoked by the Core | Core parity assertions plus the complete MemoryOS web and integration regression suites. |
| Canonical transition log | `Transition`, `TransitionLog`, full-log state derivation | Contiguous-index, digest-chain, deterministic identifier, tamper, repeated-load, and equivalent-sequence assertions. |
| Checkpoint integrity | `Checkpoint`, `checkpoint()`, `restore()` | Round-trip restoration plus transition-count, log-digest, state-digest, Workspace, and conflicting-log rejection assertions. |
| MIP ownership and verification | MO-1201 importer, serializer, and verifier called by the Core | Valid import/export round trip, invalid package rejection, Workspace isolation, and MIP regression suites. |
| No invented package cognition | Package selection requires source-authored sections | Observation-only adapter packages remain Observation-only; unavailable Trace/Replay/Evolution/Comparative requests fail deterministically. |
| Renderer separation | `projectInvestigation()` returns immutable view data | Core has no DOM, camera, Canvas, SVG, timer, polling, or renderer dependency; renderer consistency tests consume projections. |
| Thin clients | Studio routes production workflow commands through the Core | Integration and architecture tests cover Observe → Trace → Replay → Compare → Return without a second investigation implementation. |
| Atomic publication | Candidate logs are derived before publication | Failed commands preserve the prior log digest, transition count, and projected state. |

## Lifecycle evidence

The suite covers every exact lifecycle state: `Created`, `Observed`, `Traced`,
`ReplayReady`, `Replaying`, `ReplayComplete`, `ComparisonReady`, `Comparing`,
`Verified`, and `Archived`. It also checks:

- creation and import establish exactly one source kind and Workspace;
- observing rebuilds a still-valid active Reflection Trace against the accepted
  frame, or returns to `Observed` with a deterministic diagnostic when rebuild
  is impossible;
- Trace selection requires an exact Reflection;
- Replay cannot run before preparation;
- comparison requires a completed Replay and at least two observations;
- Comparative Reconstruction requires active Evolution;
- returning to the world clears active Trace, Replay, and comparison state;
- verification publishes only after complete validation and is invalidated by
  any later non-archive transition until verification runs again; and
- archive is terminal for mutating commands.

## Transition and checkpoint evidence

The transition tests independently reconstruct equivalent command sequences and
compare transition identifiers, ordered payloads, log digests, lifecycle, and
projected state. Tampering with an index, kind, payload, prior digest, transition
identifier, log digest, transition count, Workspace, or state digest is rejected.

Checkpoint restoration replays the checkpoint log from its first transition.
The checkpoint's state digest is an integrity check, not a serialized state
authority. Restoration never replaces an already loaded investigation whose
authoritative log has a different digest.

## MIP boundary evidence

The Core delegates package parsing, canonical serialization, compatibility, and
integrity verification to MO-1201. The existing MIP conformance suites continue
to cover the frozen `CCA-MIP-001` through `CCA-MIP-064` contract.

MO-1202 reference packages contain only source-authored Observation cognition.
Core tests confirm that importing them does not synthesize a Studio snapshot,
Trace, Replay, Evolution, Comparative Reconstruction, Evidence, Retrieval,
Reflection, causality, or provenance. Export returns the exact canonical package
owned by the MIP-backed investigation.

## Verification commands

From the workspace root:

```console
npm --prefix repositories/cca-studio run test:investigation-core
npm --prefix repositories/cca-studio test
node repositories/cca-studio/examples/investigation_core_usage.mjs
python tools/verify_workspace.py --root .
```

The CMake/CTest registration is `cca.memory_studio.investigation_core` when
`CCA_ENABLE_STUDIO_WEB_TESTS=ON` and Node.js is available.

## Related evidence

- [Investigation Core](investigation-core.md)
- [MIP-001 conformance matrix](mip-conformance-matrix.md)
- [AI Runtime Adapters](ai-runtime-adapters.md)
- [MemoryOS 1.1 architecture review](memoryos-1.1-engineering-architecture-review.md)
