#include <cca/memory/knowledge_retrieval.hpp>
#include <cca/memory/long_term_memory.hpp>

#include <gtest/gtest.h>

#include <cstddef>
#include <cstdint>
#include <cstdlib>
#include <limits>
#include <new>
#include <stdexcept>
#include <string>
#include <string_view>
#include <utility>
#include <variant>
#include <vector>

// CCA-KR-011, CCA-KR-014, CCA-KR-016, CCA-KR-018 through
// CCA-KR-024, CCA-KR-026, CCA-KR-028, CCA-KR-030, CCA-KR-032,
// CCA-KR-033, and CCA-KR-041: inject every ordinary allocation failure
// for each state-changing Retrieval Session operation, and compare the
// complete session (including private explanation chains through explain())
// and all three complete source aggregates after every injected exception.

namespace knowledge_retrieval_allocation_failure_support {

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

} // namespace knowledge_retrieval_allocation_failure_support

void* operator new(const std::size_t size) {
    return knowledge_retrieval_allocation_failure_support::allocate(size);
}

void* operator new[](const std::size_t size) {
    return knowledge_retrieval_allocation_failure_support::allocate(size);
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
using cca::memory::MemoryRetrievalEngine;
using cca::memory::Procedure;
using cca::memory::ProceduralMemory;
using cca::memory::ProceduralMemoryEngine;
using cca::memory::RetrievalSession;
using cca::memory::SemanticConcept;
using cca::memory::SemanticMemory;
using cca::memory::SemanticMemoryEngine;

constexpr std::string_view workspace_identifier{
    "knowledge-retrieval-allocation-workspace-with-long-identity"};
constexpr std::string_view rank_token{
    "allocation-ranking-token-with-enough-content-to-allocate"};
constexpr std::string_view filter_token{
    "allocation-filter-token-with-enough-content-to-allocate"};
constexpr std::string_view absent_identifier{
    "absent-knowledge-identifier-with-enough-content-to-allocate"};
constexpr std::string_view source_a{
    "retrieval-source-a-with-a-long-identifier-for-allocation-testing"};
constexpr std::string_view source_b{
    "retrieval-source-b-with-a-long-identifier-for-allocation-testing"};
constexpr std::string_view source_c{
    "retrieval-source-c-with-a-long-identifier-for-allocation-testing"};
constexpr std::string_view semantic_substring_identifier{
    "semantic-prefix-allocation-ranking-token-with-enough-content-to-allocate-suffix"};
constexpr std::string_view episode_exact_content_identifier{
    "episode-exact-content-with-a-long-identifier-for-allocation-testing"};
constexpr std::string_view episode_substring_identifier{
    "episode-substring-content-with-a-long-identifier-for-allocation-testing"};
constexpr std::string_view procedure_exact_content_identifier{
    "procedure-exact-content-with-a-long-identifier-for-allocation-testing"};
constexpr std::string_view procedure_substring_identifier{
    "procedure-substring-content-with-a-long-identifier-for-allocation-testing"};

struct EntrySnapshot final {
    std::string identifier;
    std::string value;
    bool archived;

    bool operator==(const EntrySnapshot&) const = default;
};

struct SemanticSnapshot final {
    std::string identifier;
    std::string meaning;
    std::vector<EntrySnapshot> source_entries;
    std::vector<std::string> categories;
    std::vector<std::string> links;

    bool operator==(const SemanticSnapshot&) const = default;
};

struct EpisodeSnapshot final {
    std::string identifier;
    std::string occurrence;
    std::string context;
    std::int64_t chronology;
    std::vector<EntrySnapshot> source_entries;
    std::vector<std::string> links;

    bool operator==(const EpisodeSnapshot&) const = default;
};

struct ProcedureSnapshot final {
    std::string identifier;
    std::string activity;
    std::vector<std::string> steps;
    std::vector<EntrySnapshot> source_entries;
    std::vector<std::string> links;

    bool operator==(const ProcedureSnapshot&) const = default;
};

using TypedSourceSnapshot =
    std::variant<SemanticSnapshot, EpisodeSnapshot, ProcedureSnapshot>;

struct CandidateSnapshot final {
    KnowledgeCandidate::Kind kind;
    std::string workspace_identifier;
    std::string source_identifier;
    std::uint32_t rank_score;
    TypedSourceSnapshot source;
    std::vector<std::string> explanation_chain;

    bool operator==(const CandidateSnapshot&) const = default;
};

struct SessionSnapshot final {
    std::string workspace_identifier;
    bool started;
    bool forgotten;
    std::vector<CandidateSnapshot> candidates;

    bool operator==(const SessionSnapshot&) const = default;
};

struct SemanticMemorySnapshot final {
    std::string workspace_identifier;
    std::vector<SemanticSnapshot> concepts;

    bool operator==(const SemanticMemorySnapshot&) const = default;
};

struct EpisodicMemorySnapshot final {
    std::string workspace_identifier;
    std::vector<EpisodeSnapshot> episodes;

    bool operator==(const EpisodicMemorySnapshot&) const = default;
};

struct ProceduralMemorySnapshot final {
    std::string workspace_identifier;
    std::vector<ProcedureSnapshot> procedures;

    bool operator==(const ProceduralMemorySnapshot&) const = default;
};

struct SourceSnapshot final {
    SemanticMemorySnapshot semantic;
    EpisodicMemorySnapshot episodic;
    ProceduralMemorySnapshot procedural;

    bool operator==(const SourceSnapshot&) const = default;
};

struct Fixture final {
    MemoryRetrievalEngine retrieval_engine;
    LongTermMemoryEngine long_term_engine;
    SemanticMemoryEngine semantic_engine;
    EpisodicMemoryEngine episodic_engine;
    ProceduralMemoryEngine procedural_engine;
    LongTermMemory evidence{std::string{workspace_identifier}};
    SemanticMemory semantic{std::string{workspace_identifier}};
    EpisodicMemory episodic{std::string{workspace_identifier}};
    ProceduralMemory procedural{std::string{workspace_identifier}};
    RetrievalSession session{std::string{workspace_identifier}};
};

struct FixtureSnapshot final {
    SessionSnapshot session;
    SourceSnapshot sources;

    bool operator==(const FixtureSnapshot&) const = default;
};

[[nodiscard]] EntrySnapshot snapshot_of(const LongTermMemoryEntry& entry) {
    return {entry.identifier(), entry.value(), entry.archived()};
}

[[nodiscard]] std::vector<EntrySnapshot> snapshot_entries(
    const std::vector<LongTermMemoryEntry>& entries) {
    std::vector<EntrySnapshot> snapshots;
    snapshots.reserve(entries.size());
    for (const auto& entry : entries) {
        snapshots.push_back(snapshot_of(entry));
    }
    return snapshots;
}

[[nodiscard]] SemanticSnapshot snapshot_of(
    const SemanticConcept& semantic_concept) {
    return {semantic_concept.identifier(),
            semantic_concept.meaning(),
            snapshot_entries(semantic_concept.sourceEntries()),
            semantic_concept.categories(),
            semantic_concept.linkedConceptIdentifiers()};
}

[[nodiscard]] EpisodeSnapshot snapshot_of(const Episode& episode) {
    return {episode.identifier(),
            episode.occurrence(),
            episode.context(),
            episode.chronology(),
            snapshot_entries(episode.sourceEntries()),
            episode.linkedEpisodeIdentifiers()};
}

[[nodiscard]] ProcedureSnapshot snapshot_of(const Procedure& procedure) {
    return {procedure.identifier(),
            procedure.activity(),
            procedure.steps(),
            snapshot_entries(procedure.sourceEntries()),
            procedure.linkedProcedureIdentifiers()};
}

[[nodiscard]] TypedSourceSnapshot typed_snapshot_of(
    const KnowledgeCandidate& candidate) {
    const auto* const semantic = candidate.semanticConcept();
    const auto* const episode = candidate.episode();
    const auto* const procedure = candidate.procedure();
    switch (candidate.kind()) {
    case KnowledgeCandidate::Kind::Semantic:
        if (semantic == nullptr || episode != nullptr || procedure != nullptr) {
            throw std::logic_error{"invalid Semantic candidate accessors"};
        }
        return snapshot_of(*semantic);
    case KnowledgeCandidate::Kind::Episodic:
        if (semantic != nullptr || episode == nullptr || procedure != nullptr) {
            throw std::logic_error{"invalid Episodic candidate accessors"};
        }
        return snapshot_of(*episode);
    case KnowledgeCandidate::Kind::Procedural:
        if (semantic != nullptr || episode != nullptr || procedure == nullptr) {
            throw std::logic_error{"invalid Procedural candidate accessors"};
        }
        return snapshot_of(*procedure);
    }
    throw std::logic_error{"invalid KnowledgeCandidate Kind"};
}

[[nodiscard]] CandidateSnapshot snapshot_of(
    const KnowledgeCandidate& candidate,
    std::vector<std::string> explanation_chain) {
    return {candidate.kind(),
            candidate.workspaceIdentifier(),
            candidate.sourceIdentifier(),
            candidate.rankScore(),
            typed_snapshot_of(candidate),
            std::move(explanation_chain)};
}

[[nodiscard]] SemanticMemorySnapshot snapshot_of(
    const SemanticMemory& memory) {
    std::vector<SemanticSnapshot> concepts;
    concepts.reserve(memory.concepts().size());
    for (const auto& semantic_concept : memory.concepts()) {
        concepts.push_back(snapshot_of(semantic_concept));
    }
    return {memory.workspaceIdentifier(), std::move(concepts)};
}

[[nodiscard]] EpisodicMemorySnapshot snapshot_of(
    const EpisodicMemory& memory) {
    std::vector<EpisodeSnapshot> episodes;
    episodes.reserve(memory.episodes().size());
    for (const auto& episode : memory.episodes()) {
        episodes.push_back(snapshot_of(episode));
    }
    return {memory.workspaceIdentifier(), std::move(episodes)};
}

[[nodiscard]] ProceduralMemorySnapshot snapshot_of(
    const ProceduralMemory& memory) {
    std::vector<ProcedureSnapshot> procedures;
    procedures.reserve(memory.procedures().size());
    for (const auto& procedure : memory.procedures()) {
        procedures.push_back(snapshot_of(procedure));
    }
    return {memory.workspaceIdentifier(), std::move(procedures)};
}

[[nodiscard]] SourceSnapshot snapshot_sources(const Fixture& fixture) {
    return {snapshot_of(fixture.semantic),
            snapshot_of(fixture.episodic),
            snapshot_of(fixture.procedural)};
}

[[nodiscard]] SessionSnapshot snapshot_session(const Fixture& fixture) {
    std::vector<CandidateSnapshot> candidates;
    candidates.reserve(fixture.session.candidates().size());
    for (const auto& candidate : fixture.session.candidates()) {
        const auto explained = fixture.retrieval_engine.explain(
            fixture.session, candidate.kind(), candidate.sourceIdentifier());
        if (!explained.succeeded()) {
            throw std::logic_error{"unable to observe candidate explanation"};
        }
        candidates.push_back(snapshot_of(
            candidate,
            explained.explanationChain()));
    }
    return {fixture.session.workspaceIdentifier(),
            fixture.session.started(),
            fixture.session.forgotten(),
            std::move(candidates)};
}

[[nodiscard]] FixtureSnapshot snapshot_of(const Fixture& fixture) {
    return {snapshot_session(fixture), snapshot_sources(fixture)};
}

void require_success(const bool succeeded,
                     const std::string& code,
                     const std::string& message) {
    ASSERT_TRUE(succeeded) << code << ": " << message;
}

void retain(Fixture& fixture,
            std::string identifier,
            std::string value) {
    auto result = fixture.long_term_engine.retain(
        fixture.evidence,
        LongTermMemoryEntry{std::move(identifier), std::move(value)});
    require_success(result.succeeded(), result.code(), result.message());
}

[[nodiscard]] const LongTermMemoryEntry& require_entry(
    const Fixture& fixture,
    const std::string_view identifier) {
    const auto* const entry = fixture.evidence.find(identifier);
    if (entry == nullptr) {
        throw std::logic_error{"allocation fixture evidence is absent"};
    }
    return *entry;
}

void seed(Fixture& fixture) {
    retain(fixture,
           std::string{source_a},
           "source-a-value-with-enough-content-to-require-allocation");
    retain(fixture,
           std::string{source_b},
           "source-b-value-with-enough-content-to-require-allocation");
    retain(fixture,
           std::string{source_c},
           "source-c-value-with-enough-content-to-require-allocation");

    {
        auto result = fixture.semantic_engine.classify(
            fixture.semantic,
            fixture.evidence,
            SemanticConcept{
                std::string{rank_token},
                "semantic-exact-identifier-meaning-with-long-content",
                {require_entry(fixture, source_a)}});
        require_success(result.succeeded(), result.code(), result.message());
    }
    {
        auto result = fixture.semantic_engine.classify(
            fixture.semantic,
            fixture.evidence,
            SemanticConcept{
                std::string{semantic_substring_identifier},
                "semantic-substring-identifier-meaning-with-long-content",
                {require_entry(fixture, source_b)}});
        require_success(result.succeeded(), result.code(), result.message());
    }
    {
        auto result = fixture.semantic_engine.categorize(
            fixture.semantic, rank_token, std::string{filter_token});
        require_success(result.succeeded(), result.code(), result.message());
    }
    {
        auto result = fixture.semantic_engine.categorize(
            fixture.semantic,
            semantic_substring_identifier,
            "second-semantic-category-with-enough-content-to-allocate");
        require_success(result.succeeded(), result.code(), result.message());
    }
    {
        auto result = fixture.semantic_engine.link(
            fixture.semantic, rank_token, semantic_substring_identifier);
        require_success(result.succeeded(), result.code(), result.message());
    }

    {
        auto result = fixture.episodic_engine.record(
            fixture.episodic,
            fixture.evidence,
            Episode{std::string{episode_exact_content_identifier},
                    std::string{rank_token},
                    "episode-exact-context-with-enough-content-to-allocate",
                    20,
                    {require_entry(fixture, source_b)}});
        require_success(result.succeeded(), result.code(), result.message());
    }
    {
        auto result = fixture.episodic_engine.derive(
            fixture.episodic,
            fixture.evidence,
            Episode{
                std::string{episode_substring_identifier},
                "episode-substring-occurrence-with-enough-content-to-allocate",
                "episode-context-prefix-allocation-ranking-token-with-enough-content-to-allocate-suffix",
                10,
                {require_entry(fixture, source_c)}});
        require_success(result.succeeded(), result.code(), result.message());
    }
    {
        auto result = fixture.episodic_engine.link(
            fixture.episodic,
            episode_exact_content_identifier,
            episode_substring_identifier);
        require_success(result.succeeded(), result.code(), result.message());
    }

    {
        auto result = fixture.procedural_engine.derive(
            fixture.procedural,
            fixture.evidence,
            Procedure{std::string{procedure_exact_content_identifier},
                      std::string{rank_token},
                      {"procedure-exact-step-with-enough-content-to-allocate"},
                      {require_entry(fixture, source_c)}});
        require_success(result.succeeded(), result.code(), result.message());
    }
    {
        auto result = fixture.procedural_engine.compose(
            fixture.procedural,
            fixture.evidence,
            Procedure{
                std::string{procedure_substring_identifier},
                "procedure-substring-activity-with-enough-content-to-allocate",
                {"procedure-step-prefix-allocation-ranking-token-with-enough-content-to-allocate-suffix",
                 "procedure-second-step-with-enough-content-to-allocate"},
                {require_entry(fixture, source_a),
                 require_entry(fixture, source_b)}});
        require_success(result.succeeded(), result.code(), result.message());
    }
    {
        auto result = fixture.procedural_engine.link(
            fixture.procedural,
            procedure_exact_content_identifier,
            procedure_substring_identifier);
        require_success(result.succeeded(), result.code(), result.message());
    }
}

[[nodiscard]] Fixture seeded_fixture() {
    Fixture fixture;
    seed(fixture);
    return fixture;
}

void start_search(Fixture& fixture, const std::string_view query) {
    auto result = fixture.retrieval_engine.search(
        fixture.session,
        fixture.semantic,
        fixture.episodic,
        fixture.procedural,
        KnowledgeQuery{std::string{query}});
    require_success(result.succeeded(), result.code(), result.message());
}

[[nodiscard]] Fixture started_fixture(const std::string_view query) {
    auto fixture = seeded_fixture();
    start_search(fixture, query);
    return fixture;
}

[[nodiscard]] Fixture forgotten_fixture() {
    auto fixture = seeded_fixture();
    auto result = fixture.retrieval_engine.forgetSession(fixture.session);
    require_success(result.succeeded(), result.code(), result.message());
    return fixture;
}

constexpr std::size_t allocation_campaign_limit = 4096U;

template <typename Arrange, typename Operation>
void verify_strong_guarantee(Arrange arrange,
                             Operation operation,
                             const std::string_view expected_code,
                             const bool expect_session_change,
                             const bool require_injected_failure = true) {
    std::size_t observed_failures = 0U;
    bool completed = false;

    for (std::size_t index = 0U;
         index < allocation_campaign_limit;
         ++index) {
        auto fixture = arrange();
        const auto before = snapshot_of(fixture);

        knowledge_retrieval_allocation_failure_support::fail_after(index);
        try {
            const auto result = operation(fixture);
            knowledge_retrieval_allocation_failure_support::disable();

            EXPECT_EQ(std::string_view{result.code()}, expected_code);
            if (expected_code == "OK") {
                EXPECT_TRUE(result.succeeded())
                    << result.code() << ": " << result.message();
                EXPECT_EQ(snapshot_sources(fixture), before.sources);
                if (expect_session_change) {
                    EXPECT_NE(snapshot_session(fixture), before.session);
                } else {
                    EXPECT_EQ(snapshot_of(fixture), before);
                }
            } else {
                EXPECT_FALSE(result.succeeded());
                EXPECT_FALSE(result.message().empty());
                EXPECT_EQ(result.candidate(), nullptr);
                EXPECT_TRUE(result.candidates().empty());
                EXPECT_TRUE(result.explanationChain().empty());
                EXPECT_EQ(snapshot_of(fixture), before);
            }
            completed = true;
            break;
        } catch (const std::bad_alloc&) {
            knowledge_retrieval_allocation_failure_support::disable();
            ++observed_failures;
            EXPECT_EQ(snapshot_of(fixture), before);
        } catch (...) {
            knowledge_retrieval_allocation_failure_support::disable();
            throw;
        }
    }

    knowledge_retrieval_allocation_failure_support::disable();
    EXPECT_TRUE(completed);
    if (require_injected_failure) {
        EXPECT_GT(observed_failures, 0U);
    }
}

TEST(KnowledgeRetrievalAllocationFailureTest,
     RetrieveStartPreservesSessionAndAllSourcesAtEveryFailure) {
    verify_strong_guarantee(
        [] { return seeded_fixture(); },
        [](Fixture& fixture) {
            return fixture.retrieval_engine.retrieve(
                fixture.session,
                fixture.semantic,
                fixture.episodic,
                fixture.procedural,
                KnowledgeCandidate::Kind::Semantic,
                rank_token);
        },
        "OK",
        true);
}

TEST(KnowledgeRetrievalAllocationFailureTest,
     SearchStartPreservesSessionAndAllSourcesAtEveryFailure) {
    verify_strong_guarantee(
        [] { return seeded_fixture(); },
        [](Fixture& fixture) {
            return fixture.retrieval_engine.search(
                fixture.session,
                fixture.semantic,
                fixture.episodic,
                fixture.procedural,
                KnowledgeQuery{std::string{rank_token}});
        },
        "OK",
        true);
}

TEST(KnowledgeRetrievalAllocationFailureTest,
     ZeroMatchSearchStartIsAtomicAtEveryFailure) {
    verify_strong_guarantee(
        [] { return seeded_fixture(); },
        [](Fixture& fixture) {
            return fixture.retrieval_engine.search(
                fixture.session,
                fixture.semantic,
                fixture.episodic,
                fixture.procedural,
                KnowledgeQuery{
                    "zero-match-query-with-enough-content-to-allocate"});
        },
        "OK",
        true);
}

TEST(KnowledgeRetrievalAllocationFailureTest,
     FilterPreservesCompleteSessionAndSourcesAtEveryFailure) {
    verify_strong_guarantee(
        [] { return started_fixture(""); },
        [](Fixture& fixture) {
            return fixture.retrieval_engine.filter(
                fixture.session, KnowledgeQuery{std::string{filter_token}});
        },
        "OK",
        true);
}

TEST(KnowledgeRetrievalAllocationFailureTest,
     RankPreservesCompleteSessionAndSourcesAtEveryFailure) {
    verify_strong_guarantee(
        [] { return started_fixture(rank_token); },
        [](Fixture& fixture) {
            return fixture.retrieval_engine.rank(fixture.session);
        },
        "OK",
        true);
}

TEST(KnowledgeRetrievalAllocationFailureTest,
     ForgetStartedSessionIsAtomicAndSourceIsolated) {
    verify_strong_guarantee(
        [] { return started_fixture(rank_token); },
        [](Fixture& fixture) {
            return fixture.retrieval_engine.forgetSession(fixture.session);
        },
        "OK",
        true,
        false);
}

TEST(KnowledgeRetrievalAllocationFailureTest,
     ForgetReadySessionIsAtomicAndSourceIsolated) {
    verify_strong_guarantee(
        [] { return seeded_fixture(); },
        [](Fixture& fixture) {
            return fixture.retrieval_engine.forgetSession(fixture.session);
        },
        "OK",
        true,
        false);
}

TEST(KnowledgeRetrievalAllocationFailureTest,
     RepeatedForgetRemainsTerminalAndSourceIsolated) {
    verify_strong_guarantee(
        [] { return forgotten_fixture(); },
        [](Fixture& fixture) {
            return fixture.retrieval_engine.forgetSession(fixture.session);
        },
        "OK",
        false,
        false);
}

TEST(KnowledgeRetrievalAllocationFailureTest,
     ExplainCopyPreservesSessionAndSourcesAtEveryFailure) {
    verify_strong_guarantee(
        [] { return started_fixture(rank_token); },
        [](Fixture& fixture) {
            return fixture.retrieval_engine.explain(
                fixture.session,
                KnowledgeCandidate::Kind::Semantic,
                rank_token);
        },
        "OK",
        false);
}

TEST(KnowledgeRetrievalAllocationFailureTest,
     RetrieveNotFoundFailureConstructionPreservesEverything) {
    verify_strong_guarantee(
        [] { return seeded_fixture(); },
        [](Fixture& fixture) {
            return fixture.retrieval_engine.retrieve(
                fixture.session,
                fixture.semantic,
                fixture.episodic,
                fixture.procedural,
                KnowledgeCandidate::Kind::Semantic,
                absent_identifier);
        },
        "NOT_FOUND",
        false,
        false);
}

TEST(KnowledgeRetrievalAllocationFailureTest,
     RepeatedStartFailureConstructionPreservesEverything) {
    verify_strong_guarantee(
        [] { return started_fixture(rank_token); },
        [](Fixture& fixture) {
            return fixture.retrieval_engine.search(
                fixture.session,
                fixture.semantic,
                fixture.episodic,
                fixture.procedural,
                KnowledgeQuery{std::string{rank_token}});
        },
        "SESSION_ALREADY_STARTED",
        false,
        false);
}

TEST(KnowledgeRetrievalAllocationFailureTest,
     FilterNotStartedFailureConstructionPreservesEverything) {
    verify_strong_guarantee(
        [] { return seeded_fixture(); },
        [](Fixture& fixture) {
            return fixture.retrieval_engine.filter(
                fixture.session, KnowledgeQuery{std::string{rank_token}});
        },
        "SESSION_NOT_STARTED",
        false,
        false);
}

TEST(KnowledgeRetrievalAllocationFailureTest,
     RankNotStartedFailureConstructionPreservesEverything) {
    verify_strong_guarantee(
        [] { return seeded_fixture(); },
        [](Fixture& fixture) {
            return fixture.retrieval_engine.rank(fixture.session);
        },
        "SESSION_NOT_STARTED",
        false,
        false);
}

TEST(KnowledgeRetrievalAllocationFailureTest,
     ExplainNotStartedFailureConstructionPreservesEverything) {
    verify_strong_guarantee(
        [] { return seeded_fixture(); },
        [](Fixture& fixture) {
            return fixture.retrieval_engine.explain(
                fixture.session,
                KnowledgeCandidate::Kind::Semantic,
                rank_token);
        },
        "SESSION_NOT_STARTED",
        false,
        false);
}

TEST(KnowledgeRetrievalAllocationFailureTest,
     ForgottenSessionFailureConstructionPreservesEverything) {
    verify_strong_guarantee(
        [] { return forgotten_fixture(); },
        [](Fixture& fixture) {
            return fixture.retrieval_engine.retrieve(
                fixture.session,
                fixture.semantic,
                fixture.episodic,
                fixture.procedural,
                KnowledgeCandidate::Kind::Semantic,
                rank_token);
        },
        "SESSION_FORGOTTEN",
        false,
        false);
}

} // namespace
