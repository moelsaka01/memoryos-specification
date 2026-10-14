#include <cca/process/process.hpp>

#include "process_test_access.hpp"

#include <array>
#include <cstddef>
#include <memory>
#include <stdexcept>
#include <string>
#include <utility>
#include <vector>

namespace cca::process {
namespace {

using cca::representation::Diagnostic;
using cca::representation::RepresentationDocument;
using cca::representation::RepresentationId;
using cca::representation::ValidationService;

constexpr auto invalid_definition_message =
    "Cannot construct a ProcessDefinition from an invalid RepresentationDocument";
constexpr auto invalid_result_message =
    "RepresentationDocument validation failed";

const std::vector<RepresentationId>& empty_execution_order() noexcept {
    static const std::vector<RepresentationId> value;
    return value;
}

} // namespace

class ProcessDefinition::Impl {
  public:
    Impl() = default;

    explicit Impl(const RepresentationDocument& document) {
        const auto& entities = document.entities();
        const auto& relationships = document.relationships();

        entity_count = entities.size();
        relationship_count = relationships.size();

        for (const auto& entity_reference : entities) {
            property_count += entity_reference.get().properties().size();
        }
        for (const auto& relationship_reference : relationships) {
            property_count += relationship_reference.get().properties().size();
        }

        execution_order.reserve(
            entity_count + relationship_count + property_count);

        for (const auto& entity_reference : entities) {
            const auto& entity = entity_reference.get();
            execution_order.push_back(entity.id());
            for (const auto& property_reference : entity.properties()) {
                execution_order.push_back(property_reference.get().id());
            }
        }
        for (const auto& relationship_reference : relationships) {
            const auto& relationship = relationship_reference.get();
            execution_order.push_back(relationship.id());
            for (const auto& property_reference : relationship.properties()) {
                execution_order.push_back(property_reference.get().id());
            }
        }
    }

    std::vector<RepresentationId> execution_order;
    std::size_t entity_count{};
    std::size_t relationship_count{};
    std::size_t property_count{};
};

ProcessDefinition::ProcessDefinition(const RepresentationDocument& document) {
    const auto validation = ValidationService{}.validate(document);
    if (!validation.valid) {
        throw std::invalid_argument{invalid_definition_message};
    }

    impl_ = std::make_unique<Impl>(document);
}

ProcessDefinition::~ProcessDefinition() = default;

ProcessDefinition::ProcessDefinition(const ProcessDefinition& other)
    : impl_(other.impl_ != nullptr ? std::make_unique<Impl>(*other.impl_)
                                  : std::make_unique<Impl>()) {}

ProcessDefinition&
ProcessDefinition::operator=(const ProcessDefinition& other) {
    if (this == &other) {
        return *this;
    }

    std::unique_ptr<Impl> replacement;
    if (other.impl_ != nullptr) {
        replacement = std::make_unique<Impl>(*other.impl_);
    } else {
        replacement = std::make_unique<Impl>();
    }
    impl_ = std::move(replacement);
    return *this;
}

ProcessDefinition::ProcessDefinition(ProcessDefinition&& other) noexcept =
    default;

ProcessDefinition&
ProcessDefinition::operator=(ProcessDefinition&& other) noexcept = default;

const std::vector<RepresentationId>&
ProcessDefinition::executionOrder() const noexcept {
    return impl_ != nullptr ? impl_->execution_order : empty_execution_order();
}

std::size_t ProcessDefinition::entityCount() const noexcept {
    return impl_ != nullptr ? impl_->entity_count : 0U;
}

std::size_t ProcessDefinition::relationshipCount() const noexcept {
    return impl_ != nullptr ? impl_->relationship_count : 0U;
}

std::size_t ProcessDefinition::propertyCount() const noexcept {
    return impl_ != nullptr ? impl_->property_count : 0U;
}

class ExecutionContext::Impl {
  public:
    explicit Impl(ProcessDefinition process_definition)
        : definition(std::move(process_definition)) {}

