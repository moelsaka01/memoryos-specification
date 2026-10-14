#include <cca/runtime/observability.hpp>
#include <cca/runtime/service_registry.hpp>

#include <algorithm>
#include <exception>
#include <string>
#include <utility>

namespace cca::runtime {
namespace {

[[nodiscard]] bool supported_cardinality(const ServiceCardinality cardinality) noexcept {
    switch (cardinality) {
    case ServiceCardinality::exactly_one:
    case ServiceCardinality::zero_or_one:
    case ServiceCardinality::one_or_more:
        return true;
    }
    return false;
}

[[nodiscard]] bool cardinality_accepts(const ServiceCardinality cardinality,
                                       const std::size_t count) noexcept {
    switch (cardinality) {
    case ServiceCardinality::exactly_one:
        return count == 1U;
    case ServiceCardinality::zero_or_one:
        return count <= 1U;
    case ServiceCardinality::one_or_more:
        return count >= 1U;
    }
    return false;
}

[[nodiscard]] RuntimeResult failure(std::string code, std::string message) {
    return RuntimeResult::failure(std::move(code), std::move(message));
}

} // namespace

class ServiceRegistry::Impl final {
  public:
    explicit Impl(Observability* observability) noexcept : observability(observability) {}

    struct ContractRecord final {
        std::type_index interface_type;
        ServiceCardinality cardinality;
    };

    struct ProviderRecord final {
        ProviderId id;
        std::type_index interface_type;
        ServiceCardinality cardinality;
        std::type_index provider_type;
        std::vector<DependencyDescriptor> dependencies;
        ErasedFactory factory;
        InterfaceAccessor interface_accessor;
        std::unique_ptr<ServiceProvider> instance;
        bool start_attempted{false};
        bool started{false};
    };

