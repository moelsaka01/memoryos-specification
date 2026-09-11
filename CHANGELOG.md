# Changelog

This changelog records MemoryOS product milestones. Foundation-era workspace
history remains available in `ROADMAP.md`.

## MemoryOS 1.2 — v1.2.1

Corrective restoration release. The v1.2.0 Git source archive omitted
already-intended v1.2 source, registered tests, fixtures, examples, required
documentation, and frozen CCA-MIP-1.0 and CCA-MEMORYOS-1.0 publication assets.
v1.2.1 restores only the exact reviewed bytes and publishes a new v1.2.1
conformance assessment.

The released v1.2 CSP-safe Studio revisions remain authoritative.
CCA-MEMORYOS-1.0, CCA-MIP-1.0, Investigation Core, SDK, CLI, Cognitive
Regression, Cognitive Investigation Explorer, lifecycle, and Studio semantics
are unchanged. The v1.2.0 commit, tag, content-addressed manifest, and evidence
remain immutable historical records; v1.2.1 is the corrected Reference
Implementation baseline.

## MemoryOS 1.2 — v1.2.0

Released. MemoryOS 1.2 turns the deterministic investigation experience into
an implementation-independent platform with portable packages, runtime
adapters, one Investigation Core, public SDK and CLI surfaces, regression
analysis, direct evidence navigation, and an official Standard and Conformance
Suite.

### MO-1208 — MemoryOS Standard

Published CCA-MEMORYOS-1.0 as the implementation-independent definition of
MemoryOS platform behavior and designated MemoryOS 1.2.0 as its initial
Reference Implementation. The milestone adds normative Runtime, lifecycle,
MIP integration, adapter, Investigation Core, SDK, CLI, Cognitive Regression,
Explorer, compatibility, versioning, and certification contracts together
with a deterministic conformance suite and requirement-by-requirement report.
No Runtime, investigation, package, SDK, CLI, Regression, Explorer, or Studio
contract was redesigned, and no new platform behavior was introduced.

### MO-1201 — Investigation Package Implementation

Implemented the frozen MIP-001 contract as a dependency-free Producer,
Consumer, and Verifier for canonical Memory Investigation Packages. The module
provides deterministic RFC 8785 serialization, domain-separated SHA-256
integrity, atomic import/export, extension compatibility, and independent
validation of Observation, Trace, Replay, Evolution, and Comparative
Reconstruction artifacts without changing Runtime or Studio behavior.

### MO-1202 — AI Runtime Adapters

Added an attested adapter contract and dependency-free reference adapters for
the OpenAI Agents SDK, Anthropic SDK, and LangGraph. Adapters validate raw event
lifecycles privately, require successful settled output, and publish only exact
completed source-authored cognition as Observation context. Transport deltas,
timestamps, namespaces, usage, live SDK objects, and provider configuration do
not enter MIP. Canonical reference packages, chunk/timestamp invariance tests,
failure and resource tests, examples, and boundary checks cover the Producer
source boundary without changing Runtime, Studio, or MIP behavior.

### MO-1203 — Investigation Core

Established one renderer-independent execution authority for deterministic
investigations. The Core derives immutable state from an append-only,
digest-linked transition log; wraps the released Trace, Replay, Cognitive
Evolution, and Comparative Reconstruction semantics; owns verified MIP-backed
investigations; and provides integrity-bound checkpoints and atomic failure
behavior. Studio and future SDK, CLI, REST, and MCP clients remain thin. The
Core never synthesizes cognitive artifacts absent from an imported package.

### MO-1204 — MemoryOS SDK Facade

Added the public JavaScript, Python, and C++ SDK facades over the frozen
Investigation Core. Studio now uses the same JavaScript SDK surface as other
consumers. Native clients communicate through one versioned, long-lived
private binding that forwards explicit Core commands and immutable results;
it implements no investigation behavior. Package verification remains MIP
owned, package bytes remain exact, native observations cannot be exported,
and comparison retains the Core's staged lifecycle.

### MO-1205 — MemoryOS CLI

Added the official `memoryos` command as the first standalone consumer of the
public MemoryOS SDK. The CLI delegates Observe, Trace, Replay, Evolution,
verification, exact MIP import/export, and inspection to the SDK; provides
stable human and canonical JSON output plus deterministic exit codes; and
supports JSON Lines automation through one live SDK session. Trace selectors
remain explicit, cross-package comparison is rejected, native observations
cannot be exported, and opaque checkpoints never leave their creating session.

### MO-1206 — Cognitive Regression Analysis

