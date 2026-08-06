# Memory Consolidation

Memory Consolidation implements CCA-CONS-1.0 as an explicit, deterministic
Working-to-Long-Term transition within one Workspace. It promotes exactly one
accessible `WorkingMemoryEntry` into one same-identity
`LongTermMemoryEntry`. Consolidation does not derive a second knowledge
identity, select candidates, or modify Semantic, Episodic, or Procedural
Memory.

CCA-CONS-1.0 implements only the frozen `Working -> Long-Term` edge. The
`Created -> Long-Term` and `Reflected -> Long-Term` edges remain under CP-008
architectural stewardship but are outside this public contract.

## Public contract

The installed header is `<cca/memory/memory_consolidation.hpp>`. It declares
the exact four public Assets and one stateless Service required by API-011-HPP:

| Declaration | Responsibility |
| --- | --- |
| `ConsolidationRequest` | Owns one Workspace, active-task, and exact Working-entry identifier. |
| `ConsolidationCandidate` | Owns source provenance, the staged Long-Term proposal, and the retained ordinal as its stage permits. |
| `ConsolidationSession` | Owns one Workspace's operational lifecycle and, after retention, an independent successor pair. |
| `ConsolidationResult` | Owns an operation's exact code, message, and stage-specific detached payload. |
| `MemoryConsolidationEngine` | Performs exactly `analyze`, `promote`, `retain`, `validate`, `retrieveSession`, and `forgetSession`. |

A request requires a non-empty Workspace identifier. Empty construction throws
`std::invalid_argument`; empty task and source identifiers remain representable
so `analyze` can return their deterministic semantic failures. Identifiers are
case-sensitive. Request construction neither observes memory nor begins a
session.

A session also requires a non-empty immutable Workspace identifier. Copy
construction is deep. Move construction transfers its complete state and
leaves the source Pristine under its original Workspace. Assignment is
disabled so an existing session cannot be rebound. A candidate has no public
source-forging constructor: only the engine can establish its initial source
evidence. Results are operation-produced and move-only. The engine owns no
state between calls.

## Lifecycle and observations

The complete session lifecycle is:

```text
Pristine --analyze--> Analyzed --promote--> Promoted --retain--> Retained
    |                     |                    |                    |
    +---------------------+--------------------+--------------------+
                              forgetSession
                                   |
                                   v
                                Forgotten
```

`promote` is idempotent in Promoted. `forgetSession` succeeds from every
state, is idempotent in Forgotten, and makes Forgotten terminal. `validate`
and `retrieveSession` are observational.

| State | `request()` | `candidate()` | `workingMemory()` | `longTermMemory()` |
| --- | --- | --- | --- | --- |
| Pristine | null | null | null | null |
| Analyzed | present | analyzed | null | null |
| Promoted | present | promoted | null | null |
| Retained | present | retained | successor | successor |
| Forgotten | null | null | null | null |

Session pointers remain valid until the session is mutated or destroyed.
Candidate entry pointers and its retained-position reference remain valid
until that candidate is assigned, moved from, or destroyed. Result pointers
remain valid until the result is move-assigned or destroyed.

## Candidate provenance and stage shape

Successful analysis records the exact Workspace, active task, zero-based
Working insertion position, and complete source entry, including identifier,
value, and optional logical expiration point. This is owned operational
provenance with no reference into the caller's Working aggregate.

- An Analyzed candidate has a Working snapshot, no Long-Term proposal, and no
  retained position.
- A Promoted candidate adds exactly one non-Archived `LongTermMemoryEntry`
  proposal with the same identifier and value.
- A Retained candidate preserves both snapshots and records the proposal's
  zero-based position in the Long-Term successor.

Task identity, source position, and expiration remain Working-state
provenance. They are not encoded into the Long-Term identifier or value and do
not create hidden Long-Term task or expiration state.

## Operations

### `analyze`

`analyze` requires a Pristine session, one active same-Workspace Working
aggregate whose task exactly matches the request, an exact accessible source,
and a same-Workspace Long-Term aggregate in which the identity is neither
present nor irreversibly Forgotten. Success privately captures complete
independent prestates, establishes Analyzed, and returns only an independent
candidate. It modifies neither aggregate and performs no transition.

### `promote`

`promote` stages the exact typed Long-Term proposal and establishes Promoted.
It neither observes a live aggregate nor establishes authoritative Long-Term
state. Repeating it in Promoted returns an equivalent candidate without
changing the session.

### `retain`

`retain` requires Promoted and revalidates the exact source, complete Working
prestate, complete publicly observable Long-Term prestate, and target
Forgotten eligibility. It constructs and publishes one logical successor
pair:

1. the Working successor omits only the selected entry and preserves its
   Workspace, active task, every survivor's value and expiration, and survivor
   relative order; and
