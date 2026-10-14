#include <cca/memory/long_term_memory.hpp>
#include <cca/memory/procedural_memory.hpp>
#include <cca/representation/representation.hpp>
#include <cca/runtime/runtime.hpp>
#include <cca/runtime/runtime_builder.hpp>
#include <cca/runtime/runtime_id.hpp>

#include "procedural_memory_persistence.hpp"

#include <gtest/gtest.h>

#include <algorithm>
#include <array>
#include <cstddef>
#include <cstdint>
#include <memory>
#include <optional>
#include <stdexcept>
#include <string>
#include <string_view>
#include <thread>
#include <type_traits>
#include <utility>
#include <vector>

/*
CCA-PRMEM-1.0 requirement coverage
----------------------------------
CCA-PRMEM-001: ProceduralMemoryArchitectureTest (CTest)
CCA-PRMEM-002: ProceduralMemoryApiTest.PublicDeclarationsMatchContract
CCA-PRMEM-003: ProceduralMemoryApiTest.PublicDeclarationsMatchContract
CCA-PRMEM-004: ProceduralMemoryOwnershipTest.WorkspaceBoundaryIsRequiredAndImmutable
CCA-PRMEM-005: ProceduralMemoryIsolationTest and architecture gate
CCA-PRMEM-006: ProceduralMemoryObservationTest.PristineAndCanonicalObservationAreExact
CCA-PRMEM-007: ProceduralMemorySourceTest.ProvenanceIsOwnedAndEvidenceRemainsAuthoritative
CCA-PRMEM-008: ProceduralMemoryPrecedenceTest.WorkspaceValidationPrecedesEveryProposalFailure
CCA-PRMEM-009: ProceduralMemoryCardinalityTest.DeriveAndComposeRangesAndPrecedenceAreExact
CCA-PRMEM-010: ProceduralMemoryEstablishmentTest.ValidatesEveryOrderedLongTermSource
CCA-PRMEM-011: ProceduralMemoryIdentityTest.IdentityIsDurableAndForgottenIdentityIsReserved
CCA-PRMEM-012: ProceduralMemoryContentTest.ActivityAndStepsAreExplicitOrderedAndInert
CCA-PRMEM-013: ProceduralMemoryProvenanceTest.PreservesCompleteImmutableOrderedProvenance
CCA-PRMEM-014: ProceduralMemoryOrderingTest.AllObservableOrdersAreDeterministic
CCA-PRMEM-015: ProceduralMemoryDeriveTest.SingleSourceAppendIdempotenceConflictAndPayloadAreExact
CCA-PRMEM-016: ProceduralMemoryComposeTest.MultiSourceAppendIdempotenceAndNoPlanningAreExact
CCA-PRMEM-017: ProceduralMemoryEstablishmentTest.
  ExistingTargetPrecedesLiveSourceLookupAndPreservesLinks
CCA-PRMEM-018: ProceduralMemoryRetrieveTest.ExactIndependentRetrievalDoesNotMutate
CCA-PRMEM-019: ProceduralMemorySearchTest.SearchesOnlySpecifiedFieldsInCanonicalOrder
CCA-PRMEM-020: ProceduralMemoryLinkTest.UndirectedAtomicLinksAndPayloadOrderAreExact
CCA-PRMEM-021: ProceduralMemoryForgetTest.RemovesAllIncidentLinksAtomically
CCA-PRMEM-022: ProceduralMemoryUpdateTest.ChangesOnlyActivityAndSteps
CCA-PRMEM-023: ProceduralMemoryForgetTest.IsIrreversibleIdempotentAndOrderPreserving
CCA-PRMEM-024: ProceduralMemorySourceTest.EvidenceIsUnchangedOnEveryPath
CCA-PRMEM-025: ProceduralMemorySourceTest.SourceAndProcedureLifecyclesAreIndependent
CCA-PRMEM-026: ProceduralMemoryResultTest.CodesMessagesAndPayloadShapesAreExact
CCA-PRMEM-027: ProceduralMemoryPrecedenceTest.AllOperationPrecedenceIsExact
CCA-PRMEM-028: ProceduralMemoryValueTest.CopiesMovesAndResultsOwnCompleteIndependentValues
CCA-PRMEM-029: ProceduralMemoryIsolationTest.IndependentInstancesAndEnginesSupportConcurrency
CCA-PRMEM-030: ProceduralMemoryFailureTest plus dedicated allocation-failure executable
CCA-PRMEM-031: ProceduralMemoryDeterminismTest.EquivalentSequencesProduceCompleteEquality
CCA-PRMEM-032: ProceduralMemoryPersistenceTest and architecture gate
CCA-PRMEM-033: ProceduralMemoryPersistenceTest.ProjectReconstructAndRealRoundTripAreExact
CCA-PRMEM-034: ProceduralMemoryRuntimeTest.RuntimeLifecyclesDoNotOwnOrMutateState
CCA-PRMEM-035: ProceduralMemoryArchitectureTest (CTest)
CCA-PRMEM-036: ProceduralMemoryArchitectureTest (CTest)
CCA-PRMEM-037: ProceduralMemoryExplicitInputTest.ValuesAreNeverInferredExecutedOrTraversed
CCA-PRMEM-038: ProceduralMemoryArchitectureTest (CTest)
CCA-PRMEM-039: documentation/example architecture checks
CCA-PRMEM-040: this mapping and architecture traceability audit
CCA-PRMEM-041: CI C++23 warnings-as-errors build gate
*/

namespace {

using cca::memory::LongTermMemory;
using cca::memory::LongTermMemoryEngine;
using cca::memory::LongTermMemoryEntry;
using cca::memory::ProceduralMemory;
using cca::memory::ProceduralMemoryEngine;
using cca::memory::Procedure;
using cca::memory::ProcedureQuery;
using cca::memory::ProcedureResult;
using cca::representation::FreezeService;
using cca::representation::RepresentationDocument;
using cca::representation::RepresentationMetadata;
using cca::representation::RepresentationType;
using cca::representation::RepresentationValue;

struct EntrySnapshot final {
    std::string identifier;
    std::string value;
    bool archived;

    bool operator==(const EntrySnapshot&) const = default;
};

struct ProcedureSnapshot final {
    std::string identifier;
    std::string activity;
    std::vector<std::string> steps;
    std::vector<EntrySnapshot> source_entries;
    std::vector<std::string> links;

    bool operator==(const ProcedureSnapshot&) const = default;
};

struct IdentifierSnapshot final {
    std::string identifier;
    std::string disposition;

    bool operator==(const IdentifierSnapshot&) const = default;
};

struct ProceduralStateSnapshot final {
    std::string workspace_identifier;
    std::vector<ProcedureSnapshot> procedures;
    std::vector<IdentifierSnapshot> identifiers;

    bool operator==(const ProceduralStateSnapshot&) const = default;
};

struct LongTermStateSnapshot final {
    std::string workspace_identifier;
    std::vector<EntrySnapshot> entries;
    std::vector<IdentifierSnapshot> identifiers;

    bool operator==(const LongTermStateSnapshot&) const = default;
};

struct ResultSnapshot final {
    bool succeeded;
    std::string code;
    std::string message;
    std::optional<ProcedureSnapshot> procedure;
    std::vector<ProcedureSnapshot> matches;