Added one read-only deterministic Regression Engine to the Investigation Core
and exposed its immutable reports through the JavaScript, Python, and native
C++ SDK facades plus the SDK-only `memoryos regression` command. Reports compare
Replay, Reflection, Evidence, Retrieval, Evolution, Verification, transition,
and lifecycle facts using stable identities and canonical digests. No renderer,
heuristic, score, explanation, summary, prediction, or AI interpretation enters
the comparison, and neither source investigation is modified.

### MO-1207 — Cognitive Investigation Explorer

Added one read-only Cognitive Investigation Explorer to the Investigation Core
for direct navigation of Replay, Reflection, Evidence, Retrieval, Evolution,
Verification, transition, and lifecycle differences already present in a
validated Cognitive Regression report. Immutable navigation results retain
canonical JSON Pointers and source digests; the SDK, CLI, and Studio consume
those same results without replaying investigations, recomputing regression,
ranking evidence, or generating explanations.

## MemoryOS 1.1 — v1.1.0

Released. MemoryOS 1.1 preserves the frozen MemoryOS 1.0 runtime and public
contracts while adding deterministic cognitive investigation.

### MO-1101 — Stable Semantic World

Added immutable Observation Frames and a renderer-independent Semantic World
projection with typed identities, canonical revisions, stable capability
anchors, deterministic topology deltas, and fixed coordinates. Equivalent
detached observations produce equivalent cognitive geography without force
layout, randomness, polling, clocks, or changes to the MemoryOS 1.0 runtime.

### MO-1102 — Cognitive Trace

Added immutable, validated Cognitive Traces that reconstruct a selected
Reflection from exact Long-Term evidence through semantic transformations and
Retrieval boundaries. Construction, query, validation, and serialization are
renderer-independent and preserve ownership, relationship integrity,
provenance, and deterministic branch order without duplicating semantic data.

### MO-1103 — Living Connectome

Reframed the Stable Semantic World as a trace-led investigation surface with
structurally distinct cognitive regions, explicit origin and destination
waypoints, deterministic follow order, and a four-level attention hierarchy.
The world remains spatially stable and selectable while presentation-only
emphasis makes the active trace dominant without inventing cognitive activity.

### MO-1104 — Cognitive Replay

Added a pure replay state machine and reference-only projection that
reconstruct an immutable Cognitive Trace one real node or relationship at a
time. Explicit Play, Pause, Restart, Previous, and Next controls preserve
completed, current, and future state deterministically without autoplay,
synthetic events, inferred cognition, or timeline semantics.

### MO-1105 — Cognitive Polish

Hardened investigation continuity and visual hierarchy without changing Trace
or Replay semantics. Replay projections update the mounted semantic world in
place, retaining layout, camera, selection, and context while clarifying the
Evidence-to-Reflection route, preserving keyboard operation, and avoiding
unnecessary complete renderer reconstruction.

### MO-1106 — Cognitive Evolution

Added renderer-independent semantic comparison between two immutable
Observation Frames for supported Evidence, Relationship, Transformation,
Retrieval, and Reflection differences. A deterministic union world preserves
orientation and unchanged context while canonical semantic keys and revision
fingerprints—not layout, DOM state, camera state, or pixels—define changes.

### MO-1107 — Comparative Reconstruction

Added deterministic alignment and synchronized replay of two validated
Cognitive Traces in one stable semantic world. Shared cognition remains
unified, divergent moments carry exact reason codes, replay pauses at real
divergence, and deterministic alignment permits reconvergence without
comparing renderings or duplicating the cognitive world.

### MO-1108 — Integration & Workflow Unification

Unified Observe, Trace, Replay, Cognitive Evolution, Comparative
Reconstruction, and Return into one reversible production workflow using
application-owned presentation checkpoints and existing immutable engines.
Engineering hardening added interaction, accessibility, performance,
scalability, documentation, and architecture evidence without changing
runtime truth, public APIs, or renderer responsibilities.

### Release-candidate validation gates

- **RC-001 — Workflow validation.** Corrected exact Reflection resolution and
  completed-Replay Compare gating, then verified the production Observe →
  Trace → Replay → Compare → Return workflow.
- **RC-001A — Documentation Freeze.** Audited onboarding, release records,
  milestone navigation, screenshots, GIFs, links, and the documented
  first-time Observe-to-Trace limitation without changing implementation.
- **RC-001B — Repository Audit.** Audited publication structure, release
  identity, media ownership, duplicate and obsolete artifacts, repository
  navigation, and release-package boundaries without changing product code.

### Known limitation

Observe-to-Trace discoverability remains a low-impact first-time usability
issue in MemoryOS 1.2.0. See [known issues](KNOWN_ISSUES.md).
