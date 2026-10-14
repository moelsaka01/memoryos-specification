# Memory Retrieval

Memory Retrieval implements CCA-KR-1.0 as a Workspace-scoped capability in
the Memory Domain. It observes accessible Semantic Concepts, Episodes, and
Procedures and produces detached candidate values. The originating memory
remains authoritative: retrieval neither owns nor changes source knowledge.

## Public contract

The installed header is `<cca/memory/knowledge_retrieval.hpp>`. It declares
the four public Assets and one stateless Service required by API-010-HPP:

| Declaration | Responsibility |
| --- | --- |
| `KnowledgeQuery` | Owns arbitrary case-sensitive literal query text. |
| `KnowledgeCandidate` | Owns one typed, detached source snapshot, rank score, Workspace identity, and private explanation chain. |
| `RetrievalSession` | Owns one Workspace's ordered candidates and ready, started, or forgotten lifecycle. |
| `KnowledgeResult` | Owns the exact operation outcome and its independent payload. |
| `MemoryRetrievalEngine` | Performs exactly `retrieve`, `search`, `filter`, `rank`, `explain`, and `forgetSession`. |

`KnowledgeQuery` is constructed from and owns the exact supplied text;
empty text is valid. A candidate has no public initial/source constructor:
only `MemoryRetrievalEngine` can initially establish one from an accessible
released source value, after which public copy and move operations provide
value semantics. `KnowledgeResult` is operation-produced and move-only.
`MemoryRetrievalEngine` is a stateless value with no caller-visible lifecycle.

Candidate identity is the pair of `KnowledgeCandidate::Kind` and exact source
identifier. Equal identifier text in two source categories therefore denotes
two candidates. Exactly one of `semanticConcept()`, `episode()`, and
`procedure()` is non-null for an engine-produced candidate.

The non-null typed accessor exposes the complete source snapshot: Semantic
identity, meaning, ordered Long-Term provenance, category order, and link
order; Episodic identity, occurrence, context, chronology, ordered provenance,
and link order; or Procedural identity, activity, step order, ordered
provenance, and link order.

## Session lifecycle

A session requires a non-empty immutable Workspace identifier; empty
construction throws `std::invalid_argument`. It begins ready and empty.
Exactly one successful `retrieve` or `search` starts it;
even a successful zero-match search starts the session. A failed retrieve
leaves it ready. Filtering, ranking, and explanation require the started
state.

`forgetSession` atomically clears all candidate state and enters the terminal
forgotten state. It is idempotent and never forgets source knowledge. Copy
construction creates an independent deep session copy. Move construction
transfers the complete session and leaves the source ready and pristine under
its original Workspace identity. Assignment remains disabled so Workspace
ownership cannot be rebound.

Candidate copies preserve complete state independently. Moving a candidate
preserves its former `Kind` in the source while leaving that source with empty
Workspace and source identifiers, score zero, null typed accessors, and an
empty private explanation chain. A moved-from `KnowledgeResult` is
unsuccessful with empty code and message, a null candidate, and empty
candidate and explanation sequences; this is not an operation failure result.

## Retrieval, matching, and ordering

Exact retrieval addresses one category and exact identifier after validating
all three source aggregates against the session Workspace. Cross-category
search visits each accessible source exactly once in this order:

1. `SemanticMemory::concepts()` order;
2. `EpisodicMemory::episodes()` canonical chronology order; and
3. `ProceduralMemory::procedures()` establishment order.

Search and filter perform only case-sensitive literal comparisons. The
searchable fields are identifiers, Semantic meaning and categories, Episodic
occurrence and context, and Procedural activity and steps. Provenance, links,
chronology, and forgotten history are deliberately excluded.

The deterministic score is the highest applicable tier, not a sum:

| Score | Match |
| --- | --- |
| 4 | Exact identifier |
| 3 | Non-exact identifier substring |
| 2 | Exact content field |
| 1 | Non-exact content-field substring |
| 0 | Empty query |

