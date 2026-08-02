#include <cca/memory/memory.hpp>

#include <gtest/gtest.h>

#include <cstddef>
#include <string>
#include <string_view>
#include <type_traits>
#include <utility>
#include <vector>

/*
CCA-MEM-1.0 requirement coverage
--------------------------------
CCA-MEM-001: MemoryArchitectureTest (CTest) and
             MemoryApiTest.PublicDeclarationsMatchTheFrozenContract
CCA-MEM-002: MemoryApiTest.PublicDeclarationsMatchTheFrozenContract
CCA-MEM-003: MemoryApiTest.PublicDeclarationsMatchTheFrozenContract
CCA-MEM-004: MemoryStoreTest.CreatesAndAtomicallyReplacesEntries
CCA-MEM-005: MemoryRetrieveTest.UsesExactCaseSensitiveIdentifiers
CCA-MEM-006: MemorySearchTest.MatchesIdentifiersAndValuesInInsertionOrder
CCA-MEM-007: MemoryForgetTest.IsIdempotentAndRestorageAppends
CCA-MEM-008: MemoryOwnershipTest.ValuesResultsAndInstancesAreIndependent
CCA-MEM-009: MemoryStoreTest.InvalidIdentifierLeavesMemoryUnchanged
CCA-MEM-010: MemoryOwnershipTest.WorkspaceBoundaryIsRequiredAndImmutable
CCA-MEM-011: MemoryOrderingTest.ReplacementPreservesDeterministicOrdering
*/

namespace {

using cca::memory::Memory;
using cca::memory::MemoryEngine;
using cca::memory::MemoryEntry;
using cca::memory::MemoryQuery;
using cca::memory::MemoryResult;

struct EntrySnapshot final {
    std::string identifier;
    std::string value;

