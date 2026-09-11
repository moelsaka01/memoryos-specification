# MemoryOS v1.2.1 Known Issues

No known issue compromises MemoryOS v1.2.1 runtime correctness,
determinism, package integrity, investigation behavior, or architectural
boundaries.

## Resolved in v1.2.1 — v1.2.0 source publication inventory

| Field | Assessment |
|---|---|
| Status | Resolved by v1.2.1 |
| Impact | v1.2.0 clean clones and source archives could not reproduce the complete released build, test, and conformance inventory |
| Scope | Distribution and conformance provenance only; no normative or product semantic change |

The v1.2.0 Git tree omitted already-intended Core and Studio source, registered
tests, MIP fixtures, examples and benchmarks, required documentation, and the
frozen Standard and MIP publication directories. Its conformance inventory also
retained pre-CSP hashes for two Studio tests and the pre-CSP Studio JavaScript
aggregate, while the released source tree contained the authoritative CSP-safe
revisions.

v1.2.1 restores the exact reviewed bytes, keeps the CSP-safe revisions, and
publishes new evidence bound to the repaired tracked tree. It does not change
CCA-MEMORYOS-1.0, CCA-MIP-1.0, Investigation Core, SDK, CLI, Cognitive
Regression, Cognitive Investigation Explorer, lifecycle, or Studio semantics.
The v1.2.0 commit, tag, manifest, and evidence remain immutable historical
records and must not be relabeled as v1.2.1 evidence.

## Observe → Trace discoverability

| Field | Assessment |
|---|---|
| Status | Open; planned for a future usability refinement |
| Impact | Low |
| Scope | First-time usability only |

### Behavior

Trace begins after the engineer selects a valid Reflection while in Observe.
The deterministic workflow is fully functional, but this entry interaction
may not be immediately obvious to a first-time user.

### Workaround

In Observe, select a Reflection node or its unambiguous owning Reflection
aggregate or session. The validated Trace activates and enables Replay.
Complete Replay and ensure that two observations exist before Compare becomes
available.

### Not affected

- Runtime
- Determinism
- Cognitive Trace
- Cognitive Replay
- Cognitive Evolution
- Comparative Reconstruction
- Cognitive Regression
- Cognitive Investigation Explorer
- Memory Investigation Packages
- Public APIs
- MemoryOS architecture

## Source license

| Field | Assessment |
|---|---|
| Status | Pending authorized owner decision |
| Impact | External source use and contribution terms are not granted |
| Scope | Repository licensing only |

The repository currently grants no software license. The
[LICENSE](LICENSE) file is a notice, not an open-source grant. An authorized
owner must select the copyright, source license, inbound contribution, and
artifact terms.

The separately published MemoryOS Standard is an open technical standard. Its
publication does not grant a license to the Reference Implementation source.
