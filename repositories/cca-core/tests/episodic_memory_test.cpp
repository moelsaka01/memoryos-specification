#include <cca/memory/episodic_memory.hpp>
#include <cca/memory/long_term_memory.hpp>
#include <cca/representation/representation.hpp>
#include <cca/runtime/runtime.hpp>
#include <cca/runtime/runtime_builder.hpp>
#include <cca/runtime/runtime_id.hpp>

#include "episodic_memory_persistence.hpp"

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
CCA-EPMEM-1.0 requirement coverage
----------------------------------
CCA-EPMEM-001: EpisodicMemoryArchitectureTest (CTest)
CCA-EPMEM-002: EpisodicMemoryApiTest.PublicDeclarationsMatchContract
CCA-EPMEM-003: EpisodicMemoryApiTest.PublicDeclarationsMatchContract
CCA-EPMEM-004: EpisodicMemoryOwnershipTest.WorkspaceBoundaryIsRequiredAndImmutable
CCA-EPMEM-005: EpisodicMemoryIsolationTest and architecture gate
CCA-EPMEM-006: EpisodicMemoryObservationTest.PristineAndCanonicalObservationAreExact
CCA-EPMEM-007: EpisodicMemorySourceTest.ProvenanceIsOwnedAndEvidenceRemainsAuthoritative
CCA-EPMEM-008: EpisodicMemoryPrecedenceTest.EstablishmentValidationOrderIsExact
CCA-EPMEM-009: EpisodicMemoryEstablishmentTest.ValidatesEveryOrderedLongTermSource
CCA-EPMEM-010: EpisodicMemoryIdentityTest.IdentityIsDurableAndForgottenIdentityIsReserved
CCA-EPMEM-011: EpisodicMemoryEstablishmentTest.PreservesCompleteOrderedProvenance
CCA-EPMEM-012: EpisodicMemoryChronologyTest.LogicalChronologyIsExplicitAndImmutable
CCA-EPMEM-013: EpisodicMemoryOrderingTest.AllObservableOrdersAreDeterministic
CCA-EPMEM-014: EpisodicMemoryRecordTest.AppendFrontierIdempotenceConflictAndPayloadAreExact
CCA-EPMEM-015: EpisodicMemoryDeriveTest.RetrospectivePlacementAndOverlapAreExact
CCA-EPMEM-016: EpisodicMemoryRetrieveTest.ExactIndependentRetrievalDoesNotMutate
CCA-EPMEM-017: EpisodicMemorySearchTest.SearchesOnlySpecifiedFieldsInCanonicalOrder
CCA-EPMEM-018: EpisodicMemoryLinkTest.UndirectedAtomicLinksAndPayloadOrderAreExact
CCA-EPMEM-019: EpisodicMemoryForgetTest.RemovesAllIncidentLinksAtomically
CCA-EPMEM-020: EpisodicMemoryUpdateTest.ChangesOnlyOccurrenceAndContext
CCA-EPMEM-021: EpisodicMemoryForgetTest.IsIrreversibleIdempotentAndOrderPreserving
CCA-EPMEM-022: EpisodicMemoryFailureTest.SemanticFailuresPreserveCompleteStateAndEvidence
CCA-EPMEM-023: EpisodicMemorySourceTest.SourceAndEpisodeLifecyclesAreIndependent
CCA-EPMEM-024: EpisodicMemoryResultTest.CodesMessagesAndPayloadShapesAreExact
CCA-EPMEM-025: EpisodicMemoryPrecedenceTest.AllOperationPrecedenceIsExact
CCA-EPMEM-026: EpisodicMemoryValueTest.CopiesMovesAndResultsOwnCompleteIndependentValues
CCA-EPMEM-027: EpisodicMemoryIsolationTest.IndependentInstancesAndEnginesSupportConcurrency
CCA-EPMEM-028: EpisodicMemoryFailureTest plus dedicated allocation-failure executable
CCA-EPMEM-029: EpisodicMemoryDeterminismTest.EquivalentSequencesProduceCompleteEquality
CCA-EPMEM-030: EpisodicMemoryPersistenceTest and architecture gate
CCA-EPMEM-031: EpisodicMemoryPersistenceTest.ProjectReconstructAndRealRoundTripAreExact
CCA-EPMEM-032: EpisodicMemoryRuntimeTest.RuntimeLifecyclesDoNotOwnOrMutateState
CCA-EPMEM-033: EpisodicMemoryArchitectureTest (CTest)
CCA-EPMEM-034: EpisodicMemoryArchitectureTest (CTest)
CCA-EPMEM-035: EpisodicMemoryExplicitInputTest.ValuesAreNeverInferredOrTraversed
CCA-EPMEM-036: EpisodicMemoryArchitectureTest (CTest)
CCA-EPMEM-037: documentation/example architecture checks
CCA-EPMEM-038: this mapping and architecture traceability audit
CCA-EPMEM-039: CI C++23 warnings-as-errors build gate
*/

namespace {

using cca::memory::Episode;
using cca::memory::EpisodeQuery;
using cca::memory::EpisodeResult;
using cca::memory::EpisodicMemory;
using cca::memory::EpisodicMemoryEngine;
using cca::memory::LongTermMemory;
using cca::memory::LongTermMemoryEngine;
using cca::memory::LongTermMemoryEntry;
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

struct EpisodeSnapshot final {
    std::string identifier;
    std::string occurrence;
    std::string context;
    std::int64_t chronology;
    std::vector<EntrySnapshot> source_entries;
    std::vector<std::string> links;

    bool operator==(const EpisodeSnapshot&) const = default;
};

struct IdentifierSnapshot final {
    std::string identifier;
    std::string disposition;

    bool operator==(const IdentifierSnapshot&) const = default;
};

struct EpisodicStateSnapshot final {
    std::string workspace_identifier;
    std::vector<EpisodeSnapshot> episodes;
    std::vector<IdentifierSnapshot> identifiers;

