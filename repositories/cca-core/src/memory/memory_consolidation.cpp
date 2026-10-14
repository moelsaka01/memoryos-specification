#include <cca/memory/memory_consolidation.hpp>

#include <algorithm>
#include <iterator>
#include <stdexcept>
#include <utility>

namespace cca::memory {
namespace {

constexpr auto ok_code = "OK";
constexpr auto session_forgotten_code = "SESSION_FORGOTTEN";
constexpr auto session_already_started_code = "SESSION_ALREADY_STARTED";
constexpr auto session_not_analyzed_code = "SESSION_NOT_ANALYZED";
constexpr auto session_not_promoted_code = "SESSION_NOT_PROMOTED";
constexpr auto session_already_retained_code = "SESSION_ALREADY_RETAINED";
constexpr auto workspace_mismatch_code = "WORKSPACE_MISMATCH";
constexpr auto invalid_task_identifier_code = "INVALID_TASK_IDENTIFIER";
constexpr auto invalid_identifier_code = "INVALID_IDENTIFIER";
constexpr auto working_memory_not_active_code = "WORKING_MEMORY_NOT_ACTIVE";
constexpr auto task_mismatch_code = "TASK_MISMATCH";
constexpr auto source_not_found_code = "SOURCE_NOT_FOUND";
constexpr auto source_changed_code = "SOURCE_CHANGED";
constexpr auto destination_conflict_code = "DESTINATION_CONFLICT";
constexpr auto destination_forgotten_code = "DESTINATION_FORGOTTEN";
constexpr auto transition_state_mismatch_code = "TRANSITION_STATE_MISMATCH";

constexpr auto session_forgotten_message =
    "Consolidation Session has been forgotten";
constexpr auto session_already_started_message =
    "Consolidation Session has already started";
constexpr auto session_not_analyzed_message =
    "Consolidation Session has not been analyzed";
constexpr auto session_not_promoted_message =
    "Consolidation Session has not been promoted";
constexpr auto session_already_retained_message =
    "Consolidation Session has already retained its candidate";
constexpr auto workspace_mismatch_message =
    "Consolidation Workspace identifiers do not match";
constexpr auto invalid_task_identifier_message =
    "Consolidation task identifier must not be empty";
constexpr auto invalid_identifier_message =
    "Consolidation entry identifier must not be empty";
constexpr auto working_memory_not_active_message =
    "Working Memory must be active for consolidation";
constexpr auto task_mismatch_message =
    "Working Memory active task does not match the request";
constexpr auto source_not_found_message =
    "Consolidation source entry was not found";
constexpr auto source_changed_message =
    "Consolidation source entry changed after analysis";
constexpr auto destination_conflict_message =
    "Long-Term Memory already contains the consolidation identity";
constexpr auto destination_forgotten_message =
    "Long-Term Memory permanently reserves the forgotten identity";
constexpr auto transition_state_mismatch_message =
    "Consolidation state does not match the analyzed transition";

const std::string& empty_string() noexcept {
    static const std::string value;
    return value;
}

const std::optional<std::size_t>& empty_position() noexcept {
    static const std::optional<std::size_t> value;
    return value;
}

bool equal_entry(const WorkingMemoryEntry& left,
                 const WorkingMemoryEntry& right) noexcept {
    return left.identifier() == right.identifier() &&
           left.value() == right.value() &&
           left.expirationPoint() == right.expirationPoint();
}

bool equal_entry(const LongTermMemoryEntry& left,
                 const LongTermMemoryEntry& right) noexcept {
    return left.identifier() == right.identifier() &&
           left.value() == right.value() &&
           left.archived() == right.archived();
}

bool equal_memory(const WorkingMemory& left,
                  const WorkingMemory& right) noexcept {
    if (left.workspaceIdentifier() != right.workspaceIdentifier() ||
        left.active() != right.active() ||
        left.activeTaskIdentifier() != right.activeTaskIdentifier() ||
        left.entries().size() != right.entries().size()) {
        return false;
    }
    return std::equal(
        left.entries().begin(), left.entries().end(),
        right.entries().begin(),
        [](const WorkingMemoryEntry& leftEntry,
           const WorkingMemoryEntry& rightEntry) {
            return equal_entry(leftEntry, rightEntry);
        });
}

bool equal_memory(const LongTermMemory& left,
                  const LongTermMemory& right) noexcept {
    if (left.workspaceIdentifier() != right.workspaceIdentifier() ||
        left.entries().size() != right.entries().size()) {
        return false;
    }
    return std::equal(
        left.entries().begin(), left.entries().end(),
        right.entries().begin(),
        [](const LongTermMemoryEntry& leftEntry,
           const LongTermMemoryEntry& rightEntry) {
            return equal_entry(leftEntry, rightEntry);
        });
}

enum class DestinationStatus { Available, Conflict, Forgotten, Invalid };

DestinationStatus destination_status(const LongTermMemory& memory,
                                     const WorkingMemoryEntry& entry) {
    if (memory.find(entry.identifier()) != nullptr) {
        return DestinationStatus::Conflict;
    }

    auto probe = LongTermMemory{memory};
    const auto result = LongTermMemoryEngine{}.retain(
        probe, LongTermMemoryEntry{entry.identifier(), entry.value()});
    if (result.succeeded()) {
        return DestinationStatus::Available;
    }
    if (result.code() == "FORGOTTEN_IDENTIFIER") {
        return DestinationStatus::Forgotten;
    }
    return DestinationStatus::Invalid;
}

bool candidate_matches_request(const ConsolidationCandidate& candidate,
                               const ConsolidationRequest& request,
                               const std::string& workspace) noexcept {
    const auto* const source = candidate.workingMemoryEntry();
    return source != nullptr &&
           candidate.workspaceIdentifier() == workspace &&
           candidate.taskIdentifier() == request.taskIdentifier() &&
           request.workspaceIdentifier() == workspace &&
           source->identifier() == request.entryIdentifier();
}

bool analyzed_candidate_valid(const ConsolidationCandidate& candidate,
                              const ConsolidationRequest& request,
                              const std::string& workspace) noexcept {
    return candidate_matches_request(candidate, request, workspace) &&
           candidate.longTermMemoryEntry() == nullptr &&
           !candidate.retainedPosition().has_value();
}

bool promoted_candidate_valid(const ConsolidationCandidate& candidate,
                              const ConsolidationRequest& request,
                              const std::string& workspace) noexcept {
    const auto* const source = candidate.workingMemoryEntry();
    const auto* const proposal = candidate.longTermMemoryEntry();
    return candidate_matches_request(candidate, request, workspace) &&
           source != nullptr && proposal != nullptr &&
           !proposal->archived() &&
           proposal->identifier() == source->identifier() &&
           proposal->value() == source->value() &&
           !candidate.retainedPosition().has_value();
}

bool retained_candidate_valid(const ConsolidationCandidate& candidate,
                              const ConsolidationRequest& request,
                              const std::string& workspace) noexcept {
    if (!candidate_matches_request(candidate, request, workspace) ||
        candidate.longTermMemoryEntry() == nullptr ||
        candidate.longTermMemoryEntry()->archived() ||
        !candidate.retainedPosition().has_value()) {
        return false;
    }
    const auto* const source = candidate.workingMemoryEntry();
    const auto* const target = candidate.longTermMemoryEntry();
    return source != nullptr && target->identifier() == source->identifier() &&
           target->value() == source->value();
}

} // namespace

ConsolidationRequest::ConsolidationRequest(std::string workspaceIdentifier,
                                           std::string taskIdentifier,
                                           std::string entryIdentifier)
    : workspace_identifier_(std::move(workspaceIdentifier)),
      task_identifier_(std::move(taskIdentifier)),
      entry_identifier_(std::move(entryIdentifier)) {
    if (workspace_identifier_.empty()) {
        throw std::invalid_argument{
            "Consolidation Workspace identifier must not be empty"};
    }
}

const std::string&
ConsolidationRequest::workspaceIdentifier() const noexcept {
    return workspace_identifier_;
}

const std::string& ConsolidationRequest::taskIdentifier() const noexcept {
    return task_identifier_;
}

const std::string& ConsolidationRequest::entryIdentifier() const noexcept {
    return entry_identifier_;
}

class ConsolidationCandidate::Impl {
  public:
    Impl(std::string workspaceIdentifier,
         std::string taskIdentifier,
         const std::size_t sourcePosition,
         WorkingMemoryEntry workingMemoryEntry,
         std::unique_ptr<LongTermMemoryEntry> longTermMemoryEntry,
         std::optional<std::size_t> retainedPosition)
        : workspace_identifier(std::move(workspaceIdentifier)),
          task_identifier(std::move(taskIdentifier)),
          source_position(sourcePosition),
          working_memory_entry(
              std::make_unique<WorkingMemoryEntry>(
                  std::move(workingMemoryEntry))),
          long_term_memory_entry(std::move(longTermMemoryEntry)),
          retained_position(retainedPosition) {}

