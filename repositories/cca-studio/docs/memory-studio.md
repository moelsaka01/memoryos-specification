# Memory Studio 1.0

Memory Studio is the passive, in-process presentation boundary for a complete
caller-supplied MemoryOS observation. It copies released CP-001 through CP-010
values into detached typed assets. It does not discover a Workspace, retain a
live source reference, create knowledge, establish accessibility, or own a
memory lifecycle.

The public C++ header is `<cca/memory/memory_studio.hpp>` and its declarations
are in `cca::memory`. CCA-STUDIO-1.0 defines four public Assets—`StudioView`,
`StudioQuery`, `StudioSession`, and `StudioResult`—and one stateless Service,
`MemoryStudioEngine`.

## Public declaration map

### `StudioView`

The primary constructor is:

```cpp
StudioView(
    std::string workspaceIdentifier,
    const Memory& memory,
    const WorkingMemory& workingMemory,
    const LongTermMemory& longTermMemory,
    const SemanticMemory& semanticMemory,
    const EpisodicMemory& episodicMemory,
    const ProceduralMemory& proceduralMemory,
    std::vector<RetrievalSession> retrievalSessions = {},
    std::vector<ConsolidationSession> consolidationSessions = {},
    std::vector<Reflection> reflections = {},
    std::vector<ReflectionSession> reflectionSessions = {},
    std::vector<ProviderSession> providerSessions = {});
```

It rejects an empty view Workspace with `std::invalid_argument`. It copies the
six required aggregates and owns the five supplied sequences in caller order.
Workspace inconsistency inside otherwise publicly constructible released
values is intentionally representable here; `observe` reports it through the
closed Result Contract.

`StudioView` has a destructor, deep copy construction, transactional deep copy
assignment, and `noexcept` move construction and move assignment. Its accessors
are all `const noexcept`:

- `workspaceIdentifier()` returns the exact view Workspace.
- `memory()`, `workingMemory()`, `longTermMemory()`, `semanticMemory()`,
  `episodicMemory()`, and `proceduralMemory()` return pointers to the six owned
  aggregate copies.
- `retrievalSessions()`, `consolidationSessions()`, `reflections()`,
  `reflectionSessions()`, and `providerSessions()` return the complete owned
  sequences.

A complete view has six non-null aggregate pointers. A moved-from view retains
its pre-move Workspace, has six null aggregate pointers, and has five empty
sequences. Copying or assigning that moved-from observation propagates the same
invalid shape. It remains a valid C++ object and `observe` reports
`INVALID_VIEW` after higher-precedence lifecycle and Workspace checks.

### `StudioQuery`

```cpp
StudioQuery(
    std::string workspaceIdentifier,
    Scope scope = Scope::Complete,
    std::string identifier = {});
```

The constructor rejects only an empty Workspace with `std::invalid_argument`.
The optional identifier may be empty. Both strings remain exact,
case-sensitive byte sequences: Studio does not trim, parse, normalize, or
case-fold them.

The closed `Scope` enumeration, in its declared order, is:

| Enumerator | Selected family |
| --- | --- |
| `Complete` | Every family in the frozen complete order |
| `Memory` | Memory Foundation |
| `WorkingMemory` | Working Memory |
| `LongTermMemory` | Long-Term Memory |
| `SemanticMemory` | Semantic Memory |
| `EpisodicMemory` | Episodic Memory |
| `ProceduralMemory` | Procedural Memory |
| `Retrieval` | Retrieval sessions and candidates |
| `Consolidation` | Consolidation sessions |
| `Reflection` | standalone Reflections and Reflection sessions |
| `Providers` | Provider sessions and descriptors |

The implicit underlying values are zero through ten. A value outside those
enumerators is reported as `INVALID_QUERY` by an operation. A Scope is only a
presentation selector; it is not a Domain, memory state, taxonomy category, or
ownership marker.