    bool operator==(const ResultSnapshot&) const = default;
};

[[nodiscard]] EntrySnapshot snapshot_of(const LongTermMemoryEntry& entry) {
    return {entry.identifier(), entry.value(), entry.archived()};
}

[[nodiscard]] std::vector<EntrySnapshot> snapshot_entries(
    const std::vector<LongTermMemoryEntry>& entries) {
    std::vector<EntrySnapshot> result;
    result.reserve(entries.size());
    for (const auto& entry : entries) {
        result.push_back(snapshot_of(entry));
    }
    return result;
}

[[nodiscard]] ProcedureSnapshot snapshot_of(const Procedure& procedure) {
    return {procedure.identifier(),
            procedure.activity(),
            procedure.steps(),
            snapshot_entries(procedure.sourceEntries()),
            procedure.linkedProcedureIdentifiers()};
}

[[nodiscard]] ResultSnapshot snapshot_of(const ProcedureResult& result) {
    std::optional<ProcedureSnapshot> procedure;
    if (result.procedure() != nullptr) {
        procedure = snapshot_of(*result.procedure());
    }
    std::vector<ProcedureSnapshot> matches;
    matches.reserve(result.matches().size());
    for (const auto& match : result.matches()) {
        matches.push_back(snapshot_of(match));
    }
    return {result.succeeded(),
            result.code(),
            result.message(),
            std::move(procedure),
            std::move(matches)};
}

void retain(LongTermMemory& memory, std::string identifier, std::string value) {
    const auto result = LongTermMemoryEngine{}.retain(
        memory,
        LongTermMemoryEntry{std::move(identifier), std::move(value)});
    ASSERT_TRUE(result.succeeded()) << result.code() << ": "
                                    << result.message();
}

[[nodiscard]] const LongTermMemoryEntry& require_entry(
    const LongTermMemory& memory,
    const std::string_view identifier) {
    const auto* const entry = memory.find(identifier);
    if (entry == nullptr) {
        throw std::logic_error{"required Long-Term source is absent"};
    }
    return *entry;
}

[[nodiscard]] Procedure proposal(
    std::string identifier,
    std::string activity,
    std::vector<std::string> steps,
    const LongTermMemory& evidence,
    const std::vector<std::string_view>& source_identifiers) {
    std::vector<LongTermMemoryEntry> sources;
    sources.reserve(source_identifiers.size());
    for (const auto source_identifier : source_identifiers) {
        sources.push_back(require_entry(evidence, source_identifier));
    }
    return Procedure{std::move(identifier),
                     std::move(activity),
                     std::move(steps),
                     std::move(sources)};
}

void derive_ok(ProceduralMemory& memory,
               const LongTermMemory& evidence,
               std::string identifier,
               std::string activity,
               std::vector<std::string> steps,
               const std::string_view source_identifier) {
    const auto result = ProceduralMemoryEngine{}.derive(
        memory,
        evidence,
        proposal(std::move(identifier),
                 std::move(activity),
                 std::move(steps),
                 evidence,
                 {source_identifier}));
    ASSERT_TRUE(result.succeeded()) << result.code() << ": "
                                    << result.message();
}

void compose_ok(ProceduralMemory& memory,
                const LongTermMemory& evidence,
                std::string identifier,
                std::string activity,
                std::vector<std::string> steps,
                const std::vector<std::string_view>& source_identifiers) {
    const auto result = ProceduralMemoryEngine{}.compose(
        memory,
        evidence,
        proposal(std::move(identifier),
                 std::move(activity),
                 std::move(steps),
                 evidence,
                 source_identifiers));
    ASSERT_TRUE(result.succeeded()) << result.code() << ": "
                                    << result.message();
}

[[nodiscard]] std::string procedural_disposition(
    const ProceduralMemory& memory,
    const std::string_view identifier) {
    if (memory.find(identifier) != nullptr) {
        return "ACCESSIBLE";
    }
    LongTermMemory evidence{memory.workspaceIdentifier()};
    retain(evidence,
           "private-procedural-history-probe-source",
           "private-procedural-history-probe-value");
    ProceduralMemory probe{memory};
    const auto result = ProceduralMemoryEngine{}.derive(
        probe,
        evidence,
        proposal(std::string{identifier},
                 "private-procedural-history-probe-activity",
                 {"private-procedural-history-probe-step"},
                 evidence,
                 {"private-procedural-history-probe-source"}));
    if (result.code() == "FORGOTTEN_IDENTIFIER") {
        return "FORGOTTEN";
    }
    if (result.succeeded()) {
        return "ABSENT";
    }
    return "UNEXPECTED:" + result.code();
}

[[nodiscard]] std::string long_term_disposition(
    const LongTermMemory& memory,
    const std::string_view identifier) {
    if (const auto* entry = memory.find(identifier); entry != nullptr) {
        return entry->archived() ? "ARCHIVED" : "LONG_TERM";
    }
    LongTermMemory probe{memory};
    const auto result = LongTermMemoryEngine{}.retain(
        probe,
        LongTermMemoryEntry{std::string{identifier}, "probe-value"});
    if (result.code() == "FORGOTTEN_IDENTIFIER") {
        return "FORGOTTEN";
    }
    if (result.succeeded()) {
        return "ABSENT";
    }
    return "UNEXPECTED:" + result.code();
}

[[nodiscard]] ProceduralStateSnapshot snapshot_of(
    const ProceduralMemory& memory,
    const std::vector<std::string_view>& probes = {}) {
    std::vector<ProcedureSnapshot> procedures;
    procedures.reserve(memory.procedures().size());
    for (const auto& procedure : memory.procedures()) {
        procedures.push_back(snapshot_of(procedure));
    }
    std::vector<IdentifierSnapshot> identifiers;
    identifiers.reserve(probes.size());
    for (const auto probe : probes) {
        identifiers.push_back(
            {std::string{probe}, procedural_disposition(memory, probe)});
    }
    return {memory.workspaceIdentifier(),
            std::move(procedures),
            std::move(identifiers)};
}

[[nodiscard]] LongTermStateSnapshot snapshot_of(
    const LongTermMemory& memory,
    const std::vector<std::string_view>& probes = {}) {
    std::vector<EntrySnapshot> entries;
    entries.reserve(memory.entries().size());
    for (const auto& entry : memory.entries()) {
        entries.push_back(snapshot_of(entry));
    }
    std::vector<IdentifierSnapshot> identifiers;
    identifiers.reserve(probes.size());
    for (const auto probe : probes) {
        identifiers.push_back(
            {std::string{probe}, long_term_disposition(memory, probe)});
    }
    return {memory.workspaceIdentifier(),
            std::move(entries),
            std::move(identifiers)};
}

void expect_procedure_success(const ProcedureResult& result,
                              const std::string_view identifier) {
    ASSERT_TRUE(result.succeeded()) << result.code() << ": "
                                    << result.message();
    EXPECT_EQ(result.code(), "OK");
    EXPECT_TRUE(result.message().empty());
    ASSERT_NE(result.procedure(), nullptr);
    EXPECT_EQ(result.procedure()->identifier(), identifier);
    EXPECT_TRUE(result.matches().empty());
}

void expect_matches_success(
    const ProcedureResult& result,
    const std::vector<std::string_view>& identifiers) {
    ASSERT_TRUE(result.succeeded()) << result.code() << ": "
                                    << result.message();
    EXPECT_EQ(result.code(), "OK");
    EXPECT_TRUE(result.message().empty());
    EXPECT_EQ(result.procedure(), nullptr);
    ASSERT_EQ(result.matches().size(), identifiers.size());
    for (std::size_t index = 0; index < identifiers.size(); ++index) {
        EXPECT_EQ(result.matches()[index].identifier(), identifiers[index]);
    }
}

void expect_no_payload_success(const ProcedureResult& result) {
    ASSERT_TRUE(result.succeeded()) << result.code() << ": "
                                    << result.message();
    EXPECT_EQ(result.code(), "OK");
    EXPECT_TRUE(result.message().empty());
    EXPECT_EQ(result.procedure(), nullptr);
    EXPECT_TRUE(result.matches().empty());
}

void expect_failure(const ProcedureResult& result,
                    const std::string_view code) {
    EXPECT_FALSE(result.succeeded());
    EXPECT_EQ(result.code(), code);
    EXPECT_FALSE(result.message().empty());
    EXPECT_EQ(result.procedure(), nullptr);
    EXPECT_TRUE(result.matches().empty());
}

TEST(ProceduralMemoryApiTest, PublicDeclarationsMatchContract) {
    static_assert(std::is_constructible_v<
                  Procedure,
                  std::string,
                  std::string,
                  std::vector<std::string>,
                  std::vector<LongTermMemoryEntry>>);
    static_assert(std::is_copy_constructible_v<Procedure>);
    static_assert(std::is_copy_assignable_v<Procedure>);
    static_assert(std::is_nothrow_move_constructible_v<Procedure>);
    static_assert(std::is_nothrow_move_assignable_v<Procedure>);
    static_assert(std::is_constructible_v<ProcedureQuery, std::string>);
    static_assert(!std::is_convertible_v<std::string, ProcedureQuery>);
    static_assert(std::is_constructible_v<ProceduralMemory, std::string>);
    static_assert(std::is_copy_constructible_v<ProceduralMemory>);
    static_assert(!std::is_copy_assignable_v<ProceduralMemory>);
    static_assert(std::is_nothrow_move_constructible_v<ProceduralMemory>);
    static_assert(!std::is_move_assignable_v<ProceduralMemory>);
    static_assert(!std::is_default_constructible_v<ProcedureResult>);
    static_assert(std::is_nothrow_move_constructible_v<ProcedureResult>);
    static_assert(std::is_nothrow_move_assignable_v<ProcedureResult>);
    static_assert(!std::is_copy_constructible_v<ProcedureResult>);
    static_assert(!std::is_copy_assignable_v<ProcedureResult>);
    static_assert(std::is_empty_v<ProceduralMemoryEngine>);

    using ProcedureString = const std::string& (Procedure::*)()
        const noexcept;
    using StringSequence = const std::vector<std::string>& (Procedure::*)()
        const noexcept;
    using SourceEntries = const std::vector<LongTermMemoryEntry>& (
        Procedure::*)() const noexcept;
    using QueryText = const std::string& (ProcedureQuery::*)() const noexcept;
    using Workspace = const std::string& (ProceduralMemory::*)()
        const noexcept;
    using Size = std::size_t (ProceduralMemory::*)() const noexcept;
    using Find = const Procedure* (ProceduralMemory::*)(
        std::string_view) const noexcept;
    using Procedures = const std::vector<Procedure>& (ProceduralMemory::*)()
        const noexcept;
    using Succeeded = bool (ProcedureResult::*)() const noexcept;
    using ResultString = const std::string& (ProcedureResult::*)()
        const noexcept;
    using ProcedurePayload = const Procedure* (ProcedureResult::*)()
        const noexcept;
    using Matches = const std::vector<Procedure>& (ProcedureResult::*)()
        const noexcept;
    using Establish = ProcedureResult (ProceduralMemoryEngine::*)(
        ProceduralMemory&, const LongTermMemory&, Procedure) const;
    using Retrieve = ProcedureResult (ProceduralMemoryEngine::*)(
        const ProceduralMemory&, std::string_view) const;
    using Search = ProcedureResult (ProceduralMemoryEngine::*)(
        const ProceduralMemory&, const ProcedureQuery&) const;
    using Link = ProcedureResult (ProceduralMemoryEngine::*)(
        ProceduralMemory&, std::string_view, std::string_view) const;
    using Update = ProcedureResult (ProceduralMemoryEngine::*)(
        ProceduralMemory&,
        std::string_view,
        std::string,
        std::vector<std::string>) const;
    using Forget = ProcedureResult (ProceduralMemoryEngine::*)(
        ProceduralMemory&, std::string_view) const;

    static_assert(std::is_same_v<decltype(static_cast<ProcedureString>(
                                     &Procedure::identifier)),
                                 ProcedureString>);
    static_assert(std::is_same_v<decltype(static_cast<ProcedureString>(
                                     &Procedure::activity)),
                                 ProcedureString>);
    static_assert(std::is_same_v<decltype(static_cast<StringSequence>(
                                     &Procedure::steps)),
                                 StringSequence>);
    static_assert(std::is_same_v<decltype(static_cast<SourceEntries>(
                                     &Procedure::sourceEntries)),
                                 SourceEntries>);
    static_assert(std::is_same_v<decltype(static_cast<StringSequence>(
                                     &Procedure::linkedProcedureIdentifiers)),
                                 StringSequence>);
    static_assert(std::is_same_v<decltype(static_cast<QueryText>(
                                     &ProcedureQuery::text)),
                                 QueryText>);
    static_assert(std::is_same_v<decltype(static_cast<Workspace>(
                                     &ProceduralMemory::workspaceIdentifier)),
                                 Workspace>);
    static_assert(std::is_same_v<decltype(static_cast<Size>(
                                     &ProceduralMemory::size)),
                                 Size>);
    static_assert(std::is_same_v<decltype(static_cast<Find>(
                                     &ProceduralMemory::find)),
                                 Find>);
    static_assert(std::is_same_v<decltype(static_cast<Procedures>(
                                     &ProceduralMemory::procedures)),
                                 Procedures>);
    static_assert(std::is_same_v<decltype(static_cast<Succeeded>(
                                     &ProcedureResult::succeeded)),
                                 Succeeded>);
    static_assert(std::is_same_v<decltype(static_cast<ResultString>(
                                     &ProcedureResult::code)),
                                 ResultString>);
    static_assert(std::is_same_v<decltype(static_cast<ResultString>(
                                     &ProcedureResult::message)),
                                 ResultString>);
    static_assert(std::is_same_v<decltype(static_cast<ProcedurePayload>(
                                     &ProcedureResult::procedure)),
                                 ProcedurePayload>);
    static_assert(std::is_same_v<decltype(static_cast<Matches>(
                                     &ProcedureResult::matches)),
                                 Matches>);
    static_assert(std::is_same_v<decltype(static_cast<Establish>(
                                     &ProceduralMemoryEngine::derive)),
                                 Establish>);
    static_assert(std::is_same_v<decltype(static_cast<Establish>(
                                     &ProceduralMemoryEngine::compose)),
                                 Establish>);
    static_assert(std::is_same_v<decltype(static_cast<Retrieve>(
                                     &ProceduralMemoryEngine::retrieve)),
                                 Retrieve>);
    static_assert(std::is_same_v<decltype(static_cast<Search>(
                                     &ProceduralMemoryEngine::search)),
                                 Search>);
    static_assert(std::is_same_v<decltype(static_cast<Link>(
                                     &ProceduralMemoryEngine::link)),
                                 Link>);
    static_assert(std::is_same_v<decltype(static_cast<Update>(
                                     &ProceduralMemoryEngine::update)),
                                 Update>);
    static_assert(std::is_same_v<decltype(static_cast<Forget>(
                                     &ProceduralMemoryEngine::forget)),
                                 Forget>);

    SUCCEED();
}

TEST(ProceduralMemoryOwnershipTest,
     WorkspaceBoundaryIsRequiredAndImmutable) {
    EXPECT_THROW(static_cast<void>(ProceduralMemory{""}),
                 std::invalid_argument);

    ProceduralMemory memory{"Workspace-A"};
    EXPECT_EQ(memory.workspaceIdentifier(), "Workspace-A");
    EXPECT_TRUE(memory.procedures().empty());
    EXPECT_EQ(memory.size(), 0U);

    ProceduralMemory copy{memory};
    EXPECT_EQ(copy.workspaceIdentifier(), "Workspace-A");
    ProceduralMemory moved{std::move(copy)};
    EXPECT_EQ(moved.workspaceIdentifier(), "Workspace-A");
    EXPECT_EQ(copy.workspaceIdentifier(), "Workspace-A");
    EXPECT_TRUE(copy.procedures().empty());
}

TEST(ProceduralMemoryObservationTest,
     PristineAndCanonicalObservationAreExact) {
    ProceduralMemory memory{"workspace"};
    EXPECT_EQ(memory.size(), 0U);
    EXPECT_EQ(memory.find("missing"), nullptr);
    EXPECT_EQ(memory.find(""), nullptr);
    EXPECT_TRUE(memory.procedures().empty());

    LongTermMemory evidence{"workspace"};
    retain(evidence, "source", "value");
    derive_ok(memory, evidence, "Alpha", "activity", {"step"}, "source");
    EXPECT_EQ(memory.size(), 1U);
    ASSERT_NE(memory.find("Alpha"), nullptr);
    EXPECT_EQ(memory.find("alpha"), nullptr);
    EXPECT_EQ(memory.procedures().front().identifier(), "Alpha");

    const auto* const pointer = memory.find("Alpha");
    const auto& sequence = memory.procedures();
    EXPECT_EQ(memory.find("Alpha"), pointer);
    EXPECT_EQ(&memory.procedures(), &sequence);
    EXPECT_EQ(pointer->activity(), "activity");
}

TEST(ProceduralMemoryValueTest, ProceduresQueriesCopiesAndMovesOwnValues) {
    std::string identifier{"procedure"};
    std::string activity{"activity"};
    std::vector<std::string> steps{"one", "two", "two"};
    std::vector<LongTermMemoryEntry> sources{
        LongTermMemoryEntry{"source", "value"}};
    Procedure value{identifier, activity, steps, sources};
    identifier = "changed";
    activity = "changed";
    steps[0] = "changed";
    sources[0] = LongTermMemoryEntry{"other", "other"};
    EXPECT_EQ(value.identifier(), "procedure");
    EXPECT_EQ(value.activity(), "activity");
    EXPECT_EQ(value.steps(),
              (std::vector<std::string>{"one", "two", "two"}));
    EXPECT_EQ(value.sourceEntries().front().identifier(), "source");
    EXPECT_TRUE(value.linkedProcedureIdentifiers().empty());

    Procedure copy{value};
    Procedure assigned{"x", "x", {"x"}, {LongTermMemoryEntry{"x", "x"}}};
    assigned = value;
    EXPECT_EQ(snapshot_of(copy), snapshot_of(value));
    EXPECT_EQ(snapshot_of(assigned), snapshot_of(value));

    Procedure moved{std::move(copy)};
    EXPECT_EQ(snapshot_of(moved), snapshot_of(value));
    EXPECT_TRUE(copy.identifier().empty());
    EXPECT_TRUE(copy.activity().empty());
    EXPECT_TRUE(copy.steps().empty());
    EXPECT_TRUE(copy.sourceEntries().empty());
    EXPECT_TRUE(copy.linkedProcedureIdentifiers().empty());

    Procedure move_assigned{"y", "y", {"y"},
                            {LongTermMemoryEntry{"y", "y"}}};
    move_assigned = std::move(assigned);
    EXPECT_EQ(snapshot_of(move_assigned), snapshot_of(value));
    EXPECT_TRUE(assigned.identifier().empty());
    EXPECT_TRUE(assigned.activity().empty());
    EXPECT_TRUE(assigned.steps().empty());
    EXPECT_TRUE(assigned.sourceEntries().empty());
    EXPECT_TRUE(assigned.linkedProcedureIdentifiers().empty());

    std::string query_text{"literal"};
    ProcedureQuery query{query_text};
    query_text = "changed";
    EXPECT_EQ(query.text(), "literal");

    LongTermMemory evidence{"workspace"};
    retain(evidence, "source", "value");
    ProceduralMemory memory{"workspace"};
    derive_ok(memory, evidence, "A", "act", {"step"}, "source");
    const auto original = snapshot_of(memory, {"A", "forgotten"});
    ProceduralMemory independent{memory};
    EXPECT_TRUE(ProceduralMemoryEngine{}.forget(memory, "A").succeeded());
    EXPECT_EQ(snapshot_of(independent, {"A", "forgotten"}), original);

    const auto before_move = snapshot_of(independent, {"A", "forgotten"});
    ProceduralMemory moved_memory{std::move(independent)};
    EXPECT_EQ(snapshot_of(moved_memory, {"A", "forgotten"}), before_move);
    EXPECT_EQ(independent.workspaceIdentifier(), "workspace");
    EXPECT_TRUE(independent.procedures().empty());
    EXPECT_EQ(procedural_disposition(independent, "A"), "ABSENT");
}

TEST(ProceduralMemoryPrecedenceTest,
     WorkspaceValidationPrecedesEveryProposalFailure) {
    LongTermMemory local{"local"};
    LongTermMemory foreign{"foreign"};
    retain(local, "source", "value");
    retain(foreign, "source", "value");
    ProceduralMemory memory{"local"};
    ProceduralMemoryEngine engine;

    const Procedure wholly_invalid{"", "", {}, {}};
    expect_failure(engine.derive(memory, foreign, wholly_invalid),
                   "WORKSPACE_MISMATCH");
    expect_failure(engine.compose(memory, foreign, wholly_invalid),
                   "WORKSPACE_MISMATCH");

    expect_failure(engine.derive(
                       memory,
                       foreign,
                       Procedure{"target",
                                 "activity",
                                 {"step"},
                                 {LongTermMemoryEntry{"missing", "wrong"}}}),
                   "WORKSPACE_MISMATCH");
    EXPECT_TRUE(memory.procedures().empty());
    EXPECT_EQ(snapshot_of(local, {"source"}),
              (LongTermStateSnapshot{
                  "local", {{"source", "value", false}},
                  {{"source", "LONG_TERM"}}}));
}

TEST(ProceduralMemoryCardinalityTest,
     DeriveAndComposeRangesAndPrecedenceAreExact) {
    LongTermMemory evidence{"workspace"};
    retain(evidence, "one", "1");
    retain(evidence, "two", "2");
    retain(evidence, "three", "3");
    ProceduralMemory memory{"workspace"};
    ProceduralMemoryEngine engine;

    expect_failure(engine.derive(
                       memory,
                       evidence,
                       Procedure{"derive-zero", "activity", {"step"}, {}}),
                   "INVALID_SOURCE_CARDINALITY");
    expect_failure(engine.derive(
                       memory,
                       evidence,
                       proposal("derive-two",
                                "activity",
                                {"step"},
                                evidence,
                                {"one", "two"})),
                   "INVALID_SOURCE_CARDINALITY");
    expect_failure(engine.compose(
                       memory,
                       evidence,
                       Procedure{"compose-zero", "activity", {"step"}, {}}),
                   "INVALID_SOURCE_CARDINALITY");
    expect_failure(engine.compose(
                       memory,
                       evidence,
                       proposal("compose-one",
                                "activity",
                                {"step"},
                                evidence,
                                {"one"})),
                   "INVALID_SOURCE_CARDINALITY");

    expect_procedure_success(
        engine.derive(memory,
                      evidence,
                      proposal("derived",
                               "activity",
                               {"step"},
                               evidence,
                               {"one"})),
        "derived");
    expect_procedure_success(
        engine.compose(memory,
                       evidence,
                       proposal("composed-two",
                                "activity",
                                {"step"},
                                evidence,
                                {"two", "one"})),
        "composed-two");
    expect_procedure_success(
        engine.compose(memory,
                       evidence,
                       proposal("composed-three",
                                "activity",
                                {"step"},
                                evidence,
                                {"three", "one", "two"})),
        "composed-three");

    expect_failure(engine.derive(
                       memory,
                       evidence,
                       Procedure{"derived",
                                 "activity",
                                 {"step"},
                                 {require_entry(evidence, "one"),
                                  LongTermMemoryEntry{"", "bad"}}}),
                   "INVALID_SOURCE_CARDINALITY");
    expect_failure(engine.compose(
                       memory,
                       evidence,
                       Procedure{"composed-two",
                                 "activity",
                                 {"step"},
                                 {LongTermMemoryEntry{"", "bad"}}}),
                   "INVALID_SOURCE_CARDINALITY");
}

TEST(ProceduralMemoryContentTest,
     ActivityAndStepsAreExplicitOrderedAndInert) {
    LongTermMemory evidence{"workspace"};
    retain(evidence, "source", "value");
    ProceduralMemory memory{"workspace"};
    ProceduralMemoryEngine engine;

    expect_failure(engine.derive(
                       memory,
                       evidence,
                       proposal("empty-activity", "", {"step"}, evidence,
                                {"source"})),
                   "INVALID_ACTIVITY");
    expect_failure(engine.derive(
                       memory,
                       evidence,
                       proposal("empty-steps", "activity", {}, evidence,
                                {"source"})),
                   "INVALID_STEPS");
    expect_failure(engine.derive(
                       memory,
                       evidence,
                       proposal("empty-first",
                                "activity",
                                {"", "second"},
                                evidence,
                                {"source"})),
                   "INVALID_STEPS");
    expect_failure(engine.derive(
                       memory,
                       evidence,
                       proposal("empty-last",
                                "activity",
                                {"first", ""},
                                evidence,
                                {"source"})),
                   "INVALID_STEPS");

    const std::vector<std::string> exact_steps{
        "caller step", "duplicate", "duplicate", "execute nothing"};
    const auto accepted = engine.derive(
        memory,
        evidence,
        proposal("procedure", "caller activity", exact_steps, evidence,
                 {"source"}));
    expect_procedure_success(accepted, "procedure");
    ASSERT_NE(accepted.procedure(), nullptr);
    EXPECT_EQ(accepted.procedure()->activity(), "caller activity");
    EXPECT_EQ(accepted.procedure()->steps(), exact_steps);
    EXPECT_EQ(memory.find("procedure")->steps(), exact_steps);
    EXPECT_EQ(snapshot_of(evidence, {"source"}).entries,
              (std::vector<EntrySnapshot>{{"source", "value", false}}));
}

TEST(ProceduralMemoryEstablishmentTest,
     ValidatesEveryOrderedLongTermSource) {
    LongTermMemory evidence{"workspace"};
    retain(evidence, "source-a", "alpha");
    retain(evidence, "source-b", "beta");
    retain(evidence, "source-c", "gamma");
    ProceduralMemory memory{"workspace"};
    ProceduralMemoryEngine engine;

    expect_failure(engine.derive(
                       memory,
                       evidence,
                       Procedure{"empty-source",
                                 "activity",
                                 {"step"},
                                 {LongTermMemoryEntry{"", "value"}}}),
                   "INVALID_PROVENANCE");
    expect_failure(engine.compose(
                       memory,
                       evidence,
                       Procedure{"duplicate-source",
                                 "activity",
                                 {"step"},
                                 {require_entry(evidence, "source-a"),
                                  require_entry(evidence, "source-a")}}),
                   "INVALID_PROVENANCE");
    expect_failure(engine.derive(
                       memory,
                       evidence,
                       Procedure{"source-a",
                                 "activity",
                                 {"step"},
                                 {require_entry(evidence, "source-a")}}),
                   "INVALID_PROVENANCE");
    expect_failure(engine.derive(
                       memory,
                       evidence,
                       Procedure{"missing-source",
                                 "activity",
                                 {"step"},
                                 {LongTermMemoryEntry{"absent", "value"}}}),
                   "SOURCE_NOT_FOUND");
    expect_failure(engine.derive(
                       memory,
                       evidence,
                       Procedure{"mismatch",
                                 "activity",
                                 {"step"},
                                 {LongTermMemoryEntry{"source-a", "wrong"}}}),
                   "SOURCE_MISMATCH");

    LongTermMemory archived_snapshot_evidence{"workspace"};
    retain(archived_snapshot_evidence, "archived", "value");
    ASSERT_TRUE(LongTermMemoryEngine{}
                    .archive(archived_snapshot_evidence, "archived")
                    .succeeded());
    expect_failure(engine.derive(
                       memory,
                       archived_snapshot_evidence,
                       Procedure{"archived-snapshot",
                                 "activity",
                                 {"step"},
                                 {require_entry(archived_snapshot_evidence,
                                                "archived")}}),
                   "SOURCE_NOT_LONG_TERM");

    LongTermMemory later_archived{"workspace"};
    retain(later_archived, "later", "value");
    const LongTermMemoryEntry live_snapshot = require_entry(later_archived,
                                                             "later");
    ASSERT_TRUE(LongTermMemoryEngine{}.archive(later_archived, "later")
                    .succeeded());
    expect_failure(engine.derive(
                       memory,
                       later_archived,
                       Procedure{"archived-live",
                                 "activity",
                                 {"step"},
                                 {live_snapshot}}),
                   "SOURCE_NOT_LONG_TERM");

    LongTermMemory forgotten_evidence{"workspace"};
    retain(forgotten_evidence, "forgotten", "value");
    const LongTermMemoryEntry forgotten_snapshot =
        require_entry(forgotten_evidence, "forgotten");
    ASSERT_TRUE(LongTermMemoryEngine{}
                    .forget(forgotten_evidence, "forgotten")
                    .succeeded());
    expect_failure(engine.derive(
                       memory,
                       forgotten_evidence,
                       Procedure{"forgotten-source",
                                 "activity",
                                 {"step"},
                                 {forgotten_snapshot}}),
                   "SOURCE_NOT_FOUND");

    expect_failure(engine.compose(
                       memory,
                       evidence,
                       Procedure{"ordered-missing",
                                 "activity",
                                 {"step"},
                                 {LongTermMemoryEntry{"absent", "wrong"},
                                  LongTermMemoryEntry{"source-a", "wrong"}}}),
                   "SOURCE_NOT_FOUND");
    expect_failure(engine.compose(
                       memory,
                       evidence,
                       Procedure{"ordered-mismatch",
                                 "activity",
                                 {"step"},
                                 {LongTermMemoryEntry{"source-a", "wrong"},
                                  LongTermMemoryEntry{"absent", "wrong"}}}),
                   "SOURCE_MISMATCH");

    const auto evidence_before = snapshot_of(
        evidence, {"source-a", "source-b", "source-c"});
    const auto result = engine.compose(
        memory,
        evidence,
        proposal("valid",
                 "activity",
                 {"first", "second"},
                 evidence,
                 {"source-c", "source-a", "source-b"}));
    expect_procedure_success(result, "valid");
    ASSERT_NE(result.procedure(), nullptr);
    EXPECT_EQ(snapshot_entries(result.procedure()->sourceEntries()),
              (std::vector<EntrySnapshot>{{"source-c", "gamma", false},
                                          {"source-a", "alpha", false},
                                          {"source-b", "beta", false}}));
    EXPECT_EQ(snapshot_of(evidence,
                          {"source-a", "source-b", "source-c"}),
              evidence_before);
}

TEST(ProceduralMemoryDeriveTest,
     SingleSourceAppendIdempotenceConflictAndPayloadAreExact) {
    LongTermMemory evidence{"workspace"};
    retain(evidence, "source", "value");
    ProceduralMemory memory{"workspace"};
    ProceduralMemoryEngine engine;
    const Procedure original = proposal(
        "A", "activity-a", {"one", "two"}, evidence, {"source"});

    expect_procedure_success(engine.derive(memory, evidence, original), "A");
    ASSERT_EQ(memory.procedures().size(), 1U);
    expect_procedure_success(engine.derive(memory, evidence, original), "A");
    EXPECT_EQ(memory.procedures().size(), 1U);

    expect_failure(engine.compose(memory, evidence, original),
                   "INVALID_SOURCE_CARDINALITY");
    expect_failure(engine.derive(
                       memory,
                       evidence,
                       Procedure{"A",
                                 "different",
                                 original.steps(),
                                 original.sourceEntries()}),
                   "IDENTIFIER_CONFLICT");
    expect_failure(engine.derive(
                       memory,
                       evidence,
                       Procedure{"A",
                                 original.activity(),
                                 {"two", "one"},
                                 original.sourceEntries()}),
                   "IDENTIFIER_CONFLICT");
}

TEST(ProceduralMemoryComposeTest,
     MultiSourceAppendIdempotenceAndNoPlanningAreExact) {
    LongTermMemory evidence{"workspace"};
    retain(evidence, "first", "first evidence");
    retain(evidence, "second", "second evidence");
    retain(evidence, "third", "third evidence");
    ProceduralMemory memory{"workspace"};
    ProceduralMemoryEngine engine;
    const std::vector<std::string> steps{
        "caller declared", "caller declared", "final"};
    const Procedure original = proposal(
        "composed",
        "caller activity",
        steps,
        evidence,
        {"third", "first", "second"});

    const auto first = engine.compose(memory, evidence, original);
    expect_procedure_success(first, "composed");
    ASSERT_NE(first.procedure(), nullptr);
    EXPECT_EQ(first.procedure()->activity(), "caller activity");
    EXPECT_EQ(first.procedure()->steps(), steps);
    EXPECT_EQ(snapshot_entries(first.procedure()->sourceEntries()),
              (std::vector<EntrySnapshot>{
                  {"third", "third evidence", false},
                  {"first", "first evidence", false},
                  {"second", "second evidence", false}}));
    expect_procedure_success(engine.compose(memory, evidence, original),
                             "composed");
    EXPECT_EQ(memory.size(), 1U);
    expect_failure(engine.derive(memory, evidence, original),
                   "INVALID_SOURCE_CARDINALITY");
}

TEST(ProceduralMemoryEstablishmentTest,
     ExistingTargetPrecedesLiveSourceLookupAndPreservesLinks) {
    LongTermMemory evidence{"workspace"};
    retain(evidence, "source-a", "alpha");
    retain(evidence, "source-b", "beta");
    ProceduralMemory memory{"workspace"};
    ProceduralMemoryEngine engine;
    const Procedure original_a = proposal(
        "A", "activity-a", {"a-1", "a-2"}, evidence, {"source-a"});
    const Procedure original_b = proposal(
        "B", "activity-b", {"b"}, evidence, {"source-b"});
    expect_procedure_success(engine.derive(memory, evidence, original_a), "A");
    expect_procedure_success(engine.derive(memory, evidence, original_b), "B");
    expect_matches_success(engine.link(memory, "A", "B"), {"A", "B"});

    ASSERT_TRUE(LongTermMemoryEngine{}
                    .store(evidence,
                           LongTermMemoryEntry{"source-a", "changed"})
                    .succeeded());
    const auto idempotent_after_change = engine.derive(
        memory, evidence, original_a);
    expect_procedure_success(idempotent_after_change, "A");
    EXPECT_EQ(idempotent_after_change.procedure()
                  ->linkedProcedureIdentifiers(),
              (std::vector<std::string>{"B"}));

    ASSERT_TRUE(LongTermMemoryEngine{}.archive(evidence, "source-a")
                    .succeeded());
    expect_procedure_success(engine.derive(memory, evidence, original_a), "A");
    ASSERT_TRUE(LongTermMemoryEngine{}.forget(evidence, "source-a")
                    .succeeded());
    expect_procedure_success(engine.derive(memory, evidence, original_a), "A");

    expect_failure(engine.derive(
                       memory,
                       evidence,
                       Procedure{"A",
                                 "conflicting activity",
                                 original_a.steps(),
                                 original_a.sourceEntries()}),
                   "IDENTIFIER_CONFLICT");
    expect_failure(engine.derive(memory, evidence, *memory.find("A")),
                   "INVALID_PROCEDURE_STATE");
    EXPECT_EQ(memory.find("A")->linkedProcedureIdentifiers(),
              (std::vector<std::string>{"B"}));
}

TEST(ProceduralMemoryProvenanceTest,
     PreservesCompleteImmutableOrderedProvenance) {
    LongTermMemory evidence{"workspace"};
    retain(evidence, "first", "1");
    retain(evidence, "second", "2");
    retain(evidence, "third", "3");
    ProceduralMemory memory{"workspace"};
    ProceduralMemoryEngine engine;
    compose_ok(memory,
               evidence,
               "A",
               "activity",
               {"first step", "second step"},
               {"third", "first", "second"});
    derive_ok(memory, evidence, "B", "other", {"only"}, "first");
    const auto expected = snapshot_entries(memory.find("A")->sourceEntries());

    expect_matches_success(engine.link(memory, "A", "B"), {"A", "B"});
    expect_procedure_success(
        engine.update(memory, "A", "updated", {"new", "new"}), "A");
    static_cast<void>(engine.retrieve(memory, "A"));
    static_cast<void>(engine.search(memory, ProcedureQuery{"updated"}));
    ASSERT_TRUE(LongTermMemoryEngine{}
                    .store(evidence, LongTermMemoryEntry{"first", "changed"})
                    .succeeded());
    ASSERT_TRUE(LongTermMemoryEngine{}.archive(evidence, "second")
                    .succeeded());
    ASSERT_TRUE(LongTermMemoryEngine{}.forget(evidence, "third")
                    .succeeded());

    EXPECT_EQ(snapshot_entries(memory.find("A")->sourceEntries()), expected);
    EXPECT_EQ(expected,
              (std::vector<EntrySnapshot>{{"third", "3", false},
                                          {"first", "1", false},
                                          {"second", "2", false}}));
}

TEST(ProceduralMemoryOrderingTest, AllObservableOrdersAreDeterministic) {
    LongTermMemory evidence{"workspace"};
    retain(evidence, "one", "1");
    retain(evidence, "two", "2");
    retain(evidence, "three", "3");
    ProceduralMemory memory{"workspace"};
    ProceduralMemoryEngine engine;

    derive_ok(memory, evidence, "A", "match a", {"a"}, "one");
    compose_ok(memory, evidence, "B", "match b", {"b", "b"},
               {"two", "one"});
    derive_ok(memory, evidence, "C", "match c", {"c"}, "three");
    compose_ok(memory, evidence, "D", "match d", {"d"},
               {"three", "two", "one"});
    ASSERT_EQ(memory.procedures().size(), 4U);
    const std::array<std::string_view, 4> expected_order{"A", "B", "C", "D"};
    for (std::size_t index = 0; index < 4U; ++index) {
        EXPECT_EQ(memory.procedures()[index].identifier(),
                  expected_order[index]);
    }

    expect_matches_success(engine.link(memory, "A", "C"), {"A", "C"});
    expect_matches_success(engine.link(memory, "A", "B"), {"A", "B"});
    expect_matches_success(engine.link(memory, "D", "A"), {"D", "A"});
    EXPECT_EQ(memory.find("A")->linkedProcedureIdentifiers(),
              (std::vector<std::string>{"C", "B", "D"}));
    expect_matches_success(engine.search(memory, ProcedureQuery{"match"}),
                           {"A", "B", "C", "D"});
    expect_procedure_success(
        engine.update(memory, "C", "match c updated", {"c", "c"}), "C");
    expect_no_payload_success(engine.forget(memory, "B"));
    ASSERT_EQ(memory.procedures().size(), 3U);
    EXPECT_EQ(memory.procedures()[0].identifier(), "A");
    EXPECT_EQ(memory.procedures()[1].identifier(), "C");
    EXPECT_EQ(memory.procedures()[2].identifier(), "D");
    EXPECT_EQ(memory.find("A")->linkedProcedureIdentifiers(),
              (std::vector<std::string>{"C", "D"}));
}

TEST(ProceduralMemoryRetrieveTest, ExactIndependentRetrievalDoesNotMutate) {
    LongTermMemory evidence{"workspace"};
    retain(evidence, "source", "value");
    ProceduralMemory memory{"workspace"};
    derive_ok(memory, evidence, "CaseSensitive", "activity", {"step"},
              "source");
    const auto before = snapshot_of(memory, {"CaseSensitive", "missing"});
    ProceduralMemoryEngine engine;

    expect_failure(engine.retrieve(memory, ""), "INVALID_IDENTIFIER");
    expect_failure(engine.retrieve(memory, "casesensitive"), "NOT_FOUND");
    expect_failure(engine.retrieve(memory, "missing"), "NOT_FOUND");
    auto retrieved = engine.retrieve(memory, "CaseSensitive");
    expect_procedure_success(retrieved, "CaseSensitive");
    ASSERT_NE(retrieved.procedure(), nullptr);
    const auto payload = snapshot_of(*retrieved.procedure());
    EXPECT_EQ(snapshot_of(memory, {"CaseSensitive", "missing"}), before);

    expect_procedure_success(
        engine.update(memory, "CaseSensitive", "changed", {"changed"}),
        "CaseSensitive");
    EXPECT_EQ(snapshot_of(*retrieved.procedure()), payload);
    EXPECT_EQ(retrieved.procedure()->activity(), "activity");
}

TEST(ProceduralMemorySearchTest,
     SearchesOnlySpecifiedFieldsInCanonicalOrder) {
    LongTermMemory evidence{"workspace"};
    retain(evidence, "hidden-source-token", "hidden-value-token");
    retain(evidence, "plain", "plain");
    ProceduralMemory memory{"workspace"};
    derive_ok(memory,
              evidence,
              "id-token-A",
              "activity alpha",
              {"first", "shared-step"},
              "hidden-source-token");
    derive_ok(memory,
              evidence,
              "B",
              "activity-token beta",
              {"second"},
              "plain");
    derive_ok(memory,
              evidence,
              "C",
              "gamma",
              {"step-token", "shared-step"},
              "plain");
    derive_ok(memory, evidence, "linked-only", "other", {"other"}, "plain");
    ProceduralMemoryEngine engine;
    expect_matches_success(engine.link(memory, "B", "linked-only"),
                           {"B", "linked-only"});
    const auto before = snapshot_of(memory);

    expect_matches_success(engine.search(memory, ProcedureQuery{"token"}),
                           {"id-token-A", "B", "C"});
    expect_matches_success(engine.search(memory, ProcedureQuery{"shared-step"}),
                           {"id-token-A", "C"});
    expect_matches_success(engine.search(memory, ProcedureQuery{"TOKEN"}), {});
    expect_matches_success(engine.search(memory, ProcedureQuery{""}),
                           {"id-token-A", "B", "C", "linked-only"});
    expect_matches_success(
        engine.search(memory, ProcedureQuery{"hidden-source-token"}), {});
    expect_matches_success(
        engine.search(memory, ProcedureQuery{"hidden-value-token"}), {});
    EXPECT_EQ(snapshot_of(memory), before);
}

TEST(ProceduralMemoryLinkTest,
     UndirectedAtomicLinksAndPayloadOrderAreExact) {
    LongTermMemory evidence{"workspace"};
    retain(evidence, "source", "value");
    ProceduralMemory memory{"workspace"};
    derive_ok(memory, evidence, "A", "a", {"a"}, "source");
    derive_ok(memory, evidence, "B", "b", {"b"}, "source");
    derive_ok(memory, evidence, "C", "c", {"c"}, "source");
    ProceduralMemoryEngine engine;

    expect_failure(engine.link(memory, "", "B"), "INVALID_IDENTIFIER");
    expect_failure(engine.link(memory, "A", ""), "INVALID_IDENTIFIER");
    expect_failure(engine.link(memory, "A", "A"), "INVALID_RELATIONSHIP");
    expect_failure(engine.link(memory, "missing", "B"), "NOT_FOUND");
    expect_failure(engine.link(memory, "A", "missing"), "NOT_FOUND");

    expect_matches_success(engine.link(memory, "A", "B"), {"A", "B"});
    EXPECT_EQ(memory.find("A")->linkedProcedureIdentifiers(),
              (std::vector<std::string>{"B"}));
    EXPECT_EQ(memory.find("B")->linkedProcedureIdentifiers(),
              (std::vector<std::string>{"A"}));
    expect_matches_success(engine.link(memory, "B", "A"), {"B", "A"});
    EXPECT_EQ(memory.find("A")->linkedProcedureIdentifiers(),
              (std::vector<std::string>{"B"}));
    EXPECT_EQ(memory.find("B")->linkedProcedureIdentifiers(),
              (std::vector<std::string>{"A"}));

    expect_matches_success(engine.link(memory, "B", "C"), {"B", "C"});
    expect_matches_success(engine.link(memory, "C", "A"), {"C", "A"});
    EXPECT_EQ(memory.find("A")->linkedProcedureIdentifiers(),
              (std::vector<std::string>{"B", "C"}));
    EXPECT_EQ(memory.find("B")->linkedProcedureIdentifiers(),
              (std::vector<std::string>{"A", "C"}));
    EXPECT_EQ(memory.find("C")->linkedProcedureIdentifiers(),
              (std::vector<std::string>{"B", "A"}));
}

TEST(ProceduralMemoryUpdateTest, ChangesOnlyActivityAndSteps) {
    LongTermMemory evidence{"workspace"};
    retain(evidence, "source", "value");
    ProceduralMemory memory{"workspace"};
    derive_ok(memory, evidence, "A", "old", {"old-1", "old-2"}, "source");
    derive_ok(memory, evidence, "B", "other", {"other"}, "source");
    ProceduralMemoryEngine engine;
    expect_matches_success(engine.link(memory, "A", "B"), {"A", "B"});
    const auto original = snapshot_of(*memory.find("A"));

    expect_failure(engine.update(memory, "", "activity", {"step"}),
                   "INVALID_IDENTIFIER");
    expect_failure(engine.update(memory, "missing", "", {}),
                   "INVALID_ACTIVITY");
    expect_failure(engine.update(memory, "missing", "activity", {}),
                   "INVALID_STEPS");
    expect_failure(engine.update(memory, "missing", "activity", {"", "x"}),
                   "INVALID_STEPS");
    expect_failure(engine.update(memory, "missing", "activity", {"step"}),
                   "NOT_FOUND");

    const std::vector<std::string> replacement{"new", "new", "last"};
    expect_procedure_success(
        engine.update(memory, "A", "updated", replacement), "A");
    const auto updated = snapshot_of(*memory.find("A"));
    EXPECT_EQ(updated.identifier, original.identifier);
    EXPECT_EQ(updated.activity, "updated");
    EXPECT_EQ(updated.steps, replacement);
    EXPECT_EQ(updated.source_entries, original.source_entries);
    EXPECT_EQ(updated.links, original.links);
    EXPECT_EQ(memory.procedures().front().identifier(), "A");
    const auto before_idempotent = snapshot_of(memory);
    expect_procedure_success(
        engine.update(memory, "A", "updated", replacement), "A");
    EXPECT_EQ(snapshot_of(memory), before_idempotent);
}

TEST(ProceduralMemoryForgetTest,
     IsIrreversibleIdempotentAndRemovesAllIncidentLinksAtomically) {
    LongTermMemory evidence{"workspace"};
    retain(evidence, "one", "1");
    retain(evidence, "two", "2");
    ProceduralMemory memory{"workspace"};
    derive_ok(memory, evidence, "A", "a", {"a"}, "one");
    compose_ok(memory, evidence, "B", "b", {"b"}, {"one", "two"});
    derive_ok(memory, evidence, "C", "c", {"c"}, "two");
    derive_ok(memory, evidence, "D", "d", {"d"}, "one");
    ProceduralMemoryEngine engine;
    expect_matches_success(engine.link(memory, "A", "B"), {"A", "B"});
    expect_matches_success(engine.link(memory, "B", "C"), {"B", "C"});
    expect_matches_success(engine.link(memory, "B", "D"), {"B", "D"});
    expect_matches_success(engine.link(memory, "A", "C"), {"A", "C"});
    const auto source_before = snapshot_of(evidence, {"one", "two"});

    expect_no_payload_success(engine.forget(memory, "never-present"));
    EXPECT_EQ(procedural_disposition(memory, "never-present"), "ABSENT");
    expect_no_payload_success(engine.forget(memory, "B"));
    EXPECT_EQ(procedural_disposition(memory, "B"), "FORGOTTEN");
    expect_no_payload_success(engine.forget(memory, "B"));
    ASSERT_EQ(memory.procedures().size(), 3U);
    EXPECT_EQ(memory.procedures()[0].identifier(), "A");
    EXPECT_EQ(memory.procedures()[1].identifier(), "C");
    EXPECT_EQ(memory.procedures()[2].identifier(), "D");
    EXPECT_EQ(memory.find("A")->linkedProcedureIdentifiers(),
              (std::vector<std::string>{"C"}));
    EXPECT_EQ(memory.find("C")->linkedProcedureIdentifiers(),
              (std::vector<std::string>{"A"}));
    EXPECT_TRUE(memory.find("D")->linkedProcedureIdentifiers().empty());
    expect_failure(engine.derive(
                       memory,
                       evidence,
                       proposal("B", "again", {"again"}, evidence, {"one"})),
                   "FORGOTTEN_IDENTIFIER");
    expect_failure(engine.compose(
                       memory,
                       evidence,
                       proposal("B", "again", {"again"}, evidence,
                                {"one", "two"})),
                   "FORGOTTEN_IDENTIFIER");
    expect_procedure_success(engine.derive(
                                 memory,
                                 evidence,
                                 proposal("never-present",
                                          "now present",
                                          {"step"},
                                          evidence,
                                          {"one"})),
                             "never-present");
    EXPECT_EQ(snapshot_of(evidence, {"one", "two"}), source_before);
}

TEST(ProceduralMemoryPrecedenceTest, AllOperationPrecedenceIsExact) {
    LongTermMemory evidence{"workspace"};
    retain(evidence, "one", "1");
    retain(evidence, "two", "2");
    ProceduralMemory memory{"workspace"};
    ProceduralMemoryEngine engine;

    expect_failure(engine.derive(
                       memory,
                       evidence,
                       Procedure{"", "", {}, {}}),
                   "INVALID_IDENTIFIER");
    expect_failure(engine.derive(
                       memory,
                       evidence,
                       Procedure{"target", "", {}, {}}),
                   "INVALID_ACTIVITY");
    expect_failure(engine.derive(
                       memory,
                       evidence,
                       Procedure{"target", "activity", {}, {}}),
                   "INVALID_STEPS");
    expect_failure(engine.derive(
                       memory,
                       evidence,
                       Procedure{"target", "activity", {"step"}, {}}),
                   "INVALID_SOURCE_CARDINALITY");
    expect_failure(engine.derive(
                       memory,
                       evidence,
                       Procedure{"target",
                                 "activity",
                                 {"step"},
                                 {LongTermMemoryEntry{"", "bad"},
                                  LongTermMemoryEntry{"", "bad"}}}),
                   "INVALID_SOURCE_CARDINALITY");
    expect_failure(engine.compose(
                       memory,
                       evidence,
                       Procedure{"target",
                                 "activity",
                                 {"step"},
                                 {LongTermMemoryEntry{"", "bad"},
                                  LongTermMemoryEntry{"one", "wrong"}}}),
                   "INVALID_PROVENANCE");
    expect_failure(engine.compose(
                       memory,
                       evidence,
                       Procedure{"target",
                                 "activity",
                                 {"step"},
                                 {LongTermMemoryEntry{"one", "1"},
                                  LongTermMemoryEntry{"one", "wrong"}}}),
                   "INVALID_PROVENANCE");

    derive_ok(memory, evidence, "A", "a", {"a"}, "one");
    derive_ok(memory, evidence, "B", "b", {"b"}, "two");
    expect_matches_success(engine.link(memory, "A", "B"), {"A", "B"});
    expect_failure(engine.derive(memory, evidence, *memory.find("A")),
                   "INVALID_PROCEDURE_STATE");

    derive_ok(memory, evidence, "forgotten", "f", {"f"}, "one");
    expect_no_payload_success(engine.forget(memory, "forgotten"));
    expect_failure(engine.derive(
                       memory,
                       evidence,
                       Procedure{"forgotten",
                                 "activity",
                                 {"step"},
                                 {LongTermMemoryEntry{"missing", "wrong"}}}),
                   "FORGOTTEN_IDENTIFIER");

    expect_failure(engine.link(memory, "", ""), "INVALID_IDENTIFIER");
    expect_failure(engine.link(memory, "A", ""), "INVALID_IDENTIFIER");
    expect_failure(engine.link(memory, "missing", "missing"),
                   "INVALID_RELATIONSHIP");
    expect_failure(engine.link(memory, "missing-a", "missing-b"),
                   "NOT_FOUND");
    expect_failure(engine.link(memory, "A", "missing-b"), "NOT_FOUND");

    expect_failure(engine.update(memory, "", "", {}),
                   "INVALID_IDENTIFIER");
    expect_failure(engine.update(memory, "missing", "", {}),
                   "INVALID_ACTIVITY");
    expect_failure(engine.update(memory, "missing", "activity", {}),
                   "INVALID_STEPS");
    expect_failure(engine.update(memory, "missing", "activity", {""}),
                   "INVALID_STEPS");
    expect_failure(engine.update(memory, "missing", "activity", {"step"}),
                   "NOT_FOUND");
    expect_failure(engine.retrieve(memory, ""), "INVALID_IDENTIFIER");
    expect_failure(engine.retrieve(memory, "missing"), "NOT_FOUND");
    expect_failure(engine.forget(memory, ""), "INVALID_IDENTIFIER");
    expect_matches_success(engine.search(memory, ProcedureQuery{"no match"}),
                           {});
}

TEST(ProceduralMemoryResultTest, CodesMessagesAndPayloadShapesAreExact) {
    const std::vector<std::string> expected_codes{
        "FORGOTTEN_IDENTIFIER",
        "IDENTIFIER_CONFLICT",
        "INVALID_ACTIVITY",
        "INVALID_IDENTIFIER",
        "INVALID_PROCEDURE_STATE",
        "INVALID_PROVENANCE",
        "INVALID_RELATIONSHIP",
        "INVALID_SOURCE_CARDINALITY",
        "INVALID_STEPS",
        "NOT_FOUND",
        "OK",
        "SOURCE_MISMATCH",
        "SOURCE_NOT_FOUND",
        "SOURCE_NOT_LONG_TERM",
        "WORKSPACE_MISMATCH"};
    std::vector<std::string> observed;
    const auto observe = [&](const ProcedureResult& result) {
        observed.push_back(result.code());
        if (result.succeeded()) {
            EXPECT_EQ(result.code(), "OK");
            EXPECT_TRUE(result.message().empty());
        } else {
            EXPECT_FALSE(result.message().empty());
            EXPECT_EQ(result.procedure(), nullptr);
            EXPECT_TRUE(result.matches().empty());
        }
    };

    LongTermMemory evidence{"workspace"};
    LongTermMemory foreign{"foreign"};
    retain(evidence, "one", "1");
    retain(evidence, "two", "2");
    retain(foreign, "one", "1");
    ProceduralMemory memory{"workspace"};
    ProceduralMemoryEngine engine;
    const Procedure a = proposal("A", "a", {"a"}, evidence, {"one"});

    auto result = engine.derive(memory, evidence, a);
    expect_procedure_success(result, "A");
    observe(result);
    derive_ok(memory, evidence, "B", "b", {"b"}, "two");
    result = engine.link(memory, "A", "B");
    expect_matches_success(result, {"A", "B"});
    observe(result);
    const Procedure linked_a = *memory.find("A");
    result = engine.search(memory, ProcedureQuery{"a"});
    expect_matches_success(result, {"A"});
    observe(result);
    result = engine.update(memory, "A", "new", {"new"});
    expect_procedure_success(result, "A");
    observe(result);
    result = engine.retrieve(memory, "A");
    expect_procedure_success(result, "A");
    observe(result);
    result = engine.forget(memory, "B");
    expect_no_payload_success(result);
    observe(result);

    const auto capture = [&](ProcedureResult failure,
                             const std::string_view code) {
        expect_failure(failure, code);
        observe(failure);
    };
    capture(engine.derive(memory, foreign, a), "WORKSPACE_MISMATCH");
    capture(engine.retrieve(memory, ""), "INVALID_IDENTIFIER");
    capture(engine.update(memory, "A", "", {"step"}),
            "INVALID_ACTIVITY");
    capture(engine.update(memory, "A", "activity", {}), "INVALID_STEPS");
    capture(engine.compose(memory, evidence, a),
            "INVALID_SOURCE_CARDINALITY");
    capture(engine.compose(
                memory,
                evidence,
                Procedure{"invalid-provenance",
                          "activity",
                          {"step"},
                          {require_entry(evidence, "one"),
                           require_entry(evidence, "one")}}),
            "INVALID_PROVENANCE");

    LongTermMemory archived{"workspace"};
    retain(archived, "source", "value");
    ASSERT_TRUE(LongTermMemoryEngine{}.archive(archived, "source").succeeded());
    capture(engine.derive(
                memory,
                archived,
                Procedure{"archived",
                          "activity",
                          {"step"},
                          {require_entry(archived, "source")}}),
            "SOURCE_NOT_LONG_TERM");
    capture(engine.derive(memory, evidence, linked_a),
            "INVALID_PROCEDURE_STATE");

    derive_ok(memory, evidence, "forgotten", "f", {"f"}, "one");
    expect_no_payload_success(engine.forget(memory, "forgotten"));
    capture(engine.derive(
                memory,
                evidence,
                proposal("forgotten", "again", {"step"}, evidence, {"one"})),
            "FORGOTTEN_IDENTIFIER");
    capture(engine.derive(
                memory,
                evidence,
                Procedure{"A", "different", a.steps(), a.sourceEntries()}),
            "IDENTIFIER_CONFLICT");
    capture(engine.derive(
                memory,
                evidence,
                Procedure{"missing-source",
                          "activity",
                          {"step"},
                          {LongTermMemoryEntry{"missing", "value"}}}),
            "SOURCE_NOT_FOUND");
    capture(engine.derive(
                memory,
                evidence,
                Procedure{"mismatch",
                          "activity",
                          {"step"},
                          {LongTermMemoryEntry{"one", "wrong"}}}),
            "SOURCE_MISMATCH");
    capture(engine.link(memory, "A", "A"), "INVALID_RELATIONSHIP");
    capture(engine.retrieve(memory, "missing"), "NOT_FOUND");

    std::sort(observed.begin(), observed.end());
    observed.erase(std::unique(observed.begin(), observed.end()),
                   observed.end());
    EXPECT_EQ(observed, expected_codes);

    const auto first_failure = engine.retrieve(memory, "missing");
    const auto second_failure = engine.retrieve(memory, "missing");
    EXPECT_EQ(first_failure.message(), second_failure.message());
}

TEST(ProceduralMemorySourceTest,
     ProvenanceIsOwnedAndSourceAndProcedureLifecyclesAreIndependent) {
    LongTermMemory evidence{"workspace"};
    retain(evidence, "source-a", "alpha");
    retain(evidence, "source-b", "beta");
    ProceduralMemory memory{"workspace"};
    ProceduralMemoryEngine engine;
    derive_ok(memory, evidence, "A", "activity-a", {"a"}, "source-a");
    derive_ok(memory, evidence, "B", "activity-b", {"b"}, "source-b");
    expect_matches_success(engine.link(memory, "A", "B"), {"A", "B"});
    const auto procedure_before = snapshot_of(*memory.find("A"));

    ASSERT_TRUE(LongTermMemoryEngine{}
                    .store(evidence,
                           LongTermMemoryEntry{"source-a", "changed"})
                    .succeeded());
    EXPECT_EQ(snapshot_of(*memory.find("A")), procedure_before);
    ASSERT_TRUE(LongTermMemoryEngine{}.archive(evidence, "source-a")
                    .succeeded());
    EXPECT_EQ(snapshot_of(*memory.find("A")), procedure_before);
    ASSERT_TRUE(LongTermMemoryEngine{}.forget(evidence, "source-a")
                    .succeeded());
    EXPECT_EQ(snapshot_of(*memory.find("A")), procedure_before);

    const auto evidence_before_update = snapshot_of(
        evidence, {"source-a", "source-b"});
    expect_procedure_success(
        engine.update(memory, "A", "updated", {"updated"}), "A");
    EXPECT_EQ(snapshot_of(evidence, {"source-a", "source-b"}),
              evidence_before_update);
    const auto survivor_before = snapshot_of(*memory.find("A"));
    expect_no_payload_success(engine.forget(memory, "B"));
    EXPECT_EQ(memory.find("A")->identifier(), survivor_before.identifier);
    EXPECT_EQ(memory.find("A")->activity(), survivor_before.activity);
    EXPECT_EQ(memory.find("A")->steps(), survivor_before.steps);
    EXPECT_EQ(snapshot_entries(memory.find("A")->sourceEntries()),
              survivor_before.source_entries);
    EXPECT_TRUE(memory.find("A")->linkedProcedureIdentifiers().empty());
    EXPECT_EQ(snapshot_of(evidence, {"source-a", "source-b"}),
              evidence_before_update);
    expect_no_payload_success(engine.forget(memory, "A"));
    EXPECT_EQ(snapshot_of(evidence, {"source-a", "source-b"}),
              evidence_before_update);
}

TEST(ProceduralMemoryFailureTest,
     SemanticFailuresPreserveCompleteStateAndEvidence) {
    LongTermMemory evidence{"workspace"};
    retain(evidence, "one", "1");
    retain(evidence, "two", "2");
    ProceduralMemory memory{"workspace"};
    ProceduralMemoryEngine engine;
    derive_ok(memory, evidence, "A", "a", {"a"}, "one");
    compose_ok(memory, evidence, "B", "b", {"b"}, {"one", "two"});
    expect_matches_success(engine.link(memory, "A", "B"), {"A", "B"});
    derive_ok(memory, evidence, "forgotten", "f", {"f"}, "one");
    expect_no_payload_success(engine.forget(memory, "forgotten"));
    const std::vector<std::string_view> procedure_probes{
        "A", "B", "forgotten", "candidate", "missing"};
    const std::vector<std::string_view> source_probes{"one", "two", "missing"};

    const auto verify = [&](auto operation, const std::string_view code) {
        const auto before = snapshot_of(memory, procedure_probes);
        const auto source_before = snapshot_of(evidence, source_probes);
        const auto result = operation();
        expect_failure(result, code);
        EXPECT_EQ(snapshot_of(memory, procedure_probes), before);
        EXPECT_EQ(snapshot_of(evidence, source_probes), source_before);
    };

    verify([&] {
        return engine.derive(
            memory,
            evidence,
            Procedure{"A", "different", {"a"},
                      {require_entry(evidence, "one")}});
    }, "IDENTIFIER_CONFLICT");
    verify([&] {
        return engine.compose(
            memory,
            evidence,
            Procedure{"candidate", "activity", {"step"},
                      {require_entry(evidence, "one"),
                       LongTermMemoryEntry{"missing", "value"}}});
    }, "SOURCE_NOT_FOUND");
    verify([&] { return engine.link(memory, "A", "missing"); },
           "NOT_FOUND");
    verify([&] {
        return engine.update(memory, "missing", "activity", {"step"});
    }, "NOT_FOUND");
    verify([&] { return engine.forget(memory, ""); },
           "INVALID_IDENTIFIER");
}

TEST(ProceduralMemoryValueTest, ResultsOwnCompleteIndependentPayloads) {
    std::optional<ProcedureResult> held_retrieval;
    std::optional<ProcedureResult> held_search;
    ProcedureSnapshot retrieved_snapshot;
    std::vector<ProcedureSnapshot> search_snapshots;
    {
        LongTermMemory evidence{"workspace"};
        retain(evidence, "source", "value");
        ProceduralMemory memory{"workspace"};
        derive_ok(memory, evidence, "A", "activity", {"one", "two"},
                  "source");
        derive_ok(memory, evidence, "B", "other", {"other"}, "source");
        ProceduralMemoryEngine engine;
        held_retrieval.emplace(engine.retrieve(memory, "A"));
        held_search.emplace(engine.search(memory, ProcedureQuery{""}));
        retrieved_snapshot = snapshot_of(*held_retrieval->procedure());
        for (const auto& match : held_search->matches()) {
            search_snapshots.push_back(snapshot_of(match));
        }
        expect_no_payload_success(engine.forget(memory, "A"));
        expect_procedure_success(
            engine.update(memory, "B", "changed", {"changed"}), "B");
    }

    ASSERT_TRUE(held_retrieval.has_value());
    ASSERT_TRUE(held_search.has_value());
    EXPECT_EQ(snapshot_of(*held_retrieval->procedure()), retrieved_snapshot);
    ASSERT_EQ(held_search->matches().size(), search_snapshots.size());
    for (std::size_t index = 0; index < search_snapshots.size(); ++index) {
        EXPECT_EQ(snapshot_of(held_search->matches()[index]),
                  search_snapshots[index]);
    }

    ProcedureResult moved{std::move(*held_retrieval)};
    expect_procedure_success(moved, "A");
    auto replacement = std::move(*held_search);
    replacement = std::move(moved);
    expect_procedure_success(replacement, "A");
}

TEST(ProceduralMemoryIsolationTest,
     IndependentInstancesAndEnginesSupportConcurrency) {
    constexpr std::size_t worker_count = 4U;
    std::array<std::optional<ProceduralStateSnapshot>, worker_count> states;
    std::array<std::optional<LongTermStateSnapshot>, worker_count> sources;
    std::array<bool, worker_count> succeeded{};
    std::array<std::thread, worker_count> workers;

    for (std::size_t index = 0; index < worker_count; ++index) {
        workers[index] = std::thread{[&, index] {
            const auto suffix = std::to_string(index);
            LongTermMemory evidence{"workspace-" + suffix};
            const auto retained = LongTermMemoryEngine{}.retain(
                evidence,
                LongTermMemoryEntry{"source-" + suffix, "value-" + suffix});
            ProceduralMemory memory{"workspace-" + suffix};
            ProceduralMemoryEngine first_engine;
            ProceduralMemoryEngine second_engine;
            const auto derived = first_engine.derive(
                memory,
                evidence,
                Procedure{"procedure-" + suffix,
                          "activity-" + suffix,
                          {"step-" + suffix},
                          {LongTermMemoryEntry{"source-" + suffix,
                                               "value-" + suffix}}});
            const auto updated = second_engine.update(
                memory,
                "procedure-" + suffix,
                "updated-" + suffix,
                {"updated-step-" + suffix});
            succeeded[index] = retained.succeeded() && derived.succeeded() &&
                               updated.succeeded();
            states[index] = snapshot_of(memory);
            sources[index] = snapshot_of(evidence);
        }};
    }
    for (auto& worker : workers) {
        worker.join();
    }
    for (std::size_t index = 0; index < worker_count; ++index) {
        ASSERT_TRUE(succeeded[index]);
        ASSERT_TRUE(states[index].has_value());
        ASSERT_TRUE(sources[index].has_value());
        EXPECT_EQ(states[index]->workspace_identifier,
                  "workspace-" + std::to_string(index));
        EXPECT_EQ(states[index]->procedures.front().activity,
                  "updated-" + std::to_string(index));
        EXPECT_EQ(sources[index]->entries.front().value,
                  "value-" + std::to_string(index));
    }
}

TEST(ProceduralMemoryRuntimeTest, RuntimeLifecyclesDoNotOwnOrMutateState) {
    LongTermMemory evidence{"workspace"};
    retain(evidence, "source", "value");
    ProceduralMemory memory{"workspace"};
    derive_ok(memory, evidence, "procedure", "activity", {"step"},
              "source");
    const auto before = snapshot_of(memory, {"procedure", "absent"});
    const auto source_before = snapshot_of(evidence, {"source"});

    {
        auto runtime = cca::runtime::RuntimeBuilder{
                           cca::runtime::RuntimeId{"procedural-runtime-one"}}
                           .build();
        ASSERT_NE(runtime, nullptr);
        ASSERT_TRUE(runtime->start().ok());
        EXPECT_EQ(snapshot_of(memory, {"procedure", "absent"}), before);
        ASSERT_TRUE(runtime->stop().ok());
    }
    {
        auto replacement = cca::runtime::RuntimeBuilder{
                               cca::runtime::RuntimeId{
                                   "procedural-runtime-replacement"}}
                               .build();
        ASSERT_NE(replacement, nullptr);
        ASSERT_TRUE(replacement->start().ok());
        ASSERT_TRUE(replacement->stop().ok());
    }
    EXPECT_EQ(snapshot_of(memory, {"procedure", "absent"}), before);
    EXPECT_EQ(snapshot_of(evidence, {"source"}), source_before);
}

TEST(ProceduralMemoryDeterminismTest,
     EquivalentSequencesProduceCompleteEquality) {
    const auto execute = [](ProceduralMemory& memory,
                            LongTermMemory& evidence) {
        ProceduralMemoryEngine engine;
        std::vector<ResultSnapshot> results;
        results.push_back(snapshot_of(engine.derive(
            memory,
            evidence,
            proposal("A", "one", {"a", "a"}, evidence, {"first"}))));
        results.push_back(snapshot_of(engine.compose(
            memory,
            evidence,
            proposal("B", "two", {"b"}, evidence, {"second", "first"}))));
        results.push_back(snapshot_of(engine.derive(
            memory,
            evidence,
            proposal("C", "three", {"c"}, evidence, {"second"}))));
        results.push_back(snapshot_of(engine.link(memory, "B", "A")));
        results.push_back(snapshot_of(engine.retrieve(memory, "A")));
        results.push_back(snapshot_of(engine.search(memory, ProcedureQuery{"o"})));
        results.push_back(snapshot_of(
            engine.update(memory, "C", "THREE", {"C", "C"})));
        results.push_back(snapshot_of(engine.forget(memory, "A")));
        results.push_back(snapshot_of(engine.derive(
            memory,
            evidence,
            proposal("A", "again", {"again"}, evidence, {"first"}))));
        results.push_back(snapshot_of(engine.forget(memory, "absent")));
        return results;
    };

    LongTermMemory first_evidence{"workspace"};
    LongTermMemory second_evidence{"workspace"};
    retain(first_evidence, "first", "1");
    retain(first_evidence, "second", "2");
    retain(second_evidence, "first", "1");
    retain(second_evidence, "second", "2");
    ProceduralMemory first{"workspace"};
    ProceduralMemory second{"workspace"};
    EXPECT_EQ(execute(first, first_evidence),
              execute(second, second_evidence));
    EXPECT_EQ(snapshot_of(first, {"A", "B", "C", "absent"}),
              snapshot_of(second, {"A", "B", "C", "absent"}));
    EXPECT_EQ(snapshot_of(first_evidence, {"first", "second"}),
              snapshot_of(second_evidence, {"first", "second"}));
}

TEST(ProceduralMemoryExplicitInputTest,
     ValuesAreNeverInferredExecutedOrTraversed) {
    LongTermMemory evidence{"workspace"};
    retain(evidence, "source", "possible inferred plan execute hidden");
    ProceduralMemory memory{"workspace"};
    derive_ok(memory, evidence, "A", "caller activity", {"caller step"},
              "source");
    derive_ok(memory, evidence, "B", "other", {"other"}, "source");
    derive_ok(memory, evidence, "C", "third", {"third"}, "source");
    ProceduralMemoryEngine engine;
    expect_matches_success(engine.link(memory, "A", "B"), {"A", "B"});
    expect_matches_success(engine.link(memory, "B", "C"), {"B", "C"});
    EXPECT_EQ(memory.find("A")->activity(), "caller activity");
    EXPECT_EQ(memory.find("A")->steps(),
              (std::vector<std::string>{"caller step"}));
    expect_matches_success(engine.search(memory, ProcedureQuery{"C"}), {"C"});
    expect_matches_success(
        engine.search(memory, ProcedureQuery{"possible inferred plan"}), {});
    expect_matches_success(engine.search(memory, ProcedureQuery{"third"}),
                           {"C"});
}

[[nodiscard]] RepresentationValue strings(
    const std::vector<std::string>& values) {
    std::vector<RepresentationValue> encoded;
    encoded.reserve(values.size());
    for (const auto& value : values) {
        encoded.emplace_back(value);
    }
    return RepresentationValue{std::move(encoded)};
}

[[nodiscard]] RepresentationValue provenance_record(
    std::string identifier,
    std::string value,
    const bool archived = false) {
    std::vector<RepresentationValue> record;
    record.emplace_back(std::move(identifier));
    record.emplace_back(std::move(value));
    record.emplace_back(archived);
    return RepresentationValue{std::move(record)};
}

[[nodiscard]] RepresentationValue procedural_record(
    std::string identifier,
    std::string activity,
    const std::vector<std::string>& steps,
    std::vector<RepresentationValue> provenance,
    const std::vector<std::string>& links = {}) {
    std::vector<RepresentationValue> record;
    record.emplace_back(std::move(identifier));
    record.emplace_back(std::move(activity));
    record.emplace_back(strings(steps));
    record.emplace_back(std::move(provenance));
    record.emplace_back(strings(links));
    return RepresentationValue{std::move(record)};
}

void add_manifest(RepresentationDocument& document,
                  std::string workspace,
                  std::vector<RepresentationValue> procedures,
                  std::vector<std::string> forgotten = {},
                  const std::int64_t schema = 1) {
    auto& manifest = document.createEntity(RepresentationType{
        "cca.memory.procedural-memory.persistence.v1"});
    manifest.addProperty("schema-version",
                         RepresentationType{"cca.integer"},
                         RepresentationValue{schema});
    manifest.addProperty("workspace-identifier",
                         RepresentationType{"cca.string"},
                         RepresentationValue{std::move(workspace)});
    manifest.addProperty(
        "procedures",
        RepresentationType{"cca.memory.procedural-memory.procedures"},
        RepresentationValue{std::move(procedures)});
    manifest.addProperty(
        "forgotten-identifiers",
        RepresentationType{"cca.memory.procedural-memory.identifiers"},
        strings(forgotten));
}

[[nodiscard]] std::unique_ptr<RepresentationDocument> malformed_projection(
    std::string workspace,
    std::vector<RepresentationValue> procedures,
    std::vector<std::string> forgotten = {},
    const std::int64_t schema = 1) {
    auto document = std::make_unique<RepresentationDocument>(
        RepresentationMetadata{"CCA", "CCA-PRMEM-1.0", "malformed-test"});
    add_manifest(*document,
                 std::move(workspace),
                 std::move(procedures),
                 std::move(forgotten),
                 schema);
    const auto validation = FreezeService{}.freeze(*document);
    if (!validation.valid) {
        throw std::logic_error{"malformed Procedural test projection was not "
                               "a valid Representation document"};
    }
    return document;
}

void expect_invalid_projection(
    const std::unique_ptr<RepresentationDocument>& projection) {
    ASSERT_NE(projection, nullptr);
    const auto entity_count = projection->entities().size();
    EXPECT_THROW(
        static_cast<void>(
            cca::memory::detail::ProceduralMemoryPersistence::reconstruct(
                *projection)),
        std::invalid_argument);
    EXPECT_TRUE(projection->isFrozen());
    EXPECT_EQ(projection->entities().size(), entity_count);
}

TEST(ProceduralMemoryPersistenceTest,
     ProjectReconstructAndRealRoundTripAreExact) {
    LongTermMemory evidence{"persistence-workspace"};
    retain(evidence, "source-a", "alpha");
    retain(evidence, "source-b", "beta");
    retain(evidence, "source-c", "gamma");
    ProceduralMemory source{"persistence-workspace"};
    ProceduralMemoryEngine engine;
    derive_ok(source, evidence, "A", "activity-a", {"a", "a"}, "source-a");
    compose_ok(source,
               evidence,
               "B",
               "activity-b",
               {"b-1", "b-2"},
               {"source-b", "source-a"});
    compose_ok(source,
               evidence,
               "C",
               "activity-c",
               {"c"},
               {"source-c", "source-a", "source-b"});
    expect_matches_success(engine.link(source, "A", "B"), {"A", "B"});
    expect_matches_success(engine.link(source, "A", "C"), {"A", "C"});
    expect_matches_success(engine.link(source, "B", "C"), {"B", "C"});
    expect_procedure_success(
        engine.update(source, "C", "updated-c", {"c", "c", "last"}),
        "C");
    expect_no_payload_success(engine.forget(source, "B"));
    const std::vector<std::string_view> probes{"A", "B", "C", "absent"};
    const auto before = snapshot_of(source, probes);

    auto projection =
        cca::memory::detail::ProceduralMemoryPersistence::project(source);
    ASSERT_NE(projection, nullptr);
    EXPECT_TRUE(projection->isFrozen());
    auto reconstructed =
        cca::memory::detail::ProceduralMemoryPersistence::reconstruct(
            *projection);
    EXPECT_EQ(snapshot_of(reconstructed, probes), before);

    auto round_tripped =
        cca::memory::detail::ProceduralMemoryPersistence::roundTrip(source);
    EXPECT_EQ(snapshot_of(round_tripped, probes), before);
    EXPECT_EQ(snapshot_of(source, probes), before);

    expect_procedure_success(
        engine.update(reconstructed, "A", "independent", {"independent"}),
        "A");
    EXPECT_EQ(source.find("A")->activity(), "activity-a");

    ASSERT_TRUE(LongTermMemoryEngine{}
                    .store(evidence,
                           LongTermMemoryEntry{"source-a", "changed"})
                    .succeeded());
    ASSERT_TRUE(LongTermMemoryEngine{}.archive(evidence, "source-b")
                    .succeeded());
    ASSERT_TRUE(LongTermMemoryEngine{}.forget(evidence, "source-c")
                    .succeeded());
    auto without_live_sources =
        cca::memory::detail::ProceduralMemoryPersistence::roundTrip(source);
    EXPECT_EQ(snapshot_of(without_live_sources, probes), before);
}

TEST(ProceduralMemoryPersistenceTest,
     MalformedInputsAreRejectedWithoutPartialPublication) {
    const auto source = [] {
        std::vector<RepresentationValue> values;
        values.push_back(provenance_record("source", "value"));
        return values;
    };
    const auto second_source = [] {
        std::vector<RepresentationValue> values;
        values.push_back(provenance_record("source", "value"));
        values.push_back(provenance_record("second", "second-value"));
        return values;
    };
    const auto valid_procedure = [&] {
        std::vector<RepresentationValue> procedures;
        procedures.push_back(procedural_record(
            "A", "activity", {"step"}, source(), {}));
        return procedures;
    };

    auto absent_manifest = std::make_unique<RepresentationDocument>(
        RepresentationMetadata{"CCA", "CCA-PRMEM-1.0", "missing"});
    ASSERT_TRUE(FreezeService{}.freeze(*absent_manifest).valid);
    expect_invalid_projection(absent_manifest);

    auto duplicate_manifest = std::make_unique<RepresentationDocument>(
        RepresentationMetadata{"CCA", "CCA-PRMEM-1.0", "duplicate"});
    add_manifest(*duplicate_manifest, "workspace", valid_procedure());
    add_manifest(*duplicate_manifest, "workspace", valid_procedure());
    ASSERT_TRUE(FreezeService{}.freeze(*duplicate_manifest).valid);
    expect_invalid_projection(duplicate_manifest);

    expect_invalid_projection(
        malformed_projection("workspace", valid_procedure(), {}, 2));
    expect_invalid_projection(malformed_projection("", valid_procedure()));

    std::vector<RepresentationValue> duplicate_procedures;
    duplicate_procedures.push_back(
        procedural_record("A", "first", {"step"}, source()));
    duplicate_procedures.push_back(
        procedural_record("A", "second", {"step"}, source()));
    expect_invalid_projection(malformed_projection(
        "workspace", std::move(duplicate_procedures)));

    std::vector<RepresentationValue> empty_identifier;
    empty_identifier.push_back(
        procedural_record("", "activity", {"step"}, source()));
    expect_invalid_projection(
        malformed_projection("workspace", std::move(empty_identifier)));

    std::vector<RepresentationValue> empty_activity;
    empty_activity.push_back(
        procedural_record("A", "", {"step"}, source()));
    expect_invalid_projection(
        malformed_projection("workspace", std::move(empty_activity)));

    std::vector<RepresentationValue> empty_steps;
    empty_steps.push_back(procedural_record("A", "activity", {}, source()));
    expect_invalid_projection(
        malformed_projection("workspace", std::move(empty_steps)));

    std::vector<RepresentationValue> empty_step_value;
    empty_step_value.push_back(
        procedural_record("A", "activity", {"first", ""}, source()));
    expect_invalid_projection(
        malformed_projection("workspace", std::move(empty_step_value)));

    std::vector<RepresentationValue> empty_provenance;
    empty_provenance.push_back(
        procedural_record("A", "activity", {"step"}, {}));
    expect_invalid_projection(
        malformed_projection("workspace", std::move(empty_provenance)));

    std::vector<RepresentationValue> empty_source;
    empty_source.push_back(procedural_record(
        "A", "activity", {"step"}, {provenance_record("", "value")}));
    expect_invalid_projection(
        malformed_projection("workspace", std::move(empty_source)));

    std::vector<RepresentationValue> duplicate_sources;
    duplicate_sources.push_back(procedural_record(
        "A",
        "activity",
        {"step"},
        {provenance_record("source", "value"),
         provenance_record("source", "value")}));
    expect_invalid_projection(
        malformed_projection("workspace", std::move(duplicate_sources)));

    std::vector<RepresentationValue> self_source;
    self_source.push_back(procedural_record(
        "A", "activity", {"step"}, {provenance_record("A", "value")}));
    expect_invalid_projection(
        malformed_projection("workspace", std::move(self_source)));

    std::vector<RepresentationValue> archived_source;
    archived_source.push_back(procedural_record(
        "A",
        "activity",
        {"step"},
        {provenance_record("source", "value", true)}));
    expect_invalid_projection(
        malformed_projection("workspace", std::move(archived_source)));

    std::vector<RepresentationValue> dangling_link;
    dangling_link.push_back(procedural_record(
        "A", "activity", {"step"}, source(), {"missing"}));
    expect_invalid_projection(
        malformed_projection("workspace", std::move(dangling_link)));

    std::vector<RepresentationValue> self_link;
    self_link.push_back(procedural_record(
        "A", "activity", {"step"}, source(), {"A"}));
    expect_invalid_projection(
        malformed_projection("workspace", std::move(self_link)));

    std::vector<RepresentationValue> duplicate_links;
    duplicate_links.push_back(procedural_record(
        "A", "activity", {"step"}, source(), {"B", "B"}));
    duplicate_links.push_back(procedural_record(
        "B", "activity", {"step"}, source(), {"A"}));
    expect_invalid_projection(
        malformed_projection("workspace", std::move(duplicate_links)));

    std::vector<RepresentationValue> asymmetric_links;
    asymmetric_links.push_back(procedural_record(
        "A", "activity", {"step"}, source(), {"B"}));
    asymmetric_links.push_back(procedural_record(
        "B", "activity", {"step"}, second_source(), {}));
    expect_invalid_projection(
        malformed_projection("workspace", std::move(asymmetric_links)));

    expect_invalid_projection(malformed_projection(
        "workspace", valid_procedure(), {"A"}));
    expect_invalid_projection(malformed_projection(
        "workspace", valid_procedure(), {"forgotten", "forgotten"}));

    std::vector<RepresentationValue> link_to_forgotten;
    link_to_forgotten.push_back(procedural_record(
        "A", "activity", {"step"}, source(), {"forgotten"}));
    expect_invalid_projection(malformed_projection(
        "workspace", std::move(link_to_forgotten), {"forgotten"}));
}

} // namespace
