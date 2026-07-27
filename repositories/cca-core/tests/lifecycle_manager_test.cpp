#include <cca/runtime/lifecycle_manager.hpp>
#include <cca/runtime/observability.hpp>
#include <cca/testing/recording_log_sink.hpp>

#include <gtest/gtest.h>
#include <iterator>
#include <memory>
#include <vector>

namespace {

using cca::runtime::DiagnosticCategory;
using cca::runtime::LifecycleManager;
using cca::runtime::Observability;
using cca::runtime::RuntimeId;
using cca::runtime::RuntimeMetric;
using cca::runtime::RuntimeState;

struct LifecycleFixture final {
    std::shared_ptr<cca::testing::RecordingLogSink> sink{
        std::make_shared<cca::testing::RecordingLogSink>()};
    Observability observability{
        RuntimeId{"lifecycle-runtime"},
        cca::core::Logger{sink, cca::core::LogLevel::debug},
    };
    LifecycleManager manager{observability};
};

TEST(LifecycleManagerTest, AcceptsTheExactSuccessfulLifecycleSequence) {
    LifecycleFixture fixture;
    const std::vector<RuntimeState> expected{
        RuntimeState::constructed,
        RuntimeState::initializing,
        RuntimeState::configuring,
        RuntimeState::registering_services,
        RuntimeState::resolving_dependencies,
        RuntimeState::validating,
        RuntimeState::runtime_freeze,
        RuntimeState::starting,
        RuntimeState::running,
        RuntimeState::stopping,
        RuntimeState::stopped,
        RuntimeState::destroyed,
    };

    for (auto iterator = std::next(expected.begin()); iterator != expected.end(); ++iterator) {
        ASSERT_TRUE(fixture.manager.transition(*iterator).ok());
    }

    EXPECT_EQ(fixture.manager.state(), RuntimeState::destroyed);
    EXPECT_EQ(fixture.manager.history(), expected);
    EXPECT_EQ(fixture.observability.metric_value(RuntimeMetric::lifecycle_transitions),
              expected.size() - 1U);
}

TEST(LifecycleManagerTest, RejectsInvalidTransitionAndRecordsObservabilityEvidence) {
    LifecycleFixture fixture;

    const auto result = fixture.manager.transition(RuntimeState::running);

    EXPECT_FALSE(result.ok());
    EXPECT_EQ(result.code(), "CCA-RUNTIME-LIFECYCLE-001");
    EXPECT_EQ(fixture.manager.state(), RuntimeState::constructed);
    EXPECT_EQ(fixture.manager.history(), (std::vector<RuntimeState>{RuntimeState::constructed}));
    EXPECT_EQ(fixture.observability.metric_value(RuntimeMetric::rejected_transitions), 1U);

    const auto diagnostics = fixture.observability.diagnostics();
    ASSERT_EQ(diagnostics.size(), 1U);
    EXPECT_EQ(diagnostics.front().runtime_id, RuntimeId{"lifecycle-runtime"});
    EXPECT_EQ(diagnostics.front().state, RuntimeState::constructed);
    EXPECT_EQ(diagnostics.front().category, DiagnosticCategory::lifecycle);
    EXPECT_EQ(diagnostics.front().code, "CCA-RUNTIME-LIFECYCLE-001");
}

TEST(LifecycleManagerTest, AcceptsOnlyTheApprovedFailureCleanupSequence) {
    LifecycleFixture fixture;
    ASSERT_TRUE(fixture.manager.transition(RuntimeState::initializing).ok());
    ASSERT_TRUE(fixture.manager.transition(RuntimeState::configuring).ok());

    ASSERT_TRUE(fixture.manager.transition(RuntimeState::failed).ok());
    ASSERT_TRUE(fixture.manager.transition(RuntimeState::rollback).ok());
    ASSERT_TRUE(fixture.manager.transition(RuntimeState::destroyed).ok());

    EXPECT_EQ(fixture.manager.history(),
              (std::vector<RuntimeState>{
                  RuntimeState::constructed,
                  RuntimeState::initializing,
                  RuntimeState::configuring,
                  RuntimeState::failed,
                  RuntimeState::rollback,
                  RuntimeState::destroyed,
              }));
}

} // namespace
