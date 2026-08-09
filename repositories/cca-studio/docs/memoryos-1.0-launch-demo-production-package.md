# MemoryOS 1.0 Launch Demo Production Package

## Purpose

This package defines the production of the MemoryOS 1.0 launch film from the
real running Memory Studio application. It is a storyboard, recording plan,
narration script, editorial guide, and distribution plan. It does not authorize
generated footage, synthetic application states, composited graph edges, or
changes to MemoryOS behavior.

The film positions MemoryOS plainly:

> MemoryOS is the operating system for deterministic cognitive memory.

The intended audience is AI engineers, staff engineers, software architects,
CTOs, AI researchers, recruiters, and engineering managers.

## Editorial principles

- Premium, minimal, and technically credible.
- Calm confidence rather than hype.
- Product interaction instead of slides or tutorial framing.
- One clear idea per shot.
- Real identifiers, counts, states, and provenance paths only.
- The cognitive topology remains the visual center of gravity.
- The voice explains meaning; it does not narrate every click.
- Editorial captions are visually distinct from observed application data.

## Product story

```text
Memory is not storage.
        |
        v
Memory becomes evidence.
        |
        v
Evidence becomes knowledge.
        |
        v
Knowledge becomes retrieval.
        |
        v
Retrieval prepares evidence for reflection.
        |
        v
Mission Control makes the complete system observable.
```

## Authenticity contract

All application footage shall come from Memory Studio running at:

```text
http://127.0.0.1:4173/
```

The checked-in reference observation supplies the baseline state:

| Field | Exact observation |
| --- | --- |
| Contract | `CCA-STUDIO-1.0` |
| Source | `deterministic-reference-observation` |
| Workspace | `workspace-memoryos-release` |
| Observation | `observation-0001` |
| Session | `studio-session-011` |
| Session state | `Observed` |
| Result | `OK` |
| Working entries | 3 |
| Long-Term entries | 5 |
| Derived knowledge | 8 values |
| Retrieval candidates | 3 |
| Evidence links | 11 |
| Validation | 6/6 Passed |

### Non-negotiable claim boundaries

1. Mission Control is a detached deterministic observation, not a live poller
   or Runtime monitor.
2. The retained Consolidation session stages `ltm-006`, while the displayed
   Long-Term aggregate contains `ltm-001` through `ltm-005`. The edit shall cut
   between these views and shall not animate a fabricated connecting edge.
3. Retrieval and Reflection are consecutive product-story beats, but the
   reference observation does not publish a direct Retrieval-session-to-
   Reflection edge. Narration shall say Retrieval prepares evidence for
   Reflection, not that a displayed candidate automatically becomes the
   Reflection.
4. `reflection-release-integrity` has exactly two sources:
   `sem-determinism` and `proc-release-review`. No Episodic source shall be
   added.
5. `6/6` means six structural checks Passed. It is not a health percentage.
6. Provider footage shows observed Provider sessions and descriptors. It does
   not prove filesystem, database, cloud, network, or external connectivity.
7. `Export view` returns an in-process detached result; it does not download a
   file.
8. `Forget session` shall never be clicked during production.
9. GitHub footage shall be recorded from the real published release commit. If
   that commit is not available, the GitHub scene is deferred rather than
   mocked.

# Part I: 90-second flagship film

## Master storyboard

### Scene 1 — The premise

| Field | Direction |
| --- | --- |
| Timestamp | `00:00-00:05` |
| Duration | 5 seconds |
| UI | Begin on a clean, settled `#complete` Mission Control frame emerging from black. |
| Camera | Start at a 103% editorial crop on the topology, then ease to 100% by `00:04`. |
| Mouse | Parked outside the content area. No click. |
| Transition | 12-frame fade from black. |
| Purpose | Establish that memory is a governed system, not a storage metaphor. |

On-screen caption:

> Memory is not storage.

### Scene 2 — Mission Control reveal

| Field | Direction |
| --- | --- |
| Timestamp | `00:05-00:12` |
| Duration | 7 seconds |
| UI | Full `MemoryOS Mission Control` view. Keep Working 3, Retained 5, Derived 8, Evidence 11, and Integrity 6/6 visible. |
| Camera | Hold the complete topology at Fit. Add a post-production push from 100% to 105% over the final 3 seconds. |
| Mouse | At `00:10.4`, move to the `Working` graph-layer filter in 0.6 seconds. Pause 0.5 seconds over the target. |
| Interaction | Click `Working` at `00:11.5`. |
| Transition | Straight continuation from Scene 1. Cut on the filter click. |
| Purpose | Introduce one cognitive topology and prepare the first lifecycle focus. |

On-screen caption:

> One Workspace. One cognitive system.

### Scene 3 — Working Memory

| Field | Direction |
| --- | --- |
| Timestamp | `00:12-00:21` |
| Duration | 9 seconds |
| UI | Working layer emphasized. Click the aggregate `Working`, allow route `#working` to settle, then select `wm-001`. Show `Verify release evidence`, expiration point `48`, and active task `task-release-review`. |
| Camera | Begin at 100%. Push to 108% around the selected Working node and context rail from `00:15-00:18`. |
| Mouse | Click aggregate `Working` at `00:12.2`; wait 0.9 seconds; move to `wm-001` in 0.55 seconds; click at `00:14.0`; park in the sidebar gutter. |
| Transition | Cut on aggregate selection. |
| Purpose | Show that temporary task context is explicit, ordered, and inspectable. |

