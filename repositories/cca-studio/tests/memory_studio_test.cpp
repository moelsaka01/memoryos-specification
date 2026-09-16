#include <cca/memory/memory_studio.hpp>

#include <gtest/gtest.h>

#include <algorithm>
#include <concepts>
#include <cstddef>
#include <cstdint>
#include <future>
#include <locale>
#include <optional>
#include <stdexcept>
#include <string>
#include <string_view>
#include <type_traits>
#include <utility>
#include <vector>

/*
CCA-STUDIO-1.0 automated conformance map
----------------------------------------
CCA-STUDIO-001--006: MemoryStudioApiTest and AR-014 architecture audit
CCA-STUDIO-007--016: MemoryStudioApiTest, MemoryStudioValueTest,
                     MemoryStudioWorkspaceTest
CCA-STUDIO-017--021: MemoryStudioSelectionTest and MemoryStudioLifecycleTest
CCA-STUDIO-022--032: MemoryStudioLifecycleTest, MemoryStudioSelectionTest,
                     MemoryStudioTraceTest, MemoryStudioSummaryTest
CCA-STUDIO-033--035: MemoryStudioIsolationTest, MemoryStudioWorkspaceTest,
                     and AR-014 architecture audit
CCA-STUDIO-036--040: MemoryStudioResultTest and MemoryStudioPrecedenceTest
CCA-STUDIO-041--043: MemoryStudioValueTest and MemoryStudioResultTest
CCA-STUDIO-044--045: MemoryStudioFailureTest and the AF-014 executable
CCA-STUDIO-046--049: MemoryStudioDeterminismTest,
                     MemoryStudioConcurrencyTest, MemoryStudioIsolationTest
CCA-STUDIO-050--055: MemoryStudioBoundaryTest and AR-014 architecture audit
CCA-STUDIO-056: DOC-014 and EX-014
CCA-STUDIO-057: this runtime suite, API-014-CT, AF-014, and AR-014
CCA-STUDIO-058: TRACE-014
CCA-STUDIO-059: BUILD-014
*/

