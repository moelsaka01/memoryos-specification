# Memory Providers

CCA-PROVIDERS-1.0 defines a typed, detached, provider-neutral handoff of
MemoryOS state. It does not select or call external infrastructure. Workspace
ownership, semantic identity, provenance, lifecycle observations, and canonical
ordering remain unchanged across the handoff.

## Public contract

The installed header is `<cca/memory/memory_provider.hpp>`. It declares exactly
four public Assets and one stateless Service in `cca::memory`:

- `ProviderDescriptor` identifies one Provider within one Workspace.
- `ProviderRequest` owns the six released memory aggregate values and an ordered
  sequence of completed `Reflection` values.
- `ProviderSession` owns Workspace-local registration order and operational
  handoff stage.
- `ProviderResult` owns one operation outcome and any returned payload.
- `MemoryProviderEngine` performs the six frozen operations without retaining
  state between calls.

The logical operations `register`, `export`, and `import` use the C++23-safe
member names `registerProvider`, `exportState`, and `importState`. The remaining
members are `validate`, `enumerate`, and `forgetSession`. No overload or callable
Provider binding is part of the public contract.

Every successfully constructed Asset belongs to one exact Workspace. Empty
Workspace identifiers are rejected by descriptor, request, and session
construction. Provider identity is exact and case-sensitive; an empty Provider
identity remains representable so operation validation can report it through
the closed Result contract.

### Value and accessor semantics

`ProviderDescriptor::workspaceIdentifier()` and `identifier()` expose its two
exact owned strings. Descriptor copy and assignment are deep; moving is
non-throwing and leaves both source strings empty.

`ProviderRequest::workspaceIdentifier()` and `providerIdentifier()` expose its
exact identities. `memory()`, `workingMemory()`, `longTermMemory()`,
`semanticMemory()`, `episodicMemory()`, and `proceduralMemory()` return pointers
to the complete owned values. `reflections()` exposes the complete owned vector
in caller order. Request copy and assignment are deep. Moving is non-throwing
and leaves the source identities empty, its aggregate pointers null, and its
Reflection sequence empty.

`ProviderSession::workspaceIdentifier()` is immutable for the session lifetime;
`state()`, `size()`, and `descriptors()` expose its exact stage and ordered
registration values. Copy construction is deep. Assignment is unavailable so
Workspace identity cannot be rebound. Move construction is non-throwing and
preserves the source Workspace under the lifecycle rule below.

`ProviderResult::workspaceIdentifier()` exposes the exact Workspace supplied by
the operation. `succeeded()`, `code()`, `message()`, `request()`, and
`descriptors()` expose the closed outcome and payload shape. Results are
move-only. A moved-from Result has an empty Workspace, code, and message, is
unsuccessful, has a null request, and has an empty descriptor sequence.

## Typed handoff boundary

A `ProviderRequest` owns complete independent copies, in this fixed validation
order, of:

1. `Memory`;
2. `WorkingMemory`;
3. `LongTermMemory`;
4. `SemanticMemory`;
5. `EpisodicMemory`;
6. `ProceduralMemory`; and
7. completed `Reflection` values in caller order.

Copying preserves all released value state, including exact identifiers,
Workspace identity, active task and expiration observations, archival state,
forgotten-identity history, categories, relationships, chronology, duplicate
procedure steps, Long-Term source snapshots, typed candidates, explanation
chains, and every canonical collection order. Import and export never recreate
values through a released mutation or derivation Service.

Retrieval, Consolidation, Reflection, Runtime, Persistence, and Provider
sessions are excluded. Retrieved accessibility and temporary operation Results
are also excluded. A completed `Reflection` is transported because it is the
released Reflected knowledge value; temporary `ReflectionResult` and
`ReflectionSession` values are not transported.

Export and import return detached request copies. Export does not encode or
write bytes. Import does not install, merge, restore, or adopt memory. Adoption
remains the responsibility of an already-approved owning Workspace Contract.

## Session lifecycle

`ProviderSession` has exactly four operational states:

```text
Open --exportState--> Exported --forgetSession--> Forgotten
Open --importState--> Imported --forgetSession--> Forgotten
Open ----------------forgetSession--------------> Forgotten
```