2. the Long-Term successor preserves every existing Long-Term or Archived
   entry, state, forgotten-identity history, and canonical order, then appends
   the non-Archived same-identity proposal.

The retained position is the destination's prior size. The operation returns
a complete result-owned pair and commits a separate, independently owned but
publicly equal pair to the Retained session.

### `validate`

For Analyzed or Promoted, `validate` compares the supplied aggregates with the
captured prestate and destination eligibility. For Retained, the supplied
aggregates must equal the session-owned successor pair in every publicly
observable detail. Validation neither mutates nor reserves its assessment
against future caller changes.

### `retrieveSession`

`retrieveSession` succeeds in all five states and returns only a complete,
independently owned session copy. It performs no engine-registry lookup and
does not invoke Memory Retrieval.

### `forgetSession`

`forgetSession` clears only operational request, candidate, prestate,
proposal, ordinal, and successor evidence. It never calls Working or Long-Term
`forget`, never changes a memory base state, and cannot invalidate an
independently owned earlier result or retrieved session.

## Functional successor-pair boundary

Caller-supplied Working and Long-Term values are const prestates and remain
unchanged on success, semantic failure, and propagated exception. Retention
does not assign into or replace either aggregate. The result-owned pair is the
atomic publication boundary: callers may retain it, or copy-construct both
successors into a newly staged enclosing Workspace owner and publish that
owner as one unit.

The unchanged inputs are historical prestate values, not a second current
semantic state. A successful pair contains the identity in exactly one base
state: absent from successor Working and present once in successor Long-Term.
There is no observable partial pair.

## Determinism and validation

Source position is Working insertion order. Source removal preserves survivor
order. Destination retention appends after every existing Long-Term or
Archived entry. Equivalent requests, sessions, prestates, and operation
histories produce equivalent codes, messages, provenance, states, successor
values, and ordering without clocks, locale, addresses, unordered iteration,
scheduling, Runtime state, or Provider choice.

Validation precedence is fixed by API-011. In summary:

- `analyze` checks Forgotten and stage, then request, Working, and Long-Term
  Workspace correspondence before task, identifier, activity, source, and
  destination eligibility.
- `promote` checks Forgotten and its exact stage outcomes before candidate
  shape.
- `retain` checks Forgotten and exact stage outcomes, Promoted request/source/
  proposal shape, both Workspace boundaries, activity, task, selected source,
  remaining Working state, destination conflict, public Long-Term prestate,
  and target Forgotten eligibility.
- `validate` checks lifecycle, both Workspace boundaries, stage shape, then
  the corresponding prestate or retained-successor invariants.
- `retrieveSession` and `forgetSession` have no semantic failure for a
  well-formed session.

## Results and failures

`succeeded()` is true exactly for `OK`. Success has an empty message. Failure
has a stable non-empty message and no candidate, session, Working, or
Long-Term payload.

| Code | Meaning |
| --- | --- |
| `OK` | The operation succeeded. |
| `SESSION_FORGOTTEN` | A non-retrieval/non-forgetting operation targeted Forgotten. |
| `SESSION_ALREADY_STARTED` | Analysis targeted a started session. |
| `SESSION_NOT_ANALYZED` | Promotion, retention, or validation targeted Pristine. |
| `SESSION_NOT_PROMOTED` | Retention targeted Analyzed. |
| `SESSION_ALREADY_RETAINED` | Promotion or retention targeted Retained. |
| `WORKSPACE_MISMATCH` | A request or aggregate belongs to another Workspace. |
| `INVALID_TASK_IDENTIFIER` | The request task identifier is empty. |
| `INVALID_IDENTIFIER` | The source identifier is empty. |
| `WORKING_MEMORY_NOT_ACTIVE` | Working Memory is inactive. |
| `TASK_MISMATCH` | The active task differs from the request. |
| `SOURCE_NOT_FOUND` | Analysis cannot find the exact source. |
| `SOURCE_CHANGED` | The selected analyzed source moved, disappeared, or changed. |
| `DESTINATION_CONFLICT` | Long-Term or Archived state already contains the identity. |
| `DESTINATION_FORGOTTEN` | The destination lineage permanently reserves the identity. |
| `TRANSITION_STATE_MISMATCH` | Other lifecycle, prestate, proposal, or successor structure differs. |

Successful payloads are exact: analyze/promote return only a candidate;
retain returns a candidate and pair; validate/forget return none; and
retrieveSession returns only a session. Moving a candidate leaves empty
Workspace/task identifiers, source position zero, null entry pointers, and no
retained position. Moving a result leaves it unsuccessful with empty code and
message and null payloads.

Every mutating operation stages fallible work before commit. Semantic failure
or an allocation/construction exception leaves the complete session and input
aggregates unchanged and publishes no partial successor pair. Distinct values
and engines support independent concurrent use; concurrent access to one
session while any access mutates it is outside the contract.

## Persistence, Runtime, and Provider boundaries

