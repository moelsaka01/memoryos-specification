# MemoryOS v1.2.1 Release Notes

## Release status

**Released**

| Identity | Value |
|---|---|
| Product release | MemoryOS 1.2 |
| Semantic version | 1.2.1 |
| Release tag | v1.2.1 |
| Standard | CCA-MEMORYOS-1.0 |
| Status | Corrected Stable Reference Implementation |

MemoryOS 1.2 turns the deterministic cognitive investigation experience
introduced in v1.1 into a portable engineering platform. The release adds a
canonical investigation package, provider-independent runtime adapters, one
Investigation Core, public SDK and CLI surfaces, deterministic regression
analysis, direct evidence navigation, and the MemoryOS Standard with its
official Conformance Suite.

The MemoryOS 1.0 runtime and v1.1 investigation architecture remain intact.

## Corrective restoration

The v1.2.0 Git source archive omitted already-intended source, registered tests,
fixtures, examples, required documentation, and frozen Standard and MIP
publication assets. v1.2.1 restores only those reviewed bytes, preserves the
released CSP-safe Studio revisions, and publishes new conformance evidence for
the repaired tracked tree.

No CCA-MEMORYOS-1.0, CCA-MIP-1.0, Investigation Core, SDK, CLI, Cognitive
Regression, Cognitive Investigation Explorer, lifecycle, or Studio semantics
changed. The v1.2.0 commit, tag, manifest, and evidence remain immutable
historical records. v1.2.1 is the corrected Reference Implementation baseline
and introduces no MemoryOS 1.3 or Investigation Policies behavior.

## MemoryOS 1.2 platform scope

### MO-1201 — Memory Investigation Packages

MIP 1.0 provides canonical serialization, deterministic ordering, stable
identifiers, integrity hashes, verification, and compatibility rules for
portable investigations.

### MO-1202 — AI Runtime Adapters

Dependency-free reference adapters translate completed OpenAI Agents SDK,
Anthropic SDK, and LangGraph runs into verified Observation-only packages
without inferring cognitive semantics.

### MO-1203 — Investigation Core

One renderer-independent authority now owns investigation lifecycle,
transition history, Trace, Replay, Evolution, Comparative Reconstruction,
Regression, Explorer navigation, checkpoints, and package integration.

### MO-1204 — MemoryOS SDK

JavaScript, Python, and C++ facades expose the same Core behavior. The SDK owns
programmability and contains no independent investigation logic.

### MO-1205 — MemoryOS CLI

The SDK-backed memoryos command brings deterministic investigation operations,
canonical JSON output, and stable exit codes to terminals, scripts, and CI.

### MO-1206 — Cognitive Regression Analysis

Regression reports deterministic differences in Replay, Reflection, Evidence,
Retrieval, Evolution, Verification, transitions, and lifecycle state. It does
not score, summarize, infer, or explain.

### MO-1207 — Cognitive Investigation Explorer

Explorer navigates from a validated regression fact to exact existing
evidence. Navigation does not rerun Replay, recompute Regression, or create
cognitive state.

### MO-1208 — MemoryOS Standard

CCA-MEMORYOS-1.0 defines the implementation-independent platform contract.
MemoryOS v1.2.0 is its initial Reference Implementation and is assessed through
the official deterministic Conformance Suite.

MemoryOS v1.2.1 is the corrected Reference Implementation baseline.

## Investigation workflow

~~~text
Observe → Select a Reflection → Trace → Replay → Compare → Investigate → Return
~~~

Selecting a valid Reflection begins Trace. Replay reconstructs actual trace
elements. Compare exposes authored evolution and deterministic regression.
Explorer follows exact regression pointers to evidence already present in the
Investigation Core.

## Compatibility

MemoryOS 1.2 is additive. It does not change the MemoryOS 1.0 runtime,
Workspace ownership, frozen public memory contracts, or the v1.1 Stable
Semantic World, Cognitive Trace, Living Connectome, Replay, Evolution, and
Comparative Reconstruction semantics.

The Standard, Reference Implementation, MIP, adapters, Core, SDK, CLI,
Regression report, Explorer result, and Conformance Suite retain independent
version identities. See the
[compatibility guide](repositories/cca-conformance/docs/compatibility-guide.md).

## Verification and documentation

- [MemoryOS Standard repository](https://github.com/moelsaka01/memoryos-specification)
- [Official Conformance Suite](repositories/cca-conformance/README.md)
- [Reference Implementation guide](repositories/cca-conformance/docs/reference-implementation-guide.md)
- [MIP guide](repositories/cca-studio/docs/memory-investigation-packages.md)
- [Investigation Core](repositories/cca-studio/docs/investigation-core.md)
- [MemoryOS SDK](repositories/cca-sdk/README.md)
- [MemoryOS CLI](repositories/memoryos-cli/README.md)
- [Cognitive Regression](repositories/cca-studio/docs/cognitive-regression.md)
- [Investigation Explorer](repositories/cca-studio/docs/cognitive-investigation-explorer.md)
- [Complete changelog](CHANGELOG.md)

## Release media

- [Official MemoryOS v1.2 demonstration](repositories/cca-studio/docs/media/memoryos-v1.2-demo.gif)
- [Full-quality MP4](repositories/cca-studio/docs/media/memoryos-v1.2-demo.mp4)

## Known limitation

The initial Observe-to-Trace transition requires selecting a valid Reflection.
The workflow is fully functional, but this interaction can be less obvious to
first-time users. It does not affect runtime correctness, determinism, Replay,
Regression, Explorer, or platform architecture. See
[KNOWN_ISSUES.md](KNOWN_ISSUES.md).

## Build and run

Build, verification, Studio, CLI, and investigation instructions are in the
root [README](README.md).
