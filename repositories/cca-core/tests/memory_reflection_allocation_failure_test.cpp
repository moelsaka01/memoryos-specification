#include <cca/memory/memory_reflection.hpp>

#include <gtest/gtest.h>

#include <cstddef>
#include <cstdint>
#include <cstdlib>
#include <limits>
#include <new>
#include <optional>
#include <stdexcept>
#include <string>
#include <string_view>
#include <utility>
#include <vector>

// CCA-REFLECT-014, CCA-REFLECT-015, CCA-REFLECT-020 through
// CCA-REFLECT-025, CCA-REFLECT-028, CCA-REFLECT-029, CCA-REFLECT-032,
// CCA-REFLECT-034 through CCA-REFLECT-037, and CCA-REFLECT-045:
// exhaustively inject ordinary allocation failures into all six public
// operations and compare complete sessions, Retrieval Sessions, typed source
// aggregates, provenance, explanation chains, and prior detached values.

namespace memory_reflection_allocation_failure_support {

constexpr auto disabled = std::numeric_limits<std::size_t>::max();
thread_local std::size_t allocations_before_failure = disabled;

void fail_after(const std::size_t successful_allocations) noexcept {
    allocations_before_failure = successful_allocations;
}

void disable() noexcept { allocations_before_failure = disabled; }

[[nodiscard]] bool should_fail() noexcept {
    if (allocations_before_failure == disabled) {
        return false;
    }
    if (allocations_before_failure == 0U) {
        disable();
        return true;
    }
    --allocations_before_failure;
    return false;
}

[[nodiscard]] void* allocate(const std::size_t requested_size) {
    if (should_fail()) {
        throw std::bad_alloc{};
    }
    const auto size = requested_size == 0U ? 1U : requested_size;
    if (auto* allocation = std::malloc(size); allocation != nullptr) {
        return allocation;
    }
    throw std::bad_alloc{};
}

} // namespace memory_reflection_allocation_failure_support

void* operator new(const std::size_t size) {
    return memory_reflection_allocation_failure_support::allocate(size);
}

void* operator new[](const std::size_t size) {
    return memory_reflection_allocation_failure_support::allocate(size);
}

void operator delete(void* allocation) noexcept { std::free(allocation); }
void operator delete[](void* allocation) noexcept { std::free(allocation); }

void operator delete(void* allocation, const std::size_t size) noexcept {
    static_cast<void>(size);
    std::free(allocation);
}

void operator delete[](void* allocation, const std::size_t size) noexcept {
    static_cast<void>(size);
    std::free(allocation);
}

