#include <cca/memory/memory_reflection.hpp>

#include <algorithm>
#include <iterator>
#include <stdexcept>
#include <utility>

namespace cca::memory {
namespace {

constexpr auto ok_code = "OK";
constexpr auto session_forgotten_code = "SESSION_FORGOTTEN";
constexpr auto session_already_started_code = "SESSION_ALREADY_STARTED";
constexpr auto session_not_prepared_code = "SESSION_NOT_PREPARED";
constexpr auto session_already_derived_code = "SESSION_ALREADY_DERIVED";
constexpr auto reflection_not_derived_code = "REFLECTION_NOT_DERIVED";
constexpr auto retrieval_session_forgotten_code =
    "RETRIEVAL_SESSION_FORGOTTEN";
constexpr auto retrieval_session_not_started_code =
    "RETRIEVAL_SESSION_NOT_STARTED";
constexpr auto workspace_mismatch_code = "WORKSPACE_MISMATCH";
constexpr auto invalid_identifier_code = "INVALID_IDENTIFIER";
constexpr auto invalid_knowledge_code = "INVALID_KNOWLEDGE";
constexpr auto no_sources_code = "NO_SOURCES";
constexpr auto invalid_source_kind_code = "INVALID_SOURCE_KIND";
constexpr auto source_not_found_code = "SOURCE_NOT_FOUND";
constexpr auto source_changed_code = "SOURCE_CHANGED";
constexpr auto identity_conflict_code = "IDENTITY_CONFLICT";
constexpr auto reflection_state_mismatch_code =
    "REFLECTION_STATE_MISMATCH";

constexpr auto session_forgotten_message =
    "Reflection Session has been forgotten";
constexpr auto session_already_started_message =
    "Reflection Session has already started";
constexpr auto session_not_prepared_message =
    "Reflection Session has not been prepared";
constexpr auto session_already_derived_message =
    "Reflection Session has already derived its Reflection";
constexpr auto reflection_not_derived_message =
    "Reflection Session has not derived a Reflection";
constexpr auto retrieval_session_forgotten_message =
    "Retrieval Session has been forgotten";
constexpr auto retrieval_session_not_started_message =
    "Retrieval Session has not started";
constexpr auto workspace_mismatch_message =
    "Reflection Workspace identifiers do not match";
constexpr auto invalid_identifier_message =
    "Reflection identifier must not be empty";
constexpr auto invalid_knowledge_message =
    "Reflection knowledge must not be empty";
constexpr auto no_sources_message =
    "Reflection requires at least one retrieved source";
constexpr auto invalid_source_kind_message =
    "Reflection source kind is invalid";
constexpr auto source_not_found_message =
    "A required Reflection source was not found";
constexpr auto source_changed_message =
    "A Reflection source changed after preparation";
constexpr auto identity_conflict_message =
    "Reflection identity conflicts with a source identity";
constexpr auto reflection_state_mismatch_message =
    "Reflection Session state is structurally inconsistent";

const std::string& empty_string() noexcept {
    static const std::string value;
    return value;
}

const std::vector<KnowledgeCandidate>& empty_candidates() noexcept {
    static const std::vector<KnowledgeCandidate> value;
    return value;
}

const std::vector<std::vector<std::string>>& empty_chains() noexcept {
    static const std::vector<std::vector<std::string>> value;
    return value;
}

const std::vector<std::string>& empty_chain() noexcept {
    static const std::vector<std::string> value;
    return value;
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

bool equal_entry(const LongTermMemoryEntry& left,
                 const LongTermMemoryEntry& right) noexcept {
    return left.identifier() == right.identifier() &&
           left.value() == right.value() &&
           left.archived() == right.archived();
}

bool equal_entries(const std::vector<LongTermMemoryEntry>& left,
                   const std::vector<LongTermMemoryEntry>& right) noexcept {
    return left.size() == right.size() &&
           std::equal(left.cbegin(), left.cend(), right.cbegin(), equal_entry);
}

bool equal_concept(const SemanticConcept& left,
                   const SemanticConcept& right) noexcept {
    return left.identifier() == right.identifier() &&
           left.meaning() == right.meaning() &&
           equal_entries(left.sourceEntries(), right.sourceEntries()) &&
           left.categories() == right.categories() &&
           left.linkedConceptIdentifiers() ==
               right.linkedConceptIdentifiers();
}

bool equal_episode(const Episode& left, const Episode& right) noexcept {
    return left.identifier() == right.identifier() &&
           left.occurrence() == right.occurrence() &&
           left.context() == right.context() &&
           left.chronology() == right.chronology() &&
           equal_entries(left.sourceEntries(), right.sourceEntries()) &&
           left.linkedEpisodeIdentifiers() ==
               right.linkedEpisodeIdentifiers();
}

bool equal_procedure(const Procedure& left,
                     const Procedure& right) noexcept {
    return left.identifier() == right.identifier() &&
           left.activity() == right.activity() && left.steps() == right.steps() &&
           equal_entries(left.sourceEntries(), right.sourceEntries()) &&
           left.linkedProcedureIdentifiers() ==
               right.linkedProcedureIdentifiers();
}

bool valid_source_entries(
    const std::vector<LongTermMemoryEntry>& entries,
    const std::string& derivedIdentifier) noexcept {
    if (entries.empty()) {
        return false;
    }
    for (std::size_t index = 0U; index < entries.size(); ++index) {
        const auto& entry = entries[index];
        if (entry.identifier().empty() || entry.archived() ||
            entry.identifier() == derivedIdentifier) {
            return false;
        }
        for (std::size_t prior = 0U; prior < index; ++prior) {
            if (entries[prior].identifier() == entry.identifier()) {
                return false;
            }
        }
    }
    return true;
}

bool valid_ordered_strings(const std::vector<std::string>& values,
                           const std::string& selfIdentifier,
                           const bool requireNonEmptySequence) noexcept {
    if (requireNonEmptySequence && values.empty()) {
        return false;
    }
    for (std::size_t index = 0U; index < values.size(); ++index) {
        if (values[index].empty() || values[index] == selfIdentifier) {
            return false;
        }
        for (std::size_t prior = 0U; prior < index; ++prior) {
            if (values[prior] == values[index]) {
                return false;
            }
        }
    }
    return true;
}

bool valid_steps(const std::vector<std::string>& steps) noexcept {
    return !steps.empty() &&
           std::all_of(steps.cbegin(), steps.cend(),
                       [](const auto& step) { return !step.empty(); });
}

bool valid_concept(const SemanticConcept& semanticConcept) noexcept {
    return !semanticConcept.identifier().empty() &&
           !semanticConcept.meaning().empty() &&
           valid_source_entries(semanticConcept.sourceEntries(),
                                semanticConcept.identifier()) &&
           valid_ordered_strings(
               semanticConcept.categories(), empty_string(), false) &&
           valid_ordered_strings(semanticConcept.linkedConceptIdentifiers(),
                                 semanticConcept.identifier(), false);
}

bool valid_episode(const Episode& episode) noexcept {
    return !episode.identifier().empty() && !episode.occurrence().empty() &&
           !episode.context().empty() && episode.chronology() >= 0 &&
           valid_source_entries(episode.sourceEntries(), episode.identifier()) &&
           valid_ordered_strings(episode.linkedEpisodeIdentifiers(),
                                 episode.identifier(), false);
}

bool valid_procedure(const Procedure& procedure) noexcept {
    return !procedure.identifier().empty() && !procedure.activity().empty() &&
           valid_steps(procedure.steps()) &&
           valid_source_entries(procedure.sourceEntries(),
                                procedure.identifier()) &&
           valid_ordered_strings(procedure.linkedProcedureIdentifiers(),
                                 procedure.identifier(), false);
}

bool valid_candidate_shape(const KnowledgeCandidate& candidate,
                           const std::string& workspaceIdentifier) noexcept {
    if (!valid_kind(candidate.kind()) || workspaceIdentifier.empty() ||
        candidate.workspaceIdentifier() != workspaceIdentifier ||
        candidate.sourceIdentifier().empty()) {
        return false;
    }

    const auto* const semantic_concept = candidate.semanticConcept();
    const auto* const episode = candidate.episode();
    const auto* const procedure = candidate.procedure();
    switch (candidate.kind()) {
    case KnowledgeCandidate::Kind::Semantic:
        return semantic_concept != nullptr && episode == nullptr &&
               procedure == nullptr &&
               candidate.sourceIdentifier() == semantic_concept->identifier() &&
               valid_concept(*semantic_concept);
    case KnowledgeCandidate::Kind::Episodic:
        return semantic_concept == nullptr && episode != nullptr &&
               procedure == nullptr &&
               candidate.sourceIdentifier() == episode->identifier() &&
               valid_episode(*episode);
    case KnowledgeCandidate::Kind::Procedural:
        return semantic_concept == nullptr && episode == nullptr &&
               procedure != nullptr &&
               candidate.sourceIdentifier() == procedure->identifier() &&
               valid_procedure(*procedure);
    }
    return false;
}

bool equal_candidate(const KnowledgeCandidate& left,
                     const KnowledgeCandidate& right) noexcept {
    if (left.kind() != right.kind() ||
        left.workspaceIdentifier() != right.workspaceIdentifier() ||
        left.sourceIdentifier() != right.sourceIdentifier() ||
        left.rankScore() != right.rankScore()) {
        return false;
    }

    switch (left.kind()) {
    case KnowledgeCandidate::Kind::Semantic:
        return left.semanticConcept() != nullptr &&
               right.semanticConcept() != nullptr && left.episode() == nullptr &&
               right.episode() == nullptr && left.procedure() == nullptr &&
               right.procedure() == nullptr &&
               equal_concept(*left.semanticConcept(),
                             *right.semanticConcept());
    case KnowledgeCandidate::Kind::Episodic:
        return left.semanticConcept() == nullptr &&
               right.semanticConcept() == nullptr && left.episode() != nullptr &&
               right.episode() != nullptr && left.procedure() == nullptr &&
               right.procedure() == nullptr &&
               equal_episode(*left.episode(), *right.episode());
    case KnowledgeCandidate::Kind::Procedural:
        return left.semanticConcept() == nullptr &&
               right.semanticConcept() == nullptr && left.episode() == nullptr &&
               right.episode() == nullptr && left.procedure() != nullptr &&
               right.procedure() != nullptr &&
               equal_procedure(*left.procedure(), *right.procedure());
    }
    return false;
}

bool equal_candidates(const std::vector<KnowledgeCandidate>& left,
                      const std::vector<KnowledgeCandidate>& right) noexcept {
    return left.size() == right.size() &&
           std::equal(
               left.cbegin(), left.cend(), right.cbegin(), equal_candidate);
}

bool same_key(const KnowledgeCandidate& candidate,
              const KnowledgeCandidate::Kind kind,
              const std::string_view identifier) noexcept {
    return candidate.kind() == kind &&
           candidate.sourceIdentifier() == identifier;
}

bool unique_candidate_keys(
    const std::vector<KnowledgeCandidate>& candidates) noexcept {
    for (std::size_t index = 0U; index < candidates.size(); ++index) {
        for (std::size_t prior = 0U; prior < index; ++prior) {
            if (same_key(candidates[prior], candidates[index].kind(),
                         candidates[index].sourceIdentifier())) {
                return false;
            }
        }
    }
    return true;
}

bool valid_explanation_chains(
    const std::vector<std::vector<std::string>>& chains) noexcept {
    return std::all_of(
        chains.cbegin(), chains.cend(), [](const auto& chain) {
            return !chain.empty() &&
                   std::all_of(chain.cbegin(), chain.cend(),
                               [](const auto& token) { return !token.empty(); });
        });
}

bool session_structure_valid(const ReflectionSession& session) noexcept {
    const auto state = session.state();
    if (state != ReflectionSession::State::Prepared &&
        state != ReflectionSession::State::Derived) {
        return false;
    }

    const auto* const query = session.query();
    const auto& candidates = session.sourceCandidates();
    const auto& chains = session.sourceExplanationChains();
    if (query == nullptr ||
        query->workspaceIdentifier() != session.workspaceIdentifier() ||
        query->identifier().empty() || query->knowledge().empty() ||
        candidates.empty() || session.size() != candidates.size() ||
        chains.size() != candidates.size() ||
        !valid_explanation_chains(chains) ||
        !unique_candidate_keys(candidates)) {
        return false;
    }

    for (const auto& candidate : candidates) {
        if (!valid_candidate_shape(candidate, session.workspaceIdentifier()) ||
            candidate.sourceIdentifier() == query->identifier()) {
            return false;
        }
    }

    const auto* const reflection = session.reflection();
    if (state == ReflectionSession::State::Prepared) {
        return reflection == nullptr;
    }
    if (reflection == nullptr ||
        reflection->workspaceIdentifier() != session.workspaceIdentifier() ||
        reflection->identifier() != query->identifier() ||
        reflection->knowledge() != query->knowledge() ||
        !equal_candidates(reflection->sourceCandidates(), candidates) ||
        reflection->sourceExplanationChains() != chains) {
        return false;
    }
    return true;
}

} // namespace

ReflectionQuery::ReflectionQuery(std::string workspaceIdentifier,
                                 std::string identifier,
                                 std::string knowledge)
    : workspace_identifier_(std::move(workspaceIdentifier)),
      identifier_(std::move(identifier)), knowledge_(std::move(knowledge)) {
    if (workspace_identifier_.empty()) {
        throw std::invalid_argument{
            "Reflection Workspace identifier must not be empty"};
    }
}

const std::string& ReflectionQuery::workspaceIdentifier() const noexcept {
    return workspace_identifier_;
}

const std::string& ReflectionQuery::identifier() const noexcept {
    return identifier_;
}

const std::string& ReflectionQuery::knowledge() const noexcept {
    return knowledge_;
}

class Reflection::Impl {
  public:
    Impl(std::string workspaceIdentifier,
         std::string reflectionIdentifier,
         std::string reflectionKnowledge,
         std::vector<KnowledgeCandidate> candidates,
         std::vector<std::vector<std::string>> chains)
        : workspace_identifier(std::move(workspaceIdentifier)),
          identifier(std::move(reflectionIdentifier)),
          knowledge(std::move(reflectionKnowledge)),
          source_candidates(std::move(candidates)),
          source_explanation_chains(std::move(chains)) {}

