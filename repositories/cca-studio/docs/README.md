# MemoryOS Studio documentation

This index is the public entry point for the MemoryOS 1.0 Studio contract, the
released MemoryOS 1.1 investigation experience, and the additive MemoryOS 1.2
package, adapter, and Investigation Core boundaries. Read the product journey from top to bottom,
or start with the engineering question you need to answer.

## Start here

| Need | Document |
|---|---|
| Assess MemoryOS against the published platform Standard | [Official conformance suite](../../cca-conformance/README.md) |
| Import, export, or verify a Memory Investigation Package | [Memory Investigation Packages](memory-investigation-packages.md) |
| Translate settled external AI runtime cognition into a verified MIP | [AI Runtime Adapters](ai-runtime-adapters.md) |
| Execute or embed a deterministic investigation | [Investigation Core](investigation-core.md) |
| Detect deterministic differences between two investigations | [Cognitive Regression Analysis](cognitive-regression.md) |
| Navigate directly to deterministic regression evidence | [Cognitive Investigation Explorer](cognitive-investigation-explorer.md) |
| Consume MemoryOS from JavaScript, Python, or C++ | [MemoryOS SDK](../../cca-sdk/README.md) · [API reference](../../cca-sdk/docs/api-reference.md) · [Developer guide](../../cca-sdk/docs/developer-guide.md) |
| Audit Investigation Core acceptance evidence | [Investigation Core conformance evidence](investigation-core-conformance-evidence.md) |
| Trace every frozen MIP requirement to implementation and tests | [MIP-001 conformance matrix](mip-conformance-matrix.md) |
| Understand the released Studio contract | [Memory Studio API and behavior](memory-studio.md) |
| Verify the frozen contract against tests | [Memory Studio conformance evidence](memory-studio-conformance-evidence.md) |
| Understand the complete MemoryOS 1.1 investigation stack | [Engineering architecture review](memoryos-1.1-engineering-architecture-review.md) |
| Follow the integrated MemoryOS 1.1 engineering workflow | [Integration & Workflow Unification](memoryos-1.1-integration-workflow.md) |
| Review MemoryOS 1.1 release status | [Release notes](../../../RELEASE_NOTES.md) · [Known issues](../../../KNOWN_ISSUES.md) · [Changelog](../../../CHANGELOG.md) |
| Watch the complete product workflow | [Official 73-second demonstration](media/memoryos-1.1-official-demo.gif) |
| Review measured engineering evidence | [Engineering benchmark](memoryos-1.1-engineering-benchmark.md) |
| Review documentation and media integrity | [Documentation audit](memoryos-1.1-documentation-audit.md) |
| Review repository publication integrity | [RC-001B repository audit](memoryos-1.1-rc-repository-audit.md) |
| Capture the MemoryOS 1.0 product story | [GitHub screenshot specification](github-screenshot-specification.md) |

## MemoryOS 1.2 integration

MO-1201 implements the frozen MIP-001 contract as a headless package layer.
The [package guide](memory-investigation-packages.md) documents its public
Producer, Consumer, and Verifier operations. The
[64-requirement conformance matrix](mip-conformance-matrix.md) names every
automated test and distinguishes executable package evidence from the two
external assurance/governance reviews.

MO-1202 adds dependency-free adapters for completed OpenAI Agents SDK,
Anthropic SDK, and LangGraph runs. The
[adapter guide](ai-runtime-adapters.md) defines the generic contract,
truth-preservation and failure rules, exact reference packages, and offline
example. Raw events remain private lifecycle-validation input. Only settled,
source-authored cognition crosses the boundary into Observation-only MIPs;
adapters never infer Evidence, Retrieval, Reflection, causality, or provenance
from provider event names.

MO-1203 establishes the [Investigation Core](investigation-core.md) as the
single renderer-independent execution authority. Its immutable, digest-linked
transition log is canonical and all state is derived from that log. It wraps
the released native investigation semantics and owns verified MIP-backed
investigations without projecting an Observation-only MIP into Studio or
inventing absent Trace, Replay, Evolution, or Comparative artifacts. See the
[conformance evidence](investigation-core-conformance-evidence.md).

MO-1204 exposes that frozen Core through the [MemoryOS SDK](../../cca-sdk/README.md).
Studio consumes the browser facade, while Python and native C++ share one
private, long-lived transport implementation. The SDK forwards explicit Core
and MIP operations; it contains no independent Trace, Replay, Evolution, or
Comparative Reconstruction behavior.

