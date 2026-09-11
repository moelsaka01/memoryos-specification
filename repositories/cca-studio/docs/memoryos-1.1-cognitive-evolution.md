# MemoryOS 1.1 MO-1106 — Cognitive Evolution

## Purpose

Cognitive Evolution answers one engineering question: **What changed between two accepted observations?** It is an additive, renderer-independent comparison over the immutable Observation Frames introduced by the Stable Semantic World. MemoryOS 1.0, Cognitive Trace, Cognitive Replay, the Living Connectome, and the deterministic layout remain unchanged.

## Architecture

```text
Accepted Observation Frame A       Accepted Observation Frame B
              │                                  │
              └──────────────┬───────────────────┘
                             ▼
                 Cognitive Evolution engine
                 - validates frame bindings
                 - compares semantic identity
                 - emits canonical differences
                 - creates a stable union world
                             │
               immutable Evolution + View
                             │
                 ┌───────────┴───────────┐
                 ▼                       ▼
       application controller     Living Connectome renderer
       adjacent frame choice      presentation only
```

The engine is implemented in `web/js/cognitive-evolution.js`. It has no DOM, clock, scheduler, randomness, host operation, layout comparison, or renderer dependency. The controller in `web/js/cognitive-evolution-controller.js` owns only explicit adjacent-frame selection and the active comparison state.

## Semantic comparison boundary

The engine compares authoritative records rather than display aggregates:

| Difference family | Authoritative observation |
| --- | --- |
| Evidence | non-aggregate `LongTermMemory` entries |
| Semantic transformations | non-detail Semantic, Episodic, and Procedural knowledge |
| Retrievals | Retrieval sessions |
| Reflections | Reflection values owned by an accepted observation |
| Relationships | explicit non-containment semantic-world relationships |

Container edges, aggregate revision counters, labels, positions, camera state, DOM state, and pixels are never semantic differences. Provenance snapshot nodes remain visible as context, but are not double-counted as new authoritative evidence.

## Difference contract

The immutable result contains exactly these difference sequences:

- added and removed Evidence;
- added, removed, and modified Relationships;
- added and removed Semantic Transformations;
- added and removed Retrievals; and
- added and removed Reflections.

Every record is reference-only: stable key, typed identity, bound frame identifier, and revision fingerprint. Semantic payload remains in its immutable Observation Frame.

When one stable cognitive identity has a different exact revision, the engine emits the old semantic version as removed and the new version as added. This preserves the supported difference contract. The view projection pairs the shared stable key as `evolved` so the Living Connectome can present one continuing identity without inventing a new semantic difference type.

## Determinism

Frame A must precede Frame B. Both frames must be immutable, belong to the same Workspace and Studio session, retain exact snapshot bindings, and use the same stable semantic layout. Before comparison, the engine independently projects each bound runtime snapshot through the Stable Semantic World and requires exact canonical equality with the supplied frame world. A graph-only mutation therefore cannot become an Evolution difference. All identities are compared by exact stable key and exact canonical revision. Difference sequences are sorted by key. The evolution identifier is derived from the two exact frame identifiers and the canonical difference references.

Equivalent inputs therefore produce byte-equivalent JavaScript values. Input graph order, DOM order, camera position, viewport, color, animation state, and layout pixels cannot change the result.

## Stable union world

Removed cognition is absent from Frame B but must remain investigable. The engine therefore supplies a renderer-independent union of both semantic worlds:

- Frame B supplies every retained or added identity;
- Frame A supplies identities removed before Frame B; and
- stable semantic coordinates are preserved exactly.

The renderer receives this union. It never reconstructs removed nodes, pairs revisions, classifies relationships, or computes a diff.

## Controls

Cognitive Evolution adds only three controls:

| Control | Behavior |
| --- | --- |
| Compare | Enter or leave comparison for the selected adjacent pair |
| Previous Observation | Move to the preceding adjacent pair |
| Next Observation | Move to the following adjacent pair |

Compare is unavailable until two successful observations exist. No comparison starts automatically. Previous and Next select an adjacent pair even while comparison is inactive; Compare activates that exact selected pair. A controller positioned at the latest pair follows a newly accepted observation, while an explicitly selected historical pair remains stable. There is no scrubber, Time Machine, branch, counterfactual, replay change, polling, or background timer.

## Visual semantics

The stable semantic world remains visible. Unchanged cognition becomes low-contrast orientation context. Changed cognitive regions retain their structural geography and receive primary hierarchy.

Difference presentation is not color-only:

- `+` and a solid boundary identify added cognition;
- `−` and a broken boundary identify removed cognition;
- `~` and a segmented boundary identify one evolved stable identity; and
- line structure distinguishes added, removed, and modified relationships.

Selecting a node reports only its engine-supplied state: Added, Removed, Evolved, or Stable context.

## Architecture review

| Boundary | Assessment |
| --- | --- |
| MemoryOS 1.0 runtime | Unchanged; no native source or API change |
| Observation model | Reused without modification |
| Stable Semantic World | Reused; layout identifier and coordinates are required to match |
| Cognitive Trace | Unchanged |
| Cognitive Replay | Unchanged |
| Living Connectome | Consumes an immutable view; performs no comparison |
| Host adapter | Existing six-operation injection boundary only |
| Unsupported scope | No Time Machine, counterfactual, Semantic Zoom, AI summary, LLM explanation, recommendation, or runtime redesign |

**Architecture review result: conformant.** Cognitive Evolution is a pure downstream semantic comparison and introduces no public MemoryOS architecture.

## Verification

Automated web tests cover:

- identical observations with zero false positives;
- added Evidence and cognition;
- removed Evidence and cognition;
- exact revision evolution using the supported removed/added contract;
- added, removed, and modified Relationships;
- rejection of graph-only changes absent from the bound runtime snapshot;
- canonical comparison under reordered graph input;
- adjacent Previous/Next controller boundaries and selected-pair preservation;
- immutable result and stable union-world integrity; and
- renderer consistency and absence of comparison business logic.

The unchanged native Studio and complete workspace suites remain the compatibility authority for MemoryOS 1.0.

## Release evidence

All images were captures of the running local application. The changed-state captures used the documented injected-host boundary to submit two deterministic, valid observations; the capture adapter was not part of the product tree.

The historical capture artifacts named below were reviewed during this milestone but are not retained in the v1.2.1 source archive. Their truthful filenames are preserved as provenance only, not as supported links.

- Before comparison: `screenshots/memory-studio-mo1106-before-compare.jpg`
- Cognitive Evolution: `screenshots/memory-studio-mo1106-cognitive-evolution.jpg`
- Added Evidence inspection: `screenshots/memory-studio-mo1106-added-evidence.jpg`
- Evolved Reflection inspection: `screenshots/memory-studio-mo1106-evolved-reflection.jpg`
- Identical-observation verification: `screenshots/memory-studio-mo1106-identical-observations.jpg`
- 30-second silent demo: `media/memory-studio-mo1106-cognitive-evolution.gif`
