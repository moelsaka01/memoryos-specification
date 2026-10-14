#include <cca/runtime/dependency_injector.hpp>
#include <cca/runtime/service_registry.hpp>

#include <algorithm>
#include <cstddef>
#include <string>
#include <typeindex>
#include <utility>
#include <vector>

namespace cca::runtime {
namespace {

[[nodiscard]] RuntimeResult failure(std::string code, std::string message) {
    return RuntimeResult::failure(std::move(code), std::move(message));
}

} // namespace

RuntimeResult DependencyInjector::build_and_validate(const ServiceRegistry& registry) {
    if (frozen_) {
        return failure("CCA-RUNTIME-INJECTOR-FROZEN",
                       "Dependency graph is immutable after Runtime Freeze.");
    }
    if (instantiation_attempted_) {
        return failure("CCA-RUNTIME-INJECTOR-INSTANTIATION-ATTEMPTED",
                       "Dependency graph cannot be rebuilt after Provider instantiation begins.");
    }
    if (registry.frozen()) {
        return failure("CCA-RUNTIME-REGISTRY-FROZEN",
                       "Dependency graph cannot be built from a frozen Service Registry.");
    }

    const auto records = registry.provider_records();
    std::vector<ProviderDependencyEdge> candidate_edges;

    for (const auto& provider : records) {
        std::vector<std::type_index> declared_dependencies;
        declared_dependencies.reserve(provider.dependencies.size());

        for (const auto& dependency : provider.dependencies) {
            if (std::ranges::find(declared_dependencies, dependency.interface_type) !=
                declared_dependencies.end()) {
                valid_ = false;
                levels_.clear();
                edges_.clear();
                return failure("CCA-RUNTIME-INJECTOR-DUPLICATE-DEPENDENCY",
                               "Provider declares the same Service Contract dependency twice.");
            }
            declared_dependencies.push_back(dependency.interface_type);

            if (!registry.contract_is_declared(dependency)) {
                valid_ = false;
                levels_.clear();
                edges_.clear();
                const auto validation = registry.validate_dependency(dependency);
                if (!validation) {
                    return validation;
                }
                return failure("CCA-RUNTIME-INJECTOR-UNDECLARED-DEPENDENCY",
                               "Provider dependency refers to an undeclared Service Contract.");
            }

            const auto validation = registry.validate_dependency(dependency);
            if (!validation) {
                valid_ = false;
                levels_.clear();
                edges_.clear();
                return validation;
            }

            for (const ProviderId dependency_id : registry.provider_ids_for(dependency)) {
                candidate_edges.push_back(ProviderDependencyEdge{
                    .dependent = provider.id,
                    .dependency = dependency_id,
                });
            }
        }
    }

    const auto registry_validation = registry.validate();
    if (!registry_validation) {
        valid_ = false;
        levels_.clear();
        edges_.clear();
        return registry_validation;
    }

    std::ranges::sort(candidate_edges,
                      [](const ProviderDependencyEdge& left, const ProviderDependencyEdge& right) {
                          if (left.dependent != right.dependent) {
                              return left.dependent < right.dependent;
                          }
                          return left.dependency < right.dependency;
                      });

    const std::size_t provider_count = records.size();
    std::vector<std::size_t> remaining_dependencies(provider_count, 0U);
    std::vector<std::vector<ProviderId>> dependents(provider_count);
    for (const auto& edge : candidate_edges) {
        if (edge.dependent.value() >= provider_count || edge.dependency.value() >= provider_count) {
            valid_ = false;
            levels_.clear();
            edges_.clear();
            return failure("CCA-RUNTIME-INJECTOR-INVALID-PROVIDER-ID",
                           "Dependency graph contains a ProviderId outside its registry.");
        }
        ++remaining_dependencies[edge.dependent.value()];
        dependents[edge.dependency.value()].push_back(edge.dependent);
    }

    std::vector<ProviderId> ready;
    ready.reserve(provider_count);
    for (std::size_t index = 0; index < provider_count; ++index) {
        if (remaining_dependencies[index] == 0U) {
            ready.emplace_back(index);
        }
    }

    std::vector<std::vector<ProviderId>> candidate_levels;
    std::size_t processed = 0U;
    while (!ready.empty()) {
        std::ranges::sort(ready);
        candidate_levels.push_back(ready);
        processed += ready.size();

        std::vector<ProviderId> next;
        for (const ProviderId dependency : ready) {
            for (const ProviderId dependent : dependents[dependency.value()]) {
                auto& count = remaining_dependencies[dependent.value()];
                --count;
                if (count == 0U) {
                    next.push_back(dependent);
                }
            }
        }
        std::ranges::sort(next);
        next.erase(std::ranges::unique(next).begin(), next.end());
        ready = std::move(next);
    }

    if (processed != provider_count) {
        valid_ = false;
        levels_.clear();
        edges_.clear();
        return failure("CCA-RUNTIME-INJECTOR-CYCLE", "Provider dependency graph contains a cycle.");
    }

    edges_ = std::move(candidate_edges);
    levels_ = std::move(candidate_levels);
    registry_ = &registry;
    registry_revision_ = registry.revision();
    valid_ = true;
    return RuntimeResult::success();
}

RuntimeResult DependencyInjector::instantiate(ServiceRegistry& registry) {
    if (frozen_) {
        return failure("CCA-RUNTIME-INJECTOR-FROZEN",
                       "Providers cannot be instantiated after Runtime Freeze.");
    }
    if (!valid_) {
        return failure("CCA-RUNTIME-INJECTOR-INVALID-GRAPH",
                       "Provider dependency graph must validate before instantiation.");
    }
    if (instantiation_attempted_) {
        return failure("CCA-RUNTIME-INJECTOR-INSTANTIATION-ATTEMPTED",
                       "Provider instantiation may be attempted only once.");
    }
    if (registry_ != &registry) {
        return failure("CCA-RUNTIME-INJECTOR-REGISTRY-MISMATCH",
                       "Providers must be instantiated from the validated Service Registry.");
    }
    if (registry_revision_ != registry.revision()) {
        return failure("CCA-RUNTIME-INJECTOR-STALE-GRAPH",
                       "Service Registry composition changed after dependency graph validation.");
    }
    if (registry.frozen()) {
        return failure("CCA-RUNTIME-REGISTRY-FROZEN",
                       "Providers cannot be instantiated after Service Registry freeze.");
    }

    instantiation_attempted_ = true;
    for (const auto& level : levels_) {
        for (const ProviderId id : level) {
            const auto result = registry.instantiate_provider(id);
            if (!result) {
                return result;
            }
        }
    }

    instantiated_ = true;
    return RuntimeResult::success();
}

RuntimeResult DependencyInjector::freeze() {
    if (frozen_) {
        return failure("CCA-RUNTIME-INJECTOR-FROZEN", "Dependency Injector is already frozen.");
    }
    if (!valid_ || !instantiated_) {
        return failure("CCA-RUNTIME-INJECTOR-INCOMPLETE",
                       "A validated and instantiated graph is required before Runtime Freeze.");
    }
    frozen_ = true;
    return RuntimeResult::success();
}

bool DependencyInjector::frozen() const noexcept {
    return frozen_;
}

bool DependencyInjector::valid() const noexcept {
    return valid_;
}

bool DependencyInjector::instantiated() const noexcept {
    return instantiated_;
}

const std::vector<std::vector<ProviderId>>& DependencyInjector::levels() const noexcept {
    return levels_;
}

const std::vector<ProviderDependencyEdge>& DependencyInjector::edges() const noexcept {
    return edges_;
}

} // namespace cca::runtime
