#include <cca/memory/working_memory.hpp>

#include <cstdint>
#include <iostream>
#include <optional>

int main() {
    using cca::memory::WorkingMemory;
    using cca::memory::WorkingMemoryEngine;
    using cca::memory::WorkingMemoryEntry;
    using cca::memory::WorkingMemoryQuery;

    WorkingMemory memory{"example-workspace"};
    WorkingMemoryEngine engine;

    const auto activated = engine.activate(memory, "example-task");
    if (!activated.succeeded()) {
        std::cerr << activated.code() << ": " << activated.message() << '\n';
        return 1;
    }

    const auto stored_first = engine.store(
        memory,
        WorkingMemoryEntry{"first", "temporary phase one",
                           std::optional<std::uint64_t>{5U}});
    const auto stored_second = engine.store(
        memory,
        WorkingMemoryEntry{"second", "temporary phase two",
                           std::optional<std::uint64_t>{10U}});
    const auto stored_kept = engine.store(
        memory, WorkingMemoryEntry{"kept", "retained for the task"});
    if (!stored_first.succeeded() || !stored_second.succeeded() ||
        !stored_kept.succeeded()) {
        return 1;
    }

    const auto retrieved = engine.retrieve(memory, "second");
    if (!retrieved.succeeded() || retrieved.entry() == nullptr ||
        retrieved.entry()->value() != "temporary phase two") {
        return 1;
    }

    const auto searched = engine.search(memory, WorkingMemoryQuery{"phase"});
    if (!searched.succeeded() || searched.matches().size() != 2U ||
        searched.matches()[0].identifier() != "first" ||
        searched.matches()[1].identifier() != "second") {
        return 1;
    }

    const auto expired = engine.expire(memory, 5U);
    if (!expired.succeeded() || expired.matches().size() != 1U ||
        expired.matches()[0].identifier() != "first") {
        return 1;
    }

    const auto forgotten = engine.forget(memory, "kept");
    if (!forgotten.succeeded()) {
        return 1;
    }

    return memory.size() == 1U && memory.entries()[0].identifier() == "second"
               ? 0
               : 1;
}
