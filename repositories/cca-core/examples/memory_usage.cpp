#include <cca/memory/memory.hpp>

#include <iostream>

int main() {
    cca::memory::Memory memory{"example-workspace"};
    cca::memory::MemoryEngine engine;

    auto stored = engine.store(
        memory,
        cca::memory::MemoryEntry{"welcome", "Memory Foundation example"});
    if (!stored.succeeded()) {
        std::cerr << stored.code() << ": " << stored.message() << '\n';
        return 1;
    }

    auto retrieved = engine.retrieve(memory, "welcome");
    if (!retrieved.succeeded() || retrieved.entry() == nullptr) {
        std::cerr << retrieved.code() << ": " << retrieved.message() << '\n';
        return 1;
    }

    const auto matches =
        engine.search(memory, cca::memory::MemoryQuery{"example"});
    if (!matches.succeeded() || matches.matches().size() != 1U) {
        return 1;
    }

    const auto forgotten = engine.forget(memory, "welcome");
    return forgotten.succeeded() && memory.size() == 0U ? 0 : 1;
}