namespace {

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
using cca::memory::Reflection;
using cca::memory::ReflectionQuery;
using cca::memory::ReflectionResult;
using cca::memory::ReflectionSession;
using cca::memory::RetrievalSession;
using cca::memory::SemanticConcept;
using cca::memory::SemanticMemory;
using cca::memory::SemanticMemoryEngine;

using Kind = KnowledgeCandidate::Kind;
using State = ReflectionSession::State;

const std::string workspace =
    "reflection-allocation-workspace-with-a-long-identifier";
const std::string target =
    "reflection-allocation-target-with-a-long-identifier";
const std::string knowledge =
    "reflection-allocation-explicit-knowledge-with-enough-content-to-allocate";
const std::string semantic_identifier =
    "reflection-allocation-semantic-source-with-a-long-identifier";
const std::string episode_identifier =
    "reflection-allocation-episodic-source-with-a-long-identifier";
const std::string procedure_identifier =
    "reflection-allocation-procedural-source-with-a-long-identifier";

struct EntrySnapshot final {
    std::string identifier;
    std::string value;
    bool archived;
    bool operator==(const EntrySnapshot&) const = default;
};

struct SemanticSnapshot final {
    std::string identifier;
    std::string meaning;
    std::vector<EntrySnapshot> sources;
    std::vector<std::string> categories;
    std::vector<std::string> links;
    bool operator==(const SemanticSnapshot&) const = default;
};

struct EpisodeSnapshot final {
    std::string identifier;
    std::string occurrence;
    std::string context;
    std::int64_t chronology;
    std::vector<EntrySnapshot> sources;
    std::vector<std::string> links;
    bool operator==(const EpisodeSnapshot&) const = default;
};

struct ProcedureSnapshot final {
    std::string identifier;
    std::string activity;
    std::vector<std::string> steps;
    std::vector<EntrySnapshot> sources;
    std::vector<std::string> links;
    bool operator==(const ProcedureSnapshot&) const = default;
};

struct CandidateSnapshot final {
    Kind kind;
    std::string workspace_identifier;
    std::string source_identifier;
    std::uint32_t rank_score;
    std::optional<SemanticSnapshot> semantic;
    std::optional<EpisodeSnapshot> episode;
    std::optional<ProcedureSnapshot> procedure;
    bool operator==(const CandidateSnapshot&) const = default;
};

struct ReflectionSnapshot final {
    std::string workspace_identifier;
    std::string identifier;
    std::string knowledge;
    std::vector<CandidateSnapshot> candidates;
    std::vector<std::vector<std::string>> chains;
    bool operator==(const ReflectionSnapshot&) const = default;
};

struct SessionSnapshot final {
    std::string workspace_identifier;
    State state;
    std::optional<std::vector<std::string>> query;
    std::vector<CandidateSnapshot> candidates;
    std::vector<std::vector<std::string>> chains;
    std::optional<ReflectionSnapshot> reflection;
    bool operator==(const SessionSnapshot&) const = default;
};

struct RetrievalSnapshot final {
    std::string workspace_identifier;
    bool started;
    bool forgotten;
    std::vector<CandidateSnapshot> candidates;
    std::vector<std::vector<std::string>> chains;
    bool operator==(const RetrievalSnapshot&) const = default;
};

struct SourcesSnapshot final {
    std::vector<EntrySnapshot> evidence;
    std::vector<SemanticSnapshot> semantic;
    std::vector<EpisodeSnapshot> episodic;
    std::vector<ProcedureSnapshot> procedural;
    bool operator==(const SourcesSnapshot&) const = default;
};

struct CompleteSnapshot final {
    SessionSnapshot session;
    RetrievalSnapshot retrieval;
    SourcesSnapshot sources;
    bool operator==(const CompleteSnapshot&) const = default;
};

[[nodiscard]] EntrySnapshot snapshot_of(const LongTermMemoryEntry& value) {
    return {value.identifier(), value.value(), value.archived()};
}

template <typename Value, typename Snapshot>
[[nodiscard]] std::vector<Snapshot> snapshot_vector(
    const std::vector<Value>& values, Snapshot (*function)(const Value&)) {
    std::vector<Snapshot> result;
    result.reserve(values.size());
    for (const auto& value : values) {
        result.push_back(function(value));
    }
    return result;
}

[[nodiscard]] std::vector<EntrySnapshot> snapshot_entries(
    const std::vector<LongTermMemoryEntry>& values) {
    return snapshot_vector<LongTermMemoryEntry, EntrySnapshot>(values,
                                                               snapshot_of);
}

[[nodiscard]] SemanticSnapshot snapshot_of(const SemanticConcept& value) {
    return {value.identifier(), value.meaning(), snapshot_entries(value.sourceEntries()),
            value.categories(), value.linkedConceptIdentifiers()};
}

[[nodiscard]] EpisodeSnapshot snapshot_of(const Episode& value) {
    return {value.identifier(), value.occurrence(), value.context(),
            value.chronology(), snapshot_entries(value.sourceEntries()),
            value.linkedEpisodeIdentifiers()};
}

[[nodiscard]] ProcedureSnapshot snapshot_of(const Procedure& value) {
    return {value.identifier(), value.activity(), value.steps(),
            snapshot_entries(value.sourceEntries()),
            value.linkedProcedureIdentifiers()};
}

[[nodiscard]] CandidateSnapshot snapshot_of(const KnowledgeCandidate& value) {
    std::optional<SemanticSnapshot> semantic;
    std::optional<EpisodeSnapshot> episode;
    std::optional<ProcedureSnapshot> procedure;
    if (value.semanticConcept() != nullptr) {
        semantic = snapshot_of(*value.semanticConcept());
    }
    if (value.episode() != nullptr) {
        episode = snapshot_of(*value.episode());
    }
    if (value.procedure() != nullptr) {
        procedure = snapshot_of(*value.procedure());
    }
    return {value.kind(), value.workspaceIdentifier(), value.sourceIdentifier(),
            value.rankScore(), std::move(semantic), std::move(episode),
            std::move(procedure)};
}

[[nodiscard]] ReflectionSnapshot snapshot_of(const Reflection& value) {
    return {value.workspaceIdentifier(), value.identifier(), value.knowledge(),
            snapshot_vector<KnowledgeCandidate, CandidateSnapshot>(
                value.sourceCandidates(), snapshot_of),
            value.sourceExplanationChains()};
}

[[nodiscard]] SessionSnapshot snapshot_of(const ReflectionSession& value) {
    std::optional<std::vector<std::string>> query;
    if (value.query() != nullptr) {
        query = std::vector<std::string>{value.query()->workspaceIdentifier(),
                                         value.query()->identifier(),
                                         value.query()->knowledge()};
    }
    std::optional<ReflectionSnapshot> reflection;
    if (value.reflection() != nullptr) {
        reflection = snapshot_of(*value.reflection());
    }
    return {value.workspaceIdentifier(), value.state(), std::move(query),
            snapshot_vector<KnowledgeCandidate, CandidateSnapshot>(
                value.sourceCandidates(), snapshot_of),
            value.sourceExplanationChains(), std::move(reflection)};
}

void require_ok(const bool succeeded,
                const std::string_view code,
                const std::string_view message) {
    if (!succeeded) {
        throw std::logic_error{std::string{code} + ": " + std::string{message}};
    }
}

template <typename Result>
void require_ok(const Result& result) {
    require_ok(result.succeeded(), result.code(), result.message());
}

struct Sources final {
    LongTermMemory evidence{workspace};
    SemanticMemory semantic{workspace};
    EpisodicMemory episodic{workspace};
    ProceduralMemory procedural{workspace};
};

[[nodiscard]] SourcesSnapshot snapshot_of(const Sources& value) {
    return {snapshot_entries(value.evidence.entries()),
            snapshot_vector<SemanticConcept, SemanticSnapshot>(
                value.semantic.concepts(), snapshot_of),
            snapshot_vector<Episode, EpisodeSnapshot>(value.episodic.episodes(),
                                                       snapshot_of),
            snapshot_vector<Procedure, ProcedureSnapshot>(
                value.procedural.procedures(), snapshot_of)};
}

void populate(Sources& sources) {
    const std::string evidence_a =
        "reflection-allocation-evidence-a-with-a-long-identifier";
    const std::string evidence_b =
        "reflection-allocation-evidence-b-with-a-long-identifier";
    require_ok(LongTermMemoryEngine{}.retain(
        sources.evidence,
        LongTermMemoryEntry{evidence_a,
                            "reflection-allocation-evidence-a-long-value"}));
    require_ok(LongTermMemoryEngine{}.retain(
        sources.evidence,
        LongTermMemoryEntry{evidence_b,
                            "reflection-allocation-evidence-b-long-value"}));
    const auto* const first = sources.evidence.find(evidence_a);
    const auto* const second = sources.evidence.find(evidence_b);
    if (first == nullptr || second == nullptr) {
        throw std::logic_error{"allocation fixture evidence missing"};
    }
    require_ok(SemanticMemoryEngine{}.classify(
        sources.semantic, sources.evidence,
        SemanticConcept{semantic_identifier,
                        "reflection-allocation-semantic-meaning-long-value",
                        {*first, *second}}));
    require_ok(SemanticMemoryEngine{}.categorize(
        sources.semantic, semantic_identifier,
        "reflection-allocation-semantic-category-long-value"));
    require_ok(EpisodicMemoryEngine{}.derive(
        sources.episodic, sources.evidence,
        Episode{episode_identifier,
                "reflection-allocation-episode-occurrence-long-value",
                "reflection-allocation-episode-context-long-value", 101,
                {*second}}));
    require_ok(ProceduralMemoryEngine{}.derive(
        sources.procedural, sources.evidence,
        Procedure{procedure_identifier,
                  "reflection-allocation-procedure-activity-long-value",
                  {"reflection-allocation-step-a-long-value",
                   "reflection-allocation-step-b-long-value"},
                  {*first}}));
}

struct Fixture final {
    Sources sources;
    RetrievalSession retrieval{workspace};
    ReflectionSession session{workspace};
    ReflectionQuery query{workspace, target, knowledge};
    MemoryReflectionEngine reflection_engine;

