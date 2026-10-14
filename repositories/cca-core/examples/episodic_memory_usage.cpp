#include <cca/memory/episodic_memory.hpp>

#include <iostream>
#include <vector>

int main() {
    using cca::memory::Episode;
    using cca::memory::EpisodeQuery;
    using cca::memory::EpisodicMemory;
    using cca::memory::EpisodicMemoryEngine;
    using cca::memory::LongTermMemory;
    using cca::memory::LongTermMemoryEngine;
    using cca::memory::LongTermMemoryEntry;

    LongTermMemory evidence{"example-workspace"};
    LongTermMemoryEngine evidence_engine;
    const auto deployment_source = evidence_engine.retain(
        evidence,
        LongTermMemoryEntry{"source-deployment",
                            "The production deployment completed"});
    const auto review_source = evidence_engine.retain(
        evidence,
        LongTermMemoryEntry{"source-review",
                            "The release review approved deployment"});
    if (!deployment_source.succeeded() || !review_source.succeeded() ||
        deployment_source.entry() == nullptr ||
        review_source.entry() == nullptr) {
        return 1;
    }

    EpisodicMemory memory{"example-workspace"};
    EpisodicMemoryEngine engine;
    const auto recorded = engine.record(
        memory,
        evidence,
        Episode{"episode-deployment",
                "The team completed the production deployment",
                "Production rollout",
                20,
                std::vector<LongTermMemoryEntry>{
                    *deployment_source.entry()}});
    const auto derived = engine.derive(
        memory,
        evidence,
        Episode{"episode-review",
                "The team approved the release",
                "Release preparation",
                10,
                std::vector<LongTermMemoryEntry>{*review_source.entry()}});
    if (!recorded.succeeded() || recorded.episode() == nullptr ||
        !derived.succeeded() || derived.episode() == nullptr) {
        return 1;
    }

    const auto retrieved = engine.retrieve(memory, "episode-deployment");
    const auto searched =
        engine.search(memory, EpisodeQuery{"production"});
    const auto linked =
        engine.link(memory, "episode-deployment", "episode-review");
    const auto updated = engine.update(
        memory,
        "episode-deployment",
        "The team verified the completed production deployment",
        "Production rollout verification");
    const auto forgotten = engine.forget(memory, "episode-review");

    if (!retrieved.succeeded() || retrieved.episode() == nullptr ||
        !searched.succeeded() || searched.matches().size() != 1U ||
        !linked.succeeded() || linked.matches().size() != 2U ||
        !updated.succeeded() || updated.episode() == nullptr ||
        !forgotten.succeeded() || evidence.size() != 2U ||
        memory.size() != 1U) {
        return 1;
    }

    std::cout << updated.episode()->identifier() << ": "
              << updated.episode()->occurrence() << '\n';
    return 0;
}
