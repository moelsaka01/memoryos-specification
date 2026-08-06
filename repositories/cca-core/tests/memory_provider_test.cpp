#include <cca/memory/memory_provider.hpp>

#include <gtest/gtest.h>

#include <algorithm>
#include <cstddef>
#include <cstdint>
#include <future>
#include <optional>
#include <stdexcept>
#include <string>
#include <string_view>
#include <type_traits>
#include <utility>
#include <vector>

/*
Primary CCA-PROVIDERS-1.0 conformance map:

CCA-PROVIDERS-003, 004: MemoryProviderApiTest.PublicDeclarationsMatchContract
CCA-PROVIDERS-006--010, 031:
    MemoryProviderValueTest.ConstructionCopyMoveAndObservationAreExact
    MemoryProviderValueTest.AssignmentsAndAccessorLifetimesAreExact
    MemoryProviderValueTest.CompletedSessionMovesResetSourcesToOpen
CCA-PROVIDERS-011, 020, 021, 025:
    MemoryProviderRegistrationTest.RegistryIsCallerOwnedOrderedAndIdempotent
CCA-PROVIDERS-009, 022--026:
    MemoryProviderLifecycleTest.AllStatesOperationsAndPayloadsAreExact
CCA-PROVIDERS-012--016:
    MemoryProviderFidelityTest.AuthenticStateProvenanceIdentityAndOrderAreExact
    MemoryProviderFidelityTest.ValidEmptyValuesSurviveDetachedTransport
CCA-PROVIDERS-013:
    MemoryProviderFidelityTest.HiddenForgottenIdentityHistorySurvivesTransport
CCA-PROVIDERS-017:
    MemoryProviderWorkspaceTest.EveryTransportedWorkspaceBoundaryIsEnforced
    MemoryProviderWorkspaceTest.MovedFromValuesAreRejectedAtWorkspaceBoundary
CCA-PROVIDERS-028, 029:
    MemoryProviderResultTest.ClosedCodesMessagesWorkspacesAndPayloadsAreExact
CCA-PROVIDERS-030:
    MemoryProviderPrecedenceTest.LifecycleIdentityAndRegistrationOrderIsExact
    MemoryProviderPrecedenceTest.ImportAggregateAndReflectionEdgesAreExact
CCA-PROVIDERS-032, 035, 036:
    MemoryProviderIsolationTest.SuccessAndSemanticFailureDoNotModifySources
    MemoryProviderIsolationTest.DetachedRequestsOutliveAndIgnoreEverySource
CCA-PROVIDERS-033:
    MemoryProviderDeterminismTest.EquivalentHistoriesAreCompletelyEqual
CCA-PROVIDERS-034:
    MemoryProviderConcurrencyTest.IndependentValuesSupportConcurrentUse
    MemoryProviderConcurrencyTest.DistinctTransportsUseSourcesConcurrently

CCA-PROVIDERS-001, 002, 005, 018, 019, 027, and 037--042 are completed by
the dedicated architecture audit. CCA-PROVIDERS-032 allocation exceptions are
completed by the dedicated allocation-failure executable. CCA-PROVIDERS-043
through 045 are completed by documentation, example, traceability, and build
evidence.
*/

