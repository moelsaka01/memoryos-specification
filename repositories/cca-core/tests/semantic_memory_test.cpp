#include <cca/memory/long_term_memory.hpp>
#include <cca/memory/semantic_memory.hpp>
#include <cca/representation/representation.hpp>
#include <cca/runtime/runtime.hpp>
#include <cca/runtime/runtime_builder.hpp>
#include <cca/runtime/runtime_id.hpp>

#include "semantic_memory_persistence.hpp"

#include <gtest/gtest.h>

#include <algorithm>
#include <array>
#include <cstddef>
#include <cstdint>
#include <functional>
#include <memory>
#include <optional>
#include <set>
#include <stdexcept>
#include <string>
#include <string_view>
#include <thread>
#include <type_traits>
#include <utility>
#include <vector>

/*
CCA-SEMMEM-1.0 requirement coverage
-----------------------------------
CCA-SEMMEM-001: SemanticMemoryArchitectureTest (CTest)
CCA-SEMMEM-002: SemanticMemoryApiTest.PublicDeclarationsMatchRepairedContract
CCA-SEMMEM-003: SemanticMemoryApiTest.PublicDeclarationsMatchRepairedContract
CCA-SEMMEM-004: SemanticMemoryOwnershipTest.WorkspaceBoundaryIsRequiredAndImmutable
CCA-SEMMEM-005: SemanticMemoryIsolationTest and SemanticMemoryArchitectureTest
CCA-SEMMEM-006: SemanticMemoryObservationTest.PristineAndCanonicalObservationAreExact
CCA-SEMMEM-007: SemanticMemorySourceTest.ProvenanceIsOwnedAndEvidenceRemainsAuthoritative
CCA-SEMMEM-008: SemanticMemoryPrecedenceTest.ClassifyValidationOrderIsExact
CCA-SEMMEM-009: SemanticMemoryClassifyTest.ValidatesEveryOrderedLongTermSource
CCA-SEMMEM-010: SemanticMemoryIdentityTest.IdentityIsDurableAndForgottenIdentityIsReserved
CCA-SEMMEM-011: SemanticMemoryClassifyTest.PreservesCompleteOrderedProvenance
CCA-SEMMEM-012: SemanticMemoryOrderingTest.AllObservableOrdersAreDeterministic
CCA-SEMMEM-013: SemanticMemoryClassifyTest.AppendIdempotenceConflictAndPayloadAreExact
CCA-SEMMEM-014: SemanticMemoryCategorizeTest.AppendIdempotenceAndPreservationAreExact
CCA-SEMMEM-015: SemanticMemoryLinkTest.UndirectedAtomicLinksAndPayloadOrderAreExact
CCA-SEMMEM-016: SemanticMemoryForgetTest.RemovesAllIncidentLinksAtomically
CCA-SEMMEM-017: SemanticMemoryRetrieveTest.ExactIndependentRetrievalDoesNotMutate
CCA-SEMMEM-018: SemanticMemorySearchTest.SearchesOnlySpecifiedFieldsInCanonicalOrder
CCA-SEMMEM-019: SemanticMemoryUpdateTest.ChangesOnlyMeaningAndIsIdempotent
CCA-SEMMEM-020: SemanticMemoryForgetTest.IsIrreversibleIdempotentAndOrderPreserving
CCA-SEMMEM-021: SemanticMemoryFailureTest.SemanticFailuresPreserveCompleteStateAndEvidence
CCA-SEMMEM-022: SemanticMemorySourceTest.SourceAndConceptLifecyclesAreIndependent
CCA-SEMMEM-023: SemanticMemoryResultTest.CodesMessagesAndPayloadShapesAreExact
CCA-SEMMEM-024: SemanticMemoryPrecedenceTest.AllOperationPrecedenceIsExact
CCA-SEMMEM-025: SemanticMemoryValueTest.CopiesMovesAndResultsOwnCompleteIndependentValues
CCA-SEMMEM-026: SemanticMemoryIsolationTest.IndependentInstancesAndEnginesSupportConcurrency
CCA-SEMMEM-027: SemanticMemoryFailureTest plus dedicated allocation-failure executable
CCA-SEMMEM-028: SemanticMemoryDeterminismTest.EquivalentSequencesProduceCompleteEquality
CCA-SEMMEM-029: SemanticMemoryPersistenceTest and SemanticMemoryArchitectureTest
CCA-SEMMEM-030: SemanticMemoryPersistenceTest.ProjectReconstructAndRealRoundTripAreExact
CCA-SEMMEM-031: SemanticMemoryRuntimeTest.RuntimeLifecyclesDoNotOwnOrMutateState
CCA-SEMMEM-032: SemanticMemoryArchitectureTest (CTest)
CCA-SEMMEM-033: SemanticMemoryArchitectureTest (CTest)
CCA-SEMMEM-034: SemanticMemorySearchTest and SemanticMemoryExplicitInputTest
CCA-SEMMEM-035: SemanticMemoryArchitectureTest (CTest)
CCA-SEMMEM-036: SemanticMemoryArchitectureTest documentation/example checks
CCA-SEMMEM-037: This mapping and SemanticMemoryArchitectureTest traceability audit
CCA-SEMMEM-038: CI warnings-as-errors build and architecture gate
*/

namespace {

using cca::memory::LongTermMemory;
using cca::memory::LongTermMemoryEngine;
using cca::memory::LongTermMemoryEntry;
using cca::memory::SemanticConcept;
using cca::memory::SemanticMemory;
using cca::memory::SemanticMemoryEngine;
using cca::memory::SemanticQuery;
using cca::memory::SemanticResult;
using cca::representation::FreezeService;
using cca::representation::RepresentationDocument;
using cca::representation::RepresentationEntity;
using cca::representation::RepresentationMetadata;
using cca::representation::RepresentationType;
using cca::representation::RepresentationValue;

struct EntrySnapshot final {
    std::string identifier;
    std::string value;
    bool archived;

    bool operator==(const EntrySnapshot&) const = default;
};

struct ConceptSnapshot final {
    std::string identifier;
    std::string meaning;
    std::vector<EntrySnapshot> source_entries;
    std::vector<std::string> categories;
    std::vector<std::string> links;

    bool operator==(const ConceptSnapshot&) const = default;
};

struct IdentifierSnapshot final {
    std::string identifier;
    std::string disposition;

    bool operator==(const IdentifierSnapshot&) const = default;
};

struct SemanticStateSnapshot final {
    std::string workspace_identifier;
    std::vector<ConceptSnapshot> concepts;
    std::vector<IdentifierSnapshot> identifiers;

