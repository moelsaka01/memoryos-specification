#pragma once

#include <cca/core/configuration.hpp>
#include <cca/runtime/runtime_result.hpp>

#include <memory>
#include <mutex>

namespace cca::runtime {

/// Owns the immutable configuration snapshot for one Runtime instance.
///
/// Configuration source policy is deliberately outside this component. A caller
/// supplies an already-built core::Configuration while the Runtime is
/// Configuring. Replacements are allowed until freeze and are rejected afterward.
/// snapshot() returns shared immutable ownership so concurrent readers never hold
/// a reference invalidated by a permitted pre-freeze replacement.
class ConfigurationManager final {
  public:
    ConfigurationManager() = default;

    [[nodiscard]] RuntimeResult configure(core::Configuration configuration);
    [[nodiscard]] RuntimeResult validate() const;
    [[nodiscard]] RuntimeResult freeze();

    [[nodiscard]] bool configured() const;
    [[nodiscard]] bool frozen() const;
    [[nodiscard]] std::shared_ptr<const core::Configuration> snapshot() const;

  private:
    mutable std::mutex mutex_;
    std::shared_ptr<const core::Configuration> configuration_;
    bool frozen_{false};
};

} // namespace cca::runtime