On-screen caption:

> Active context remains explicit.

### Scene 4 — Consolidation

| Field | Direction |
| --- | --- |
| Timestamp | `00:21-00:31` |
| Duration | 10 seconds |
| UI | Click lifecycle link `Consolidation 1 observed`. Select `consolidation-session-001`. Hold the `Retained` state, request, candidate, and Workspace identity. |
| Camera | Reframe from Working to Consolidation with a 12-frame editorial pan. Settle at 110% on the selected session. |
| Mouse | Move to `Consolidation 1 observed` in 0.6 seconds; pause 0.5 seconds; click at `00:21.8`; wait 0.9 seconds; click `consolidation-session-001` at `00:23.1`; park. |
| Transition | Straight cut on navigation. Do not animate a Working-to-Long-Term edge. |
| Purpose | Present memory formation as an explicit recorded transition. |

On-screen caption:

> Consolidation is deliberate.

### Scene 5 — Long-Term evidence

| Field | Direction |
| --- | --- |
| Timestamp | `00:31-00:39` |
| Duration | 8 seconds |
| UI | Click lifecycle link `Long-Term 5 observed`. Select `ltm-002`: `Equivalent inputs preserve deterministic order.` |
| Camera | Cut to the separate Long-Term perspective. Push from 104% to 109% toward `ltm-002`. |
| Mouse | Click `Long-Term 5 observed` at `00:31.2`; wait 0.9 seconds; click `ltm-002` at `00:32.4`; park. |
| Transition | Clean straight cut. This is a separate observed aggregate, not a visual continuation of staged `ltm-006`. |
| Purpose | Establish Long-Term Memory as authoritative retained evidence. |

On-screen caption:

> Memory becomes evidence.

### Scene 6 — Semantic Knowledge

| Field | Direction |
| --- | --- |
| Timestamp | `00:39-00:49` |
| Duration | 10 seconds |
| UI | Click `Semantic Knowledge`, then select `sem-determinism`. Keep its meaning, categories `behavior` and `determinism`, linked concept `sem-provenance`, and source `ltm-002` readable. |
| Camera | Center the Semantic cluster. Push from 105% to 111% toward the selected concept and source detail. |
| Mouse | Hover the Semantic navigation icon until its label is readable; click at `00:39.6`; wait 0.9 seconds; click `sem-determinism` at `00:41.0`; park. |
| Transition | Cut on route change. |
| Purpose | Show knowledge derivation without ownership transfer or source mutation. |

On-screen caption:

> Evidence becomes knowledge.

### Scene 7 — Retrieval

| Field | Direction |
| --- | --- |
| Timestamp | `00:49-00:58` |
| Duration | 9 seconds |
| UI | Open `Memory Retrieval`. In `Find by exact ID`, enter `proc-release-review`, then click `Inspect`. Hold the Procedural candidate, score `87`, and chain `ltm-001 -> ltm-002 -> proc-release-review`. |
| Camera | Hold the Retrieval region at 110%. Add a restrained 104%-to-109% editorial push after Inspect completes. |
| Mouse | Click `Memory Retrieval` at `00:49.4`; wait 0.9 seconds; click the exact-ID field; enter `proc-release-review`; click `Inspect` at `00:52.0`; park after the result appears. |
| Transition | Straight cut. Do not trace in this scene. |
| Purpose | Show deterministic selection with source identity and explanation order intact. |

On-screen caption:

> Knowledge becomes retrievable.

### Scene 8 — Reflection

| Field | Direction |
| --- | --- |
| Timestamp | `00:58-01:10` |
| Duration | 12 seconds |
| UI | Click `Memory Reflection`. Clear the persisted identifier. Click `Trace 2 evidence sources` to select `reflection-release-integrity`. Show the derived knowledge and exactly two sources. |
| Camera | Place Reflection center-right with Semantic and Procedural evidence upstream. Slowly push from 106% to 112%. |
| Mouse | Click `Memory Reflection` at `00:58.3`; wait 0.9 seconds; clear the exact-ID field; click `Trace 2 evidence sources` at `01:00.2`; park for 5 seconds so the knowledge statement can be read. |
| Transition | Cut on route change; no synthetic convergence overlay. |
| Purpose | Make Reflection the visual and conceptual high point of the film. |

On-screen caption:

> Reflection preserves every source.

### Scene 9 — Trace provenance

| Field | Direction |
| --- | --- |
| Timestamp | `01:10-01:20` |
| Duration | 10 seconds |
| UI | From the selected Reflection context, click the separate `Trace provenance` button. Hold the real `Trace · Passed` state and `Trace: OK` feedback. Then open `Workspace Provenance` for the explicit evidence perspective. |
| Camera | Hold the selected Reflection at 112% through the click. Cut to the provenance perspective and frame only authentic Long-Term, derived, Retrieval, and Reflection paths. |
| Mouse | Move to context `Trace provenance` in 0.6 seconds; pause 0.5 seconds; click at `01:10.9`; hold 2 seconds; click `Workspace Provenance` at `01:14.2`; wait 0.9 seconds; select `sem-determinism`; park. |
| Transition | Cut on Provenance navigation. |
| Purpose | Prove that explanation is stored structure, not generated presentation. |

