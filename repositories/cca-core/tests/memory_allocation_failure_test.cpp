#include <cca/memory/memory.hpp>

#include <gtest/gtest.h>

#include <cstddef>
#include <cstdlib>
#include <limits>
#include <new>
#include <string>
#include <utility>
#include <vector>

// CCA-MEM-004, CCA-MEM-007, and CCA-MEM-009: inject every allocation
// failure independently and verify the strong guarantee for mutation.

namespace memory_allocation_failure_support {

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

} // namespace memory_allocation_failure_support

void* operator new(const std::size_t size) {
    return memory_allocation_failure_support::allocate(size);
}

void* operator new[](const std::size_t size) {
    return memory_allocation_failure_support::allocate(size);
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

using cca::memory::Memory;
using cca::memory::MemoryEngine;
using cca::memory::MemoryEntry;

struct EntrySnapshot final {
    std::string identifier;
    std::string value;

    bool operator==(const EntrySnapshot&) const = default;
};

[[nodiscard]] std::vector<EntrySnapshot> snapshot_of(const Memory& memory) {
    std::vector<EntrySnapshot> result;
    result.reserve(memory.entries().size());
    for (const auto& entry : memory.entries()) {
        result.push_back(EntrySnapshot{entry.identifier(), entry.value()});
    }
    return result;
}

void seed(MemoryEngine& engine, Memory& memory) {
    ASSERT_TRUE(engine.store(
        memory,
        MemoryEntry{"first-entry-with-a-long-identifier",
                    "first-value-with-enough-content-to-allocate"})
                    .succeeded());
    ASSERT_TRUE(engine.store(
        memory,
        MemoryEntry{"second-entry-with-a-long-identifier",
                    "second-value-with-enough-content-to-allocate"})
                    .succeeded());
}

constexpr std::size_t allocation_campaign_limit = 64U;

TEST(MemoryAllocationFailureTest,
     NewStorePreservesMemoryAtEveryAllocationFailure) {
    std::size_t observed_failures = 0U;
    bool completed = false;

    for (std::size_t index = 0U;
         index < allocation_campaign_limit;
         ++index) {
        MemoryEngine engine;
        Memory memory{"allocation-test-workspace"};
        seed(engine, memory);
        const auto before = snapshot_of(memory);
        const MemoryEntry candidate{
            "third-entry-with-a-long-identifier",
            "third-value-with-enough-content-to-allocate"};

        memory_allocation_failure_support::fail_after(index);
        try {
            const auto result = engine.store(memory, candidate);
            memory_allocation_failure_support::disable();
            EXPECT_TRUE(result.succeeded());
            completed = true;
            break;
        } catch (const std::bad_alloc&) {
            memory_allocation_failure_support::disable();
            ++observed_failures;
            EXPECT_EQ(snapshot_of(memory), before);
        } catch (...) {
            memory_allocation_failure_support::disable();
            throw;
        }
    }

    EXPECT_TRUE(completed);
    EXPECT_GT(observed_failures, 0U);
}

TEST(MemoryAllocationFailureTest,
     ReplacementPreservesMemoryAtEveryAllocationFailure) {
    std::size_t observed_failures = 0U;
    bool completed = false;

    for (std::size_t index = 0U;
         index < allocation_campaign_limit;
         ++index) {
        MemoryEngine engine;
        Memory memory{"allocation-test-workspace"};
        seed(engine, memory);
        const auto before = snapshot_of(memory);
        const MemoryEntry replacement{
            "first-entry-with-a-long-identifier",
            "replacement-value-with-enough-content-to-allocate"};

        memory_allocation_failure_support::fail_after(index);
        try {
            const auto result = engine.store(memory, replacement);
            memory_allocation_failure_support::disable();
            EXPECT_TRUE(result.succeeded());
            completed = true;
            break;
        } catch (const std::bad_alloc&) {
            memory_allocation_failure_support::disable();
            ++observed_failures;
            EXPECT_EQ(snapshot_of(memory), before);
        } catch (...) {
            memory_allocation_failure_support::disable();
            throw;
        }
    }

    EXPECT_TRUE(completed);
    EXPECT_GT(observed_failures, 0U);
}

TEST(MemoryAllocationFailureTest,
     ForgetPreservesMemoryAtEveryAllocationFailure) {
    std::size_t observed_failures = 0U;
    bool completed = false;

    for (std::size_t index = 0U;
         index < allocation_campaign_limit;
         ++index) {
        MemoryEngine engine;
        Memory memory{"allocation-test-workspace"};
        seed(engine, memory);
        const auto before = snapshot_of(memory);

        memory_allocation_failure_support::fail_after(index);
        try {
            const auto result = engine.forget(
                memory, "first-entry-with-a-long-identifier");
            memory_allocation_failure_support::disable();
            EXPECT_TRUE(result.succeeded());
            completed = true;
            break;
        } catch (const std::bad_alloc&) {
            memory_allocation_failure_support::disable();
            ++observed_failures;
            EXPECT_EQ(snapshot_of(memory), before);
        } catch (...) {
            memory_allocation_failure_support::disable();
            throw;
        }
    }

    EXPECT_TRUE(completed);
    EXPECT_GT(observed_failures, 0U);
}

} // namespace
