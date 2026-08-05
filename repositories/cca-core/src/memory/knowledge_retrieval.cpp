#include <cca/memory/knowledge_retrieval.hpp>

#include <algorithm>
#include <array>
#include <charconv>
#include <limits>
#include <memory>
#include <optional>
#include <stdexcept>
#include <string>
#include <string_view>
#include <system_error>
#include <utility>
#include <vector>

namespace cca::memory {
namespace {

const std::string empty_text;
const std::string ok_code{"OK"};
const std::string session_forgotten_code{"SESSION_FORGOTTEN"};
const std::string session_already_started_code{"SESSION_ALREADY_STARTED"};
const std::string session_not_started_code{"SESSION_NOT_STARTED"};
const std::string workspace_mismatch_code{"WORKSPACE_MISMATCH"};
const std::string invalid_source_kind_code{"INVALID_SOURCE_KIND"};
const std::string invalid_identifier_code{"INVALID_IDENTIFIER"};
const std::string not_found_code{"NOT_FOUND"};

const std::string session_forgotten_message{
    "Retrieval session is forgotten"};
const std::string session_already_started_message{
    "Retrieval session has already started"};
const std::string session_not_started_message{
    "Retrieval session has not started"};
const std::string workspace_mismatch_message{
    "Source memory Workspace identifier does not match the retrieval session"};
const std::string invalid_source_kind_message{
    "Knowledge Candidate source kind is invalid"};
const std::string invalid_identifier_message{
    "Knowledge source identifier must not be empty"};
const std::string not_found_message{"Requested knowledge was not found"};

constexpr std::string_view retrieve_token{"retrieve:identifier-exact"};
constexpr std::string_view stable_tie_token{"rank:stable-tie"};

struct CandidateMatch {
    std::uint32_t score{};
    std::string token;
};

template <typename Integer>
std::string decimal_text(const Integer value) {
    std::array<char, 32U> buffer{};
    const auto conversion =
        std::to_chars(buffer.data(), buffer.data() + buffer.size(), value);
    if (conversion.ec != std::errc{}) {
        throw std::logic_error{"Failed to render deterministic decimal text"};
    }
    return std::string{buffer.data(), conversion.ptr};
}

std::string operation_token(
    const std::string_view operation,
    const std::string_view suffix) {
    std::string token;
    token.reserve(operation.size() + 1U + suffix.size());
    token.append(operation);
    token.push_back(':');
    token.append(suffix);
    return token;
}

std::string content_token(
    const std::string_view operation,
    const bool exact,
    const std::string_view field) {
    constexpr std::string_view exact_prefix{"content-exact:"};
    constexpr std::string_view substring_prefix{"content-substring:"};
    const auto prefix = exact ? exact_prefix : substring_prefix;

    std::string token;
    token.reserve(operation.size() + 1U + prefix.size() + field.size());
    token.append(operation);
    token.push_back(':');
    token.append(prefix);
    token.append(field);
    return token;
}

std::string indexed_field(
    const std::string_view field,
    const std::size_t index) {
    const auto index_text = decimal_text(index);
    std::string result;
    result.reserve(field.size() + 2U + index_text.size());
    result.append(field);
    result.push_back('[');
    result.append(index_text);
    result.push_back(']');
    return result;
}

void consider_content(
    std::optional<CandidateMatch>& best,
    const std::string_view value,
    const std::string_view query,
    const std::string_view field,
    const std::string_view operation) {
    const bool exact = value == query;
    const bool substring = !exact && value.find(query) != std::string_view::npos;
    if (!exact && !substring) {
        return;
    }

    const std::uint32_t score = exact ? 2U : 1U;
    if (best.has_value() && best->score >= score) {
        return;
    }

    best = CandidateMatch{score, content_token(operation, exact, field)};
}

std::optional<CandidateMatch> match_identifier(
    const std::string_view identifier,
    const std::string_view query,
    const std::string_view operation) {
    if (identifier == query) {
        return CandidateMatch{4U, operation_token(operation, "identifier-exact")};
    }
    if (identifier.find(query) != std::string_view::npos) {
        return CandidateMatch{
            3U,
            operation_token(operation, "identifier-substring")};
    }
    return std::nullopt;
}

std::optional<CandidateMatch> match_semantic(
    const SemanticConcept& semantic_concept,
    const std::string_view query,
    const std::string_view operation) {
    if (query.empty()) {
        return CandidateMatch{0U, operation_token(operation, "empty-query")};
    }
    if (auto match =
            match_identifier(semantic_concept.identifier(), query, operation)) {
        return match;
    }

    std::optional<CandidateMatch> best;
    consider_content(
        best,
        semantic_concept.meaning(),
        query,
        "meaning",
        operation);
    const auto& categories = semantic_concept.categories();
    for (std::size_t index = 0U; index < categories.size(); ++index) {
        consider_content(
            best,
            categories[index],
            query,
            indexed_field("category", index),
            operation);
    }
    return best;
}

std::optional<CandidateMatch> match_episode(
    const Episode& episode,
    const std::string_view query,
    const std::string_view operation) {
    if (query.empty()) {
        return CandidateMatch{0U, operation_token(operation, "empty-query")};
    }
    if (auto match = match_identifier(episode.identifier(), query, operation)) {
        return match;
    }

    std::optional<CandidateMatch> best;
    consider_content(best, episode.occurrence(), query, "occurrence", operation);
    consider_content(best, episode.context(), query, "context", operation);
    return best;
}

std::optional<CandidateMatch> match_procedure(
    const Procedure& procedure,
    const std::string_view query,
    const std::string_view operation) {
    if (query.empty()) {
        return CandidateMatch{0U, operation_token(operation, "empty-query")};
    }
    if (auto match = match_identifier(procedure.identifier(), query, operation)) {
        return match;
    }

    std::optional<CandidateMatch> best;
    consider_content(best, procedure.activity(), query, "activity", operation);
    const auto& steps = procedure.steps();
    for (std::size_t index = 0U; index < steps.size(); ++index) {
        consider_content(
            best,
            steps[index],
            query,
            indexed_field("step", index),
            operation);
    }
    return best;
}

std::optional<CandidateMatch> match_candidate(
    const KnowledgeCandidate& candidate,
    const std::string_view query,
    const std::string_view operation) {
    switch (candidate.kind()) {
    case KnowledgeCandidate::Kind::Semantic:
        if (const auto* semantic_concept = candidate.semanticConcept();
            semantic_concept != nullptr) {
            return match_semantic(*semantic_concept, query, operation);
        }
        break;
    case KnowledgeCandidate::Kind::Episodic:
        if (const auto* episode = candidate.episode(); episode != nullptr) {
            return match_episode(*episode, query, operation);
        }
        break;
    case KnowledgeCandidate::Kind::Procedural:
        if (const auto* procedure = candidate.procedure(); procedure != nullptr) {
            return match_procedure(*procedure, query, operation);
        }
        break;
    }
    return std::nullopt;
}

bool valid_kind(const KnowledgeCandidate::Kind kind) noexcept {
    switch (kind) {
    case KnowledgeCandidate::Kind::Semantic:
    case KnowledgeCandidate::Kind::Episodic:
    case KnowledgeCandidate::Kind::Procedural:
        return true;
    }
    return false;
}

bool same_key(
    const KnowledgeCandidate& candidate,
    const KnowledgeCandidate::Kind kind,
    const std::string_view identifier) noexcept {
    return candidate.kind() == kind && candidate.sourceIdentifier() == identifier;
}

std::size_t checked_source_count(
    const std::size_t semantic_count,
    const std::size_t episodic_count,
    const std::size_t procedural_count) {
    constexpr auto maximum = std::numeric_limits<std::size_t>::max();
    if (episodic_count > maximum - semantic_count) {
        throw std::length_error{"Knowledge Candidate count exceeds container capacity"};
    }
    const auto semantic_and_episodic = semantic_count + episodic_count;
    if (procedural_count > maximum - semantic_and_episodic) {
        throw std::length_error{"Knowledge Candidate count exceeds container capacity"};
    }
    return semantic_and_episodic + procedural_count;
}

std::string rank_score_token(const std::uint32_t score) {
    constexpr std::string_view prefix{"rank:score:"};
    const auto score_text = decimal_text(score);
    std::string token;
    token.reserve(prefix.size() + score_text.size());
    token.append(prefix);
    token.append(score_text);
    return token;
}

} // namespace

KnowledgeQuery::KnowledgeQuery(std::string text) : text_(std::move(text)) {}

const std::string& KnowledgeQuery::text() const noexcept { return text_; }

KnowledgeCandidate::KnowledgeCandidate(
    std::string workspaceIdentifier,
    SemanticConcept semanticConcept,
    const std::uint32_t rankScore,
    std::vector<std::string> explanationChain)
    : kind_(Kind::Semantic),
      workspace_identifier_(std::move(workspaceIdentifier)),
      source_identifier_(semanticConcept.identifier()), rank_score_(rankScore),
      source_value_(std::move(semanticConcept)),
      explanation_chain_(std::move(explanationChain)) {}

KnowledgeCandidate::KnowledgeCandidate(
    std::string workspaceIdentifier,
    Episode episode,
    const std::uint32_t rankScore,
    std::vector<std::string> explanationChain)
    : kind_(Kind::Episodic),
      workspace_identifier_(std::move(workspaceIdentifier)),
      source_identifier_(episode.identifier()), rank_score_(rankScore),
      source_value_(std::move(episode)),
      explanation_chain_(std::move(explanationChain)) {}

KnowledgeCandidate::KnowledgeCandidate(
    std::string workspaceIdentifier,
    Procedure procedure,
    const std::uint32_t rankScore,
    std::vector<std::string> explanationChain)
    : kind_(Kind::Procedural),
      workspace_identifier_(std::move(workspaceIdentifier)),
      source_identifier_(procedure.identifier()), rank_score_(rankScore),
      source_value_(std::move(procedure)),
      explanation_chain_(std::move(explanationChain)) {}

KnowledgeCandidate::~KnowledgeCandidate() = default;
KnowledgeCandidate::KnowledgeCandidate(const KnowledgeCandidate&) = default;

KnowledgeCandidate&
KnowledgeCandidate::operator=(const KnowledgeCandidate& other) {
    if (this != &other) {
        KnowledgeCandidate copy{other};
        *this = std::move(copy);
    }
    return *this;
}

KnowledgeCandidate::KnowledgeCandidate(KnowledgeCandidate&& other) noexcept
    : kind_(other.kind_),
      workspace_identifier_(std::move(other.workspace_identifier_)),
      source_identifier_(std::move(other.source_identifier_)),
      rank_score_(other.rank_score_),
      source_value_(std::move(other.source_value_)),
      explanation_chain_(std::move(other.explanation_chain_)) {
    other.workspace_identifier_.clear();
    other.source_identifier_.clear();
    other.rank_score_ = 0U;
    other.source_value_.template emplace<std::monostate>();
    other.explanation_chain_.clear();
}

KnowledgeCandidate&
KnowledgeCandidate::operator=(KnowledgeCandidate&& other) noexcept {
    if (this != &other) {
        kind_ = other.kind_;
        workspace_identifier_ = std::move(other.workspace_identifier_);
        source_identifier_ = std::move(other.source_identifier_);
        rank_score_ = other.rank_score_;
        source_value_ = std::move(other.source_value_);
        explanation_chain_ = std::move(other.explanation_chain_);

        other.workspace_identifier_.clear();
        other.source_identifier_.clear();
        other.rank_score_ = 0U;
        other.source_value_.template emplace<std::monostate>();
        other.explanation_chain_.clear();
    }
    return *this;
}

KnowledgeCandidate::Kind KnowledgeCandidate::kind() const noexcept {
    return kind_;
}

const std::string& KnowledgeCandidate::workspaceIdentifier() const noexcept {
    return workspace_identifier_;
}

const std::string& KnowledgeCandidate::sourceIdentifier() const noexcept {
    return source_identifier_;
}

std::uint32_t KnowledgeCandidate::rankScore() const noexcept {
    return rank_score_;
}

const SemanticConcept* KnowledgeCandidate::semanticConcept() const noexcept {
    return std::get_if<SemanticConcept>(&source_value_);
}

const Episode* KnowledgeCandidate::episode() const noexcept {
    return std::get_if<Episode>(&source_value_);
}

const Procedure* KnowledgeCandidate::procedure() const noexcept {
    return std::get_if<Procedure>(&source_value_);
}

RetrievalSession::RetrievalSession(std::string workspaceIdentifier) {
    if (workspaceIdentifier.empty()) {
        throw std::invalid_argument{"Workspace identifier must not be empty"};
    }
    workspace_identifier_ =
        std::make_shared<const std::string>(std::move(workspaceIdentifier));
}

RetrievalSession::~RetrievalSession() = default;
RetrievalSession::RetrievalSession(const RetrievalSession&) = default;

RetrievalSession::RetrievalSession(RetrievalSession&& other) noexcept
    : workspace_identifier_(other.workspace_identifier_),
      started_(other.started_), forgotten_(other.forgotten_),
      candidates_(std::move(other.candidates_)) {
    other.started_ = false;
    other.forgotten_ = false;
    other.candidates_.clear();
}

const std::string& RetrievalSession::workspaceIdentifier() const noexcept {
    return workspace_identifier_ != nullptr ? *workspace_identifier_ : empty_text;
}

bool RetrievalSession::started() const noexcept { return started_; }

bool RetrievalSession::forgotten() const noexcept { return forgotten_; }

std::size_t RetrievalSession::size() const noexcept {
    return candidates_.size();
}

const std::vector<KnowledgeCandidate>&
RetrievalSession::candidates() const noexcept {
    return candidates_;
}

KnowledgeResult::KnowledgeResult(
    const std::uint8_t status,
    std::unique_ptr<KnowledgeCandidate> candidate,
    std::vector<KnowledgeCandidate> candidates,
    std::vector<std::string> explanationChain)
    : status_(status), candidate_(std::move(candidate)),
      candidates_(std::move(candidates)),
      explanation_chain_(std::move(explanationChain)) {}

KnowledgeResult::KnowledgeResult(KnowledgeResult&& other) noexcept
    : status_(other.status_), candidate_(std::move(other.candidate_)),
      candidates_(std::move(other.candidates_)),
      explanation_chain_(std::move(other.explanation_chain_)) {
    other.status_ = moved_from_status;
    other.candidate_.reset();
    other.candidates_.clear();
    other.explanation_chain_.clear();
}

KnowledgeResult& KnowledgeResult::operator=(KnowledgeResult&& other) noexcept {
    if (this != &other) {
        status_ = other.status_;
        candidate_ = std::move(other.candidate_);
        candidates_ = std::move(other.candidates_);
        explanation_chain_ = std::move(other.explanation_chain_);

        other.status_ = moved_from_status;
        other.candidate_.reset();
        other.candidates_.clear();
        other.explanation_chain_.clear();
    }
    return *this;
}

KnowledgeResult::~KnowledgeResult() = default;

bool KnowledgeResult::succeeded() const noexcept {
    return status_ == ok_status;
}

const std::string& KnowledgeResult::code() const noexcept {
    switch (status_) {
    case moved_from_status:
        return empty_text;
    case ok_status:
        return ok_code;
    case session_forgotten_status:
        return session_forgotten_code;
    case session_already_started_status:
        return session_already_started_code;
    case session_not_started_status:
        return session_not_started_code;
    case workspace_mismatch_status:
        return workspace_mismatch_code;
    case invalid_source_kind_status:
        return invalid_source_kind_code;
    case invalid_identifier_status:
        return invalid_identifier_code;
    case not_found_status:
        return not_found_code;
    }
    return empty_text;
}

const std::string& KnowledgeResult::message() const noexcept {
    switch (status_) {
    case moved_from_status:
    case ok_status:
        return empty_text;
    case session_forgotten_status:
        return session_forgotten_message;
    case session_already_started_status:
        return session_already_started_message;
    case session_not_started_status:
        return session_not_started_message;
    case workspace_mismatch_status:
        return workspace_mismatch_message;
    case invalid_source_kind_status:
        return invalid_source_kind_message;
    case invalid_identifier_status:
        return invalid_identifier_message;
    case not_found_status:
        return not_found_message;
    }
    return empty_text;
}

const KnowledgeCandidate* KnowledgeResult::candidate() const noexcept {
    return candidate_.get();
}

const std::vector<KnowledgeCandidate>&
KnowledgeResult::candidates() const noexcept {
    return candidates_;
}

const std::vector<std::string>&
KnowledgeResult::explanationChain() const noexcept {
    return explanation_chain_;
}

KnowledgeResult
MemoryRetrievalEngine::failure(const std::uint8_t status) {
    return KnowledgeResult{status, nullptr, {}, {}};
}

KnowledgeResult MemoryRetrievalEngine::candidateSuccess(
    const KnowledgeCandidate& candidate,
    std::vector<std::string> explanationChain) {
    return KnowledgeResult{
        KnowledgeResult::ok_status,
        std::make_unique<KnowledgeCandidate>(candidate),
        {},
        std::move(explanationChain)};
}

KnowledgeResult MemoryRetrievalEngine::candidatesSuccess(
    const std::vector<KnowledgeCandidate>& candidates) {
    return KnowledgeResult{
        KnowledgeResult::ok_status,
        nullptr,
        candidates,
        {}};
}

KnowledgeResult MemoryRetrievalEngine::emptySuccess() {
    return KnowledgeResult{KnowledgeResult::ok_status, nullptr, {}, {}};
}

KnowledgeResult MemoryRetrievalEngine::retrieve(
    RetrievalSession& session,
    const SemanticMemory& semanticMemory,
    const EpisodicMemory& episodicMemory,
    const ProceduralMemory& proceduralMemory,
    const KnowledgeCandidate::Kind kind,
    const std::string_view identifier) const {
    if (session.forgotten_) {
        return failure(KnowledgeResult::session_forgotten_status);
    }
    if (session.started_) {
        return failure(KnowledgeResult::session_already_started_status);
    }
    if (semanticMemory.workspaceIdentifier() != session.workspaceIdentifier()) {
        return failure(KnowledgeResult::workspace_mismatch_status);
    }
    if (episodicMemory.workspaceIdentifier() != session.workspaceIdentifier()) {
        return failure(KnowledgeResult::workspace_mismatch_status);
    }
    if (proceduralMemory.workspaceIdentifier() != session.workspaceIdentifier()) {
        return failure(KnowledgeResult::workspace_mismatch_status);
    }
    if (!valid_kind(kind)) {
        return failure(KnowledgeResult::invalid_source_kind_status);
    }
    if (identifier.empty()) {
        return failure(KnowledgeResult::invalid_identifier_status);
    }

    const auto start_session = [&session](KnowledgeCandidate candidate) {
        std::vector<KnowledgeCandidate> staged;
        staged.reserve(1U);
        staged.push_back(std::move(candidate));
        auto result = MemoryRetrievalEngine::candidateSuccess(staged.front(), {});
        session.candidates_.swap(staged);
        session.started_ = true;
        return result;
    };

    switch (kind) {
    case KnowledgeCandidate::Kind::Semantic:
        if (const auto* semantic_concept = semanticMemory.find(identifier);
            semantic_concept != nullptr) {
            std::vector<std::string> chain;
            chain.emplace_back(retrieve_token);
            return start_session(KnowledgeCandidate{
                session.workspaceIdentifier(),
                *semantic_concept,
                4U,
                std::move(chain)});
        }
        break;
    case KnowledgeCandidate::Kind::Episodic:
        if (const auto* episode = episodicMemory.find(identifier);
            episode != nullptr) {
            std::vector<std::string> chain;
            chain.emplace_back(retrieve_token);
            return start_session(KnowledgeCandidate{
                session.workspaceIdentifier(),
                *episode,
                4U,
                std::move(chain)});
        }
        break;
    case KnowledgeCandidate::Kind::Procedural:
        if (const auto* procedure = proceduralMemory.find(identifier);
            procedure != nullptr) {
            std::vector<std::string> chain;
            chain.emplace_back(retrieve_token);
            return start_session(KnowledgeCandidate{
                session.workspaceIdentifier(),
                *procedure,
                4U,
                std::move(chain)});
        }
        break;
    }
    return failure(KnowledgeResult::not_found_status);
}

KnowledgeResult MemoryRetrievalEngine::search(
    RetrievalSession& session,
    const SemanticMemory& semanticMemory,
    const EpisodicMemory& episodicMemory,
    const ProceduralMemory& proceduralMemory,
    const KnowledgeQuery& query) const {
    if (session.forgotten_) {
        return failure(KnowledgeResult::session_forgotten_status);
    }
    if (session.started_) {
        return failure(KnowledgeResult::session_already_started_status);
    }
    if (semanticMemory.workspaceIdentifier() != session.workspaceIdentifier()) {
        return failure(KnowledgeResult::workspace_mismatch_status);
    }
    if (episodicMemory.workspaceIdentifier() != session.workspaceIdentifier()) {
        return failure(KnowledgeResult::workspace_mismatch_status);
    }
    if (proceduralMemory.workspaceIdentifier() != session.workspaceIdentifier()) {
        return failure(KnowledgeResult::workspace_mismatch_status);
    }

    std::vector<KnowledgeCandidate> staged;
    staged.reserve(checked_source_count(
        semanticMemory.size(),
        episodicMemory.size(),
        proceduralMemory.size()));

    for (const auto& semantic_concept : semanticMemory.concepts()) {
        auto match = match_semantic(semantic_concept, query.text(), "search");
        if (!match.has_value()) {
            continue;
        }
        std::vector<std::string> chain;
        chain.push_back(std::move(match->token));
        staged.push_back(KnowledgeCandidate{
            session.workspaceIdentifier(),
            semantic_concept,
            match->score,
            std::move(chain)});
    }

    for (const auto& episode : episodicMemory.episodes()) {
        auto match = match_episode(episode, query.text(), "search");
        if (!match.has_value()) {
            continue;
        }
        std::vector<std::string> chain;
        chain.push_back(std::move(match->token));
        staged.push_back(KnowledgeCandidate{
            session.workspaceIdentifier(),
            episode,
            match->score,
            std::move(chain)});
    }

    for (const auto& procedure : proceduralMemory.procedures()) {
        auto match = match_procedure(procedure, query.text(), "search");
        if (!match.has_value()) {
            continue;
        }
        std::vector<std::string> chain;
        chain.push_back(std::move(match->token));
        staged.push_back(KnowledgeCandidate{
            session.workspaceIdentifier(),
            procedure,
            match->score,
            std::move(chain)});
    }

    auto result = candidatesSuccess(staged);
    session.candidates_.swap(staged);
    session.started_ = true;
    return result;
}

KnowledgeResult MemoryRetrievalEngine::filter(
    RetrievalSession& session,
    const KnowledgeQuery& query) const {
    if (session.forgotten_) {
        return failure(KnowledgeResult::session_forgotten_status);
    }
    if (!session.started_) {
        return failure(KnowledgeResult::session_not_started_status);
    }

    std::vector<KnowledgeCandidate> staged;
    staged.reserve(session.candidates_.size());
    for (const auto& candidate : session.candidates_) {
        auto match = match_candidate(candidate, query.text(), "filter");
        if (!match.has_value()) {
            continue;
        }

        KnowledgeCandidate survivor{candidate};
        survivor.rank_score_ = match->score;
        survivor.explanation_chain_.push_back(std::move(match->token));
        staged.push_back(std::move(survivor));
    }

    auto result = candidatesSuccess(staged);
    session.candidates_.swap(staged);
    return result;
}

KnowledgeResult
MemoryRetrievalEngine::rank(RetrievalSession& session) const {
    if (session.forgotten_) {
        return failure(KnowledgeResult::session_forgotten_status);
    }
    if (!session.started_) {
        return failure(KnowledgeResult::session_not_started_status);
    }

    auto staged = session.candidates_;
    for (auto& candidate : staged) {
        std::size_t equal_score_count = 0U;
        for (const auto& other : staged) {
            if (other.rankScore() == candidate.rankScore()) {
                ++equal_score_count;
            }
        }

        candidate.explanation_chain_.push_back(
            rank_score_token(candidate.rankScore()));
        if (equal_score_count > 1U) {
            candidate.explanation_chain_.emplace_back(stable_tie_token);
        }
    }

    std::stable_sort(
        staged.begin(),
        staged.end(),
        [](const KnowledgeCandidate& first, const KnowledgeCandidate& second) {
            return first.rankScore() > second.rankScore();
        });

    auto result = candidatesSuccess(staged);
    session.candidates_.swap(staged);
    return result;
}

KnowledgeResult MemoryRetrievalEngine::explain(
    const RetrievalSession& session,
    const KnowledgeCandidate::Kind kind,
    const std::string_view identifier) const {
    if (session.forgotten_) {
        return failure(KnowledgeResult::session_forgotten_status);
    }
    if (!session.started_) {
        return failure(KnowledgeResult::session_not_started_status);
    }
    if (!valid_kind(kind)) {
        return failure(KnowledgeResult::invalid_source_kind_status);
    }
    if (identifier.empty()) {
        return failure(KnowledgeResult::invalid_identifier_status);
    }

    const auto found = std::find_if(
        session.candidates_.cbegin(),
        session.candidates_.cend(),
        [kind, identifier](const KnowledgeCandidate& candidate) {
            return same_key(candidate, kind, identifier);
        });
    if (found == session.candidates_.cend()) {
        return failure(KnowledgeResult::not_found_status);
    }
    return candidateSuccess(*found, found->explanation_chain_);
}

KnowledgeResult
MemoryRetrievalEngine::forgetSession(RetrievalSession& session) const {
    auto result = emptySuccess();
    session.candidates_.clear();
    session.started_ = false;
    session.forgotten_ = true;
    return result;
}

} // namespace cca::memory
