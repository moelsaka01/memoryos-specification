# MemoryOS 1.1 MO-1101 — Stable Semantic World

[MemoryOS 1.1 documentation index](README.md)

## Purpose

Sprint 1 introduces the smallest additive foundation needed for observable
cognition in Memory Studio. MemoryOS 1.0 remains the authority for memory
ownership, lifecycle, service behavior, ordering, provenance, and the frozen
CP-011 public C++ Contract.

The extension is private to the downstream web presentation. It adds no C++
type, operation, dependency, lifecycle, or architectural concept.

## Architecture analysis

Memory Studio 1.0 already provides the correct boundary: a caller supplies a
complete detached `StudioView`, and the six frozen operations return detached
results. The browser adapter mirrors those six operations without polling,
subscriptions, clocks, networking, or source ownership.

The 1.0 graph projection was deterministic for one unchanged input, but three
presentation concerns were coupled:

- graph construction used array positions and a single untyped identifier
  index;
- layout and activity semantics were inferred inside the DOM renderer; and
- selection and camera state were recreated whenever a perspective rendered.

That coupling made unchanged locations vulnerable to movement after unrelated
additions, made equal identifiers in different memory families ambiguous, and
made ambient presentation motion indistinguishable from observed state change.

## Decision

Sprint 1 adds two internal, dependency-free layers between the existing
detached observation model and the renderer:

```text
Frozen CP-011 operation result
              |
              v
    Detached Studio snapshot
              |
              v
      Typed graph projection
              |
              v
  Immutable SemanticWorld frame
  - stable typed keys
  - fixed semantic anchors
  - explicit positioned nodes
  - explicit edge flow metadata
              |
              v
  Observation frame timeline
  - ingestion sequence
  - previous/current delta
  - no wall clock
              |
              v
      Presentation renderer
  - consumes positioned world
  - emits interaction state
  - does not acquire memory
```

`semantic-world.js` is the pure projection boundary. It canonicalizes nodes
and edges, rejects malformed or duplicate keys, assigns coordinates from
fixed capability anchors plus stable key hashes, and returns a deeply frozen
world. Layout never depends on graph degree, input array position, sibling
count, wall-clock time, randomness, or a force simulation.

`observation-timeline.js` accepts only successful detached `Observe` results
from the same Workspace and Studio session. Each frame receives a contiguous
ingestion sequence, uses that sequence in its collision-free timeline-local
identifier, and owns an immutable snapshot, world, and topology delta.
The first frame has no activity. Later frames mark only added or changed nodes
and edges; Inspect, navigation, and perspective changes do not create frames.
Exact canonical revisions determine equality. Compact hashes label frames and
place nodes, but never decide whether semantic state changed.

## Stable identity and provenance

Graph keys are typed by memory family. Equal text identifiers in Memory,
Long-Term Memory, and Semantic Memory remain distinct locations. Evidence
resolution uses separate indexes for Working, Long-Term, Semantic, Episodic,
and Procedural sources. A source can no longer be overwritten by an unrelated
family that happens to use the same identifier.

Every directly inspectable graph location also carries its exact observation
path. This preserves distinct Retrieval candidates and Provider descriptors
even when their displayed identifiers are equal.

## Follow interaction

Follow is presentation state, not a MemoryOS operation. The application owns a
serializable view state containing the selected key, followed key, active
filter, interaction mode, and camera. The renderer consumes that state and
emits updated state after explicit user interaction.

Following a node centers the camera on its stable semantic key. It remains
followed across perspectives and accepted observation frames while that key is
present. Selecting another node while Follow is active transfers Follow to
that explicit node. Manual panning or fitting the graph ends Follow. If an
accepted frame no longer contains the key, Follow clears deterministically.

Follow does not traverse inferred relationships, mutate memory, create
activity, or add an operation to the frozen Studio service.

## Observable motion

The detached graph is static by default. Continuous node pulses, edge currents,
synapse motion, and live-state indicators are disabled. A finite highlight is
applied only when the accepted current frame reports an actual topology delta.
Camera transitions occur only in response to explicit view interaction.

The built-in reference observation is therefore presented as an observed
frame, not a live stream. A host may inject real detached operation results
through the existing six-operation adapter; Studio still does not poll or
subscribe to a source.

## Replay readiness

Sprint 1 does not expose Replay, Diff, Semantic Zoom, or Time Machine. It makes
them implementable without changing MemoryOS 1.0 by establishing immutable,
ordered observation frames with deterministic world fingerprints and explicit
deltas. No replay controls, inferred history, synthetic frames, or autonomous
playback are included.

## Compatibility invariants

- The CP-011 public header and implementation are unchanged.
- The six frozen Studio operations are unchanged.
- CP-001 through CP-010 have no dependency on Studio.
- Studio remains passive, provider-independent, and Runtime-lifetime
  independent.
- Workspace identity, source identity, stored order, result codes, and
  explanation chains remain exact.
- Forgetting a Studio session clears private frame and view state without
  modifying a MemoryOS source.

## Verification

Automated presentation tests cover:

- canonical world equality under graph input permutation;
- stable coordinates after unrelated topology additions;
- typed provenance under cross-family identifier collisions;
- exact paths for duplicate Retrieval candidate locations;
- immutable, contiguous observation frames;
- collision-free frame addressing despite compact fingerprint collisions;
- empty first-frame activity and precise changed-frame deltas;
- deterministic selection and Follow reconciliation across observations;
- absence of random, clock, force, polling, and streaming dependencies;
- renderer separation from snapshot and host-adapter concerns; and
- static default presentation with finite observation-derived activity.

The existing native Studio behavior, allocation-failure, API, example, and
architecture-boundary suites remain the compatibility gate.

## Historical Sprint 2 recommendation

This recommendation records the state at MO-1101 closure. It was superseded
by the released [MO-1102 Cognitive Trace](memoryos-1.1-sprint-2.md) and the
final [MO-1108 integrated workflow](memoryos-1.1-integration-workflow.md).

Add explicit frame navigation and a read-only observation diff over frames
already accepted by the same Studio session. Keep acquisition outside Studio:
the host continues to submit coherent detached observations through the frozen
adapter. Sprint 2 should expose no autoplay or synthetic time, and should defer
Semantic Zoom and Time Machine until frame navigation and diff semantics are
independently verified.