    bool frozen{false};
    std::size_t revision{0U};
    Observability* observability;
    std::vector<ContractRecord> contracts;
    std::vector<ProviderRecord> providers;
};

ServiceRegistry::ServiceRegistry() : impl_(std::make_unique<Impl>(nullptr)) {}

ServiceRegistry::ServiceRegistry(Observability& observability)
    : impl_(std::make_unique<Impl>(&observability)) {}

ServiceRegistry::~ServiceRegistry() {
    for (auto iterator = impl_->providers.rbegin(); iterator != impl_->providers.rend();
         ++iterator) {
        iterator->instance.reset();
    }
}

RuntimeResult ServiceRegistry::declare_contract_internal(const std::type_index interface_type,
                                                         const ServiceCardinality cardinality) {
    if (impl_->frozen) {
        return failure("CCA-RUNTIME-REGISTRY-FROZEN",
                       "Service Contract declarations are immutable after Runtime Freeze.");
    }
    if (!supported_cardinality(cardinality)) {
        return failure("CCA-RUNTIME-REGISTRY-INVALID-CARDINALITY",
                       "Service Contract uses a cardinality not approved by CCA-RF-1.0.");
    }

    const auto existing =
        std::ranges::find(impl_->contracts, interface_type, &Impl::ContractRecord::interface_type);
    if (existing != impl_->contracts.end()) {
        if (existing->cardinality != cardinality) {
            return failure("CCA-RUNTIME-REGISTRY-CARDINALITY-CONFLICT",
                           "Service Contract was already declared with a different cardinality.");
        }
        return failure("CCA-RUNTIME-REGISTRY-DUPLICATE-CONTRACT",
                       "Service Contract was already declared.");
    }

    impl_->contracts.push_back(Impl::ContractRecord{
        .interface_type = interface_type,
        .cardinality = cardinality,
    });
    ++impl_->revision;
    return RuntimeResult::success();
}

RuntimeResult
ServiceRegistry::register_provider_internal(const std::type_index interface_type,
                                            const ServiceCardinality cardinality,
                                            const std::type_index provider_type,
                                            std::vector<DependencyDescriptor> dependencies,
                                            ErasedFactory factory,
                                            InterfaceAccessor interface_accessor) {
    if (impl_->frozen) {
        return failure("CCA-RUNTIME-REGISTRY-FROZEN",
                       "Provider registrations are immutable after Runtime Freeze.");
    }
    if (!supported_cardinality(cardinality)) {
        return failure("CCA-RUNTIME-REGISTRY-INVALID-CARDINALITY",
                       "Provider binding uses a cardinality not approved by CCA-RF-1.0.");
    }

    const auto contract =
        std::ranges::find(impl_->contracts, interface_type, &Impl::ContractRecord::interface_type);
    if (contract == impl_->contracts.end()) {
        return failure("CCA-RUNTIME-REGISTRY-UNDECLARED-CONTRACT",
                       "Provider binding requires a declared Service Contract.");
    }
    if (contract->cardinality != cardinality) {
        return failure("CCA-RUNTIME-REGISTRY-CARDINALITY-CONFLICT",
                       "Provider binding cardinality differs from its Service Contract.");
    }

    const auto duplicate =
        std::ranges::find_if(impl_->providers, [&](const Impl::ProviderRecord& provider) {
            return provider.interface_type == interface_type &&
                   provider.provider_type == provider_type;
        });
    if (duplicate != impl_->providers.end()) {
        return failure("CCA-RUNTIME-REGISTRY-DUPLICATE-BINDING",
                       "The same typed Service Contract and Provider binding already exists.");
    }

    const ProviderId id{impl_->providers.size()};
    impl_->providers.push_back(Impl::ProviderRecord{
        .id = id,
        .interface_type = interface_type,
        .cardinality = cardinality,
        .provider_type = provider_type,
        .dependencies = std::move(dependencies),
        .factory = std::move(factory),
        .interface_accessor = std::move(interface_accessor),
        .instance = nullptr,
    });
    ++impl_->revision;
    return RuntimeResult::success();
}

RuntimeResult ServiceRegistry::validate() const {
    for (const auto& contract : impl_->contracts) {
        const auto count = static_cast<std::size_t>(std::ranges::count(
            impl_->providers, contract.interface_type, &Impl::ProviderRecord::interface_type));
        if (!cardinality_accepts(contract.cardinality, count)) {
            return failure("CCA-RUNTIME-REGISTRY-CARDINALITY",
                           "Registered Provider count violates its Service Contract cardinality.");
        }
    }
    return RuntimeResult::success();
}

RuntimeResult ServiceRegistry::freeze() {
    if (impl_->frozen) {
        return failure("CCA-RUNTIME-REGISTRY-FROZEN", "Service Registry is already frozen.");
    }

    const auto validation = validate();
    if (!validation) {
        return validation;
    }
    if (std::ranges::any_of(impl_->providers, [](const Impl::ProviderRecord& provider) {
            return provider.instance == nullptr;
        })) {
        return failure("CCA-RUNTIME-REGISTRY-NOT-INSTANTIATED",
                       "Every registered Provider must be instantiated before Runtime Freeze.");
    }

    impl_->frozen = true;
    return RuntimeResult::success();
}

bool ServiceRegistry::frozen() const noexcept {
    return impl_->frozen;
}

std::vector<void*> ServiceRegistry::resolve_instances(const std::type_index interface_type,
                                                      const ServiceCardinality cardinality) const {
    const auto contract =
        std::ranges::find(impl_->contracts, interface_type, &Impl::ContractRecord::interface_type);
    if (contract == impl_->contracts.end()) {
        throw_resolution_failure("CCA-RUNTIME-REGISTRY-RESOLUTION-UNDECLARED",
                                 "Service Contract was not declared");
    }
    if (contract->cardinality != cardinality) {
        throw_resolution_failure("CCA-RUNTIME-REGISTRY-RESOLUTION-CARDINALITY",
                                 "Service Contract cardinality differs from its declaration");
    }

    std::vector<void*> instances;
    for (const auto& provider : impl_->providers) {
        if (provider.interface_type == interface_type && provider.instance != nullptr) {
            instances.push_back(provider.interface_accessor(*provider.instance));
        }
    }
    return instances;
}

void ServiceRegistry::throw_resolution_failure(std::string code, std::string message) const {
    if (impl_->observability != nullptr) {
        try {
            impl_->observability->record_service_registry(
                impl_->observability->state(), RuntimeResult::failure(std::move(code), message));
        } catch (...) {
            // Resolution semantics remain deterministic even if diagnostic
            // allocation or an injected logging sink fails.
        }
    }
    throw std::logic_error{message};
}

std::vector<ServiceRegistry::ProviderRecordView> ServiceRegistry::provider_records() const {
    std::vector<ProviderRecordView> records;
    records.reserve(impl_->providers.size());
    for (const auto& provider : impl_->providers) {
        records.push_back(ProviderRecordView{
            .id = provider.id,
            .dependencies = provider.dependencies,
        });
    }
    return records;
}

bool ServiceRegistry::contract_is_declared(const DependencyDescriptor& dependency) const {
    return std::ranges::any_of(impl_->contracts, [&](const Impl::ContractRecord& contract) {
        return contract.interface_type == dependency.interface_type &&
               contract.cardinality == dependency.cardinality;
    });
}

RuntimeResult ServiceRegistry::validate_dependency(const DependencyDescriptor& dependency) const {
    if (!supported_cardinality(dependency.cardinality)) {
        return failure("CCA-RUNTIME-INJECTOR-INVALID-CARDINALITY",
                       "Provider dependency uses a cardinality not approved by CCA-RF-1.0.");
    }

    const auto contract = std::ranges::find(
        impl_->contracts, dependency.interface_type, &Impl::ContractRecord::interface_type);
    if (contract == impl_->contracts.end()) {
        return failure("CCA-RUNTIME-INJECTOR-UNDECLARED-DEPENDENCY",
                       "Provider dependency refers to an undeclared Service Contract.");
    }
    if (contract->cardinality != dependency.cardinality) {
        return failure("CCA-RUNTIME-INJECTOR-CARDINALITY-CONFLICT",
                       "Provider dependency cardinality differs from the declared contract.");
    }

    const auto count = static_cast<std::size_t>(std::ranges::count(
        impl_->providers, dependency.interface_type, &Impl::ProviderRecord::interface_type));
    if (!cardinality_accepts(dependency.cardinality, count)) {
        return failure("CCA-RUNTIME-INJECTOR-MISSING-DEPENDENCY",
                       "Provider dependency cannot be satisfied at its declared cardinality.");
    }
    return RuntimeResult::success();
}

std::vector<ProviderId>
ServiceRegistry::provider_ids_for(const DependencyDescriptor& dependency) const {
    std::vector<ProviderId> ids;
    for (const auto& provider : impl_->providers) {
        if (provider.interface_type == dependency.interface_type) {
            ids.push_back(provider.id);
        }
    }
    return ids;
}

RuntimeResult ServiceRegistry::instantiate_provider(const ProviderId id) {
    if (impl_->frozen) {
        return failure("CCA-RUNTIME-REGISTRY-FROZEN",
                       "Providers cannot be instantiated after Runtime Freeze.");
    }
    if (id.value() >= impl_->providers.size()) {
        return failure("CCA-RUNTIME-REGISTRY-UNKNOWN-PROVIDER",
                       "ProviderId does not belong to this Service Registry.");
    }

    auto& provider = impl_->providers[id.value()];
    if (provider.instance != nullptr) {
        return failure("CCA-RUNTIME-REGISTRY-ALREADY-INSTANTIATED",
                       "Provider was already instantiated.");
    }

    try {
        auto instance = provider.factory(*this);
        if (instance == nullptr) {
            return failure("CCA-RUNTIME-REGISTRY-NULL-PROVIDER", "Provider factory returned null.");
        }
        provider.instance = std::move(instance);
    } catch (const std::exception& exception) {
        return failure("CCA-RUNTIME-REGISTRY-FACTORY",
                       std::string{"Provider factory failed: "} + exception.what());
    } catch (...) {
        return failure("CCA-RUNTIME-REGISTRY-FACTORY",
                       "Provider factory failed with an unknown exception.");
    }

    return RuntimeResult::success();
}

bool ServiceRegistry::any_provider_instantiated() const noexcept {
    return std::ranges::any_of(impl_->providers, [](const Impl::ProviderRecord& provider) {
        return provider.instance != nullptr;
    });
}

std::size_t ServiceRegistry::revision() const noexcept {
    return impl_->revision;
}

ServiceProvider* ServiceRegistry::lifecycle_provider(const ProviderId id) noexcept {
    if (id.value() >= impl_->providers.size()) {
        return nullptr;
    }
    return impl_->providers[id.value()].instance.get();
}

const ServiceProvider* ServiceRegistry::lifecycle_provider(const ProviderId id) const noexcept {
    if (id.value() >= impl_->providers.size()) {
        return nullptr;
    }
    return impl_->providers[id.value()].instance.get();
}

RuntimeResult ServiceRegistry::mark_start_attempted(const ProviderId id) {
    auto* provider = lifecycle_provider(id);
    if (provider == nullptr) {
        return failure("CCA-RUNTIME-REGISTRY-UNKNOWN-PROVIDER",
                       "Cannot mark an unknown or uninstantiated Provider.");
    }
    static_cast<void>(provider);
    impl_->providers[id.value()].start_attempted = true;
    return RuntimeResult::success();
}

RuntimeResult ServiceRegistry::mark_started(const ProviderId id) {
    auto* provider = lifecycle_provider(id);
    if (provider == nullptr) {
        return failure("CCA-RUNTIME-REGISTRY-UNKNOWN-PROVIDER",
                       "Cannot mark an unknown or uninstantiated Provider.");
    }
    static_cast<void>(provider);
    if (!impl_->providers[id.value()].start_attempted) {
        return failure("CCA-RUNTIME-REGISTRY-START-NOT-ATTEMPTED",
                       "Provider cannot be marked started before a start attempt.");
    }
    impl_->providers[id.value()].started = true;
    return RuntimeResult::success();
}

RuntimeResult ServiceRegistry::mark_stopped(const ProviderId id) {
    auto* provider = lifecycle_provider(id);
    if (provider == nullptr) {
        return failure("CCA-RUNTIME-REGISTRY-UNKNOWN-PROVIDER",
                       "Cannot mark an unknown or uninstantiated Provider.");
    }
    static_cast<void>(provider);
    impl_->providers[id.value()].started = false;
    return RuntimeResult::success();
}

bool ServiceRegistry::start_attempted(const ProviderId id) const noexcept {
    return id.value() < impl_->providers.size() && impl_->providers[id.value()].start_attempted;
}

bool ServiceRegistry::started(const ProviderId id) const noexcept {
    return id.value() < impl_->providers.size() && impl_->providers[id.value()].started;
}

void ServiceRegistry::destroy_provider(const ProviderId id) noexcept {
    if (id.value() >= impl_->providers.size()) {
        return;
    }
    auto& provider = impl_->providers[id.value()];
    provider.instance.reset();
    provider.start_attempted = false;
    provider.started = false;
}

std::size_t ServiceRegistry::provider_count() const noexcept {
    return impl_->providers.size();
}

} // namespace cca::runtime
