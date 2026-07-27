#include <cca/runtime/runtime_state.hpp>

namespace cca::runtime {

std::string_view to_string(const RuntimeState state) noexcept {
    switch (state) {
    case RuntimeState::constructed:
        return "Constructed";
    case RuntimeState::initializing:
        return "Initializing";
    case RuntimeState::configuring:
        return "Configuring";
    case RuntimeState::registering_services:
        return "Registering Services";
    case RuntimeState::resolving_dependencies:
        return "Resolving Dependencies";
    case RuntimeState::validating:
        return "Validating";
    case RuntimeState::runtime_freeze:
        return "Runtime Freeze";
    case RuntimeState::starting:
        return "Starting";
    case RuntimeState::running:
        return "Running";
    case RuntimeState::stopping:
        return "Stopping";
    case RuntimeState::stopped:
        return "Stopped";
    case RuntimeState::destroyed:
        return "Destroyed";
    case RuntimeState::failed:
        return "Failed";
    case RuntimeState::rollback:
        return "Rollback";
    }
    return "Unknown";
}

} // namespace cca::runtime
