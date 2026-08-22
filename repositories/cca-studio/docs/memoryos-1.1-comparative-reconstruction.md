# MemoryOS 1.1 MO-1107 — Comparative Reconstruction

## Purpose

Comparative Reconstruction answers one engineering question: **At which exact semantic step did two cognitive investigations diverge?** It synchronizes two immutable Cognitive Traces over adjacent Observation Frames and presents them in one stable semantic world. MemoryOS 1.0, Cognitive Trace, Cognitive Replay, Cognitive Evolution, and the Living Connectome geography remain unchanged.

## Architecture

```text
Observation Frame A                 Observation Frame B
        │                                   │
        ▼                                   ▼
validated Cognitive Trace A        validated Cognitive Trace B
        │                                   │
        └──────────────┬────────────────────┘
                       ▼
          Comparative Reconstruction engine
          - resolves exact frame revisions
          - aligns semantic identities
          - classifies exact divergences
          - reuses the Evolution union world
                       │
          immutable Reconstruction result
                       │
             Comparative Replay controller
             - synchronized cursor
             - pause at divergence
             - explicit resume
                       │
               immutable projection
                       │
               Living Connectome renderer
               presentation only
```

`web/js/cognitive-comparative-reconstruction.js` owns semantic alignment and divergence classification. `web/js/cognitive-comparative-replay.js` owns the pure synchronized replay state machine. `web/js/app.js` owns explicit controls and the finite presentation timer. `web/js/graph.js` consumes completed projections; it does not build traces, compare revisions, align steps, or detect divergence.

## Reconstruction contract

The engine accepts exactly two immutable, validated Cognitive Traces and their exact bound Observation Frames. Frame A must precede Frame B. Both investigations must belong to the same Workspace, Studio session, and stable layout. Each frame is independently validated against its detached runtime snapshot before comparison.

The engine resolves every replay reference against the semantic revision in its own bound frame, then aligns the two ordered sequences by exact `element type + stable key` identity. Alignment uses a deterministic longest-common-subsequence table. When two equal-length choices exist, the Frame A-only step is emitted first. Inserted or removed cognition therefore produces one local divergence and later shared cognition can reconverge; positional zipping cannot manufacture a cascade of false changes.

Each immutable moment is one of:

| State | Meaning |
| --- | --- |
| `shared` | Both traces contain the same semantic identity, exact revision, trace role, and traversal direction. |
| `a-only` | The exact semantic step exists only in Observation A. |
| `b-only` | The exact semantic step exists only in Observation B. |
| `modified` | Both traces contain the same identity, but its exact semantic revision or trace binding differs. |

The only emitted reason codes are `A_ONLY`, `B_ONLY`, `SEMANTIC_REVISION_CHANGED`, `RELATIONSHIP_REVISION_CHANGED`, and `TRACE_BINDING_CHANGED`. Results contain stable references and canonical fingerprints only. Semantic payload remains owned by the immutable Observation Frames.

## Synchronized replay

Both investigations share one cursor over the aligned reconstruction. Shared cognition advances as one route. At every divergent moment, replay pauses before any later step becomes current. Play explicitly acknowledges that divergence and resumes synchronized reconstruction. The next divergence pauses again.

Cognitive Evolution remains an independent view. Its existing Compare control first answers **What changed?** without entering Comparative Reconstruction. The engineer then explicitly chooses **Compare traces** from the Evolution context to answer **Where did the investigations diverge?** Leaving Comparative Reconstruction returns to the existing Evolution view.

The controller supports only:

| Control | Behavior |
| --- | --- |
| Compare | Leave Comparative Reconstruction and return to the selected Cognitive Evolution comparison. |
| Play | Begin reconstruction or explicitly continue from a divergence. |
| Pause | Stop at the current semantic moment. |
| Previous Step | Move one aligned semantic moment backward. |
| Next Step | Move one aligned semantic moment forward. |
| Reset | Return both investigations to the synchronized ready state. |

Space toggles Play/Pause, Left and Right move one step, and R resets. There is no scrubber, Time Machine, branch, counterfactual, background polling, or automatic start.

## One semantic world

