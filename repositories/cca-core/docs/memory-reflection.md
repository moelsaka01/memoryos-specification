# Memory Reflection

Memory Reflection implements CCA-REFLECT-1.0 as explicit, deterministic,
source-preserving derivation from retrieved Semantic, Episodic, and Procedural
knowledge to one newly identified `Reflection` in the same Workspace. The
caller supplies the Reflection knowledge. The engine neither generates content
nor modifies, reclassifies, reasons about, or assumes ownership of a source.

This version produces Reflected knowledge only. It does not implement the
frozen `Reflected -> Long-Term` edge, invoke Memory Consolidation, or add a
Persistence mapping. Runtime may host the stateless Service but does not own
Reflection state.

## Public contract

The public header is `<cca/memory/memory_reflection.hpp>`. It declares exactly
four public Assets and one stateless Service:

| Declaration | Responsibility |
| --- | --- |
| `ReflectionQuery` | Owns one Workspace identifier, proposed Reflection identifier, and exact caller-supplied knowledge. |
| `Reflection` | Owns one authentic Reflected value and its complete ordered immediate-source evidence. |
| `ReflectionSession` | Owns one Workspace's operational preparation and derivation lifecycle. |
| `ReflectionResult` | Owns one operation outcome and its operation-specific payload. |
| `MemoryReflectionEngine` | Performs exactly `reflect`, `derive`, `explain`, `validate`, `retrieveSession`, and `forgetSession`. |

Query and session construction reject an empty Workspace identifier by
throwing `std::invalid_argument`. Empty target identity and knowledge remain
representable in a query so `reflect` can report their deterministic semantic
errors. Identifiers and content are preserved byte-for-byte and compared
case-sensitively.

Only successful `MemoryReflectionEngine::derive` can initially establish an
authentic `Reflection`; there is no public source-forging constructor. A
Reflection owns its Workspace identifier, distinct target identity, exact
knowledge, complete `KnowledgeCandidate` sequence, and parallel explanation
chains. Public copies are deep and independent.

`ReflectionResult` is move-only. A moved-from Result is unsuccessful with
empty code and message, null pointers, and an empty explanation chain. A
moved-from Reflection has empty strings and sequences. A moved-from session is
Pristine in its original Workspace. Session assignment is disabled so an
existing Workspace boundary cannot be rebound.

## Session lifecycle

```text
Pristine --reflect--> Prepared --derive--> Derived
    |                    |                   |
    +--------------------+-------------------+
                  forgetSession
                        |
                        v
                    Forgotten
```

`Prepared` is operational evidence, not a MemoryOS base state. Reflected
knowledge exists only after successful `derive`.

| State | `query()` | candidates and chains | `reflection()` |
| --- | --- | --- | --- |
| `Pristine` | null | empty | null |
| `Prepared` | present | non-empty, complete, aligned | null |
| `Derived` | present | non-empty, complete, aligned | present |
| `Forgotten` | null | empty | null |

`size()` always equals `sourceCandidates().size()`. In Prepared and Derived,
the explanation-chain sequence has the same cardinality and positional
correspondence. `explain`, `validate`, and `retrieveSession` are observational.
Forgotten is terminal; repeated `forgetSession` is idempotent.

## Preparation and detached evidence

`reflect` requires a Pristine Reflection Session and a same-Workspace,
started, non-Forgotten Retrieval Session with at least one candidate. It uses
every current candidate in exact session order, including the deterministic
effects of prior CCA-KR-1.0 `filter` and `rank` calls. It neither selects,
deduplicates, searches for, nor reorders sources.

For every `(KnowledgeCandidate::Kind, sourceIdentifier)` key, `reflect` invokes
released `MemoryRetrievalEngine::explain`, verifies complete candidate
equality, and copies the exact explanation chain byte-for-byte. Complete
candidate equality includes Kind, Workspace, identifier, rank score, typed
accessor shape, category-specific fields, ordered Long-Term provenance, direct
relationships, and every nested order.

The proposed Reflection identifier must be non-empty and differ from every
immediate source identifier, regardless of source Kind. Knowledge must be
non-empty. The Contract has no Reflection aggregate and makes no uniqueness
claim against Reflections produced by other sessions.

Preparation captures detached evidence only. A CCA-KR candidate or Retrieval
Session does not keep the source in Retrieved accessibility and is never
reinterpreted as a live source.

## Live accessibility and derivation

`derive` requires Prepared and const live `SemanticMemory`, `EpisodicMemory`,
and `ProceduralMemory` aggregates. It first checks their Workspace identifiers
in that fixed order. It then processes prepared candidates in stored order.

For each source, the engine calls exactly the matching released category
Service operation:

- `SemanticMemoryEngine::retrieve` for Semantic candidates;
- `EpisodicMemoryEngine::retrieve` for Episodic candidates; and
- `ProceduralMemoryEngine::retrieve` for Procedural candidates.

