#include <cca/memory/memory_provider.hpp>

#include <algorithm>
#include <stdexcept>
#include <utility>

namespace cca::memory {
namespace {

constexpr auto ok_code = "OK";
constexpr auto session_forgotten_code = "SESSION_FORGOTTEN";
constexpr auto session_already_completed_code =
    "SESSION_ALREADY_COMPLETED";
constexpr auto workspace_mismatch_code = "WORKSPACE_MISMATCH";
constexpr auto invalid_provider_identifier_code =
    "INVALID_PROVIDER_IDENTIFIER";
constexpr auto provider_not_registered_code = "PROVIDER_NOT_REGISTERED";

constexpr auto session_forgotten_message =
    "Provider Session has been forgotten";
constexpr auto session_already_completed_message =
    "Provider Session has already completed transport";
constexpr auto workspace_mismatch_message =
    "Provider Workspace identifiers do not match";
constexpr auto invalid_provider_identifier_message =
    "Provider identifier must not be empty";
constexpr auto provider_not_registered_message =
    "Provider identifier is not registered in the Session";

struct ValidationFailure {
    const char* code{};
    const char* message{};

    explicit operator bool() const noexcept { return code != nullptr; }
};

const std::string& empty_string() noexcept {
    static const std::string value;
    return value;
}

const std::vector<Reflection>& empty_reflections() noexcept {
    static const std::vector<Reflection> value;
    return value;
}

bool provider_is_registered(const ProviderSession& session,
                            const std::string& identifier) noexcept {
    const auto& descriptors = session.descriptors();
    return std::any_of(descriptors.cbegin(), descriptors.cend(),
                       [&identifier](const auto& descriptor) {
                           return descriptor.identifier() == identifier;
                       });
}

template <typename Value>
bool has_workspace(const Value* const value,
                   const std::string& workspaceIdentifier) noexcept {
    return value != nullptr &&
           value->workspaceIdentifier() == workspaceIdentifier;
}

ValidationFailure validate_request(const ProviderSession& session,
                                   const ProviderRequest& request) noexcept {
    const auto& workspace_identifier = session.workspaceIdentifier();
    if (request.workspaceIdentifier() != workspace_identifier) {
        return {workspace_mismatch_code, workspace_mismatch_message};
    }
    if (request.providerIdentifier().empty()) {
        return {invalid_provider_identifier_code,
                invalid_provider_identifier_message};
    }
    if (!provider_is_registered(session, request.providerIdentifier())) {
        return {provider_not_registered_code,
                provider_not_registered_message};
    }

    if (!has_workspace(request.memory(), workspace_identifier) ||
        !has_workspace(request.workingMemory(), workspace_identifier) ||
        !has_workspace(request.longTermMemory(), workspace_identifier) ||
        !has_workspace(request.semanticMemory(), workspace_identifier) ||
        !has_workspace(request.episodicMemory(), workspace_identifier) ||
        !has_workspace(request.proceduralMemory(), workspace_identifier)) {
        return {workspace_mismatch_code, workspace_mismatch_message};
    }

    for (const auto& reflection : request.reflections()) {
        if (reflection.workspaceIdentifier() != workspace_identifier) {
            return {workspace_mismatch_code, workspace_mismatch_message};
        }
    }

    // Released aggregate and Reflection Contracts establish their remaining
    // public structural invariants. Direct value copies preserve those
    // invariants and their private identity histories without live lookup.
    return {};
}

} // namespace

ProviderDescriptor::ProviderDescriptor(std::string workspaceIdentifier,
                                       std::string identifier)
    : workspace_identifier_(std::move(workspaceIdentifier)),
      identifier_(std::move(identifier)) {
    if (workspace_identifier_.empty()) {
        throw std::invalid_argument{
            "Provider Workspace identifier must not be empty"};
    }
}

ProviderDescriptor::~ProviderDescriptor() = default;
ProviderDescriptor::ProviderDescriptor(const ProviderDescriptor&) = default;

ProviderDescriptor&
ProviderDescriptor::operator=(const ProviderDescriptor& other) {
    if (this != &other) {
        ProviderDescriptor replacement{other};
        workspace_identifier_.swap(replacement.workspace_identifier_);
        identifier_.swap(replacement.identifier_);
    }
    return *this;
}

ProviderDescriptor::ProviderDescriptor(ProviderDescriptor&& other) noexcept
    : workspace_identifier_(std::move(other.workspace_identifier_)),
      identifier_(std::move(other.identifier_)) {
    other.workspace_identifier_.clear();
    other.identifier_.clear();
}

ProviderDescriptor&
ProviderDescriptor::operator=(ProviderDescriptor&& other) noexcept {
    if (this != &other) {
        ProviderDescriptor replacement{std::move(other)};
        workspace_identifier_.swap(replacement.workspace_identifier_);
        identifier_.swap(replacement.identifier_);
    }
    return *this;
}

const std::string&
ProviderDescriptor::workspaceIdentifier() const noexcept {
    return workspace_identifier_;
}

const std::string& ProviderDescriptor::identifier() const noexcept {
    return identifier_;
}

class ProviderRequest::Impl {
  public:
    Impl(std::string workspaceIdentifier,
         std::string providerIdentifier,
         const Memory& memoryValue,
         const WorkingMemory& workingMemoryValue,
         const LongTermMemory& longTermMemoryValue,
         const SemanticMemory& semanticMemoryValue,
         const EpisodicMemory& episodicMemoryValue,
         const ProceduralMemory& proceduralMemoryValue,
         std::vector<Reflection> reflectionValues)
        : workspace_identifier(std::move(workspaceIdentifier)),
          provider_identifier(std::move(providerIdentifier)),
          memory(memoryValue), working_memory(workingMemoryValue),
          long_term_memory(longTermMemoryValue),
          semantic_memory(semanticMemoryValue),
          episodic_memory(episodicMemoryValue),
          procedural_memory(proceduralMemoryValue),
          reflections(std::move(reflectionValues)) {}