`StudioQuery` has a destructor, independent copy construction and assignment,
and `noexcept` move construction and assignment. `workspaceIdentifier()`,
`scope()`, and `identifier()` are `const noexcept`. After either move, the
source retains its Workspace, resets to `Scope::Complete`, has an empty
identifier, and remains usable and copyable.

### `StudioSession`

```cpp
explicit StudioSession(std::string workspaceIdentifier);
```

Construction rejects an empty Workspace with `std::invalid_argument`. The
Workspace is immutable for the session lifetime. The closed `State`
enumerators are `Open`, `Observed`, and `Forgotten`, with implicit values zero,
one, and two.

The class has a destructor, deep copy construction, and `noexcept` move
construction. Copy assignment and move assignment are deleted so assignment
cannot rebind Workspace ownership. Its `workspaceIdentifier()`, `state()`, and
`view()` accessors are `const noexcept`. `view()` is non-null only while
Observed.

Moving an Open or Observed session leaves the source Open with no view and its
original Workspace. Moving a Forgotten session leaves the source Forgotten,
with no view and its original Workspace.

### `StudioResult`

`StudioResult` is move-only: copy construction and copy assignment are
deleted; move construction and move assignment are `noexcept`; and the class
has a destructor. Callers receive Results only from the six Service
operations.

All Result accessors are `const noexcept`:

- `workspaceIdentifier()` returns the operation session's exact Workspace.
- `succeeded()` is true exactly when `code()` is `OK`.
- `code()` and `message()` expose the closed outcome.
- `view()` exposes an owned complete view only for the operations whose payload
  shape permits it.
- `observations()` exposes inspection paths or summary lines.
- `explanationChains()` preserves a sequence of chains and each chain's token
  sequence.

A moved-from Result has an empty Workspace, reports failure, has empty code and
message, a null view, and empty sequences. It is not an operation-produced
outcome.

### `MemoryStudioEngine`

`MemoryStudioEngine` is freely constructible and has no Workspace or session
state. It declares exactly these six `const` operations, with no overloads:

```cpp
StudioResult observe(StudioSession&, const StudioView&) const;
StudioResult inspect(const StudioSession&, const StudioQuery&) const;
StudioResult trace(const StudioSession&, const StudioQuery&) const;
StudioResult summarize(const StudioSession&, const StudioQuery&) const;
StudioResult exportView(const StudioSession&) const;
StudioResult forgetSession(StudioSession&) const;
```

## Constructing a coherent view

The caller supplies a coherent cut and excludes concurrent source mutation
while the `StudioView` constructor copies independently owned values. The
complete frozen family order is:

```text
Memory
WorkingMemory
LongTermMemory
SemanticMemory
EpisodicMemory
ProceduralMemory
Retrieval sessions
Consolidation sessions
Reflection values
Reflection sessions
Provider sessions
```

All six aggregates are required. The five sequences may be empty. Aggregate
canonical order, outer caller order, nested released order, permitted
duplicates, identities, content, provenance snapshots, explanation-chain
boundaries, lifecycle observations, expiration observations, archive flags,
relationships, chronology, and procedure-step order are retained.

"Complete" means exactly the six aggregate values and every sequence value the
caller supplied. Released Contracts provide no Workspace registry for Studio
to enumerate. Current values already cleared by a released forget operation,
arbitrary Provider requests or operation Results, Provider implementation
state, inaccessible private data, UI state, Runtime state, and Persistence
state cannot be reconstructed. Hidden forgotten-identifier history can remain
inside a deep released copy without becoming newly visible through Studio.

At `observe`, the view Workspace, every aggregate Workspace, every supplied
session or Reflection Workspace, and every publicly observable nested
Workspace-bearing value must equal the session Workspace byte-for-byte. Studio
uses public observations only. It trusts released lifecycle, discriminator,
alignment, identity, payload, and provenance invariants and does not
structurally revalidate them.

