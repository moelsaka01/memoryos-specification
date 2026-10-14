#pragma once

namespace cca::runtime {

/// Implementation policy for providers that share one validated dependency level.
///
/// CCA-RF-1.0 requires sequential dependency levels and permits concurrency only
/// within one level. This policy selects between deterministic serial execution
/// and opt-in parallel execution without changing graph ordering.
enum class StartupExecutionPolicy {
    sequential,
    parallel_within_level,
};

} // namespace cca::runtime
