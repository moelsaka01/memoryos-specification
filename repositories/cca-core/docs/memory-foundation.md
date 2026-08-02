# Memory Foundation

The Memory Foundation provides deterministic storage, retrieval, search, and
forgetting within one Workspace ownership boundary. A `Memory` is constructed
with a non-empty Workspace identifier. That identifier is immutable for the
value's lifetime, including copy and move construction.

`Memory` owns its entries in insertion order. `MemoryEngine` owns no Memory
state and exposes four operations:

- `store` creates an entry or atomically replaces its value. Replacement keeps
  the original insertion position.
- `retrieve` uses an exact, case-sensitive identifier.
- `search` uses case-sensitive substring matching over identifiers and values.
  Matches retain insertion order; an empty query returns all entries.
- `forget` removes an exact identifier and succeeds when it is already absent.

Forgetting an entry removes its insertion position. Storing the same identifier
later creates a new position at the end. Results own their returned values, so
retrieved entries and search matches remain valid after the source Memory is
changed or destroyed.

## Minimal usage

```cpp
#include <cca/memory/memory.hpp>

cca::memory::Memory memory{"workspace-id"};
cca::memory::MemoryEngine engine;

auto stored = engine.store(
    memory, cca::memory::MemoryEntry{"greeting", "hello"});
auto retrieved = engine.retrieve(memory, "greeting");
auto matches = engine.search(memory, cca::memory::MemoryQuery{"hello"});
auto forgotten = engine.forget(memory, "greeting");
```

Successful operations use `OK`. An empty entry identifier is rejected with
`INVALID_IDENTIFIER`, and an absent retrieval reports `NOT_FOUND`. Failed
operations do not partially modify Memory.

## Requirement evidence

| Requirement | Automated evidence |
| --- | --- |
| CCA-MEM-001 | `cca.memory.architecture`; public contract test |
| CCA-MEM-002 | Public declaration contract test |
| CCA-MEM-003 | Public service signature contract test |
| CCA-MEM-004 | Create and atomic replacement test |
| CCA-MEM-005 | Exact retrieval and deterministic absence test |
| CCA-MEM-006 | Identifier/value matching and ordered search test |
| CCA-MEM-007 | Idempotent forget and restorage-order test |
| CCA-MEM-008 | Input, result, instance, and engine isolation test |
| CCA-MEM-009 | Invalid-input and allocation-failure atomicity tests |
| CCA-MEM-010 | Workspace construction, copy, and move test |
| CCA-MEM-011 | Equivalent replacement sequence ordering test |

The architecture check also guards the Foundation boundary against dependencies
on other CCA foundations and against excluded capability leakage.
