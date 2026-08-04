# Episodic Memory

Episodic Memory implements CCA-EPMEM-1.0 as a Workspace-owned capability in
the Memory Domain. It establishes explicitly described Episodes from released
Long-Term Memory evidence while leaving that evidence unchanged. Long-Term
Memory remains authoritative; Episodic Memory owns only derived Episodes and
their historical provenance values.

## Public contract

The installed header is `<cca/memory/episodic_memory.hpp>`. It declares the
four public Assets and one stateless Service required by API-008-HPP:

| Declaration | Responsibility |
| --- | --- |
| `Episode` | Owns an Episode identifier, occurrence, context, logical chronology, ordered Long-Term provenance snapshots, and direct links. |
| `EpisodeQuery` | Owns literal search text. |
| `EpisodicMemory` | Owns one Workspace's accessible Episodes in canonical chronological order and private Forgotten-identity history. |
| `EpisodeResult` | Owns the result code, message, `episode()` payload, and `matches()` payload. |
| `EpisodicMemoryEngine` | Performs exactly `record`, `derive`, `retrieve`, `search`, `link`, `update`, and `forget`. |

`Episode` construction creates a detached proposal. It does not add an Asset
to a Workspace, validate current evidence, record an occurrence, or perform
derivation. Its link sequence is initially empty. `record` and `derive` are
the only operations that can accept the proposal into an `EpisodicMemory`.

## Workspace ownership and value lifetime

`EpisodicMemory` requires a non-empty Workspace identifier. Construction with
an empty identifier throws `std::invalid_argument`. The identifier cannot be
changed, and assignment is disabled to prevent Workspace rebinding.

A new memory is pristine. `size()` counts accessible Episodes, `find()` uses
exact case-sensitive identity, and `episodes()` exposes canonical
chronological order. Aggregate pointers and references remain valid until the
memory is mutated or destroyed. Forgotten identities are never exposed.

Copy construction produces independent complete Episodic state. Move
construction transfers that state without throwing and leaves the source
pristine under its original Workspace identifier. Episodes and queries have
independent value semantics. Results are move-only and own every returned
Episode; their pointers remain valid until result destruction or move
assignment.

## Occurrence, context, and chronology

Each accepted Episode has a non-empty occurrence describing one particular
occurrence and a non-empty context describing the setting that makes it
particular. Both values are supplied explicitly. Episodic Memory does not
infer them, evaluate their truth, generalize them into Semantic knowledge, or
derive a procedure.

Chronology is a caller-supplied, non-negative `std::int64_t` logical ordering
key. It has no wall-clock unit, time zone, duration, or elapsed-time meaning.
No operation reads a system or Runtime clock. Chronology is immutable after
establishment.

Canonical Episode order is ascending chronology. Episodes with equal
chronology retain successful establishment order. `record` accepts a new
Episode only at or after the final accessible chronology and appends it.
`derive` supports retrospective insertion and places a new Episode after the
existing equal-chronology group. Forgotten Episodes do not define the record
frontier.

## Derivation and provenance

Recording and derivation require the destination and evidence aggregates to
have the same exact Workspace identifier. A new Episode must have a non-empty
identity, occurrence, and context; a non-negative chronology; and one or more
ordered source snapshots. Every source identifier must be non-empty, unique
in that Episode, and different from the Episode identifier.

Each proposed `LongTermMemoryEntry` must be Long-Term rather than Archived and
must match an exact accessible source in the supplied `LongTermMemory`,
including its value. The accepted Episode owns copies in caller-declared
order. It retains no pointer, iterator, result object, or lifetime dependency
into the evidence aggregate.

Provenance becomes immutable at successful establishment. Later Long-Term
store, archive, or forget operations do not rewrite the snapshot. Later
Episodic retrieval, search, linking, update, or forgetting never changes
Long-Term state. Multiple Episodes may cite the same source.

## Operations and deterministic order

| Operation | Behavior | Success payload |
| --- | --- | --- |
| `record` | Validates a detached proposal and same-Workspace evidence, then appends a new Episode at the current chronology frontier. An identical detached proposal is idempotent. | `episode()` |
| `derive` | Applies the same source-preserving validation and inserts a retrospective Episode after the existing equal-chronology group. Idempotence is shared with `record`. | `episode()` |
| `retrieve` | Returns an exact Episode copy and represents bounded `Retrieved(Episodic)` accessibility without stored-state mutation. | `episode()` |
| `search` | Applies a case-sensitive substring test to identifiers, occurrences, and contexts only. Empty text matches every Episode. | Chronologically ordered `matches()` |
| `link` | Atomically creates one untyped undirected association between two distinct Episodes. An exact duplicate is idempotent. | Two endpoint copies in `matches()`, in argument order |
| `update` | Atomically replaces only an Episode's non-empty occurrence and context. | `episode()` |
| `forget` | Irreversibly removes an Episode, reserves its identifier, and atomically removes its incident links. Absent forgetting is idempotent. | No payload |