Registration leaves an Open session Open. Exported and Imported are alternative
completed outcomes. `validate` and `enumerate` remain observational in Open,
Exported, and Imported. Forgotten is terminal; every non-forget operation
returns `SESSION_FORGOTTEN`, and repeated `forgetSession` succeeds
idempotently.

These stages are operational information, not MemoryOS semantic states. No
session operation changes a transported memory lifecycle. A moved-from
Forgotten session remains empty Forgotten. Any other moved-from session retains
its Workspace, becomes empty Open, and may be destroyed or reused according to
the public move contract.

## Operations

### `registerProvider`

Registration requires an Open session, the same exact Workspace, and a
non-empty Provider identifier. The first exact identity is appended. An exact
duplicate succeeds without replacement or reordering. Registration binds no
implementation, performs no discovery, and makes no external call.

### `exportState`

Export requires an Open session and a valid request targeting an exactly
registered Provider identity. It validates the complete typed state, constructs
an independent Result request, and atomically establishes Exported. Sources and
the input request remain unchanged.

### `importState`

Import uses the same eligibility and validation boundary as export. It returns
an independent request and atomically establishes Imported. It performs no
Workspace mutation, restoration, or Persistence operation.

### `validate`

Validation is observational in Open, Exported, and Imported. It checks session,
request, Provider registration, Workspace correspondence, aggregate shape, and
Reflection shape in the frozen precedence order. It resolves no live source and
does not invalidate a derived value merely because an independent source later
changed, archived, or was forgotten.

### `enumerate`

Enumeration returns an independent copy of descriptors in first-registration
order. An empty Open session returns an empty successful sequence. No external
registry or infrastructure discovery is consulted.

### `forgetSession`

Forgetting clears only session-owned descriptor metadata and establishes
Forgotten atomically. It does not unregister infrastructure, destroy earlier
Results, delete transported information, or forget memory.

## Results, precedence, and failure safety

Every operation-produced Result owns the exact session Workspace. `succeeded()`
is true exactly for `OK`. Success messages are empty. Failure messages are
stable and non-empty, and failure Results contain no request or descriptor
payload.

The closed code set is:

- `OK`;
- `SESSION_FORGOTTEN`;
- `SESSION_ALREADY_COMPLETED`;
- `WORKSPACE_MISMATCH`;
- `INVALID_PROVIDER_IDENTIFIER`; and
- `PROVIDER_NOT_REGISTERED`.

Lifecycle is checked before inputs; Workspace is checked before Provider
identity and registration; aggregate Workspaces follow the fixed typed order;
Reflection Workspaces follow caller order; complete public structure follows
Workspace checks. All fallible Result and replacement-session construction
completes before a non-throwing commit.

Semantic failures use `ProviderResult`. Allocation, construction, and released
copy exceptions may propagate. Every failure provides the strong guarantee:
the session, descriptors, request, aggregates, Reflections, provenance,
lifecycle observations, and order remain unchanged, and no partial payload or
session stage is published.

Equivalent inputs and histories produce equivalent complete observations,
independent of clocks, locale, addresses, unordered iteration, scheduling,
Runtime state, and Provider implementation choice. Distinct values and engines
support independent concurrent use. Concurrent access to one session while any
access mutates it is not required.

## Architectural boundaries

All handoff values remain inside one Workspace and its Memory Domain. A Provider
implements approved infrastructure but does not define memory meaning,
ownership, order, provenance, lifecycle, validation, errors, Contracts,
Policies, or capability relationships. `MemoryProviderEngine` is a stateless
Service; registration exists only in the caller-owned session.

Runtime may host the Service but owns no Asset and triggers no operation.
Persistence remains a separate Workspace-state boundary: CP-010 adds no mapping,
format, saved scope, registration/session preservation, `save`, or `load` call.

The implementation has no filesystem, stream, database, SQLite, cloud,
networking, endpoint, path, URI, serialization, encoding, compression,
encryption, credential, plugin, discovery, routing, fallback, replication,
synchronization, or Studio behavior. It performs no memory mutation, retrieval,
derivation, classification, consolidation, reflection, reasoning, planning,
execution, or scheduling.

## Example

[`examples/memory_provider_usage.cpp`](../examples/memory_provider_usage.cpp)
constructs all six released aggregates, derives an authentic `Reflection`,
registers and enumerates one descriptor, validates and exports a complete
request, imports the detached request through another session, and forgets both
sessions. Every Result is checked before payload access.