On-screen caption:

> Only recorded links are shown.

### Scene 10 — Return to Mission Control

| Field | Direction |
| --- | --- |
| Timestamp | `01:20-01:26` |
| Duration | 6 seconds |
| UI | Click the top-left MemoryOS brand link to return to `#complete`. Click `Fit graph` after the topology settles. Hold the complete graph. |
| Camera | Pull back from 110% to 100% over 4 seconds. |
| Mouse | Click the brand at `01:20.2`; wait 0.9 seconds; click `Fit graph` at `01:21.4`; move out of frame. |
| Transition | Direct route cut followed by the slow pullback. |
| Purpose | Resolve the individual lifecycle views into one coherent system. |

On-screen caption:

> Mission Control makes the system observable.

### Scene 11 — GitHub

| Field | Direction |
| --- | --- |
| Timestamp | `01:26-01:28` |
| Duration | 2 seconds |
| UI | Cut to the real GitHub repository at the MemoryOS 1.0 release commit. Show repository identity and the README hero. |
| Camera | Static 100% browser view. No scroll in the 90-second version. |
| Mouse | Parked outside content. |
| Transition | 6-frame cross-dissolve from Mission Control. |
| Purpose | Connect the product experience to an inspectable engineering artifact. |

### Scene 12 — Release lockup

| Field | Direction |
| --- | --- |
| Timestamp | `01:28-01:30` |
| Duration | 2 seconds |
| UI | Clean black field or a genuinely captured, heavily dimmed Mission Control frame. Show the existing product mark and editorial release copy only. |
| Camera | Static. |
| Mouse | Absent. |
| Transition | 18-frame fade to black. |
| Purpose | Close with the product identity. |

On-screen caption:

> MemoryOS 1.0

## 90-second narration

Read at approximately 126-132 words per minute. Keep pauses intact.

| Time | Narration |
| --- | --- |
| `00:00-00:05` | Memory is not storage. |
| `00:05-00:12` | It is a system of context, identity, evidence, and change. MemoryOS makes that system explicit. |
| `00:12-00:21` | Working Memory holds the active task. Its entries remain ordered, temporary, and owned by one Workspace. |
| `00:21-00:31` | Consolidation is deliberate. A selected Working entry is analyzed, promoted, and retained through an atomic successor boundary. |
| `00:31-00:39` | Long-Term Memory becomes the authoritative evidence layer. Identity and deterministic order remain visible. |
| `00:39-00:49` | From that evidence, MemoryOS derives knowledge by meaning. Semantic Concepts keep their own identity and preserve explicit references to their sources. |
| `00:49-00:58` | Retrieval operates across derived knowledge. Candidates remain typed, ranked deterministically, and accompanied by their explanation chains. |
| `00:58-01:10` | Reflection works from prepared evidence. It creates independently identified knowledge while keeping every contributing source intact. |
| `01:10-01:20` | Provenance is not inferred after the fact. The recorded path is inspectable, in order, back to authoritative evidence. Missing links remain absent. |
| `01:20-01:26` | Mission Control brings the complete observation together as one cognitive topology. |
| `01:26-01:30` | Deterministic memory. Preserved evidence. MemoryOS 1.0. |

## 90-second on-screen captions

Captions are chapter statements, not subtitles. Show only one at a time.

| Time | Caption |
| --- | --- |
| `00:00-00:05` | Memory is not storage. |
| `00:05-00:12` | One Workspace. One cognitive system. |
| `00:12-00:21` | Active context remains explicit. |
| `00:21-00:31` | Consolidation is deliberate. |
| `00:31-00:39` | Memory becomes evidence. |
| `00:39-00:49` | Evidence becomes knowledge. |
| `00:49-00:58` | Knowledge becomes retrievable. |
| `00:58-01:10` | Reflection preserves every source. |
| `01:10-01:20` | Only recorded links are shown. |
| `01:20-01:26` | Mission Control makes the system observable. |
| `01:28-01:30` | MemoryOS 1.0 |

# Part II: 30-second teaser

## Teaser storyboard

| Time | Duration | UI and interaction | Camera and transition | Purpose |
| --- | ---: | --- | --- | --- |
| `00:00-00:02` | 2s | Mission Control graph already visible at Fit. | Fade up in 6 frames; 100%-to-104% push. | Immediate product hook. |
| `00:02-00:06` | 4s | Prepared Working take: click `wm-001`, then cut to prepared retained Consolidation take. | Two straight cuts on selection. | Context becomes a deliberate memory transition. |
| `00:06-00:10` | 4s | Separate Long-Term take with `ltm-002` selected. | Hold at 108%. | Memory becomes evidence. |
| `00:10-00:14` | 4s | `sem-determinism` selected with `ltm-002` source visible. | Slow 104%-to-109% push. | Evidence becomes knowledge. |
| `00:14-00:18` | 4s | Prepared Retrieval Inspect result for `proc-release-review`. | Frame the three-token chain. | Knowledge becomes retrieval. |
| `00:18-00:24` | 6s | Reflection selected; click real context `Trace provenance`; hold `Trace · Passed`. | Reflection-centered push to 112%. | Signature product moment. |
| `00:24-00:27` | 3s | Return to Mission Control and click Fit. | Pull back to full topology. | Resolve the system. |
| `00:27-00:29` | 2s | Real GitHub release page. | 4-frame dissolve. | Engineering proof. |
| `00:29-00:30` | 1s | `MemoryOS 1.0` lockup. | Fade to black. | Release identity. |

