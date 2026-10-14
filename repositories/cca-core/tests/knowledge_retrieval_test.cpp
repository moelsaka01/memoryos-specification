#include <cca/memory/knowledge_retrieval.hpp>
#include <cca/memory/long_term_memory.hpp>
#include <cca/runtime/runtime.hpp>
#include <cca/runtime/runtime_builder.hpp>
#include <cca/runtime/runtime_id.hpp>

#include <gtest/gtest.h>

#include <cstddef>
#include <cstdint>
#include <optional>
#include <stdexcept>
#include <string>
#include <string_view>
#include <thread>
#include <type_traits>
#include <utility>
#include <vector>

/*
CCA-KR-1.0 requirement coverage
-------------------------------
CCA-KR-001: KnowledgeRetrievalBoundaryTest and architecture review
CCA-KR-002: KnowledgeRetrievalApiTest.PublicDeclarationsMatchContract
CCA-KR-003: KnowledgeRetrievalApiTest.PublicDeclarationsMatchContract
CCA-KR-004: KnowledgeRetrievalOwnershipTest.WorkspaceAndPristineStateAreExact
CCA-KR-005: KnowledgeRetrievalBoundaryTest.WorkspacesSourcesAndRuntimeStayIsolated
CCA-KR-006: KnowledgeRetrievalLifecycleTest.ReadyStartedAndForgottenTransitionsAreExact
CCA-KR-007: KnowledgeRetrievalOwnershipTest.SessionCopiesMovesAndObservationOwnState
CCA-KR-008: KnowledgeRetrievalMatchingTest.QueryOwnershipCaseAndLiteralRulesAreExact
CCA-KR-009: KnowledgeRetrievalIdentityTest.CompositeIdentityDistinguishesKinds
CCA-KR-010: KnowledgeRetrievalApiTest and KnowledgeRetrievalPrecedenceTest
CCA-KR-011: KnowledgeRetrievalRetrieveTest.AllKindsPreserveCompleteTypedSnapshots
CCA-KR-012: KnowledgeRetrievalRetrieveTest and KnowledgeRetrievalOrderingTest
CCA-KR-013: KnowledgeRetrievalPrecedenceTest.WorkspaceChecksPrecedeKeyValidation
CCA-KR-014: KnowledgeRetrievalIsolationTest.SourceAndDetachedCandidateLifetimesAreIndependent
CCA-KR-015: KnowledgeRetrievalOrderingTest.EmptySearchUsesCanonicalCrossKindOrder
            and EqualChronologyPreservesReleasedEpisodeOrder
CCA-KR-016: KnowledgeRetrievalRetrieveTest.AllKindsPreserveCompleteTypedSnapshots
            and AbsentAndForgottenSourcesAreNotFoundForEveryKind
CCA-KR-017: KnowledgeRetrievalMatchingTest.IncludedAndExcludedFieldsAreExact
            and KnowledgeRetrievalFilterTest.IncludedFieldsAcrossKindsAreExactAndStable
CCA-KR-018: KnowledgeRetrievalOrderingTest.EmptySearchUsesCanonicalCrossKindOrder
            and EqualChronologyPreservesReleasedEpisodeOrder
CCA-KR-019: KnowledgeRetrievalFilterTest.NarrowsSnapshotsWithoutRereadingSources
            plus IncludedFieldsAcrossKindsAreExactAndStable and
            FilteringAfterRankPreservesPriorChainAndOrder
CCA-KR-020: KnowledgeRetrievalMatchingTest.ScoreTiersAndFieldPrecedenceAreExact
CCA-KR-021: KnowledgeRetrievalRankTest.StableDescendingScoresAndTieTokensAreExact
            and KnowledgeRetrievalFilterTest.FilteringAfterRankPreservesPriorChainAndOrder
CCA-KR-022: KnowledgeRetrievalMatchingTest, KnowledgeRetrievalFilterTest,
            and KnowledgeRetrievalRankTest, including MissingTokenTiersAreExact
CCA-KR-023: KnowledgeRetrievalExplainTest.CompositeLookupIsConstAndExact
CCA-KR-024: KnowledgeRetrievalLifecycleTest.ReadyStartedAndForgottenTransitionsAreExact
CCA-KR-025: KnowledgeRetrievalIsolationTest.SourceAndDetachedCandidateLifetimesAreIndependent
            and DestructionDirectionsPreserveDetachedAndSourceState
CCA-KR-026: KnowledgeRetrievalIsolationTest.SourceAndDetachedCandidateLifetimesAreIndependent
            and DestructionDirectionsPreserveDetachedAndSourceState
CCA-KR-027: KnowledgeRetrievalResultTest.CodesMessagesAndPayloadShapesAreExact
CCA-KR-028: KnowledgeRetrievalResultTest.CodesMessagesAndPayloadShapesAreExact
CCA-KR-029: KnowledgeRetrievalPrecedenceTest.AllOperationPrecedenceIsExact
CCA-KR-030: KnowledgeRetrievalValueTest.CandidatesSessionsAndResultsHonorMoveContracts
            and SearchAndExplainResultsMoveCompletePayloads
CCA-KR-031: KnowledgeRetrievalBoundaryTest.IndependentEnginesAndSessionsAreIsolated
CCA-KR-032: KnowledgeRetrievalFailureTest.SemanticFailuresPreserveCompleteState
CCA-KR-033: KnowledgeRetrievalDeterminismTest.EquivalentHistoriesAreCompletelyEqual
CCA-KR-034: KnowledgeRetrievalBoundaryTest.IndependentEnginesAndSessionsAreIsolated
CCA-KR-035: KnowledgeRetrievalBoundaryTest.WorkspacesSourcesAndRuntimeStayIsolated
            and RuntimeLifecyclePreservesEverySessionState
CCA-KR-036: KnowledgeRetrievalApiTest and architecture review
CCA-KR-037: KnowledgeRetrievalBoundaryTest.NoExcludedBehaviorIsObservable
CCA-KR-038: KnowledgeRetrievalMatchingTest.IncludedAndExcludedFieldsAreExact
CCA-KR-039: documentation/example review
CCA-KR-040: this mapping and architecture traceability review
CCA-KR-041: CI C++23 warnings-as-errors build gate
*/

namespace {

using cca::memory::Episode;
using cca::memory::EpisodicMemory;
using cca::memory::EpisodicMemoryEngine;
using cca::memory::KnowledgeCandidate;
using cca::memory::KnowledgeQuery;
using cca::memory::KnowledgeResult;
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

using Kind = KnowledgeCandidate::Kind;

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
    std::vector<std::string> explanation;

    bool operator==(const CandidateSnapshot&) const = default;
};

struct SessionSnapshot final {
    std::string workspace_identifier;
    bool started;
    bool forgotten;
    std::vector<CandidateSnapshot> candidates;

    bool operator==(const SessionSnapshot&) const = default;
};

struct ResultSnapshot final {
    bool succeeded;
    std::string code;
    std::string message;
    std::optional<CandidateSnapshot> candidate;
    std::vector<CandidateSnapshot> candidates;
    std::vector<std::string> explanation;

    bool operator==(const ResultSnapshot&) const = default;
};

struct SourceStateSnapshot final {
    std::string workspace_identifier;
    std::vector<EntrySnapshot> evidence;
    std::vector<SemanticSnapshot> semantic;
    std::vector<EpisodeSnapshot> episodic;
    std::vector<ProcedureSnapshot> procedural;

    bool operator==(const SourceStateSnapshot&) const = default;
};

[[nodiscard]] EntrySnapshot snapshot_of(const LongTermMemoryEntry& value) {
    return {value.identifier(), value.value(), value.archived()};
}

[[nodiscard]] std::vector<EntrySnapshot> snapshot_entries(
    const std::vector<LongTermMemoryEntry>& values) {
    std::vector<EntrySnapshot> result;
    result.reserve(values.size());
    for (const auto& value : values) {
        result.push_back(snapshot_of(value));
    }
    return result;
}

[[nodiscard]] SemanticSnapshot snapshot_of(const SemanticConcept& value) {
    return {value.identifier(),
            value.meaning(),
            snapshot_entries(value.sourceEntries()),
            value.categories(),
            value.linkedConceptIdentifiers()};
}

[[nodiscard]] EpisodeSnapshot snapshot_of(const Episode& value) {
    return {value.identifier(),
            value.occurrence(),
            value.context(),
            value.chronology(),
            snapshot_entries(value.sourceEntries()),
            value.linkedEpisodeIdentifiers()};
}

[[nodiscard]] ProcedureSnapshot snapshot_of(const Procedure& value) {
    return {value.identifier(),
            value.activity(),
            value.steps(),
            snapshot_entries(value.sourceEntries()),
            value.linkedProcedureIdentifiers()};
}

template <typename Value, typename SnapshotFunction>
[[nodiscard]] auto snapshot_values(const std::vector<Value>& values,
                                   SnapshotFunction snapshot_function) {
    using Snapshot = decltype(snapshot_function(values.front()));
    std::vector<Snapshot> result;
    result.reserve(values.size());
    for (const auto& value : values) {
        result.push_back(snapshot_function(value));
    }
    return result;
}

[[nodiscard]] CandidateSnapshot snapshot_of(
    const KnowledgeCandidate& value,
    std::vector<std::string> explanation = {}) {
    std::optional<SemanticSnapshot> semantic;
    if (value.semanticConcept() != nullptr) {
        semantic = snapshot_of(*value.semanticConcept());
    }
    std::optional<EpisodeSnapshot> episode;
    if (value.episode() != nullptr) {
        episode = snapshot_of(*value.episode());
    }
    std::optional<ProcedureSnapshot> procedure;
    if (value.procedure() != nullptr) {
        procedure = snapshot_of(*value.procedure());
    }
    return {value.kind(),
            value.workspaceIdentifier(),
            value.sourceIdentifier(),
            value.rankScore(),
            std::move(semantic),
            std::move(episode),
            std::move(procedure),
            std::move(explanation)};
}

[[nodiscard]] ResultSnapshot snapshot_of(const KnowledgeResult& value) {
    std::optional<CandidateSnapshot> candidate;
    if (value.candidate() != nullptr) {
        candidate = snapshot_of(*value.candidate());
    }
    std::vector<CandidateSnapshot> candidates;
    candidates.reserve(value.candidates().size());
    for (const auto& item : value.candidates()) {
        candidates.push_back(snapshot_of(item));
    }
    return {value.succeeded(),
            value.code(),
            value.message(),
            std::move(candidate),
            std::move(candidates),
            value.explanationChain()};
}

class Sources final {
public:
    explicit Sources(const std::string& workspace_identifier)
        : evidence{workspace_identifier},
          semantic{workspace_identifier},
          episodic{workspace_identifier},
          procedural{workspace_identifier} {}

    void retain(std::string identifier, std::string value) {
        const auto result = LongTermMemoryEngine{}.retain(
            evidence,
            LongTermMemoryEntry{std::move(identifier), std::move(value)});
        ASSERT_TRUE(result.succeeded()) << result.code() << ": "
                                        << result.message();
    }

    [[nodiscard]] const LongTermMemoryEntry& entry(
        const std::string_view identifier) const {
        const auto* const value = evidence.find(identifier);
        if (value == nullptr) {
            throw std::logic_error{"test fixture evidence is absent"};
        }
        return *value;
    }

    void add_semantic(std::string identifier,
                      std::string meaning,
                      const std::vector<std::string_view>& source_identifiers) {
        std::vector<LongTermMemoryEntry> source_entries;
        source_entries.reserve(source_identifiers.size());
        for (const auto source_identifier : source_identifiers) {
            source_entries.push_back(entry(source_identifier));
        }
        const auto result = SemanticMemoryEngine{}.classify(
            semantic,
            evidence,
            SemanticConcept{std::move(identifier),
                            std::move(meaning),
                            std::move(source_entries)});
        ASSERT_TRUE(result.succeeded()) << result.code() << ": "
                                        << result.message();
    }

    void categorize(const std::string_view identifier, std::string category) {
        const auto result = SemanticMemoryEngine{}.categorize(
            semantic, identifier, std::move(category));
        ASSERT_TRUE(result.succeeded()) << result.code() << ": "
                                        << result.message();
    }