    void transitionTo(const ExecutionState next) noexcept {
        state = next;
        if (transition_count < transitions.size()) {
            transitions[transition_count] = next;
            ++transition_count;
        }
    }

    ProcessDefinition definition;
    ExecutionState state{ExecutionState::Ready};
    std::vector<RepresentationId> trace;
    std::array<ExecutionState, 3U> transitions{
        ExecutionState::Ready,
        ExecutionState::Ready,
        ExecutionState::Ready,
    };
    std::size_t transition_count{1U};
};

ExecutionContext::ExecutionContext(ProcessDefinition definition)
    : impl_(std::make_unique<Impl>(std::move(definition))) {}

ExecutionContext::~ExecutionContext() = default;

const ProcessDefinition& ExecutionContext::definition() const noexcept {
    return impl_->definition;
}

ExecutionState ExecutionContext::state() const noexcept {
    return impl_->state;
}

const std::vector<RepresentationId>& ExecutionContext::trace() const noexcept {
    return impl_->trace;
}

std::vector<ExecutionState>
ProcessInternalAccess::stateTransitions(const ExecutionContext& context) {
    return {
        context.impl_->transitions.begin(),
        context.impl_->transitions.begin() +
            static_cast<std::ptrdiff_t>(context.impl_->transition_count),
    };
}

void ProcessInternalAccess::setState(ExecutionContext& context,
                                     const ExecutionState state) noexcept {
    context.impl_->state = state;
}

ExecutionResult::ExecutionResult(
    const ExecutionState state,
    const Code code,
    std::string message,
    std::vector<RepresentationId> trace,
    std::vector<Diagnostic> diagnostics)
    : state_(state), code_(code), message_(std::move(message)),
      trace_(std::move(trace)), diagnostics_(std::move(diagnostics)) {
    const auto success_invariants =
        state_ == ExecutionState::Completed && code_ == Code::Success &&
        message_.empty() && diagnostics_.empty();
    const auto invalid_invariants =
        state_ == ExecutionState::Failed &&
        code_ == Code::InvalidRepresentation && !message_.empty() &&
        trace_.empty();

    if (!success_invariants && !invalid_invariants) {
        throw std::logic_error{"Invalid ExecutionResult invariants"};
    }
}

bool ExecutionResult::succeeded() const noexcept {
    return state_ == ExecutionState::Completed && code_ == Code::Success;
}

ExecutionState ExecutionResult::state() const noexcept {
    return state_;
}

ExecutionResult::Code ExecutionResult::code() const noexcept {
    return code_;
}

std::string_view ExecutionResult::message() const noexcept {
    return message_;
}

const std::vector<RepresentationId>& ExecutionResult::trace() const noexcept {
    return trace_;
}

const std::vector<Diagnostic>& ExecutionResult::diagnostics() const noexcept {
    return diagnostics_;
}

ExecutionResult ProcessEngine::execute(
    const RepresentationDocument& document) const {
    auto validation = ValidationService{}.validate(document);
    if (!validation.valid) {
        return ExecutionResult{
            ExecutionState::Failed,
            ExecutionResult::Code::InvalidRepresentation,
            invalid_result_message,
            {},
            std::move(validation.diagnostics),
        };
    }

    const ProcessDefinition definition{document};
    return execute(definition);
}

ExecutionResult
ProcessEngine::execute(const ProcessDefinition& definition) const {
    ExecutionContext context{definition};
    return execute(context);
}

ExecutionResult ProcessEngine::execute(ExecutionContext& context) const {
    if (context.impl_->state != ExecutionState::Ready) {
        throw std::logic_error{"Only a Ready ExecutionContext may be executed"};
    }

    auto context_trace = context.impl_->definition.executionOrder();
    auto result_trace = context_trace;
    ExecutionResult result{
        ExecutionState::Completed,
        ExecutionResult::Code::Success,
        {},
        std::move(result_trace),
        {},
    };

    context.impl_->transitionTo(ExecutionState::Running);
    context.impl_->trace.swap(context_trace);
    context.impl_->transitionTo(ExecutionState::Completed);

    return result;
}

} // namespace cca::process
