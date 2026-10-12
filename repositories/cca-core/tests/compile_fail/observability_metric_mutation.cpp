// Must NOT compile: increment_metric is private to Observability (friends only), including the
// one-argument form that uses its default argument.
#include <cca/runtime/observability.hpp>

void mutate_metric(cca::runtime::Observability& observability) {
    observability.increment_metric(cca::runtime::RuntimeMetric::cleanup_operations);
}