    Impl(const Impl& other)
        : workspace_identifier(other.workspace_identifier),
          task_identifier(other.task_identifier),
          source_position(other.source_position),
          working_memory_entry(
              other.working_memory_entry != nullptr
                  ? std::make_unique<WorkingMemoryEntry>(
                        *other.working_memory_entry)
                  : nullptr),
          long_term_memory_entry(
              other.long_term_memory_entry != nullptr
                  ? std::make_unique<LongTermMemoryEntry>(
                        *other.long_term_memory_entry)
                  : nullptr),
          retained_position(other.retained_position) {}

    std::string workspace_identifier;
    std::string task_identifier;
    std::size_t source_position{};
    std::unique_ptr<WorkingMemoryEntry> working_memory_entry;
    std::unique_ptr<LongTermMemoryEntry> long_term_memory_entry;
    std::optional<std::size_t> retained_position;
};

ConsolidationCandidate::ConsolidationCandidate(
    std::string workspaceIdentifier,
    std::string taskIdentifier,
    const std::size_t sourcePosition,
    WorkingMemoryEntry workingMemoryEntry,
    std::unique_ptr<LongTermMemoryEntry> longTermMemoryEntry,
    const std::optional<std::size_t> retainedPosition)
    : impl_(std::make_unique<Impl>(
          std::move(workspaceIdentifier), std::move(taskIdentifier),
          sourcePosition, std::move(workingMemoryEntry),
          std::move(longTermMemoryEntry), retainedPosition)) {}

ConsolidationCandidate::~ConsolidationCandidate() = default;

ConsolidationCandidate::ConsolidationCandidate(
    const ConsolidationCandidate& other)
    : impl_(other.impl_ != nullptr ? std::make_unique<Impl>(*other.impl_)
                                  : nullptr) {}

ConsolidationCandidate& ConsolidationCandidate::operator=(
    const ConsolidationCandidate& other) {
    if (this != &other) {
        auto replacement = other.impl_ != nullptr
                               ? std::make_unique<Impl>(*other.impl_)
                               : nullptr;
        impl_.swap(replacement);
    }
    return *this;
}

ConsolidationCandidate::ConsolidationCandidate(
    ConsolidationCandidate&&) noexcept = default;
ConsolidationCandidate& ConsolidationCandidate::operator=(
    ConsolidationCandidate&&) noexcept = default;

const std::string&
ConsolidationCandidate::workspaceIdentifier() const noexcept {
    return impl_ != nullptr ? impl_->workspace_identifier : empty_string();
}

const std::string&
ConsolidationCandidate::taskIdentifier() const noexcept {
    return impl_ != nullptr ? impl_->task_identifier : empty_string();
}

std::size_t ConsolidationCandidate::sourcePosition() const noexcept {
    return impl_ != nullptr ? impl_->source_position : 0U;
}

const WorkingMemoryEntry*
ConsolidationCandidate::workingMemoryEntry() const noexcept {
    return impl_ != nullptr ? impl_->working_memory_entry.get() : nullptr;
}

const LongTermMemoryEntry*
ConsolidationCandidate::longTermMemoryEntry() const noexcept {
    return impl_ != nullptr ? impl_->long_term_memory_entry.get() : nullptr;
}

const std::optional<std::size_t>&
ConsolidationCandidate::retainedPosition() const noexcept {
    return impl_ != nullptr ? impl_->retained_position : empty_position();
}

class ConsolidationSession::Impl {
  public:
    Impl() = default;

