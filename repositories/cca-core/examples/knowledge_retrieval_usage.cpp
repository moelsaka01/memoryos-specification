#include <cca/memory/knowledge_retrieval.hpp>

#include <iostream>
#include <vector>

int main() {
    using cca::memory::Episode;
    using cca::memory::EpisodicMemory;
    using cca::memory::EpisodicMemoryEngine;
    using cca::memory::KnowledgeCandidate;
    using cca::memory::KnowledgeQuery;
    using cca::memory::LongTermMemory;
    using cca::memory::LongTermMemoryEngine;
    using cca::memory::LongTermMemoryEntry;
    using cca::memory::MemoryRetrievalEngine;
    using cca::memory::Procedure;
    using cca::memory::ProceduralMemory;
    using cca::memory::ProceduralMemoryEngine;
    using cca::memory::RetrievalSession;
    using cca::memory::SemanticConcept;
    using cca::memory::SemanticMemory;
    using cca::memory::SemanticMemoryEngine;

    LongTermMemory evidence{"example-workspace"};
    LongTermMemoryEngine evidence_engine;
    const auto semantic_source = evidence_engine.retain(
        evidence,
        LongTermMemoryEntry{"source-concept", "A release has an approval"});
    const auto episodic_source = evidence_engine.retain(
        evidence,
        LongTermMemoryEntry{"source-episode", "The release was approved"});
    const auto procedural_source = evidence_engine.retain(
        evidence,
        LongTermMemoryEntry{"source-procedure", "A release can be published"});
    if (!semantic_source.succeeded() || semantic_source.entry() == nullptr ||
        !episodic_source.succeeded() || episodic_source.entry() == nullptr ||
        !procedural_source.succeeded() || procedural_source.entry() == nullptr) {
        return 1;
    }

    SemanticMemory semantic_memory{"example-workspace"};
    SemanticMemoryEngine semantic_engine;
    const auto classified = semantic_engine.classify(
        semantic_memory,
        evidence,
        SemanticConcept{
            "concept-release",
            "A release is an approved product version",
            std::vector<LongTermMemoryEntry>{*semantic_source.entry()}});

    EpisodicMemory episodic_memory{"example-workspace"};
    EpisodicMemoryEngine episodic_engine;
    const auto recorded = episodic_engine.record(
        episodic_memory,
        evidence,
        Episode{"episode-release",
                "The release was approved",
                "release review",
                10,
                std::vector<LongTermMemoryEntry>{*episodic_source.entry()}});

    ProceduralMemory procedural_memory{"example-workspace"};
    ProceduralMemoryEngine procedural_engine;
    const auto derived = procedural_engine.derive(
        procedural_memory,
        evidence,
        Procedure{"procedure-release",
                  "Publish a release",
                  {"Verify the release", "Publish the release"},
                  std::vector<LongTermMemoryEntry>{*procedural_source.entry()}});
    if (!classified.succeeded() || !recorded.succeeded() ||
        !derived.succeeded()) {
        return 1;
    }

    MemoryRetrievalEngine engine;
    RetrievalSession exact_session{"example-workspace"};
    const auto exact = engine.retrieve(
        exact_session,
        semantic_memory,
        episodic_memory,
        procedural_memory,
        KnowledgeCandidate::Kind::Semantic,
        "concept-release");

    RetrievalSession search_session{"example-workspace"};
    const auto searched = engine.search(
        search_session,
        semantic_memory,
        episodic_memory,
        procedural_memory,
        KnowledgeQuery{"release"});
    const auto filtered = engine.filter(search_session, KnowledgeQuery{"release"});
    const auto ranked = engine.rank(search_session);
    const auto explained = engine.explain(
        search_session,
        KnowledgeCandidate::Kind::Semantic,
        "concept-release");
    const auto forgotten = engine.forgetSession(search_session);

    if (!exact.succeeded() || exact.candidate() == nullptr ||
        !searched.succeeded() || searched.candidates().size() != 3U ||
        !filtered.succeeded() || filtered.candidates().size() != 3U ||
        !ranked.succeeded() || ranked.candidates().size() != 3U ||
        !explained.succeeded() || explained.candidate() == nullptr ||
        explained.explanationChain().size() != 4U || !forgotten.succeeded() ||
        !search_session.forgotten() || semantic_memory.size() != 1U ||
        episodic_memory.size() != 1U || procedural_memory.size() != 1U) {
        return 1;
    }

    std::cout << ranked.candidates().size() << " deterministic candidates\n";
    return 0;
}