    Fixture() {
        populate(sources);
        require_ok(MemoryRetrievalEngine{}.search(
            retrieval, sources.semantic, sources.episodic, sources.procedural,
            KnowledgeQuery{""}));
        require_ok(MemoryRetrievalEngine{}.rank(retrieval));
    }
};

[[nodiscard]] RetrievalSnapshot snapshot_retrieval(
    const RetrievalSession& session) {
    std::vector<std::vector<std::string>> chains;
    if (session.started() && !session.forgotten()) {
        for (const auto& candidate : session.candidates()) {
            const auto explained = MemoryRetrievalEngine{}.explain(
                session, candidate.kind(), candidate.sourceIdentifier());
            require_ok(explained);
            chains.push_back(explained.explanationChain());
        }
    }
    return {session.workspaceIdentifier(), session.started(), session.forgotten(),
            snapshot_vector<KnowledgeCandidate, CandidateSnapshot>(
                session.candidates(), snapshot_of),
            std::move(chains)};
}

[[nodiscard]] CompleteSnapshot snapshot_of(const Fixture& value) {
    return {snapshot_of(value.session), snapshot_retrieval(value.retrieval),
            snapshot_of(value.sources)};
}

[[nodiscard]] Fixture prepared_fixture() {
    Fixture fixture;
    require_ok(fixture.reflection_engine.reflect(
        fixture.session, fixture.query, fixture.retrieval));
    return fixture;
}

[[nodiscard]] Fixture derived_fixture() {
    auto fixture = prepared_fixture();
    require_ok(fixture.reflection_engine.derive(
        fixture.session, fixture.sources.semantic, fixture.sources.episodic,
        fixture.sources.procedural));
    return fixture;
}

constexpr std::size_t allocation_campaign_limit = 8192U;

template <typename Arrange, typename Operation>
void verify_strong_guarantee(Arrange arrange,
                             Operation operation,
                             const std::string_view expected_code,
                             const bool expect_session_change,
                             const bool require_injected_failure = true) {
    std::size_t observed_failures = 0U;
    bool completed = false;
    for (std::size_t index = 0U; index < allocation_campaign_limit; ++index) {
        auto fixture = arrange();
        const auto before = snapshot_of(fixture);
        memory_reflection_allocation_failure_support::fail_after(index);
        try {
            const auto result = operation(fixture);
            memory_reflection_allocation_failure_support::disable();
            EXPECT_EQ(result.code(), expected_code);
            if (expected_code == "OK") {
                EXPECT_TRUE(result.succeeded())
                    << result.code() << ": " << result.message();
                EXPECT_EQ(snapshot_of(fixture.sources), before.sources);
                EXPECT_EQ(snapshot_retrieval(fixture.retrieval), before.retrieval);
                if (expect_session_change) {
                    EXPECT_NE(snapshot_of(fixture.session), before.session);
                } else {
                    EXPECT_EQ(snapshot_of(fixture), before);
                }
            } else {
                EXPECT_FALSE(result.succeeded());
                EXPECT_FALSE(result.message().empty());
                EXPECT_EQ(result.reflection(), nullptr);
                EXPECT_EQ(result.session(), nullptr);
                EXPECT_EQ(result.candidate(), nullptr);
                EXPECT_TRUE(result.explanationChain().empty());
                EXPECT_EQ(snapshot_of(fixture), before);
            }
            completed = true;
            break;
        } catch (const std::bad_alloc&) {
            memory_reflection_allocation_failure_support::disable();
            ++observed_failures;
            EXPECT_EQ(snapshot_of(fixture), before);
        } catch (...) {
            memory_reflection_allocation_failure_support::disable();
            throw;
        }
    }
    memory_reflection_allocation_failure_support::disable();
    EXPECT_TRUE(completed);
    if (require_injected_failure) {
        EXPECT_GT(observed_failures, 0U);
    }
}

TEST(MemoryReflectionAllocationFailureTest,
     ReflectPreservesCompleteStateAtEveryFailure) {
    verify_strong_guarantee(
        [] { return Fixture{}; },
        [](Fixture& fixture) {
            return fixture.reflection_engine.reflect(
                fixture.session, fixture.query, fixture.retrieval);
        },
        "OK", true);
}

TEST(MemoryReflectionAllocationFailureTest,
     DerivePreservesCompleteStateAndSourcesAtEveryFailure) {
    verify_strong_guarantee(
        [] { return prepared_fixture(); },
        [](Fixture& fixture) {
            return fixture.reflection_engine.derive(
                fixture.session, fixture.sources.semantic,
                fixture.sources.episodic, fixture.sources.procedural);
        },
        "OK", true);
}

TEST(MemoryReflectionAllocationFailureTest,
     ExplainPreservesCompleteStateAtEveryFailure) {
    verify_strong_guarantee(
        [] { return derived_fixture(); },
        [](Fixture& fixture) {
            return fixture.reflection_engine.explain(
                fixture.session, Kind::Semantic, semantic_identifier);
        },
        "OK", false);
}

TEST(MemoryReflectionAllocationFailureTest,
     ValidatePreparedPreservesCompleteStateAtEveryFailure) {
    verify_strong_guarantee(
        [] { return prepared_fixture(); },
        [](Fixture& fixture) {
            return fixture.reflection_engine.validate(fixture.session);
        },
        "OK", false, false);
}

TEST(MemoryReflectionAllocationFailureTest,
     ValidateDerivedPreservesCompleteStateAtEveryFailure) {
    verify_strong_guarantee(
        [] { return derived_fixture(); },
        [](Fixture& fixture) {
            return fixture.reflection_engine.validate(fixture.session);
        },
        "OK", false, false);
}

TEST(MemoryReflectionAllocationFailureTest,
     RetrieveSessionPreservesCompleteStateAtEveryFailure) {
    verify_strong_guarantee(
        [] { return derived_fixture(); },
        [](Fixture& fixture) {
            return fixture.reflection_engine.retrieveSession(fixture.session);
        },
        "OK", false);
}

TEST(MemoryReflectionAllocationFailureTest,
     ForgetSessionIsAtomicAtEveryFailure) {
    verify_strong_guarantee(
        [] { return derived_fixture(); },
        [](Fixture& fixture) {
            return fixture.reflection_engine.forgetSession(fixture.session);
        },
        "OK", true, false);
}

TEST(MemoryReflectionAllocationFailureTest,
     WrongStageFailureConstructionPreservesEverything) {
    verify_strong_guarantee(
        [] { return Fixture{}; },
        [](Fixture& fixture) {
            return fixture.reflection_engine.derive(
                fixture.session, fixture.sources.semantic,
                fixture.sources.episodic, fixture.sources.procedural);
        },
        "SESSION_NOT_PREPARED", false, false);
}

TEST(MemoryReflectionAllocationFailureTest,
     SourceChangedFailureConstructionPreservesEverything) {
    verify_strong_guarantee(
        [] {
            auto fixture = prepared_fixture();
            require_ok(SemanticMemoryEngine{}.update(
                fixture.sources.semantic, semantic_identifier,
                "reflection-allocation-changed-semantic-meaning-long-value"));
            return fixture;
        },
        [](Fixture& fixture) {
            return fixture.reflection_engine.derive(
                fixture.session, fixture.sources.semantic,
                fixture.sources.episodic, fixture.sources.procedural);
        },
        "SOURCE_CHANGED", false);
}

TEST(MemoryReflectionAllocationFailureTest,
     SourceNotFoundFailureConstructionPreservesEverything) {
    verify_strong_guarantee(
        [] {
            auto fixture = prepared_fixture();
            require_ok(SemanticMemoryEngine{}.forget(
                fixture.sources.semantic, semantic_identifier));
            return fixture;
        },
        [](Fixture& fixture) {
            return fixture.reflection_engine.derive(
                fixture.session, fixture.sources.semantic,
                fixture.sources.episodic, fixture.sources.procedural);
        },
        "SOURCE_NOT_FOUND", false, false);
}

} // namespace