    void link_semantic(const std::string_view first,
                       const std::string_view second) {
        const auto result = SemanticMemoryEngine{}.link(semantic, first, second);
        ASSERT_TRUE(result.succeeded()) << result.code() << ": "
                                        << result.message();
    }

    void add_episode(std::string identifier,
                     std::string occurrence,
                     std::string context,
                     const std::int64_t chronology,
                     const std::vector<std::string_view>& source_identifiers) {
        std::vector<LongTermMemoryEntry> source_entries;
        source_entries.reserve(source_identifiers.size());
        for (const auto source_identifier : source_identifiers) {
            source_entries.push_back(entry(source_identifier));
        }
        const auto result = EpisodicMemoryEngine{}.derive(
            episodic,
            evidence,
            Episode{std::move(identifier),
                    std::move(occurrence),
                    std::move(context),
                    chronology,
                    std::move(source_entries)});
        ASSERT_TRUE(result.succeeded()) << result.code() << ": "
                                        << result.message();
    }

    void link_episodes(const std::string_view first,
                       const std::string_view second) {
        const auto result = EpisodicMemoryEngine{}.link(episodic, first, second);
        ASSERT_TRUE(result.succeeded()) << result.code() << ": "
                                        << result.message();
    }

    void add_procedure(
        std::string identifier,
        std::string activity,
        std::vector<std::string> steps,
        const std::string_view source_identifier) {
        const auto result = ProceduralMemoryEngine{}.derive(
            procedural,
            evidence,
            Procedure{std::move(identifier),
                      std::move(activity),
                      std::move(steps),
                      {entry(source_identifier)}});
        ASSERT_TRUE(result.succeeded()) << result.code() << ": "
                                        << result.message();
    }

    void link_procedures(const std::string_view first,
                         const std::string_view second) {
        const auto result = ProceduralMemoryEngine{}.link(
            procedural, first, second);
        ASSERT_TRUE(result.succeeded()) << result.code() << ": "
                                        << result.message();
    }

    LongTermMemory evidence;
    SemanticMemory semantic;
    EpisodicMemory episodic;
    ProceduralMemory procedural;
};

[[nodiscard]] SourceStateSnapshot snapshot_of(const Sources& sources) {
    return {sources.semantic.workspaceIdentifier(),
            snapshot_entries(sources.evidence.entries()),
            snapshot_values(sources.semantic.concepts(), [](const auto& value) {
                return snapshot_of(value);
            }),
            snapshot_values(sources.episodic.episodes(), [](const auto& value) {
                return snapshot_of(value);
            }),
            snapshot_values(sources.procedural.procedures(),
                            [](const auto& value) {
                                return snapshot_of(value);
                            })};
}

[[nodiscard]] KnowledgeResult search(Sources& sources,
                                     RetrievalSession& session,
                                     std::string query) {
    return MemoryRetrievalEngine{}.search(
        session,
        sources.semantic,
        sources.episodic,
        sources.procedural,
        KnowledgeQuery{std::move(query)});
}

[[nodiscard]] KnowledgeResult retrieve(Sources& sources,
                                       RetrievalSession& session,
                                       const Kind kind,
                                       const std::string_view identifier) {
    return MemoryRetrievalEngine{}.retrieve(session,
                                            sources.semantic,
                                            sources.episodic,
                                            sources.procedural,
                                            kind,
                                            identifier);
}

[[nodiscard]] const KnowledgeCandidate* find_candidate(
    const std::vector<KnowledgeCandidate>& candidates,
    const Kind kind,
    const std::string_view identifier) {
    for (const auto& candidate : candidates) {
        if (candidate.kind() == kind &&
            candidate.sourceIdentifier() == identifier) {
            return &candidate;
        }
    }
    return nullptr;
}

[[nodiscard]] std::vector<std::string> explanation_of(
    const RetrievalSession& session,
    const Kind kind,
    const std::string_view identifier) {
    const auto result = MemoryRetrievalEngine{}.explain(session, kind, identifier);
    if (!result.succeeded()) {
        throw std::logic_error{"test fixture candidate cannot be explained"};
    }
    return result.explanationChain();
}

[[nodiscard]] SessionSnapshot snapshot_of(const RetrievalSession& session) {
    std::vector<CandidateSnapshot> candidates;
    candidates.reserve(session.candidates().size());
    for (const auto& candidate : session.candidates()) {
        candidates.push_back(snapshot_of(
            candidate,
            explanation_of(session,
                           candidate.kind(),
                           candidate.sourceIdentifier())));
    }
    return {session.workspaceIdentifier(),
            session.started(),
            session.forgotten(),
            std::move(candidates)};
}

void expect_failure(const KnowledgeResult& result,
                    const std::string_view expected_code) {
    EXPECT_FALSE(result.succeeded());
    EXPECT_EQ(result.code(), expected_code);
    EXPECT_FALSE(result.message().empty());
    EXPECT_EQ(result.candidate(), nullptr);
    EXPECT_TRUE(result.candidates().empty());
    EXPECT_TRUE(result.explanationChain().empty());
}

void expect_ok(const KnowledgeResult& result) {
    EXPECT_TRUE(result.succeeded()) << result.code() << ": " << result.message();
    EXPECT_EQ(result.code(), "OK");
    EXPECT_TRUE(result.message().empty());
}

void populate_rich_sources(Sources& sources) {
    sources.retain("source-a", "evidence-a");
    sources.retain("source-b", "evidence-b");
    sources.retain("source-c", "evidence-c");

    sources.add_semantic(
        "shared", "semantic alpha", {"source-a", "source-b"});
    sources.add_semantic("semantic-second", "semantic beta", {"source-c"});
    sources.categorize("shared", "category-0");
    sources.categorize("shared", "category-target");
    sources.link_semantic("shared", "semantic-second");

    sources.add_episode(
        "episode-late", "late occurrence", "late context", 20, {"source-b"});
    sources.add_episode(
        "shared", "early occurrence", "early context", 10, {"source-a"});
    sources.link_episodes("shared", "episode-late");

    sources.add_procedure(
        "procedure-first", "first activity", {"first-step"}, "source-c");
    sources.add_procedure(
        "shared", "shared activity", {"step-0", "step-target"}, "source-a");
    sources.link_procedures("shared", "procedure-first");
}

void expect_single_search(Sources& sources,
                          const std::string_view query,
                          const Kind expected_kind,
                          const std::string_view expected_identifier,
                          const std::uint32_t expected_score,
                          const std::string_view expected_token) {
    RetrievalSession session{"workspace"};
    const auto result = search(sources, session, std::string{query});
    ASSERT_TRUE(result.succeeded()) << result.code() << ": " << result.message();
    ASSERT_EQ(result.candidates().size(), 1U);
    const auto& candidate = result.candidates().front();
    EXPECT_EQ(candidate.kind(), expected_kind);
    EXPECT_EQ(candidate.sourceIdentifier(), expected_identifier);
    EXPECT_EQ(candidate.rankScore(), expected_score);
    EXPECT_EQ(explanation_of(session, expected_kind, expected_identifier),
              std::vector<std::string>{std::string{expected_token}});
}

TEST(KnowledgeRetrievalApiTest, PublicDeclarationsMatchContract) {
    static_assert(std::is_constructible_v<KnowledgeQuery, std::string>);
    static_assert(!std::is_convertible_v<std::string, KnowledgeQuery>);
    static_assert(!std::is_default_constructible_v<KnowledgeCandidate>);
    static_assert(std::is_copy_constructible_v<KnowledgeCandidate>);
    static_assert(std::is_copy_assignable_v<KnowledgeCandidate>);
    static_assert(std::is_nothrow_move_constructible_v<KnowledgeCandidate>);
    static_assert(std::is_nothrow_move_assignable_v<KnowledgeCandidate>);
    static_assert(!std::is_constructible_v<KnowledgeCandidate, SemanticConcept>);
    static_assert(!std::is_constructible_v<KnowledgeCandidate, Episode>);
    static_assert(!std::is_constructible_v<KnowledgeCandidate, Procedure>);
    static_assert(std::is_constructible_v<RetrievalSession, std::string>);
    static_assert(std::is_copy_constructible_v<RetrievalSession>);
    static_assert(!std::is_copy_assignable_v<RetrievalSession>);
    static_assert(std::is_nothrow_move_constructible_v<RetrievalSession>);
    static_assert(!std::is_move_assignable_v<RetrievalSession>);
    static_assert(!std::is_default_constructible_v<KnowledgeResult>);
    static_assert(!std::is_copy_constructible_v<KnowledgeResult>);
    static_assert(!std::is_copy_assignable_v<KnowledgeResult>);
    static_assert(std::is_nothrow_move_constructible_v<KnowledgeResult>);
    static_assert(std::is_nothrow_move_assignable_v<KnowledgeResult>);
    static_assert(std::is_empty_v<MemoryRetrievalEngine>);

    using QueryText = const std::string& (KnowledgeQuery::*)() const noexcept;
    using CandidateKind = Kind (KnowledgeCandidate::*)() const noexcept;
    using CandidateString = const std::string& (
        KnowledgeCandidate::*)() const noexcept;
    using RankScore = std::uint32_t (KnowledgeCandidate::*)() const noexcept;
    using SemanticPayload = const SemanticConcept* (
        KnowledgeCandidate::*)() const noexcept;
    using EpisodePayload = const Episode* (KnowledgeCandidate::*)() const noexcept;
    using ProcedurePayload = const Procedure* (
        KnowledgeCandidate::*)() const noexcept;
    using SessionString = const std::string& (
        RetrievalSession::*)() const noexcept;
    using SessionFlag = bool (RetrievalSession::*)() const noexcept;
    using SessionSize = std::size_t (RetrievalSession::*)() const noexcept;
    using SessionCandidates = const std::vector<KnowledgeCandidate>& (
        RetrievalSession::*)() const noexcept;
    using ResultFlag = bool (KnowledgeResult::*)() const noexcept;
    using ResultString = const std::string& (KnowledgeResult::*)() const noexcept;
    using ResultCandidate = const KnowledgeCandidate* (
        KnowledgeResult::*)() const noexcept;
    using ResultCandidates = const std::vector<KnowledgeCandidate>& (
        KnowledgeResult::*)() const noexcept;
    using Explanation = const std::vector<std::string>& (
        KnowledgeResult::*)() const noexcept;

    static_assert(std::is_same_v<decltype(static_cast<QueryText>(
                                     &KnowledgeQuery::text)),
                                 QueryText>);
    static_assert(std::is_same_v<decltype(static_cast<CandidateKind>(
                                     &KnowledgeCandidate::kind)),
                                 CandidateKind>);
    static_assert(std::is_same_v<decltype(static_cast<CandidateString>(
                                     &KnowledgeCandidate::workspaceIdentifier)),
                                 CandidateString>);
    static_assert(std::is_same_v<decltype(static_cast<CandidateString>(
                                     &KnowledgeCandidate::sourceIdentifier)),
                                 CandidateString>);
    static_assert(std::is_same_v<decltype(static_cast<RankScore>(
                                     &KnowledgeCandidate::rankScore)),
                                 RankScore>);
    static_assert(std::is_same_v<decltype(static_cast<SemanticPayload>(
                                     &KnowledgeCandidate::semanticConcept)),
                                 SemanticPayload>);
    static_assert(std::is_same_v<decltype(static_cast<EpisodePayload>(
                                     &KnowledgeCandidate::episode)),
                                 EpisodePayload>);
    static_assert(std::is_same_v<decltype(static_cast<ProcedurePayload>(
                                     &KnowledgeCandidate::procedure)),
                                 ProcedurePayload>);
    static_assert(std::is_same_v<decltype(static_cast<SessionString>(
                                     &RetrievalSession::workspaceIdentifier)),
                                 SessionString>);
    static_assert(std::is_same_v<decltype(static_cast<SessionFlag>(
                                     &RetrievalSession::started)),
                                 SessionFlag>);
    static_assert(std::is_same_v<decltype(static_cast<SessionFlag>(
                                     &RetrievalSession::forgotten)),
                                 SessionFlag>);
    static_assert(std::is_same_v<decltype(static_cast<SessionSize>(
                                     &RetrievalSession::size)),
                                 SessionSize>);
    static_assert(std::is_same_v<decltype(static_cast<SessionCandidates>(
                                     &RetrievalSession::candidates)),
                                 SessionCandidates>);
    static_assert(std::is_same_v<decltype(static_cast<ResultFlag>(
                                     &KnowledgeResult::succeeded)),
                                 ResultFlag>);
    static_assert(std::is_same_v<decltype(static_cast<ResultString>(
                                     &KnowledgeResult::code)),
                                 ResultString>);
    static_assert(std::is_same_v<decltype(static_cast<ResultString>(
                                     &KnowledgeResult::message)),
                                 ResultString>);
    static_assert(std::is_same_v<decltype(static_cast<ResultCandidate>(
                                     &KnowledgeResult::candidate)),
                                 ResultCandidate>);
    static_assert(std::is_same_v<decltype(static_cast<ResultCandidates>(
                                     &KnowledgeResult::candidates)),
                                 ResultCandidates>);
    static_assert(std::is_same_v<decltype(static_cast<Explanation>(
                                     &KnowledgeResult::explanationChain)),
                                 Explanation>);

    using Retrieve = KnowledgeResult (MemoryRetrievalEngine::*)(
        RetrievalSession&,
        const SemanticMemory&,
        const EpisodicMemory&,
        const ProceduralMemory&,
        Kind,
        std::string_view) const;
    using Search = KnowledgeResult (MemoryRetrievalEngine::*)(
        RetrievalSession&,
        const SemanticMemory&,
        const EpisodicMemory&,
        const ProceduralMemory&,
        const KnowledgeQuery&) const;
    using Filter = KnowledgeResult (MemoryRetrievalEngine::*)(
        RetrievalSession&, const KnowledgeQuery&) const;
    using Rank = KnowledgeResult (MemoryRetrievalEngine::*)(
        RetrievalSession&) const;
    using Explain = KnowledgeResult (MemoryRetrievalEngine::*)(
        const RetrievalSession&, Kind, std::string_view) const;
    using Forget = KnowledgeResult (MemoryRetrievalEngine::*)(
        RetrievalSession&) const;

    static_assert(std::is_same_v<decltype(static_cast<Retrieve>(
                                     &MemoryRetrievalEngine::retrieve)),
                                 Retrieve>);
    static_assert(std::is_same_v<decltype(static_cast<Search>(
                                     &MemoryRetrievalEngine::search)),
                                 Search>);
    static_assert(std::is_same_v<decltype(static_cast<Filter>(
                                     &MemoryRetrievalEngine::filter)),
                                 Filter>);
    static_assert(std::is_same_v<decltype(static_cast<Rank>(
                                     &MemoryRetrievalEngine::rank)),
                                 Rank>);
    static_assert(std::is_same_v<decltype(static_cast<Explain>(
                                     &MemoryRetrievalEngine::explain)),
                                 Explain>);
    static_assert(std::is_same_v<decltype(static_cast<Forget>(
                                     &MemoryRetrievalEngine::forgetSession)),
                                 Forget>);

    EXPECT_NE(Kind::Semantic, Kind::Episodic);
    EXPECT_NE(Kind::Episodic, Kind::Procedural);
    EXPECT_NE(Kind::Semantic, Kind::Procedural);
}

