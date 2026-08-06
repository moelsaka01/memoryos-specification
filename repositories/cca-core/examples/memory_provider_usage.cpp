#include <cca/memory/memory_provider.hpp>

#include <iostream>
#include <vector>

int main() {
    using namespace cca::memory;

    constexpr auto workspace = "provider-example-workspace";

    Memory memory{workspace};
    MemoryEngine memory_engine;
    const auto stored = memory_engine.store(
        memory, MemoryEntry{"foundation-entry", "Provider handoff example"});

    WorkingMemory working_memory{workspace};
    WorkingMemoryEngine working_engine;
    const auto activated = working_engine.activate(working_memory, "provider-task");
    const auto working_stored = working_engine.store(
        working_memory,
        WorkingMemoryEntry{"working-entry", "Prepare detached handoff"});

    LongTermMemory long_term_memory{workspace};
    LongTermMemoryEngine long_term_engine;
    const auto semantic_source = long_term_engine.retain(
        long_term_memory,
        LongTermMemoryEntry{"source-concept", "Providers preserve Contracts"});
    const auto episodic_source = long_term_engine.retain(
        long_term_memory,
        LongTermMemoryEntry{"source-episode", "A handoff was reviewed"});
    const auto procedural_source = long_term_engine.retain(
        long_term_memory,
        LongTermMemoryEntry{"source-procedure", "Validate before handoff"});
    if (!stored.succeeded() || !activated.succeeded() ||
        !working_stored.succeeded() || !semantic_source.succeeded() ||
        semantic_source.entry() == nullptr || !episodic_source.succeeded() ||
        episodic_source.entry() == nullptr || !procedural_source.succeeded() ||
        procedural_source.entry() == nullptr) {
        return 1;
    }

    SemanticMemory semantic_memory{workspace};
    SemanticMemoryEngine semantic_engine;
    const auto classified = semantic_engine.classify(
        semantic_memory,
        long_term_memory,
        SemanticConcept{
            "concept-provider",
            "A Provider implements approved Contract infrastructure",
            std::vector<LongTermMemoryEntry>{*semantic_source.entry()}});

    EpisodicMemory episodic_memory{workspace};
    EpisodicMemoryEngine episodic_engine;
    const auto recorded = episodic_engine.record(
        episodic_memory,
        long_term_memory,
        Episode{"episode-provider",
                "The Provider handoff was reviewed",
                "provider review",
                10,
                std::vector<LongTermMemoryEntry>{*episodic_source.entry()}});

    ProceduralMemory procedural_memory{workspace};
    ProceduralMemoryEngine procedural_engine;
    const auto procedure_derived = procedural_engine.derive(
        procedural_memory,
        long_term_memory,
        Procedure{
            "procedure-provider",
            "Prepare a Provider handoff",
            {"Validate state", "Export detached state"},
            std::vector<LongTermMemoryEntry>{*procedural_source.entry()}});
    if (!classified.succeeded() || !recorded.succeeded() ||
        !procedure_derived.succeeded()) {
        return 1;
    }

    RetrievalSession retrieval_session{workspace};
    MemoryRetrievalEngine retrieval_engine;
    const auto searched = retrieval_engine.search(
        retrieval_session,
        semantic_memory,
        episodic_memory,
        procedural_memory,
        KnowledgeQuery{"Provider"});
    const auto ranked = retrieval_engine.rank(retrieval_session);
    if (!searched.succeeded() || !ranked.succeeded() ||
        retrieval_session.size() == 0U) {
        return 1;
    }

    ReflectionSession reflection_session{workspace};
    MemoryReflectionEngine reflection_engine;
    const auto prepared = reflection_engine.reflect(
        reflection_session,
        ReflectionQuery{workspace,
                        "provider-example-reflection",
                        "Provider handoff preserves semantic evidence"},
        retrieval_session);
    const auto reflected = reflection_engine.derive(
        reflection_session,
        semantic_memory,
        episodic_memory,
        procedural_memory);
    if (!prepared.succeeded() || !reflected.succeeded() ||
        reflected.reflection() == nullptr) {
        return 1;
    }

    ProviderDescriptor descriptor{workspace, "provider-a"};
    ProviderRequest request{
        workspace,
        "provider-a",
        memory,
        working_memory,
        long_term_memory,
        semantic_memory,
        episodic_memory,
        procedural_memory,
        std::vector<Reflection>{*reflected.reflection()}};

    MemoryProviderEngine provider_engine;
    ProviderSession export_session{workspace};
    const auto registered =
        provider_engine.registerProvider(export_session, descriptor);
    const auto validated = provider_engine.validate(export_session, request);
    const auto enumerated = provider_engine.enumerate(export_session);
    const auto exported = provider_engine.exportState(export_session, request);
    if (!registered.succeeded() || !validated.succeeded() ||
        !enumerated.succeeded() || enumerated.descriptors().size() != 1U ||
        !exported.succeeded() || exported.request() == nullptr) {
        return 1;
    }

    ProviderSession import_session{workspace};
    const auto import_registered =
        provider_engine.registerProvider(import_session, descriptor);
    const auto imported =
        provider_engine.importState(import_session, *exported.request());
    if (!import_registered.succeeded() || !imported.succeeded() ||
        imported.request() == nullptr ||
        imported.request()->reflections().size() != 1U) {
        return 1;
    }

    const auto export_forgotten =
        provider_engine.forgetSession(export_session);
    const auto import_forgotten =
        provider_engine.forgetSession(import_session);
    if (!export_forgotten.succeeded() || !import_forgotten.succeeded() ||
        export_session.state() != ProviderSession::State::Forgotten ||
        import_session.state() != ProviderSession::State::Forgotten ||
        exported.request()->semanticMemory()->size() != 1U ||
        imported.request()->reflections().front().identifier() !=
            reflected.reflection()->identifier()) {
        return 1;
    }

    std::cout << "exported six aggregates and "
              << imported.request()->reflections().size()
              << " authentic Reflection\n";
    return 0;
}
