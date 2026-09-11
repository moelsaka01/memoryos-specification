#include <cca/memory/long_term_memory.hpp>

#include <gtest/gtest.h>

#include <cstddef>
#include <cstdlib>
#include <limits>
#include <new>
#include <string>
#include <string_view>
#include <utility>
#include <vector>

// CCA-LTMEM-009, CCA-LTMEM-010, CCA-LTMEM-011, CCA-LTMEM-014,
// CCA-LTMEM-016, CCA-LTMEM-017, and CCA-LTMEM-023: inject each allocation
// failure independently and compare complete observable state plus forgotten
// identifier behavior for every mutating operation.

namespace long_term_memory_allocation_failure_support {

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

} // namespace long_term_memory_allocation_failure_support

void* operator new(const std::size_t size) {
    return long_term_memory_allocation_failure_support::allocate(size);
}

void* operator new[](const std::size_t size) {
    return long_term_memory_allocation_failure_support::allocate(size);
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

using cca::memory::LongTermMemory;
using cca::memory::LongTermMemoryEngine;
using cca::memory::LongTermMemoryEntry;

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

struct Fixture final {
    LongTermMemoryEngine engine;
    LongTermMemory target{"allocation-test-workspace"};
    LongTermMemory preserved{"allocation-test-workspace"};
    std::vector<std::string_view> identifier_probes{
        "first-entry-with-a-long-identifier",
        "second-entry-with-a-long-identifier",
        "third-entry-with-a-long-identifier",
        "forgotten-entry-with-a-long-identifier",
        "candidate-entry-with-a-long-identifier",
        "absent-entry-with-a-long-identifier"};
};

struct FixtureSnapshot final {
    StateSnapshot target;
    StateSnapshot preserved;

    bool operator==(const FixtureSnapshot&) const = default;
};

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
                            "allocation-history-probe-value"});
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
    const std::vector<std::string_view>& identifier_probes) {
    std::vector<EntrySnapshot> entries;
    entries.reserve(memory.entries().size());
    for (const auto& entry : memory.entries()) {
        entries.push_back(
            EntrySnapshot{entry.identifier(), entry.value(), entry.archived()});
    }

    std::vector<IdentifierSnapshot> identifiers;
    identifiers.reserve(identifier_probes.size());
    for (const auto identifier : identifier_probes) {
        identifiers.push_back(
            IdentifierSnapshot{std::string{identifier},
                               identifier_disposition(memory, identifier)});
    }
    return StateSnapshot{memory.workspaceIdentifier(),
                         std::move(entries),
                         std::move(identifiers)};
}

[[nodiscard]] FixtureSnapshot snapshot_of(const Fixture& fixture) {
    return FixtureSnapshot{
        snapshot_of(fixture.target, fixture.identifier_probes),
        snapshot_of(fixture.preserved, fixture.identifier_probes)};
}

void retain(LongTermMemoryEngine& engine,
            LongTermMemory& memory,
            std::string identifier,
            std::string value) {
    ASSERT_TRUE(engine
                    .retain(memory,
                            LongTermMemoryEntry{std::move(identifier),
                                                std::move(value)})
                    .succeeded());
}

void seed_target(Fixture& fixture) {
    retain(fixture.engine,
           fixture.target,
           "first-entry-with-a-long-identifier",
           "first-value-with-enough-content-to-allocate");
    retain(fixture.engine,
           fixture.target,
           "second-entry-with-a-long-identifier",
           "second-value-with-enough-content-to-allocate");
    retain(fixture.engine,
           fixture.target,
           "third-entry-with-a-long-identifier",
           "third-value-with-enough-content-to-allocate");
    retain(fixture.engine,
           fixture.target,
           "forgotten-entry-with-a-long-identifier",
           "forgotten-value-with-enough-content-to-allocate");
    ASSERT_TRUE(fixture.engine
                    .archive(fixture.target,
                             "second-entry-with-a-long-identifier")
                    .succeeded());
    ASSERT_TRUE(fixture.engine
                    .forget(fixture.target,
                            "forgotten-entry-with-a-long-identifier")
                    .succeeded());
}

void seed_preserved(Fixture& fixture) {
    retain(fixture.engine,
           fixture.preserved,
           "first-entry-with-a-long-identifier",
           "preserved-first-value-with-enough-content-to-allocate");
    retain(fixture.engine,
           fixture.preserved,
           "second-entry-with-a-long-identifier",
           "preserved-second-value-with-enough-content-to-allocate");
    retain(fixture.engine,
           fixture.preserved,
           "third-entry-with-a-long-identifier",
           "preserved-third-value-with-enough-content-to-allocate");
    retain(fixture.engine,
           fixture.preserved,
           "forgotten-entry-with-a-long-identifier",
           "preserved-forgotten-value-with-enough-content-to-allocate");
    ASSERT_TRUE(fixture.engine
                    .archive(fixture.preserved,
                             "second-entry-with-a-long-identifier")
                    .succeeded());
    ASSERT_TRUE(fixture.engine
                    .forget(fixture.preserved,
                            "forgotten-entry-with-a-long-identifier")
                    .succeeded());
}