namespace {

using cca::memory::ConsolidationRequest;
using cca::memory::ConsolidationSession;
using cca::memory::Episode;
using cca::memory::EpisodicMemory;
using cca::memory::EpisodicMemoryEngine;
using cca::memory::KnowledgeCandidate;
using cca::memory::KnowledgeQuery;
using cca::memory::LongTermMemory;
using cca::memory::LongTermMemoryEngine;
using cca::memory::LongTermMemoryEntry;
using cca::memory::Memory;
using cca::memory::MemoryConsolidationEngine;
using cca::memory::MemoryEngine;
using cca::memory::MemoryEntry;
using cca::memory::MemoryProviderEngine;
using cca::memory::MemoryReflectionEngine;
using cca::memory::MemoryRetrievalEngine;
using cca::memory::MemoryStudioEngine;
using cca::memory::Procedure;
using cca::memory::ProceduralMemory;
using cca::memory::ProceduralMemoryEngine;
using cca::memory::ProviderDescriptor;
using cca::memory::ProviderRequest;
using cca::memory::ProviderSession;
using cca::memory::Reflection;
using cca::memory::ReflectionQuery;
using cca::memory::ReflectionSession;
using cca::memory::RetrievalSession;
using cca::memory::SemanticConcept;
using cca::memory::SemanticMemory;
using cca::memory::SemanticMemoryEngine;
using cca::memory::StudioQuery;
using cca::memory::StudioResult;
using cca::memory::StudioSession;
using cca::memory::StudioView;
using cca::memory::WorkingMemory;
using cca::memory::WorkingMemoryEngine;
using cca::memory::WorkingMemoryEntry;

using Scope = StudioQuery::Scope;
using StudioState = StudioSession::State;
using Tokens = std::vector<std::string>;

constexpr std::string_view workspace{"studio-workspace"};

template <typename Result>
void require_ok(const Result& result) {
    if (!result.succeeded()) {
        throw std::logic_error{result.code() + ": " + result.message()};
    }
}

[[nodiscard]] std::string decimal(const std::size_t value) {
    return std::to_string(value);
}

void append(Tokens& values, const std::string_view label,
            const std::string_view value) {
    values.emplace_back(std::string{label} + "=" + std::string{value});
}

void append(Tokens& values, const std::string_view label, const bool value) {
    append(values, label,
           value ? std::string_view{"true"} : std::string_view{"false"});
}

void append(Tokens& values, const std::string_view label,
            const std::size_t value) {
    append(values, label, decimal(value));
}

void append_entry(Tokens& values, const std::string_view prefix,
                  const LongTermMemoryEntry& entry) {
    append(values, std::string{prefix} + ".identifier", entry.identifier());
    append(values, std::string{prefix} + ".value", entry.value());
    append(values, std::string{prefix} + ".archived", entry.archived());
}

void append_concept(Tokens& values, const std::string_view prefix,
                    const SemanticConcept& semantic_value) {
    append(values, std::string{prefix} + ".identifier",
           semantic_value.identifier());
    append(values, std::string{prefix} + ".meaning", semantic_value.meaning());
    for (std::size_t index = 0; index < semantic_value.sourceEntries().size();
         ++index) {
        append_entry(values,
                     std::string{prefix} + ".sources[" + decimal(index) + "]",
                     semantic_value.sourceEntries()[index]);
    }
    for (std::size_t index = 0; index < semantic_value.categories().size();
         ++index) {
        append(values,
               std::string{prefix} + ".categories[" + decimal(index) + "]",
               semantic_value.categories()[index]);
    }
    for (std::size_t index = 0;
         index < semantic_value.linkedConceptIdentifiers().size(); ++index) {
        append(values, std::string{prefix} + ".links[" + decimal(index) + "]",
               semantic_value.linkedConceptIdentifiers()[index]);
    }
}

void append_episode(Tokens& values, const std::string_view prefix,
                    const Episode& episode) {
    append(values, std::string{prefix} + ".identifier", episode.identifier());
    append(values, std::string{prefix} + ".occurrence", episode.occurrence());
    append(values, std::string{prefix} + ".context", episode.context());
    append(values, std::string{prefix} + ".chronology",
           std::to_string(episode.chronology()));
    for (std::size_t index = 0; index < episode.sourceEntries().size();
         ++index) {
        append_entry(values,
                     std::string{prefix} + ".sources[" + decimal(index) + "]",
                     episode.sourceEntries()[index]);
    }
    for (std::size_t index = 0;
         index < episode.linkedEpisodeIdentifiers().size(); ++index) {
        append(values, std::string{prefix} + ".links[" + decimal(index) + "]",
               episode.linkedEpisodeIdentifiers()[index]);
    }
}

void append_procedure(Tokens& values, const std::string_view prefix,
                      const Procedure& procedure) {
    append(values, std::string{prefix} + ".identifier",
           procedure.identifier());
    append(values, std::string{prefix} + ".activity", procedure.activity());
    for (std::size_t index = 0; index < procedure.steps().size(); ++index) {
        append(values, std::string{prefix} + ".steps[" + decimal(index) + "]",
               procedure.steps()[index]);
    }
    for (std::size_t index = 0; index < procedure.sourceEntries().size();
         ++index) {
        append_entry(values,
                     std::string{prefix} + ".sources[" + decimal(index) + "]",
                     procedure.sourceEntries()[index]);
    }
    for (std::size_t index = 0;
         index < procedure.linkedProcedureIdentifiers().size(); ++index) {
        append(values, std::string{prefix} + ".links[" + decimal(index) + "]",
               procedure.linkedProcedureIdentifiers()[index]);
    }
}

void append_candidate(Tokens& values, const std::string_view prefix,
                      const KnowledgeCandidate& candidate) {
    append(values, std::string{prefix} + ".kind",
           std::to_string(static_cast<int>(candidate.kind())));
    append(values, std::string{prefix} + ".workspace",
           candidate.workspaceIdentifier());
    append(values, std::string{prefix} + ".source",
           candidate.sourceIdentifier());
    append(values, std::string{prefix} + ".score",
           std::to_string(candidate.rankScore()));
    if (candidate.semanticConcept() != nullptr) {
        append_concept(values, std::string{prefix} + ".semantic",
                       *candidate.semanticConcept());
    }
    if (candidate.episode() != nullptr) {
        append_episode(values, std::string{prefix} + ".episode",
                       *candidate.episode());
    }
    if (candidate.procedure() != nullptr) {
        append_procedure(values, std::string{prefix} + ".procedure",
                         *candidate.procedure());
    }
}

void append_memory(Tokens& values, const std::string_view prefix,
                   const Memory& memory) {
    append(values, std::string{prefix} + ".workspace",
           memory.workspaceIdentifier());
    for (std::size_t index = 0; index < memory.entries().size(); ++index) {
        const auto& entry = memory.entries()[index];
        append(values,
               std::string{prefix} + ".entries[" + decimal(index) + "].id",
               entry.identifier());
        append(values, std::string{prefix} + ".entries[" + decimal(index) +
                           "].value",
               entry.value());
    }
}

void append_working(Tokens& values, const std::string_view prefix,
                    const WorkingMemory& memory) {
    append(values, std::string{prefix} + ".workspace",
           memory.workspaceIdentifier());
    append(values, std::string{prefix} + ".active", memory.active());
    append(values, std::string{prefix} + ".task.present",
           memory.activeTaskIdentifier().has_value());
    if (memory.activeTaskIdentifier().has_value()) {
        append(values, std::string{prefix} + ".task",
               *memory.activeTaskIdentifier());
    }
    for (std::size_t index = 0; index < memory.entries().size(); ++index) {
        const auto& entry = memory.entries()[index];
        const auto item = std::string{prefix} + ".entries[" + decimal(index) +
                          "]";
        append(values, item + ".id", entry.identifier());
        append(values, item + ".value", entry.value());
        append(values, item + ".expiration.present",
               entry.expirationPoint().has_value());
        if (entry.expirationPoint().has_value()) {
            append(values, item + ".expiration",
                   std::to_string(*entry.expirationPoint()));
        }
    }
}

void append_long_term(Tokens& values, const std::string_view prefix,
                      const LongTermMemory& memory) {
    append(values, std::string{prefix} + ".workspace",
           memory.workspaceIdentifier());
    for (std::size_t index = 0; index < memory.entries().size(); ++index) {
        append_entry(values,
                     std::string{prefix} + ".entries[" + decimal(index) + "]",
                     memory.entries()[index]);
    }
}

void append_semantic(Tokens& values, const std::string_view prefix,
                     const SemanticMemory& memory) {
    append(values, std::string{prefix} + ".workspace",
           memory.workspaceIdentifier());
    for (std::size_t index = 0; index < memory.concepts().size(); ++index) {
        append_concept(values,
                       std::string{prefix} + ".concepts[" + decimal(index) +
                           "]",
                       memory.concepts()[index]);
    }
}

void append_episodic(Tokens& values, const std::string_view prefix,
                     const EpisodicMemory& memory) {
    append(values, std::string{prefix} + ".workspace",
           memory.workspaceIdentifier());
    for (std::size_t index = 0; index < memory.episodes().size(); ++index) {
        append_episode(values,
                       std::string{prefix} + ".episodes[" + decimal(index) +
                           "]",
                       memory.episodes()[index]);
    }
}

void append_procedural(Tokens& values, const std::string_view prefix,
                       const ProceduralMemory& memory) {
    append(values, std::string{prefix} + ".workspace",
           memory.workspaceIdentifier());
    for (std::size_t index = 0; index < memory.procedures().size(); ++index) {
        append_procedure(values,
                         std::string{prefix} + ".procedures[" +
                             decimal(index) + "]",
                         memory.procedures()[index]);
    }
}

void append_reflection(Tokens& values, const std::string_view prefix,
                       const Reflection& reflection) {
    append(values, std::string{prefix} + ".workspace",
           reflection.workspaceIdentifier());
    append(values, std::string{prefix} + ".identifier",
           reflection.identifier());
    append(values, std::string{prefix} + ".knowledge", reflection.knowledge());
    for (std::size_t index = 0; index < reflection.sourceCandidates().size();
         ++index) {
        append_candidate(values,
                         std::string{prefix} + ".sources[" + decimal(index) +
                             "]",
                         reflection.sourceCandidates()[index]);
        const auto& chain = reflection.sourceExplanationChains()[index];
        for (std::size_t token = 0; token < chain.size(); ++token) {
            append(values,
                   std::string{prefix} + ".chains[" + decimal(index) + "][" +
                       decimal(token) + "]",
                   chain[token]);
        }
    }
}

[[nodiscard]] Tokens snapshot_of(const StudioView& view) {
    Tokens values;
    append(values, "View.workspace", view.workspaceIdentifier());
    append(values, "View.memory.present", view.memory() != nullptr);
    append(values, "View.working.present", view.workingMemory() != nullptr);
    append(values, "View.longterm.present", view.longTermMemory() != nullptr);
    append(values, "View.semantic.present", view.semanticMemory() != nullptr);
    append(values, "View.episodic.present", view.episodicMemory() != nullptr);
    append(values, "View.procedural.present",
           view.proceduralMemory() != nullptr);
    if (view.memory() != nullptr) {
        append_memory(values, "Memory", *view.memory());
    }
    if (view.workingMemory() != nullptr) {
        append_working(values, "Working", *view.workingMemory());
    }
    if (view.longTermMemory() != nullptr) {
        append_long_term(values, "LongTerm", *view.longTermMemory());
    }
    if (view.semanticMemory() != nullptr) {
        append_semantic(values, "Semantic", *view.semanticMemory());
    }
    if (view.episodicMemory() != nullptr) {
        append_episodic(values, "Episodic", *view.episodicMemory());
    }
    if (view.proceduralMemory() != nullptr) {
        append_procedural(values, "Procedural", *view.proceduralMemory());
    }

    for (std::size_t outer = 0; outer < view.retrievalSessions().size();
         ++outer) {
        const auto& session = view.retrievalSessions()[outer];
        const auto prefix = "Retrieval[" + decimal(outer) + "]";
        append(values, prefix + ".workspace", session.workspaceIdentifier());
        append(values, prefix + ".started", session.started());
        append(values, prefix + ".forgotten", session.forgotten());
        for (std::size_t inner = 0; inner < session.candidates().size();
             ++inner) {
            const auto& candidate = session.candidates()[inner];
            append_candidate(values,
                             prefix + ".candidates[" + decimal(inner) + "]",
                             candidate);
            const auto explanation = MemoryRetrievalEngine{}.explain(
                session, candidate.kind(), candidate.sourceIdentifier());
            require_ok(explanation);
            for (std::size_t token = 0;
                 token < explanation.explanationChain().size(); ++token) {
                append(values,
                       prefix + ".chains[" + decimal(inner) + "][" +
                           decimal(token) + "]",
                       explanation.explanationChain()[token]);
            }
        }
    }

    for (std::size_t outer = 0;
         outer < view.consolidationSessions().size(); ++outer) {
        const auto& session = view.consolidationSessions()[outer];
        const auto prefix = "Consolidation[" + decimal(outer) + "]";
        append(values, prefix + ".workspace", session.workspaceIdentifier());
        append(values, prefix + ".state",
               std::to_string(static_cast<int>(session.state())));
        if (session.request() != nullptr) {
            append(values, prefix + ".request.workspace",
                   session.request()->workspaceIdentifier());
            append(values, prefix + ".request.task",
                   session.request()->taskIdentifier());
            append(values, prefix + ".request.entry",
                   session.request()->entryIdentifier());
        }
        if (session.candidate() != nullptr) {
            const auto& candidate = *session.candidate();
            append(values, prefix + ".candidate.workspace",
                   candidate.workspaceIdentifier());
            append(values, prefix + ".candidate.task",
                   candidate.taskIdentifier());
            append(values, prefix + ".candidate.position",
                   candidate.sourcePosition());
            if (candidate.workingMemoryEntry() != nullptr) {
                append(values, prefix + ".candidate.working.id",
                       candidate.workingMemoryEntry()->identifier());
                append(values, prefix + ".candidate.working.value",
                       candidate.workingMemoryEntry()->value());
            }
            if (candidate.longTermMemoryEntry() != nullptr) {
                append_entry(values, prefix + ".candidate.longterm",
                             *candidate.longTermMemoryEntry());
            }
            append(values, prefix + ".candidate.retained.present",
                   candidate.retainedPosition().has_value());
            if (candidate.retainedPosition().has_value()) {
                append(values, prefix + ".candidate.retained",
                       *candidate.retainedPosition());
            }
        }
        if (session.workingMemory() != nullptr) {
            append_working(values, prefix + ".working",
                           *session.workingMemory());
        }
        if (session.longTermMemory() != nullptr) {
            append_long_term(values, prefix + ".longterm",
                             *session.longTermMemory());
        }
    }

    for (std::size_t outer = 0; outer < view.reflections().size(); ++outer) {
        append_reflection(values,
                          "ReflectionValue[" + decimal(outer) + "]",
                          view.reflections()[outer]);
    }
    for (std::size_t outer = 0; outer < view.reflectionSessions().size();
         ++outer) {
        const auto& session = view.reflectionSessions()[outer];
        const auto prefix = "ReflectionSession[" + decimal(outer) + "]";
        append(values, prefix + ".workspace", session.workspaceIdentifier());
        append(values, prefix + ".state",
               std::to_string(static_cast<int>(session.state())));
        if (session.query() != nullptr) {
            append(values, prefix + ".query.workspace",
                   session.query()->workspaceIdentifier());
            append(values, prefix + ".query.identifier",
                   session.query()->identifier());
            append(values, prefix + ".query.knowledge",
                   session.query()->knowledge());
        }
        for (std::size_t inner = 0; inner < session.sourceCandidates().size();
             ++inner) {
            append_candidate(values,
                             prefix + ".sources[" + decimal(inner) + "]",
                             session.sourceCandidates()[inner]);
            const auto& chain = session.sourceExplanationChains()[inner];
            for (std::size_t token = 0; token < chain.size(); ++token) {
                append(values,
                       prefix + ".chains[" + decimal(inner) + "][" +
                           decimal(token) + "]",
                       chain[token]);
            }
        }
        if (session.reflection() != nullptr) {
            append_reflection(values, prefix + ".reflection",
                              *session.reflection());
        }
    }

    for (std::size_t outer = 0; outer < view.providerSessions().size();
         ++outer) {
        const auto& session = view.providerSessions()[outer];
        const auto prefix = "Provider[" + decimal(outer) + "]";
        append(values, prefix + ".workspace", session.workspaceIdentifier());
        append(values, prefix + ".state",
               std::to_string(static_cast<int>(session.state())));
        for (std::size_t inner = 0; inner < session.descriptors().size();
             ++inner) {
            append(values,
                   prefix + ".descriptors[" + decimal(inner) + "].workspace",
                   session.descriptors()[inner].workspaceIdentifier());
            append(values,
                   prefix + ".descriptors[" + decimal(inner) + "].identifier",
                   session.descriptors()[inner].identifier());
        }
    }
    return values;
}

[[nodiscard]] Tokens snapshot_of(const StudioSession& session) {
    Tokens result{session.workspaceIdentifier(),
                  std::to_string(static_cast<int>(session.state()))};
    if (session.view() != nullptr) {
        auto view = snapshot_of(*session.view());
        result.insert(result.end(), view.begin(), view.end());
    }
    return result;
}

[[nodiscard]] const std::string& expected_message(
    const std::string_view code) {
    static const std::string forgotten{"studio session is forgotten"};
    static const std::string not_observed{"studio session has no observed view"};
    static const std::string workspace_mismatch{
        "workspace identifiers do not match"};
    static const std::string invalid_view{"studio view is invalid"};
    static const std::string invalid_query{"studio query is invalid"};
    static const std::string not_found{"studio query matched no observation"};
    if (code == "SESSION_FORGOTTEN") {
        return forgotten;
    }
    if (code == "SESSION_NOT_OBSERVED") {
        return not_observed;
    }
    if (code == "WORKSPACE_MISMATCH") {
        return workspace_mismatch;
    }
    if (code == "INVALID_VIEW") {
        return invalid_view;
    }
    if (code == "INVALID_QUERY") {
        return invalid_query;
    }
    return not_found;
}

void expect_failure(const StudioResult& result, const std::string_view code,
                    const std::string_view expected_workspace = workspace) {
    EXPECT_EQ(result.workspaceIdentifier(), expected_workspace);
    EXPECT_FALSE(result.succeeded());
    EXPECT_EQ(result.code(), code);
    EXPECT_EQ(result.message(), expected_message(code));
    EXPECT_EQ(result.view(), nullptr);
    EXPECT_TRUE(result.observations().empty());
    EXPECT_TRUE(result.explanationChains().empty());
}

void expect_success(const StudioResult& result,
                    const std::string_view expected_workspace = workspace) {
    EXPECT_EQ(result.workspaceIdentifier(), expected_workspace);
    EXPECT_TRUE(result.succeeded()) << result.code() << ": " << result.message();
    EXPECT_EQ(result.code(), "OK");
    EXPECT_TRUE(result.message().empty());
}

struct Fixture final {
    explicit Fixture(std::string workspace_identifier_value = std::string{workspace})
        : workspace_identifier{std::move(workspace_identifier_value)},
          memory{this->workspace_identifier},
          working{this->workspace_identifier},
          long_term{this->workspace_identifier},
          semantic{this->workspace_identifier},
          episodic{this->workspace_identifier},
          procedural{this->workspace_identifier} {
        populate_aggregates();
        populate_retrieval();
        populate_consolidation();
        populate_reflection();
        populate_providers();
    }

