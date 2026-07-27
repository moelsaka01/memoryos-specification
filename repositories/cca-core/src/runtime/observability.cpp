#include <cca/runtime/observability.hpp>

#include <algorithm>
#include <stdexcept>
#include <utility>

namespace cca::runtime {
namespace {

[[nodiscard]] core::LogLevel log_level(const DiagnosticSeverity severity) noexcept {
    switch (severity) {
    case DiagnosticSeverity::debug:
        return core::LogLevel::debug;
    case DiagnosticSeverity::info:
        return core::LogLevel::info;
    case DiagnosticSeverity::warning:
        return core::LogLevel::warning;
    case DiagnosticSeverity::error:
        return core::LogLevel::error;
    }
    return core::LogLevel::error;
}

[[nodiscard]] std::string outcome_code(const RuntimeResult& result,
                                       const std::string_view success_code) {
    return result ? std::string{success_code} : result.code();
}

[[nodiscard]] std::string outcome_message(const RuntimeResult& result,
                                          const std::string_view success_message) {
    return result ? std::string{success_message} : result.message();
}

} // namespace

std::string_view to_string(const DiagnosticSeverity severity) noexcept {
    switch (severity) {
    case DiagnosticSeverity::debug:
        return "debug";
    case DiagnosticSeverity::info:
        return "info";
    case DiagnosticSeverity::warning:
        return "warning";
    case DiagnosticSeverity::error:
        return "error";
    }
    return "unknown";
}

std::string_view to_string(const DiagnosticCategory category) noexcept {
    switch (category) {
    case DiagnosticCategory::lifecycle:
        return "lifecycle";
    case DiagnosticCategory::configuration:
        return "configuration";
    case DiagnosticCategory::validation:
        return "validation";
    case DiagnosticCategory::service_registry:
        return "service_registry";
    case DiagnosticCategory::dependency_graph:
        return "dependency_graph";
    case DiagnosticCategory::startup:
        return "startup";
    case DiagnosticCategory::shutdown:
        return "shutdown";
    case DiagnosticCategory::event_bus:
        return "event_bus";
    case DiagnosticCategory::failure:
        return "failure";
    case DiagnosticCategory::rollback:
        return "rollback";
    case DiagnosticCategory::cleanup:
        return "cleanup";
    }
    return "unknown";
}

std::string_view to_string(const RuntimeMetric metric) noexcept {
    switch (metric) {
    case RuntimeMetric::diagnostics_recorded:
        return "diagnostics_recorded";
    case RuntimeMetric::lifecycle_transitions:
        return "lifecycle_transitions";
    case RuntimeMetric::rejected_transitions:
        return "rejected_transitions";
    case RuntimeMetric::validation_failures:
        return "validation_failures";
    case RuntimeMetric::service_registry_failures:
        return "service_registry_failures";
    case RuntimeMetric::dependency_graph_failures:
        return "dependency_graph_failures";
    case RuntimeMetric::providers_started:
        return "providers_started";
    case RuntimeMetric::providers_stopped:
        return "providers_stopped";
    case RuntimeMetric::event_publications:
        return "event_publications";
    case RuntimeMetric::event_deliveries:
        return "event_deliveries";
    case RuntimeMetric::event_handler_failures:
        return "event_handler_failures";
    case RuntimeMetric::runtime_failures:
        return "runtime_failures";
    case RuntimeMetric::rollbacks:
        return "rollbacks";
    case RuntimeMetric::cleanup_operations:
        return "cleanup_operations";
    }
    return "unknown";
}

std::string_view to_string(const HealthStatus status) noexcept {
    switch (status) {
    case HealthStatus::healthy:
        return "healthy";
    case HealthStatus::degraded:
        return "degraded";
    case HealthStatus::failed:
        return "failed";
    case HealthStatus::inactive:
        return "inactive";
    }
    return "unknown";
}

Observability::Observability(RuntimeId runtime_id, core::Logger logger)
    : runtime_id_(std::move(runtime_id)), logger_(std::move(logger)) {}

const RuntimeId& Observability::runtime_id() const noexcept {
    return runtime_id_;
}

RuntimeState Observability::state() const {
    const std::scoped_lock lock{mutex_};
    return state_;
}

std::uint64_t Observability::record(const DiagnosticSeverity severity,
                                    const DiagnosticCategory category,
                                    const RuntimeState state,
                                    std::string code,
                                    std::string message) {
    return record_impl(
        severity, category, state, std::move(code), std::move(message), std::nullopt);
}

void Observability::record_lifecycle_transition(const RuntimeState from, const RuntimeState to) {
    const auto message = std::string{"Runtime transitioned from "} + std::string{to_string(from)} +
                         " to " + std::string{to_string(to)};

    {
        const std::scoped_lock lock{mutex_};
        state_ = to;
    }
    static_cast<void>(record_impl(DiagnosticSeverity::info,
                                  DiagnosticCategory::lifecycle,
                                  to,
                                  "lifecycle.transition",
                                  message,
                                  RuntimeMetric::lifecycle_transitions));
}

void Observability::record_rejected_transition(const RuntimeState from,
                                               const RuntimeState to,
                                               const RuntimeResult& result) {
    const auto code = result ? std::string{"lifecycle.transition_rejected"} : result.code();
    const auto message = result ? std::string{"Runtime transition was rejected"}
                                : result.message() + " (" + std::string{to_string(from)} + " -> " +
                                      std::string{to_string(to)} + ")";
    static_cast<void>(record_impl(DiagnosticSeverity::error,
                                  DiagnosticCategory::lifecycle,
                                  from,
                                  code,
                                  message,
                                  RuntimeMetric::rejected_transitions));
}

void Observability::record_configuration(const RuntimeState state, const RuntimeResult& result) {
    record_result(DiagnosticCategory::configuration,
                  state,
                  result,
                  "configuration.valid",
                  "Runtime configuration is valid",
                  RuntimeMetric::validation_failures);
}

void Observability::record_validation(const RuntimeState state, const RuntimeResult& result) {
    record_result(DiagnosticCategory::validation,
                  state,
                  result,
                  "validation.succeeded",
                  "Runtime composition validation succeeded",
                  RuntimeMetric::validation_failures);
}

void Observability::record_service_registry(const RuntimeState state, const RuntimeResult& result) {
    record_result(DiagnosticCategory::service_registry,
                  state,
                  result,
                  "service_registry.succeeded",
                  "Service Registry operation succeeded",
                  RuntimeMetric::service_registry_failures);
}

void Observability::record_dependency_graph(const RuntimeState state, const RuntimeResult& result) {
    record_result(DiagnosticCategory::dependency_graph,
                  state,
                  result,
                  "dependency_graph.valid",
                  "Dependency graph validation succeeded",
                  RuntimeMetric::dependency_graph_failures);
}

void Observability::record_startup(const RuntimeState state,
                                   const ProviderId provider_id,
                                   const std::size_t dependency_level,
                                   const RuntimeResult& result) {
    const auto message = "Provider " + std::to_string(provider_id.value()) +
                         " at dependency level " + std::to_string(dependency_level) + ": " +
                         outcome_message(result, "startup completed");
    static_cast<void>(
        record_impl(result ? DiagnosticSeverity::info : DiagnosticSeverity::error,
                    DiagnosticCategory::startup,
                    state,
                    outcome_code(result, "startup.provider_started"),
                    message,
                    result ? std::optional{RuntimeMetric::providers_started} : std::nullopt,
                    provider_id,
                    dependency_level));
}

void Observability::record_shutdown(const RuntimeState state,
                                    const ProviderId provider_id,
                                    const std::size_t dependency_level,
                                    const RuntimeResult& result) {
    const auto message = "Provider " + std::to_string(provider_id.value()) +
                         " at dependency level " + std::to_string(dependency_level) + ": " +
                         outcome_message(result, "shutdown completed");
    static_cast<void>(
        record_impl(result ? DiagnosticSeverity::info : DiagnosticSeverity::error,
                    DiagnosticCategory::shutdown,
                    state,
                    outcome_code(result, "shutdown.provider_stopped"),
                    message,
                    result ? std::optional{RuntimeMetric::providers_stopped} : std::nullopt,
                    provider_id,
                    dependency_level));
}

void Observability::record_event_bus_failure(const RuntimeState state,
                                             std::string code,
                                             std::string message) {
    static_cast<void>(record_impl(DiagnosticSeverity::error,
                                  DiagnosticCategory::event_bus,
                                  state,
                                  std::move(code),
                                  std::move(message),
                                  RuntimeMetric::event_handler_failures));
}

void Observability::record_failure(const RuntimeState state, const RuntimeResult& result) {
    record_result(DiagnosticCategory::failure,
                  state,
                  result,
                  "failure.recorded",
                  "Runtime failure handling was requested",
                  RuntimeMetric::runtime_failures,
                  RuntimeMetric::runtime_failures);
}

void Observability::record_rollback(const RuntimeState state, const RuntimeResult& result) {
    record_result(DiagnosticCategory::rollback,
                  state,
                  result,
                  "rollback.succeeded",
                  "Runtime rollback completed",
                  RuntimeMetric::rollbacks,
                  RuntimeMetric::rollbacks);
}

void Observability::record_cleanup(const RuntimeState state, const RuntimeResult& result) {
    record_result(DiagnosticCategory::cleanup,
                  state,
                  result,
                  "cleanup.succeeded",
                  "Runtime cleanup completed",
                  RuntimeMetric::cleanup_operations,
                  RuntimeMetric::cleanup_operations);
}

void Observability::increment_metric(const RuntimeMetric metric, const std::uint64_t amount) {
    const std::scoped_lock lock{mutex_};
    metrics_[metric_index(metric)] += amount;
}

std::uint64_t Observability::metric_value(const RuntimeMetric metric) const {
    const std::scoped_lock lock{mutex_};
    return metrics_[metric_index(metric)];
}

std::vector<DiagnosticRecord> Observability::diagnostics() const {
    std::vector<DiagnosticRecord> result;
    {
        const std::scoped_lock lock{mutex_};
        result = diagnostics_;
    }
    std::ranges::sort(result, {}, &DiagnosticRecord::sequence);
    return result;
}

std::vector<MetricSnapshot> Observability::metrics() const {
    std::vector<MetricSnapshot> result;
    result.reserve(metric_count);

    const std::scoped_lock lock{mutex_};
    for (std::size_t index = 0; index < metric_count; ++index) {
        result.push_back(MetricSnapshot{
            .metric = static_cast<RuntimeMetric>(index),
            .value = metrics_[index],
        });
    }
    return result;
}

HealthSnapshot Observability::health() const {
    const std::scoped_lock lock{mutex_};

    HealthStatus status = HealthStatus::healthy;
    if (state_ == RuntimeState::failed || state_ == RuntimeState::rollback) {
        status = HealthStatus::failed;
    } else if (state_ == RuntimeState::stopped || state_ == RuntimeState::destroyed) {
        status = HealthStatus::inactive;
    } else if (error_count_ != 0) {
        status = HealthStatus::degraded;
    }

    return HealthSnapshot{
        .runtime_id = runtime_id_,
        .state = state_,
        .status = status,
        .diagnostic_count = metrics_[metric_index(RuntimeMetric::diagnostics_recorded)],
        .error_count = error_count_,
    };
}

std::size_t Observability::metric_index(const RuntimeMetric metric) {
    const auto index = static_cast<std::size_t>(metric);
    if (index >= metric_count) {
        throw std::invalid_argument{"unknown Runtime metric"};
    }
    return index;
}

std::uint64_t Observability::record_impl(const DiagnosticSeverity severity,
                                         const DiagnosticCategory category,
                                         const RuntimeState state,
                                         std::string code,
                                         std::string message,
                                         const std::optional<RuntimeMetric> metric,
                                         const std::optional<ProviderId> provider_id,
                                         const std::optional<std::size_t> dependency_level) {
    if (code.empty()) {
        throw std::invalid_argument{"diagnostic code must not be empty"};
    }
    if (message.empty()) {
        throw std::invalid_argument{"diagnostic message must not be empty"};
    }

    DiagnosticRecord diagnostic{
        .runtime_id = runtime_id_,
        .sequence = 0,
        .state = state,
        .severity = severity,
        .category = category,
        .provider_id = provider_id,
        .dependency_level = dependency_level,
        .code = std::move(code),
        .message = std::move(message),
    };

    {
        const std::scoped_lock lock{mutex_};
        diagnostic.sequence = next_sequence_;
        ++next_sequence_;
        diagnostics_.push_back(diagnostic);
        ++metrics_[metric_index(RuntimeMetric::diagnostics_recorded)];
        if (metric.has_value()) {
            ++metrics_[metric_index(*metric)];
        }
        if (severity == DiagnosticSeverity::error) {
            ++error_count_;
        }
    }

    const auto log_message =
        "[" + runtime_id_.value() + "] " + diagnostic.code + ": " + diagnostic.message;
    try {
        logger_.log(log_level(severity), "runtime.observability", log_message);
    } catch (...) {
        // The retained diagnostic is authoritative. A failing injected sink must
        // not become a seventh coordination mechanism or alter Runtime behavior.
    }
    return diagnostic.sequence;
}

void Observability::record_result(const DiagnosticCategory category,
                                  const RuntimeState state,
                                  const RuntimeResult& result,
                                  const std::string_view success_code,
                                  const std::string_view success_message,
                                  const std::optional<RuntimeMetric> failure_metric,
                                  const std::optional<RuntimeMetric> success_metric) {
    static_cast<void>(record_impl(result ? DiagnosticSeverity::info : DiagnosticSeverity::error,
                                  category,
                                  state,
                                  outcome_code(result, success_code),
                                  outcome_message(result, success_message),
                                  result ? success_metric : failure_metric));
}

} // namespace cca::runtime
