#include <cca/memory/episodic_memory.hpp>
#include <cca/memory/long_term_memory.hpp>

#include <gtest/gtest.h>

#include <cstddef>
#include <cstdint>
#include <cstdlib>
#include <limits>
#include <new>
#include <string>
#include <string_view>
#include <utility>
#include <vector>

// CCA-EPMEM-010 through CCA-EPMEM-015, CCA-EPMEM-018 through
// CCA-EPMEM-023, CCA-EPMEM-026 through CCA-EPMEM-029, and CCA-EPMEM-039:
// independently inject every ordinary allocation failure for every mutating
// operation and compare complete Episodic state, hidden Forgotten behavior,
// canonical chronology, provenance, links, and complete Long-Term evidence.

namespace episodic_memory_allocation_failure_support {

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

} // namespace episodic_memory_allocation_failure_support

void* operator new(const std::size_t size) {
    return episodic_memory_allocation_failure_support::allocate(size);
}

void* operator new[](const std::size_t size) {
    return episodic_memory_allocation_failure_support::allocate(size);
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

using cca::memory::Episode;
using cca::memory::EpisodicMemory;
using cca::memory::EpisodicMemoryEngine;
using cca::memory::LongTermMemory;
using cca::memory::LongTermMemoryEngine;
using cca::memory::LongTermMemoryEntry;

constexpr std::string_view source_a{
    "source-a-with-a-long-identifier-for-allocation-testing"};
constexpr std::string_view source_b{
    "source-b-with-a-long-identifier-for-allocation-testing"};
constexpr std::string_view episode_a{
    "episode-a-with-a-long-identifier-for-allocation-testing"};
constexpr std::string_view episode_b{
    "episode-b-with-a-long-identifier-for-allocation-testing"};
constexpr std::string_view episode_c{
    "episode-c-with-a-long-identifier-for-allocation-testing"};
constexpr std::string_view forgotten_episode{
    "forgotten-episode-with-a-long-identifier-for-allocation-testing"};
constexpr std::string_view candidate_episode{
    "candidate-episode-with-a-long-identifier-for-allocation-testing"};
constexpr std::string_view absent_episode{
    "absent-episode-with-a-long-identifier-for-allocation-testing"};

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

struct Fixture final {
    EpisodicMemoryEngine episodic_engine;
    LongTermMemoryEngine long_term_engine;
    EpisodicMemory target{"episodic-allocation-test-workspace"};
    LongTermMemory evidence{"episodic-allocation-test-workspace"};
    std::vector<std::string_view> episode_probes{
        episode_a,
        episode_b,
        episode_c,
        forgotten_episode,
        candidate_episode,
        absent_episode};
    std::vector<std::string_view> source_probes{source_a, source_b};
};

struct FixtureSnapshot final {
    EpisodicStateSnapshot target;
    LongTermStateSnapshot evidence;

    bool operator==(const FixtureSnapshot&) const = default;
};

[[nodiscard]] EntrySnapshot snapshot_of(const LongTermMemoryEntry& entry) {
    return {entry.identifier(), entry.value(), entry.archived()};
}

[[nodiscard]] EpisodeSnapshot snapshot_of(const Episode& episode) {
    std::vector<EntrySnapshot> sources;
    sources.reserve(episode.sourceEntries().size());
    for (const auto& source : episode.sourceEntries()) {
        sources.push_back(snapshot_of(source));
    }
    return {episode.identifier(),
            episode.occurrence(),
            episode.context(),
            episode.chronology(),
            std::move(sources),
            episode.linkedEpisodeIdentifiers()};
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

[[nodiscard]] Episode proposal(
    std::string identifier,
    std::string occurrence,
    std::string context,
    const std::int64_t chronology,
    const LongTermMemory& evidence,
    const std::vector<std::string_view>& source_identifiers) {
    std::vector<LongTermMemoryEntry> sources;
    sources.reserve(source_identifiers.size());
    for (const auto source_identifier : source_identifiers) {
        sources.push_back(require_entry(evidence, source_identifier));
    }
    return Episode{std::move(identifier),
                   std::move(occurrence),
                   std::move(context),
                   chronology,
                   std::move(sources)};
}

void derive(EpisodicMemoryEngine& engine,
            EpisodicMemory& memory,
            const LongTermMemory& evidence,
            std::string identifier,
            std::string occurrence,
            std::string context,
            const std::int64_t chronology,
            const std::vector<std::string_view>& sources) {
    const auto result = engine.derive(
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
    LongTermMemory probe_evidence{memory.workspaceIdentifier()};
    const auto retained = LongTermMemoryEngine{}.retain(
        probe_evidence,
        LongTermMemoryEntry{
            "private-episodic-allocation-history-probe-source",
            "private-episodic-allocation-history-probe-value"});
    if (!retained.succeeded()) {
        return "PROBE-SOURCE-FAILURE:" + retained.code();
    }
    EpisodicMemory probe{memory};
    const auto derived = EpisodicMemoryEngine{}.derive(
        probe,
        probe_evidence,
        proposal(std::string{identifier},
                 "private-episodic-allocation-history-probe-occurrence",
                 "private-episodic-allocation-history-probe-context",
                 0,
                 probe_evidence,
                 {"private-episodic-allocation-history-probe-source"}));
    if (derived.code() == "FORGOTTEN_IDENTIFIER") {
        return "FORGOTTEN";
    }
    if (derived.succeeded()) {
        return "ABSENT";
    }
    return "UNEXPECTED:" + derived.code();
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

[[nodiscard]] EpisodicStateSnapshot snapshot_of(
    const EpisodicMemory& memory,
    const std::vector<std::string_view>& probes) {
    std::vector<EpisodeSnapshot> episodes;
    episodes.reserve(memory.episodes().size());
    for (const auto& episode : memory.episodes()) {
        episodes.push_back(snapshot_of(episode));
    }
    std::vector<IdentifierSnapshot> identifiers;
    identifiers.reserve(probes.size());
    for (const auto probe : probes) {
        identifiers.push_back(
            {std::string{probe}, episodic_disposition(memory, probe)});
    }
    return {memory.workspaceIdentifier(),
            std::move(episodes),
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
    return {snapshot_of(fixture.target, fixture.episode_probes),
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
    derive(fixture.episodic_engine,
           fixture.target,
           fixture.evidence,
           std::string{episode_a},
           "episode-a-occurrence-with-enough-content-to-require-allocation",
           "episode-a-context-with-enough-content-to-require-allocation",
           10,
           {source_a, source_b});
    derive(fixture.episodic_engine,
           fixture.target,
           fixture.evidence,
           std::string{episode_b},
           "episode-b-occurrence-with-enough-content-to-require-allocation",
           "episode-b-context-with-enough-content-to-require-allocation",
           20,
           {source_b});
    derive(fixture.episodic_engine,
           fixture.target,
           fixture.evidence,
           std::string{episode_c},
           "episode-c-occurrence-with-enough-content-to-require-allocation",
           "episode-c-context-with-enough-content-to-require-allocation",
           30,
           {source_a});
    derive(fixture.episodic_engine,
           fixture.target,
           fixture.evidence,
           std::string{forgotten_episode},
           "forgotten-occurrence-with-enough-content-to-require-allocation",
           "forgotten-context-with-enough-content-to-require-allocation",
           15,
           {source_a});
    ASSERT_TRUE(fixture.episodic_engine
                    .link(fixture.target, episode_a, episode_b)
                    .succeeded());
    ASSERT_TRUE(fixture.episodic_engine
                    .link(fixture.target, episode_a, episode_c)
                    .succeeded());
    ASSERT_TRUE(fixture.episodic_engine
                    .link(fixture.target, episode_b, episode_c)
                    .succeeded());
    ASSERT_TRUE(fixture.episodic_engine
                    .forget(fixture.target, forgotten_episode)
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

        episodic_memory_allocation_failure_support::fail_after(index);
        try {
            const auto result = operation(fixture);
            episodic_memory_allocation_failure_support::disable();
            EXPECT_TRUE(result.succeeded()) << result.code() << ": "
                                            << result.message();
            completed = true;
            break;
        } catch (const std::bad_alloc&) {
            episodic_memory_allocation_failure_support::disable();
            ++observed_failures;
            EXPECT_EQ(snapshot_of(fixture), before);
        } catch (...) {
            episodic_memory_allocation_failure_support::disable();
            throw;
        }
    }

    episodic_memory_allocation_failure_support::disable();
    EXPECT_TRUE(completed);
    EXPECT_GT(observed_failures, 0U);
}

[[nodiscard]] Fixture seeded_fixture() {
    Fixture fixture;
    seed(fixture);
    return fixture;
}

TEST(EpisodicMemoryAllocationFailureTest,
     RecordAppendPreservesAllStateAtEveryFailure) {
    verify_strong_guarantee(
        [] { return seeded_fixture(); },
        [](Fixture& fixture) {
            return fixture.episodic_engine.record(
                fixture.target,
                fixture.evidence,
                proposal(
                    std::string{candidate_episode},
                    "candidate-occurrence-with-enough-content-to-allocate",
                    "candidate-context-with-enough-content-to-allocate",
                    40,
                    fixture.evidence,
                    {source_b, source_a}));
        });
}

TEST(EpisodicMemoryAllocationFailureTest,
     RecordIdempotencePreservesAllStateAtEveryFailure) {
    verify_strong_guarantee(
        [] { return seeded_fixture(); },
        [](Fixture& fixture) {
            return fixture.episodic_engine.record(
                fixture.target,
                fixture.evidence,
                proposal(
                    std::string{episode_c},
                    "episode-c-occurrence-with-enough-content-to-require-allocation",
                    "episode-c-context-with-enough-content-to-require-allocation",
                    30,
                    fixture.evidence,
                    {source_a}));
        });
}

TEST(EpisodicMemoryAllocationFailureTest,
     DeriveInsertionPreservesAllStateAtEveryFailure) {
    verify_strong_guarantee(
        [] { return seeded_fixture(); },
        [](Fixture& fixture) {
            return fixture.episodic_engine.derive(
                fixture.target,
                fixture.evidence,
                proposal(
                    std::string{candidate_episode},
                    "candidate-occurrence-with-enough-content-to-allocate",
                    "candidate-context-with-enough-content-to-allocate",
                    15,
                    fixture.evidence,
                    {source_b, source_a}));
        });
}

TEST(EpisodicMemoryAllocationFailureTest,
     DeriveIdempotencePreservesAllStateAtEveryFailure) {
    verify_strong_guarantee(
        [] { return seeded_fixture(); },
        [](Fixture& fixture) {
            return fixture.episodic_engine.derive(
                fixture.target,
                fixture.evidence,
                proposal(
                    std::string{episode_b},
                    "episode-b-occurrence-with-enough-content-to-require-allocation",
                    "episode-b-context-with-enough-content-to-require-allocation",
                    20,
                    fixture.evidence,
                    {source_b}));
        });
}

TEST(EpisodicMemoryAllocationFailureTest,
     LinkAppendPreservesAllStateAtEveryFailure) {
    verify_strong_guarantee(
        [] {
            Fixture fixture;
            retain(fixture.long_term_engine,
                   fixture.evidence,
                   std::string{source_a},
                   "source-a-value-with-enough-content-to-require-allocation");
            derive(fixture.episodic_engine,
                   fixture.target,
                   fixture.evidence,
                   std::string{episode_a},
                   "episode-a-occurrence-with-enough-content-to-allocate",
                   "episode-a-context-with-enough-content-to-allocate",
                   10,
                   {source_a});
            derive(fixture.episodic_engine,
                   fixture.target,
                   fixture.evidence,
                   std::string{episode_b},
                   "episode-b-occurrence-with-enough-content-to-allocate",
                   "episode-b-context-with-enough-content-to-allocate",
                   20,
                   {source_a});
            return fixture;
        },
        [](Fixture& fixture) {
            return fixture.episodic_engine.link(
                fixture.target, episode_a, episode_b);
        });
}

TEST(EpisodicMemoryAllocationFailureTest,
     LinkIdempotencePreservesAllStateAtEveryFailure) {
    verify_strong_guarantee(
        [] { return seeded_fixture(); },
        [](Fixture& fixture) {
            return fixture.episodic_engine.link(
                fixture.target, episode_a, episode_b);
        });
}

TEST(EpisodicMemoryAllocationFailureTest,
     UpdateReplacementPreservesAllStateAtEveryFailure) {
    verify_strong_guarantee(
        [] { return seeded_fixture(); },
        [](Fixture& fixture) {
            return fixture.episodic_engine.update(
                fixture.target,
                episode_a,
                "replacement-occurrence-with-enough-content-to-allocate",
                "replacement-context-with-enough-content-to-allocate");
        });
}

TEST(EpisodicMemoryAllocationFailureTest,
     UpdateIdempotencePreservesAllStateAtEveryFailure) {
    verify_strong_guarantee(
        [] { return seeded_fixture(); },
        [](Fixture& fixture) {
            return fixture.episodic_engine.update(
                fixture.target,
                episode_a,
                "episode-a-occurrence-with-enough-content-to-require-allocation",
                "episode-a-context-with-enough-content-to-require-allocation");
        });
}

TEST(EpisodicMemoryAllocationFailureTest,
     ForgetPresentWithMultiSurvivorLinksPreservesAllStateAtEveryFailure) {
    verify_strong_guarantee(
        [] { return seeded_fixture(); },
        [](Fixture& fixture) {
            return fixture.episodic_engine.forget(
                fixture.target, episode_b);
        });
}

TEST(EpisodicMemoryAllocationFailureTest,
     ForgetAbsentPreservesAllStateAtEveryFailure) {
    verify_strong_guarantee(
        [] { return seeded_fixture(); },
        [](Fixture& fixture) {
            return fixture.episodic_engine.forget(
                fixture.target, absent_episode);
        });
}

TEST(EpisodicMemoryAllocationFailureTest,
     ForgetRepeatedPreservesAllStateAtEveryFailure) {
    verify_strong_guarantee(
        [] { return seeded_fixture(); },
        [](Fixture& fixture) {
            return fixture.episodic_engine.forget(
                fixture.target, forgotten_episode);
        });
}

} // namespace
