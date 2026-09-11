#include <cca/memory/semantic_memory.hpp>

#include <iostream>
#include <vector>

int main() {
    using cca::memory::LongTermMemory;
    using cca::memory::LongTermMemoryEngine;
    using cca::memory::LongTermMemoryEntry;
    using cca::memory::SemanticConcept;
    using cca::memory::SemanticMemory;
    using cca::memory::SemanticMemoryEngine;
    using cca::memory::SemanticQuery;

    LongTermMemory evidence{"example-workspace"};
    LongTermMemoryEngine evidence_engine;
    const auto first_source = evidence_engine.retain(
        evidence,
        LongTermMemoryEntry{"source-language", "A language has a grammar"});
    const auto second_source = evidence_engine.retain(
        evidence,
        LongTermMemoryEntry{"source-system", "A system has components"});
    if (!first_source.succeeded() || !second_source.succeeded() ||
        first_source.entry() == nullptr || second_source.entry() == nullptr) {
        return 1;
    }

    SemanticMemory memory{"example-workspace"};
    SemanticMemoryEngine engine;
    const auto language = engine.classify(
        memory,
        evidence,
        SemanticConcept{
            "concept-language",
            "Language is a structured communication system",
            std::vector<LongTermMemoryEntry>{*first_source.entry()}});
    const auto system = engine.classify(
        memory,
        evidence,
        SemanticConcept{
            "concept-system",
            "A system is an organized collection of components",
            std::vector<LongTermMemoryEntry>{*second_source.entry()}});
    if (!language.succeeded() || !system.succeeded()) {
        return 1;
    }

    const auto categorized =
        engine.categorize(memory, "concept-language", "foundational");
    const auto linked =
        engine.link(memory, "concept-language", "concept-system");
    const auto retrieved = engine.retrieve(memory, "concept-language");
    const auto searched = engine.search(memory, SemanticQuery{"foundational"});
    const auto updated = engine.update(
        memory,
        "concept-language",
        "Language is a rule-governed communication system");
    const auto forgotten = engine.forget(memory, "concept-system");

    if (!categorized.succeeded() || !linked.succeeded() ||
        linked.matches().size() != 2U || !retrieved.succeeded() ||
        retrieved.semanticConcept() == nullptr || !searched.succeeded() ||
        searched.matches().size() != 1U || !updated.succeeded() ||
        updated.semanticConcept() == nullptr || !forgotten.succeeded() ||
        evidence.size() != 2U || memory.size() != 1U) {
        return 1;
    }

    std::cout << updated.semanticConcept()->identifier() << ": "
              << updated.semanticConcept()->meaning() << '\n';
    return 0;
}
