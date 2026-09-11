#include <cca/memory/long_term_memory.hpp>
#include <cca/memory/semantic_memory.hpp>

#include <gtest/gtest.h>

#include <cstddef>
#include <cstdlib>
#include <limits>
#include <new>
#include <string>
#include <string_view>
#include <utility>
#include <vector>

// CCA-SEMMEM-012 through CCA-SEMMEM-016, CCA-SEMMEM-019 through
// CCA-SEMMEM-021, CCA-SEMMEM-023, CCA-SEMMEM-025 through CCA-SEMMEM-028,
// and CCA-SEMMEM-038: independently inject every ordinary allocation failure
// for every mutating operation and compare complete Semantic state, hidden
// Forgotten behavior, all observable ordering, and complete Long-Term source
// state. Idempotent and absent mutation paths are included because result
// construction must also provide the strong failure guarantee.

namespace semantic_memory_allocation_failure_support {

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

} // namespace semantic_memory_allocation_failure_support

void* operator new(const std::size_t size) {
    return semantic_memory_allocation_failure_support::allocate(size);
}

void* operator new[](const std::size_t size) {
    return semantic_memory_allocation_failure_support::allocate(size);
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
using cca::memory::SemanticConcept;
using cca::memory::SemanticMemory;
using cca::memory::SemanticMemoryEngine;

constexpr std::string_view source_a{
    "source-a-with-a-long-identifier-for-allocation-testing"};
constexpr std::string_view source_b{
    "source-b-with-a-long-identifier-for-allocation-testing"};
constexpr std::string_view concept_a{
    "concept-a-with-a-long-identifier-for-allocation-testing"};
constexpr std::string_view concept_b{
    "concept-b-with-a-long-identifier-for-allocation-testing"};
constexpr std::string_view concept_c{
    "concept-c-with-a-long-identifier-for-allocation-testing"};
constexpr std::string_view forgotten_concept{
    "forgotten-concept-with-a-long-identifier-for-allocation-testing"};
constexpr std::string_view candidate_concept{
    "candidate-concept-with-a-long-identifier-for-allocation-testing"};
constexpr std::string_view absent_concept{
    "absent-concept-with-a-long-identifier-for-allocation-testing"};

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

struct Fixture final {
    SemanticMemoryEngine semantic_engine;
    LongTermMemoryEngine long_term_engine;
    SemanticMemory target{"semantic-allocation-test-workspace"};
    LongTermMemory evidence{"semantic-allocation-test-workspace"};
    std::vector<std::string_view> concept_probes{
        concept_a, concept_b, concept_c, forgotten_concept,
        candidate_concept, absent_concept};
    std::vector<std::string_view> source_probes{source_a, source_b};
};

struct FixtureSnapshot final {
    SemanticStateSnapshot target;
    LongTermStateSnapshot evidence;

    bool operator==(const FixtureSnapshot&) const = default;
};

[[nodiscard]] EntrySnapshot snapshot_of(const LongTermMemoryEntry& entry) {
    return {entry.identifier(), entry.value(), entry.archived()};
}

[[nodiscard]] ConceptSnapshot snapshot_of(const SemanticConcept& value) {
    std::vector<EntrySnapshot> sources;
    sources.reserve(value.sourceEntries().size());
    for (const auto& source : value.sourceEntries()) {
        sources.push_back(snapshot_of(source));
    }
    return {value.identifier(),
            value.meaning(),
            std::move(sources),
            value.categories(),
            value.linkedConceptIdentifiers()};
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

[[nodiscard]] SemanticConcept proposal(
    std::string identifier,
    std::string meaning,
    const LongTermMemory& evidence,
    const std::vector<std::string_view>& source_identifiers) {
    std::vector<LongTermMemoryEntry> sources;
    sources.reserve(source_identifiers.size());
    for (const auto source_identifier : source_identifiers) {
        sources.push_back(require_entry(evidence, source_identifier));
    }
    return SemanticConcept{std::move(identifier),
                           std::move(meaning),
                           std::move(sources)};
}

void classify(SemanticMemoryEngine& engine,
              SemanticMemory& memory,
              const LongTermMemory& evidence,
              std::string identifier,
              std::string meaning,
              const std::vector<std::string_view>& sources) {
    const auto result = engine.classify(
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
    LongTermMemory probe_evidence{memory.workspaceIdentifier()};
    const auto retained = LongTermMemoryEngine{}.retain(
        probe_evidence,
        LongTermMemoryEntry{
            "private-semantic-allocation-history-probe-source",
            "private-semantic-allocation-history-probe-value"});
    if (!retained.succeeded()) {
        return "PROBE-SOURCE-FAILURE:" + retained.code();
    }
    SemanticMemory probe{memory};
    const auto classified = SemanticMemoryEngine{}.classify(
        probe,
        probe_evidence,
        proposal(std::string{identifier},
                 "private-semantic-allocation-history-probe-meaning",
                 probe_evidence,
                 {"private-semantic-allocation-history-probe-source"}));
    if (classified.code() == "FORGOTTEN_IDENTIFIER") {
        return "FORGOTTEN";
    }
    if (classified.succeeded()) {
        return "ABSENT";
    }
    return "UNEXPECTED:" + classified.code();
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
        LongTermMemoryEntry{std::string{identifier},
                            "private-long-term-history-probe-value"});
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
    const std::vector<std::string_view>& probes) {
    std::vector<ConceptSnapshot> concepts;
    concepts.reserve(memory.concepts().size());
    for (const auto& semantic_concept : memory.concepts()) {
        concepts.push_back(snapshot_of(semantic_concept));
    }
    std::vector<IdentifierSnapshot> identifiers;
    identifiers.reserve(probes.size());
    for (const auto probe : probes) {
        identifiers.push_back(
            {std::string{probe}, semantic_disposition(memory, probe)});
    }
    return {memory.workspaceIdentifier(),
            std::move(concepts),
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
    return {snapshot_of(fixture.target, fixture.concept_probes),
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
    classify(fixture.semantic_engine,
             fixture.target,
             fixture.evidence,
             std::string{concept_a},
             "concept-a-meaning-with-enough-content-to-require-allocation",
             {source_a, source_b});
    classify(fixture.semantic_engine,
             fixture.target,
             fixture.evidence,
             std::string{concept_b},
             "concept-b-meaning-with-enough-content-to-require-allocation",
             {source_b});
    classify(fixture.semantic_engine,
             fixture.target,
             fixture.evidence,
             std::string{concept_c},
             "concept-c-meaning-with-enough-content-to-require-allocation",
             {source_a});
    classify(fixture.semantic_engine,
             fixture.target,
             fixture.evidence,
             std::string{forgotten_concept},
             "forgotten-meaning-with-enough-content-to-require-allocation",
             {source_a});
    ASSERT_TRUE(fixture.semantic_engine
                    .categorize(
                        fixture.target,
                        concept_a,
                        "first-category-with-enough-content-to-allocate")
                    .succeeded());
    ASSERT_TRUE(fixture.semantic_engine
                    .categorize(
                        fixture.target,
                        concept_a,
                        "second-category-with-enough-content-to-allocate")
                    .succeeded());
    ASSERT_TRUE(
        fixture.semantic_engine.link(fixture.target, concept_a, concept_b)
            .succeeded());
    ASSERT_TRUE(
        fixture.semantic_engine.link(fixture.target, concept_a, concept_c)
            .succeeded());
    ASSERT_TRUE(
        fixture.semantic_engine.link(fixture.target, concept_b, concept_c)
            .succeeded());
    ASSERT_TRUE(fixture.semantic_engine
                    .forget(fixture.target, forgotten_concept)
                    .succeeded());
}

constexpr std::size_t allocation_campaign_limit = 1024U;

template <typename Arrange, typename Operation>
void verify_strong_guarantee(Arrange arrange, Operation operation) {
    std::size_t observed_failures = 0U;
    bool completed = false;

    for (std::size_t index = 0U;
         index < allocation_campaign_limit;
         ++index) {
        auto fixture = arrange();
        const auto before = snapshot_of(fixture);

        semantic_memory_allocation_failure_support::fail_after(index);
        try {
            const auto result = operation(fixture);
            semantic_memory_allocation_failure_support::disable();
            EXPECT_TRUE(result.succeeded()) << result.code() << ": "
                                            << result.message();
            completed = true;
            break;
        } catch (const std::bad_alloc&) {
            semantic_memory_allocation_failure_support::disable();
            ++observed_failures;
            EXPECT_EQ(snapshot_of(fixture), before);
        } catch (...) {
            semantic_memory_allocation_failure_support::disable();
            throw;
        }
    }

    semantic_memory_allocation_failure_support::disable();
    EXPECT_TRUE(completed);
    EXPECT_GT(observed_failures, 0U);
}

[[nodiscard]] Fixture seeded_fixture() {
    Fixture fixture;
    seed(fixture);
    return fixture;
}

TEST(SemanticMemoryAllocationFailureTest,
     ClassifyAppendPreservesAllStateAtEveryFailure) {
    verify_strong_guarantee(
        [] { return seeded_fixture(); },
        [](Fixture& fixture) {
            return fixture.semantic_engine.classify(
                fixture.target,
                fixture.evidence,
                proposal(
                    std::string{candidate_concept},
                    "candidate-meaning-with-enough-content-to-require-allocation",
                    fixture.evidence,
                    {source_b, source_a}));
        });
}

TEST(SemanticMemoryAllocationFailureTest,
     ClassifyIdempotencePreservesAllStateAtEveryFailure) {
    verify_strong_guarantee(
        [] { return seeded_fixture(); },
        [](Fixture& fixture) {
            return fixture.semantic_engine.classify(
                fixture.target,
                fixture.evidence,
                proposal(
                    std::string{concept_a},
                    "concept-a-meaning-with-enough-content-to-require-allocation",
                    fixture.evidence,
                    {source_a, source_b}));
        });
}

TEST(SemanticMemoryAllocationFailureTest,
     CategorizeAppendPreservesAllStateAtEveryFailure) {
    verify_strong_guarantee(
        [] { return seeded_fixture(); },
        [](Fixture& fixture) {
            return fixture.semantic_engine.categorize(
                fixture.target,
                concept_b,
                "new-category-with-enough-content-to-require-allocation");
        });
}

TEST(SemanticMemoryAllocationFailureTest,
     CategorizeIdempotencePreservesAllStateAtEveryFailure) {
    verify_strong_guarantee(
        [] { return seeded_fixture(); },
        [](Fixture& fixture) {
            return fixture.semantic_engine.categorize(
                fixture.target,
                concept_a,
                "first-category-with-enough-content-to-allocate");
        });
}

TEST(SemanticMemoryAllocationFailureTest,
     LinkAppendPreservesAllStateAtEveryFailure) {
    verify_strong_guarantee(
        [] {
            Fixture fixture;
            retain(fixture.long_term_engine,
                   fixture.evidence,
                   std::string{source_a},
                   "source-a-value-with-enough-content-to-require-allocation");
            classify(fixture.semantic_engine,
                     fixture.target,
                     fixture.evidence,
                     std::string{concept_a},
                     "concept-a-meaning-with-enough-content-to-require-allocation",
                     {source_a});
            classify(fixture.semantic_engine,
                     fixture.target,
                     fixture.evidence,
                     std::string{concept_b},
                     "concept-b-meaning-with-enough-content-to-require-allocation",
                     {source_a});
            return fixture;
        },
        [](Fixture& fixture) {
            return fixture.semantic_engine.link(
                fixture.target, concept_a, concept_b);
        });
}

TEST(SemanticMemoryAllocationFailureTest,
     LinkIdempotencePreservesAllStateAtEveryFailure) {
    verify_strong_guarantee(
        [] { return seeded_fixture(); },
        [](Fixture& fixture) {
            return fixture.semantic_engine.link(
                fixture.target, concept_a, concept_b);
        });
}

TEST(SemanticMemoryAllocationFailureTest,
     UpdateReplacementPreservesAllStateAtEveryFailure) {
    verify_strong_guarantee(
        [] { return seeded_fixture(); },
        [](Fixture& fixture) {
            return fixture.semantic_engine.update(
                fixture.target,
                concept_a,
                "replacement-meaning-with-enough-content-to-require-allocation");
        });
}

TEST(SemanticMemoryAllocationFailureTest,
     UpdateIdempotencePreservesAllStateAtEveryFailure) {
    verify_strong_guarantee(
        [] { return seeded_fixture(); },
        [](Fixture& fixture) {
            return fixture.semantic_engine.update(
                fixture.target,
                concept_a,
                "concept-a-meaning-with-enough-content-to-require-allocation");
        });
}

TEST(SemanticMemoryAllocationFailureTest,
     ForgetPresentWithMultiSurvivorLinksPreservesAllStateAtEveryFailure) {
    verify_strong_guarantee(
        [] { return seeded_fixture(); },
        [](Fixture& fixture) {
            return fixture.semantic_engine.forget(
                fixture.target, concept_b);
        });
}

TEST(SemanticMemoryAllocationFailureTest,
     ForgetAbsentPreservesAllStateAtEveryFailure) {
    verify_strong_guarantee(
        [] { return seeded_fixture(); },
        [](Fixture& fixture) {
            return fixture.semantic_engine.forget(
                fixture.target, absent_concept);
        });
}

TEST(SemanticMemoryAllocationFailureTest,
     ForgetRepeatedPreservesAllStateAtEveryFailure) {
    verify_strong_guarantee(
        [] { return seeded_fixture(); },
        [](Fixture& fixture) {
            return fixture.semantic_engine.forget(
                fixture.target, forgotten_concept);
        });
}

} // namespace
