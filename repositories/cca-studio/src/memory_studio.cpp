#include <cca/memory/memory_studio.hpp>

#include <algorithm>
#include <array>
#include <charconv>
#include <limits>
#include <stdexcept>
#include <string_view>
#include <utility>

namespace cca::memory {
namespace {

constexpr std::string_view ok_code{"OK"};
constexpr std::string_view session_forgotten_code{"SESSION_FORGOTTEN"};
constexpr std::string_view session_not_observed_code{
    "SESSION_NOT_OBSERVED"};
constexpr std::string_view workspace_mismatch_code{"WORKSPACE_MISMATCH"};
constexpr std::string_view invalid_view_code{"INVALID_VIEW"};
constexpr std::string_view invalid_query_code{"INVALID_QUERY"};
constexpr std::string_view not_found_code{"NOT_FOUND"};

constexpr std::string_view session_forgotten_message{
    "studio session is forgotten"};
constexpr std::string_view session_not_observed_message{
    "studio session has no observed view"};
constexpr std::string_view workspace_mismatch_message{
    "workspace identifiers do not match"};
constexpr std::string_view invalid_view_message{"studio view is invalid"};
constexpr std::string_view invalid_query_message{"studio query is invalid"};
constexpr std::string_view not_found_message{
    "studio query matched no observation"};

const std::string& empty_string() noexcept {
    static const std::string value;
    return value;
}

template <typename Value>
const std::vector<Value>& empty_sequence() noexcept {
    static const std::vector<Value> value;
    return value;
}

enum class ViewValidation { Valid, InvalidView, WorkspaceMismatch };

template <typename Value>
bool has_workspace(const Value& value,
                   const std::string_view workspaceIdentifier) noexcept {
    return value.workspaceIdentifier() == workspaceIdentifier;
}

bool candidates_have_workspace(
    const std::vector<KnowledgeCandidate>& candidates,
    const std::string_view workspaceIdentifier) noexcept {
    return std::all_of(
        candidates.cbegin(), candidates.cend(),
        [workspaceIdentifier](const KnowledgeCandidate& candidate) {
            return has_workspace(candidate, workspaceIdentifier);
        });
}

ViewValidation validate_view(const StudioView& view) noexcept {
    if (view.memory() == nullptr || view.workingMemory() == nullptr ||
        view.longTermMemory() == nullptr ||
        view.semanticMemory() == nullptr ||
        view.episodicMemory() == nullptr ||
        view.proceduralMemory() == nullptr) {
        return ViewValidation::InvalidView;
    }

    const auto& workspace = view.workspaceIdentifier();
    if (!has_workspace(*view.memory(), workspace) ||
        !has_workspace(*view.workingMemory(), workspace) ||
        !has_workspace(*view.longTermMemory(), workspace) ||
        !has_workspace(*view.semanticMemory(), workspace) ||
        !has_workspace(*view.episodicMemory(), workspace) ||
        !has_workspace(*view.proceduralMemory(), workspace)) {
        return ViewValidation::WorkspaceMismatch;
    }

    for (const auto& session : view.retrievalSessions()) {
        if (!has_workspace(session, workspace) ||
            !candidates_have_workspace(session.candidates(), workspace)) {
            return ViewValidation::WorkspaceMismatch;
        }
    }

    for (const auto& session : view.consolidationSessions()) {
        if (!has_workspace(session, workspace)) {
            return ViewValidation::WorkspaceMismatch;
        }
        if (session.request() != nullptr &&
            !has_workspace(*session.request(), workspace)) {
            return ViewValidation::WorkspaceMismatch;
        }
        if (session.candidate() != nullptr &&
            !has_workspace(*session.candidate(), workspace)) {
            return ViewValidation::WorkspaceMismatch;
        }
        if (session.workingMemory() != nullptr &&
            !has_workspace(*session.workingMemory(), workspace)) {
            return ViewValidation::WorkspaceMismatch;
        }
        if (session.longTermMemory() != nullptr &&
            !has_workspace(*session.longTermMemory(), workspace)) {
            return ViewValidation::WorkspaceMismatch;
        }
    }

    for (const auto& reflection : view.reflections()) {
        if (!has_workspace(reflection, workspace) ||
            !candidates_have_workspace(reflection.sourceCandidates(),
                                       workspace)) {
            return ViewValidation::WorkspaceMismatch;
        }
    }

    for (const auto& session : view.reflectionSessions()) {
        if (!has_workspace(session, workspace)) {
            return ViewValidation::WorkspaceMismatch;
        }
        if (session.query() != nullptr &&
            !has_workspace(*session.query(), workspace)) {
            return ViewValidation::WorkspaceMismatch;
        }
        if (!candidates_have_workspace(session.sourceCandidates(),
                                       workspace)) {
            return ViewValidation::WorkspaceMismatch;
        }
        if (session.reflection() != nullptr) {
            if (!has_workspace(*session.reflection(), workspace) ||
                !candidates_have_workspace(
                    session.reflection()->sourceCandidates(), workspace)) {
                return ViewValidation::WorkspaceMismatch;
            }
        }
    }

    for (const auto& session : view.providerSessions()) {
        if (!has_workspace(session, workspace)) {
            return ViewValidation::WorkspaceMismatch;
        }
        for (const auto& descriptor : session.descriptors()) {
            if (!has_workspace(descriptor, workspace)) {
                return ViewValidation::WorkspaceMismatch;
            }
        }
    }

    return ViewValidation::Valid;
}

bool valid_scope(const StudioQuery::Scope scope) noexcept {
    switch (scope) {
    case StudioQuery::Scope::Complete:
    case StudioQuery::Scope::Memory:
    case StudioQuery::Scope::WorkingMemory:
    case StudioQuery::Scope::LongTermMemory:
    case StudioQuery::Scope::SemanticMemory:
    case StudioQuery::Scope::EpisodicMemory:
    case StudioQuery::Scope::ProceduralMemory:
    case StudioQuery::Scope::Retrieval:
    case StudioQuery::Scope::Consolidation:
    case StudioQuery::Scope::Reflection:
    case StudioQuery::Scope::Providers:
        return true;
    }
    return false;
}

void append_decimal(std::string& destination, const std::size_t value) {
    std::array<char, std::numeric_limits<std::size_t>::digits10 + 1U> buffer{};
    const auto converted =
        std::to_chars(buffer.data(), buffer.data() + buffer.size(), value);
    if (converted.ec != std::errc{}) {
        throw std::length_error{"studio index is not representable"};
    }
    destination.append(buffer.data(), converted.ptr);
}

std::string indexed_path(const std::string_view prefix,
                         const std::size_t index) {
    std::string path{prefix};
    path.push_back('[');
    append_decimal(path, index);
    path.push_back(']');
    return path;
}

std::string nested_indexed_path(const std::string_view prefix,
                                const std::size_t outerIndex,
                                const std::string_view nestedLabel,
                                const std::size_t nestedIndex) {
    auto path = indexed_path(prefix, outerIndex);
    path.append(nestedLabel);
    path.push_back('[');
    append_decimal(path, nestedIndex);
    path.push_back(']');
    return path;
}

void select_memory(const StudioView& view,
                   const std::string_view identifier,
                   std::vector<std::string>& observations) {
    const auto& entries = view.memory()->entries();
    if (identifier.empty()) {
        observations.emplace_back("Memory");
    }
    for (std::size_t index = 0U; index < entries.size(); ++index) {
        if (identifier.empty() || entries[index].identifier() == identifier) {
            observations.push_back(indexed_path("Memory.entries", index));
        }
    }
}

void select_working_memory(const StudioView& view,
                           const std::string_view identifier,
                           std::vector<std::string>& observations) {
    const auto& entries = view.workingMemory()->entries();
    if (identifier.empty()) {
        observations.emplace_back("WorkingMemory");
    }
    for (std::size_t index = 0U; index < entries.size(); ++index) {
        if (identifier.empty() || entries[index].identifier() == identifier) {
            observations.push_back(
                indexed_path("WorkingMemory.entries", index));
        }
    }
}

void select_long_term_memory(const StudioView& view,
                             const std::string_view identifier,
                             std::vector<std::string>& observations) {
    const auto& entries = view.longTermMemory()->entries();
    if (identifier.empty()) {
        observations.emplace_back("LongTermMemory");
    }
    for (std::size_t index = 0U; index < entries.size(); ++index) {
        if (identifier.empty() || entries[index].identifier() == identifier) {
            observations.push_back(
                indexed_path("LongTermMemory.entries", index));
        }
    }
}

void select_semantic_memory(const StudioView& view,
                            const std::string_view identifier,
                            std::vector<std::string>& observations) {
    const auto& concepts = view.semanticMemory()->concepts();
    if (identifier.empty()) {
        observations.emplace_back("SemanticMemory");
    }
    for (std::size_t index = 0U; index < concepts.size(); ++index) {
        if (identifier.empty() || concepts[index].identifier() == identifier) {
            observations.push_back(
                indexed_path("SemanticMemory.concepts", index));
        }
    }
}

void select_episodic_memory(const StudioView& view,
                            const std::string_view identifier,
                            std::vector<std::string>& observations) {
    const auto& episodes = view.episodicMemory()->episodes();
    if (identifier.empty()) {
        observations.emplace_back("EpisodicMemory");
    }
    for (std::size_t index = 0U; index < episodes.size(); ++index) {
        if (identifier.empty() || episodes[index].identifier() == identifier) {
            observations.push_back(
                indexed_path("EpisodicMemory.episodes", index));
        }
    }
}

void select_procedural_memory(const StudioView& view,
                              const std::string_view identifier,
                              std::vector<std::string>& observations) {
    const auto& procedures = view.proceduralMemory()->procedures();
    if (identifier.empty()) {
        observations.emplace_back("ProceduralMemory");
    }
    for (std::size_t index = 0U; index < procedures.size(); ++index) {
        if (identifier.empty() ||
            procedures[index].identifier() == identifier) {
            observations.push_back(
                indexed_path("ProceduralMemory.procedures", index));
        }
    }
}

void select_retrieval(const StudioView& view,
                      const std::string_view identifier,
                      std::vector<std::string>& observations) {
    const auto& sessions = view.retrievalSessions();
    for (std::size_t session_index = 0U; session_index < sessions.size();
         ++session_index) {
        if (identifier.empty()) {
            observations.push_back(
                indexed_path("Retrieval.sessions", session_index));
        }
        const auto& candidates = sessions[session_index].candidates();
        for (std::size_t candidate_index = 0U;
             candidate_index < candidates.size(); ++candidate_index) {
            if (identifier.empty() ||
                candidates[candidate_index].sourceIdentifier() == identifier) {
                observations.push_back(nested_indexed_path(
                    "Retrieval.sessions", session_index, ".candidates",
                    candidate_index));
            }
        }
    }
}

void select_consolidation(const StudioView& view,
                          const std::string_view identifier,
                          std::vector<std::string>& observations) {
    const auto& sessions = view.consolidationSessions();
    for (std::size_t index = 0U; index < sessions.size(); ++index) {
        const auto& session = sessions[index];
        bool selected = identifier.empty();
        if (!selected && session.request() != nullptr) {
            selected = session.request()->entryIdentifier() == identifier;
        }
        if (!selected && session.candidate() != nullptr) {
            const auto* working = session.candidate()->workingMemoryEntry();
            const auto* retained = session.candidate()->longTermMemoryEntry();
            selected =
                (working != nullptr && working->identifier() == identifier) ||
                (retained != nullptr && retained->identifier() == identifier);
        }
        if (selected) {
            observations.push_back(
                indexed_path("Consolidation.sessions", index));
        }
    }
}

void select_reflection(const StudioView& view,
                       const std::string_view identifier,
                       std::vector<std::string>& observations) {
    const auto& reflections = view.reflections();
    for (std::size_t reflection_index = 0U;
         reflection_index < reflections.size(); ++reflection_index) {
        const auto& reflection = reflections[reflection_index];
        if (identifier.empty() || reflection.identifier() == identifier) {
            observations.push_back(
                indexed_path("Reflection.values", reflection_index));
        }
        const auto& candidates = reflection.sourceCandidates();
        for (std::size_t source_index = 0U;
             source_index < candidates.size(); ++source_index) {
            if (identifier.empty() ||
                candidates[source_index].sourceIdentifier() == identifier) {
                observations.push_back(nested_indexed_path(
                    "Reflection.values", reflection_index, ".sources",
                    source_index));
            }
        }
    }

    const auto& sessions = view.reflectionSessions();
    for (std::size_t session_index = 0U; session_index < sessions.size();
         ++session_index) {
        const auto& session = sessions[session_index];
        const bool target_match =
            identifier.empty() ||
            (session.query() != nullptr &&
             session.query()->identifier() == identifier) ||
            (session.reflection() != nullptr &&
             session.reflection()->identifier() == identifier);
        if (target_match) {
            observations.push_back(
                indexed_path("Reflection.sessions", session_index));
        }
        const auto& candidates = session.sourceCandidates();
        for (std::size_t source_index = 0U;
             source_index < candidates.size(); ++source_index) {
            if (identifier.empty() ||
                candidates[source_index].sourceIdentifier() == identifier) {
                observations.push_back(nested_indexed_path(
                    "Reflection.sessions", session_index, ".sources",
                    source_index));
            }
        }
    }
}

void select_providers(const StudioView& view,
                      const std::string_view identifier,
                      std::vector<std::string>& observations) {
    const auto& sessions = view.providerSessions();
    for (std::size_t session_index = 0U; session_index < sessions.size();
         ++session_index) {
        if (identifier.empty()) {
            observations.push_back(
                indexed_path("Providers.sessions", session_index));
        }
        const auto& descriptors = sessions[session_index].descriptors();
        for (std::size_t descriptor_index = 0U;
             descriptor_index < descriptors.size(); ++descriptor_index) {
            if (identifier.empty() ||
                descriptors[descriptor_index].identifier() == identifier) {
                observations.push_back(nested_indexed_path(
                    "Providers.sessions", session_index, ".descriptors",
                    descriptor_index));
            }
        }
    }
}

void select_scope(const StudioView& view,
                  const StudioQuery::Scope scope,
                  const std::string_view identifier,
                  std::vector<std::string>& observations) {
    if (scope == StudioQuery::Scope::Complete) {
        select_memory(view, identifier, observations);
        select_working_memory(view, identifier, observations);
        select_long_term_memory(view, identifier, observations);
        select_semantic_memory(view, identifier, observations);
        select_episodic_memory(view, identifier, observations);
        select_procedural_memory(view, identifier, observations);
        select_retrieval(view, identifier, observations);
        select_consolidation(view, identifier, observations);
        select_reflection(view, identifier, observations);
        select_providers(view, identifier, observations);
        return;
    }

    switch (scope) {
    case StudioQuery::Scope::Memory:
        select_memory(view, identifier, observations);
        return;
    case StudioQuery::Scope::WorkingMemory:
        select_working_memory(view, identifier, observations);
        return;
    case StudioQuery::Scope::LongTermMemory:
        select_long_term_memory(view, identifier, observations);
        return;
    case StudioQuery::Scope::SemanticMemory:
        select_semantic_memory(view, identifier, observations);
        return;
    case StudioQuery::Scope::EpisodicMemory:
        select_episodic_memory(view, identifier, observations);
        return;
    case StudioQuery::Scope::ProceduralMemory:
        select_procedural_memory(view, identifier, observations);
        return;
    case StudioQuery::Scope::Retrieval:
        select_retrieval(view, identifier, observations);
        return;
    case StudioQuery::Scope::Consolidation:
        select_consolidation(view, identifier, observations);
        return;
    case StudioQuery::Scope::Reflection:
        select_reflection(view, identifier, observations);
        return;
    case StudioQuery::Scope::Providers:
        select_providers(view, identifier, observations);
        return;
    case StudioQuery::Scope::Complete:
        return;
    }
}

bool append_retrieval_chains(
    const StudioView& view,
    const std::string_view identifier,
    std::vector<std::vector<std::string>>& chains) {
    bool matched = false;
    const MemoryRetrievalEngine engine;
    for (const auto& session : view.retrievalSessions()) {
        for (const auto& candidate : session.candidates()) {
            if (!identifier.empty() &&
                candidate.sourceIdentifier() != identifier) {
                continue;
            }
            matched = true;
            const auto explained = engine.explain(
                session, candidate.kind(), candidate.sourceIdentifier());
            if (!explained.succeeded()) {
                throw std::logic_error{
                    "released retrieval explanation invariant failed"};
            }
            chains.push_back(explained.explanationChain());
        }
    }
    return matched;
}

bool append_reflection_value_chains(
    const Reflection& reflection,
    const std::string_view identifier,
    std::vector<std::vector<std::string>>& chains) {
    const auto& candidates = reflection.sourceCandidates();
    const auto& source_chains = reflection.sourceExplanationChains();
    const bool target_match =
        identifier.empty() || reflection.identifier() == identifier;
    if (target_match) {
        chains.insert(chains.end(), source_chains.cbegin(),
                      source_chains.cend());
        return true;
    }

    bool matched = false;
    for (std::size_t index = 0U; index < candidates.size(); ++index) {
        if (candidates[index].sourceIdentifier() == identifier) {
            matched = true;
            chains.push_back(source_chains[index]);
        }
    }
    return matched;
}

bool append_reflection_session_chains(
    const ReflectionSession& session,
    const std::string_view identifier,
    std::vector<std::vector<std::string>>& chains) {
    const bool target_match =
        identifier.empty() ||
        (session.query() != nullptr &&
         session.query()->identifier() == identifier) ||
        (session.reflection() != nullptr &&
         session.reflection()->identifier() == identifier);
    const auto& candidates = session.sourceCandidates();
    const auto& source_chains = session.sourceExplanationChains();
    if (target_match) {
        chains.insert(chains.end(), source_chains.cbegin(),
                      source_chains.cend());
        return true;
    }

    bool matched = false;
    for (std::size_t index = 0U; index < candidates.size(); ++index) {
        if (candidates[index].sourceIdentifier() == identifier) {
            matched = true;
            chains.push_back(source_chains[index]);
        }
    }
    return matched;
}

bool append_reflection_chains(
    const StudioView& view,
    const std::string_view identifier,
    std::vector<std::vector<std::string>>& chains) {
    bool matched = false;
    for (const auto& reflection : view.reflections()) {
        matched = append_reflection_value_chains(reflection, identifier,
                                                 chains) ||
                  matched;
    }
    for (const auto& session : view.reflectionSessions()) {
        matched = append_reflection_session_chains(session, identifier,
                                                   chains) ||
                  matched;
    }
    return matched;
}

void append_count(std::vector<std::string>& observations,
                  const std::string_view key,
                  const std::size_t value) {
    std::string line{key};
    line.push_back('=');
    append_decimal(line, value);
    observations.push_back(std::move(line));
}

void append_boolean(std::vector<std::string>& observations,
                    const std::string_view key,
                    const bool value) {
    std::string line{key};
    line.push_back('=');
    line.append(value ? "true" : "false");
    observations.push_back(std::move(line));
}

void summarize_memory(const StudioView& view,
                      std::vector<std::string>& observations) {
    append_count(observations, "Memory.entries", view.memory()->entries().size());
}

void summarize_working_memory(const StudioView& view,
                              std::vector<std::string>& observations) {
    append_boolean(observations, "WorkingMemory.active",
                   view.workingMemory()->active());
    append_count(observations, "WorkingMemory.entries",
                 view.workingMemory()->entries().size());
}

void summarize_long_term_memory(const StudioView& view,
                                std::vector<std::string>& observations) {
    const auto& entries = view.longTermMemory()->entries();
    const auto archived = static_cast<std::size_t>(std::count_if(
        entries.cbegin(), entries.cend(),
        [](const LongTermMemoryEntry& entry) { return entry.archived(); }));
    append_count(observations, "LongTermMemory.entries", entries.size());
    append_count(observations, "LongTermMemory.archived", archived);
}

void summarize_semantic_memory(const StudioView& view,
                               std::vector<std::string>& observations) {
    append_count(observations, "SemanticMemory.concepts",
                 view.semanticMemory()->concepts().size());
}

void summarize_episodic_memory(const StudioView& view,
                               std::vector<std::string>& observations) {
    append_count(observations, "EpisodicMemory.episodes",
                 view.episodicMemory()->episodes().size());
}

void summarize_procedural_memory(const StudioView& view,
                                 std::vector<std::string>& observations) {
    append_count(observations, "ProceduralMemory.procedures",
                 view.proceduralMemory()->procedures().size());
}

void summarize_retrieval(const StudioView& view,
                         std::vector<std::string>& observations) {
    std::size_t ready = 0U;
    std::size_t started = 0U;
    std::size_t forgotten = 0U;
    std::size_t candidates = 0U;
    for (const auto& session : view.retrievalSessions()) {
        candidates += session.candidates().size();
        if (session.forgotten()) {
            ++forgotten;
        } else if (session.started()) {
            ++started;
        } else {
            ++ready;
        }
    }
    append_count(observations, "Retrieval.sessions",
                 view.retrievalSessions().size());
    append_count(observations, "Retrieval.sessions.Ready", ready);
    append_count(observations, "Retrieval.sessions.Started", started);
    append_count(observations, "Retrieval.sessions.Forgotten", forgotten);
    append_count(observations, "Retrieval.candidates", candidates);
}

void summarize_consolidation(const StudioView& view,
                             std::vector<std::string>& observations) {
    std::array<std::size_t, 5U> states{};
    std::size_t candidates = 0U;
    for (const auto& session : view.consolidationSessions()) {
        switch (session.state()) {
        case ConsolidationSession::State::Pristine:
            ++states[0U];
            break;
        case ConsolidationSession::State::Analyzed:
            ++states[1U];
            break;
        case ConsolidationSession::State::Promoted:
            ++states[2U];
            break;
        case ConsolidationSession::State::Retained:
            ++states[3U];
            break;
        case ConsolidationSession::State::Forgotten:
            ++states[4U];
            break;
        }
        if (session.candidate() != nullptr) {
            ++candidates;
        }
    }
    append_count(observations, "Consolidation.sessions",
                 view.consolidationSessions().size());
    append_count(observations, "Consolidation.sessions.Pristine", states[0U]);
    append_count(observations, "Consolidation.sessions.Analyzed", states[1U]);
    append_count(observations, "Consolidation.sessions.Promoted", states[2U]);
    append_count(observations, "Consolidation.sessions.Retained", states[3U]);
    append_count(observations, "Consolidation.sessions.Forgotten", states[4U]);
    append_count(observations, "Consolidation.candidates", candidates);
}

void summarize_reflection(const StudioView& view,
                          std::vector<std::string>& observations) {
    std::array<std::size_t, 4U> states{};
    std::size_t sources = 0U;
    for (const auto& reflection : view.reflections()) {
        sources += reflection.sourceCandidates().size();
    }
    for (const auto& session : view.reflectionSessions()) {
        sources += session.sourceCandidates().size();
        switch (session.state()) {
        case ReflectionSession::State::Pristine:
            ++states[0U];
            break;
        case ReflectionSession::State::Prepared:
            ++states[1U];
            break;
        case ReflectionSession::State::Derived:
            ++states[2U];
            break;
        case ReflectionSession::State::Forgotten:
            ++states[3U];
            break;
        }
    }
    append_count(observations, "Reflection.values", view.reflections().size());
    append_count(observations, "Reflection.sessions",
                 view.reflectionSessions().size());
    append_count(observations, "Reflection.sessions.Pristine", states[0U]);
    append_count(observations, "Reflection.sessions.Prepared", states[1U]);
    append_count(observations, "Reflection.sessions.Derived", states[2U]);
    append_count(observations, "Reflection.sessions.Forgotten", states[3U]);
    append_count(observations, "Reflection.sources", sources);
}

void summarize_providers(const StudioView& view,
                         std::vector<std::string>& observations) {
    std::array<std::size_t, 4U> states{};
    std::size_t descriptors = 0U;
    for (const auto& session : view.providerSessions()) {
        descriptors += session.descriptors().size();
        switch (session.state()) {
        case ProviderSession::State::Open:
            ++states[0U];
            break;
        case ProviderSession::State::Exported:
            ++states[1U];
            break;
        case ProviderSession::State::Imported:
            ++states[2U];
            break;
        case ProviderSession::State::Forgotten:
            ++states[3U];
            break;
        }
    }
    append_count(observations, "Providers.sessions",
                 view.providerSessions().size());
    append_count(observations, "Providers.sessions.Open", states[0U]);
    append_count(observations, "Providers.sessions.Exported", states[1U]);
    append_count(observations, "Providers.sessions.Imported", states[2U]);
    append_count(observations, "Providers.sessions.Forgotten", states[3U]);
    append_count(observations, "Providers.descriptors", descriptors);
}

void summarize_scope(const StudioView& view,
                     const StudioQuery::Scope scope,
                     std::vector<std::string>& observations) {
    if (scope == StudioQuery::Scope::Complete) {
        summarize_memory(view, observations);
        summarize_working_memory(view, observations);
        summarize_long_term_memory(view, observations);
        summarize_semantic_memory(view, observations);
        summarize_episodic_memory(view, observations);
        summarize_procedural_memory(view, observations);
        summarize_retrieval(view, observations);
        summarize_consolidation(view, observations);
        summarize_reflection(view, observations);
        summarize_providers(view, observations);
        return;
    }

    switch (scope) {
    case StudioQuery::Scope::Memory:
        summarize_memory(view, observations);
        return;
    case StudioQuery::Scope::WorkingMemory:
        summarize_working_memory(view, observations);
        return;
    case StudioQuery::Scope::LongTermMemory:
        summarize_long_term_memory(view, observations);
        return;
    case StudioQuery::Scope::SemanticMemory:
        summarize_semantic_memory(view, observations);
        return;
    case StudioQuery::Scope::EpisodicMemory:
        summarize_episodic_memory(view, observations);
        return;
    case StudioQuery::Scope::ProceduralMemory:
        summarize_procedural_memory(view, observations);
        return;
    case StudioQuery::Scope::Retrieval:
        summarize_retrieval(view, observations);
        return;
    case StudioQuery::Scope::Consolidation:
        summarize_consolidation(view, observations);
        return;
    case StudioQuery::Scope::Reflection:
        summarize_reflection(view, observations);
        return;
    case StudioQuery::Scope::Providers:
        summarize_providers(view, observations);
        return;
    case StudioQuery::Scope::Complete:
        return;
    }
}

} // namespace

class StudioView::Impl {
  public:
    Impl(const Memory& memoryValue,
         const WorkingMemory& workingMemoryValue,
         const LongTermMemory& longTermMemoryValue,
         const SemanticMemory& semanticMemoryValue,
         const EpisodicMemory& episodicMemoryValue,
         const ProceduralMemory& proceduralMemoryValue,
         std::vector<RetrievalSession> retrievalSessionValues,
         std::vector<ConsolidationSession> consolidationSessionValues,
         std::vector<Reflection> reflectionValues,
         std::vector<ReflectionSession> reflectionSessionValues,
         std::vector<ProviderSession> providerSessionValues)
        : memory(memoryValue), working_memory(workingMemoryValue),
          long_term_memory(longTermMemoryValue),
          semantic_memory(semanticMemoryValue),
          episodic_memory(episodicMemoryValue),
          procedural_memory(proceduralMemoryValue),
          retrieval_sessions(std::move(retrievalSessionValues)),
          consolidation_sessions(std::move(consolidationSessionValues)),
          reflections(std::move(reflectionValues)),
          reflection_sessions(std::move(reflectionSessionValues)),
          provider_sessions(std::move(providerSessionValues)) {}