The engine retains every returned category Result and typed returned access
until it has staged the complete Result-owned Reflection, the independent
session-owned Reflection, and the success Result. The category Contracts
explicitly apply `Retrieved(Semantic)`, `Retrieved(Episodic)`, or
`Retrieved(Procedural)` accessibility to those returned accesses. Their
combined lifetime and target staging therefore form one compound,
operation-bounded `Retrieved(Y) -> Reflected` derivation scope.

The engine does not call `MemoryRetrievalEngine::retrieve` during derivation:
CCA-KR-1.0 ends its own accessibility window before its detached candidate is
returned. It also does not reinterpret bare aggregate access as Retrieved.
Category Results are released after complete staging and are never retained in
a Reflection, session, or engine.

Every returned typed value is compared completely with the prepared snapshot.
Rank score and explanation history are preparation evidence rather than live
source fields and are excluded from drift comparison. Absence or an
inaccessible Forgotten source is `SOURCE_NOT_FOUND`; complete typed drift is
`SOURCE_CHANGED`; another unexpected released semantic failure is
`REFLECTION_STATE_MISMATCH`.

All source aggregates remain unchanged. Retrieval and derivation do not change
source identity, content, provenance, relationships, ordering, category,
Workspace, base state, or lifecycle. Later source changes do not rewrite or
invalidate a completed Reflection, and Reflection/session lifecycle never
cascades to a source.

## Operations

### `reflect`

Validates lifecycle, Workspace boundaries, retrieval lifecycle, query fields,
non-empty source cardinality, complete candidate shapes, identity distinction,
and exact explanations in the specified precedence. Success atomically
establishes Prepared and has no payload. It reads no live category aggregate
and creates no Reflection.

### `derive`

Validates Prepared structure, aggregate Workspaces, exact live presence, and
complete source equality. Success atomically establishes Derived and returns
one complete independent Reflection while the session receives a completely
equivalent independent copy. The operation cannot be repeated in Derived.

### `explain`

Requires Derived. It selects an immediate source using exact Kind and exact
identifier and returns an independent complete candidate plus its preserved
byte-identical chain. It performs no live lookup and appends no token.

### `validate`

Accepts Prepared and Derived. It checks the state-dependent query, Workspace,
identity, knowledge, candidate shape, composite-key uniqueness, chain
alignment, and complete Derived Reflection correspondence. It reads no live
source, so a later source lifecycle change does not invalidate completed
evidence.

### `retrieveSession`

Accepts every state and returns a complete independent session copy. It uses
no registry, Runtime, Persistence, Provider, or live source aggregate.

### `forgetSession`

Accepts every state, atomically clears session-owned operational evidence, and
establishes terminal Forgotten. It does not forget a source or change an
independently returned Reflection or session copy.

## Result codes, payloads, and precedence

The closed operation code set is:

`OK`, `SESSION_FORGOTTEN`, `SESSION_ALREADY_STARTED`,
`SESSION_NOT_PREPARED`, `SESSION_ALREADY_DERIVED`,
`REFLECTION_NOT_DERIVED`, `RETRIEVAL_SESSION_FORGOTTEN`,
`RETRIEVAL_SESSION_NOT_STARTED`, `WORKSPACE_MISMATCH`,
`INVALID_IDENTIFIER`, `INVALID_KNOWLEDGE`, `NO_SOURCES`,
`INVALID_SOURCE_KIND`, `SOURCE_NOT_FOUND`, `SOURCE_CHANGED`,
`IDENTITY_CONFLICT`, and `REFLECTION_STATE_MISMATCH`.

`succeeded()` is true exactly for `OK`. Success messages are empty. Failure
messages are stable and non-empty, and failures contain no payload.

| Successful operation | Only payload |
| --- | --- |
| `reflect` | none |
| `derive` | complete Reflection |
| `explain` | complete candidate and explanation chain |
| `validate` | none |
| `retrieveSession` | complete session |
| `forgetSession` | none |

Lifecycle checks precede all other checks. `reflect` then checks query and
Retrieval Session Workspace, Retrieval Session lifecycle, target fields,
cardinality, candidate shape, identity conflict, and explanation
correspondence. `derive` checks Prepared structure before Semantic, Episodic,
and Procedural Workspace equality, then validates live sources in prepared
order. `explain` checks Kind before identifier and identifier before exact
lookup. A caller-supplied query, Retrieval Session, or live aggregate
Workspace disagreement is `WORKSPACE_MISMATCH`; inconsistent stored session
evidence is `REFLECTION_STATE_MISMATCH`.

## Determinism, failure safety, and concurrency

All observable ordering comes from the prepared Retrieval Session sequence.
Nested provenance, relationship, category, chronology, step, and explanation
orders are preserved exactly. Equivalent values and histories produce
equivalent codes, messages, payloads, lifecycle stages, source evidence, and
ordering. Clocks, locale, addresses, unordered iteration, scheduling, Runtime
state, Persistence activity, and Provider choice do not participate.

Every mutating operation stages all allocation, copying, category retrieval,
comparison, Result construction, and replacement state before a no-fail
session commit. Semantic failure and propagated allocation, construction, or
released-operation exceptions preserve the complete session, all input
aggregates, every source, all ordering, and every prior independent Result.
No partial Reflection is published.