## Teaser narration

> Memory is not storage. Active context becomes retained evidence. Evidence
> becomes knowledge. Knowledge remains retrievable with its explanation intact.
> Reflection preserves every source. Mission Control makes the complete system
> observable. MemoryOS 1.0.

## Teaser captions

| Time | Caption |
| --- | --- |
| `00:00-00:04` | Memory is not storage. |
| `00:04-00:09` | Memory becomes evidence. |
| `00:09-00:14` | Evidence becomes knowledge. |
| `00:14-00:18` | Knowledge becomes retrieval. |
| `00:18-00:24` | Reflection preserves its sources. |
| `00:24-00:29` | One Workspace. One cognitive system. |
| `00:29-00:30` | MemoryOS 1.0 |

# Part III: three-minute extended walkthrough

## Extended storyboard

| Time | Duration | Exact application direction | Camera and purpose |
| --- | ---: | --- | --- |
| `00:00-00:10` | 10s | Open `#complete`, click Fit, and hold the full topology. | Establish Mission Control and one Workspace. |
| `00:10-00:24` | 14s | Click `Memory`, select the Memory aggregate, then select `mem-003`. | Explain ordered foundational memory without calling it evidence derivation. |
| `00:24-00:42` | 18s | Click `Working Memory`, select `task-release-review`, then `wm-001`. | Show active task, exact value, and explicit expiration. |
| `00:42-01:02` | 20s | Click `Memory Consolidation`, select `consolidation-session-001`, and hold Retained state. | Explain explicit analysis, promotion, retention, and atomic publication. |
| `01:02-01:17` | 15s | Cut through the real sidebar to `Long-Term Memory`; select `ltm-002`. | Present a separate authoritative evidence aggregate. |
| `01:17-01:37` | 20s | Click `Semantic Knowledge`; select `sem-determinism`. | Show meaning, categories, link, and exact `ltm-002` source. |
| `01:37-01:57` | 20s | Click `Memory Retrieval`; enter `proc-release-review`; click `Inspect`; hold the score and chain. | Explain deterministic candidate order and preserved source identity. |
| `01:57-02:20` | 23s | Click `Memory Reflection`; clear the field; click `Trace 2 evidence sources`; then click context `Trace provenance`. | Hold the derived statement and exactly two source chains. |
| `02:20-02:36` | 16s | Click `Workspace Provenance`; select `sem-determinism`; run its real context trace. | Explain explicit paths and absent links. |
| `02:36-02:48` | 12s | Click `Memory Providers`; select `provider-session-001`. | Show Exported state and ordered descriptors without claiming connectivity. |
| `02:48-02:58` | 10s | Click `Validation State`; select `Provenance chains`, then `Runtime independence`. | Present exact Passed checks rather than a health score. |
| `02:58-03:12` | 14s | Return through the MemoryOS brand; click Fit; optionally select Workspace, then clear the selection. | Resolve all perspectives into Mission Control. |
| `03:12-03:26` | 14s | Cut to the real GitHub release. Hold the repository header, then perform one controlled README scroll through architecture and verification. | Connect product presentation to implementation evidence. |
| `03:26-03:30` | 4s | Release lockup and repository URL. | Fade to black. |

The extended master is intentionally `3:30` if every explanatory hold is kept.
For an exact `3:00` delivery, use the compressed timing below:

| Sequence | Exact delivery window |
| --- | --- |
| Mission Control | `00:00-00:08` |
| Memory Foundation | `00:08-00:18` |
| Working Memory | `00:18-00:32` |
| Consolidation | `00:32-00:49` |
| Long-Term Memory | `00:49-01:02` |
| Semantic Knowledge | `01:02-01:19` |
| Retrieval | `01:19-01:36` |
| Reflection | `01:36-01:57` |
| Provenance | `01:57-02:13` |
| Providers | `02:13-02:25` |
| Validation | `02:25-02:37` |
| Mission Control return | `02:37-02:45` |
| GitHub | `02:45-02:56` |
| Lockup | `02:56-03:00` |

Use the exact three-minute windows for the release deliverable. The longer
version is a recording master from which pauses may be selected safely.

## Three-minute narration

### `00:00-00:18` — Mission Control and Memory Foundation

> MemoryOS begins with a simple premise: memory is not just storage. It is
> identifiable state, owned by one Workspace and changed only through explicit
> operations. Mission Control presents the complete observation as one
> cognitive topology. The Memory Foundation keeps its entries ordered and
> deterministic, so the same state produces the same public result.

### `00:18-00:49` — Working Memory and Consolidation