    std::string workspace_identifier;
    std::string provider_identifier;
    Memory memory;
    WorkingMemory working_memory;
    LongTermMemory long_term_memory;
    SemanticMemory semantic_memory;
    EpisodicMemory episodic_memory;
    ProceduralMemory procedural_memory;
    std::vector<Reflection> reflections;
};

ProviderRequest::ProviderRequest(std::string workspaceIdentifier,
                                 std::string providerIdentifier,
                                 const Memory& memory,
                                 const WorkingMemory& workingMemory,
                                 const LongTermMemory& longTermMemory,
                                 const SemanticMemory& semanticMemory,
                                 const EpisodicMemory& episodicMemory,
                                 const ProceduralMemory& proceduralMemory,
                                 std::vector<Reflection> reflections) {
    if (workspaceIdentifier.empty()) {
        throw std::invalid_argument{
            "Provider Workspace identifier must not be empty"};
    }
    impl_ = std::make_unique<Impl>(
        std::move(workspaceIdentifier), std::move(providerIdentifier), memory,
        workingMemory, longTermMemory, semanticMemory, episodicMemory,
        proceduralMemory, std::move(reflections));
}

ProviderRequest::~ProviderRequest() = default;

ProviderRequest::ProviderRequest(const ProviderRequest& other)
    : impl_(other.impl_ != nullptr ? std::make_unique<Impl>(*other.impl_)
                                  : nullptr) {}

ProviderRequest& ProviderRequest::operator=(const ProviderRequest& other) {
    if (this != &other) {
        auto replacement = other.impl_ != nullptr
                               ? std::make_unique<Impl>(*other.impl_)
                               : nullptr;
        impl_.swap(replacement);
    }
    return *this;
}

ProviderRequest::ProviderRequest(ProviderRequest&&) noexcept = default;
ProviderRequest& ProviderRequest::operator=(ProviderRequest&&) noexcept =
    default;

const std::string& ProviderRequest::workspaceIdentifier() const noexcept {
    return impl_ != nullptr ? impl_->workspace_identifier : empty_string();
}

const std::string& ProviderRequest::providerIdentifier() const noexcept {
    return impl_ != nullptr ? impl_->provider_identifier : empty_string();
}

const Memory* ProviderRequest::memory() const noexcept {
    return impl_ != nullptr ? &impl_->memory : nullptr;
}

const WorkingMemory* ProviderRequest::workingMemory() const noexcept {
    return impl_ != nullptr ? &impl_->working_memory : nullptr;
}

const LongTermMemory* ProviderRequest::longTermMemory() const noexcept {
    return impl_ != nullptr ? &impl_->long_term_memory : nullptr;
}

const SemanticMemory* ProviderRequest::semanticMemory() const noexcept {
    return impl_ != nullptr ? &impl_->semantic_memory : nullptr;
}

const EpisodicMemory* ProviderRequest::episodicMemory() const noexcept {
    return impl_ != nullptr ? &impl_->episodic_memory : nullptr;
}

const ProceduralMemory*
ProviderRequest::proceduralMemory() const noexcept {
    return impl_ != nullptr ? &impl_->procedural_memory : nullptr;
}

const std::vector<Reflection>& ProviderRequest::reflections() const noexcept {
    return impl_ != nullptr ? impl_->reflections : empty_reflections();
}

ProviderSession::ProviderSession(std::string workspaceIdentifier) {
    if (workspaceIdentifier.empty()) {
        throw std::invalid_argument{
            "Provider Workspace identifier must not be empty"};
    }
    workspace_identifier_ =
        std::make_shared<const std::string>(std::move(workspaceIdentifier));
}

ProviderSession::~ProviderSession() = default;

ProviderSession::ProviderSession(const ProviderSession& other)
    : workspace_identifier_(std::make_shared<const std::string>(
          other.workspaceIdentifier())),
      state_(other.state_), descriptors_(other.descriptors_) {}

ProviderSession::ProviderSession(ProviderSession&& other) noexcept
    : workspace_identifier_(other.workspace_identifier_), state_(other.state_),
      descriptors_(std::move(other.descriptors_)) {
    other.descriptors_.clear();
    if (other.state_ != State::Forgotten) {
        other.state_ = State::Open;
    }
}

const std::string& ProviderSession::workspaceIdentifier() const noexcept {
    return *workspace_identifier_;
}

ProviderSession::State ProviderSession::state() const noexcept {
    return state_;
}

std::size_t ProviderSession::size() const noexcept {
    return descriptors_.size();
}

const std::vector<ProviderDescriptor>&
ProviderSession::descriptors() const noexcept {
    return descriptors_;
}

ProviderResult::ProviderResult(
    std::string workspaceIdentifier,
    std::string code,
    std::string message,
    std::unique_ptr<ProviderRequest> request,
    std::vector<ProviderDescriptor> descriptors)
    : workspace_identifier_(std::move(workspaceIdentifier)),
      code_(std::move(code)), message_(std::move(message)),
      request_(std::move(request)), descriptors_(std::move(descriptors)) {}

ProviderResult ProviderResult::success(
    std::string workspaceIdentifier,
    std::unique_ptr<ProviderRequest> request,
    std::vector<ProviderDescriptor> descriptors) {
    return ProviderResult{std::move(workspaceIdentifier), ok_code, {},
                          std::move(request), std::move(descriptors)};
}

ProviderResult ProviderResult::failure(std::string workspaceIdentifier,
                                       std::string code,
                                       std::string message) {
    return ProviderResult{std::move(workspaceIdentifier), std::move(code),
                          std::move(message), nullptr, {}};
}

ProviderResult::~ProviderResult() = default;

ProviderResult::ProviderResult(ProviderResult&& other) noexcept
    : workspace_identifier_(std::move(other.workspace_identifier_)),
      code_(std::move(other.code_)), message_(std::move(other.message_)),
      request_(std::move(other.request_)),
      descriptors_(std::move(other.descriptors_)) {
    other.workspace_identifier_.clear();
    other.code_.clear();
    other.message_.clear();
    other.request_.reset();
    other.descriptors_.clear();
}

ProviderResult& ProviderResult::operator=(ProviderResult&& other) noexcept {
    if (this != &other) {
        ProviderResult replacement{std::move(other)};
        workspace_identifier_.swap(replacement.workspace_identifier_);
        code_.swap(replacement.code_);
        message_.swap(replacement.message_);
        request_.swap(replacement.request_);
        descriptors_.swap(replacement.descriptors_);
    }
    return *this;
}

const std::string& ProviderResult::workspaceIdentifier() const noexcept {
    return workspace_identifier_;
}

bool ProviderResult::succeeded() const noexcept { return code_ == ok_code; }

const std::string& ProviderResult::code() const noexcept { return code_; }

const std::string& ProviderResult::message() const noexcept {
    return message_;
}

const ProviderRequest* ProviderResult::request() const noexcept {
    return request_.get();
}

const std::vector<ProviderDescriptor>&
ProviderResult::descriptors() const noexcept {
    return descriptors_;
}

ProviderResult MemoryProviderEngine::registerProvider(
    ProviderSession& session,
    const ProviderDescriptor& descriptor) const {
    if (session.state_ == ProviderSession::State::Forgotten) {
        return ProviderResult::failure(
            session.workspaceIdentifier(), session_forgotten_code,
            session_forgotten_message);
    }
    if (session.state_ != ProviderSession::State::Open) {
        return ProviderResult::failure(
            session.workspaceIdentifier(), session_already_completed_code,
            session_already_completed_message);
    }
    if (descriptor.workspaceIdentifier() != session.workspaceIdentifier()) {
        return ProviderResult::failure(session.workspaceIdentifier(),
                                       workspace_mismatch_code,
                                       workspace_mismatch_message);
    }
    if (descriptor.identifier().empty()) {
        return ProviderResult::failure(
            session.workspaceIdentifier(), invalid_provider_identifier_code,
            invalid_provider_identifier_message);
    }
    if (provider_is_registered(session, descriptor.identifier())) {
        return ProviderResult::success(session.workspaceIdentifier());
    }

    ProviderSession replacement{session};
    replacement.descriptors_.push_back(descriptor);
    auto result = ProviderResult::success(session.workspaceIdentifier());
    session.descriptors_.swap(replacement.descriptors_);
    session.state_ = replacement.state_;
    return result;
}

ProviderResult
MemoryProviderEngine::exportState(ProviderSession& session,
                                  const ProviderRequest& request) const {
    if (session.state_ == ProviderSession::State::Forgotten) {
        return ProviderResult::failure(
            session.workspaceIdentifier(), session_forgotten_code,
            session_forgotten_message);
    }
    if (session.state_ != ProviderSession::State::Open) {
        return ProviderResult::failure(
            session.workspaceIdentifier(), session_already_completed_code,
            session_already_completed_message);
    }
    const auto failure = validate_request(session, request);
    if (failure) {
        return ProviderResult::failure(session.workspaceIdentifier(),
                                       failure.code, failure.message);
    }

    auto request_copy = std::make_unique<ProviderRequest>(request);
    ProviderSession replacement{session};
    replacement.state_ = ProviderSession::State::Exported;
    auto result = ProviderResult::success(session.workspaceIdentifier(),
                                          std::move(request_copy));
    session.descriptors_.swap(replacement.descriptors_);
    session.state_ = replacement.state_;
    return result;
}

ProviderResult
MemoryProviderEngine::importState(ProviderSession& session,
                                  const ProviderRequest& request) const {
    if (session.state_ == ProviderSession::State::Forgotten) {
        return ProviderResult::failure(
            session.workspaceIdentifier(), session_forgotten_code,
            session_forgotten_message);
    }
    if (session.state_ != ProviderSession::State::Open) {
        return ProviderResult::failure(
            session.workspaceIdentifier(), session_already_completed_code,
            session_already_completed_message);
    }
    const auto failure = validate_request(session, request);
    if (failure) {
        return ProviderResult::failure(session.workspaceIdentifier(),
                                       failure.code, failure.message);
    }

    auto request_copy = std::make_unique<ProviderRequest>(request);
    ProviderSession replacement{session};
    replacement.state_ = ProviderSession::State::Imported;
    auto result = ProviderResult::success(session.workspaceIdentifier(),
                                          std::move(request_copy));
    session.descriptors_.swap(replacement.descriptors_);
    session.state_ = replacement.state_;
    return result;
}

ProviderResult
MemoryProviderEngine::validate(const ProviderSession& session,
                               const ProviderRequest& request) const {
    if (session.state() == ProviderSession::State::Forgotten) {
        return ProviderResult::failure(
            session.workspaceIdentifier(), session_forgotten_code,
            session_forgotten_message);
    }
    const auto failure = validate_request(session, request);
    if (failure) {
        return ProviderResult::failure(session.workspaceIdentifier(),
                                       failure.code, failure.message);
    }
    return ProviderResult::success(session.workspaceIdentifier());
}

ProviderResult
MemoryProviderEngine::enumerate(const ProviderSession& session) const {
    if (session.state() == ProviderSession::State::Forgotten) {
        return ProviderResult::failure(
            session.workspaceIdentifier(), session_forgotten_code,
            session_forgotten_message);
    }
    auto descriptors = session.descriptors();
    return ProviderResult::success(session.workspaceIdentifier(), nullptr,
                                   std::move(descriptors));
}

ProviderResult
MemoryProviderEngine::forgetSession(ProviderSession& session) const {
    if (session.state_ == ProviderSession::State::Forgotten) {
        return ProviderResult::success(session.workspaceIdentifier());
    }

    ProviderSession replacement{session.workspaceIdentifier()};
    replacement.state_ = ProviderSession::State::Forgotten;
    auto result = ProviderResult::success(session.workspaceIdentifier());
    session.descriptors_.swap(replacement.descriptors_);
    session.state_ = replacement.state_;
    return result;
}

} // namespace cca::memory
