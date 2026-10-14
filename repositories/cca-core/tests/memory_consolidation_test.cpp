#include <cca/memory/memory_consolidation.hpp>

#include <gtest/gtest.h>

#include <algorithm>
#include <cstddef>
#include <cstdint>
#include <future>
#include <optional>
#include <stdexcept>
#include <string>
#include <string_view>
#include <type_traits>
#include <utility>
#include <vector>

/*
CCA-CONS-1.0 requirement coverage
---------------------------------
CCA-CONS-001: MemoryConsolidationBoundaryTest and independent architecture review
CCA-CONS-002: MemoryConsolidationTransitionTest and MemoryConsolidationBoundaryTest
CCA-CONS-003: MemoryConsolidationApiTest.PublicDeclarationsMatchFrozenContract
CCA-CONS-004: MemoryConsolidationApiTest.PublicDeclarationsMatchFrozenContract
CCA-CONS-005: MemoryConsolidationBoundaryTest.PublicSurfaceUsesOnlyReleasedMemoryTypes
CCA-CONS-006: MemoryConsolidationOwnershipTest.ConstructionAndWorkspaceOwnershipAreExact
CCA-CONS-007: MemoryConsolidationOwnershipTest.ConstructionAndWorkspaceOwnershipAreExact
CCA-CONS-008: MemoryConsolidationLifecycleTest.PristineAndSuccessfulStagesAreExact
CCA-CONS-009: MemoryConsolidationLifecycleTest.PristineAndSuccessfulStagesAreExact
CCA-CONS-010: MemoryConsolidationLifecycleTest.PristineAndSuccessfulStagesAreExact
CCA-CONS-011: MemoryConsolidationSessionTest.RetrieveDeepCopiesEveryLifecycleStage
CCA-CONS-012: MemoryConsolidationApiTest.PublicDeclarationsMatchFrozenContract
CCA-CONS-013: MemoryConsolidationProvenanceTest.CandidatePreservesCompleteWorkingEvidence
CCA-CONS-014: MemoryConsolidationLifecycleTest.PristineAndSuccessfulStagesAreExact
CCA-CONS-015: MemoryConsolidationPrecedenceTest.AnalyzePrecedenceIsExact
              and RetainAndValidatePrecedenceIsExact
CCA-CONS-016: MemoryConsolidationPrecedenceTest.SourcePreconditionsAndDriftAreExact
CCA-CONS-017: MemoryConsolidationPrecedenceTest.SourcePreconditionsAndDriftAreExact
CCA-CONS-018: MemoryConsolidationPrecedenceTest.DestinationStatesAreExact
CCA-CONS-019: MemoryConsolidationTransitionTest.IdentityContentAndBaseStateArePreserved
CCA-CONS-020: MemoryConsolidationProvenanceTest.CandidatePreservesCompleteWorkingEvidence
CCA-CONS-021: MemoryConsolidationLifecycleTest.PristineAndSuccessfulStagesAreExact
CCA-CONS-022: MemoryConsolidationLifecycleTest.PromotionIsTypedAndIdempotent
CCA-CONS-023: MemoryConsolidationTransitionTest.AtomicSuccessorPairIsComplete
CCA-CONS-024: MemoryConsolidationTransitionTest.WorkingSuccessorPreservesSurvivorsAndOrder
CCA-CONS-025: MemoryConsolidationTransitionTest.LongTermSuccessorAppendsAndPreservesAllState
CCA-CONS-026: MemoryConsolidationValidationTest.IsStateDependentAndObservational
CCA-CONS-027: MemoryConsolidationSessionTest.RetrieveDeepCopiesEveryLifecycleStage
CCA-CONS-028: MemoryConsolidationSessionTest.ForgettingEveryStageIsTerminalAndIsolated
CCA-CONS-029: MemoryConsolidationTransitionTest.AtomicSuccessorPairIsComplete
CCA-CONS-030: MemoryConsolidationFailureTest.AllOutcomesLeaveInputPrestatesUnchanged
CCA-CONS-031: MemoryConsolidationTransitionTest.WorkingSuccessorPreservesSurvivorsAndOrder
              and LongTermSuccessorAppendsAndPreservesAllState
CCA-CONS-032: MemoryConsolidationLifecycleTest.RepeatedAndWrongStageOperationsAreExact
CCA-CONS-033: MemoryConsolidationResultTest.CodesMessagesAndPayloadShapesAreClosed
CCA-CONS-034: MemoryConsolidationResultTest.SuccessPayloadShapesAreExact
CCA-CONS-035: MemoryConsolidationPrecedenceTest.AnalyzePrecedenceIsExact
              and RetainAndValidatePrecedenceIsExact
CCA-CONS-036: MemoryConsolidationValueTest.CopyMoveAndLifetimeContractsAreExact
CCA-CONS-037: MemoryConsolidationBoundaryTest.IndependentEnginesAndValuesRemainIsolated
CCA-CONS-038: MemoryConsolidationFailureTest.AllOutcomesLeaveInputPrestatesUnchanged
              and MemoryConsolidationAllocationFailureTest (dedicated executable)
CCA-CONS-039: MemoryConsolidationDeterminismTest.EquivalentHistoriesAreCompletelyEqual
CCA-CONS-040: MemoryConsolidationBoundaryTest.IndependentEnginesAndValuesRemainIsolated
CCA-CONS-041: MemoryConsolidationBoundaryTest.PersistenceDoesNotOwnSessionLifecycle
CCA-CONS-042: MemoryConsolidationBoundaryTest.PublicSurfaceUsesOnlyReleasedMemoryTypes
CCA-CONS-043: MemoryConsolidationApiTest.PublicDeclarationsMatchFrozenContract
CCA-CONS-044: MemoryConsolidationBoundaryTest.NoExcludedCapabilityIsObservable
CCA-CONS-045: documentation and executable-example review
CCA-CONS-046: this bidirectional mapping and independent traceability review
CCA-CONS-047: CI C++23 warnings-as-errors build gate
*/

namespace {

using cca::memory::ConsolidationCandidate;
using cca::memory::ConsolidationRequest;
using cca::memory::ConsolidationResult;
using cca::memory::ConsolidationSession;
using cca::memory::LongTermMemory;
using cca::memory::LongTermMemoryEngine;
using cca::memory::LongTermMemoryEntry;
using cca::memory::MemoryConsolidationEngine;
using cca::memory::WorkingMemory;
using cca::memory::WorkingMemoryEngine;
using cca::memory::WorkingMemoryEntry;

using State = ConsolidationSession::State;

constexpr std::string_view workspace{"consolidation-workspace"};
constexpr std::string_view task{"active-task"};
constexpr std::string_view source_identifier{"working-b"};
constexpr std::string_view source_value{"working-value-b"};

struct WorkingEntrySnapshot final {
    std::string identifier;
    std::string value;
    std::optional<std::uint64_t> expiration_point;

    bool operator==(const WorkingEntrySnapshot&) const = default;
};

struct WorkingSnapshot final {
    std::string workspace_identifier;
    bool active;
    std::optional<std::string> task_identifier;
    std::vector<WorkingEntrySnapshot> entries;

    bool operator==(const WorkingSnapshot&) const = default;
};

struct LongTermEntrySnapshot final {
    std::string identifier;
    std::string value;
    bool archived;

    bool operator==(const LongTermEntrySnapshot&) const = default;
};

struct LongTermSnapshot final {
    std::string workspace_identifier;
    std::vector<LongTermEntrySnapshot> entries;

    bool operator==(const LongTermSnapshot&) const = default;
};

struct CandidateSnapshot final {
    std::string workspace_identifier;
    std::string task_identifier;
    std::size_t source_position;
    std::optional<WorkingEntrySnapshot> working_entry;
    std::optional<LongTermEntrySnapshot> long_term_entry;
    std::optional<std::size_t> retained_position;