## Session lifecycle and re-observation

```text
Open --observe--> Observed --observe--> Observed (atomic replacement)
Open --forgetSession--> Forgotten
Observed --forgetSession--> Forgotten
Forgotten --forgetSession--> Forgotten (idempotent)
```

An Open session owns no view. `observe` stages two complete deep copies: one is
installed in the session and the other is returned in the Result. Successful
re-observation replaces the installed view only after all validation and
allocation finish. A Forgotten session is terminal; only idempotent
`forgetSession` succeeds from it.

`inspect`, `trace`, `summarize`, and `exportView` report
`SESSION_NOT_OBSERVED` on Open and `SESSION_FORGOTTEN` on Forgotten. `observe`
reports `SESSION_FORGOTTEN` on Forgotten. `forgetSession` succeeds in all three
states.

Studio stages a successful `forgetSession` Result before its nonthrowing
commit. The commit clears only the session-owned view and establishes
Forgotten. It does not traverse or modify the detached view's sources, invoke a
released forget operation, invalidate an earlier Result, or destroy external
evidence.

## Exact selection and inspection paths

An empty identifier selects the complete requested scope. A non-empty
identifier compares only these exact identities:

| Scope | Identity fields |
| --- | --- |
| `Memory` | `MemoryEntry::identifier()` |
| `WorkingMemory` | `WorkingMemoryEntry::identifier()` |
| `LongTermMemory` | `LongTermMemoryEntry::identifier()` |
| `SemanticMemory` | `SemanticConcept::identifier()` |
| `EpisodicMemory` | `Episode::identifier()` |
| `ProceduralMemory` | `Procedure::identifier()` |
| `Retrieval` | `KnowledgeCandidate::sourceIdentifier()` |
| `Consolidation` | request entry plus candidate Working/Long-Term entry identifiers |
| `Reflection` | Reflection/query target identifiers plus source-candidate identifiers |
| `Providers` | `ProviderDescriptor::identifier()` |
| `Complete` | all preceding fields in complete family order |

No content search, substring match, relationship traversal, ranking,
retrieval, inference, provenance resolution, or live access participates.
Equal identifiers at distinct locations remain distinct matches. An empty
selection is successful; a valid non-empty miss is `NOT_FOUND`.

`inspect` returns an independent complete view plus paths into that view. The
closed path grammar is:

```text
Memory
Memory.entries[i]
WorkingMemory
WorkingMemory.entries[i]
LongTermMemory
LongTermMemory.entries[i]
SemanticMemory
SemanticMemory.concepts[i]
EpisodicMemory
EpisodicMemory.episodes[i]
ProceduralMemory
ProceduralMemory.procedures[i]
Retrieval.sessions[i]
Retrieval.sessions[i].candidates[j]
Consolidation.sessions[i]
Reflection.values[i]
Reflection.values[i].sources[j]
Reflection.sessions[i]
Reflection.sessions[i].sources[j]
Providers.sessions[i]
Providers.sessions[i].descriptors[j]
```

Indices are zero-based ASCII decimal without leading zero except zero. Empty
selection traverses depth-first: every aggregate, session, or Reflection path
precedes its ordered child paths. `Complete` concatenates families in the
frozen order. Exact selection emits only the most specific matching item path.
Every independently matching field contributes its location. A Consolidation
session is the sole coalescing exception: one or more matches in it emit its
session path at most once. Paths are location labels, not stable identities,
semantic categories, resource addresses, or a persistence format.

## Explanation tracing

`trace` accepts only `Complete`, `Retrieval`, and `Reflection`. An empty
identifier selects all chains in the permitted scope. An exact Retrieval
source identifier selects each matching candidate chain. An exact Reflection
or query target selects all aligned chains in that value; an exact source
identifier selects the corresponding aligned chains.

