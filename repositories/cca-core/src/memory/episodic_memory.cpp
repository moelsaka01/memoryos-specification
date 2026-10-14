#include <cca/memory/episodic_memory.hpp>

#include <algorithm>
#include <stdexcept>
#include <utility>

namespace cca::memory {
namespace {

constexpr auto ok_code = "OK";
constexpr auto workspace_mismatch_code = "WORKSPACE_MISMATCH";
constexpr auto invalid_identifier_code = "INVALID_IDENTIFIER";
constexpr auto invalid_occurrence_code = "INVALID_OCCURRENCE";
constexpr auto invalid_context_code = "INVALID_CONTEXT";
constexpr auto invalid_chronology_code = "INVALID_CHRONOLOGY";
constexpr auto invalid_provenance_code = "INVALID_PROVENANCE";
constexpr auto source_not_long_term_code = "SOURCE_NOT_LONG_TERM";
constexpr auto invalid_episode_state_code = "INVALID_EPISODE_STATE";
constexpr auto forgotten_identifier_code = "FORGOTTEN_IDENTIFIER";
constexpr auto identifier_conflict_code = "IDENTIFIER_CONFLICT";
constexpr auto chronology_violation_code = "CHRONOLOGY_VIOLATION";
constexpr auto source_not_found_code = "SOURCE_NOT_FOUND";
constexpr auto source_mismatch_code = "SOURCE_MISMATCH";
constexpr auto invalid_relationship_code = "INVALID_RELATIONSHIP";
constexpr auto not_found_code = "NOT_FOUND";

constexpr auto workspace_mismatch_message =
    "Episodic Memory and Long-Term Memory Workspace identifiers do not match";
constexpr auto invalid_identifier_message =
    "Episode identifier must not be empty";
constexpr auto invalid_occurrence_message =
    "Episode occurrence must not be empty";
constexpr auto invalid_context_message = "Episode context must not be empty";
constexpr auto invalid_chronology_message =
    "Episode chronology must not be negative";
constexpr auto invalid_provenance_message = "Episode provenance is invalid";
constexpr auto source_not_long_term_message =
    "Episode source must be in Long-Term state";
constexpr auto invalid_episode_state_message =
    "Episode proposal must not contain links";
constexpr auto forgotten_identifier_message =
    "Forgotten Episode identifier cannot be reused";
constexpr auto identifier_conflict_message =
    "Episode identifier conflicts with an existing Episode";
constexpr auto chronology_violation_message =
    "Recorded Episode chronology precedes the accessible frontier";
constexpr auto source_not_found_message = "Episode source was not found";
constexpr auto source_mismatch_message =
    "Episode source value does not match Long-Term Memory";
constexpr auto invalid_relationship_message =
    "Episode relationship endpoints must be distinct";
constexpr auto not_found_message = "Episode was not found";

const std::string& empty_string() noexcept {
    static const std::string value;
    return value;
}

const std::vector<Episode>& empty_matches() noexcept {
    static const std::vector<Episode> value;
    return value;
}

std::vector<Episode>::iterator find_episode(
    std::vector<Episode>& episodes,
    const std::string_view identifier) noexcept {
    return std::find_if(
        episodes.begin(), episodes.end(),
        [identifier](const Episode& candidate) {
            return candidate.identifier() == identifier;
        });
}

std::vector<Episode>::const_iterator find_episode(
    const std::vector<Episode>& episodes,
    const std::string_view identifier) noexcept {
    return std::find_if(
        episodes.begin(), episodes.end(),
        [identifier](const Episode& candidate) {
            return candidate.identifier() == identifier;
        });
}

bool contains_identifier(const std::vector<std::string>& identifiers,
                         const std::string_view identifier) noexcept {
    return std::any_of(
        identifiers.begin(), identifiers.end(),
        [identifier](const std::string& candidate) {
            return candidate == identifier;
        });
}

bool same_provenance(
    const std::vector<LongTermMemoryEntry>& first,
    const std::vector<LongTermMemoryEntry>& second) noexcept {
    if (first.size() != second.size()) {
        return false;
    }
    for (std::size_t index = 0; index < first.size(); ++index) {
        if (first[index].identifier() != second[index].identifier() ||
            first[index].value() != second[index].value() ||
            first[index].archived() != second[index].archived()) {
            return false;
        }
    }
    return true;
}

bool same_episode(const Episode& first, const Episode& second) noexcept {
    return first.identifier() == second.identifier() &&
           first.occurrence() == second.occurrence() &&
           first.context() == second.context() &&
           first.chronology() == second.chronology() &&
           same_provenance(first.sourceEntries(), second.sourceEntries());
}

bool contains_text(const Episode& episode, const std::string& text) {
    return episode.identifier().find(text) != std::string::npos ||
           episode.occurrence().find(text) != std::string::npos ||
           episode.context().find(text) != std::string::npos;
}

} // namespace

Episode::Episode(std::string identifier,
                 std::string occurrence,
                 std::string context,
                 const std::int64_t chronology,
                 std::vector<LongTermMemoryEntry> sourceEntries)
    : identifier_(std::move(identifier)), occurrence_(std::move(occurrence)),
      context_(std::move(context)), chronology_(chronology),
      source_entries_(std::move(sourceEntries)) {}

Episode::~Episode() = default;
Episode::Episode(const Episode&) = default;

Episode& Episode::operator=(const Episode& other) {
    if (this != &other) {
        Episode copy{other};
        identifier_.swap(copy.identifier_);
        occurrence_.swap(copy.occurrence_);
        context_.swap(copy.context_);
        std::swap(chronology_, copy.chronology_);
        source_entries_.swap(copy.source_entries_);
        linked_episode_identifiers_.swap(copy.linked_episode_identifiers_);
    }
    return *this;
}

Episode::Episode(Episode&& other) noexcept
    : identifier_(std::move(other.identifier_)),
      occurrence_(std::move(other.occurrence_)),
      context_(std::move(other.context_)), chronology_(other.chronology_),
      source_entries_(std::move(other.source_entries_)),
      linked_episode_identifiers_(
          std::move(other.linked_episode_identifiers_)) {
    other.identifier_.clear();
    other.occurrence_.clear();
    other.context_.clear();
    other.chronology_ = 0;
    other.source_entries_.clear();
    other.linked_episode_identifiers_.clear();
}

Episode& Episode::operator=(Episode&& other) noexcept {
    if (this != &other) {
        identifier_ = std::move(other.identifier_);
        occurrence_ = std::move(other.occurrence_);
        context_ = std::move(other.context_);
        chronology_ = other.chronology_;
        source_entries_ = std::move(other.source_entries_);
        linked_episode_identifiers_ =
            std::move(other.linked_episode_identifiers_);

        other.identifier_.clear();
        other.occurrence_.clear();
        other.context_.clear();
        other.chronology_ = 0;
        other.source_entries_.clear();
        other.linked_episode_identifiers_.clear();
    }
    return *this;
}

const std::string& Episode::identifier() const noexcept { return identifier_; }

const std::string& Episode::occurrence() const noexcept { return occurrence_; }

const std::string& Episode::context() const noexcept { return context_; }

std::int64_t Episode::chronology() const noexcept { return chronology_; }

const std::vector<LongTermMemoryEntry>&
Episode::sourceEntries() const noexcept {
    return source_entries_;
}

const std::vector<std::string>&
Episode::linkedEpisodeIdentifiers() const noexcept {
    return linked_episode_identifiers_;
}

EpisodeQuery::EpisodeQuery(std::string text) : text_(std::move(text)) {}

const std::string& EpisodeQuery::text() const noexcept { return text_; }

EpisodicMemory::EpisodicMemory(std::string workspaceIdentifier) {
    if (workspaceIdentifier.empty()) {
        throw std::invalid_argument{"Workspace identifier must not be empty"};
    }
    workspace_identifier_ =
        std::make_shared<const std::string>(std::move(workspaceIdentifier));
}

EpisodicMemory::~EpisodicMemory() = default;
EpisodicMemory::EpisodicMemory(const EpisodicMemory&) = default;

EpisodicMemory::EpisodicMemory(EpisodicMemory&& other) noexcept
    : workspace_identifier_(other.workspace_identifier_),
      episodes_(std::move(other.episodes_)),
      forgotten_identifiers_(std::move(other.forgotten_identifiers_)) {
    other.episodes_.clear();
    other.forgotten_identifiers_.clear();
}

const std::string& EpisodicMemory::workspaceIdentifier() const noexcept {
    return workspace_identifier_ != nullptr ? *workspace_identifier_
                                            : empty_string();
}

std::size_t EpisodicMemory::size() const noexcept { return episodes_.size(); }

const Episode*
EpisodicMemory::find(const std::string_view identifier) const noexcept {
    const auto found = find_episode(episodes_, identifier);
    return found != episodes_.end() ? std::addressof(*found) : nullptr;
}

const std::vector<Episode>& EpisodicMemory::episodes() const noexcept {
    return episodes_;
}

class EpisodeResult::Impl {
  public:
    Impl(const bool operationSucceeded,
         std::string resultCode,
         std::string resultMessage,
         std::unique_ptr<Episode> resultEpisode,
         std::vector<Episode> resultMatches)
        : succeeded(operationSucceeded), code(std::move(resultCode)),
          message(std::move(resultMessage)),
          episode(std::move(resultEpisode)),
          matches(std::move(resultMatches)) {}

