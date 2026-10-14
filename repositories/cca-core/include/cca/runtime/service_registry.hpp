#pragma once

#include <cca/runtime/provider.hpp>
#include <cca/runtime/runtime_result.hpp>

#include <concepts>
#include <cstddef>
#include <functional>
#include <memory>
#include <optional>
#include <stdexcept>
#include <type_traits>
#include <typeindex>
#include <utility>
#include <vector>

namespace cca::runtime {

class DependencyInjector;
class Observability;
class Runtime;

/// The typed resolution result prescribed by a Service Contract's cardinality.
template <ServiceContractType Contract>
using ServiceResolution = std::conditional_t<
    Contract::cardinality == ServiceCardinality::exactly_one,
    typename Contract::interface_type&,
    std::conditional_t<Contract::cardinality == ServiceCardinality::zero_or_one,
                       std::optional<std::reference_wrapper<typename Contract::interface_type>>,
                       std::vector<std::reference_wrapper<typename Contract::interface_type>>>>;

namespace detail {

template <typename Factory, typename Provider, typename... ResolvedDependencies>
concept ProviderFactoryFor =
    std::copy_constructible<std::decay_t<Factory>> &&
    requires(std::decay_t<Factory>& factory, ResolvedDependencies... dependencies) {
        {
            std::invoke(factory, std::forward<ResolvedDependencies>(dependencies)...)
        } -> std::convertible_to<std::unique_ptr<Provider>>;
    };

} // namespace detail

/// Instance-local registry of typed Service Contracts and internal Providers.
///
/// Contract and Provider identity are represented by C++ types; no public
/// operation accepts a string service identifier. Contract declarations and
/// Provider registrations are mutable only before freeze(). Provider factories
/// are invoked by DependencyInjector in dependency-level order. The registry is
/// instance-confined while mutable; after freeze, resolve() supports concurrent
/// reads provided callers do not concurrently destroy the owning Runtime.
class ServiceRegistry final {
  public:
    ServiceRegistry();
    explicit ServiceRegistry(Observability& observability);
    ~ServiceRegistry();

    ServiceRegistry(const ServiceRegistry&) = delete;
    ServiceRegistry& operator=(const ServiceRegistry&) = delete;
    ServiceRegistry(ServiceRegistry&&) = delete;
    ServiceRegistry& operator=(ServiceRegistry&&) = delete;

    /// Declares one typed Service Contract and its required cardinality.
    ///
    /// Re-declaration, a cardinality outside the approved set, or mutation after
    /// freeze returns an explicit failure without changing the registry.
    template <ServiceContractType Contract> [[nodiscard]] RuntimeResult declare_contract() {
        using Interface = typename Contract::interface_type;
        return declare_contract_internal(std::type_index{typeid(Interface)}, Contract::cardinality);
    }

    /// Registers an internal Provider and a copyable, constructor-injection factory.
    ///
    /// Contract must already be declared. Provider must implement both the
    /// consumer-visible Interface and ServiceProvider. Dependencies are typed
    /// ServiceContract specifications and are supplied to the factory in the same
    /// order. Registering the same Contract/Provider type binding twice is rejected;
    /// distinct Provider types remain valid candidates for OneOrMore.
    template <ServiceContractType Contract,
              typename Provider,
              ServiceContractType... Dependencies,
              typename Factory>
        requires std::derived_from<Provider, typename Contract::interface_type> &&
                 std::derived_from<Provider, ServiceProvider> &&
                 detail::ProviderFactoryFor<Factory, Provider, ServiceResolution<Dependencies>...>
    [[nodiscard]] RuntimeResult register_provider(Factory&& factory) {
        using Interface = typename Contract::interface_type;
        using FactoryType = std::decay_t<Factory>;

        FactoryType typed_factory{std::forward<Factory>(factory)};
        ErasedFactory erased_factory =
            [typed_factory = std::move(typed_factory)](
                ServiceRegistry& registry) mutable -> std::unique_ptr<ServiceProvider> {
            auto concrete = std::invoke(typed_factory,
                                        registry.template resolve_for_injection<Dependencies>()...);
            std::unique_ptr<Provider> owned_provider{std::move(concrete)};
            return owned_provider;
        };

        InterfaceAccessor interface_accessor = [](ServiceProvider& provider) -> void* {
            auto& concrete = dynamic_cast<Provider&>(provider);
            return static_cast<void*>(static_cast<Interface*>(&concrete));
        };

        std::vector<DependencyDescriptor> dependencies;
        dependencies.reserve(sizeof...(Dependencies));
        (dependencies.push_back(DependencyDescriptor{
             std::type_index{typeid(typename Dependencies::interface_type)},
             Dependencies::cardinality,
         }),
         ...);

        return register_provider_internal(std::type_index{typeid(Interface)},
                                          Contract::cardinality,
                                          std::type_index{typeid(Provider)},
                                          std::move(dependencies),
                                          std::move(erased_factory),
                                          std::move(interface_accessor));
    }

    /// Validates every declared contract against its registered Provider count.
    [[nodiscard]] RuntimeResult validate() const;

    /// Makes contract declarations, bindings, factories, and instances immutable.
    ///
    /// Freeze succeeds only after validation and after every registered Provider
    /// has been instantiated by DependencyInjector.
    [[nodiscard]] RuntimeResult freeze();

    [[nodiscard]] bool frozen() const noexcept;