TEST(KnowledgeRetrievalOwnershipTest, WorkspaceAndPristineStateAreExact) {
    EXPECT_THROW((RetrievalSession{""}), std::invalid_argument);

    std::string workspace{"workspace"};
    RetrievalSession session{workspace};
    workspace = "changed";
    EXPECT_EQ(session.workspaceIdentifier(), "workspace");
    EXPECT_FALSE(session.started());
    EXPECT_FALSE(session.forgotten());
    EXPECT_EQ(session.size(), 0U);
    EXPECT_TRUE(session.candidates().empty());

    std::string query_text{"Exact Text"};
    KnowledgeQuery query{query_text};
    query_text = "changed";
    EXPECT_EQ(query.text(), "Exact Text");
    const KnowledgeQuery copy{query};
    EXPECT_EQ(copy.text(), "Exact Text");
}

TEST(KnowledgeRetrievalLifecycleTest,
     ReadyStartedAndForgottenTransitionsAreExact) {
    Sources sources{"workspace"};
    populate_rich_sources(sources);
    MemoryRetrievalEngine engine;

    RetrievalSession failed_start{"workspace"};
    const auto missing = retrieve(
        sources, failed_start, Kind::Semantic, "missing");
    expect_failure(missing, "NOT_FOUND");
    EXPECT_FALSE(failed_start.started());
    EXPECT_FALSE(failed_start.forgotten());
    EXPECT_TRUE(failed_start.candidates().empty());

    const auto zero_match = search(sources, failed_start, "no-match-anywhere");
    expect_ok(zero_match);
    EXPECT_TRUE(failed_start.started());
    EXPECT_FALSE(failed_start.forgotten());
    EXPECT_TRUE(failed_start.candidates().empty());

    const auto zero_match_filter = engine.filter(
        failed_start, KnowledgeQuery{"still-no-match"});
    expect_ok(zero_match_filter);
    EXPECT_TRUE(zero_match_filter.candidates().empty());
    EXPECT_TRUE(failed_start.candidates().empty());
    const auto zero_match_rank = engine.rank(failed_start);
    expect_ok(zero_match_rank);
    EXPECT_TRUE(zero_match_rank.candidates().empty());
    EXPECT_TRUE(failed_start.candidates().empty());
    expect_failure(engine.explain(
                       failed_start, Kind::Semantic, "still-no-match"),
                   "NOT_FOUND");

    const auto repeated_search = search(sources, failed_start, "");
    expect_failure(repeated_search, "SESSION_ALREADY_STARTED");
    const auto repeated_retrieve = retrieve(
        sources, failed_start, Kind::Semantic, "shared");
    expect_failure(repeated_retrieve, "SESSION_ALREADY_STARTED");

    RetrievalSession ready{"workspace"};
    expect_failure(engine.filter(ready, KnowledgeQuery{"x"}),
                   "SESSION_NOT_STARTED");
    expect_failure(engine.rank(ready), "SESSION_NOT_STARTED");
    expect_failure(engine.explain(ready, Kind::Semantic, "shared"),
                   "SESSION_NOT_STARTED");

    const auto forget_ready = engine.forgetSession(ready);
    expect_ok(forget_ready);
    EXPECT_EQ(forget_ready.candidate(), nullptr);
    EXPECT_TRUE(forget_ready.candidates().empty());
    EXPECT_TRUE(forget_ready.explanationChain().empty());
    EXPECT_FALSE(ready.started());
    EXPECT_TRUE(ready.forgotten());
    EXPECT_TRUE(ready.candidates().empty());

    const auto repeat_forget = engine.forgetSession(ready);
    expect_ok(repeat_forget);
    EXPECT_FALSE(ready.started());
    EXPECT_TRUE(ready.forgotten());
    EXPECT_TRUE(ready.candidates().empty());
    expect_failure(search(sources, ready, ""), "SESSION_FORGOTTEN");
    expect_failure(engine.filter(ready, KnowledgeQuery{""}),
                   "SESSION_FORGOTTEN");
    expect_failure(engine.rank(ready), "SESSION_FORGOTTEN");
    expect_failure(engine.explain(ready, Kind::Semantic, "shared"),
                   "SESSION_FORGOTTEN");

    RetrievalSession started{"workspace"};
    ASSERT_TRUE(search(sources, started, "").succeeded());
    ASSERT_FALSE(started.candidates().empty());
    expect_ok(engine.forgetSession(started));
    EXPECT_FALSE(started.started());
    EXPECT_TRUE(started.forgotten());
    EXPECT_TRUE(started.candidates().empty());
}

TEST(KnowledgeRetrievalRetrieveTest,
     AllKindsPreserveCompleteTypedSnapshots) {
    Sources sources{"workspace"};
    populate_rich_sources(sources);
    const auto sources_before = snapshot_of(sources);

    {
        RetrievalSession session{"workspace"};
        const auto result = retrieve(sources, session, Kind::Semantic, "shared");
        expect_ok(result);
        ASSERT_NE(result.candidate(), nullptr);
        EXPECT_TRUE(result.candidates().empty());
        EXPECT_TRUE(result.explanationChain().empty());
        const auto& candidate = *result.candidate();
        EXPECT_EQ(candidate.kind(), Kind::Semantic);
        EXPECT_EQ(candidate.workspaceIdentifier(), "workspace");
        EXPECT_EQ(candidate.sourceIdentifier(), "shared");
        EXPECT_EQ(candidate.rankScore(), 4U);
        ASSERT_NE(candidate.semanticConcept(), nullptr);
        EXPECT_EQ(candidate.episode(), nullptr);
        EXPECT_EQ(candidate.procedure(), nullptr);
        ASSERT_NE(sources.semantic.find("shared"), nullptr);
        EXPECT_EQ(snapshot_of(*candidate.semanticConcept()),
                  snapshot_of(*sources.semantic.find("shared")));
        EXPECT_EQ(explanation_of(session, Kind::Semantic, "shared"),
                  std::vector<std::string>{"retrieve:identifier-exact"});
    }

    {
        RetrievalSession session{"workspace"};
        const auto result = retrieve(sources, session, Kind::Episodic, "shared");
        expect_ok(result);
        ASSERT_NE(result.candidate(), nullptr);
        const auto& candidate = *result.candidate();
        EXPECT_EQ(candidate.kind(), Kind::Episodic);
        EXPECT_EQ(candidate.sourceIdentifier(), "shared");
        EXPECT_EQ(candidate.rankScore(), 4U);
        EXPECT_EQ(candidate.semanticConcept(), nullptr);
        ASSERT_NE(candidate.episode(), nullptr);
        EXPECT_EQ(candidate.procedure(), nullptr);
        ASSERT_NE(sources.episodic.find("shared"), nullptr);
        EXPECT_EQ(snapshot_of(*candidate.episode()),
                  snapshot_of(*sources.episodic.find("shared")));
        EXPECT_EQ(explanation_of(session, Kind::Episodic, "shared"),
                  std::vector<std::string>{"retrieve:identifier-exact"});
    }

    {
        RetrievalSession session{"workspace"};
        const auto result = retrieve(sources, session, Kind::Procedural, "shared");
        expect_ok(result);
        ASSERT_NE(result.candidate(), nullptr);
        const auto& candidate = *result.candidate();
        EXPECT_EQ(candidate.kind(), Kind::Procedural);
        EXPECT_EQ(candidate.sourceIdentifier(), "shared");
        EXPECT_EQ(candidate.rankScore(), 4U);
        EXPECT_EQ(candidate.semanticConcept(), nullptr);
        EXPECT_EQ(candidate.episode(), nullptr);
        ASSERT_NE(candidate.procedure(), nullptr);
        ASSERT_NE(sources.procedural.find("shared"), nullptr);
        EXPECT_EQ(snapshot_of(*candidate.procedure()),
                  snapshot_of(*sources.procedural.find("shared")));
        EXPECT_EQ(explanation_of(session, Kind::Procedural, "shared"),
                  std::vector<std::string>{"retrieve:identifier-exact"});
    }

    EXPECT_EQ(snapshot_of(sources), sources_before);
}

