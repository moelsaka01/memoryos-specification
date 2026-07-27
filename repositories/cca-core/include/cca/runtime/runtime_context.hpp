#pragma once

#include <cca/core/configuration.hpp>
#include <cca/runtime/runtime_id.hpp>

namespace cca::runtime {

class ConfigurationManager;
class EventBus;
class Observability;

/// Instance-scoped execution context supplied to service Providers.
///
/// Runtime owns the context and every referenced component. Providers receive a
/// non-owning reference during start and stop; they must not retain the context
/// beyond the Runtime lifetime. Required service collaboration is deliberately
/// absent and must be constructor-injected. The context exposes immutable
/// configuration, the instance Event Bus, and an inspection-only Observability
/// view. Providers cannot append Runtime Foundation outcome evidence or update
/// its metrics. Concurrent access is safe subject to the documented contracts
/// of those components.
class RuntimeContext final {
  public:
    RuntimeContext(RuntimeId runtime_id,
                   ConfigurationManager& configuration_manager,
                   EventBus& event_bus,
                   const Observability& observability);

    [[nodiscard]] const RuntimeId& runtime_id() const noexcept;
    [[nodiscard]] const cca::core::Configuration& configuration() const;
    [[nodiscard]] EventBus& event_bus() const noexcept;
    [[nodiscard]] const Observability& observability() const noexcept;

  private:
    RuntimeId runtime_id_;
    ConfigurationManager& configuration_manager_;
    EventBus& event_bus_;
    const Observability& observability_;
};

} // namespace cca::runtime