> Working Memory holds temporary task context. Here, the active release-review
> task contains three entries. Each value remains inspectable, including its
> logical expiration observation. Nothing becomes durable automatically.
> Consolidation is the explicit boundary. A selected Working entry is analyzed,
> promoted into a Long-Term proposal, and retained as an atomic successor pair.
> The Service owns no memory state, and a failure publishes no partial result.

### `00:49-01:19` — Long-Term and Semantic Knowledge

> Long-Term Memory is the authoritative retained evidence layer. Identity,
> archival state, and canonical order remain visible independently of Runtime
> lifetime. Semantic Memory derives conceptual knowledge from that evidence.
> The concept has its own identity, categories, and relationships, while its
> Long-Term source remains unchanged and explicitly referenced.

### `01:19-01:57` — Retrieval and Reflection

> Retrieval operates across Semantic, Episodic, and Procedural knowledge. It
> returns detached, typed candidates with deterministic ranking and mechanical
> explanation chains. Reflection begins from prepared retrieved evidence. The
> knowledge statement is independently identified, and both contributing
> sources remain intact. Reflection does not replace the evidence, and it does
> not conceal the path that produced the result.

### `01:57-02:37` — Provenance, Providers, and Validation

> Provenance is recorded structure. Mission Control follows only the links that
> exist in the observed values; it does not infer a missing relationship for
> presentation. Provider sessions expose provider-neutral metadata while
> preserving Workspace identity and descriptor order. They do not reveal or
> select external infrastructure. Validation reports six exact structural
> checks, including provenance alignment, the Provider boundary, and Runtime
> independence.

### `02:37-03:00` — Resolution

> Every perspective returns to the same Workspace and the same cognitive
> topology. The implementation, frozen contracts, tests, examples, and
> conformance evidence are available in the repository. Deterministic memory.
> Preserved evidence. Explainable evolution. MemoryOS 1.0.

## Extended chapter captions

| Time | Caption |
| --- | --- |
| `00:00-00:08` | One Workspace. One cognitive system. |
| `00:08-00:18` | Memory begins with explicit state. |
| `00:18-00:32` | Active context remains temporary. |
| `00:32-00:49` | Consolidation is an explicit boundary. |
| `00:49-01:02` | Long-Term Memory is authoritative evidence. |
| `01:02-01:19` | Derived knowledge preserves its source. |
| `01:19-01:36` | Retrieval keeps identity and explanation intact. |
| `01:36-01:57` | Reflection derives without destroying evidence. |
| `01:57-02:13` | Provenance shows only recorded links. |
| `02:13-02:25` | Providers cannot redefine semantics. |
| `02:25-02:37` | Integrity is verified through exact checks. |
| `02:37-02:56` | The complete system remains inspectable. |
| `02:56-03:00` | MemoryOS 1.0 |

# Part IV: recording guide

## Application preparation

1. From the workspace root, start the real presentation:

   ```bash
   node repositories/cca-studio/scripts/serve.mjs
   ```

2. Open `http://127.0.0.1:4173/#complete`.
3. Confirm the header shows `Observed`.
4. Confirm the Studio session is `studio-session-011`.
5. Confirm Workspace is `workspace-memoryos-release`.
6. Confirm Mission Control signals are `3`, `5`, `8`, `11`, and `6/6`.
7. Set browser zoom to `100%`.
8. Click `Fit graph` once and wait 1 second.
9. Keep `Select nodes` active.
10. Close the inspector unless a shot explicitly needs the exact-value panel.
11. Move the pointer out of the graph before the recording slate.

Reloading the page restores the deterministic reference observation and clears
selection. Use a reload between independent takes rather than attempting to
undo every interaction.

## Exact interaction take list

Record every take separately with 5 seconds of clean handles before the first
interaction and after the final settled state.

### Take A — Mission Control

1. Open `#complete`.
2. Wait 1 second for the topology reveal.
3. Click `Fit graph`.
4. Wait 3 seconds.
5. Move to the `Working` layer filter over 0.6 seconds.
6. Pause 0.5 seconds.
7. Click once.
8. Hold 2 seconds.

### Take B — Working Memory

1. From Mission Control with Working emphasized, click graph aggregate
   `Working`.
2. Wait 0.9 seconds after route `#working` appears.
3. Click node `wm-001`.
4. Hold its context for at least 4 seconds.
5. Do not click `Trace provenance`.

### Take C — Consolidation

1. Click lifecycle link `Consolidation 1 observed`.
2. Wait 0.9 seconds.
3. Click `consolidation-session-001`.
4. Hold `Retained` for at least 5 seconds.
5. Do not visually connect its staged `ltm-006` to the displayed Long-Term
   aggregate.

### Take D — Long-Term Memory

1. Click lifecycle link `Long-Term 5 observed`.
2. Wait 0.9 seconds.
3. Click `ltm-002`.
4. Hold the evidence text for at least 4 seconds.
5. Do not run a trace from `ltm-003`; the observed result is `NOT_FOUND`.

### Take E — Semantic Knowledge

1. Hover the Semantic navigation icon until `Semantic Knowledge` is readable.
2. Click once.
3. Wait 0.9 seconds.
4. Click `sem-determinism`.
5. Hold its meaning, categories, link, and `ltm-002` source for 6 seconds.
6. Keep the source visible; do not flatten it into the concept.

