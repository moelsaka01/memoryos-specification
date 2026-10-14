#include <cca/runtime/event_bus.hpp>
#include <cca/runtime/lifecycle_manager.hpp>
#include <cca/runtime/observability.hpp>
#include <cca/runtime/runtime.hpp>
#include <cca/runtime/runtime_builder.hpp>
#include <cca/runtime/runtime_context.hpp>
#include <cca/runtime/service_registry.hpp>
#include <cca/testing/recording_log_sink.hpp>

#include <algorithm>
#include <concepts>
#include <cstdint>
#include <gtest/gtest.h>
#include <memory>
#include <stdexcept>
#include <string>
#include <thread>
#include <utility>
#include <vector>

namespace {

using cca::runtime::DiagnosticCategory;
using cca::runtime::DiagnosticSeverity;
using cca::runtime::EventBus;
using cca::runtime::HealthStatus;
using cca::runtime::LifecycleManager;
using cca::runtime::Observability;
using cca::runtime::ProviderId;
using cca::runtime::Runtime;
using cca::runtime::RuntimeBuilder;
using cca::runtime::RuntimeContext;
using cca::runtime::RuntimeId;
using cca::runtime::RuntimeMetric;
using cca::runtime::RuntimeResult;
using cca::runtime::RuntimeState;
using cca::runtime::ServiceCardinality;
using cca::runtime::ServiceContract;
using cca::runtime::ServiceProvider;
using cca::runtime::ServiceRegistry;

struct ObservedEvent final {
    int value;
};

struct ObservedService {
    virtual ~ObservedService() = default;
};

using ObservedContract = ServiceContract<ObservedService, ServiceCardinality::exactly_one>;

class ObservedProvider final : public ObservedService, public ServiceProvider {
  public:
    [[nodiscard]] RuntimeResult start(RuntimeContext& context) override {
        static_cast<void>(context);
        return RuntimeResult::success();
    }