Independent queries, sessions, Results, Reflections, Retrieval Sessions,
engines, and source aggregates may be used concurrently. Const observation of
an unmodified value performs no hidden mutation. Concurrent use of one
Reflection Session when any access mutates it is not required.

## Architectural boundaries

- The Workspace is the ownership and consistency boundary; derivation never
  transfers ownership or creates cross-Workspace state.
- The Service is stateless and retains no caller-owned pointer, Result,
  source, or session between calls.
- Runtime is disposable and cannot trigger or determine Reflection behavior.
- No Persistence projection, reconstruction, format, or Provider is added.
- Released CCA-CONS-1.0 implements only Working-to-Long-Term consolidation;
  CP-009 neither invokes it nor claims Reflected-to-Long-Term delivery.
- The implementation does not modify Long-Term, Semantic, Episodic, or
  Procedural knowledge; classify, consolidate, reason, plan, execute, archive,
  restore, or forget source knowledge; traverse relationships; generate or
  infer content; use similarity, embeddings, vectors, Knowledge Graphs, LLMs,
  or AI; schedule work; execute workflows; simulate; or implement Studio.

## Requirement coverage

The automated unit, allocation-failure, architecture, example, and build gates
provide the following CCA-REFLECT-1.0 evidence:

| Requirement | Evidence focus |
| --- | --- |
| CCA-REFLECT-001 | Constitution, Workspace, Domain, and frozen-authority architecture audit |
| CCA-REFLECT-002 | Semantic/Episodic/Procedural-only staged derivation boundary |
| CCA-REFLECT-003 | Exact four-Asset declaration audit |
| CCA-REFLECT-004 | Exact Service and six-operation declaration audit |
| CCA-REFLECT-005 | Released public dependency and acyclicity audit |
| CCA-REFLECT-006 | Session construction and immutable Workspace tests |
| CCA-REFLECT-007 | Query ownership, construction, and inertness tests |
| CCA-REFLECT-008 | Pristine observations |
| CCA-REFLECT-009 | Closed lifecycle and observational-operation tests |
| CCA-REFLECT-010 | Complete session observation and accessor lifetime tests |
| CCA-REFLECT-011 | Caller-owned all-state session-copy tests |
| CCA-REFLECT-012 | Engine-only Reflection establishment audit |
| CCA-REFLECT-013 | Complete all-current-candidate capture and order tests |
| CCA-REFLECT-014 | Complete typed source and nested provenance tests |
| CCA-REFLECT-015 | Byte-identical explanation preservation and alignment tests |
| CCA-REFLECT-016 | Query/session/candidate/aggregate/target Workspace tests |
| CCA-REFLECT-017 | Target identity, knowledge, and source-distinctness tests |
| CCA-REFLECT-018 | Explicit content and no-transformation audit |
| CCA-REFLECT-019 | Detached CCA-KR evidence boundary tests |
| CCA-REFLECT-020 | Fixed-order category retrieval, absence, and drift tests |
| CCA-REFLECT-021 | Retained returned-access scope and unchanged base-state tests |
| CCA-REFLECT-022 | Complete source non-interference tests |
| CCA-REFLECT-023 | Reflect validation, preparation, and atomicity tests |
| CCA-REFLECT-024 | Derive validation, provenance, and atomicity tests |
| CCA-REFLECT-025 | Independent equivalent publication values |
| CCA-REFLECT-026 | Exact explain lookup, payload, and non-mutation tests |
| CCA-REFLECT-027 | Prepared/Derived structural validation tests |
| CCA-REFLECT-028 | Independent all-state `retrieveSession` copies |
| CCA-REFLECT-029 | All-state terminal and isolated forgetting |
| CCA-REFLECT-030 | Repetition and wrong-stage outcomes |
| CCA-REFLECT-031 | Closed codes, messages, and failure payloads |
| CCA-REFLECT-032 | Exact success payload shapes |
| CCA-REFLECT-033 | Exhaustive overlapping-failure precedence |
| CCA-REFLECT-034 | Deep copy, move, ownership, and assignment restrictions |
| CCA-REFLECT-035 | Stateless Service and retained-reference audit |
| CCA-REFLECT-036 | Semantic and allocation-failure strong guarantees |
| CCA-REFLECT-037 | Complete equivalent-history determinism |
| CCA-REFLECT-038 | Independent concurrency and const observation |
| CCA-REFLECT-039 | Source/target lifecycle independence |
| CCA-REFLECT-040 | Runtime and Provider independence |
| CCA-REFLECT-041 | No Persistence mapping, trigger, or scope expansion |
| CCA-REFLECT-042 | Reflected-only output and no consolidation dependency |
| CCA-REFLECT-043 | Excluded-capability dependency, symbol, and behavior audit |
| CCA-REFLECT-044 | This API guide and the six-operation executable example |
| CCA-REFLECT-045 | Bidirectional traceability and C++23 warnings-as-errors gates |

The executable example is
[`examples/memory_reflection_usage.cpp`](../examples/memory_reflection_usage.cpp).
Only CCA-REFLECT-1.0 and its frozen authorities define normative behavior.
