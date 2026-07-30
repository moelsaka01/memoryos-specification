# Process Foundation

This guide documents the IM-005 implementation of CCA-PROC-1.0. The frozen
specification package remains the normative authority; this document explains
how to use the implementation.

## Architecture

Process is a Layer 4 Domain Engine. It consumes the public Representation
Foundation API and is hosted by the Runtime Foundation without becoming a
Runtime component. Runtime code does not depend upward on Process.

CCA-PROC-1.0 implements deterministic structural visitation. It does not
interpret Representation types, property names, values, relationship
direction, or metadata as actions or control flow. Execution has no external
side effects.

The implementation is split into:

- `cca::process`, the Process library and public API;
- the passive `cca::representation` input dependency; and
- a private Runtime contract and Provider adapter used only by composition
  roots.

## Public API

Include the complete API with:

```cpp
#include <cca/process/process.hpp>
```

The five public concepts are:

| Concept | Responsibility |
|---|---|
| `ProcessDefinition` | Owns the immutable identifier plan and source counts |
| `ExecutionContext` | Owns one definition, one execution state, and one trace |
| `ExecutionState` | Defines `Ready`, `Running`, `Completed`, and `Failed` |
| `ExecutionResult` | Owns one terminal result, message, trace, and diagnostics |
| `ProcessEngine` | Performs synchronous validation, materialization, and execution |

`ProcessEngine` is the only public Process service.

## Direct execution

The minimal public example is:

```cpp
using cca::process::ExecutionResult;
using cca::process::ProcessEngine;
using cca::representation::RepresentationDocument;

RepresentationDocument model;
ProcessEngine engine;
ExecutionResult result = engine.execute(model);
```

An empty valid document completes successfully with an empty trace.

For a non-empty document, `ProcessDefinition` copies identifiers in this exact
order:

1. entities in document insertion order;
2. each entity's properties immediately after that entity;
3. relationships in document insertion order after all entities; and
4. each relationship's properties immediately after that relationship.

The document root, metadata, and relationship endpoint references do not add
trace entries.

## Validation and Representation lifecycle

Direct document execution and `ProcessDefinition` construction use
`cca::representation::ValidationService`. Validation is read-only.

Valid Mutable, internally Validated, and Frozen documents are accepted without
changing their lifecycle. Process never freezes a document and never starts,
commits, or rolls back a Representation transaction.

`ProcessDefinition` retains no document reference. Once materialized, its plan
is unaffected by source mutation, transaction rollback, or source destruction.
A valid state observed during an active transaction may therefore be
materialized safely under the caller's synchronization.

## Execution lifecycle

Constructing an `ExecutionContext` establishes:

```text
state = Ready
trace = empty
```

Successful execution performs:

```text
Ready -> Running -> Completed
```

The completed context trace and returned result trace both equal
`ProcessDefinition::executionOrder()`.

Contexts are one-shot. Passing a Running, Completed, or Failed context to
`ProcessEngine::execute(context)` throws `std::logic_error` before mutation.

## Result and error behavior

| Condition | State | Code or exception |
|---|---|---|
| Valid execution | `Completed` | `ExecutionResult::Code::Success` |
| Invalid direct document | `Failed` | `ExecutionResult::Code::InvalidRepresentation` |
| Invalid definition construction | No object | `std::invalid_argument` |
| Non-Ready context execution | Context unchanged | `std::logic_error` |
| Allocation failure | Caller-owned state unchanged | Standard allocation exception |

Successful results have an empty message and diagnostics. Invalid direct input
has a deterministic non-empty message, an empty trace, and an owned copy of
the complete ordered Representation diagnostics.

Definition construction and all execute overloads provide the strong exception
guarantee.

## Ownership and lifetime

- The caller owns every source `RepresentationDocument`.
- `ProcessDefinition` owns copied identifiers and counts.
- `ExecutionContext` exclusively owns its definition value, state, and trace.
- `ExecutionResult` owns its message, trace, and diagnostics.
- `ProcessEngine` contains no per-execution mutable state.

Accessor references and views remain valid until the supplying object is
assigned, mutated where permitted, moved from, or destroyed. Executing a
context may invalidate trace element references and iterators, but not a
reference to the trace collection object.

## Runtime-hosted execution

The private composition adapter registers:

```cpp
cca::runtime::ServiceContract<
    cca::process::ProcessEngine,
    cca::runtime::ServiceCardinality::exactly_one>
```

with exactly one internal Provider. The Provider participates in normal
Runtime validation, freeze, startup, reverse-order shutdown, failure, and
rollback behavior.

Composition roots in this repository call the private
`cca::process::detail::add_process_runtime_integration(builder)` seam before
building the Runtime. Provider types and that composition seam are not part of
the installed Process API.

After successful Runtime startup, hosted code resolves the contract and calls
the same public service:

```cpp
using ProcessContract = cca::runtime::ServiceContract<
    cca::process::ProcessEngine,
    cca::runtime::ServiceCardinality::exactly_one>;

auto& engine =
    runtime.service_registry().resolve<ProcessContract>();
auto result = engine.execute(model);
```

The call must occur while the owning Runtime is Running. A resolved reference
is Provider-owned and must not outlive its Provider or Runtime. Invalid Process
input returns `ExecutionResult` without failing the Runtime; Provider start or
stop failure remains a Runtime lifecycle failure.

## Thread safety

Supported concurrent operations are:

- const access to completed definitions and results; and
- calls on one stateless engine when contexts are distinct and document access
  follows the Representation synchronization contract.

Concurrent access to one context requires external synchronization. All access
to a shared `RepresentationDocument` also requires the external
synchronization prescribed by CCA-REP-1.0.

## Examples and conformance

- [Direct execution example](../examples/process_usage.cpp)
- [Runtime-hosted example](../examples/process_runtime_usage.cpp)
- [Requirement evidence](process-conformance-evidence.md)

The Process implementation intentionally contains no scheduling, persistence,
serialization, networking, distributed execution, BPMN, workflow-engine,
MemoryOS, Studio, AI, plugin, callback, cancellation, retry, timeout, or code
generation behavior.
