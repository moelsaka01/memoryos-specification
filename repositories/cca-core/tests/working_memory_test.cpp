#include <cca/memory/memory.hpp>
#include <cca/memory/working_memory.hpp>

#include <gtest/gtest.h>

#include <cstddef>
#include <cstdint>
#include <limits>
#include <optional>
#include <stdexcept>
#include <string>
#include <string_view>
#include <type_traits>
#include <utility>
#include <vector>

/*
CCA-WMEM-1.0 requirement coverage
---------------------------------
CCA-WMEM-001: WorkingMemoryArchitectureTest (CTest)
CCA-WMEM-002: WorkingMemoryApiTest.PublicDeclarationsMatchTheFrozenContract
CCA-WMEM-003: WorkingMemoryApiTest.PublicDeclarationsMatchTheFrozenContract
CCA-WMEM-004: WorkingMemoryOwnershipTest.WorkspaceBoundaryIsRequiredAndImmutable
CCA-WMEM-005: WorkingMemoryIsolationTest.WorkspacesAndEnginesDoNotShareState
              and WorkingMemoryArchitectureTest (CTest)
CCA-WMEM-006: WorkingMemoryActivationTest.InitialStateAndActivationAreExact
CCA-WMEM-007: WorkingMemoryActivationTest.ReactivationIsIdempotentAndTaskSwitchClears
CCA-WMEM-008: WorkingMemoryPreconditionTest.InactiveStateTakesPrecedenceWithoutMutation
CCA-WMEM-009: WorkingMemoryStoreTest.CreatesAndReplacesCompleteEntriesInPlace
CCA-WMEM-010: WorkingMemoryRetrieveTest.UsesExactIdentifiersAndDoesNotMutate
CCA-WMEM-011: WorkingMemorySearchTest.MatchesIdentifierAndValueInInsertionOrder
CCA-WMEM-012: WorkingMemoryForgetTest.IsExactIdempotentAndPreservesSurvivorOrder
CCA-WMEM-013: WorkingMemoryExpirationTest.IsInclusiveOptionalAndOrderPreserving
CCA-WMEM-014: WorkingMemoryExpirationTest.IsOnlyExplicitAndRetainsNoLogicalClock
CCA-WMEM-015: WorkingMemoryOrderingTest.EquivalentSequencesProduceEquivalentObservations
CCA-WMEM-016: WorkingMemoryOwnershipTest.ValuesResultsCopiesAndMovesAreIndependent
CCA-WMEM-017: WorkingMemoryFailureTest.SemanticFailuresPreserveCompleteState
              and WorkingMemoryAllocationFailureTest (dedicated executable)
CCA-WMEM-018: WorkingMemoryIsolationTest.MemoryFoundationStateIsUntouched
              and WorkingMemoryArchitectureTest (CTest)
CCA-WMEM-019: WorkingMemoryArchitectureTest (CTest)
*/

namespace {

using cca::memory::Memory;
using cca::memory::MemoryEngine;
using cca::memory::MemoryEntry;
using cca::memory::WorkingMemory;
using cca::memory::WorkingMemoryEngine;
using cca::memory::WorkingMemoryEntry;
using cca::memory::WorkingMemoryQuery;
using cca::memory::WorkingMemoryResult;

struct EntrySnapshot final {
    std::string identifier;
    std::string value;
    std::optional<std::uint64_t> expiration_point;

    bool operator==(const EntrySnapshot&) const = default;
};

struct StateSnapshot final {
    std::string workspace_identifier;
    bool active;
    std::optional<std::string> task_identifier;
    std::vector<EntrySnapshot> entries;

    bool operator==(const StateSnapshot&) const = default;
};

struct FoundationEntrySnapshot final {
    std::string identifier;
    std::string value;

