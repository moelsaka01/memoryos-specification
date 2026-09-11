#include <cca/memory/memory_consolidation.hpp>

#include <gtest/gtest.h>

#include <cstddef>
#include <cstdint>
#include <cstdlib>
#include <limits>
#include <new>
#include <optional>
#include <stdexcept>
#include <string>
#include <string_view>
#include <utility>
#include <vector>

// CCA-CONS-021 through CCA-CONS-030, CCA-CONS-034, CCA-CONS-036,
// CCA-CONS-038, CCA-CONS-039, and CCA-CONS-047: inject every ordinary
// allocation failure into all six consolidation operations. After each
// exception, compare the complete public session, a continuation fingerprint
// of its private staged state, both complete input aggregates, ordering, and
// Long-Term forgotten-identity behavior.

namespace memory_consolidation_allocation_failure_support {

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

} // namespace memory_consolidation_allocation_failure_support

void* operator new(const std::size_t size) {
    return memory_consolidation_allocation_failure_support::allocate(size);
}

void* operator new[](const std::size_t size) {
    return memory_consolidation_allocation_failure_support::allocate(size);
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

using cca::memory::ConsolidationCandidate;
using cca::memory::ConsolidationRequest;
using cca::memory::ConsolidationResult;
using cca::memory::ConsolidationSession;
using cca::memory::LongTermMemory;
using cca::memory::LongTermMemoryEngine;
using cca::memory::LongTermMemoryEntry;
using cca::memory::MemoryConsolidationEngine;
using cca::memory::WorkingMemory;
using cca::memory::WorkingMemoryEngine;
using cca::memory::WorkingMemoryEntry;

using State = ConsolidationSession::State;

constexpr std::string_view workspace{
    "consolidation-allocation-workspace-with-long-identifier"};
constexpr std::string_view task{
    "consolidation-allocation-active-task-with-long-identifier"};
constexpr std::string_view source_identifier{
    "consolidation-allocation-working-source-with-long-identifier"};
constexpr std::string_view forgotten_identifier{
    "consolidation-allocation-forgotten-long-term-identifier"};

struct WorkingEntrySnapshot final {
    std::string identifier;
    std::string value;
    std::optional<std::uint64_t> expiration_point;

    bool operator==(const WorkingEntrySnapshot&) const = default;
};

struct WorkingSnapshot final {
    std::string workspace_identifier;
    bool active;
    std::optional<std::string> task_identifier;
    std::vector<WorkingEntrySnapshot> entries;

    bool operator==(const WorkingSnapshot&) const = default;
};

struct LongTermEntrySnapshot final {
    std::string identifier;
    std::string value;
    bool archived;

    bool operator==(const LongTermEntrySnapshot&) const = default;
};

struct LongTermSnapshot final {
    std::string workspace_identifier;
    std::vector<LongTermEntrySnapshot> entries;
    std::string source_disposition;
    std::string forgotten_disposition;

    bool operator==(const LongTermSnapshot&) const = default;
};

struct RequestSnapshot final {
    std::string workspace_identifier;
    std::string task_identifier;
    std::string entry_identifier;

    bool operator==(const RequestSnapshot&) const = default;
};

struct CandidateSnapshot final {
    std::string workspace_identifier;
    std::string task_identifier;
    std::size_t source_position;
    std::optional<WorkingEntrySnapshot> working_entry;
    std::optional<LongTermEntrySnapshot> long_term_entry;
    std::optional<std::size_t> retained_position;

    bool operator==(const CandidateSnapshot&) const = default;
};

struct SessionSnapshot final {
    std::string workspace_identifier;
    State state;
    std::optional<RequestSnapshot> request;
    std::optional<CandidateSnapshot> candidate;
    std::optional<WorkingSnapshot> working;
    std::optional<LongTermSnapshot> long_term;

    bool operator==(const SessionSnapshot&) const = default;
};

struct ResultSnapshot final {
    bool succeeded;
    std::string code;
    std::string message;
    std::optional<CandidateSnapshot> candidate;
    std::optional<SessionSnapshot> session;
    std::optional<WorkingSnapshot> working;
    std::optional<LongTermSnapshot> long_term;

    bool operator==(const ResultSnapshot&) const = default;
};

struct ContinuationSnapshot final {
    std::vector<std::string> codes;
    SessionSnapshot final_session;
    std::optional<ResultSnapshot> final_result;

    bool operator==(const ContinuationSnapshot&) const = default;
};

struct FixtureSnapshot final {
    RequestSnapshot request;
    SessionSnapshot session;
    ContinuationSnapshot continuation;
    WorkingSnapshot working;
    LongTermSnapshot long_term;

    bool operator==(const FixtureSnapshot&) const = default;
};

[[nodiscard]] WorkingEntrySnapshot snapshot_of(
    const WorkingMemoryEntry& entry) {
    return {entry.identifier(), entry.value(), entry.expirationPoint()};
}

[[nodiscard]] LongTermEntrySnapshot snapshot_of(
    const LongTermMemoryEntry& entry) {
    return {entry.identifier(), entry.value(), entry.archived()};
}

[[nodiscard]] WorkingSnapshot snapshot_of(const WorkingMemory& memory) {
    std::vector<WorkingEntrySnapshot> entries;
    entries.reserve(memory.entries().size());
    for (const auto& entry : memory.entries()) {
        entries.push_back(snapshot_of(entry));
    }
    return {memory.workspaceIdentifier(),
            memory.active(),
            memory.activeTaskIdentifier(),
            std::move(entries)};
}

[[nodiscard]] std::string disposition_of(
    const LongTermMemory& memory,
    const std::string_view identifier) {
    if (const auto* const entry = memory.find(identifier); entry != nullptr) {
        return entry->archived() ? "ARCHIVED" : "LONG_TERM";
    }

    LongTermMemory probe{memory};
    const auto result = LongTermMemoryEngine{}.retain(
        probe,
        LongTermMemoryEntry{
            std::string{identifier},
            "allocation-probe-value-with-enough-content-to-allocate"});
    if (result.code() == "FORGOTTEN_IDENTIFIER") {
        return "FORGOTTEN";
    }
    if (result.succeeded()) {
        return "ABSENT";
    }
    return "UNEXPECTED:" + result.code();
}

[[nodiscard]] LongTermSnapshot snapshot_of(const LongTermMemory& memory) {
    std::vector<LongTermEntrySnapshot> entries;
    entries.reserve(memory.entries().size());
    for (const auto& entry : memory.entries()) {
        entries.push_back(snapshot_of(entry));
    }
    return {memory.workspaceIdentifier(),
            std::move(entries),
            disposition_of(memory, source_identifier),
            disposition_of(memory, forgotten_identifier)};
}

[[nodiscard]] RequestSnapshot snapshot_of(
    const ConsolidationRequest& request) {
    return {request.workspaceIdentifier(),
            request.taskIdentifier(),
            request.entryIdentifier()};
}

[[nodiscard]] CandidateSnapshot snapshot_of(
    const ConsolidationCandidate& candidate) {
    std::optional<WorkingEntrySnapshot> working_entry;
    if (const auto* const entry = candidate.workingMemoryEntry();
        entry != nullptr) {
        working_entry = snapshot_of(*entry);
    }

    std::optional<LongTermEntrySnapshot> long_term_entry;
    if (const auto* const entry = candidate.longTermMemoryEntry();
        entry != nullptr) {
        long_term_entry = snapshot_of(*entry);
    }

    return {candidate.workspaceIdentifier(),
            candidate.taskIdentifier(),
            candidate.sourcePosition(),
            std::move(working_entry),
            std::move(long_term_entry),
            candidate.retainedPosition()};
}

[[nodiscard]] SessionSnapshot snapshot_of(
    const ConsolidationSession& session) {
    std::optional<RequestSnapshot> request;
    if (const auto* const value = session.request(); value != nullptr) {
        request = snapshot_of(*value);
    }

    std::optional<CandidateSnapshot> candidate;
    if (const auto* const value = session.candidate(); value != nullptr) {
        candidate = snapshot_of(*value);
    }

    std::optional<WorkingSnapshot> working;
    if (const auto* const value = session.workingMemory(); value != nullptr) {
        working = snapshot_of(*value);
    }

    std::optional<LongTermSnapshot> long_term;
    if (const auto* const value = session.longTermMemory(); value != nullptr) {
        long_term = snapshot_of(*value);
    }

    return {session.workspaceIdentifier(),
            session.state(),
            std::move(request),
            std::move(candidate),
            std::move(working),
            std::move(long_term)};
}

[[nodiscard]] ResultSnapshot snapshot_of(
    const ConsolidationResult& result) {
    std::optional<CandidateSnapshot> candidate;
    if (const auto* const value = result.candidate(); value != nullptr) {
        candidate = snapshot_of(*value);
    }

    std::optional<SessionSnapshot> session;
    if (const auto* const value = result.session(); value != nullptr) {
        session = snapshot_of(*value);
    }

    std::optional<WorkingSnapshot> working;
    if (const auto* const value = result.workingMemory(); value != nullptr) {
        working = snapshot_of(*value);
    }

    std::optional<LongTermSnapshot> long_term;
    if (const auto* const value = result.longTermMemory(); value != nullptr) {
        long_term = snapshot_of(*value);
    }

    return {result.succeeded(),
            result.code(),
            result.message(),
            std::move(candidate),
            std::move(session),
            std::move(working),
            std::move(long_term)};
}

void require_success(const bool succeeded,
                     const std::string& code,
                     const std::string& message) {
    if (!succeeded) {
        throw std::runtime_error{code + ": " + message};
    }
}

void activate(WorkingMemory& memory) {
    const auto result = WorkingMemoryEngine{}.activate(
        memory, std::string{task});
    require_success(result.succeeded(), result.code(), result.message());
}

void store(WorkingMemory& memory,
           std::string identifier,
           std::string value,
           const std::optional<std::uint64_t> expiration) {
    const auto result = WorkingMemoryEngine{}.store(
        memory,
        WorkingMemoryEntry{
            std::move(identifier), std::move(value), expiration});
    require_success(result.succeeded(), result.code(), result.message());
}

void retain(LongTermMemory& memory,
            std::string identifier,
            std::string value) {
    const auto result = LongTermMemoryEngine{}.retain(
        memory,
        LongTermMemoryEntry{std::move(identifier), std::move(value)});
    require_success(result.succeeded(), result.code(), result.message());
}

struct Fixture final {
    WorkingMemory working{std::string{workspace}};
    LongTermMemory long_term{std::string{workspace}};
    ConsolidationSession session{std::string{workspace}};
    ConsolidationRequest request{std::string{workspace},
                                 std::string{task},
                                 std::string{source_identifier}};
    MemoryConsolidationEngine engine;

    Fixture() {
        activate(working);
        store(working,
              "consolidation-allocation-working-a-with-long-identifier",
              "consolidation-allocation-working-a-value-with-long-content",
              100U);
        store(working,
              std::string{source_identifier},
              "consolidation-allocation-source-value-with-long-content",
              200U);
        store(working,
              "consolidation-allocation-working-c-with-long-identifier",
              "consolidation-allocation-working-c-value-with-long-content",
              300U);

        retain(long_term,
               "consolidation-allocation-long-a-with-long-identifier",
               "consolidation-allocation-long-a-value-with-long-content");
        retain(long_term,
               "consolidation-allocation-long-b-with-long-identifier",
               "consolidation-allocation-long-b-value-with-long-content");
        retain(long_term,
               std::string{forgotten_identifier},
               "consolidation-allocation-forgotten-value-with-long-content");
        const auto archived = LongTermMemoryEngine{}.archive(
            long_term,
            "consolidation-allocation-long-a-with-long-identifier");
        require_success(
            archived.succeeded(), archived.code(), archived.message());
        const auto forgotten = LongTermMemoryEngine{}.forget(
            long_term, forgotten_identifier);
        require_success(
            forgotten.succeeded(), forgotten.code(), forgotten.message());
    }
};

void analyze(Fixture& fixture) {
    const auto result = fixture.engine.analyze(
        fixture.session,
        fixture.request,
        fixture.working,
        fixture.long_term);
    require_success(result.succeeded(), result.code(), result.message());
}

void promote(Fixture& fixture) {
    analyze(fixture);
    const auto result = fixture.engine.promote(fixture.session);
    require_success(result.succeeded(), result.code(), result.message());
}

void retain_transition(Fixture& fixture) {
    promote(fixture);
    const auto result = fixture.engine.retain(
        fixture.session, fixture.working, fixture.long_term);
    require_success(result.succeeded(), result.code(), result.message());
}

[[nodiscard]] Fixture analyzed_fixture() {
    Fixture fixture;
    analyze(fixture);
    return fixture;
}

[[nodiscard]] Fixture promoted_fixture() {
    Fixture fixture;
    promote(fixture);
    return fixture;
}

[[nodiscard]] Fixture retained_fixture() {
    Fixture fixture;
    retain_transition(fixture);
    return fixture;
}

[[nodiscard]] ContinuationSnapshot continuation_of(const Fixture& fixture) {
    ConsolidationSession session{fixture.session};
    MemoryConsolidationEngine engine;
    std::vector<std::string> codes;
    std::optional<ResultSnapshot> final_result;

    const auto observe = [&](const ConsolidationResult& result) {
        codes.push_back(result.code());
        final_result = snapshot_of(result);
        return result.succeeded();
    };

    if (session.state() == State::Pristine) {
        const auto result = engine.analyze(
            session, fixture.request, fixture.working, fixture.long_term);
        if (!observe(result)) {
            return {std::move(codes),
                    snapshot_of(session),
                    std::move(final_result)};
        }
    }
    if (session.state() == State::Analyzed) {
        const auto result = engine.promote(session);
        if (!observe(result)) {
            return {std::move(codes),
                    snapshot_of(session),
                    std::move(final_result)};
        }
    }
    if (session.state() == State::Promoted) {
        const auto result =
            engine.retain(session, fixture.working, fixture.long_term);
        if (!observe(result)) {
            return {std::move(codes),
                    snapshot_of(session),
                    std::move(final_result)};
        }
    }
    if (session.state() == State::Retained) {
        const auto* const working = session.workingMemory();
        const auto* const long_term = session.longTermMemory();
        if (working == nullptr || long_term == nullptr) {
            throw std::logic_error{"Retained session has no successor pair"};
        }
        const auto result = engine.validate(session, *working, *long_term);
        static_cast<void>(observe(result));
    } else if (session.state() == State::Forgotten) {
        const auto result = engine.retrieveSession(session);
        static_cast<void>(observe(result));
    }

    return {std::move(codes),
            snapshot_of(session),
            std::move(final_result)};
}

[[nodiscard]] FixtureSnapshot snapshot_of(const Fixture& fixture) {
    return {snapshot_of(fixture.request),
            snapshot_of(fixture.session),
            continuation_of(fixture),
            snapshot_of(fixture.working),
            snapshot_of(fixture.long_term)};
}

constexpr std::size_t allocation_campaign_limit = 4096U;

template <typename Arrange, typename Operation>
void verify_strong_guarantee(Arrange arrange,
                             Operation operation,
                             const bool expect_session_change) {
    std::size_t observed_failures = 0U;
    bool completed = false;

    for (std::size_t index = 0U;
         index < allocation_campaign_limit;
         ++index) {
        auto fixture = arrange();
        const auto before = snapshot_of(fixture);

        memory_consolidation_allocation_failure_support::fail_after(index);
        try {
            const auto result = operation(fixture);
            memory_consolidation_allocation_failure_support::disable();

            EXPECT_TRUE(result.succeeded())
                << result.code() << ": " << result.message();
            EXPECT_EQ(result.code(), "OK");
            EXPECT_TRUE(result.message().empty());
            EXPECT_EQ(snapshot_of(fixture.working), before.working);
            EXPECT_EQ(snapshot_of(fixture.long_term), before.long_term);
            if (expect_session_change) {
                EXPECT_NE(snapshot_of(fixture.session), before.session);
            } else {
                EXPECT_EQ(snapshot_of(fixture), before);
            }
            completed = true;
            break;
        } catch (const std::bad_alloc&) {
            memory_consolidation_allocation_failure_support::disable();
            ++observed_failures;
            EXPECT_EQ(snapshot_of(fixture), before);
        } catch (...) {
            memory_consolidation_allocation_failure_support::disable();
            throw;
        }
    }

    memory_consolidation_allocation_failure_support::disable();
    EXPECT_TRUE(completed);
    EXPECT_GT(observed_failures, 0U);
}

TEST(MemoryConsolidationAllocationFailureTest,
     AnalyzePreservesCompleteStateAtEveryFailure) {
    verify_strong_guarantee(
        [] { return Fixture{}; },
        [](Fixture& fixture) {
            return fixture.engine.analyze(
                fixture.session,
                fixture.request,
                fixture.working,
                fixture.long_term);
        },
        true);
}

TEST(MemoryConsolidationAllocationFailureTest,
     PromotePreservesCompleteStateAtEveryFailure) {
    verify_strong_guarantee(
        [] { return analyzed_fixture(); },
        [](Fixture& fixture) {
            return fixture.engine.promote(fixture.session);
        },
        true);
}

TEST(MemoryConsolidationAllocationFailureTest,
     RetainPreservesCompleteStateAtEveryFailure) {
    verify_strong_guarantee(
        [] { return promoted_fixture(); },
        [](Fixture& fixture) {
            return fixture.engine.retain(
                fixture.session, fixture.working, fixture.long_term);
        },
        true);
}

TEST(MemoryConsolidationAllocationFailureTest,
     ValidatePreservesCompleteStateAtEveryFailure) {
    verify_strong_guarantee(
        [] { return promoted_fixture(); },
        [](Fixture& fixture) {
            return fixture.engine.validate(
                fixture.session, fixture.working, fixture.long_term);
        },
        false);
}

TEST(MemoryConsolidationAllocationFailureTest,
     RetrieveSessionPreservesCompleteStateAtEveryFailure) {
    verify_strong_guarantee(
        [] { return retained_fixture(); },
        [](Fixture& fixture) {
            return fixture.engine.retrieveSession(fixture.session);
        },
        false);
}

TEST(MemoryConsolidationAllocationFailureTest,
     ForgetSessionPreservesCompleteStateAtEveryFailure) {
    verify_strong_guarantee(
        [] { return retained_fixture(); },
        [](Fixture& fixture) {
            return fixture.engine.forgetSession(fixture.session);
        },
        true);
}

} // namespace
