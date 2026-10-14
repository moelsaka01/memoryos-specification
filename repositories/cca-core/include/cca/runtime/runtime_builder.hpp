#pragma once

#include <cca/core/configuration.hpp>
#include <cca/core/logging.hpp>
#include <cca/runtime/event_bus.hpp>
#include <cca/runtime/execution_policy.hpp>
#include <cca/runtime/runtime_id.hpp>
#include <cca/runtime/runtime_result.hpp>
#include <cca/runtime/service_registry.hpp>

#include <concepts>
#include <functional>
#include <memory>
#include <string>
#include <type_traits>
#include <utility>
#include <vector>

namespace cca::runtime {

class Runtime;

/// Collects one Runtime instance's explicit pre-lifecycle composition plan.
///
/// RuntimeBuilder owns configuration values, typed contract/provider actions,
/// typed Event Bus subscriptions, startup policy, and the injected log sink.
/// build() transfers that plan into a Runtime whose initial state is Constructed;
/// it does not configure, register, resolve, freeze, or start the Runtime. A
/// builder is instance-confined and must be moved to build.
class RuntimeBuilder final {
  public:
    explicit RuntimeBuilder(RuntimeId runtime_id);

    RuntimeBuilder(const RuntimeBuilder&) = delete;
    RuntimeBuilder& operator=(const RuntimeBuilder&) = delete;
    RuntimeBuilder(RuntimeBuilder&&) noexcept = default;
    RuntimeBuilder& operator=(RuntimeBuilder&&) noexcept = default;

    [[nodiscard]] const RuntimeId& runtime_id() const noexcept;

    RuntimeBuilder& set_configuration(core::ConfigurationKey key, std::string value);
    RuntimeBuilder& use_log_sink(std::shared_ptr<core::LogSink> sink);
    RuntimeBuilder& use_startup_policy(StartupExecutionPolicy policy) noexcept;

    template <ServiceContractType Contract> RuntimeBuilder& declare_contract() {
        registry_actions_.emplace_back([](ServiceRegistry& registry) {
            return registry.template declare_contract<Contract>();
        });
        return *this;
    }

    /// Adds one internal Provider binding and its typed constructor-injection factory.
    ///
    /// Dependencies are ServiceContract specifications. The factory receives their
    /// cardinality-specific resolved values in declaration order and returns unique
    /// ownership of Provider. The action executes only during Registering Services.
    template <ServiceContractType Contract,
              typename Provider,
              ServiceContractType... Dependencies,
              typename Factory>
        requires std::derived_from<Provider, typename Contract::interface_type> &&
                 std::derived_from<Provider, ServiceProvider> &&
                 detail::ProviderFactoryFor<Factory, Provider, ServiceResolution<Dependencies>...>
    RuntimeBuilder& add_provider(Factory&& factory) {
        using FactoryType = std::decay_t<Factory>;
        FactoryType typed_factory{std::forward<Factory>(factory)};
        registry_actions_.emplace_back(
            [typed_factory = std::move(typed_factory)](ServiceRegistry& registry) mutable {
                return registry.template register_provider<Contract, Provider, Dependencies...>(
                    typed_factory);
            });
        return *this;
    }

    /// Adds one typed, instance-local Event Bus subscription before Runtime Freeze.
    template <typename Event, typename Handler>
        requires std::copy_constructible<std::decay_t<Handler>>
    RuntimeBuilder& subscribe(Handler&& handler) {
        using HandlerType = std::decay_t<Handler>;
        HandlerType typed_handler{std::forward<Handler>(handler)};
        event_actions_.emplace_back(
            [typed_handler = std::move(typed_handler)](EventBus& event_bus) mutable {
                return event_bus.template subscribe<Event>(typed_handler);
            });
        return *this;
    }

    [[nodiscard]] std::unique_ptr<Runtime> build() &&;

  private:
    using RegistryAction = std::function<RuntimeResult(ServiceRegistry&)>;
    using EventAction = std::function<RuntimeResult(EventBus&)>;

    RuntimeId runtime_id_;
    core::ConfigurationBuilder configuration_builder_;
    std::shared_ptr<core::LogSink> log_sink_;
    StartupExecutionPolicy startup_policy_{StartupExecutionPolicy::sequential};
    std::vector<RegistryAction> registry_actions_;
    std::vector<EventAction> event_actions_;

    friend class Runtime;
};

} // namespace cca::runtime
