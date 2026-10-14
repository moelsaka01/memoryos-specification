#include <cca/memory/memory_reflection.hpp>

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
    using cca::memory::MemoryReflectionEngine;
    using cca::memory::MemoryRetrievalEngine;
    using cca::memory::Procedure;
    using cca::memory::ProceduralMemory;
    using cca::memory::ProceduralMemoryEngine;
    using cca::memory::ReflectionQuery;
    using cca::memory::ReflectionSession;
    using cca::memory::RetrievalSession;
    using cca::memory::SemanticConcept;
    using cca::memory::SemanticMemory;
    using cca::memory::SemanticMemoryEngine;

    constexpr auto workspace = "reflection-example-workspace";

    LongTermMemory evidence{workspace};
    LongTermMemoryEngine evidence_engine;
    const auto semantic_source = evidence_engine.retain(
        evidence,
        LongTermMemoryEntry{"evidence-policy", "Approval is required"});
    const auto episodic_source = evidence_engine.retain(
        evidence,
        LongTermMemoryEntry{"evidence-review", "The review approved release"});
    const auto procedural_source = evidence_engine.retain(
        evidence,
        LongTermMemoryEntry{"evidence-publish", "Publication follows review"});
    if (!semantic_source.succeeded() || semantic_source.entry() == nullptr ||
        !episodic_source.succeeded() || episodic_source.entry() == nullptr ||
        !procedural_source.succeeded() ||
        procedural_source.entry() == nullptr) {
        return 1;
    }

    SemanticMemory semantic_memory{workspace};
    SemanticMemoryEngine semantic_engine;
    const auto classified = semantic_engine.classify(
        semantic_memory,
        evidence,
        SemanticConcept{
            "concept-release",
            "A release is an approved product version",
            std::vector<LongTermMemoryEntry>{*semantic_source.entry()}});

    EpisodicMemory episodic_memory{workspace};
    EpisodicMemoryEngine episodic_engine;
    const auto recorded = episodic_engine.record(
        episodic_memory,
        evidence,
        Episode{"episode-release",
                "The release review completed",
                "release approval",
                10,
                std::vector<LongTermMemoryEntry>{*episodic_source.entry()}});

    ProceduralMemory procedural_memory{workspace};
    ProceduralMemoryEngine procedural_engine;
    const auto procedure_derived = procedural_engine.derive(
        procedural_memory,
        evidence,
        Procedure{
            "procedure-release",
            "Publish a release",
            {"Verify approval", "Publish release"},
            std::vector<LongTermMemoryEntry>{*procedural_source.entry()}});
    if (!classified.succeeded() || !recorded.succeeded() ||
        !procedure_derived.succeeded()) {
        return 1;
    }

    // CCA-KR-1.0 prepares deterministic detached evidence. The session does
    // not keep any source in Retrieved accessibility after search returns.
    RetrievalSession retrieval_session{workspace};
    MemoryRetrievalEngine retrieval_engine;
    const auto searched = retrieval_engine.search(
        retrieval_session,
        semantic_memory,
        episodic_memory,
        procedural_memory,
        KnowledgeQuery{"release"});
    const auto ranked = retrieval_engine.rank(retrieval_session);
    if (!searched.succeeded() || !ranked.succeeded() ||
        retrieval_session.size() != 3U) {
        return 1;
    }

    MemoryReflectionEngine reflection_engine;
    ReflectionSession reflection_session{workspace};
    ReflectionQuery query{
        workspace,
        "reflection-release-readiness",
        "Approval, review, and publication evidence support release readiness"};

    const auto prepared = reflection_engine.reflect(
        reflection_session, query, retrieval_session);
    if (!prepared.succeeded() || prepared.reflection() != nullptr ||
        reflection_session.state() != ReflectionSession::State::Prepared ||
        reflection_session.size() != 3U) {
        return 1;
    }

    // derive revalidates every source through its matching released category
    // Service. It retains those returned accesses through complete target
    // staging, then releases them without modifying any source aggregate.
    const auto derived = reflection_engine.derive(
        reflection_session,
        semantic_memory,
        episodic_memory,
        procedural_memory);
    if (!derived.succeeded() || derived.reflection() == nullptr ||
        reflection_session.state() != ReflectionSession::State::Derived ||
        derived.reflection()->identifier() !=
            "reflection-release-readiness" ||
        derived.reflection()->sourceCandidates().size() != 3U ||
        derived.reflection()->sourceExplanationChains().size() != 3U ||
        semantic_memory.size() != 1U || episodic_memory.size() != 1U ||
        procedural_memory.size() != 1U) {
        return 1;
    }

    const auto explained = reflection_engine.explain(
        reflection_session,
        KnowledgeCandidate::Kind::Semantic,
        "concept-release");
    const auto validated = reflection_engine.validate(reflection_session);
    const auto retrieved =
        reflection_engine.retrieveSession(reflection_session);
    if (!explained.succeeded() || explained.candidate() == nullptr ||
        explained.explanationChain().empty() || !validated.succeeded() ||
        !retrieved.succeeded() || retrieved.session() == nullptr ||
        retrieved.session()->reflection() == nullptr) {
        return 1;
    }

    // The retrieved session and derive Result own independent Reflection
    // values. Forgetting operational session evidence changes neither value.
    const auto forgotten =
        reflection_engine.forgetSession(reflection_session);
    if (!forgotten.succeeded() ||
        reflection_session.state() != ReflectionSession::State::Forgotten ||
        reflection_session.query() != nullptr ||
        reflection_session.reflection() != nullptr ||
        reflection_session.size() != 0U ||
        retrieved.session()->state() != ReflectionSession::State::Derived ||
        derived.reflection()->knowledge() != query.knowledge()) {
        return 1;
    }

    std::cout << derived.reflection()->identifier() << " preserves "
              << derived.reflection()->sourceCandidates().size()
              << " ordered sources\n";
    return 0;
}