MO-1206 adds [Cognitive Regression Analysis](cognitive-regression.md) as a
read-only Investigation Core operation. Its fixed report categories expose
only observed Replay, Reflection, Evidence, Retrieval, Evolution,
Verification, transition, and lifecycle differences. SDK and automation
clients consume the same immutable report and do not implement comparison.

MO-1207 adds the
[Cognitive Investigation Explorer](cognitive-investigation-explorer.md). It
validates detached Regression Reports and follows exact ordered difference
subjects and digest pointers without rerunning Replay, recomputing Regression,
or creating cognitive state. SDK, CLI, and Studio consume the same immutable
Core result.

MO-1208 publishes CCA-MEMORYOS-1.0 outside the implementation workspace and
activates the [official conformance suite](../../cca-conformance/README.md).
MemoryOS 1.2.0 is the initial Reference Implementation; Studio documentation
and source remain informative evidence rather than normative platform text.

The focused edge suites are:

- [`mip_ordering_conformance_test.mjs`](../tests/mip_ordering_conformance_test.mjs)
  for interoperable scalars, occurrences, and Observation chronology;
- [`mip_derived_edge_conformance_test.mjs`](../tests/mip_derived_edge_conformance_test.mjs)
  for multi-branch Trace/Replay and Comparative alignment; and
- [`mip_pipeline_conformance_test.mjs`](../tests/mip_pipeline_conformance_test.mjs)
  for all validation phases, every stable diagnostic, detached publication,
  extension preservation, and lossless compatibility; and
- [`ai_runtime_adapter_test.mjs`](../tests/ai_runtime_adapter_test.mjs)
  for provider lifecycle validation, settled projections, transport
  invariance, failure/resource boundaries, and canonical reference packages;
  and
- [`investigation_core_test.mjs`](../tests/investigation_core_test.mjs)
  for lifecycle, transition-log integrity, checkpoint restoration, native
  semantic parity, verified MIP ownership, thin projections, and atomic failure;
  and
- [`cognitive_regression_test.mjs`](../tests/cognitive_regression_test.mjs)
  for category correctness, ordering, package neutrality, immutability,
  failure atomicity, renderer separation, and bounded deterministic analysis;
  and
- [`cognitive_investigation_explorer_test.mjs`](../tests/cognitive_investigation_explorer_test.mjs)
  for evidence navigation, exact selectors, deterministic JSON, read-only
  behavior, validation, performance, and renderer separation.

## MemoryOS 1.1 milestone map

| Milestone | Responsibility | Renderer-independent truth |
|---|---|---|
| [MO-1101 — Stable Semantic World](memoryos-1.1-sprint-1.md) | Accept immutable observations into deterministic cognitive geography | Observation Frames, canonical identity, stable layout |
| [MO-1102 — Cognitive Trace](memoryos-1.1-sprint-2.md) | Reconstruct one Reflection from exact evidence and relationships | Immutable trace membership, order, validation, serialization |
| [MO-1103 — Living Connectome](memoryos-1.1-sprint-3.md) | Present the trace as the dominant investigation | Consumes the Stable Semantic World and Cognitive Trace |
| [MO-1104 — Cognitive Replay](memoryos-1.1-sprint-4.md) | Reveal one real trace element at a time | Immutable replay state and reference-only projection |
| [MO-1105 — Cognitive Polish](memoryos-1.1-sprint-5.md) | Preserve investigation continuity and calm hierarchy | Reuses the existing replay and trace models unchanged |
| [MO-1106 — Cognitive Evolution](memoryos-1.1-cognitive-evolution.md) | Answer “What changed?” across two observations | Canonical semantic differences and stable union world |
| [MO-1107 — Comparative Reconstruction](memoryos-1.1-comparative-reconstruction.md) | Answer “Where did the investigations diverge?” | Deterministic trace alignment and synchronized replay |
| [MO-1108 — Integration & Workflow Unification](memoryos-1.1-integration-workflow.md) | Connect Observe, Trace, Replay, Evolution, and Comparative Reconstruction into one reversible workflow | Existing immutable models plus application-owned checkpoint and graph view state; no new cognitive truth |

## Investigation architecture

```mermaid
flowchart LR
    Contract["Frozen MemoryOS 1.0<br/>Studio contract"]
    Frames["MO-1101<br/>Observation Frames"]
    World["Stable Semantic World"]
    Trace["MO-1102<br/>Cognitive Trace"]
    Replay["MO-1104<br/>Cognitive Replay"]
    Evolution["MO-1106<br/>Cognitive Evolution"]
    Comparative["MO-1107<br/>Comparative Reconstruction"]
    App["Application controllers"]
    Renderer["Living Connectome renderer"]

    Contract --> Frames
    Frames --> World
    Frames --> Trace
    Trace --> Replay
    Frames --> Evolution
    Trace --> Comparative
    Evolution --> Comparative
    World --> Renderer
    Replay --> App
    Evolution --> App
    Comparative --> App
    App -->|immutable projections| Renderer
```

