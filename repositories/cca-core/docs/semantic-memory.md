# Semantic Memory

Semantic Memory implements CCA-SEMMEM-1.0 as a Workspace-owned capability in
the Memory Domain. It derives explicitly declared concepts from released
Long-Term Memory evidence while leaving that evidence unchanged. Long-Term
Memory remains authoritative; Semantic Memory owns only derived concepts and
their historical provenance values.

## Public contract

The installed header is `<cca/memory/semantic_memory.hpp>`. It declares the
four public Assets and one stateless Service required by API-007-HPP:

| Declaration | Responsibility |
| --- | --- |
| `SemanticConcept` | Owns a concept identifier, explicit meaning, ordered Long-Term provenance snapshots, categories, and direct links. |
| `SemanticQuery` | Owns literal search text. |
| `SemanticMemory` | Owns one Workspace's ordered accessible concepts and private Forgotten-identity history. |
| `SemanticResult` | Owns the result code, message, `semanticConcept()` payload, and `matches()` payload. |
| `SemanticMemoryEngine` | Performs exactly `classify`, `categorize`, `link`, `retrieve`, `search`, `update`, and `forget`. |

`SemanticConcept` construction creates a detached proposal. It does not add an
Asset to a Workspace or validate current evidence. Its category and link
sequences are initially empty. Classification is the only operation that can
accept the proposal into a `SemanticMemory`.

## Workspace ownership and value lifetime

`SemanticMemory` requires a non-empty Workspace identifier. Construction with
an empty identifier throws `std::invalid_argument`. The identifier cannot be
changed, and assignment is disabled to prevent Workspace rebinding.

A new memory is pristine. `size()` counts accessible concepts, `find()` uses
exact case-sensitive identity, and `concepts()` exposes canonical
classification order. Aggregate pointers and references remain valid until
the memory is mutated or destroyed. Forgotten identities are never exposed.

Copy construction produces independent complete Semantic state. Move
construction transfers that state without throwing and leaves the source
pristine under its original Workspace identifier. Concepts and queries have
independent value semantics. Results are move-only and own every returned
concept; their pointers remain valid until result destruction or move
assignment.

## Derivation and provenance

Classification requires the destination and evidence aggregates to have the
same exact Workspace identifier. A new concept must have a non-empty identity,
non-empty meaning, and one or more ordered source snapshots. Every source
identifier must be non-empty, unique in that concept, and different from the
concept identifier.

Each proposed `LongTermMemoryEntry` must be Long-Term rather than Archived and
must match an exact accessible source in the supplied `LongTermMemory`,
including its value. The accepted concept owns copies in caller-declared
order. It retains no pointer, iterator, or lifetime dependency into the
evidence aggregate.

Provenance becomes immutable at successful classification. Later Long-Term
store, archive, or forget operations do not rewrite the snapshot. Later
Semantic categorization, linking, update, retrieval, search, or forgetting
never changes Long-Term state. Multiple concepts may cite the same source.

## Operations and deterministic order

| Operation | Behavior | Success payload |
| --- | --- | --- |
| `classify` | Validates a pristine detached proposal and same-Workspace Long-Term evidence, then appends a new concept. An identical pristine proposal is idempotent. | `semanticConcept()` |
| `categorize` | Appends a non-empty exact category label. An exact duplicate is idempotent. | `semanticConcept()` |
| `link` | Atomically creates one untyped undirected association between two distinct concepts. An exact duplicate is idempotent. | Two endpoint copies in `matches()`, in argument order |
| `retrieve` | Returns an exact concept copy and represents bounded `Retrieved(Semantic)` accessibility without stored-state mutation. | `semanticConcept()` |
| `search` | Applies a case-sensitive substring test to identifiers, meanings, and categories only. Empty text matches all concepts. | Canonically ordered `matches()` |
| `update` | Atomically replaces only a concept's non-empty explicit meaning. | `semanticConcept()` |
| `forget` | Irreversibly removes a concept, reserves its identifier, and atomically removes its incident links. Absent forgetting is idempotent. | No payload |