    bool operator==(const CandidateSnapshot&) const = default;
};

struct RequestSnapshot final {
    std::string workspace_identifier;
    std::string task_identifier;
    std::string entry_identifier;

    bool operator==(const RequestSnapshot&) const = default;
};

struct SessionSnapshot final {
    std::string workspace_identifier;
    State state;
    std::optional<RequestSnapshot> request;
    std::optional<CandidateSnapshot> candidate;
    std::optional<WorkingSnapshot> working;
    std::optional<LongTermSnapshot> long_term;

    bool operator==(const SessionSnapshot&) const = default;
};

struct ResultSnapshot final {
    bool succeeded;
    std::string code;
    std::string message;
    std::optional<CandidateSnapshot> candidate;
    std::optional<SessionSnapshot> session;
    std::optional<WorkingSnapshot> working;
    std::optional<LongTermSnapshot> long_term;

    bool operator==(const ResultSnapshot&) const = default;
};

[[nodiscard]] WorkingEntrySnapshot snapshot_of(
    const WorkingMemoryEntry& entry) {
    return {entry.identifier(), entry.value(), entry.expirationPoint()};
}

[[nodiscard]] LongTermEntrySnapshot snapshot_of(
    const LongTermMemoryEntry& entry) {
    return {entry.identifier(), entry.value(), entry.archived()};
}

[[nodiscard]] WorkingSnapshot snapshot_of(const WorkingMemory& memory) {
    std::vector<WorkingEntrySnapshot> entries;
    entries.reserve(memory.entries().size());
    for (const auto& entry : memory.entries()) {
        entries.push_back(snapshot_of(entry));
    }
    return {memory.workspaceIdentifier(),
            memory.active(),
            memory.activeTaskIdentifier(),
            std::move(entries)};
}

[[nodiscard]] LongTermSnapshot snapshot_of(const LongTermMemory& memory) {
    std::vector<LongTermEntrySnapshot> entries;
    entries.reserve(memory.entries().size());
    for (const auto& entry : memory.entries()) {
        entries.push_back(snapshot_of(entry));
    }
    return {memory.workspaceIdentifier(), std::move(entries)};
}

[[nodiscard]] CandidateSnapshot snapshot_of(
    const ConsolidationCandidate& candidate) {
    std::optional<WorkingEntrySnapshot> working_entry;
    if (const auto* const entry = candidate.workingMemoryEntry();
        entry != nullptr) {
        working_entry = snapshot_of(*entry);
    }

    std::optional<LongTermEntrySnapshot> long_term_entry;
    if (const auto* const entry = candidate.longTermMemoryEntry();
        entry != nullptr) {
        long_term_entry = snapshot_of(*entry);
    }

    return {candidate.workspaceIdentifier(),
            candidate.taskIdentifier(),
            candidate.sourcePosition(),
            std::move(working_entry),
            std::move(long_term_entry),
            candidate.retainedPosition()};
}

[[nodiscard]] RequestSnapshot snapshot_of(
    const ConsolidationRequest& request) {
    return {request.workspaceIdentifier(),
            request.taskIdentifier(),
            request.entryIdentifier()};
}

[[nodiscard]] SessionSnapshot snapshot_of(
    const ConsolidationSession& session) {
    std::optional<RequestSnapshot> request;
    if (const auto* const value = session.request(); value != nullptr) {
        request = snapshot_of(*value);
    }

    std::optional<CandidateSnapshot> candidate;
    if (const auto* const value = session.candidate(); value != nullptr) {
        candidate = snapshot_of(*value);
    }

    std::optional<WorkingSnapshot> working;
    if (const auto* const value = session.workingMemory(); value != nullptr) {
        working = snapshot_of(*value);
    }

    std::optional<LongTermSnapshot> long_term;
    if (const auto* const value = session.longTermMemory(); value != nullptr) {
        long_term = snapshot_of(*value);
    }

    return {session.workspaceIdentifier(),
            session.state(),
            std::move(request),
            std::move(candidate),
            std::move(working),
            std::move(long_term)};
}

[[nodiscard]] ResultSnapshot snapshot_of(const ConsolidationResult& result) {
    std::optional<CandidateSnapshot> candidate;
    if (const auto* const value = result.candidate(); value != nullptr) {
        candidate = snapshot_of(*value);
    }

    std::optional<SessionSnapshot> session;
    if (const auto* const value = result.session(); value != nullptr) {
        session = snapshot_of(*value);
    }

    std::optional<WorkingSnapshot> working;
    if (const auto* const value = result.workingMemory(); value != nullptr) {
        working = snapshot_of(*value);
    }

    std::optional<LongTermSnapshot> long_term;
    if (const auto* const value = result.longTermMemory(); value != nullptr) {
        long_term = snapshot_of(*value);
    }

    return {result.succeeded(),
            result.code(),
            result.message(),
            std::move(candidate),
            std::move(session),
            std::move(working),
            std::move(long_term)};
}

void require_success(const ConsolidationResult& result) {
    ASSERT_TRUE(result.succeeded()) << result.code() << ": "
                                    << result.message();
    EXPECT_EQ(result.code(), "OK");
    EXPECT_TRUE(result.message().empty());
}

void expect_failure(const ConsolidationResult& result,
                    const std::string_view code) {
    EXPECT_FALSE(result.succeeded());
    EXPECT_EQ(result.code(), code);
    EXPECT_FALSE(result.message().empty());
    EXPECT_EQ(result.candidate(), nullptr);
    EXPECT_EQ(result.session(), nullptr);
    EXPECT_EQ(result.workingMemory(), nullptr);
    EXPECT_EQ(result.longTermMemory(), nullptr);
}

void activate(WorkingMemory& memory,
              const std::string_view task_identifier = task) {
    WorkingMemoryEngine engine;
    const auto result = engine.activate(memory, std::string{task_identifier});
    ASSERT_TRUE(result.succeeded()) << result.code() << ": "
                                    << result.message();
}

void store(WorkingMemory& memory,
           std::string identifier,
           std::string value,
           const std::optional<std::uint64_t> expiration = std::nullopt) {
    WorkingMemoryEngine engine;
    const auto result = engine.store(
        memory,
        WorkingMemoryEntry{
            std::move(identifier), std::move(value), expiration});
    ASSERT_TRUE(result.succeeded()) << result.code() << ": "
                                    << result.message();
}

void retain(LongTermMemory& memory,
            std::string identifier,
            std::string value) {
    LongTermMemoryEngine engine;
    const auto result = engine.retain(
        memory,
        LongTermMemoryEntry{std::move(identifier), std::move(value)});
    ASSERT_TRUE(result.succeeded()) << result.code() << ": "
                                    << result.message();
}

void archive(LongTermMemory& memory, const std::string_view identifier) {
    LongTermMemoryEngine engine;
    const auto result = engine.archive(memory, identifier);
    ASSERT_TRUE(result.succeeded()) << result.code() << ": "
                                    << result.message();
}

void forget(LongTermMemory& memory, const std::string_view identifier) {
    LongTermMemoryEngine engine;
    const auto result = engine.forget(memory, identifier);
    ASSERT_TRUE(result.succeeded()) << result.code() << ": "
                                    << result.message();
}

[[nodiscard]] bool is_forgotten(const LongTermMemory& memory,
                                const std::string_view identifier) {
    LongTermMemory copy{memory};
    LongTermMemoryEngine engine;
    const auto result = engine.retain(
        copy, LongTermMemoryEntry{std::string{identifier}, "probe-value"});
    return result.code() == "FORGOTTEN_IDENTIFIER";
}

struct Fixture final {
    WorkingMemory working{std::string{workspace}};
    LongTermMemory long_term{std::string{workspace}};
    ConsolidationSession session{std::string{workspace}};
    ConsolidationRequest request{std::string{workspace},
                                 std::string{task},
                                 std::string{source_identifier}};
    MemoryConsolidationEngine engine;

