#include <cca/runtime/configuration_manager.hpp>
#include <cca/runtime/event_bus.hpp>
#include <cca/runtime/observability.hpp>
#include <cca/runtime/runtime_context.hpp>

#include <stdexcept>
#include <utility>

namespace cca::runtime {

RuntimeContext::RuntimeContext(RuntimeId runtime_id,
                               ConfigurationManager& configuration_manager,
                               EventBus& event_bus,
                               const Observability& observability)
    : runtime_id_(std::move(runtime_id)), configuration_manager_(configuration_manager),
      event_bus_(event_bus), observability_(observability) {}

const RuntimeId& RuntimeContext::runtime_id() const noexcept {
    return runtime_id_;
}

const cca::core::Configuration& RuntimeContext::configuration() const {
    const auto snapshot = configuration_manager_.snapshot();
    if (snapshot == nullptr) {
        throw std::logic_error{"Runtime configuration is not available"};
    }
    return *snapshot;
}

EventBus& RuntimeContext::event_bus() const noexcept {
    return event_bus_;
}

const Observability& RuntimeContext::observability() const noexcept {
    return observability_;
}

} // namespace cca::runtime