    /// Resolves only the consumer-visible Interface for a typed Contract.
    ///
    /// ExactlyOne returns Interface&, ZeroOrOne returns an optional reference, and
    /// OneOrMore returns references in deterministic Provider registration order.
    /// Public resolution is rejected until Runtime Freeze has completed.
    /// std::logic_error indicates resolution before freeze or an internal violation
    /// of the validated cardinality.
    template <ServiceContractType Contract>
    [[nodiscard]] ServiceResolution<Contract> resolve() const {
        if (!frozen()) {
            throw_resolution_failure(
                "CCA-RUNTIME-REGISTRY-RESOLUTION-BEFORE-FREEZE",
                "Service Contracts cannot be resolved publicly before Runtime Freeze");
        }
        return resolve_typed<Contract>();
    }

  private:
    template <ServiceContractType Contract>
    [[nodiscard]] ServiceResolution<Contract> resolve_for_injection() const {
        if (frozen()) {
            throw_resolution_failure("CCA-RUNTIME-REGISTRY-INJECTION-AFTER-FREEZE",
                                     "Constructor injection cannot resolve after Runtime Freeze");
        }
        return resolve_typed<Contract>();
    }

    template <ServiceContractType Contract>
    [[nodiscard]] ServiceResolution<Contract> resolve_typed() const {
        using Interface = typename Contract::interface_type;
        const auto instances =
            resolve_instances(std::type_index{typeid(Interface)}, Contract::cardinality);

        if constexpr (Contract::cardinality == ServiceCardinality::exactly_one) {
            if (instances.size() != 1U) {
                throw_resolution_failure(
                    "CCA-RUNTIME-REGISTRY-RESOLUTION-CARDINALITY",
                    "ExactlyOne Service Contract does not have one instantiated Provider");
            }
            return *static_cast<Interface*>(instances.front());
        } else if constexpr (Contract::cardinality == ServiceCardinality::zero_or_one) {
            if (instances.size() > 1U) {
                throw_resolution_failure(
                    "CCA-RUNTIME-REGISTRY-RESOLUTION-CARDINALITY",
                    "ZeroOrOne Service Contract has more than one instantiated Provider");
            }
            if (instances.empty()) {
                return std::nullopt;
            }
            return std::ref(*static_cast<Interface*>(instances.front()));
        } else {
            if (instances.empty()) {
                throw_resolution_failure("CCA-RUNTIME-REGISTRY-RESOLUTION-CARDINALITY",
                                         "OneOrMore Service Contract has no instantiated Provider");
            }
            std::vector<std::reference_wrapper<Interface>> resolved;
            resolved.reserve(instances.size());
            for (void* instance : instances) {
                resolved.emplace_back(*static_cast<Interface*>(instance));
            }
            return resolved;
        }
    }

    struct DependencyDescriptor final {
        std::type_index interface_type;
        ServiceCardinality cardinality;
    };

    struct ProviderRecordView final {
        ProviderId id;
        std::vector<DependencyDescriptor> dependencies;
    };

    using ErasedFactory =
        std::function<std::unique_ptr<ServiceProvider>(ServiceRegistry& registry)>;
    using InterfaceAccessor = std::function<void*(ServiceProvider& provider)>;

    [[nodiscard]] RuntimeResult declare_contract_internal(std::type_index interface_type,
                                                          ServiceCardinality cardinality);
    [[nodiscard]] RuntimeResult
    register_provider_internal(std::type_index interface_type,
                               ServiceCardinality cardinality,
                               std::type_index provider_type,
                               std::vector<DependencyDescriptor> dependencies,
                               ErasedFactory factory,
                               InterfaceAccessor interface_accessor);
    [[nodiscard]] std::vector<void*> resolve_instances(std::type_index interface_type,
                                                       ServiceCardinality cardinality) const;
    [[noreturn]] void throw_resolution_failure(std::string code, std::string message) const;

    // Narrow composition seam consumed only by DependencyInjector.
    [[nodiscard]] std::vector<ProviderRecordView> provider_records() const;
    [[nodiscard]] bool contract_is_declared(const DependencyDescriptor& dependency) const;
    [[nodiscard]] RuntimeResult validate_dependency(const DependencyDescriptor& dependency) const;
    [[nodiscard]] std::vector<ProviderId>
    provider_ids_for(const DependencyDescriptor& dependency) const;
    [[nodiscard]] RuntimeResult instantiate_provider(ProviderId id);
    [[nodiscard]] bool any_provider_instantiated() const noexcept;
    [[nodiscard]] std::size_t revision() const noexcept;

    // Narrow lifecycle seam consumed only by Runtime after composition.
    [[nodiscard]] ServiceProvider* lifecycle_provider(ProviderId id) noexcept;
    [[nodiscard]] const ServiceProvider* lifecycle_provider(ProviderId id) const noexcept;
    [[nodiscard]] RuntimeResult mark_start_attempted(ProviderId id);
    [[nodiscard]] RuntimeResult mark_started(ProviderId id);
    [[nodiscard]] RuntimeResult mark_stopped(ProviderId id);
    [[nodiscard]] bool start_attempted(ProviderId id) const noexcept;
    [[nodiscard]] bool started(ProviderId id) const noexcept;
    void destroy_provider(ProviderId id) noexcept;
    [[nodiscard]] std::size_t provider_count() const noexcept;

    class Impl;
    std::unique_ptr<Impl> impl_;

    friend class DependencyInjector;
    friend class Runtime;
};

} // namespace cca::runtime