Concept order is successful first-classification order. Categories and
per-concept links retain insertion order. Idempotence and update preserve
positions. Forgetting preserves survivor order and the order of every
remaining link. Search filters canonical order without ranking.

Links are direct, untyped associations. They do not imply direction,
transitivity, hierarchy, relationship types, traversal, or inference. Version
1.0 defines no unlink, uncategorize, or archive operation.

## Validation precedence

`classify` validates, in order:

1. exact Workspace equality;
2. non-empty concept identifier;
3. non-empty meaning;
4. non-empty provenance;
5. each ordered source's identifier uniqueness, target distinction, and
   non-Archived snapshot state;
6. empty proposal category and link state;
7. Forgotten concept identity;
8. existing-target idempotence or conflict;
9. each current source's presence, Long-Term state, and exact value; and
10. atomic commit.

`categorize` validates identifier, label, then target. `link` validates first
identifier, second identifier, endpoint distinction, first target, then second
target. `retrieve`, `update`, and `forget` validate identifier before lookup;
`update` validates meaning before lookup. Search has no semantic failure.

## Results and errors

`succeeded()` is true exactly for `OK`. Success has an empty message. Every
failure has a stable non-empty message, null `semanticConcept()`, and empty
`matches()`. The closed code set is:

| Code | Meaning |
| --- | --- |
| `OK` | The operation completed. |
| `WORKSPACE_MISMATCH` | Evidence and destination have different Workspace identifiers. |
| `INVALID_IDENTIFIER` | A required concept identifier is empty. |
| `INVALID_MEANING` | A proposed or updated meaning is empty. |
| `INVALID_PROVENANCE` | Provenance is empty or contains an empty, duplicate, or target-equal source identifier. |
| `SOURCE_NOT_LONG_TERM` | A proposed or resolved source is Archived. |
| `INVALID_CONCEPT_STATE` | A classification proposal already contains categories or links. |
| `FORGOTTEN_IDENTIFIER` | Classification attempted to reuse a Forgotten concept identity. |
| `IDENTIFIER_CONFLICT` | An existing identity has different meaning or provenance. |
| `SOURCE_NOT_FOUND` | A source is absent or Forgotten in Long-Term Memory. |
| `SOURCE_MISMATCH` | A source snapshot value differs from current evidence. |
| `INVALID_CATEGORY` | A category label is empty. |
| `INVALID_RELATIONSHIP` | Link endpoints are identical. |
| `NOT_FOUND` | A required accessible Semantic Concept is absent. |

## Failure guarantees, determinism, and concurrency

Every mutating operation provides the strong failure guarantee. Semantic
failure and propagated allocation or construction exceptions leave complete
Semantic state, Forgotten history, relationships, and all ordering unchanged.
The supplied Long-Term evidence remains unchanged on every path.

Equivalent operation histories over equivalent inputs produce equivalent
codes, messages, payloads, concepts, provenance, categories, links, Forgotten
behavior, and ordering. Results never depend on addresses, clocks, unordered
iteration, Runtime state, Provider choice, or scheduling.

Distinct memories, engines, concepts, queries, and results may be used
concurrently. Concurrent mutation of one `SemanticMemory` is not supported.
Const access to an otherwise unmodified value performs no hidden mutation.

## Persistence and Runtime boundaries

A private, provider-independent adapter projects complete Semantic state into
the existing CCA-PERSIST complete Workspace Asset representation. Real save
and load preserve Workspace identity, concept identity and meaning, ordered
provenance snapshots, category and link order, Forgotten identity history,
and canonical concept order. Reconstruction is atomic and requires no live
Long-Term lookup, so historical sources may subsequently be updated,
Archived, or Forgotten.

The adapter is not installed and adds no public persistence type or operation.
It selects no Provider or external representation and does not embed a
`LongTermMemory` aggregate. Runtime may host the stateless engine, but Runtime
start, stop, replacement, registries, events, diagnostics, and threads never
own or mutate Semantic state and are excluded from persisted data.