Provenance and per-Episode links retain insertion order. Retrieval, search,
linking, update, and idempotence preserve Episode positions. Forgetting
preserves survivor order and the order of every remaining link. Search
filters canonical chronological order without ranking or chronology-range
behavior.

Links are direct, untyped associations. They do not imply direction,
causality, temporal precedence, transitivity, hierarchy, relationship types,
traversal, or inference. Version 1.0 defines no unlink or archive operation.

## Validation precedence

`record` validates, in order:

1. exact Workspace equality;
2. non-empty Episode identifier;
3. non-empty occurrence;
4. non-empty context;
5. non-negative chronology;
6. non-empty provenance;
7. each ordered source's identifier uniqueness, target distinction, and
   non-Archived snapshot state;
8. empty proposal link state;
9. Forgotten Episode identity;
10. existing-target idempotence or conflict;
11. the accessible record frontier for a new identifier;
12. each current source's exact presence, Long-Term state, and value; and
13. atomic append.

`derive` uses the same order through existing-target handling, omits the
record-frontier step, validates current sources, and atomically inserts the
new Episode. Existing-target handling precedes frontier and live-source
validation, so exact idempotence survives later chronology growth and source
lifecycle changes.

`retrieve` and `forget` validate identifier before lookup. `link` validates
first identifier, second identifier, endpoint distinction, first target, then
second target. `update` validates identifier, occurrence, context, then target.
Search has no semantic failure result.

## Results and errors

`succeeded()` is true exactly for `OK`. Success has an empty message. Every
failure has a stable non-empty message, null `episode()`, and empty
`matches()`. The closed code set is:

| Code | Meaning |
| --- | --- |
| `OK` | The operation completed. |
| `WORKSPACE_MISMATCH` | Evidence and destination have different Workspace identifiers. |
| `INVALID_IDENTIFIER` | A required Episode identifier is empty. |
| `INVALID_OCCURRENCE` | A proposed or updated occurrence is empty. |
| `INVALID_CONTEXT` | A proposed or updated context is empty. |
| `INVALID_CHRONOLOGY` | A proposed chronology is negative. |
| `INVALID_PROVENANCE` | Provenance is empty or contains an empty, duplicate, or target-equal source identifier. |
| `SOURCE_NOT_LONG_TERM` | A proposed or resolved source is Archived. |
| `INVALID_EPISODE_STATE` | An establishment proposal already contains links. |
| `FORGOTTEN_IDENTIFIER` | Establishment attempted to reuse a Forgotten Episode identity. |
| `IDENTIFIER_CONFLICT` | An existing identity has different occurrence, context, chronology, or provenance. |
| `CHRONOLOGY_VIOLATION` | A new `record` proposal precedes the accessible frontier. |
| `SOURCE_NOT_FOUND` | A source is absent or Forgotten in Long-Term Memory. |
| `SOURCE_MISMATCH` | A source snapshot value differs from current evidence. |
| `INVALID_RELATIONSHIP` | Link endpoints are identical. |
| `NOT_FOUND` | A required accessible Episode is absent. |

## Failure guarantees, determinism, and concurrency

Every mutating operation provides the strong failure guarantee. Episodic
failure and propagated allocation or construction exceptions leave complete
Episodic state, Forgotten history, links, chronology, and all ordering
unchanged. The supplied Long-Term evidence remains unchanged on every path.

Equivalent operation histories over equivalent inputs produce equivalent
codes, messages, payloads, Episodes, chronology, provenance, links, Forgotten
behavior, and ordering. Results never depend on addresses, clocks, unordered
iteration, Runtime state, Provider choice, or scheduling.

Distinct memories, engines, Episodes, queries, and results may be used
concurrently. Concurrent mutation of one `EpisodicMemory` is not supported.
Const access to an otherwise unmodified value performs no hidden mutation.

## Persistence and Runtime boundaries

A private, provider-independent adapter projects complete Episodic state into
the existing CCA-PERSIST complete Workspace Asset representation. Real save
and load preserve Workspace identity, Episode identity, occurrence, context,
chronology, ordered provenance snapshots, link order, Forgotten identity
history, canonical chronological order, and equal-key establishment order.
Reconstruction is atomic and requires no live Long-Term lookup, so historical
sources may subsequently be updated, Archived, or Forgotten.

