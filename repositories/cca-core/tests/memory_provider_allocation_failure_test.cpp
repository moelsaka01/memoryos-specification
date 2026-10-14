#include <cca/memory/memory_provider.hpp>

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

// CCA-PROVIDERS-013 through CCA-PROVIDERS-017,
// CCA-PROVIDERS-020 through CCA-PROVIDERS-032, CCA-PROVIDERS-035,
// CCA-PROVIDERS-044, and CCA-PROVIDERS-045: exhaustively inject ordinary
// allocation failures into every fallible operation category. Each failure
// compares the complete session, request, six source aggregates, hidden
// forgotten-identifier histories, Reflections, provenance, and ordering.

namespace memory_provider_allocation_failure_support {

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

} // namespace memory_provider_allocation_failure_support

void* operator new(const std::size_t size) {
    return memory_provider_allocation_failure_support::allocate(size);
}

void* operator new[](const std::size_t size) {
    return memory_provider_allocation_failure_support::allocate(size);
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

using CandidateKind = KnowledgeCandidate::Kind;
using SessionState = ProviderSession::State;

constexpr std::string_view workspace{
    "provider-allocation-workspace-with-a-long-identifier"};
constexpr std::string_view other_workspace{
    "provider-allocation-other-workspace-with-a-long-identifier"};
constexpr std::string_view provider_identifier{
    "provider-allocation-provider-with-a-long-identifier"};
constexpr std::string_view unregistered_provider_identifier{
    "provider-allocation-unregistered-provider-with-a-long-identifier"};
constexpr std::string_view long_term_semantic_source{
    "provider-allocation-semantic-evidence-with-a-long-identifier"};
constexpr std::string_view long_term_episode_source{
    "provider-allocation-episodic-evidence-with-a-long-identifier"};
constexpr std::string_view long_term_procedure_source{
    "provider-allocation-procedural-evidence-with-a-long-identifier"};
constexpr std::string_view long_term_forgotten_identifier{
    "provider-allocation-forgotten-long-term-with-a-long-identifier"};
constexpr std::string_view semantic_identifier{
    "provider-allocation-semantic-concept-with-a-long-identifier"};
constexpr std::string_view semantic_forgotten_identifier{
    "provider-allocation-forgotten-semantic-with-a-long-identifier"};
constexpr std::string_view episode_identifier{
    "provider-allocation-episode-with-a-long-identifier"};
constexpr std::string_view episode_forgotten_identifier{
    "provider-allocation-forgotten-episode-with-a-long-identifier"};
constexpr std::string_view procedure_identifier{
    "provider-allocation-procedure-with-a-long-identifier"};
constexpr std::string_view procedure_forgotten_identifier{
    "provider-allocation-forgotten-procedure-with-a-long-identifier"};

struct EntrySnapshot final {
    std::string identifier;
    std::string value;
    bool operator==(const EntrySnapshot&) const = default;
};

struct WorkingEntrySnapshot final {
    std::string identifier;
    std::string value;
    std::optional<std::uint64_t> expiration_point;
    bool operator==(const WorkingEntrySnapshot&) const = default;
};

struct LongTermEntrySnapshot final {
    std::string identifier;
    std::string value;
    bool archived;
    bool operator==(const LongTermEntrySnapshot&) const = default;
};

struct SemanticConceptSnapshot final {
    std::string identifier;
    std::string meaning;
    std::vector<LongTermEntrySnapshot> sources;
    std::vector<std::string> categories;
    std::vector<std::string> links;
    bool operator==(const SemanticConceptSnapshot&) const = default;
};

struct EpisodeSnapshot final {
    std::string identifier;
    std::string occurrence;
    std::string context;
    std::int64_t chronology;
    std::vector<LongTermEntrySnapshot> sources;
    std::vector<std::string> links;
    bool operator==(const EpisodeSnapshot&) const = default;
};

struct ProcedureSnapshot final {
    std::string identifier;
    std::string activity;
    std::vector<std::string> steps;
    std::vector<LongTermEntrySnapshot> sources;
    std::vector<std::string> links;
    bool operator==(const ProcedureSnapshot&) const = default;
};

struct CandidateSnapshot final {
    CandidateKind kind;
    std::string workspace_identifier;
    std::string source_identifier;
    std::uint32_t rank_score;
    std::optional<SemanticConceptSnapshot> semantic;
    std::optional<EpisodeSnapshot> episodic;
    std::optional<ProcedureSnapshot> procedural;
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

struct MemorySnapshot final {
    std::string workspace_identifier;
    std::vector<EntrySnapshot> entries;
    bool operator==(const MemorySnapshot&) const = default;
};

struct WorkingMemorySnapshot final {
    std::string workspace_identifier;
    bool active;
    std::optional<std::string> active_task_identifier;
    std::vector<WorkingEntrySnapshot> entries;
    bool operator==(const WorkingMemorySnapshot&) const = default;
};

struct LongTermMemorySnapshot final {
    std::string workspace_identifier;
    std::vector<LongTermEntrySnapshot> entries;
    std::string forgotten_disposition;
    bool operator==(const LongTermMemorySnapshot&) const = default;
};

struct SemanticMemorySnapshot final {
    std::string workspace_identifier;
    std::vector<SemanticConceptSnapshot> concepts;
    std::string forgotten_disposition;
    bool operator==(const SemanticMemorySnapshot&) const = default;
};

struct EpisodicMemorySnapshot final {
    std::string workspace_identifier;
    std::vector<EpisodeSnapshot> episodes;
    std::string forgotten_disposition;
    bool operator==(const EpisodicMemorySnapshot&) const = default;
};

struct ProceduralMemorySnapshot final {
    std::string workspace_identifier;
    std::vector<ProcedureSnapshot> procedures;
    std::string forgotten_disposition;
    bool operator==(const ProceduralMemorySnapshot&) const = default;
};

struct SourcesSnapshot final {
    MemorySnapshot memory;
    WorkingMemorySnapshot working;
    LongTermMemorySnapshot long_term;
    SemanticMemorySnapshot semantic;
    EpisodicMemorySnapshot episodic;
    ProceduralMemorySnapshot procedural;
    std::vector<ReflectionSnapshot> reflections;
    bool operator==(const SourcesSnapshot&) const = default;
};

struct RequestSnapshot final {
    std::string workspace_identifier;
    std::string provider_identifier;
    std::optional<MemorySnapshot> memory;
    std::optional<WorkingMemorySnapshot> working;
    std::optional<LongTermMemorySnapshot> long_term;
    std::optional<SemanticMemorySnapshot> semantic;
    std::optional<EpisodicMemorySnapshot> episodic;
    std::optional<ProceduralMemorySnapshot> procedural;
    std::vector<ReflectionSnapshot> reflections;
    bool operator==(const RequestSnapshot&) const = default;
};

struct DescriptorSnapshot final {
    std::string workspace_identifier;
    std::string identifier;
    bool operator==(const DescriptorSnapshot&) const = default;
};

struct SessionSnapshot final {
    std::string workspace_identifier;
    SessionState state;
    std::vector<DescriptorSnapshot> descriptors;
    bool operator==(const SessionSnapshot&) const = default;
};

struct FixtureSnapshot final {
    SourcesSnapshot sources;
    RequestSnapshot request;
    DescriptorSnapshot descriptor;
    SessionSnapshot session;
    bool operator==(const FixtureSnapshot&) const = default;
};

template <typename Result>
void require_ok(const Result& result) {
    if (!result.succeeded()) {
        throw std::logic_error{result.code() + ": " + result.message()};
    }
}

[[nodiscard]] EntrySnapshot snapshot_of(const MemoryEntry& value) {
    return {value.identifier(), value.value()};
}

[[nodiscard]] WorkingEntrySnapshot snapshot_of(
    const WorkingMemoryEntry& value) {
    return {value.identifier(), value.value(), value.expirationPoint()};
}

[[nodiscard]] LongTermEntrySnapshot snapshot_of(
    const LongTermMemoryEntry& value) {
    return {value.identifier(), value.value(), value.archived()};
}

[[nodiscard]] std::vector<LongTermEntrySnapshot> snapshot_entries(
    const std::vector<LongTermMemoryEntry>& values) {
    std::vector<LongTermEntrySnapshot> result;
    result.reserve(values.size());
    for (const auto& value : values) {
        result.push_back(snapshot_of(value));
    }
    return result;
}

[[nodiscard]] SemanticConceptSnapshot snapshot_of(
    const SemanticConcept& value) {
    return {value.identifier(),
            value.meaning(),
            snapshot_entries(value.sourceEntries()),
            value.categories(),
            value.linkedConceptIdentifiers()};
}

[[nodiscard]] EpisodeSnapshot snapshot_of(const Episode& value) {
    return {value.identifier(),
            value.occurrence(),
            value.context(),
            value.chronology(),
            snapshot_entries(value.sourceEntries()),
            value.linkedEpisodeIdentifiers()};
}

[[nodiscard]] ProcedureSnapshot snapshot_of(const Procedure& value) {
    return {value.identifier(),
            value.activity(),
            value.steps(),
            snapshot_entries(value.sourceEntries()),
            value.linkedProcedureIdentifiers()};
}

[[nodiscard]] CandidateSnapshot snapshot_of(const KnowledgeCandidate& value) {
    std::optional<SemanticConceptSnapshot> semantic;
    if (value.semanticConcept() != nullptr) {
        semantic = snapshot_of(*value.semanticConcept());
    }
    std::optional<EpisodeSnapshot> episodic;
    if (value.episode() != nullptr) {
        episodic = snapshot_of(*value.episode());
    }
    std::optional<ProcedureSnapshot> procedural;
    if (value.procedure() != nullptr) {
        procedural = snapshot_of(*value.procedure());
    }
    return {value.kind(),
            value.workspaceIdentifier(),
            value.sourceIdentifier(),
            value.rankScore(),
            std::move(semantic),
            std::move(episodic),
            std::move(procedural)};
}

[[nodiscard]] ReflectionSnapshot snapshot_of(const Reflection& value) {
    std::vector<CandidateSnapshot> candidates;
    candidates.reserve(value.sourceCandidates().size());
    for (const auto& candidate : value.sourceCandidates()) {
        candidates.push_back(snapshot_of(candidate));
    }
    return {value.workspaceIdentifier(),
            value.identifier(),
            value.knowledge(),
            std::move(candidates),
            value.sourceExplanationChains()};
}

[[nodiscard]] MemorySnapshot snapshot_of(const Memory& value) {
    std::vector<EntrySnapshot> entries;
    entries.reserve(value.entries().size());
    for (const auto& entry : value.entries()) {
        entries.push_back(snapshot_of(entry));
    }
    return {value.workspaceIdentifier(), std::move(entries)};
}

[[nodiscard]] WorkingMemorySnapshot snapshot_of(const WorkingMemory& value) {
    std::vector<WorkingEntrySnapshot> entries;
    entries.reserve(value.entries().size());
    for (const auto& entry : value.entries()) {
        entries.push_back(snapshot_of(entry));
    }
    return {value.workspaceIdentifier(),
            value.active(),
            value.activeTaskIdentifier(),
            std::move(entries)};
}

[[nodiscard]] std::string forgotten_disposition(
    const LongTermMemory& value) {
    LongTermMemory probe{value};
    const auto result = LongTermMemoryEngine{}.retain(
        probe,
        LongTermMemoryEntry{
            std::string{long_term_forgotten_identifier},
            "provider-allocation-long-term-probe-value-with-long-content"});
    return result.code();
}

[[nodiscard]] LongTermMemorySnapshot snapshot_of(
    const LongTermMemory& value) {
    std::vector<LongTermEntrySnapshot> entries;
    entries.reserve(value.entries().size());
    for (const auto& entry : value.entries()) {
        entries.push_back(snapshot_of(entry));
    }
    return {value.workspaceIdentifier(),
            std::move(entries),
            forgotten_disposition(value)};
}

[[nodiscard]] const LongTermMemoryEntry& semantic_source(
    const LongTermMemory& evidence) {
    const auto* const source = evidence.find(long_term_semantic_source);
    if (source == nullptr) {
        throw std::logic_error{"semantic evidence is missing"};
    }
    return *source;
}

[[nodiscard]] const LongTermMemoryEntry& episodic_source(
    const LongTermMemory& evidence) {
    const auto* const source = evidence.find(long_term_episode_source);
    if (source == nullptr) {
        throw std::logic_error{"episodic evidence is missing"};
    }
    return *source;
}

[[nodiscard]] const LongTermMemoryEntry& procedural_source(
    const LongTermMemory& evidence) {
    const auto* const source = evidence.find(long_term_procedure_source);
    if (source == nullptr) {
        throw std::logic_error{"procedural evidence is missing"};
    }
    return *source;
}

[[nodiscard]] std::string forgotten_disposition(
    const SemanticMemory& value,
    const LongTermMemory& evidence) {
    SemanticMemory probe{value};
    const auto result = SemanticMemoryEngine{}.classify(
        probe,
        evidence,
        SemanticConcept{
            std::string{semantic_forgotten_identifier},
            "provider-allocation-semantic-probe-meaning-with-long-content",
            {semantic_source(evidence)}});
    return result.code();
}

[[nodiscard]] SemanticMemorySnapshot snapshot_of(
    const SemanticMemory& value,
    const LongTermMemory& evidence) {
    std::vector<SemanticConceptSnapshot> concepts;
    concepts.reserve(value.concepts().size());
    for (const auto& semantic_concept : value.concepts()) {
        concepts.push_back(snapshot_of(semantic_concept));
    }
    return {value.workspaceIdentifier(),
            std::move(concepts),
            forgotten_disposition(value, evidence)};
}

[[nodiscard]] std::string forgotten_disposition(
    const EpisodicMemory& value,
    const LongTermMemory& evidence) {
    EpisodicMemory probe{value};
    const auto result = EpisodicMemoryEngine{}.derive(
        probe,
        evidence,
        Episode{
            std::string{episode_forgotten_identifier},
            "provider-allocation-episodic-probe-occurrence-with-long-content",
            "provider-allocation-episodic-probe-context-with-long-content",
            99,
            {episodic_source(evidence)}});
    return result.code();
}

[[nodiscard]] EpisodicMemorySnapshot snapshot_of(
    const EpisodicMemory& value,
    const LongTermMemory& evidence) {
    std::vector<EpisodeSnapshot> episodes;
    episodes.reserve(value.episodes().size());
    for (const auto& episode : value.episodes()) {
        episodes.push_back(snapshot_of(episode));
    }
    return {value.workspaceIdentifier(),
            std::move(episodes),
            forgotten_disposition(value, evidence)};
}

[[nodiscard]] std::string forgotten_disposition(
    const ProceduralMemory& value,
    const LongTermMemory& evidence) {
    ProceduralMemory probe{value};
    const auto result = ProceduralMemoryEngine{}.derive(
        probe,
        evidence,
        Procedure{
            std::string{procedure_forgotten_identifier},
            "provider-allocation-procedural-probe-activity-with-long-content",
            {"provider-allocation-procedural-probe-step-with-long-content"},
            {procedural_source(evidence)}});
    return result.code();
}

[[nodiscard]] ProceduralMemorySnapshot snapshot_of(
    const ProceduralMemory& value,
    const LongTermMemory& evidence) {
    std::vector<ProcedureSnapshot> procedures;
    procedures.reserve(value.procedures().size());
    for (const auto& procedure : value.procedures()) {
        procedures.push_back(snapshot_of(procedure));
    }
    return {value.workspaceIdentifier(),
            std::move(procedures),
            forgotten_disposition(value, evidence)};
}

struct Sources final {
    Memory memory{std::string{workspace}};
    WorkingMemory working{std::string{workspace}};
    LongTermMemory long_term{std::string{workspace}};
    SemanticMemory semantic{std::string{workspace}};
    EpisodicMemory episodic{std::string{workspace}};
    ProceduralMemory procedural{std::string{workspace}};
    std::vector<Reflection> reflections;

    Sources() {
        require_ok(MemoryEngine{}.store(
            memory,
            MemoryEntry{
                "provider-allocation-memory-a-with-a-long-identifier",
                "provider-allocation-memory-a-value-with-long-content"}));
        require_ok(MemoryEngine{}.store(
            memory,
            MemoryEntry{
                "provider-allocation-memory-b-with-a-long-identifier",
                "provider-allocation-memory-b-value-with-long-content"}));

        require_ok(WorkingMemoryEngine{}.activate(
            working,
            "provider-allocation-active-task-with-a-long-identifier"));
        require_ok(WorkingMemoryEngine{}.store(
            working,
            WorkingMemoryEntry{
                "provider-allocation-working-a-with-a-long-identifier",
                "provider-allocation-working-a-value-with-long-content",
                200U}));
        require_ok(WorkingMemoryEngine{}.store(
            working,
            WorkingMemoryEntry{
                "provider-allocation-working-b-with-a-long-identifier",
                "provider-allocation-working-b-value-with-long-content"}));

        require_ok(LongTermMemoryEngine{}.retain(
            long_term,
            LongTermMemoryEntry{
                std::string{long_term_semantic_source},
                "provider-allocation-semantic-evidence-value-long-content"}));
        require_ok(LongTermMemoryEngine{}.retain(
            long_term,
            LongTermMemoryEntry{
                std::string{long_term_episode_source},
                "provider-allocation-episodic-evidence-value-long-content"}));
        require_ok(LongTermMemoryEngine{}.retain(
            long_term,
            LongTermMemoryEntry{
                std::string{long_term_procedure_source},
                "provider-allocation-procedural-evidence-value-long-content"}));
        require_ok(LongTermMemoryEngine{}.retain(
            long_term,
            LongTermMemoryEntry{
                "provider-allocation-archived-evidence-with-long-identifier",
                "provider-allocation-archived-evidence-value-long-content"}));
        require_ok(LongTermMemoryEngine{}.archive(
            long_term,
            "provider-allocation-archived-evidence-with-long-identifier"));
        require_ok(LongTermMemoryEngine{}.retain(
            long_term,
            LongTermMemoryEntry{
                std::string{long_term_forgotten_identifier},
                "provider-allocation-forgotten-evidence-value-long-content"}));
        require_ok(LongTermMemoryEngine{}.forget(
            long_term, long_term_forgotten_identifier));

        require_ok(SemanticMemoryEngine{}.classify(
            semantic,
            long_term,
            SemanticConcept{
                std::string{semantic_identifier},
                "provider-allocation-semantic-meaning-with-long-content",
                {semantic_source(long_term)}}));
        require_ok(SemanticMemoryEngine{}.categorize(
            semantic,
            semantic_identifier,
            "provider-allocation-semantic-category-with-long-content"));
        require_ok(SemanticMemoryEngine{}.classify(
            semantic,
            long_term,
            SemanticConcept{
                std::string{semantic_forgotten_identifier},
                "provider-allocation-forgotten-semantic-meaning-long-content",
                {semantic_source(long_term)}}));
        require_ok(SemanticMemoryEngine{}.forget(
            semantic, semantic_forgotten_identifier));

        require_ok(EpisodicMemoryEngine{}.derive(
            episodic,
            long_term,
            Episode{
                std::string{episode_identifier},
                "provider-allocation-episode-occurrence-with-long-content",
                "provider-allocation-episode-context-with-long-content",
                41,
                {episodic_source(long_term)}}));
        require_ok(EpisodicMemoryEngine{}.derive(
            episodic,
            long_term,
            Episode{
                std::string{episode_forgotten_identifier},
                "provider-allocation-forgotten-episode-occurrence-long-content",
                "provider-allocation-forgotten-episode-context-long-content",
                42,
                {episodic_source(long_term)}}));
        require_ok(EpisodicMemoryEngine{}.forget(
            episodic, episode_forgotten_identifier));

        require_ok(ProceduralMemoryEngine{}.derive(
            procedural,
            long_term,
            Procedure{
                std::string{procedure_identifier},
                "provider-allocation-procedure-activity-with-long-content",
                {"provider-allocation-step-a-with-long-content",
                 "provider-allocation-step-a-with-long-content"},
                {procedural_source(long_term)}}));
        require_ok(ProceduralMemoryEngine{}.derive(
            procedural,
            long_term,
            Procedure{
                std::string{procedure_forgotten_identifier},
                "provider-allocation-forgotten-procedure-activity-long-content",
                {"provider-allocation-forgotten-step-with-long-content"},
                {procedural_source(long_term)}}));
        require_ok(ProceduralMemoryEngine{}.forget(
            procedural, procedure_forgotten_identifier));

        RetrievalSession retrieval{std::string{workspace}};
        require_ok(MemoryRetrievalEngine{}.search(
            retrieval,
            semantic,
            episodic,
            procedural,
            KnowledgeQuery{""}));
        require_ok(MemoryRetrievalEngine{}.rank(retrieval));

        ReflectionSession reflection_session{std::string{workspace}};
        require_ok(MemoryReflectionEngine{}.reflect(
            reflection_session,
            ReflectionQuery{
                std::string{workspace},
                "provider-allocation-reflection-with-a-long-identifier",
                "provider-allocation-reflected-knowledge-with-long-content"},
            retrieval));
        const auto reflected = MemoryReflectionEngine{}.derive(
            reflection_session, semantic, episodic, procedural);
        require_ok(reflected);
        if (reflected.reflection() == nullptr) {
            throw std::logic_error{"allocation fixture Reflection is missing"};
        }
        reflections.push_back(*reflected.reflection());
    }
};

[[nodiscard]] SourcesSnapshot snapshot_of(const Sources& value) {
    std::vector<ReflectionSnapshot> reflections;
    reflections.reserve(value.reflections.size());
    for (const auto& reflection : value.reflections) {
        reflections.push_back(snapshot_of(reflection));
    }
    return {snapshot_of(value.memory),
            snapshot_of(value.working),
            snapshot_of(value.long_term),
            snapshot_of(value.semantic, value.long_term),
            snapshot_of(value.episodic, value.long_term),
            snapshot_of(value.procedural, value.long_term),
            std::move(reflections)};
}

[[nodiscard]] RequestSnapshot snapshot_of(const ProviderRequest& value) {
    const auto* const long_term = value.longTermMemory();

    std::optional<MemorySnapshot> memory;
    if (value.memory() != nullptr) {
        memory = snapshot_of(*value.memory());
    }
    std::optional<WorkingMemorySnapshot> working;
    if (value.workingMemory() != nullptr) {
        working = snapshot_of(*value.workingMemory());
    }
    std::optional<LongTermMemorySnapshot> long_term_snapshot;
    if (long_term != nullptr) {
        long_term_snapshot = snapshot_of(*long_term);
    }
    std::optional<SemanticMemorySnapshot> semantic;
    if (value.semanticMemory() != nullptr && long_term != nullptr) {
        semantic = snapshot_of(*value.semanticMemory(), *long_term);
    }
    std::optional<EpisodicMemorySnapshot> episodic;
    if (value.episodicMemory() != nullptr && long_term != nullptr) {
        episodic = snapshot_of(*value.episodicMemory(), *long_term);
    }
    std::optional<ProceduralMemorySnapshot> procedural;
    if (value.proceduralMemory() != nullptr && long_term != nullptr) {
        procedural = snapshot_of(*value.proceduralMemory(), *long_term);
    }
    std::vector<ReflectionSnapshot> reflections;
    reflections.reserve(value.reflections().size());
    for (const auto& reflection : value.reflections()) {
        reflections.push_back(snapshot_of(reflection));
    }

    return {value.workspaceIdentifier(),
            value.providerIdentifier(),
            std::move(memory),
            std::move(working),
            std::move(long_term_snapshot),
            std::move(semantic),
            std::move(episodic),
            std::move(procedural),
            std::move(reflections)};
}

[[nodiscard]] DescriptorSnapshot snapshot_of(
    const ProviderDescriptor& value) {
    return {value.workspaceIdentifier(), value.identifier()};
}

[[nodiscard]] std::vector<DescriptorSnapshot> snapshot_descriptors(
    const std::vector<ProviderDescriptor>& values) {
    std::vector<DescriptorSnapshot> result;
    result.reserve(values.size());
    for (const auto& value : values) {
        result.push_back(snapshot_of(value));
    }
    return result;
}

[[nodiscard]] SessionSnapshot snapshot_of(const ProviderSession& value) {
    return {value.workspaceIdentifier(),
            value.state(),
            snapshot_descriptors(value.descriptors())};
}

struct Fixture final {
    Sources sources;
    ProviderRequest request;
    ProviderDescriptor descriptor;
    ProviderSession session{std::string{workspace}};
    MemoryProviderEngine engine;

    Fixture(
        std::string request_workspace = std::string{workspace},
        std::string request_provider = std::string{provider_identifier},
        std::string descriptor_workspace = std::string{workspace},
        std::string descriptor_provider = std::string{provider_identifier})
        : request{std::move(request_workspace),
                  std::move(request_provider),
                  sources.memory,
                  sources.working,
                  sources.long_term,
                  sources.semantic,
                  sources.episodic,
                  sources.procedural,
                  sources.reflections},
          descriptor{std::move(descriptor_workspace),
                     std::move(descriptor_provider)} {}
};

[[nodiscard]] FixtureSnapshot snapshot_of(const Fixture& value) {
    return {snapshot_of(value.sources),
            snapshot_of(value.request),
            snapshot_of(value.descriptor),
            snapshot_of(value.session)};
}

void register_provider(Fixture& fixture) {
    require_ok(fixture.engine.registerProvider(fixture.session,
                                               fixture.descriptor));
}

[[nodiscard]] Fixture registered_fixture(
    std::string request_workspace = std::string{workspace},
    std::string request_provider = std::string{provider_identifier}) {
    Fixture fixture{std::move(request_workspace), std::move(request_provider)};
    register_provider(fixture);
    return fixture;
}

[[nodiscard]] Fixture exported_fixture() {
    auto fixture = registered_fixture();
    require_ok(fixture.engine.exportState(fixture.session, fixture.request));
    return fixture;
}

[[nodiscard]] Fixture imported_fixture() {
    auto fixture = registered_fixture();
    require_ok(fixture.engine.importState(fixture.session, fixture.request));
    return fixture;
}

[[nodiscard]] Fixture forgotten_fixture() {
    auto fixture = registered_fixture();
    require_ok(fixture.engine.forgetSession(fixture.session));
    return fixture;
}

struct ExpectedOutcome final {
    std::string_view code;
    SessionState state;
    std::size_t session_size;
    bool session_changes;
    bool request_payload;
    std::size_t descriptor_payload_size;
};

constexpr std::size_t allocation_campaign_limit = 16384U;

template <typename Arrange, typename Operation>
void verify_strong_guarantee(Arrange arrange,
                             Operation operation,
                             const ExpectedOutcome expected) {
    std::size_t observed_failures = 0U;
    bool completed = false;

    for (std::size_t index = 0U; index < allocation_campaign_limit; ++index) {
        auto fixture = arrange();
        const auto before = snapshot_of(fixture);

        memory_provider_allocation_failure_support::fail_after(index);
        try {
            const ProviderResult result = operation(fixture);
            memory_provider_allocation_failure_support::disable();

            EXPECT_EQ(result.code(), expected.code);
            EXPECT_EQ(result.succeeded(), expected.code == "OK");
            if (expected.code == "OK") {
                EXPECT_TRUE(result.message().empty());
            } else {
                EXPECT_FALSE(result.message().empty());
            }
            EXPECT_EQ(result.request() != nullptr, expected.request_payload);
            EXPECT_EQ(result.descriptors().size(),
                      expected.descriptor_payload_size);
            EXPECT_EQ(fixture.session.state(), expected.state);
            EXPECT_EQ(fixture.session.size(), expected.session_size);

            if (result.request() != nullptr) {
                EXPECT_EQ(snapshot_of(*result.request()), before.request);
            }
            if (!result.descriptors().empty()) {
                EXPECT_EQ(snapshot_descriptors(result.descriptors()),
                          before.session.descriptors);
            }

            if (expected.session_changes) {
                EXPECT_EQ(snapshot_of(fixture.sources), before.sources);
                EXPECT_EQ(snapshot_of(fixture.request), before.request);
                EXPECT_EQ(snapshot_of(fixture.descriptor), before.descriptor);
                EXPECT_NE(snapshot_of(fixture.session), before.session);
            } else {
                EXPECT_EQ(snapshot_of(fixture), before);
            }

            completed = true;
            break;
        } catch (const std::bad_alloc&) {
            memory_provider_allocation_failure_support::disable();
            ++observed_failures;
            EXPECT_EQ(snapshot_of(fixture), before);
        } catch (...) {
            memory_provider_allocation_failure_support::disable();
            throw;
        }
    }

    memory_provider_allocation_failure_support::disable();
    EXPECT_TRUE(completed);
    EXPECT_GT(observed_failures, 0U);
}

TEST(MemoryProviderAllocationFailureTest,
     NewRegistrationIsAtomicAtEveryAllocationFailure) {
    verify_strong_guarantee(
        [] { return Fixture{}; },
        [](Fixture& fixture) {
            return fixture.engine.registerProvider(fixture.session,
                                                   fixture.descriptor);
        },
        {"OK", SessionState::Open, 1U, true, false, 0U});
}

TEST(MemoryProviderAllocationFailureTest,
     ExportIsAtomicAndPreservesEverySourceAtEveryAllocationFailure) {
    verify_strong_guarantee(
        [] { return registered_fixture(); },
        [](Fixture& fixture) {
            return fixture.engine.exportState(fixture.session,
                                              fixture.request);
        },
        {"OK", SessionState::Exported, 1U, true, true, 0U});
}

TEST(MemoryProviderAllocationFailureTest,
     ImportIsAtomicAndPreservesEverySourceAtEveryAllocationFailure) {
    verify_strong_guarantee(
        [] { return registered_fixture(); },
        [](Fixture& fixture) {
            return fixture.engine.importState(fixture.session,
                                              fixture.request);
        },
        {"OK", SessionState::Imported, 1U, true, true, 0U});
}

TEST(MemoryProviderAllocationFailureTest,
     ValidateSuccessPreservesCompleteStateAtEveryAllocationFailure) {
    verify_strong_guarantee(
        [] { return registered_fixture(); },
        [](Fixture& fixture) {
            return fixture.engine.validate(fixture.session, fixture.request);
        },
        {"OK", SessionState::Open, 1U, false, false, 0U});
}

TEST(MemoryProviderAllocationFailureTest,
     ValidateFailureConstructionPreservesCompleteState) {
    verify_strong_guarantee(
        [] {
            return registered_fixture(std::string{other_workspace});
        },
        [](Fixture& fixture) {
            return fixture.engine.validate(fixture.session, fixture.request);
        },
        {"WORKSPACE_MISMATCH",
         SessionState::Open,
         1U,
         false,
         false,
         0U});
}

TEST(MemoryProviderAllocationFailureTest,
     EmptyEnumerationPreservesCompleteStateAtEveryAllocationFailure) {
    verify_strong_guarantee(
        [] { return Fixture{}; },
        [](Fixture& fixture) {
            return fixture.engine.enumerate(fixture.session);
        },
        {"OK", SessionState::Open, 0U, false, false, 0U});
}

TEST(MemoryProviderAllocationFailureTest,
     PopulatedEnumerationPreservesCompleteStateAtEveryAllocationFailure) {
    verify_strong_guarantee(
        [] { return registered_fixture(); },
        [](Fixture& fixture) {
            return fixture.engine.enumerate(fixture.session);
        },
        {"OK", SessionState::Open, 1U, false, false, 1U});
}

TEST(MemoryProviderAllocationFailureTest,
     ForgetFromOpenIsAtomicAtEveryAllocationFailure) {
    verify_strong_guarantee(
        [] { return registered_fixture(); },
        [](Fixture& fixture) {
            return fixture.engine.forgetSession(fixture.session);
        },
        {"OK", SessionState::Forgotten, 0U, true, false, 0U});
}

TEST(MemoryProviderAllocationFailureTest,
     ForgetFromExportedIsAtomicAtEveryAllocationFailure) {
    verify_strong_guarantee(
        [] { return exported_fixture(); },
        [](Fixture& fixture) {
            return fixture.engine.forgetSession(fixture.session);
        },
        {"OK", SessionState::Forgotten, 0U, true, false, 0U});
}

TEST(MemoryProviderAllocationFailureTest,
     ForgetFromImportedIsAtomicAtEveryAllocationFailure) {
    verify_strong_guarantee(
        [] { return imported_fixture(); },
        [](Fixture& fixture) {
            return fixture.engine.forgetSession(fixture.session);
        },
        {"OK", SessionState::Forgotten, 0U, true, false, 0U});
}

TEST(MemoryProviderAllocationFailureTest,
     CompletedLifecycleFailureConstructionPreservesCompleteState) {
    verify_strong_guarantee(
        [] { return exported_fixture(); },
        [](Fixture& fixture) {
            return fixture.engine.registerProvider(fixture.session,
                                                   fixture.descriptor);
        },
        {"SESSION_ALREADY_COMPLETED",
         SessionState::Exported,
         1U,
         false,
         false,
         0U});
}

TEST(MemoryProviderAllocationFailureTest,
     ForgottenLifecycleFailureConstructionPreservesCompleteState) {
    verify_strong_guarantee(
        [] { return forgotten_fixture(); },
        [](Fixture& fixture) {
            return fixture.engine.enumerate(fixture.session);
        },
        {"SESSION_FORGOTTEN",
         SessionState::Forgotten,
         0U,
         false,
         false,
         0U});
}

TEST(MemoryProviderAllocationFailureTest,
     DescriptorWorkspaceFailureConstructionPreservesCompleteState) {
    verify_strong_guarantee(
        [] {
            return Fixture{std::string{workspace},
                           std::string{provider_identifier},
                           std::string{other_workspace},
                           std::string{provider_identifier}};
        },
        [](Fixture& fixture) {
            return fixture.engine.registerProvider(fixture.session,
                                                   fixture.descriptor);
        },
        {"WORKSPACE_MISMATCH",
         SessionState::Open,
         0U,
         false,
         false,
         0U});
}

TEST(MemoryProviderAllocationFailureTest,
     InvalidIdentityFailureConstructionPreservesCompleteState) {
    verify_strong_guarantee(
        [] {
            return Fixture{std::string{workspace},
                           std::string{provider_identifier},
                           std::string{workspace},
                           std::string{}};
        },
        [](Fixture& fixture) {
            return fixture.engine.registerProvider(fixture.session,
                                                   fixture.descriptor);
        },
        {"INVALID_PROVIDER_IDENTIFIER",
         SessionState::Open,
         0U,
         false,
         false,
         0U});
}

TEST(MemoryProviderAllocationFailureTest,
     RegistrationFailureConstructionPreservesCompleteState) {
    verify_strong_guarantee(
        [] {
            return registered_fixture(
                std::string{workspace},
                std::string{unregistered_provider_identifier});
        },
        [](Fixture& fixture) {
            return fixture.engine.validate(fixture.session, fixture.request);
        },
        {"PROVIDER_NOT_REGISTERED",
         SessionState::Open,
         1U,
         false,
         false,
         0U});
}

} // namespace