    std::string workspace_identifier;
    std::string identifier;
    std::string knowledge;
    std::vector<KnowledgeCandidate> source_candidates;
    std::vector<std::vector<std::string>> source_explanation_chains;
};

Reflection::Reflection(
    std::string workspaceIdentifier,
    std::string identifier,
    std::string knowledge,
    std::vector<KnowledgeCandidate> sourceCandidates,
    std::vector<std::vector<std::string>> sourceExplanationChains)
    : impl_(std::make_unique<Impl>(
          std::move(workspaceIdentifier), std::move(identifier),
          std::move(knowledge), std::move(sourceCandidates),
          std::move(sourceExplanationChains))) {}

Reflection::~Reflection() = default;

Reflection::Reflection(const Reflection& other)
    : impl_(other.impl_ != nullptr ? std::make_unique<Impl>(*other.impl_)
                                  : nullptr) {}

Reflection& Reflection::operator=(const Reflection& other) {
    if (this != &other) {
        auto replacement = other.impl_ != nullptr
                               ? std::make_unique<Impl>(*other.impl_)
                               : nullptr;
        impl_.swap(replacement);
    }
    return *this;
}

Reflection::Reflection(Reflection&&) noexcept = default;
Reflection& Reflection::operator=(Reflection&&) noexcept = default;

const std::string& Reflection::workspaceIdentifier() const noexcept {
    return impl_ != nullptr ? impl_->workspace_identifier : empty_string();
}

const std::string& Reflection::identifier() const noexcept {
    return impl_ != nullptr ? impl_->identifier : empty_string();
}

const std::string& Reflection::knowledge() const noexcept {
    return impl_ != nullptr ? impl_->knowledge : empty_string();
}

const std::vector<KnowledgeCandidate>&
Reflection::sourceCandidates() const noexcept {
    return impl_ != nullptr ? impl_->source_candidates : empty_candidates();
}

const std::vector<std::vector<std::string>>&
Reflection::sourceExplanationChains() const noexcept {
    return impl_ != nullptr ? impl_->source_explanation_chains : empty_chains();
}

class ReflectionSession::Impl {
  public:
    Impl() = default;