TEST(KnowledgeRetrievalRetrieveTest,
     AbsentAndForgottenSourcesAreNotFoundForEveryKind) {
    Sources absent_sources{"workspace"};
    populate_rich_sources(absent_sources);
    const auto absent_sources_before = snapshot_of(absent_sources);
    for (const auto kind : {Kind::Semantic, Kind::Episodic, Kind::Procedural}) {
        RetrievalSession session{"workspace"};
        const auto ready_before = snapshot_of(session);
        const auto result = retrieve(absent_sources, session, kind, "absent");
        expect_failure(result, "NOT_FOUND");
        EXPECT_EQ(snapshot_of(session), ready_before);
    }
    EXPECT_EQ(snapshot_of(absent_sources), absent_sources_before);

    const auto expect_forgotten_not_found = [](Sources& sources,
                                               const Kind kind) {
        const auto sources_before = snapshot_of(sources);
        RetrievalSession session{"workspace"};
        const auto ready_before = snapshot_of(session);
        const auto result = retrieve(sources, session, kind, "shared");
        expect_failure(result, "NOT_FOUND");
        EXPECT_EQ(snapshot_of(session), ready_before);
        EXPECT_EQ(snapshot_of(sources), sources_before);
    };

    {
        Sources sources{"workspace"};
        populate_rich_sources(sources);
        ASSERT_TRUE(SemanticMemoryEngine{}.forget(sources.semantic, "shared")
                        .succeeded());
        ASSERT_NE(sources.episodic.find("shared"), nullptr);
        ASSERT_NE(sources.procedural.find("shared"), nullptr);
        expect_forgotten_not_found(sources, Kind::Semantic);
    }
    {
        Sources sources{"workspace"};
        populate_rich_sources(sources);
        ASSERT_TRUE(EpisodicMemoryEngine{}.forget(sources.episodic, "shared")
                        .succeeded());
        ASSERT_NE(sources.semantic.find("shared"), nullptr);
        ASSERT_NE(sources.procedural.find("shared"), nullptr);
        expect_forgotten_not_found(sources, Kind::Episodic);
    }
    {
        Sources sources{"workspace"};
        populate_rich_sources(sources);
        ASSERT_TRUE(ProceduralMemoryEngine{}
                        .forget(sources.procedural, "shared")
                        .succeeded());
        ASSERT_NE(sources.semantic.find("shared"), nullptr);
        ASSERT_NE(sources.episodic.find("shared"), nullptr);
        expect_forgotten_not_found(sources, Kind::Procedural);
    }
}

TEST(KnowledgeRetrievalIdentityTest, CompositeIdentityDistinguishesKinds) {
    Sources sources{"workspace"};
    populate_rich_sources(sources);
    RetrievalSession session{"workspace"};
    const auto result = search(sources, session, "shared");
    expect_ok(result);

    const auto* semantic = find_candidate(
        result.candidates(), Kind::Semantic, "shared");
    const auto* episodic = find_candidate(
        result.candidates(), Kind::Episodic, "shared");
    const auto* procedural = find_candidate(
        result.candidates(), Kind::Procedural, "shared");
    ASSERT_NE(semantic, nullptr);
    ASSERT_NE(episodic, nullptr);
    ASSERT_NE(procedural, nullptr);
    EXPECT_NE(semantic->semanticConcept(), nullptr);
    EXPECT_NE(episodic->episode(), nullptr);
    EXPECT_NE(procedural->procedure(), nullptr);
}

TEST(KnowledgeRetrievalOrderingTest, EmptySearchUsesCanonicalCrossKindOrder) {
    Sources sources{"workspace"};
    populate_rich_sources(sources);
    RetrievalSession session{"workspace"};
    const auto result = search(sources, session, "");
    expect_ok(result);
    EXPECT_EQ(result.candidate(), nullptr);
    EXPECT_TRUE(result.explanationChain().empty());
    ASSERT_EQ(result.candidates().size(), 6U);
    ASSERT_EQ(session.size(), 6U);

    const std::vector<std::pair<Kind, std::string>> expected{
        {Kind::Semantic, "shared"},
        {Kind::Semantic, "semantic-second"},
        {Kind::Episodic, "shared"},
        {Kind::Episodic, "episode-late"},
        {Kind::Procedural, "procedure-first"},
        {Kind::Procedural, "shared"}};
    for (std::size_t index = 0; index < expected.size(); ++index) {
        EXPECT_EQ(result.candidates()[index].kind(), expected[index].first);
        EXPECT_EQ(result.candidates()[index].sourceIdentifier(),
                  expected[index].second);
        EXPECT_EQ(result.candidates()[index].rankScore(), 0U);
        EXPECT_EQ(explanation_of(session,
                                 expected[index].first,
                                 expected[index].second),
                  std::vector<std::string>{"search:empty-query"});
    }
}

TEST(KnowledgeRetrievalOrderingTest,
     EqualChronologyPreservesReleasedEpisodeOrder) {
    Sources sources{"workspace"};
    sources.retain("source", "evidence");
    sources.add_semantic("semantic", "meaning", {"source"});
    sources.add_episode(
        "episode-early", "early", "context", 5, {"source"});
    sources.add_episode(
        "episode-tie-first", "tie first", "context", 10, {"source"});
    sources.add_episode(
        "episode-tie-second", "tie second", "context", 10, {"source"});
    sources.add_episode(
        "episode-late", "late", "context", 20, {"source"});
    sources.add_procedure(
        "procedure", "activity", {"step"}, "source");

    const std::vector<std::string> released_episode_order{
        "episode-early",
        "episode-tie-first",
        "episode-tie-second",
        "episode-late"};
    ASSERT_EQ(sources.episodic.episodes().size(),
              released_episode_order.size());
    for (std::size_t index = 0; index < released_episode_order.size(); ++index) {
        EXPECT_EQ(sources.episodic.episodes()[index].identifier(),
                  released_episode_order[index]);
    }
    EXPECT_EQ(sources.episodic.episodes()[1].chronology(), 10);
    EXPECT_EQ(sources.episodic.episodes()[2].chronology(), 10);

    RetrievalSession session{"workspace"};
    const auto result = search(sources, session, "");
    expect_ok(result);
    ASSERT_EQ(result.candidates().size(), 6U);
    const std::vector<std::pair<Kind, std::string>> expected{
        {Kind::Semantic, "semantic"},
        {Kind::Episodic, "episode-early"},
        {Kind::Episodic, "episode-tie-first"},
        {Kind::Episodic, "episode-tie-second"},
        {Kind::Episodic, "episode-late"},
        {Kind::Procedural, "procedure"}};
    for (std::size_t index = 0; index < expected.size(); ++index) {
        EXPECT_EQ(result.candidates()[index].kind(), expected[index].first);
        EXPECT_EQ(result.candidates()[index].sourceIdentifier(),
                  expected[index].second);
    }
}

TEST(KnowledgeRetrievalMatchingTest, ScoreTiersAndFieldPrecedenceAreExact) {
    Sources sources{"workspace"};
    sources.retain("source", "evidence");
    sources.add_semantic("semantic-identifier-exact",
                         "semantic-meaning-exact",
                         {"source"});
    sources.categorize("semantic-identifier-exact", "semantic-category-first");
    sources.categorize("semantic-identifier-exact", "semantic-category-target");
    sources.add_semantic("prefix-shared-suffix", "shared", {"source"});
    sources.add_semantic("duplicate-semantic",
                         "duplicate-semantic-field",
                         {"source"});
    sources.categorize("duplicate-semantic", "duplicate-semantic-field");
    sources.add_episode("episode-id",
                        "episode-occurrence-exact",
                        "episode-context-exact",
                        11,
                        {"source"});
    sources.add_episode("episode-duplicate",
                        "duplicate-episode-field",
                        "duplicate-episode-field",
                        12,
                        {"source"});
    sources.add_procedure("procedure-id",
                          "procedure-activity-exact",
                          {"procedure-step-first", "procedure-step-target"},
                          "source");

    expect_single_search(sources,
                         "semantic-identifier-exact",
                         Kind::Semantic,
                         "semantic-identifier-exact",
                         4U,
                         "search:identifier-exact");
    expect_single_search(sources,
                         "identifier-exact",
                         Kind::Semantic,
                         "semantic-identifier-exact",
                         3U,
                         "search:identifier-substring");
    expect_single_search(sources,
                         "semantic-meaning-exact",
                         Kind::Semantic,
                         "semantic-identifier-exact",
                         2U,
                         "search:content-exact:meaning");
    expect_single_search(sources,
                         "meaning-exact",
                         Kind::Semantic,
                         "semantic-identifier-exact",
                         1U,
                         "search:content-substring:meaning");
    expect_single_search(sources,
                         "semantic-category-target",
                         Kind::Semantic,
                         "semantic-identifier-exact",
                         2U,
                         "search:content-exact:category[1]");
    expect_single_search(sources,
                         "category-target",
                         Kind::Semantic,
                         "semantic-identifier-exact",
                         1U,
                         "search:content-substring:category[1]");
    expect_single_search(sources,
                         "episode-occurrence-exact",
                         Kind::Episodic,
                         "episode-id",
                         2U,
                         "search:content-exact:occurrence");
    expect_single_search(sources,
                         "episode-context-exact",
                         Kind::Episodic,
                         "episode-id",
                         2U,
                         "search:content-exact:context");
    expect_single_search(sources,
                         "procedure-activity-exact",
                         Kind::Procedural,
                         "procedure-id",
                         2U,
                         "search:content-exact:activity");
    expect_single_search(sources,
                         "procedure-step-target",
                         Kind::Procedural,
                         "procedure-id",
                         2U,
                         "search:content-exact:step[1]");
    expect_single_search(sources,
                         "shared",
                         Kind::Semantic,
                         "prefix-shared-suffix",
                         3U,
                         "search:identifier-substring");
    expect_single_search(sources,
                         "duplicate-semantic-field",
                         Kind::Semantic,
                         "duplicate-semantic",
                         2U,
                         "search:content-exact:meaning");
    expect_single_search(sources,
                         "duplicate-episode-field",
                         Kind::Episodic,
                         "episode-duplicate",
                         2U,
                         "search:content-exact:occurrence");
}

TEST(KnowledgeRetrievalMatchingTest,
     QueryOwnershipCaseAndLiteralRulesAreExact) {
    Sources sources{"workspace"};
    sources.retain("source", "evidence");
    sources.add_semantic("case-source", "CaseSensitive", {"source"});

    RetrievalSession exact_session{"workspace"};
    const KnowledgeQuery exact_query{"CaseSensitive"};
    const auto exact = MemoryRetrievalEngine{}.search(
        exact_session,
        sources.semantic,
        sources.episodic,
        sources.procedural,
        exact_query);
    expect_ok(exact);
    ASSERT_EQ(exact.candidates().size(), 1U);

    RetrievalSession wrong_case_session{"workspace"};
    const auto wrong_case = search(sources, wrong_case_session, "casesensitive");
    expect_ok(wrong_case);
    EXPECT_TRUE(wrong_case.candidates().empty());

    RetrievalSession no_tokenization_session{"workspace"};
    const auto no_tokenization = search(
        sources, no_tokenization_session, "Case Sensitive");
    expect_ok(no_tokenization);
    EXPECT_TRUE(no_tokenization.candidates().empty());
}