Consolidation adds no Persistence type, format, operation, or private mapping.
Requests, candidates, sessions, proposals, ordinals, result wrappers, and
successor copies as operational evidence are not persisted. After an
enclosing Workspace owner atomically adopts a completed Long-Term successor,
that ordinary Long-Term state remains eligible for the existing private,
provider-independent CCA-LTMEM-1.0 Persistence mapping. Persistence never
starts, resumes, advances, or forgets a consolidation session.

Runtime may host the stateless `MemoryConsolidationEngine`, but Runtime
lifetime, clocks, threads, registries, event buses, diagnostics, startup, and
shutdown own no consolidation value and determine no outcome. Provider
identity likewise cannot determine eligibility, identity, ordering,
validation, or publication.

The capability performs no automatic or background promotion, batching,
selection, scoring, optimization, deduplication, expiration, retrieval,
classification, reflection, reasoning, planning, execution, inference,
archival, restoration, or memory forgetting. It does not modify Semantic,
Episodic, or Procedural Memory.

## Example

The public example is
[`examples/memory_consolidation_usage.cpp`](../examples/memory_consolidation_usage.cpp).
It exercises all six operations, verifies that caller prestates remain
unchanged, validates and copies the functional successor pair, and forgets
only the original operational session.

## Requirement coverage

| Requirement | Automated or review evidence |
| --- | --- |
| CCA-CONS-001 | Frozen-authority and constitutional architecture review |
| CCA-CONS-002 | Working-to-Long-Term-only transition boundary checks |
| CCA-CONS-003 | Exact four-Asset declaration audit |
| CCA-CONS-004 | Exact stateless Service and six-operation API audit |
| CCA-CONS-005 | Released dependency and acyclicity inspection |
| CCA-CONS-006 | Session Workspace construction and immutability tests |
| CCA-CONS-007 | Single-entry request ownership and inertness tests |
| CCA-CONS-008 | Pristine lifecycle and null-payload tests |
| CCA-CONS-009 | Complete lifecycle transition tests |
| CCA-CONS-010 | All-state session observation and lifetime tests |
| CCA-CONS-011 | Caller-owned all-state retrieval and no-registry audit |
| CCA-CONS-012 | Engine-only candidate establishment audit |
| CCA-CONS-013 | Complete source provenance tests |
| CCA-CONS-014 | Analyzed, Promoted, and Retained candidate-shape tests |
| CCA-CONS-015 | Workspace boundary and ordering tests |
| CCA-CONS-016 | Active Working task precondition tests |
| CCA-CONS-017 | Exact-source and prestate-drift tests |
| CCA-CONS-018 | Long-Term, Archived, and Forgotten destination tests |
| CCA-CONS-019 | Same-identity/value and non-Archived proposal tests |
| CCA-CONS-020 | Working-only metadata non-leakage tests |
| CCA-CONS-021 | Analyze capture, atomicity, and non-interference tests |
| CCA-CONS-022 | Promote success, repetition, and atomicity tests |
| CCA-CONS-023 | Functional retain revalidation and commit tests |
| CCA-CONS-024 | Working successor survivor and ordering tests |
| CCA-CONS-025 | Long-Term successor preservation and append tests |
| CCA-CONS-026 | Stage-specific observational validate tests |
| CCA-CONS-027 | Independent retrieveSession tests in all five states |
| CCA-CONS-028 | Terminal, idempotent all-stage session-forgetting tests |
| CCA-CONS-029 | Atomic and independently owned successor-pair tests |
| CCA-CONS-030 | Input non-interference tests for every outcome |
| CCA-CONS-031 | Complete unrelated-state preservation tests |
| CCA-CONS-032 | Repetition and wrong-stage result tests |
| CCA-CONS-033 | Closed result-code, message, and payload tests |
| CCA-CONS-034 | Exact operation payload-shape tests |
| CCA-CONS-035 | Overlapping-failure precedence tests |
| CCA-CONS-036 | Copy, move, ownership, and assignment-restriction tests |
| CCA-CONS-037 | Stateless-Service and lifetime-isolation audit |
| CCA-CONS-038 | Semantic and allocation-failure strong-guarantee tests |
| CCA-CONS-039 | Complete equivalent-history determinism tests |
| CCA-CONS-040 | Independent concurrency and const-observation tests |
| CCA-CONS-041 | Persistence-boundary and no-session-mapping audit |
| CCA-CONS-042 | Runtime and Provider independence checks |
| CCA-CONS-043 | Released-public-only compatibility build and audit |
| CCA-CONS-044 | Excluded-capability dependency and symbol scans |
| CCA-CONS-045 | This guide and all-six-operation executable example |
| CCA-CONS-046 | Bidirectional 47-row traceability audit |
| CCA-CONS-047 | C++23 warnings-as-errors build and complete test run |

Conformance requires every row to pass. Success of one operation is not
partial conformance.