`filter` considers only current session candidates, preserves survivor order,
and replaces each survivor's score. `rank` performs a stable descending-score
ordering, preserving the immediate order of equal scores. Neither operation
re-reads or modifies source aggregates.

## Explanations and provenance

Each candidate retains an ordered mechanical explanation chain. Retrieval
records `retrieve:identifier-exact`. Search and filter record one token for
the maximum-scoring first field. Ranking records `rank:score:N` and records
`rank:stable-tie` when another current candidate has the same score.
Repeated filtering and ranking append history deterministically.

For `OP` equal to `search` or `filter`, the complete search/filter token
grammar is:

```text
OP:empty-query
OP:identifier-exact
OP:identifier-substring
OP:content-exact:FIELD
OP:content-substring:FIELD
```

`FIELD` is exactly `meaning`, `occurrence`, `context`, `activity`,
`category[N]`, or `step[N]`, where `N` is the zero-based stored position.
Ranking uses exactly `rank:score:N` followed by `rank:stable-tie` when the
candidate shares its current score with another candidate.

`explain` returns an independent candidate and byte-identical complete chain
without mutating the session. This chain explains retrieval mechanics; it is
not reasoning. The typed candidate snapshot separately preserves complete
source provenance, including ordered `LongTermMemoryEntry` values. Every
candidate and result is detached: no pointer, iterator, or lifetime dependency
into a supplied source aggregate is retained.

The source observation represents a bounded Retrieved accessibility overlay.
It ends when the source value has been copied, is never stored in the source,
and does not make session copies authoritative knowledge. Subsequent update or
forget operations on a source do not rewrite a detached candidate, and a
candidate cannot revive or access forgotten source knowledge.

## Results, failure, and concurrency

Successful results use `OK` with an empty message. Semantic failures use the
closed codes `SESSION_FORGOTTEN`, `SESSION_ALREADY_STARTED`,
`SESSION_NOT_STARTED`, `WORKSPACE_MISMATCH`, `INVALID_SOURCE_KIND`,
`INVALID_IDENTIFIER`, and `NOT_FOUND`, with stable non-empty messages and no
payload. Payload shape is operation-specific: exact retrieve and explain
return one candidate, search/filter/rank return a sequence, explain also
returns a chain, and forgetting returns no payload.

Every session mutation stages complete state before commit. A semantic error
or propagated allocation/construction exception leaves the session and all
three source aggregates unchanged. Equivalent values and operation histories
produce equivalent ordering, scores, chains, payloads, and diagnostics.

Validation precedence is fixed. `retrieve` validates, in order: not
forgotten, not already started, Semantic Workspace equality, Episodic
Workspace equality, Procedural Workspace equality, valid `Kind`, non-empty
identifier, then exact source presence. `search` uses the same lifecycle and
Semantic-to-Episodic-to-Procedural Workspace order before scanning.
`filter` and `rank` validate not forgotten before started. `explain` validates
not forgotten, started, valid `Kind`, non-empty identifier, then exact
composite-key presence. `forgetSession` has no semantic failure and remains
idempotent in every lifecycle state.

The engine stores no state between calls. Distinct engines, sessions, source
aggregates, queries, candidates, and results may be used concurrently. A
single session is not required to support concurrent access when any access
mutates it.

References returned by `RetrievalSession::candidates()` and pointers into
those values remain valid until that session is mutated or destroyed. A
candidate's typed-source pointer remains valid until the candidate is
assigned, moved from, or destroyed. Result pointers and references remain
valid until the result is move-assigned or destroyed. Const observation of an
otherwise unmodified value performs no hidden mutation.

## Architecture boundary

