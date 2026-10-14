# Working Memory

The Working Memory capability provides temporary, task-oriented memory within
the Memory Domain. A `WorkingMemory` belongs to exactly one Workspace and is
constructed with a non-empty Workspace identifier. The identifier is immutable
for the value's lifetime. Construction with an empty identifier throws
`std::invalid_argument`.

`WorkingMemory` owns its active-task state and entries. Copy construction
creates an independent value with the same Workspace identifier, active task,
entries, expiration points, and ordering. Move construction transfers the task
and entries, while the source retains its Workspace identifier and becomes
inactive and empty. Assignment is disabled so an existing value cannot be
rebound to another Workspace.

`WorkingMemoryEngine` owns no Working Memory state and does not access Memory
Foundation or Long-Term Memory state.

## Activation lifecycle

A newly constructed `WorkingMemory` is inactive and empty. Entry operations are
available only after `activate` establishes a non-empty task identifier.

- Activating the current task is idempotent and retains all entries and their
  ordering.
- Activating a different task atomically clears the prior task's entries and
  establishes the new task.
- `store`, `retrieve`, `search`, `expire`, and `forget` return `NOT_ACTIVE`
  without mutation when no task is active. This check precedes entry-identifier
  validation.

Task and entry identifiers are compared exactly and case-sensitively.

## Entries and deterministic ordering

Entries are stored in canonical insertion order:

- `store` appends a new identifier. Replacing an existing identifier updates
  its value and expiration point without changing its position.
- `retrieve` returns an independently owned copy for an exact identifier.
- `search` performs a case-sensitive substring match against identifiers and
  values. An empty query matches every entry, and matches retain insertion
  order.
- `forget` removes an exact identifier and preserves survivor order. Forgetting
  an absent identifier is an idempotent success. Storing that identifier later
  appends a new position.

Equivalent operation sequences over equivalent values produce equivalent
results and ordering.

## Explicit logical expiration

A `WorkingMemoryEntry` may carry an optional caller-supplied
`std::uint64_t` logical expiration point. The point is an ordered value, not a
wall-clock timestamp. Working Memory does not read a clock, retain a current
logical point, or delegate expiration to Runtime or a Provider.

`expire(memory, point)` explicitly removes entries whose expiration point is
less than or equal to `point`. Entries without expiration points and entries
with later points remain. Removed entries are returned by `matches()` in their
former insertion order, and survivor order is preserved.

Retrieval and search never hide or remove entries implicitly. Logical points
need not be monotonic. Repeating expiration against unchanged state at the same
point succeeds with no additional removals.

## Results and errors

Results own the values exposed by `entry()` and `matches()`. Their payloads are
independent of the source `WorkingMemory` and remain valid until the result is
destroyed or move-assigned.

| Code | Meaning |
| --- | --- |
| `OK` | The operation completed successfully. |
| `INVALID_TASK_IDENTIFIER` | `activate` received an empty task identifier. |
| `NOT_ACTIVE` | An entry operation was attempted before activation. |
| `INVALID_IDENTIFIER` | `store`, `retrieve`, or `forget` received an empty entry identifier. |
| `NOT_FOUND` | `retrieve` found no exact identifier. |

`succeeded()` is true exactly for `OK`. Successful results have an empty
message. Failed results have a stable, non-empty message, a null `entry()`, and
an empty `matches()` sequence. Mutating operations provide the strong failure
guarantee: semantic errors and propagated allocation or value-construction
failures leave Workspace ownership, activation, entries, expiration points, and
ordering unchanged.

## Usage

```cpp
#include <cca/memory/working_memory.hpp>

#include <cstdint>
#include <optional>

cca::memory::WorkingMemory memory{"workspace-id"};
cca::memory::WorkingMemoryEngine engine;

auto activated = engine.activate(memory, "task-id");
auto stored = engine.store(
    memory,
    cca::memory::WorkingMemoryEntry{
        "draft", "temporary value",
        std::optional<std::uint64_t>{10U}});
auto retrieved = engine.retrieve(memory, "draft");
auto matches =
    engine.search(memory, cca::memory::WorkingMemoryQuery{"temporary"});
auto expired = engine.expire(memory, 10U);
auto forgotten = engine.forget(memory, "draft");
```

The complete executable example is `examples/working_memory_usage.cpp`.

## Requirement and conformance summary

| Requirement | Conformance evidence |
| --- | --- |
| CCA-WMEM-001 | Constitutional and frozen Memory Foundation boundary checks |
| CCA-WMEM-002 | Public asset declaration contract checks |
| CCA-WMEM-003 | `WorkingMemoryEngine` operation signature checks |
| CCA-WMEM-004 | Non-empty, immutable Workspace ownership and copy/move checks |
| CCA-WMEM-005 | Memory Domain and cross-instance isolation checks |
| CCA-WMEM-006 | Initial state and first activation checks |
| CCA-WMEM-007 | Same-task idempotence and atomic task-switch checks |
| CCA-WMEM-008 | Inactive operation and error-precedence checks |
| CCA-WMEM-009 | Append, atomic replacement, and position-preservation checks |
| CCA-WMEM-010 | Exact retrieval and deterministic absence checks |
| CCA-WMEM-011 | Identifier/value matching, empty-query, and ordered-result checks |
| CCA-WMEM-012 | Idempotent forget and survivor-order checks |
| CCA-WMEM-013 | Optional and inclusive expiration with ordered removed results |
| CCA-WMEM-014 | Explicit-only, clock-independent, idempotent expiration checks |
| CCA-WMEM-015 | Equivalent-sequence and canonical-order checks |
| CCA-WMEM-016 | Input, result, instance, and engine isolation checks |
| CCA-WMEM-017 | Semantic and allocation-failure atomicity checks |
| CCA-WMEM-018 | Memory Foundation and Long-Term Memory isolation checks |
| CCA-WMEM-019 | Excluded-capability dependency checks |

A conforming implementation covers every mandatory requirement with automated
tests, builds with warnings treated as errors, and introduces no dependency on
excluded capabilities.