    Memory memory;
    WorkingMemory working_memory;
    LongTermMemory long_term_memory;
    SemanticMemory semantic_memory;
    EpisodicMemory episodic_memory;
    ProceduralMemory procedural_memory;
    std::vector<RetrievalSession> retrieval_sessions;
    std::vector<ConsolidationSession> consolidation_sessions;
    std::vector<Reflection> reflections;
    std::vector<ReflectionSession> reflection_sessions;
    std::vector<ProviderSession> provider_sessions;
};

StudioView::StudioView(
    std::string workspaceIdentifier,
    const Memory& memory,
    const WorkingMemory& workingMemory,
    const LongTermMemory& longTermMemory,
    const SemanticMemory& semanticMemory,
    const EpisodicMemory& episodicMemory,
    const ProceduralMemory& proceduralMemory,
    std::vector<RetrievalSession> retrievalSessions,
    std::vector<ConsolidationSession> consolidationSessions,
    std::vector<Reflection> reflections,
    std::vector<ReflectionSession> reflectionSessions,
    std::vector<ProviderSession> providerSessions) {
    if (workspaceIdentifier.empty()) {
        throw std::invalid_argument{
            "studio workspace identifier must not be empty"};
    }

    auto workspace =
        std::make_shared<const std::string>(std::move(workspaceIdentifier));
    auto implementation = std::make_unique<Impl>(
        memory, workingMemory, longTermMemory, semanticMemory, episodicMemory,
        proceduralMemory, std::move(retrievalSessions),
        std::move(consolidationSessions), std::move(reflections),
        std::move(reflectionSessions), std::move(providerSessions));
    workspace_identifier_ = std::move(workspace);
    impl_ = std::move(implementation);
}

StudioView::~StudioView() = default;

StudioView::StudioView(const StudioView& other)
    : workspace_identifier_(other.workspace_identifier_),
      impl_(other.impl_ != nullptr ? std::make_unique<Impl>(*other.impl_)
                                  : nullptr) {}

StudioView& StudioView::operator=(const StudioView& other) {
    if (this != &other) {
        auto workspace = other.workspace_identifier_;
        auto implementation = other.impl_ != nullptr
                                  ? std::make_unique<Impl>(*other.impl_)
                                  : nullptr;
        workspace_identifier_.swap(workspace);
        impl_.swap(implementation);
    }
    return *this;
}

StudioView::StudioView(StudioView&& other) noexcept
    : workspace_identifier_(other.workspace_identifier_),
      impl_(std::move(other.impl_)) {}

StudioView& StudioView::operator=(StudioView&& other) noexcept {
    if (this != &other) {
        auto workspace = other.workspace_identifier_;
        impl_ = std::move(other.impl_);
        workspace_identifier_ = std::move(workspace);
    }
    return *this;
}

const std::string& StudioView::workspaceIdentifier() const noexcept {
    return *workspace_identifier_;
}

const Memory* StudioView::memory() const noexcept {
    return impl_ != nullptr ? &impl_->memory : nullptr;
}

const WorkingMemory* StudioView::workingMemory() const noexcept {
    return impl_ != nullptr ? &impl_->working_memory : nullptr;
}

const LongTermMemory* StudioView::longTermMemory() const noexcept {
    return impl_ != nullptr ? &impl_->long_term_memory : nullptr;
}

const SemanticMemory* StudioView::semanticMemory() const noexcept {
    return impl_ != nullptr ? &impl_->semantic_memory : nullptr;
}

const EpisodicMemory* StudioView::episodicMemory() const noexcept {
    return impl_ != nullptr ? &impl_->episodic_memory : nullptr;
}

const ProceduralMemory* StudioView::proceduralMemory() const noexcept {
    return impl_ != nullptr ? &impl_->procedural_memory : nullptr;
}

const std::vector<RetrievalSession>&
StudioView::retrievalSessions() const noexcept {
    return impl_ != nullptr ? impl_->retrieval_sessions
                            : empty_sequence<RetrievalSession>();
}

const std::vector<ConsolidationSession>&
StudioView::consolidationSessions() const noexcept {
    return impl_ != nullptr ? impl_->consolidation_sessions
                            : empty_sequence<ConsolidationSession>();
}

const std::vector<Reflection>& StudioView::reflections() const noexcept {
    return impl_ != nullptr ? impl_->reflections : empty_sequence<Reflection>();
}

const std::vector<ReflectionSession>&
StudioView::reflectionSessions() const noexcept {
    return impl_ != nullptr ? impl_->reflection_sessions
                            : empty_sequence<ReflectionSession>();
}

const std::vector<ProviderSession>&
StudioView::providerSessions() const noexcept {
    return impl_ != nullptr ? impl_->provider_sessions
                            : empty_sequence<ProviderSession>();
}

StudioQuery::StudioQuery(std::string workspaceIdentifier,
                         const Scope scope,
                         std::string identifier) {
    if (workspaceIdentifier.empty()) {
        throw std::invalid_argument{
            "studio workspace identifier must not be empty"};
    }
    workspace_identifier_ =
        std::make_shared<const std::string>(std::move(workspaceIdentifier));
    scope_ = scope;
    identifier_ = std::move(identifier);
}

StudioQuery::~StudioQuery() = default;
StudioQuery::StudioQuery(const StudioQuery&) = default;

StudioQuery& StudioQuery::operator=(const StudioQuery& other) {
    if (this != &other) {
        auto workspace = other.workspace_identifier_;
        auto identifier = other.identifier_;
        workspace_identifier_.swap(workspace);
        identifier_.swap(identifier);
        scope_ = other.scope_;
    }
    return *this;
}

StudioQuery::StudioQuery(StudioQuery&& other) noexcept
    : workspace_identifier_(other.workspace_identifier_), scope_(other.scope_),
      identifier_(std::move(other.identifier_)) {
    other.scope_ = Scope::Complete;
    other.identifier_.clear();
}

StudioQuery& StudioQuery::operator=(StudioQuery&& other) noexcept {
    if (this != &other) {
        auto workspace = other.workspace_identifier_;
        auto identifier = std::move(other.identifier_);
        const auto scope = other.scope_;
        workspace_identifier_ = std::move(workspace);
        identifier_ = std::move(identifier);
        scope_ = scope;
        other.scope_ = Scope::Complete;
        other.identifier_.clear();
    }
    return *this;
}

const std::string& StudioQuery::workspaceIdentifier() const noexcept {
    return *workspace_identifier_;
}

StudioQuery::Scope StudioQuery::scope() const noexcept { return scope_; }

const std::string& StudioQuery::identifier() const noexcept {
    return identifier_;
}

StudioSession::StudioSession(std::string workspaceIdentifier) {
    if (workspaceIdentifier.empty()) {
        throw std::invalid_argument{
            "studio workspace identifier must not be empty"};
    }
    workspace_identifier_ =
        std::make_shared<const std::string>(std::move(workspaceIdentifier));
}

StudioSession::~StudioSession() = default;

StudioSession::StudioSession(const StudioSession& other)
    : workspace_identifier_(other.workspace_identifier_), state_(other.state_),
      view_(other.view_ != nullptr ? std::make_unique<StudioView>(*other.view_)
                                  : nullptr) {}

StudioSession::StudioSession(StudioSession&& other) noexcept
    : workspace_identifier_(other.workspace_identifier_), state_(other.state_),
      view_(std::move(other.view_)) {
    if (other.state_ != State::Forgotten) {
        other.state_ = State::Open;
    }
}

const std::string& StudioSession::workspaceIdentifier() const noexcept {
    return *workspace_identifier_;
}

StudioSession::State StudioSession::state() const noexcept { return state_; }

const StudioView* StudioSession::view() const noexcept {
    return state_ == State::Observed ? view_.get() : nullptr;
}

class StudioResult::Impl {
  public:
    Impl(std::string workspaceIdentifier,
         std::string resultCode,
         std::string resultMessage,
         std::unique_ptr<StudioView> resultView,
         std::vector<std::string> resultObservations,
         std::vector<std::vector<std::string>> resultExplanationChains)
        : workspace_identifier(std::move(workspaceIdentifier)),
          code(std::move(resultCode)), message(std::move(resultMessage)),
          view(std::move(resultView)),
          observations(std::move(resultObservations)),
          explanation_chains(std::move(resultExplanationChains)) {}

