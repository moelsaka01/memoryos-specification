# Procedural Memory

Procedural Memory implements CCA-PRMEM-1.0 as a Workspace-owned capability in
the Memory Domain. It establishes explicitly described Procedures from
released Long-Term Memory evidence while leaving that evidence unchanged.
Long-Term Memory remains authoritative; Procedural Memory owns only derived
Procedures and their historical provenance values.

## Public contract

The installed header is `<cca/memory/procedural_memory.hpp>`. It declares the
four public Assets and one stateless Service required by API-009-HPP:

| Declaration | Responsibility |
| --- | --- |
| `Procedure` | Owns a durable identifier, explicit activity, ordered descriptive steps, ordered Long-Term provenance snapshots, and direct links. |
| `ProcedureQuery` | Owns literal search text. |
| `ProceduralMemory` | Owns one Workspace's accessible Procedures in canonical establishment order and private Forgotten-identity history. |
| `ProcedureResult` | Owns the result code, message, `procedure()` payload, and `matches()` payload. |
| `ProceduralMemoryEngine` | Performs exactly `derive`, `compose`, `retrieve`, `search`, `link`, `update`, and `forget`. |

`Procedure` construction creates a detached proposal with an empty link
sequence. It does not add an Asset to a Workspace, validate evidence, derive
or compose knowledge, plan an activity, or execute steps. `derive` and
`compose` are the only operations that accept a detached proposal into a
`ProceduralMemory`.

## Workspace ownership and value lifetime

`ProceduralMemory` requires a non-empty Workspace identifier. Construction
with an empty identifier throws `std::invalid_argument`. The identifier
cannot change, and assignment is disabled to prevent Workspace rebinding.

A new memory is pristine. `size()` counts accessible Procedures, `find()`
uses exact case-sensitive identity, and `procedures()` exposes canonical
successful-establishment order. Aggregate pointers and references remain
valid until mutation or destruction. Forgotten identities are never exposed.

Copy construction produces independent complete Procedural state. Move
construction transfers that state without throwing and leaves the source
pristine under its original Workspace identifier. Procedures and queries have
independent value semantics. Results are move-only and own every returned
Procedure; their pointers remain valid until result destruction or move
assignment.

## Activity and descriptive steps

Every accepted Procedure has a non-empty caller-supplied activity and a
non-empty ordered sequence of non-empty caller-supplied steps. The activity
identifies what is being performed. The steps describe how it is performed.
Duplicate step text is valid, and every position is preserved.

Activities and steps are inert descriptive knowledge. They are not commands,
Process definitions, preconditions, branches, loops, schedules, workflows,
plans, executable control flow, or Runtime actions. Procedural Memory never
chooses, synthesizes, combines, verifies, reorders, or executes them.

## Derivation and provenance

Both establishment operations require exact Workspace equality between the
destination and evidence aggregates. Each source snapshot must have a
non-empty identifier unique within the proposal and different from the
Procedure identifier. It must be Long-Term rather than Archived and match the
exact identifier and value of an accessible entry in the supplied
`LongTermMemory`.

`derive` requires exactly one source snapshot. `compose` requires two or more
ordered source snapshots. Both establish a complete caller-declared Procedure
through the single Long-Term-to-new-Procedural taxonomy edge:

| Operation | Evidence cardinality | Meaning |
| --- | --- | --- |
| `derive` | Exactly one source | Establish complete procedural knowledge supported by one retained memory. |
| `compose` | Two or more sources | Establish complete procedural knowledge supported by multiple retained memories. |

`compose` does not combine existing Procedures, merge steps, infer content,
or perform planning. A Procedure is never a derivation source.

The accepted Procedure owns exact source copies in caller order and retains
no pointer, iterator, result object, or lifetime dependency into evidence.
Provenance becomes immutable. Later Long-Term store, archive, or forget
behavior does not rewrite or invalidate it. Procedural operations never
modify, archive, forget, reorder, or own Long-Term state.

An exact detached proposal is idempotently recognized before current source
lookup, so independent source lifecycle changes do not invalidate historical
identity. Different activity, steps, or provenance under the same identifier
is an identifier conflict. Aggregate-owned links are preserved during exact
idempotence.

## Operations and deterministic order