The renderer is deliberately downstream. It never constructs traces, decides
replay order, compares observations, aligns investigations, or invents
semantic activity.

## Engineering Excellence evidence

| Review | Evidence |
|---|---|
| Performance | [Measured performance report](memoryos-1.1-performance-report.md) · [raw engine results](../benchmarks/memoryos-1.1-benchmark-results.json) · [raw browser results](../benchmarks/memoryos-1.1-browser-render-results.json) |
| Scalability | [100–10,000-node validation report](memoryos-1.1-scalability-report.md) |
| Reproducibility | [Engineering benchmark contract](memoryos-1.1-engineering-benchmark.md) |
| Product consistency | [UX audit](memoryos-1.1-ux-audit.md) |
| Inclusive operation | [Accessibility audit](memoryos-1.1-accessibility-audit.md) |
| Public release integrity | [Documentation audit](memoryos-1.1-documentation-audit.md) |
| Release Candidate documentation | [RC-001A documentation freeze audit](memoryos-1.1-rc-documentation-audit.md) |
| Release Candidate repository | [RC-001B repository audit](memoryos-1.1-rc-repository-audit.md) |
| Architecture boundaries | [Engineering architecture review](memoryos-1.1-engineering-architecture-review.md) |

## Genuine visual evidence

The following assets are repository-hosted captures of the running local application,
not mockups or generated product images.

The MO-1108 release row uses true PNG and GIF assets. Earlier milestone stills
are retained as historical JPEG evidence with truthful `.jpg` extensions.
Raw capture sequences are separated from release media and documented in the
media manifest.

| Capability | Screenshot evidence | Silent demonstration |
|---|---|---|
| **MemoryOS 1.1 · v1.1.0** | [Mission Control](screenshots/memory-studio-mo1108-mission-control.png) · [Trace](screenshots/memory-studio-mo1108-trace.png) · [Replay](screenshots/memory-studio-mo1108-replay.png) · [Evolution](screenshots/memory-studio-mo1108-evolution.png) · [Comparative](screenshots/memory-studio-mo1108-comparative.png) · [Mobile](screenshots/memory-studio-mo1108-mobile.png) | [Official 73-second demonstration](media/memoryos-1.1-official-demo.gif) · [30-second Engineering Excellence cut](media/memory-studio-mo1108-engineering-excellence.gif) |
| Living Connectome | [Before](screenshots/memory-studio-sprint3-before.jpg) · [After](screenshots/memory-studio-sprint3-after.jpg) | [Trace-led investigation](media/memory-studio-sprint3-living-connectome.gif) |
| Cognitive Replay | [Before](screenshots/memory-studio-sprint4-before-replay.jpg) · [Mid replay](screenshots/memory-studio-sprint4-mid-replay.jpg) · [Complete](screenshots/memory-studio-sprint4-completed-replay.jpg) | [Deterministic replay](media/memory-studio-sprint4-cognitive-replay.gif) |
| Cognitive Polish | [Semantic world](screenshots/memory-studio-sprint5-semantic-world.jpg) · [Investigation](screenshots/memory-studio-sprint5-reconstruction.jpg) | [Investigation continuity](media/memory-studio-sprint5-cognitive-polish.gif) |
| Cognitive Evolution | [Before](screenshots/memory-studio-mo1106-before-compare.jpg) · [Differences](screenshots/memory-studio-mo1106-cognitive-evolution.jpg) | [Observation comparison](media/memory-studio-mo1106-cognitive-evolution.gif) |
| Comparative Reconstruction | [Ready](screenshots/memory-studio-mo1107-reconstruction-ready.jpg) · [Evidence divergence](screenshots/memory-studio-mo1107-evidence-divergence.jpg) · [Reflection divergence](screenshots/memory-studio-mo1107-reflection-divergence.jpg) | [Synchronized reconstruction](media/memory-studio-mo1107-comparative-reconstruction.gif) |

## Historical release material

- [MemoryOS 1.0 launch demonstration production package](memoryos-1.0-launch-demo-production-package.md)
- [MemoryOS 1.0 GitHub screenshot specification](github-screenshot-specification.md)

These documents remain available as release records. Current MemoryOS 1.1
claims should use the milestone evidence indexed above.

The [media manifest](media/README.md) defines the current release, milestone,
source-frame, and archived-asset boundaries.