The public capability depends only on the released Semantic, Episodic, and
Procedural Memory Contracts. It has no Runtime or Persistence dependency,
retains no source reference, introduces no Provider choice, and does not
classify, derive, consolidate, reflect, reason, plan, execute, archive,
restore, forget source knowledge, rewrite evidence, infer or automatically
enrich content, normalize queries, or traverse relationships. It performs no
embeddings, similarity or vector search, Knowledge Graph or AI/LLM behavior,
scheduling, workflow execution, simulation, or Memory Studio behavior.
Runtime may host the stateless Service but cannot own session or result state.

## Example

The warnings-as-errors public example is
[`examples/knowledge_retrieval_usage.cpp`](../examples/knowledge_retrieval_usage.cpp).
It establishes one value in each released source category, performs exact and
cross-category retrieval, filters, ranks, explains a candidate, and forgets
the session while checking that source aggregates remain populated.

## Requirement coverage

| Requirement | Automated or review evidence |
| --- | --- |
| CCA-KR-001 | Memory Retrieval architecture boundary test |
| CCA-KR-002 | Exact four-Asset public API and compile-time tests |
| CCA-KR-003 | Exact stateless Service and six-operation scans/tests |
| CCA-KR-004 | Session construction, immutable Workspace, copy, and move tests |
| CCA-KR-005 | Memory Domain and dependency architecture scan |
| CCA-KR-006 | Ready/start/forgotten lifecycle tests |
| CCA-KR-007 | Session flag, size, and candidate-order observation tests |
| CCA-KR-008 | Query ownership, empty query, case, and literal matching tests |
| CCA-KR-009 | Kind and composite-key tests |
| CCA-KR-010 | No-forging-constructor and engine-establishment tests |
| CCA-KR-011 | Complete typed source equality and accessor tests |
| CCA-KR-012 | Semantic, Episodic, and Procedural coverage tests |
| CCA-KR-013 | Three-source Workspace validation and precedence tests |
| CCA-KR-014 | Before/after source equality and detached-lifetime tests |
| CCA-KR-015 | Canonical cross-category and category-local ordering tests |
| CCA-KR-016 | Exact retrieve success, absence, and failure atomicity tests |
| CCA-KR-017 | Included and excluded searchable-field tests |
| CCA-KR-018 | Search matches, zero matches, empty query, and start tests |
| CCA-KR-019 | Filter survivor, score, chain, and no-source-read tests |
| CCA-KR-020 | Score-tier and first-maximum-field tests |
| CCA-KR-021 | Stable descending rank and repeated-rank tests |
| CCA-KR-022 | Exact explanation-token construction tests |
| CCA-KR-023 | Explain lookup, payload, chain, and const behavior tests |
| CCA-KR-024 | Terminal idempotent session-forgetting tests |
| CCA-KR-025 | Bounded Retrieved and detached-observation tests |
| CCA-KR-026 | Source update/forget and session lifecycle-separation tests |
| CCA-KR-027 | Closed result-code, message, and moved-from tests |
| CCA-KR-028 | Exact operation payload-shape tests |
| CCA-KR-029 | Table-driven overlapping-error precedence tests |
| CCA-KR-030 | Candidate/session/result value and move-invariant tests |
| CCA-KR-031 | Stateless-engine and independent-session tests |
| CCA-KR-032 | Semantic and exhaustive allocation-failure state comparisons |
| CCA-KR-033 | Equivalent-history complete-state determinism tests |
| CCA-KR-034 | Distinct-object concurrency test and documented same-session boundary |
| CCA-KR-035 | Runtime/Persistence dependency and state scans |
| CCA-KR-036 | Released source-header/API compatibility builds |
| CCA-KR-037 | Excluded-capability dependency and symbol scans |
| CCA-KR-038 | Source immutability and prohibited-behavior tests/scans |
| CCA-KR-039 | This API guide and build-checked public example |
| CCA-KR-040 | Bidirectional 41-row traceability audit |
| CCA-KR-041 | Warnings-as-errors build and complete CTest run |

Conformance requires every row to pass. Individual operation success is not
partial conformance.