| Operation | Behavior | Success payload |
| --- | --- | --- |
| `derive` | Validates exactly one same-Workspace source and appends a complete caller-declared Procedure. | `procedure()` |
| `compose` | Validates two or more ordered same-Workspace sources and appends a complete caller-declared Procedure. | `procedure()` |
| `retrieve` | Returns an exact independent Procedure copy and bounded `Retrieved(Procedural)` accessibility without state mutation. | `procedure()` |
| `search` | Applies a case-sensitive substring test to identifier, activity, and steps only. Empty text matches every accessible Procedure. | Canonically ordered `matches()` |
| `link` | Atomically creates one untyped undirected association between two distinct Procedures. An exact duplicate is idempotent. | Two endpoint copies in `matches()`, in argument order |
| `update` | Atomically replaces only a Procedure's complete non-empty activity and ordered non-empty steps. | `procedure()` |
| `forget` | Irreversibly removes a Procedure, reserves its identifier, and atomically removes incident links. Absent forgetting is idempotent. | No payload |

Canonical Procedure order is successful new-establishment order across
interleaved `derive` and `compose` calls. Provenance, steps, and each
Procedure's links preserve their specified order. Retrieval, search, linking,
update, and idempotence preserve aggregate positions. Forgetting preserves
survivor order and the order of every remaining link.

Links are direct untyped associations. They do not imply composition,
execution sequence, dependency, prerequisite, direction, causality,
hierarchy, transitivity, traversal, planning, or inference. Version 1.0
defines no unlink operation.

## Validation precedence

`derive` validates, in order:

1. exact Workspace equality;
2. non-empty Procedure identifier;
3. non-empty activity;
4. a non-empty step sequence and then every non-empty step in order;
5. source cardinality equal to one;
6. every ordered source's non-empty unique identifier, target distinction,
   and non-Archived snapshot state;
7. empty proposal link state;
8. Forgotten Procedure identity;
9. existing-target idempotence or conflict;
10. every current source's exact presence, Long-Term state, and value; and
11. atomic append.

`compose` uses the same order but requires at least two sources at step 5.
An empty provenance sequence therefore reports `INVALID_SOURCE_CARDINALITY`.

`retrieve` and `forget` validate identifier before lookup. `link` validates
first identifier, second identifier, endpoint distinction, first target, then
second target. `update` validates identifier, activity, the complete step
sequence in order, then target. Search has no semantic failure result.

## Results and errors

`succeeded()` is true exactly for `OK`. Success has an empty message. Every
failure has a stable non-empty message, null `procedure()`, and empty
`matches()`. The closed code set is:

| Code | Meaning |
| --- | --- |
| `OK` | The operation completed. |
| `WORKSPACE_MISMATCH` | Evidence and destination have different Workspace identifiers. |
| `INVALID_IDENTIFIER` | A required Procedure identifier is empty. |
| `INVALID_ACTIVITY` | A proposed or updated activity is empty. |
| `INVALID_STEPS` | A step sequence is empty or contains an empty step. |
| `INVALID_SOURCE_CARDINALITY` | `derive` did not receive exactly one source or `compose` received fewer than two. |
| `INVALID_PROVENANCE` | A source identifier is empty, duplicate, or equal to the Procedure identifier. |
| `SOURCE_NOT_LONG_TERM` | A proposed or resolved source is Archived. |
| `INVALID_PROCEDURE_STATE` | An establishment proposal already contains links. |
| `FORGOTTEN_IDENTIFIER` | Establishment attempted to reuse a Forgotten Procedure identity. |
| `IDENTIFIER_CONFLICT` | An existing identity has different activity, steps, or provenance. |
| `SOURCE_NOT_FOUND` | A source is absent or Forgotten in Long-Term Memory. |
| `SOURCE_MISMATCH` | A source snapshot value differs from current evidence. |
| `INVALID_RELATIONSHIP` | Link endpoints are identical. |
| `NOT_FOUND` | A required accessible Procedure is absent. |

## Failure guarantees, determinism, and concurrency

Every mutating operation provides the strong failure guarantee. Semantic
failure and propagated allocation or construction exceptions leave complete
Procedural state, Forgotten history, links, and all ordering unchanged. The
supplied Long-Term evidence remains unchanged on every path.

Equivalent operation histories over equivalent inputs produce equivalent
codes, messages, payloads, Procedures, activity, steps, provenance, links,
Forgotten behavior, and ordering. Results never depend on addresses, clocks,
unordered iteration, Runtime state, Provider choice, or scheduling.

Distinct memories, engines, Procedures, queries, and results may be used
concurrently. Concurrent mutation of one `ProceduralMemory` is not supported.
Const access to an otherwise unmodified value performs no hidden mutation.

## Persistence and Runtime boundaries

A private provider-independent mapping projects complete Procedural state
into the existing CCA-PERSIST complete Workspace Asset representation. Real
save and load preserve Workspace identity, Procedure identity, activity,
ordered steps including duplicates, ordered provenance snapshots, link order,
Forgotten identity history, and canonical establishment order.
Reconstruction is atomic and requires no live Long-Term lookup, so historical
sources may subsequently be updated, Archived, or Forgotten.

