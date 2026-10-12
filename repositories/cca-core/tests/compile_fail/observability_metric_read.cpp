// Positive control: must compile. The public read accessor is callable from outside Observability.
#include <cca/runtime/observability.hpp>

[[nodiscard]] std::uint64_t read_metric(const cca::runtime::Observability& observability) {
    return observability.metric_value(cca::runtime::RuntimeMetric::cleanup_operations);
}