    Impl(const Impl& other)
        : state(other.state),
          request(other.request != nullptr
                      ? std::make_unique<ConsolidationRequest>(*other.request)
                      : nullptr),
          candidate(other.candidate != nullptr
                        ? std::make_unique<ConsolidationCandidate>(
                              *other.candidate)
                        : nullptr),
          analyzed_working_memory(
              other.analyzed_working_memory != nullptr
                  ? std::make_unique<WorkingMemory>(
                        *other.analyzed_working_memory)
                  : nullptr),
          analyzed_long_term_memory(
              other.analyzed_long_term_memory != nullptr
                  ? std::make_unique<LongTermMemory>(
                        *other.analyzed_long_term_memory)
                  : nullptr),
          working_memory(other.working_memory != nullptr
                             ? std::make_unique<WorkingMemory>(
                                   *other.working_memory)
                             : nullptr),
          long_term_memory(other.long_term_memory != nullptr
                               ? std::make_unique<LongTermMemory>(
                                     *other.long_term_memory)
                               : nullptr) {}

    State state{State::Pristine};
    std::unique_ptr<ConsolidationRequest> request;
    std::unique_ptr<ConsolidationCandidate> candidate;
    std::unique_ptr<WorkingMemory> analyzed_working_memory;
    std::unique_ptr<LongTermMemory> analyzed_long_term_memory;
    std::unique_ptr<WorkingMemory> working_memory;
    std::unique_ptr<LongTermMemory> long_term_memory;
};

ConsolidationSession::ConsolidationSession(std::string workspaceIdentifier) {
    if (workspaceIdentifier.empty()) {
        throw std::invalid_argument{
            "Consolidation Workspace identifier must not be empty"};
    }
    workspace_identifier_ =
        std::make_shared<const std::string>(std::move(workspaceIdentifier));
    impl_ = std::make_unique<Impl>();
}

ConsolidationSession::~ConsolidationSession() = default;

ConsolidationSession::ConsolidationSession(
    const ConsolidationSession& other)
    : workspace_identifier_(other.workspace_identifier_),
      impl_(other.impl_ != nullptr ? std::make_unique<Impl>(*other.impl_)
                                  : nullptr) {}

ConsolidationSession::ConsolidationSession(
    ConsolidationSession&& other) noexcept
    : workspace_identifier_(other.workspace_identifier_),
      impl_(std::move(other.impl_)) {}

const std::string&
ConsolidationSession::workspaceIdentifier() const noexcept {
    return workspace_identifier_ != nullptr ? *workspace_identifier_
                                            : empty_string();
}

ConsolidationSession::State ConsolidationSession::state() const noexcept {
    return impl_ != nullptr ? impl_->state : State::Pristine;
}

const ConsolidationRequest* ConsolidationSession::request() const noexcept {
    return impl_ != nullptr ? impl_->request.get() : nullptr;
}

const ConsolidationCandidate*
ConsolidationSession::candidate() const noexcept {
    return impl_ != nullptr ? impl_->candidate.get() : nullptr;
}

const WorkingMemory* ConsolidationSession::workingMemory() const noexcept {
    return impl_ != nullptr ? impl_->working_memory.get() : nullptr;
}

const LongTermMemory* ConsolidationSession::longTermMemory() const noexcept {
    return impl_ != nullptr ? impl_->long_term_memory.get() : nullptr;
}

class ConsolidationResult::Impl {
  public:
    Impl(const bool operationSucceeded,
         std::string resultCode,
         std::string resultMessage,
         std::unique_ptr<ConsolidationCandidate> resultCandidate,
         std::unique_ptr<ConsolidationSession> resultSession,
         std::unique_ptr<WorkingMemory> resultWorkingMemory,
         std::unique_ptr<LongTermMemory> resultLongTermMemory)
        : succeeded(operationSucceeded), code(std::move(resultCode)),
          message(std::move(resultMessage)),
          candidate(std::move(resultCandidate)),
          session(std::move(resultSession)),
          working_memory(std::move(resultWorkingMemory)),
          long_term_memory(std::move(resultLongTermMemory)) {}

