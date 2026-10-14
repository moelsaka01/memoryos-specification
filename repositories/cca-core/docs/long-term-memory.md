# Long-Term Memory

Long-Term Memory provides Workspace-owned durable knowledge behavior within
the Memory Domain. A `LongTermMemory` is constructed with one non-empty
Workspace identifier. The identifier is immutable for the value's lifetime;
assignment is disabled so an existing value cannot be rebound to another
Workspace.

`LongTermMemoryEngine` is stateless. It operates only on the supplied
`LongTermMemory` and does not accept or transfer Memory Foundation or Working
Memory values. Entry construction presents an already-classified Long-Term
value at the capability boundary; it does not perform reflection,
classification, or consolidation.

## Ownership and state

A newly constructed memory is pristine. It owns an ordered sequence of
Long-Term and Archived entries plus private forgotten-identifier history.
`size()`, `find()`, and `entries()` expose the accessible sequence without
exposing Forgotten knowledge. Identifiers are exact and case-sensitive.

Copy construction creates independent semantic state under the same Workspace
identifier. Move construction transfers all semantic state and leaves the
source pristine while retaining its original Workspace identifier. Entries,
queries, memories, and result payloads own their values.

An entry has one of these semantic dispositions:

- Long-Term: accessible to exact retrieval and ordered search.
- Archived: retained and exactly retrievable, but excluded from search.
- Forgotten: removed from the accessible sequence; its identifier cannot be
  reused in that memory lineage.

There is no public transition from Archived back to Long-Term and no
transition out of Forgotten.

## Operations and deterministic ordering

- `retain` appends an absent entry. An identical identifier and value is
  idempotent, including when the existing entry is Archived; a different value
  reports `IDENTIFIER_CONFLICT`.
- `store` appends or replaces a Long-Term value at its current position. It
  never replaces or unarchives an Archived destination.
- `retrieve` returns an independent copy of an exact Long-Term or Archived
  entry without changing state.
- `search` applies a case-sensitive substring test to Long-Term identifiers
  and values. Empty text matches all Long-Term entries.
- `archive` changes only the target's state and is idempotent when repeated.
- `restore` copies complete preserved state into a pristine target with the
  same Workspace identifier. It does not mean unarchive.
- `forget` removes a Long-Term or Archived entry and permanently reserves its
  identifier. Forgetting an absent identifier is idempotent.

Canonical order is insertion order. Replacement and archive preserve
position; forget preserves survivor order; search filters without reordering;
and restore reproduces the complete order. Equivalent operation sequences
produce equivalent state and results.

## Results and failure behavior

`LongTermMemoryResult` owns the values returned by `entry()` and `matches()`.
Successful results use `OK` and an empty message. Failed results have a stable,
non-empty message, a null entry, and no matches.

| Code | Meaning |
| --- | --- |
| `OK` | The operation completed successfully. |
| `INVALID_IDENTIFIER` | An identifier-bearing operation received an empty identifier. |
| `NOT_FOUND` | Exact retrieval or archive found no accessible entry. |
| `IDENTIFIER_CONFLICT` | Retain found the identifier with a different value. |
| `ARCHIVED` | Retain or store received Archived input, or store targeted Archived state. |
| `FORGOTTEN_IDENTIFIER` | Retain or store attempted to reuse a forgotten identifier. |
| `WORKSPACE_MISMATCH` | Restore source and target belong to different Workspaces. |
| `RESTORE_TARGET_NOT_PRISTINE` | Restore targeted a same-Workspace value with semantic history. |

Mutating operations provide the strong failure guarantee. A semantic failure
or propagated allocation failure publishes no partial change to Workspace
ownership, entries, states, forgotten history, or ordering.

## Persistence and Runtime boundaries

Complete Long-Term Memory state is projected and reconstructed through the
existing CCA-PERSIST complete Workspace Asset boundary by a private,
provider-independent adapter. The mapping preserves Workspace ownership,
durable identifiers, values, Archived states, forgotten identifiers, and
canonical order. It is not a public persistence type or external format.