Retrieval sessions precede Reflection values, which precede Reflection
sessions. Outer, candidate/source, token, and chain order and duplicates remain
unchanged. For each selected Retrieval candidate, Studio calls only released
`MemoryRetrievalEngine::explain` with the candidate's exact Kind and source
identifier on the detached session. Reflection chains are copied from the
released aligned public sequences. Studio does not call Retrieval, search,
filter, rank, or any Reflection operation; append tokens; flatten chains;
interpret explanations; or reconstruct cleared evidence.

For `Complete`, only chain-bearing Retrieval and Reflection identities count.
An identifier found solely in another family is still `NOT_FOUND`. A valid
empty chain selection succeeds with an empty chain sequence.

## Mechanical summaries

`summarize` accepts every declared scope but requires an empty identifier. It
returns fixed `key=value` observations with no whitespace. Counts are
locale-independent base-ten ASCII without grouping or leading zero except
zero. The only Boolean is lowercase `true` or `false`.

| Scope | Ordered keys |
| --- | --- |
| `Memory` | `Memory.entries` |
| `WorkingMemory` | `WorkingMemory.active`, `WorkingMemory.entries` |
| `LongTermMemory` | `LongTermMemory.entries`, `LongTermMemory.archived` |
| `SemanticMemory` | `SemanticMemory.concepts` |
| `EpisodicMemory` | `EpisodicMemory.episodes` |
| `ProceduralMemory` | `ProceduralMemory.procedures` |
| `Retrieval` | `Retrieval.sessions`, `Retrieval.sessions.Ready`, `Retrieval.sessions.Started`, `Retrieval.sessions.Forgotten`, `Retrieval.candidates` |
| `Consolidation` | `Consolidation.sessions`, `Consolidation.sessions.Pristine`, `Consolidation.sessions.Analyzed`, `Consolidation.sessions.Promoted`, `Consolidation.sessions.Retained`, `Consolidation.sessions.Forgotten`, `Consolidation.candidates` |
| `Reflection` | `Reflection.values`, `Reflection.sessions`, `Reflection.sessions.Pristine`, `Reflection.sessions.Prepared`, `Reflection.sessions.Derived`, `Reflection.sessions.Forgotten`, `Reflection.sources` |
| `Providers` | `Providers.sessions`, `Providers.sessions.Open`, `Providers.sessions.Exported`, `Providers.sessions.Imported`, `Providers.sessions.Forgotten`, `Providers.descriptors` |

`Complete` concatenates these 33 keys in complete family order. Aggregate
counts are their released collection sizes. `WorkingMemory.active` is the
released flag. `LongTermMemory.archived` counts public archive flags.
Retrieval Ready means neither started nor forgotten, Started means started and
not forgotten, and Forgotten means forgotten. Other session counts use exact
released enum states. Candidate, Reflection-source, and descriptor counts are
ordered sequence totals; they are not unique counts. The summary conveys no
quality, confidence, health, relevance, or inferred meaning.

## Export

`exportView` returns an independent complete in-process copy of the installed
view. "Export" does not mean serialization or CP-010 transport. The operation
has no path, stream, URI, endpoint, encoding, Provider, Persistence,
filesystem, network, or other external side effect.

## Result codes, messages, and payloads

The closed operation-produced outcomes are:

| Code | Exact message |
| --- | --- |
| `OK` | empty |
| `SESSION_FORGOTTEN` | `studio session is forgotten` |
| `SESSION_NOT_OBSERVED` | `studio session has no observed view` |
| `WORKSPACE_MISMATCH` | `workspace identifiers do not match` |
| `INVALID_VIEW` | `studio view is invalid` |
| `INVALID_QUERY` | `studio query is invalid` |
| `NOT_FOUND` | `studio query matched no observation` |

Every failure has a null view and empty observation and chain sequences.
Success payloads are exactly:

