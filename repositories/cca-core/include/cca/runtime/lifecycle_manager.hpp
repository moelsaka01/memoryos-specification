#pragma once

#include <cca/runtime/runtime_result.hpp>
#include <cca/runtime/runtime_state.hpp>

#include <mutex>
#include <vector>

namespace cca::runtime {

class Observability;

/// Owns and enforces the exact CCA-RF-1.0 Runtime state machine.
///
/// LifecycleManager is one of the six Runtime Foundation components. Runtime
/// owns it and is the only caller permitted to request transitions. Accepted and
/// rejected transitions are reported through the instance-owned Observability
/// component. State reads are synchronized; one Runtime lifecycle operation is
/// advanced at a time.
class LifecycleManager final {
  public:
    explicit LifecycleManager(Observability& observability);

    LifecycleManager(const LifecycleManager&) = delete;
    LifecycleManager& operator=(const LifecycleManager&) = delete;
    LifecycleManager(LifecycleManager&&) = delete;
    LifecycleManager& operator=(LifecycleManager&&) = delete;

    [[nodiscard]] RuntimeState state() const;
    [[nodiscard]] std::vector<RuntimeState> history() const;
    [[nodiscard]] RuntimeResult transition(RuntimeState next);

  private:
    [[nodiscard]] static bool permits(RuntimeState current, RuntimeState next) noexcept;

    Observability& observability_;
    mutable std::mutex mutex_;
    RuntimeState state_{RuntimeState::constructed};
    std::vector<RuntimeState> history_{RuntimeState::constructed};
};

} // namespace cca::runtime
