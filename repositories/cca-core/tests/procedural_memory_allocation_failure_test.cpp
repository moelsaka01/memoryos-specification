#include <cca/memory/long_term_memory.hpp>
#include <cca/memory/procedural_memory.hpp>

#include <gtest/gtest.h>

#include <cstddef>
#include <cstdlib>
#include <limits>
#include <new>
#include <stdexcept>
#include <string>
#include <string_view>
#include <utility>
#include <vector>

// CCA-PRMEM-011 through CCA-PRMEM-017, CCA-PRMEM-020 through
// CCA-PRMEM-031, and CCA-PRMEM-041: independently inject every ordinary
// allocation failure for every mutating operation and compare Workspace
// identity, complete Procedures, ordered activity/steps/provenance/links,
// hidden Forgotten behavior, canonical order, and Long-Term evidence.

namespace procedural_memory_allocation_failure_support {

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

} // namespace procedural_memory_allocation_failure_support

void* operator new(const std::size_t size) {
    return procedural_memory_allocation_failure_support::allocate(size);
}

void* operator new[](const std::size_t size) {
    return procedural_memory_allocation_failure_support::allocate(size);
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
using cca::memory::ProceduralMemory;
using cca::memory::ProceduralMemoryEngine;
using cca::memory::Procedure;

constexpr std::string_view source_a{
    "source-a-with-a-long-identifier-for-allocation-testing"};
constexpr std::string_view source_b{
    "source-b-with-a-long-identifier-for-allocation-testing"};
constexpr std::string_view source_c{
    "source-c-with-a-long-identifier-for-allocation-testing"};
constexpr std::string_view procedure_a{
    "procedure-a-with-a-long-identifier-for-allocation-testing"};
constexpr std::string_view procedure_b{
    "procedure-b-with-a-long-identifier-for-allocation-testing"};
constexpr std::string_view procedure_c{
    "procedure-c-with-a-long-identifier-for-allocation-testing"};
constexpr std::string_view forgotten_procedure{
    "forgotten-procedure-with-a-long-identifier-for-allocation-testing"};
constexpr std::string_view candidate_procedure{
    "candidate-procedure-with-a-long-identifier-for-allocation-testing"};
constexpr std::string_view absent_procedure{
    "absent-procedure-with-a-long-identifier-for-allocation-testing"};

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

struct Fixture final {
    ProceduralMemoryEngine procedural_engine;
    LongTermMemoryEngine long_term_engine;
    ProceduralMemory target{"procedural-allocation-test-workspace"};
    LongTermMemory evidence{"procedural-allocation-test-workspace"};
    std::vector<std::string_view> procedure_probes{
        procedure_a,
        procedure_b,
        procedure_c,
        forgotten_procedure,
        candidate_procedure,
        absent_procedure};
    std::vector<std::string_view> source_probes{source_a, source_b, source_c};
};

struct FixtureSnapshot final {
    ProceduralStateSnapshot target;
    LongTermStateSnapshot evidence;

    bool operator==(const FixtureSnapshot&) const = default;
};

[[nodiscard]] EntrySnapshot snapshot_of(const LongTermMemoryEntry& entry) {
    return {entry.identifier(), entry.value(), entry.archived()};
}

[[nodiscard]] ProcedureSnapshot snapshot_of(const Procedure& procedure) {
    std::vector<EntrySnapshot> sources;
    sources.reserve(procedure.sourceEntries().size());
    for (const auto& source : procedure.sourceEntries()) {
        sources.push_back(snapshot_of(source));
    }
    return {procedure.identifier(),
            procedure.activity(),
            procedure.steps(),
            std::move(sources),
            procedure.linkedProcedureIdentifiers()};
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

[[nodiscard]] const LongTermMemoryEntry& require_entry(
    const LongTermMemory& memory,
    const std::string_view identifier) {
    const auto* const entry = memory.find(identifier);
    if (entry == nullptr) {
        throw std::logic_error{"allocation fixture source is absent"};
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

void derive(ProceduralMemoryEngine& engine,
            ProceduralMemory& memory,
            const LongTermMemory& evidence,
            std::string identifier,
            std::string activity,
            std::vector<std::string> steps,
            const std::string_view source) {
    const auto result = engine.derive(
        memory,
        evidence,
        proposal(std::move(identifier),
                 std::move(activity),
                 std::move(steps),
                 evidence,
                 {source}));
    ASSERT_TRUE(result.succeeded()) << result.code() << ": "
                                    << result.message();
}

void compose(ProceduralMemoryEngine& engine,
             ProceduralMemory& memory,
             const LongTermMemory& evidence,
             std::string identifier,
             std::string activity,
             std::vector<std::string> steps,
             const std::vector<std::string_view>& sources) {
    const auto result = engine.compose(
        memory,
        evidence,
        proposal(std::move(identifier),
                 std::move(activity),
                 std::move(steps),
                 evidence,
                 sources));
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
    const auto retained = LongTermMemoryEngine{}.retain(
        evidence,
        LongTermMemoryEntry{
            "private-procedural-allocation-history-probe-source",
            "private-procedural-allocation-history-probe-value"});
    if (!retained.succeeded()) {
        return "PROBE-SOURCE-FAILURE:" + retained.code();
    }
    ProceduralMemory probe{memory};
    const auto result = ProceduralMemoryEngine{}.derive(
        probe,
        evidence,
        proposal(std::string{identifier},
                 "private-procedural-allocation-history-probe-activity",
                 {"private-procedural-allocation-history-probe-step"},
                 evidence,
                 {"private-procedural-allocation-history-probe-source"}));
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
    const std::vector<std::string_view>& probes) {
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
    const std::vector<std::string_view>& probes) {
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

[[nodiscard]] FixtureSnapshot snapshot_of(const Fixture& fixture) {
    return {snapshot_of(fixture.target, fixture.procedure_probes),
            snapshot_of(fixture.evidence, fixture.source_probes)};
}

void seed(Fixture& fixture) {
    retain(fixture.long_term_engine,
           fixture.evidence,
           std::string{source_a},
           "source-a-value-with-enough-content-to-require-allocation");
    retain(fixture.long_term_engine,
           fixture.evidence,
           std::string{source_b},
           "source-b-value-with-enough-content-to-require-allocation");
    retain(fixture.long_term_engine,
           fixture.evidence,
           std::string{source_c},
           "source-c-value-with-enough-content-to-require-allocation");
    derive(fixture.procedural_engine,
           fixture.target,
           fixture.evidence,
           std::string{procedure_a},
           "procedure-a-activity-with-enough-content-to-require-allocation",
           {"procedure-a-step-one-with-enough-content-to-allocate",
            "procedure-a-step-two-with-enough-content-to-allocate"},
           source_a);
    compose(fixture.procedural_engine,
            fixture.target,
            fixture.evidence,
            std::string{procedure_b},
            "procedure-b-activity-with-enough-content-to-require-allocation",
            {"procedure-b-step-one-with-enough-content-to-allocate",
             "procedure-b-step-one-with-enough-content-to-allocate"},
            {source_b, source_a});
    derive(fixture.procedural_engine,
           fixture.target,
           fixture.evidence,
           std::string{procedure_c},
           "procedure-c-activity-with-enough-content-to-require-allocation",
           {"procedure-c-step-with-enough-content-to-require-allocation"},
           source_c);
    derive(fixture.procedural_engine,
           fixture.target,
           fixture.evidence,
           std::string{forgotten_procedure},
           "forgotten-activity-with-enough-content-to-require-allocation",
           {"forgotten-step-with-enough-content-to-require-allocation"},
           source_a);
    ASSERT_TRUE(fixture.procedural_engine
                    .link(fixture.target, procedure_a, procedure_b)
                    .succeeded());
    ASSERT_TRUE(fixture.procedural_engine
                    .link(fixture.target, procedure_a, procedure_c)
                    .succeeded());
    ASSERT_TRUE(fixture.procedural_engine
                    .link(fixture.target, procedure_b, procedure_c)
                    .succeeded());
    ASSERT_TRUE(fixture.procedural_engine
                    .forget(fixture.target, forgotten_procedure)
                    .succeeded());
}

[[nodiscard]] Fixture seeded_fixture() {
    Fixture fixture;
    seed(fixture);
    return fixture;
}

constexpr std::size_t allocation_campaign_limit = 2048U;

template <typename Arrange, typename Operation>
void verify_strong_guarantee(Arrange arrange,
                             Operation operation,
                             const std::string_view expected_code) {
    std::size_t observed_failures = 0U;
    bool completed = false;

    for (std::size_t index = 0U;
         index < allocation_campaign_limit;
         ++index) {
        auto fixture = arrange();
        const auto before = snapshot_of(fixture);

        procedural_memory_allocation_failure_support::fail_after(index);
        try {
            const auto result = operation(fixture);
            procedural_memory_allocation_failure_support::disable();
            EXPECT_EQ(result.code(), expected_code);
            if (expected_code == "OK") {
                EXPECT_TRUE(result.succeeded()) << result.code() << ": "
                                                << result.message();
            } else {
                EXPECT_FALSE(result.succeeded());
                EXPECT_FALSE(result.message().empty());
                EXPECT_EQ(result.procedure(), nullptr);
                EXPECT_TRUE(result.matches().empty());
                EXPECT_EQ(snapshot_of(fixture), before);
            }
            completed = true;
            break;
        } catch (const std::bad_alloc&) {
            procedural_memory_allocation_failure_support::disable();
            ++observed_failures;
            EXPECT_EQ(snapshot_of(fixture), before);
        } catch (...) {
            procedural_memory_allocation_failure_support::disable();
            throw;
        }
    }

    procedural_memory_allocation_failure_support::disable();
    EXPECT_TRUE(completed);
    EXPECT_GT(observed_failures, 0U);
}

TEST(ProceduralMemoryAllocationFailureTest,
     DeriveAppendPreservesAllStateAtEveryFailure) {
    verify_strong_guarantee(
        [] { return seeded_fixture(); },
        [](Fixture& fixture) {
            return fixture.procedural_engine.derive(
                fixture.target,
                fixture.evidence,
                proposal(
                    std::string{candidate_procedure},
                    "candidate-activity-with-enough-content-to-allocate",
                    {"candidate-step-one-with-enough-content-to-allocate",
                     "candidate-step-two-with-enough-content-to-allocate"},
                    fixture.evidence,
                    {source_b}));
        },
        "OK");
}

TEST(ProceduralMemoryAllocationFailureTest,
     DeriveIdempotencePreservesAllStateAtEveryFailure) {
    verify_strong_guarantee(
        [] { return seeded_fixture(); },
        [](Fixture& fixture) {
            return fixture.procedural_engine.derive(
                fixture.target,
                fixture.evidence,
                proposal(
                    std::string{procedure_a},
                    "procedure-a-activity-with-enough-content-to-require-allocation",
                    {"procedure-a-step-one-with-enough-content-to-allocate",
                     "procedure-a-step-two-with-enough-content-to-allocate"},
                    fixture.evidence,
                    {source_a}));
        },
        "OK");
}

TEST(ProceduralMemoryAllocationFailureTest,
     ComposeAppendPreservesAllStateAtEveryFailure) {
    verify_strong_guarantee(
        [] { return seeded_fixture(); },
        [](Fixture& fixture) {
            return fixture.procedural_engine.compose(
                fixture.target,
                fixture.evidence,
                proposal(
                    std::string{candidate_procedure},
                    "candidate-composed-activity-with-enough-content-to-allocate",
                    {"candidate-composed-step-one-with-enough-content-to-allocate",
                     "candidate-composed-step-two-with-enough-content-to-allocate"},
                    fixture.evidence,
                    {source_c, source_a, source_b}));
        },
        "OK");
}

TEST(ProceduralMemoryAllocationFailureTest,
     ComposeIdempotencePreservesAllStateAtEveryFailure) {
    verify_strong_guarantee(
        [] { return seeded_fixture(); },
        [](Fixture& fixture) {
            return fixture.procedural_engine.compose(
                fixture.target,
                fixture.evidence,
                proposal(
                    std::string{procedure_b},
                    "procedure-b-activity-with-enough-content-to-require-allocation",
                    {"procedure-b-step-one-with-enough-content-to-allocate",
                     "procedure-b-step-one-with-enough-content-to-allocate"},
                    fixture.evidence,
                    {source_b, source_a}));
        },
        "OK");
}

TEST(ProceduralMemoryAllocationFailureTest,
     LinkAppendPreservesBothEndpointsAtEveryFailure) {
    verify_strong_guarantee(
        [] {
            Fixture fixture;
            retain(fixture.long_term_engine,
                   fixture.evidence,
                   std::string{source_a},
                   "source-a-value-with-enough-content-to-require-allocation");
            derive(fixture.procedural_engine,
                   fixture.target,
                   fixture.evidence,
                   std::string{procedure_a},
                   "procedure-a-activity-with-enough-content-to-allocate",
                   {"procedure-a-step-with-enough-content-to-allocate"},
                   source_a);
            derive(fixture.procedural_engine,
                   fixture.target,
                   fixture.evidence,
                   std::string{procedure_b},
                   "procedure-b-activity-with-enough-content-to-allocate",
                   {"procedure-b-step-with-enough-content-to-allocate"},
                   source_a);
            return fixture;
        },
        [](Fixture& fixture) {
            return fixture.procedural_engine.link(
                fixture.target, procedure_a, procedure_b);
        },
        "OK");
}

TEST(ProceduralMemoryAllocationFailureTest,
     LinkIdempotencePreservesAllStateAtEveryFailure) {
    verify_strong_guarantee(
        [] { return seeded_fixture(); },
        [](Fixture& fixture) {
            return fixture.procedural_engine.link(
                fixture.target, procedure_b, procedure_a);
        },
        "OK");
}

TEST(ProceduralMemoryAllocationFailureTest,
     UpdateReplacementPreservesAllStateAtEveryFailure) {
    verify_strong_guarantee(
        [] { return seeded_fixture(); },
        [](Fixture& fixture) {
            return fixture.procedural_engine.update(
                fixture.target,
                procedure_a,
                "replacement-activity-with-enough-content-to-allocate",
                {"replacement-step-one-with-enough-content-to-allocate",
                 "replacement-step-one-with-enough-content-to-allocate",
                 "replacement-step-three-with-enough-content-to-allocate"});
        },
        "OK");
}

TEST(ProceduralMemoryAllocationFailureTest,
     UpdateIdempotencePreservesAllStateAtEveryFailure) {
    verify_strong_guarantee(
        [] { return seeded_fixture(); },
        [](Fixture& fixture) {
            return fixture.procedural_engine.update(
                fixture.target,
                procedure_a,
                "procedure-a-activity-with-enough-content-to-require-allocation",
                {"procedure-a-step-one-with-enough-content-to-allocate",
                 "procedure-a-step-two-with-enough-content-to-allocate"});
        },
        "OK");
}

TEST(ProceduralMemoryAllocationFailureTest,
     ForgetPresentWithMultiSurvivorLinksPreservesAllStateAtEveryFailure) {
    verify_strong_guarantee(
        [] { return seeded_fixture(); },
        [](Fixture& fixture) {
            return fixture.procedural_engine.forget(
                fixture.target, procedure_b);
        },
        "OK");
}

TEST(ProceduralMemoryAllocationFailureTest,
     ForgetAbsentPreservesAllStateAtEveryFailure) {
    verify_strong_guarantee(
        [] { return seeded_fixture(); },
        [](Fixture& fixture) {
            return fixture.procedural_engine.forget(
                fixture.target, absent_procedure);
        },
        "OK");
}

TEST(ProceduralMemoryAllocationFailureTest,
     ForgetRepeatedPreservesAllStateAtEveryFailure) {
    verify_strong_guarantee(
        [] { return seeded_fixture(); },
        [](Fixture& fixture) {
            return fixture.procedural_engine.forget(
                fixture.target, forgotten_procedure);
        },
        "OK");
}

TEST(ProceduralMemoryAllocationFailureTest,
     DeriveConflictFailureConstructionPreservesAllState) {
    verify_strong_guarantee(
        [] { return seeded_fixture(); },
        [](Fixture& fixture) {
            return fixture.procedural_engine.derive(
                fixture.target,
                fixture.evidence,
                proposal(
                    std::string{procedure_a},
                    "conflicting-activity-with-enough-content-to-allocate",
                    {"procedure-a-step-one-with-enough-content-to-allocate",
                     "procedure-a-step-two-with-enough-content-to-allocate"},
                    fixture.evidence,
                    {source_a}));
        },
        "IDENTIFIER_CONFLICT");
}

TEST(ProceduralMemoryAllocationFailureTest,
     ComposeMissingSourceFailureConstructionPreservesAllState) {
    verify_strong_guarantee(
        [] { return seeded_fixture(); },
        [](Fixture& fixture) {
            return fixture.procedural_engine.compose(
                fixture.target,
                fixture.evidence,
                Procedure{
                    std::string{candidate_procedure},
                    "candidate-activity-with-enough-content-to-allocate",
                    {"candidate-step-with-enough-content-to-allocate"},
                    {require_entry(fixture.evidence, source_a),
                     LongTermMemoryEntry{
                         "missing-source-with-a-long-identifier-for-allocation-testing",
                         "missing-source-value-with-enough-content-to-allocate"}}});
        },
        "SOURCE_NOT_FOUND");
}

TEST(ProceduralMemoryAllocationFailureTest,
     LinkMissingEndpointFailureConstructionPreservesAllState) {
    verify_strong_guarantee(
        [] { return seeded_fixture(); },
        [](Fixture& fixture) {
            return fixture.procedural_engine.link(
                fixture.target, procedure_a, absent_procedure);
        },
        "NOT_FOUND");
}

TEST(ProceduralMemoryAllocationFailureTest,
     UpdateMissingTargetFailureConstructionPreservesAllState) {
    verify_strong_guarantee(
        [] { return seeded_fixture(); },
        [](Fixture& fixture) {
            return fixture.procedural_engine.update(
                fixture.target,
                absent_procedure,
                "missing-target-activity-with-enough-content-to-allocate",
                {"missing-target-step-with-enough-content-to-allocate"});
        },
        "NOT_FOUND");
}

} // namespace
