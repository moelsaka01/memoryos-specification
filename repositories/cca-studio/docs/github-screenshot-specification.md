# MemoryOS 1.0 GitHub Screenshot Specification

## Purpose

This document defines the eight release screenshots used to present MemoryOS
1.0 on GitHub. It is a capture specification for the real Memory Studio web
application. It does not authorize mockups, generated images, compositing,
invented telemetry, or changes to the frozen Studio Contract.

Together, the screenshots tell one product story:

```text
One cognitive topology
  -> source-preserving knowledge
  -> explicit memory formation
  -> provider-neutral observation
  -> complete, inspectable evidence
  -> deterministic Workspace integrity
```

## Authenticity contract

Every visible value shall come from the active detached Studio observation.
The checked-in deterministic reference observation is the baseline unless an
injected host observation supplies a more complete, equally valid state.

The capture process shall not:

- generate or paint nodes, edges, labels, metrics, or panels into an image;
- edit identifiers, counts, validation states, or explanation chains;
- imply live telemetry, polling, discovery, or automatic refresh;
- show Provider implementations, connectivity, or request contents that Studio
  does not observe;
- invent confidence, relevance, health, uptime, resource, or performance
  scores;
- combine UI states from different sessions into one screenshot; or
- use a graph path that cannot be reconstructed from the observed public
  values.

If a requested relationship is absent from the observation, the capture shall
show the strongest truthful partial path or be deferred. It shall not bridge
the gap visually.

## Baseline observation

The checked-in reference observation provides the following capture facts:

| Observation | Exact value |
| --- | --- |
| Contract | `CCA-STUDIO-1.0` |
| Source | `deterministic-reference-observation` |
| Workspace | `workspace-memoryos-release` |
| Observation | `observation-0001` |
| Studio session | `studio-session-011` |
| Session state | `Observed` |
| Result | `OK` |
| Memory entries | 4 |
| Active Working entries | 3 |
| Long-Term entries | 5, including 1 Archived entry |
| Semantic Concepts | 3 |
| Episodes | 3 |
| Procedures | 2 |
| Retrieval sessions | 2 |
| Retrieval candidates | 3 |
| Consolidation sessions | 2 |
| Reflections | 1 |
| Reflection sessions | 1 |
| Provider sessions | 2 |
| Provider descriptors | 3 |
| Validation checks | 6 Passed |

## Capture standard

### Desktop

- Logical viewport: `1600 x 1000`.
- Device pixel ratio: `2` where the capture environment supports it.
- Browser zoom: `100%`.
- Output format: lossless PNG in sRGB.
- Browser and operating-system chrome: excluded.
- Mouse pointer: outside the capture unless a deliberate hover is specified.
- Scroll position: page origin unless the shot specifies otherwise.
- Motion: allow the topology to settle before capture.
- Focus rings, dialogs, tooltips, and hover states: absent unless required by
  the shot.

### Mobile

- Logical viewport: `390 x 844`.
- Device pixel ratio: `3` where supported.
- Browser zoom: `100%`.
- No desktop panel may be compressed into the narrow viewport.
- Navigation and context shall use the application's real responsive states.

### Composition

- The cognitive topology remains the dominant surface.
- Workspace is the stable visual anchor.
- Capability colors remain consistent across all screenshots.
- Selection is conveyed with label, line treatment, and emphasis, not color
  alone.
- Unrelated topology is dimmed rather than removed when context is useful.
- Primary graph labels remain legible at normal GitHub README width.
- Product signals appear as compact inline observations, not a grid of
  dashboard cards.

## Screenshot 1: Mission Control

**Filename:** `memoryos-01-mission-control.png`

**README role:** Full-width hero.

**Story:** MemoryOS is one Workspace-owned cognitive system rather than a
collection of disconnected tools.

### What shall be visible

- `MemoryOS Mission Control` title and description.
- `workspace-memoryos-release` identity.
- `studio-session-011` in `Observed` state.
- Complete topology with labeled aggregate regions for Memory, Working,
  Consolidation, Long-Term, Semantic, Episodic, Procedural, Retrieval,
  Reflection, Providers, and Validation.