    bool operator==(const EntrySnapshot&) const = default;
};

[[nodiscard]] EntrySnapshot snapshot_of(const MemoryEntry& entry) {
    return EntrySnapshot{entry.identifier(), entry.value()};
}

[[nodiscard]] std::vector<EntrySnapshot>
snapshot_of(const std::vector<MemoryEntry>& entries) {
    std::vector<EntrySnapshot> snapshot;
    snapshot.reserve(entries.size());
    for (const auto& entry : entries) {
        snapshot.push_back(snapshot_of(entry));
    }
    return snapshot;
}

[[nodiscard]] std::vector<EntrySnapshot> snapshot_of(const Memory& memory) {
    return snapshot_of(memory.entries());
}

void store(MemoryEngine& engine,
           Memory& memory,
           std::string identifier,
           std::string value) {
    const auto result = engine.store(
        memory, MemoryEntry{std::move(identifier), std::move(value)});
    ASSERT_TRUE(result.succeeded()) << result.code() << ": "
                                    << result.message();
    EXPECT_EQ(result.code(), "OK");
}

TEST(MemoryApiTest, PublicDeclarationsMatchTheFrozenContract) {
    static_assert(std::is_constructible_v<MemoryEntry,
                                          std::string,
                                          std::string>);
    static_assert(std::is_constructible_v<MemoryQuery, std::string>);
    static_assert(!std::is_convertible_v<std::string, MemoryQuery>);

    static_assert(std::is_constructible_v<Memory, std::string>);
    static_assert(std::is_copy_constructible_v<Memory>);
    static_assert(!std::is_copy_assignable_v<Memory>);
    static_assert(std::is_nothrow_move_constructible_v<Memory>);
    static_assert(!std::is_move_assignable_v<Memory>);

    static_assert(std::is_nothrow_move_constructible_v<MemoryResult>);
    static_assert(std::is_nothrow_move_assignable_v<MemoryResult>);
    static_assert(!std::is_copy_constructible_v<MemoryResult>);
    static_assert(!std::is_copy_assignable_v<MemoryResult>);

    using EntryIdentifier =
        const std::string& (MemoryEntry::*)() const noexcept;
    using EntryValue = const std::string& (MemoryEntry::*)() const noexcept;
    using QueryText = const std::string& (MemoryQuery::*)() const noexcept;
    using WorkspaceIdentifier =
        const std::string& (Memory::*)() const noexcept;
    using MemorySize = std::size_t (Memory::*)() const noexcept;
    using MemoryFind =
        const MemoryEntry* (Memory::*)(std::string_view) const noexcept;
    using MemoryEntries =
        const std::vector<MemoryEntry>& (Memory::*)() const noexcept;
    using ResultSucceeded = bool (MemoryResult::*)() const noexcept;
    using ResultText = const std::string& (MemoryResult::*)() const noexcept;
    using ResultEntry =
        const MemoryEntry* (MemoryResult::*)() const noexcept;
    using ResultMatches =
        const std::vector<MemoryEntry>& (MemoryResult::*)() const noexcept;
    using Store = MemoryResult (MemoryEngine::*)(Memory&, MemoryEntry) const;
    using Retrieve = MemoryResult (MemoryEngine::*)(
        const Memory&, std::string_view) const;
    using Search = MemoryResult (MemoryEngine::*)(
        const Memory&, const MemoryQuery&) const;
    using Forget = MemoryResult (MemoryEngine::*)(
        Memory&, std::string_view) const;

    static_assert(std::is_same_v<decltype(&MemoryEntry::identifier),
                                 EntryIdentifier>);
    static_assert(std::is_same_v<decltype(&MemoryEntry::value), EntryValue>);
    static_assert(std::is_same_v<decltype(&MemoryQuery::text), QueryText>);
    static_assert(std::is_same_v<decltype(&Memory::workspaceIdentifier),
                                 WorkspaceIdentifier>);
    static_assert(std::is_same_v<decltype(&Memory::size), MemorySize>);
    static_assert(std::is_same_v<decltype(&Memory::find), MemoryFind>);
    static_assert(std::is_same_v<decltype(&Memory::entries), MemoryEntries>);
    static_assert(std::is_same_v<decltype(&MemoryResult::succeeded),
                                 ResultSucceeded>);
    static_assert(std::is_same_v<decltype(&MemoryResult::code), ResultText>);
    static_assert(std::is_same_v<decltype(&MemoryResult::message), ResultText>);
    static_assert(std::is_same_v<decltype(&MemoryResult::entry), ResultEntry>);
    static_assert(std::is_same_v<decltype(&MemoryResult::matches),
                                 ResultMatches>);
    static_assert(std::is_same_v<decltype(&MemoryEngine::store), Store>);
    static_assert(std::is_same_v<decltype(&MemoryEngine::retrieve), Retrieve>);
    static_assert(std::is_same_v<decltype(&MemoryEngine::search), Search>);
    static_assert(std::is_same_v<decltype(&MemoryEngine::forget), Forget>);

    const MemoryEntry entry{"entry", "value"};
    const MemoryQuery query{"needle"};
    EXPECT_EQ(entry.identifier(), "entry");
    EXPECT_EQ(entry.value(), "value");
    EXPECT_EQ(query.text(), "needle");
}

TEST(MemoryOwnershipTest, WorkspaceBoundaryIsRequiredAndImmutable) {
    EXPECT_ANY_THROW(static_cast<void>(Memory{""}));

    MemoryEngine engine;
    Memory original{"workspace-alpha"};
    store(engine, original, "one", "first");

    Memory copied{original};
    EXPECT_EQ(copied.workspaceIdentifier(), "workspace-alpha");
    EXPECT_EQ(snapshot_of(copied), snapshot_of(original));

    Memory moved{std::move(copied)};
    EXPECT_EQ(moved.workspaceIdentifier(), "workspace-alpha");
    EXPECT_EQ(snapshot_of(moved), snapshot_of(original));
}

TEST(MemoryStoreTest, CreatesAndAtomicallyReplacesEntries) {
    Memory memory{"workspace"};
    MemoryEngine engine;

    store(engine, memory, "alpha", "one");
    store(engine, memory, "beta", "two");
    ASSERT_EQ(memory.size(), 2U);
    ASSERT_NE(memory.find("alpha"), nullptr);
    EXPECT_EQ(memory.find("alpha")->value(), "one");

    store(engine, memory, "alpha", "replacement");
    EXPECT_EQ(memory.size(), 2U);
    ASSERT_NE(memory.find("alpha"), nullptr);
    EXPECT_EQ(memory.find("alpha")->value(), "replacement");
    EXPECT_EQ(snapshot_of(memory),
              (std::vector<EntrySnapshot>{{"alpha", "replacement"},
                                          {"beta", "two"}}));
}

TEST(MemoryStoreTest, InvalidIdentifierLeavesMemoryUnchanged) {
    Memory memory{"workspace"};
    MemoryEngine engine;
    store(engine, memory, "stable", "value");
    const auto before = snapshot_of(memory);

    const auto first = engine.store(memory, MemoryEntry{"", "rejected"});
    EXPECT_FALSE(first.succeeded());
    EXPECT_EQ(first.code(), "INVALID_IDENTIFIER");
    EXPECT_EQ(snapshot_of(memory), before);

    const auto second = engine.store(memory, MemoryEntry{"", "different"});
    EXPECT_FALSE(second.succeeded());
    EXPECT_EQ(second.code(), first.code());
    EXPECT_EQ(second.message(), first.message());
    EXPECT_EQ(snapshot_of(memory), before);
}

TEST(MemoryRetrieveTest, UsesExactCaseSensitiveIdentifiers) {
    Memory memory{"workspace"};
    MemoryEngine engine;
    store(engine, memory, "CaseSensitive", "payload");
    const auto before = snapshot_of(memory);

    auto found = engine.retrieve(memory, "CaseSensitive");
    ASSERT_TRUE(found.succeeded()) << found.message();
    EXPECT_EQ(found.code(), "OK");
    ASSERT_NE(found.entry(), nullptr);
    EXPECT_EQ(snapshot_of(*found.entry()),
              (EntrySnapshot{"CaseSensitive", "payload"}));

    const auto absent = engine.retrieve(memory, "casesensitive");
    EXPECT_FALSE(absent.succeeded());
    EXPECT_EQ(absent.code(), "NOT_FOUND");
    EXPECT_EQ(absent.entry(), nullptr);
    EXPECT_EQ(snapshot_of(memory), before);

    const auto repeated = engine.retrieve(memory, "casesensitive");
    EXPECT_EQ(repeated.succeeded(), absent.succeeded());
    EXPECT_EQ(repeated.code(), absent.code());
    EXPECT_EQ(repeated.message(), absent.message());
}

TEST(MemoryIdentifierValidationTest,
     EmptyIdentifiersAreRejectedDeterministicallyWithoutMutation) {
    Memory memory{"workspace"};
    MemoryEngine engine;
    store(engine, memory, "stable", "value");
    const auto before = snapshot_of(memory);

    const auto retrieve = engine.retrieve(memory, "");
    EXPECT_FALSE(retrieve.succeeded());
    EXPECT_EQ(retrieve.code(), "INVALID_IDENTIFIER");
    EXPECT_EQ(retrieve.entry(), nullptr);
    EXPECT_EQ(snapshot_of(memory), before);

    const auto forget = engine.forget(memory, "");
    EXPECT_FALSE(forget.succeeded());
    EXPECT_EQ(forget.code(), "INVALID_IDENTIFIER");
    EXPECT_EQ(snapshot_of(memory), before);

    const auto repeated_retrieve = engine.retrieve(memory, "");
    const auto repeated_forget = engine.forget(memory, "");
    EXPECT_EQ(repeated_retrieve.code(), retrieve.code());
    EXPECT_EQ(repeated_retrieve.message(), retrieve.message());
    EXPECT_EQ(repeated_forget.code(), forget.code());
    EXPECT_EQ(repeated_forget.message(), forget.message());
}

TEST(MemorySearchTest, MatchesIdentifiersAndValuesInInsertionOrder) {
    Memory memory{"workspace"};
    MemoryEngine engine;
    store(engine, memory, "first-needle", "unrelated");
    store(engine, memory, "second", "contains needle value");
    store(engine, memory, "Needle-case", "case-sensitive miss");
    store(engine, memory, "fourth-needle", "needle twice");
    const auto before = snapshot_of(memory);

    const MemoryQuery query{"needle"};
    const auto result = engine.search(memory, query);
    ASSERT_TRUE(result.succeeded()) << result.message();
    EXPECT_EQ(result.code(), "OK");
    EXPECT_EQ(snapshot_of(result.matches()),
              (std::vector<EntrySnapshot>{
                  {"first-needle", "unrelated"},
                  {"second", "contains needle value"},
                  {"fourth-needle", "needle twice"},
              }));

    const auto all = engine.search(memory, MemoryQuery{""});
    EXPECT_TRUE(all.succeeded());
    EXPECT_EQ(snapshot_of(all.matches()), before);
    EXPECT_EQ(snapshot_of(memory), before);
}

TEST(MemoryForgetTest, IsIdempotentAndRestorageAppends) {
    Memory memory{"workspace"};
    MemoryEngine engine;
    store(engine, memory, "first", "one");
    store(engine, memory, "second", "two");
    store(engine, memory, "third", "three");

    const auto removed = engine.forget(memory, "second");
    EXPECT_TRUE(removed.succeeded()) << removed.message();
    EXPECT_EQ(removed.code(), "OK");
    EXPECT_EQ(snapshot_of(memory),
              (std::vector<EntrySnapshot>{{"first", "one"},
                                          {"third", "three"}}));

    const auto before_absent = snapshot_of(memory);
    const auto absent = engine.forget(memory, "second");
    EXPECT_TRUE(absent.succeeded()) << absent.message();
    EXPECT_EQ(absent.code(), "OK");
    EXPECT_EQ(snapshot_of(memory), before_absent);

    store(engine, memory, "second", "restored");
    EXPECT_EQ(snapshot_of(memory),
              (std::vector<EntrySnapshot>{{"first", "one"},
                                          {"third", "three"},
                                          {"second", "restored"}}));
}

TEST(MemoryOwnershipTest, ValuesResultsAndInstancesAreIndependent) {
    std::string identifier = "owned-id";
    std::string value = "owned-value";
    MemoryEntry supplied{identifier, value};
    identifier.assign("caller-mutated-id");
    value.assign("caller-mutated-value");
    EXPECT_EQ(supplied.identifier(), "owned-id");
    EXPECT_EQ(supplied.value(), "owned-value");

    MemoryEngine first_engine;
    MemoryEngine second_engine;
    Memory first{"workspace-one"};
    Memory second{"workspace-two"};
    ASSERT_TRUE(first_engine.store(first, std::move(supplied)).succeeded());
    store(second_engine, second, "other", "isolated");

    auto retrieved = first_engine.retrieve(first, "owned-id");
    auto searched = first_engine.search(first, MemoryQuery{"owned"});
    ASSERT_NE(retrieved.entry(), nullptr);
    ASSERT_EQ(searched.matches().size(), 1U);

    ASSERT_TRUE(first_engine.forget(first, "owned-id").succeeded());
    store(first_engine, first, "replacement", "new-state");

    EXPECT_EQ(snapshot_of(*retrieved.entry()),
              (EntrySnapshot{"owned-id", "owned-value"}));
    EXPECT_EQ(snapshot_of(searched.matches()),
              (std::vector<EntrySnapshot>{{"owned-id", "owned-value"}}));
    EXPECT_EQ(snapshot_of(second),
              (std::vector<EntrySnapshot>{{"other", "isolated"}}));

    auto moved = std::move(retrieved);
    ASSERT_NE(moved.entry(), nullptr);
    EXPECT_EQ(snapshot_of(*moved.entry()),
              (EntrySnapshot{"owned-id", "owned-value"}));

    auto assigned = first_engine.retrieve(first, "replacement");
    assigned = std::move(moved);
    ASSERT_NE(assigned.entry(), nullptr);
    EXPECT_EQ(snapshot_of(*assigned.entry()),
              (EntrySnapshot{"owned-id", "owned-value"}));
}

TEST(MemoryOrderingTest, ReplacementPreservesDeterministicOrdering) {
    Memory first{"workspace"};
    Memory second{"workspace"};
    MemoryEngine first_engine;
    MemoryEngine second_engine;

    const auto apply_equivalent_sequence = [](MemoryEngine& engine,
                                              Memory& memory) {
        store(engine, memory, "alpha", "match-original");
        store(engine, memory, "beta", "match-beta");
        store(engine, memory, "gamma", "match-gamma");
        store(engine, memory, "beta", "match-replaced");
        store(engine, memory, "alpha", "match-final");
    };

    apply_equivalent_sequence(first_engine, first);
    apply_equivalent_sequence(second_engine, second);

    const std::vector<EntrySnapshot> expected{
        {"alpha", "match-final"},
        {"beta", "match-replaced"},
        {"gamma", "match-gamma"},
    };
    EXPECT_EQ(snapshot_of(first), expected);
    EXPECT_EQ(snapshot_of(second), expected);

    const auto first_search =
        first_engine.search(first, MemoryQuery{"match"});
    const auto second_search =
        second_engine.search(second, MemoryQuery{"match"});
    EXPECT_EQ(snapshot_of(first_search.matches()), expected);
    EXPECT_EQ(snapshot_of(second_search.matches()), expected);
    EXPECT_EQ(first_search.code(), second_search.code());
    EXPECT_EQ(first_search.message(), second_search.message());
}

} // namespace