    Impl(const Impl& other)
        : state(other.state),
          query(other.query != nullptr
                    ? std::make_unique<ReflectionQuery>(*other.query)
                    : nullptr),
          source_candidates(other.source_candidates),
          source_explanation_chains(other.source_explanation_chains),
          reflection(other.reflection != nullptr
                         ? std::make_unique<Reflection>(*other.reflection)
                         : nullptr) {}

    State state{State::Pristine};
    std::unique_ptr<ReflectionQuery> query;
    std::vector<KnowledgeCandidate> source_candidates;
    std::vector<std::vector<std::string>> source_explanation_chains;
    std::unique_ptr<Reflection> reflection;
};

ReflectionSession::ReflectionSession(std::string workspaceIdentifier) {
    if (workspaceIdentifier.empty()) {
        throw std::invalid_argument{
            "Reflection Workspace identifier must not be empty"};
    }
    workspace_identifier_ =
        std::make_shared<const std::string>(std::move(workspaceIdentifier));
    impl_ = std::make_unique<Impl>();
}

ReflectionSession::~ReflectionSession() = default;

ReflectionSession::ReflectionSession(const ReflectionSession& other)
    : workspace_identifier_(other.workspace_identifier_),
      impl_(other.impl_ != nullptr ? std::make_unique<Impl>(*other.impl_)
                                  : nullptr) {}

ReflectionSession::ReflectionSession(ReflectionSession&& other) noexcept
    : workspace_identifier_(other.workspace_identifier_),
      impl_(std::move(other.impl_)) {}

const std::string& ReflectionSession::workspaceIdentifier() const noexcept {
    return workspace_identifier_ != nullptr ? *workspace_identifier_
                                            : empty_string();
}

ReflectionSession::State ReflectionSession::state() const noexcept {
    return impl_ != nullptr ? impl_->state : State::Pristine;
}

const ReflectionQuery* ReflectionSession::query() const noexcept {
    return impl_ != nullptr ? impl_->query.get() : nullptr;
}

std::size_t ReflectionSession::size() const noexcept {
    return impl_ != nullptr ? impl_->source_candidates.size() : 0U;
}

const std::vector<KnowledgeCandidate>&
ReflectionSession::sourceCandidates() const noexcept {
    return impl_ != nullptr ? impl_->source_candidates : empty_candidates();
}

const std::vector<std::vector<std::string>>&
ReflectionSession::sourceExplanationChains() const noexcept {
    return impl_ != nullptr ? impl_->source_explanation_chains : empty_chains();
}

const Reflection* ReflectionSession::reflection() const noexcept {
    return impl_ != nullptr ? impl_->reflection.get() : nullptr;
}

class ReflectionResult::Impl {
  public:
    Impl(bool operationSucceeded,
         std::string resultCode,
         std::string resultMessage,
         std::unique_ptr<Reflection> resultReflection,
         std::unique_ptr<ReflectionSession> resultSession,
         std::unique_ptr<KnowledgeCandidate> resultCandidate,
         std::vector<std::string> resultExplanationChain)
        : succeeded(operationSucceeded), code(std::move(resultCode)),
          message(std::move(resultMessage)),
          reflection(std::move(resultReflection)),
          session(std::move(resultSession)),
          candidate(std::move(resultCandidate)),
          explanation_chain(std::move(resultExplanationChain)) {}

