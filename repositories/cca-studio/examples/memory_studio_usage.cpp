#include <cca/memory/memory_studio.hpp>

#include <iostream>
#include <string_view>
#include <vector>

namespace {

template <typename Result>
bool require_success(const Result& result, const std::string_view operation) {
    if (result.succeeded()) {
        return true;
    }

    std::cerr << operation << " failed: " << result.code() << ": "
              << result.message() << '\n';
    return false;
}

} // namespace

int main() {
    using namespace cca::memory;

    constexpr auto workspace = "memory-studio-example-workspace";

    // The caller constructs and owns every released value. Studio receives a
    // detached coherent cut; it does not discover or refresh these sources.
    Memory memory{workspace};
    const auto stored = MemoryEngine{}.store(
        memory, MemoryEntry{"foundation-note", "A detached Studio example"});
    if (!require_success(stored, "MemoryEngine::store")) {
        return 1;
    }

    WorkingMemory working_memory{workspace};
    const auto activated =
        WorkingMemoryEngine{}.activate(working_memory, "studio-example-task");
    const auto working_stored = WorkingMemoryEngine{}.store(
        working_memory,
        WorkingMemoryEntry{"working-note", "Prepare the observation"});
    if (!require_success(activated, "WorkingMemoryEngine::activate") ||
        !require_success(working_stored, "WorkingMemoryEngine::store")) {
        return 1;
    }

    LongTermMemory long_term_memory{workspace};
    const auto semantic_evidence = LongTermMemoryEngine{}.retain(
        long_term_memory,
        LongTermMemoryEntry{"evidence-concept", "A view is a detached value"});
    const auto episodic_evidence = LongTermMemoryEngine{}.retain(
        long_term_memory,
        LongTermMemoryEntry{"evidence-episode", "The view was reviewed"});
    const auto procedural_evidence = LongTermMemoryEngine{}.retain(
        long_term_memory,
        LongTermMemoryEntry{"evidence-procedure", "Review before presentation"});
    if (!require_success(semantic_evidence, "LongTermMemoryEngine::retain") ||
        !require_success(episodic_evidence, "LongTermMemoryEngine::retain") ||
        !require_success(procedural_evidence,
                         "LongTermMemoryEngine::retain")) {
        return 1;
    }

    const auto* const semantic_source =
        long_term_memory.find("evidence-concept");
    const auto* const episodic_source =
        long_term_memory.find("evidence-episode");
    const auto* const procedural_source =
        long_term_memory.find("evidence-procedure");
    if (semantic_source == nullptr || episodic_source == nullptr ||
        procedural_source == nullptr) {
        return 1;
    }

    SemanticMemory semantic_memory{workspace};
    const auto classified = SemanticMemoryEngine{}.classify(
        semantic_memory,
        long_term_memory,
        SemanticConcept{"concept-studio",
                        "Studio presents caller-supplied detached values",
                        std::vector<LongTermMemoryEntry>{*semantic_source}});

    EpisodicMemory episodic_memory{workspace};
    const auto recorded = EpisodicMemoryEngine{}.record(
        episodic_memory,
        long_term_memory,
        Episode{"episode-studio",
                "The detached observation was reviewed",
                "Memory Studio example",
                1,
                std::vector<LongTermMemoryEntry>{*episodic_source}});

    ProceduralMemory procedural_memory{workspace};
    const auto derived = ProceduralMemoryEngine{}.derive(
        procedural_memory,
        long_term_memory,
        Procedure{"procedure-studio",
                  "Present a detached observation",
                  {"Construct released values", "Construct StudioView",
                   "Invoke an explicit Studio operation"},
                  std::vector<LongTermMemoryEntry>{*procedural_source}});
    if (!require_success(classified, "SemanticMemoryEngine::classify") ||
        !require_success(recorded, "EpisodicMemoryEngine::record") ||
        !require_success(derived, "ProceduralMemoryEngine::derive")) {
        return 1;
    }

    // This authentic CP-007 session contains the explanation chain that
    // MemoryStudioEngine::trace later projects without changing it.
    RetrievalSession retrieval_session{workspace};
    const auto retrieved = MemoryRetrievalEngine{}.retrieve(
        retrieval_session,
        semantic_memory,
        episodic_memory,
        procedural_memory,
        KnowledgeCandidate::Kind::Semantic,
        "concept-studio");
    if (!require_success(retrieved, "MemoryRetrievalEngine::retrieve") ||
        retrieved.candidate() == nullptr) {
        return 1;
    }

    // An Open released ProviderSession is observable state. No Provider
    // implementation or Provider operation is needed by this example.
    ProviderSession provider_session{workspace};

    StudioView view{
        workspace,
        memory,
        working_memory,
        long_term_memory,
        semantic_memory,
        episodic_memory,
        procedural_memory,
        std::vector<RetrievalSession>{retrieval_session},
        {},
        {},
        {},
        std::vector<ProviderSession>{provider_session}};

    MemoryStudioEngine studio;
    StudioSession session{workspace};

    const auto observed = studio.observe(session, view);
    if (!require_success(observed, "MemoryStudioEngine::observe") ||
        observed.view() == nullptr) {
        return 1;
    }

    const StudioQuery retrieval_query{
        workspace, StudioQuery::Scope::Retrieval, "concept-studio"};
    const auto inspected = studio.inspect(session, retrieval_query);
    if (!require_success(inspected, "MemoryStudioEngine::inspect") ||
        inspected.view() == nullptr || inspected.observations().empty()) {
        return 1;
    }

    const auto traced = studio.trace(session, retrieval_query);
    if (!require_success(traced, "MemoryStudioEngine::trace") ||
        traced.explanationChains().empty()) {
        return 1;
    }

    const StudioQuery complete_query{workspace};
    const auto summarized = studio.summarize(session, complete_query);
    if (!require_success(summarized, "MemoryStudioEngine::summarize") ||
        summarized.observations().empty()) {
        return 1;
    }

    const auto exported = studio.exportView(session);
    if (!require_success(exported, "MemoryStudioEngine::exportView") ||
        exported.view() == nullptr) {
        return 1;
    }

    const auto forgotten = studio.forgetSession(session);
    if (!require_success(forgotten, "MemoryStudioEngine::forgetSession") ||
        session.state() != StudioSession::State::Forgotten ||
        session.view() != nullptr ||
        provider_session.state() != ProviderSession::State::Open) {
        return 1;
    }

    std::cout << "inspect paths: " << inspected.observations().size() << '\n'
              << "trace chains: " << traced.explanationChains().size() << '\n'
              << "summary lines: " << summarized.observations().size()
              << '\n';
    return 0;
}