| Operation | View | Observations | Explanation chains |
| --- | --- | --- | --- |
| `observe` | independent complete view | empty | empty |
| `inspect` | independent complete view | exact paths | empty |
| `trace` | null | empty | selected exact chains |
| `summarize` | null | ordered summary lines | empty |
| `exportView` | independent complete view | empty | empty |
| `forgetSession` | null | empty | empty |

## Validation precedence

`observe` applies this observable order:

1. reject Forgotten;
2. compare session and view Workspace;
3. require six aggregate pointers in API order;
4. compare six aggregate Workspaces in API order;
5. compare outer and nested public Workspaces in Retrieval, Consolidation,
   standalone Reflection, Reflection-session, and Provider order; and
6. stage two view copies, the replacement, and the successful Result before a
   nonthrowing commit.

Missing aggregates are `INVALID_VIEW`; every Workspace discrepancy is
`WORKSPACE_MISMATCH`.

`inspect`, `trace`, and `summarize` check Forgotten, then Observed, query
Workspace, declared Scope membership, operation-specific query shape, exact
selection, and finally `NOT_FOUND`. They rely on the installed validated view
and do not revalidate it. `exportView` checks Forgotten before Open and stages
its copy before success. `forgetSession` has no semantic failure for a
well-formed session and stages success before clearing the view.

## Ownership, lifetime, failure, and determinism

Every successful payload is detached from its input, session-owned view,
engine, and every earlier payload. Re-observation and forgetting do not change
earlier Results. Source mutation or destruction after completed construction
cannot change a view. No engine retains an argument reference.

Pointers and references returned by a view or Result remain valid until that
owning object is moved from, move-assigned, or destroyed. A session `view()`
pointer remains valid until successful re-observation, forgetting, moving, or
destruction. Copy assignment and move assignment invalidate references into
the assignment target.

Semantic failures are `StudioResult` values. Allocation, construction,
released copy, and permitted CP-007 `explain` exceptions propagate as standard
exceptions; they are not translated into extra result codes. Every failure
provides the strong guarantee. A mutating operation publishes no partial view
or payload and does not change the session until every fallible step succeeds.

Equivalent values and operation histories produce equivalent codes, messages,
paths, summary lines, chains, payloads, stages, provenance, and order. Outcomes
do not depend on addresses, clocks, locale, unordered iteration, scheduling,
Runtime state, Provider identity, or display technology.

Distinct engines, sessions, views, queries, Results, and source values support
independent concurrent use. Concurrent const observation of one otherwise
unchanged value has no hidden mutation. Concurrent access to one session while
any access mutates it is not promised. The caller must still provide a
coherent cut while constructing a view from independent sources.

## Architecture and exclusions

The production dependency direction is:

```text
Memory Studio -> released MemoryOS public Contracts -> platform foundations
```

Released capabilities do not depend on Studio. Runtime may host the stateless
engine but owns no Studio or memory Asset. Policies and released Contracts
remain authoritative; possessing a Studio value grants no new access.
Persistence has no Studio mapping, and Studio neither saves nor loads.
Provider observation is limited to detached `ProviderSession` and
`ProviderDescriptor` state and is independent of Provider implementation or
replacement.

CCA-STUDIO-1.0 defines no UI toolkit, window, widget, renderer, layout, theme,
dashboard, editing model, display transport, filesystem/database/cloud/network
I/O, stream, serializer, encoding, compression, encryption, Provider
implementation, Persistence expansion, Workspace discovery, background
refresh, polling, subscription, synchronization, migration, sharing,
cross-Workspace presentation, memory mutation, accessibility transition,
retrieval, search, filtering, ranking, classification, linking, derivation,
consolidation, reflection, reasoning, inference, planning, execution,
scheduling, workflow, simulation, LLM, or AI behavior.

A graphical or networked application can consume this library only as a
separately governed downstream component. Such an application must not add UI,
I/O, automatic refresh, mutation, or transport behavior to the CP-011 target or
reinterpret its passive detached Contract.