    bool operator==(const EpisodicStateSnapshot&) const = default;
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
    std::optional<EpisodeSnapshot> episode;
    std::vector<EpisodeSnapshot> matches;

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

[[nodiscard]] EpisodeSnapshot snapshot_of(const Episode& episode) {
    return {episode.identifier(),
            episode.occurrence(),
            episode.context(),
            episode.chronology(),
            snapshot_entries(episode.sourceEntries()),
            episode.linkedEpisodeIdentifiers()};
}

[[nodiscard]] std::vector<EpisodeSnapshot> snapshot_episodes(
    const std::vector<Episode>& episodes) {
    std::vector<EpisodeSnapshot> result;
    result.reserve(episodes.size());
    for (const auto& episode : episodes) {
        result.push_back(snapshot_of(episode));
    }
    return result;
}

void retain(LongTermMemory& memory,
            std::string identifier,
            std::string value) {
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
        throw std::logic_error{"test fixture source entry is absent"};
    }
    return *entry;
}

[[nodiscard]] Episode proposal(
    std::string identifier,
    std::string occurrence,
    std::string context,
    const std::int64_t chronology,
    const LongTermMemory& evidence,
    const std::vector<std::string_view>& sources) {
    std::vector<LongTermMemoryEntry> snapshots;
    snapshots.reserve(sources.size());
    for (const auto source : sources) {
        snapshots.push_back(require_entry(evidence, source));
    }
    return Episode{std::move(identifier),
                   std::move(occurrence),
                   std::move(context),
                   chronology,
                   std::move(snapshots)};
}

void record_ok(EpisodicMemory& memory,
               const LongTermMemory& evidence,
               std::string identifier,
               std::string occurrence,
               std::string context,
               const std::int64_t chronology,
               const std::vector<std::string_view>& sources) {
    const auto result = EpisodicMemoryEngine{}.record(
        memory,
        evidence,
        proposal(std::move(identifier),
                 std::move(occurrence),
                 std::move(context),
                 chronology,
                 evidence,
                 sources));
    ASSERT_TRUE(result.succeeded()) << result.code() << ": "
                                    << result.message();
}

void derive_ok(EpisodicMemory& memory,
               const LongTermMemory& evidence,
               std::string identifier,
               std::string occurrence,
               std::string context,
               const std::int64_t chronology,
               const std::vector<std::string_view>& sources) {
    const auto result = EpisodicMemoryEngine{}.derive(
        memory,
        evidence,
        proposal(std::move(identifier),
                 std::move(occurrence),
                 std::move(context),
                 chronology,
                 evidence,
                 sources));
    ASSERT_TRUE(result.succeeded()) << result.code() << ": "
                                    << result.message();
}

[[nodiscard]] std::string episodic_disposition(
    const EpisodicMemory& memory,
    const std::string_view identifier) {
    if (memory.find(identifier) != nullptr) {
        return "ACCESSIBLE";
    }

    constexpr std::string_view probe_source{
        "__episodic-memory-history-probe-source__"};
    LongTermMemory evidence{memory.workspaceIdentifier()};
    retain(evidence, std::string{probe_source}, "probe-source-value");
    EpisodicMemory copy{memory};
    const auto result = EpisodicMemoryEngine{}.derive(
        copy,
        evidence,
        proposal(std::string{identifier},
                 "probe-occurrence",
                 "probe-context",
                 0,
                 evidence,
                 {probe_source}));
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
    LongTermMemory copy{memory};
    const auto result = LongTermMemoryEngine{}.retain(
        copy,
        LongTermMemoryEntry{std::string{identifier}, "history-probe"});
    if (result.code() == "FORGOTTEN_IDENTIFIER") {
        return "FORGOTTEN";
    }
    if (result.succeeded()) {
        return "ABSENT";
    }
    return "UNEXPECTED:" + result.code();
}

[[nodiscard]] EpisodicStateSnapshot snapshot_of(
    const EpisodicMemory& memory,
    const std::vector<std::string_view>& probes = {}) {
    std::vector<IdentifierSnapshot> identifiers;
    identifiers.reserve(probes.size());
    for (const auto identifier : probes) {
        identifiers.push_back(
            {std::string{identifier}, episodic_disposition(memory, identifier)});
    }
    return {memory.workspaceIdentifier(),
            snapshot_episodes(memory.episodes()),
            std::move(identifiers)};
}

[[nodiscard]] LongTermStateSnapshot snapshot_of(
    const LongTermMemory& memory,
    const std::vector<std::string_view>& probes) {
    std::vector<IdentifierSnapshot> identifiers;
    identifiers.reserve(probes.size());
    for (const auto identifier : probes) {
        identifiers.push_back({std::string{identifier},
                               long_term_disposition(memory, identifier)});
    }
    return {memory.workspaceIdentifier(),
            snapshot_entries(memory.entries()),
            std::move(identifiers)};
}

[[nodiscard]] ResultSnapshot snapshot_of(const EpisodeResult& result) {
    std::optional<EpisodeSnapshot> episode;
    if (result.episode() != nullptr) {
        episode = snapshot_of(*result.episode());
    }
    return {result.succeeded(),
            result.code(),
            result.message(),
            std::move(episode),
            snapshot_episodes(result.matches())};
}

void expect_episode_success(const EpisodeResult& result,
                            const std::string_view identifier) {
    ASSERT_TRUE(result.succeeded()) << result.code() << ": "
                                    << result.message();
    EXPECT_EQ(result.code(), "OK");
    EXPECT_TRUE(result.message().empty());
    ASSERT_NE(result.episode(), nullptr);
    EXPECT_EQ(result.episode()->identifier(), identifier);
    EXPECT_TRUE(result.matches().empty());
}

void expect_matches_success(
    const EpisodeResult& result,
    const std::vector<std::string_view>& identifiers) {
    ASSERT_TRUE(result.succeeded()) << result.code() << ": "
                                    << result.message();
    EXPECT_EQ(result.code(), "OK");
    EXPECT_TRUE(result.message().empty());
    EXPECT_EQ(result.episode(), nullptr);
    ASSERT_EQ(result.matches().size(), identifiers.size());
    for (std::size_t index = 0; index < identifiers.size(); ++index) {
        EXPECT_EQ(result.matches()[index].identifier(), identifiers[index]);
    }
}

void expect_no_payload_success(const EpisodeResult& result) {
    ASSERT_TRUE(result.succeeded()) << result.code() << ": "
                                    << result.message();
    EXPECT_EQ(result.code(), "OK");
    EXPECT_TRUE(result.message().empty());
    EXPECT_EQ(result.episode(), nullptr);
    EXPECT_TRUE(result.matches().empty());
}

void expect_failure(const EpisodeResult& result,
                    const std::string_view code) {
    EXPECT_FALSE(result.succeeded());
    EXPECT_EQ(result.code(), code);
    EXPECT_FALSE(result.message().empty());
    EXPECT_EQ(result.episode(), nullptr);
    EXPECT_TRUE(result.matches().empty());
}

TEST(EpisodicMemoryApiTest, PublicDeclarationsMatchContract) {
    static_assert(std::is_constructible_v<Episode,
                                          std::string,
                                          std::string,
                                          std::string,
                                          std::int64_t,
                                          std::vector<LongTermMemoryEntry>>);
    static_assert(std::is_copy_constructible_v<Episode>);
    static_assert(std::is_copy_assignable_v<Episode>);
    static_assert(std::is_nothrow_move_constructible_v<Episode>);
    static_assert(std::is_nothrow_move_assignable_v<Episode>);
    static_assert(std::is_constructible_v<EpisodeQuery, std::string>);
    static_assert(!std::is_convertible_v<std::string, EpisodeQuery>);
    static_assert(std::is_constructible_v<EpisodicMemory, std::string>);
    static_assert(std::is_copy_constructible_v<EpisodicMemory>);
    static_assert(!std::is_copy_assignable_v<EpisodicMemory>);
    static_assert(std::is_nothrow_move_constructible_v<EpisodicMemory>);
    static_assert(!std::is_move_assignable_v<EpisodicMemory>);
    static_assert(!std::is_default_constructible_v<EpisodeResult>);
    static_assert(std::is_nothrow_move_constructible_v<EpisodeResult>);
    static_assert(std::is_nothrow_move_assignable_v<EpisodeResult>);
    static_assert(!std::is_copy_constructible_v<EpisodeResult>);
    static_assert(!std::is_copy_assignable_v<EpisodeResult>);
    static_assert(std::is_empty_v<EpisodicMemoryEngine>);

    using EpisodeString = const std::string& (Episode::*)() const noexcept;
    using Chronology = std::int64_t (Episode::*)() const noexcept;
    using SourceEntries = const std::vector<LongTermMemoryEntry>& (
        Episode::*)() const noexcept;
    using StringSequence = const std::vector<std::string>& (
        Episode::*)() const noexcept;
    using QueryText = const std::string& (EpisodeQuery::*)() const noexcept;
    using Workspace = const std::string& (EpisodicMemory::*)() const noexcept;
    using Size = std::size_t (EpisodicMemory::*)() const noexcept;
    using Find = const Episode* (EpisodicMemory::*)(
        std::string_view) const noexcept;
    using Episodes = const std::vector<Episode>& (
        EpisodicMemory::*)() const noexcept;
    using Succeeded = bool (EpisodeResult::*)() const noexcept;
    using ResultString = const std::string& (EpisodeResult::*)()
        const noexcept;
    using EpisodePayload = const Episode* (EpisodeResult::*)() const noexcept;
    using Matches = const std::vector<Episode>& (
        EpisodeResult::*)() const noexcept;

    static_assert(std::is_same_v<decltype(static_cast<EpisodeString>(
                                     &Episode::identifier)),
                                 EpisodeString>);
    static_assert(std::is_same_v<decltype(static_cast<EpisodeString>(
                                     &Episode::occurrence)),
                                 EpisodeString>);
    static_assert(std::is_same_v<decltype(static_cast<EpisodeString>(
                                     &Episode::context)),
                                 EpisodeString>);
    static_assert(std::is_same_v<decltype(static_cast<Chronology>(
                                     &Episode::chronology)),
                                 Chronology>);
    static_assert(std::is_same_v<decltype(static_cast<SourceEntries>(
                                     &Episode::sourceEntries)),
                                 SourceEntries>);
    static_assert(std::is_same_v<decltype(static_cast<StringSequence>(
                                     &Episode::linkedEpisodeIdentifiers)),
                                 StringSequence>);
    static_assert(std::is_same_v<decltype(static_cast<QueryText>(
                                     &EpisodeQuery::text)),
                                 QueryText>);
    static_assert(std::is_same_v<decltype(static_cast<Workspace>(
                                     &EpisodicMemory::workspaceIdentifier)),
                                 Workspace>);
    static_assert(std::is_same_v<decltype(static_cast<Size>(
                                     &EpisodicMemory::size)),
                                 Size>);
    static_assert(std::is_same_v<decltype(static_cast<Find>(
                                     &EpisodicMemory::find)),
                                 Find>);
    static_assert(std::is_same_v<decltype(static_cast<Episodes>(
                                     &EpisodicMemory::episodes)),
                                 Episodes>);
    static_assert(std::is_same_v<decltype(static_cast<Succeeded>(
                                     &EpisodeResult::succeeded)),
                                 Succeeded>);
    static_assert(std::is_same_v<decltype(static_cast<ResultString>(
                                     &EpisodeResult::code)),
                                 ResultString>);
    static_assert(std::is_same_v<decltype(static_cast<ResultString>(
                                     &EpisodeResult::message)),
                                 ResultString>);
    static_assert(std::is_same_v<decltype(static_cast<EpisodePayload>(
                                     &EpisodeResult::episode)),
                                 EpisodePayload>);
    static_assert(std::is_same_v<decltype(static_cast<Matches>(
                                     &EpisodeResult::matches)),
                                 Matches>);

    using Record = EpisodeResult (EpisodicMemoryEngine::*)(
        EpisodicMemory&, const LongTermMemory&, Episode) const;
    using Derive = EpisodeResult (EpisodicMemoryEngine::*)(
        EpisodicMemory&, const LongTermMemory&, Episode) const;
    using Retrieve = EpisodeResult (EpisodicMemoryEngine::*)(
        const EpisodicMemory&, std::string_view) const;
    using Search = EpisodeResult (EpisodicMemoryEngine::*)(
        const EpisodicMemory&, const EpisodeQuery&) const;
    using Link = EpisodeResult (EpisodicMemoryEngine::*)(
        EpisodicMemory&, std::string_view, std::string_view) const;
    using Update = EpisodeResult (EpisodicMemoryEngine::*)(
        EpisodicMemory&, std::string_view, std::string, std::string) const;
    using Forget = EpisodeResult (EpisodicMemoryEngine::*)(
        EpisodicMemory&, std::string_view) const;

    static_assert(std::is_same_v<decltype(static_cast<Record>(
                                     &EpisodicMemoryEngine::record)),
                                 Record>);
    static_assert(std::is_same_v<decltype(static_cast<Derive>(
                                     &EpisodicMemoryEngine::derive)),
                                 Derive>);
    static_assert(std::is_same_v<decltype(static_cast<Retrieve>(
                                     &EpisodicMemoryEngine::retrieve)),
                                 Retrieve>);
    static_assert(std::is_same_v<decltype(static_cast<Search>(
                                     &EpisodicMemoryEngine::search)),
                                 Search>);
    static_assert(std::is_same_v<decltype(static_cast<Link>(
                                     &EpisodicMemoryEngine::link)),
                                 Link>);
    static_assert(std::is_same_v<decltype(static_cast<Update>(
                                     &EpisodicMemoryEngine::update)),
                                 Update>);
    static_assert(std::is_same_v<decltype(static_cast<Forget>(
                                     &EpisodicMemoryEngine::forget)),
                                 Forget>);
}

TEST(EpisodicMemoryOwnershipTest, WorkspaceBoundaryIsRequiredAndImmutable) {
    EXPECT_THROW(static_cast<void>(EpisodicMemory{""}),
                 std::invalid_argument);
    EpisodicMemory memory{"Workspace-A"};
    EXPECT_EQ(memory.workspaceIdentifier(), "Workspace-A");
    EXPECT_EQ(memory.size(), 0U);
    EXPECT_TRUE(memory.episodes().empty());
    EXPECT_EQ(memory.find("anything"), nullptr);
}

TEST(EpisodicMemoryObservationTest,
     PristineAndCanonicalObservationAreExact) {
    LongTermMemory evidence{"workspace"};
    retain(evidence, "source-1", "one");
    retain(evidence, "source-2", "two");
    EpisodicMemory memory{"workspace"};
    derive_ok(memory, evidence, "Beta", "second", "context-b", 20,
              {"source-2"});
    const auto* stable_pointer = memory.find("Beta");
    ASSERT_NE(stable_pointer, nullptr);
    EXPECT_EQ(stable_pointer->occurrence(), "second");
    EXPECT_EQ(memory.find("beta"), nullptr);
    EXPECT_EQ(memory.size(), 1U);

    const auto observation = snapshot_of(memory);
    EXPECT_EQ(snapshot_of(memory), observation);
    derive_ok(memory, evidence, "Alpha", "first", "context-a", 10,
              {"source-1"});
    ASSERT_EQ(memory.episodes().size(), 2U);
    EXPECT_EQ(memory.episodes()[0].identifier(), "Alpha");
    EXPECT_EQ(memory.episodes()[1].identifier(), "Beta");
}

TEST(EpisodicMemoryValueTest, EpisodesQueriesCopiesAndMovesOwnValues) {
    LongTermMemory evidence{"workspace"};
    retain(evidence, "source", "value");
    Episode detached = proposal(
        "episode-id", "occurrence", "context", 7, evidence, {"source"});
    Episode copied{detached};
    EXPECT_EQ(snapshot_of(copied), snapshot_of(detached));
    Episode assigned{"other", "other", "other", 1,
                     {require_entry(evidence, "source")}};
    assigned = detached;
    EXPECT_EQ(snapshot_of(assigned), snapshot_of(detached));

    Episode moved{std::move(copied)};
    EXPECT_EQ(moved.identifier(), "episode-id");
    EXPECT_TRUE(copied.identifier().empty());
    EXPECT_TRUE(copied.occurrence().empty());
    EXPECT_TRUE(copied.context().empty());
    EXPECT_EQ(copied.chronology(), 0);
    EXPECT_TRUE(copied.sourceEntries().empty());
    EXPECT_TRUE(copied.linkedEpisodeIdentifiers().empty());

    Episode move_assigned{"temporary", "temporary", "temporary", 1,
                          {require_entry(evidence, "source")}};
    move_assigned = std::move(assigned);
    EXPECT_EQ(move_assigned.identifier(), "episode-id");
    EXPECT_TRUE(assigned.identifier().empty());
    EXPECT_TRUE(assigned.sourceEntries().empty());

    EpisodeQuery query{"Owned query"};
    EXPECT_EQ(query.text(), "Owned query");

    EpisodicMemory memory{"workspace"};
    derive_ok(memory, evidence, "episode-id", "occurrence", "context", 7,
              {"source"});
    EpisodicMemory independent{memory};
    expect_episode_success(EpisodicMemoryEngine{}.update(
                               independent,
                               "episode-id",
                               "changed occurrence",
                               "changed context"),
                           "episode-id");
    EXPECT_EQ(memory.find("episode-id")->occurrence(), "occurrence");

    const auto before_move = snapshot_of(independent, {"episode-id"});
    EpisodicMemory moved_memory{std::move(independent)};
    EXPECT_EQ(snapshot_of(moved_memory, {"episode-id"}), before_move);
    EXPECT_EQ(independent.workspaceIdentifier(), "workspace");
    EXPECT_TRUE(independent.episodes().empty());
    EXPECT_EQ(episodic_disposition(independent, "episode-id"), "ABSENT");
}

TEST(EpisodicMemoryEstablishmentTest,
     ValidatesEveryOrderedLongTermSource) {
    LongTermMemory evidence{"workspace"};
    retain(evidence, "source-a", "alpha evidence");
    retain(evidence, "source-b", "beta evidence");
    retain(evidence, "source-c", "gamma evidence");
    EpisodicMemory memory{"workspace"};
    EpisodicMemoryEngine engine;

    expect_failure(engine.derive(
                       memory,
                       evidence,
                       Episode{"none", "occurrence", "context", 1, {}}),
                   "INVALID_PROVENANCE");
    expect_failure(engine.derive(
                       memory,
                       evidence,
                       Episode{"empty-source",
                               "occurrence",
                               "context",
                               1,
                               {LongTermMemoryEntry{"", "value"}}}),
                   "INVALID_PROVENANCE");
    expect_failure(engine.derive(
                       memory,
                       evidence,
                       Episode{"duplicate-source",
                               "occurrence",
                               "context",
                               1,
                               {require_entry(evidence, "source-a"),
                                require_entry(evidence, "source-a")}}),
                   "INVALID_PROVENANCE");
    expect_failure(engine.derive(
                       memory,
                       evidence,
                       Episode{"source-a",
                               "occurrence",
                               "context",
                               1,
                               {require_entry(evidence, "source-a")}}),
                   "INVALID_PROVENANCE");
    expect_failure(engine.derive(
                       memory,
                       evidence,
                       Episode{"missing-source",
                               "occurrence",
                               "context",
                               1,
                               {LongTermMemoryEntry{"absent", "value"}}}),
                   "SOURCE_NOT_FOUND");
    expect_failure(engine.derive(
                       memory,
                       evidence,
                       Episode{"mismatch",
                               "occurrence",
                               "context",
                               1,
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
                       Episode{"archived-snapshot",
                               "occurrence",
                               "context",
                               1,
                               {require_entry(archived_snapshot_evidence,
                                              "archived")}}),
                   "SOURCE_NOT_LONG_TERM");

    LongTermMemory later_archived_evidence{"workspace"};
    retain(later_archived_evidence, "later-archived", "value");
    const LongTermMemoryEntry live_snapshot =
        require_entry(later_archived_evidence, "later-archived");
    ASSERT_TRUE(LongTermMemoryEngine{}
                    .archive(later_archived_evidence, "later-archived")
                    .succeeded());
    expect_failure(engine.derive(
                       memory,
                       later_archived_evidence,
                       Episode{"archived-live-source",
                               "occurrence",
                               "context",
                               1,
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
                       Episode{"forgotten-source",
                               "occurrence",
                               "context",
                               1,
                               {forgotten_snapshot}}),
                   "SOURCE_NOT_FOUND");

    const auto evidence_before = snapshot_of(
        evidence, {"source-a", "source-b", "source-c"});
    const auto result = engine.derive(
        memory,
        evidence,
        proposal("valid",
                 "one occurrence",
                 "one context",
                 5,
                 evidence,
                 {"source-c", "source-a", "source-b"}));
    expect_episode_success(result, "valid");
    ASSERT_NE(result.episode(), nullptr);
    EXPECT_EQ(snapshot_entries(result.episode()->sourceEntries()),
              (std::vector<EntrySnapshot>{
                  {"source-c", "gamma evidence", false},
                  {"source-a", "alpha evidence", false},
                  {"source-b", "beta evidence", false}}));
    EXPECT_EQ(snapshot_of(evidence,
                          {"source-a", "source-b", "source-c"}),
              evidence_before);
}

TEST(EpisodicMemoryPrecedenceTest,
     EstablishmentValidationOrderIsExact) {
    LongTermMemory local{"local"};
    LongTermMemory foreign{"foreign"};
    retain(local, "source", "value");
    retain(foreign, "source", "value");
    EpisodicMemory memory{"local"};
    EpisodicMemoryEngine engine;

    const Episode wholly_invalid{"", "", "", -1, {}};
    expect_failure(engine.record(memory, foreign, wholly_invalid),
                   "WORKSPACE_MISMATCH");
    expect_failure(engine.derive(memory, foreign, wholly_invalid),
                   "WORKSPACE_MISMATCH");

    expect_failure(engine.record(
                       memory,
                       local,
                       Episode{"", "", "", -1, {}}),
                   "INVALID_IDENTIFIER");
    expect_failure(engine.record(
                       memory,
                       local,
                       Episode{"episode", "", "", -1, {}}),
                   "INVALID_OCCURRENCE");
    expect_failure(engine.record(
                       memory,
                       local,
                       Episode{"episode", "occurrence", "", -1, {}}),
                   "INVALID_CONTEXT");
    expect_failure(engine.record(
                       memory,
                       local,
                       Episode{"episode", "occurrence", "context", -1, {}}),
                   "INVALID_CHRONOLOGY");
    expect_failure(engine.record(
                       memory,
                       local,
                       Episode{"episode", "occurrence", "context", 0, {}}),
                   "INVALID_PROVENANCE");

    derive_ok(memory, local, "existing", "occurrence", "context", 10,
              {"source"});
    expect_failure(engine.link(memory, "existing", "other"), "NOT_FOUND");
}

TEST(EpisodicMemoryRecordTest,
     AppendFrontierIdempotenceConflictAndPayloadAreExact) {
    LongTermMemory evidence{"workspace"};
    retain(evidence, "source", "value");
    EpisodicMemory memory{"workspace"};
    EpisodicMemoryEngine engine;

    const Episode original = proposal(
        "A", "first occurrence", "context-a", 10, evidence, {"source"});
    expect_episode_success(engine.record(memory, evidence, original), "A");
    record_ok(memory, evidence, "B", "second occurrence", "context-b", 10,
              {"source"});
    record_ok(memory, evidence, "C", "third occurrence", "context-c", 12,
              {"source"});
    ASSERT_EQ(memory.episodes().size(), 3U);
    EXPECT_EQ(memory.episodes()[0].identifier(), "A");
    EXPECT_EQ(memory.episodes()[1].identifier(), "B");
    EXPECT_EQ(memory.episodes()[2].identifier(), "C");

    const auto before_earlier = snapshot_of(memory, {"A", "D"});
    expect_failure(engine.record(
                       memory,
                       evidence,
                       proposal("D",
                                "earlier",
                                "context-d",
                                11,
                                evidence,
                                {"source"})),
                   "CHRONOLOGY_VIOLATION");
    EXPECT_EQ(snapshot_of(memory, {"A", "D"}), before_earlier);

    expect_matches_success(engine.link(memory, "A", "B"), {"A", "B"});
    ASSERT_TRUE(LongTermMemoryEngine{}.archive(evidence, "source").succeeded());

    const auto idempotent = engine.record(memory, evidence, original);
    expect_episode_success(idempotent, "A");
    ASSERT_NE(idempotent.episode(), nullptr);
    EXPECT_EQ(idempotent.episode()->linkedEpisodeIdentifiers(),
              (std::vector<std::string>{"B"}));
    expect_episode_success(engine.derive(memory, evidence, original), "A");

    expect_failure(engine.record(
                       memory,
                       evidence,
                       Episode{"A",
                               "different",
                               "context-a",
                               10,
                               original.sourceEntries()}),
                   "IDENTIFIER_CONFLICT");
    expect_failure(engine.record(memory, evidence, *memory.find("A")),
                   "INVALID_EPISODE_STATE");
}

TEST(EpisodicMemoryDeriveTest,
     RetrospectivePlacementAndOverlapAreExact) {
    LongTermMemory evidence{"workspace"};
    retain(evidence, "source", "value");
    EpisodicMemory memory{"workspace"};
    EpisodicMemoryEngine engine;

    derive_ok(memory, evidence, "A", "a", "context", 20, {"source"});
    derive_ok(memory, evidence, "B", "b", "context", 10, {"source"});
    derive_ok(memory, evidence, "C", "c", "context", 20, {"source"});
    derive_ok(memory, evidence, "D", "d", "context", 15, {"source"});
    derive_ok(memory, evidence, "E", "e", "context", 20, {"source"});

    ASSERT_EQ(memory.episodes().size(), 5U);
    EXPECT_EQ(memory.episodes()[0].identifier(), "B");
    EXPECT_EQ(memory.episodes()[1].identifier(), "D");
    EXPECT_EQ(memory.episodes()[2].identifier(), "A");
    EXPECT_EQ(memory.episodes()[3].identifier(), "C");
    EXPECT_EQ(memory.episodes()[4].identifier(), "E");

    const Episode overlap = proposal(
        "F", "f", "context", 20, evidence, {"source"});
    expect_episode_success(engine.record(memory, evidence, overlap), "F");
    expect_episode_success(engine.derive(memory, evidence, overlap), "F");
    EXPECT_EQ(memory.episodes().back().identifier(), "F");
}

TEST(EpisodicMemoryChronologyTest,
     LogicalChronologyIsExplicitAndImmutable) {
    LongTermMemory evidence{"workspace"};
    retain(evidence, "source", "a value containing 9999");
    EpisodicMemory memory{"workspace"};
    EpisodicMemoryEngine engine;

    expect_failure(engine.derive(
                       memory,
                       evidence,
                       proposal("negative",
                                "occurrence",
                                "context",
                                -1,
                                evidence,
                                {"source"})),
                   "INVALID_CHRONOLOGY");
    derive_ok(memory, evidence, "zero", "occurrence 999", "context", 0,
              {"source"});
    derive_ok(memory, evidence, "declared", "occurrence", "context", 42,
              {"source"});
    expect_episode_success(
        engine.update(memory, "declared", "new occurrence", "new context"),
        "declared");
    expect_matches_success(engine.link(memory, "zero", "declared"),
                           {"zero", "declared"});
    EXPECT_EQ(memory.find("zero")->chronology(), 0);
    EXPECT_EQ(memory.find("declared")->chronology(), 42);
}

TEST(EpisodicMemoryRetrieveTest,
     ExactIndependentRetrievalDoesNotMutate) {
    LongTermMemory evidence{"workspace"};
    retain(evidence, "source", "value");
    EpisodicMemory memory{"workspace"};
    derive_ok(memory, evidence, "Episode", "occurrence", "context", 7,
              {"source"});
    const auto before = snapshot_of(memory, {"Episode"});
    EpisodicMemoryEngine engine;

    expect_failure(engine.retrieve(memory, ""), "INVALID_IDENTIFIER");
    expect_failure(engine.retrieve(memory, "episode"), "NOT_FOUND");
    auto result = engine.retrieve(memory, "Episode");
    expect_episode_success(result, "Episode");
    ASSERT_NE(result.episode(), nullptr);
    EXPECT_EQ(snapshot_of(*result.episode()),
              snapshot_of(*memory.find("Episode")));
    EXPECT_EQ(snapshot_of(memory, {"Episode"}), before);

    expect_episode_success(
        engine.update(memory, "Episode", "changed", "changed context"),
        "Episode");
    EXPECT_EQ(result.episode()->occurrence(), "occurrence");
}

TEST(EpisodicMemorySearchTest,
     SearchesOnlySpecifiedFieldsInCanonicalOrder) {
    LongTermMemory evidence{"workspace"};
    retain(evidence, "needle-source", "needle evidence value");
    EpisodicMemory memory{"workspace"};
    derive_ok(memory, evidence, "needle-id", "first", "context", 30,
              {"needle-source"});
    derive_ok(memory, evidence, "B", "contains needle", "context", 10,
              {"needle-source"});
    derive_ok(memory, evidence, "C", "third", "needle context", 20,
              {"needle-source"});
    derive_ok(memory, evidence, "D", "Needle", "other", 40,
              {"needle-source"});
    EpisodicMemoryEngine engine;

    expect_matches_success(engine.search(memory, EpisodeQuery{"needle"}),
                           {"B", "C", "needle-id"});
    expect_matches_success(engine.search(memory, EpisodeQuery{""}),
                           {"B", "C", "needle-id", "D"});
    expect_matches_success(engine.search(memory, EpisodeQuery{"Needle"}),
                           {"D"});
    expect_matches_success(engine.search(memory, EpisodeQuery{"30"}), {});
    expect_matches_success(
        engine.search(memory, EpisodeQuery{"needle evidence value"}), {});
    expect_matches_success(engine.search(memory, EpisodeQuery{"needle-source"}),
                           {});
}

TEST(EpisodicMemoryLinkTest,
     UndirectedAtomicLinksAndPayloadOrderAreExact) {
    LongTermMemory evidence{"workspace"};
    retain(evidence, "source", "value");
    EpisodicMemory memory{"workspace"};
    derive_ok(memory, evidence, "A", "a", "context", 1, {"source"});
    derive_ok(memory, evidence, "B", "b", "context", 2, {"source"});
    derive_ok(memory, evidence, "C", "c", "context", 3, {"source"});
    EpisodicMemoryEngine engine;

    expect_failure(engine.link(memory, "", "B"), "INVALID_IDENTIFIER");
    expect_failure(engine.link(memory, "A", ""), "INVALID_IDENTIFIER");
    expect_failure(engine.link(memory, "missing", "missing"),
                   "INVALID_RELATIONSHIP");
    expect_failure(engine.link(memory, "missing", "B"), "NOT_FOUND");
    expect_failure(engine.link(memory, "A", "missing"), "NOT_FOUND");
    expect_failure(engine.link(memory, "A", "A"), "INVALID_RELATIONSHIP");

    expect_matches_success(engine.link(memory, "B", "A"), {"B", "A"});
    EXPECT_EQ(memory.find("A")->linkedEpisodeIdentifiers(),
              (std::vector<std::string>{"B"}));
    EXPECT_EQ(memory.find("B")->linkedEpisodeIdentifiers(),
              (std::vector<std::string>{"A"}));

    const auto after_first = snapshot_of(memory);
    expect_matches_success(engine.link(memory, "B", "A"), {"B", "A"});
    EXPECT_EQ(snapshot_of(memory), after_first);

    expect_matches_success(engine.link(memory, "A", "C"), {"A", "C"});
    expect_matches_success(engine.link(memory, "C", "B"), {"C", "B"});
    EXPECT_EQ(memory.find("A")->linkedEpisodeIdentifiers(),
              (std::vector<std::string>{"B", "C"}));
    EXPECT_EQ(memory.find("B")->linkedEpisodeIdentifiers(),
              (std::vector<std::string>{"A", "C"}));
    EXPECT_EQ(memory.find("C")->linkedEpisodeIdentifiers(),
              (std::vector<std::string>{"A", "B"}));
}

TEST(EpisodicMemoryUpdateTest,
     ChangesOnlyOccurrenceAndContextAndIsIdempotent) {
    LongTermMemory evidence{"workspace"};
    retain(evidence, "source-a", "alpha");
    retain(evidence, "source-b", "beta");
    EpisodicMemory memory{"workspace"};
    derive_ok(memory,
              evidence,
              "A",
              "old occurrence",
              "old context",
              17,
              {"source-b", "source-a"});
    derive_ok(memory, evidence, "B", "other", "other context", 18,
              {"source-a"});
    EpisodicMemoryEngine engine;
    expect_matches_success(engine.link(memory, "A", "B"), {"A", "B"});
    const auto before = snapshot_of(*memory.find("A"));

    expect_failure(engine.update(memory, "", "new", "new"),
                   "INVALID_IDENTIFIER");
    expect_failure(engine.update(memory, "A", "", "new"),
                   "INVALID_OCCURRENCE");
    expect_failure(engine.update(memory, "A", "new", ""),
                   "INVALID_CONTEXT");
    expect_failure(engine.update(memory, "missing", "new", "new"),
                   "NOT_FOUND");

    auto changed = engine.update(
        memory, "A", "new occurrence", "new context");
    expect_episode_success(changed, "A");
    const auto after = snapshot_of(*memory.find("A"));
    EXPECT_EQ(after.identifier, before.identifier);
    EXPECT_EQ(after.occurrence, "new occurrence");
    EXPECT_EQ(after.context, "new context");
    EXPECT_EQ(after.chronology, before.chronology);
    EXPECT_EQ(after.source_entries, before.source_entries);
    EXPECT_EQ(after.links, before.links);

    const auto state_after = snapshot_of(memory);
    expect_episode_success(engine.update(
                               memory,
                               "A",
                               "new occurrence",
                               "new context"),
                           "A");
    EXPECT_EQ(snapshot_of(memory), state_after);
}

TEST(EpisodicMemoryForgetTest,
     IsIrreversibleIdempotentOrderPreservingAndCleansLinks) {
    LongTermMemory evidence{"workspace"};
    retain(evidence, "source", "value");
    EpisodicMemory memory{"workspace"};
    derive_ok(memory, evidence, "A", "a", "context", 10, {"source"});
    derive_ok(memory, evidence, "B", "b", "context", 10, {"source"});
    derive_ok(memory, evidence, "C", "c", "context", 20, {"source"});
    derive_ok(memory, evidence, "D", "d", "context", 30, {"source"});
    EpisodicMemoryEngine engine;
    expect_matches_success(engine.link(memory, "A", "B"), {"A", "B"});
    expect_matches_success(engine.link(memory, "B", "C"), {"B", "C"});
    expect_matches_success(engine.link(memory, "B", "D"), {"B", "D"});
    expect_matches_success(engine.link(memory, "A", "D"), {"A", "D"});

    expect_failure(engine.forget(memory, ""), "INVALID_IDENTIFIER");
    expect_no_payload_success(engine.forget(memory, "B"));
    EXPECT_EQ(memory.size(), 3U);
    EXPECT_EQ(memory.episodes()[0].identifier(), "A");
    EXPECT_EQ(memory.episodes()[1].identifier(), "C");
    EXPECT_EQ(memory.episodes()[2].identifier(), "D");
    EXPECT_EQ(memory.find("A")->linkedEpisodeIdentifiers(),
              (std::vector<std::string>{"D"}));
    EXPECT_TRUE(memory.find("C")->linkedEpisodeIdentifiers().empty());
    EXPECT_EQ(memory.find("D")->linkedEpisodeIdentifiers(),
              (std::vector<std::string>{"A"}));
    EXPECT_EQ(episodic_disposition(memory, "B"), "FORGOTTEN");

    const auto after_forget = snapshot_of(memory, {"B", "never"});
    expect_no_payload_success(engine.forget(memory, "B"));
    expect_no_payload_success(engine.forget(memory, "never"));
    EXPECT_EQ(snapshot_of(memory, {"B", "never"}), after_forget);

    expect_failure(engine.derive(
                       memory,
                       evidence,
                       proposal("B", "again", "context", 10, evidence,
                                {"source"})),
                   "FORGOTTEN_IDENTIFIER");
    expect_episode_success(engine.derive(
                               memory,
                               evidence,
                               proposal("never",
                                        "first use",
                                        "context",
                                        5,
                                        evidence,
                                        {"source"})),
                           "never");
}

TEST(EpisodicMemorySourceTest,
     ProvenanceIsOwnedAndEvidenceRemainsAuthoritative) {
    LongTermMemory evidence{"workspace"};
    retain(evidence, "source-a", "original-a");
    retain(evidence, "source-b", "original-b");
    EpisodicMemory memory{"workspace"};
    derive_ok(memory,
              evidence,
              "episode",
              "occurrence",
              "context",
              1,
              {"source-b", "source-a"});
    const auto provenance_before =
        snapshot_entries(memory.find("episode")->sourceEntries());

    ASSERT_TRUE(LongTermMemoryEngine{}
                    .store(evidence,
                           LongTermMemoryEntry{"source-a", "changed-a"})
                    .succeeded());
    ASSERT_TRUE(LongTermMemoryEngine{}.archive(evidence, "source-b").succeeded());
    EXPECT_EQ(snapshot_entries(memory.find("episode")->sourceEntries()),
              provenance_before);

    expect_episode_success(EpisodicMemoryEngine{}.update(
                               memory,
                               "episode",
                               "updated",
                               "updated context"),
                           "episode");
    EXPECT_EQ(require_entry(evidence, "source-a").value(), "changed-a");
    EXPECT_TRUE(require_entry(evidence, "source-b").archived());

    ASSERT_TRUE(LongTermMemoryEngine{}.forget(evidence, "source-b").succeeded());
    expect_no_payload_success(
        EpisodicMemoryEngine{}.forget(memory, "episode"));
    EXPECT_EQ(long_term_disposition(evidence, "source-a"), "LONG_TERM");
    EXPECT_EQ(long_term_disposition(evidence, "source-b"), "FORGOTTEN");
}

TEST(EpisodicMemoryOrderingTest, AllObservableOrdersAreDeterministic) {
    LongTermMemory evidence{"workspace"};
    retain(evidence, "one", "1");
    retain(evidence, "two", "2");
    retain(evidence, "three", "3");
    EpisodicMemory memory{"workspace"};
    derive_ok(memory, evidence, "late-a", "match", "c", 30,
              {"three", "one", "two"});
    derive_ok(memory, evidence, "early", "match", "c", 10, {"one"});
    derive_ok(memory, evidence, "late-b", "match", "c", 30, {"two"});
    derive_ok(memory, evidence, "middle", "match", "c", 20, {"one"});
    EpisodicMemoryEngine engine;
    expect_matches_success(engine.link(memory, "late-a", "early"),
                           {"late-a", "early"});
    expect_matches_success(engine.link(memory, "late-a", "middle"),
                           {"late-a", "middle"});
    expect_matches_success(engine.link(memory, "late-a", "late-b"),
                           {"late-a", "late-b"});

    expect_matches_success(engine.search(memory, EpisodeQuery{"match"}),
                           {"early", "middle", "late-a", "late-b"});
    EXPECT_EQ(memory.find("late-a")->sourceEntries()[0].identifier(), "three");
    EXPECT_EQ(memory.find("late-a")->sourceEntries()[1].identifier(), "one");
    EXPECT_EQ(memory.find("late-a")->sourceEntries()[2].identifier(), "two");
    EXPECT_EQ(memory.find("late-a")->linkedEpisodeIdentifiers(),
              (std::vector<std::string>{"early", "middle", "late-b"}));

    expect_no_payload_success(engine.forget(memory, "middle"));
    expect_matches_success(engine.search(memory, EpisodeQuery{"match"}),
                           {"early", "late-a", "late-b"});
    EXPECT_EQ(memory.find("late-a")->linkedEpisodeIdentifiers(),
              (std::vector<std::string>{"early", "late-b"}));
}

TEST(EpisodicMemoryPrecedenceTest, AllOperationPrecedenceIsExact) {
    LongTermMemory evidence{"workspace"};
    retain(evidence, "source-a", "alpha");
    retain(evidence, "source-b", "beta");
    EpisodicMemory memory{"workspace"};
    derive_ok(memory, evidence, "A", "a", "context", 10, {"source-a"});
    derive_ok(memory, evidence, "B", "b", "context", 20, {"source-b"});
    EpisodicMemoryEngine engine;

    expect_failure(engine.retrieve(memory, ""), "INVALID_IDENTIFIER");
    expect_failure(engine.retrieve(memory, "missing"), "NOT_FOUND");
    expect_failure(engine.link(memory, "", ""), "INVALID_IDENTIFIER");
    expect_failure(engine.link(memory, "A", ""), "INVALID_IDENTIFIER");
    expect_failure(engine.link(memory, "missing", "missing"),
                   "INVALID_RELATIONSHIP");
    expect_failure(engine.link(memory, "missing", "also-missing"),
                   "NOT_FOUND");
    expect_failure(engine.link(memory, "A", "missing"), "NOT_FOUND");
    expect_failure(engine.update(memory, "", "", ""),
                   "INVALID_IDENTIFIER");
    expect_failure(engine.update(memory, "missing", "", ""),
                   "INVALID_OCCURRENCE");
    expect_failure(engine.update(memory, "missing", "valid", ""),
                   "INVALID_CONTEXT");
    expect_failure(engine.update(memory, "missing", "valid", "valid"),
                   "NOT_FOUND");

    const auto before = snapshot_of(memory);
    expect_failure(engine.record(
                       memory,
                       evidence,
                       Episode{"new",
                               "occurrence",
                               "context",
                               5,
                               {LongTermMemoryEntry{"missing", "wrong"}}}),
                   "CHRONOLOGY_VIOLATION");
    EXPECT_EQ(snapshot_of(memory), before);

    expect_failure(engine.derive(
                       memory,
                       evidence,
                       Episode{"new",
                               "occurrence",
                               "context",
                               5,
                               {LongTermMemoryEntry{"missing", "wrong"},
                                LongTermMemoryEntry{"source-a", "wrong"}}}),
                   "SOURCE_NOT_FOUND");
}

TEST(EpisodicMemoryResultTest, CodesMessagesAndPayloadShapesAreExact) {
    LongTermMemory evidence{"workspace"};
    retain(evidence, "source", "value");
    EpisodicMemory memory{"workspace"};
    EpisodicMemoryEngine engine;

    expect_episode_success(engine.record(
                               memory,
                               evidence,
                               proposal("A", "a", "context", 1, evidence,
                                        {"source"})),
                           "A");
    expect_episode_success(engine.derive(
                               memory,
                               evidence,
                               proposal("B", "b", "context", 0, evidence,
                                        {"source"})),
                           "B");
    expect_episode_success(engine.retrieve(memory, "A"), "A");
    expect_matches_success(engine.search(memory, EpisodeQuery{""}), {"B", "A"});
    expect_matches_success(engine.link(memory, "A", "B"), {"A", "B"});
    expect_episode_success(engine.update(memory, "A", "new", "new context"),
                           "A");
    expect_no_payload_success(engine.forget(memory, "B"));

    const auto failure = engine.retrieve(memory, "missing");
    expect_failure(failure, "NOT_FOUND");
    const auto same_failure = engine.retrieve(memory, "missing");
    EXPECT_EQ(failure.code(), same_failure.code());
    EXPECT_EQ(failure.message(), same_failure.message());
}

TEST(EpisodicMemoryFailureTest,
     SemanticFailuresPreserveCompleteStateAndEvidence) {
    LongTermMemory evidence{"workspace"};
    retain(evidence, "source-a", "alpha");
    retain(evidence, "source-b", "beta");
    EpisodicMemory memory{"workspace"};
    derive_ok(memory, evidence, "A", "a", "context", 10,
              {"source-a", "source-b"});
    derive_ok(memory, evidence, "B", "b", "context", 20, {"source-b"});
    EpisodicMemoryEngine engine;
    expect_matches_success(engine.link(memory, "A", "B"), {"A", "B"});

    const auto assert_unchanged = [&](const auto& operation) {
        const auto memory_before = snapshot_of(memory, {"A", "B", "missing"});
        const auto evidence_before = snapshot_of(
            evidence, {"source-a", "source-b", "missing-source"});
        operation();
        EXPECT_EQ(snapshot_of(memory, {"A", "B", "missing"}), memory_before);
        EXPECT_EQ(snapshot_of(
                      evidence, {"source-a", "source-b", "missing-source"}),
                  evidence_before);
    };

    assert_unchanged([&] {
        expect_failure(engine.derive(
                           memory,
                           evidence,
                           Episode{"new", "", "context", 1,
                                   {require_entry(evidence, "source-a")}}),
                       "INVALID_OCCURRENCE");
    });
    assert_unchanged([&] {
        expect_failure(engine.record(
                           memory,
                           evidence,
                           proposal("new",
                                    "occurrence",
                                    "context",
                                    1,
                                    evidence,
                                    {"source-a"})),
                       "CHRONOLOGY_VIOLATION");
    });
    assert_unchanged([&] {
        expect_failure(engine.link(memory, "A", "missing"), "NOT_FOUND");
    });
    assert_unchanged([&] {
        expect_failure(engine.update(memory, "A", "", "context"),
                       "INVALID_OCCURRENCE");
    });
    assert_unchanged([&] {
        expect_failure(engine.forget(memory, ""), "INVALID_IDENTIFIER");
    });
}

TEST(EpisodicMemoryValueTest, ResultsOwnCompleteIndependentPayloads) {
    LongTermMemory evidence{"workspace"};
    retain(evidence, "source", "value");
    EpisodicMemory memory{"workspace"};
    derive_ok(memory, evidence, "A", "old", "old context", 3, {"source"});

    auto retrieved = EpisodicMemoryEngine{}.retrieve(memory, "A");
    expect_episode_success(retrieved, "A");
    const auto payload = snapshot_of(*retrieved.episode());
    expect_episode_success(EpisodicMemoryEngine{}.update(
                               memory, "A", "new", "new context"),
                           "A");
    EXPECT_EQ(snapshot_of(*retrieved.episode()), payload);

    EpisodeResult moved{std::move(retrieved)};
    EXPECT_EQ(snapshot_of(*moved.episode()), payload);
    EXPECT_FALSE(retrieved.succeeded());
    EXPECT_TRUE(retrieved.code().empty());
    EXPECT_EQ(retrieved.episode(), nullptr);
    EXPECT_TRUE(retrieved.matches().empty());
}

TEST(EpisodicMemoryIsolationTest,
     WorkspacesEnginesAndValuesDoNotShareState) {
    LongTermMemory first_evidence{"first"};
    LongTermMemory second_evidence{"second"};
    retain(first_evidence, "source", "one");
    retain(second_evidence, "source", "two");
    EpisodicMemory first{"first"};
    EpisodicMemory second{"second"};
    EpisodicMemoryEngine first_engine;
    EpisodicMemoryEngine second_engine;
    derive_ok(first, first_evidence, "episode", "first", "first context", 1,
              {"source"});
    derive_ok(second, second_evidence, "episode", "second", "second context",
              2, {"source"});
    expect_episode_success(first_engine.update(
                               first, "episode", "changed first", "context"),
                           "episode");
    expect_episode_success(second_engine.update(
                               second, "episode", "changed second", "context"),
                           "episode");
    EXPECT_EQ(first.find("episode")->occurrence(), "changed first");
    EXPECT_EQ(second.find("episode")->occurrence(), "changed second");
    EXPECT_EQ(first.find("episode")->chronology(), 1);
    EXPECT_EQ(second.find("episode")->chronology(), 2);
}

TEST(EpisodicMemoryIsolationTest,
     IndependentInstancesAndEnginesSupportConcurrency) {
    constexpr std::size_t worker_count = 6U;
    std::array<std::optional<EpisodicStateSnapshot>, worker_count> states;
    std::array<std::optional<LongTermStateSnapshot>, worker_count> sources;
    std::vector<std::thread> workers;
    workers.reserve(worker_count);
    for (std::size_t index = 0; index < worker_count; ++index) {
        workers.emplace_back([index, &states, &sources] {
            const auto workspace = "workspace-" + std::to_string(index);
            LongTermMemory evidence{workspace};
            retain(evidence, "source", "value-" + std::to_string(index));
            EpisodicMemory memory{workspace};
            EpisodicMemoryEngine engine;
            derive_ok(memory,
                      evidence,
                      "episode",
                      "occurrence",
                      "context",
                      static_cast<std::int64_t>(index),
                      {"source"});
            expect_episode_success(
                engine.update(memory,
                              "episode",
                              "updated-" + std::to_string(index),
                              "context-" + std::to_string(index)),
                "episode");
            states[index] = snapshot_of(memory);
            sources[index] = snapshot_of(evidence, {"source"});
        });
    }
    for (auto& worker : workers) {
        worker.join();
    }
    for (std::size_t index = 0; index < worker_count; ++index) {
        ASSERT_TRUE(states[index].has_value());
        ASSERT_TRUE(sources[index].has_value());
        EXPECT_EQ(states[index]->workspace_identifier,
                  "workspace-" + std::to_string(index));
        EXPECT_EQ(states[index]->episodes.front().occurrence,
                  "updated-" + std::to_string(index));
        EXPECT_EQ(sources[index]->entries.front().value,
                  "value-" + std::to_string(index));
    }
}

TEST(EpisodicMemoryRuntimeTest, RuntimeLifecyclesDoNotOwnOrMutateState) {
    LongTermMemory evidence{"workspace"};
    retain(evidence, "source", "value");
    EpisodicMemory memory{"workspace"};
    derive_ok(memory, evidence, "episode", "occurrence", "context", 7,
              {"source"});
    const auto before = snapshot_of(memory, {"episode", "absent"});
    const auto source_before = snapshot_of(evidence, {"source"});

    {
        auto runtime = cca::runtime::RuntimeBuilder{
                           cca::runtime::RuntimeId{"episodic-runtime-one"}}
                           .build();
        ASSERT_NE(runtime, nullptr);
        ASSERT_TRUE(runtime->start().ok());
        EXPECT_EQ(snapshot_of(memory, {"episode", "absent"}), before);
        ASSERT_TRUE(runtime->stop().ok());
    }
    {
        auto replacement = cca::runtime::RuntimeBuilder{
                               cca::runtime::RuntimeId{
                                   "episodic-runtime-replacement"}}
                               .build();
        ASSERT_NE(replacement, nullptr);
        ASSERT_TRUE(replacement->start().ok());
        ASSERT_TRUE(replacement->stop().ok());
    }
    EXPECT_EQ(snapshot_of(memory, {"episode", "absent"}), before);
    EXPECT_EQ(snapshot_of(evidence, {"source"}), source_before);
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

[[nodiscard]] RepresentationValue episodic_record(
    std::string identifier,
    std::string occurrence,
    std::string context,
    const std::int64_t chronology,
    std::vector<RepresentationValue> provenance,
    const std::vector<std::string>& links = {}) {
    std::vector<RepresentationValue> record;
    record.emplace_back(std::move(identifier));
    record.emplace_back(std::move(occurrence));
    record.emplace_back(std::move(context));
    record.emplace_back(chronology);
    record.emplace_back(std::move(provenance));
    record.emplace_back(strings(links));
    return RepresentationValue{std::move(record)};
}

void add_manifest(RepresentationDocument& document,
                  std::string workspace,
                  std::vector<RepresentationValue> episodes,
                  std::vector<std::string> forgotten = {},
                  const std::int64_t schema = 1) {
    auto& manifest = document.createEntity(RepresentationType{
        "cca.memory.episodic-memory.persistence.v1"});
    manifest.addProperty("schema-version",
                         RepresentationType{"cca.integer"},
                         RepresentationValue{schema});
    manifest.addProperty("workspace-identifier",
                         RepresentationType{"cca.string"},
                         RepresentationValue{std::move(workspace)});
    manifest.addProperty(
        "episodes",
        RepresentationType{"cca.memory.episodic-memory.episodes"},
        RepresentationValue{std::move(episodes)});
    manifest.addProperty(
        "forgotten-identifiers",
        RepresentationType{"cca.memory.episodic-memory.identifiers"},
        strings(forgotten));
}

[[nodiscard]] std::unique_ptr<RepresentationDocument> malformed_projection(
    std::string workspace,
    std::vector<RepresentationValue> episodes,
    std::vector<std::string> forgotten = {},
    const std::int64_t schema = 1) {
    auto document = std::make_unique<RepresentationDocument>(
        RepresentationMetadata{"CCA", "CCA-EPMEM-1.0", "malformed-test"});
    add_manifest(*document,
                 std::move(workspace),
                 std::move(episodes),
                 std::move(forgotten),
                 schema);
    const auto validation = FreezeService{}.freeze(*document);
    if (!validation.valid) {
        throw std::logic_error{"malformed Episodic test projection was not a "
                               "valid Representation document"};
    }
    return document;
}

void expect_invalid_projection(
    const std::unique_ptr<RepresentationDocument>& projection) {
    ASSERT_NE(projection, nullptr);
    EXPECT_THROW(
        static_cast<void>(
            cca::memory::detail::EpisodicMemoryPersistence::reconstruct(
                *projection)),
        std::invalid_argument);
}

TEST(EpisodicMemoryPersistenceTest,
     ProjectReconstructAndRealRoundTripAreExact) {
    LongTermMemory evidence{"persistence-workspace"};
    retain(evidence, "source-a", "alpha");
    retain(evidence, "source-b", "beta");
    EpisodicMemory source{"persistence-workspace"};
    EpisodicMemoryEngine engine;
    derive_ok(source, evidence, "A", "occurrence-a", "context-a", 10,
              {"source-b", "source-a"});
    derive_ok(source, evidence, "B", "occurrence-b", "context-b", 10,
              {"source-a"});
    derive_ok(source, evidence, "C", "occurrence-c", "context-c", 20,
              {"source-b"});
    expect_matches_success(engine.link(source, "A", "B"), {"A", "B"});
    expect_matches_success(engine.link(source, "A", "C"), {"A", "C"});
    expect_no_payload_success(engine.forget(source, "B"));
    const std::vector<std::string_view> probes{"A", "B", "C", "absent"};
    const auto before = snapshot_of(source, probes);

    auto projection =
        cca::memory::detail::EpisodicMemoryPersistence::project(source);
    ASSERT_NE(projection, nullptr);
    EXPECT_TRUE(projection->isFrozen());
    auto reconstructed =
        cca::memory::detail::EpisodicMemoryPersistence::reconstruct(
            *projection);
    EXPECT_EQ(snapshot_of(reconstructed, probes), before);

    auto round_tripped =
        cca::memory::detail::EpisodicMemoryPersistence::roundTrip(source);
    EXPECT_EQ(snapshot_of(round_tripped, probes), before);
    EXPECT_EQ(snapshot_of(source, probes), before);

    expect_episode_success(engine.update(
                               reconstructed,
                               "A",
                               "independent",
                               "independent context"),
                           "A");
    EXPECT_EQ(source.find("A")->occurrence(), "occurrence-a");

    ASSERT_TRUE(LongTermMemoryEngine{}.archive(evidence, "source-a").succeeded());
    ASSERT_TRUE(LongTermMemoryEngine{}.forget(evidence, "source-b").succeeded());
    auto without_live_sources =
        cca::memory::detail::EpisodicMemoryPersistence::roundTrip(source);
    EXPECT_EQ(snapshot_of(without_live_sources, probes), before);
}

TEST(EpisodicMemoryPersistenceTest,
     MalformedInputsAreRejectedWithoutPartialPublication) {
    const auto source = [] {
        std::vector<RepresentationValue> values;
        values.push_back(provenance_record("source", "value"));
        return values;
    };
    const auto valid_episode = [&] {
        std::vector<RepresentationValue> episodes;
        episodes.push_back(episodic_record(
            "A", "occurrence", "context", 1, source(), {}));
        return episodes;
    };

    auto absent_manifest = std::make_unique<RepresentationDocument>(
        RepresentationMetadata{"CCA", "CCA-EPMEM-1.0", "missing"});
    ASSERT_TRUE(FreezeService{}.freeze(*absent_manifest).valid);
    expect_invalid_projection(absent_manifest);

    auto duplicate_manifest = std::make_unique<RepresentationDocument>(
        RepresentationMetadata{"CCA", "CCA-EPMEM-1.0", "duplicate"});
    add_manifest(*duplicate_manifest, "workspace", valid_episode());
    add_manifest(*duplicate_manifest, "workspace", valid_episode());
    ASSERT_TRUE(FreezeService{}.freeze(*duplicate_manifest).valid);
    expect_invalid_projection(duplicate_manifest);

    expect_invalid_projection(
        malformed_projection("workspace", valid_episode(), {}, 2));
    expect_invalid_projection(malformed_projection("", valid_episode()));

    std::vector<RepresentationValue> duplicate_episodes;
    duplicate_episodes.push_back(
        episodic_record("A", "first", "context", 1, source()));
    duplicate_episodes.push_back(
        episodic_record("A", "second", "context", 2, source()));
    expect_invalid_projection(malformed_projection(
        "workspace", std::move(duplicate_episodes)));

    std::vector<RepresentationValue> empty_occurrence;
    empty_occurrence.push_back(
        episodic_record("A", "", "context", 1, source()));
    expect_invalid_projection(malformed_projection(
        "workspace", std::move(empty_occurrence)));

    std::vector<RepresentationValue> negative_chronology;
    negative_chronology.push_back(
        episodic_record("A", "occurrence", "context", -1, source()));
    expect_invalid_projection(malformed_projection(
        "workspace", std::move(negative_chronology)));

    std::vector<RepresentationValue> unsorted;
    unsorted.push_back(
        episodic_record("A", "occurrence", "context", 2, source()));
    unsorted.push_back(
        episodic_record("B", "occurrence", "context", 1, source()));
    expect_invalid_projection(
        malformed_projection("workspace", std::move(unsorted)));

    std::vector<RepresentationValue> empty_provenance;
    empty_provenance.push_back(
        episodic_record("A", "occurrence", "context", 1, {}));
    expect_invalid_projection(malformed_projection(
        "workspace", std::move(empty_provenance)));

    std::vector<RepresentationValue> self_source;
    self_source.push_back(episodic_record(
        "A", "occurrence", "context", 1,
        {provenance_record("A", "value")}));
    expect_invalid_projection(
        malformed_projection("workspace", std::move(self_source)));

    std::vector<RepresentationValue> archived_source;
    archived_source.push_back(episodic_record(
        "A", "occurrence", "context", 1,
        {provenance_record("source", "value", true)}));
    expect_invalid_projection(
        malformed_projection("workspace", std::move(archived_source)));

    std::vector<RepresentationValue> dangling_link;
    dangling_link.push_back(episodic_record(
        "A", "occurrence", "context", 1, source(), {"missing"}));
    expect_invalid_projection(
        malformed_projection("workspace", std::move(dangling_link)));

    std::vector<RepresentationValue> asymmetric_links;
    asymmetric_links.push_back(episodic_record(
        "A", "occurrence", "context", 1, source(), {"B"}));
    asymmetric_links.push_back(episodic_record(
        "B", "occurrence", "context", 2, source(), {}));
    expect_invalid_projection(
        malformed_projection("workspace", std::move(asymmetric_links)));

    expect_invalid_projection(malformed_projection(
        "workspace", valid_episode(), {"A"}));
    expect_invalid_projection(malformed_projection(
        "workspace", valid_episode(), {"forgotten", "forgotten"}));
}

TEST(EpisodicMemoryDeterminismTest,
     EquivalentSequencesProduceCompleteEquality) {
    const auto execute = [](EpisodicMemory& memory,
                            LongTermMemory& evidence) {
        EpisodicMemoryEngine engine;
        std::vector<ResultSnapshot> results;
        results.push_back(snapshot_of(engine.record(
            memory,
            evidence,
            proposal("A", "one", "context-a", 10, evidence,
                     {"second", "first"}))));
        results.push_back(snapshot_of(engine.derive(
            memory,
            evidence,
            proposal("B", "two", "context-b", 5, evidence, {"first"}))));
        results.push_back(snapshot_of(engine.derive(
            memory,
            evidence,
            proposal("C", "three", "context-c", 10, evidence, {"second"}))));
        results.push_back(snapshot_of(engine.link(memory, "B", "A")));
        results.push_back(snapshot_of(engine.retrieve(memory, "A")));
        results.push_back(snapshot_of(engine.search(memory, EpisodeQuery{"o"})));
        results.push_back(snapshot_of(
            engine.update(memory, "C", "THREE", "CONTEXT-C")));
        results.push_back(snapshot_of(engine.forget(memory, "A")));
        results.push_back(snapshot_of(engine.derive(
            memory,
            evidence,
            proposal("A", "again", "context", 1, evidence, {"first"}))));
        results.push_back(snapshot_of(engine.forget(memory, "absent")));
        return results;
    };

    LongTermMemory first_evidence{"workspace"};
    LongTermMemory second_evidence{"workspace"};
    retain(first_evidence, "first", "1");
    retain(first_evidence, "second", "2");
    retain(second_evidence, "first", "1");
    retain(second_evidence, "second", "2");
    EpisodicMemory first{"workspace"};
    EpisodicMemory second{"workspace"};
    const auto first_results = execute(first, first_evidence);
    const auto second_results = execute(second, second_evidence);
    EXPECT_EQ(first_results, second_results);
    EXPECT_EQ(snapshot_of(first, {"A", "B", "C", "absent"}),
              snapshot_of(second, {"A", "B", "C", "absent"}));
    EXPECT_EQ(snapshot_of(first_evidence, {"first", "second"}),
              snapshot_of(second_evidence, {"first", "second"}));
}

TEST(EpisodicMemoryExplicitInputTest, ValuesAreNeverInferredOrTraversed) {
    LongTermMemory evidence{"workspace"};
    retain(evidence, "evidence", "possible inferred occurrence 999");
    EpisodicMemory memory{"workspace"};
    EpisodicMemoryEngine engine;
    derive_ok(memory,
              evidence,
              "A",
              "caller occurrence",
              "caller context",
              7,
              {"evidence"});
    derive_ok(memory, evidence, "B", "other", "other context", 8,
              {"evidence"});
    derive_ok(memory, evidence, "C", "third", "third context", 9,
              {"evidence"});
    expect_matches_success(engine.link(memory, "A", "B"), {"A", "B"});
    expect_matches_success(engine.link(memory, "B", "C"), {"B", "C"});
    EXPECT_EQ(memory.find("A")->occurrence(), "caller occurrence");
    EXPECT_EQ(memory.find("A")->context(), "caller context");
    EXPECT_EQ(memory.find("A")->chronology(), 7);
    EXPECT_EQ(memory.find("A")->linkedEpisodeIdentifiers(),
              (std::vector<std::string>{"B"}));
    expect_matches_success(engine.search(memory, EpisodeQuery{"C"}), {"C"});
    expect_matches_success(
        engine.search(memory, EpisodeQuery{"possible inferred occurrence"}),
        {});
    expect_matches_success(engine.search(memory, EpisodeQuery{"999"}), {});
}

} // namespace