    bool operator==(const SemanticStateSnapshot&) const = default;
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
    std::optional<ConceptSnapshot> semantic_concept;
    std::vector<ConceptSnapshot> matches;

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

[[nodiscard]] ConceptSnapshot snapshot_of(const SemanticConcept& value) {
    return {value.identifier(),
            value.meaning(),
            snapshot_entries(value.sourceEntries()),
            value.categories(),
            value.linkedConceptIdentifiers()};
}

[[nodiscard]] std::vector<ConceptSnapshot> snapshot_concepts(
    const std::vector<SemanticConcept>& concepts) {
    std::vector<ConceptSnapshot> result;
    result.reserve(concepts.size());
    for (const auto& semantic_concept : concepts) {
        result.push_back(snapshot_of(semantic_concept));
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

[[nodiscard]] SemanticConcept proposal(
    std::string identifier,
    std::string meaning,
    const LongTermMemory& evidence,
    const std::vector<std::string_view>& sources) {
    std::vector<LongTermMemoryEntry> snapshots;
    snapshots.reserve(sources.size());
    for (const auto source : sources) {
        snapshots.push_back(require_entry(evidence, source));
    }
    return SemanticConcept{std::move(identifier),
                           std::move(meaning),
                           std::move(snapshots)};
}

void classify_ok(SemanticMemory& memory,
                 const LongTermMemory& evidence,
                 std::string identifier,
                 std::string meaning,
                 const std::vector<std::string_view>& sources) {
    const auto result = SemanticMemoryEngine{}.classify(
        memory,
        evidence,
        proposal(std::move(identifier),
                 std::move(meaning),
                 evidence,
                 sources));
    ASSERT_TRUE(result.succeeded()) << result.code() << ": "
                                    << result.message();
}

[[nodiscard]] std::string semantic_disposition(
    const SemanticMemory& memory,
    const std::string_view identifier) {
    if (memory.find(identifier) != nullptr) {
        return "ACCESSIBLE";
    }

    constexpr std::string_view probe_source{
        "__semantic-memory-history-probe-source__"};
    LongTermMemory evidence{memory.workspaceIdentifier()};
    retain(evidence, std::string{probe_source}, "probe-source-value");
    SemanticMemory copy{memory};
    const auto result = SemanticMemoryEngine{}.classify(
        copy,
        evidence,
        proposal(std::string{identifier},
                 "probe-meaning",
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

[[nodiscard]] SemanticStateSnapshot snapshot_of(
    const SemanticMemory& memory,
    const std::vector<std::string_view>& identifier_probes = {}) {
    std::vector<IdentifierSnapshot> identifiers;
    identifiers.reserve(identifier_probes.size());
    for (const auto identifier : identifier_probes) {
        identifiers.push_back({std::string{identifier},
                               semantic_disposition(memory, identifier)});
    }
    return {memory.workspaceIdentifier(),
            snapshot_concepts(memory.concepts()),
            std::move(identifiers)};
}

[[nodiscard]] LongTermStateSnapshot snapshot_of(
    const LongTermMemory& memory,
    const std::vector<std::string_view>& identifier_probes) {
    std::vector<IdentifierSnapshot> identifiers;
    identifiers.reserve(identifier_probes.size());
    for (const auto identifier : identifier_probes) {
        identifiers.push_back({std::string{identifier},
                               long_term_disposition(memory, identifier)});
    }
    return {memory.workspaceIdentifier(),
            snapshot_entries(memory.entries()),
            std::move(identifiers)};
}

[[nodiscard]] ResultSnapshot snapshot_of(const SemanticResult& result) {
    std::optional<ConceptSnapshot> semantic_concept;
    if (result.semanticConcept() != nullptr) {
        semantic_concept = snapshot_of(*result.semanticConcept());
    }
    return {result.succeeded(),
            result.code(),
            result.message(),
            std::move(semantic_concept),
            snapshot_concepts(result.matches())};
}

void expect_concept_success(const SemanticResult& result,
                            const std::string_view identifier) {
    ASSERT_TRUE(result.succeeded()) << result.code() << ": "
                                    << result.message();
    EXPECT_EQ(result.code(), "OK");
    EXPECT_TRUE(result.message().empty());
    ASSERT_NE(result.semanticConcept(), nullptr);
    EXPECT_EQ(result.semanticConcept()->identifier(), identifier);
    EXPECT_TRUE(result.matches().empty());
}

void expect_matches_success(const SemanticResult& result,
                            const std::vector<std::string_view>& identifiers) {
    ASSERT_TRUE(result.succeeded()) << result.code() << ": "
                                    << result.message();
    EXPECT_EQ(result.code(), "OK");
    EXPECT_TRUE(result.message().empty());
    EXPECT_EQ(result.semanticConcept(), nullptr);
    ASSERT_EQ(result.matches().size(), identifiers.size());
    for (std::size_t index = 0; index < identifiers.size(); ++index) {
        EXPECT_EQ(result.matches()[index].identifier(), identifiers[index]);
    }
}

void expect_no_payload_success(const SemanticResult& result) {
    ASSERT_TRUE(result.succeeded()) << result.code() << ": "
                                    << result.message();
    EXPECT_EQ(result.code(), "OK");
    EXPECT_TRUE(result.message().empty());
    EXPECT_EQ(result.semanticConcept(), nullptr);
    EXPECT_TRUE(result.matches().empty());
}

void expect_failure(const SemanticResult& result,
                    const std::string_view code) {
    EXPECT_FALSE(result.succeeded());
    EXPECT_EQ(result.code(), code);
    EXPECT_FALSE(result.message().empty());
    EXPECT_EQ(result.semanticConcept(), nullptr);
    EXPECT_TRUE(result.matches().empty());
}

TEST(SemanticMemoryApiTest, PublicDeclarationsMatchRepairedContract) {
    static_assert(std::is_constructible_v<SemanticConcept,
                                          std::string,
                                          std::string,
                                          std::vector<LongTermMemoryEntry>>);
    static_assert(std::is_copy_constructible_v<SemanticConcept>);
    static_assert(std::is_copy_assignable_v<SemanticConcept>);
    static_assert(std::is_nothrow_move_constructible_v<SemanticConcept>);
    static_assert(std::is_nothrow_move_assignable_v<SemanticConcept>);
    static_assert(std::is_constructible_v<SemanticQuery, std::string>);
    static_assert(!std::is_convertible_v<std::string, SemanticQuery>);
    static_assert(std::is_constructible_v<SemanticMemory, std::string>);
    static_assert(std::is_copy_constructible_v<SemanticMemory>);
    static_assert(!std::is_copy_assignable_v<SemanticMemory>);
    static_assert(std::is_nothrow_move_constructible_v<SemanticMemory>);
    static_assert(!std::is_move_assignable_v<SemanticMemory>);
    static_assert(!std::is_default_constructible_v<SemanticResult>);
    static_assert(std::is_nothrow_move_constructible_v<SemanticResult>);
    static_assert(std::is_nothrow_move_assignable_v<SemanticResult>);
    static_assert(!std::is_copy_constructible_v<SemanticResult>);
    static_assert(!std::is_copy_assignable_v<SemanticResult>);
    static_assert(std::is_empty_v<SemanticMemoryEngine>);

    using ConceptString = const std::string& (SemanticConcept::*)()
        const noexcept;
    using SourceEntries = const std::vector<LongTermMemoryEntry>& (
        SemanticConcept::*)() const noexcept;
    using StringSequence = const std::vector<std::string>& (
        SemanticConcept::*)() const noexcept;
    using QueryText = const std::string& (SemanticQuery::*)() const noexcept;
    using Workspace = const std::string& (SemanticMemory::*)() const noexcept;
    using Size = std::size_t (SemanticMemory::*)() const noexcept;
    using Find = const SemanticConcept* (SemanticMemory::*)(
        std::string_view) const noexcept;
    using Concepts = const std::vector<SemanticConcept>& (
        SemanticMemory::*)() const noexcept;
    using Succeeded = bool (SemanticResult::*)() const noexcept;
    using ResultString = const std::string& (SemanticResult::*)()
        const noexcept;
    using SemanticConceptPayload = const SemanticConcept* (
        SemanticResult::*)() const noexcept;
    using Matches = const std::vector<SemanticConcept>& (
        SemanticResult::*)() const noexcept;

    static_assert(std::is_same_v<decltype(static_cast<ConceptString>(
                                     &SemanticConcept::identifier)),
                                 ConceptString>);
    static_assert(std::is_same_v<decltype(static_cast<ConceptString>(
                                     &SemanticConcept::meaning)),
                                 ConceptString>);
    static_assert(std::is_same_v<decltype(static_cast<SourceEntries>(
                                     &SemanticConcept::sourceEntries)),
                                 SourceEntries>);
    static_assert(std::is_same_v<decltype(static_cast<StringSequence>(
                                     &SemanticConcept::categories)),
                                 StringSequence>);
    static_assert(std::is_same_v<decltype(static_cast<StringSequence>(
                                     &SemanticConcept::linkedConceptIdentifiers)),
                                 StringSequence>);
    static_assert(std::is_same_v<decltype(static_cast<QueryText>(
                                     &SemanticQuery::text)),
                                 QueryText>);
    static_assert(std::is_same_v<decltype(static_cast<Workspace>(
                                     &SemanticMemory::workspaceIdentifier)),
                                 Workspace>);
    static_assert(std::is_same_v<decltype(static_cast<Size>(
                                     &SemanticMemory::size)),
                                 Size>);
    static_assert(std::is_same_v<decltype(static_cast<Find>(
                                     &SemanticMemory::find)),
                                 Find>);
    static_assert(std::is_same_v<decltype(static_cast<Concepts>(
                                     &SemanticMemory::concepts)),
                                 Concepts>);
    static_assert(std::is_same_v<decltype(static_cast<Succeeded>(
                                     &SemanticResult::succeeded)),
                                 Succeeded>);
    static_assert(std::is_same_v<decltype(static_cast<ResultString>(
                                     &SemanticResult::code)),
                                 ResultString>);
    static_assert(std::is_same_v<decltype(static_cast<ResultString>(
                                     &SemanticResult::message)),
                                 ResultString>);
    static_assert(std::is_same_v<decltype(static_cast<SemanticConceptPayload>(
                                     &SemanticResult::semanticConcept)),
                                 SemanticConceptPayload>);
    static_assert(std::is_same_v<decltype(static_cast<Matches>(
                                     &SemanticResult::matches)),
                                 Matches>);

    using Classify = SemanticResult (SemanticMemoryEngine::*)(
        SemanticMemory&, const LongTermMemory&, SemanticConcept) const;
    using Categorize = SemanticResult (SemanticMemoryEngine::*)(
        SemanticMemory&, std::string_view, std::string) const;
    using Link = SemanticResult (SemanticMemoryEngine::*)(
        SemanticMemory&, std::string_view, std::string_view) const;
    using Retrieve = SemanticResult (SemanticMemoryEngine::*)(
        const SemanticMemory&, std::string_view) const;
    using Search = SemanticResult (SemanticMemoryEngine::*)(
        const SemanticMemory&, const SemanticQuery&) const;
    using Update = SemanticResult (SemanticMemoryEngine::*)(
        SemanticMemory&, std::string_view, std::string) const;
    using Forget = SemanticResult (SemanticMemoryEngine::*)(
        SemanticMemory&, std::string_view) const;

    static_assert(std::is_same_v<decltype(static_cast<Classify>(
                                     &SemanticMemoryEngine::classify)),
                                 Classify>);
    static_assert(std::is_same_v<decltype(static_cast<Categorize>(
                                     &SemanticMemoryEngine::categorize)),
                                 Categorize>);
    static_assert(std::is_same_v<decltype(static_cast<Link>(
                                     &SemanticMemoryEngine::link)),
                                 Link>);
    static_assert(std::is_same_v<decltype(static_cast<Retrieve>(
                                     &SemanticMemoryEngine::retrieve)),
                                 Retrieve>);
    static_assert(std::is_same_v<decltype(static_cast<Search>(
                                     &SemanticMemoryEngine::search)),
                                 Search>);
    static_assert(std::is_same_v<decltype(static_cast<Update>(
                                     &SemanticMemoryEngine::update)),
                                 Update>);
    static_assert(std::is_same_v<decltype(static_cast<Forget>(
                                     &SemanticMemoryEngine::forget)),
                                 Forget>);
}

TEST(SemanticMemoryOwnershipTest, WorkspaceBoundaryIsRequiredAndImmutable) {
    EXPECT_THROW(static_cast<void>(SemanticMemory{""}), std::invalid_argument);
    SemanticMemory memory{"Workspace-A"};
    EXPECT_EQ(memory.workspaceIdentifier(), "Workspace-A");
    EXPECT_EQ(memory.size(), 0U);
    EXPECT_TRUE(memory.concepts().empty());
    EXPECT_EQ(memory.find("anything"), nullptr);
}

TEST(SemanticMemoryObservationTest, PristineAndCanonicalObservationAreExact) {
    LongTermMemory evidence{"workspace"};
    retain(evidence, "source-1", "one");
    retain(evidence, "source-2", "two");
    SemanticMemory memory{"workspace"};
    classify_ok(memory, evidence, "Beta", "second", {"source-2"});
    const auto* stable_pointer = memory.find("Beta");
    ASSERT_NE(stable_pointer, nullptr);
    EXPECT_EQ(stable_pointer->meaning(), "second");
    EXPECT_EQ(memory.find("beta"), nullptr);
    EXPECT_EQ(memory.size(), 1U);
    EXPECT_EQ(memory.concepts().front().identifier(), "Beta");

    const auto observation = snapshot_of(memory);
    EXPECT_EQ(snapshot_of(memory), observation);
    classify_ok(memory, evidence, "Alpha", "first", {"source-1"});
    ASSERT_EQ(memory.concepts().size(), 2U);
    EXPECT_EQ(memory.concepts()[0].identifier(), "Beta");
    EXPECT_EQ(memory.concepts()[1].identifier(), "Alpha");
}

TEST(SemanticMemoryValueTest, ConceptsQueriesCopiesAndMovesOwnValues) {
    LongTermMemory evidence{"workspace"};
    retain(evidence, "source", "value");
    SemanticConcept detached = proposal(
        "concept-id", "meaning", evidence, {"source"});
    SemanticConcept copied{detached};
    EXPECT_EQ(snapshot_of(copied), snapshot_of(detached));
    SemanticConcept assigned{"other", "other", {require_entry(evidence,
                                                                 "source")}};
    assigned = detached;
    EXPECT_EQ(snapshot_of(assigned), snapshot_of(detached));

    SemanticConcept moved{std::move(copied)};
    EXPECT_EQ(moved.identifier(), "concept-id");
    EXPECT_TRUE(copied.identifier().empty());
    EXPECT_TRUE(copied.meaning().empty());
    EXPECT_TRUE(copied.sourceEntries().empty());
    EXPECT_TRUE(copied.categories().empty());
    EXPECT_TRUE(copied.linkedConceptIdentifiers().empty());

    SemanticConcept move_assigned{"temporary", "temporary",
                                  {require_entry(evidence, "source")}};
    move_assigned = std::move(assigned);
    EXPECT_EQ(move_assigned.identifier(), "concept-id");
    EXPECT_TRUE(assigned.identifier().empty());
    EXPECT_TRUE(assigned.sourceEntries().empty());

    SemanticQuery query{"Owned query"};
    EXPECT_EQ(query.text(), "Owned query");

    SemanticMemory memory{"workspace"};
    classify_ok(memory, evidence, "concept-id", "meaning", {"source"});
    SemanticMemory independent{memory};
    expect_concept_success(
        SemanticMemoryEngine{}.update(independent, "concept-id", "changed"),
        "concept-id");
    EXPECT_EQ(memory.find("concept-id")->meaning(), "meaning");

    const auto before_move = snapshot_of(independent, {"concept-id"});
    SemanticMemory moved_memory{std::move(independent)};
    EXPECT_EQ(snapshot_of(moved_memory, {"concept-id"}), before_move);
    EXPECT_EQ(independent.workspaceIdentifier(), "workspace");
    EXPECT_TRUE(independent.concepts().empty());
    EXPECT_EQ(semantic_disposition(independent, "concept-id"), "ABSENT");
}

TEST(SemanticMemoryClassifyTest, ValidatesEveryOrderedLongTermSource) {
    LongTermMemory evidence{"workspace"};
    retain(evidence, "source-a", "alpha evidence");
    retain(evidence, "source-b", "beta evidence");
    retain(evidence, "source-c", "gamma evidence");
    SemanticMemory memory{"workspace"};
    SemanticMemoryEngine engine;

    expect_failure(engine.classify(
                       memory,
                       evidence,
                       SemanticConcept{"none", "meaning", {}}),
                   "INVALID_PROVENANCE");
    expect_failure(engine.classify(
                       memory,
                       evidence,
                       SemanticConcept{"empty-source",
                                       "meaning",
                                       {LongTermMemoryEntry{"", "value"}}}),
                   "INVALID_PROVENANCE");
    expect_failure(engine.classify(
                       memory,
                       evidence,
                       SemanticConcept{
                           "duplicate-source",
                           "meaning",
                           {require_entry(evidence, "source-a"),
                            require_entry(evidence, "source-a")}}),
                   "INVALID_PROVENANCE");
    expect_failure(engine.classify(
                       memory,
                       evidence,
                       SemanticConcept{"source-a",
                                       "meaning",
                                       {require_entry(evidence, "source-a")}}),
                   "INVALID_PROVENANCE");
    expect_failure(engine.classify(
                       memory,
                       evidence,
                       SemanticConcept{"missing-source",
                                       "meaning",
                                       {LongTermMemoryEntry{"absent", "value"}}}),
                   "SOURCE_NOT_FOUND");
    expect_failure(engine.classify(
                       memory,
                       evidence,
                       SemanticConcept{"mismatch",
                                       "meaning",
                                       {LongTermMemoryEntry{"source-a",
                                                            "not alpha"}}}),
                   "SOURCE_MISMATCH");

    LongTermMemory archived{"workspace"};
    retain(archived, "archived-source", "historical");
    ASSERT_TRUE(LongTermMemoryEngine{}
                    .archive(archived, "archived-source")
                    .succeeded());
    expect_failure(engine.classify(
                       memory,
                       archived,
                       proposal("archived-snapshot",
                                "meaning",
                                archived,
                                {"archived-source"})),
                   "SOURCE_NOT_LONG_TERM");

    // Structural validation completes for every snapshot before current
    // evidence lookup, and current sources are then checked in caller order.
    expect_failure(engine.classify(
                       memory,
                       archived,
                       SemanticConcept{
                           "structural-order",
                           "meaning",
                           {LongTermMemoryEntry{"", "invalid first"},
                            require_entry(archived, "archived-source")}}),
                   "INVALID_PROVENANCE");

    LongTermMemory lookup_order{"workspace"};
    retain(lookup_order, "active", "active value");
    retain(lookup_order, "archived", "archived value");
    ASSERT_TRUE(LongTermMemoryEngine{}
                    .archive(lookup_order, "archived")
                    .succeeded());
    expect_failure(engine.classify(
                       memory,
                       lookup_order,
                       SemanticConcept{
                           "presence-first",
                           "meaning",
                           {LongTermMemoryEntry{"missing", "value"},
                            LongTermMemoryEntry{"archived", "archived value"}}}),
                   "SOURCE_NOT_FOUND");
    expect_failure(engine.classify(
                       memory,
                       lookup_order,
                       SemanticConcept{
                           "state-first",
                           "meaning",
                           {LongTermMemoryEntry{"archived", "archived value"},
                            LongTermMemoryEntry{"active", "wrong"}}}),
                   "SOURCE_NOT_LONG_TERM");
    expect_failure(engine.classify(
                       memory,
                       lookup_order,
                       SemanticConcept{
                           "value-first",
                           "meaning",
                           {LongTermMemoryEntry{"active", "wrong"},
                            LongTermMemoryEntry{"missing", "value"}}}),
                   "SOURCE_MISMATCH");

    const auto result = engine.classify(
        memory,
        evidence,
        proposal("ordered", "explicit meaning", evidence,
                 {"source-c", "source-a", "source-b"}));
    expect_concept_success(result, "ordered");
    ASSERT_NE(result.semanticConcept(), nullptr);
    EXPECT_EQ(snapshot_entries(result.semanticConcept()->sourceEntries()),
              (std::vector<EntrySnapshot>{{"source-c", "gamma evidence", false},
                                          {"source-a", "alpha evidence", false},
                                          {"source-b", "beta evidence", false}}));
    EXPECT_TRUE(result.semanticConcept()->categories().empty());
    EXPECT_TRUE(result.semanticConcept()->linkedConceptIdentifiers().empty());
}

TEST(SemanticMemoryClassifyTest,
     AppendIdempotenceConflictAndPayloadAreExact) {
    LongTermMemory evidence{"workspace"};
    retain(evidence, "source", "original evidence");
    SemanticMemory memory{"workspace"};
    SemanticMemoryEngine engine;
    const SemanticConcept pristine =
        proposal("concept", "meaning", evidence, {"source"});

    const auto first = engine.classify(memory, evidence, pristine);
    expect_concept_success(first, "concept");
    ASSERT_EQ(memory.size(), 1U);
    EXPECT_EQ(snapshot_of(*first.semanticConcept()),
              snapshot_of(memory.concepts().front()));

    expect_concept_success(
        engine.categorize(memory, "concept", "category"), "concept");
    const auto before_idempotence = snapshot_of(memory);
    const auto repeated = engine.classify(memory, evidence, pristine);
    expect_concept_success(repeated, "concept");
    EXPECT_EQ(snapshot_of(memory), before_idempotence);
    ASSERT_NE(repeated.semanticConcept(), nullptr);
    EXPECT_EQ(repeated.semanticConcept()->categories(),
              (std::vector<std::string>{"category"}));

    expect_failure(engine.classify(
                       memory,
                       evidence,
                       proposal("concept", "different", evidence, {"source"})),
                   "IDENTIFIER_CONFLICT");
    expect_failure(engine.classify(memory, evidence,
                                   *memory.find("concept")),
                   "INVALID_CONCEPT_STATE");
    EXPECT_EQ(memory.size(), 1U);
}

TEST(SemanticMemoryPrecedenceTest, ClassifyValidationOrderIsExact) {
    LongTermMemory evidence{"workspace"};
    retain(evidence, "source", "value");
    LongTermMemory other_workspace{"other"};
    retain(other_workspace, "source", "value");
    SemanticMemory memory{"workspace"};
    SemanticMemoryEngine engine;

    expect_failure(engine.classify(
                       memory,
                       other_workspace,
                       SemanticConcept{"", "", {}}),
                   "WORKSPACE_MISMATCH");
    expect_failure(engine.classify(
                       memory,
                       evidence,
                       SemanticConcept{"", "", {}}),
                   "INVALID_IDENTIFIER");
    expect_failure(engine.classify(
                       memory,
                       evidence,
                       SemanticConcept{"candidate", "", {}}),
                   "INVALID_MEANING");
    expect_failure(engine.classify(
                       memory,
                       evidence,
                       SemanticConcept{"candidate", "meaning", {}}),
                   "INVALID_PROVENANCE");

    classify_ok(memory, evidence, "decorated", "meaning", {"source"});
    expect_concept_success(engine.categorize(memory, "decorated", "label"),
                           "decorated");
    SemanticConcept decorated{*memory.find("decorated")};
    expect_no_payload_success(engine.forget(memory, "decorated"));
    expect_failure(engine.classify(memory, evidence, decorated),
                   "INVALID_CONCEPT_STATE");
    expect_failure(engine.classify(
                       memory,
                       evidence,
                       proposal("decorated", "meaning", evidence, {"source"})),
                   "FORGOTTEN_IDENTIFIER");

    classify_ok(memory, evidence, "conflict", "meaning", {"source"});
    ASSERT_TRUE(LongTermMemoryEngine{}.forget(evidence, "source").succeeded());
    expect_failure(engine.classify(
                       memory,
                       evidence,
                       SemanticConcept{"conflict",
                                       "different",
                                       {LongTermMemoryEntry{"source", "value"}}}),
                   "IDENTIFIER_CONFLICT");
    expect_concept_success(engine.classify(
                               memory,
                               evidence,
                               SemanticConcept{
                                   "conflict",
                                   "meaning",
                                   {LongTermMemoryEntry{"source", "value"}}}),
                           "conflict");
}

TEST(SemanticMemoryCategorizeTest,
     AppendIdempotenceAndPreservationAreExact) {
    LongTermMemory evidence{"workspace"};
    retain(evidence, "source", "value");
    SemanticMemory memory{"workspace"};
    classify_ok(memory, evidence, "concept", "meaning", {"source"});
    SemanticMemoryEngine engine;
    const auto original = snapshot_of(*memory.find("concept"));

    expect_concept_success(engine.categorize(memory, "concept", "Beta"),
                           "concept");
    expect_concept_success(engine.categorize(memory, "concept", "Alpha"),
                           "concept");
    const auto before_repeat = snapshot_of(memory);
    const auto repeated = engine.categorize(memory, "concept", "Beta");
    expect_concept_success(repeated, "concept");
    EXPECT_EQ(snapshot_of(memory), before_repeat);
    ASSERT_NE(repeated.semanticConcept(), nullptr);
    EXPECT_EQ(repeated.semanticConcept()->categories(),
              (std::vector<std::string>{"Beta", "Alpha"}));
    EXPECT_EQ(repeated.semanticConcept()->identifier(), original.identifier);
    EXPECT_EQ(repeated.semanticConcept()->meaning(), original.meaning);
    EXPECT_EQ(snapshot_entries(repeated.semanticConcept()->sourceEntries()),
              original.source_entries);

    expect_failure(engine.categorize(memory, "", ""),
                   "INVALID_IDENTIFIER");
    expect_failure(engine.categorize(memory, "absent", ""),
                   "INVALID_CATEGORY");
    expect_failure(engine.categorize(memory, "absent", "valid"),
                   "NOT_FOUND");
    expect_concept_success(engine.categorize(memory, "concept", "beta"),
                           "concept");
    EXPECT_EQ(memory.find("concept")->categories(),
              (std::vector<std::string>{"Beta", "Alpha", "beta"}));
}

TEST(SemanticMemoryLinkTest,
     UndirectedAtomicLinksAndPayloadOrderAreExact) {
    LongTermMemory evidence{"workspace"};
    retain(evidence, "source", "value");
    SemanticMemory memory{"workspace"};
    classify_ok(memory, evidence, "A", "one", {"source"});
    classify_ok(memory, evidence, "B", "two", {"source"});
    classify_ok(memory, evidence, "C", "three", {"source"});
    SemanticMemoryEngine engine;

    expect_matches_success(engine.link(memory, "B", "A"), {"B", "A"});
    EXPECT_EQ(memory.find("A")->linkedConceptIdentifiers(),
              (std::vector<std::string>{"B"}));
    EXPECT_EQ(memory.find("B")->linkedConceptIdentifiers(),
              (std::vector<std::string>{"A"}));
    const auto before_repeat = snapshot_of(memory);
    expect_matches_success(engine.link(memory, "B", "A"), {"B", "A"});
    EXPECT_EQ(snapshot_of(memory), before_repeat);

    expect_matches_success(engine.link(memory, "A", "C"), {"A", "C"});
    expect_matches_success(engine.link(memory, "C", "B"), {"C", "B"});
    EXPECT_EQ(memory.find("A")->linkedConceptIdentifiers(),
              (std::vector<std::string>{"B", "C"}));
    EXPECT_EQ(memory.find("B")->linkedConceptIdentifiers(),
              (std::vector<std::string>{"A", "C"}));
    EXPECT_EQ(memory.find("C")->linkedConceptIdentifiers(),
              (std::vector<std::string>{"A", "B"}));

    expect_failure(engine.link(memory, "", ""), "INVALID_IDENTIFIER");
    expect_failure(engine.link(memory, "A", ""), "INVALID_IDENTIFIER");
    expect_failure(engine.link(memory, "absent", "absent"),
                   "INVALID_RELATIONSHIP");
    expect_failure(engine.link(memory, "absent", "A"), "NOT_FOUND");
    expect_failure(engine.link(memory, "A", "absent"), "NOT_FOUND");
}

TEST(SemanticMemoryRetrieveTest,
     ExactIndependentRetrievalDoesNotMutate) {
    LongTermMemory evidence{"workspace"};
    retain(evidence, "source", "value");
    SemanticMemory memory{"workspace"};
    classify_ok(memory, evidence, "Exact", "meaning", {"source"});
    expect_concept_success(
        SemanticMemoryEngine{}.categorize(memory, "Exact", "category"),
        "Exact");
    const auto before = snapshot_of(memory);

    auto result = SemanticMemoryEngine{}.retrieve(memory, "Exact");
    expect_concept_success(result, "Exact");
    EXPECT_EQ(snapshot_of(memory), before);
    EXPECT_EQ(snapshot_of(*result.semanticConcept()),
              snapshot_of(*memory.find("Exact")));
    SemanticConcept independent{*result.semanticConcept()};
    independent = SemanticConcept{"changed", "changed", {}};
    EXPECT_EQ(memory.find("Exact")->identifier(), "Exact");
    EXPECT_EQ(memory.find("Exact")->meaning(), "meaning");

    expect_failure(SemanticMemoryEngine{}.retrieve(memory, ""),
                   "INVALID_IDENTIFIER");
    expect_failure(SemanticMemoryEngine{}.retrieve(memory, "exact"),
                   "NOT_FOUND");
}

TEST(SemanticMemorySearchTest,
     SearchesOnlySpecifiedFieldsInCanonicalOrder) {
    LongTermMemory evidence{"workspace"};
    retain(evidence, "hidden-source-token", "hidden-value-token");
    SemanticMemory memory{"workspace"};
    classify_ok(memory, evidence, "first-token", "meaning one",
                {"hidden-source-token"});
    classify_ok(memory, evidence, "second", "TOKEN meaning",
                {"hidden-source-token"});
    classify_ok(memory, evidence, "third", "meaning three",
                {"hidden-source-token"});
    SemanticMemoryEngine engine;
    expect_concept_success(engine.categorize(memory, "third", "token-label"),
                           "third");
    expect_matches_success(engine.link(memory, "first-token", "second"),
                           {"first-token", "second"});
    const auto before = snapshot_of(memory);

    expect_matches_success(engine.search(memory, SemanticQuery{"token"}),
                           {"first-token", "third"});
    expect_matches_success(engine.search(memory, SemanticQuery{"TOKEN"}),
                           {"second"});
    expect_matches_success(engine.search(memory, SemanticQuery{""}),
                           {"first-token", "second", "third"});
    expect_matches_success(engine.search(memory,
                                         SemanticQuery{"hidden-source-token"}),
                           {});
    expect_matches_success(engine.search(memory,
                                         SemanticQuery{"hidden-value-token"}),
                           {});
    expect_matches_success(engine.search(memory, SemanticQuery{"second"}),
                           {"second"});
    EXPECT_EQ(snapshot_of(memory), before);
}

TEST(SemanticMemoryUpdateTest, ChangesOnlyMeaningAndIsIdempotent) {
    LongTermMemory evidence{"workspace"};
    retain(evidence, "source", "value");
    SemanticMemory memory{"workspace"};
    classify_ok(memory, evidence, "A", "old", {"source"});
    classify_ok(memory, evidence, "B", "other", {"source"});
    SemanticMemoryEngine engine;
    expect_concept_success(engine.categorize(memory, "A", "category"), "A");
    expect_matches_success(engine.link(memory, "A", "B"), {"A", "B"});
    const auto before = snapshot_of(*memory.find("A"));

    const auto changed = engine.update(memory, "A", "new explicit meaning");
    expect_concept_success(changed, "A");
    const auto after = snapshot_of(*memory.find("A"));
    EXPECT_EQ(after.identifier, before.identifier);
    EXPECT_EQ(after.meaning, "new explicit meaning");
    EXPECT_EQ(after.source_entries, before.source_entries);
    EXPECT_EQ(after.categories, before.categories);
    EXPECT_EQ(after.links, before.links);
    EXPECT_EQ(memory.concepts()[0].identifier(), "A");

    const auto before_repeat = snapshot_of(memory);
    expect_concept_success(engine.update(memory, "A", "new explicit meaning"),
                           "A");
    EXPECT_EQ(snapshot_of(memory), before_repeat);
    expect_failure(engine.update(memory, "", ""), "INVALID_IDENTIFIER");
    expect_failure(engine.update(memory, "absent", ""), "INVALID_MEANING");
    expect_failure(engine.update(memory, "absent", "valid"), "NOT_FOUND");
}

TEST(SemanticMemoryForgetTest,
     IsIrreversibleIdempotentAndOrderPreserving) {
    LongTermMemory evidence{"workspace"};
    retain(evidence, "source", "value");
    SemanticMemory memory{"workspace"};
    classify_ok(memory, evidence, "A", "one", {"source"});
    classify_ok(memory, evidence, "B", "two", {"source"});
    classify_ok(memory, evidence, "C", "three", {"source"});
    SemanticMemoryEngine engine;
    expect_matches_success(engine.link(memory, "A", "B"), {"A", "B"});
    expect_matches_success(engine.link(memory, "A", "C"), {"A", "C"});
    expect_matches_success(engine.link(memory, "B", "C"), {"B", "C"});

    expect_no_payload_success(engine.forget(memory, "B"));
    EXPECT_EQ(semantic_disposition(memory, "B"), "FORGOTTEN");
    ASSERT_EQ(memory.concepts().size(), 2U);
    EXPECT_EQ(memory.concepts()[0].identifier(), "A");
    EXPECT_EQ(memory.concepts()[1].identifier(), "C");
    EXPECT_EQ(memory.find("A")->linkedConceptIdentifiers(),
              (std::vector<std::string>{"C"}));
    EXPECT_EQ(memory.find("C")->linkedConceptIdentifiers(),
              (std::vector<std::string>{"A"}));
    expect_no_payload_success(engine.forget(memory, "B"));
    expect_failure(engine.classify(
                       memory,
                       evidence,
                       proposal("B", "replacement", evidence, {"source"})),
                   "FORGOTTEN_IDENTIFIER");

    expect_no_payload_success(engine.forget(memory, "never-present"));
    EXPECT_EQ(semantic_disposition(memory, "never-present"), "ABSENT");
    expect_concept_success(engine.classify(
                               memory,
                               evidence,
                               proposal("never-present", "usable", evidence,
                                        {"source"})),
                           "never-present");
    expect_failure(engine.forget(memory, ""), "INVALID_IDENTIFIER");
}

TEST(SemanticMemorySourceTest,
     ProvenanceIsOwnedAndEvidenceRemainsAuthoritative) {
    LongTermMemory evidence{"workspace"};
    retain(evidence, "source", "observed value");
    SemanticMemory memory{"workspace"};
    SemanticMemoryEngine semantic_engine;
    classify_ok(memory, evidence, "concept", "meaning", {"source"});
    const auto provenance_before =
        snapshot_entries(memory.find("concept")->sourceEntries());

    ASSERT_TRUE(LongTermMemoryEngine{}
                    .store(evidence,
                           LongTermMemoryEntry{"source", "changed value"})
                    .succeeded());
    EXPECT_EQ(snapshot_entries(memory.find("concept")->sourceEntries()),
              provenance_before);
    ASSERT_TRUE(LongTermMemoryEngine{}.archive(evidence, "source").succeeded());
    EXPECT_EQ(snapshot_entries(memory.find("concept")->sourceEntries()),
              provenance_before);
    ASSERT_TRUE(LongTermMemoryEngine{}.forget(evidence, "source").succeeded());
    EXPECT_EQ(snapshot_entries(memory.find("concept")->sourceEntries()),
              provenance_before);

    const auto evidence_before = snapshot_of(evidence, {"source"});
    expect_concept_success(
        semantic_engine.update(memory, "concept", "new meaning"), "concept");
    EXPECT_EQ(snapshot_of(evidence, {"source"}), evidence_before);
    expect_no_payload_success(semantic_engine.forget(memory, "concept"));
    EXPECT_EQ(snapshot_of(evidence, {"source"}), evidence_before);
}

TEST(SemanticMemoryOrderingTest, AllObservableOrdersAreDeterministic) {
    LongTermMemory evidence{"workspace"};
    retain(evidence, "one", "1");
    retain(evidence, "two", "2");
    retain(evidence, "three", "3");
    SemanticMemory memory{"workspace"};
    SemanticMemoryEngine engine;
    classify_ok(memory, evidence, "B", "b", {"three", "one", "two"});
    classify_ok(memory, evidence, "A", "a", {"one"});
    classify_ok(memory, evidence, "C", "c", {"two"});
    expect_concept_success(engine.categorize(memory, "B", "second"), "B");
    expect_concept_success(engine.categorize(memory, "B", "first"), "B");
    expect_matches_success(engine.link(memory, "B", "C"), {"B", "C"});
    expect_matches_success(engine.link(memory, "B", "A"), {"B", "A"});
    expect_concept_success(engine.update(memory, "B", "updated"), "B");
    EXPECT_EQ(memory.find("B")->categories(),
              (std::vector<std::string>{"second", "first"}));
    EXPECT_EQ(memory.find("B")->linkedConceptIdentifiers(),
              (std::vector<std::string>{"C", "A"}));
    EXPECT_EQ(snapshot_entries(memory.find("B")->sourceEntries()),
              (std::vector<EntrySnapshot>{{"three", "3", false},
                                          {"one", "1", false},
                                          {"two", "2", false}}));
    expect_no_payload_success(engine.forget(memory, "A"));
    expect_matches_success(engine.search(memory, SemanticQuery{""}),
                           {"B", "C"});
}

TEST(SemanticMemoryPrecedenceTest, AllOperationPrecedenceIsExact) {
    LongTermMemory evidence{"workspace"};
    retain(evidence, "source", "value");
    SemanticMemory memory{"workspace"};
    classify_ok(memory, evidence, "A", "meaning", {"source"});
    SemanticMemoryEngine engine;

    expect_failure(engine.categorize(memory, "", ""),
                   "INVALID_IDENTIFIER");
    expect_failure(engine.categorize(memory, "absent", ""),
                   "INVALID_CATEGORY");
    expect_failure(engine.categorize(memory, "absent", "category"),
                   "NOT_FOUND");
    expect_failure(engine.link(memory, "", ""), "INVALID_IDENTIFIER");
    expect_failure(engine.link(memory, "A", ""), "INVALID_IDENTIFIER");
    expect_failure(engine.link(memory, "absent", "absent"),
                   "INVALID_RELATIONSHIP");
    expect_failure(engine.link(memory, "absent", "A"), "NOT_FOUND");
    expect_failure(engine.link(memory, "A", "absent"), "NOT_FOUND");
    expect_failure(engine.retrieve(memory, ""), "INVALID_IDENTIFIER");
    expect_failure(engine.update(memory, "", ""), "INVALID_IDENTIFIER");
    expect_failure(engine.update(memory, "absent", ""), "INVALID_MEANING");
    expect_failure(engine.update(memory, "absent", "meaning"), "NOT_FOUND");
    expect_failure(engine.forget(memory, ""), "INVALID_IDENTIFIER");
    expect_matches_success(engine.search(memory, SemanticQuery{"no-match"}),
                           {});
}

TEST(SemanticMemoryResultTest, CodesMessagesAndPayloadShapesAreExact) {
    std::set<std::string> observed_codes;
    const auto record = [&observed_codes](const SemanticResult& result) {
        observed_codes.insert(result.code());
    };

    LongTermMemory evidence{"workspace"};
    retain(evidence, "source", "value");
    SemanticMemory memory{"workspace"};
    SemanticMemoryEngine engine;
    auto result = engine.search(memory, SemanticQuery{""});
    record(result);
    expect_matches_success(result, {});

    LongTermMemory other{"other"};
    retain(other, "source", "value");
    result = engine.classify(memory, other, SemanticConcept{"", "", {}});
    record(result);
    expect_failure(result, "WORKSPACE_MISMATCH");
    result = engine.retrieve(memory, "");
    record(result);
    expect_failure(result, "INVALID_IDENTIFIER");
    result = engine.update(memory, "absent", "");
    record(result);
    expect_failure(result, "INVALID_MEANING");
    result = engine.classify(memory, evidence,
                             SemanticConcept{"candidate", "meaning", {}});
    record(result);
    expect_failure(result, "INVALID_PROVENANCE");

    LongTermMemory archived{"workspace"};
    retain(archived, "source", "value");
    ASSERT_TRUE(LongTermMemoryEngine{}.archive(archived, "source").succeeded());
    result = engine.classify(
        memory, archived, proposal("archived", "meaning", archived, {"source"}));
    record(result);
    expect_failure(result, "SOURCE_NOT_LONG_TERM");

    classify_ok(memory, evidence, "decorated", "meaning", {"source"});
    expect_concept_success(engine.categorize(memory, "decorated", "label"),
                           "decorated");
    result = engine.classify(memory, evidence, *memory.find("decorated"));
    record(result);
    expect_failure(result, "INVALID_CONCEPT_STATE");
    SemanticConcept forgotten_proposal =
        proposal("forgotten", "meaning", evidence, {"source"});
    expect_concept_success(engine.classify(memory, evidence,
                                           forgotten_proposal),
                           "forgotten");
    expect_no_payload_success(engine.forget(memory, "forgotten"));
    result = engine.classify(memory, evidence, forgotten_proposal);
    record(result);
    expect_failure(result, "FORGOTTEN_IDENTIFIER");

    result = engine.classify(
        memory, evidence,
        proposal("decorated", "different", evidence, {"source"}));
    record(result);
    expect_failure(result, "IDENTIFIER_CONFLICT");
    result = engine.classify(
        memory, evidence,
        SemanticConcept{"missing", "meaning",
                        {LongTermMemoryEntry{"absent", "value"}}});
    record(result);
    expect_failure(result, "SOURCE_NOT_FOUND");
    result = engine.classify(
        memory, evidence,
        SemanticConcept{"mismatch", "meaning",
                        {LongTermMemoryEntry{"source", "different"}}});
    record(result);
    expect_failure(result, "SOURCE_MISMATCH");
    result = engine.categorize(memory, "absent", "");
    record(result);
    expect_failure(result, "INVALID_CATEGORY");
    result = engine.link(memory, "same", "same");
    record(result);
    expect_failure(result, "INVALID_RELATIONSHIP");
    result = engine.retrieve(memory, "absent");
    const auto stable_message = result.message();
    record(result);
    expect_failure(result, "NOT_FOUND");
    const auto repeated = engine.retrieve(memory, "absent");
    EXPECT_EQ(repeated.message(), stable_message);

    const std::set<std::string> expected_codes{
        "OK", "WORKSPACE_MISMATCH", "INVALID_IDENTIFIER",
        "INVALID_MEANING", "INVALID_PROVENANCE", "SOURCE_NOT_LONG_TERM",
        "INVALID_CONCEPT_STATE", "FORGOTTEN_IDENTIFIER",
        "IDENTIFIER_CONFLICT", "SOURCE_NOT_FOUND", "SOURCE_MISMATCH",
        "INVALID_CATEGORY", "INVALID_RELATIONSHIP", "NOT_FOUND"};
    EXPECT_EQ(observed_codes, expected_codes);
}

TEST(SemanticMemoryFailureTest,
     SemanticFailuresPreserveCompleteStateAndEvidence) {
    LongTermMemory evidence{"workspace"};
    retain(evidence, "source", "value");
    SemanticMemory memory{"workspace"};
    classify_ok(memory, evidence, "A", "meaning", {"source"});
    classify_ok(memory, evidence, "B", "meaning", {"source"});
    expect_matches_success(SemanticMemoryEngine{}.link(memory, "A", "B"),
                           {"A", "B"});
    SemanticMemoryEngine engine;

    const auto verify_failure = [&](auto operation,
                                    const std::string_view expected_code) {
        const auto semantic_before =
            snapshot_of(memory, {"A", "B", "forgotten", "absent"});
        const auto evidence_before = snapshot_of(evidence, {"source"});
        const auto failed = operation();
        expect_failure(failed, expected_code);
        EXPECT_EQ(snapshot_of(memory,
                              {"A", "B", "forgotten", "absent"}),
                  semantic_before);
        EXPECT_EQ(snapshot_of(evidence, {"source"}), evidence_before);
    };

    verify_failure(
        [&] {
            return engine.classify(
                memory,
                evidence,
                SemanticConcept{"candidate", "meaning",
                                {LongTermMemoryEntry{"source", "wrong"}}});
        },
        "SOURCE_MISMATCH");
    verify_failure([&] { return engine.categorize(memory, "A", ""); },
                   "INVALID_CATEGORY");
    verify_failure([&] { return engine.link(memory, "A", "absent"); },
                   "NOT_FOUND");
    verify_failure([&] { return engine.update(memory, "A", ""); },
                   "INVALID_MEANING");
    verify_failure([&] { return engine.forget(memory, ""); },
                   "INVALID_IDENTIFIER");
}

TEST(SemanticMemoryValueTest, ResultsOwnCompleteIndependentPayloads) {
    LongTermMemory evidence{"workspace"};
    retain(evidence, "source", "value");
    SemanticMemory memory{"workspace"};
    classify_ok(memory, evidence, "A", "old", {"source"});
    auto retrieved = SemanticMemoryEngine{}.retrieve(memory, "A");
    expect_concept_success(retrieved, "A");
    const auto payload = snapshot_of(*retrieved.semanticConcept());
    expect_concept_success(
        SemanticMemoryEngine{}.update(memory, "A", "new"), "A");
    EXPECT_EQ(snapshot_of(*retrieved.semanticConcept()), payload);

    SemanticResult moved{std::move(retrieved)};
    EXPECT_EQ(snapshot_of(*moved.semanticConcept()), payload);
    EXPECT_FALSE(retrieved.succeeded());
    EXPECT_TRUE(retrieved.code().empty());
    EXPECT_EQ(retrieved.semanticConcept(), nullptr);
}

TEST(SemanticMemoryIsolationTest,
     WorkspacesEnginesAndValuesDoNotShareState) {
    LongTermMemory first_evidence{"first"};
    LongTermMemory second_evidence{"second"};
    retain(first_evidence, "source", "one");
    retain(second_evidence, "source", "two");
    SemanticMemory first{"first"};
    SemanticMemory second{"second"};
    SemanticMemoryEngine first_engine;
    SemanticMemoryEngine second_engine;
    classify_ok(first, first_evidence, "concept", "first meaning", {"source"});
    classify_ok(second, second_evidence, "concept", "second meaning", {"source"});
    expect_concept_success(first_engine.categorize(first, "concept", "first"),
                           "concept");
    expect_concept_success(second_engine.update(second, "concept", "changed"),
                           "concept");
    EXPECT_EQ(first.find("concept")->meaning(), "first meaning");
    EXPECT_EQ(first.find("concept")->categories(),
              (std::vector<std::string>{"first"}));
    EXPECT_EQ(second.find("concept")->meaning(), "changed");
    EXPECT_TRUE(second.find("concept")->categories().empty());
}

TEST(SemanticMemoryIsolationTest,
     IndependentInstancesAndEnginesSupportConcurrency) {
    constexpr std::size_t worker_count = 6U;
    std::array<std::optional<SemanticStateSnapshot>, worker_count> states;
    std::array<std::optional<LongTermStateSnapshot>, worker_count> sources;
    std::vector<std::thread> workers;
    workers.reserve(worker_count);
    for (std::size_t index = 0; index < worker_count; ++index) {
        workers.emplace_back([index, &states, &sources] {
            const auto workspace = "workspace-" + std::to_string(index);
            LongTermMemory evidence{workspace};
            retain(evidence, "source", "value-" + std::to_string(index));
            SemanticMemory memory{workspace};
            SemanticMemoryEngine engine;
            classify_ok(memory, evidence, "concept", "meaning", {"source"});
            expect_concept_success(
                engine.categorize(memory,
                                  "concept",
                                  "category-" + std::to_string(index)),
                "concept");
            expect_concept_success(
                engine.update(memory,
                              "concept",
                              "updated-" + std::to_string(index)),
                "concept");
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
        EXPECT_EQ(states[index]->concepts.front().meaning,
                  "updated-" + std::to_string(index));
        EXPECT_EQ(sources[index]->entries.front().value,
                  "value-" + std::to_string(index));
    }
}

TEST(SemanticMemoryRuntimeTest, RuntimeLifecyclesDoNotOwnOrMutateState) {
    LongTermMemory evidence{"workspace"};
    retain(evidence, "source", "value");
    SemanticMemory memory{"workspace"};
    classify_ok(memory, evidence, "concept", "meaning", {"source"});
    const auto before = snapshot_of(memory, {"concept", "absent"});
    const auto source_before = snapshot_of(evidence, {"source"});

    {
        auto runtime = cca::runtime::RuntimeBuilder{
                           cca::runtime::RuntimeId{"semantic-runtime-one"}}
                           .build();
        ASSERT_NE(runtime, nullptr);
        ASSERT_TRUE(runtime->start().ok());
        EXPECT_EQ(snapshot_of(memory, {"concept", "absent"}), before);
        ASSERT_TRUE(runtime->stop().ok());
    }
    {
        auto replacement = cca::runtime::RuntimeBuilder{
                               cca::runtime::RuntimeId{
                                   "semantic-runtime-replacement"}}
                               .build();
        ASSERT_NE(replacement, nullptr);
        ASSERT_TRUE(replacement->start().ok());
        ASSERT_TRUE(replacement->stop().ok());
    }
    EXPECT_EQ(snapshot_of(memory, {"concept", "absent"}), before);
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

[[nodiscard]] RepresentationValue semantic_record(
    std::string identifier,
    std::string meaning,
    std::vector<RepresentationValue> provenance,
    const std::vector<std::string>& categories = {},
    const std::vector<std::string>& links = {}) {
    std::vector<RepresentationValue> record;
    record.emplace_back(std::move(identifier));
    record.emplace_back(std::move(meaning));
    record.emplace_back(std::move(provenance));
    record.emplace_back(strings(categories));
    record.emplace_back(strings(links));
    return RepresentationValue{std::move(record)};
}

void add_manifest(RepresentationDocument& document,
                  std::string workspace,
                  std::vector<RepresentationValue> concepts,
                  std::vector<std::string> forgotten = {},
                  const std::int64_t schema = 1) {
    auto& manifest = document.createEntity(RepresentationType{
        "cca.memory.semantic-memory.persistence.v1"});
    manifest.addProperty("schema-version",
                         RepresentationType{"cca.integer"},
                         RepresentationValue{schema});
    manifest.addProperty("workspace-identifier",
                         RepresentationType{"cca.string"},
                         RepresentationValue{std::move(workspace)});
    manifest.addProperty(
        "concepts",
        RepresentationType{"cca.memory.semantic-memory.concepts"},
        RepresentationValue{std::move(concepts)});
    manifest.addProperty(
        "forgotten-identifiers",
        RepresentationType{"cca.memory.semantic-memory.identifiers"},
        strings(forgotten));
}

[[nodiscard]] std::unique_ptr<RepresentationDocument> malformed_projection(
    std::string workspace,
    std::vector<RepresentationValue> concepts,
    std::vector<std::string> forgotten = {},
    const std::int64_t schema = 1) {
    auto document = std::make_unique<RepresentationDocument>(
        RepresentationMetadata{"CCA", "CCA-SEMMEM-1.0", "malformed-test"});
    add_manifest(*document,
                 std::move(workspace),
                 std::move(concepts),
                 std::move(forgotten),
                 schema);
    const auto validation = FreezeService{}.freeze(*document);
    if (!validation.valid) {
        throw std::logic_error{"malformed Semantic test projection was not a "
                               "valid Representation document"};
    }
    return document;
}

void expect_invalid_projection(
    const std::unique_ptr<RepresentationDocument>& projection) {
    ASSERT_NE(projection, nullptr);
    EXPECT_THROW(
        static_cast<void>(
            cca::memory::detail::SemanticMemoryPersistence::reconstruct(
                *projection)),
        std::invalid_argument);
}

TEST(SemanticMemoryPersistenceTest,
     ProjectReconstructAndRealRoundTripAreExact) {
    LongTermMemory evidence{"persistence-workspace"};
    retain(evidence, "source-a", "alpha");
    retain(evidence, "source-b", "beta");
    SemanticMemory source{"persistence-workspace"};
    SemanticMemoryEngine engine;
    classify_ok(source, evidence, "A", "meaning-a",
                {"source-b", "source-a"});
    classify_ok(source, evidence, "B", "meaning-b", {"source-a"});
    classify_ok(source, evidence, "C", "meaning-c", {"source-b"});
    expect_concept_success(engine.categorize(source, "A", "second"), "A");
    expect_concept_success(engine.categorize(source, "A", "first"), "A");
    expect_matches_success(engine.link(source, "A", "B"), {"A", "B"});
    expect_matches_success(engine.link(source, "A", "C"), {"A", "C"});
    expect_no_payload_success(engine.forget(source, "B"));
    const std::vector<std::string_view> probes{"A", "B", "C", "absent"};
    const auto before = snapshot_of(source, probes);

    auto projection =
        cca::memory::detail::SemanticMemoryPersistence::project(source);
    ASSERT_NE(projection, nullptr);
    EXPECT_TRUE(projection->isFrozen());
    auto reconstructed =
        cca::memory::detail::SemanticMemoryPersistence::reconstruct(
            *projection);
    EXPECT_EQ(snapshot_of(reconstructed, probes), before);

    auto round_tripped =
        cca::memory::detail::SemanticMemoryPersistence::roundTrip(source);
    EXPECT_EQ(snapshot_of(round_tripped, probes), before);
    EXPECT_EQ(snapshot_of(source, probes), before);

    expect_concept_success(engine.update(reconstructed, "A", "independent"),
                           "A");
    EXPECT_EQ(source.find("A")->meaning(), "meaning-a");

    ASSERT_TRUE(LongTermMemoryEngine{}.archive(evidence, "source-a").succeeded());
    ASSERT_TRUE(LongTermMemoryEngine{}.forget(evidence, "source-b").succeeded());
    auto without_live_sources =
        cca::memory::detail::SemanticMemoryPersistence::roundTrip(source);
    EXPECT_EQ(snapshot_of(without_live_sources, probes), before);
}

TEST(SemanticMemoryPersistenceTest,
     MalformedInputsAreRejectedWithoutPartialPublication) {
    const auto source = [] {
        std::vector<RepresentationValue> values;
        values.push_back(provenance_record("source", "value"));
        return values;
    };
    const auto valid_concept = [&] {
        std::vector<RepresentationValue> concepts;
        concepts.push_back(
            semantic_record("A", "meaning", source(), {}, {}));
        return concepts;
    };

    auto absent_manifest = std::make_unique<RepresentationDocument>(
        RepresentationMetadata{"CCA", "CCA-SEMMEM-1.0", "missing"});
    ASSERT_TRUE(FreezeService{}.freeze(*absent_manifest).valid);
    expect_invalid_projection(absent_manifest);

    auto duplicate_manifest = std::make_unique<RepresentationDocument>(
        RepresentationMetadata{"CCA", "CCA-SEMMEM-1.0", "duplicate"});
    add_manifest(*duplicate_manifest, "workspace", valid_concept());
    add_manifest(*duplicate_manifest, "workspace", valid_concept());
    ASSERT_TRUE(FreezeService{}.freeze(*duplicate_manifest).valid);
    expect_invalid_projection(duplicate_manifest);

    expect_invalid_projection(
        malformed_projection("workspace", valid_concept(), {}, 2));
    expect_invalid_projection(malformed_projection("", valid_concept()));

    std::vector<RepresentationValue> duplicate_concepts;
    duplicate_concepts.push_back(
        semantic_record("A", "first", source(), {}, {}));
    duplicate_concepts.push_back(
        semantic_record("A", "second", source(), {}, {}));
    expect_invalid_projection(malformed_projection(
        "workspace", std::move(duplicate_concepts)));

    std::vector<RepresentationValue> empty_provenance;
    empty_provenance.push_back(
        semantic_record("A", "meaning", {}, {}, {}));
    expect_invalid_projection(malformed_projection(
        "workspace", std::move(empty_provenance)));

    std::vector<RepresentationValue> self_source;
    self_source.push_back(semantic_record(
        "A", "meaning", {provenance_record("A", "value")}, {}, {}));
    expect_invalid_projection(
        malformed_projection("workspace", std::move(self_source)));

    std::vector<RepresentationValue> archived_source;
    archived_source.push_back(semantic_record(
        "A", "meaning", {provenance_record("source", "value", true)}, {}, {}));
    expect_invalid_projection(
        malformed_projection("workspace", std::move(archived_source)));

    std::vector<RepresentationValue> duplicate_category;
    duplicate_category.push_back(semantic_record(
        "A", "meaning", source(), {"same", "same"}, {}));
    expect_invalid_projection(
        malformed_projection("workspace", std::move(duplicate_category)));

    std::vector<RepresentationValue> dangling_link;
    dangling_link.push_back(semantic_record(
        "A", "meaning", source(), {}, {"missing"}));
    expect_invalid_projection(
        malformed_projection("workspace", std::move(dangling_link)));

    std::vector<RepresentationValue> asymmetric_links;
    asymmetric_links.push_back(semantic_record(
        "A", "meaning", source(), {}, {"B"}));
    asymmetric_links.push_back(semantic_record(
        "B", "meaning", source(), {}, {}));
    expect_invalid_projection(
        malformed_projection("workspace", std::move(asymmetric_links)));

    expect_invalid_projection(malformed_projection(
        "workspace", valid_concept(), {"A"}));
    expect_invalid_projection(malformed_projection(
        "workspace", valid_concept(), {"forgotten", "forgotten"}));
}

TEST(SemanticMemoryDeterminismTest,
     EquivalentSequencesProduceCompleteEquality) {
    const auto execute = [](SemanticMemory& memory,
                            LongTermMemory& evidence) {
        SemanticMemoryEngine engine;
        std::vector<ResultSnapshot> results;
        results.push_back(snapshot_of(engine.classify(
            memory, evidence,
            proposal("A", "one", evidence, {"second", "first"}))));
        results.push_back(snapshot_of(engine.classify(
            memory, evidence,
            proposal("B", "two", evidence, {"first"}))));
        results.push_back(snapshot_of(engine.categorize(memory, "A", "beta")));
        results.push_back(snapshot_of(engine.categorize(memory, "A", "alpha")));
        results.push_back(snapshot_of(engine.link(memory, "B", "A")));
        results.push_back(snapshot_of(engine.retrieve(memory, "A")));
        results.push_back(snapshot_of(engine.search(memory, SemanticQuery{"a"})));
        results.push_back(snapshot_of(engine.update(memory, "B", "TWO")));
        results.push_back(snapshot_of(engine.forget(memory, "A")));
        results.push_back(snapshot_of(engine.classify(
            memory, evidence,
            proposal("A", "again", evidence, {"first"}))));
        results.push_back(snapshot_of(engine.forget(memory, "absent")));
        return results;
    };

    LongTermMemory first_evidence{"workspace"};
    LongTermMemory second_evidence{"workspace"};
    retain(first_evidence, "first", "1");
    retain(first_evidence, "second", "2");
    retain(second_evidence, "first", "1");
    retain(second_evidence, "second", "2");
    SemanticMemory first{"workspace"};
    SemanticMemory second{"workspace"};
    const auto first_results = execute(first, first_evidence);
    const auto second_results = execute(second, second_evidence);
    EXPECT_EQ(first_results, second_results);
    EXPECT_EQ(snapshot_of(first, {"A", "B", "absent"}),
              snapshot_of(second, {"A", "B", "absent"}));
    EXPECT_EQ(snapshot_of(first_evidence, {"first", "second"}),
              snapshot_of(second_evidence, {"first", "second"}));
}

TEST(SemanticMemoryExplicitInputTest,
     MeaningCategoriesAndLinksAreNeverInferredOrTraversed) {
    LongTermMemory evidence{"workspace"};
    retain(evidence, "evidence", "possible inferred phrase");
    SemanticMemory memory{"workspace"};
    SemanticMemoryEngine engine;
    classify_ok(memory, evidence, "A", "caller meaning", {"evidence"});
    classify_ok(memory, evidence, "B", "other", {"evidence"});
    classify_ok(memory, evidence, "C", "third", {"evidence"});
    expect_matches_success(engine.link(memory, "A", "B"), {"A", "B"});
    expect_matches_success(engine.link(memory, "B", "C"), {"B", "C"});
    EXPECT_EQ(memory.find("A")->meaning(), "caller meaning");
    EXPECT_TRUE(memory.find("A")->categories().empty());
    EXPECT_EQ(memory.find("A")->linkedConceptIdentifiers(),
              (std::vector<std::string>{"B"}));
    expect_matches_success(engine.search(memory, SemanticQuery{"C"}), {"C"});
    expect_matches_success(
        engine.search(memory, SemanticQuery{"possible inferred phrase"}),
        {});
}

} // namespace