### Take F — Retrieval

1. Click `Memory Retrieval`.
2. Wait 0.9 seconds.
3. Click `Find by exact ID`.
4. Enter `proc-release-review` exactly.
5. Move to `Inspect` over 0.5 seconds.
6. Pause 0.4 seconds.
7. Click `Inspect`.
8. Hold the Procedural candidate, score `87`, and chain for 6 seconds.
9. Do not imply that this displayed candidate automatically becomes the
   Reflection.

### Take G — Reflection and trace

1. Click `Memory Reflection`.
2. Wait 0.9 seconds.
3. Clear the persisted exact-ID field.
4. Click context action `Trace 2 evidence sources`.
5. Hold the selected Reflection for 4 seconds.
6. Move to the newly visible context action `Trace provenance` over 0.6
   seconds.
7. Pause 0.5 seconds.
8. Click once.
9. Hold `Trace · Passed` and `Trace: OK` for at least 2 seconds.

The first `Trace 2 evidence sources` action selects the Reflection. The second
`Trace provenance` action executes the real trace. Preserve both steps in the
recording.

### Take H — Workspace Provenance

1. Click `Workspace Provenance`.
2. Wait 0.9 seconds.
3. Click `sem-determinism`.
4. Click its context `Trace provenance` action.
5. Hold the successful trace for 5 seconds.
6. Do not draw a connection between public values where the observation has no
   recorded edge.

### Take I — Providers

1. Click `Memory Providers`.
2. Wait 0.9 seconds.
3. Click `provider-session-001`.
4. Hold its `Exported` state and descriptors
   `provider-reference-a`, `provider-reference-b` for 5 seconds.
5. Do not say `Connected` and do not add external-provider imagery.

### Take J — Validation

1. Click `Validation State`.
2. Wait 0.9 seconds.
3. Click `Validation check: Provenance chains`.
4. Hold `Passed` and `Released retrieval and reflection chains remain aligned`
   for 4 seconds.
5. Click `Validation check: Runtime independence`.
6. Hold for 3 seconds.

### Take K — Return

1. Click the top-left MemoryOS brand link.
2. Wait 0.9 seconds for `#complete`.
3. Click `Fit graph`.
4. Move the cursor out of frame.
5. Hold the complete topology for at least 6 seconds.

### Take L — GitHub

1. Open the real repository release commit in a separate browser tab.
2. Confirm the repository name, release identifier, README, screenshots, and
   documentation are actually published.
3. Record the repository header for 4 seconds.
4. For the extended cut only, perform one smooth scroll lasting 4-5 seconds.
5. Stop on architecture, verification, or documentation—not an unfinished
   placeholder.

## Cursor choreography

- Standard system pointer, normal size.
- Pointer speed equivalent to Windows `6/11`.
- Pointer acceleration and trails disabled.
- Move between targets in `0.45-0.70` seconds.
- Stop for `0.4-0.6` seconds before every click.
- Hold the post-click state for at least `1.8` seconds.
- Park in the sidebar gutter or outside the frame during reading holds.
- No cursor spotlight, artificial click ripple, or replacement cursor.
- Do not circle nodes or shake the pointer to demand attention.

## Zoom choreography

- Keep browser zoom at `100%` for every take.
- Use the real `Fit graph` control at the opening and final Mission Control
  states.
- Avoid repeated native `Zoom in` clicks; one click jumps directly to a much
  tighter graph state and makes shot matching difficult.
- Record in 4K and create restrained editorial pushes instead:
  - standard detail push: `100% -> 106%` over 18 frames;
  - feature emphasis: `104% -> 110%` over 24 frames;
  - Reflection maximum: `106% -> 112%` over 36 frames;
  - final reveal: `110% -> 100%` over 4 seconds.
- Anchor every push to the selected node or evidence chain.
- Do not move the editorial camera while the graph reveal is still settling.

# Part V: editing guide

## OBS recording settings

### Preferred capture

| Setting | Value |
| --- | --- |
| Display | `3840 x 2160`, SDR |
| Operating-system scale | `200%` |
| OBS canvas | `3840 x 2160` |
| OBS output | `3840 x 2160` |
| Capture rate | `60 fps` |
| Source | Window Capture targeting the exact browser window |
| Capture method | Windows Graphics Capture where available |
| Recording container | MKV |
| Encoder | Hardware HEVC or H.264 encoder |
| Quality mode | Constant-quality mode equivalent to CQ/CQP 12-16 |
| Keyframe interval | 1 second |
| Color space | Rec.709 |
| Range | Limited |
| Audio sample rate | 48 kHz |

Remux MKV to MP4 after capture. Do not record directly to MP4 because an
interrupted recording can invalidate the entire file.

### Fallback capture

Use `2560 x 1440` at 60 fps. Deliver a native 1440p master rather than
upscaling to 4K.

### Capture discipline

- Disable notifications, messaging overlays, browser extensions, and password
  prompts.
- Hide bookmarks, download bars, and browser chrome from the application take.
- Record narration separately as 48 kHz, 24-bit WAV.
- Disable unused desktop-audio tracks.
- Capture each interaction at least twice.
- Keep 5-second clean handles around every take.
- Verify there are no console errors before the recording session.

## Timeline and motion

