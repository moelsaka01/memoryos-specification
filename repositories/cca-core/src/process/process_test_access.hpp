#pragma once

#include <cca/process/process.hpp>

#include <vector>

namespace cca::process {

class ProcessInternalAccess {
  public:
    [[nodiscard]] static std::vector<ExecutionState>
    stateTransitions(const ExecutionContext& context);

    static void setState(ExecutionContext& context,
                         ExecutionState state) noexcept;
};

} // namespace cca::process