    Fixture() {
        activate(working);
        store(working, "working-a", "working-value-a", 100U);
        store(working,
              std::string{source_identifier},
              std::string{source_value},
              200U);
        store(working, "working-c", "working-value-c", 300U);

        retain(long_term, "long-a", "long-value-a");
        retain(long_term, "long-b", "long-value-b");
        retain(long_term, "forgotten-unrelated", "forgotten-value");
        archive(long_term, "long-a");
        forget(long_term, "forgotten-unrelated");
    }
};

void analyze(Fixture& fixture) {
    const auto result = fixture.engine.analyze(
        fixture.session,
        fixture.request,
        fixture.working,
        fixture.long_term);
    require_success(result);
}

void promote(Fixture& fixture) {
    analyze(fixture);
    const auto result = fixture.engine.promote(fixture.session);
    require_success(result);
}

[[nodiscard]] ConsolidationResult retain_transition(Fixture& fixture) {
    promote(fixture);
    return fixture.engine.retain(
        fixture.session, fixture.working, fixture.long_term);
}

TEST(MemoryConsolidationApiTest, PublicDeclarationsMatchFrozenContract) {
    static_assert(std::is_constructible_v<ConsolidationRequest,
                                          std::string,
                                          std::string,
                                          std::string>);
    static_assert(std::is_copy_constructible_v<ConsolidationRequest>);
    static_assert(std::is_move_constructible_v<ConsolidationRequest>);

    static_assert(!std::is_default_constructible_v<ConsolidationCandidate>);
    static_assert(std::is_copy_constructible_v<ConsolidationCandidate>);
    static_assert(std::is_copy_assignable_v<ConsolidationCandidate>);
    static_assert(
        std::is_nothrow_move_constructible_v<ConsolidationCandidate>);
    static_assert(std::is_nothrow_move_assignable_v<ConsolidationCandidate>);

    static_assert(std::is_constructible_v<ConsolidationSession, std::string>);
    static_assert(!std::is_convertible_v<std::string, ConsolidationSession>);
    static_assert(std::is_copy_constructible_v<ConsolidationSession>);
    static_assert(!std::is_copy_assignable_v<ConsolidationSession>);
    static_assert(std::is_nothrow_move_constructible_v<ConsolidationSession>);
    static_assert(!std::is_move_assignable_v<ConsolidationSession>);

    static_assert(!std::is_default_constructible_v<ConsolidationResult>);
    static_assert(!std::is_copy_constructible_v<ConsolidationResult>);
    static_assert(!std::is_copy_assignable_v<ConsolidationResult>);
    static_assert(std::is_nothrow_move_constructible_v<ConsolidationResult>);
    static_assert(std::is_nothrow_move_assignable_v<ConsolidationResult>);
    static_assert(std::is_empty_v<MemoryConsolidationEngine>);

    using Analyze = ConsolidationResult (MemoryConsolidationEngine::*)(
        ConsolidationSession&,
        const ConsolidationRequest&,
        const WorkingMemory&,
        const LongTermMemory&) const;
    using Promote = ConsolidationResult (MemoryConsolidationEngine::*)(
        ConsolidationSession&) const;
    using Retain = ConsolidationResult (MemoryConsolidationEngine::*)(
        ConsolidationSession&,
        const WorkingMemory&,
        const LongTermMemory&) const;
    using Validate = ConsolidationResult (MemoryConsolidationEngine::*)(
        const ConsolidationSession&,
        const WorkingMemory&,
        const LongTermMemory&) const;
    using Retrieve = ConsolidationResult (MemoryConsolidationEngine::*)(
        const ConsolidationSession&) const;
    using Forget = ConsolidationResult (MemoryConsolidationEngine::*)(
        ConsolidationSession&) const;

    static_assert(std::is_same_v<
                  decltype(static_cast<Analyze>(
                      &MemoryConsolidationEngine::analyze)),
                  Analyze>);
    static_assert(std::is_same_v<
                  decltype(static_cast<Promote>(
                      &MemoryConsolidationEngine::promote)),
                  Promote>);
    static_assert(std::is_same_v<
                  decltype(static_cast<Retain>(
                      &MemoryConsolidationEngine::retain)),
                  Retain>);
    static_assert(std::is_same_v<
                  decltype(static_cast<Validate>(
                      &MemoryConsolidationEngine::validate)),
                  Validate>);
    static_assert(std::is_same_v<
                  decltype(static_cast<Retrieve>(
                      &MemoryConsolidationEngine::retrieveSession)),
                  Retrieve>);
    static_assert(std::is_same_v<
                  decltype(static_cast<Forget>(
                      &MemoryConsolidationEngine::forgetSession)),
                  Forget>);

    SUCCEED();
}

TEST(MemoryConsolidationOwnershipTest,
     ConstructionAndWorkspaceOwnershipAreExact) {
    EXPECT_THROW(ConsolidationRequest("", "task", "entry"),
                 std::invalid_argument);
    EXPECT_THROW(ConsolidationSession(""), std::invalid_argument);

    const ConsolidationRequest empty_semantic_fields{
        std::string{workspace}, "", ""};
    EXPECT_EQ(empty_semantic_fields.workspaceIdentifier(), workspace);
    EXPECT_TRUE(empty_semantic_fields.taskIdentifier().empty());
    EXPECT_TRUE(empty_semantic_fields.entryIdentifier().empty());

    ConsolidationSession session{std::string{workspace}};
    EXPECT_EQ(session.workspaceIdentifier(), workspace);
    EXPECT_EQ(session.state(), State::Pristine);
    EXPECT_EQ(session.request(), nullptr);
    EXPECT_EQ(session.candidate(), nullptr);
    EXPECT_EQ(session.workingMemory(), nullptr);
    EXPECT_EQ(session.longTermMemory(), nullptr);
}

TEST(MemoryConsolidationLifecycleTest, PristineAndSuccessfulStagesAreExact) {
    Fixture fixture;

    const auto analyzed = fixture.engine.analyze(
        fixture.session, fixture.request, fixture.working, fixture.long_term);
    require_success(analyzed);
    EXPECT_EQ(fixture.session.state(), State::Analyzed);
    ASSERT_NE(fixture.session.request(), nullptr);
    ASSERT_NE(fixture.session.candidate(), nullptr);
    EXPECT_EQ(fixture.session.workingMemory(), nullptr);
    EXPECT_EQ(fixture.session.longTermMemory(), nullptr);
    ASSERT_NE(analyzed.candidate(), nullptr);
    EXPECT_EQ(analyzed.session(), nullptr);
    EXPECT_EQ(analyzed.workingMemory(), nullptr);
    EXPECT_EQ(analyzed.longTermMemory(), nullptr);

    const auto promoted = fixture.engine.promote(fixture.session);
    require_success(promoted);
    EXPECT_EQ(fixture.session.state(), State::Promoted);
    ASSERT_NE(fixture.session.candidate(), nullptr);
    ASSERT_NE(fixture.session.candidate()->longTermMemoryEntry(), nullptr);
    EXPECT_FALSE(fixture.session.candidate()->retainedPosition().has_value());

    const auto retained = fixture.engine.retain(
        fixture.session, fixture.working, fixture.long_term);
    require_success(retained);
    EXPECT_EQ(fixture.session.state(), State::Retained);
    EXPECT_NE(fixture.session.request(), nullptr);
    EXPECT_NE(fixture.session.candidate(), nullptr);
    EXPECT_NE(fixture.session.workingMemory(), nullptr);
    EXPECT_NE(fixture.session.longTermMemory(), nullptr);
}

TEST(MemoryConsolidationLifecycleTest, PromotionIsTypedAndIdempotent) {
    Fixture fixture;
    analyze(fixture);

    const auto first = fixture.engine.promote(fixture.session);
    require_success(first);
    const auto first_session = snapshot_of(fixture.session);
    ASSERT_NE(first.candidate(), nullptr);
    ASSERT_NE(first.candidate()->longTermMemoryEntry(), nullptr);
    EXPECT_EQ(first.candidate()->longTermMemoryEntry()->identifier(),
              source_identifier);
    EXPECT_EQ(first.candidate()->longTermMemoryEntry()->value(), source_value);
    EXPECT_FALSE(first.candidate()->longTermMemoryEntry()->archived());

    const auto second = fixture.engine.promote(fixture.session);
    require_success(second);
    ASSERT_NE(second.candidate(), nullptr);
    EXPECT_EQ(snapshot_of(*second.candidate()),
              snapshot_of(*first.candidate()));
    EXPECT_EQ(snapshot_of(fixture.session), first_session);
}

TEST(MemoryConsolidationProvenanceTest,
     CandidatePreservesCompleteWorkingEvidence) {
    Fixture fixture;
    const auto result = fixture.engine.analyze(
        fixture.session, fixture.request, fixture.working, fixture.long_term);
    require_success(result);
    ASSERT_NE(result.candidate(), nullptr);

    const auto& candidate = *result.candidate();
    EXPECT_EQ(candidate.workspaceIdentifier(), workspace);
    EXPECT_EQ(candidate.taskIdentifier(), task);
    EXPECT_EQ(candidate.sourcePosition(), 1U);
    ASSERT_NE(candidate.workingMemoryEntry(), nullptr);
    EXPECT_EQ(candidate.workingMemoryEntry()->identifier(), source_identifier);
    EXPECT_EQ(candidate.workingMemoryEntry()->value(), source_value);
    EXPECT_EQ(candidate.workingMemoryEntry()->expirationPoint(), 200U);
    EXPECT_EQ(candidate.longTermMemoryEntry(), nullptr);
    EXPECT_FALSE(candidate.retainedPosition().has_value());
}

TEST(MemoryConsolidationTransitionTest,
     IdentityContentAndBaseStateArePreserved) {
    Fixture fixture;
    const auto result = retain_transition(fixture);
    require_success(result);
    ASSERT_NE(result.workingMemory(), nullptr);
    ASSERT_NE(result.longTermMemory(), nullptr);

    EXPECT_EQ(result.workingMemory()->find(source_identifier), nullptr);
    const auto* const retained = result.longTermMemory()->find(source_identifier);
    ASSERT_NE(retained, nullptr);
    EXPECT_EQ(retained->identifier(), source_identifier);
    EXPECT_EQ(retained->value(), source_value);
    EXPECT_FALSE(retained->archived());
}

TEST(MemoryConsolidationTransitionTest,
     WorkingSuccessorPreservesSurvivorsAndOrder) {
    Fixture fixture;
    const auto before = snapshot_of(fixture.working);
    const auto result = retain_transition(fixture);
    require_success(result);
    ASSERT_NE(result.workingMemory(), nullptr);

    const auto successor = snapshot_of(*result.workingMemory());
    ASSERT_EQ(before.entries.size(), 3U);
    ASSERT_EQ(successor.entries.size(), 2U);
    EXPECT_EQ(successor.workspace_identifier, before.workspace_identifier);
    EXPECT_EQ(successor.active, before.active);
    EXPECT_EQ(successor.task_identifier, before.task_identifier);
    EXPECT_EQ(successor.entries[0], before.entries[0]);
    EXPECT_EQ(successor.entries[1], before.entries[2]);
}

TEST(MemoryConsolidationTransitionTest,
     LongTermSuccessorAppendsAndPreservesAllState) {
    Fixture fixture;
    const auto before = snapshot_of(fixture.long_term);
    ASSERT_TRUE(is_forgotten(fixture.long_term, "forgotten-unrelated"));

    const auto result = retain_transition(fixture);
    require_success(result);
    ASSERT_NE(result.longTermMemory(), nullptr);
    ASSERT_NE(result.candidate(), nullptr);

    const auto successor = snapshot_of(*result.longTermMemory());
    ASSERT_EQ(successor.entries.size(), before.entries.size() + 1U);
    for (std::size_t index = 0U; index < before.entries.size(); ++index) {
        EXPECT_EQ(successor.entries[index], before.entries[index]);
    }
    EXPECT_EQ(successor.entries.back().identifier, source_identifier);
    EXPECT_EQ(successor.entries.back().value, source_value);
    EXPECT_FALSE(successor.entries.back().archived);
    ASSERT_TRUE(result.candidate()->retainedPosition().has_value());
    EXPECT_EQ(*result.candidate()->retainedPosition(), before.entries.size());
    EXPECT_TRUE(
        is_forgotten(*result.longTermMemory(), "forgotten-unrelated"));
}

TEST(MemoryConsolidationTransitionTest, AtomicSuccessorPairIsComplete) {
    Fixture fixture;
    const auto original_working = snapshot_of(fixture.working);
    const auto original_long_term = snapshot_of(fixture.long_term);
    const auto result = retain_transition(fixture);
    require_success(result);

    ASSERT_NE(result.workingMemory(), nullptr);
    ASSERT_NE(result.longTermMemory(), nullptr);
    ASSERT_NE(fixture.session.workingMemory(), nullptr);
    ASSERT_NE(fixture.session.longTermMemory(), nullptr);
    EXPECT_EQ(snapshot_of(*result.workingMemory()),
              snapshot_of(*fixture.session.workingMemory()));
    EXPECT_EQ(snapshot_of(*result.longTermMemory()),
              snapshot_of(*fixture.session.longTermMemory()));
    EXPECT_NE(result.workingMemory(), fixture.session.workingMemory());
    EXPECT_NE(result.longTermMemory(), fixture.session.longTermMemory());

    EXPECT_EQ(snapshot_of(fixture.working), original_working);
    EXPECT_EQ(snapshot_of(fixture.long_term), original_long_term);
    EXPECT_EQ(result.workingMemory()->find(source_identifier), nullptr);
    EXPECT_NE(result.longTermMemory()->find(source_identifier), nullptr);
}

TEST(MemoryConsolidationValidationTest, IsStateDependentAndObservational) {
    Fixture fixture;

    {
        const auto before = snapshot_of(fixture.session);
        const auto result = fixture.engine.validate(
            fixture.session, fixture.working, fixture.long_term);
        expect_failure(result, "SESSION_NOT_ANALYZED");
        EXPECT_EQ(snapshot_of(fixture.session), before);
    }

    analyze(fixture);
    {
        const auto before = snapshot_of(fixture.session);
        const auto result = fixture.engine.validate(
            fixture.session, fixture.working, fixture.long_term);
        require_success(result);
        EXPECT_EQ(snapshot_of(fixture.session), before);
    }

    {
        const auto result = fixture.engine.promote(fixture.session);
        require_success(result);
        const auto before = snapshot_of(fixture.session);
        const auto validation = fixture.engine.validate(
            fixture.session, fixture.working, fixture.long_term);
        require_success(validation);
        EXPECT_EQ(snapshot_of(fixture.session), before);
    }

    const auto retained = fixture.engine.retain(
        fixture.session, fixture.working, fixture.long_term);
    require_success(retained);
    ASSERT_NE(retained.workingMemory(), nullptr);
    ASSERT_NE(retained.longTermMemory(), nullptr);
    const auto before = snapshot_of(fixture.session);
    const auto validation = fixture.engine.validate(
        fixture.session,
        *retained.workingMemory(),
        *retained.longTermMemory());
    require_success(validation);
    EXPECT_EQ(snapshot_of(fixture.session), before);
}

TEST(MemoryConsolidationSessionTest,
     RetrieveDeepCopiesEveryLifecycleStage) {
    Fixture fixture;
    const auto check = [&fixture] {
        const auto before = snapshot_of(fixture.session);
        const auto result = fixture.engine.retrieveSession(fixture.session);
        require_success(result);
        ASSERT_NE(result.session(), nullptr);
        EXPECT_EQ(snapshot_of(*result.session()), before);
        EXPECT_NE(result.session(), &fixture.session);
        EXPECT_EQ(snapshot_of(fixture.session), before);
    };

    check();
    analyze(fixture);
    check();
    {
        const auto result = fixture.engine.promote(fixture.session);
        require_success(result);
    }
    check();
    {
        const auto result = fixture.engine.retain(
            fixture.session, fixture.working, fixture.long_term);
        require_success(result);
    }
    check();
    {
        const auto result = fixture.engine.forgetSession(fixture.session);
        require_success(result);
    }
    check();
}

TEST(MemoryConsolidationSessionTest,
     ForgettingEveryStageIsTerminalAndIsolated) {
    for (const State stage : {State::Pristine,
                              State::Analyzed,
                              State::Promoted,
                              State::Retained,
                              State::Forgotten}) {
        Fixture fixture;
        std::optional<WorkingSnapshot> detached_working;
        std::optional<LongTermSnapshot> detached_long_term;

        if (stage != State::Pristine && stage != State::Forgotten) {
            analyze(fixture);
        }
        if (stage == State::Promoted || stage == State::Retained) {
            const auto result = fixture.engine.promote(fixture.session);
            require_success(result);
        }
        if (stage == State::Retained) {
            const auto result = fixture.engine.retain(
                fixture.session, fixture.working, fixture.long_term);
            require_success(result);
            ASSERT_NE(result.workingMemory(), nullptr);
            ASSERT_NE(result.longTermMemory(), nullptr);
            detached_working = snapshot_of(*result.workingMemory());
            detached_long_term = snapshot_of(*result.longTermMemory());
        }
        if (stage == State::Forgotten) {
            const auto result = fixture.engine.forgetSession(fixture.session);
            require_success(result);
        }

        const auto working_before = snapshot_of(fixture.working);
        const auto long_term_before = snapshot_of(fixture.long_term);
        const auto forgotten = fixture.engine.forgetSession(fixture.session);
        require_success(forgotten);
        EXPECT_EQ(fixture.session.state(), State::Forgotten);
        EXPECT_EQ(fixture.session.request(), nullptr);
        EXPECT_EQ(fixture.session.candidate(), nullptr);
        EXPECT_EQ(fixture.session.workingMemory(), nullptr);
        EXPECT_EQ(fixture.session.longTermMemory(), nullptr);
        EXPECT_EQ(snapshot_of(fixture.working), working_before);
        EXPECT_EQ(snapshot_of(fixture.long_term), long_term_before);

        const auto repeated = fixture.engine.forgetSession(fixture.session);
        require_success(repeated);
        EXPECT_EQ(fixture.session.state(), State::Forgotten);
        if (detached_working.has_value()) {
            EXPECT_EQ(detached_working->entries.size(), 2U);
            EXPECT_EQ(detached_long_term->entries.size(), 3U);
        }
    }
}

TEST(MemoryConsolidationLifecycleTest,
     RepeatedAndWrongStageOperationsAreExact) {
    Fixture fixture;

    expect_failure(fixture.engine.promote(fixture.session),
                   "SESSION_NOT_ANALYZED");
    expect_failure(
        fixture.engine.retain(
            fixture.session, fixture.working, fixture.long_term),
        "SESSION_NOT_ANALYZED");

    analyze(fixture);
    expect_failure(
        fixture.engine.analyze(
            fixture.session,
            fixture.request,
            fixture.working,
            fixture.long_term),
        "SESSION_ALREADY_STARTED");
    expect_failure(
        fixture.engine.retain(
            fixture.session, fixture.working, fixture.long_term),
        "SESSION_NOT_PROMOTED");

    {
        const auto result = fixture.engine.promote(fixture.session);
        require_success(result);
    }
    {
        const auto result = fixture.engine.retain(
            fixture.session, fixture.working, fixture.long_term);
        require_success(result);
    }
    expect_failure(fixture.engine.promote(fixture.session),
                   "SESSION_ALREADY_RETAINED");
    expect_failure(
        fixture.engine.retain(
            fixture.session, fixture.working, fixture.long_term),
        "SESSION_ALREADY_RETAINED");

    {
        const auto result = fixture.engine.forgetSession(fixture.session);
        require_success(result);
    }
    expect_failure(
        fixture.engine.analyze(
            fixture.session,
            fixture.request,
            fixture.working,
            fixture.long_term),
        "SESSION_FORGOTTEN");
    expect_failure(fixture.engine.promote(fixture.session),
                   "SESSION_FORGOTTEN");
    expect_failure(
        fixture.engine.retain(
            fixture.session, fixture.working, fixture.long_term),
        "SESSION_FORGOTTEN");
    expect_failure(
        fixture.engine.validate(
            fixture.session, fixture.working, fixture.long_term),
        "SESSION_FORGOTTEN");
}

TEST(MemoryConsolidationPrecedenceTest, AnalyzePrecedenceIsExact) {
    {
        Fixture fixture;
        const auto forgotten = fixture.engine.forgetSession(fixture.session);
        require_success(forgotten);
        ConsolidationRequest wrong{"other", "", ""};
        WorkingMemory wrong_working{"other"};
        LongTermMemory wrong_long_term{"other"};
        expect_failure(
            fixture.engine.analyze(
                fixture.session, wrong, wrong_working, wrong_long_term),
            "SESSION_FORGOTTEN");
    }
    {
        Fixture fixture;
        analyze(fixture);
        ConsolidationRequest wrong{"other", "", ""};
        WorkingMemory wrong_working{"other"};
        LongTermMemory wrong_long_term{"other"};
        expect_failure(
            fixture.engine.analyze(
                fixture.session, wrong, wrong_working, wrong_long_term),
            "SESSION_ALREADY_STARTED");
    }
    {
        Fixture fixture;
        ConsolidationRequest wrong{"other", "", ""};
        WorkingMemory wrong_working{"other"};
        LongTermMemory wrong_long_term{"other"};
        expect_failure(
            fixture.engine.analyze(
                fixture.session, wrong, wrong_working, wrong_long_term),
            "WORKSPACE_MISMATCH");
    }
    {
        Fixture fixture;
        ConsolidationRequest request{std::string{workspace}, "", ""};
        WorkingMemory wrong_working{"other"};
        LongTermMemory wrong_long_term{"other"};
        expect_failure(
            fixture.engine.analyze(
                fixture.session,
                request,
                wrong_working,
                wrong_long_term),
            "WORKSPACE_MISMATCH");
    }
    {
        Fixture fixture;
        ConsolidationRequest request{std::string{workspace}, "", ""};
        LongTermMemory wrong_long_term{"other"};
        expect_failure(
            fixture.engine.analyze(
                fixture.session,
                request,
                fixture.working,
                wrong_long_term),
            "WORKSPACE_MISMATCH");
    }
    {
        Fixture fixture;
        ConsolidationRequest request{std::string{workspace}, "", ""};
        expect_failure(
            fixture.engine.analyze(
                fixture.session,
                request,
                fixture.working,
                fixture.long_term),
            "INVALID_TASK_IDENTIFIER");
    }
    {
        Fixture fixture;
        ConsolidationRequest request{std::string{workspace},
                                     std::string{task},
                                     ""};
        expect_failure(
            fixture.engine.analyze(
                fixture.session,
                request,
                fixture.working,
                fixture.long_term),
            "INVALID_IDENTIFIER");
    }
}

TEST(MemoryConsolidationPrecedenceTest,
     SourcePreconditionsAndDriftAreExact) {
    {
        Fixture fixture;
        WorkingMemory inactive{std::string{workspace}};
        ConsolidationRequest absent{std::string{workspace},
                                    "wrong-task",
                                    "absent"};
        expect_failure(
            fixture.engine.analyze(
                fixture.session, absent, inactive, fixture.long_term),
            "WORKING_MEMORY_NOT_ACTIVE");
    }
    {
        Fixture fixture;
        ConsolidationRequest absent{std::string{workspace},
                                    "wrong-task",
                                    "absent"};
        expect_failure(
            fixture.engine.analyze(
                fixture.session, absent, fixture.working, fixture.long_term),
            "TASK_MISMATCH");
    }
    {
        Fixture fixture;
        ConsolidationRequest absent{std::string{workspace},
                                    std::string{task},
                                    "absent"};
        expect_failure(
            fixture.engine.analyze(
                fixture.session, absent, fixture.working, fixture.long_term),
            "SOURCE_NOT_FOUND");
    }
    {
        Fixture fixture;
        promote(fixture);
        WorkingMemory changed{fixture.working};
        store(changed,
              std::string{source_identifier},
              "changed-value",
              200U);
        expect_failure(
            fixture.engine.retain(
                fixture.session, changed, fixture.long_term),
            "SOURCE_CHANGED");
    }
    {
        Fixture fixture;
        promote(fixture);
        WorkingMemory changed{fixture.working};
        store(changed, "unrelated", "unrelated-value");
        expect_failure(
            fixture.engine.retain(
                fixture.session, changed, fixture.long_term),
            "TRANSITION_STATE_MISMATCH");
    }
    {
        Fixture fixture;
        promote(fixture);
        WorkingMemory changed{fixture.working};
        store(changed,
              std::string{source_identifier},
              std::string{source_value},
              201U);
        expect_failure(
            fixture.engine.retain(
                fixture.session, changed, fixture.long_term),
            "SOURCE_CHANGED");
    }
    {
        Fixture fixture;
        promote(fixture);
        WorkingMemory changed{fixture.working};
        WorkingMemoryEngine engine;
        const auto forgotten = engine.forget(changed, source_identifier);
        ASSERT_TRUE(forgotten.succeeded()) << forgotten.code() << ": "
                                           << forgotten.message();
        expect_failure(
            fixture.engine.retain(
                fixture.session, changed, fixture.long_term),
            "SOURCE_CHANGED");
    }
    {
        Fixture fixture;
        promote(fixture);
        WorkingMemory changed{fixture.working};
        WorkingMemoryEngine engine;
        const auto forgotten = engine.forget(changed, source_identifier);
        ASSERT_TRUE(forgotten.succeeded()) << forgotten.code() << ": "
                                           << forgotten.message();
        store(changed,
              std::string{source_identifier},
              std::string{source_value},
              200U);
        expect_failure(
            fixture.engine.retain(
                fixture.session, changed, fixture.long_term),
            "SOURCE_CHANGED");
    }
}

TEST(MemoryConsolidationPrecedenceTest, DestinationStatesAreExact) {
    {
        Fixture fixture;
        retain(fixture.long_term,
               std::string{source_identifier},
               std::string{source_value});
        expect_failure(
            fixture.engine.analyze(
                fixture.session,
                fixture.request,
                fixture.working,
                fixture.long_term),
            "DESTINATION_CONFLICT");
    }
    {
        Fixture fixture;
        retain(fixture.long_term,
               std::string{source_identifier},
               std::string{source_value});
        archive(fixture.long_term, source_identifier);
        expect_failure(
            fixture.engine.analyze(
                fixture.session,
                fixture.request,
                fixture.working,
                fixture.long_term),
            "DESTINATION_CONFLICT");
    }
    {
        Fixture fixture;
        retain(fixture.long_term,
               std::string{source_identifier},
               std::string{source_value});
        forget(fixture.long_term, source_identifier);
        expect_failure(
            fixture.engine.analyze(
                fixture.session,
                fixture.request,
                fixture.working,
                fixture.long_term),
            "DESTINATION_FORGOTTEN");
    }
    {
        Fixture fixture;
        promote(fixture);
        LongTermMemory changed{fixture.long_term};
        retain(changed, "unrelated-new", "unrelated-new-value");
        expect_failure(
            fixture.engine.retain(fixture.session, fixture.working, changed),
            "TRANSITION_STATE_MISMATCH");
    }
    {
        Fixture fixture;
        promote(fixture);
        LongTermMemory changed{fixture.long_term};
        retain(changed,
               std::string{source_identifier},
               std::string{source_value});
        forget(changed, source_identifier);
        expect_failure(
            fixture.engine.retain(fixture.session, fixture.working, changed),
            "DESTINATION_FORGOTTEN");
    }
}

TEST(MemoryConsolidationPrecedenceTest, RetainAndValidatePrecedenceIsExact) {
    {
        Fixture fixture;
        promote(fixture);
        WorkingMemory wrong_working{"wrong"};
        LongTermMemory wrong_long_term{"wrong"};
        expect_failure(
            fixture.engine.retain(
                fixture.session, wrong_working, wrong_long_term),
            "WORKSPACE_MISMATCH");
    }
    {
        Fixture fixture;
        promote(fixture);
        LongTermMemory wrong_long_term{"wrong"};
        expect_failure(
            fixture.engine.retain(
                fixture.session, fixture.working, wrong_long_term),
            "WORKSPACE_MISMATCH");
    }
    {
        Fixture fixture;
        promote(fixture);
        WorkingMemory inactive{std::string{workspace}};
        expect_failure(
            fixture.engine.retain(
                fixture.session, inactive, fixture.long_term),
            "WORKING_MEMORY_NOT_ACTIVE");
    }
    {
        Fixture fixture;
        promote(fixture);
        WorkingMemory changed{fixture.working};
        activate(changed, "other-task");
        expect_failure(
            fixture.engine.retain(
                fixture.session, changed, fixture.long_term),
            "TASK_MISMATCH");
    }
    {
        Fixture fixture;
        promote(fixture);
        WorkingMemory wrong_working{"wrong"};
        LongTermMemory wrong_long_term{"wrong"};
        expect_failure(
            fixture.engine.validate(
                fixture.session, wrong_working, wrong_long_term),
            "WORKSPACE_MISMATCH");
    }
}

TEST(MemoryConsolidationValidationTest,
     RejectsCompletePrestateAndSuccessorDriftWithoutMutation) {
    {
        Fixture fixture;
        analyze(fixture);
        WorkingMemory changed{fixture.working};
        store(changed,
              std::string{source_identifier},
              std::string{source_value},
              201U);
        const auto before = snapshot_of(fixture.session);
        expect_failure(
            fixture.engine.validate(
                fixture.session, changed, fixture.long_term),
            "SOURCE_CHANGED");
        EXPECT_EQ(snapshot_of(fixture.session), before);
    }
    {
        Fixture fixture;
        promote(fixture);
        LongTermMemory changed{fixture.long_term};
        retain(changed, "unrelated-drift", "unrelated-drift-value");
        const auto before = snapshot_of(fixture.session);
        expect_failure(
            fixture.engine.validate(
                fixture.session, fixture.working, changed),
            "TRANSITION_STATE_MISMATCH");
        EXPECT_EQ(snapshot_of(fixture.session), before);
    }
    {
        Fixture fixture;
        const auto retained = retain_transition(fixture);
        require_success(retained);
        ASSERT_NE(retained.workingMemory(), nullptr);
        ASSERT_NE(retained.longTermMemory(), nullptr);
        WorkingMemory changed{*retained.workingMemory()};
        store(changed, "successor-drift", "successor-drift-value");
        const auto before = snapshot_of(fixture.session);
        expect_failure(
            fixture.engine.validate(
                fixture.session, changed, *retained.longTermMemory()),
            "TRANSITION_STATE_MISMATCH");
        EXPECT_EQ(snapshot_of(fixture.session), before);
    }
}

TEST(MemoryConsolidationResultTest, SuccessPayloadShapesAreExact) {
    Fixture fixture;
    const auto analyzed = fixture.engine.analyze(
        fixture.session, fixture.request, fixture.working, fixture.long_term);
    require_success(analyzed);
    EXPECT_NE(analyzed.candidate(), nullptr);
    EXPECT_EQ(analyzed.session(), nullptr);
    EXPECT_EQ(analyzed.workingMemory(), nullptr);
    EXPECT_EQ(analyzed.longTermMemory(), nullptr);

    const auto promoted = fixture.engine.promote(fixture.session);
    require_success(promoted);
    EXPECT_NE(promoted.candidate(), nullptr);
    EXPECT_EQ(promoted.session(), nullptr);
    EXPECT_EQ(promoted.workingMemory(), nullptr);
    EXPECT_EQ(promoted.longTermMemory(), nullptr);

    const auto retained = fixture.engine.retain(
        fixture.session, fixture.working, fixture.long_term);
    require_success(retained);
    EXPECT_NE(retained.candidate(), nullptr);
    EXPECT_EQ(retained.session(), nullptr);
    EXPECT_NE(retained.workingMemory(), nullptr);
    EXPECT_NE(retained.longTermMemory(), nullptr);

    const auto validated = fixture.engine.validate(
        fixture.session,
        *retained.workingMemory(),
        *retained.longTermMemory());
    require_success(validated);
    EXPECT_EQ(validated.candidate(), nullptr);
    EXPECT_EQ(validated.session(), nullptr);
    EXPECT_EQ(validated.workingMemory(), nullptr);
    EXPECT_EQ(validated.longTermMemory(), nullptr);

    const auto retrieved = fixture.engine.retrieveSession(fixture.session);
    require_success(retrieved);
    EXPECT_EQ(retrieved.candidate(), nullptr);
    EXPECT_NE(retrieved.session(), nullptr);
    EXPECT_EQ(retrieved.workingMemory(), nullptr);
    EXPECT_EQ(retrieved.longTermMemory(), nullptr);

    const auto forgotten = fixture.engine.forgetSession(fixture.session);
    require_success(forgotten);
    EXPECT_EQ(forgotten.candidate(), nullptr);
    EXPECT_EQ(forgotten.session(), nullptr);
    EXPECT_EQ(forgotten.workingMemory(), nullptr);
    EXPECT_EQ(forgotten.longTermMemory(), nullptr);
}

TEST(MemoryConsolidationResultTest, CodesMessagesAndPayloadShapesAreClosed) {
    Fixture fixture;
    const auto invalid = fixture.engine.promote(fixture.session);
    expect_failure(invalid, "SESSION_NOT_ANALYZED");

    const auto success = fixture.engine.retrieveSession(fixture.session);
    require_success(success);
    EXPECT_TRUE(success.message().empty());

    const std::vector<std::string_view> closed_codes{
        "OK",
        "SESSION_FORGOTTEN",
        "SESSION_ALREADY_STARTED",
        "SESSION_NOT_ANALYZED",
        "SESSION_NOT_PROMOTED",
        "SESSION_ALREADY_RETAINED",
        "WORKSPACE_MISMATCH",
        "INVALID_TASK_IDENTIFIER",
        "INVALID_IDENTIFIER",
        "WORKING_MEMORY_NOT_ACTIVE",
        "TASK_MISMATCH",
        "SOURCE_NOT_FOUND",
        "SOURCE_CHANGED",
        "DESTINATION_CONFLICT",
        "DESTINATION_FORGOTTEN",
        "TRANSITION_STATE_MISMATCH"};
    EXPECT_NE(std::find(closed_codes.begin(), closed_codes.end(),
                        std::string_view{invalid.code()}),
              closed_codes.end());
}

TEST(MemoryConsolidationValueTest, CopyMoveAndLifetimeContractsAreExact) {
    Fixture fixture;
    analyze(fixture);
    ASSERT_NE(fixture.session.candidate(), nullptr);

    ConsolidationCandidate candidate_copy{*fixture.session.candidate()};
    const auto candidate_snapshot = snapshot_of(candidate_copy);
    ConsolidationCandidate candidate_moved{std::move(candidate_copy)};
    EXPECT_EQ(snapshot_of(candidate_moved), candidate_snapshot);
    EXPECT_TRUE(candidate_copy.workspaceIdentifier().empty());
    EXPECT_TRUE(candidate_copy.taskIdentifier().empty());
    EXPECT_EQ(candidate_copy.sourcePosition(), 0U);
    EXPECT_EQ(candidate_copy.workingMemoryEntry(), nullptr);
    EXPECT_EQ(candidate_copy.longTermMemoryEntry(), nullptr);
    EXPECT_FALSE(candidate_copy.retainedPosition().has_value());

    ConsolidationCandidate assigned_candidate{
        *fixture.session.candidate()};
    ConsolidationCandidate copied_candidate{candidate_moved};
    assigned_candidate = copied_candidate;
    EXPECT_EQ(snapshot_of(assigned_candidate), snapshot_of(copied_candidate));
    assigned_candidate = std::move(copied_candidate);
    EXPECT_EQ(snapshot_of(assigned_candidate), candidate_snapshot);
    EXPECT_TRUE(copied_candidate.workspaceIdentifier().empty());
    EXPECT_EQ(copied_candidate.workingMemoryEntry(), nullptr);

    const auto session_snapshot = snapshot_of(fixture.session);
    ConsolidationSession session_copy{fixture.session};
    EXPECT_EQ(snapshot_of(session_copy), session_snapshot);
    const auto forgotten = fixture.engine.forgetSession(fixture.session);
    require_success(forgotten);
    EXPECT_EQ(snapshot_of(session_copy), session_snapshot);

    ConsolidationSession session_moved{std::move(session_copy)};
    EXPECT_EQ(snapshot_of(session_moved), session_snapshot);
    EXPECT_EQ(session_copy.workspaceIdentifier(), workspace);
    EXPECT_EQ(session_copy.state(), State::Pristine);
    EXPECT_EQ(session_copy.request(), nullptr);
    EXPECT_EQ(session_copy.candidate(), nullptr);
    EXPECT_EQ(session_copy.workingMemory(), nullptr);
    EXPECT_EQ(session_copy.longTermMemory(), nullptr);

    auto result = fixture.engine.retrieveSession(session_moved);
    const auto result_snapshot = snapshot_of(result);
    ConsolidationResult moved_result{std::move(result)};
    EXPECT_EQ(snapshot_of(moved_result), result_snapshot);
    EXPECT_FALSE(result.succeeded());
    EXPECT_TRUE(result.code().empty());
    EXPECT_TRUE(result.message().empty());
    EXPECT_EQ(result.candidate(), nullptr);
    EXPECT_EQ(result.session(), nullptr);
    EXPECT_EQ(result.workingMemory(), nullptr);
    EXPECT_EQ(result.longTermMemory(), nullptr);

    auto assignment_source = fixture.engine.retrieveSession(session_moved);
    auto assignment_target = fixture.engine.retrieveSession(session_moved);
    const auto assignment_snapshot = snapshot_of(assignment_source);
    assignment_target = std::move(assignment_source);
    EXPECT_EQ(snapshot_of(assignment_target), assignment_snapshot);
    EXPECT_FALSE(assignment_source.succeeded());
    EXPECT_TRUE(assignment_source.code().empty());
    EXPECT_TRUE(assignment_source.message().empty());
    EXPECT_EQ(assignment_source.candidate(), nullptr);
    EXPECT_EQ(assignment_source.session(), nullptr);
    EXPECT_EQ(assignment_source.workingMemory(), nullptr);
    EXPECT_EQ(assignment_source.longTermMemory(), nullptr);
}

TEST(MemoryConsolidationValueTest,
     ResultAndRetrievedSessionOutliveAllSourceValues) {
    const auto make_retained_result = [] {
        Fixture fixture;
        return retain_transition(fixture);
    };

    auto retained = make_retained_result();
    require_success(retained);
    ASSERT_NE(retained.workingMemory(), nullptr);
    ASSERT_NE(retained.longTermMemory(), nullptr);
    EXPECT_EQ(retained.workingMemory()->find(source_identifier), nullptr);
    EXPECT_NE(retained.longTermMemory()->find(source_identifier), nullptr);

    ConsolidationSession detached_session = [] {
        Fixture fixture;
        const auto result = fixture.engine.retrieveSession(fixture.session);
        require_success(result);
        return ConsolidationSession{*result.session()};
    }();
    EXPECT_EQ(detached_session.workspaceIdentifier(), workspace);
    EXPECT_EQ(detached_session.state(), State::Pristine);
}

TEST(MemoryConsolidationFailureTest,
     AllOutcomesLeaveInputPrestatesUnchanged) {
    Fixture fixture;
    const auto working_before = snapshot_of(fixture.working);
    const auto long_term_before = snapshot_of(fixture.long_term);

    const auto analyzed = fixture.engine.analyze(
        fixture.session, fixture.request, fixture.working, fixture.long_term);
    require_success(analyzed);
    EXPECT_EQ(snapshot_of(fixture.working), working_before);
    EXPECT_EQ(snapshot_of(fixture.long_term), long_term_before);

    const auto promoted = fixture.engine.promote(fixture.session);
    require_success(promoted);
    EXPECT_EQ(snapshot_of(fixture.working), working_before);
    EXPECT_EQ(snapshot_of(fixture.long_term), long_term_before);

    WorkingMemory changed{fixture.working};
    store(changed, std::string{source_identifier}, "changed-value", 200U);
    const auto session_before_failure = snapshot_of(fixture.session);
    const auto failure = fixture.engine.retain(
        fixture.session, changed, fixture.long_term);
    expect_failure(failure, "SOURCE_CHANGED");
    EXPECT_EQ(snapshot_of(fixture.session), session_before_failure);
    EXPECT_EQ(snapshot_of(fixture.working), working_before);
    EXPECT_EQ(snapshot_of(fixture.long_term), long_term_before);

    const auto retained = fixture.engine.retain(
        fixture.session, fixture.working, fixture.long_term);
    require_success(retained);
    EXPECT_EQ(snapshot_of(fixture.working), working_before);
    EXPECT_EQ(snapshot_of(fixture.long_term), long_term_before);
}

TEST(MemoryConsolidationDeterminismTest,
     EquivalentHistoriesAreCompletelyEqual) {
    Fixture left;
    Fixture right;

    const auto left_analyzed = left.engine.analyze(
        left.session, left.request, left.working, left.long_term);
    const auto right_analyzed = right.engine.analyze(
        right.session, right.request, right.working, right.long_term);
    EXPECT_EQ(snapshot_of(left_analyzed), snapshot_of(right_analyzed));
    EXPECT_EQ(snapshot_of(left.session), snapshot_of(right.session));

    const auto left_promoted = left.engine.promote(left.session);
    const auto right_promoted = right.engine.promote(right.session);
    EXPECT_EQ(snapshot_of(left_promoted), snapshot_of(right_promoted));
    EXPECT_EQ(snapshot_of(left.session), snapshot_of(right.session));

    const auto left_retained = left.engine.retain(
        left.session, left.working, left.long_term);
    const auto right_retained = right.engine.retain(
        right.session, right.working, right.long_term);
    EXPECT_EQ(snapshot_of(left_retained), snapshot_of(right_retained));
    EXPECT_EQ(snapshot_of(left.session), snapshot_of(right.session));
}

TEST(MemoryConsolidationBoundaryTest,
     IndependentEnginesAndValuesRemainIsolated) {
    const auto run = [] {
        Fixture fixture;
        const auto result = retain_transition(fixture);
        if (!result.succeeded()) {
            throw std::runtime_error{result.code() + ": " + result.message()};
        }
        return std::pair{snapshot_of(fixture.session), snapshot_of(result)};
    };

    auto first = std::async(std::launch::async, run);
    auto second = std::async(std::launch::async, run);
    EXPECT_EQ(first.get(), second.get());
}

TEST(MemoryConsolidationBoundaryTest,
     PublicSurfaceUsesOnlyReleasedMemoryTypes) {
    static_assert(std::is_empty_v<MemoryConsolidationEngine>);
    static_assert(std::is_same_v<
                  decltype(std::declval<const ConsolidationSession&>()
                               .workingMemory()),
                  const WorkingMemory*>);
    static_assert(std::is_same_v<
                  decltype(std::declval<const ConsolidationSession&>()
                               .longTermMemory()),
                  const LongTermMemory*>);
    static_assert(std::is_same_v<
                  decltype(std::declval<const ConsolidationCandidate&>()
                               .workingMemoryEntry()),
                  const WorkingMemoryEntry*>);
    static_assert(std::is_same_v<
                  decltype(std::declval<const ConsolidationCandidate&>()
                               .longTermMemoryEntry()),
                  const LongTermMemoryEntry*>);
    SUCCEED();
}

TEST(MemoryConsolidationBoundaryTest,
     PersistenceDoesNotOwnSessionLifecycle) {
    Fixture fixture;
    const auto retained = retain_transition(fixture);
    require_success(retained);
    ASSERT_NE(retained.longTermMemory(), nullptr);

    LongTermMemory persisted_value{*retained.longTermMemory()};
    const auto persisted_snapshot = snapshot_of(persisted_value);
    const auto forgotten = fixture.engine.forgetSession(fixture.session);
    require_success(forgotten);
    EXPECT_EQ(snapshot_of(persisted_value), persisted_snapshot);
    EXPECT_EQ(fixture.session.state(), State::Forgotten);
}

TEST(MemoryConsolidationBoundaryTest, NoExcludedCapabilityIsObservable) {
    Fixture fixture;
    const auto working_before = snapshot_of(fixture.working);
    const auto long_term_before = snapshot_of(fixture.long_term);
    const auto retained = retain_transition(fixture);
    require_success(retained);

    EXPECT_EQ(snapshot_of(fixture.working), working_before);
    EXPECT_EQ(snapshot_of(fixture.long_term), long_term_before);
    ASSERT_NE(retained.workingMemory(), nullptr);
    ASSERT_NE(retained.longTermMemory(), nullptr);
    EXPECT_EQ(retained.workingMemory()->size(), 2U);
    EXPECT_EQ(retained.longTermMemory()->size(), 3U);
}

} // namespace