- Workspace hub as the dominant node.
- Compact observed signals sourced from the reference observation.
- The Working -> Consolidation -> Long-Term -> Retrieval -> Reflection
  lifecycle ribbon as observation navigation, not an implied exhaustive
  provenance chain.
- Reflection convergence context for `reflection-release-integrity`.
- Graph legend and exact-identifier controls.

### Camera position

- Use the complete-topology perspective.
- Place Workspace slightly left of the visual center.
- Place Reflection in the lower-right quadrant.
- Keep all aggregate nodes inside the graph frame.
- Reserve sufficient right-side space for the Reflection context panel.
- Use an orthographic, straight-on view with no decorative perspective tilt.

### Zoom level

- Browser: `100%`.
- Graph: `Fit`, expected effective range `86-90%`.
- All aggregate labels shall remain readable.

### UI state

- Route: `#complete`.
- Scope: `Complete`.
- Exact identifier: empty.
- Graph selection: none.
- Context panel: default Reflection convergence.
- Inspector: closed.
- Navigation: normal desktop state.
- Validation: `6/6 Passed`.

### Acceptance criteria

- No graph node is clipped.
- Workspace is the first focal point and Reflection is the second.
- Counts agree with the active observation.
- The image contains no generic dashboard-card wall.

**Caption:** Mission Control presents the complete MemoryOS lifecycle as one
Workspace-owned cognitive topology.

**Alt text:** MemoryOS Mission Control showing Memory, Working, Consolidation,
Long-Term, Semantic, Episodic, Procedural, Retrieval, Reflection, Provider, and
Validation regions connected around one Workspace.

## Screenshot 2: Reflection

**Filename:** `memoryos-02-reflection.png`

**README role:** Primary capability image.

**Story:** Reflection creates independently identified knowledge while keeping
every contributing source and explanation chain intact.

### What shall be visible

- `Memory Reflection` perspective.
- Selected `reflection-release-integrity` node.
- Exact derived knowledge text.
- The two observed sources only:
  - Semantic `sem-determinism`, with chain `ltm-002 -> sem-determinism`;
  - Procedural `proc-release-review`, with chain
    `ltm-001 -> ltm-002 -> proc-release-review`.
- Reflection session `reflection-session-001` in `Derived` state.
- Reflection context panel with `2 sources`.
- Trace provenance action.

The screenshot shall not add an Episodic source; none contributes to the
observed Reflection.

### Camera position

- Center the Retrieval-to-Reflection region.
- Position the selected Reflection slightly right of center.
- Keep its Semantic and Procedural evidence nodes visible upstream.
- Reserve approximately 30% of the width for selected context.
- Dim non-contributing topology without hiding the Workspace.

### Zoom level

- Browser: `100%`.
- Graph: approximately `110-115%`.
- Both source paths and the Reflection label shall fit without clipping.

### UI state

- Route: `#reflection`.
- Scope: `Reflection`.
- Identifier: `reflection-release-integrity`.
- Reflection node: selected.
- Provenance emphasis: enabled through the real trace interaction.
- Context panel: Reflection details.
- Inspector: open only if the implementation opens it from the selected node.

### Acceptance criteria

- The source count is exactly 2.
- Both displayed chains match the detached observation token-for-token.
- No source knowledge appears mutated, replaced, or consumed.

**Caption:** Retrieved evidence converges into a source-preserving Reflection
with every contributing explanation chain intact.

**Alt text:** Selected MemoryOS Reflection with highlighted Semantic and
Procedural evidence paths converging on independently identified knowledge.

## Screenshot 3: Semantic Knowledge

**Filename:** `memoryos-03-semantic-knowledge.png`

**README role:** Knowledge-organization image.

**Story:** Semantic Concepts organize knowledge by meaning while Long-Term
Memory remains authoritative evidence.

### What shall be visible

- `Semantic Knowledge` perspective.
- Selected `sem-determinism` concept.
- Meaning: `Equivalent observations produce the same public order.`
- Categories `behavior` and `determinism`.
- Link to `sem-provenance`.
- Explicit source reference to `ltm-002`.
- Workspace identity and provenance action.
- Neighboring Semantic Concepts for context.

### Camera position