## Requirement coverage

| Requirement | Verification evidence |
| --- | --- |
| CCA-PROVIDERS-001 | Constitutional and MemoryOS architecture scan |
| CCA-PROVIDERS-002 | Detached-handoff and zero-semantic-state architecture checks |
| CCA-PROVIDERS-003 | Exact four-Asset public declaration test |
| CCA-PROVIDERS-004 | Exact Service, six-operation, and C++23 binding test |
| CCA-PROVIDERS-005 | Released-public-only and reverse-dependency scan |
| CCA-PROVIDERS-006 | Descriptor construction, Workspace, identity, copy, and move tests |
| CCA-PROVIDERS-007 | Complete typed request construction and ownership tests |
| CCA-PROVIDERS-008 | Session construction and immutable Workspace tests |
| CCA-PROVIDERS-009 | Exact Open, Exported, Imported, and Forgotten lifecycle tests |
| CCA-PROVIDERS-010 | Complete session observation and accessor-lifetime tests |
| CCA-PROVIDERS-011 | Caller-owned registry and stateless-engine audit |
| CCA-PROVIDERS-012 | Exact transported-state and excluded-session tests |
| CCA-PROVIDERS-013 | Complete aggregate, hidden-history, and Reflection fidelity tests |
| CCA-PROVIDERS-014 | Nested provenance and explanation-chain equality tests |
| CCA-PROVIDERS-015 | Aggregate, duplicate, and Reflection ordering tests |
| CCA-PROVIDERS-016 | Byte-exact identity and no-reconstruction tests |
| CCA-PROVIDERS-017 | Same-Workspace mismatch and no-re-homing tests |
| CCA-PROVIDERS-018 | Architecture audit proving that no observable external Provider path exists |
| CCA-PROVIDERS-019 | No-Provider-semantic-authority architecture audit |
| CCA-PROVIDERS-020 | Registration eligibility, append, and side-effect tests |
| CCA-PROVIDERS-021 | Duplicate idempotence and order-preservation tests |
| CCA-PROVIDERS-022 | Export validation, fidelity, lifecycle, and atomicity tests |
| CCA-PROVIDERS-023 | Import validation, fidelity, lifecycle, and non-installation tests |
| CCA-PROVIDERS-024 | Complete observational validation tests |
| CCA-PROVIDERS-025 | Empty and populated deterministic enumeration tests |
| CCA-PROVIDERS-026 | All-state terminal idempotent forgetting tests |
| CCA-PROVIDERS-027 | External-side-effect and atomicity-boundary audit |
| CCA-PROVIDERS-028 | Closed code, message, success, Workspace, and payload tests |
| CCA-PROVIDERS-029 | Exact success-payload matrix tests |
| CCA-PROVIDERS-030 | Exhaustive overlapping-failure precedence tests |
| CCA-PROVIDERS-031 | Deep-copy, move, ownership, assignment, and lifetime tests |
| CCA-PROVIDERS-032 | Semantic and exhaustive allocation-failure comparisons |
| CCA-PROVIDERS-033 | Complete equivalent-history determinism tests |
| CCA-PROVIDERS-034 | Independent concurrency and const-observation tests |
| CCA-PROVIDERS-035 | Complete source non-interference tests |
| CCA-PROVIDERS-036 | Provider and memory lifecycle-independence tests |
| CCA-PROVIDERS-037 | Runtime dependency and lifecycle-exclusion audit |
| CCA-PROVIDERS-038 | Persistence mapping and scope-exclusion audit |
| CCA-PROVIDERS-039 | Policy and Contract subordination audit |
| CCA-PROVIDERS-040 | Released CP-001 through CP-009 compatibility audit |
| CCA-PROVIDERS-041 | Prohibited semantic dependency and symbol scan |
| CCA-PROVIDERS-042 | Provider-specific infrastructure and Studio exclusion scan |
| CCA-PROVIDERS-043 | This guide and build-checked six-operation example |
| CCA-PROVIDERS-044 | Unit, allocation-failure, architecture, and example inventory |
| CCA-PROVIDERS-045 | Bidirectional traceability and C++23 warnings-as-errors gate |

Conformance requires every row. Partial conformance is not defined.