    bool operator==(const FoundationEntrySnapshot&) const = default;
};

[[nodiscard]] EntrySnapshot snapshot_of(const WorkingMemoryEntry& entry) {
    return EntrySnapshot{
        entry.identifier(), entry.value(), entry.expirationPoint()};
}

[[nodiscard]] std::vector<EntrySnapshot>
snapshot_of(const std::vector<WorkingMemoryEntry>& entries) {
    std::vector<EntrySnapshot> snapshot;
    snapshot.reserve(entries.size());
    for (const auto& entry : entries) {
        snapshot.push_back(snapshot_of(entry));
    }
    return snapshot;
}

[[nodiscard]] StateSnapshot snapshot_of(const WorkingMemory& memory) {
    return StateSnapshot{memory.workspaceIdentifier(),
                         memory.active(),
                         memory.activeTaskIdentifier(),
                         snapshot_of(memory.entries())};
}

[[nodiscard]] std::vector<FoundationEntrySnapshot>
snapshot_of(const Memory& memory) {
    std::vector<FoundationEntrySnapshot> snapshot;
    snapshot.reserve(memory.entries().size());
    for (const auto& entry : memory.entries()) {
        snapshot.push_back(
            FoundationEntrySnapshot{entry.identifier(), entry.value()});
    }
    return snapshot;
}

void expect_success_without_payload(const WorkingMemoryResult& result) {
    EXPECT_TRUE(result.succeeded()) << result.code() << ": "
                                    << result.message();
    EXPECT_EQ(result.code(), "OK");
    EXPECT_TRUE(result.message().empty());
    EXPECT_EQ(result.entry(), nullptr);
    EXPECT_TRUE(result.matches().empty());
}

void expect_failure(const WorkingMemoryResult& result,
                    const std::string_view expected_code) {
    EXPECT_FALSE(result.succeeded());
    EXPECT_EQ(result.code(), expected_code);
    EXPECT_FALSE(result.message().empty());
    EXPECT_EQ(result.entry(), nullptr);
    EXPECT_TRUE(result.matches().empty());
}

void activate(WorkingMemoryEngine& engine,
              WorkingMemory& memory,
              std::string task_identifier = "task") {
    const auto result = engine.activate(memory, std::move(task_identifier));
    expect_success_without_payload(result);
}

void store(WorkingMemoryEngine& engine,
           WorkingMemory& memory,
           std::string identifier,
           std::string value,
           std::optional<std::uint64_t> expiration_point = std::nullopt) {
    const auto result = engine.store(
        memory,
        WorkingMemoryEntry{std::move(identifier),
                           std::move(value),
                           expiration_point});
    ASSERT_TRUE(result.succeeded()) << result.code() << ": "
                                    << result.message();
    EXPECT_EQ(result.code(), "OK");
    EXPECT_TRUE(result.message().empty());
    ASSERT_NE(result.entry(), nullptr);
    EXPECT_TRUE(result.matches().empty());
}

TEST(WorkingMemoryApiTest, PublicDeclarationsMatchTheFrozenContract) {
    static_assert(std::is_constructible_v<WorkingMemoryEntry,
                                          std::string,
                                          std::string,
                                          std::optional<std::uint64_t>>);
    static_assert(std::is_constructible_v<WorkingMemoryEntry,
                                          std::string,
                                          std::string>);
    static_assert(std::is_constructible_v<WorkingMemoryQuery, std::string>);
    static_assert(!std::is_convertible_v<std::string, WorkingMemoryQuery>);

    static_assert(std::is_constructible_v<WorkingMemory, std::string>);
    static_assert(std::is_copy_constructible_v<WorkingMemory>);
    static_assert(!std::is_copy_assignable_v<WorkingMemory>);
    static_assert(std::is_nothrow_move_constructible_v<WorkingMemory>);
    static_assert(!std::is_move_assignable_v<WorkingMemory>);

    static_assert(!std::is_default_constructible_v<WorkingMemoryResult>);
    static_assert(std::is_nothrow_move_constructible_v<WorkingMemoryResult>);
    static_assert(std::is_nothrow_move_assignable_v<WorkingMemoryResult>);
    static_assert(!std::is_copy_constructible_v<WorkingMemoryResult>);
    static_assert(!std::is_copy_assignable_v<WorkingMemoryResult>);
    static_assert(std::is_empty_v<WorkingMemoryEngine>);

    using EntryIdentifier =
        const std::string& (WorkingMemoryEntry::*)() const noexcept;
    using EntryValue =
        const std::string& (WorkingMemoryEntry::*)() const noexcept;
    using EntryExpiration = const std::optional<std::uint64_t>& (
        WorkingMemoryEntry::*)() const noexcept;
    using QueryText =
        const std::string& (WorkingMemoryQuery::*)() const noexcept;
    using WorkspaceIdentifier =
        const std::string& (WorkingMemory::*)() const noexcept;
    using Active = bool (WorkingMemory::*)() const noexcept;
    using ActiveTask = const std::optional<std::string>& (
        WorkingMemory::*)() const noexcept;
    using MemorySize = std::size_t (WorkingMemory::*)() const noexcept;
    using MemoryFind = const WorkingMemoryEntry* (WorkingMemory::*)(
        std::string_view) const noexcept;
    using MemoryEntries = const std::vector<WorkingMemoryEntry>& (
        WorkingMemory::*)() const noexcept;
    using ResultSucceeded = bool (WorkingMemoryResult::*)() const noexcept;
    using ResultText =
        const std::string& (WorkingMemoryResult::*)() const noexcept;
    using ResultEntry =
        const WorkingMemoryEntry* (WorkingMemoryResult::*)() const noexcept;
    using ResultMatches = const std::vector<WorkingMemoryEntry>& (
        WorkingMemoryResult::*)() const noexcept;
    using Activate = WorkingMemoryResult (WorkingMemoryEngine::*)(
        WorkingMemory&, std::string) const;
    using Store = WorkingMemoryResult (WorkingMemoryEngine::*)(
        WorkingMemory&, WorkingMemoryEntry) const;
    using Retrieve = WorkingMemoryResult (WorkingMemoryEngine::*)(
        const WorkingMemory&, std::string_view) const;
    using Search = WorkingMemoryResult (WorkingMemoryEngine::*)(
        const WorkingMemory&, const WorkingMemoryQuery&) const;
    using Expire = WorkingMemoryResult (WorkingMemoryEngine::*)(
        WorkingMemory&, std::uint64_t) const;
    using Forget = WorkingMemoryResult (WorkingMemoryEngine::*)(
        WorkingMemory&, std::string_view) const;

    static_assert(std::is_same_v<decltype(&WorkingMemoryEntry::identifier),
                                 EntryIdentifier>);
    static_assert(std::is_same_v<decltype(&WorkingMemoryEntry::value),
                                 EntryValue>);
    static_assert(std::is_same_v<decltype(&WorkingMemoryEntry::expirationPoint),
                                 EntryExpiration>);
    static_assert(std::is_same_v<decltype(&WorkingMemoryQuery::text),
                                 QueryText>);
    static_assert(std::is_same_v<decltype(&WorkingMemory::workspaceIdentifier),
                                 WorkspaceIdentifier>);
    static_assert(std::is_same_v<decltype(&WorkingMemory::active), Active>);
    static_assert(std::is_same_v<decltype(&WorkingMemory::activeTaskIdentifier),
                                 ActiveTask>);
    static_assert(std::is_same_v<decltype(&WorkingMemory::size), MemorySize>);
    static_assert(std::is_same_v<decltype(&WorkingMemory::find), MemoryFind>);
    static_assert(std::is_same_v<decltype(&WorkingMemory::entries),
                                 MemoryEntries>);
    static_assert(std::is_same_v<decltype(&WorkingMemoryResult::succeeded),
                                 ResultSucceeded>);
    static_assert(std::is_same_v<decltype(&WorkingMemoryResult::code),
                                 ResultText>);
    static_assert(std::is_same_v<decltype(&WorkingMemoryResult::message),
                                 ResultText>);
    static_assert(std::is_same_v<decltype(&WorkingMemoryResult::entry),
                                 ResultEntry>);
    static_assert(std::is_same_v<decltype(&WorkingMemoryResult::matches),
                                 ResultMatches>);
    static_assert(std::is_same_v<decltype(&WorkingMemoryEngine::activate),
                                 Activate>);
    static_assert(std::is_same_v<decltype(&WorkingMemoryEngine::store), Store>);
    static_assert(std::is_same_v<decltype(&WorkingMemoryEngine::retrieve),
                                 Retrieve>);
    static_assert(std::is_same_v<decltype(&WorkingMemoryEngine::search), Search>);
    static_assert(std::is_same_v<decltype(&WorkingMemoryEngine::expire), Expire>);
    static_assert(std::is_same_v<decltype(&WorkingMemoryEngine::forget), Forget>);

    std::string identifier = "entry";
    std::string value = "value";
    std::string query_text = "needle";
    const WorkingMemoryEntry entry{
        identifier, value, std::uint64_t{42U}};
    const WorkingMemoryQuery query{query_text};
    identifier.assign("changed");
    value.assign("changed");
    query_text.assign("changed");

    EXPECT_EQ(entry.identifier(), "entry");
    EXPECT_EQ(entry.value(), "value");
    EXPECT_EQ(entry.expirationPoint(),
              std::optional<std::uint64_t>{std::uint64_t{42U}});
    EXPECT_EQ(query.text(), "needle");
}

TEST(WorkingMemoryOwnershipTest, WorkspaceBoundaryIsRequiredAndImmutable) {
    EXPECT_THROW(static_cast<void>(WorkingMemory{""}), std::invalid_argument);

    std::string workspace_identifier = "workspace-alpha";
    WorkingMemory memory{workspace_identifier};
    workspace_identifier.assign("caller-mutated");
    EXPECT_EQ(memory.workspaceIdentifier(), "workspace-alpha");

    WorkingMemoryEngine engine;
    activate(engine, memory, "task-alpha");
    store(engine, memory, "entry", "value", std::uint64_t{12U});

    const auto before = snapshot_of(memory);
    const auto invalid = engine.activate(memory, "");
    expect_failure(invalid, "INVALID_TASK_IDENTIFIER");
    EXPECT_EQ(snapshot_of(memory), before);
    EXPECT_EQ(memory.workspaceIdentifier(), "workspace-alpha");
}

TEST(WorkingMemoryActivationTest, InitialStateAndActivationAreExact) {
    WorkingMemory memory{"workspace"};
    WorkingMemoryEngine engine;

    EXPECT_FALSE(memory.active());
    EXPECT_FALSE(memory.activeTaskIdentifier().has_value());
    EXPECT_EQ(memory.size(), 0U);
    EXPECT_TRUE(memory.entries().empty());
    EXPECT_EQ(memory.find("anything"), nullptr);

    const auto invalid = engine.activate(memory, "");
    expect_failure(invalid, "INVALID_TASK_IDENTIFIER");
    EXPECT_FALSE(memory.active());
    EXPECT_FALSE(memory.activeTaskIdentifier().has_value());
    EXPECT_TRUE(memory.entries().empty());

    const auto activated = engine.activate(memory, "Task-A");
    expect_success_without_payload(activated);
    EXPECT_TRUE(memory.active());
    ASSERT_TRUE(memory.activeTaskIdentifier().has_value());
    EXPECT_EQ(*memory.activeTaskIdentifier(), "Task-A");
    EXPECT_EQ(memory.workspaceIdentifier(), "workspace");
    EXPECT_TRUE(memory.entries().empty());
}

TEST(WorkingMemoryActivationTest,
     ReactivationIsIdempotentAndTaskSwitchClears) {
    WorkingMemory memory{"workspace"};
    WorkingMemoryEngine engine;
    activate(engine, memory, "Task-A");
    store(engine, memory, "first", "one", std::uint64_t{4U});
    store(engine, memory, "second", "two");
    const auto populated = snapshot_of(memory);

    const auto same_task = engine.activate(memory, "Task-A");
    expect_success_without_payload(same_task);
    EXPECT_EQ(snapshot_of(memory), populated);

    const auto different_case = engine.activate(memory, "task-a");
    expect_success_without_payload(different_case);
    EXPECT_TRUE(memory.active());
    ASSERT_TRUE(memory.activeTaskIdentifier().has_value());
    EXPECT_EQ(*memory.activeTaskIdentifier(), "task-a");
    EXPECT_TRUE(memory.entries().empty());
    EXPECT_EQ(memory.size(), 0U);
    EXPECT_EQ(memory.workspaceIdentifier(), "workspace");
}

TEST(WorkingMemoryPreconditionTest,
     InactiveStateTakesPrecedenceWithoutMutation) {
    WorkingMemory memory{"workspace"};
    WorkingMemoryEngine engine;
    const auto initial = snapshot_of(memory);

    const auto stored =
        engine.store(memory, WorkingMemoryEntry{"", "rejected"});
    expect_failure(stored, "NOT_ACTIVE");
    EXPECT_EQ(snapshot_of(memory), initial);

    const auto retrieved = engine.retrieve(memory, "");
    expect_failure(retrieved, "NOT_ACTIVE");
    EXPECT_EQ(snapshot_of(memory), initial);

    const auto searched = engine.search(memory, WorkingMemoryQuery{""});
    expect_failure(searched, "NOT_ACTIVE");
    EXPECT_EQ(snapshot_of(memory), initial);

    const auto expired = engine.expire(memory, std::uint64_t{0U});
    expect_failure(expired, "NOT_ACTIVE");
    EXPECT_EQ(snapshot_of(memory), initial);

    const auto forgotten = engine.forget(memory, "");
    expect_failure(forgotten, "NOT_ACTIVE");
    EXPECT_EQ(snapshot_of(memory), initial);

    const auto repeated = engine.retrieve(memory, "");
    EXPECT_EQ(repeated.code(), retrieved.code());
    EXPECT_EQ(repeated.message(), retrieved.message());
}

TEST(WorkingMemoryStoreTest, CreatesAndReplacesCompleteEntriesInPlace) {
    WorkingMemory memory{"workspace"};
    WorkingMemoryEngine engine;
    activate(engine, memory);

    auto first_result = engine.store(
        memory,
        WorkingMemoryEntry{"alpha", "original", std::uint64_t{5U}});
    ASSERT_TRUE(first_result.succeeded()) << first_result.message();
    ASSERT_NE(first_result.entry(), nullptr);
    EXPECT_EQ(snapshot_of(*first_result.entry()),
              (EntrySnapshot{"alpha", "original", std::uint64_t{5U}}));
    EXPECT_TRUE(first_result.matches().empty());

    store(engine, memory, "beta", "second");
    store(engine, memory, "gamma", "third", std::uint64_t{9U});

    auto replacement = engine.store(
        memory,
        WorkingMemoryEntry{"beta", "replacement", std::uint64_t{7U}});
    ASSERT_TRUE(replacement.succeeded()) << replacement.message();
    ASSERT_NE(replacement.entry(), nullptr);
    EXPECT_EQ(snapshot_of(*replacement.entry()),
              (EntrySnapshot{"beta", "replacement", std::uint64_t{7U}}));

    EXPECT_EQ(snapshot_of(memory.entries()),
              (std::vector<EntrySnapshot>{
                  {"alpha", "original", std::uint64_t{5U}},
                  {"beta", "replacement", std::uint64_t{7U}},
                  {"gamma", "third", std::uint64_t{9U}},
              }));
    EXPECT_EQ(memory.size(), 3U);
    ASSERT_NE(memory.find("beta"), nullptr);
    EXPECT_EQ(memory.find("beta")->value(), "replacement");
    EXPECT_EQ(memory.find("Beta"), nullptr);

    store(engine, memory, "alpha", "no-expiration");
    ASSERT_NE(memory.find("alpha"), nullptr);
    EXPECT_FALSE(memory.find("alpha")->expirationPoint().has_value());

    EXPECT_EQ(snapshot_of(*first_result.entry()),
              (EntrySnapshot{"alpha", "original", std::uint64_t{5U}}));
}

TEST(WorkingMemoryRetrieveTest, UsesExactIdentifiersAndDoesNotMutate) {
    WorkingMemory memory{"workspace"};
    WorkingMemoryEngine engine;
    activate(engine, memory);
    store(engine,
          memory,
          "CaseSensitive",
          "payload",
          std::numeric_limits<std::uint64_t>::max());
    const auto before = snapshot_of(memory);

    auto found = engine.retrieve(memory, "CaseSensitive");
    ASSERT_TRUE(found.succeeded()) << found.message();
    EXPECT_EQ(found.code(), "OK");
    EXPECT_TRUE(found.message().empty());
    ASSERT_NE(found.entry(), nullptr);
    EXPECT_TRUE(found.matches().empty());
    EXPECT_EQ(snapshot_of(*found.entry()),
              (EntrySnapshot{"CaseSensitive",
                             "payload",
                             std::numeric_limits<std::uint64_t>::max()}));

    const auto absent = engine.retrieve(memory, "casesensitive");
    expect_failure(absent, "NOT_FOUND");
    EXPECT_EQ(snapshot_of(memory), before);

    const auto repeated = engine.retrieve(memory, "casesensitive");
    EXPECT_EQ(repeated.code(), absent.code());
    EXPECT_EQ(repeated.message(), absent.message());

    store(engine, memory, "CaseSensitive", "changed");
    EXPECT_EQ(snapshot_of(*found.entry()),
              (EntrySnapshot{"CaseSensitive",
                             "payload",
                             std::numeric_limits<std::uint64_t>::max()}));
}

TEST(WorkingMemorySearchTest,
     MatchesIdentifierAndValueInInsertionOrder) {
    WorkingMemory memory{"workspace"};
    WorkingMemoryEngine engine;
    activate(engine, memory);
    store(engine, memory, "first-needle", "unrelated");
    store(engine, memory, "second", "contains needle value");
    store(engine, memory, "Needle-case", "case-sensitive miss");
    store(engine, memory, "fourth-needle", "needle twice");
    const auto before = snapshot_of(memory);

    auto result = engine.search(memory, WorkingMemoryQuery{"needle"});
    ASSERT_TRUE(result.succeeded()) << result.message();
    EXPECT_EQ(result.code(), "OK");
    EXPECT_TRUE(result.message().empty());
    EXPECT_EQ(result.entry(), nullptr);
    EXPECT_EQ(snapshot_of(result.matches()),
              (std::vector<EntrySnapshot>{
                  {"first-needle", "unrelated", std::nullopt},
                  {"second", "contains needle value", std::nullopt},
                  {"fourth-needle", "needle twice", std::nullopt},
              }));

    const auto no_match =
        engine.search(memory, WorkingMemoryQuery{"not-present"});
    EXPECT_TRUE(no_match.succeeded());
    EXPECT_EQ(no_match.code(), "OK");
    EXPECT_TRUE(no_match.matches().empty());

    const auto all = engine.search(memory, WorkingMemoryQuery{""});
    EXPECT_TRUE(all.succeeded());
    EXPECT_EQ(snapshot_of(all.matches()), before.entries);
    EXPECT_EQ(snapshot_of(memory), before);

    const auto forgotten = engine.forget(memory, "first-needle");
    expect_success_without_payload(forgotten);
    EXPECT_EQ(snapshot_of(result.matches()),
              (std::vector<EntrySnapshot>{
                  {"first-needle", "unrelated", std::nullopt},
                  {"second", "contains needle value", std::nullopt},
                  {"fourth-needle", "needle twice", std::nullopt},
              }));
}

TEST(WorkingMemoryForgetTest,
     IsExactIdempotentAndPreservesSurvivorOrder) {
    WorkingMemory memory{"workspace"};
    WorkingMemoryEngine engine;
    activate(engine, memory);
    store(engine, memory, "first", "one");
    store(engine, memory, "Second", "two", std::uint64_t{2U});
    store(engine, memory, "third", "three");

    const auto wrong_case = engine.forget(memory, "second");
    expect_success_without_payload(wrong_case);
    EXPECT_EQ(memory.size(), 3U);

    const auto removed = engine.forget(memory, "Second");
    expect_success_without_payload(removed);
    EXPECT_EQ(snapshot_of(memory.entries()),
              (std::vector<EntrySnapshot>{
                  {"first", "one", std::nullopt},
                  {"third", "three", std::nullopt},
              }));

    const auto before_absent = snapshot_of(memory);
    const auto absent = engine.forget(memory, "Second");
    expect_success_without_payload(absent);
    EXPECT_EQ(snapshot_of(memory), before_absent);

    store(engine, memory, "Second", "restored", std::uint64_t{8U});
    EXPECT_EQ(snapshot_of(memory.entries()),
              (std::vector<EntrySnapshot>{
                  {"first", "one", std::nullopt},
                  {"third", "three", std::nullopt},
                  {"Second", "restored", std::uint64_t{8U}},
              }));
}

TEST(WorkingMemoryExpirationTest,
     IsInclusiveOptionalAndOrderPreserving) {
    WorkingMemory memory{"workspace"};
    WorkingMemoryEngine engine;
    activate(engine, memory);
    store(engine, memory, "persistent-first", "a");
    store(engine, memory, "zero", "b", std::uint64_t{0U});
    store(engine, memory, "ten-first", "c", std::uint64_t{10U});
    store(engine, memory, "later", "d", std::uint64_t{11U});
    store(engine, memory, "persistent-second", "e");
    store(engine, memory, "ten-second", "f", std::uint64_t{10U});
    store(engine,
          memory,
          "maximum",
          "g",
          std::numeric_limits<std::uint64_t>::max());

    auto expired = engine.expire(memory, std::uint64_t{10U});
    ASSERT_TRUE(expired.succeeded()) << expired.message();
    EXPECT_EQ(expired.code(), "OK");
    EXPECT_TRUE(expired.message().empty());
    EXPECT_EQ(expired.entry(), nullptr);
    EXPECT_EQ(snapshot_of(expired.matches()),
              (std::vector<EntrySnapshot>{
                  {"zero", "b", std::uint64_t{0U}},
                  {"ten-first", "c", std::uint64_t{10U}},
                  {"ten-second", "f", std::uint64_t{10U}},
              }));
    EXPECT_EQ(snapshot_of(memory.entries()),
              (std::vector<EntrySnapshot>{
                  {"persistent-first", "a", std::nullopt},
                  {"later", "d", std::uint64_t{11U}},
                  {"persistent-second", "e", std::nullopt},
                  {"maximum",
                   "g",
                   std::numeric_limits<std::uint64_t>::max()},
              }));

    store(engine, memory, "after-expiration", "new");
    EXPECT_EQ(snapshot_of(expired.matches()),
              (std::vector<EntrySnapshot>{
                  {"zero", "b", std::uint64_t{0U}},
                  {"ten-first", "c", std::uint64_t{10U}},
                  {"ten-second", "f", std::uint64_t{10U}},
              }));
}

TEST(WorkingMemoryExpirationTest,
     IsOnlyExplicitAndRetainsNoLogicalClock) {
    WorkingMemory memory{"workspace"};
    WorkingMemoryEngine engine;
    activate(engine, memory);
    store(engine, memory, "already-due", "visible", std::uint64_t{1U});

    const auto retrieved = engine.retrieve(memory, "already-due");
    ASSERT_TRUE(retrieved.succeeded()) << retrieved.message();
    const auto searched = engine.search(memory, WorkingMemoryQuery{"due"});
    ASSERT_TRUE(searched.succeeded()) << searched.message();
    EXPECT_EQ(searched.matches().size(), 1U);
    EXPECT_EQ(memory.size(), 1U);

    const auto no_due = engine.expire(memory, std::uint64_t{0U});
    EXPECT_TRUE(no_due.succeeded());
    EXPECT_TRUE(no_due.matches().empty());
    EXPECT_EQ(memory.size(), 1U);

    const auto due = engine.expire(memory, std::uint64_t{1U});
    ASSERT_TRUE(due.succeeded()) << due.message();
    ASSERT_EQ(due.matches().size(), 1U);
    EXPECT_EQ(due.matches().front().identifier(), "already-due");
    EXPECT_TRUE(memory.entries().empty());

    const auto repeated = engine.expire(memory, std::uint64_t{1U});
    EXPECT_TRUE(repeated.succeeded());
    EXPECT_TRUE(repeated.matches().empty());

    store(engine, memory, "lower-after-higher", "new", std::uint64_t{0U});
    ASSERT_NE(memory.find("lower-after-higher"), nullptr);
    const auto lower = engine.expire(memory, std::uint64_t{0U});
    ASSERT_TRUE(lower.succeeded()) << lower.message();
    ASSERT_EQ(lower.matches().size(), 1U);
    EXPECT_EQ(lower.matches().front().identifier(), "lower-after-higher");
    EXPECT_TRUE(memory.entries().empty());
}

TEST(WorkingMemoryOwnershipTest,
     ValuesResultsCopiesAndMovesAreIndependent) {
    std::string identifier = "owned-id";
    std::string value = "owned-value";
    WorkingMemoryEntry supplied{
        identifier, value, std::uint64_t{15U}};
    identifier.assign("caller-mutated-id");
    value.assign("caller-mutated-value");
    EXPECT_EQ(supplied.identifier(), "owned-id");
    EXPECT_EQ(supplied.value(), "owned-value");

    WorkingMemoryEngine engine;
    WorkingMemory original{"workspace"};
    activate(engine, original, "task");
    auto stored = engine.store(original, std::move(supplied));
    ASSERT_TRUE(stored.succeeded()) << stored.message();
    ASSERT_NE(stored.entry(), nullptr);

    WorkingMemory copied{original};
    EXPECT_EQ(snapshot_of(copied), snapshot_of(original));
    store(engine, original, "owned-id", "changed", std::uint64_t{3U});
    EXPECT_NE(snapshot_of(copied), snapshot_of(original));
    ASSERT_NE(copied.find("owned-id"), nullptr);
    EXPECT_EQ(copied.find("owned-id")->value(), "owned-value");

    const auto copied_before_move = snapshot_of(copied);
    WorkingMemory moved{std::move(copied)};
    EXPECT_EQ(snapshot_of(moved), copied_before_move);
    EXPECT_EQ(copied.workspaceIdentifier(), "workspace");
    EXPECT_FALSE(copied.active());
    EXPECT_FALSE(copied.activeTaskIdentifier().has_value());
    EXPECT_TRUE(copied.entries().empty());

    const auto forgotten = engine.forget(moved, "owned-id");
    expect_success_without_payload(forgotten);
    EXPECT_TRUE(moved.entries().empty());
    EXPECT_EQ(snapshot_of(*stored.entry()),
              (EntrySnapshot{"owned-id", "owned-value", std::uint64_t{15U}}));

    auto moved_result = std::move(stored);
    ASSERT_NE(moved_result.entry(), nullptr);
    EXPECT_EQ(moved_result.entry()->value(), "owned-value");

    auto assigned_result = engine.search(original, WorkingMemoryQuery{"nope"});
    assigned_result = std::move(moved_result);
    ASSERT_NE(assigned_result.entry(), nullptr);
    EXPECT_EQ(snapshot_of(*assigned_result.entry()),
              (EntrySnapshot{"owned-id", "owned-value", std::uint64_t{15U}}));
}

TEST(WorkingMemoryIsolationTest, WorkspacesAndEnginesDoNotShareState) {
    WorkingMemoryEngine first_engine;
    WorkingMemoryEngine second_engine;
    WorkingMemory first{"workspace-one"};
    WorkingMemory second{"workspace-two"};
    activate(first_engine, first, "first-task");
    activate(second_engine, second, "second-task");
    store(first_engine, first, "first-entry", "first-value");
    store(second_engine, second, "second-entry", "second-value");

    const auto first_before = snapshot_of(first);
    const auto second_before = snapshot_of(second);

    const auto first_via_second_engine =
        second_engine.retrieve(first, "first-entry");
    ASSERT_TRUE(first_via_second_engine.succeeded())
        << first_via_second_engine.message();
    ASSERT_NE(first_via_second_engine.entry(), nullptr);
    EXPECT_EQ(first_via_second_engine.entry()->value(), "first-value");

    const auto missing_cross_workspace =
        first_engine.retrieve(second, "first-entry");
    expect_failure(missing_cross_workspace, "NOT_FOUND");
    EXPECT_EQ(snapshot_of(first), first_before);
    EXPECT_EQ(snapshot_of(second), second_before);

    const auto switched = first_engine.activate(first, "replacement-task");
    expect_success_without_payload(switched);
    EXPECT_TRUE(first.entries().empty());
    EXPECT_EQ(snapshot_of(second), second_before);
}

TEST(WorkingMemoryIsolationTest, MemoryFoundationStateIsUntouched) {
    Memory foundation_memory{"workspace"};
    MemoryEngine foundation_engine;
    ASSERT_TRUE(foundation_engine
                    .store(foundation_memory,
                           MemoryEntry{"foundation-entry",
                                       "foundation-value"})
                    .succeeded());
    const auto foundation_before = snapshot_of(foundation_memory);

    WorkingMemory working_memory{"workspace"};
    WorkingMemoryEngine working_engine;
    activate(working_engine, working_memory, "task");
    store(working_engine, working_memory, "temporary", "working-value");
    ASSERT_TRUE(working_engine
                    .search(working_memory, WorkingMemoryQuery{"working"})
                    .succeeded());
    ASSERT_TRUE(working_engine
                    .expire(working_memory,
                            std::numeric_limits<std::uint64_t>::max())
                    .succeeded());
    ASSERT_TRUE(working_engine.forget(working_memory, "temporary").succeeded());
    ASSERT_TRUE(working_engine.activate(working_memory, "other-task").succeeded());

    EXPECT_EQ(snapshot_of(foundation_memory), foundation_before);
    ASSERT_NE(foundation_memory.find("foundation-entry"), nullptr);
    EXPECT_EQ(foundation_memory.find("foundation-entry")->value(),
              "foundation-value");
}

TEST(WorkingMemoryFailureTest,
     SemanticFailuresPreserveCompleteState) {
    WorkingMemory memory{"workspace"};
    WorkingMemoryEngine engine;
    activate(engine, memory, "task");
    store(engine, memory, "first", "one", std::uint64_t{1U});
    store(engine, memory, "second", "two");
    const auto before = snapshot_of(memory);

    const auto invalid_store =
        engine.store(memory, WorkingMemoryEntry{"", "rejected", 2U});
    expect_failure(invalid_store, "INVALID_IDENTIFIER");
    EXPECT_EQ(snapshot_of(memory), before);

    const auto invalid_retrieve = engine.retrieve(memory, "");
    expect_failure(invalid_retrieve, "INVALID_IDENTIFIER");
    EXPECT_EQ(snapshot_of(memory), before);

    const auto invalid_forget = engine.forget(memory, "");
    expect_failure(invalid_forget, "INVALID_IDENTIFIER");
    EXPECT_EQ(snapshot_of(memory), before);

    const auto absent = engine.retrieve(memory, "absent");
    expect_failure(absent, "NOT_FOUND");
    EXPECT_EQ(snapshot_of(memory), before);

    const auto repeated_store =
        engine.store(memory, WorkingMemoryEntry{"", "different", 99U});
    EXPECT_EQ(repeated_store.code(), invalid_store.code());
    EXPECT_EQ(repeated_store.message(), invalid_store.message());
    EXPECT_EQ(snapshot_of(memory), before);
}

struct DeterministicObservation final {
    std::vector<std::string> codes;
    std::vector<std::string> messages;
    std::vector<std::vector<EntrySnapshot>> result_sequences;
    StateSnapshot final_state;

