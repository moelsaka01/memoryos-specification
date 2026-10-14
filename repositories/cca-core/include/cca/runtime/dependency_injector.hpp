#pragma once

#include <cca/runtime/provider.hpp>
#include <cca/runtime/runtime_result.hpp>

#include <cstddef>
#include <vector>

namespace cca::runtime {

class ServiceRegistry;

/// One validated dependency edge from a dependent Provider to its dependency.
struct ProviderDependencyEdge final {
    ProviderId dependent;
    ProviderId dependency;

    [[nodiscard]] bool operator==(const ProviderDependencyEdge&) const = default;
};

/// Builds, validates, and materializes one Runtime's Provider dependency graph.
///
/// The injector reads typed declarations and registrations from its associated
/// ServiceRegistry. It validates dependency declarations, cardinality, and
/// cycles; derives deterministic dependency-first levels; and invokes Provider
/// factories one level at a time. It does not start or stop Providers.
/// DependencyInjector is instance-confined while mutable. Its snapshots are
/// immutable after freeze and safe for concurrent reads with the owning Runtime.
class DependencyInjector final {
  public:
    DependencyInjector() = default;

    DependencyInjector(const DependencyInjector&) = delete;
    DependencyInjector& operator=(const DependencyInjector&) = delete;
    DependencyInjector(DependencyInjector&&) = delete;
    DependencyInjector& operator=(DependencyInjector&&) = delete;

    /// Builds and validates the complete dependent-to-dependency graph.
    ///
    /// Every Provider registered for a matching dependency contract becomes an
    /// edge target. Invalid or duplicate dependency declarations, missing
    /// Providers, cardinality violations, and cycles return deterministic failure.
    [[nodiscard]] RuntimeResult build_and_validate(const ServiceRegistry& registry);

    /// Instantiates Providers in sequential dependency-level order.
    ///
    /// Construction uses each registration's typed factory. Collaborators are
    /// resolved from earlier levels and supplied as constructor arguments.
    [[nodiscard]] RuntimeResult instantiate(ServiceRegistry& registry);

    /// Freezes the validated, instantiated dependency graph against mutation.
    [[nodiscard]] RuntimeResult freeze();

    [[nodiscard]] bool frozen() const noexcept;
    [[nodiscard]] bool valid() const noexcept;
    [[nodiscard]] bool instantiated() const noexcept;

    /// Deterministic dependency-first levels ordered by Provider registration ID.
    [[nodiscard]] const std::vector<std::vector<ProviderId>>& levels() const noexcept;

    /// Deterministic edges ordered by dependent ID, then dependency ID.
    [[nodiscard]] const std::vector<ProviderDependencyEdge>& edges() const noexcept;

  private:
    bool frozen_{false};
    bool valid_{false};
    bool instantiation_attempted_{false};
    bool instantiated_{false};
    const ServiceRegistry* registry_{nullptr};
    std::size_t registry_revision_{0U};
    std::vector<std::vector<ProviderId>> levels_;
    std::vector<ProviderDependencyEdge> edges_;
};

} // namespace cca::runtime