    bool succeeded{};
    std::string code;
    std::string message;
    std::unique_ptr<Episode> episode;
    std::vector<Episode> matches;
};

EpisodeResult::EpisodeResult(const bool succeeded,
                             std::string code,
                             std::string message,
                             std::unique_ptr<Episode> episode,
                             std::vector<Episode> matches)
    : impl_(std::make_unique<Impl>(succeeded, std::move(code),
                                   std::move(message), std::move(episode),
                                   std::move(matches))) {}

EpisodeResult::EpisodeResult(EpisodeResult&&) noexcept = default;
EpisodeResult& EpisodeResult::operator=(EpisodeResult&&) noexcept = default;
EpisodeResult::~EpisodeResult() = default;

bool EpisodeResult::succeeded() const noexcept {
    return impl_ != nullptr && impl_->succeeded;
}

const std::string& EpisodeResult::code() const noexcept {
    return impl_ != nullptr ? impl_->code : empty_string();
}

const std::string& EpisodeResult::message() const noexcept {
    return impl_ != nullptr ? impl_->message : empty_string();
}

const Episode* EpisodeResult::episode() const noexcept {
    return impl_ != nullptr ? impl_->episode.get() : nullptr;
}

const std::vector<Episode>& EpisodeResult::matches() const noexcept {
    return impl_ != nullptr ? impl_->matches : empty_matches();
}

EpisodeResult EpisodicMemoryEngine::record(
    EpisodicMemory& memory,
    const LongTermMemory& evidence,
    Episode episode) const {
    if (memory.workspaceIdentifier() != evidence.workspaceIdentifier()) {
        return EpisodeResult{false, workspace_mismatch_code,
                             workspace_mismatch_message, nullptr, {}};
    }
    if (episode.identifier().empty()) {
        return EpisodeResult{false, invalid_identifier_code,
                             invalid_identifier_message, nullptr, {}};
    }
    if (episode.occurrence().empty()) {
        return EpisodeResult{false, invalid_occurrence_code,
                             invalid_occurrence_message, nullptr, {}};
    }
    if (episode.context().empty()) {
        return EpisodeResult{false, invalid_context_code,
                             invalid_context_message, nullptr, {}};
    }
    if (episode.chronology() < 0) {
        return EpisodeResult{false, invalid_chronology_code,
                             invalid_chronology_message, nullptr, {}};
    }
    if (episode.sourceEntries().empty()) {
        return EpisodeResult{false, invalid_provenance_code,
                             invalid_provenance_message, nullptr, {}};
    }

    const auto& sourceEntries = episode.sourceEntries();
    for (std::size_t index = 0; index < sourceEntries.size(); ++index) {
        const auto& snapshot = sourceEntries[index];
        if (snapshot.identifier().empty()) {
            return EpisodeResult{false, invalid_provenance_code,
                                 invalid_provenance_message, nullptr, {}};
        }
        const auto duplicate = std::find_if(
            sourceEntries.begin(),
            sourceEntries.begin() + static_cast<std::ptrdiff_t>(index),
            [&snapshot](const LongTermMemoryEntry& candidate) {
                return candidate.identifier() == snapshot.identifier();
            });
        if (duplicate != sourceEntries.begin() +
                             static_cast<std::ptrdiff_t>(index) ||
            snapshot.identifier() == episode.identifier()) {
            return EpisodeResult{false, invalid_provenance_code,
                                 invalid_provenance_message, nullptr, {}};
        }
        if (snapshot.archived()) {
            return EpisodeResult{false, source_not_long_term_code,
                                 source_not_long_term_message, nullptr, {}};
        }
    }

    if (!episode.linkedEpisodeIdentifiers().empty()) {
        return EpisodeResult{false, invalid_episode_state_code,
                             invalid_episode_state_message, nullptr, {}};
    }
    if (contains_identifier(memory.forgotten_identifiers_,
                            episode.identifier())) {
        return EpisodeResult{false, forgotten_identifier_code,
                             forgotten_identifier_message, nullptr, {}};
    }

    const auto existing = find_episode(memory.episodes_, episode.identifier());
    if (existing != memory.episodes_.end()) {
        if (same_episode(*existing, episode)) {
            return EpisodeResult{
                true, ok_code, {}, std::make_unique<Episode>(*existing), {}};
        }
        return EpisodeResult{false, identifier_conflict_code,
                             identifier_conflict_message, nullptr, {}};
    }

    if (!memory.episodes_.empty() &&
        episode.chronology() < memory.episodes_.back().chronology()) {
        return EpisodeResult{false, chronology_violation_code,
                             chronology_violation_message, nullptr, {}};
    }

    return derive(memory, evidence, std::move(episode));
}

EpisodeResult EpisodicMemoryEngine::derive(
    EpisodicMemory& memory,
    const LongTermMemory& evidence,
    Episode episode) const {
    if (memory.workspaceIdentifier() != evidence.workspaceIdentifier()) {
        return EpisodeResult{false, workspace_mismatch_code,
                             workspace_mismatch_message, nullptr, {}};
    }
    if (episode.identifier().empty()) {
        return EpisodeResult{false, invalid_identifier_code,
                             invalid_identifier_message, nullptr, {}};
    }
    if (episode.occurrence().empty()) {
        return EpisodeResult{false, invalid_occurrence_code,
                             invalid_occurrence_message, nullptr, {}};
    }
    if (episode.context().empty()) {
        return EpisodeResult{false, invalid_context_code,
                             invalid_context_message, nullptr, {}};
    }
    if (episode.chronology() < 0) {
        return EpisodeResult{false, invalid_chronology_code,
                             invalid_chronology_message, nullptr, {}};
    }
    if (episode.sourceEntries().empty()) {
        return EpisodeResult{false, invalid_provenance_code,
                             invalid_provenance_message, nullptr, {}};
    }

    const auto& sourceEntries = episode.sourceEntries();
    for (std::size_t index = 0; index < sourceEntries.size(); ++index) {
        const auto& snapshot = sourceEntries[index];
        if (snapshot.identifier().empty()) {
            return EpisodeResult{false, invalid_provenance_code,
                                 invalid_provenance_message, nullptr, {}};
        }
        const auto duplicate = std::find_if(
            sourceEntries.begin(),
            sourceEntries.begin() + static_cast<std::ptrdiff_t>(index),
            [&snapshot](const LongTermMemoryEntry& candidate) {
                return candidate.identifier() == snapshot.identifier();
            });
        if (duplicate != sourceEntries.begin() +
                             static_cast<std::ptrdiff_t>(index) ||
            snapshot.identifier() == episode.identifier()) {
            return EpisodeResult{false, invalid_provenance_code,
                                 invalid_provenance_message, nullptr, {}};
        }
        if (snapshot.archived()) {
            return EpisodeResult{false, source_not_long_term_code,
                                 source_not_long_term_message, nullptr, {}};
        }
    }

    if (!episode.linkedEpisodeIdentifiers().empty()) {
        return EpisodeResult{false, invalid_episode_state_code,
                             invalid_episode_state_message, nullptr, {}};
    }
    if (contains_identifier(memory.forgotten_identifiers_,
                            episode.identifier())) {
        return EpisodeResult{false, forgotten_identifier_code,
                             forgotten_identifier_message, nullptr, {}};
    }

    const auto existing = find_episode(memory.episodes_, episode.identifier());
    if (existing != memory.episodes_.end()) {
        if (same_episode(*existing, episode)) {
            return EpisodeResult{
                true, ok_code, {}, std::make_unique<Episode>(*existing), {}};
        }
        return EpisodeResult{false, identifier_conflict_code,
                             identifier_conflict_message, nullptr, {}};
    }

    for (const auto& snapshot : sourceEntries) {
        const auto* const source = evidence.find(snapshot.identifier());
        if (source == nullptr) {
            return EpisodeResult{false, source_not_found_code,
                                 source_not_found_message, nullptr, {}};
        }
        if (source->archived()) {
            return EpisodeResult{false, source_not_long_term_code,
                                 source_not_long_term_message, nullptr, {}};
        }
        if (source->value() != snapshot.value()) {
            return EpisodeResult{false, source_mismatch_code,
                                 source_mismatch_message, nullptr, {}};
        }
    }

    auto stagedEpisodes = memory.episodes_;
    const auto insertion = std::upper_bound(
        stagedEpisodes.begin(), stagedEpisodes.end(), episode.chronology(),
        [](const std::int64_t chronology, const Episode& candidate) {
            return chronology < candidate.chronology();
        });
    const auto insertionIndex = static_cast<std::size_t>(
        std::distance(stagedEpisodes.begin(), insertion));
    stagedEpisodes.insert(insertion, std::move(episode));
    auto success = EpisodeResult{
        true, ok_code, {},
        std::make_unique<Episode>(stagedEpisodes[insertionIndex]), {}};
    memory.episodes_.swap(stagedEpisodes);
    return success;
}

EpisodeResult EpisodicMemoryEngine::retrieve(
    const EpisodicMemory& memory,
    const std::string_view identifier) const {
    if (identifier.empty()) {
        return EpisodeResult{false, invalid_identifier_code,
                             invalid_identifier_message, nullptr, {}};
    }
    const auto* const found = memory.find(identifier);
    if (found == nullptr) {
        return EpisodeResult{false, not_found_code, not_found_message,
                             nullptr, {}};
    }
    return EpisodeResult{
        true, ok_code, {}, std::make_unique<Episode>(*found), {}};
}

EpisodeResult EpisodicMemoryEngine::search(
    const EpisodicMemory& memory,
    const EpisodeQuery& query) const {
    std::vector<Episode> matches;
    matches.reserve(memory.episodes_.size());
    for (const auto& episode : memory.episodes_) {
        if (contains_text(episode, query.text())) {
            matches.push_back(episode);
        }
    }
    return EpisodeResult{true, ok_code, {}, nullptr, std::move(matches)};
}

EpisodeResult EpisodicMemoryEngine::link(
    EpisodicMemory& memory,
    const std::string_view firstEpisodeIdentifier,
    const std::string_view secondEpisodeIdentifier) const {
    if (firstEpisodeIdentifier.empty()) {
        return EpisodeResult{false, invalid_identifier_code,
                             invalid_identifier_message, nullptr, {}};
    }
    if (secondEpisodeIdentifier.empty()) {
        return EpisodeResult{false, invalid_identifier_code,
                             invalid_identifier_message, nullptr, {}};
    }
    if (firstEpisodeIdentifier == secondEpisodeIdentifier) {
        return EpisodeResult{false, invalid_relationship_code,
                             invalid_relationship_message, nullptr, {}};
    }

    const auto first =
        find_episode(memory.episodes_, firstEpisodeIdentifier);
    if (first == memory.episodes_.end()) {
        return EpisodeResult{false, not_found_code, not_found_message,
                             nullptr, {}};
    }
    const auto second =
        find_episode(memory.episodes_, secondEpisodeIdentifier);
    if (second == memory.episodes_.end()) {
        return EpisodeResult{false, not_found_code, not_found_message,
                             nullptr, {}};
    }

    const bool firstHasLink = contains_identifier(
        first->linkedEpisodeIdentifiers(), secondEpisodeIdentifier);
    const bool secondHasLink = contains_identifier(
        second->linkedEpisodeIdentifiers(), firstEpisodeIdentifier);
    if (firstHasLink != secondHasLink) {
        throw std::logic_error{"Episodic Memory link invariant violated"};
    }
    if (firstHasLink) {
        std::vector<Episode> matches;
        matches.reserve(2U);
        matches.push_back(*first);
        matches.push_back(*second);
        return EpisodeResult{true, ok_code, {}, nullptr, std::move(matches)};
    }

    const auto firstIndex = static_cast<std::size_t>(
        std::distance(memory.episodes_.begin(), first));
    const auto secondIndex = static_cast<std::size_t>(
        std::distance(memory.episodes_.begin(), second));
    auto stagedEpisodes = memory.episodes_;
    stagedEpisodes[firstIndex].linked_episode_identifiers_.emplace_back(
        secondEpisodeIdentifier);
    stagedEpisodes[secondIndex].linked_episode_identifiers_.emplace_back(
        firstEpisodeIdentifier);

    std::vector<Episode> matches;
    matches.reserve(2U);
    matches.push_back(stagedEpisodes[firstIndex]);
    matches.push_back(stagedEpisodes[secondIndex]);
    auto success =
        EpisodeResult{true, ok_code, {}, nullptr, std::move(matches)};
    memory.episodes_.swap(stagedEpisodes);
    return success;
}

EpisodeResult EpisodicMemoryEngine::update(
    EpisodicMemory& memory,
    const std::string_view identifier,
    std::string occurrence,
    std::string context) const {
    if (identifier.empty()) {
        return EpisodeResult{false, invalid_identifier_code,
                             invalid_identifier_message, nullptr, {}};
    }
    if (occurrence.empty()) {
        return EpisodeResult{false, invalid_occurrence_code,
                             invalid_occurrence_message, nullptr, {}};
    }
    if (context.empty()) {
        return EpisodeResult{false, invalid_context_code,
                             invalid_context_message, nullptr, {}};
    }

    const auto found = find_episode(memory.episodes_, identifier);
    if (found == memory.episodes_.end()) {
        return EpisodeResult{false, not_found_code, not_found_message,
                             nullptr, {}};
    }
    if (found->occurrence() == occurrence && found->context() == context) {
        return EpisodeResult{
            true, ok_code, {}, std::make_unique<Episode>(*found), {}};
    }

    const auto index = static_cast<std::size_t>(
        std::distance(memory.episodes_.begin(), found));
    auto stagedEpisodes = memory.episodes_;
    stagedEpisodes[index].occurrence_ = std::move(occurrence);
    stagedEpisodes[index].context_ = std::move(context);
    auto success = EpisodeResult{
        true, ok_code, {}, std::make_unique<Episode>(stagedEpisodes[index]), {}};
    memory.episodes_.swap(stagedEpisodes);
    return success;
}

EpisodeResult EpisodicMemoryEngine::forget(
    EpisodicMemory& memory,
    const std::string_view identifier) const {
    if (identifier.empty()) {
        return EpisodeResult{false, invalid_identifier_code,
                             invalid_identifier_message, nullptr, {}};
    }

    const auto found = find_episode(memory.episodes_, identifier);
    if (found == memory.episodes_.end()) {
        return EpisodeResult{true, ok_code, {}, nullptr, {}};
    }

    auto stagedEpisodes = memory.episodes_;
    auto stagedForgottenIdentifiers = memory.forgotten_identifiers_;
    stagedForgottenIdentifiers.push_back(found->identifier());

    const auto stagedFound = find_episode(stagedEpisodes, identifier);
    stagedEpisodes.erase(stagedFound);
    for (auto& survivor : stagedEpisodes) {
        std::erase(survivor.linked_episode_identifiers_, identifier);
    }

    auto success = EpisodeResult{true, ok_code, {}, nullptr, {}};
    memory.episodes_.swap(stagedEpisodes);
    memory.forgotten_identifiers_.swap(stagedForgottenIdentifiers);
    return success;
}

} // namespace cca::memory
