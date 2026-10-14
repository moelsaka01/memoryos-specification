#include <cca/memory/long_term_memory.hpp>
#include <cca/memory/memory.hpp>
#include <cca/memory/working_memory.hpp>
#include <cca/runtime/runtime.hpp>
#include <cca/runtime/runtime_builder.hpp>
#include <cca/runtime/runtime_id.hpp>

#include "long_term_memory_persistence.hpp"

#include <gtest/gtest.h>

#include <array>
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
CCA-LTMEM-1.0 requirement coverage
----------------------------------
CCA-LTMEM-001: LongTermMemoryArchitectureTest (CTest)
CCA-LTMEM-002: LongTermMemoryApiTest.PublicDeclarationsMatchTheFrozenContract
CCA-LTMEM-003: LongTermMemoryApiTest.PublicDeclarationsMatchTheFrozenContract
CCA-LTMEM-004: LongTermMemoryOwnershipTest.WorkspaceBoundaryIsRequiredAndImmutable
CCA-LTMEM-005: LongTermMemoryIsolationTest.WorkspacesAndEnginesDoNotShareState
                 and LongTermMemoryArchitectureTest (CTest)
CCA-LTMEM-006: LongTermMemoryConstructionTest.InitialStateAndClassificationBoundaryAreExact
                 and LongTermMemoryArchitectureTest (CTest)
CCA-LTMEM-007: LongTermMemoryObservationTest.ExposesCompleteStateWithSpecifiedLifetimes
CCA-LTMEM-008: LongTermMemoryIdentityTest.PreservesExactDurableIdentifiers
CCA-LTMEM-009: LongTermMemoryOrderingTest.AllTransitionsPreserveCanonicalOrder
CCA-LTMEM-010: LongTermMemoryRetainTest.AppendIdempotenceConflictAndPrecedenceAreExact
CCA-LTMEM-011: LongTermMemoryStoreTest.AppendReplacementAndRejectionsAreExact
CCA-LTMEM-012: LongTermMemoryRetrieveTest.LongTermAndArchivedRetrievalAreExactAndIndependent
CCA-LTMEM-013: LongTermMemorySearchTest.FiltersInCanonicalOrderWithoutMutation
CCA-LTMEM-014: LongTermMemoryArchiveTest.TransitionAndIdempotenceAreExact
CCA-LTMEM-015: LongTermMemoryRestoreTest.PreconditionsAndValidationPrecedenceAreExact
CCA-LTMEM-016: LongTermMemoryRestoreTest.RestoresCompleteIndependentSemanticState
CCA-LTMEM-017: LongTermMemoryForgetTest.IsIrreversibleIdempotentAndOrderPreserving
CCA-LTMEM-018: LongTermMemoryTransitionTest.OnlyExplicitOperationsChangeBaseState
CCA-LTMEM-019: LongTermMemoryIntegrityTest.RetainedKnowledgeChangesOnlyAsSpecified
CCA-LTMEM-020: LongTermMemoryResultTest.CodesMessagesAndPayloadShapesAreExact
CCA-LTMEM-021: LongTermMemoryOwnershipTest.ValuesCopiesMovesAndResultsAreIndependent
CCA-LTMEM-022: LongTermMemoryIsolationTest.WorkspacesAndEnginesDoNotShareState
                 and LongTermMemoryIsolationTest.IndependentValuesSupportConcurrentUse
CCA-LTMEM-023: LongTermMemoryFailureTest.SemanticFailuresPreserveCompleteStateAndOtherCapabilities
                 and LongTermMemoryAllocationFailureTest (dedicated executable)
CCA-LTMEM-024: LongTermMemoryPersistenceTest.RoundTripPreservesCompleteWorkspaceAssetState
CCA-LTMEM-025: LongTermMemoryRuntimeTest.RuntimeLifecycleDoesNotOwnOrMutateMemory
                 and LongTermMemoryArchitectureTest (CTest)
CCA-LTMEM-026: LongTermMemoryFailureTest.SemanticFailuresPreserveCompleteStateAndOtherCapabilities
                 and LongTermMemoryArchitectureTest (CTest)
CCA-LTMEM-027: LongTermMemoryArchitectureTest (CTest)
CCA-LTMEM-028: LongTermMemoryDeterminismTest.EquivalentSequencesProduceEquivalentResultsAndState
CCA-LTMEM-029: LongTermMemoryArchitectureTest (CTest) and the CI warnings-as-errors build
*/

namespace {

using cca::memory::LongTermMemory;
using cca::memory::LongTermMemoryEngine;
using cca::memory::LongTermMemoryEntry;
using cca::memory::LongTermMemoryQuery;
using cca::memory::LongTermMemoryResult;
using cca::memory::Memory;
using cca::memory::MemoryEngine;
using cca::memory::MemoryEntry;
using cca::memory::WorkingMemory;
using cca::memory::WorkingMemoryEngine;
using cca::memory::WorkingMemoryEntry;

struct EntrySnapshot final {
    std::string identifier;
    std::string value;
    bool archived;

    bool operator==(const EntrySnapshot&) const = default;
};

struct IdentifierSnapshot final {
    std::string identifier;
    std::string disposition;

    bool operator==(const IdentifierSnapshot&) const = default;
};

struct StateSnapshot final {
    std::string workspace_identifier;
    std::vector<EntrySnapshot> entries;
    std::vector<IdentifierSnapshot> identifiers;

    bool operator==(const StateSnapshot&) const = default;
};

struct ResultSnapshot final {
    bool succeeded;
    std::string code;
    std::string message;
    std::optional<EntrySnapshot> entry;
    std::vector<EntrySnapshot> matches;

    bool operator==(const ResultSnapshot&) const = default;
};

struct MemoryEntrySnapshot final {
    std::string identifier;
    std::string value;

    bool operator==(const MemoryEntrySnapshot&) const = default;
};

struct WorkingEntrySnapshot final {
    std::string identifier;
    std::string value;
    std::optional<std::uint64_t> expiration_point;

    bool operator==(const WorkingEntrySnapshot&) const = default;
};

struct WorkingStateSnapshot final {
    std::string workspace_identifier;
    bool active;
    std::optional<std::string> task_identifier;
    std::vector<WorkingEntrySnapshot> entries;