TEST(KnowledgeRetrievalMatchingTest, IncludedAndExcludedFieldsAreExact) {
    Sources sources{"workspace"};
    sources.retain("provenance-only-id", "provenance-only-value");
    sources.add_semantic(
        "semantic-origin", "semantic-visible", {"provenance-only-id"});
    sources.add_semantic(
        "semantic-link-target", "target-visible", {"provenance-only-id"});
    sources.link_semantic("semantic-origin", "semantic-link-target");
    sources.add_episode("episode-origin",
                        "episode-visible",
                        "episode-context-visible",
                        31415,
                        {"provenance-only-id"});
    sources.add_episode("episode-link-target",
                        "episode-target-visible",
                        "episode-target-context",
                        31416,
                        {"provenance-only-id"});
    sources.link_episodes("episode-origin", "episode-link-target");
    sources.add_procedure("procedure-origin",
                          "procedure-visible",
                          {"step-visible"},
                          "provenance-only-id");
    sources.add_procedure("procedure-link-target",
                          "procedure-target-visible",
                          {"target-step"},
                          "provenance-only-id");
    sources.link_procedures("procedure-origin", "procedure-link-target");

    for (const auto query : {"provenance-only-id",
                             "provenance-only-value",
                             "31415"}) {
        RetrievalSession session{"workspace"};
        const auto result = search(sources, session, query);
        expect_ok(result);
        EXPECT_TRUE(result.candidates().empty()) << query;
    }

    RetrievalSession link_session{"workspace"};
    const auto link_result = search(
        sources, link_session, "semantic-link-target");
    expect_ok(link_result);
    ASSERT_EQ(link_result.candidates().size(), 1U);
    EXPECT_EQ(link_result.candidates().front().sourceIdentifier(),
              "semantic-link-target");
    EXPECT_EQ(find_candidate(link_result.candidates(),
                             Kind::Semantic,
                             "semantic-origin"),
              nullptr);

    RetrievalSession episode_link_session{"workspace"};
    const auto episode_link_result = search(
        sources, episode_link_session, "episode-link-target");
    expect_ok(episode_link_result);
    ASSERT_EQ(episode_link_result.candidates().size(), 1U);
    EXPECT_EQ(episode_link_result.candidates().front().kind(),
              Kind::Episodic);
    EXPECT_EQ(episode_link_result.candidates().front().sourceIdentifier(),
              "episode-link-target");
    EXPECT_EQ(find_candidate(episode_link_result.candidates(),
                             Kind::Episodic,
                             "episode-origin"),
              nullptr);

    RetrievalSession procedure_link_session{"workspace"};
    const auto procedure_link_result = search(
        sources, procedure_link_session, "procedure-link-target");
    expect_ok(procedure_link_result);
    ASSERT_EQ(procedure_link_result.candidates().size(), 1U);
    EXPECT_EQ(procedure_link_result.candidates().front().kind(),
              Kind::Procedural);
    EXPECT_EQ(procedure_link_result.candidates().front().sourceIdentifier(),
              "procedure-link-target");
    EXPECT_EQ(find_candidate(procedure_link_result.candidates(),
                             Kind::Procedural,
                             "procedure-origin"),
              nullptr);

    for (const auto query : {"provenance-only-id",
                             "provenance-only-value",
                             "31415"}) {
        SCOPED_TRACE(query);
        RetrievalSession session{"workspace"};
        ASSERT_TRUE(search(sources, session, "").succeeded());
        const auto filtered = MemoryRetrievalEngine{}.filter(
            session, KnowledgeQuery{query});
        expect_ok(filtered);
        EXPECT_TRUE(filtered.candidates().empty());
        EXPECT_TRUE(session.candidates().empty());
    }

    struct LinkFilterCase final {
        std::string query;
        Kind kind;
        std::string target;
        std::string origin;
    };
    const std::vector<LinkFilterCase> link_filter_cases{
        {"semantic-link-target",
         Kind::Semantic,
         "semantic-link-target",
         "semantic-origin"},
        {"episode-link-target",
         Kind::Episodic,
         "episode-link-target",
         "episode-origin"},
        {"procedure-link-target",
         Kind::Procedural,
         "procedure-link-target",
         "procedure-origin"}};
    for (const auto& test_case : link_filter_cases) {
        SCOPED_TRACE(test_case.query);
        RetrievalSession session{"workspace"};
        ASSERT_TRUE(search(sources, session, "").succeeded());
        const auto filtered = MemoryRetrievalEngine{}.filter(
            session, KnowledgeQuery{test_case.query});
        expect_ok(filtered);
        ASSERT_EQ(filtered.candidates().size(), 1U);
        EXPECT_EQ(filtered.candidates().front().kind(), test_case.kind);
        EXPECT_EQ(filtered.candidates().front().sourceIdentifier(),
                  test_case.target);
        EXPECT_EQ(find_candidate(filtered.candidates(),
                                 test_case.kind,
                                 test_case.origin),
                  nullptr);
    }
}

TEST(KnowledgeRetrievalFilterTest, NarrowsSnapshotsWithoutRereadingSources) {
    Sources sources{"workspace"};
    populate_rich_sources(sources);
    RetrievalSession session{"workspace"};
    const auto initial = search(sources, session, "");
    ASSERT_TRUE(initial.succeeded());
    ASSERT_EQ(initial.candidates().size(), 6U);
    const auto initial_result_snapshot = snapshot_of(initial);

    const auto filter = MemoryRetrievalEngine{}.filter(
        session, KnowledgeQuery{"alpha"});
    expect_ok(filter);
    EXPECT_EQ(filter.candidate(), nullptr);
    EXPECT_TRUE(filter.explanationChain().empty());
    ASSERT_EQ(filter.candidates().size(), 1U);
    EXPECT_EQ(filter.candidates().front().kind(), Kind::Semantic);
    EXPECT_EQ(filter.candidates().front().sourceIdentifier(), "shared");
    EXPECT_EQ(filter.candidates().front().rankScore(), 1U);
    EXPECT_EQ(explanation_of(session, Kind::Semantic, "shared"),
              (std::vector<std::string>{
                  "search:empty-query",
                  "filter:content-substring:meaning"}));

    const auto update = SemanticMemoryEngine{}.update(
        sources.semantic, "shared", "changed live meaning");
    ASSERT_TRUE(update.succeeded());
    sources.add_semantic("new-live-match", "semantic alpha", {"source-a"});

    const auto second_filter = MemoryRetrievalEngine{}.filter(
        session, KnowledgeQuery{"alpha"});
    expect_ok(second_filter);
    ASSERT_EQ(second_filter.candidates().size(), 1U);
    EXPECT_EQ(second_filter.candidates().front().sourceIdentifier(), "shared");
    ASSERT_NE(second_filter.candidates().front().semanticConcept(), nullptr);
    EXPECT_EQ(second_filter.candidates().front().semanticConcept()->meaning(),
              "semantic alpha");
    EXPECT_EQ(explanation_of(session, Kind::Semantic, "shared"),
              (std::vector<std::string>{
                  "search:empty-query",
                  "filter:content-substring:meaning",
                  "filter:content-substring:meaning"}));
    EXPECT_EQ(snapshot_of(initial), initial_result_snapshot);

    RetrievalSession empty_filter_session{"workspace"};
    ASSERT_TRUE(search(sources, empty_filter_session, "").succeeded());
    const auto before = empty_filter_session.size();
    const auto empty_filter = MemoryRetrievalEngine{}.filter(
        empty_filter_session, KnowledgeQuery{""});
    expect_ok(empty_filter);
    EXPECT_EQ(empty_filter_session.size(), before);
    for (const auto& candidate : empty_filter_session.candidates()) {
        EXPECT_EQ(candidate.rankScore(), 0U);
        const auto chain = explanation_of(empty_filter_session,
                                          candidate.kind(),
                                          candidate.sourceIdentifier());
        ASSERT_GE(chain.size(), 2U);
        EXPECT_EQ(chain[chain.size() - 1U], "filter:empty-query");
    }
}

TEST(KnowledgeRetrievalFilterTest, MissingTokenTiersAreExact) {
    Sources sources{"workspace"};
    sources.retain("source", "evidence");
    sources.add_semantic("needle", "other", {"source"});
    sources.add_semantic("prefix-needle-suffix", "other", {"source"});
    sources.add_semantic("content", "needle", {"source"});

    RetrievalSession filter_session{"workspace"};
    ASSERT_TRUE(search(sources, filter_session, "").succeeded());
    const auto filtered = MemoryRetrievalEngine{}.filter(
        filter_session, KnowledgeQuery{"needle"});
    expect_ok(filtered);
    ASSERT_EQ(filtered.candidates().size(), 3U);
    EXPECT_EQ(explanation_of(filter_session, Kind::Semantic, "needle"),
              (std::vector<std::string>{
                  "search:empty-query", "filter:identifier-exact"}));
    EXPECT_EQ(explanation_of(filter_session,
                             Kind::Semantic,
                             "prefix-needle-suffix"),
              (std::vector<std::string>{
                  "search:empty-query", "filter:identifier-substring"}));
    EXPECT_EQ(explanation_of(filter_session, Kind::Semantic, "content"),
              (std::vector<std::string>{
                  "search:empty-query",
                  "filter:content-exact:meaning"}));

    RetrievalSession rank_session{"workspace"};
    ASSERT_TRUE(search(sources, rank_session, "").succeeded());
    const auto ranked = MemoryRetrievalEngine{}.rank(rank_session);
    expect_ok(ranked);
    ASSERT_EQ(ranked.candidates().size(), 3U);
    for (const auto& candidate : ranked.candidates()) {
        EXPECT_EQ(candidate.rankScore(), 0U);
        EXPECT_EQ(explanation_of(rank_session,
                                 candidate.kind(),
                                 candidate.sourceIdentifier()),
                  (std::vector<std::string>{
                      "search:empty-query",
                      "rank:score:0",
                      "rank:stable-tie"}));
    }
}

TEST(KnowledgeRetrievalFilterTest,
     IncludedFieldsAcrossKindsAreExactAndStable) {
    Sources sources{"workspace"};
    sources.retain("source", "evidence");
    sources.add_episode("episode-first",
                        "occurrence-target",
                        "context-target",
                        1,
                        {"source"});
    sources.add_episode("episode-second",
                        "occurrence-target",
                        "context-target",
                        2,
                        {"source"});
    sources.add_procedure("procedure-first",
                          "activity-target",
                          {"skip", "step-target"},
                          "source");
    sources.add_procedure("procedure-second",
                          "activity-target",
                          {"step-target"},
                          "source");
    const auto sources_before = snapshot_of(sources);

    struct FilterCase final {
        std::string query;
        Kind kind;
        std::vector<std::string> identifiers;
        std::vector<std::string> tokens;
    };
    const std::vector<FilterCase> cases{
        {"occurrence-target",
         Kind::Episodic,
         {"episode-first", "episode-second"},
         {"filter:content-exact:occurrence",
          "filter:content-exact:occurrence"}},
        {"context-target",
         Kind::Episodic,
         {"episode-first", "episode-second"},
         {"filter:content-exact:context",
          "filter:content-exact:context"}},
        {"activity-target",
         Kind::Procedural,
         {"procedure-first", "procedure-second"},
         {"filter:content-exact:activity",
          "filter:content-exact:activity"}},
        {"step-target",
         Kind::Procedural,
         {"procedure-first", "procedure-second"},
         {"filter:content-exact:step[1]",
          "filter:content-exact:step[0]"}}};

    for (const auto& test_case : cases) {
        SCOPED_TRACE(test_case.query);
        RetrievalSession session{"workspace"};
        ASSERT_TRUE(search(sources, session, "").succeeded());
        const auto filtered = MemoryRetrievalEngine{}.filter(
            session, KnowledgeQuery{test_case.query});
        expect_ok(filtered);
        ASSERT_EQ(filtered.candidates().size(),
                  test_case.identifiers.size());
        for (std::size_t index = 0; index < test_case.identifiers.size();
             ++index) {
            EXPECT_EQ(filtered.candidates()[index].kind(), test_case.kind);
            EXPECT_EQ(filtered.candidates()[index].sourceIdentifier(),
                      test_case.identifiers[index]);
            EXPECT_EQ(filtered.candidates()[index].rankScore(), 2U);
            EXPECT_EQ(explanation_of(session,
                                     test_case.kind,
                                     test_case.identifiers[index]),
                      (std::vector<std::string>{
                          "search:empty-query", test_case.tokens[index]}));
        }
    }
    EXPECT_EQ(snapshot_of(sources), sources_before);
}