The adapter is not installed and adds no public persistence type or operation.
It selects no Provider or external representation and does not embed a
`LongTermMemory` aggregate. Runtime may host the stateless engine, but Runtime
start, stop, replacement, clocks, registries, events, diagnostics, and threads
never own or mutate Episodic state and are excluded from persisted data.

Episodic Memory performs no reasoning, truth evaluation, automatic
occurrence, context, chronology, or link inference, Semantic classification,
procedural derivation, reflection, similarity or vector search, relationship
traversal, evidence destruction, embeddings, LLM behavior, or AI inference.
Procedural Memory, Consolidation, Knowledge Graphs, and Memory Studio remain
outside CP-005.

## Example

The buildable public-only example is
[`examples/episodic_memory_usage.cpp`](../examples/episodic_memory_usage.cpp).
It establishes Long-Term evidence and exercises all seven operations without
accessing the private Persistence adapter.

## Requirement coverage

| Requirement | Automated or review evidence |
| --- | --- |
| CCA-EPMEM-001 | Episodic Memory architecture CTest |
| CCA-EPMEM-002 | Exact public Asset signature and architecture scans |
| CCA-EPMEM-003 | Exact seven-operation signature and architecture scans |
| CCA-EPMEM-004 | Workspace construction, immutability, copy, and move tests |
| CCA-EPMEM-005 | Workspace-boundary and dependency architecture tests |
| CCA-EPMEM-006 | Pristine observation, lookup, order, and lifetime tests |
| CCA-EPMEM-007 | Ownership, stateless-Service, and source-isolation tests |
| CCA-EPMEM-008 | Same-Workspace establishment and precedence tests |
| CCA-EPMEM-009 | Complete ordered Long-Term source-validation tests |
| CCA-EPMEM-010 | Durable exact identity, forgetting, and round-trip tests |
| CCA-EPMEM-011 | Complete immutable provenance equality and lifetime tests |
| CCA-EPMEM-012 | Explicit chronology validation, immutability, and clock-exclusion tests |
| CCA-EPMEM-013 | Episode, equal-key, provenance, link, survivor, search, and Persistence order tests |
| CCA-EPMEM-014 | Record frontier, append, idempotence, conflict, and source-integrity tests |
| CCA-EPMEM-015 | Derive placement, equal-key stability, overlap, idempotence, and conflict tests |
| CCA-EPMEM-016 | Exact retrieval, independent payload, accessibility, and non-mutation tests |
| CCA-EPMEM-017 | Literal search-field, case, order, empty, and exclusion tests |
| CCA-EPMEM-018 | Link validation, symmetry, order, idempotence, and payload tests |
| CCA-EPMEM-019 | Relationship integrity and atomic incident-link cleanup tests |
| CCA-EPMEM-020 | Occurrence-and-context-only update and preservation tests |
| CCA-EPMEM-021 | Irreversible forget, history, survivor-order, and cleanup tests |
| CCA-EPMEM-022 | Complete Long-Term before/after comparisons |
| CCA-EPMEM-023 | Independent source and Episode lifecycle tests |
| CCA-EPMEM-024 | Closed code, message, payload, ownership, and lifetime tests |
| CCA-EPMEM-025 | Table-driven overlapping-error precedence tests |
| CCA-EPMEM-026 | Value semantics, special-member, and rebinding tests |
| CCA-EPMEM-027 | Stateless-engine, isolation, no-retained-reference, and concurrency tests |
| CCA-EPMEM-028 | Semantic and exhaustive allocation-failure state comparisons |
| CCA-EPMEM-029 | Equivalent-history complete-state determinism test |
| CCA-EPMEM-030 | Private provider-independent Persistence architecture scan |
| CCA-EPMEM-031 | Real save/load/reconstruct fidelity and malformed-state tests |
| CCA-EPMEM-032 | Runtime dependency and lifecycle non-interference tests |
| CCA-EPMEM-033 | Released public CP-003-only dependency scan |
| CCA-EPMEM-034 | Excluded-capability dependency and symbol scan |
| CCA-EPMEM-035 | Explicit-input, literal-search, and prohibited-behavior tests |
| CCA-EPMEM-036 | No-archive public and implementation scans |
| CCA-EPMEM-037 | This API guide and warnings-as-errors public example test |
| CCA-EPMEM-038 | Bidirectional 39-row traceability audit |
| CCA-EPMEM-039 | Repository CI warnings-as-errors build and full CTest run |

Conformance requires every row to pass. Individual operation success is not
partial conformance.