    bool operator==(const WorkingStateSnapshot&) const = default;
};

[[nodiscard]] EntrySnapshot snapshot_of(const LongTermMemoryEntry& entry) {
    return EntrySnapshot{entry.identifier(), entry.value(), entry.archived()};
}

[[nodiscard]] std::vector<EntrySnapshot>
snapshot_of(const std::vector<LongTermMemoryEntry>& entries) {
    std::vector<EntrySnapshot> result;
    result.reserve(entries.size());
    for (const auto& entry : entries) {
        result.push_back(snapshot_of(entry));
    }
    return result;
}

[[nodiscard]] std::string identifier_disposition(
    const LongTermMemory& memory,
    const std::string_view identifier) {
    if (const auto* entry = memory.find(identifier); entry != nullptr) {
        return entry->archived() ? "ARCHIVED" : "LONG_TERM";
    }

    LongTermMemory probe{memory};
    const auto result = LongTermMemoryEngine{}.retain(
        probe,
        LongTermMemoryEntry{std::string{identifier},
                            "private-forgotten-history-probe"});
    if (result.code() == "FORGOTTEN_IDENTIFIER") {
        return "FORGOTTEN";
    }
    if (result.succeeded()) {
        return "ABSENT";
    }
    return "UNEXPECTED:" + result.code();
}

[[nodiscard]] StateSnapshot snapshot_of(
    const LongTermMemory& memory,
    const std::vector<std::string_view>& identifier_probes = {}) {
    std::vector<IdentifierSnapshot> identifiers;
    identifiers.reserve(identifier_probes.size());
    for (const auto identifier : identifier_probes) {
        identifiers.push_back(
            IdentifierSnapshot{std::string{identifier},
                               identifier_disposition(memory, identifier)});
    }

    return StateSnapshot{memory.workspaceIdentifier(),
                         snapshot_of(memory.entries()),
                         std::move(identifiers)};
}

[[nodiscard]] ResultSnapshot snapshot_of(const LongTermMemoryResult& result) {
    std::optional<EntrySnapshot> entry;
    if (result.entry() != nullptr) {
        entry = snapshot_of(*result.entry());
    }
    return ResultSnapshot{result.succeeded(),
                          result.code(),
                          result.message(),
                          std::move(entry),
                          snapshot_of(result.matches())};
}

[[nodiscard]] std::vector<MemoryEntrySnapshot> snapshot_of(
    const Memory& memory) {
    std::vector<MemoryEntrySnapshot> result;
    result.reserve(memory.entries().size());
    for (const auto& entry : memory.entries()) {
        result.push_back(
            MemoryEntrySnapshot{entry.identifier(), entry.value()});
    }
    return result;
}

[[nodiscard]] WorkingStateSnapshot snapshot_of(
    const WorkingMemory& memory) {
    std::vector<WorkingEntrySnapshot> entries;
    entries.reserve(memory.entries().size());
    for (const auto& entry : memory.entries()) {
        entries.push_back(WorkingEntrySnapshot{entry.identifier(),
                                               entry.value(),
                                               entry.expirationPoint()});
    }
    return WorkingStateSnapshot{memory.workspaceIdentifier(),
                                memory.active(),
                                memory.activeTaskIdentifier(),
                                std::move(entries)};
}

void expect_entry_success(const LongTermMemoryResult& result,
                          const std::string_view identifier,
                          const std::string_view value,
                          const bool archived) {
    ASSERT_TRUE(result.succeeded()) << result.code() << ": "
                                    << result.message();
    EXPECT_EQ(result.code(), "OK");
    EXPECT_TRUE(result.message().empty());
    ASSERT_NE(result.entry(), nullptr);
    EXPECT_EQ(result.entry()->identifier(), identifier);
    EXPECT_EQ(result.entry()->value(), value);
    EXPECT_EQ(result.entry()->archived(), archived);
    EXPECT_TRUE(result.matches().empty());
}

void expect_no_payload_success(const LongTermMemoryResult& result) {
    ASSERT_TRUE(result.succeeded()) << result.code() << ": "
                                    << result.message();
    EXPECT_EQ(result.code(), "OK");
    EXPECT_TRUE(result.message().empty());
    EXPECT_EQ(result.entry(), nullptr);
    EXPECT_TRUE(result.matches().empty());
}

void expect_failure(const LongTermMemoryResult& result,
                    const std::string_view expected_code) {
    EXPECT_FALSE(result.succeeded());
    EXPECT_EQ(result.code(), expected_code);
    EXPECT_FALSE(result.message().empty());
    EXPECT_EQ(result.entry(), nullptr);
    EXPECT_TRUE(result.matches().empty());
}

void retain(LongTermMemoryEngine& engine,
            LongTermMemory& memory,
            std::string identifier,
            std::string value) {
    const auto result = engine.retain(
        memory,
        LongTermMemoryEntry{std::move(identifier), std::move(value)});
    ASSERT_TRUE(result.succeeded()) << result.code() << ": "
                                    << result.message();
}

void store(LongTermMemoryEngine& engine,
           LongTermMemory& memory,
           std::string identifier,
           std::string value) {
    const auto result = engine.store(
        memory,
        LongTermMemoryEntry{std::move(identifier), std::move(value)});
    ASSERT_TRUE(result.succeeded()) << result.code() << ": "
                                    << result.message();
}

TEST(LongTermMemoryApiTest, PublicDeclarationsMatchTheFrozenContract) {
    static_assert(
        std::is_constructible_v<LongTermMemoryEntry, std::string, std::string>);
    static_assert(std::is_constructible_v<LongTermMemoryQuery, std::string>);
    static_assert(!std::is_convertible_v<std::string, LongTermMemoryQuery>);

    static_assert(std::is_constructible_v<LongTermMemory, std::string>);
    static_assert(std::is_copy_constructible_v<LongTermMemory>);
    static_assert(!std::is_copy_assignable_v<LongTermMemory>);
    static_assert(std::is_nothrow_move_constructible_v<LongTermMemory>);
    static_assert(!std::is_move_assignable_v<LongTermMemory>);

    static_assert(!std::is_default_constructible_v<LongTermMemoryResult>);
    static_assert(std::is_nothrow_move_constructible_v<LongTermMemoryResult>);
    static_assert(std::is_nothrow_move_assignable_v<LongTermMemoryResult>);
    static_assert(!std::is_copy_constructible_v<LongTermMemoryResult>);
    static_assert(!std::is_copy_assignable_v<LongTermMemoryResult>);
    static_assert(std::is_empty_v<LongTermMemoryEngine>);

    using EntryIdentifier =
        const std::string& (LongTermMemoryEntry::*)() const noexcept;
    using EntryValue =
        const std::string& (LongTermMemoryEntry::*)() const noexcept;
    using EntryArchived = bool (LongTermMemoryEntry::*)() const noexcept;
    using QueryText =
        const std::string& (LongTermMemoryQuery::*)() const noexcept;
    using WorkspaceIdentifier =
        const std::string& (LongTermMemory::*)() const noexcept;
    using MemorySize = std::size_t (LongTermMemory::*)() const noexcept;
    using Find = const LongTermMemoryEntry* (LongTermMemory::*)(
        std::string_view) const noexcept;
    using Entries = const std::vector<LongTermMemoryEntry>& (
        LongTermMemory::*)() const noexcept;
    using Succeeded = bool (LongTermMemoryResult::*)() const noexcept;
    using ResultString =
        const std::string& (LongTermMemoryResult::*)() const noexcept;
    using ResultEntry =
        const LongTermMemoryEntry* (LongTermMemoryResult::*)() const noexcept;
    using Matches = const std::vector<LongTermMemoryEntry>& (
        LongTermMemoryResult::*)() const noexcept;

    static_assert(std::is_same_v<decltype(static_cast<EntryIdentifier>(
                                     &LongTermMemoryEntry::identifier)),
                                 EntryIdentifier>);
    static_assert(std::is_same_v<decltype(static_cast<EntryValue>(
                                     &LongTermMemoryEntry::value)),
                                 EntryValue>);
    static_assert(std::is_same_v<decltype(static_cast<EntryArchived>(
                                     &LongTermMemoryEntry::archived)),
                                 EntryArchived>);
    static_assert(std::is_same_v<decltype(static_cast<QueryText>(
                                     &LongTermMemoryQuery::text)),
                                 QueryText>);
    static_assert(std::is_same_v<decltype(static_cast<WorkspaceIdentifier>(
                                     &LongTermMemory::workspaceIdentifier)),
                                 WorkspaceIdentifier>);
    static_assert(std::is_same_v<decltype(static_cast<MemorySize>(
                                     &LongTermMemory::size)),
                                 MemorySize>);
    static_assert(std::is_same_v<decltype(static_cast<Find>(
                                     &LongTermMemory::find)),
                                 Find>);
    static_assert(std::is_same_v<decltype(static_cast<Entries>(
                                     &LongTermMemory::entries)),
                                 Entries>);
    static_assert(std::is_same_v<decltype(static_cast<Succeeded>(
                                     &LongTermMemoryResult::succeeded)),
                                 Succeeded>);
    static_assert(std::is_same_v<decltype(static_cast<ResultString>(
                                     &LongTermMemoryResult::code)),
                                 ResultString>);
    static_assert(std::is_same_v<decltype(static_cast<ResultString>(
                                     &LongTermMemoryResult::message)),
                                 ResultString>);
    static_assert(std::is_same_v<decltype(static_cast<ResultEntry>(
                                     &LongTermMemoryResult::entry)),
                                 ResultEntry>);
    static_assert(std::is_same_v<decltype(static_cast<Matches>(
                                     &LongTermMemoryResult::matches)),
                                 Matches>);

    using Retain = LongTermMemoryResult (LongTermMemoryEngine::*)(
        LongTermMemory&, LongTermMemoryEntry) const;
    using Store = LongTermMemoryResult (LongTermMemoryEngine::*)(
        LongTermMemory&, LongTermMemoryEntry) const;
    using Retrieve = LongTermMemoryResult (LongTermMemoryEngine::*)(
        const LongTermMemory&, std::string_view) const;
    using Search = LongTermMemoryResult (LongTermMemoryEngine::*)(
        const LongTermMemory&, const LongTermMemoryQuery&) const;
    using Archive = LongTermMemoryResult (LongTermMemoryEngine::*)(
        LongTermMemory&, std::string_view) const;
    using Restore = LongTermMemoryResult (LongTermMemoryEngine::*)(
        LongTermMemory&, const LongTermMemory&) const;
    using Forget = LongTermMemoryResult (LongTermMemoryEngine::*)(
        LongTermMemory&, std::string_view) const;

    static_assert(std::is_same_v<decltype(static_cast<Retain>(
                                     &LongTermMemoryEngine::retain)),
                                 Retain>);
    static_assert(std::is_same_v<decltype(static_cast<Store>(
                                     &LongTermMemoryEngine::store)),
                                 Store>);
    static_assert(std::is_same_v<decltype(static_cast<Retrieve>(
                                     &LongTermMemoryEngine::retrieve)),
                                 Retrieve>);
    static_assert(std::is_same_v<decltype(static_cast<Search>(
                                     &LongTermMemoryEngine::search)),
                                 Search>);
    static_assert(std::is_same_v<decltype(static_cast<Archive>(
                                     &LongTermMemoryEngine::archive)),
                                 Archive>);
    static_assert(std::is_same_v<decltype(static_cast<Restore>(
                                     &LongTermMemoryEngine::restore)),
                                 Restore>);
    static_assert(std::is_same_v<decltype(static_cast<Forget>(
                                     &LongTermMemoryEngine::forget)),
                                 Forget>);

    static_assert(!std::is_invocable_v<Retain,
                                       const LongTermMemoryEngine&,
                                       LongTermMemory&,
                                       MemoryEntry>);
    static_assert(!std::is_invocable_v<Retain,
                                       const LongTermMemoryEngine&,
                                       LongTermMemory&,
                                       WorkingMemoryEntry>);
}

TEST(LongTermMemoryOwnershipTest,
     WorkspaceBoundaryIsRequiredAndImmutable) {
    EXPECT_THROW(static_cast<void>(LongTermMemory{""}),
                 std::invalid_argument);

    LongTermMemory memory{"Workspace-Case-Sensitive"};
    EXPECT_EQ(memory.workspaceIdentifier(), "Workspace-Case-Sensitive");

    LongTermMemory copied{memory};
    EXPECT_EQ(copied.workspaceIdentifier(), "Workspace-Case-Sensitive");

    LongTermMemory moved{std::move(copied)};
    EXPECT_EQ(moved.workspaceIdentifier(), "Workspace-Case-Sensitive");
    EXPECT_EQ(copied.workspaceIdentifier(), "Workspace-Case-Sensitive");
}

TEST(LongTermMemoryConstructionTest,
     InitialStateAndClassificationBoundaryAreExact) {
    std::string identifier = "durable-id";
    std::string value = "already-classified-long-term-value";
    LongTermMemoryEntry entry{identifier, value};
    LongTermMemory memory{"workspace"};
    LongTermMemory other{"workspace"};

    identifier = "changed";
    value = "changed";
    EXPECT_EQ(entry.identifier(), "durable-id");
    EXPECT_EQ(entry.value(), "already-classified-long-term-value");
    EXPECT_FALSE(entry.archived());
    EXPECT_EQ(memory.size(), 0U);
    EXPECT_TRUE(memory.entries().empty());
    EXPECT_EQ(memory.find("durable-id"), nullptr);
    EXPECT_EQ(other.size(), 0U);

    std::string query_text = "classified";
    const LongTermMemoryQuery query{query_text};
    query_text = "changed";
    EXPECT_EQ(query.text(), "classified");
}

TEST(LongTermMemoryObservationTest,
     ExposesCompleteStateWithSpecifiedLifetimes) {
    LongTermMemoryEngine engine;
    LongTermMemory memory{"workspace"};
    retain(engine, memory, "first", "alpha");
    retain(engine, memory, "second", "beta");
    expect_entry_success(engine.archive(memory, "second"),
                         "second",
                         "beta",
                         true);

    const auto* first = memory.find("first");
    const auto* second = memory.find("second");
    const auto* entries = &memory.entries();
    ASSERT_NE(first, nullptr);
    ASSERT_NE(second, nullptr);
    EXPECT_FALSE(first->archived());
    EXPECT_TRUE(second->archived());
    EXPECT_EQ(memory.size(), 2U);
    ASSERT_EQ(entries->size(), 2U);

    const auto retrieved = engine.retrieve(memory, "second");
    const auto searched = engine.search(memory, LongTermMemoryQuery{"alpha"});
    ASSERT_TRUE(retrieved.succeeded());
    ASSERT_TRUE(searched.succeeded());

    EXPECT_EQ(memory.find("first"), first);
    EXPECT_EQ(memory.find("second"), second);
    EXPECT_EQ(&memory.entries(), entries);
    EXPECT_EQ(first->identifier(), "first");
    EXPECT_EQ(second->value(), "beta");

    expect_no_payload_success(engine.forget(memory, "first"));
    EXPECT_EQ(memory.find("first"), nullptr);
    EXPECT_EQ(memory.size(), 1U);
    ASSERT_EQ(memory.entries().size(), 1U);
    EXPECT_EQ(memory.entries().front().identifier(), "second");
}

TEST(LongTermMemoryRetainTest,
     AppendIdempotenceConflictAndPrecedenceAreExact) {
    LongTermMemoryEngine engine;
    LongTermMemory memory{"workspace"};

    const auto appended =
        engine.retain(memory, LongTermMemoryEntry{"first", "one"});
    expect_entry_success(appended, "first", "one", false);
    retain(engine, memory, "second", "two");

    const auto before_idempotent =
        snapshot_of(memory, {"first", "second"});
    const auto idempotent =
        engine.retain(memory, LongTermMemoryEntry{"first", "one"});
    expect_entry_success(idempotent, "first", "one", false);
    EXPECT_EQ(snapshot_of(memory, {"first", "second"}), before_idempotent);

    const auto conflict =
        engine.retain(memory, LongTermMemoryEntry{"first", "different"});
    expect_failure(conflict, "IDENTIFIER_CONFLICT");
    EXPECT_EQ(snapshot_of(memory, {"first", "second"}), before_idempotent);

    expect_entry_success(engine.archive(memory, "second"),
                         "second",
                         "two",
                         true);
    const auto archived_idempotent =
        engine.retain(memory, LongTermMemoryEntry{"second", "two"});
    expect_entry_success(archived_idempotent, "second", "two", true);
    expect_failure(
        engine.retain(memory,
                      LongTermMemoryEntry{"second", "different"}),
        "IDENTIFIER_CONFLICT");

    expect_failure(engine.retain(memory, LongTermMemoryEntry{"", "value"}),
                   "INVALID_IDENTIFIER");

    LongTermMemory archived_source{"workspace"};
    retain(engine, archived_source, "forgotten", "archived-input");
    ASSERT_TRUE(engine.archive(archived_source, "forgotten").succeeded());
    const auto archived_copy = engine.retrieve(archived_source, "forgotten");
    ASSERT_NE(archived_copy.entry(), nullptr);

    LongTermMemory target{"workspace"};
    retain(engine, target, "forgotten", "old");
    expect_no_payload_success(engine.forget(target, "forgotten"));
    const auto before_precedence = snapshot_of(target, {"forgotten"});
    expect_failure(engine.retain(target, *archived_copy.entry()), "ARCHIVED");
    EXPECT_EQ(snapshot_of(target, {"forgotten"}), before_precedence);
    expect_failure(
        engine.retain(target,
                      LongTermMemoryEntry{"forgotten", "new-value"}),
        "FORGOTTEN_IDENTIFIER");
}

TEST(LongTermMemoryStoreTest,
     AppendReplacementAndRejectionsAreExact) {
    LongTermMemoryEngine engine;
    LongTermMemory memory{"workspace"};
    store(engine, memory, "first", "one");
    store(engine, memory, "second", "two");
    store(engine, memory, "third", "three");

    const auto replaced =
        engine.store(memory, LongTermMemoryEntry{"second", "TWO"});
    expect_entry_success(replaced, "second", "TWO", false);
    EXPECT_EQ(snapshot_of(memory.entries()),
              (std::vector<EntrySnapshot>{{"first", "one", false},
                                          {"second", "TWO", false},
                                          {"third", "three", false}}));

    ASSERT_TRUE(engine.archive(memory, "second").succeeded());
    const auto before_archived_destination =
        snapshot_of(memory, {"first", "second", "third"});
    expect_failure(
        engine.store(memory, LongTermMemoryEntry{"second", "replacement"}),
        "ARCHIVED");
    EXPECT_EQ(snapshot_of(memory, {"first", "second", "third"}),
              before_archived_destination);

    expect_failure(engine.store(memory, LongTermMemoryEntry{"", "value"}),
                   "INVALID_IDENTIFIER");

    LongTermMemory archived_source{"workspace"};
    store(engine, archived_source, "forgotten", "input");
    ASSERT_TRUE(engine.archive(archived_source, "forgotten").succeeded());
    const auto archived_copy = engine.retrieve(archived_source, "forgotten");
    ASSERT_NE(archived_copy.entry(), nullptr);

    LongTermMemory forgotten_target{"workspace"};
    store(engine, forgotten_target, "forgotten", "old");
    ASSERT_TRUE(engine.forget(forgotten_target, "forgotten").succeeded());
    const auto before_precedence =
        snapshot_of(forgotten_target, {"forgotten"});
    expect_failure(engine.store(forgotten_target, *archived_copy.entry()),
                   "ARCHIVED");
    EXPECT_EQ(snapshot_of(forgotten_target, {"forgotten"}),
              before_precedence);
    expect_failure(
        engine.store(forgotten_target,
                     LongTermMemoryEntry{"forgotten", "new"}),
        "FORGOTTEN_IDENTIFIER");
}

TEST(LongTermMemoryRetrieveTest,
     LongTermAndArchivedRetrievalAreExactAndIndependent) {
    LongTermMemoryEngine engine;
    LongTermMemory memory{"workspace"};
    retain(engine, memory, "Case-ID", "value");
    retain(engine, memory, "archived", "preserved");
    ASSERT_TRUE(engine.archive(memory, "archived").succeeded());

    const auto before = snapshot_of(memory, {"Case-ID", "archived"});
    const auto active = engine.retrieve(memory, "Case-ID");
    const auto archived = engine.retrieve(memory, "archived");
    expect_entry_success(active, "Case-ID", "value", false);
    expect_entry_success(archived, "archived", "preserved", true);
    expect_failure(engine.retrieve(memory, "case-id"), "NOT_FOUND");
    expect_failure(engine.retrieve(memory, "missing"), "NOT_FOUND");
    expect_failure(engine.retrieve(memory, ""), "INVALID_IDENTIFIER");
    EXPECT_EQ(snapshot_of(memory, {"Case-ID", "archived"}), before);

    ASSERT_TRUE(engine.forget(memory, "archived").succeeded());
    EXPECT_EQ(archived.entry()->identifier(), "archived");
    EXPECT_EQ(archived.entry()->value(), "preserved");
    EXPECT_TRUE(archived.entry()->archived());
}

TEST(LongTermMemorySearchTest,
     FiltersInCanonicalOrderWithoutMutation) {
    LongTermMemoryEngine engine;
    LongTermMemory memory{"workspace"};
    retain(engine, memory, "alpha-id", "first value");
    retain(engine, memory, "middle", "contains alpha");
    retain(engine, memory, "Alpha-id", "different case");
    retain(engine, memory, "archived-alpha", "alpha hidden");
    retain(engine, memory, "forgotten-alpha", "alpha removed");
    ASSERT_TRUE(engine.archive(memory, "archived-alpha").succeeded());
    ASSERT_TRUE(engine.forget(memory, "forgotten-alpha").succeeded());

    const auto before = snapshot_of(
        memory,
        {"alpha-id", "middle", "Alpha-id", "archived-alpha",
         "forgotten-alpha"});
    const auto matches = engine.search(memory, LongTermMemoryQuery{"alpha"});
    ASSERT_TRUE(matches.succeeded());
    EXPECT_EQ(matches.code(), "OK");
    EXPECT_TRUE(matches.message().empty());
    EXPECT_EQ(matches.entry(), nullptr);
    EXPECT_EQ(snapshot_of(matches.matches()),
              (std::vector<EntrySnapshot>{{"alpha-id", "first value", false},
                                          {"middle", "contains alpha", false}}));

    const auto case_matches =
        engine.search(memory, LongTermMemoryQuery{"Alpha"});
    ASSERT_EQ(case_matches.matches().size(), 1U);
    EXPECT_EQ(case_matches.matches().front().identifier(), "Alpha-id");

    const auto all = engine.search(memory, LongTermMemoryQuery{""});
    EXPECT_EQ(snapshot_of(all.matches()),
              (std::vector<EntrySnapshot>{{"alpha-id", "first value", false},
                                          {"middle", "contains alpha", false},
                                          {"Alpha-id", "different case", false}}));

    const auto none = engine.search(memory, LongTermMemoryQuery{"not-there"});
    ASSERT_TRUE(none.succeeded());
    EXPECT_TRUE(none.matches().empty());
    EXPECT_EQ(snapshot_of(memory,
                          {"alpha-id", "middle", "Alpha-id",
                           "archived-alpha", "forgotten-alpha"}),
              before);

    ASSERT_TRUE(engine.forget(memory, "alpha-id").succeeded());
    ASSERT_EQ(matches.matches().size(), 2U);
    EXPECT_EQ(matches.matches().front().identifier(), "alpha-id");
}

TEST(LongTermMemoryArchiveTest, TransitionAndIdempotenceAreExact) {
    LongTermMemoryEngine engine;
    LongTermMemory memory{"workspace"};
    retain(engine, memory, "first", "one");
    retain(engine, memory, "second", "two");
    retain(engine, memory, "third", "three");

    const auto archived = engine.archive(memory, "second");
    expect_entry_success(archived, "second", "two", true);
    EXPECT_EQ(snapshot_of(memory.entries()),
              (std::vector<EntrySnapshot>{{"first", "one", false},
                                          {"second", "two", true},
                                          {"third", "three", false}}));

    const auto before_idempotent = snapshot_of(memory, {"second"});
    expect_entry_success(engine.archive(memory, "second"),
                         "second",
                         "two",
                         true);
    EXPECT_EQ(snapshot_of(memory, {"second"}), before_idempotent);

    expect_failure(engine.archive(memory, "missing"), "NOT_FOUND");
    expect_failure(engine.archive(memory, ""), "INVALID_IDENTIFIER");
    ASSERT_TRUE(engine.forget(memory, "third").succeeded());
    expect_failure(engine.archive(memory, "third"), "NOT_FOUND");
}

TEST(LongTermMemoryRestoreTest,
     PreconditionsAndValidationPrecedenceAreExact) {
    LongTermMemoryEngine engine;
    LongTermMemory source{"source-workspace"};
    retain(engine, source, "source", "value");

    LongTermMemory mismatch_target{"different-workspace"};
    retain(engine, mismatch_target, "target", "value");
    const auto source_before = snapshot_of(source, {"source"});
    const auto mismatch_before = snapshot_of(mismatch_target, {"target"});
    expect_failure(engine.restore(mismatch_target, source),
                   "WORKSPACE_MISMATCH");
    EXPECT_EQ(snapshot_of(source, {"source"}), source_before);
    EXPECT_EQ(snapshot_of(mismatch_target, {"target"}), mismatch_before);

    LongTermMemory non_pristine{"source-workspace"};
    retain(engine, non_pristine, "target", "value");
    const auto non_pristine_before =
        snapshot_of(non_pristine, {"target", "source"});
    expect_failure(engine.restore(non_pristine, source),
                   "RESTORE_TARGET_NOT_PRISTINE");
    EXPECT_EQ(snapshot_of(non_pristine, {"target", "source"}),
              non_pristine_before);

    LongTermMemory forgotten_only{"source-workspace"};
    retain(engine, forgotten_only, "forgotten", "value");
    ASSERT_TRUE(engine.forget(forgotten_only, "forgotten").succeeded());
    ASSERT_EQ(forgotten_only.size(), 0U);
    const auto forgotten_before =
        snapshot_of(forgotten_only, {"forgotten", "source"});
    expect_failure(engine.restore(forgotten_only, source),
                   "RESTORE_TARGET_NOT_PRISTINE");
    EXPECT_EQ(snapshot_of(forgotten_only, {"forgotten", "source"}),
              forgotten_before);

    LongTermMemory pristine_self{"self-workspace"};
    expect_no_payload_success(engine.restore(pristine_self, pristine_self));
    retain(engine, pristine_self, "entry", "value");
    const auto self_before = snapshot_of(pristine_self, {"entry"});
    expect_failure(engine.restore(pristine_self, pristine_self),
                   "RESTORE_TARGET_NOT_PRISTINE");
    EXPECT_EQ(snapshot_of(pristine_self, {"entry"}), self_before);
}

TEST(LongTermMemoryRestoreTest,
     RestoresCompleteIndependentSemanticState) {
    LongTermMemoryEngine engine;
    LongTermMemory source{"workspace"};
    retain(engine, source, "forgotten", "removed");
    retain(engine, source, "archived", "preserved archived");
    retain(engine, source, "active", "preserved active");
    ASSERT_TRUE(engine.archive(source, "archived").succeeded());
    ASSERT_TRUE(engine.forget(source, "forgotten").succeeded());

    const auto source_before =
        snapshot_of(source, {"forgotten", "archived", "active", "absent"});
    LongTermMemory target{"workspace"};
    expect_no_payload_success(engine.restore(target, source));
    EXPECT_EQ(snapshot_of(target,
                          {"forgotten", "archived", "active", "absent"}),
              source_before);
    EXPECT_EQ(snapshot_of(source,
                          {"forgotten", "archived", "active", "absent"}),
              source_before);

    store(engine, target, "active", "target-only-change");
    EXPECT_EQ(source.find("active")->value(), "preserved active");
    ASSERT_TRUE(engine.forget(source, "active").succeeded());
    ASSERT_NE(target.find("active"), nullptr);
    EXPECT_EQ(target.find("active")->value(), "target-only-change");
    EXPECT_EQ(identifier_disposition(target, "forgotten"), "FORGOTTEN");
    EXPECT_EQ(identifier_disposition(source, "forgotten"), "FORGOTTEN");
}

TEST(LongTermMemoryForgetTest,
     IsIrreversibleIdempotentAndOrderPreserving) {
    LongTermMemoryEngine engine;
    LongTermMemory memory{"workspace"};
    retain(engine, memory, "first", "one");
    retain(engine, memory, "second", "two");
    retain(engine, memory, "third", "three");
    ASSERT_TRUE(engine.archive(memory, "second").succeeded());

    expect_no_payload_success(engine.forget(memory, "second"));
    EXPECT_EQ(snapshot_of(memory.entries()),
              (std::vector<EntrySnapshot>{{"first", "one", false},
                                          {"third", "three", false}}));
    EXPECT_EQ(memory.find("second"), nullptr);
    EXPECT_EQ(identifier_disposition(memory, "second"), "FORGOTTEN");

    const auto before_repeat = snapshot_of(memory, {"second", "absent"});
    expect_no_payload_success(engine.forget(memory, "second"));
    EXPECT_EQ(snapshot_of(memory, {"second", "absent"}), before_repeat);
    expect_failure(
        engine.retain(memory, LongTermMemoryEntry{"second", "new"}),
        "FORGOTTEN_IDENTIFIER");
    expect_failure(engine.store(memory, LongTermMemoryEntry{"second", "new"}),
                   "FORGOTTEN_IDENTIFIER");

    expect_no_payload_success(engine.forget(memory, "never-present"));
    EXPECT_EQ(identifier_disposition(memory, "never-present"), "ABSENT");
    expect_entry_success(
        engine.retain(memory,
                      LongTermMemoryEntry{"never-present", "now accepted"}),
        "never-present",
        "now accepted",
        false);
    expect_failure(engine.forget(memory, ""), "INVALID_IDENTIFIER");
}

TEST(LongTermMemoryIdentityTest, PreservesExactDurableIdentifiers) {
    LongTermMemoryEngine engine;
    LongTermMemory memory{"workspace"};
    const std::string identifier = "Durable-ID/Case_01";
    store(engine, memory, identifier, "initial");
    store(engine, memory, identifier, "replacement");
    ASSERT_NE(memory.find(identifier), nullptr);
    EXPECT_EQ(memory.find(identifier)->identifier(), identifier);
    EXPECT_EQ(memory.find("durable-id/case_01"), nullptr);

    LongTermMemory copy{memory};
    expect_entry_success(engine.archive(copy, identifier),
                         identifier,
                         "replacement",
                         true);
    const auto retrieved = engine.retrieve(copy, identifier);
    expect_entry_success(retrieved, identifier, "replacement", true);

    LongTermMemory restored{"workspace"};
    expect_no_payload_success(engine.restore(restored, copy));
    ASSERT_NE(restored.find(identifier), nullptr);
    EXPECT_EQ(restored.find(identifier)->identifier(), identifier);
    EXPECT_TRUE(restored.find(identifier)->archived());
}

TEST(LongTermMemoryOrderingTest, AllTransitionsPreserveCanonicalOrder) {
    LongTermMemoryEngine engine;
    LongTermMemory source{"workspace"};
    retain(engine, source, "a", "match a");
    retain(engine, source, "b", "match b");
    retain(engine, source, "c", "match c");
    store(engine, source, "b", "match B replacement");
    ASSERT_TRUE(engine.archive(source, "a").succeeded());
    ASSERT_TRUE(engine.forget(source, "b").succeeded());
    retain(engine, source, "d", "match d");

    EXPECT_EQ(snapshot_of(source.entries()),
              (std::vector<EntrySnapshot>{{"a", "match a", true},
                                          {"c", "match c", false},
                                          {"d", "match d", false}}));
    const auto matches =
        engine.search(source, LongTermMemoryQuery{"match"});
    EXPECT_EQ(snapshot_of(matches.matches()),
              (std::vector<EntrySnapshot>{{"c", "match c", false},
                                          {"d", "match d", false}}));

    LongTermMemory restored{"workspace"};
    ASSERT_TRUE(engine.restore(restored, source).succeeded());
    EXPECT_EQ(snapshot_of(restored, {"a", "b", "c", "d"}),
              snapshot_of(source, {"a", "b", "c", "d"}));
}

TEST(LongTermMemoryTransitionTest,
     OnlyExplicitOperationsChangeBaseState) {
    LongTermMemoryEngine engine;
    LongTermMemory memory{"workspace"};
    retain(engine, memory, "active", "value");
    retain(engine, memory, "archived", "value");
    ASSERT_TRUE(engine.archive(memory, "archived").succeeded());
    const auto before = snapshot_of(memory, {"active", "archived"});

    for (std::size_t repetition = 0U; repetition < 8U; ++repetition) {
        EXPECT_NE(memory.find("active"), nullptr);
        EXPECT_NE(memory.find("archived"), nullptr);
        EXPECT_EQ(memory.size(), 2U);
        EXPECT_EQ(memory.entries().size(), 2U);
        EXPECT_TRUE(engine.retrieve(memory, "active").succeeded());
        EXPECT_TRUE(engine.retrieve(memory, "archived").succeeded());
        EXPECT_TRUE(
            engine.search(memory, LongTermMemoryQuery{"value"}).succeeded());
    }

    EXPECT_EQ(snapshot_of(memory, {"active", "archived"}), before);
    EXPECT_FALSE(memory.find("active")->archived());
    EXPECT_TRUE(memory.find("archived")->archived());
}

TEST(LongTermMemoryIntegrityTest,
     RetainedKnowledgeChangesOnlyAsSpecified) {
    LongTermMemoryEngine engine;
    LongTermMemory memory{"workspace"};
    retain(engine, memory, "first", "immutable until store");
    retain(engine, memory, "second", "archive preserves this");
    const auto initial = snapshot_of(memory, {"first", "second"});

    ASSERT_TRUE(engine.retrieve(memory, "first").succeeded());
    ASSERT_TRUE(engine.search(memory, LongTermMemoryQuery{"preserves"})
                    .succeeded());
    EXPECT_EQ(snapshot_of(memory, {"first", "second"}), initial);

    ASSERT_TRUE(engine.archive(memory, "second").succeeded());
    ASSERT_NE(memory.find("second"), nullptr);
    EXPECT_EQ(memory.find("second")->identifier(), "second");
    EXPECT_EQ(memory.find("second")->value(), "archive preserves this");
    EXPECT_TRUE(memory.find("second")->archived());

    store(engine, memory, "first", "explicitly replaced");
    EXPECT_EQ(memory.entries().front().identifier(), "first");
    EXPECT_EQ(memory.entries().front().value(), "explicitly replaced");
    EXPECT_EQ(memory.workspaceIdentifier(), "workspace");
}

TEST(LongTermMemoryResultTest, CodesMessagesAndPayloadShapesAreExact) {
    LongTermMemoryEngine engine;
    LongTermMemory memory{"workspace"};

    const auto retained =
        engine.retain(memory, LongTermMemoryEntry{"entry", "value"});
    expect_entry_success(retained, "entry", "value", false);

    const auto searched = engine.search(memory, LongTermMemoryQuery{"entry"});
    ASSERT_TRUE(searched.succeeded());
    EXPECT_EQ(searched.code(), "OK");
    EXPECT_TRUE(searched.message().empty());
    EXPECT_EQ(searched.entry(), nullptr);
    ASSERT_EQ(searched.matches().size(), 1U);

    expect_failure(engine.retrieve(memory, ""), "INVALID_IDENTIFIER");
    expect_failure(engine.retrieve(memory, "missing"), "NOT_FOUND");
    expect_failure(
        engine.retain(memory, LongTermMemoryEntry{"entry", "different"}),
        "IDENTIFIER_CONFLICT");

    ASSERT_TRUE(engine.archive(memory, "entry").succeeded());
    expect_failure(engine.store(memory, LongTermMemoryEntry{"entry", "new"}),
                   "ARCHIVED");
    ASSERT_TRUE(engine.forget(memory, "entry").succeeded());
    expect_failure(engine.retain(memory, LongTermMemoryEntry{"entry", "new"}),
                   "FORGOTTEN_IDENTIFIER");

    LongTermMemory mismatch{"other-workspace"};
    expect_failure(engine.restore(mismatch, memory), "WORKSPACE_MISMATCH");
    LongTermMemory non_pristine{"workspace"};
    retain(engine, non_pristine, "target", "value");
    expect_failure(engine.restore(non_pristine, memory),
                   "RESTORE_TARGET_NOT_PRISTINE");

    const auto first_invalid = engine.retrieve(memory, "");
    const auto second_invalid = engine.retrieve(memory, "");
    EXPECT_EQ(first_invalid.message(), second_invalid.message());
    EXPECT_FALSE(first_invalid.message().empty());

    const auto forgotten = engine.forget(memory, "entry");
    expect_no_payload_success(forgotten);
}

TEST(LongTermMemoryOwnershipTest,
     ValuesCopiesMovesAndResultsAreIndependent) {
    LongTermMemoryEngine engine;
    LongTermMemory original{"workspace"};
    retain(engine, original, "forgotten", "old");
    retain(engine, original, "active", "value");
    ASSERT_TRUE(engine.forget(original, "forgotten").succeeded());

    LongTermMemory copy{original};
    store(engine, copy, "active", "copy-only");
    EXPECT_EQ(original.find("active")->value(), "value");
    EXPECT_EQ(copy.find("active")->value(), "copy-only");
    expect_failure(
        engine.retain(copy, LongTermMemoryEntry{"forgotten", "new"}),
        "FORGOTTEN_IDENTIFIER");

    const auto result = engine.retrieve(original, "active");
    ASSERT_NE(result.entry(), nullptr);
    ASSERT_TRUE(engine.forget(original, "active").succeeded());
    EXPECT_EQ(result.entry()->identifier(), "active");
    EXPECT_EQ(result.entry()->value(), "value");

    const auto before_move =
        snapshot_of(copy, {"forgotten", "active", "absent"});
    LongTermMemory moved{std::move(copy)};
    EXPECT_EQ(snapshot_of(moved, {"forgotten", "active", "absent"}),
              before_move);
    EXPECT_EQ(copy.workspaceIdentifier(), "workspace");
    EXPECT_EQ(copy.size(), 0U);
    EXPECT_TRUE(copy.entries().empty());
    expect_entry_success(
        engine.retain(copy, LongTermMemoryEntry{"forgotten", "reusable"}),
        "forgotten",
        "reusable",
        false);

    auto moved_result = engine.retrieve(moved, "active");
    LongTermMemoryResult destination{std::move(moved_result)};
    ASSERT_NE(destination.entry(), nullptr);
    EXPECT_EQ(destination.entry()->value(), "copy-only");
}

TEST(LongTermMemoryIsolationTest,
     WorkspacesAndEnginesDoNotShareState) {
    LongTermMemoryEngine first_engine;
    LongTermMemoryEngine second_engine;
    LongTermMemory first{"workspace-a"};
    LongTermMemory second{"workspace-b"};

    retain(first_engine, first, "same-id", "first");
    retain(second_engine, second, "same-id", "second");
    ASSERT_TRUE(first_engine.archive(first, "same-id").succeeded());

    ASSERT_NE(first.find("same-id"), nullptr);
    ASSERT_NE(second.find("same-id"), nullptr);
    EXPECT_TRUE(first.find("same-id")->archived());
    EXPECT_FALSE(second.find("same-id")->archived());
    EXPECT_EQ(first.find("same-id")->value(), "first");
    EXPECT_EQ(second.find("same-id")->value(), "second");

    LongTermMemory same_workspace_target{"workspace-a"};
    ASSERT_TRUE(second_engine.restore(same_workspace_target, first).succeeded());
    ASSERT_TRUE(second_engine.forget(same_workspace_target, "same-id")
                    .succeeded());
    EXPECT_NE(first.find("same-id"), nullptr);
}

TEST(LongTermMemoryIsolationTest, IndependentValuesSupportConcurrentUse) {
    constexpr std::size_t worker_count = 4U;
    std::array<bool, worker_count> succeeded{};
    std::array<std::thread, worker_count> workers;
    const LongTermMemoryEngine engine;

    for (std::size_t index = 0U; index < worker_count; ++index) {
        workers[index] = std::thread{[index, &engine, &succeeded] {
            LongTermMemory memory{"workspace-" + std::to_string(index)};
            const auto id = "entry-" + std::to_string(index);
            const auto value = "value-" + std::to_string(index);
            const auto retained =
                engine.retain(memory, LongTermMemoryEntry{id, value});
            const auto archived = engine.archive(memory, id);
            const auto retrieved = engine.retrieve(memory, id);
            succeeded[index] =
                retained.succeeded() && archived.succeeded() &&
                retrieved.succeeded() && retrieved.entry() != nullptr &&
                retrieved.entry()->identifier() == id &&
                retrieved.entry()->value() == value &&
                retrieved.entry()->archived() && memory.size() == 1U;
        }};
    }
    for (auto& worker : workers) {
        worker.join();
    }
    for (const auto completed : succeeded) {
        EXPECT_TRUE(completed);
    }
}

TEST(LongTermMemoryFailureTest,
     SemanticFailuresPreserveCompleteStateAndOtherCapabilities) {
    LongTermMemoryEngine engine;
    LongTermMemory memory{"workspace"};
    retain(engine, memory, "active", "value");
    retain(engine, memory, "archived", "archived value");
    retain(engine, memory, "forgotten", "forgotten value");
    ASSERT_TRUE(engine.archive(memory, "archived").succeeded());
    ASSERT_TRUE(engine.forget(memory, "forgotten").succeeded());

    Memory foundation{"workspace"};
    MemoryEngine foundation_engine;
    ASSERT_TRUE(foundation_engine
                    .store(foundation, MemoryEntry{"foundation", "value"})
                    .succeeded());
    WorkingMemory working{"workspace"};
    WorkingMemoryEngine working_engine;
    ASSERT_TRUE(working_engine.activate(working, "task").succeeded());
    ASSERT_TRUE(working_engine
                    .store(working,
                           WorkingMemoryEntry{"working", "temporary", 7U})
                    .succeeded());

    const auto foundation_before = snapshot_of(foundation);
    const auto working_before = snapshot_of(working);
    const std::vector<std::string_view> probes{
        "active", "archived", "forgotten", "absent"};

    const auto expect_unchanged_after_failure =
        [&](LongTermMemoryResult result,
            const std::string_view code,
            const StateSnapshot& before) {
            expect_failure(result, code);
            EXPECT_EQ(snapshot_of(memory, probes), before);
            EXPECT_EQ(snapshot_of(foundation), foundation_before);
            EXPECT_EQ(snapshot_of(working), working_before);
        };

    auto before = snapshot_of(memory, probes);
    expect_unchanged_after_failure(
        engine.retain(memory, LongTermMemoryEntry{"", "value"}),
        "INVALID_IDENTIFIER",
        before);
    expect_unchanged_after_failure(
        engine.retain(memory, LongTermMemoryEntry{"active", "different"}),
        "IDENTIFIER_CONFLICT",
        before);
    expect_unchanged_after_failure(
        engine.store(memory,
                     LongTermMemoryEntry{"archived", "replacement"}),
        "ARCHIVED",
        before);
    expect_unchanged_after_failure(
        engine.store(memory,
                     LongTermMemoryEntry{"forgotten", "replacement"}),
        "FORGOTTEN_IDENTIFIER",
        before);

    LongTermMemory different_workspace{"other-workspace"};
    retain(engine, different_workspace, "source", "value");
    const auto different_before = snapshot_of(different_workspace, {"source"});
    expect_unchanged_after_failure(engine.restore(memory, different_workspace),
                                   "WORKSPACE_MISMATCH",
                                   before);
    EXPECT_EQ(snapshot_of(different_workspace, {"source"}), different_before);

    EXPECT_EQ(snapshot_of(foundation), foundation_before);
    EXPECT_EQ(snapshot_of(working), working_before);
}

TEST(LongTermMemoryRuntimeTest,
     RuntimeLifecycleDoesNotOwnOrMutateMemory) {
    LongTermMemoryEngine engine;
    LongTermMemory memory{"workspace"};
    retain(engine, memory, "active", "value");
    retain(engine, memory, "archived", "value");
    ASSERT_TRUE(engine.archive(memory, "archived").succeeded());
    const auto before = snapshot_of(memory, {"active", "archived"});

    {
        auto runtime = cca::runtime::RuntimeBuilder{
                           cca::runtime::RuntimeId{"ltmem-runtime-one"}}
                           .build();
        ASSERT_NE(runtime, nullptr);
        ASSERT_TRUE(runtime->start().ok());
        EXPECT_EQ(snapshot_of(memory, {"active", "archived"}), before);
        ASSERT_TRUE(runtime->stop().ok());
    }
    EXPECT_EQ(snapshot_of(memory, {"active", "archived"}), before);

    {
        auto replacement = cca::runtime::RuntimeBuilder{
                               cca::runtime::RuntimeId{"ltmem-runtime-two"}}
                               .build();
        ASSERT_NE(replacement, nullptr);
        ASSERT_TRUE(replacement->start().ok());
        ASSERT_TRUE(replacement->stop().ok());
    }
    EXPECT_EQ(snapshot_of(memory, {"active", "archived"}), before);
}

TEST(LongTermMemoryPersistenceTest,
     RoundTripPreservesCompleteWorkspaceAssetState) {
    LongTermMemoryEngine engine;
    LongTermMemory source{"persistence-workspace"};
    retain(engine, source, "Durable-A", "first value");
    retain(engine, source, "Durable-B", "archived value");
    retain(engine, source, "Durable-C", "forgotten value");
    retain(engine, source, "Durable-D", "last value");
    ASSERT_TRUE(engine.archive(source, "Durable-B").succeeded());
    ASSERT_TRUE(engine.forget(source, "Durable-C").succeeded());
    const std::vector<std::string_view> probes{
        "Durable-A", "Durable-B", "Durable-C", "Durable-D", "Absent"};
    const auto source_before = snapshot_of(source, probes);

    auto projection =
        cca::memory::detail::LongTermMemoryPersistence::project(source);
    ASSERT_NE(projection, nullptr);
    auto directly_reconstructed =
        cca::memory::detail::LongTermMemoryPersistence::reconstruct(
            *projection);
    EXPECT_EQ(snapshot_of(directly_reconstructed, probes), source_before);

    auto reconstructed =
        cca::memory::detail::LongTermMemoryPersistence::roundTrip(source);
    EXPECT_EQ(snapshot_of(reconstructed, probes), source_before);
    EXPECT_EQ(snapshot_of(source, probes), source_before);

    LongTermMemory restored{"persistence-workspace"};
    expect_no_payload_success(engine.restore(restored, reconstructed));
    EXPECT_EQ(snapshot_of(restored, probes), source_before);
    EXPECT_TRUE(restored.find("Durable-B")->archived());
    EXPECT_EQ(identifier_disposition(restored, "Durable-C"), "FORGOTTEN");

    store(engine, reconstructed, "Durable-A", "independent reconstruction");
    EXPECT_EQ(source.find("Durable-A")->value(), "first value");
    EXPECT_EQ(restored.find("Durable-A")->value(), "first value");
}

TEST(LongTermMemoryDeterminismTest,
     EquivalentSequencesProduceEquivalentResultsAndState) {
    const auto execute = [](LongTermMemory& memory) {
        LongTermMemoryEngine engine;
        std::vector<ResultSnapshot> results;
        results.push_back(snapshot_of(engine.retain(
            memory, LongTermMemoryEntry{"first", "one"})));
        results.push_back(snapshot_of(engine.store(
            memory, LongTermMemoryEntry{"second", "two"})));
        results.push_back(snapshot_of(engine.store(
            memory, LongTermMemoryEntry{"first", "ONE"})));
        results.push_back(snapshot_of(engine.archive(memory, "second")));
        results.push_back(snapshot_of(
            engine.search(memory, LongTermMemoryQuery{"O"})));
        results.push_back(snapshot_of(engine.retrieve(memory, "second")));
        results.push_back(snapshot_of(engine.forget(memory, "first")));
        results.push_back(snapshot_of(engine.retain(
            memory, LongTermMemoryEntry{"first", "again"})));
        results.push_back(snapshot_of(engine.forget(memory, "absent")));
        return results;
    };

    LongTermMemory first{"workspace"};
    LongTermMemory second{"workspace"};
    const auto first_results = execute(first);
    const auto second_results = execute(second);

    EXPECT_EQ(first_results, second_results);
    EXPECT_EQ(snapshot_of(first, {"first", "second", "absent"}),
              snapshot_of(second, {"first", "second", "absent"}));
}

} // namespace