TEST(KnowledgeRetrievalRankTest,
     StableDescendingScoresAndTieTokensAreExact) {
    Sources sources{"workspace"};
    sources.retain("source", "evidence");
    sources.add_semantic("content-a", "q", {"source"});
    sources.add_semantic("middle-q-value", "none", {"source"});
    sources.add_semantic("q", "none", {"source"});
    sources.add_semantic("content-b", "q", {"source"});
    sources.add_semantic("content-c", "before-q-after", {"source"});

    RetrievalSession session{"workspace"};
    const auto initial = search(sources, session, "q");
    ASSERT_TRUE(initial.succeeded());
    ASSERT_EQ(initial.candidates().size(), 5U);
    const std::vector<std::string> initial_order{
        "content-a", "middle-q-value", "q", "content-b", "content-c"};
    for (std::size_t index = 0; index < initial_order.size(); ++index) {
        EXPECT_EQ(initial.candidates()[index].sourceIdentifier(),
                  initial_order[index]);
    }

    const auto ranked = MemoryRetrievalEngine{}.rank(session);
    expect_ok(ranked);
    EXPECT_EQ(ranked.candidate(), nullptr);
    EXPECT_TRUE(ranked.explanationChain().empty());
    ASSERT_EQ(ranked.candidates().size(), 5U);
    const std::vector<std::string> ranked_order{
        "q", "middle-q-value", "content-a", "content-b", "content-c"};
    const std::vector<std::uint32_t> ranked_scores{4U, 3U, 2U, 2U, 1U};
    for (std::size_t index = 0; index < ranked_order.size(); ++index) {
        EXPECT_EQ(ranked.candidates()[index].sourceIdentifier(),
                  ranked_order[index]);
        EXPECT_EQ(ranked.candidates()[index].rankScore(), ranked_scores[index]);
    }

    EXPECT_EQ(explanation_of(session, Kind::Semantic, "q"),
              (std::vector<std::string>{
                  "search:identifier-exact", "rank:score:4"}));
    EXPECT_EQ(explanation_of(session, Kind::Semantic, "content-a"),
              (std::vector<std::string>{
                  "search:content-exact:meaning",
                  "rank:score:2",
                  "rank:stable-tie"}));
    EXPECT_EQ(explanation_of(session, Kind::Semantic, "content-b"),
              (std::vector<std::string>{
                  "search:content-exact:meaning",
                  "rank:score:2",
                  "rank:stable-tie"}));
    EXPECT_EQ(explanation_of(session, Kind::Semantic, "content-c"),
              (std::vector<std::string>{
                  "search:content-substring:meaning", "rank:score:1"}));

    const auto repeated = MemoryRetrievalEngine{}.rank(session);
    expect_ok(repeated);
    for (std::size_t index = 0; index < ranked_order.size(); ++index) {
        EXPECT_EQ(repeated.candidates()[index].sourceIdentifier(),
                  ranked_order[index]);
        EXPECT_EQ(repeated.candidates()[index].rankScore(), ranked_scores[index]);
    }
    EXPECT_EQ(explanation_of(session, Kind::Semantic, "content-a"),
              (std::vector<std::string>{
                  "search:content-exact:meaning",
                  "rank:score:2",
                  "rank:stable-tie",
                  "rank:score:2",
                  "rank:stable-tie"}));
}

TEST(KnowledgeRetrievalFilterTest,
     FilteringAfterRankPreservesPriorChainAndOrder) {
    Sources sources{"workspace"};
    sources.retain("source", "evidence");
    sources.add_semantic("content-a", "q", {"source"});
    sources.add_semantic("middle-q-value", "other", {"source"});
    sources.add_semantic("q", "other", {"source"});
    sources.add_semantic("content-b", "q", {"source"});
    sources.add_semantic("content-c", "before-q-after", {"source"});
    for (const auto identifier : {"content-a",
                                  "middle-q-value",
                                  "q",
                                  "content-b",
                                  "content-c"}) {
        sources.categorize(identifier, "retain");
    }

    RetrievalSession session{"workspace"};
    ASSERT_TRUE(search(sources, session, "q").succeeded());
    const auto ranked = MemoryRetrievalEngine{}.rank(session);
    expect_ok(ranked);
    const auto ranked_result_before = snapshot_of(ranked);
    const auto sources_before = snapshot_of(sources);

    const auto filtered = MemoryRetrievalEngine{}.filter(
        session, KnowledgeQuery{"retain"});
    expect_ok(filtered);
    ASSERT_EQ(filtered.candidates().size(), 5U);

    const std::vector<std::string> expected_order{
        "q", "middle-q-value", "content-a", "content-b", "content-c"};
    for (std::size_t index = 0; index < expected_order.size(); ++index) {
        EXPECT_EQ(filtered.candidates()[index].sourceIdentifier(),
                  expected_order[index]);
        EXPECT_EQ(filtered.candidates()[index].rankScore(), 2U);
        EXPECT_EQ(session.candidates()[index].sourceIdentifier(),
                  expected_order[index]);
        EXPECT_EQ(session.candidates()[index].rankScore(), 2U);
    }

    EXPECT_EQ(explanation_of(session, Kind::Semantic, "q"),
              (std::vector<std::string>{
                  "search:identifier-exact",
                  "rank:score:4",
                  "filter:content-exact:category[0]"}));
    EXPECT_EQ(explanation_of(session, Kind::Semantic, "middle-q-value"),
              (std::vector<std::string>{
                  "search:identifier-substring",
                  "rank:score:3",
                  "filter:content-exact:category[0]"}));
    EXPECT_EQ(explanation_of(session, Kind::Semantic, "content-a"),
              (std::vector<std::string>{
                  "search:content-exact:meaning",
                  "rank:score:2",
                  "rank:stable-tie",
                  "filter:content-exact:category[0]"}));
    EXPECT_EQ(explanation_of(session, Kind::Semantic, "content-b"),
              (std::vector<std::string>{
                  "search:content-exact:meaning",
                  "rank:score:2",
                  "rank:stable-tie",
                  "filter:content-exact:category[0]"}));
    EXPECT_EQ(explanation_of(session, Kind::Semantic, "content-c"),
              (std::vector<std::string>{
                  "search:content-substring:meaning",
                  "rank:score:1",
                  "filter:content-exact:category[0]"}));
    EXPECT_EQ(snapshot_of(ranked), ranked_result_before);
    EXPECT_EQ(snapshot_of(sources), sources_before);
}

TEST(KnowledgeRetrievalExplainTest, CompositeLookupIsConstAndExact) {
    Sources sources{"workspace"};
    populate_rich_sources(sources);
    RetrievalSession session{"workspace"};
    ASSERT_TRUE(search(sources, session, "").succeeded());
    const auto before = snapshot_of(session);

    for (const auto kind : {Kind::Semantic, Kind::Episodic, Kind::Procedural}) {
        const auto result = MemoryRetrievalEngine{}.explain(
            session, kind, "shared");
        expect_ok(result);
        ASSERT_NE(result.candidate(), nullptr);
        EXPECT_EQ(result.candidate()->kind(), kind);
        EXPECT_EQ(result.candidate()->sourceIdentifier(), "shared");
        EXPECT_TRUE(result.candidates().empty());
        EXPECT_EQ(result.explanationChain(),
                  std::vector<std::string>{"search:empty-query"});
    }
    EXPECT_EQ(snapshot_of(session), before);

    const auto filtered = MemoryRetrievalEngine{}.filter(
        session, KnowledgeQuery{"semantic alpha"});
    ASSERT_TRUE(filtered.succeeded());
    expect_failure(MemoryRetrievalEngine{}.explain(
                       session, Kind::Episodic, "shared"),
                   "NOT_FOUND");
}

TEST(KnowledgeRetrievalPrecedenceTest,
     WorkspaceChecksPrecedeKeyValidation) {
    Sources valid{"workspace"};
    populate_rich_sources(valid);
    SemanticMemory wrong_semantic{"other-semantic"};
    EpisodicMemory wrong_episodic{"other-episodic"};
    ProceduralMemory wrong_procedural{"other-procedural"};
    const auto invalid_kind = static_cast<Kind>(999);
    MemoryRetrievalEngine engine;

    {
        RetrievalSession session{"workspace"};
        expect_failure(engine.retrieve(session,
                                       wrong_semantic,
                                       wrong_episodic,
                                       wrong_procedural,
                                       invalid_kind,
                                       ""),
                       "WORKSPACE_MISMATCH");
    }
    {
        RetrievalSession session{"workspace"};
        expect_failure(engine.retrieve(session,
                                       valid.semantic,
                                       wrong_episodic,
                                       wrong_procedural,
                                       invalid_kind,
                                       ""),
                       "WORKSPACE_MISMATCH");
    }
    {
        RetrievalSession session{"workspace"};
        expect_failure(engine.retrieve(session,
                                       valid.semantic,
                                       valid.episodic,
                                       wrong_procedural,
                                       invalid_kind,
                                       ""),
                       "WORKSPACE_MISMATCH");
    }
    {
        RetrievalSession session{"workspace"};
        expect_failure(engine.search(session,
                                     wrong_semantic,
                                     wrong_episodic,
                                     wrong_procedural,
                                     KnowledgeQuery{""}),
                       "WORKSPACE_MISMATCH");
    }
    {
        RetrievalSession session{"workspace"};
        expect_failure(engine.search(session,
                                     valid.semantic,
                                     wrong_episodic,
                                     valid.procedural,
                                     KnowledgeQuery{""}),
                       "WORKSPACE_MISMATCH");
    }
    {
        RetrievalSession session{"workspace"};
        expect_failure(engine.search(session,
                                     valid.semantic,
                                     valid.episodic,
                                     wrong_procedural,
                                     KnowledgeQuery{""}),
                       "WORKSPACE_MISMATCH");
    }
    {
        RetrievalSession started{"workspace"};
        ASSERT_TRUE(search(valid, started, "").succeeded());
        const auto started_before = snapshot_of(started);
        expect_failure(engine.search(started,
                                     wrong_semantic,
                                     wrong_episodic,
                                     wrong_procedural,
                                     KnowledgeQuery{""}),
                       "SESSION_ALREADY_STARTED");
        EXPECT_EQ(snapshot_of(started), started_before);
    }
    {
        RetrievalSession forgotten{"workspace"};
        ASSERT_TRUE(engine.forgetSession(forgotten).succeeded());
        const auto forgotten_before = snapshot_of(forgotten);
        expect_failure(engine.search(forgotten,
                                     wrong_semantic,
                                     wrong_episodic,
                                     wrong_procedural,
                                     KnowledgeQuery{""}),
                       "SESSION_FORGOTTEN");
        EXPECT_EQ(snapshot_of(forgotten), forgotten_before);
    }
}

TEST(KnowledgeRetrievalPrecedenceTest, AllOperationPrecedenceIsExact) {
    Sources sources{"workspace"};
    populate_rich_sources(sources);
    MemoryRetrievalEngine engine;
    const auto invalid_kind = static_cast<Kind>(999);

    RetrievalSession ready{"workspace"};
    expect_failure(retrieve(sources, ready, invalid_kind, ""),
                   "INVALID_SOURCE_KIND");
    expect_failure(retrieve(sources, ready, Kind::Semantic, ""),
                   "INVALID_IDENTIFIER");
    const auto first_missing = retrieve(
        sources, ready, Kind::Semantic, "missing");
    const auto second_missing = retrieve(
        sources, ready, Kind::Semantic, "missing");
    expect_failure(first_missing, "NOT_FOUND");
    expect_failure(second_missing, "NOT_FOUND");
    EXPECT_EQ(first_missing.message(), second_missing.message());
    EXPECT_FALSE(ready.started());

    expect_failure(engine.explain(ready, invalid_kind, ""),
                   "SESSION_NOT_STARTED");
    expect_failure(engine.filter(ready, KnowledgeQuery{""}),
                   "SESSION_NOT_STARTED");
    expect_failure(engine.rank(ready), "SESSION_NOT_STARTED");

    ASSERT_TRUE(search(sources, ready, "").succeeded());
    expect_failure(engine.explain(ready, invalid_kind, ""),
                   "INVALID_SOURCE_KIND");
    expect_failure(engine.explain(ready, Kind::Semantic, ""),
                   "INVALID_IDENTIFIER");
    expect_failure(engine.explain(ready, Kind::Semantic, "missing"),
                   "NOT_FOUND");

    SemanticMemory wrong_semantic{"other"};
    EpisodicMemory wrong_episodic{"other"};
    ProceduralMemory wrong_procedural{"other"};
    expect_failure(engine.retrieve(ready,
                                   wrong_semantic,
                                   wrong_episodic,
                                   wrong_procedural,
                                   invalid_kind,
                                   ""),
                   "SESSION_ALREADY_STARTED");

    ASSERT_TRUE(engine.forgetSession(ready).succeeded());
    expect_failure(engine.retrieve(ready,
                                   wrong_semantic,
                                   wrong_episodic,
                                   wrong_procedural,
                                   invalid_kind,
                                   ""),
                   "SESSION_FORGOTTEN");
    expect_failure(engine.explain(ready, invalid_kind, ""),
                   "SESSION_FORGOTTEN");
}

