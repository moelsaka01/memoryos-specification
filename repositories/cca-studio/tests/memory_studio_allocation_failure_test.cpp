#include <cca/memory/memory_studio.hpp>

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

// AF-014 / CCA-STUDIO-022, -032, -040, -044, -045, -048, and -057:
// this executable owns its allocation injector so normal production outcomes
// are unaffected. Each campaign injects one ordinary allocation failure at a
// time and continues until the first execution after the final failure point.

namespace memory_studio_allocation_failure_support {

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

} // namespace memory_studio_allocation_failure_support

void* operator new(const std::size_t size) {
    return memory_studio_allocation_failure_support::allocate(size);
}

void* operator new[](const std::size_t size) {
    return memory_studio_allocation_failure_support::allocate(size);
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

using namespace cca::memory;

const std::string workspace =
    "memory-studio-allocation-workspace-with-a-long-identifier";
const std::string other_workspace =
    "memory-studio-other-workspace-with-a-long-identifier";
const std::string task_identifier =
    "memory-studio-allocation-task-with-a-long-identifier";
const std::string working_identifier =
    "memory-studio-working-entry-with-a-long-identifier";
const std::string semantic_identifier =
    "memory-studio-semantic-concept-with-a-long-identifier";
const std::string episodic_identifier =
    "memory-studio-episodic-entry-with-a-long-identifier";
const std::string procedural_identifier =
    "memory-studio-procedural-entry-with-a-long-identifier";
const std::string forgotten_long_term_identifier =
    "memory-studio-forgotten-long-term-with-a-long-identifier";
const std::string forgotten_semantic_identifier =
    "memory-studio-forgotten-semantic-with-a-long-identifier";
const std::string forgotten_episodic_identifier =
    "memory-studio-forgotten-episodic-with-a-long-identifier";
const std::string forgotten_procedural_identifier =
    "memory-studio-forgotten-procedural-with-a-long-identifier";

template <typename Result>
void require_ok(const Result& result) {
    if (!result.succeeded()) {
        throw std::logic_error{result.code() + ": " + result.message()};
    }
}

struct Snapshot final {
    std::vector<std::string> fields;
    bool operator==(const Snapshot&) const = default;
};

class SnapshotBuilder final {
  public:
    void text(const std::string& name, const std::string_view value) {
        value_.fields.push_back(name);
        value_.fields.emplace_back(value);
    }

    void boolean(const std::string& name, const bool value) {
        text(name, value ? "true" : "false");
    }

    template <typename Integer>
    void number(const std::string& name, const Integer value) {
        text(name, std::to_string(value));
    }

    [[nodiscard]] Snapshot finish() && { return std::move(value_); }

  private:
    Snapshot value_;
};

[[nodiscard]] std::string indexed(const std::string& prefix,
                                  const std::size_t index) {
    return prefix + "[" + std::to_string(index) + "]";
}

void add_long_term_entry(SnapshotBuilder& builder,
                         const LongTermMemoryEntry& entry,
                         const std::string& prefix) {
    builder.text(prefix + ".identifier", entry.identifier());
    builder.text(prefix + ".value", entry.value());
    builder.boolean(prefix + ".archived", entry.archived());
}

void add_memory_entry(SnapshotBuilder& builder,
                      const MemoryEntry& entry,
                      const std::string& prefix) {
    builder.text(prefix + ".identifier", entry.identifier());
    builder.text(prefix + ".value", entry.value());
}

void add_working_entry(SnapshotBuilder& builder,
                       const WorkingMemoryEntry& entry,
                       const std::string& prefix) {
    builder.text(prefix + ".identifier", entry.identifier());
    builder.text(prefix + ".value", entry.value());
    builder.boolean(prefix + ".expiration.present",
                    entry.expirationPoint().has_value());
    if (entry.expirationPoint().has_value()) {
        builder.number(prefix + ".expiration.value",
                       *entry.expirationPoint());
    }
}

void add_semantic_concept(SnapshotBuilder& builder,
                          const SemanticConcept& semantic_concept,
                          const std::string& prefix) {
    builder.text(prefix + ".identifier", semantic_concept.identifier());
    builder.text(prefix + ".meaning", semantic_concept.meaning());
    builder.number(prefix + ".sources.size",
                   semantic_concept.sourceEntries().size());
    for (std::size_t index = 0U;
         index < semantic_concept.sourceEntries().size();
         ++index) {
        add_long_term_entry(builder, semantic_concept.sourceEntries()[index],
                            indexed(prefix + ".sources", index));
    }
    builder.number(prefix + ".categories.size",
                   semantic_concept.categories().size());
    for (std::size_t index = 0U;
         index < semantic_concept.categories().size(); ++index) {
        builder.text(indexed(prefix + ".categories", index),
                     semantic_concept.categories()[index]);
    }
    builder.number(prefix + ".links.size",
                   semantic_concept.linkedConceptIdentifiers().size());
    for (std::size_t index = 0U;
         index < semantic_concept.linkedConceptIdentifiers().size(); ++index) {
        builder.text(indexed(prefix + ".links", index),
                     semantic_concept.linkedConceptIdentifiers()[index]);
    }
}

void add_episode(SnapshotBuilder& builder,
                 const Episode& episode,
                 const std::string& prefix) {
    builder.text(prefix + ".identifier", episode.identifier());
    builder.text(prefix + ".occurrence", episode.occurrence());
    builder.text(prefix + ".context", episode.context());
    builder.number(prefix + ".chronology", episode.chronology());
    builder.number(prefix + ".sources.size", episode.sourceEntries().size());
    for (std::size_t index = 0U; index < episode.sourceEntries().size();
         ++index) {
        add_long_term_entry(builder, episode.sourceEntries()[index],
                            indexed(prefix + ".sources", index));
    }
    builder.number(prefix + ".links.size",
                   episode.linkedEpisodeIdentifiers().size());
    for (std::size_t index = 0U;
         index < episode.linkedEpisodeIdentifiers().size(); ++index) {
        builder.text(indexed(prefix + ".links", index),
                     episode.linkedEpisodeIdentifiers()[index]);
    }
}

void add_procedure(SnapshotBuilder& builder,
                   const Procedure& procedure,
                   const std::string& prefix) {
    builder.text(prefix + ".identifier", procedure.identifier());
    builder.text(prefix + ".activity", procedure.activity());
    builder.number(prefix + ".steps.size", procedure.steps().size());
    for (std::size_t index = 0U; index < procedure.steps().size(); ++index) {
        builder.text(indexed(prefix + ".steps", index),
                     procedure.steps()[index]);
    }
    builder.number(prefix + ".sources.size", procedure.sourceEntries().size());
    for (std::size_t index = 0U; index < procedure.sourceEntries().size();
         ++index) {
        add_long_term_entry(builder, procedure.sourceEntries()[index],
                            indexed(prefix + ".sources", index));
    }
    builder.number(prefix + ".links.size",
                   procedure.linkedProcedureIdentifiers().size());
    for (std::size_t index = 0U;
         index < procedure.linkedProcedureIdentifiers().size(); ++index) {
        builder.text(indexed(prefix + ".links", index),
                     procedure.linkedProcedureIdentifiers()[index]);
    }
}

[[nodiscard]] std::string long_term_disposition(
    const LongTermMemory& memory, const std::string& identifier) {
    if (const auto* entry = memory.find(identifier); entry != nullptr) {
        return entry->archived() ? "ARCHIVED" : "LONG_TERM";
    }
    LongTermMemory probe{memory};
    const auto result = LongTermMemoryEngine{}.retain(
        probe,
        LongTermMemoryEntry{identifier,
                            "private-history-probe-value-with-long-content"});
    if (result.code() == "FORGOTTEN_IDENTIFIER") {
        return "FORGOTTEN";
    }
    return result.succeeded() ? "ABSENT" : "UNEXPECTED:" + result.code();
}

[[nodiscard]] LongTermMemory probe_evidence(const std::string& identifier) {
    LongTermMemory evidence{workspace};
    require_ok(LongTermMemoryEngine{}.retain(
        evidence,
        LongTermMemoryEntry{identifier,
                            "private-history-probe-evidence-long-value"}));
    return evidence;
}

[[nodiscard]] std::string semantic_disposition(
    const SemanticMemory& memory, const std::string& identifier) {
    if (memory.find(identifier) != nullptr) {
        return "ACCESSIBLE";
    }
    const std::string source =
        "private-semantic-history-probe-source-with-a-long-identifier";
    auto evidence = probe_evidence(source);
    SemanticMemory probe{memory};
    const auto result = SemanticMemoryEngine{}.classify(
        probe,
        evidence,
        SemanticConcept{
            identifier,
            "private-semantic-history-probe-meaning-with-long-content",
            {*evidence.find(source)}});
    if (result.code() == "FORGOTTEN_IDENTIFIER") {
        return "FORGOTTEN";
    }
    return result.succeeded() ? "ABSENT" : "UNEXPECTED:" + result.code();
}

[[nodiscard]] std::string episodic_disposition(
    const EpisodicMemory& memory, const std::string& identifier) {
    if (memory.find(identifier) != nullptr) {
        return "ACCESSIBLE";
    }
    const std::string source =
        "private-episodic-history-probe-source-with-a-long-identifier";
    auto evidence = probe_evidence(source);
    EpisodicMemory probe{memory};
    const auto result = EpisodicMemoryEngine{}.derive(
        probe,
        evidence,
        Episode{identifier,
                "private-episodic-history-probe-occurrence-long-content",
                "private-episodic-history-probe-context-long-content",
                0,
                {*evidence.find(source)}});
    if (result.code() == "FORGOTTEN_IDENTIFIER") {
        return "FORGOTTEN";
    }
    return result.succeeded() ? "ABSENT" : "UNEXPECTED:" + result.code();
}

[[nodiscard]] std::string procedural_disposition(
    const ProceduralMemory& memory, const std::string& identifier) {
    if (memory.find(identifier) != nullptr) {
        return "ACCESSIBLE";
    }
    const std::string source =
        "private-procedural-history-probe-source-with-a-long-identifier";
    auto evidence = probe_evidence(source);
    ProceduralMemory probe{memory};
    const auto result = ProceduralMemoryEngine{}.derive(
        probe,
        evidence,
        Procedure{identifier,
                  "private-procedural-history-probe-activity-long-content",
                  {"private-procedural-history-probe-step-long-content"},
                  {*evidence.find(source)}});
    if (result.code() == "FORGOTTEN_IDENTIFIER") {
        return "FORGOTTEN";
    }
    return result.succeeded() ? "ABSENT" : "UNEXPECTED:" + result.code();
}

void add_memory(SnapshotBuilder& builder,
                const Memory& memory,
                const std::string& prefix) {
    builder.text(prefix + ".workspace", memory.workspaceIdentifier());
    builder.number(prefix + ".entries.size", memory.entries().size());
    for (std::size_t index = 0U; index < memory.entries().size(); ++index) {
        add_memory_entry(builder, memory.entries()[index],
                         indexed(prefix + ".entries", index));
    }
}

void add_working_memory(SnapshotBuilder& builder,
                        const WorkingMemory& memory,
                        const std::string& prefix) {
    builder.text(prefix + ".workspace", memory.workspaceIdentifier());
    builder.boolean(prefix + ".active", memory.active());
    builder.boolean(prefix + ".task.present",
                    memory.activeTaskIdentifier().has_value());
    if (memory.activeTaskIdentifier().has_value()) {
        builder.text(prefix + ".task.value", *memory.activeTaskIdentifier());
    }
    builder.number(prefix + ".entries.size", memory.entries().size());
    for (std::size_t index = 0U; index < memory.entries().size(); ++index) {
        add_working_entry(builder, memory.entries()[index],
                          indexed(prefix + ".entries", index));
    }
}

void add_long_term_memory(SnapshotBuilder& builder,
                          const LongTermMemory& memory,
                          const std::string& prefix) {
    builder.text(prefix + ".workspace", memory.workspaceIdentifier());
    builder.number(prefix + ".entries.size", memory.entries().size());
    for (std::size_t index = 0U; index < memory.entries().size(); ++index) {
        add_long_term_entry(builder, memory.entries()[index],
                            indexed(prefix + ".entries", index));
    }
    builder.text(prefix + ".forgotten-probe",
                 long_term_disposition(memory, forgotten_long_term_identifier));
}

void add_semantic_memory(SnapshotBuilder& builder,
                         const SemanticMemory& memory,
                         const std::string& prefix) {
    builder.text(prefix + ".workspace", memory.workspaceIdentifier());
    builder.number(prefix + ".concepts.size", memory.concepts().size());
    for (std::size_t index = 0U; index < memory.concepts().size(); ++index) {
        add_semantic_concept(builder, memory.concepts()[index],
                             indexed(prefix + ".concepts", index));
    }
    builder.text(prefix + ".forgotten-probe",
                 semantic_disposition(memory, forgotten_semantic_identifier));
}

void add_episodic_memory(SnapshotBuilder& builder,
                         const EpisodicMemory& memory,
                         const std::string& prefix) {
    builder.text(prefix + ".workspace", memory.workspaceIdentifier());
    builder.number(prefix + ".episodes.size", memory.episodes().size());
    for (std::size_t index = 0U; index < memory.episodes().size(); ++index) {
        add_episode(builder, memory.episodes()[index],
                    indexed(prefix + ".episodes", index));
    }
    builder.text(prefix + ".forgotten-probe",
                 episodic_disposition(memory, forgotten_episodic_identifier));
}

void add_procedural_memory(SnapshotBuilder& builder,
                           const ProceduralMemory& memory,
                           const std::string& prefix) {
    builder.text(prefix + ".workspace", memory.workspaceIdentifier());
    builder.number(prefix + ".procedures.size", memory.procedures().size());
    for (std::size_t index = 0U; index < memory.procedures().size(); ++index) {
        add_procedure(builder, memory.procedures()[index],
                      indexed(prefix + ".procedures", index));
    }
    builder.text(prefix + ".forgotten-probe",
                 procedural_disposition(memory,
                                        forgotten_procedural_identifier));
}

void add_candidate(SnapshotBuilder& builder,
                   const KnowledgeCandidate& candidate,
                   const std::string& prefix) {
    builder.number(prefix + ".kind", static_cast<int>(candidate.kind()));
    builder.text(prefix + ".workspace", candidate.workspaceIdentifier());
    builder.text(prefix + ".source", candidate.sourceIdentifier());
    builder.number(prefix + ".rank", candidate.rankScore());
    builder.boolean(prefix + ".semantic.present",
                    candidate.semanticConcept() != nullptr);
    if (candidate.semanticConcept() != nullptr) {
        add_semantic_concept(builder, *candidate.semanticConcept(),
                             prefix + ".semantic");
    }
    builder.boolean(prefix + ".episodic.present",
                    candidate.episode() != nullptr);
    if (candidate.episode() != nullptr) {
        add_episode(builder, *candidate.episode(), prefix + ".episodic");
    }
    builder.boolean(prefix + ".procedural.present",
                    candidate.procedure() != nullptr);
    if (candidate.procedure() != nullptr) {
        add_procedure(builder, *candidate.procedure(), prefix + ".procedural");
    }
}

void add_chain(SnapshotBuilder& builder,
               const std::vector<std::string>& chain,
               const std::string& prefix) {
    builder.number(prefix + ".size", chain.size());
    for (std::size_t index = 0U; index < chain.size(); ++index) {
        builder.text(indexed(prefix, index), chain[index]);
    }
}

void add_retrieval_session(SnapshotBuilder& builder,
                           const RetrievalSession& session,
                           const std::string& prefix) {
    builder.text(prefix + ".workspace", session.workspaceIdentifier());
    builder.boolean(prefix + ".started", session.started());
    builder.boolean(prefix + ".forgotten", session.forgotten());
    builder.number(prefix + ".candidates.size", session.candidates().size());
    for (std::size_t index = 0U; index < session.candidates().size(); ++index) {
        const auto candidate_prefix = indexed(prefix + ".candidates", index);
        const auto& candidate = session.candidates()[index];
        add_candidate(builder, candidate, candidate_prefix);
        if (session.started() && !session.forgotten()) {
            const auto explained = MemoryRetrievalEngine{}.explain(
                session, candidate.kind(), candidate.sourceIdentifier());
            require_ok(explained);
            add_chain(builder, explained.explanationChain(),
                      candidate_prefix + ".chain");
        }
    }
}

void add_consolidation_candidate(SnapshotBuilder& builder,
                                 const ConsolidationCandidate& candidate,
                                 const std::string& prefix) {
    builder.text(prefix + ".workspace", candidate.workspaceIdentifier());
    builder.text(prefix + ".task", candidate.taskIdentifier());
    builder.number(prefix + ".source-position", candidate.sourcePosition());
    builder.boolean(prefix + ".working.present",
                    candidate.workingMemoryEntry() != nullptr);
    if (candidate.workingMemoryEntry() != nullptr) {
        add_working_entry(builder, *candidate.workingMemoryEntry(),
                          prefix + ".working");
    }
    builder.boolean(prefix + ".long-term.present",
                    candidate.longTermMemoryEntry() != nullptr);
    if (candidate.longTermMemoryEntry() != nullptr) {
        add_long_term_entry(builder, *candidate.longTermMemoryEntry(),
                            prefix + ".long-term");
    }
    builder.boolean(prefix + ".retained-position.present",
                    candidate.retainedPosition().has_value());
    if (candidate.retainedPosition().has_value()) {
        builder.number(prefix + ".retained-position.value",
                       *candidate.retainedPosition());
    }
}

void add_consolidation_session(SnapshotBuilder& builder,
                               const ConsolidationSession& session,
                               const std::string& prefix) {
    builder.text(prefix + ".workspace", session.workspaceIdentifier());
    builder.number(prefix + ".state", static_cast<int>(session.state()));
    builder.boolean(prefix + ".request.present", session.request() != nullptr);
    if (session.request() != nullptr) {
        builder.text(prefix + ".request.workspace",
                     session.request()->workspaceIdentifier());
        builder.text(prefix + ".request.task",
                     session.request()->taskIdentifier());
        builder.text(prefix + ".request.entry",
                     session.request()->entryIdentifier());
    }
    builder.boolean(prefix + ".candidate.present",
                    session.candidate() != nullptr);
    if (session.candidate() != nullptr) {
        add_consolidation_candidate(builder, *session.candidate(),
                                    prefix + ".candidate");
    }
    builder.boolean(prefix + ".working-memory.present",
                    session.workingMemory() != nullptr);
    if (session.workingMemory() != nullptr) {
        add_working_memory(builder, *session.workingMemory(),
                           prefix + ".working-memory");
    }
    builder.boolean(prefix + ".long-term-memory.present",
                    session.longTermMemory() != nullptr);
    if (session.longTermMemory() != nullptr) {
        add_long_term_memory(builder, *session.longTermMemory(),
                             prefix + ".long-term-memory");
    }
}

void add_reflection(SnapshotBuilder& builder,
                    const Reflection& reflection,
                    const std::string& prefix) {
    builder.text(prefix + ".workspace", reflection.workspaceIdentifier());
    builder.text(prefix + ".identifier", reflection.identifier());
    builder.text(prefix + ".knowledge", reflection.knowledge());
    builder.number(prefix + ".sources.size",
                   reflection.sourceCandidates().size());
    for (std::size_t index = 0U;
         index < reflection.sourceCandidates().size(); ++index) {
        add_candidate(builder, reflection.sourceCandidates()[index],
                      indexed(prefix + ".sources", index));
    }
    builder.number(prefix + ".chains.size",
                   reflection.sourceExplanationChains().size());
    for (std::size_t index = 0U;
         index < reflection.sourceExplanationChains().size(); ++index) {
        add_chain(builder, reflection.sourceExplanationChains()[index],
                  indexed(prefix + ".chains", index));
    }
}

void add_reflection_session(SnapshotBuilder& builder,
                            const ReflectionSession& session,
                            const std::string& prefix) {
    builder.text(prefix + ".workspace", session.workspaceIdentifier());
    builder.number(prefix + ".state", static_cast<int>(session.state()));
    builder.boolean(prefix + ".query.present", session.query() != nullptr);
    if (session.query() != nullptr) {
        builder.text(prefix + ".query.workspace",
                     session.query()->workspaceIdentifier());
        builder.text(prefix + ".query.identifier",
                     session.query()->identifier());
        builder.text(prefix + ".query.knowledge", session.query()->knowledge());
    }
    builder.number(prefix + ".sources.size", session.sourceCandidates().size());
    for (std::size_t index = 0U; index < session.sourceCandidates().size();
         ++index) {
        add_candidate(builder, session.sourceCandidates()[index],
                      indexed(prefix + ".sources", index));
    }
    builder.number(prefix + ".chains.size",
                   session.sourceExplanationChains().size());
    for (std::size_t index = 0U;
         index < session.sourceExplanationChains().size(); ++index) {
        add_chain(builder, session.sourceExplanationChains()[index],
                  indexed(prefix + ".chains", index));
    }
    builder.boolean(prefix + ".reflection.present",
                    session.reflection() != nullptr);
    if (session.reflection() != nullptr) {
        add_reflection(builder, *session.reflection(), prefix + ".reflection");
    }
}

void add_provider_session(SnapshotBuilder& builder,
                          const ProviderSession& session,
                          const std::string& prefix) {
    builder.text(prefix + ".workspace", session.workspaceIdentifier());
    builder.number(prefix + ".state", static_cast<int>(session.state()));
    builder.number(prefix + ".descriptors.size", session.descriptors().size());
    for (std::size_t index = 0U; index < session.descriptors().size(); ++index) {
        const auto descriptor_prefix =
            indexed(prefix + ".descriptors", index);
        builder.text(descriptor_prefix + ".workspace",
                     session.descriptors()[index].workspaceIdentifier());
        builder.text(descriptor_prefix + ".identifier",
                     session.descriptors()[index].identifier());
    }
}

void add_view(SnapshotBuilder& builder,
              const StudioView& view,
              const std::string& prefix) {
    builder.text(prefix + ".workspace", view.workspaceIdentifier());
    builder.boolean(prefix + ".memory.present", view.memory() != nullptr);
    if (view.memory() != nullptr) {
        add_memory(builder, *view.memory(), prefix + ".memory");
    }
    builder.boolean(prefix + ".working.present",
                    view.workingMemory() != nullptr);
    if (view.workingMemory() != nullptr) {
        add_working_memory(builder, *view.workingMemory(), prefix + ".working");
    }
    builder.boolean(prefix + ".long-term.present",
                    view.longTermMemory() != nullptr);
    if (view.longTermMemory() != nullptr) {
        add_long_term_memory(builder, *view.longTermMemory(),
                             prefix + ".long-term");
    }
    builder.boolean(prefix + ".semantic.present",
                    view.semanticMemory() != nullptr);
    if (view.semanticMemory() != nullptr) {
        add_semantic_memory(builder, *view.semanticMemory(),
                            prefix + ".semantic");
    }
    builder.boolean(prefix + ".episodic.present",
                    view.episodicMemory() != nullptr);
    if (view.episodicMemory() != nullptr) {
        add_episodic_memory(builder, *view.episodicMemory(),
                            prefix + ".episodic");
    }
    builder.boolean(prefix + ".procedural.present",
                    view.proceduralMemory() != nullptr);
    if (view.proceduralMemory() != nullptr) {
        add_procedural_memory(builder, *view.proceduralMemory(),
                              prefix + ".procedural");
    }

    builder.number(prefix + ".retrieval.size",
                   view.retrievalSessions().size());
    for (std::size_t index = 0U; index < view.retrievalSessions().size();
         ++index) {
        add_retrieval_session(builder, view.retrievalSessions()[index],
                              indexed(prefix + ".retrieval", index));
    }
    builder.number(prefix + ".consolidation.size",
                   view.consolidationSessions().size());
    for (std::size_t index = 0U;
         index < view.consolidationSessions().size(); ++index) {
        add_consolidation_session(
            builder, view.consolidationSessions()[index],
            indexed(prefix + ".consolidation", index));
    }
    builder.number(prefix + ".reflections.size", view.reflections().size());
    for (std::size_t index = 0U; index < view.reflections().size(); ++index) {
        add_reflection(builder, view.reflections()[index],
                       indexed(prefix + ".reflections", index));
    }
    builder.number(prefix + ".reflection-sessions.size",
                   view.reflectionSessions().size());
    for (std::size_t index = 0U; index < view.reflectionSessions().size();
         ++index) {
        add_reflection_session(
            builder, view.reflectionSessions()[index],
            indexed(prefix + ".reflection-sessions", index));
    }
    builder.number(prefix + ".providers.size", view.providerSessions().size());
    for (std::size_t index = 0U; index < view.providerSessions().size();
         ++index) {
        add_provider_session(builder, view.providerSessions()[index],
                             indexed(prefix + ".providers", index));
    }
}

[[nodiscard]] Snapshot snapshot_of(const StudioView& view) {
    SnapshotBuilder builder;
    add_view(builder, view, "view");
    return std::move(builder).finish();
}

void add_studio_session(SnapshotBuilder& builder,
                        const StudioSession& session,
                        const std::string& prefix) {
    builder.text(prefix + ".workspace", session.workspaceIdentifier());
    builder.number(prefix + ".state", static_cast<int>(session.state()));
    builder.boolean(prefix + ".view.present", session.view() != nullptr);
    if (session.view() != nullptr) {
        add_view(builder, *session.view(), prefix + ".view");
    }
}

void add_studio_result(SnapshotBuilder& builder,
                       const StudioResult& result,
                       const std::string& prefix) {
    builder.text(prefix + ".workspace", result.workspaceIdentifier());
    builder.boolean(prefix + ".succeeded", result.succeeded());
    builder.text(prefix + ".code", result.code());
    builder.text(prefix + ".message", result.message());
    builder.boolean(prefix + ".view.present", result.view() != nullptr);
    if (result.view() != nullptr) {
        add_view(builder, *result.view(), prefix + ".view");
    }
    builder.number(prefix + ".observations.size",
                   result.observations().size());
    for (std::size_t index = 0U; index < result.observations().size(); ++index) {
        builder.text(indexed(prefix + ".observations", index),
                     result.observations()[index]);
    }
    builder.number(prefix + ".chains.size",
                   result.explanationChains().size());
    for (std::size_t index = 0U;
         index < result.explanationChains().size(); ++index) {
        add_chain(builder, result.explanationChains()[index],
                  indexed(prefix + ".chains", index));
    }
}

[[nodiscard]] Snapshot snapshot_of(const StudioResult& result) {
    SnapshotBuilder builder;
    add_studio_result(builder, result, "result");
    return std::move(builder).finish();
}

struct Inputs final {
    Memory memory{workspace};
    WorkingMemory working{workspace};
    LongTermMemory long_term{workspace};
    SemanticMemory semantic{workspace};
    EpisodicMemory episodic{workspace};
    ProceduralMemory procedural{workspace};
    std::vector<RetrievalSession> retrieval;
    std::vector<ConsolidationSession> consolidation;
    std::vector<Reflection> reflections;
    std::vector<ReflectionSession> reflection_sessions;
    std::vector<ProviderSession> providers;

    Inputs() {
        require_ok(MemoryEngine{}.store(
            memory,
            MemoryEntry{
                "memory-studio-foundation-entry-with-a-long-identifier",
                "memory-studio-foundation-value-with-enough-content-to-allocate"}));

        require_ok(WorkingMemoryEngine{}.activate(working, task_identifier));
        require_ok(WorkingMemoryEngine{}.store(
            working,
            WorkingMemoryEntry{
                working_identifier,
                "memory-studio-working-value-with-enough-content-to-allocate",
                std::optional<std::uint64_t>{500U}}));
        require_ok(WorkingMemoryEngine{}.store(
            working,
            WorkingMemoryEntry{
                "memory-studio-working-survivor-with-a-long-identifier",
                "memory-studio-working-survivor-value-with-long-content"}));

        const std::string semantic_source =
            "memory-studio-semantic-evidence-with-a-long-identifier";
        const std::string episodic_source =
            "memory-studio-episodic-evidence-with-a-long-identifier";
        const std::string procedural_source =
            "memory-studio-procedural-evidence-with-a-long-identifier";
        require_ok(LongTermMemoryEngine{}.retain(
            long_term,
            LongTermMemoryEntry{
                semantic_source,
                "memory-studio-semantic-evidence-value-with-long-content"}));
        require_ok(LongTermMemoryEngine{}.retain(
            long_term,
            LongTermMemoryEntry{
                episodic_source,
                "memory-studio-episodic-evidence-value-with-long-content"}));
        require_ok(LongTermMemoryEngine{}.retain(
            long_term,
            LongTermMemoryEntry{
                procedural_source,
                "memory-studio-procedural-evidence-value-with-long-content"}));

        const auto* const semantic_entry = long_term.find(semantic_source);
        const auto* const episodic_entry = long_term.find(episodic_source);
        const auto* const procedural_entry = long_term.find(procedural_source);
        if (semantic_entry == nullptr || episodic_entry == nullptr ||
            procedural_entry == nullptr) {
            throw std::logic_error{"allocation fixture evidence is absent"};
        }

        require_ok(SemanticMemoryEngine{}.classify(
            semantic,
            long_term,
            SemanticConcept{
                semantic_identifier,
                "memory-studio-semantic-meaning-with-enough-content-to-allocate",
                {*semantic_entry}}));
        require_ok(SemanticMemoryEngine{}.categorize(
            semantic,
            semantic_identifier,
            "memory-studio-semantic-category-with-a-long-identifier"));

        require_ok(EpisodicMemoryEngine{}.derive(
            episodic,
            long_term,
            Episode{
                episodic_identifier,
                "memory-studio-episodic-occurrence-with-long-content",
                "memory-studio-episodic-context-with-long-content",
                123456789,
                {*episodic_entry}}));

        require_ok(ProceduralMemoryEngine{}.derive(
            procedural,
            long_term,
            Procedure{
                procedural_identifier,
                "memory-studio-procedural-activity-with-long-content",
                {"memory-studio-procedure-step-one-with-long-content",
                 "memory-studio-procedure-step-two-with-long-content",
                 "memory-studio-procedure-step-two-with-long-content"},
                {*procedural_entry}}));

        // Preserve released hidden forgotten-identifier history in every
        // aggregate that carries it. Snapshot probes verify the history also
        // survives every Studio copy and every injected exception.
        require_ok(LongTermMemoryEngine{}.retain(
            long_term,
            LongTermMemoryEntry{
                forgotten_long_term_identifier,
                "memory-studio-forgotten-long-term-value-with-long-content"}));
        require_ok(LongTermMemoryEngine{}.forget(
            long_term, forgotten_long_term_identifier));

        const auto* const retained_semantic_entry =
            long_term.find(semantic_source);
        const auto* const retained_episodic_entry =
            long_term.find(episodic_source);
        const auto* const retained_procedural_entry =
            long_term.find(procedural_source);
        if (retained_semantic_entry == nullptr ||
            retained_episodic_entry == nullptr ||
            retained_procedural_entry == nullptr) {
            throw std::logic_error{
                "allocation fixture retained evidence is absent"};
        }

        require_ok(SemanticMemoryEngine{}.classify(
            semantic,
            long_term,
            SemanticConcept{
                forgotten_semantic_identifier,
                "memory-studio-forgotten-semantic-meaning-with-long-content",
                {*retained_semantic_entry}}));
        require_ok(SemanticMemoryEngine{}.forget(
            semantic, forgotten_semantic_identifier));

        require_ok(EpisodicMemoryEngine{}.derive(
            episodic,
            long_term,
            Episode{
                forgotten_episodic_identifier,
                "memory-studio-forgotten-episodic-occurrence-long-content",
                "memory-studio-forgotten-episodic-context-long-content",
                42,
                {*retained_episodic_entry}}));
        require_ok(EpisodicMemoryEngine{}.forget(
            episodic, forgotten_episodic_identifier));

        require_ok(ProceduralMemoryEngine{}.derive(
            procedural,
            long_term,
            Procedure{
                forgotten_procedural_identifier,
                "memory-studio-forgotten-procedural-activity-long-content",
                {"memory-studio-forgotten-procedural-step-long-content"},
                {*retained_procedural_entry}}));
        require_ok(ProceduralMemoryEngine{}.forget(
            procedural, forgotten_procedural_identifier));
        require_ok(LongTermMemoryEngine{}.archive(long_term, semantic_source));

        RetrievalSession retrieval_session{workspace};
        require_ok(MemoryRetrievalEngine{}.search(
            retrieval_session,
            semantic,
            episodic,
            procedural,
            KnowledgeQuery{""}));
        require_ok(MemoryRetrievalEngine{}.rank(retrieval_session));
        retrieval.push_back(retrieval_session);

        ConsolidationSession consolidation_session{workspace};
        const ConsolidationRequest request{
            workspace, task_identifier, working_identifier};
        require_ok(MemoryConsolidationEngine{}.analyze(
            consolidation_session, request, working, long_term));
        require_ok(MemoryConsolidationEngine{}.promote(
            consolidation_session));
        consolidation.push_back(consolidation_session);

        ReflectionSession reflection_session{workspace};
        const ReflectionQuery reflection_query{
            workspace,
            "memory-studio-reflection-with-a-long-identifier",
            "memory-studio-reflection-knowledge-with-enough-content-to-allocate"};
        require_ok(MemoryReflectionEngine{}.reflect(
            reflection_session, reflection_query, retrieval_session));
        const auto reflected = MemoryReflectionEngine{}.derive(
            reflection_session, semantic, episodic, procedural);
        require_ok(reflected);
        if (reflected.reflection() == nullptr) {
            throw std::logic_error{"allocation fixture Reflection is absent"};
        }
        reflections.push_back(*reflected.reflection());
        reflection_sessions.push_back(reflection_session);

        ProviderSession provider_session{workspace};
        require_ok(MemoryProviderEngine{}.registerProvider(
            provider_session,
            ProviderDescriptor{
                workspace,
                "memory-studio-provider-with-a-long-identifier"}));
        providers.push_back(provider_session);
    }

    [[nodiscard]] StudioView make_view() const {
        return StudioView{workspace,
                          memory,
                          working,
                          long_term,
                          semantic,
                          episodic,
                          procedural,
                          retrieval,
                          consolidation,
                          reflections,
                          reflection_sessions,
                          providers};
    }
};

void add_inputs(SnapshotBuilder& builder,
                const Inputs& inputs,
                const std::string& prefix) {
    add_memory(builder, inputs.memory, prefix + ".memory");
    add_working_memory(builder, inputs.working, prefix + ".working");
    add_long_term_memory(builder, inputs.long_term, prefix + ".long-term");
    add_semantic_memory(builder, inputs.semantic, prefix + ".semantic");
    add_episodic_memory(builder, inputs.episodic, prefix + ".episodic");
    add_procedural_memory(builder, inputs.procedural, prefix + ".procedural");
    builder.number(prefix + ".retrieval.size", inputs.retrieval.size());
    for (std::size_t index = 0U; index < inputs.retrieval.size(); ++index) {
        add_retrieval_session(builder, inputs.retrieval[index],
                              indexed(prefix + ".retrieval", index));
    }
    builder.number(prefix + ".consolidation.size",
                   inputs.consolidation.size());
    for (std::size_t index = 0U; index < inputs.consolidation.size(); ++index) {
        add_consolidation_session(builder, inputs.consolidation[index],
                                  indexed(prefix + ".consolidation", index));
    }
    builder.number(prefix + ".reflections.size", inputs.reflections.size());
    for (std::size_t index = 0U; index < inputs.reflections.size(); ++index) {
        add_reflection(builder, inputs.reflections[index],
                       indexed(prefix + ".reflections", index));
    }
    builder.number(prefix + ".reflection-sessions.size",
                   inputs.reflection_sessions.size());
    for (std::size_t index = 0U; index < inputs.reflection_sessions.size();
         ++index) {
        add_reflection_session(
            builder, inputs.reflection_sessions[index],
            indexed(prefix + ".reflection-sessions", index));
    }
    builder.number(prefix + ".providers.size", inputs.providers.size());
    for (std::size_t index = 0U; index < inputs.providers.size(); ++index) {
        add_provider_session(builder, inputs.providers[index],
                             indexed(prefix + ".providers", index));
    }
}

[[nodiscard]] Snapshot snapshot_of(const Inputs& inputs) {
    SnapshotBuilder builder;
    add_inputs(builder, inputs, "inputs");
    return std::move(builder).finish();
}

struct FixtureSnapshot final {
    Snapshot inputs;
    Snapshot supplied_view;
    Snapshot session;
    std::optional<Snapshot> earlier_result;
    std::optional<Snapshot> transition_result;
    bool operator==(const FixtureSnapshot&) const = default;
};

struct OpenFixture final {
    Inputs inputs;
    StudioView supplied_view{inputs.make_view()};
    StudioSession session{workspace};
    MemoryStudioEngine engine;
};

[[nodiscard]] FixtureSnapshot snapshot_of(const OpenFixture& fixture) {
    SnapshotBuilder session_builder;
    add_studio_session(session_builder, fixture.session, "session");
    return {snapshot_of(fixture.inputs), snapshot_of(fixture.supplied_view),
            std::move(session_builder).finish(), std::nullopt, std::nullopt};
}

struct ObservedFixture final {
    Inputs inputs;
    StudioView supplied_view{inputs.make_view()};
    StudioSession session{workspace};
    MemoryStudioEngine engine;
    std::optional<StudioResult> earlier_result;

    ObservedFixture() {
        earlier_result.emplace(engine.observe(session, supplied_view));
        require_ok(*earlier_result);
        if (earlier_result->view() == nullptr) {
            throw std::logic_error{"allocation fixture observe view is absent"};
        }
    }
};

[[nodiscard]] FixtureSnapshot snapshot_of(const ObservedFixture& fixture) {
    SnapshotBuilder session_builder;
    add_studio_session(session_builder, fixture.session, "session");
    return {snapshot_of(fixture.inputs), snapshot_of(fixture.supplied_view),
            std::move(session_builder).finish(),
            snapshot_of(*fixture.earlier_result), std::nullopt};
}

struct ForgottenFixture final {
    Inputs inputs;
    StudioView supplied_view{inputs.make_view()};
    StudioSession session{workspace};
    MemoryStudioEngine engine;
    std::optional<StudioResult> earlier_result;
    std::optional<StudioResult> transition_result;

    ForgottenFixture() {
        earlier_result.emplace(engine.observe(session, supplied_view));
        require_ok(*earlier_result);
        transition_result.emplace(engine.forgetSession(session));
        require_ok(*transition_result);
    }
};

[[nodiscard]] FixtureSnapshot snapshot_of(const ForgottenFixture& fixture) {
    SnapshotBuilder session_builder;
    add_studio_session(session_builder, fixture.session, "session");
    return {snapshot_of(fixture.inputs), snapshot_of(fixture.supplied_view),
            std::move(session_builder).finish(),
            snapshot_of(*fixture.earlier_result),
            snapshot_of(*fixture.transition_result)};
}

constexpr std::size_t allocation_campaign_limit = 16384U;

template <typename Arrange, typename Operation, typename VerifySuccess>
void sweep_studio_result(Arrange arrange,
                         Operation operation,
                         VerifySuccess verify_success) {
    std::size_t observed_failures = 0U;
    bool completed = false;
    for (std::size_t index = 0U; index < allocation_campaign_limit; ++index) {
        auto fixture = arrange();
        const auto before = snapshot_of(fixture);
        memory_studio_allocation_failure_support::fail_after(index);
        try {
            auto result = operation(fixture);
            memory_studio_allocation_failure_support::disable();
            verify_success(fixture, result, before);
            completed = true;
            break;
        } catch (const std::bad_alloc&) {
            memory_studio_allocation_failure_support::disable();
            ++observed_failures;
            EXPECT_EQ(snapshot_of(fixture), before);
        } catch (...) {
            memory_studio_allocation_failure_support::disable();
            throw;
        }
    }
    memory_studio_allocation_failure_support::disable();
    EXPECT_TRUE(completed);
    EXPECT_GT(observed_failures, 0U);
}

void expect_success(const StudioResult& result) {
    EXPECT_TRUE(result.succeeded()) << result.code() << ": "
                                    << result.message();
    EXPECT_EQ(result.code(), "OK");
    EXPECT_TRUE(result.message().empty());
}

void expect_failure(const StudioResult& result,
                    const std::string_view code,
                    const std::string_view message) {
    EXPECT_FALSE(result.succeeded());
    EXPECT_EQ(result.code(), code);
    EXPECT_EQ(result.message(), message);
    EXPECT_EQ(result.view(), nullptr);
    EXPECT_TRUE(result.observations().empty());
    EXPECT_TRUE(result.explanationChains().empty());
}

TEST(MemoryStudioAllocationFailureTest,
     CompleteViewConstructionSweepsEveryAllocation) {
    std::size_t observed_failures = 0U;
    bool completed = false;
    for (std::size_t index = 0U; index < allocation_campaign_limit; ++index) {
        Inputs inputs;
        const auto before = snapshot_of(inputs);
        memory_studio_allocation_failure_support::fail_after(index);
        try {
            auto view = inputs.make_view();
            memory_studio_allocation_failure_support::disable();
            EXPECT_EQ(snapshot_of(inputs), before);
            EXPECT_NE(view.memory(), nullptr);
            EXPECT_NE(view.workingMemory(), nullptr);
            EXPECT_NE(view.longTermMemory(), nullptr);
            EXPECT_NE(view.semanticMemory(), nullptr);
            EXPECT_NE(view.episodicMemory(), nullptr);
            EXPECT_NE(view.proceduralMemory(), nullptr);
            EXPECT_EQ(view.retrievalSessions().size(), 1U);
            EXPECT_EQ(view.consolidationSessions().size(), 1U);
            EXPECT_EQ(view.reflections().size(), 1U);
            EXPECT_EQ(view.reflectionSessions().size(), 1U);
            EXPECT_EQ(view.providerSessions().size(), 1U);
            completed = true;
            break;
        } catch (const std::bad_alloc&) {
            memory_studio_allocation_failure_support::disable();
            ++observed_failures;
            EXPECT_EQ(snapshot_of(inputs), before);
        } catch (...) {
            memory_studio_allocation_failure_support::disable();
            throw;
        }
    }
    EXPECT_TRUE(completed);
    EXPECT_GT(observed_failures, 0U);
}

TEST(MemoryStudioAllocationFailureTest,
     ViewCopyConstructionAndAssignmentAreTransactional) {
    std::size_t construction_failures = 0U;
    bool construction_completed = false;
    for (std::size_t index = 0U; index < allocation_campaign_limit; ++index) {
        Inputs inputs;
        const auto original = inputs.make_view();
        const auto before = snapshot_of(original);
        memory_studio_allocation_failure_support::fail_after(index);
        try {
            const StudioView copy{original};
            memory_studio_allocation_failure_support::disable();
            EXPECT_EQ(snapshot_of(original), before);
            EXPECT_EQ(snapshot_of(copy), before);
            construction_completed = true;
            break;
        } catch (const std::bad_alloc&) {
            memory_studio_allocation_failure_support::disable();
            ++construction_failures;
            EXPECT_EQ(snapshot_of(original), before);
        } catch (...) {
            memory_studio_allocation_failure_support::disable();
            throw;
        }
    }
    EXPECT_TRUE(construction_completed);
    EXPECT_GT(construction_failures, 0U);

    std::size_t assignment_failures = 0U;
    bool assignment_completed = false;
    for (std::size_t index = 0U; index < allocation_campaign_limit; ++index) {
        Inputs inputs;
        const auto source = inputs.make_view();
        StudioView target{workspace,
                          inputs.memory,
                          inputs.working,
                          inputs.long_term,
                          inputs.semantic,
                          inputs.episodic,
                          inputs.procedural};
        const auto source_before = snapshot_of(source);
        const auto target_before = snapshot_of(target);
        memory_studio_allocation_failure_support::fail_after(index);
        try {
            target = source;
            memory_studio_allocation_failure_support::disable();
            EXPECT_EQ(snapshot_of(source), source_before);
            EXPECT_EQ(snapshot_of(target), source_before);
            assignment_completed = true;
            break;
        } catch (const std::bad_alloc&) {
            memory_studio_allocation_failure_support::disable();
            ++assignment_failures;
            EXPECT_EQ(snapshot_of(source), source_before);
            EXPECT_EQ(snapshot_of(target), target_before);
        } catch (...) {
            memory_studio_allocation_failure_support::disable();
            throw;
        }
    }
    EXPECT_TRUE(assignment_completed);
    EXPECT_GT(assignment_failures, 0U);
}

TEST(MemoryStudioAllocationFailureTest,
     QueryConstructionCopyAndAssignmentSweepEveryAllocation) {
    std::size_t construction_failures = 0U;
    bool construction_completed = false;
    for (std::size_t index = 0U; index < allocation_campaign_limit; ++index) {
        memory_studio_allocation_failure_support::fail_after(index);
        try {
            const StudioQuery query{workspace,
                                    StudioQuery::Scope::Retrieval,
                                    semantic_identifier};
            memory_studio_allocation_failure_support::disable();
            EXPECT_EQ(query.workspaceIdentifier(), workspace);
            EXPECT_EQ(query.scope(), StudioQuery::Scope::Retrieval);
            EXPECT_EQ(query.identifier(), semantic_identifier);
            construction_completed = true;
            break;
        } catch (const std::bad_alloc&) {
            memory_studio_allocation_failure_support::disable();
            ++construction_failures;
        } catch (...) {
            memory_studio_allocation_failure_support::disable();
            throw;
        }
    }
    EXPECT_TRUE(construction_completed);
    EXPECT_GT(construction_failures, 0U);

    std::size_t copy_failures = 0U;
    bool copy_completed = false;
    for (std::size_t index = 0U; index < allocation_campaign_limit; ++index) {
        const StudioQuery source{workspace,
                                 StudioQuery::Scope::Retrieval,
                                 semantic_identifier};
        StudioQuery target{workspace};
        memory_studio_allocation_failure_support::fail_after(index);
        try {
            const StudioQuery copy{source};
            target = source;
            memory_studio_allocation_failure_support::disable();
            EXPECT_EQ(copy.workspaceIdentifier(), workspace);
            EXPECT_EQ(copy.scope(), StudioQuery::Scope::Retrieval);
            EXPECT_EQ(copy.identifier(), semantic_identifier);
            EXPECT_EQ(target.workspaceIdentifier(), workspace);
            EXPECT_EQ(target.scope(), StudioQuery::Scope::Retrieval);
            EXPECT_EQ(target.identifier(), semantic_identifier);
            copy_completed = true;
            break;
        } catch (const std::bad_alloc&) {
            memory_studio_allocation_failure_support::disable();
            ++copy_failures;
            EXPECT_EQ(source.workspaceIdentifier(), workspace);
            EXPECT_EQ(source.scope(), StudioQuery::Scope::Retrieval);
            EXPECT_EQ(source.identifier(), semantic_identifier);
            EXPECT_EQ(target.workspaceIdentifier(), workspace);
            EXPECT_EQ(target.scope(), StudioQuery::Scope::Complete);
            EXPECT_TRUE(target.identifier().empty());
        } catch (...) {
            memory_studio_allocation_failure_support::disable();
            throw;
        }
    }
    EXPECT_TRUE(copy_completed);
    EXPECT_GT(copy_failures, 0U);
}

TEST(MemoryStudioAllocationFailureTest,
     ObservedSessionCopyConstructionSweepsEveryAllocation) {
    std::size_t session_construction_failures = 0U;
    bool session_construction_completed = false;
    for (std::size_t index = 0U; index < allocation_campaign_limit; ++index) {
        memory_studio_allocation_failure_support::fail_after(index);
        try {
            const StudioSession session{workspace};
            memory_studio_allocation_failure_support::disable();
            EXPECT_EQ(session.workspaceIdentifier(), workspace);
            EXPECT_EQ(session.state(), StudioSession::State::Open);
            EXPECT_EQ(session.view(), nullptr);
            session_construction_completed = true;
            break;
        } catch (const std::bad_alloc&) {
            memory_studio_allocation_failure_support::disable();
            ++session_construction_failures;
        } catch (...) {
            memory_studio_allocation_failure_support::disable();
            throw;
        }
    }
    EXPECT_TRUE(session_construction_completed);
    EXPECT_GT(session_construction_failures, 0U);

    std::size_t observed_failures = 0U;
    bool completed = false;
    for (std::size_t index = 0U; index < allocation_campaign_limit; ++index) {
        ObservedFixture fixture;
        const auto before = snapshot_of(fixture);
        memory_studio_allocation_failure_support::fail_after(index);
        try {
            const StudioSession copy{fixture.session};
            memory_studio_allocation_failure_support::disable();
            SnapshotBuilder builder;
            add_studio_session(builder, copy, "session");
            EXPECT_EQ(std::move(builder).finish(), before.session);
            EXPECT_EQ(snapshot_of(fixture), before);
            completed = true;
            break;
        } catch (const std::bad_alloc&) {
            memory_studio_allocation_failure_support::disable();
            ++observed_failures;
            EXPECT_EQ(snapshot_of(fixture), before);
        } catch (...) {
            memory_studio_allocation_failure_support::disable();
            throw;
        }
    }
    EXPECT_TRUE(completed);
    EXPECT_GT(observed_failures, 0U);
}

TEST(MemoryStudioAllocationFailureTest,
     ObserveAndReobserveCommitOnlyAfterCompleteStaging) {
    sweep_studio_result(
        [] { return OpenFixture{}; },
        [](OpenFixture& fixture) {
            return fixture.engine.observe(fixture.session,
                                          fixture.supplied_view);
        },
        [](const OpenFixture& fixture,
           const StudioResult& result,
           const FixtureSnapshot& before) {
            expect_success(result);
            EXPECT_NE(result.view(), nullptr);
            EXPECT_TRUE(result.observations().empty());
            EXPECT_TRUE(result.explanationChains().empty());
            EXPECT_EQ(fixture.session.state(), StudioSession::State::Observed);
            EXPECT_NE(fixture.session.view(), nullptr);
            EXPECT_NE(fixture.session.view(), result.view());
            EXPECT_EQ(snapshot_of(fixture.inputs), before.inputs);
            EXPECT_EQ(snapshot_of(fixture.supplied_view), before.supplied_view);
        });

    sweep_studio_result(
        [] { return ObservedFixture{}; },
        [](ObservedFixture& fixture) {
            return fixture.engine.observe(fixture.session,
                                          fixture.supplied_view);
        },
        [](const ObservedFixture& fixture,
           const StudioResult& result,
           const FixtureSnapshot& before) {
            expect_success(result);
            EXPECT_NE(result.view(), nullptr);
            EXPECT_NE(fixture.session.view(), nullptr);
            EXPECT_NE(fixture.session.view(), result.view());
            EXPECT_EQ(snapshot_of(fixture.inputs), before.inputs);
            EXPECT_EQ(snapshot_of(fixture.supplied_view), before.supplied_view);
            EXPECT_EQ(snapshot_of(*fixture.earlier_result),
                      *before.earlier_result);
        });
}

TEST(MemoryStudioAllocationFailureTest,
     InspectTraceSummarizeAndExportPreserveCompleteObservedState) {
    sweep_studio_result(
        [] { return ObservedFixture{}; },
        [](ObservedFixture& fixture) {
            return fixture.engine.inspect(
                fixture.session, StudioQuery{workspace});
        },
        [](const ObservedFixture& fixture,
           const StudioResult& result,
           const FixtureSnapshot& before) {
            expect_success(result);
            EXPECT_NE(result.view(), nullptr);
            EXPECT_FALSE(result.observations().empty());
            EXPECT_TRUE(result.explanationChains().empty());
            EXPECT_EQ(snapshot_of(fixture), before);
        });

    sweep_studio_result(
        [] { return ObservedFixture{}; },
        [](ObservedFixture& fixture) {
            return fixture.engine.trace(
                fixture.session,
                StudioQuery{workspace, StudioQuery::Scope::Complete});
        },
        [](const ObservedFixture& fixture,
           const StudioResult& result,
           const FixtureSnapshot& before) {
            expect_success(result);
            EXPECT_EQ(result.view(), nullptr);
            EXPECT_TRUE(result.observations().empty());
            EXPECT_FALSE(result.explanationChains().empty());
            EXPECT_EQ(snapshot_of(fixture), before);
        });

    sweep_studio_result(
        [] { return ObservedFixture{}; },
        [](ObservedFixture& fixture) {
            return fixture.engine.summarize(
                fixture.session, StudioQuery{workspace});
        },
        [](const ObservedFixture& fixture,
           const StudioResult& result,
           const FixtureSnapshot& before) {
            expect_success(result);
            EXPECT_EQ(result.view(), nullptr);
            EXPECT_FALSE(result.observations().empty());
            EXPECT_TRUE(result.explanationChains().empty());
            EXPECT_EQ(snapshot_of(fixture), before);
        });

    sweep_studio_result(
        [] { return ObservedFixture{}; },
        [](ObservedFixture& fixture) {
            return fixture.engine.exportView(fixture.session);
        },
        [](const ObservedFixture& fixture,
           const StudioResult& result,
           const FixtureSnapshot& before) {
            expect_success(result);
            EXPECT_NE(result.view(), nullptr);
            EXPECT_TRUE(result.observations().empty());
            EXPECT_TRUE(result.explanationChains().empty());
            EXPECT_EQ(snapshot_of(fixture), before);
        });
}

TEST(MemoryStudioAllocationFailureTest,
     ForgetStagesSuccessBeforeItsNonthrowingTerminalCommit) {
    sweep_studio_result(
        [] { return ObservedFixture{}; },
        [](ObservedFixture& fixture) {
            return fixture.engine.forgetSession(fixture.session);
        },
        [](const ObservedFixture& fixture,
           const StudioResult& result,
           const FixtureSnapshot& before) {
            expect_success(result);
            EXPECT_EQ(result.view(), nullptr);
            EXPECT_TRUE(result.observations().empty());
            EXPECT_TRUE(result.explanationChains().empty());
            EXPECT_EQ(fixture.session.state(), StudioSession::State::Forgotten);
            EXPECT_EQ(fixture.session.view(), nullptr);
            EXPECT_EQ(snapshot_of(fixture.inputs), before.inputs);
            EXPECT_EQ(snapshot_of(fixture.supplied_view), before.supplied_view);
            EXPECT_EQ(snapshot_of(*fixture.earlier_result),
                      *before.earlier_result);
        });
}

TEST(MemoryStudioAllocationFailureTest,
     EverySemanticFailureFactoryPropagatesAllocationAndPreservesState) {
    sweep_studio_result(
        [] { return OpenFixture{}; },
        [](OpenFixture& fixture) {
            return fixture.engine.inspect(
                fixture.session, StudioQuery{workspace});
        },
        [](const OpenFixture& fixture,
           const StudioResult& result,
           const FixtureSnapshot& before) {
            expect_failure(result,
                           "SESSION_NOT_OBSERVED",
                           "studio session has no observed view");
            EXPECT_EQ(snapshot_of(fixture), before);
        });

    sweep_studio_result(
        [] { return ForgottenFixture{}; },
        [](ForgottenFixture& fixture) {
            return fixture.engine.exportView(fixture.session);
        },
        [](const ForgottenFixture& fixture,
           const StudioResult& result,
           const FixtureSnapshot& before) {
            expect_failure(result,
                           "SESSION_FORGOTTEN",
                           "studio session is forgotten");
            EXPECT_EQ(snapshot_of(fixture), before);
        });

    sweep_studio_result(
        [] { return ObservedFixture{}; },
        [](ObservedFixture& fixture) {
            return fixture.engine.inspect(
                fixture.session, StudioQuery{other_workspace});
        },
        [](const ObservedFixture& fixture,
           const StudioResult& result,
           const FixtureSnapshot& before) {
            expect_failure(result,
                           "WORKSPACE_MISMATCH",
                           "workspace identifiers do not match");
            EXPECT_EQ(snapshot_of(fixture), before);
        });

    sweep_studio_result(
        [] { return ObservedFixture{}; },
        [](ObservedFixture& fixture) {
            return fixture.engine.inspect(
                fixture.session,
                StudioQuery{workspace,
                            static_cast<StudioQuery::Scope>(999),
                            semantic_identifier});
        },
        [](const ObservedFixture& fixture,
           const StudioResult& result,
           const FixtureSnapshot& before) {
            expect_failure(result,
                           "INVALID_QUERY",
                           "studio query is invalid");
            EXPECT_EQ(snapshot_of(fixture), before);
        });

    sweep_studio_result(
        [] { return ObservedFixture{}; },
        [](ObservedFixture& fixture) {
            return fixture.engine.inspect(
                fixture.session,
                StudioQuery{
                    workspace,
                    StudioQuery::Scope::Memory,
                    "memory-studio-absent-identifier-with-long-content"});
        },
        [](const ObservedFixture& fixture,
           const StudioResult& result,
           const FixtureSnapshot& before) {
            expect_failure(result,
                           "NOT_FOUND",
                           "studio query matched no observation");
            EXPECT_EQ(snapshot_of(fixture), before);
        });
}

TEST(MemoryStudioAllocationFailureTest,
     InvalidMovedViewFailureConstructionPreservesAllInputs) {
    struct InvalidViewFixture final {
        Inputs inputs;
        StudioView invalid_view{inputs.make_view()};
        StudioView moved_value{std::move(invalid_view)};
        StudioSession session{workspace};
        MemoryStudioEngine engine;
    };

    const auto take_snapshot = [](const InvalidViewFixture& fixture) {
        SnapshotBuilder builder;
        add_inputs(builder, fixture.inputs, "inputs");
        add_view(builder, fixture.invalid_view, "invalid-view");
        add_view(builder, fixture.moved_value, "moved-value");
        add_studio_session(builder, fixture.session, "session");
        return std::move(builder).finish();
    };

    std::size_t observed_failures = 0U;
    bool completed = false;
    for (std::size_t index = 0U; index < allocation_campaign_limit; ++index) {
        InvalidViewFixture fixture;
        const auto before = take_snapshot(fixture);
        memory_studio_allocation_failure_support::fail_after(index);
        try {
            auto result =
                fixture.engine.observe(fixture.session, fixture.invalid_view);
            memory_studio_allocation_failure_support::disable();
            expect_failure(result,
                           "INVALID_VIEW",
                           "studio view is invalid");
            EXPECT_EQ(take_snapshot(fixture), before);
            completed = true;
            break;
        } catch (const std::bad_alloc&) {
            memory_studio_allocation_failure_support::disable();
            ++observed_failures;
            EXPECT_EQ(take_snapshot(fixture), before);
        } catch (...) {
            memory_studio_allocation_failure_support::disable();
            throw;
        }
    }
    EXPECT_TRUE(completed);
    EXPECT_GT(observed_failures, 0U);
}

TEST(MemoryStudioAllocationFailureTest,
     ReleasedExplainAndRetrievalTraceKeepTheStandardExceptionBoundary) {
    std::size_t explain_failures = 0U;
    bool explain_completed = false;
    for (std::size_t index = 0U; index < allocation_campaign_limit; ++index) {
        Inputs inputs;
        const auto before = snapshot_of(inputs);
        const auto& session = inputs.retrieval.front();
        const auto& candidate = session.candidates().front();
        memory_studio_allocation_failure_support::fail_after(index);
        try {
            const auto result = MemoryRetrievalEngine{}.explain(
                session, candidate.kind(), candidate.sourceIdentifier());
            memory_studio_allocation_failure_support::disable();
            require_ok(result);
            EXPECT_FALSE(result.explanationChain().empty());
            EXPECT_EQ(snapshot_of(inputs), before);
            explain_completed = true;
            break;
        } catch (const std::bad_alloc&) {
            memory_studio_allocation_failure_support::disable();
            ++explain_failures;
            EXPECT_EQ(snapshot_of(inputs), before);
        } catch (...) {
            memory_studio_allocation_failure_support::disable();
            throw;
        }
    }
    EXPECT_TRUE(explain_completed);
    EXPECT_GT(explain_failures, 0U);

    sweep_studio_result(
        [] { return ObservedFixture{}; },
        [](ObservedFixture& fixture) {
            return fixture.engine.trace(
                fixture.session,
                StudioQuery{workspace,
                            StudioQuery::Scope::Retrieval,
                            semantic_identifier});
        },
        [](const ObservedFixture& fixture,
           const StudioResult& result,
           const FixtureSnapshot& before) {
            expect_success(result);
            EXPECT_EQ(result.explanationChains().size(), 1U);
            EXPECT_EQ(snapshot_of(fixture), before);
        });
}

} // namespace