namespace {

using cca::memory::Episode;
using cca::memory::EpisodicMemory;
using cca::memory::EpisodicMemoryEngine;
using cca::memory::KnowledgeCandidate;
using cca::memory::KnowledgeQuery;
using cca::memory::LongTermMemory;
using cca::memory::LongTermMemoryEngine;
using cca::memory::LongTermMemoryEntry;
using cca::memory::Memory;
using cca::memory::MemoryEngine;
using cca::memory::MemoryEntry;
using cca::memory::MemoryProviderEngine;
using cca::memory::MemoryReflectionEngine;
using cca::memory::MemoryRetrievalEngine;
using cca::memory::Procedure;
using cca::memory::ProceduralMemory;
using cca::memory::ProceduralMemoryEngine;
using cca::memory::ProviderDescriptor;
using cca::memory::ProviderRequest;
using cca::memory::ProviderResult;
using cca::memory::ProviderSession;
using cca::memory::Reflection;
using cca::memory::ReflectionQuery;
using cca::memory::ReflectionSession;
using cca::memory::RetrievalSession;
using cca::memory::SemanticConcept;
using cca::memory::SemanticMemory;
using cca::memory::SemanticMemoryEngine;
using cca::memory::WorkingMemory;
using cca::memory::WorkingMemoryEngine;
using cca::memory::WorkingMemoryEntry;

using Kind = KnowledgeCandidate::Kind;
using State = ProviderSession::State;

constexpr std::string_view workspace{"provider-workspace"};
constexpr std::string_view provider_a{"provider-a"};
constexpr std::string_view provider_b{"Provider-B"};

template <typename Result>
void require_ok(const Result& result) {
    if (!result.succeeded()) {
        throw std::logic_error{result.code() + ": " + result.message()};
    }
}

struct EntrySnapshot final {
    std::string identifier;
    std::string value;
    bool archived{};
    bool operator==(const EntrySnapshot&) const = default;
};

struct MemorySnapshot final {
    std::string workspace_identifier;
    std::vector<std::pair<std::string, std::string>> entries;
    bool operator==(const MemorySnapshot&) const = default;
};

struct WorkingEntrySnapshot final {
    std::string identifier;
    std::string value;
    std::optional<std::uint64_t> expiration_point;
    bool operator==(const WorkingEntrySnapshot&) const = default;
};

struct WorkingSnapshot final {
    std::string workspace_identifier;
    bool active{};
    std::optional<std::string> active_task;
    std::vector<WorkingEntrySnapshot> entries;
    bool operator==(const WorkingSnapshot&) const = default;
};

struct LongTermSnapshot final {
    std::string workspace_identifier;
    std::vector<EntrySnapshot> entries;
    bool operator==(const LongTermSnapshot&) const = default;
};

struct SemanticSnapshot final {
    std::string identifier;
    std::string meaning;
    std::vector<EntrySnapshot> sources;
    std::vector<std::string> categories;
    std::vector<std::string> links;
    bool operator==(const SemanticSnapshot&) const = default;
};

struct SemanticMemorySnapshot final {
    std::string workspace_identifier;
    std::vector<SemanticSnapshot> concepts;
    bool operator==(const SemanticMemorySnapshot&) const = default;
};

struct EpisodeSnapshot final {
    std::string identifier;
    std::string occurrence;
    std::string context;
    std::int64_t chronology{};
    std::vector<EntrySnapshot> sources;
    std::vector<std::string> links;
    bool operator==(const EpisodeSnapshot&) const = default;
};

struct EpisodicMemorySnapshot final {
    std::string workspace_identifier;
    std::vector<EpisodeSnapshot> episodes;
    bool operator==(const EpisodicMemorySnapshot&) const = default;
};

struct ProcedureSnapshot final {
    std::string identifier;
    std::string activity;
    std::vector<std::string> steps;
    std::vector<EntrySnapshot> sources;
    std::vector<std::string> links;
    bool operator==(const ProcedureSnapshot&) const = default;
};

struct ProceduralMemorySnapshot final {
    std::string workspace_identifier;
    std::vector<ProcedureSnapshot> procedures;
    bool operator==(const ProceduralMemorySnapshot&) const = default;
};

struct CandidateSnapshot final {
    Kind kind{Kind::Semantic};
    std::string workspace_identifier;
    std::string source_identifier;
    std::uint32_t rank_score{};
    std::optional<SemanticSnapshot> semantic;
    std::optional<EpisodeSnapshot> episode;
    std::optional<ProcedureSnapshot> procedure;
    bool operator==(const CandidateSnapshot&) const = default;
};

struct ReflectionSnapshot final {
    std::string workspace_identifier;
    std::string identifier;
    std::string knowledge;
    std::vector<CandidateSnapshot> candidates;
    std::vector<std::vector<std::string>> explanation_chains;
    bool operator==(const ReflectionSnapshot&) const = default;
};

struct RequestSnapshot final {
    std::string workspace_identifier;
    std::string provider_identifier;
    std::optional<MemorySnapshot> memory;
    std::optional<WorkingSnapshot> working;
    std::optional<LongTermSnapshot> long_term;
    std::optional<SemanticMemorySnapshot> semantic;
    std::optional<EpisodicMemorySnapshot> episodic;
    std::optional<ProceduralMemorySnapshot> procedural;
    std::vector<ReflectionSnapshot> reflections;
    bool operator==(const RequestSnapshot&) const = default;
};

struct SessionSnapshot final {
    std::string workspace_identifier;
    State state{State::Open};
    std::vector<std::pair<std::string, std::string>> descriptors;
    bool operator==(const SessionSnapshot&) const = default;
};

struct ResultSnapshot final {
    std::string workspace_identifier;
    bool succeeded{};
    std::string code;
    std::string message;
    std::optional<RequestSnapshot> request;
    std::vector<std::pair<std::string, std::string>> descriptors;
    bool operator==(const ResultSnapshot&) const = default;
};

[[nodiscard]] EntrySnapshot snapshot_of(const LongTermMemoryEntry& value) {
    return {value.identifier(), value.value(), value.archived()};
}

template <typename Value, typename Snapshot>
[[nodiscard]] std::vector<Snapshot> snapshot_vector(
    const std::vector<Value>& values,
    Snapshot (*snapshot)(const Value&)) {
    std::vector<Snapshot> result;
    result.reserve(values.size());
    for (const auto& value : values) {
        result.push_back(snapshot(value));
    }
    return result;
}

[[nodiscard]] std::vector<EntrySnapshot> snapshot_entries(
    const std::vector<LongTermMemoryEntry>& values) {
    return snapshot_vector<LongTermMemoryEntry, EntrySnapshot>(values,
                                                               snapshot_of);
}

[[nodiscard]] MemorySnapshot snapshot_of(const Memory& value) {
    MemorySnapshot result{value.workspaceIdentifier(), {}};
    result.entries.reserve(value.entries().size());
    for (const auto& entry : value.entries()) {
        result.entries.emplace_back(entry.identifier(), entry.value());
    }
    return result;
}

[[nodiscard]] WorkingSnapshot snapshot_of(const WorkingMemory& value) {
    WorkingSnapshot result{value.workspaceIdentifier(), value.active(),
                           value.activeTaskIdentifier(), {}};
    result.entries.reserve(value.entries().size());
    for (const auto& entry : value.entries()) {
        result.entries.push_back(
            {entry.identifier(), entry.value(), entry.expirationPoint()});
    }
    return result;
}

[[nodiscard]] LongTermSnapshot snapshot_of(const LongTermMemory& value) {
    return {value.workspaceIdentifier(), snapshot_entries(value.entries())};
}

[[nodiscard]] SemanticSnapshot snapshot_of(const SemanticConcept& value) {
    return {value.identifier(), value.meaning(),
            snapshot_entries(value.sourceEntries()), value.categories(),
            value.linkedConceptIdentifiers()};
}

[[nodiscard]] SemanticMemorySnapshot snapshot_of(const SemanticMemory& value) {
    return {value.workspaceIdentifier(),
            snapshot_vector<SemanticConcept, SemanticSnapshot>(
                value.concepts(), snapshot_of)};
}

[[nodiscard]] EpisodeSnapshot snapshot_of(const Episode& value) {
    return {value.identifier(), value.occurrence(), value.context(),
            value.chronology(), snapshot_entries(value.sourceEntries()),
            value.linkedEpisodeIdentifiers()};
}

[[nodiscard]] EpisodicMemorySnapshot snapshot_of(const EpisodicMemory& value) {
    return {value.workspaceIdentifier(),
            snapshot_vector<Episode, EpisodeSnapshot>(value.episodes(),
                                                       snapshot_of)};
}

[[nodiscard]] ProcedureSnapshot snapshot_of(const Procedure& value) {
    return {value.identifier(), value.activity(), value.steps(),
            snapshot_entries(value.sourceEntries()),
            value.linkedProcedureIdentifiers()};
}

[[nodiscard]] ProceduralMemorySnapshot snapshot_of(
    const ProceduralMemory& value) {
    return {value.workspaceIdentifier(),
            snapshot_vector<Procedure, ProcedureSnapshot>(
                value.procedures(), snapshot_of)};
}

[[nodiscard]] CandidateSnapshot snapshot_of(const KnowledgeCandidate& value) {
    CandidateSnapshot result;
    result.kind = value.kind();
    result.workspace_identifier = value.workspaceIdentifier();
    result.source_identifier = value.sourceIdentifier();
    result.rank_score = value.rankScore();
    if (value.semanticConcept() != nullptr) {
        result.semantic = snapshot_of(*value.semanticConcept());
    }
    if (value.episode() != nullptr) {
        result.episode = snapshot_of(*value.episode());
    }
    if (value.procedure() != nullptr) {
        result.procedure = snapshot_of(*value.procedure());
    }
    return result;
}

[[nodiscard]] ReflectionSnapshot snapshot_of(const Reflection& value) {
    return {value.workspaceIdentifier(), value.identifier(), value.knowledge(),
            snapshot_vector<KnowledgeCandidate, CandidateSnapshot>(
                value.sourceCandidates(), snapshot_of),
            value.sourceExplanationChains()};
}

[[nodiscard]] RequestSnapshot snapshot_of(const ProviderRequest& value) {
    RequestSnapshot result;
    result.workspace_identifier = value.workspaceIdentifier();
    result.provider_identifier = value.providerIdentifier();
    if (value.memory() != nullptr) {
        result.memory = snapshot_of(*value.memory());
    }
    if (value.workingMemory() != nullptr) {
        result.working = snapshot_of(*value.workingMemory());
    }
    if (value.longTermMemory() != nullptr) {
        result.long_term = snapshot_of(*value.longTermMemory());
    }
    if (value.semanticMemory() != nullptr) {
        result.semantic = snapshot_of(*value.semanticMemory());
    }
    if (value.episodicMemory() != nullptr) {
        result.episodic = snapshot_of(*value.episodicMemory());
    }
    if (value.proceduralMemory() != nullptr) {
        result.procedural = snapshot_of(*value.proceduralMemory());
    }
    result.reflections = snapshot_vector<Reflection, ReflectionSnapshot>(
        value.reflections(), snapshot_of);
    return result;
}

[[nodiscard]] SessionSnapshot snapshot_of(const ProviderSession& value) {
    SessionSnapshot result{value.workspaceIdentifier(), value.state(), {}};
    result.descriptors.reserve(value.descriptors().size());
    for (const auto& descriptor : value.descriptors()) {
        result.descriptors.emplace_back(descriptor.workspaceIdentifier(),
                                        descriptor.identifier());
    }
    return result;
}

[[nodiscard]] ResultSnapshot snapshot_of(const ProviderResult& value) {
    ResultSnapshot result;
    result.workspace_identifier = value.workspaceIdentifier();
    result.succeeded = value.succeeded();
    result.code = value.code();
    result.message = value.message();
    if (value.request() != nullptr) {
        result.request = snapshot_of(*value.request());
    }
    for (const auto& descriptor : value.descriptors()) {
        result.descriptors.emplace_back(descriptor.workspaceIdentifier(),
                                        descriptor.identifier());
    }
    return result;
}

void expect_ok(const ProviderResult& result) {
    EXPECT_TRUE(result.succeeded()) << result.code() << ": " << result.message();
    EXPECT_EQ(result.code(), "OK");
    EXPECT_TRUE(result.message().empty());
}

void expect_failure(const ProviderResult& result,
                    const std::string_view workspace_identifier,
                    const std::string_view code) {
    EXPECT_EQ(result.workspaceIdentifier(), workspace_identifier);
    EXPECT_FALSE(result.succeeded());
    EXPECT_EQ(result.code(), code);
    EXPECT_FALSE(result.message().empty());
    EXPECT_EQ(result.request(), nullptr);
    EXPECT_TRUE(result.descriptors().empty());
}

void expect_equivalent_failures(const ProviderResult& first,
                                const ProviderResult& second,
                                const std::string_view code) {
    expect_failure(first, workspace, code);
    expect_failure(second, workspace, code);
    EXPECT_EQ(snapshot_of(first), snapshot_of(second));
}

void expect_no_payload(const ProviderResult& result) {
    EXPECT_EQ(result.request(), nullptr);
    EXPECT_TRUE(result.descriptors().empty());
}

class AuthenticState final {
  private:
    std::string workspace_identifier_;

  public:
    explicit AuthenticState(std::string workspace_identifier)
        : workspace_identifier_{std::move(workspace_identifier)},
          memory{workspace_identifier_}, working{workspace_identifier_},
          long_term{workspace_identifier_}, semantic{workspace_identifier_},
          episodic{workspace_identifier_}, procedural{workspace_identifier_} {
        populate_base_state();
        build_reflection("reflection-a", "Explicit reflected knowledge A");
        build_reflection("reflection-b", "Explicit reflected knowledge B");
    }

    [[nodiscard]] ProviderRequest request(
        std::string provider_identifier = std::string{provider_a}) const {
        return ProviderRequest{workspace_identifier_,
                               std::move(provider_identifier),
                               memory,
                               working,
                               long_term,
                               semantic,
                               episodic,
                               procedural,
                               reflections};
    }

    [[nodiscard]] const std::string& workspaceIdentifier() const noexcept {
        return workspace_identifier_;
    }

    Memory memory;
    WorkingMemory working;
    LongTermMemory long_term;
    SemanticMemory semantic;
    EpisodicMemory episodic;
    ProceduralMemory procedural;
    std::vector<Reflection> reflections;

  private:
    [[nodiscard]] const LongTermMemoryEntry& evidence(
        const std::string_view identifier) const {
        const auto* const entry = long_term.find(identifier);
        if (entry == nullptr) {
            throw std::logic_error{"fixture evidence is absent"};
        }
        return *entry;
    }

    void retain(std::string identifier, std::string value) {
        require_ok(LongTermMemoryEngine{}.retain(
            long_term,
            LongTermMemoryEntry{std::move(identifier), std::move(value)}));
    }