The mapping is not installed and adds no public persistence type or operation.
It selects no Provider or external representation and does not embed a
`LongTermMemory` aggregate. Runtime may host the stateless engine, but Runtime
start, stop, replacement, clocks, registries, events, diagnostics, and threads
never own or mutate Procedural state and are excluded from persisted data.

Procedural Memory performs no concept classification, episode derivation,
planning, reasoning, reflection, consolidation, simulation, relationship
traversal, evidence destruction, embeddings, similarity or vector search,
LLM behavior, AI inference, scheduling, workflow behavior, or execution.
Semantic Memory, Episodic Memory, and Memory Studio remain outside CP-006.
Version 1.0 exposes no execute, schedule, plan, archive, restore, or unlink
operation and implements no hidden equivalent.

## Example

The buildable public-only example is
[`examples/procedural_memory_usage.cpp`](../examples/procedural_memory_usage.cpp).
It establishes Long-Term evidence and exercises all seven operations without
accessing the private Persistence mapping.

## Requirement coverage

| Requirement | Automated or review evidence |
| --- | --- |
| CCA-PRMEM-001 | Procedural Memory architecture CTest |
| CCA-PRMEM-002 | Exact public Asset signature and architecture scans |
| CCA-PRMEM-003 | Exact seven-operation signature and architecture scans |
| CCA-PRMEM-004 | Workspace construction, immutability, copy, and move tests |
| CCA-PRMEM-005 | Workspace-boundary and dependency architecture tests |
| CCA-PRMEM-006 | Pristine observation, lookup, order, and lifetime tests |
| CCA-PRMEM-007 | Ownership, stateless-Service, and source-isolation tests |
| CCA-PRMEM-008 | Same-Workspace establishment and precedence tests |
| CCA-PRMEM-009 | Exact derive/compose source-cardinality tests |
| CCA-PRMEM-010 | Complete ordered Long-Term source-validation tests |
| CCA-PRMEM-011 | Durable exact identity, forgetting, and round-trip tests |
| CCA-PRMEM-012 | Explicit activity, step validation, duplicate preservation, and inert-content tests |
| CCA-PRMEM-013 | Complete immutable provenance equality and lifetime tests |
| CCA-PRMEM-014 | Aggregate, step, provenance, link, survivor, search, and Persistence order tests |
| CCA-PRMEM-015 | Single-source derive append, idempotence, conflict, and source-integrity tests |
| CCA-PRMEM-016 | Multi-source compose append, idempotence, and non-planning tests |
| CCA-PRMEM-017 | Existing-target precedence after link and source lifecycle changes |
| CCA-PRMEM-018 | Exact retrieval, independent payload, accessibility, and non-mutation tests |
| CCA-PRMEM-019 | Literal search-field, case, order, empty, and exclusion tests |
| CCA-PRMEM-020 | Link validation, symmetry, order, idempotence, and payload tests |
| CCA-PRMEM-021 | Relationship integrity and atomic incident-link cleanup tests |
| CCA-PRMEM-022 | Activity-and-steps-only update and preservation tests |
| CCA-PRMEM-023 | Irreversible forget, history, survivor-order, and cleanup tests |
| CCA-PRMEM-024 | Complete Long-Term before/after comparisons on every path |
| CCA-PRMEM-025 | Independent source and Procedure lifecycle tests |
| CCA-PRMEM-026 | Closed code, message, payload, ownership, and lifetime tests |
| CCA-PRMEM-027 | Table-driven overlapping-error precedence tests |
| CCA-PRMEM-028 | Value semantics, special-member, and rebinding tests |
| CCA-PRMEM-029 | Stateless-engine, isolation, no-retained-reference, and concurrency tests |
| CCA-PRMEM-030 | Semantic and exhaustive allocation-failure state comparisons |
| CCA-PRMEM-031 | Equivalent-history complete-state determinism test |
| CCA-PRMEM-032 | Private provider-independent Persistence architecture scan |
| CCA-PRMEM-033 | Real save/load/reconstruct fidelity and malformed-state tests |
| CCA-PRMEM-034 | Runtime dependency and lifecycle non-interference tests |
| CCA-PRMEM-035 | Released public CP-003-only dependency scan |
| CCA-PRMEM-036 | Excluded-capability dependency and symbol scan |
| CCA-PRMEM-037 | Explicit-input, literal-search, and prohibited-behavior tests |
| CCA-PRMEM-038 | No-hidden-operation public and implementation scans |
| CCA-PRMEM-039 | This API guide and warnings-as-errors public example test |
| CCA-PRMEM-040 | Bidirectional 41-row traceability audit |
| CCA-PRMEM-041 | Repository CI warnings-as-errors build and full CTest run |

Conformance requires every row to pass. Individual operation success is not
partial conformance.
