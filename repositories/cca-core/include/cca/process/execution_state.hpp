#pragma once

namespace cca::process {

enum class ExecutionState {
    Ready,
    Running,
    Completed,
    Failed
};

} // namespace cca::process