    [[nodiscard]] RuntimeResult stop(RuntimeContext& context) override {
        static_cast<void>(context);
        return RuntimeResult::success();
    }
};

template <typename Type>
concept CanRecordCoreDiagnostic = requires(Type& observability) {
    observability.record(DiagnosticSeverity::info,
                         DiagnosticCategory::cleanup,
                         RuntimeState::destroyed,
                         "forged.cleanup",
                         "forged cleanup");
};

template <typename Type>
concept CanRecordCoreOutcome = requires(Type& observability) {
    observability.record_cleanup(RuntimeState::destroyed, RuntimeResult::success());
};

template <typename Type>
concept CanMutateCoreMetric = requires(Type& observability) {
    observability.increment_metric(RuntimeMetric::cleanup_operations);
};

static_assert(!CanRecordCoreDiagnostic<Observability>);
static_assert(!CanRecordCoreOutcome<Observability>);
static_assert(!CanMutateCoreMetric<Observability>);
static_assert(
    std::same_as<decltype(std::declval<Runtime&>().observability()), const Observability&>);
static_assert(
    std::same_as<decltype(std::declval<RuntimeContext&>().observability()), const Observability&>);

struct ObservabilityFixture final {
    std::shared_ptr<cca::testing::RecordingLogSink> sink{
        std::make_shared<cca::testing::RecordingLogSink>()};
    cca::core::Logger logger{sink, cca::core::LogLevel::debug};
    Observability observability{RuntimeId{"runtime-observability"}, logger};
    LifecycleManager lifecycle{observability};
};

TEST(ObservabilityTest, RetainsInstanceScopedLifecycleDiagnosticsAndLogs) {
    ObservabilityFixture fixture;

    ASSERT_TRUE(fixture.lifecycle.transition(RuntimeState::initializing).ok());
    const auto rejected = fixture.lifecycle.transition(RuntimeState::running);

    EXPECT_FALSE(rejected.ok());
    const auto diagnostics = fixture.observability.diagnostics();
    ASSERT_EQ(diagnostics.size(), 2U);
    EXPECT_EQ(diagnostics[0].runtime_id, RuntimeId{"runtime-observability"});
    EXPECT_EQ(diagnostics[0].sequence, 1U);
    EXPECT_EQ(diagnostics[0].state, RuntimeState::initializing);
    EXPECT_EQ(diagnostics[0].category, DiagnosticCategory::lifecycle);
    EXPECT_EQ(diagnostics[1].sequence, 2U);
    EXPECT_EQ(diagnostics[1].severity, DiagnosticSeverity::error);
    EXPECT_EQ(fixture.observability.state(), RuntimeState::initializing);
    EXPECT_EQ(fixture.observability.metric_value(RuntimeMetric::lifecycle_transitions), 1U);
    EXPECT_EQ(fixture.observability.metric_value(RuntimeMetric::rejected_transitions), 1U);

    const auto logs = fixture.sink->snapshot();
    ASSERT_EQ(logs.size(), 2U);
    EXPECT_NE(logs.front().message.find("[runtime-observability]"), std::string::npos);
}

TEST(ObservabilityTest, ExposesAuthenticRegistryEventAndHealthOutcomesReadOnly) {
    ObservabilityFixture fixture;
    ServiceRegistry registry{fixture.observability};

    EXPECT_THROW(static_cast<void>(registry.resolve<ObservedContract>()), std::logic_error);

    EventBus event_bus{RuntimeId{"runtime-observability"}, fixture.observability};
    ASSERT_TRUE(event_bus
                    .subscribe<ObservedEvent>(
                        [](const ObservedEvent&) { throw std::runtime_error{"handler failed"}; })
                    .ok());
    const auto delivery = event_bus.publish(ObservedEvent{.value = 7}).get();
    EXPECT_FALSE(delivery.ok());
    EXPECT_EQ(delivery.failure_count, 1U);

    EXPECT_EQ(fixture.observability.metric_value(RuntimeMetric::service_registry_failures), 1U);
    EXPECT_EQ(fixture.observability.metric_value(RuntimeMetric::event_publications), 1U);
    EXPECT_EQ(fixture.observability.metric_value(RuntimeMetric::event_handler_failures), 1U);
    EXPECT_EQ(fixture.observability.health().status, HealthStatus::degraded);

    ASSERT_TRUE(fixture.lifecycle.transition(RuntimeState::initializing).ok());
    ASSERT_TRUE(fixture.lifecycle.transition(RuntimeState::failed).ok());
    EXPECT_EQ(fixture.observability.health().status, HealthStatus::failed);
    ASSERT_TRUE(fixture.lifecycle.transition(RuntimeState::rollback).ok());
    ASSERT_TRUE(fixture.lifecycle.transition(RuntimeState::destroyed).ok());
    EXPECT_EQ(fixture.observability.health().status, HealthStatus::inactive);
}

TEST(ObservabilityTest, RuntimeRecordsProviderAndCleanupOutcomesThroughPrivateSeams) {
    const auto sink = std::make_shared<cca::testing::RecordingLogSink>();
    RuntimeBuilder builder{RuntimeId{"observed-runtime"}};
    builder.use_log_sink(sink);
    builder.declare_contract<ObservedContract>();
    builder.add_provider<ObservedContract, ObservedProvider>(
        [] { return std::make_unique<ObservedProvider>(); });
    auto runtime = std::move(builder).build();

    ASSERT_TRUE(runtime->start().ok());
    ASSERT_TRUE(runtime->stop().ok());

    const auto& observability = runtime->observability();
    EXPECT_EQ(observability.metric_value(RuntimeMetric::providers_started), 1U);
    EXPECT_EQ(observability.metric_value(RuntimeMetric::providers_stopped), 1U);
    EXPECT_EQ(observability.metric_value(RuntimeMetric::cleanup_operations), 1U);

    const auto diagnostics = observability.diagnostics();
    const auto startup = std::ranges::find_if(diagnostics, [](const auto& diagnostic) {
        return diagnostic.category == DiagnosticCategory::startup;
    });
    const auto shutdown = std::ranges::find_if(diagnostics, [](const auto& diagnostic) {
        return diagnostic.category == DiagnosticCategory::shutdown;
    });
    ASSERT_NE(startup, diagnostics.end());
    ASSERT_NE(shutdown, diagnostics.end());
    EXPECT_EQ(startup->provider_id, ProviderId{0U});
    EXPECT_EQ(startup->dependency_level, 0U);
    EXPECT_EQ(shutdown->provider_id, ProviderId{0U});
    EXPECT_EQ(shutdown->dependency_level, 0U);
    EXPECT_FALSE(sink->snapshot().empty());
}

TEST(ObservabilityTest, ConcurrentAuthenticRecordingIsSafeAndSequenceSorted) {
    ObservabilityFixture fixture;
    constexpr std::size_t thread_count = 8U;
    constexpr std::size_t records_per_thread = 50U;

    std::vector<std::jthread> threads;
    threads.reserve(thread_count);
    for (std::size_t thread = 0; thread < thread_count; ++thread) {
        threads.emplace_back([&fixture] {
            ServiceRegistry registry{fixture.observability};
            for (std::size_t record = 0; record < records_per_thread; ++record) {
                try {
                    static_cast<void>(registry.resolve<ObservedContract>());
                } catch (const std::logic_error&) {
                }
            }
        });
    }
    threads.clear();

    const auto diagnostics = fixture.observability.diagnostics();
    ASSERT_EQ(diagnostics.size(), thread_count * records_per_thread);
    EXPECT_EQ(fixture.observability.metric_value(RuntimeMetric::service_registry_failures),
              thread_count * records_per_thread);
    for (std::size_t index = 0; index < diagnostics.size(); ++index) {
        EXPECT_EQ(diagnostics[index].sequence, static_cast<std::uint64_t>(index + 1U));
        EXPECT_EQ(diagnostics[index].runtime_id, RuntimeId{"runtime-observability"});
        EXPECT_EQ(diagnostics[index].category, DiagnosticCategory::service_registry);
    }
}

TEST(ObservabilityTest, SeparateInstancesDoNotConflateEvidence) {
    const auto first_sink = std::make_shared<cca::testing::RecordingLogSink>();
    const auto second_sink = std::make_shared<cca::testing::RecordingLogSink>();
    Observability first{RuntimeId{"runtime-one"}, cca::core::Logger{first_sink}};
    Observability second{RuntimeId{"runtime-two"}, cca::core::Logger{second_sink}};
    LifecycleManager first_lifecycle{first};
    LifecycleManager second_lifecycle{second};

    ASSERT_TRUE(first_lifecycle.transition(RuntimeState::initializing).ok());
    ASSERT_TRUE(second_lifecycle.transition(RuntimeState::initializing).ok());

    ASSERT_EQ(first.diagnostics().size(), 1U);
    ASSERT_EQ(second.diagnostics().size(), 1U);
    EXPECT_EQ(first.diagnostics().front().runtime_id, RuntimeId{"runtime-one"});
    EXPECT_EQ(second.diagnostics().front().runtime_id, RuntimeId{"runtime-two"});
}

} // namespace