    bool operator==(const DeterministicObservation&) const = default;
};

[[nodiscard]] DeterministicObservation
run_deterministic_sequence(WorkingMemoryEngine& engine,
                           WorkingMemory& memory) {
    DeterministicObservation observation;
    const auto observe_result = [&observation](
                                    const WorkingMemoryResult& result) {
        observation.codes.push_back(result.code());
        observation.messages.push_back(result.message());
        if (result.entry() != nullptr) {
            observation.result_sequences.push_back({snapshot_of(*result.entry())});
        } else {
            observation.result_sequences.push_back(snapshot_of(result.matches()));
        }
    };

    const auto activated = engine.activate(memory, "task");
    observe_result(activated);
    const auto alpha = engine.store(
        memory, WorkingMemoryEntry{"alpha", "match-a", std::uint64_t{5U}});
    observe_result(alpha);
    const auto beta = engine.store(
        memory, WorkingMemoryEntry{"beta", "match-b", std::uint64_t{2U}});
    observe_result(beta);
    const auto gamma = engine.store(
        memory, WorkingMemoryEntry{"gamma", "match-c"});
    observe_result(gamma);
    const auto replaced = engine.store(
        memory,
        WorkingMemoryEntry{"alpha", "match-replaced", std::uint64_t{7U}});
    observe_result(replaced);
    const auto search = engine.search(memory, WorkingMemoryQuery{"match"});
    observe_result(search);
    const auto expired = engine.expire(memory, std::uint64_t{2U});
    observe_result(expired);
    const auto forgotten = engine.forget(memory, "gamma");
    observe_result(forgotten);
    const auto absent = engine.retrieve(memory, "gamma");
    observe_result(absent);

    observation.final_state = snapshot_of(memory);
    return observation;
}

TEST(WorkingMemoryOrderingTest,
     EquivalentSequencesProduceEquivalentObservations) {
    WorkingMemoryEngine first_engine;
    WorkingMemoryEngine second_engine;
    WorkingMemory first{"workspace"};
    WorkingMemory second{"workspace"};

    const auto first_observation =
        run_deterministic_sequence(first_engine, first);
    const auto second_observation =
        run_deterministic_sequence(second_engine, second);

    EXPECT_EQ(first_observation, second_observation);
    EXPECT_TRUE(first.active());
    ASSERT_TRUE(first.activeTaskIdentifier().has_value());
    EXPECT_EQ(*first.activeTaskIdentifier(), "task");
    EXPECT_EQ(snapshot_of(first.entries()),
              (std::vector<EntrySnapshot>{
                  {"alpha", "match-replaced", std::uint64_t{7U}},
              }));
}

} // namespace