    void populate_base_state() {
        require_ok(MemoryEngine{}.store(
            memory, MemoryEntry{"memory-b", "memory value b"}));
        require_ok(MemoryEngine{}.store(
            memory, MemoryEntry{"memory-a", "memory value a"}));
        require_ok(MemoryEngine{}.store(
            memory, MemoryEntry{"memory-b", "memory replacement b"}));

        require_ok(WorkingMemoryEngine{}.activate(working, "task-main"));
        require_ok(WorkingMemoryEngine{}.store(
            working, WorkingMemoryEntry{"working-b", "working value b", 70U}));
        require_ok(WorkingMemoryEngine{}.store(
            working, WorkingMemoryEntry{"working-a", "working value a"}));
        require_ok(WorkingMemoryEngine{}.store(
            working,
            WorkingMemoryEntry{"working-b", "working replacement b", 90U}));

        retain("evidence-a", "Evidence A");
        retain("evidence-b", "Evidence B");
        retain("evidence-c", "Evidence C");
        retain("archived-evidence", "Archived evidence");
        require_ok(LongTermMemoryEngine{}.archive(long_term,
                                                   "archived-evidence"));
        retain("forgotten-evidence", "Forgotten evidence");
        require_ok(LongTermMemoryEngine{}.forget(long_term,
                                                  "forgotten-evidence"));

        require_ok(SemanticMemoryEngine{}.classify(
            semantic, long_term,
            SemanticConcept{"semantic-a", "Meaning A",
                            {evidence("evidence-a"), evidence("evidence-b")}}));
        require_ok(SemanticMemoryEngine{}.classify(
            semantic, long_term,
            SemanticConcept{"semantic-b", "Meaning B",
                            {evidence("evidence-c")}}));
        require_ok(SemanticMemoryEngine{}.categorize(semantic, "semantic-a",
                                                      "category-a"));
        require_ok(SemanticMemoryEngine{}.categorize(semantic, "semantic-a",
                                                      "category-b"));
        require_ok(SemanticMemoryEngine{}.link(semantic, "semantic-a",
                                                "semantic-b"));
        require_ok(SemanticMemoryEngine{}.classify(
            semantic, long_term,
            SemanticConcept{"forgotten-semantic", "Forgotten meaning",
                            {evidence("evidence-a")}}));
        require_ok(SemanticMemoryEngine{}.forget(semantic,
                                                  "forgotten-semantic"));

        require_ok(EpisodicMemoryEngine{}.derive(
            episodic, long_term,
            Episode{"episode-a", "Occurrence A", "Context A", 10,
                    {evidence("evidence-a")}}));
        require_ok(EpisodicMemoryEngine{}.derive(
            episodic, long_term,
            Episode{"episode-b", "Occurrence B", "Context B", 10,
                    {evidence("evidence-b"), evidence("evidence-c")}}));
        require_ok(EpisodicMemoryEngine{}.link(episodic, "episode-a",
                                                "episode-b"));
        require_ok(EpisodicMemoryEngine{}.derive(
            episodic, long_term,
            Episode{"forgotten-episode", "Forgotten occurrence",
                    "Forgotten context", 20, {evidence("evidence-a")}}));
        require_ok(EpisodicMemoryEngine{}.forget(episodic,
                                                  "forgotten-episode"));

        require_ok(ProceduralMemoryEngine{}.derive(
            procedural, long_term,
            Procedure{"procedure-a", "Activity A",
                      {"step-a", "step-a", "step-b"},
                      {evidence("evidence-c")}}));
        require_ok(ProceduralMemoryEngine{}.compose(
            procedural, long_term,
            Procedure{"procedure-b", "Activity B", {"step-c"},
                      {evidence("evidence-a"), evidence("evidence-b")}}));
        require_ok(ProceduralMemoryEngine{}.link(procedural, "procedure-a",
                                                  "procedure-b"));
        require_ok(ProceduralMemoryEngine{}.derive(
            procedural, long_term,
            Procedure{"forgotten-procedure", "Forgotten activity", {"step"},
                      {evidence("evidence-a")}}));
        require_ok(ProceduralMemoryEngine{}.forget(procedural,
                                                    "forgotten-procedure"));
    }

