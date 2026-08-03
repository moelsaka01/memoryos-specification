#include <cca/memory/long_term_memory.hpp>

#include <iostream>

int main() {
    using cca::memory::LongTermMemory;
    using cca::memory::LongTermMemoryEngine;
    using cca::memory::LongTermMemoryEntry;
    using cca::memory::LongTermMemoryQuery;

    LongTermMemory memory{"example-workspace"};
    LongTermMemoryEngine engine;

    const auto retained = engine.retain(
        memory, LongTermMemoryEntry{"principle", "durable knowledge"});
    const auto stored = engine.store(
        memory, LongTermMemoryEntry{"record", "version one"});
    const auto replaced = engine.store(
        memory, LongTermMemoryEntry{"record", "version two"});
    if (!retained.succeeded() || !stored.succeeded() ||
        !replaced.succeeded()) {
        return 1;
    }

    const auto archived = engine.archive(memory, "principle");
    const auto retrieved = engine.retrieve(memory, "principle");
    const auto searched =
        engine.search(memory, LongTermMemoryQuery{"version"});
    if (!archived.succeeded() || !retrieved.succeeded() ||
        retrieved.entry() == nullptr || !retrieved.entry()->archived() ||
        searched.matches().size() != 1U ||
        searched.matches()[0].identifier() != "record") {
        return 1;
    }

    const auto forgotten = engine.forget(memory, "record");
    LongTermMemory restored{"example-workspace"};
    const auto restoration = engine.restore(restored, memory);
    const auto reuse = engine.retain(
        restored, LongTermMemoryEntry{"record", "version three"});
    if (!forgotten.succeeded() || !restoration.succeeded() ||
        reuse.succeeded() || reuse.code() != "FORGOTTEN_IDENTIFIER") {
        return 1;
    }

    std::cout << restored.entries()[0].identifier() << " is archived\n";
    return restored.size() == 1U && restored.entries()[0].archived() ? 0 : 1;
}