    [[nodiscard]] StudioView view() const {
        return StudioView{workspace_identifier,
                          memory,
                          working,
                          long_term,
                          semantic,
                          episodic,
                          procedural,
                          retrieval_sessions,
                          consolidation_sessions,
                          reflections,
                          reflection_sessions,
                          provider_sessions};
    }

    std::string workspace_identifier;
    Memory memory;
    WorkingMemory working;
    LongTermMemory long_term;
    SemanticMemory semantic;
    EpisodicMemory episodic;
    ProceduralMemory procedural;
    std::vector<RetrievalSession> retrieval_sessions;
    std::vector<ConsolidationSession> consolidation_sessions;
    std::vector<Reflection> reflections;
    std::vector<ReflectionSession> reflection_sessions;
    std::vector<ProviderSession> provider_sessions;

  private:
    [[nodiscard]] const LongTermMemoryEntry& evidence(
        const std::string_view identifier) const {
        const auto* const entry = long_term.find(identifier);
        if (entry == nullptr) {
            throw std::logic_error{"fixture evidence is absent"};
        }
        return *entry;
    }

    void populate_aggregates() {
        require_ok(MemoryEngine{}.store(
            memory, MemoryEntry{"shared", "memory shared value"}));
        require_ok(MemoryEngine{}.store(
            memory, MemoryEntry{"memory-b", "memory value b"}));

        require_ok(WorkingMemoryEngine{}.activate(working, "task-main"));
        require_ok(WorkingMemoryEngine{}.store(
            working, WorkingMemoryEntry{"shared", "working shared value", 77U}));
        require_ok(WorkingMemoryEngine{}.store(
            working, WorkingMemoryEntry{"working-b", "working value b"}));

        require_ok(LongTermMemoryEngine{}.retain(
            long_term, LongTermMemoryEntry{"evidence-a", "Evidence A"}));
        require_ok(LongTermMemoryEngine{}.retain(
            long_term, LongTermMemoryEntry{"evidence-b", "Evidence B"}));
        require_ok(LongTermMemoryEngine{}.retain(
            long_term, LongTermMemoryEntry{"shared", "long-term shared value"}));

        require_ok(SemanticMemoryEngine{}.classify(
            semantic, long_term,
            SemanticConcept{"shared", "semantic shared meaning",
                            {evidence("evidence-a"), evidence("evidence-b")}}));
        require_ok(SemanticMemoryEngine{}.classify(
            semantic, long_term,
            SemanticConcept{"semantic-b", "semantic meaning b",
                            {evidence("shared")}}));
        require_ok(SemanticMemoryEngine{}.categorize(semantic, "shared",
                                                      "category-a"));
        require_ok(SemanticMemoryEngine{}.categorize(semantic, "shared",
                                                      "category-a"));
        require_ok(SemanticMemoryEngine{}.link(semantic, "shared",
                                                "semantic-b"));

        require_ok(EpisodicMemoryEngine{}.derive(
            episodic, long_term,
            Episode{"shared", "episode shared occurrence", "context-a", 11,
                    {evidence("evidence-a")}}));
        require_ok(EpisodicMemoryEngine{}.derive(
            episodic, long_term,
            Episode{"episode-b", "episode occurrence b", "context-b", 22,
                    {evidence("evidence-b"), evidence("shared")}}));
        require_ok(EpisodicMemoryEngine{}.link(episodic, "shared",
                                                "episode-b"));

        require_ok(ProceduralMemoryEngine{}.derive(
            procedural, long_term,
            Procedure{"shared", "procedure shared activity",
                      {"step-a", "step-a", "step-b"},
                      {evidence("evidence-a")}}));
        require_ok(ProceduralMemoryEngine{}.compose(
            procedural, long_term,
            Procedure{"procedure-b", "procedure activity b", {"step-c"},
                      {evidence("evidence-b"), evidence("shared")}}));
        require_ok(ProceduralMemoryEngine{}.link(procedural, "shared",
                                                  "procedure-b"));
        require_ok(LongTermMemoryEngine{}.archive(long_term, "evidence-b"));
    }

    void populate_retrieval() {
        retrieval_sessions.emplace_back(workspace_identifier);

        RetrievalSession started{workspace_identifier};
        require_ok(MemoryRetrievalEngine{}.search(
            started, semantic, episodic, procedural, KnowledgeQuery{""}));
        require_ok(MemoryRetrievalEngine{}.rank(started));
        retrieval_sessions.push_back(started);

        RetrievalSession forgotten{started};
        require_ok(MemoryRetrievalEngine{}.forgetSession(forgotten));
        retrieval_sessions.push_back(std::move(forgotten));
    }

    void populate_consolidation() {
        consolidation_sessions.emplace_back(workspace_identifier);

        ConsolidationSession analyzed{workspace_identifier};
        const ConsolidationRequest request{workspace_identifier, "task-main",
                                           "working-b"};
        require_ok(MemoryConsolidationEngine{}.analyze(
            analyzed, request, working, long_term));
        consolidation_sessions.push_back(analyzed);

        ConsolidationSession forgotten{workspace_identifier};
        require_ok(MemoryConsolidationEngine{}.forgetSession(forgotten));
        consolidation_sessions.push_back(std::move(forgotten));
    }

    void populate_reflection() {
        ReflectionSession prepared{workspace_identifier};
        const ReflectionQuery query{workspace_identifier, "reflection-target",
                                    "mechanical reflected knowledge"};
        require_ok(MemoryReflectionEngine{}.reflect(
            prepared, query, retrieval_sessions[1]));

        ReflectionSession derived{prepared};
        const auto result = MemoryReflectionEngine{}.derive(
            derived, semantic, episodic, procedural);
        require_ok(result);
        if (result.reflection() == nullptr) {
            throw std::logic_error{"fixture reflection payload is absent"};
        }
        reflections.push_back(*result.reflection());
        reflection_sessions.push_back(prepared);
        reflection_sessions.push_back(derived);

        ReflectionSession forgotten{workspace_identifier};
        require_ok(MemoryReflectionEngine{}.forgetSession(forgotten));
        reflection_sessions.push_back(std::move(forgotten));
    }