TEST(KnowledgeRetrievalFailureTest,
     SemanticFailuresPreserveCompleteState) {
    Sources sources{"workspace"};
    populate_rich_sources(sources);
    const auto source_before = snapshot_of(sources);
    RetrievalSession ready{"workspace"};
    const SessionSnapshot ready_before{ready.workspaceIdentifier(),
                                       ready.started(),
                                       ready.forgotten(),
                                       {}};

    expect_failure(retrieve(sources, ready, Kind::Semantic, "missing"),
                   "NOT_FOUND");
    EXPECT_EQ(snapshot_of(sources), source_before);
    EXPECT_EQ((SessionSnapshot{ready.workspaceIdentifier(),
                               ready.started(),
                               ready.forgotten(),
                               {}}),
              ready_before);

    RetrievalSession started{"workspace"};
    ASSERT_TRUE(search(sources, started, "").succeeded());
    const auto session_before = snapshot_of(started);
    expect_failure(search(sources, started, "alpha"),
                   "SESSION_ALREADY_STARTED");
    expect_failure(MemoryRetrievalEngine{}.explain(
                       started, Kind::Semantic, "missing"),
                   "NOT_FOUND");
    EXPECT_EQ(snapshot_of(started), session_before);
    EXPECT_EQ(snapshot_of(sources), source_before);
}

TEST(KnowledgeRetrievalIsolationTest,
     SourceAndDetachedCandidateLifetimesAreIndependent) {
    Sources sources{"workspace"};
    populate_rich_sources(sources);

    RetrievalSession semantic_session{"workspace"};
    RetrievalSession episode_session{"workspace"};
    RetrievalSession procedure_session{"workspace"};
    const auto semantic_result = retrieve(
        sources, semantic_session, Kind::Semantic, "shared");
    const auto episode_result = retrieve(
        sources, episode_session, Kind::Episodic, "shared");
    const auto procedure_result = retrieve(
        sources, procedure_session, Kind::Procedural, "shared");
    ASSERT_NE(semantic_result.candidate(), nullptr);
    ASSERT_NE(episode_result.candidate(), nullptr);
    ASSERT_NE(procedure_result.candidate(), nullptr);
    const auto semantic_before = snapshot_of(*semantic_result.candidate());
    const auto episode_before = snapshot_of(*episode_result.candidate());
    const auto procedure_before = snapshot_of(*procedure_result.candidate());

    ASSERT_TRUE(SemanticMemoryEngine{}.update(
                    sources.semantic, "shared", "live semantic changed")
                    .succeeded());
    ASSERT_TRUE(EpisodicMemoryEngine{}.update(sources.episodic,
                                              "shared",
                                              "live occurrence changed",
                                              "live context changed")
                    .succeeded());
    ASSERT_TRUE(ProceduralMemoryEngine{}.update(
                    sources.procedural,
                    "shared",
                    "live activity changed",
                    {"live-step"})
                    .succeeded());
    ASSERT_TRUE(LongTermMemoryEngine{}.archive(sources.evidence, "source-a")
                    .succeeded());
    ASSERT_TRUE(SemanticMemoryEngine{}.forget(sources.semantic, "shared")
                    .succeeded());
    ASSERT_TRUE(EpisodicMemoryEngine{}.forget(sources.episodic, "shared")
                    .succeeded());
    ASSERT_TRUE(ProceduralMemoryEngine{}.forget(sources.procedural, "shared")
                    .succeeded());

    EXPECT_EQ(snapshot_of(*semantic_result.candidate()), semantic_before);
    EXPECT_EQ(snapshot_of(*episode_result.candidate()), episode_before);
    EXPECT_EQ(snapshot_of(*procedure_result.candidate()), procedure_before);
    ASSERT_EQ(semantic_session.size(), 1U);
    ASSERT_EQ(episode_session.size(), 1U);
    ASSERT_EQ(procedure_session.size(), 1U);
    EXPECT_EQ(snapshot_of(semantic_session.candidates().front()),
              semantic_before);
    EXPECT_EQ(snapshot_of(episode_session.candidates().front()), episode_before);
    EXPECT_EQ(snapshot_of(procedure_session.candidates().front()),
              procedure_before);

    EXPECT_EQ(sources.semantic.find("shared"), nullptr);
    EXPECT_EQ(sources.episodic.find("shared"), nullptr);
    EXPECT_EQ(sources.procedural.find("shared"), nullptr);
    EXPECT_NE(semantic_result.candidate()->semanticConcept(), nullptr);
    EXPECT_NE(episode_result.candidate()->episode(), nullptr);
    EXPECT_NE(procedure_result.candidate()->procedure(), nullptr);
    EXPECT_EQ(sources.semantic.find("shared"), nullptr);
    EXPECT_EQ(sources.episodic.find("shared"), nullptr);
    EXPECT_EQ(sources.procedural.find("shared"), nullptr);

    RetrievalSession forgotten_source_session{"workspace"};
    expect_failure(retrieve(sources,
                            forgotten_source_session,
                            Kind::Semantic,
                            "shared"),
                   "NOT_FOUND");
    EXPECT_FALSE(forgotten_source_session.started());
}

TEST(KnowledgeRetrievalIsolationTest,
     DestructionDirectionsPreserveDetachedAndSourceState) {
    Sources persistent_sources{"workspace"};
    populate_rich_sources(persistent_sources);
    const auto persistent_sources_before = snapshot_of(persistent_sources);
    {
        RetrievalSession transient_session{"workspace"};
        {
            const auto transient_result = search(
                persistent_sources, transient_session, "");
            expect_ok(transient_result);
            ASSERT_EQ(transient_result.candidates().size(), 6U);
        }
        ASSERT_TRUE(transient_session.started());
        ASSERT_EQ(transient_session.size(), 6U);
    }
    EXPECT_EQ(snapshot_of(persistent_sources), persistent_sources_before);

    RetrievalSession detached_session{"workspace"};
    auto detached_result = [&detached_session]() -> KnowledgeResult {
        Sources transient_sources{"workspace"};
        populate_rich_sources(transient_sources);
        const auto transient_sources_before = snapshot_of(transient_sources);
        auto result = search(transient_sources, detached_session, "");
        EXPECT_TRUE(result.succeeded()) << result.code();
        EXPECT_EQ(snapshot_of(transient_sources), transient_sources_before);
        return result;
    }();

    const auto detached_result_before = snapshot_of(detached_result);
    const auto detached_session_before = snapshot_of(detached_session);
    ASSERT_EQ(detached_result.candidates().size(), 6U);
    ASSERT_EQ(detached_session.size(), 6U);
    ASSERT_NE(detached_result.candidates().front().semanticConcept(), nullptr);
    EXPECT_EQ(detached_result.candidates().front()
                  .semanticConcept()
                  ->meaning(),
              "semantic alpha");

    const auto filtered = MemoryRetrievalEngine{}.filter(
        detached_session, KnowledgeQuery{"shared"});
    expect_ok(filtered);
    ASSERT_EQ(filtered.candidates().size(), 3U);
    const auto ranked = MemoryRetrievalEngine{}.rank(detached_session);
    expect_ok(ranked);
    ASSERT_EQ(ranked.candidates().size(), 3U);
    const auto explained = MemoryRetrievalEngine{}.explain(
        detached_session, Kind::Semantic, "shared");
    expect_ok(explained);
    EXPECT_NE(snapshot_of(detached_session), detached_session_before);
    EXPECT_EQ(snapshot_of(detached_result), detached_result_before);
}

TEST(KnowledgeRetrievalValueTest,
     CandidatesSessionsAndResultsHonorMoveContracts) {
    Sources sources{"workspace"};
    populate_rich_sources(sources);

    RetrievalSession semantic_session{"workspace"};
    auto semantic_result = retrieve(
        sources, semantic_session, Kind::Semantic, "shared");
    ASSERT_NE(semantic_result.candidate(), nullptr);
    KnowledgeCandidate candidate_copy{*semantic_result.candidate()};
    const auto expected_candidate = snapshot_of(candidate_copy);
    KnowledgeCandidate moved_candidate{std::move(candidate_copy)};
    EXPECT_EQ(snapshot_of(moved_candidate), expected_candidate);
    EXPECT_EQ(candidate_copy.kind(), Kind::Semantic);
    EXPECT_TRUE(candidate_copy.workspaceIdentifier().empty());
    EXPECT_TRUE(candidate_copy.sourceIdentifier().empty());
    EXPECT_EQ(candidate_copy.rankScore(), 0U);
    EXPECT_EQ(candidate_copy.semanticConcept(), nullptr);
    EXPECT_EQ(candidate_copy.episode(), nullptr);
    EXPECT_EQ(candidate_copy.procedure(), nullptr);

    RetrievalSession episodic_session{"workspace"};
    const auto episodic_result = retrieve(
        sources, episodic_session, Kind::Episodic, "shared");
    ASSERT_NE(episodic_result.candidate(), nullptr);
    KnowledgeCandidate assigned{*episodic_result.candidate()};
    assigned = moved_candidate;
    EXPECT_EQ(snapshot_of(assigned), expected_candidate);
    KnowledgeCandidate move_assigned{*episodic_result.candidate()};
    move_assigned = std::move(assigned);
    EXPECT_EQ(snapshot_of(move_assigned), expected_candidate);
    EXPECT_EQ(assigned.kind(), Kind::Semantic);
    EXPECT_TRUE(assigned.workspaceIdentifier().empty());
    EXPECT_TRUE(assigned.sourceIdentifier().empty());
    EXPECT_EQ(assigned.semanticConcept(), nullptr);

    RetrievalSession original{"workspace"};
    ASSERT_TRUE(search(sources, original, "").succeeded());
    RetrievalSession copy{original};
    const auto copy_before = snapshot_of(copy);
    ASSERT_TRUE(MemoryRetrievalEngine{}
                    .filter(original, KnowledgeQuery{"semantic alpha"})
                    .succeeded());
    EXPECT_EQ(snapshot_of(copy), copy_before);
    EXPECT_NE(snapshot_of(original), copy_before);

    RetrievalSession moved_session{std::move(copy)};
    EXPECT_EQ(snapshot_of(moved_session), copy_before);
    EXPECT_EQ(copy.workspaceIdentifier(), "workspace");
    EXPECT_FALSE(copy.started());
    EXPECT_FALSE(copy.forgotten());
    EXPECT_TRUE(copy.candidates().empty());

    const auto result_before = snapshot_of(semantic_result);
    KnowledgeResult moved_result{std::move(semantic_result)};
    EXPECT_EQ(snapshot_of(moved_result), result_before);
    EXPECT_FALSE(semantic_result.succeeded());
    EXPECT_TRUE(semantic_result.code().empty());
    EXPECT_TRUE(semantic_result.message().empty());
    EXPECT_EQ(semantic_result.candidate(), nullptr);
    EXPECT_TRUE(semantic_result.candidates().empty());
    EXPECT_TRUE(semantic_result.explanationChain().empty());

    RetrievalSession destination_session{"workspace"};
    auto destination = search(sources, destination_session, "no-match");
    destination = std::move(moved_result);
    EXPECT_EQ(snapshot_of(destination), result_before);
    EXPECT_FALSE(moved_result.succeeded());
    EXPECT_TRUE(moved_result.code().empty());
    EXPECT_TRUE(moved_result.message().empty());
    EXPECT_EQ(moved_result.candidate(), nullptr);
    EXPECT_TRUE(moved_result.candidates().empty());
    EXPECT_TRUE(moved_result.explanationChain().empty());
}

