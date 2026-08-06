#include <cca/memory/memory_consolidation.hpp>

#include <cstdint>
#include <iostream>
#include <optional>

int main() {
    using cca::memory::ConsolidationRequest;
    using cca::memory::ConsolidationSession;
    using cca::memory::LongTermMemory;
    using cca::memory::LongTermMemoryEngine;
    using cca::memory::LongTermMemoryEntry;
    using cca::memory::MemoryConsolidationEngine;
    using cca::memory::WorkingMemory;
    using cca::memory::WorkingMemoryEngine;
    using cca::memory::WorkingMemoryEntry;

    WorkingMemory working_memory{"example-workspace"};
    WorkingMemoryEngine working_engine;
    const auto activated =
        working_engine.activate(working_memory, "example-task");
    const auto source_stored = working_engine.store(
        working_memory,
        WorkingMemoryEntry{"observation",
                           "the release candidate passed verification",
                           std::optional<std::uint64_t>{100U}});
    const auto survivor_stored = working_engine.store(
        working_memory,
        WorkingMemoryEntry{"next-action", "publish after approval"});

    LongTermMemory long_term_memory{"example-workspace"};
    LongTermMemoryEngine long_term_engine;
    const auto existing_retained = long_term_engine.retain(
        long_term_memory,
        LongTermMemoryEntry{"release-policy", "approval is required"});

    if (!activated.succeeded() || !source_stored.succeeded() ||
        !survivor_stored.succeeded() || !existing_retained.succeeded()) {
        return 1;
    }

    MemoryConsolidationEngine engine;
    ConsolidationSession session{"example-workspace"};
    ConsolidationRequest request{
        "example-workspace", "example-task", "observation"};

    const auto analyzed = engine.analyze(
        session, request, working_memory, long_term_memory);
    if (!analyzed.succeeded() || analyzed.candidate() == nullptr ||
        session.state() != ConsolidationSession::State::Analyzed ||
        analyzed.candidate()->sourcePosition() != 0U ||
        analyzed.candidate()->workingMemoryEntry() == nullptr) {
        return 1;
    }

    const auto promoted = engine.promote(session);
    if (!promoted.succeeded() || promoted.candidate() == nullptr ||
        promoted.candidate()->longTermMemoryEntry() == nullptr ||
        session.state() != ConsolidationSession::State::Promoted) {
        return 1;
    }

    const auto retained =
        engine.retain(session, working_memory, long_term_memory);
    if (!retained.succeeded() || retained.candidate() == nullptr ||
        retained.workingMemory() == nullptr ||
        retained.longTermMemory() == nullptr ||
        session.state() != ConsolidationSession::State::Retained ||
        !retained.candidate()->retainedPosition().has_value() ||
        *retained.candidate()->retainedPosition() != 1U) {
        return 1;
    }

    // Retention is functional: the caller's prestates remain unchanged, while
    // the result owns the complete Working/Long-Term successor pair.
    if (working_memory.find("observation") == nullptr ||
        long_term_memory.find("observation") != nullptr ||
        retained.workingMemory()->find("observation") != nullptr ||
        retained.workingMemory()->find("next-action") == nullptr ||
        retained.longTermMemory()->find("observation") == nullptr) {
        return 1;
    }

    const auto validated = engine.validate(
        session, *retained.workingMemory(), *retained.longTermMemory());
    const auto retrieved = engine.retrieveSession(session);
    if (!validated.succeeded() || !retrieved.succeeded() ||
        retrieved.session() == nullptr ||
        retrieved.session()->state() !=
            ConsolidationSession::State::Retained ||
        retrieved.session()->workingMemory() == nullptr ||
        retrieved.session()->longTermMemory() == nullptr) {
        return 1;
    }

    // These independently owned values are suitable for adoption by an
    // enclosing Workspace transaction. Only an adopted Long-Term successor is
    // eligible for the existing Persistence mapping; the consolidation
    // session is operational evidence and is not persisted. Runtime may host
    // the stateless engine but does not own any value used here.
    WorkingMemory successor_working{*retained.workingMemory()};
    LongTermMemory successor_long_term{*retained.longTermMemory()};

    const auto forgotten = engine.forgetSession(session);
    if (!forgotten.succeeded() ||
        session.state() != ConsolidationSession::State::Forgotten ||
        session.request() != nullptr || session.candidate() != nullptr ||
        session.workingMemory() != nullptr ||
        session.longTermMemory() != nullptr ||
        retrieved.session()->state() !=
            ConsolidationSession::State::Retained ||
        successor_working.size() != 1U || successor_long_term.size() != 2U) {
        return 1;
    }

    std::cout << "promoted observation to Long-Term position "
              << *retained.candidate()->retainedPosition() << '\n';
    return 0;
}