    std::string workspace_identifier;
    std::string code;
    std::string message;
    std::unique_ptr<StudioView> view;
    std::vector<std::string> observations;
    std::vector<std::vector<std::string>> explanation_chains;
};

StudioResult::StudioResult(
    std::string workspaceIdentifier,
    std::string code,
    std::string message,
    std::unique_ptr<StudioView> view,
    std::vector<std::string> observations,
    std::vector<std::vector<std::string>> explanationChains)
    : impl_(std::make_unique<Impl>(
          std::move(workspaceIdentifier), std::move(code), std::move(message),
          std::move(view), std::move(observations),
          std::move(explanationChains))) {}

StudioResult::StudioResult(StudioResult&&) noexcept = default;
StudioResult& StudioResult::operator=(StudioResult&&) noexcept = default;
StudioResult::~StudioResult() = default;

const std::string& StudioResult::workspaceIdentifier() const noexcept {
    return impl_ != nullptr ? impl_->workspace_identifier : empty_string();
}

bool StudioResult::succeeded() const noexcept {
    return impl_ != nullptr && impl_->code == ok_code;
}

const std::string& StudioResult::code() const noexcept {
    return impl_ != nullptr ? impl_->code : empty_string();
}

const std::string& StudioResult::message() const noexcept {
    return impl_ != nullptr ? impl_->message : empty_string();
}

const StudioView* StudioResult::view() const noexcept {
    return impl_ != nullptr ? impl_->view.get() : nullptr;
}

const std::vector<std::string>&
StudioResult::observations() const noexcept {
    return impl_ != nullptr ? impl_->observations
                            : empty_sequence<std::string>();
}

const std::vector<std::vector<std::string>>&
StudioResult::explanationChains() const noexcept {
    return impl_ != nullptr
               ? impl_->explanation_chains
               : empty_sequence<std::vector<std::string>>();
}

StudioResult MemoryStudioEngine::observe(StudioSession& session,
                                         const StudioView& view) const {
    const auto failure = [&session](const std::string_view code,
                                    const std::string_view message) {
        return StudioResult{std::string{session.workspaceIdentifier()},
                            std::string{code}, std::string{message}, nullptr, {},
                            {}};
    };

    if (session.state_ == StudioSession::State::Forgotten) {
        return failure(session_forgotten_code, session_forgotten_message);
    }
    if (session.workspaceIdentifier() != view.workspaceIdentifier()) {
        return failure(workspace_mismatch_code, workspace_mismatch_message);
    }

    switch (validate_view(view)) {
    case ViewValidation::InvalidView:
        return failure(invalid_view_code, invalid_view_message);
    case ViewValidation::WorkspaceMismatch:
        return failure(workspace_mismatch_code, workspace_mismatch_message);
    case ViewValidation::Valid:
        break;
    }

    auto session_view = std::make_unique<StudioView>(view);
    auto result_view = std::make_unique<StudioView>(view);
    StudioResult result{std::string{session.workspaceIdentifier()},
                        std::string{ok_code}, {}, std::move(result_view), {}, {}};
    session.view_.swap(session_view);
    session.state_ = StudioSession::State::Observed;
    return result;
}

StudioResult MemoryStudioEngine::inspect(const StudioSession& session,
                                         const StudioQuery& query) const {
    const auto failure = [&session](const std::string_view code,
                                    const std::string_view message) {
        return StudioResult{std::string{session.workspaceIdentifier()},
                            std::string{code}, std::string{message}, nullptr, {},
                            {}};
    };

    if (session.state_ == StudioSession::State::Forgotten) {
        return failure(session_forgotten_code, session_forgotten_message);
    }
    if (session.state_ == StudioSession::State::Open) {
        return failure(session_not_observed_code,
                       session_not_observed_message);
    }
    if (session.workspaceIdentifier() != query.workspaceIdentifier()) {
        return failure(workspace_mismatch_code, workspace_mismatch_message);
    }
    if (!valid_scope(query.scope())) {
        return failure(invalid_query_code, invalid_query_message);
    }

    std::vector<std::string> observations;
    select_scope(*session.view_, query.scope(), query.identifier(),
                 observations);
    if (!query.identifier().empty() && observations.empty()) {
        return failure(not_found_code, not_found_message);
    }

    auto result_view = std::make_unique<StudioView>(*session.view_);
    return StudioResult{std::string{session.workspaceIdentifier()},
                        std::string{ok_code}, {}, std::move(result_view),
                        std::move(observations), {}};
}

StudioResult MemoryStudioEngine::trace(const StudioSession& session,
                                       const StudioQuery& query) const {
    const auto failure = [&session](const std::string_view code,
                                    const std::string_view message) {
        return StudioResult{std::string{session.workspaceIdentifier()},
                            std::string{code}, std::string{message}, nullptr, {},
                            {}};
    };

    if (session.state_ == StudioSession::State::Forgotten) {
        return failure(session_forgotten_code, session_forgotten_message);
    }
    if (session.state_ == StudioSession::State::Open) {
        return failure(session_not_observed_code,
                       session_not_observed_message);
    }
    if (session.workspaceIdentifier() != query.workspaceIdentifier()) {
        return failure(workspace_mismatch_code, workspace_mismatch_message);
    }
    if (!valid_scope(query.scope())) {
        return failure(invalid_query_code, invalid_query_message);
    }
    if (query.scope() != StudioQuery::Scope::Complete &&
        query.scope() != StudioQuery::Scope::Retrieval &&
        query.scope() != StudioQuery::Scope::Reflection) {
        return failure(invalid_query_code, invalid_query_message);
    }

    std::vector<std::vector<std::string>> chains;
    bool matched = false;
    if (query.scope() == StudioQuery::Scope::Complete ||
        query.scope() == StudioQuery::Scope::Retrieval) {
        matched = append_retrieval_chains(*session.view_, query.identifier(),
                                          chains) ||
                  matched;
    }
    if (query.scope() == StudioQuery::Scope::Complete ||
        query.scope() == StudioQuery::Scope::Reflection) {
        matched = append_reflection_chains(*session.view_, query.identifier(),
                                           chains) ||
                  matched;
    }
    if (!query.identifier().empty() && !matched) {
        return failure(not_found_code, not_found_message);
    }

    return StudioResult{std::string{session.workspaceIdentifier()},
                        std::string{ok_code}, {}, nullptr, {},
                        std::move(chains)};
}

StudioResult MemoryStudioEngine::summarize(const StudioSession& session,
                                           const StudioQuery& query) const {
    const auto failure = [&session](const std::string_view code,
                                    const std::string_view message) {
        return StudioResult{std::string{session.workspaceIdentifier()},
                            std::string{code}, std::string{message}, nullptr, {},
                            {}};
    };

    if (session.state_ == StudioSession::State::Forgotten) {
        return failure(session_forgotten_code, session_forgotten_message);
    }
    if (session.state_ == StudioSession::State::Open) {
        return failure(session_not_observed_code,
                       session_not_observed_message);
    }
    if (session.workspaceIdentifier() != query.workspaceIdentifier()) {
        return failure(workspace_mismatch_code, workspace_mismatch_message);
    }
    if (!valid_scope(query.scope())) {
        return failure(invalid_query_code, invalid_query_message);
    }
    if (!query.identifier().empty()) {
        return failure(invalid_query_code, invalid_query_message);
    }

    std::vector<std::string> observations;
    summarize_scope(*session.view_, query.scope(), observations);
    return StudioResult{std::string{session.workspaceIdentifier()},
                        std::string{ok_code}, {}, nullptr,
                        std::move(observations), {}};
}

StudioResult
MemoryStudioEngine::exportView(const StudioSession& session) const {
    const auto failure = [&session](const std::string_view code,
                                    const std::string_view message) {
        return StudioResult{std::string{session.workspaceIdentifier()},
                            std::string{code}, std::string{message}, nullptr, {},
                            {}};
    };

    if (session.state_ == StudioSession::State::Forgotten) {
        return failure(session_forgotten_code, session_forgotten_message);
    }
    if (session.state_ == StudioSession::State::Open) {
        return failure(session_not_observed_code,
                       session_not_observed_message);
    }

    auto result_view = std::make_unique<StudioView>(*session.view_);
    return StudioResult{std::string{session.workspaceIdentifier()},
                        std::string{ok_code}, {}, std::move(result_view), {}, {}};
}

StudioResult MemoryStudioEngine::forgetSession(StudioSession& session) const {
    StudioResult result{std::string{session.workspaceIdentifier()},
                        std::string{ok_code}, {}, nullptr, {}, {}};
    session.view_.reset();
    session.state_ = StudioSession::State::Forgotten;
    return result;
}

} // namespace cca::memory
