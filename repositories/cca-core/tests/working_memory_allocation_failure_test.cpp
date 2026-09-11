#include <cca/memory/working_memory.hpp>

#include <gtest/gtest.h>

#include <cstddef>
#include <cstdint>
#include <cstdlib>
#include <limits>
#include <new>
#include <optional>
#include <string>
#include <utility>
#include <vector>

// CCA-WMEM-007, CCA-WMEM-009, CCA-WMEM-012, CCA-WMEM-013, and
// CCA-WMEM-017: inject each allocation failure independently and verify the
// complete strong guarantee for every mutating operation.

namespace working_memory_allocation_failure_support {

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

} // namespace working_memory_allocation_failure_support

void* operator new(const std::size_t size) {
    return working_memory_allocation_failure_support::allocate(size);
}

void* operator new[](const std::size_t size) {
    return working_memory_allocation_failure_support::allocate(size);
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

using cca::memory::WorkingMemory;
using cca::memory::WorkingMemoryEngine;
using cca::memory::WorkingMemoryEntry;

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

[[nodiscard]] StateSnapshot snapshot_of(const WorkingMemory& memory) {
    std::vector<EntrySnapshot> entries;
    entries.reserve(memory.entries().size());
    for (const auto& entry : memory.entries()) {
        entries.push_back(EntrySnapshot{entry.identifier(),
                                        entry.value(),
                                        entry.expirationPoint()});
    }
    return StateSnapshot{memory.workspaceIdentifier(),
                         memory.active(),
                         memory.activeTaskIdentifier(),
                         std::move(entries)};
}

void activate_and_seed(WorkingMemoryEngine& engine, WorkingMemory& memory) {
    ASSERT_TRUE(engine
                    .activate(memory,
                              "allocation-test-task-with-a-long-identifier")
                    .succeeded());
    ASSERT_TRUE(engine
                    .store(memory,
                           WorkingMemoryEntry{
                               "first-entry-with-a-long-identifier",
                               "first-value-with-enough-content-to-allocate",
                               std::uint64_t{5U}})
                    .succeeded());
    ASSERT_TRUE(engine
                    .store(memory,
                           WorkingMemoryEntry{
                               "second-entry-with-a-long-identifier",
                               "second-value-with-enough-content-to-allocate"})
                    .succeeded());
    ASSERT_TRUE(engine
                    .store(memory,
                           WorkingMemoryEntry{
                               "third-entry-with-a-long-identifier",
                               "third-value-with-enough-content-to-allocate",
                               std::uint64_t{15U}})
                    .succeeded());
}

constexpr std::size_t allocation_campaign_limit = 128U;

TEST(WorkingMemoryAllocationFailureTest,
     InitialActivationPreservesStateAtEveryAllocationFailure) {
    std::size_t observed_failures = 0U;
    bool completed = false;

    for (std::size_t index = 0U;
         index < allocation_campaign_limit;
         ++index) {
        WorkingMemoryEngine engine;
        WorkingMemory memory{"allocation-test-workspace"};
        const auto before = snapshot_of(memory);
        const std::string task_identifier =
            "initial-task-with-a-long-identifier-that-must-allocate";

        working_memory_allocation_failure_support::fail_after(index);
        try {
            const auto result = engine.activate(memory, task_identifier);
            working_memory_allocation_failure_support::disable();
            EXPECT_TRUE(result.succeeded());
            completed = true;
            break;
        } catch (const std::bad_alloc&) {
            working_memory_allocation_failure_support::disable();
            ++observed_failures;
            EXPECT_EQ(snapshot_of(memory), before);
        } catch (...) {
            working_memory_allocation_failure_support::disable();
            throw;
        }
    }

    EXPECT_TRUE(completed);
    EXPECT_GT(observed_failures, 0U);
}

TEST(WorkingMemoryAllocationFailureTest,
     TaskSwitchPreservesStateAtEveryAllocationFailure) {
    std::size_t observed_failures = 0U;
    bool completed = false;

    for (std::size_t index = 0U;
         index < allocation_campaign_limit;
         ++index) {
        WorkingMemoryEngine engine;
        WorkingMemory memory{"allocation-test-workspace"};
        activate_and_seed(engine, memory);
        const auto before = snapshot_of(memory);
        const std::string task_identifier =
            "replacement-task-with-a-long-identifier-that-must-allocate";

        working_memory_allocation_failure_support::fail_after(index);
        try {
            const auto result = engine.activate(memory, task_identifier);
            working_memory_allocation_failure_support::disable();
            EXPECT_TRUE(result.succeeded());
            completed = true;
            break;
        } catch (const std::bad_alloc&) {
            working_memory_allocation_failure_support::disable();
            ++observed_failures;
            EXPECT_EQ(snapshot_of(memory), before);
        } catch (...) {
            working_memory_allocation_failure_support::disable();
            throw;
        }
    }

    EXPECT_TRUE(completed);
    EXPECT_GT(observed_failures, 0U);
}

TEST(WorkingMemoryAllocationFailureTest,
     NewStorePreservesStateAtEveryAllocationFailure) {
    std::size_t observed_failures = 0U;
    bool completed = false;

    for (std::size_t index = 0U;
         index < allocation_campaign_limit;
         ++index) {
        WorkingMemoryEngine engine;
        WorkingMemory memory{"allocation-test-workspace"};
        activate_and_seed(engine, memory);
        const auto before = snapshot_of(memory);
        const WorkingMemoryEntry candidate{
            "fourth-entry-with-a-long-identifier",
            "fourth-value-with-enough-content-to-allocate",
            std::uint64_t{20U}};

        working_memory_allocation_failure_support::fail_after(index);
        try {
            const auto result = engine.store(memory, candidate);
            working_memory_allocation_failure_support::disable();
            EXPECT_TRUE(result.succeeded());
            completed = true;
            break;
        } catch (const std::bad_alloc&) {
            working_memory_allocation_failure_support::disable();
            ++observed_failures;
            EXPECT_EQ(snapshot_of(memory), before);
        } catch (...) {
            working_memory_allocation_failure_support::disable();
            throw;
        }
    }

    EXPECT_TRUE(completed);
    EXPECT_GT(observed_failures, 0U);
}

TEST(WorkingMemoryAllocationFailureTest,
     ReplacementPreservesStateAtEveryAllocationFailure) {
    std::size_t observed_failures = 0U;
    bool completed = false;

    for (std::size_t index = 0U;
         index < allocation_campaign_limit;
         ++index) {
        WorkingMemoryEngine engine;
        WorkingMemory memory{"allocation-test-workspace"};
        activate_and_seed(engine, memory);
        const auto before = snapshot_of(memory);
        const WorkingMemoryEntry replacement{
            "first-entry-with-a-long-identifier",
            "replacement-value-with-enough-content-to-allocate",
            std::uint64_t{25U}};

        working_memory_allocation_failure_support::fail_after(index);
        try {
            const auto result = engine.store(memory, replacement);
            working_memory_allocation_failure_support::disable();
            EXPECT_TRUE(result.succeeded());
            completed = true;
            break;
        } catch (const std::bad_alloc&) {
            working_memory_allocation_failure_support::disable();
            ++observed_failures;
            EXPECT_EQ(snapshot_of(memory), before);
        } catch (...) {
            working_memory_allocation_failure_support::disable();
            throw;
        }
    }

    EXPECT_TRUE(completed);
    EXPECT_GT(observed_failures, 0U);
}

TEST(WorkingMemoryAllocationFailureTest,
     ExpirePreservesStateAtEveryAllocationFailure) {
    std::size_t observed_failures = 0U;
    bool completed = false;

    for (std::size_t index = 0U;
         index < allocation_campaign_limit;
         ++index) {
        WorkingMemoryEngine engine;
        WorkingMemory memory{"allocation-test-workspace"};
        activate_and_seed(engine, memory);
        const auto before = snapshot_of(memory);

        working_memory_allocation_failure_support::fail_after(index);
        try {
            const auto result = engine.expire(memory, std::uint64_t{5U});
            working_memory_allocation_failure_support::disable();
            EXPECT_TRUE(result.succeeded());
            completed = true;
            break;
        } catch (const std::bad_alloc&) {
            working_memory_allocation_failure_support::disable();
            ++observed_failures;
            EXPECT_EQ(snapshot_of(memory), before);
        } catch (...) {
            working_memory_allocation_failure_support::disable();
            throw;
        }
    }

    EXPECT_TRUE(completed);
    EXPECT_GT(observed_failures, 0U);
}

TEST(WorkingMemoryAllocationFailureTest,
     ForgetPreservesStateAtEveryAllocationFailure) {
    std::size_t observed_failures = 0U;
    bool completed = false;

    for (std::size_t index = 0U;
         index < allocation_campaign_limit;
         ++index) {
        WorkingMemoryEngine engine;
        WorkingMemory memory{"allocation-test-workspace"};
        activate_and_seed(engine, memory);
        const auto before = snapshot_of(memory);

        working_memory_allocation_failure_support::fail_after(index);
        try {
            const auto result = engine.forget(
                memory, "second-entry-with-a-long-identifier");
            working_memory_allocation_failure_support::disable();
            EXPECT_TRUE(result.succeeded());
            completed = true;
            break;
        } catch (const std::bad_alloc&) {
            working_memory_allocation_failure_support::disable();
            ++observed_failures;
            EXPECT_EQ(snapshot_of(memory), before);
        } catch (...) {
            working_memory_allocation_failure_support::disable();
            throw;
        }
    }

    EXPECT_TRUE(completed);
    EXPECT_GT(observed_failures, 0U);
}

} // namespace