    void populate_providers() {
        const ProviderDescriptor shared{workspace_identifier, "shared"};
        const ProviderDescriptor other{workspace_identifier, "provider-b"};

        ProviderSession open{workspace_identifier};
        require_ok(MemoryProviderEngine{}.registerProvider(open, shared));
        require_ok(MemoryProviderEngine{}.registerProvider(open, other));
        provider_sessions.push_back(open);

        ProviderSession exported{open};
        const ProviderRequest request{workspace_identifier,
                                      "shared",
                                      memory,
                                      working,
                                      long_term,
                                      semantic,
                                      episodic,
                                      procedural,
                                      reflections};
        require_ok(MemoryProviderEngine{}.exportState(exported, request));
        provider_sessions.push_back(exported);

        ProviderSession forgotten{open};
        require_ok(MemoryProviderEngine{}.forgetSession(forgotten));
        provider_sessions.push_back(std::move(forgotten));
    }
};

[[nodiscard]] StudioView minimal_view(const std::string& identifier) {
    const Memory memory{identifier};
    const WorkingMemory working{identifier};
    const LongTermMemory long_term{identifier};
    const SemanticMemory semantic{identifier};
    const EpisodicMemory episodic{identifier};
    const ProceduralMemory procedural{identifier};
    return StudioView{identifier, memory, working, long_term, semantic,
                      episodic, procedural};
}

void append_indexed_paths(std::vector<std::string>& paths,
                          const std::string_view prefix,
                          const std::size_t count) {
    for (std::size_t index = 0; index < count; ++index) {
        paths.emplace_back(std::string{prefix} + "[" + decimal(index) + "]");
    }
}

[[nodiscard]] std::vector<std::string> empty_paths_for(
    const StudioView& view, const Scope scope) {
    std::vector<std::string> paths;
    const auto includes = [scope](const Scope selected) {
        return scope == Scope::Complete || scope == selected;
    };
    if (includes(Scope::Memory)) {
        paths.emplace_back("Memory");
        append_indexed_paths(paths, "Memory.entries", view.memory()->size());
    }
    if (includes(Scope::WorkingMemory)) {
        paths.emplace_back("WorkingMemory");
        append_indexed_paths(paths, "WorkingMemory.entries",
                             view.workingMemory()->size());
    }
    if (includes(Scope::LongTermMemory)) {
        paths.emplace_back("LongTermMemory");
        append_indexed_paths(paths, "LongTermMemory.entries",
                             view.longTermMemory()->size());
    }
    if (includes(Scope::SemanticMemory)) {
        paths.emplace_back("SemanticMemory");
        append_indexed_paths(paths, "SemanticMemory.concepts",
                             view.semanticMemory()->size());
    }
    if (includes(Scope::EpisodicMemory)) {
        paths.emplace_back("EpisodicMemory");
        append_indexed_paths(paths, "EpisodicMemory.episodes",
                             view.episodicMemory()->size());
    }
    if (includes(Scope::ProceduralMemory)) {
        paths.emplace_back("ProceduralMemory");
        append_indexed_paths(paths, "ProceduralMemory.procedures",
                             view.proceduralMemory()->size());
    }
    if (includes(Scope::Retrieval)) {
        for (std::size_t outer = 0; outer < view.retrievalSessions().size();
             ++outer) {
            const auto session = "Retrieval.sessions[" + decimal(outer) + "]";
            paths.push_back(session);
            append_indexed_paths(paths, session + ".candidates",
                                 view.retrievalSessions()[outer].size());
        }
    }
    if (includes(Scope::Consolidation)) {
        append_indexed_paths(paths, "Consolidation.sessions",
                             view.consolidationSessions().size());
    }
    if (includes(Scope::Reflection)) {
        for (std::size_t outer = 0; outer < view.reflections().size(); ++outer) {
            const auto value = "Reflection.values[" + decimal(outer) + "]";
            paths.push_back(value);
            append_indexed_paths(paths, value + ".sources",
                                 view.reflections()[outer].sourceCandidates().size());
        }
        for (std::size_t outer = 0;
             outer < view.reflectionSessions().size(); ++outer) {
            const auto session =
                "Reflection.sessions[" + decimal(outer) + "]";
            paths.push_back(session);
            append_indexed_paths(
                paths, session + ".sources",
                view.reflectionSessions()[outer].sourceCandidates().size());
        }
    }
    if (includes(Scope::Providers)) {
        for (std::size_t outer = 0; outer < view.providerSessions().size();
             ++outer) {
            const auto session = "Providers.sessions[" + decimal(outer) + "]";
            paths.push_back(session);
            append_indexed_paths(paths, session + ".descriptors",
                                 view.providerSessions()[outer].size());
        }
    }
    return paths;
}

// API-014-CT: exact public types, special members, qualifiers, defaults, and
// operation signatures. AR-014 supplies the source-level closed-surface proof.
static_assert(static_cast<int>(Scope::Complete) == 0);
static_assert(static_cast<int>(Scope::Memory) == 1);
static_assert(static_cast<int>(Scope::WorkingMemory) == 2);
static_assert(static_cast<int>(Scope::LongTermMemory) == 3);
static_assert(static_cast<int>(Scope::SemanticMemory) == 4);
static_assert(static_cast<int>(Scope::EpisodicMemory) == 5);
static_assert(static_cast<int>(Scope::ProceduralMemory) == 6);
static_assert(static_cast<int>(Scope::Retrieval) == 7);
static_assert(static_cast<int>(Scope::Consolidation) == 8);
static_assert(static_cast<int>(Scope::Reflection) == 9);
static_assert(static_cast<int>(Scope::Providers) == 10);
static_assert(static_cast<int>(StudioState::Open) == 0);
static_assert(static_cast<int>(StudioState::Observed) == 1);
static_assert(static_cast<int>(StudioState::Forgotten) == 2);

static_assert(std::is_constructible_v<
              StudioView, std::string, const Memory&, const WorkingMemory&,
              const LongTermMemory&, const SemanticMemory&,
              const EpisodicMemory&, const ProceduralMemory&>);
static_assert(std::is_constructible_v<
              StudioView, std::string, const Memory&, const WorkingMemory&,
              const LongTermMemory&, const SemanticMemory&,
              const EpisodicMemory&, const ProceduralMemory&,
              std::vector<RetrievalSession>,
              std::vector<ConsolidationSession>, std::vector<Reflection>,
              std::vector<ReflectionSession>, std::vector<ProviderSession>>);
static_assert(!std::is_default_constructible_v<StudioView>);
static_assert(std::is_copy_constructible_v<StudioView>);
static_assert(std::is_copy_assignable_v<StudioView>);
static_assert(std::is_nothrow_move_constructible_v<StudioView>);
static_assert(std::is_nothrow_move_assignable_v<StudioView>);

static_assert(std::is_constructible_v<StudioQuery, std::string>);
static_assert(std::is_constructible_v<StudioQuery, std::string, Scope>);
static_assert(
    std::is_constructible_v<StudioQuery, std::string, Scope, std::string>);
static_assert(!std::is_default_constructible_v<StudioQuery>);
static_assert(std::is_copy_constructible_v<StudioQuery>);
static_assert(std::is_copy_assignable_v<StudioQuery>);
static_assert(std::is_nothrow_move_constructible_v<StudioQuery>);
static_assert(std::is_nothrow_move_assignable_v<StudioQuery>);

static_assert(std::is_constructible_v<StudioSession, std::string>);
static_assert(!std::is_default_constructible_v<StudioSession>);
static_assert(std::is_copy_constructible_v<StudioSession>);
static_assert(!std::is_copy_assignable_v<StudioSession>);
static_assert(std::is_nothrow_move_constructible_v<StudioSession>);
static_assert(!std::is_move_assignable_v<StudioSession>);

static_assert(!std::is_default_constructible_v<StudioResult>);
static_assert(!std::is_copy_constructible_v<StudioResult>);
static_assert(!std::is_copy_assignable_v<StudioResult>);
static_assert(std::is_nothrow_move_constructible_v<StudioResult>);
static_assert(std::is_nothrow_move_assignable_v<StudioResult>);
static_assert(std::is_empty_v<MemoryStudioEngine>);
static_assert(std::is_default_constructible_v<MemoryStudioEngine>);

static_assert(std::same_as<decltype(std::declval<const StudioView&>()
                                        .workspaceIdentifier()),
                           const std::string&>);
static_assert(std::same_as<decltype(std::declval<const StudioView&>().memory()),
                           const Memory*>);
static_assert(std::same_as<decltype(std::declval<const StudioView&>()
                                        .workingMemory()),
                           const WorkingMemory*>);
static_assert(std::same_as<decltype(std::declval<const StudioView&>()
                                        .longTermMemory()),
                           const LongTermMemory*>);
static_assert(std::same_as<decltype(std::declval<const StudioView&>()
                                        .semanticMemory()),
                           const SemanticMemory*>);
static_assert(std::same_as<decltype(std::declval<const StudioView&>()
                                        .episodicMemory()),
                           const EpisodicMemory*>);
static_assert(std::same_as<decltype(std::declval<const StudioView&>()
                                        .proceduralMemory()),
                           const ProceduralMemory*>);
static_assert(std::same_as<decltype(std::declval<const StudioView&>()
                                        .retrievalSessions()),
                           const std::vector<RetrievalSession>&>);
static_assert(std::same_as<decltype(std::declval<const StudioView&>()
                                        .consolidationSessions()),
                           const std::vector<ConsolidationSession>&>);
static_assert(std::same_as<decltype(std::declval<const StudioView&>()
                                        .reflections()),
                           const std::vector<Reflection>&>);
static_assert(std::same_as<decltype(std::declval<const StudioView&>()
                                        .reflectionSessions()),
                           const std::vector<ReflectionSession>&>);
static_assert(std::same_as<decltype(std::declval<const StudioView&>()
                                        .providerSessions()),
                           const std::vector<ProviderSession>&>);
static_assert(noexcept(std::declval<const StudioView&>().workspaceIdentifier()));
static_assert(noexcept(std::declval<const StudioView&>().memory()));
static_assert(noexcept(std::declval<const StudioView&>().providerSessions()));

static_assert(std::same_as<decltype(std::declval<const StudioQuery&>().scope()),
                           Scope>);
static_assert(std::same_as<decltype(std::declval<const StudioQuery&>()
                                        .identifier()),
                           const std::string&>);
static_assert(noexcept(std::declval<const StudioQuery&>().scope()));
static_assert(noexcept(std::declval<const StudioQuery&>().identifier()));
static_assert(std::same_as<decltype(std::declval<const StudioSession&>().state()),
                           StudioState>);
static_assert(std::same_as<decltype(std::declval<const StudioSession&>().view()),
                           const StudioView*>);
static_assert(noexcept(std::declval<const StudioSession&>().view()));
static_assert(std::same_as<decltype(std::declval<const StudioResult&>()
                                        .workspaceIdentifier()),
                           const std::string&>);
static_assert(std::same_as<decltype(std::declval<const StudioResult&>()
                                        .succeeded()),
                           bool>);
static_assert(std::same_as<decltype(std::declval<const StudioResult&>().view()),
                           const StudioView*>);
static_assert(std::same_as<decltype(std::declval<const StudioResult&>()
                                        .observations()),
                           const std::vector<std::string>&>);
static_assert(std::same_as<decltype(std::declval<const StudioResult&>()
                                        .explanationChains()),
                           const std::vector<std::vector<std::string>>&>);
static_assert(noexcept(std::declval<const StudioResult&>().succeeded()));
static_assert(noexcept(std::declval<const StudioResult&>().explanationChains()));

using ObserveSignature = StudioResult (MemoryStudioEngine::*)(
    StudioSession&, const StudioView&) const;
using QuerySignature = StudioResult (MemoryStudioEngine::*)(
    const StudioSession&, const StudioQuery&) const;
using ExportSignature = StudioResult (MemoryStudioEngine::*)(
    const StudioSession&) const;
using ForgetSignature = StudioResult (MemoryStudioEngine::*)(StudioSession&) const;
static_assert(std::same_as<decltype(&MemoryStudioEngine::observe),
                           ObserveSignature>);
static_assert(std::same_as<decltype(&MemoryStudioEngine::inspect),
                           QuerySignature>);
static_assert(std::same_as<decltype(&MemoryStudioEngine::trace), QuerySignature>);
static_assert(std::same_as<decltype(&MemoryStudioEngine::summarize),
                           QuerySignature>);
static_assert(std::same_as<decltype(&MemoryStudioEngine::exportView),
                           ExportSignature>);
static_assert(std::same_as<decltype(&MemoryStudioEngine::forgetSession),
                           ForgetSignature>);

TEST(MemoryStudioApiTest, ConstructionDefaultsAndByteExactStringsAreExact) {
    EXPECT_THROW(static_cast<void>(minimal_view("")), std::invalid_argument);
    EXPECT_THROW(static_cast<void>(StudioQuery{""}), std::invalid_argument);
    EXPECT_THROW(static_cast<void>(StudioSession{""}), std::invalid_argument);

    const StudioQuery defaults{std::string{workspace}};
    EXPECT_EQ(defaults.workspaceIdentifier(), workspace);
    EXPECT_EQ(defaults.scope(), Scope::Complete);
    EXPECT_TRUE(defaults.identifier().empty());

    const std::string exact_workspace{" workspace\0A ", 13};
    const std::string exact_identifier{" Id\0B ", 7};
    const StudioQuery exact{exact_workspace, Scope::Providers,
                            exact_identifier};
    EXPECT_EQ(exact.workspaceIdentifier(), exact_workspace);
    EXPECT_EQ(exact.scope(), Scope::Providers);
    EXPECT_EQ(exact.identifier(), exact_identifier);
}

TEST(MemoryStudioValueTest, ViewConstructionCopyAssignmentAndMovesOwnDeepState) {
    Fixture fixture;
    auto original = fixture.view();
    const auto expected = snapshot_of(original);

    StudioView copied{original};
    auto assigned = minimal_view(std::string{workspace});
    assigned = original;
    EXPECT_EQ(snapshot_of(copied), expected);
    EXPECT_EQ(snapshot_of(assigned), expected);
    EXPECT_NE(copied.memory(), original.memory());
    EXPECT_NE(assigned.semanticMemory(), original.semanticMemory());

    require_ok(MemoryEngine{}.store(
        fixture.memory, MemoryEntry{"late-source", "not captured"}));
    require_ok(MemoryRetrievalEngine{}.forgetSession(
        fixture.retrieval_sessions[1]));
    require_ok(MemoryProviderEngine{}.forgetSession(
        fixture.provider_sessions[0]));
    EXPECT_EQ(snapshot_of(original), expected);
    EXPECT_EQ(snapshot_of(copied), expected);

    StudioView moved{std::move(original)};
    EXPECT_EQ(snapshot_of(moved), expected);
    EXPECT_EQ(original.workspaceIdentifier(), workspace);
    EXPECT_EQ(original.memory(), nullptr);
    EXPECT_EQ(original.workingMemory(), nullptr);
    EXPECT_EQ(original.longTermMemory(), nullptr);
    EXPECT_EQ(original.semanticMemory(), nullptr);
    EXPECT_EQ(original.episodicMemory(), nullptr);
    EXPECT_EQ(original.proceduralMemory(), nullptr);
    EXPECT_TRUE(original.retrievalSessions().empty());
    EXPECT_TRUE(original.consolidationSessions().empty());
    EXPECT_TRUE(original.reflections().empty());
    EXPECT_TRUE(original.reflectionSessions().empty());
    EXPECT_TRUE(original.providerSessions().empty());

    StudioView copied_invalid{original};
    auto assigned_invalid = minimal_view(std::string{workspace});
    assigned_invalid = original;
    EXPECT_EQ(snapshot_of(copied_invalid), snapshot_of(original));
    EXPECT_EQ(snapshot_of(assigned_invalid), snapshot_of(original));

    auto move_target = minimal_view(std::string{workspace});
    move_target = std::move(moved);
    EXPECT_EQ(snapshot_of(move_target), expected);
    EXPECT_EQ(moved.workspaceIdentifier(), workspace);
    EXPECT_EQ(moved.memory(), nullptr);
}

TEST(MemoryStudioValueTest, QueryAndEverySessionStageHaveExactMoveShapes) {
    const std::string identifier{"  Case\0Sensitive  ", 18};
    StudioQuery query{std::string{workspace}, Scope::Reflection, identifier};
    StudioQuery moved_query{std::move(query)};
    EXPECT_EQ(moved_query.workspaceIdentifier(), workspace);
    EXPECT_EQ(moved_query.scope(), Scope::Reflection);
    EXPECT_EQ(moved_query.identifier(), identifier);
    EXPECT_EQ(query.workspaceIdentifier(), workspace);
    EXPECT_EQ(query.scope(), Scope::Complete);
    EXPECT_TRUE(query.identifier().empty());
    const StudioQuery copied_moved_from{query};
    EXPECT_EQ(copied_moved_from.scope(), Scope::Complete);

    StudioQuery assigned_source{std::string{workspace}, Scope::Providers,
                                "provider-b"};
    StudioQuery assigned_target{std::string{workspace}, Scope::Memory,
                                "discarded"};
    assigned_target = std::move(assigned_source);
    EXPECT_EQ(assigned_target.scope(), Scope::Providers);
    EXPECT_EQ(assigned_target.identifier(), "provider-b");
    EXPECT_EQ(assigned_source.workspaceIdentifier(), workspace);
    EXPECT_EQ(assigned_source.scope(), Scope::Complete);
    EXPECT_TRUE(assigned_source.identifier().empty());

    MemoryStudioEngine engine;
    Fixture fixture;
    const auto view = fixture.view();

    StudioSession open{std::string{workspace}};
    StudioSession moved_open{std::move(open)};
    EXPECT_EQ(moved_open.state(), StudioState::Open);
    EXPECT_EQ(open.workspaceIdentifier(), workspace);
    EXPECT_EQ(open.state(), StudioState::Open);
    EXPECT_EQ(open.view(), nullptr);

    StudioSession observed{std::string{workspace}};
    require_ok(engine.observe(observed, view));
    const auto observed_snapshot = snapshot_of(observed);
    StudioSession moved_observed{std::move(observed)};
    EXPECT_EQ(snapshot_of(moved_observed), observed_snapshot);
    EXPECT_EQ(observed.workspaceIdentifier(), workspace);
    EXPECT_EQ(observed.state(), StudioState::Open);
    EXPECT_EQ(observed.view(), nullptr);

    StudioSession forgotten{std::string{workspace}};
    require_ok(engine.forgetSession(forgotten));
    StudioSession moved_forgotten{std::move(forgotten)};
    EXPECT_EQ(moved_forgotten.state(), StudioState::Forgotten);
    EXPECT_EQ(moved_forgotten.view(), nullptr);
    EXPECT_EQ(forgotten.workspaceIdentifier(), workspace);
    EXPECT_EQ(forgotten.state(), StudioState::Forgotten);
    EXPECT_EQ(forgotten.view(), nullptr);
}

TEST(MemoryStudioLifecycleTest, AllStagesReplacementAndPayloadShapesAreExact) {
    Fixture fixture;
    MemoryStudioEngine engine;
    StudioSession session{std::string{workspace}};
    const StudioQuery complete{std::string{workspace}};
    const auto first_view = fixture.view();

    expect_failure(engine.inspect(session, complete), "SESSION_NOT_OBSERVED");
    expect_failure(engine.trace(session, complete), "SESSION_NOT_OBSERVED");
    expect_failure(engine.summarize(session, complete),
                   "SESSION_NOT_OBSERVED");
    expect_failure(engine.exportView(session), "SESSION_NOT_OBSERVED");

    auto first = engine.observe(session, first_view);
    expect_success(first);
    ASSERT_NE(first.view(), nullptr);
    EXPECT_TRUE(first.observations().empty());
    EXPECT_TRUE(first.explanationChains().empty());
    EXPECT_EQ(session.state(), StudioState::Observed);
    ASSERT_NE(session.view(), nullptr);
    const auto first_snapshot = snapshot_of(*first.view());
    EXPECT_EQ(snapshot_of(*session.view()), first_snapshot);
    EXPECT_NE(session.view(), first.view());

    auto replacement_view = minimal_view(std::string{workspace});
    auto replacement = engine.observe(session, replacement_view);
    expect_success(replacement);
    ASSERT_NE(replacement.view(), nullptr);
    EXPECT_TRUE(replacement.view()->memory()->entries().empty());
    EXPECT_TRUE(session.view()->memory()->entries().empty());
    EXPECT_EQ(snapshot_of(*first.view()), first_snapshot);

    auto inspected = engine.inspect(session, complete);
    expect_success(inspected);
    EXPECT_NE(inspected.view(), nullptr);
    EXPECT_TRUE(inspected.explanationChains().empty());
    auto traced = engine.trace(session, complete);
    expect_success(traced);
    EXPECT_EQ(traced.view(), nullptr);
    EXPECT_TRUE(traced.observations().empty());
    auto summarized = engine.summarize(session, complete);
    expect_success(summarized);
    EXPECT_EQ(summarized.view(), nullptr);
    EXPECT_TRUE(summarized.explanationChains().empty());
    auto exported = engine.exportView(session);
    expect_success(exported);
    EXPECT_NE(exported.view(), nullptr);
    EXPECT_TRUE(exported.observations().empty());
    EXPECT_TRUE(exported.explanationChains().empty());

    auto forgotten = engine.forgetSession(session);
    expect_success(forgotten);
    EXPECT_EQ(forgotten.view(), nullptr);
    EXPECT_TRUE(forgotten.observations().empty());
    EXPECT_TRUE(forgotten.explanationChains().empty());
    EXPECT_EQ(session.state(), StudioState::Forgotten);
    EXPECT_EQ(session.view(), nullptr);
    EXPECT_NE(exported.view(), nullptr);

    expect_failure(engine.observe(session, replacement_view),
                   "SESSION_FORGOTTEN");
    expect_failure(engine.inspect(session, complete), "SESSION_FORGOTTEN");
    expect_failure(engine.trace(session, complete), "SESSION_FORGOTTEN");
    expect_failure(engine.summarize(session, complete), "SESSION_FORGOTTEN");
    expect_failure(engine.exportView(session), "SESSION_FORGOTTEN");
    expect_success(engine.forgetSession(session));
    EXPECT_EQ(session.state(), StudioState::Forgotten);
}

TEST(MemoryStudioLifecycleTest, SessionCopiesDeepCopyEveryStage) {
    MemoryStudioEngine engine;
    Fixture fixture;
    const auto view = fixture.view();

    StudioSession open{std::string{workspace}};
    const StudioSession open_copy{open};
    EXPECT_EQ(snapshot_of(open_copy), snapshot_of(open));

    require_ok(engine.observe(open, view));
    StudioSession observed_copy{open};
    EXPECT_EQ(snapshot_of(observed_copy), snapshot_of(open));
    EXPECT_NE(observed_copy.view(), open.view());
    require_ok(engine.forgetSession(open));
    EXPECT_EQ(observed_copy.state(), StudioState::Observed);
    EXPECT_NE(observed_copy.view(), nullptr);

    StudioSession forgotten_copy{open};
    EXPECT_EQ(snapshot_of(forgotten_copy), snapshot_of(open));
    EXPECT_EQ(forgotten_copy.state(), StudioState::Forgotten);
}

TEST(MemoryStudioSelectionTest, EmptySelectionsUseEveryFrozenPathInFixedOrder) {
    Fixture fixture;
    MemoryStudioEngine engine;
    const auto view = fixture.view();
    StudioSession session{std::string{workspace}};
    require_ok(engine.observe(session, view));

    const std::vector<Scope> scopes{
        Scope::Complete,       Scope::Memory,       Scope::WorkingMemory,
        Scope::LongTermMemory, Scope::SemanticMemory, Scope::EpisodicMemory,
        Scope::ProceduralMemory, Scope::Retrieval,  Scope::Consolidation,
        Scope::Reflection,     Scope::Providers};
    for (const auto scope : scopes) {
        SCOPED_TRACE(static_cast<int>(scope));
        const auto result =
            engine.inspect(session, StudioQuery{std::string{workspace}, scope});
        expect_success(result);
        ASSERT_NE(result.view(), nullptr);
        EXPECT_EQ(result.observations(), empty_paths_for(*result.view(), scope));
        EXPECT_EQ(snapshot_of(*result.view()), snapshot_of(*session.view()));
        EXPECT_NE(result.view(), session.view());
        EXPECT_TRUE(result.explanationChains().empty());
    }
}

TEST(MemoryStudioSelectionTest, ExactIdentityIsCaseSensitiveAndScopeBounded) {
    Fixture fixture;
    MemoryStudioEngine engine;
    const auto view = fixture.view();
    StudioSession session{std::string{workspace}};
    require_ok(engine.observe(session, view));

    const auto memory = engine.inspect(
        session, StudioQuery{std::string{workspace}, Scope::Memory, "shared"});
    expect_success(memory);
    EXPECT_EQ(memory.observations(),
              (std::vector<std::string>{"Memory.entries[0]"}));

    const auto consolidation = engine.inspect(
        session,
        StudioQuery{std::string{workspace}, Scope::Consolidation,
                    "working-b"});
    expect_success(consolidation);
    EXPECT_EQ(consolidation.observations(),
              (std::vector<std::string>{"Consolidation.sessions[1]"}));

    const auto reflection = engine.inspect(
        session, StudioQuery{std::string{workspace}, Scope::Reflection,
                             "reflection-target"});
    expect_success(reflection);
    EXPECT_EQ(reflection.observations(),
              (std::vector<std::string>{"Reflection.values[0]",
                                        "Reflection.sessions[0]",
                                        "Reflection.sessions[1]"}));

    expect_failure(engine.inspect(
                       session, StudioQuery{std::string{workspace},
                                            Scope::Memory, "Shared"}),
                   "NOT_FOUND");
    expect_failure(engine.inspect(
                       session, StudioQuery{std::string{workspace},
                                            Scope::Memory, "hare"}),
                   "NOT_FOUND");
    expect_failure(engine.inspect(
                       session, StudioQuery{std::string{workspace},
                                            Scope::Memory, "semantic-b"}),
                   "NOT_FOUND");

    const auto complete = engine.inspect(
        session,
        StudioQuery{std::string{workspace}, Scope::Complete, "shared"});
    expect_success(complete);
    const auto& paths = complete.observations();
    ASSERT_GE(paths.size(), 12U);
    EXPECT_EQ(paths[0], "Memory.entries[0]");
    EXPECT_EQ(paths[1], "WorkingMemory.entries[0]");
    EXPECT_EQ(paths[2], "LongTermMemory.entries[2]");
    EXPECT_EQ(paths[3], "SemanticMemory.concepts[0]");
    EXPECT_EQ(paths[4], "EpisodicMemory.episodes[0]");
    EXPECT_EQ(paths[5], "ProceduralMemory.procedures[0]");
    EXPECT_EQ(std::count(paths.begin(), paths.end(),
                         "Consolidation.sessions[1]"),
              0);
    EXPECT_EQ(paths.back(), "Providers.sessions[1].descriptors[0]");
}

TEST(MemoryStudioSelectionTest, ZeroAndMultiDigitIndicesHaveClosedGrammar) {
    const std::string identifier{workspace};
    Memory memory{identifier};
    for (std::size_t index = 0; index < 11; ++index) {
        require_ok(MemoryEngine{}.store(
            memory, MemoryEntry{"entry-" + decimal(index), "value"}));
    }
    const WorkingMemory working{identifier};
    const LongTermMemory long_term{identifier};
    const SemanticMemory semantic{identifier};
    const EpisodicMemory episodic{identifier};
    const ProceduralMemory procedural{identifier};
    const StudioView view{identifier, memory, working, long_term, semantic,
                          episodic, procedural};
    StudioSession session{identifier};
    MemoryStudioEngine engine;
    require_ok(engine.observe(session, view));
    const auto result = engine.inspect(
        session, StudioQuery{identifier, Scope::Memory});
    expect_success(result);
    ASSERT_EQ(result.observations().size(), 12U);
    EXPECT_EQ(result.observations()[0], "Memory");
    EXPECT_EQ(result.observations()[1], "Memory.entries[0]");
    EXPECT_EQ(result.observations()[11], "Memory.entries[10]");
    EXPECT_EQ(std::count(result.observations().begin(),
                         result.observations().end(), "Memory.entries[010]"),
              0);
}

[[nodiscard]] std::vector<std::vector<std::string>> retrieval_chains(
    const StudioView& view, const std::string_view identifier = {}) {
    std::vector<std::vector<std::string>> chains;
    for (const auto& session : view.retrievalSessions()) {
        for (const auto& candidate : session.candidates()) {
            if (!identifier.empty() &&
                candidate.sourceIdentifier() != identifier) {
                continue;
            }
            const auto result = MemoryRetrievalEngine{}.explain(
                session, candidate.kind(), candidate.sourceIdentifier());
            require_ok(result);
            chains.push_back(result.explanationChain());
        }
    }
    return chains;
}

[[nodiscard]] std::vector<std::vector<std::string>> reflection_chains(
    const StudioView& view, const std::string_view identifier = {}) {
    std::vector<std::vector<std::string>> chains;
    for (const auto& reflection : view.reflections()) {
        const auto& sources = reflection.sourceCandidates();
        const auto& source_chains = reflection.sourceExplanationChains();
        for (std::size_t index = 0; index < sources.size(); ++index) {
            if (identifier.empty() ||
                sources[index].sourceIdentifier() == identifier) {
                chains.push_back(source_chains[index]);
            }
        }
    }
    for (const auto& session : view.reflectionSessions()) {
        const auto& sources = session.sourceCandidates();
        const auto& source_chains = session.sourceExplanationChains();
        for (std::size_t index = 0; index < sources.size(); ++index) {
            if (identifier.empty() ||
                sources[index].sourceIdentifier() == identifier) {
                chains.push_back(source_chains[index]);
            }
        }
    }
    return chains;
}

TEST(MemoryStudioTraceTest, AuthenticReleasedChainsArePreservedExactly) {
    Fixture fixture;
    MemoryStudioEngine engine;
    const auto view = fixture.view();
    StudioSession session{std::string{workspace}};
    require_ok(engine.observe(session, view));

    const auto expected_retrieval = retrieval_chains(*session.view());
    const auto retrieval = engine.trace(
        session, StudioQuery{std::string{workspace}, Scope::Retrieval});
    expect_success(retrieval);
    EXPECT_EQ(retrieval.view(), nullptr);
    EXPECT_TRUE(retrieval.observations().empty());
    EXPECT_EQ(retrieval.explanationChains(), expected_retrieval);

    const auto expected_reflection = reflection_chains(*session.view());
    const auto reflection = engine.trace(
        session, StudioQuery{std::string{workspace}, Scope::Reflection});
    expect_success(reflection);
    EXPECT_EQ(reflection.explanationChains(), expected_reflection);

    auto expected_complete = expected_retrieval;
    expected_complete.insert(expected_complete.end(), expected_reflection.begin(),
                             expected_reflection.end());
    const auto complete = engine.trace(session, StudioQuery{std::string{workspace}});
    expect_success(complete);
    EXPECT_EQ(complete.explanationChains(), expected_complete);

    const auto exact = engine.trace(
        session, StudioQuery{std::string{workspace}, Scope::Retrieval, "shared"});
    expect_success(exact);
    EXPECT_EQ(exact.explanationChains(),
              retrieval_chains(*session.view(), "shared"));

    const auto by_reflection = engine.trace(
        session, StudioQuery{std::string{workspace}, Scope::Reflection,
                             "reflection-target"});
    expect_success(by_reflection);
    EXPECT_EQ(by_reflection.explanationChains(), expected_reflection);

    const auto by_reflection_source = engine.trace(
        session, StudioQuery{std::string{workspace}, Scope::Reflection,
                             "shared"});
    expect_success(by_reflection_source);
    const auto expected_reflection_source =
        reflection_chains(*session.view(), "shared");
    EXPECT_FALSE(expected_reflection_source.empty());
    EXPECT_EQ(by_reflection_source.explanationChains(),
              expected_reflection_source);

    expect_failure(engine.trace(
                       session, StudioQuery{std::string{workspace},
                                            Scope::Complete, "memory-b"}),
                   "NOT_FOUND");
}

TEST(MemoryStudioTraceTest, ProhibitedScopesAndValidEmptySelectionsAreExact) {
    Fixture fixture;
    MemoryStudioEngine engine;
    const auto view = fixture.view();
    StudioSession session{std::string{workspace}};
    require_ok(engine.observe(session, view));
    const std::vector<Scope> prohibited{
        Scope::Memory,          Scope::WorkingMemory, Scope::LongTermMemory,
        Scope::SemanticMemory,  Scope::EpisodicMemory,
        Scope::ProceduralMemory, Scope::Consolidation, Scope::Providers};
    for (const auto scope : prohibited) {
        SCOPED_TRACE(static_cast<int>(scope));
        expect_failure(engine.trace(
                           session, StudioQuery{std::string{workspace}, scope}),
                       "INVALID_QUERY");
    }

    const auto empty_view = minimal_view(std::string{workspace});
    StudioSession empty_session{std::string{workspace}};
    require_ok(engine.observe(empty_session, empty_view));
    const auto empty = engine.trace(
        empty_session,
        StudioQuery{std::string{workspace}, Scope::Reflection});
    expect_success(empty);
    EXPECT_TRUE(empty.explanationChains().empty());
}

TEST(MemoryStudioSummaryTest, EveryKeyStateCountAndOrderIsExact) {
    Fixture fixture;
    MemoryStudioEngine engine;
    const auto view = fixture.view();
    StudioSession session{std::string{workspace}};
    require_ok(engine.observe(session, view));

    const std::vector<std::string> expected{
        "Memory.entries=2",
        "WorkingMemory.active=true",
        "WorkingMemory.entries=2",
        "LongTermMemory.entries=3",
        "LongTermMemory.archived=1",
        "SemanticMemory.concepts=2",
        "EpisodicMemory.episodes=2",
        "ProceduralMemory.procedures=2",
        "Retrieval.sessions=3",
        "Retrieval.sessions.Ready=1",
        "Retrieval.sessions.Started=1",
        "Retrieval.sessions.Forgotten=1",
        "Retrieval.candidates=6",
        "Consolidation.sessions=3",
        "Consolidation.sessions.Pristine=1",
        "Consolidation.sessions.Analyzed=1",
        "Consolidation.sessions.Promoted=0",
        "Consolidation.sessions.Retained=0",
        "Consolidation.sessions.Forgotten=1",
        "Consolidation.candidates=1",
        "Reflection.values=1",
        "Reflection.sessions=3",
        "Reflection.sessions.Pristine=0",
        "Reflection.sessions.Prepared=1",
        "Reflection.sessions.Derived=1",
        "Reflection.sessions.Forgotten=1",
        "Reflection.sources=18",
        "Providers.sessions=3",
        "Providers.sessions.Open=1",
        "Providers.sessions.Exported=1",
        "Providers.sessions.Imported=0",
        "Providers.sessions.Forgotten=1",
        "Providers.descriptors=4"};
    const auto complete =
        engine.summarize(session, StudioQuery{std::string{workspace}});
    expect_success(complete);
    EXPECT_EQ(complete.view(), nullptr);
    EXPECT_EQ(complete.observations(), expected);
    EXPECT_TRUE(complete.explanationChains().empty());

    const auto working = engine.summarize(
        session, StudioQuery{std::string{workspace}, Scope::WorkingMemory});
    expect_success(working);
    EXPECT_EQ(working.observations(),
              (std::vector<std::string>{"WorkingMemory.active=true",
                                        "WorkingMemory.entries=2"}));
    const auto providers = engine.summarize(
        session, StudioQuery{std::string{workspace}, Scope::Providers});
    expect_success(providers);
    EXPECT_EQ(providers.observations(),
              (std::vector<std::string>{"Providers.sessions=3",
                                        "Providers.sessions.Open=1",
                                        "Providers.sessions.Exported=1",
                                        "Providers.sessions.Imported=0",
                                        "Providers.sessions.Forgotten=1",
                                        "Providers.descriptors=4"}));

    expect_failure(engine.summarize(
                       session, StudioQuery{std::string{workspace},
                                            Scope::Complete, "shared"}),
                   "INVALID_QUERY");
}

TEST(MemoryStudioSummaryTest,
     EveryLegalReleasedStageIsObservedAndCounted) {
    Fixture fixture;
    MemoryConsolidationEngine consolidation_engine;
    ConsolidationSession promoted{std::string{workspace}};
    const ConsolidationRequest consolidation_request{
        std::string{workspace}, "task-main", "working-b"};
    require_ok(consolidation_engine.analyze(
        promoted, consolidation_request, fixture.working, fixture.long_term));
    require_ok(consolidation_engine.promote(promoted));
    ASSERT_EQ(promoted.state(), ConsolidationSession::State::Promoted);
    ConsolidationSession retained{promoted};
    require_ok(consolidation_engine.retain(
        retained, fixture.working, fixture.long_term));
    ASSERT_EQ(retained.state(), ConsolidationSession::State::Retained);

    ReflectionSession pristine{std::string{workspace}};

    ProviderSession imported{std::string{workspace}};
    const ProviderDescriptor descriptor{std::string{workspace}, "shared"};
    require_ok(MemoryProviderEngine{}.registerProvider(imported, descriptor));
    const ProviderRequest provider_request{
        std::string{workspace}, "shared", fixture.memory, fixture.working,
        fixture.long_term, fixture.semantic, fixture.episodic,
        fixture.procedural, fixture.reflections};
    require_ok(MemoryProviderEngine{}.importState(imported, provider_request));
    ASSERT_EQ(imported.state(), ProviderSession::State::Imported);

    const StudioView view{
        std::string{workspace}, fixture.memory, fixture.working,
        fixture.long_term, fixture.semantic, fixture.episodic,
        fixture.procedural, {}, {promoted, retained}, {}, {pristine},
        {imported}};
    MemoryStudioEngine engine;
    StudioSession session{std::string{workspace}};
    require_ok(engine.observe(session, view));
    ASSERT_NE(session.view(), nullptr);
    ASSERT_EQ(session.view()->consolidationSessions().size(), 2U);
    EXPECT_EQ(session.view()->consolidationSessions()[0].state(),
              ConsolidationSession::State::Promoted);
    EXPECT_EQ(session.view()->consolidationSessions()[1].state(),
              ConsolidationSession::State::Retained);
    ASSERT_EQ(session.view()->reflectionSessions().size(), 1U);
    EXPECT_EQ(session.view()->reflectionSessions()[0].state(),
              ReflectionSession::State::Pristine);
    ASSERT_EQ(session.view()->providerSessions().size(), 1U);
    EXPECT_EQ(session.view()->providerSessions()[0].state(),
              ProviderSession::State::Imported);

    const auto consolidation = engine.summarize(
        session, StudioQuery{std::string{workspace}, Scope::Consolidation});
    expect_success(consolidation);
    EXPECT_EQ(consolidation.observations(),
              (std::vector<std::string>{
                  "Consolidation.sessions=2",
                  "Consolidation.sessions.Pristine=0",
                  "Consolidation.sessions.Analyzed=0",
                  "Consolidation.sessions.Promoted=1",
                  "Consolidation.sessions.Retained=1",
                  "Consolidation.sessions.Forgotten=0",
                  "Consolidation.candidates=2"}));
    const auto reflection = engine.summarize(
        session, StudioQuery{std::string{workspace}, Scope::Reflection});
    expect_success(reflection);
    EXPECT_EQ(reflection.observations(),
              (std::vector<std::string>{
                  "Reflection.values=0", "Reflection.sessions=1",
                  "Reflection.sessions.Pristine=1",
                  "Reflection.sessions.Prepared=0",
                  "Reflection.sessions.Derived=0",
                  "Reflection.sessions.Forgotten=0",
                  "Reflection.sources=0"}));
    const auto providers = engine.summarize(
        session, StudioQuery{std::string{workspace}, Scope::Providers});
    expect_success(providers);
    EXPECT_EQ(providers.observations(),
              (std::vector<std::string>{
                  "Providers.sessions=1", "Providers.sessions.Open=0",
                  "Providers.sessions.Exported=0",
                  "Providers.sessions.Imported=1",
                  "Providers.sessions.Forgotten=0",
                  "Providers.descriptors=1"}));
}

TEST(MemoryStudioSummaryTest, EmptyCompleteViewReportsEveryZeroAndFalse) {
    MemoryStudioEngine engine;
    StudioSession session{std::string{workspace}};
    const auto view = minimal_view(std::string{workspace});
    require_ok(engine.observe(session, view));
    const auto summary =
        engine.summarize(session, StudioQuery{std::string{workspace}});
    expect_success(summary);
    EXPECT_EQ(summary.observations(),
              (std::vector<std::string>{
                  "Memory.entries=0", "WorkingMemory.active=false",
                  "WorkingMemory.entries=0", "LongTermMemory.entries=0",
                  "LongTermMemory.archived=0",
                  "SemanticMemory.concepts=0", "EpisodicMemory.episodes=0",
                  "ProceduralMemory.procedures=0", "Retrieval.sessions=0",
                  "Retrieval.sessions.Ready=0",
                  "Retrieval.sessions.Started=0",
                  "Retrieval.sessions.Forgotten=0",
                  "Retrieval.candidates=0", "Consolidation.sessions=0",
                  "Consolidation.sessions.Pristine=0",
                  "Consolidation.sessions.Analyzed=0",
                  "Consolidation.sessions.Promoted=0",
                  "Consolidation.sessions.Retained=0",
                  "Consolidation.sessions.Forgotten=0",
                  "Consolidation.candidates=0", "Reflection.values=0",
                  "Reflection.sessions=0",
                  "Reflection.sessions.Pristine=0",
                  "Reflection.sessions.Prepared=0",
                  "Reflection.sessions.Derived=0",
                  "Reflection.sessions.Forgotten=0",
                  "Reflection.sources=0", "Providers.sessions=0",
                  "Providers.sessions.Open=0",
                  "Providers.sessions.Exported=0",
                  "Providers.sessions.Imported=0",
                  "Providers.sessions.Forgotten=0",
                  "Providers.descriptors=0"}));
}

class GroupedPunctuation final : public std::numpunct<char> {
  protected:
    char do_thousands_sep() const override { return ','; }
    std::string do_grouping() const override { return "\1"; }
    std::string do_truename() const override { return "YES"; }
    std::string do_falsename() const override { return "NO"; }
};

class LocaleGuard final {
  public:
    LocaleGuard() : previous_{std::locale()} {}
    ~LocaleGuard() { std::locale::global(previous_); }
    LocaleGuard(const LocaleGuard&) = delete;
    LocaleGuard& operator=(const LocaleGuard&) = delete;