- Center the Semantic cluster.
- Place `sem-determinism` near center-left.
- Keep `ltm-002` upstream and `sem-provenance` downstream or adjacent.
- Keep Workspace visible at lower emphasis.
- Reserve the right side for exact concept context.

### Zoom level

- Browser: `100%`.
- Graph: approximately `105-110%`.
- The selected concept, Long-Term source, categories, and direct link shall fit
  in one frame.

### UI state

- Route: `#semantic`.
- Scope: `SemanticMemory`.
- Identifier: `sem-determinism`.
- Selected node: `sem-determinism`.
- Source and relationship paths: emphasized.
- Episodic and Procedural regions: dimmed, not removed.

### Acceptance criteria

- The image never implies that Semantic owns or modifies Long-Term Memory.
- The concept identity differs visibly from the Long-Term source identity.
- Category and relationship order matches the observation.

**Caption:** Semantic knowledge has its own identity while preserving explicit
references to authoritative Long-Term evidence.

**Alt text:** Semantic Knowledge view with the selected sem-determinism concept,
its categories, linked concept, and highlighted Long-Term source ltm-002.

## Screenshot 4: Memory Lifecycle

**Filename:** `memoryos-04-memory-lifecycle.png`

**README role:** Full-width memory-formation explanation.

**Story:** Working Memory becomes retained knowledge only through explicit,
deterministic Consolidation.

### What shall be visible

- Working Memory task `task-release-review`.
- Working entry `wm-001`.
- `consolidation-session-001` in `Retained` state.
- Candidate source position `0`.
- Staged Long-Term identity `ltm-006`.
- Retained position `5`.
- Working, Consolidation, and Long-Term aggregate regions.
- Clear directional emphasis:

  ```text
  Working Memory -> Consolidation -> Long-Term Memory
  ```

The graph shall describe the observed retained session. It shall not claim
that the simplified top-level reference Long-Term aggregate already exposes
`ltm-006` unless the active observation actually does so.

### Camera position

- Frame the Working, Consolidation, and Long-Term corridor.
- Place Working upper-left, Consolidation center, and Long-Term lower-right.
- Keep Workspace faintly visible as the common owner.
- Heavily dim derived knowledge and operational regions.

### Zoom level

- Browser: `100%`.
- Graph: approximately `112-118%`.
- The selected session, source, destination identity, and retained ordinal
  shall remain readable.

### UI state

- Route: `#consolidation`.
- Scope: `Consolidation`.
- Selected node: `consolidation-session-001`.
- Context: retained candidate and provenance.
- Session state: `Retained`.
- No Reflection or Retrieval trace active.

### Acceptance criteria

- The screenshot distinguishes `wm-001` from staged `ltm-006` exactly as the
  observation records them.
- It does not depict automatic promotion or a clock-triggered transition.
- It does not show Semantic, Episodic, or Procedural mutation.

**Caption:** Explicit Consolidation records the deterministic transition from
active Working Memory to retained Long-Term knowledge.

**Alt text:** MemoryOS lifecycle view showing wm-001, a retained Consolidation
session, and the staged Long-Term identity ltm-006 inside one Workspace.

## Screenshot 5: Provider Layer

**Filename:** `memoryos-05-provider-layer.png`

**README role:** Architecture-boundary image.

**Story:** Studio observes Provider-neutral session metadata without exposing
or inventing Provider implementation state.

### What shall be visible

- `Memory Providers` perspective.
- `provider-session-001` in `Exported` state.
- `provider-reference-a` and `provider-reference-b` in stored order.
- `provider-session-002` in `Open` state.
- `provider-reference-c`.
- Workspace identity.
- Compact signals: 2 sessions, 3 descriptors, neutral semantics.
- Validation check `Provider boundary: Passed` where space permits.

Studio observes only `ProviderSession` and `ProviderDescriptor` values. The
screenshot shall not display ProviderRequest contents, bytes, external
infrastructure, or a connectivity claim.

### Camera position

- Center the Providers aggregate.
- Place the Exported session as the primary node.
- Keep the Open session as secondary context.
- Arrange descriptors around their owning session without suggesting external
  network endpoints.
- Keep Workspace visible as the ownership anchor.