    void build_reflection(std::string identifier, std::string knowledge) {
        RetrievalSession retrieval{workspace_identifier_};
        require_ok(MemoryRetrievalEngine{}.search(
            retrieval, semantic, episodic, procedural, KnowledgeQuery{""}));
        require_ok(MemoryRetrievalEngine{}.rank(retrieval));

        ReflectionSession reflection_session{workspace_identifier_};
        ReflectionQuery query{workspace_identifier_, std::move(identifier),
                              std::move(knowledge)};
        require_ok(MemoryReflectionEngine{}.reflect(reflection_session, query,
                                                     retrieval));
        auto derived = MemoryReflectionEngine{}.derive(
            reflection_session, semantic, episodic, procedural);
        require_ok(derived);
        if (derived.reflection() == nullptr) {
            throw std::logic_error{"fixture reflection payload is absent"};
        }
        reflections.push_back(*derived.reflection());
    }

};

[[nodiscard]] ProviderRequest request_with(
    const AuthenticState& source,
    const std::string& request_workspace,
    std::string provider_identifier,
    const Memory& memory,
    const WorkingMemory& working,
    const LongTermMemory& long_term,
    const SemanticMemory& semantic,
    const EpisodicMemory& episodic,
    const ProceduralMemory& procedural,
    std::vector<Reflection> reflections) {
    static_cast<void>(source);
    return ProviderRequest{request_workspace,
                           std::move(provider_identifier),
                           memory,
                           working,
                           long_term,
                           semantic,
                           episodic,
                           procedural,
                           std::move(reflections)};
}

[[nodiscard]] ProviderRequest request_with(
    const AuthenticState& source,
    const Memory& memory,
    const WorkingMemory& working,
    const LongTermMemory& long_term,
    const SemanticMemory& semantic,
    const EpisodicMemory& episodic,
    const ProceduralMemory& procedural,
    std::vector<Reflection> reflections) {
    return request_with(source, source.workspaceIdentifier(),
                        std::string{provider_a}, memory, working, long_term,
                        semantic, episodic, procedural,
                        std::move(reflections));
}

TEST(MemoryProviderApiTest, PublicDeclarationsMatchContract) {
    static_assert(std::is_constructible_v<ProviderDescriptor, std::string,
                                          std::string>);
    static_assert(std::is_copy_constructible_v<ProviderDescriptor>);
    static_assert(std::is_copy_assignable_v<ProviderDescriptor>);
    static_assert(std::is_nothrow_move_constructible_v<ProviderDescriptor>);
    static_assert(std::is_nothrow_move_assignable_v<ProviderDescriptor>);

    static_assert(std::is_constructible_v<
                  ProviderRequest, std::string, std::string, const Memory&,
                  const WorkingMemory&, const LongTermMemory&,
                  const SemanticMemory&, const EpisodicMemory&,
                  const ProceduralMemory&, std::vector<Reflection>>);
    static_assert(std::is_constructible_v<
                  ProviderRequest, std::string, std::string, const Memory&,
                  const WorkingMemory&, const LongTermMemory&,
                  const SemanticMemory&, const EpisodicMemory&,
                  const ProceduralMemory&>);
    static_assert(std::is_copy_constructible_v<ProviderRequest>);
    static_assert(std::is_copy_assignable_v<ProviderRequest>);
    static_assert(std::is_nothrow_move_constructible_v<ProviderRequest>);
    static_assert(std::is_nothrow_move_assignable_v<ProviderRequest>);

    static_assert(std::is_constructible_v<ProviderSession, std::string>);
    static_assert(std::is_copy_constructible_v<ProviderSession>);
    static_assert(!std::is_copy_assignable_v<ProviderSession>);
    static_assert(std::is_nothrow_move_constructible_v<ProviderSession>);
    static_assert(!std::is_move_assignable_v<ProviderSession>);

    static_assert(!std::is_default_constructible_v<ProviderResult>);
    static_assert(!std::is_copy_constructible_v<ProviderResult>);
    static_assert(!std::is_copy_assignable_v<ProviderResult>);
    static_assert(std::is_nothrow_move_constructible_v<ProviderResult>);
    static_assert(std::is_nothrow_move_assignable_v<ProviderResult>);
    static_assert(std::is_empty_v<MemoryProviderEngine>);

    using DescriptorWorkspace = const std::string& (
        ProviderDescriptor::*)() const noexcept;
    using DescriptorIdentifier = const std::string& (
        ProviderDescriptor::*)() const noexcept;
    using RequestMemory = const Memory* (ProviderRequest::*)() const noexcept;
    using RequestReflections = const std::vector<Reflection>& (
        ProviderRequest::*)() const noexcept;
    using SessionStateAccessor = State (ProviderSession::*)() const noexcept;
    using SessionSize = std::size_t (ProviderSession::*)() const noexcept;
    using SessionDescriptors = const std::vector<ProviderDescriptor>& (
        ProviderSession::*)() const noexcept;
    using ResultSucceeded = bool (ProviderResult::*)() const noexcept;
    using ResultRequest = const ProviderRequest* (
        ProviderResult::*)() const noexcept;

    static_assert(std::is_same_v<
                  decltype(&ProviderDescriptor::workspaceIdentifier),
                  DescriptorWorkspace>);
    static_assert(std::is_same_v<decltype(&ProviderDescriptor::identifier),
                                 DescriptorIdentifier>);
    static_assert(std::is_same_v<decltype(&ProviderRequest::memory),
                                 RequestMemory>);
    static_assert(std::is_same_v<decltype(&ProviderRequest::reflections),
                                 RequestReflections>);
    static_assert(std::is_same_v<decltype(&ProviderSession::state),
                                 SessionStateAccessor>);
    static_assert(std::is_same_v<decltype(&ProviderSession::size), SessionSize>);
    static_assert(std::is_same_v<decltype(&ProviderSession::descriptors),
                                 SessionDescriptors>);
    static_assert(std::is_same_v<decltype(&ProviderResult::succeeded),
                                 ResultSucceeded>);
    static_assert(std::is_same_v<decltype(&ProviderResult::request),
                                 ResultRequest>);

    static_assert(State::Open != State::Exported);
    static_assert(State::Exported != State::Imported);
    static_assert(State::Imported != State::Forgotten);

    using Register = ProviderResult (MemoryProviderEngine::*)(
        ProviderSession&, const ProviderDescriptor&) const;
    using Transfer = ProviderResult (MemoryProviderEngine::*)(
        ProviderSession&, const ProviderRequest&) const;
    using Validate = ProviderResult (MemoryProviderEngine::*)(
        const ProviderSession&, const ProviderRequest&) const;
    using Enumerate = ProviderResult (MemoryProviderEngine::*)(
        const ProviderSession&) const;
    using Forget = ProviderResult (MemoryProviderEngine::*)(
        ProviderSession&) const;

    static_assert(std::is_same_v<
                  decltype(static_cast<Register>(
                      &MemoryProviderEngine::registerProvider)),
                  Register>);
    static_assert(std::is_same_v<
                  decltype(static_cast<Transfer>(
                      &MemoryProviderEngine::exportState)),
                  Transfer>);
    static_assert(std::is_same_v<
                  decltype(static_cast<Transfer>(
                      &MemoryProviderEngine::importState)),
                  Transfer>);
    static_assert(std::is_same_v<
                  decltype(static_cast<Validate>(&MemoryProviderEngine::validate)),
                  Validate>);
    static_assert(std::is_same_v<
                  decltype(static_cast<Enumerate>(
                      &MemoryProviderEngine::enumerate)),
                  Enumerate>);
    static_assert(std::is_same_v<
                  decltype(static_cast<Forget>(
                      &MemoryProviderEngine::forgetSession)),
                  Forget>);
}

TEST(MemoryProviderValueTest, ConstructionCopyMoveAndObservationAreExact) {
    EXPECT_THROW((ProviderDescriptor{"", "provider"}), std::invalid_argument);
    EXPECT_THROW((ProviderSession{""}), std::invalid_argument);

    ProviderDescriptor empty_identifier{"workspace", ""};
    EXPECT_EQ(empty_identifier.workspaceIdentifier(), "workspace");
    EXPECT_TRUE(empty_identifier.identifier().empty());

    ProviderDescriptor descriptor{"workspace", " Provider-A "};
    ProviderDescriptor descriptor_copy = descriptor;
    EXPECT_EQ(descriptor_copy.workspaceIdentifier(), "workspace");
    EXPECT_EQ(descriptor_copy.identifier(), " Provider-A ");
    ProviderDescriptor descriptor_moved = std::move(descriptor_copy);
    EXPECT_EQ(descriptor_moved.identifier(), " Provider-A ");
    EXPECT_TRUE(descriptor_copy.workspaceIdentifier().empty());
    EXPECT_TRUE(descriptor_copy.identifier().empty());

    AuthenticState state{std::string{workspace}};
    EXPECT_THROW((ProviderRequest{"", std::string{provider_a}, state.memory,
                                  state.working, state.long_term, state.semantic,
                                  state.episodic, state.procedural,
                                  state.reflections}),
                 std::invalid_argument);

    auto request = state.request();
    const auto expected = snapshot_of(request);
    ProviderRequest request_copy = request;
    EXPECT_EQ(snapshot_of(request_copy), expected);

    ProviderRequest assigned = state.request(std::string{provider_b});
    assigned = request;
    EXPECT_EQ(snapshot_of(assigned), expected);

    ProviderRequest moved = std::move(request_copy);
    EXPECT_EQ(snapshot_of(moved), expected);
    EXPECT_TRUE(request_copy.workspaceIdentifier().empty());
    EXPECT_TRUE(request_copy.providerIdentifier().empty());
    EXPECT_EQ(request_copy.memory(), nullptr);
    EXPECT_EQ(request_copy.workingMemory(), nullptr);
    EXPECT_EQ(request_copy.longTermMemory(), nullptr);
    EXPECT_EQ(request_copy.semanticMemory(), nullptr);
    EXPECT_EQ(request_copy.episodicMemory(), nullptr);
    EXPECT_EQ(request_copy.proceduralMemory(), nullptr);
    EXPECT_TRUE(request_copy.reflections().empty());

    ProviderSession open{"workspace"};
    MemoryProviderEngine engine;
    expect_ok(engine.registerProvider(
        open, ProviderDescriptor{"workspace", "provider"}));
    ProviderSession open_copy = open;
    EXPECT_EQ(snapshot_of(open_copy), snapshot_of(open));
    ProviderSession moved_open = std::move(open_copy);
    EXPECT_EQ(moved_open.size(), 1U);
    EXPECT_EQ(open_copy.workspaceIdentifier(), "workspace");
    EXPECT_EQ(open_copy.state(), State::Open);
    EXPECT_TRUE(open_copy.descriptors().empty());

    ProviderSession forgotten{"workspace"};
    expect_ok(engine.forgetSession(forgotten));
    ProviderSession moved_forgotten = std::move(forgotten);
    EXPECT_EQ(moved_forgotten.state(), State::Forgotten);
    EXPECT_EQ(forgotten.workspaceIdentifier(), "workspace");
    EXPECT_EQ(forgotten.state(), State::Forgotten);
    EXPECT_TRUE(forgotten.descriptors().empty());

    auto result = engine.enumerate(open);
    const auto result_before_move = snapshot_of(result);
    ProviderResult moved_result = std::move(result);
    EXPECT_EQ(snapshot_of(moved_result), result_before_move);
    EXPECT_TRUE(result.workspaceIdentifier().empty());
    EXPECT_FALSE(result.succeeded());
    EXPECT_TRUE(result.code().empty());
    EXPECT_TRUE(result.message().empty());
    EXPECT_EQ(result.request(), nullptr);
    EXPECT_TRUE(result.descriptors().empty());
}

TEST(MemoryProviderValueTest, AssignmentsAndAccessorLifetimesAreExact) {
    AuthenticState values{std::string{workspace}};

    const ProviderDescriptor descriptor{std::string{workspace},
                                        std::string{provider_a}};
    ProviderDescriptor descriptor_copy{"temporary-workspace", "temporary"};
    descriptor_copy = descriptor;
    EXPECT_EQ(descriptor_copy.workspaceIdentifier(), workspace);
    EXPECT_EQ(descriptor_copy.identifier(), provider_a);
    EXPECT_EQ(descriptor.workspaceIdentifier(), workspace);
    EXPECT_EQ(descriptor.identifier(), provider_a);

    ProviderDescriptor descriptor_move{"move-target", "move-target"};
    descriptor_move = std::move(descriptor_copy);
    EXPECT_EQ(descriptor_move.workspaceIdentifier(), workspace);
    EXPECT_EQ(descriptor_move.identifier(), provider_a);
    EXPECT_TRUE(descriptor_copy.workspaceIdentifier().empty());
    EXPECT_TRUE(descriptor_copy.identifier().empty());

    auto request_source = values.request();
    const auto request_expected = snapshot_of(request_source);
    auto request_target = values.request(std::string{provider_b});
    request_target = std::move(request_source);
    EXPECT_EQ(snapshot_of(request_target), request_expected);
    EXPECT_TRUE(request_source.workspaceIdentifier().empty());
    EXPECT_TRUE(request_source.providerIdentifier().empty());
    EXPECT_EQ(request_source.memory(), nullptr);
    EXPECT_EQ(request_source.workingMemory(), nullptr);
    EXPECT_EQ(request_source.longTermMemory(), nullptr);
    EXPECT_EQ(request_source.semanticMemory(), nullptr);
    EXPECT_EQ(request_source.episodicMemory(), nullptr);
    EXPECT_EQ(request_source.proceduralMemory(), nullptr);
    EXPECT_TRUE(request_source.reflections().empty());

    ProviderSession session{std::string{workspace}};
    MemoryProviderEngine engine;
    expect_ok(engine.registerProvider(session, descriptor));

    const auto* const session_workspace = &session.workspaceIdentifier();
    const auto* const session_descriptors = &session.descriptors();
    const auto* const first_descriptor = &session.descriptors().front();
    const auto* const request_workspace = &request_target.workspaceIdentifier();
    const auto* const request_memory = request_target.memory();
    const auto* const request_reflections = &request_target.reflections();

    auto validated = engine.validate(session, request_target);
    expect_ok(validated);
    auto enumerated = engine.enumerate(session);
    expect_ok(enumerated);

    EXPECT_EQ(&session.workspaceIdentifier(), session_workspace);
    EXPECT_EQ(&session.descriptors(), session_descriptors);
    EXPECT_EQ(&session.descriptors().front(), first_descriptor);
    EXPECT_EQ(&request_target.workspaceIdentifier(), request_workspace);
    EXPECT_EQ(request_target.memory(), request_memory);
    EXPECT_EQ(&request_target.reflections(), request_reflections);
    EXPECT_EQ(session.workspaceIdentifier(), workspace);
    EXPECT_EQ(session.descriptors().front().identifier(), provider_a);
    EXPECT_EQ(snapshot_of(request_target), request_expected);

    auto result_source = engine.enumerate(session);
    const auto result_expected = snapshot_of(result_source);
    auto result_target = engine.validate(session, request_target);
    result_target = std::move(result_source);
    EXPECT_EQ(snapshot_of(result_target), result_expected);
    EXPECT_TRUE(result_source.workspaceIdentifier().empty());
    EXPECT_FALSE(result_source.succeeded());
    EXPECT_TRUE(result_source.code().empty());
    EXPECT_TRUE(result_source.message().empty());
    EXPECT_EQ(result_source.request(), nullptr);
    EXPECT_TRUE(result_source.descriptors().empty());
}

TEST(MemoryProviderValueTest, CompletedSessionMovesResetSourcesToOpen) {
    AuthenticState values{std::string{workspace}};
    const auto request = values.request();
    const ProviderDescriptor descriptor{std::string{workspace},
                                        std::string{provider_a}};
    MemoryProviderEngine engine;

    ProviderSession exported_source{std::string{workspace}};
    expect_ok(engine.registerProvider(exported_source, descriptor));
    expect_ok(engine.exportState(exported_source, request));
    ProviderSession exported = std::move(exported_source);
    EXPECT_EQ(exported.state(), State::Exported);
    EXPECT_EQ(exported.size(), 1U);
    EXPECT_EQ(exported_source.workspaceIdentifier(), workspace);
    EXPECT_EQ(exported_source.state(), State::Open);
    EXPECT_TRUE(exported_source.descriptors().empty());
    expect_ok(engine.registerProvider(exported_source, descriptor));
    EXPECT_EQ(exported_source.size(), 1U);

    ProviderSession imported_source{std::string{workspace}};
    expect_ok(engine.registerProvider(imported_source, descriptor));
    expect_ok(engine.importState(imported_source, request));
    ProviderSession imported = std::move(imported_source);
    EXPECT_EQ(imported.state(), State::Imported);
    EXPECT_EQ(imported.size(), 1U);
    EXPECT_EQ(imported_source.workspaceIdentifier(), workspace);
    EXPECT_EQ(imported_source.state(), State::Open);
    EXPECT_TRUE(imported_source.descriptors().empty());
    expect_ok(engine.registerProvider(imported_source, descriptor));
    EXPECT_EQ(imported_source.size(), 1U);
}

TEST(MemoryProviderRegistrationTest,
     RegistryIsCallerOwnedOrderedAndIdempotent) {
    MemoryProviderEngine engine;
    ProviderSession first{std::string{workspace}};
    ProviderSession second{std::string{workspace}};
    const ProviderDescriptor descriptor_b{std::string{workspace},
                                          std::string{provider_b}};
    const ProviderDescriptor descriptor_a{std::string{workspace},
                                          std::string{provider_a}};

    expect_ok(engine.registerProvider(first, descriptor_b));
    expect_ok(engine.registerProvider(first, descriptor_a));
    const auto before_duplicate = snapshot_of(first);
    expect_ok(engine.registerProvider(first, descriptor_b));
    EXPECT_EQ(snapshot_of(first), before_duplicate);

    ASSERT_EQ(first.size(), 2U);
    EXPECT_EQ(first.descriptors()[0].identifier(), provider_b);
    EXPECT_EQ(first.descriptors()[1].identifier(), provider_a);
    EXPECT_TRUE(second.descriptors().empty());

    auto listed = engine.enumerate(first);
    expect_ok(listed);
    EXPECT_EQ(listed.workspaceIdentifier(), workspace);
    EXPECT_EQ(listed.request(), nullptr);
    ASSERT_EQ(listed.descriptors().size(), 2U);
    EXPECT_EQ(listed.descriptors()[0].identifier(), provider_b);
    EXPECT_EQ(listed.descriptors()[1].identifier(), provider_a);

    expect_ok(engine.registerProvider(
        first, ProviderDescriptor{std::string{workspace}, "provider-A"}));
    EXPECT_EQ(first.size(), 3U);
}

TEST(MemoryProviderLifecycleTest, AllStatesOperationsAndPayloadsAreExact) {
    AuthenticState values{std::string{workspace}};
    auto request = values.request();
    const ProviderDescriptor descriptor{std::string{workspace},
                                        std::string{provider_a}};
    MemoryProviderEngine engine;

    ProviderSession exported{std::string{workspace}};
    EXPECT_EQ(exported.state(), State::Open);
    expect_ok(engine.registerProvider(exported, descriptor));
    auto validation_result = engine.validate(exported, request);
    expect_ok(validation_result);
    expect_no_payload(validation_result);
    auto export_result = engine.exportState(exported, request);
    expect_ok(export_result);
    EXPECT_EQ(exported.state(), State::Exported);
    ASSERT_NE(export_result.request(), nullptr);
    EXPECT_TRUE(export_result.descriptors().empty());
    EXPECT_EQ(snapshot_of(*export_result.request()), snapshot_of(request));
    expect_ok(engine.validate(exported, request));
    auto export_enumeration = engine.enumerate(exported);
    expect_ok(export_enumeration);
    EXPECT_EQ(export_enumeration.descriptors().size(), 1U);
    expect_failure(engine.registerProvider(exported, descriptor), workspace,
                   "SESSION_ALREADY_COMPLETED");
    expect_failure(engine.exportState(exported, request), workspace,
                   "SESSION_ALREADY_COMPLETED");
    expect_failure(engine.importState(exported, request), workspace,
                   "SESSION_ALREADY_COMPLETED");

    ProviderSession imported{std::string{workspace}};
    expect_ok(engine.registerProvider(imported, descriptor));
    auto import_result = engine.importState(imported, *export_result.request());
    expect_ok(import_result);
    EXPECT_EQ(imported.state(), State::Imported);
    ASSERT_NE(import_result.request(), nullptr);
    EXPECT_TRUE(import_result.descriptors().empty());
    EXPECT_EQ(snapshot_of(*import_result.request()), snapshot_of(request));
    expect_ok(engine.validate(imported, request));
    expect_ok(engine.enumerate(imported));
    expect_failure(engine.registerProvider(imported, descriptor), workspace,
                   "SESSION_ALREADY_COMPLETED");
    expect_failure(engine.exportState(imported, request), workspace,
                   "SESSION_ALREADY_COMPLETED");
    expect_failure(engine.importState(imported, request), workspace,
                   "SESSION_ALREADY_COMPLETED");

    auto forgotten_result = engine.forgetSession(imported);
    expect_ok(forgotten_result);
    expect_no_payload(forgotten_result);
    EXPECT_EQ(imported.state(), State::Forgotten);
    EXPECT_TRUE(imported.descriptors().empty());
    const auto forgotten_snapshot = snapshot_of(imported);
    expect_ok(engine.forgetSession(imported));
    EXPECT_EQ(snapshot_of(imported), forgotten_snapshot);
    expect_failure(engine.exportState(imported, request), workspace,
                   "SESSION_FORGOTTEN");
    expect_failure(engine.validate(imported, request), workspace,
                   "SESSION_FORGOTTEN");
    expect_failure(engine.enumerate(imported), workspace, "SESSION_FORGOTTEN");

    ProviderSession direct_forget{std::string{workspace}};
    expect_ok(engine.forgetSession(direct_forget));
    EXPECT_EQ(direct_forget.state(), State::Forgotten);
}

TEST(MemoryProviderFidelityTest,
     AuthenticStateProvenanceIdentityAndOrderAreExact) {
    AuthenticState values{std::string{workspace}};
    const auto source_request = values.request();
    const auto expected = snapshot_of(source_request);

    ASSERT_EQ(expected.memory->entries.size(), 2U);
    EXPECT_EQ(expected.memory->entries[0].first, "memory-b");
    EXPECT_EQ(expected.memory->entries[0].second, "memory replacement b");
    ASSERT_EQ(expected.working->entries.size(), 2U);
    EXPECT_EQ(expected.working->entries[0].identifier, "working-b");
    EXPECT_EQ(expected.working->entries[0].expiration_point, 90U);
    ASSERT_EQ(expected.semantic->concepts[0].sources.size(), 2U);
    EXPECT_EQ(expected.semantic->concepts[0].categories,
              (std::vector<std::string>{"category-a", "category-b"}));
    EXPECT_EQ(expected.episodic->episodes[0].chronology, 10);
    EXPECT_EQ(expected.episodic->episodes[1].chronology, 10);
    EXPECT_EQ(expected.procedural->procedures[0].steps,
              (std::vector<std::string>{"step-a", "step-a", "step-b"}));
    ASSERT_EQ(expected.reflections.size(), 2U);
    EXPECT_EQ(expected.reflections[0].identifier, "reflection-a");
    EXPECT_EQ(expected.reflections[1].identifier, "reflection-b");
    ASSERT_FALSE(expected.reflections[0].candidates.empty());
    EXPECT_EQ(expected.reflections[0].candidates.size(),
              expected.reflections[0].explanation_chains.size());

    MemoryProviderEngine engine;
    ProviderSession export_session{std::string{workspace}};
    expect_ok(engine.registerProvider(
        export_session,
        ProviderDescriptor{std::string{workspace}, std::string{provider_a}}));
    auto exported = engine.exportState(export_session, source_request);
    expect_ok(exported);
    ASSERT_NE(exported.request(), nullptr);
    EXPECT_EQ(snapshot_of(*exported.request()), expected);

    ProviderSession import_session{std::string{workspace}};
    expect_ok(engine.registerProvider(
        import_session,
        ProviderDescriptor{std::string{workspace}, std::string{provider_a}}));
    auto imported = engine.importState(import_session, *exported.request());
    expect_ok(imported);
    ASSERT_NE(imported.request(), nullptr);
    EXPECT_EQ(snapshot_of(*imported.request()), expected);
    EXPECT_NE(imported.request(), exported.request());
    EXPECT_NE(imported.request()->memory(), exported.request()->memory());
    EXPECT_NE(&imported.request()->reflections(),
              &exported.request()->reflections());
}

TEST(MemoryProviderFidelityTest, ValidEmptyValuesSurviveDetachedTransport) {
    const std::string workspace_identifier{workspace};
    Memory memory{workspace_identifier};
    WorkingMemory working{workspace_identifier};
    LongTermMemory long_term{workspace_identifier};
    SemanticMemory semantic{workspace_identifier};
    EpisodicMemory episodic{workspace_identifier};
    ProceduralMemory procedural{workspace_identifier};

    require_ok(MemoryEngine{}.store(
        memory, MemoryEntry{"memory-empty-value", ""}));
    require_ok(WorkingMemoryEngine{}.activate(working, "empty-value-task"));
    require_ok(WorkingMemoryEngine{}.store(
        working, WorkingMemoryEntry{"working-empty-value", ""}));
    require_ok(LongTermMemoryEngine{}.retain(
        long_term, LongTermMemoryEntry{"long-term-empty-value", ""}));

    const ProviderRequest request{
        workspace_identifier, std::string{provider_a}, memory, working,
        long_term, semantic, episodic, procedural};
    const auto expected = snapshot_of(request);

    ProviderSession export_session{workspace_identifier};
    MemoryProviderEngine engine;
    const ProviderDescriptor descriptor{workspace_identifier,
                                        std::string{provider_a}};
    expect_ok(engine.registerProvider(export_session, descriptor));
    auto exported = engine.exportState(export_session, request);
    expect_ok(exported);
    ASSERT_NE(exported.request(), nullptr);
    EXPECT_EQ(snapshot_of(*exported.request()), expected);
    ASSERT_EQ(exported.request()->memory()->entries().size(), 1U);
    EXPECT_TRUE(exported.request()->memory()->entries().front().value().empty());
    ASSERT_EQ(exported.request()->workingMemory()->entries().size(), 1U);
    EXPECT_TRUE(
        exported.request()->workingMemory()->entries().front().value().empty());
    ASSERT_EQ(exported.request()->longTermMemory()->entries().size(), 1U);
    EXPECT_TRUE(
        exported.request()->longTermMemory()->entries().front().value().empty());

    ProviderSession import_session{workspace_identifier};
    expect_ok(engine.registerProvider(import_session, descriptor));
    auto imported = engine.importState(import_session, *exported.request());
    expect_ok(imported);
    ASSERT_NE(imported.request(), nullptr);
    EXPECT_EQ(snapshot_of(*imported.request()), expected);
}

TEST(MemoryProviderFidelityTest,
     HiddenForgottenIdentityHistorySurvivesTransport) {
    AuthenticState values{std::string{workspace}};
    auto request = values.request();
    ProviderSession session{std::string{workspace}};
    MemoryProviderEngine engine;
    expect_ok(engine.registerProvider(
        session,
        ProviderDescriptor{std::string{workspace}, std::string{provider_a}}));
    auto exported = engine.exportState(session, request);
    require_ok(exported);
    ASSERT_NE(exported.request(), nullptr);

    LongTermMemory long_term = *exported.request()->longTermMemory();
    auto retained = LongTermMemoryEngine{}.retain(
        long_term, LongTermMemoryEntry{"forgotten-evidence", "new value"});
    EXPECT_FALSE(retained.succeeded());
    EXPECT_EQ(retained.code(), "FORGOTTEN_IDENTIFIER");

    SemanticMemory semantic = *exported.request()->semanticMemory();
    auto classified = SemanticMemoryEngine{}.classify(
        semantic, *exported.request()->longTermMemory(),
        SemanticConcept{"forgotten-semantic", "new meaning",
                        {*exported.request()->longTermMemory()->find(
                            "evidence-a")}});
    EXPECT_FALSE(classified.succeeded());
    EXPECT_EQ(classified.code(), "FORGOTTEN_IDENTIFIER");

    EpisodicMemory episodic = *exported.request()->episodicMemory();
    auto episode = EpisodicMemoryEngine{}.derive(
        episodic, *exported.request()->longTermMemory(),
        Episode{"forgotten-episode", "new occurrence", "new context", 30,
                {*exported.request()->longTermMemory()->find("evidence-a")}});
    EXPECT_FALSE(episode.succeeded());
    EXPECT_EQ(episode.code(), "FORGOTTEN_IDENTIFIER");

    ProceduralMemory procedural = *exported.request()->proceduralMemory();
    auto procedure = ProceduralMemoryEngine{}.derive(
        procedural, *exported.request()->longTermMemory(),
        Procedure{"forgotten-procedure", "new activity", {"new step"},
                  {*exported.request()->longTermMemory()->find("evidence-a")}});
    EXPECT_FALSE(procedure.succeeded());
    EXPECT_EQ(procedure.code(), "FORGOTTEN_IDENTIFIER");
}

TEST(MemoryProviderWorkspaceTest,
     EveryTransportedWorkspaceBoundaryIsEnforced) {
    AuthenticState values{std::string{workspace}};
    AuthenticState other{"other-workspace"};
    MemoryProviderEngine engine;
    ProviderSession session{std::string{workspace}};
    expect_ok(engine.registerProvider(
        session,
        ProviderDescriptor{std::string{workspace}, std::string{provider_a}}));

    expect_failure(engine.registerProvider(
                       session, ProviderDescriptor{"other-workspace", "other"}),
                   workspace, "WORKSPACE_MISMATCH");

    const auto verify_mismatch = [&](ProviderRequest request) {
        const auto before = snapshot_of(session);
        auto result = engine.validate(session, request);
        expect_failure(result, workspace, "WORKSPACE_MISMATCH");
        EXPECT_EQ(snapshot_of(session), before);
    };

    verify_mismatch(request_with(
        values, "other-workspace", std::string{provider_a}, values.memory,
        values.working, values.long_term, values.semantic, values.episodic,
        values.procedural, values.reflections));
    verify_mismatch(request_with(
        values, other.memory, values.working, values.long_term, values.semantic,
        values.episodic, values.procedural, values.reflections));
    verify_mismatch(request_with(
        values, values.memory, other.working, values.long_term, values.semantic,
        values.episodic, values.procedural, values.reflections));
    verify_mismatch(request_with(
        values, values.memory, values.working, other.long_term, values.semantic,
        values.episodic, values.procedural, values.reflections));
    verify_mismatch(request_with(
        values, values.memory, values.working, values.long_term, other.semantic,
        values.episodic, values.procedural, values.reflections));
    verify_mismatch(request_with(
        values, values.memory, values.working, values.long_term, values.semantic,
        other.episodic, values.procedural, values.reflections));
    verify_mismatch(request_with(
        values, values.memory, values.working, values.long_term, values.semantic,
        values.episodic, other.procedural, values.reflections));
    verify_mismatch(request_with(
        values, values.memory, values.working, values.long_term, values.semantic,
        values.episodic, values.procedural, other.reflections));
}

TEST(MemoryProviderWorkspaceTest,
     MovedFromValuesAreRejectedAtWorkspaceBoundary) {
    AuthenticState values{std::string{workspace}};
    MemoryProviderEngine engine;
    ProviderSession session{std::string{workspace}};
    expect_ok(engine.registerProvider(
        session,
        ProviderDescriptor{std::string{workspace}, std::string{provider_a}}));

    auto request_source = values.request();
    const auto retained_request = std::move(request_source);
    EXPECT_EQ(retained_request.workspaceIdentifier(), workspace);
    expect_failure(engine.validate(session, request_source), workspace,
                   "WORKSPACE_MISMATCH");

    Reflection reflection_source = values.reflections.front();
    const Reflection retained_reflection = std::move(reflection_source);
    EXPECT_EQ(retained_reflection.workspaceIdentifier(), workspace);
    EXPECT_TRUE(reflection_source.workspaceIdentifier().empty());

    std::vector<Reflection> moved_from_reflections;
    moved_from_reflections.push_back(std::move(reflection_source));
    ProviderRequest moved_reflection_request{
        std::string{workspace}, std::string{provider_a}, values.memory,
        values.working, values.long_term, values.semantic, values.episodic,
        values.procedural, std::move(moved_from_reflections)};
    ASSERT_EQ(moved_reflection_request.reflections().size(), 1U);
    EXPECT_TRUE(moved_reflection_request.reflections()
                    .front()
                    .workspaceIdentifier()
                    .empty());
    expect_failure(engine.validate(session, moved_reflection_request), workspace,
                   "WORKSPACE_MISMATCH");
}

TEST(MemoryProviderResultTest,
     ClosedCodesMessagesWorkspacesAndPayloadsAreExact) {
    AuthenticState values{std::string{workspace}};
    const auto request = values.request();
    MemoryProviderEngine engine;
    const ProviderDescriptor descriptor{std::string{workspace},
                                        std::string{provider_a}};

    ProviderSession open{std::string{workspace}};
    auto ok = engine.registerProvider(open, descriptor);
    expect_ok(ok);
    EXPECT_EQ(ok.workspaceIdentifier(), workspace);
    expect_no_payload(ok);

    ProviderSession forgotten{std::string{workspace}};
    expect_ok(engine.forgetSession(forgotten));
    auto first_forgotten = engine.enumerate(forgotten);
    auto second_forgotten = engine.enumerate(forgotten);
    expect_equivalent_failures(first_forgotten, second_forgotten,
                               "SESSION_FORGOTTEN");

    ProviderSession completed{std::string{workspace}};
    expect_ok(engine.registerProvider(completed, descriptor));
    expect_ok(engine.exportState(completed, request));
    auto first_completed = engine.registerProvider(completed, descriptor);
    auto second_completed = engine.registerProvider(completed, descriptor);
    expect_equivalent_failures(first_completed, second_completed,
                               "SESSION_ALREADY_COMPLETED");

    ProviderSession workspace_session{std::string{workspace}};
    const ProviderDescriptor wrong_workspace{"other-workspace", "provider"};
    auto first_workspace =
        engine.registerProvider(workspace_session, wrong_workspace);
    auto second_workspace =
        engine.registerProvider(workspace_session, wrong_workspace);
    expect_equivalent_failures(first_workspace, second_workspace,
                               "WORKSPACE_MISMATCH");
    const ProviderDescriptor empty_identifier{std::string{workspace}, ""};
    auto first_identifier =
        engine.registerProvider(workspace_session, empty_identifier);
    auto second_identifier =
        engine.registerProvider(workspace_session, empty_identifier);
    expect_equivalent_failures(first_identifier, second_identifier,
                               "INVALID_PROVIDER_IDENTIFIER");

    ProviderSession absent{std::string{workspace}};
    auto first_absent = engine.exportState(absent, request);
    auto second_absent = engine.exportState(absent, request);
    expect_equivalent_failures(first_absent, second_absent,
                               "PROVIDER_NOT_REGISTERED");

    ProviderSession empty{std::string{workspace}};
    auto empty_enumeration = engine.enumerate(empty);
    expect_ok(empty_enumeration);
    EXPECT_EQ(empty_enumeration.request(), nullptr);
    EXPECT_TRUE(empty_enumeration.descriptors().empty());

}

TEST(MemoryProviderResultTest,
     EverySuccessfulOperationReportsTheSessionWorkspace) {
    AuthenticState values{std::string{workspace}};
    const auto request = values.request();
    const ProviderDescriptor descriptor{std::string{workspace},
                                        std::string{provider_a}};
    MemoryProviderEngine engine;
    const auto expect_workspace = [](const ProviderResult& result) {
        expect_ok(result);
        EXPECT_EQ(result.workspaceIdentifier(), workspace);
    };

    ProviderSession export_session{std::string{workspace}};
    auto registered = engine.registerProvider(export_session, descriptor);
    expect_workspace(registered);
    auto validated = engine.validate(export_session, request);
    expect_workspace(validated);
    auto enumerated = engine.enumerate(export_session);
    expect_workspace(enumerated);
    auto exported = engine.exportState(export_session, request);
    expect_workspace(exported);
    auto export_forgotten = engine.forgetSession(export_session);
    expect_workspace(export_forgotten);
    EXPECT_EQ(export_session.state(), State::Forgotten);
    EXPECT_TRUE(export_session.descriptors().empty());

    ProviderSession import_session{std::string{workspace}};
    auto import_registered = engine.registerProvider(import_session, descriptor);
    expect_workspace(import_registered);
    auto imported = engine.importState(import_session, request);
    expect_workspace(imported);
    auto import_forgotten = engine.forgetSession(import_session);
    expect_workspace(import_forgotten);
    EXPECT_EQ(import_session.state(), State::Forgotten);
    EXPECT_TRUE(import_session.descriptors().empty());
}

TEST(MemoryProviderPrecedenceTest,
     LifecycleIdentityAndRegistrationOrderIsExact) {
    AuthenticState values{std::string{workspace}};
    AuthenticState other{"other-workspace"};
    MemoryProviderEngine engine;
    const ProviderDescriptor valid{std::string{workspace},
                                   std::string{provider_a}};
    const ProviderDescriptor wrong_and_empty{"other-workspace", ""};

    ProviderSession completed{std::string{workspace}};
    expect_ok(engine.registerProvider(completed, valid));
    auto valid_request = values.request();
    expect_ok(engine.exportState(completed, valid_request));
    expect_failure(engine.registerProvider(completed, wrong_and_empty), workspace,
                   "SESSION_ALREADY_COMPLETED");

    ProviderSession forgotten{std::string{workspace}};
    expect_ok(engine.forgetSession(forgotten));
    expect_failure(engine.registerProvider(forgotten, wrong_and_empty), workspace,
                   "SESSION_FORGOTTEN");

    ProviderSession open{std::string{workspace}};
    expect_failure(engine.registerProvider(open, wrong_and_empty), workspace,
                   "WORKSPACE_MISMATCH");
    expect_failure(engine.registerProvider(
                       open, ProviderDescriptor{std::string{workspace}, ""}),
                   workspace, "INVALID_PROVIDER_IDENTIFIER");

    auto wrong_request_workspace = request_with(
        values, "other-workspace", "", values.memory, values.working,
        values.long_term, values.semantic, values.episodic, values.procedural,
        values.reflections);
    expect_failure(engine.exportState(open, wrong_request_workspace), workspace,
                   "WORKSPACE_MISMATCH");

    auto empty_identifier = values.request("");
    expect_failure(engine.exportState(open, empty_identifier), workspace,
                   "INVALID_PROVIDER_IDENTIFIER");

    auto unregistered_with_bad_memory = request_with(
        values, values.workspaceIdentifier(), "unregistered", other.memory,
        values.working, values.long_term, values.semantic, values.episodic,
        values.procedural, values.reflections);
    expect_failure(engine.exportState(open, unregistered_with_bad_memory),
                   workspace, "PROVIDER_NOT_REGISTERED");

    ProviderSession registered{std::string{workspace}};
    expect_ok(engine.registerProvider(registered, valid));
    auto bad_memory = request_with(
        values, other.memory, other.working, values.long_term, values.semantic,
        values.episodic, values.procedural, values.reflections);
    expect_failure(engine.exportState(registered, bad_memory), workspace,
                   "WORKSPACE_MISMATCH");

    ProviderSession completed_validation{std::string{workspace}};
    expect_ok(engine.registerProvider(completed_validation, valid));
    expect_ok(engine.importState(completed_validation, valid_request));
    expect_failure(engine.validate(completed_validation, empty_identifier),
                   workspace, "INVALID_PROVIDER_IDENTIFIER");
}

TEST(MemoryProviderPrecedenceTest,
     ImportAggregateAndReflectionEdgesAreExact) {
    AuthenticState values{std::string{workspace}};
    AuthenticState other{"other-workspace"};
    MemoryProviderEngine engine;
    const ProviderDescriptor descriptor{std::string{workspace},
                                        std::string{provider_a}};

    auto wrong_request_workspace = request_with(
        values, "other-workspace", "", values.memory, values.working,
        values.long_term, values.semantic, values.episodic, values.procedural,
        other.reflections);

    ProviderSession completed{std::string{workspace}};
    expect_ok(engine.registerProvider(completed, descriptor));
    expect_ok(engine.exportState(completed, values.request()));
    expect_failure(engine.importState(completed, wrong_request_workspace),
                   workspace, "SESSION_ALREADY_COMPLETED");

    ProviderSession forgotten{std::string{workspace}};
    expect_ok(engine.forgetSession(forgotten));
    expect_failure(engine.importState(forgotten, wrong_request_workspace),
                   workspace, "SESSION_FORGOTTEN");

    ProviderSession open{std::string{workspace}};
    expect_failure(engine.importState(open, wrong_request_workspace), workspace,
                   "WORKSPACE_MISMATCH");

    auto empty_provider_with_bad_memory = request_with(
        values, values.workspaceIdentifier(), "", other.memory, values.working,
        values.long_term, values.semantic, values.episodic, values.procedural,
        values.reflections);
    expect_failure(engine.importState(open, empty_provider_with_bad_memory),
                   workspace, "INVALID_PROVIDER_IDENTIFIER");

    auto unregistered_with_bad_memory = request_with(
        values, values.workspaceIdentifier(), "unregistered", other.memory,
        values.working, values.long_term, values.semantic, values.episodic,
        values.procedural, values.reflections);
    expect_failure(engine.importState(open, unregistered_with_bad_memory),
                   workspace, "PROVIDER_NOT_REGISTERED");

    expect_ok(engine.registerProvider(open, descriptor));
    const auto verify_workspace_failure = [&](ProviderRequest request) {
        const auto before = snapshot_of(open);
        auto result = engine.importState(open, request);
        expect_failure(result, workspace, "WORKSPACE_MISMATCH");
        EXPECT_EQ(snapshot_of(open), before);
    };

    verify_workspace_failure(request_with(
        values, other.memory, values.working, values.long_term, values.semantic,
        values.episodic, values.procedural, values.reflections));
    verify_workspace_failure(request_with(
        values, values.memory, other.working, values.long_term, values.semantic,
        values.episodic, values.procedural, values.reflections));
    verify_workspace_failure(request_with(
        values, values.memory, values.working, other.long_term, values.semantic,
        values.episodic, values.procedural, values.reflections));
    verify_workspace_failure(request_with(
        values, values.memory, values.working, values.long_term, other.semantic,
        values.episodic, values.procedural, values.reflections));
    verify_workspace_failure(request_with(
        values, values.memory, values.working, values.long_term, values.semantic,
        other.episodic, values.procedural, values.reflections));
    verify_workspace_failure(request_with(
        values, values.memory, values.working, values.long_term, values.semantic,
        values.episodic, other.procedural, values.reflections));

    auto first_reflection_bad = values.reflections;
    first_reflection_bad.front() = other.reflections.front();
    verify_workspace_failure(request_with(
        values, values.memory, values.working, values.long_term, values.semantic,
        values.episodic, values.procedural, std::move(first_reflection_bad)));

    auto second_reflection_bad = values.reflections;
    ASSERT_GE(second_reflection_bad.size(), 2U);
    second_reflection_bad[1] = other.reflections.front();
    verify_workspace_failure(request_with(
        values, values.memory, values.working, values.long_term, values.semantic,
        values.episodic, values.procedural, std::move(second_reflection_bad)));

    auto bad_aggregate_and_reflection = other.reflections;
    verify_workspace_failure(request_with(
        values, other.memory, other.working, other.long_term, other.semantic,
        other.episodic, other.procedural,
        std::move(bad_aggregate_and_reflection)));
}

TEST(MemoryProviderIsolationTest,
     SuccessAndSemanticFailureDoNotModifySources) {
    AuthenticState values{std::string{workspace}};
    auto request = values.request();
    const auto memory_before = snapshot_of(values.memory);
    const auto working_before = snapshot_of(values.working);
    const auto long_term_before = snapshot_of(values.long_term);
    const auto semantic_before = snapshot_of(values.semantic);
    const auto episodic_before = snapshot_of(values.episodic);
    const auto procedural_before = snapshot_of(values.procedural);
    const auto reflections_before = snapshot_vector<Reflection, ReflectionSnapshot>(
        values.reflections, snapshot_of);
    const auto request_before = snapshot_of(request);

    MemoryProviderEngine engine;
    ProviderSession session{std::string{workspace}};
    const ProviderDescriptor descriptor{std::string{workspace},
                                        std::string{provider_a}};
    const auto descriptor_workspace = descriptor.workspaceIdentifier();
    const auto descriptor_identifier = descriptor.identifier();
    expect_ok(engine.registerProvider(session, descriptor));
    expect_ok(engine.validate(session, request));
    auto exported = engine.exportState(session, request);
    expect_ok(exported);

    ProviderSession failing{std::string{workspace}};
    auto failure = engine.exportState(failing, request);
    expect_failure(failure, workspace, "PROVIDER_NOT_REGISTERED");

    EXPECT_EQ(snapshot_of(values.memory), memory_before);
    EXPECT_EQ(snapshot_of(values.working), working_before);
    EXPECT_EQ(snapshot_of(values.long_term), long_term_before);
    EXPECT_EQ(snapshot_of(values.semantic), semantic_before);
    EXPECT_EQ(snapshot_of(values.episodic), episodic_before);
    EXPECT_EQ(snapshot_of(values.procedural), procedural_before);
    const auto reflections_after =
        snapshot_vector<Reflection, ReflectionSnapshot>(values.reflections,
                                                        snapshot_of);
    EXPECT_EQ(reflections_after, reflections_before);
    EXPECT_EQ(snapshot_of(request), request_before);
    EXPECT_EQ(descriptor.workspaceIdentifier(), descriptor_workspace);
    EXPECT_EQ(descriptor.identifier(), descriptor_identifier);

    ASSERT_NE(exported.request(), nullptr);
    const auto detached = snapshot_of(*exported.request());
    expect_ok(engine.forgetSession(session));
    EXPECT_EQ(snapshot_of(*exported.request()), detached);
}

TEST(MemoryProviderIsolationTest,
     DetachedRequestsOutliveAndIgnoreEverySource) {
    auto request_after_source_destruction = [] {
        AuthenticState local_values{std::string{workspace}};
        return local_values.request();
    }();
    const auto destroyed_source_snapshot =
        snapshot_of(request_after_source_destruction);

    MemoryProviderEngine engine;
    ProviderSession destroyed_source_session{std::string{workspace}};
    expect_ok(engine.registerProvider(
        destroyed_source_session,
        ProviderDescriptor{std::string{workspace}, std::string{provider_a}}));
    expect_ok(engine.validate(destroyed_source_session,
                              request_after_source_destruction));
    EXPECT_EQ(snapshot_of(request_after_source_destruction),
              destroyed_source_snapshot);

    AuthenticState values{std::string{workspace}};
    const auto request = values.request();
    const auto request_before_source_changes = snapshot_of(request);

    require_ok(MemoryEngine{}.forget(values.memory, "memory-a"));
    require_ok(WorkingMemoryEngine{}.forget(values.working, "working-a"));
    require_ok(LongTermMemoryEngine{}.archive(values.long_term, "evidence-a"));
    require_ok(LongTermMemoryEngine{}.forget(values.long_term, "evidence-b"));
    require_ok(SemanticMemoryEngine{}.forget(values.semantic, "semantic-a"));
    require_ok(EpisodicMemoryEngine{}.forget(values.episodic, "episode-a"));
    require_ok(
        ProceduralMemoryEngine{}.forget(values.procedural, "procedure-a"));
    values.reflections.clear();

    ASSERT_TRUE(request_before_source_changes.memory.has_value());
    ASSERT_TRUE(request_before_source_changes.working.has_value());
    ASSERT_TRUE(request_before_source_changes.long_term.has_value());
    ASSERT_TRUE(request_before_source_changes.semantic.has_value());
    ASSERT_TRUE(request_before_source_changes.episodic.has_value());
    ASSERT_TRUE(request_before_source_changes.procedural.has_value());
    EXPECT_NE(snapshot_of(values.memory),
              *request_before_source_changes.memory);
    EXPECT_NE(snapshot_of(values.working),
              *request_before_source_changes.working);
    EXPECT_NE(snapshot_of(values.long_term),
              *request_before_source_changes.long_term);
    EXPECT_NE(snapshot_of(values.semantic),
              *request_before_source_changes.semantic);
    EXPECT_NE(snapshot_of(values.episodic),
              *request_before_source_changes.episodic);
    EXPECT_NE(snapshot_of(values.procedural),
              *request_before_source_changes.procedural);
    EXPECT_TRUE(values.reflections.empty());

    EXPECT_EQ(snapshot_of(request), request_before_source_changes);
    ProviderSession changed_source_session{std::string{workspace}};
    expect_ok(engine.registerProvider(
        changed_source_session,
        ProviderDescriptor{std::string{workspace}, std::string{provider_a}}));
    expect_ok(engine.validate(changed_source_session, request));
    auto exported = engine.exportState(changed_source_session, request);
    expect_ok(exported);
    ASSERT_NE(exported.request(), nullptr);
    EXPECT_EQ(snapshot_of(*exported.request()),
              request_before_source_changes);
}

[[nodiscard]] std::pair<SessionSnapshot, ResultSnapshot> deterministic_history(
    const std::string& workspace_identifier) {
    AuthenticState values{workspace_identifier};
    auto request = values.request();
    ProviderSession session{workspace_identifier};
    MemoryProviderEngine engine;
    require_ok(engine.registerProvider(
        session, ProviderDescriptor{workspace_identifier, std::string{provider_b}}));
    require_ok(engine.registerProvider(
        session, ProviderDescriptor{workspace_identifier, std::string{provider_a}}));
    require_ok(engine.registerProvider(
        session, ProviderDescriptor{workspace_identifier, std::string{provider_b}}));
    auto result = engine.enumerate(session);
    require_ok(result);
    return {snapshot_of(session), snapshot_of(result)};
}

struct ConcurrentTransportSnapshot final {
    RequestSnapshot source_request;
    SessionSnapshot session;
    ResultSnapshot result;
    bool operator==(const ConcurrentTransportSnapshot&) const = default;
};

[[nodiscard]] ConcurrentTransportSnapshot concurrent_transport_history() {
    AuthenticState values{std::string{workspace}};
    const auto request = values.request();
    const auto source_before = snapshot_of(request);
    ProviderSession session{std::string{workspace}};
    MemoryProviderEngine engine;
    require_ok(engine.registerProvider(
        session,
        ProviderDescriptor{std::string{workspace}, std::string{provider_a}}));
    auto result = engine.exportState(session, request);
    require_ok(result);
    if (result.request() == nullptr) {
        throw std::logic_error{"concurrent export payload is absent"};
    }
    if (snapshot_of(request) != source_before) {
        throw std::logic_error{"concurrent export changed its source"};
    }
    return {source_before, snapshot_of(session), snapshot_of(result)};
}

TEST(MemoryProviderDeterminismTest, EquivalentHistoriesAreCompletelyEqual) {
    const auto first = deterministic_history(std::string{workspace});
    const auto second = deterministic_history(std::string{workspace});
    EXPECT_EQ(first, second);

    AuthenticState first_values{std::string{workspace}};
    AuthenticState second_values{std::string{workspace}};
    ProviderSession first_session{std::string{workspace}};
    ProviderSession second_session{std::string{workspace}};
    MemoryProviderEngine first_engine;
    MemoryProviderEngine second_engine;
    const ProviderDescriptor descriptor{std::string{workspace},
                                        std::string{provider_a}};
    require_ok(first_engine.registerProvider(first_session, descriptor));
    require_ok(second_engine.registerProvider(second_session, descriptor));
    auto first_result = first_engine.exportState(first_session,
                                                  first_values.request());
    auto second_result = second_engine.exportState(second_session,
                                                    second_values.request());
    EXPECT_EQ(snapshot_of(first_result), snapshot_of(second_result));
    EXPECT_EQ(snapshot_of(first_session), snapshot_of(second_session));
}

TEST(MemoryProviderConcurrencyTest, IndependentValuesSupportConcurrentUse) {
    auto first = std::async(std::launch::async, [] {
        return deterministic_history(std::string{workspace});
    });
    auto second = std::async(std::launch::async, [] {
        return deterministic_history(std::string{workspace});
    });
    EXPECT_EQ(first.get(), second.get());

    AuthenticState values{std::string{workspace}};
    ProviderSession session{std::string{workspace}};
    MemoryProviderEngine engine;
    require_ok(engine.registerProvider(
        session,
        ProviderDescriptor{std::string{workspace}, std::string{provider_a}}));
    const auto before = snapshot_of(session);
    const ProviderSession& observed = session;
    auto observation_a = std::async(std::launch::async, [&observed] {
        return snapshot_of(observed);
    });
    auto observation_b = std::async(std::launch::async, [&observed] {
        return snapshot_of(observed);
    });
    EXPECT_EQ(observation_a.get(), before);
    EXPECT_EQ(observation_b.get(), before);
    EXPECT_EQ(snapshot_of(session), before);
}

TEST(MemoryProviderConcurrencyTest,
     DistinctTransportsUseSourcesConcurrently) {
    auto first = std::async(std::launch::async, concurrent_transport_history);
    auto second = std::async(std::launch::async, concurrent_transport_history);
    const auto first_history = first.get();
    const auto second_history = second.get();
    EXPECT_EQ(first_history, second_history);
    EXPECT_EQ(first_history.session.state, State::Exported);
    EXPECT_EQ(first_history.session.descriptors.size(), 1U);
    ASSERT_TRUE(first_history.result.request.has_value());
    EXPECT_EQ(*first_history.result.request, first_history.source_request);
}

} // namespace