Comparative Reconstruction reuses Cognitive Evolution's validated union world. Shared cognition is rendered once. The graph is never duplicated and layout is never compared. Stable semantic coordinates remain unchanged throughout reconstruction.

Presentation is structural as well as chromatic:

- Observation A uses a solid square marker and solid route;
- Observation B uses a dashed diamond marker and dashed route;
- a modified shared identity uses a split `A|B` marker;
- shared steps use one unified route;
- completed cognition remains visible, the current moment receives primary hierarchy, future cognition stays quiet, and the surrounding world remains available as orientation context.

Per-side occurrence state is retained even when an identity moves within a trace. At an A-only moment the A route is current while the matching B occurrence remains future; at the later B-only moment A is completed while B is current. The renderer never collapses those phases into one false shared emphasis.

The investigation rail states the exact semantic role, Observation A reference, Observation B reference, deterministic reason, and aligned step. It does not summarize, infer, or recommend.

## Determinism and failure behavior

Equivalent frame-and-trace inputs produce byte-equivalent reconstruction values, identifiers, moment order, divergence indices, and replay projections. DOM order, CSS, viewport, pixels, camera state, timers, and renderer state cannot affect the engine.

Invalid frame bindings, mutable traces, missing semantic references, Workspace or session mismatches, layout mismatches, and inconsistent projections fail before any reconstruction result is published. The existing Observation Frames, traces, Evolution results, and runtime state are never mutated.

## Architecture review

| Boundary | Assessment |
| --- | --- |
| MemoryOS 1.0 runtime | Unchanged; no native source, public Contract, or API change |
| Stable Semantic World | Reused without modification |
| Cognitive Trace | Consumed as the authoritative ordered investigation |
| Cognitive Replay | Reused to derive exact trace step order; behavior unchanged |
| Cognitive Evolution | Reused for exact frame validation and the stable union world |
| Comparative engine | Pure, renderer-independent, clock-free, and deterministic |
| Comparative controller | Pure immutable transitions; no timer or DOM access |
| Living Connectome | Consumes classifications and projection state only |
| Application | Owns engineer commands and the finite UI timer |
| Unsupported scope | No Time Machine, Counterfactual Replay, AI explanation, LLM summary, recommendation, or runtime redesign |

**Architecture review result: conformant.** Comparative Reconstruction is an additive downstream investigation capability. It introduces no new public MemoryOS architecture and does not alter previous milestones.

## Verification

Automated web tests cover:

- identical traces with one unified route and no false divergence;
- exact Evidence, Semantic Transformation, Retrieval, and Reflection divergence;
- inserted Evidence followed by deterministic realignment and reconvergence;
- invalid frame binding and mutable-trace rejection;
- synchronized replay, pause-at-every-divergence, and explicit resume;
- explicit Comparative activation with Cognitive Evolution preserved independently;
- reordered trace cognition with per-side current, completed, and future phases;
- previous, next, reset, completion, interruption, and deterministic replay;
- exact frame binding and one-world renderer consistency;
- renderer separation from semantic alignment and divergence logic; and
- non-color-only markers, exact controls, and absence of manufactured animation.

## Release evidence

Every image below is a capture of the running local application. The changed observation was supplied through the existing six-operation injected-host boundary and the capture adapter was removed after verification.

- [Before comparison](screenshots/memory-studio-mo1107-before-comparison.png)
- [Cognitive Evolution before explicit reconstruction](screenshots/memory-studio-mo1107-cognitive-evolution.png)
- [Synchronized reconstruction ready](screenshots/memory-studio-mo1107-reconstruction-ready.png)
- [Evidence divergence](screenshots/memory-studio-mo1107-evidence-divergence.png)
- [Semantic Transformation divergence](screenshots/memory-studio-mo1107-semantic-divergence.png)
- [Retrieval divergence](screenshots/memory-studio-mo1107-retrieval-divergence.png)
- [Reflection divergence](screenshots/memory-studio-mo1107-reflection-divergence.png)
- [Reconstruction complete](screenshots/memory-studio-mo1107-reconstruction-complete.png)
- [30-second silent demo](media/memory-studio-mo1107-comparative-reconstruction.gif)