Semantic Memory performs no reasoning, truth evaluation, automatic
classification, reflection, similarity or vector search, relationship
traversal, evidence destruction, embeddings, LLM behavior, or AI inference.
Episodic Memory, Procedural Memory, Consolidation, Knowledge Graphs, and Memory
Studio remain outside CP-004.

## Example

The buildable public-only example is
[`examples/semantic_memory_usage.cpp`](../examples/semantic_memory_usage.cpp).
It establishes Long-Term evidence and exercises all seven operations without
accessing the private Persistence adapter.

## Requirement coverage

| Requirement | Automated or review evidence |
| --- | --- |
| CCA-SEMMEM-001 | Semantic Memory architecture CTest |
| CCA-SEMMEM-002 | Exact public Asset signature and architecture scans |
| CCA-SEMMEM-003 | Exact seven-operation signature and architecture scans |
| CCA-SEMMEM-004 | Workspace construction, immutability, copy, and move tests |
| CCA-SEMMEM-005 | Workspace-boundary and dependency architecture tests |
| CCA-SEMMEM-006 | Pristine observation, lookup, order, and lifetime tests |
| CCA-SEMMEM-007 | Ownership, stateless-Service, and source-isolation tests |
| CCA-SEMMEM-008 | Same-Workspace derivation and precedence tests |
| CCA-SEMMEM-009 | Complete ordered Long-Term source-validation tests |
| CCA-SEMMEM-010 | Durable exact identity, forgetting, and round-trip tests |
| CCA-SEMMEM-011 | Complete immutable provenance equality and lifetime tests |
| CCA-SEMMEM-012 | Concept, provenance, category, link, survivor, search, and Persistence order tests |
| CCA-SEMMEM-013 | Classification append, idempotence, conflict, pristine-state, and source-integrity tests |
| CCA-SEMMEM-014 | Categorization validation, order, idempotence, and preservation tests |
| CCA-SEMMEM-015 | Link validation, symmetry, order, idempotence, and payload tests |
| CCA-SEMMEM-016 | Relationship integrity and atomic incident-link cleanup tests |
| CCA-SEMMEM-017 | Exact retrieval, independent payload, accessibility, and non-mutation tests |
| CCA-SEMMEM-018 | Literal search-field, case, order, empty, and exclusion tests |
| CCA-SEMMEM-019 | Meaning-only update and preservation tests |
| CCA-SEMMEM-020 | Irreversible forget, history, survivor-order, and cleanup tests |
| CCA-SEMMEM-021 | Complete Long-Term before/after comparisons |
| CCA-SEMMEM-022 | Independent source and concept lifecycle tests |
| CCA-SEMMEM-023 | Closed code, message, payload, ownership, and lifetime tests |
| CCA-SEMMEM-024 | Table-driven overlapping-error precedence tests |
| CCA-SEMMEM-025 | Value semantics, special-member, and rebinding tests |
| CCA-SEMMEM-026 | Stateless-engine, isolation, no-retained-reference, and concurrency tests |
| CCA-SEMMEM-027 | Semantic and exhaustive allocation-failure state comparisons |
| CCA-SEMMEM-028 | Equivalent-history complete-state determinism test |
| CCA-SEMMEM-029 | Private provider-independent Persistence architecture scan |
| CCA-SEMMEM-030 | Real save/load/reconstruct fidelity and malformed-state tests |
| CCA-SEMMEM-031 | Runtime dependency and lifecycle non-interference tests |
| CCA-SEMMEM-032 | Released public CP-003-only dependency scan |
| CCA-SEMMEM-033 | Excluded-capability dependency and symbol scan |
| CCA-SEMMEM-034 | Explicit-input, literal-search, and prohibited-behavior tests |
| CCA-SEMMEM-035 | No-archive public and implementation scans |
| CCA-SEMMEM-036 | This API guide and warnings-as-errors public example test |
| CCA-SEMMEM-037 | Bidirectional 38-row traceability audit |
| CCA-SEMMEM-038 | Repository CI warnings-as-errors build and full CTest run |

Conformance requires every row to pass. Individual operation success is not
partial conformance.