Restoration operates on an independently owned reconstructed value and a
pristine destination. Workspace mismatch is checked before destination state.
Runtime lifetime and Provider selection do not own or mutate Long-Term Memory
state.

## Usage

```cpp
#include <cca/memory/long_term_memory.hpp>

cca::memory::LongTermMemory memory{"workspace-id"};
cca::memory::LongTermMemoryEngine engine;

auto retained = engine.retain(
    memory,
    cca::memory::LongTermMemoryEntry{"principle", "durable knowledge"});
auto stored = engine.store(
    memory,
    cca::memory::LongTermMemoryEntry{"record", "updated value"});
auto retrieved = engine.retrieve(memory, "principle");
auto matches =
    engine.search(memory, cca::memory::LongTermMemoryQuery{"durable"});
auto archived = engine.archive(memory, "principle");
auto forgotten = engine.forget(memory, "record");

cca::memory::LongTermMemory restored{"workspace-id"};
auto restoration = engine.restore(restored, memory);
```

The complete executable example is `examples/long_term_memory_usage.cpp`.

## Requirement and conformance summary

| Requirement | Conformance evidence |
| --- | --- |
| CCA-LTMEM-001 | Constitutional and frozen architecture checks in the Long-Term Memory architecture CTest |
| CCA-LTMEM-002 | Exact public Asset declaration compile checks |
| CCA-LTMEM-003 | Exact `LongTermMemoryEngine` operation declaration checks |
| CCA-LTMEM-004 | Non-empty immutable Workspace ownership and lifetime tests |
| CCA-LTMEM-005 | Memory Domain, cross-Workspace, and architecture checks |
| CCA-LTMEM-006 | Pristine construction and classification-boundary tests |
| CCA-LTMEM-007 | Aggregate observation, Archived state, and accessor-lifetime tests |
| CCA-LTMEM-008 | Empty, exact, case-sensitive, and preserved identifier tests |
| CCA-LTMEM-009 | Canonical ordering across every state transition and restoration |
| CCA-LTMEM-010 | Retain append, idempotence, conflict, rejection, payload, and precedence tests |
| CCA-LTMEM-011 | Store append, in-place replacement, Archived/Forgotten rejection, and precedence tests |
| CCA-LTMEM-012 | Exact Long-Term and Archived retrieval and independent-payload tests |
| CCA-LTMEM-013 | Ordered identifier/value search, empty query, and Archived exclusion tests |
| CCA-LTMEM-014 | Archive transition, preservation, idempotence, and absence tests |
| CCA-LTMEM-015 | Restore Workspace, pristine-target, alias, and validation-precedence tests |
| CCA-LTMEM-016 | Complete restoration fidelity, atomicity, and source-independence tests |
| CCA-LTMEM-017 | Forget removal, idempotence, irreversible reuse rejection, and lineage tests |
| CCA-LTMEM-018 | Explicit-only state-transition and no-implicit-transition tests |
| CCA-LTMEM-019 | Retained identifier, value, state, ownership, and order integrity tests |
| CCA-LTMEM-020 | Complete result-code, message, success, and payload-shape tests |
| CCA-LTMEM-021 | Value ownership, copy/move invariants, and result-lifetime tests |
| CCA-LTMEM-022 | Stateless engine, instance isolation, and independent-concurrency tests |
| CCA-LTMEM-023 | Semantic-failure tests plus the dedicated allocation-failure executable |
| CCA-LTMEM-024 | Private Persistence projection, save/load, reconstruction, and full-fidelity round-trip tests |
| CCA-LTMEM-025 | Runtime lifecycle independence and architecture checks |
| CCA-LTMEM-026 | Released Memory and Working Memory isolation and compatibility checks |
| CCA-LTMEM-027 | Excluded-capability dependency and declaration scan |
| CCA-LTMEM-028 | Equivalent-sequence complete-state and result determinism test |
| CCA-LTMEM-029 | Repository warnings-as-errors build and architecture CTest |

Conformance requires every row to pass; success of one operation does not
imply partial capability conformance.
