# MemoryOS 1.1 Sprint 3 — Living Connectome Identity

## Purpose

Sprint 3 turns the existing Living Connectome into a calm cognitive-investigation surface. It is a presentation-only extension of the immutable Semantic World from Sprint 1 and the renderer-independent Cognitive Trace from Sprint 2. The MemoryOS runtime, public API, observation-frame model, trace builder, trace validator, and deterministic layout are unchanged.

## Investigation hierarchy

Trace mode uses four deliberate attention levels:

1. **Active Trace** — explicit trace routes, origin evidence, transformations, retrieval boundaries, and the Reflection destination.
2. **Immediate Context** — the currently followed trace step and its compact detached-value identity.
3. **Connected Cognitive Region** — the structural region containing the active step.
4. **Background World** — the complete semantic world remains present and selectable, but visually quiet.

## Visual decisions

| Decision | Understanding gained |
| --- | --- |
| Origin and outcome waypoints | Makes the direction of investigation visible before an engineer reads a label. |
| Wide, quiet trace-route underlay | Joins validated trace relationships into one visual journey without changing or inferring relationships. |
| Fixed cognitive-region contours | Makes Working, Long-Term, Semantic, Retrieval, Reflection, Providers, and Validation recognizable by shape and topology rather than color alone. |
| Archive, lattice, corridor, convergence, buffer, ports, and boundary motifs | Gives each region a structural signature while preserving the fixed Sprint 1 geography. |
| Role-specific trace stages | Separates evidence, transformation, retrieval, and Reflection as investigation stages. |
| One compact investigation ribbon | Replaces unrelated product metrics with the branch, evidence, stage, and destination facts relevant to the active trace. |
| Quiet background topology | Preserves context without forcing engineers to search for the active investigation. |
| Reduced glow and microstructure | Removes decorative emphasis that competed with trace meaning. |
| Compact selection context | Keeps the selected detached value available without turning the investigation into a side-panel workflow. |
| Manual Previous / Next Follow controls | Lets an engineer move through actual trace membership in deterministic order; there is no autoplay, timer, or simulated cognition. |
| Stable camera transitions | Moves through the unchanged semantic world after direct input and preserves spatial memory. |
| Static trace rendering | Ensures the interface never implies runtime activity that was not present in an accepted observation frame. |

## Architecture boundary

The renderer receives a completed Semantic World and a validated Cognitive Trace. Region geometry is a fixed renderer vocabulary aligned to existing semantic anchors. Trace routes are drawn only from supplied `edgeKey`, `nodeKey`, and `direction` references. Follow creates a de-duplicated view order from supplied trace roles and never writes semantic state.

Sprint 3 adds no force layout, randomness, clock, timer, polling, backend abstraction, or runtime dependency. It does not implement Replay, Timeline, Diff, Time Machine, Semantic Zoom, or Counterfactuals.

## Visual verification

The captures came from the local application at `http://127.0.0.1:4173/#reflection` using the injected deterministic reference observation.

The historical capture artifacts named below were reviewed during this milestone but are not retained in the v1.2.1 source archive. Their truthful filenames are preserved as provenance only, not as supported links.

- Before: `screenshots/memory-studio-sprint3-before.jpg`
- After: `screenshots/memory-studio-sprint3-after.jpg`
- Follow origin: `screenshots/memory-studio-sprint3-follow-origin.jpg`
- Silent interaction demo: `media/memory-studio-sprint3-living-connectome.gif`

## Verification contract

- Existing Memory Studio tests remain green.
- Region definitions are immutable, fixed, and structurally distinct.
- Trace Follow ordering is deterministic, role ordered, and duplicate free.
- The semantic world is not mutated by presentation sequencing.
- Trace mode retains every non-trace node as background context.
- Trace motion is limited to direct camera interaction; accepted observation deltas remain the only data-driven animation.