| Setting | Direction |
| --- | --- |
| Master timeline | `3840 x 2160`, 30 fps, Rec.709 |
| Source interpretation | Native 60 fps; no optical flow or frame blending |
| Average shot length | 4-7 seconds |
| Reflection/provenance hold | 7-12 seconds |
| Route transition | Straight cut on the real click |
| Elapsed-time compression | 6-frame cross-dissolve only |
| Opening fade | 12 frames |
| Final fade | 18 frames |
| Caption fade-in | 8 frames |
| Caption fade-out | 8 frames |
| Caption hold | 54-90 frames |

Do not use whip pans, simulated depth, lens blur, bloom, film grain,
chromatic aberration, floating particles, or fabricated graph animation.

## Typography

- Use Inter for editorial titles and captions.
- Use Cascadia Code only for exact identifiers.
- Maximum two lines per editorial caption.
- Use sentence case.
- Keep captions outside dense graph labels.
- For 4K:
  - opening title: Inter Semibold, 112 px;
  - chapter caption: Inter Medium, 72 px;
  - support line: Inter Regular, 48 px.
- Keep at least 192 px from left and right edges and 144 px from top and bottom.
- Do not imitate an application panel; editorial copy must remain visibly
  separate from observed UI data.

## Color treatment

- Preserve the product palette and relative capability colors.
- Use no cinematic LUT.
- Keep the black floor above crushing so graph detail remains visible.
- Keep primary UI text below clipping.
- Limit saturation adjustment to approximately 100-103%.
- Do not shift MemoryOS blue, green, violet, teal, orange, or Reflection
  magenta.
- A subtle editorial vignette is permitted only if it does not obscure graph
  nodes or alter perceived UI state.

## Audio mix

- Integrated program target: approximately `-14 LUFS`.
- True peak ceiling: `-1 dBTP`.
- Narration target: approximately `-16 LUFS` short-term.
- High-pass narration near 75 Hz.
- Gentle compression around 2.5:1 with 3-5 dB gain reduction.
- Light de-essing only.
- Duck music 4-6 dB under narration with an 80 ms attack and 450 ms release.
- Deliver separate narration, music, and sound-design stems at 48 kHz/24-bit.

# Part VI: music direction

Use an original commissioned cue or a commercially cleared production-library
cue with retained license documentation. Do not reference, imitate, or edit a
copyrighted commercial track.

## Musical brief

| Attribute | Direction |
| --- | --- |
| Tempo | 82-86 BPM, preferably 84 BPM |
| Meter | 4/4 |
| Emotion | Focused, calm, intelligent, quietly consequential |
| Opening | Air and low harmonic texture; no impact hit |
| Foundation | Restrained analog pulse |
| Knowledge | Warm harmonic expansion and sparse glass-like tone |
| Retrieval | Light rhythmic definition without urgency |
| Reflection | Controlled low-frequency lift and wider harmony |
| Provenance | Brief reduction in percussion to expose the trace |
| Resolution | Stable cadence without a trailer-style climax |

Suggested palette:

- low analog pulse;
- warm evolving pad;
- sparse plucked or glass-like tone;
- soft filtered percussion;
- modest sub support at Reflection; and
- one resolved final harmonic tone.

Avoid vocals, trailer drums, risers, impacts, glitch effects, synthetic voice
samples, and generic “technology” sound clichés.

## 90-second energy map

| Time | Energy |
| --- | --- |
| `00:00-00:05` | Atmosphere only |
| `00:05-00:21` | Introduce low pulse |
| `00:21-00:39` | Add quiet rhythmic structure |
| `00:39-00:58` | Harmonic lift through knowledge and Retrieval |
| `00:58-01:10` | Controlled peak at Reflection |
| `01:10-01:20` | Reduce percussion for provenance clarity |
| `01:20-01:26` | Harmonic release on Mission Control |
| `01:26-01:30` | Resolved cadence and silence |

# Part VII: thumbnail specification

## Source

Capture a fresh real Mission Control frame from `#complete` with:

- Workspace hub visible;
- Reflection region visible;
- complete topology at Fit;
- default Reflection convergence context; and
- no open modal, tooltip, inspector, or cursor.

Cropping, a localized dark editorial scrim, and release typography are
permitted. Do not redraw nodes, combine different application states, or add
fabricated glow and metrics.

## YouTube thumbnail

| Field | Direction |
| --- | --- |
| Canvas | `1280 x 720`, sRGB |
| Output | JPG quality 88-92, under 2 MB |
| Composition | Workspace near center; Reflection context on the right third |
| Primary copy | `MemoryOS 1.0` |
| Optional support copy | `Memory becomes evidence.` |
| Typeface | Inter Semibold / Inter Medium |
| Accent | One thin blue or Reflection-magenta accent |

Do not use a face, arrow, “AI brain” label, fake performance metric, flame,
explosion, red circle, or hype phrase.

## Thumbnail test

At 10% scale, the viewer must still identify:

1. the MemoryOS topology;
2. the Workspace center;
3. the Reflection accent; and
4. `MemoryOS 1.0`.

# Part VIII: LinkedIn version

## Primary format