### Zoom level

- Browser: `100%`.
- Graph: approximately `105-110%`.
- Both sessions and all three descriptor identifiers shall be legible.

### UI state

- Route: `#providers`.
- Scope: `Providers`.
- Selected node: `provider-session-001`.
- Context: session state and ordered descriptors.
- No fake `Connected`, latency, throughput, storage, cloud, filesystem, or
  database state.

### Acceptance criteria

- Only the two observed sessions and three descriptors are shown.
- Exported is presented as a recorded session state, not proof of external I/O.
- Provider choice never changes memory meaning, identity, or ownership.

**Caption:** Provider-neutral observation preserves Workspace identity and
descriptor order without exposing Provider-specific semantics.

**Alt text:** Memory Providers view showing one Exported and one Open session
with three ordered Provider descriptors inside the same Workspace.

## Screenshot 6: Mobile View

**Filename:** `memoryos-06-mobile.png`

**README role:** Responsive product-quality proof.

**Story:** The cognitive topology remains the primary interface on a narrow
viewport.

### What shall be visible

- MemoryOS mark and compact Mission Control identity.
- Observed status.
- Workspace node.
- Recognizable Working, Long-Term, Retrieval, and Reflection regions.
- One selected Reflection path.
- Responsive graph legend or layer affordance.
- Collapsed navigation control.
- Collapsed context or bottom-sheet affordance.
- One clear primary action, preferably `Trace provenance`.

### Camera position

- Center Workspace in the upper-middle of the available graph area.
- Keep Reflection in the lower-right.
- Crop peripheral detail before shrinking primary labels.
- Do not introduce horizontal scrolling.

### Zoom level

- Browser: `100%`.
- Graph: `Fit`, expected effective range `90-94%`.
- Aggregate labels may be selectively reduced, but Workspace and the selected
  capability shall remain readable.

### UI state

- Viewport: `390 x 844`.
- Route: `#complete`.
- Scope: `Complete`.
- Navigation: collapsed.
- Context: collapsed responsive state.
- Search: responsive compact state.
- Graph selection: Reflection.
- No desktop side panel squeezed into the viewport.

### Acceptance criteria

- No clipped controls, overlapping labels, or horizontal overflow.
- The graph occupies most of the useful viewport.
- The mobile view exposes the same observation, not a separate mock dataset.

**Caption:** Mission Control preserves the same cognitive topology and evidence
model on a focused mobile canvas.

**Alt text:** Mobile MemoryOS Mission Control with a centered Workspace,
collapsed navigation, and an emphasized Reflection path.

## Screenshot 7: Provenance Graph

**Filename:** `memoryos-07-provenance-graph.png`

**README role:** Full-width technical differentiator.

**Story:** MemoryOS exposes only explicit evidence paths and never fills a
missing relationship through inference.

### Truthful baseline paths

The checked-in reference observation supports these authentic paths:

1. Retrieval evidence:
   `ltm-001 -> sem-ownership -> retrieval candidate`.
2. Reflection evidence:
   `ltm-002 -> sem-determinism -> reflection-release-integrity`.
3. Procedural Reflection evidence:
   `ltm-001 + ltm-002 -> proc-release-review ->
   reflection-release-integrity`.

The reference observation does not contain one continuous public path from a
Working entry through Consolidation, Long-Term, a Retrieval candidate, and the
Reflection. The screenshot shall therefore show the authentic paths above and
shall not draw a synthetic connecting edge.

An injected observation may be used for a longer chain only when every link is
present in its public values and can be reproduced by Studio's real trace
operation.

### What shall be visible

- `Workspace Provenance` perspective.
- Selected `reflection-release-integrity` endpoint.
- The exact Semantic and Procedural Reflection chains.
- At least one exact Retrieval candidate chain as a distinct observed path.
- Long-Term evidence identifiers.
- Derived knowledge identities.
- Explanation-chain order.
- Workspace identity and validation state.
- A clear visual distinction between lifecycle edges and provenance references.

### Camera position

- Use a vertical or gently diagonal evidence composition.
- Place Long-Term evidence upstream.
- Place derived knowledge centrally.
- Place Retrieval and Reflection toward the destination side.
- Keep all selected evidence identifiers visible.
- Dim every unrelated edge.
- Reserve the right side for exact chain details.

