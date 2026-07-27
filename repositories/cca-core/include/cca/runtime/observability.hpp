#pragma once

#include <cca/core/logging.hpp>
#include <cca/runtime/provider.hpp>
#include <cca/runtime/runtime_id.hpp>
#include <cca/runtime/runtime_result.hpp>
#include <cca/runtime/runtime_state.hpp>

#include <array>
#include <cstddef>
#include <cstdint>
#include <mutex>
#include <optional>
#include <string>
#include <string_view>
#include <vector>

namespace cca::runtime {

class EventBus;
class LifecycleManager;
class Runtime;
class ServiceRegistry;

/// Severity of one instance-scoped diagnostic.
enum class DiagnosticSeverity {
    debug,
    info,
    warning,
    error,
};

/// Runtime Foundation outcome represented by one diagnostic.
enum class DiagnosticCategory {
    lifecycle,
    configuration,
    validation,
    service_registry,
    dependency_graph,
    startup,
    shutdown,
    event_bus,
    failure,
    rollback,
    cleanup,
};

/// Typed counters maintained by the Observability component.
enum class RuntimeMetric {
    diagnostics_recorded,
    lifecycle_transitions,
    rejected_transitions,
    validation_failures,
    service_registry_failures,
    dependency_graph_failures,
    providers_started,
    providers_stopped,
    event_publications,
    event_deliveries,
    event_handler_failures,
    runtime_failures,
    rollbacks,
    cleanup_operations,
};

/// Concrete health projection supplied by this implementation.
///
/// Health is an Observability facet, not another Runtime Foundation component.
enum class HealthStatus {
    healthy,
    degraded,
    failed,
    inactive,
};

[[nodiscard]] std::string_view to_string(DiagnosticSeverity severity) noexcept;
[[nodiscard]] std::string_view to_string(DiagnosticCategory category) noexcept;
[[nodiscard]] std::string_view to_string(RuntimeMetric metric) noexcept;
[[nodiscard]] std::string_view to_string(HealthStatus status) noexcept;

struct DiagnosticRecord final {
    RuntimeId runtime_id;
    std::uint64_t sequence;
    RuntimeState state;
    DiagnosticSeverity severity;
    DiagnosticCategory category;
    std::optional<ProviderId> provider_id;
    std::optional<std::size_t> dependency_level;
    std::string code;
    std::string message;

    bool operator==(const DiagnosticRecord&) const = default;
};

struct MetricSnapshot final {
    RuntimeMetric metric;
    std::uint64_t value;

    bool operator==(const MetricSnapshot&) const = default;
};

struct HealthSnapshot final {
    RuntimeId runtime_id;
    RuntimeState state;
    HealthStatus status;
    std::uint64_t diagnostic_count;
    std::uint64_t error_count;

    bool operator==(const HealthSnapshot&) const = default;
};

/// Instance-scoped logging, diagnostics, metrics, and health infrastructure.
///
/// All facets remain part of this one Observability component. Calls are
/// thread-safe. Calls serialized by Runtime receive deterministic sequence
/// numbers; concurrent calls receive unique sequence numbers in mutex acquisition
/// order. snapshots are sorted by those sequence numbers and contain no clock or
/// process-global data. Public access is inspection-only; only the coordinating
/// Runtime components may append foundation outcome evidence or update its
/// foundation metrics.
class Observability final {
  public:
    Observability(RuntimeId runtime_id, core::Logger logger);

    [[nodiscard]] const RuntimeId& runtime_id() const noexcept;
    [[nodiscard]] RuntimeState state() const;

    [[nodiscard]] std::uint64_t metric_value(RuntimeMetric metric) const;
    [[nodiscard]] std::vector<DiagnosticRecord> diagnostics() const;
    [[nodiscard]] std::vector<MetricSnapshot> metrics() const;
    [[nodiscard]] HealthSnapshot health() const;

  private:
    [[nodiscard]] std::uint64_t record(DiagnosticSeverity severity,
                                       DiagnosticCategory category,
                                       RuntimeState state,
                                       std::string code,
                                       std::string message);

    void record_lifecycle_transition(RuntimeState from, RuntimeState to);
    void
    record_rejected_transition(RuntimeState from, RuntimeState to, const RuntimeResult& result);
    void record_configuration(RuntimeState state, const RuntimeResult& result);
    void record_validation(RuntimeState state, const RuntimeResult& result);
    void record_service_registry(RuntimeState state, const RuntimeResult& result);
    void record_dependency_graph(RuntimeState state, const RuntimeResult& result);
    void record_startup(RuntimeState state,
                        ProviderId provider_id,
                        std::size_t dependency_level,
                        const RuntimeResult& result);
    void record_shutdown(RuntimeState state,
                         ProviderId provider_id,
                         std::size_t dependency_level,
                         const RuntimeResult& result);
    void record_event_bus_failure(RuntimeState state, std::string code, std::string message);
    void record_failure(RuntimeState state, const RuntimeResult& result);
    void record_rollback(RuntimeState state, const RuntimeResult& result);
    void record_cleanup(RuntimeState state, const RuntimeResult& result);

    void increment_metric(RuntimeMetric metric, std::uint64_t amount = 1);
    static constexpr std::size_t metric_count = 14;

    [[nodiscard]] static std::size_t metric_index(RuntimeMetric metric);
    [[nodiscard]] std::uint64_t
    record_impl(DiagnosticSeverity severity,
                DiagnosticCategory category,
                RuntimeState state,
                std::string code,
                std::string message,
                std::optional<RuntimeMetric> metric = std::nullopt,
                std::optional<ProviderId> provider_id = std::nullopt,
                std::optional<std::size_t> dependency_level = std::nullopt);
    void record_result(DiagnosticCategory category,
                       RuntimeState state,
                       const RuntimeResult& result,
                       std::string_view success_code,
                       std::string_view success_message,
                       std::optional<RuntimeMetric> failure_metric = std::nullopt,
                       std::optional<RuntimeMetric> success_metric = std::nullopt);

    RuntimeId runtime_id_;
    core::Logger logger_;
    mutable std::mutex mutex_;
    RuntimeState state_{RuntimeState::constructed};
    std::uint64_t next_sequence_{1};
    std::uint64_t error_count_{0};
    std::vector<DiagnosticRecord> diagnostics_;
    std::array<std::uint64_t, metric_count> metrics_{};

    friend class EventBus;
    friend class LifecycleManager;
    friend class Runtime;
    friend class ServiceRegistry;
};

} // namespace cca::runtime