constexpr std::size_t allocation_campaign_limit = 256U;

template <typename Arrange, typename Operation>
void verify_strong_guarantee(Arrange arrange, Operation operation) {
    std::size_t observed_failures = 0U;
    bool completed = false;

    for (std::size_t index = 0U;
         index < allocation_campaign_limit;
         ++index) {
        auto fixture = arrange();
        const auto before = snapshot_of(fixture);

        long_term_memory_allocation_failure_support::fail_after(index);
        try {
            const auto result = operation(fixture);
            long_term_memory_allocation_failure_support::disable();
            EXPECT_TRUE(result.succeeded()) << result.code() << ": "
                                            << result.message();
            completed = true;
            break;
        } catch (const std::bad_alloc&) {
            long_term_memory_allocation_failure_support::disable();
            ++observed_failures;
            EXPECT_EQ(snapshot_of(fixture), before);
        } catch (...) {
            long_term_memory_allocation_failure_support::disable();
            throw;
        }
    }

    EXPECT_TRUE(completed);
    EXPECT_GT(observed_failures, 0U);
}

TEST(LongTermMemoryAllocationFailureTest,
     RetainAppendPreservesStateAtEveryAllocationFailure) {
    verify_strong_guarantee(
        [] { return Fixture{}; },
        [](Fixture& fixture) {
            return fixture.engine.retain(
                fixture.target,
                LongTermMemoryEntry{
                    "candidate-entry-with-a-long-identifier",
                    "candidate-value-with-enough-content-to-allocate"});
        });
}

TEST(LongTermMemoryAllocationFailureTest,
     RetainIdempotencePreservesStateAtEveryAllocationFailure) {
    verify_strong_guarantee(
        [] {
            Fixture fixture;
            seed_target(fixture);
            return fixture;
        },
        [](Fixture& fixture) {
            return fixture.engine.retain(
                fixture.target,
                LongTermMemoryEntry{
                    "first-entry-with-a-long-identifier",
                    "first-value-with-enough-content-to-allocate"});
        });
}

TEST(LongTermMemoryAllocationFailureTest,
     StoreAppendPreservesStateAtEveryAllocationFailure) {
    verify_strong_guarantee(
        [] {
            Fixture fixture;
            seed_target(fixture);
            return fixture;
        },
        [](Fixture& fixture) {
            return fixture.engine.store(
                fixture.target,
                LongTermMemoryEntry{
                    "candidate-entry-with-a-long-identifier",
                    "candidate-value-with-enough-content-to-allocate"});
        });
}

TEST(LongTermMemoryAllocationFailureTest,
     StoreReplacementPreservesStateAtEveryAllocationFailure) {
    verify_strong_guarantee(
        [] {
            Fixture fixture;
            seed_target(fixture);
            return fixture;
        },
        [](Fixture& fixture) {
            return fixture.engine.store(
                fixture.target,
                LongTermMemoryEntry{
                    "third-entry-with-a-long-identifier",
                    "replacement-value-with-enough-content-to-allocate"});
        });
}

TEST(LongTermMemoryAllocationFailureTest,
     ArchivePreservesStateAtEveryAllocationFailure) {
    verify_strong_guarantee(
        [] {
            Fixture fixture;
            seed_target(fixture);
            return fixture;
        },
        [](Fixture& fixture) {
            return fixture.engine.archive(
                fixture.target,
                "third-entry-with-a-long-identifier");
        });
}

TEST(LongTermMemoryAllocationFailureTest,
     ForgetPreservesEntriesAndHistoryAtEveryAllocationFailure) {
    verify_strong_guarantee(
        [] {
            Fixture fixture;
            seed_target(fixture);
            return fixture;
        },
        [](Fixture& fixture) {
            return fixture.engine.forget(
                fixture.target,
                "third-entry-with-a-long-identifier");
        });
}

TEST(LongTermMemoryAllocationFailureTest,
     RestorePreservesSourceAndTargetAtEveryAllocationFailure) {
    verify_strong_guarantee(
        [] {
            Fixture fixture;
            seed_preserved(fixture);
            return fixture;
        },
        [](Fixture& fixture) {
            return fixture.engine.restore(fixture.target, fixture.preserved);
        });
}

} // namespace