    bool succeeded{};
    std::string code;
    std::string message;
    std::unique_ptr<ConsolidationCandidate> candidate;
    std::unique_ptr<ConsolidationSession> session;
    std::unique_ptr<WorkingMemory> working_memory;
    std::unique_ptr<LongTermMemory> long_term_memory;
};

ConsolidationResult::ConsolidationResult(
    const bool succeeded,
    std::string code,
    std::string message,
    std::unique_ptr<ConsolidationCandidate> candidate,
    std::unique_ptr<ConsolidationSession> session,
    std::unique_ptr<WorkingMemory> workingMemory,
    std::unique_ptr<LongTermMemory> longTermMemory)
    : impl_(std::make_unique<Impl>(
          succeeded, std::move(code), std::move(message),
          std::move(candidate), std::move(session), std::move(workingMemory),
          std::move(longTermMemory))) {}

ConsolidationResult ConsolidationResult::success(
    std::unique_ptr<ConsolidationCandidate> candidate,
    std::unique_ptr<ConsolidationSession> session,
    std::unique_ptr<WorkingMemory> workingMemory,
    std::unique_ptr<LongTermMemory> longTermMemory) {
    return ConsolidationResult{true, ok_code, {}, std::move(candidate),
                               std::move(session), std::move(workingMemory),
                               std::move(longTermMemory)};
}

ConsolidationResult ConsolidationResult::failure(std::string code,
                                                 std::string message) {
    return ConsolidationResult{false, std::move(code), std::move(message),
                               nullptr, nullptr, nullptr, nullptr};
}

ConsolidationResult::ConsolidationResult(ConsolidationResult&&) noexcept =
    default;
ConsolidationResult& ConsolidationResult::operator=(
    ConsolidationResult&&) noexcept = default;
ConsolidationResult::~ConsolidationResult() = default;

bool ConsolidationResult::succeeded() const noexcept {
    return impl_ != nullptr && impl_->succeeded;
}

const std::string& ConsolidationResult::code() const noexcept {
    return impl_ != nullptr ? impl_->code : empty_string();
}

const std::string& ConsolidationResult::message() const noexcept {
    return impl_ != nullptr ? impl_->message : empty_string();
}

const ConsolidationCandidate*
ConsolidationResult::candidate() const noexcept {
    return impl_ != nullptr ? impl_->candidate.get() : nullptr;
}

const ConsolidationSession* ConsolidationResult::session() const noexcept {
    return impl_ != nullptr ? impl_->session.get() : nullptr;
}

const WorkingMemory* ConsolidationResult::workingMemory() const noexcept {
    return impl_ != nullptr ? impl_->working_memory.get() : nullptr;
}

const LongTermMemory* ConsolidationResult::longTermMemory() const noexcept {
    return impl_ != nullptr ? impl_->long_term_memory.get() : nullptr;
}

ConsolidationResult MemoryConsolidationEngine::analyze(
    ConsolidationSession& session,
    const ConsolidationRequest& request,
    const WorkingMemory& workingMemory,
    const LongTermMemory& longTermMemory) const {
    if (session.state() == ConsolidationSession::State::Forgotten) {
        return ConsolidationResult::failure(session_forgotten_code,
                                            session_forgotten_message);
    }
    if (session.state() != ConsolidationSession::State::Pristine) {
        return ConsolidationResult::failure(session_already_started_code,
                                            session_already_started_message);
    }
    if (request.workspaceIdentifier() != session.workspaceIdentifier()) {
        return ConsolidationResult::failure(workspace_mismatch_code,
                                            workspace_mismatch_message);
    }
    if (workingMemory.workspaceIdentifier() != session.workspaceIdentifier()) {
        return ConsolidationResult::failure(workspace_mismatch_code,
                                            workspace_mismatch_message);
    }
    if (longTermMemory.workspaceIdentifier() !=
        session.workspaceIdentifier()) {
        return ConsolidationResult::failure(workspace_mismatch_code,
                                            workspace_mismatch_message);
    }
    if (request.taskIdentifier().empty()) {
        return ConsolidationResult::failure(
            invalid_task_identifier_code, invalid_task_identifier_message);
    }
    if (request.entryIdentifier().empty()) {
        return ConsolidationResult::failure(invalid_identifier_code,
                                            invalid_identifier_message);
    }
    if (!workingMemory.active()) {
        return ConsolidationResult::failure(
            working_memory_not_active_code, working_memory_not_active_message);
    }
    if (!workingMemory.activeTaskIdentifier().has_value() ||
        *workingMemory.activeTaskIdentifier() != request.taskIdentifier()) {
        return ConsolidationResult::failure(task_mismatch_code,
                                            task_mismatch_message);
    }

    const auto found = std::find_if(
        workingMemory.entries().begin(), workingMemory.entries().end(),
        [&request](const WorkingMemoryEntry& entry) {
            return entry.identifier() == request.entryIdentifier();
        });
    if (found == workingMemory.entries().end()) {
        return ConsolidationResult::failure(source_not_found_code,
                                            source_not_found_message);
    }
    const auto source_position = static_cast<std::size_t>(
        std::distance(workingMemory.entries().begin(), found));

    const auto destination = destination_status(longTermMemory, *found);
    if (destination == DestinationStatus::Conflict) {
        return ConsolidationResult::failure(destination_conflict_code,
                                            destination_conflict_message);
    }
    if (destination == DestinationStatus::Forgotten) {
        return ConsolidationResult::failure(destination_forgotten_code,
                                            destination_forgotten_message);
    }
    if (destination != DestinationStatus::Available) {
        return ConsolidationResult::failure(
            transition_state_mismatch_code, transition_state_mismatch_message);
    }

    auto next = std::make_unique<ConsolidationSession::Impl>();
    next->state = ConsolidationSession::State::Analyzed;
    next->request = std::make_unique<ConsolidationRequest>(request);
    next->candidate = std::make_unique<ConsolidationCandidate>(
        ConsolidationCandidate{session.workspaceIdentifier(),
                               request.taskIdentifier(), source_position,
                               *found, nullptr, std::nullopt});
    next->analyzed_working_memory =
        std::make_unique<WorkingMemory>(workingMemory);
    next->analyzed_long_term_memory =
        std::make_unique<LongTermMemory>(longTermMemory);

    auto result = ConsolidationResult::success(
        std::make_unique<ConsolidationCandidate>(*next->candidate));
    session.impl_ = std::move(next);
    return result;
}

ConsolidationResult
MemoryConsolidationEngine::promote(ConsolidationSession& session) const {
    if (session.state() == ConsolidationSession::State::Forgotten) {
        return ConsolidationResult::failure(session_forgotten_code,
                                            session_forgotten_message);
    }
    if (session.state() == ConsolidationSession::State::Retained) {
        return ConsolidationResult::failure(session_already_retained_code,
                                            session_already_retained_message);
    }
    if (session.state() == ConsolidationSession::State::Pristine) {
        return ConsolidationResult::failure(session_not_analyzed_code,
                                            session_not_analyzed_message);
    }
    if (session.impl_ == nullptr || session.impl_->request == nullptr ||
        session.impl_->candidate == nullptr ||
        session.impl_->analyzed_working_memory == nullptr ||
        session.impl_->analyzed_long_term_memory == nullptr ||
        session.impl_->working_memory != nullptr ||
        session.impl_->long_term_memory != nullptr) {
        return ConsolidationResult::failure(
            transition_state_mismatch_code, transition_state_mismatch_message);
    }

    if (session.state() == ConsolidationSession::State::Promoted) {
        if (!promoted_candidate_valid(*session.impl_->candidate,
                                      *session.impl_->request,
                                      session.workspaceIdentifier())) {
            return ConsolidationResult::failure(
                transition_state_mismatch_code,
                transition_state_mismatch_message);
        }
        return ConsolidationResult::success(
            std::make_unique<ConsolidationCandidate>(
                *session.impl_->candidate));
    }

    if (!analyzed_candidate_valid(*session.impl_->candidate,
                                  *session.impl_->request,
                                  session.workspaceIdentifier())) {
        return ConsolidationResult::failure(
            transition_state_mismatch_code, transition_state_mismatch_message);
    }

    const auto* const source =
        session.impl_->candidate->workingMemoryEntry();
    auto next = std::make_unique<ConsolidationSession::Impl>(*session.impl_);
    auto promoted = ConsolidationCandidate{
        session.impl_->candidate->workspaceIdentifier(),
        session.impl_->candidate->taskIdentifier(),
        session.impl_->candidate->sourcePosition(), *source,
        std::make_unique<LongTermMemoryEntry>(source->identifier(),
                                              source->value()),
        std::nullopt};
    next->candidate =
        std::make_unique<ConsolidationCandidate>(std::move(promoted));
    next->state = ConsolidationSession::State::Promoted;

    auto result = ConsolidationResult::success(
        std::make_unique<ConsolidationCandidate>(*next->candidate));
    session.impl_ = std::move(next);
    return result;
}

ConsolidationResult MemoryConsolidationEngine::retain(
    ConsolidationSession& session,
    const WorkingMemory& workingMemory,
    const LongTermMemory& longTermMemory) const {
    if (session.state() == ConsolidationSession::State::Forgotten) {
        return ConsolidationResult::failure(session_forgotten_code,
                                            session_forgotten_message);
    }
    if (session.state() == ConsolidationSession::State::Pristine) {
        return ConsolidationResult::failure(session_not_analyzed_code,
                                            session_not_analyzed_message);
    }
    if (session.state() == ConsolidationSession::State::Analyzed) {
        return ConsolidationResult::failure(session_not_promoted_code,
                                            session_not_promoted_message);
    }
    if (session.state() == ConsolidationSession::State::Retained) {
        return ConsolidationResult::failure(session_already_retained_code,
                                            session_already_retained_message);
    }
    if (session.impl_ == nullptr || session.impl_->request == nullptr ||
        session.impl_->candidate == nullptr ||
        session.impl_->analyzed_working_memory == nullptr ||
        session.impl_->analyzed_long_term_memory == nullptr ||
        session.impl_->working_memory != nullptr ||
        session.impl_->long_term_memory != nullptr ||
        !promoted_candidate_valid(*session.impl_->candidate,
                                  *session.impl_->request,
                                  session.workspaceIdentifier())) {
        return ConsolidationResult::failure(
            transition_state_mismatch_code, transition_state_mismatch_message);
    }
    if (workingMemory.workspaceIdentifier() != session.workspaceIdentifier()) {
        return ConsolidationResult::failure(workspace_mismatch_code,
                                            workspace_mismatch_message);
    }
    if (longTermMemory.workspaceIdentifier() !=
        session.workspaceIdentifier()) {
        return ConsolidationResult::failure(workspace_mismatch_code,
                                            workspace_mismatch_message);
    }
    if (!workingMemory.active()) {
        return ConsolidationResult::failure(
            working_memory_not_active_code, working_memory_not_active_message);
    }
    if (!workingMemory.activeTaskIdentifier().has_value() ||
        *workingMemory.activeTaskIdentifier() !=
            session.impl_->request->taskIdentifier()) {
        return ConsolidationResult::failure(task_mismatch_code,
                                            task_mismatch_message);
    }

    const auto source_position = session.impl_->candidate->sourcePosition();
    const auto* const source = session.impl_->candidate->workingMemoryEntry();
    if (source_position >= workingMemory.entries().size() || source == nullptr ||
        !equal_entry(workingMemory.entries()[source_position], *source)) {
        return ConsolidationResult::failure(source_changed_code,
                                            source_changed_message);
    }
    if (!equal_memory(workingMemory,
                      *session.impl_->analyzed_working_memory)) {
        return ConsolidationResult::failure(
            transition_state_mismatch_code, transition_state_mismatch_message);
    }
    if (longTermMemory.find(source->identifier()) != nullptr) {
        return ConsolidationResult::failure(destination_conflict_code,
                                            destination_conflict_message);
    }
    if (!equal_memory(longTermMemory,
                      *session.impl_->analyzed_long_term_memory)) {
        return ConsolidationResult::failure(
            transition_state_mismatch_code, transition_state_mismatch_message);
    }

    const auto destination = destination_status(longTermMemory, *source);
    if (destination == DestinationStatus::Forgotten) {
        return ConsolidationResult::failure(destination_forgotten_code,
                                            destination_forgotten_message);
    }
    if (destination == DestinationStatus::Conflict) {
        return ConsolidationResult::failure(destination_conflict_code,
                                            destination_conflict_message);
    }
    if (destination != DestinationStatus::Available) {
        return ConsolidationResult::failure(
            transition_state_mismatch_code, transition_state_mismatch_message);
    }

    WorkingMemory working_successor{workingMemory.workspaceIdentifier()};
    auto activation = WorkingMemoryEngine{}.activate(
        working_successor, *workingMemory.activeTaskIdentifier());
    if (!activation.succeeded()) {
        throw std::logic_error{"Unable to construct Working Memory successor"};
    }
    for (std::size_t index = 0; index < workingMemory.entries().size();
         ++index) {
        if (index == source_position) {
            continue;
        }
        auto stored = WorkingMemoryEngine{}.store(
            working_successor, workingMemory.entries()[index]);
        if (!stored.succeeded()) {
            throw std::logic_error{
                "Unable to preserve Working Memory successor"};
        }
    }

    LongTermMemory long_term_successor{longTermMemory};
    const auto* const proposal =
        session.impl_->candidate->longTermMemoryEntry();
    auto retained = LongTermMemoryEngine{}.retain(long_term_successor,
                                                  *proposal);
    if (!retained.succeeded()) {
        if (retained.code() == "FORGOTTEN_IDENTIFIER") {
            return ConsolidationResult::failure(destination_forgotten_code,
                                                destination_forgotten_message);
        }
        if (retained.code() == "IDENTIFIER_CONFLICT") {
            return ConsolidationResult::failure(destination_conflict_code,
                                                destination_conflict_message);
        }
        return ConsolidationResult::failure(
            transition_state_mismatch_code, transition_state_mismatch_message);
    }

    const auto retained_position = longTermMemory.size();
    auto retained_candidate = ConsolidationCandidate{
        session.impl_->candidate->workspaceIdentifier(),
        session.impl_->candidate->taskIdentifier(), source_position, *source,
        std::make_unique<LongTermMemoryEntry>(*proposal), retained_position};

    auto next = std::make_unique<ConsolidationSession::Impl>();
    next->state = ConsolidationSession::State::Retained;
    next->request =
        std::make_unique<ConsolidationRequest>(*session.impl_->request);
    next->candidate = std::make_unique<ConsolidationCandidate>(
        retained_candidate);
    next->working_memory =
        std::make_unique<WorkingMemory>(working_successor);
    next->long_term_memory =
        std::make_unique<LongTermMemory>(long_term_successor);

    auto result = ConsolidationResult::success(
        std::make_unique<ConsolidationCandidate>(retained_candidate), nullptr,
        std::make_unique<WorkingMemory>(working_successor),
        std::make_unique<LongTermMemory>(long_term_successor));
    session.impl_ = std::move(next);
    return result;
}

ConsolidationResult MemoryConsolidationEngine::validate(
    const ConsolidationSession& session,
    const WorkingMemory& workingMemory,
    const LongTermMemory& longTermMemory) const {
    if (session.state() == ConsolidationSession::State::Forgotten) {
        return ConsolidationResult::failure(session_forgotten_code,
                                            session_forgotten_message);
    }
    if (session.state() == ConsolidationSession::State::Pristine) {
        return ConsolidationResult::failure(session_not_analyzed_code,
                                            session_not_analyzed_message);
    }
    if (workingMemory.workspaceIdentifier() != session.workspaceIdentifier()) {
        return ConsolidationResult::failure(workspace_mismatch_code,
                                            workspace_mismatch_message);
    }
    if (longTermMemory.workspaceIdentifier() !=
        session.workspaceIdentifier()) {
        return ConsolidationResult::failure(workspace_mismatch_code,
                                            workspace_mismatch_message);
    }
    if (session.impl_ == nullptr || session.impl_->request == nullptr ||
        session.impl_->candidate == nullptr) {
        return ConsolidationResult::failure(
            transition_state_mismatch_code, transition_state_mismatch_message);
    }

    if (session.state() == ConsolidationSession::State::Retained) {
        if (session.impl_->analyzed_working_memory != nullptr ||
            session.impl_->analyzed_long_term_memory != nullptr ||
            session.impl_->working_memory == nullptr ||
            session.impl_->long_term_memory == nullptr ||
            !retained_candidate_valid(*session.impl_->candidate,
                                      *session.impl_->request,
                                      session.workspaceIdentifier())) {
            return ConsolidationResult::failure(
                transition_state_mismatch_code,
                transition_state_mismatch_message);
        }
        const auto position =
            *session.impl_->candidate->retainedPosition();
        const auto* const source =
            session.impl_->candidate->workingMemoryEntry();
        const auto* const proposal =
            session.impl_->candidate->longTermMemoryEntry();
        if (position >= session.impl_->long_term_memory->entries().size() ||
            session.impl_->working_memory->find(source->identifier()) !=
                nullptr ||
            !equal_entry(
                session.impl_->long_term_memory->entries()[position],
                *proposal) ||
            !equal_memory(workingMemory, *session.impl_->working_memory) ||
            !equal_memory(longTermMemory,
                          *session.impl_->long_term_memory)) {
            return ConsolidationResult::failure(
                transition_state_mismatch_code,
                transition_state_mismatch_message);
        }
        return ConsolidationResult::success();
    }

    const bool analyzed =
        session.state() == ConsolidationSession::State::Analyzed;
    if (session.impl_->analyzed_working_memory == nullptr ||
        session.impl_->analyzed_long_term_memory == nullptr ||
        session.impl_->working_memory != nullptr ||
        session.impl_->long_term_memory != nullptr ||
        (analyzed &&
         !analyzed_candidate_valid(*session.impl_->candidate,
                                   *session.impl_->request,
                                   session.workspaceIdentifier())) ||
        (!analyzed &&
         !promoted_candidate_valid(*session.impl_->candidate,
                                   *session.impl_->request,
                                   session.workspaceIdentifier()))) {
        return ConsolidationResult::failure(
            transition_state_mismatch_code, transition_state_mismatch_message);
    }
    if (!workingMemory.active()) {
        return ConsolidationResult::failure(
            working_memory_not_active_code, working_memory_not_active_message);
    }
    if (!workingMemory.activeTaskIdentifier().has_value() ||
        *workingMemory.activeTaskIdentifier() !=
            session.impl_->request->taskIdentifier()) {
        return ConsolidationResult::failure(task_mismatch_code,
                                            task_mismatch_message);
    }
    const auto source_position = session.impl_->candidate->sourcePosition();
    const auto* const source = session.impl_->candidate->workingMemoryEntry();
    if (source_position >= workingMemory.entries().size() || source == nullptr ||
        !equal_entry(workingMemory.entries()[source_position], *source)) {
        return ConsolidationResult::failure(source_changed_code,
                                            source_changed_message);
    }
    if (!equal_memory(workingMemory,
                      *session.impl_->analyzed_working_memory)) {
        return ConsolidationResult::failure(
            transition_state_mismatch_code, transition_state_mismatch_message);
    }
    if (longTermMemory.find(source->identifier()) != nullptr) {
        return ConsolidationResult::failure(destination_conflict_code,
                                            destination_conflict_message);
    }
    if (!equal_memory(longTermMemory,
                      *session.impl_->analyzed_long_term_memory)) {
        return ConsolidationResult::failure(
            transition_state_mismatch_code, transition_state_mismatch_message);
    }
    const auto destination = destination_status(longTermMemory, *source);
    if (destination == DestinationStatus::Forgotten) {
        return ConsolidationResult::failure(destination_forgotten_code,
                                            destination_forgotten_message);
    }
    if (destination == DestinationStatus::Conflict) {
        return ConsolidationResult::failure(destination_conflict_code,
                                            destination_conflict_message);
    }
    if (destination != DestinationStatus::Available) {
        return ConsolidationResult::failure(
            transition_state_mismatch_code, transition_state_mismatch_message);
    }
    return ConsolidationResult::success();
}

ConsolidationResult MemoryConsolidationEngine::retrieveSession(
    const ConsolidationSession& session) const {
    return ConsolidationResult::success(
        nullptr, std::make_unique<ConsolidationSession>(session));
}

ConsolidationResult MemoryConsolidationEngine::forgetSession(
    ConsolidationSession& session) const {
    auto next = std::make_unique<ConsolidationSession::Impl>();
    next->state = ConsolidationSession::State::Forgotten;
    auto result = ConsolidationResult::success();
    session.impl_ = std::move(next);
    return result;
}

} // namespace cca::memory
