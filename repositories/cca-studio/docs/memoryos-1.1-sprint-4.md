# MemoryOS 1.1 Sprint 4 — Cognitive Replay

## Purpose

Cognitive Replay lets an engineer reconstruct how an observed Reflection emerged from its evidence. Replay consumes one immutable Cognitive Trace and reveals its existing semantic elements in deterministic order. It does not query the runtime, infer cognition, synthesize events, or mutate the Semantic World.

## Architecture

```text
Immutable Cognitive Trace
          |
          v
buildCognitiveReplay()        reference-only, renderer-independent
          |
          v
Immutable Replay + State      Ready / Playing / Paused / Completed
          |
          v
projectReplay()               completed / current / future references
          |
          v
Living Connectome Renderer    presentation only
```

`cognitive-replay.js` is a pure projection and state machine. It accepts only a frozen MemoryOS 1.1 Cognitive Trace. Its replay steps reference trace `nodeKey` and `edgeKey` values; semantic payload remains in the bound observation frame.

The application owns the replay state and the optional Play scheduler. The scheduler advances the pure controller by one existing replay step every 1100 milliseconds after explicit user activation. Elapsed time never determines event identity, ordering, or semantic meaning. Pause, Restart, Previous, Next, selection, route changes, and trace replacement clear or interrupt scheduling deterministically.

The renderer receives a completed replay projection. It never builds a replay, traverses the graph, reads evidence payloads, or computes ordering.

## Ordering

Replay uses the frozen Cognitive Trace roles:

1. origin evidence nodes;
2. explicit evidence relationships;
3. semantic transformation nodes;
4. explicit retrieval relationships;
5. retrieval boundaries;
6. explicit Reflection contribution relationships;
7. the observed Reflection target.

Within a role, original trace branch and step order is preserved. Shared node and relationship references are emitted once. The reference observation reconstructs 15 actual elements: 8 nodes and 7 relationships.

## Controls

| Control | Behavior | Keyboard |
| --- | --- | --- |
| Play | Starts only on engineer request or resumes a paused replay. | `Space` |
| Pause | Stops scheduling without changing the current semantic step. | `Space` |
| Restart | Restores Ready at step 0 without starting playback. | `R` |
| Previous Step | Moves to the preceding actual replay element and pauses. | `Left Arrow` |
| Next Step | Moves to the next actual replay element and pauses. | `Right Arrow` |

There is no page-load autoplay and no timeline scrubber.

## Rendering contract

- Completed steps remain visible.
- The current step receives the only primary emphasis.
- Future trace elements remain present but quiet.
- The complete Semantic World remains visible as orientation context.
- Camera position is preserved throughout Replay.
- Replay state changes are discrete; trace elements do not animate between steps.
- Completion leaves the entire validated investigation visible.

## Visual verification

All captures were taken from the running local application with the deterministic reference observation.

The historical capture artifacts named below were reviewed during this milestone but are not retained in the v1.2.1 source archive. Their truthful filenames are preserved as provenance only, not as supported links.

- Before Replay: `screenshots/memory-studio-sprint4-before-replay.jpg`
- Mid Replay: `screenshots/memory-studio-sprint4-mid-replay.jpg`
- Completed Replay: `screenshots/memory-studio-sprint4-completed-replay.jpg`
- 20-second silent Replay: `media/memory-studio-sprint4-cognitive-replay.gif`

The silent demo is assembled from real browser captures taken during an actual Play run. It contains no generated cognitive frames.

## Explicit exclusions

Sprint 4 does not implement Time Machine, Counterfactual Replay, Fork Reality, Diff, Semantic Zoom, new backend architecture, new runtime abstractions, fake activity, decorative animation, or generated explanations.

## Verification

Automated tests cover replay ordering, deterministic reconstruction, restart, completion, interruption, Previous/Next behavior, immutable state restoration, trace/frame binding, and renderer separation. The frozen native Studio suite and the complete workspace regression suite remain authoritative for MemoryOS 1.0 compatibility.
