# MemoryOS v1.2.0 Known Issues

No known issue compromises MemoryOS v1.2.0 runtime correctness,
determinism, package integrity, investigation behavior, or architectural
boundaries.

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