    bool succeeded{};
    std::string code;
    std::string message;
    std::unique_ptr<Reflection> reflection;
    std::unique_ptr<ReflectionSession> session;
    std::unique_ptr<KnowledgeCandidate> candidate;
    std::vector<std::string> explanation_chain;
};

ReflectionResult::ReflectionResult(
    const bool succeeded,
    std::string code,
    std::string message,
    std::unique_ptr<Reflection> reflection,
    std::unique_ptr<ReflectionSession> session,
    std::unique_ptr<KnowledgeCandidate> candidate,
    std::vector<std::string> explanationChain)
    : impl_(std::make_unique<Impl>(
          succeeded, std::move(code), std::move(message),
          std::move(reflection), std::move(session), std::move(candidate),
          std::move(explanationChain))) {}

ReflectionResult ReflectionResult::success(
    std::unique_ptr<Reflection> reflection,
    std::unique_ptr<ReflectionSession> session,
    std::unique_ptr<KnowledgeCandidate> candidate,
    std::vector<std::string> explanationChain) {
    return ReflectionResult{true, ok_code, {}, std::move(reflection),
                            std::move(session), std::move(candidate),
                            std::move(explanationChain)};
}

ReflectionResult ReflectionResult::failure(std::string code,
                                           std::string message) {
    return ReflectionResult{false, std::move(code), std::move(message),
                            nullptr, nullptr, nullptr, {}};
}

ReflectionResult::ReflectionResult(ReflectionResult&&) noexcept = default;
ReflectionResult&
ReflectionResult::operator=(ReflectionResult&&) noexcept = default;
ReflectionResult::~ReflectionResult() = default;

bool ReflectionResult::succeeded() const noexcept {
    return impl_ != nullptr && impl_->succeeded;
}

const std::string& ReflectionResult::code() const noexcept {
    return impl_ != nullptr ? impl_->code : empty_string();
}

const std::string& ReflectionResult::message() const noexcept {
    return impl_ != nullptr ? impl_->message : empty_string();
}

const Reflection* ReflectionResult::reflection() const noexcept {
    return impl_ != nullptr ? impl_->reflection.get() : nullptr;
}

const ReflectionSession* ReflectionResult::session() const noexcept {
    return impl_ != nullptr ? impl_->session.get() : nullptr;
}

const KnowledgeCandidate* ReflectionResult::candidate() const noexcept {
    return impl_ != nullptr ? impl_->candidate.get() : nullptr;
}

const std::vector<std::string>&
ReflectionResult::explanationChain() const noexcept {
    return impl_ != nullptr ? impl_->explanation_chain : empty_chain();
}

ReflectionResult MemoryReflectionEngine::reflect(
    ReflectionSession& session,
    const ReflectionQuery& query,
    const RetrievalSession& retrievalSession) const {
    if (session.state() == ReflectionSession::State::Forgotten) {
        return ReflectionResult::failure(session_forgotten_code,
                                         session_forgotten_message);
    }
    if (session.state() != ReflectionSession::State::Pristine) {
        return ReflectionResult::failure(session_already_started_code,
                                         session_already_started_message);
    }
    if (query.workspaceIdentifier() != session.workspaceIdentifier()) {
        return ReflectionResult::failure(workspace_mismatch_code,
                                         workspace_mismatch_message);
    }
    if (retrievalSession.workspaceIdentifier() !=
        session.workspaceIdentifier()) {
        return ReflectionResult::failure(workspace_mismatch_code,
                                         workspace_mismatch_message);
    }
    if (retrievalSession.forgotten()) {
        return ReflectionResult::failure(
            retrieval_session_forgotten_code,
            retrieval_session_forgotten_message);
    }
    if (!retrievalSession.started()) {
        return ReflectionResult::failure(
            retrieval_session_not_started_code,
            retrieval_session_not_started_message);
    }
    if (query.identifier().empty()) {
        return ReflectionResult::failure(invalid_identifier_code,
                                         invalid_identifier_message);
    }
    if (query.knowledge().empty()) {
        return ReflectionResult::failure(invalid_knowledge_code,
                                         invalid_knowledge_message);
    }
    if (retrievalSession.candidates().empty()) {
        return ReflectionResult::failure(no_sources_code, no_sources_message);
    }

    const auto& source_candidates = retrievalSession.candidates();
    for (const auto& candidate : source_candidates) {
        if (!valid_candidate_shape(candidate, session.workspaceIdentifier())) {
            return ReflectionResult::failure(
                reflection_state_mismatch_code,
                reflection_state_mismatch_message);
        }
    }
    if (!unique_candidate_keys(source_candidates)) {
        return ReflectionResult::failure(reflection_state_mismatch_code,
                                         reflection_state_mismatch_message);
    }
    for (const auto& candidate : source_candidates) {
        if (candidate.sourceIdentifier() == query.identifier()) {
            return ReflectionResult::failure(identity_conflict_code,
                                             identity_conflict_message);
        }
    }

    std::vector<KnowledgeCandidate> staged_candidates;
    std::vector<std::vector<std::string>> staged_chains;
    staged_candidates.reserve(source_candidates.size());
    staged_chains.reserve(source_candidates.size());

    const MemoryRetrievalEngine retrieval_engine;
    for (const auto& candidate : source_candidates) {
        auto explained = retrieval_engine.explain(
            retrievalSession, candidate.kind(), candidate.sourceIdentifier());
        if (!explained.succeeded() || explained.candidate() == nullptr ||
            !equal_candidate(candidate, *explained.candidate()) ||
            explained.explanationChain().empty() ||
            std::any_of(explained.explanationChain().cbegin(),
                        explained.explanationChain().cend(),
                        [](const auto& token) { return token.empty(); })) {
            return ReflectionResult::failure(
                reflection_state_mismatch_code,
                reflection_state_mismatch_message);
        }
        staged_candidates.push_back(*explained.candidate());
        staged_chains.push_back(explained.explanationChain());
    }

    auto next = std::make_unique<ReflectionSession::Impl>();
    next->state = ReflectionSession::State::Prepared;
    next->query = std::make_unique<ReflectionQuery>(query);
    next->source_candidates = std::move(staged_candidates);
    next->source_explanation_chains = std::move(staged_chains);

    auto result = ReflectionResult::success();
    session.impl_ = std::move(next);
    return result;
}

ReflectionResult MemoryReflectionEngine::derive(
    ReflectionSession& session,
    const SemanticMemory& semanticMemory,
    const EpisodicMemory& episodicMemory,
    const ProceduralMemory& proceduralMemory) const {
    if (session.state() == ReflectionSession::State::Forgotten) {
        return ReflectionResult::failure(session_forgotten_code,
                                         session_forgotten_message);
    }
    if (session.state() == ReflectionSession::State::Pristine) {
        return ReflectionResult::failure(session_not_prepared_code,
                                         session_not_prepared_message);
    }
    if (session.state() == ReflectionSession::State::Derived) {
        return ReflectionResult::failure(session_already_derived_code,
                                         session_already_derived_message);
    }
    if (!session_structure_valid(session)) {
        return ReflectionResult::failure(reflection_state_mismatch_code,
                                         reflection_state_mismatch_message);
    }
    if (semanticMemory.workspaceIdentifier() != session.workspaceIdentifier()) {
        return ReflectionResult::failure(workspace_mismatch_code,
                                         workspace_mismatch_message);
    }
    if (episodicMemory.workspaceIdentifier() != session.workspaceIdentifier()) {
        return ReflectionResult::failure(workspace_mismatch_code,
                                         workspace_mismatch_message);
    }
    if (proceduralMemory.workspaceIdentifier() !=
        session.workspaceIdentifier()) {
        return ReflectionResult::failure(workspace_mismatch_code,
                                         workspace_mismatch_message);
    }

    std::size_t semantic_count = 0U;
    std::size_t episodic_count = 0U;
    std::size_t procedural_count = 0U;
    for (const auto& candidate : session.sourceCandidates()) {
        switch (candidate.kind()) {
        case KnowledgeCandidate::Kind::Semantic:
            ++semantic_count;
            break;
        case KnowledgeCandidate::Kind::Episodic:
            ++episodic_count;
            break;
        case KnowledgeCandidate::Kind::Procedural:
            ++procedural_count;
            break;
        default:
            return ReflectionResult::failure(
                reflection_state_mismatch_code,
                reflection_state_mismatch_message);
        }
    }

    std::vector<SemanticResult> semantic_results;
    std::vector<EpisodeResult> episodic_results;
    std::vector<ProcedureResult> procedural_results;
    semantic_results.reserve(semantic_count);
    episodic_results.reserve(episodic_count);
    procedural_results.reserve(procedural_count);

    const SemanticMemoryEngine semantic_engine;
    const EpisodicMemoryEngine episodic_engine;
    const ProceduralMemoryEngine procedural_engine;
    for (const auto& candidate : session.sourceCandidates()) {
        switch (candidate.kind()) {
        case KnowledgeCandidate::Kind::Semantic: {
            auto retrieved = semantic_engine.retrieve(
                semanticMemory, candidate.sourceIdentifier());
            if (!retrieved.succeeded()) {
                if (retrieved.code() == "NOT_FOUND") {
                    return ReflectionResult::failure(source_not_found_code,
                                                     source_not_found_message);
                }
                return ReflectionResult::failure(
                    reflection_state_mismatch_code,
                    reflection_state_mismatch_message);
            }
            semantic_results.push_back(std::move(retrieved));
            const auto* const live =
                semantic_results.back().semanticConcept();
            if (live == nullptr || candidate.semanticConcept() == nullptr) {
                return ReflectionResult::failure(
                    reflection_state_mismatch_code,
                    reflection_state_mismatch_message);
            }
            if (!equal_concept(*live, *candidate.semanticConcept())) {
                return ReflectionResult::failure(source_changed_code,
                                                 source_changed_message);
            }
            break;
        }
        case KnowledgeCandidate::Kind::Episodic: {
            auto retrieved = episodic_engine.retrieve(
                episodicMemory, candidate.sourceIdentifier());
            if (!retrieved.succeeded()) {
                if (retrieved.code() == "NOT_FOUND") {
                    return ReflectionResult::failure(source_not_found_code,
                                                     source_not_found_message);
                }
                return ReflectionResult::failure(
                    reflection_state_mismatch_code,
                    reflection_state_mismatch_message);
            }
            episodic_results.push_back(std::move(retrieved));
            const auto* const live = episodic_results.back().episode();
            if (live == nullptr || candidate.episode() == nullptr) {
                return ReflectionResult::failure(
                    reflection_state_mismatch_code,
                    reflection_state_mismatch_message);
            }
            if (!equal_episode(*live, *candidate.episode())) {
                return ReflectionResult::failure(source_changed_code,
                                                 source_changed_message);
            }
            break;
        }
        case KnowledgeCandidate::Kind::Procedural: {
            auto retrieved = procedural_engine.retrieve(
                proceduralMemory, candidate.sourceIdentifier());
            if (!retrieved.succeeded()) {
                if (retrieved.code() == "NOT_FOUND") {
                    return ReflectionResult::failure(source_not_found_code,
                                                     source_not_found_message);
                }
                return ReflectionResult::failure(
                    reflection_state_mismatch_code,
                    reflection_state_mismatch_message);
            }
            procedural_results.push_back(std::move(retrieved));
            const auto* const live = procedural_results.back().procedure();
            if (live == nullptr || candidate.procedure() == nullptr) {
                return ReflectionResult::failure(
                    reflection_state_mismatch_code,
                    reflection_state_mismatch_message);
            }
            if (!equal_procedure(*live, *candidate.procedure())) {
                return ReflectionResult::failure(source_changed_code,
                                                 source_changed_message);
            }
            break;
        }
        default:
            return ReflectionResult::failure(
                reflection_state_mismatch_code,
                reflection_state_mismatch_message);
        }
    }

    const auto* const query = session.query();
    auto result_reflection = std::unique_ptr<Reflection>{new Reflection{
        session.workspaceIdentifier(), query->identifier(), query->knowledge(),
        session.sourceCandidates(), session.sourceExplanationChains()}};
    auto session_reflection =
        std::make_unique<Reflection>(*result_reflection);
    auto next = std::make_unique<ReflectionSession::Impl>(*session.impl_);
    next->state = ReflectionSession::State::Derived;
    next->reflection = std::move(session_reflection);

    auto result = ReflectionResult::success(std::move(result_reflection));
    session.impl_ = std::move(next);
    return result;
}

ReflectionResult MemoryReflectionEngine::explain(
    const ReflectionSession& session,
    const KnowledgeCandidate::Kind kind,
    const std::string_view identifier) const {
    if (session.state() == ReflectionSession::State::Forgotten) {
        return ReflectionResult::failure(session_forgotten_code,
                                         session_forgotten_message);
    }
    if (session.state() != ReflectionSession::State::Derived) {
        return ReflectionResult::failure(reflection_not_derived_code,
                                         reflection_not_derived_message);
    }
    if (!valid_kind(kind)) {
        return ReflectionResult::failure(invalid_source_kind_code,
                                         invalid_source_kind_message);
    }
    if (identifier.empty()) {
        return ReflectionResult::failure(invalid_identifier_code,
                                         invalid_identifier_message);
    }

    const auto& candidates = session.sourceCandidates();
    const auto found = std::find_if(
        candidates.cbegin(), candidates.cend(),
        [kind, identifier](const KnowledgeCandidate& candidate) {
            return same_key(candidate, kind, identifier);
        });
    if (found == candidates.cend()) {
        return ReflectionResult::failure(source_not_found_code,
                                         source_not_found_message);
    }
    const auto index = static_cast<std::size_t>(
        std::distance(candidates.cbegin(), found));
    if (index >= session.sourceExplanationChains().size()) {
        return ReflectionResult::failure(reflection_state_mismatch_code,
                                         reflection_state_mismatch_message);
    }

    return ReflectionResult::success(
        nullptr, nullptr, std::make_unique<KnowledgeCandidate>(*found),
        session.sourceExplanationChains()[index]);
}

ReflectionResult
MemoryReflectionEngine::validate(const ReflectionSession& session) const {
    if (session.state() == ReflectionSession::State::Forgotten) {
        return ReflectionResult::failure(session_forgotten_code,
                                         session_forgotten_message);
    }
    if (session.state() == ReflectionSession::State::Pristine) {
        return ReflectionResult::failure(session_not_prepared_code,
                                         session_not_prepared_message);
    }
    if (!session_structure_valid(session)) {
        return ReflectionResult::failure(reflection_state_mismatch_code,
                                         reflection_state_mismatch_message);
    }
    return ReflectionResult::success();
}

ReflectionResult MemoryReflectionEngine::retrieveSession(
    const ReflectionSession& session) const {
    return ReflectionResult::success(
        nullptr, std::make_unique<ReflectionSession>(session));
}

ReflectionResult
MemoryReflectionEngine::forgetSession(ReflectionSession& session) const {
    if (session.state() == ReflectionSession::State::Forgotten) {
        return ReflectionResult::success();
    }

    auto next = std::make_unique<ReflectionSession::Impl>();
    next->state = ReflectionSession::State::Forgotten;
    auto result = ReflectionResult::success();
    session.impl_ = std::move(next);
    return result;
}

} // namespace cca::memory
