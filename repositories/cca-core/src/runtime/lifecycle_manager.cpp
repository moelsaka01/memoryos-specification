#include <cca/runtime/lifecycle_manager.hpp>
#include <cca/runtime/observability.hpp>

#include <string>

namespace cca::runtime {

LifecycleManager::LifecycleManager(Observability& observability) : observability_(observability) {}

RuntimeState LifecycleManager::state() const {
    const std::scoped_lock lock{mutex_};
    return state_;
}

std::vector<RuntimeState> LifecycleManager::history() const {
    const std::scoped_lock lock{mutex_};
    return history_;
}

RuntimeResult LifecycleManager::transition(const RuntimeState next) {
    RuntimeState current{};
    {
        const std::scoped_lock lock{mutex_};
        current = state_;
        if (!permits(current, next)) {
            const auto result = RuntimeResult::failure(
                "CCA-RUNTIME-LIFECYCLE-001",
                "invalid Runtime lifecycle transition from " + std::string{to_string(current)} +
                    " to " + std::string{to_string(next)});
            observability_.record_rejected_transition(current, next, result);
            return result;
        }

        state_ = next;
        history_.push_back(next);
    }

    observability_.record_lifecycle_transition(current, next);
    return RuntimeResult::success();
}

bool LifecycleManager::permits(const RuntimeState current, const RuntimeState next) noexcept {
    switch (current) {
    case RuntimeState::constructed:
        return next == RuntimeState::initializing;
    case RuntimeState::initializing:
        return next == RuntimeState::configuring || next == RuntimeState::failed;
    case RuntimeState::configuring:
        return next == RuntimeState::registering_services || next == RuntimeState::failed;
    case RuntimeState::registering_services:
        return next == RuntimeState::resolving_dependencies || next == RuntimeState::failed;
    case RuntimeState::resolving_dependencies:
        return next == RuntimeState::validating || next == RuntimeState::failed;
    case RuntimeState::validating:
        return next == RuntimeState::runtime_freeze || next == RuntimeState::failed;
    case RuntimeState::runtime_freeze:
        return next == RuntimeState::starting;
    case RuntimeState::starting:
        return next == RuntimeState::running || next == RuntimeState::failed;
    case RuntimeState::running:
        return next == RuntimeState::stopping || next == RuntimeState::failed;
    case RuntimeState::stopping:
        return next == RuntimeState::stopped || next == RuntimeState::failed;
    case RuntimeState::stopped:
        return next == RuntimeState::destroyed;
    case RuntimeState::failed:
        return next == RuntimeState::rollback;
    case RuntimeState::rollback:
        return next == RuntimeState::destroyed;
    case RuntimeState::destroyed:
        return false;
    }
    return false;
}

} // namespace cca::runtime
