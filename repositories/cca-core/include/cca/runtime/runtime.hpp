#pragma once

#include <cca/core/configuration.hpp>
#include <cca/runtime/configuration_manager.hpp>
#include <cca/runtime/dependency_injector.hpp>
#include <cca/runtime/event_bus.hpp>
#include <cca/runtime/execution_policy.hpp>
#include <cca/runtime/lifecycle_manager.hpp>
#include <cca/runtime/observability.hpp>
#include <cca/runtime/runtime_context.hpp>
#include <cca/runtime/runtime_id.hpp>
#include <cca/runtime/runtime_result.hpp>
#include <cca/runtime/runtime_state.hpp>
#include <cca/runtime/service_registry.hpp>

#include <cstddef>
#include <functional>
#include <mutex>
#include <vector>

namespace cca::runtime {

class RuntimeBuilder;

/// Owns one isolated CCA Runtime Foundation instance.
///
/// Runtime is an orchestration surface, not a seventh Runtime Foundation
/// component. It owns exactly LifecycleManager, ServiceRegistry,
/// DependencyInjector, EventBus, ConfigurationManager, and Observability plus
/// their instance-scoped RuntimeContext. start() executes the complete
/// Constructed-to-Running path; stop() executes Running-to-Destroyed. Expected
/// failures return RuntimeResult and drive Failed-to-Rollback-to-Destroyed.
/// Lifecycle operations on one instance are serialized. Concurrent provider
/// startup is restricted to one validated dependency level when explicitly
/// enabled.
class Runtime final {
  public:
    ~Runtime();

    Runtime(const Runtime&) = delete;
    Runtime& operator=(const Runtime&) = delete;
    Runtime(Runtime&&) = delete;
    Runtime& operator=(Runtime&&) = delete;

    [[nodiscard]] const RuntimeId& runtime_id() const noexcept;
    [[nodiscard]] RuntimeState state() const;
    [[nodiscard]] std::vector<RuntimeState> lifecycle_history() const;
    [[nodiscard]] bool frozen() const;

    [[nodiscard]] RuntimeResult start();
    [[nodiscard]] RuntimeResult stop();

    /// Enters the approved failure path from Running and performs rollback.
    [[nodiscard]] RuntimeResult fail(RuntimeResult cause);

    [[nodiscard]] const LifecycleManager& lifecycle_manager() const noexcept;
    [[nodiscard]] const ServiceRegistry& service_registry() const noexcept;
    [[nodiscard]] const DependencyInjector& dependency_injector() const noexcept;
    [[nodiscard]] EventBus& event_bus() noexcept;
    [[nodiscard]] const EventBus& event_bus() const noexcept;
    [[nodiscard]] const ConfigurationManager& configuration_manager() const noexcept;
    /// Returns an inspection-only view of authoritative Runtime evidence.
    [[nodiscard]] const Observability& observability() const noexcept;
    [[nodiscard]] RuntimeContext& context() noexcept;
    [[nodiscard]] const RuntimeContext& context() const noexcept;

  private:
    using RegistryAction = std::function<RuntimeResult(ServiceRegistry&)>;
    using EventAction = std::function<RuntimeResult(EventBus&)>;

    explicit Runtime(RuntimeBuilder&& builder);

    [[nodiscard]] RuntimeResult configure_and_register();
    [[nodiscard]] RuntimeResult resolve_validate_and_freeze();
    [[nodiscard]] RuntimeResult start_providers();
    [[nodiscard]] RuntimeResult start_level_sequential(const std::vector<ProviderId>& level,
                                                       std::size_t dependency_level);
    [[nodiscard]] RuntimeResult start_level_parallel(const std::vector<ProviderId>& level,
                                                     std::size_t dependency_level);
    [[nodiscard]] RuntimeResult stop_started_providers();
    [[nodiscard]] RuntimeResult rollback(const RuntimeResult& cause, bool stop_already_attempted);
    void destroy_provider_instances() noexcept;

    RuntimeId runtime_id_;
    core::Configuration configuration_plan_;
    StartupExecutionPolicy startup_policy_;
    std::vector<RegistryAction> registry_actions_;
    std::vector<EventAction> event_actions_;

    Observability observability_;
    LifecycleManager lifecycle_manager_;
    ServiceRegistry service_registry_;
    DependencyInjector dependency_injector_;
    EventBus event_bus_;
    ConfigurationManager configuration_manager_;
    RuntimeContext context_;

    mutable std::mutex operation_mutex_;

    friend class RuntimeBuilder;
};

} // namespace cca::runtime
