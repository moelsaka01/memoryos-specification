#pragma once

#include <string_view>

namespace cca::runtime {

/// Complete CCA-RF-1.0 Runtime lifecycle state set.
///
/// Only LifecycleManager advances a Runtime through these values. Enumerators use
/// C++ naming conventions while to_string() returns the canonical standard names.
enum class RuntimeState {
    constructed,
    initializing,
    configuring,
    registering_services,
    resolving_dependencies,
    validating,
    runtime_freeze,
    starting,
    running,
    stopping,
    stopped,
    destroyed,
    failed,
    rollback,
};

/// Returns the stable CCA-RF-1.0 display name for a Runtime state.
[[nodiscard]] std::string_view to_string(RuntimeState state) noexcept;

} // namespace cca::runtime