- Canvas: `1080 x 1350` (`4:5`).
- Frame rate: 30 fps.
- Codec: H.264 High Profile.
- Audio: AAC, 48 kHz.
- Duration: 30 seconds.
- Start with the graph already visible; do not spend the opening on a logo.

Record a separate real responsive take where possible. Do not squeeze a
desktop side panel into portrait framing. For detailed desktop moments, crop a
single real region and cut to another real region rather than building a
synthetic composite.

## LinkedIn scene order

| Time | Scene |
| --- | --- |
| `00:00-00:02` | Mission Control already in motion; `Memory is not storage.` |
| `00:02-00:06` | Working and separate retained Consolidation states |
| `00:06-00:10` | Long-Term `ltm-002` and Semantic `sem-determinism` |
| `00:10-00:15` | Retrieval candidate and explanation chain |
| `00:15-00:21` | Reflection with its two real sources |
| `00:21-00:26` | Real provenance trace |
| `00:26-00:28` | Mission Control Fit view |
| `00:28-00:29` | Real GitHub release page |
| `00:29-00:30` | `MemoryOS 1.0` lockup |

## Vertical crop strategy

- Keep Workspace in the middle 60% of the frame.
- Use Reflection as the primary lower-third visual anchor.
- Move editorial captions above or below the selected graph path, never over
  exact identifiers.
- Preserve at least 72 px at the sides, 96 px at the top, and 180 px at the
  bottom for platform overlays.
- Use the application's real responsive state for complete-interface shots.
- Keep each crop spatially stable; avoid constant horizontal reframing.

## Caption recommendations

- Burn in reviewed captions for muted autoplay.
- Also upload an edited SRT sidecar when supported by the publishing workflow.
- Manually correct:
  - `MemoryOS`;
  - `Long-Term Memory`;
  - `ltm-002`;
  - `sem-determinism`;
  - `proc-release-review`;
  - `reflection-release-integrity`; and
  - `Workspace`.
- Maximum two lines.
- Prefer 3-7 words per caption card.
- Keep each card visible for 0.9-2.5 seconds.
- Leave a minimum two-frame gap between editorial caption cards.
- Use Inter Semibold at approximately 52 px on the 1080 x 1350 canvas.
- Use a dark, high-contrast caption plate only when the graph beneath is too
  dense for reliable readability.

## LinkedIn opening copy

> Memory is not storage.

Do not begin with “We are excited to announce,” a logo animation, a feature
list, or a generic AI claim.

# Part IX: release deliverables

## Video exports

| Deliverable | Specification |
| --- | --- |
| Archive master | 4K ProRes 422 HQ, 30 fps, 48 kHz/24-bit |
| 90-second distribution | 4K H.264 High Profile, two-pass high-quality encode |
| 30-second teaser | 4K and 1080p H.264 |
| Three-minute walkthrough | 4K and 1080p H.264 |
| LinkedIn feed | 1080 x 1350 H.264, 30 fps |
| Optional vertical alternate | 1080 x 1920 H.264, 30 fps |
| Captions | Reviewed SRT for each narration version |
| Audio stems | Narration, music, and sound design at 48 kHz/24-bit |
| Thumbnail | 1280 x 720 JPG and editable source |

## Final production checklist

### Product truth

- [ ] Every shot comes from the real running Memory Studio application.
- [ ] Workspace, session, identifiers, counts, and states match the active
      observation.
- [ ] Reflection shows exactly two observed sources.
- [ ] Retrieval is not presented as a direct published edge to Reflection.
- [ ] Consolidation `ltm-006` is not composited into the displayed Long-Term
      aggregate.
- [ ] Provenance shows only recorded edges.
- [ ] Providers are not presented as connected infrastructure.
- [ ] Validation 6/6 is described as six Passed checks, not a percentage.
- [ ] GitHub footage comes from the real release commit.

### Capture

- [ ] Browser zoom is 100%.
- [ ] No notification, browser, developer-tool, or operating-system chrome is
      visible.
- [ ] The pointer is deliberate and parked during reading holds.
- [ ] Every route has at least two takes and 5-second clean handles.
- [ ] Graph motion settles before the usable hold.
- [ ] No accidental `Forget session` interaction occurred.

### Edit

- [ ] One idea is communicated per shot.
- [ ] Reflection receives the longest visual hold.
- [ ] Editorial copy never looks like observed application data.
- [ ] No fabricated UI, nodes, paths, metrics, or motion were added.
- [ ] Captions remain readable on desktop, mobile, and LinkedIn crops.
- [ ] Narration is intelligible without music.
- [ ] Music is original or properly licensed.
- [ ] Final audio meets the target loudness and true-peak ceiling.

### Release

- [ ] 90-second master reviewed in full.
- [ ] 30-second teaser reviewed without audio.
- [ ] Three-minute narration matches the final UI edit.
- [ ] LinkedIn crop keeps essential content inside safe margins.
- [ ] SRT identifiers were manually corrected.
- [ ] Thumbnail uses one real Mission Control capture.
- [ ] Repository URL and release designation are correct.

## Final viewer takeaway

The film succeeds when the viewer understands, without a feature list, that
MemoryOS treats memory as deterministic, Workspace-owned, source-preserving
cognitive state—and that Mission Control makes that state observable without
inventing behavior.