TEST(KnowledgeRetrievalValueTest,
     SearchAndExplainResultsMoveCompletePayloads) {
    Sources sources{"workspace"};
    populate_rich_sources(sources);
    const auto sources_before = snapshot_of(sources);
    const auto expect_moved_from = [](const KnowledgeResult& result) {
        EXPECT_FALSE(result.succeeded());
        EXPECT_TRUE(result.code().empty());
        EXPECT_TRUE(result.message().empty());
        EXPECT_EQ(result.candidate(), nullptr);
        EXPECT_TRUE(result.candidates().empty());
        EXPECT_TRUE(result.explanationChain().empty());
    };

    RetrievalSession session{"workspace"};
    auto search_result = search(sources, session, "");
    ASSERT_EQ(search_result.candidates().size(), 6U);
    const auto search_before = snapshot_of(search_result);
    KnowledgeResult moved_search{std::move(search_result)};
    EXPECT_EQ(snapshot_of(moved_search), search_before);
    expect_moved_from(search_result);

    RetrievalSession search_destination_session{"workspace"};
    auto search_destination = retrieve(sources,
                                       search_destination_session,
                                       Kind::Semantic,
                                       "absent");
    search_destination = std::move(moved_search);
    EXPECT_EQ(snapshot_of(search_destination), search_before);
    expect_moved_from(moved_search);

    ASSERT_TRUE(MemoryRetrievalEngine{}.rank(session).succeeded());
    auto explain_result = MemoryRetrievalEngine{}.explain(
        session, Kind::Semantic, "shared");
    ASSERT_NE(explain_result.candidate(), nullptr);
    ASSERT_FALSE(explain_result.explanationChain().empty());
    const auto explain_before = snapshot_of(explain_result);
    KnowledgeResult moved_explain{std::move(explain_result)};
    EXPECT_EQ(snapshot_of(moved_explain), explain_before);
    expect_moved_from(explain_result);

    RetrievalSession explain_destination_session{"workspace"};
    auto explain_destination = retrieve(sources,
                                        explain_destination_session,
                                        Kind::Semantic,
                                        "absent");
    explain_destination = std::move(moved_explain);
    EXPECT_EQ(snapshot_of(explain_destination), explain_before);
    expect_moved_from(moved_explain);
    EXPECT_EQ(snapshot_of(sources), sources_before);
}

TEST(KnowledgeRetrievalResultTest, CodesMessagesAndPayloadShapesAreExact) {
    Sources sources{"workspace"};
    populate_rich_sources(sources);
    MemoryRetrievalEngine engine;

    RetrievalSession retrieve_session{"workspace"};
    const auto retrieve_result = retrieve(
        sources, retrieve_session, Kind::Semantic, "shared");
    expect_ok(retrieve_result);
    EXPECT_NE(retrieve_result.candidate(), nullptr);
    EXPECT_TRUE(retrieve_result.candidates().empty());
    EXPECT_TRUE(retrieve_result.explanationChain().empty());

    RetrievalSession pipeline{"workspace"};
    const auto search_result = search(sources, pipeline, "");
    expect_ok(search_result);
    EXPECT_EQ(search_result.candidate(), nullptr);
    EXPECT_FALSE(search_result.candidates().empty());
    EXPECT_TRUE(search_result.explanationChain().empty());

    const auto filter_result = engine.filter(
        pipeline, KnowledgeQuery{"semantic alpha"});
    expect_ok(filter_result);
    EXPECT_EQ(filter_result.candidate(), nullptr);
    EXPECT_FALSE(filter_result.candidates().empty());
    EXPECT_TRUE(filter_result.explanationChain().empty());

    const auto rank_result = engine.rank(pipeline);
    expect_ok(rank_result);
    EXPECT_EQ(rank_result.candidate(), nullptr);
    EXPECT_FALSE(rank_result.candidates().empty());
    EXPECT_TRUE(rank_result.explanationChain().empty());

    const auto explain_result = engine.explain(
        pipeline, Kind::Semantic, "shared");
    expect_ok(explain_result);
    EXPECT_NE(explain_result.candidate(), nullptr);
    EXPECT_TRUE(explain_result.candidates().empty());
    EXPECT_FALSE(explain_result.explanationChain().empty());

    const auto forget_result = engine.forgetSession(pipeline);
    expect_ok(forget_result);
    EXPECT_EQ(forget_result.candidate(), nullptr);
    EXPECT_TRUE(forget_result.candidates().empty());
    EXPECT_TRUE(forget_result.explanationChain().empty());

    RetrievalSession failure_session{"workspace"};
    expect_failure(retrieve(sources,
                            failure_session,
                            Kind::Semantic,
                            "missing"),
                   "NOT_FOUND");
}

TEST(KnowledgeRetrievalDeterminismTest,
     EquivalentHistoriesAreCompletelyEqual) {
    Sources first_sources{"workspace"};
    Sources second_sources{"workspace"};
    populate_rich_sources(first_sources);
    populate_rich_sources(second_sources);
    RetrievalSession first{"workspace"};
    RetrievalSession second{"workspace"};
    MemoryRetrievalEngine first_engine;
    MemoryRetrievalEngine second_engine;

    const auto first_search = search(first_sources, first, "");
    const auto second_search = search(second_sources, second, "");
    EXPECT_EQ(snapshot_of(first_search), snapshot_of(second_search));
    ASSERT_TRUE(first_engine.filter(first, KnowledgeQuery{"shared"}).succeeded());
    ASSERT_TRUE(second_engine.filter(second, KnowledgeQuery{"shared"}).succeeded());
    ASSERT_TRUE(first_engine.rank(first).succeeded());
    ASSERT_TRUE(second_engine.rank(second).succeeded());
    EXPECT_EQ(snapshot_of(first), snapshot_of(second));
    EXPECT_EQ(snapshot_of(first_sources), snapshot_of(second_sources));
}

TEST(KnowledgeRetrievalBoundaryTest,
     IndependentEnginesAndSessionsAreIsolated) {
    Sources sources{"workspace"};
    populate_rich_sources(sources);
    const auto source_before = snapshot_of(sources);
    RetrievalSession first{"workspace"};
    RetrievalSession second{"workspace"};
    std::string first_code;
    std::string second_code;
    std::size_t first_size{};
    std::size_t second_size{};

    std::thread first_thread{[&] {
        const auto result = MemoryRetrievalEngine{}.search(
            first,
            sources.semantic,
            sources.episodic,
            sources.procedural,
            KnowledgeQuery{"semantic"});
        first_code = result.code();
        first_size = result.candidates().size();
    }};
    std::thread second_thread{[&] {
        const auto result = MemoryRetrievalEngine{}.search(
            second,
            sources.semantic,
            sources.episodic,
            sources.procedural,
            KnowledgeQuery{"activity"});
        second_code = result.code();
        second_size = result.candidates().size();
    }};
    first_thread.join();
    second_thread.join();

    EXPECT_EQ(first_code, "OK");
    EXPECT_EQ(second_code, "OK");
    EXPECT_EQ(first_size, 2U);
    EXPECT_EQ(second_size, 2U);
    EXPECT_NE(snapshot_of(first), snapshot_of(second));
    EXPECT_EQ(snapshot_of(sources), source_before);
}

TEST(KnowledgeRetrievalBoundaryTest, WorkspacesSourcesAndRuntimeStayIsolated) {
    Sources sources{"workspace"};
    populate_rich_sources(sources);
    RetrievalSession session{"workspace"};
    ASSERT_TRUE(search(sources, session, "").succeeded());
    const auto session_before = snapshot_of(session);
    const auto sources_before = snapshot_of(sources);

    {
        auto runtime = cca::runtime::RuntimeBuilder{
                           cca::runtime::RuntimeId{"retrieval-runtime-one"}}
                           .build();
        ASSERT_NE(runtime, nullptr);
        ASSERT_TRUE(runtime->start().ok());
        EXPECT_EQ(snapshot_of(session), session_before);
        EXPECT_EQ(snapshot_of(sources), sources_before);
        ASSERT_TRUE(runtime->stop().ok());
    }
    {
        auto replacement = cca::runtime::RuntimeBuilder{
                               cca::runtime::RuntimeId{
                                   "retrieval-runtime-replacement"}}
                               .build();
        ASSERT_NE(replacement, nullptr);
        ASSERT_TRUE(replacement->start().ok());
        ASSERT_TRUE(replacement->stop().ok());
    }

    EXPECT_EQ(snapshot_of(session), session_before);
    EXPECT_EQ(snapshot_of(sources), sources_before);
    const auto filtered = MemoryRetrievalEngine{}.filter(
        session, KnowledgeQuery{"semantic alpha"});
    expect_ok(filtered);
}

TEST(KnowledgeRetrievalBoundaryTest,
     RuntimeLifecyclePreservesEverySessionState) {
    Sources sources{"workspace"};
    populate_rich_sources(sources);
    RetrievalSession session{"workspace"};

    const auto expect_runtime_lifecycle_isolated =
        [&](const std::string_view stage) {
            const auto session_before = snapshot_of(session);
            const auto sources_before = snapshot_of(sources);
            const auto id_prefix =
                std::string{"knowledge-retrieval-"} + std::string{stage};

            {
                auto runtime = cca::runtime::RuntimeBuilder{
                                   cca::runtime::RuntimeId{id_prefix +
                                                           "-runtime"}}
                                   .build();
                ASSERT_NE(runtime, nullptr);
                EXPECT_EQ(snapshot_of(session), session_before);
                EXPECT_EQ(snapshot_of(sources), sources_before);
                ASSERT_TRUE(runtime->start().ok());
                EXPECT_EQ(snapshot_of(session), session_before);
                EXPECT_EQ(snapshot_of(sources), sources_before);
                ASSERT_TRUE(runtime->stop().ok());
                EXPECT_EQ(snapshot_of(session), session_before);
                EXPECT_EQ(snapshot_of(sources), sources_before);
            }

            EXPECT_EQ(snapshot_of(session), session_before);
            EXPECT_EQ(snapshot_of(sources), sources_before);
            {
                auto replacement = cca::runtime::RuntimeBuilder{
                                       cca::runtime::RuntimeId{
                                           id_prefix + "-replacement"}}
                                       .build();
                ASSERT_NE(replacement, nullptr);
                EXPECT_EQ(snapshot_of(session), session_before);
                EXPECT_EQ(snapshot_of(sources), sources_before);
                ASSERT_TRUE(replacement->start().ok());
                EXPECT_EQ(snapshot_of(session), session_before);
                EXPECT_EQ(snapshot_of(sources), sources_before);
                ASSERT_TRUE(replacement->stop().ok());
            }
            EXPECT_EQ(snapshot_of(session), session_before);
            EXPECT_EQ(snapshot_of(sources), sources_before);
        };

    expect_runtime_lifecycle_isolated("ready");

    const auto started = search(sources, session, "");
    expect_ok(started);
    ASSERT_TRUE(session.started());
    expect_runtime_lifecycle_isolated("started");

    const auto filtered = MemoryRetrievalEngine{}.filter(
        session, KnowledgeQuery{"shared"});
    expect_ok(filtered);
    ASSERT_EQ(session.size(), 3U);
    expect_runtime_lifecycle_isolated("filtered");

    const auto ranked = MemoryRetrievalEngine{}.rank(session);
    expect_ok(ranked);
    ASSERT_EQ(session.size(), 3U);
    expect_runtime_lifecycle_isolated("ranked");

    const auto explained = MemoryRetrievalEngine{}.explain(
        session, Kind::Semantic, "shared");
    expect_ok(explained);
    const auto explained_before = snapshot_of(explained);
    expect_runtime_lifecycle_isolated("explained");
    EXPECT_EQ(snapshot_of(explained), explained_before);

    const auto forgotten = MemoryRetrievalEngine{}.forgetSession(session);
    expect_ok(forgotten);
    ASSERT_TRUE(session.forgotten());
    expect_runtime_lifecycle_isolated("forgotten");
    EXPECT_EQ(snapshot_of(explained), explained_before);
}

TEST(KnowledgeRetrievalBoundaryTest, NoExcludedBehaviorIsObservable) {
    Sources sources{"workspace"};
    populate_rich_sources(sources);
    const auto source_before = snapshot_of(sources);
    RetrievalSession session{"workspace"};
    const auto result = search(sources, session, "category-target");
    expect_ok(result);
    ASSERT_EQ(result.candidates().size(), 1U);
    EXPECT_EQ(result.candidates().front().kind(), Kind::Semantic);
    EXPECT_EQ(result.candidates().front().sourceIdentifier(), "shared");
    EXPECT_EQ(snapshot_of(sources), source_before);

    const auto explained = MemoryRetrievalEngine{}.explain(
        session, Kind::Semantic, "shared");
    expect_ok(explained);
    EXPECT_EQ(snapshot_of(sources), source_before);
    EXPECT_EQ(explained.explanationChain(),
              std::vector<std::string>{
                  "search:content-exact:category[1]"});
}

} // namespace
