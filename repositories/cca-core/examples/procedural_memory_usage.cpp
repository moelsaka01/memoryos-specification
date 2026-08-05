#include <cca/memory/procedural_memory.hpp>

#include <iostream>
#include <vector>

int main() {
    using cca::memory::LongTermMemory;
    using cca::memory::LongTermMemoryEngine;
    using cca::memory::LongTermMemoryEntry;
    using cca::memory::Procedure;
    using cca::memory::ProceduralMemory;
    using cca::memory::ProceduralMemoryEngine;
    using cca::memory::ProcedureQuery;

    LongTermMemory evidence{"example-workspace"};
    LongTermMemoryEngine evidence_engine;
    const auto review_source = evidence_engine.retain(
        evidence,
        LongTermMemoryEntry{"source-review", "Review the release package"});
    const auto verification_source = evidence_engine.retain(
        evidence,
        LongTermMemoryEntry{"source-verification", "Verify the release outputs"});
    const auto publication_source = evidence_engine.retain(
        evidence,
        LongTermMemoryEntry{"source-publication", "Publish the verified package"});
    if (!review_source.succeeded() || review_source.entry() == nullptr ||
        !verification_source.succeeded() || verification_source.entry() == nullptr ||
        !publication_source.succeeded() || publication_source.entry() == nullptr) {
        return 1;
    }

    ProceduralMemory memory{"example-workspace"};
    ProceduralMemoryEngine engine;
    const auto derived = engine.derive(
        memory,
        evidence,
        Procedure{"procedure-review",
                  "Review a release",
                  {"Open the release package", "Inspect the declared outputs"},
                  std::vector<LongTermMemoryEntry>{*review_source.entry()}});
    const auto composed = engine.compose(
        memory,
        evidence,
        Procedure{"procedure-publish",
                  "Publish a verified release",
                  {"Verify the release outputs", "Publish the verified package"},
                  std::vector<LongTermMemoryEntry>{
                      *verification_source.entry(), *publication_source.entry()}});
    if (!derived.succeeded() || derived.procedure() == nullptr ||
        !composed.succeeded() || composed.procedure() == nullptr) {
        return 1;
    }

    const auto retrieved = engine.retrieve(memory, "procedure-review");
    const auto searched = engine.search(memory, ProcedureQuery{"Publish"});
    const auto linked =
        engine.link(memory, "procedure-review", "procedure-publish");
    const auto updated = engine.update(
        memory,
        "procedure-review",
        "Review and approve a release",
        {"Open the release package", "Inspect the outputs", "Record the approval"});
    const auto forgotten = engine.forget(memory, "procedure-publish");

    if (!retrieved.succeeded() || retrieved.procedure() == nullptr ||
        !searched.succeeded() || searched.matches().size() != 1U ||
        !linked.succeeded() || linked.matches().size() != 2U ||
        !updated.succeeded() || updated.procedure() == nullptr ||
        !forgotten.succeeded() || evidence.size() != 3U || memory.size() != 1U ||
        memory.find("procedure-review") == nullptr ||
        !memory.find("procedure-review")->linkedProcedureIdentifiers().empty()) {
        return 1;
    }

    std::cout << updated.procedure()->identifier() << ": "
              << updated.procedure()->activity() << '\n';
    return 0;
}