  private:
    std::locale previous_;
};

TEST(MemoryStudioSummaryTest, FormattingIsLocaleIndependentAscii) {
    Fixture fixture;
    MemoryStudioEngine engine;
    StudioSession session{std::string{workspace}};
    const auto view = fixture.view();
    require_ok(engine.observe(session, view));
    const StudioQuery query{std::string{workspace}};
    const auto baseline = engine.summarize(session, query).observations();

    LocaleGuard guard;
    std::locale::global(
        std::locale{std::locale::classic(), new GroupedPunctuation});
    const auto under_custom_locale = engine.summarize(session, query);
    expect_success(under_custom_locale);
    EXPECT_EQ(under_custom_locale.observations(), baseline);
    for (const auto& line : under_custom_locale.observations()) {
        EXPECT_EQ(line.find(','), std::string::npos);
        EXPECT_EQ(line.find("YES"), std::string::npos);
        EXPECT_EQ(line.find("NO"), std::string::npos);
    }
}

TEST(MemoryStudioWorkspaceTest, AggregateAndOuterWorkspaceBoundariesAreClosed) {
    const std::string good{workspace};
    const std::string bad{"other-workspace"};
    Memory good_memory{good};
    WorkingMemory good_working{good};
    LongTermMemory good_long{good};
    SemanticMemory good_semantic{good};
    EpisodicMemory good_episodic{good};
    ProceduralMemory good_procedural{good};
    Memory bad_memory{bad};
    WorkingMemory bad_working{bad};
    LongTermMemory bad_long{bad};
    SemanticMemory bad_semantic{bad};
    EpisodicMemory bad_episodic{bad};
    ProceduralMemory bad_procedural{bad};
    MemoryStudioEngine engine;

    const auto expect_mismatch = [&](const StudioView& view) {
        StudioSession session{good};
        expect_failure(engine.observe(session, view), "WORKSPACE_MISMATCH", good);
        EXPECT_EQ(session.state(), StudioState::Open);
        EXPECT_EQ(session.view(), nullptr);
    };
    expect_mismatch(StudioView{good, bad_memory, good_working, good_long,
                               good_semantic, good_episodic, good_procedural});
    expect_mismatch(StudioView{good, good_memory, bad_working, good_long,
                               good_semantic, good_episodic, good_procedural});
    expect_mismatch(StudioView{good, good_memory, good_working, bad_long,
                               good_semantic, good_episodic, good_procedural});
    expect_mismatch(StudioView{good, good_memory, good_working, good_long,
                               bad_semantic, good_episodic, good_procedural});
    expect_mismatch(StudioView{good, good_memory, good_working, good_long,
                               good_semantic, bad_episodic, good_procedural});
    expect_mismatch(StudioView{good, good_memory, good_working, good_long,
                               good_semantic, good_episodic, bad_procedural});

    expect_mismatch(StudioView{
        good, good_memory, good_working, good_long, good_semantic,
        good_episodic, good_procedural,
        std::vector<RetrievalSession>{RetrievalSession{bad}}});
    expect_mismatch(StudioView{
        good, good_memory, good_working, good_long, good_semantic,
        good_episodic, good_procedural, {},
        std::vector<ConsolidationSession>{ConsolidationSession{bad}}});

    Fixture foreign{bad};
    expect_mismatch(StudioView{good,
                               good_memory,
                               good_working,
                               good_long,
                               good_semantic,
                               good_episodic,
                               good_procedural,
                               {},
                               {},
                               foreign.reflections});
    expect_mismatch(StudioView{good,
                               good_memory,
                               good_working,
                               good_long,
                               good_semantic,
                               good_episodic,
                               good_procedural,
                               {},
                               {},
                               {},
                               std::vector<ReflectionSession>{
                                   ReflectionSession{bad}}});
    expect_mismatch(StudioView{good,
                               good_memory,
                               good_working,
                               good_long,
                               good_semantic,
                               good_episodic,
                               good_procedural,
                               {},
                               {},
                               {},
                               {},
                               std::vector<ProviderSession>{
                                   ProviderSession{bad}}});
}

TEST(MemoryStudioPrecedenceTest, ObserveAndQueryValidationOrderIsExact) {
    MemoryStudioEngine engine;
    Fixture fixture;
    auto view = fixture.view();
    StudioSession session{std::string{workspace}};
    const auto invalid_scope = static_cast<Scope>(77);

    expect_failure(engine.trace(
                       session,
                       StudioQuery{"other-workspace", invalid_scope,
                                   "missing"}),
                   "SESSION_NOT_OBSERVED");
    expect_failure(engine.summarize(
                       session,
                       StudioQuery{"other-workspace", invalid_scope,
                                   "missing"}),
                   "SESSION_NOT_OBSERVED");

    auto moved_target = minimal_view(std::string{workspace});
    StudioView invalid{std::move(moved_target)};
    static_cast<void>(invalid);
    expect_failure(engine.observe(session, moved_target), "INVALID_VIEW");

    auto foreign = minimal_view("other-workspace");
    StudioView foreign_invalid{std::move(foreign)};
    static_cast<void>(foreign_invalid);
    expect_failure(engine.observe(session, foreign), "WORKSPACE_MISMATCH");

    require_ok(engine.observe(session, view));
    const auto before = snapshot_of(session);
    expect_failure(engine.inspect(
                       session, StudioQuery{"other-workspace", invalid_scope}),
                   "WORKSPACE_MISMATCH");
    expect_failure(engine.trace(
                       session,
                       StudioQuery{"other-workspace", invalid_scope,
                                   "missing"}),
                   "WORKSPACE_MISMATCH");
    expect_failure(engine.summarize(
                       session,
                       StudioQuery{"other-workspace", invalid_scope,
                                   "missing"}),
                   "WORKSPACE_MISMATCH");
    expect_failure(engine.inspect(
                       session,
                       StudioQuery{std::string{workspace}, invalid_scope}),
                   "INVALID_QUERY");
    expect_failure(engine.trace(
                       session,
                       StudioQuery{std::string{workspace}, Scope::Memory,
                                   "missing"}),
                   "INVALID_QUERY");
    expect_failure(engine.summarize(
                       session,
                       StudioQuery{std::string{workspace}, Scope::Complete,
                                   "missing"}),
                   "INVALID_QUERY");
    expect_failure(engine.inspect(
                       session,
                       StudioQuery{std::string{workspace}, Scope::Memory,
                                   "missing"}),
                   "NOT_FOUND");
    EXPECT_EQ(snapshot_of(session), before);

    require_ok(engine.forgetSession(session));
    expect_failure(engine.inspect(
                       session, StudioQuery{"other-workspace", invalid_scope,
                                            "missing"}),
                   "SESSION_FORGOTTEN");
    expect_failure(engine.trace(
                       session,
                       StudioQuery{"other-workspace", invalid_scope,
                                   "missing"}),
                   "SESSION_FORGOTTEN");
    expect_failure(engine.summarize(
                       session,
                       StudioQuery{"other-workspace", invalid_scope,
                                   "missing"}),
                   "SESSION_FORGOTTEN");
    expect_failure(engine.observe(session, foreign), "SESSION_FORGOTTEN");
    expect_failure(engine.exportView(session), "SESSION_FORGOTTEN");
}

TEST(MemoryStudioResultTest, MoveOnlyOutcomesHaveExactMovedFromShape) {
    Fixture fixture;
    MemoryStudioEngine engine;
    const auto view = fixture.view();
    StudioSession session{std::string{workspace}};
    require_ok(engine.observe(session, view));
    const StudioQuery query{std::string{workspace}, Scope::Memory};

    auto source = engine.inspect(session, query);
    const auto expected_observations = source.observations();
    StudioResult moved{std::move(source)};
    expect_success(moved);
    EXPECT_EQ(moved.observations(), expected_observations);
    EXPECT_TRUE(source.workspaceIdentifier().empty());
    EXPECT_FALSE(source.succeeded());
    EXPECT_TRUE(source.code().empty());
    EXPECT_TRUE(source.message().empty());
    EXPECT_EQ(source.view(), nullptr);
    EXPECT_TRUE(source.observations().empty());
    EXPECT_TRUE(source.explanationChains().empty());

    auto assignment_source = engine.trace(
        session, StudioQuery{std::string{workspace}, Scope::Retrieval});
    const auto expected_chains = assignment_source.explanationChains();
    auto assignment_target = engine.summarize(session, query);
    assignment_target = std::move(assignment_source);
    expect_success(assignment_target);
    EXPECT_EQ(assignment_target.explanationChains(), expected_chains);
    EXPECT_TRUE(assignment_source.workspaceIdentifier().empty());
    EXPECT_FALSE(assignment_source.succeeded());
    EXPECT_TRUE(assignment_source.code().empty());
    EXPECT_TRUE(assignment_source.message().empty());
    EXPECT_EQ(assignment_source.view(), nullptr);
    EXPECT_TRUE(assignment_source.observations().empty());
    EXPECT_TRUE(assignment_source.explanationChains().empty());
}

TEST(MemoryStudioIsolationTest, SourcesSessionsAndPriorResultsRemainIndependent) {
    Fixture fixture;
    MemoryStudioEngine engine;
    const auto source_before = snapshot_of(fixture.view());
    const auto view = fixture.view();
    StudioSession session{std::string{workspace}};
    auto observed = engine.observe(session, view);
    require_ok(observed);
    ASSERT_NE(observed.view(), nullptr);
    const auto result_before = snapshot_of(*observed.view());

    const auto inspect_before = snapshot_of(session);
    require_ok(engine.inspect(
        session, StudioQuery{std::string{workspace}, Scope::Complete}));
    require_ok(engine.trace(
        session, StudioQuery{std::string{workspace}, Scope::Complete}));
    require_ok(engine.summarize(
        session, StudioQuery{std::string{workspace}, Scope::Complete}));
    require_ok(engine.exportView(session));
    EXPECT_EQ(snapshot_of(session), inspect_before);
    EXPECT_EQ(snapshot_of(fixture.view()), source_before);

    const auto replacement = minimal_view(std::string{workspace});
    require_ok(engine.observe(session, replacement));
    EXPECT_EQ(snapshot_of(*observed.view()), result_before);
    EXPECT_NE(snapshot_of(*session.view()), result_before);
    require_ok(engine.forgetSession(session));
    EXPECT_EQ(snapshot_of(*observed.view()), result_before);
}

TEST(MemoryStudioFailureTest, SemanticFailuresPreserveCompleteSessionState) {
    Fixture fixture;
    MemoryStudioEngine engine;
    const auto view = fixture.view();
    StudioSession session{std::string{workspace}};
    require_ok(engine.observe(session, view));
    const auto before = snapshot_of(session);

    expect_failure(engine.observe(session, minimal_view("other-workspace")),
                   "WORKSPACE_MISMATCH");
    expect_failure(engine.inspect(
                       session,
                       StudioQuery{std::string{workspace}, Scope::Memory,
                                   "absent"}),
                   "NOT_FOUND");
    expect_failure(engine.trace(
                       session,
                       StudioQuery{std::string{workspace}, Scope::Providers}),
                   "INVALID_QUERY");
    expect_failure(engine.summarize(
                       session,
                       StudioQuery{std::string{workspace}, Scope::Complete,
                                   "not-empty"}),
                   "INVALID_QUERY");
    EXPECT_EQ(snapshot_of(session), before);
    EXPECT_EQ(snapshot_of(view), snapshot_of(fixture.view()));
}

TEST(MemoryStudioDeterminismTest, EquivalentHistoriesProduceEquivalentOutcomes) {
    Fixture first_fixture;
    Fixture second_fixture;
    const auto first_view = first_fixture.view();
    const auto second_view = second_fixture.view();
    EXPECT_EQ(snapshot_of(first_view), snapshot_of(second_view));

    MemoryStudioEngine first_engine;
    MemoryStudioEngine second_engine;
    StudioSession first_session{std::string{workspace}};
    StudioSession second_session{std::string{workspace}};
    require_ok(first_engine.observe(first_session, first_view));
    require_ok(second_engine.observe(second_session, second_view));
    const StudioQuery query{std::string{workspace}};
    EXPECT_EQ(first_engine.inspect(first_session, query).observations(),
              second_engine.inspect(second_session, query).observations());
    EXPECT_EQ(first_engine.trace(first_session, query).explanationChains(),
              second_engine.trace(second_session, query).explanationChains());
    EXPECT_EQ(first_engine.summarize(first_session, query).observations(),
              second_engine.summarize(second_session, query).observations());
}

TEST(MemoryStudioConcurrencyTest, IndependentAndConstObservationsAreRaceFree) {
    Fixture fixture;
    MemoryStudioEngine engine;
    const auto view = fixture.view();
    StudioSession first{std::string{workspace}};
    StudioSession second{std::string{workspace}};
    require_ok(engine.observe(first, view));
    require_ok(engine.observe(second, view));
    const auto before = snapshot_of(first);

    auto inspect_task = std::async(std::launch::async, [&engine, &first] {
        return engine.inspect(
            first, StudioQuery{std::string{workspace}, Scope::Complete});
    });
    auto trace_task = std::async(std::launch::async, [&engine, &first] {
        return engine.trace(
            first, StudioQuery{std::string{workspace}, Scope::Complete});
    });
    auto summary_task = std::async(std::launch::async, [&engine, &second] {
        return engine.summarize(
            second, StudioQuery{std::string{workspace}, Scope::Complete});
    });
    const auto inspected = inspect_task.get();
    const auto traced = trace_task.get();
    const auto summarized = summary_task.get();
    expect_success(inspected);
    expect_success(traced);
    expect_success(summarized);
    EXPECT_EQ(snapshot_of(first), before);
    EXPECT_EQ(inspected.observations(), empty_paths_for(*inspected.view(),
                                                        Scope::Complete));
}

TEST(MemoryStudioBoundaryTest, EngineLifetimeAndProviderIdentityDoNotOwnState) {
    Fixture fixture;
    StudioSession session{std::string{workspace}};
    const auto view = fixture.view();
    Tokens expected;
    {
        MemoryStudioEngine transient;
        auto result = transient.observe(session, view);
        require_ok(result);
        expected = snapshot_of(*result.view());
    }
    ASSERT_NE(session.view(), nullptr);
    EXPECT_EQ(snapshot_of(*session.view()), expected);
    MemoryStudioEngine replacement;
    const auto exported = replacement.exportView(session);
    expect_success(exported);
    ASSERT_NE(exported.view(), nullptr);
    EXPECT_EQ(snapshot_of(*exported.view()), expected);
}

} // namespace