### Zoom level

- Browser: `100%`.
- Graph: approximately `115-120%`.
- The selected paths shall fit without scrolling or label clipping.

### UI state

- Route: `#provenance`.
- Scope control: `Complete` as required by the Studio query contract.
- Selected endpoint: `reflection-release-integrity`.
- Trace action: active.
- Chain details: expanded.
- Unrelated topology: dimmed.

### Acceptance criteria

- Every rendered edge corresponds to an observed public reference.
- Token order matches the source explanation chain.
- Missing links remain visibly absent.
- The screenshot does not imply ownership transfer or source mutation.

**Caption:** Workspace Provenance reveals explicit evidence paths while leaving
unrecorded relationships visibly absent.

**Alt text:** MemoryOS provenance perspective showing exact Long-Term,
Semantic, Procedural, Retrieval, and Reflection evidence paths without inferred
connections.

## Screenshot 8: Workspace Health

**Filename:** `memoryos-08-workspace-health.png`

**README role:** Trust and integrity image.

**Story:** MemoryOS reports exact structural and ownership checks instead of an
opaque health score.

### What shall be visible

- `Validation State` perspective.
- Workspace identity.
- Result `OK`.
- Exactly six Passed checks:
  1. Workspace identity;
  2. Required aggregates;
  3. Deterministic ordering;
  4. Provenance chains;
  5. Provider boundary; and
  6. Runtime independence.
- Exact check details from the active observation.
- Required aggregates `6/6`.
- Complete topology as subdued structural context.
- Mechanically derived counts only where they remain legible.

The heading may use `Workspace Health` as GitHub narrative copy, but the
application perspective remains the implemented `Validation State` route.

### Camera position

- Center Workspace or the Validation aggregate.
- Keep the complete topology visible at low emphasis.
- Reserve the right side for the ordered validation checks.
- Do not replace checks with gauges or synthetic trend charts.

### Zoom level

- Browser: `100%`.
- Graph: approximately `88-92%`.
- Validation labels and check details take priority over secondary node labels.

### UI state

- Route: `#validation`.
- Effective query scope: `Complete`.
- Selected node: Validation aggregate or `workspace` validation check.
- Context: ordered checks expanded.
- Result: `OK`.
- No warning or alert state unless the injected observation contains a real
  failure.

### Acceptance criteria

- The image shows 6 Passed checks and no fabricated percentage.
- Runtime independence and Provider-boundary checks remain visible.
- Validation is presented as deterministic evidence, not live monitoring.

**Caption:** Workspace integrity is expressed through exact ownership,
ordering, provenance, Provider-boundary, and Runtime-independence checks.

**Alt text:** MemoryOS Validation State showing six Passed Workspace,
aggregate, ordering, provenance, Provider, and Runtime-independence checks.

## GitHub composition

The screenshots should appear in this order:

1. Mission Control as the full-width README hero.
2. Reflection and Semantic Knowledge as a balanced two-column row.
3. Memory Lifecycle at full width beneath the architecture overview.
4. Provider Layer and Workspace Health as a two-column trust row.
5. Provenance Graph at full width as the principal engineering
   differentiator.
6. Mobile View in a narrow centered column or beside a concise responsive
   product statement.

This sequence communicates:

```text
System -> Knowledge -> Lifecycle -> Boundaries -> Evidence -> Experience
```

## Final release checklist

Before any screenshot is committed:

- [ ] The capture comes from the real Memory Studio application.
- [ ] The source observation identifier is recorded with the capture.
- [ ] Every visible count matches that observation.
- [ ] Every highlighted relationship is present in public observed values.
- [ ] No Provider implementation state is shown.
- [ ] No Runtime implementation state is shown.
- [ ] No synthetic health, confidence, or performance metric is shown.
- [ ] Desktop captures use a consistent viewport and device scale.
- [ ] Mobile capture has no clipping or horizontal overflow.
- [ ] Text remains readable at standard GitHub README width.
- [ ] PNG output is lossless and free of browser or operating-system chrome.
- [ ] The filename, caption, and alt text match this specification.
