#include <cca/core/configuration.hpp>
#include <cca/runtime/runtime.hpp>
#include <cca/runtime/runtime_builder.hpp>
#include <cca/runtime/runtime_host.hpp>

#include <atomic>
#include <gtest/gtest.h>
#include <utility>
#include <vector>

namespace {

using cca::core::ConfigurationKey;
using cca::runtime::HealthStatus;
using cca::runtime::RuntimeBuilder;
using cca::runtime::RuntimeHost;
using cca::runtime::RuntimeId;
using cca::runtime::RuntimeResult;
using cca::runtime::RuntimeState;

struct HostEvent final {
    int value;
};

TEST(RuntimeHostTest, KeepsConfigurationEventsAndLifecycleStateInstanceLocal) {
    std::atomic<int> first_total{0};
    std::atomic<int> second_total{0};

    RuntimeBuilder first_builder{RuntimeId{"first"}};
    first_builder.set_configuration(ConfigurationKey{"instance.name"}, "first-value")
        .subscribe<HostEvent>(
            [&first_total](const HostEvent& event) { first_total += event.value; });

    RuntimeBuilder second_builder{RuntimeId{"second"}};
    second_builder.set_configuration(ConfigurationKey{"instance.name"}, "second-value")
        .subscribe<HostEvent>(
            [&second_total](const HostEvent& event) { second_total += event.value; });

    RuntimeHost host;
    ASSERT_TRUE(host.create(std::move(first_builder)).ok());
    ASSERT_TRUE(host.create(std::move(second_builder)).ok());
    EXPECT_EQ(host.size(), 2U);
    EXPECT_EQ(host.runtime_ids(),
              (std::vector<RuntimeId>{RuntimeId{"first"}, RuntimeId{"second"}}));

    ASSERT_TRUE(host.start(RuntimeId{"first"}).ok());
    auto* first = host.find(RuntimeId{"first"});
    auto* second = host.find(RuntimeId{"second"});
    ASSERT_NE(first, nullptr);
    ASSERT_NE(second, nullptr);
    EXPECT_EQ(first->state(), RuntimeState::running);
    EXPECT_EQ(second->state(), RuntimeState::constructed);

    ASSERT_TRUE(host.start(RuntimeId{"second"}).ok());
    EXPECT_EQ(second->state(), RuntimeState::running);
    EXPECT_EQ(first->context().configuration().get_or(ConfigurationKey{"instance.name"}, "missing"),
              "first-value");
    EXPECT_EQ(
        second->context().configuration().get_or(ConfigurationKey{"instance.name"}, "missing"),
        "second-value");

    ASSERT_TRUE(first->event_bus().publish(HostEvent{.value = 3}).get().ok());
    EXPECT_EQ(first_total, 3);
    EXPECT_EQ(second_total, 0);
    ASSERT_TRUE(second->event_bus().publish(HostEvent{.value = 7}).get().ok());
    EXPECT_EQ(first_total, 3);
    EXPECT_EQ(second_total, 7);

    const auto second_diagnostics_before = second->observability().diagnostics();
    const auto failure =
        first->fail(RuntimeResult::failure("test.first_failed", "first instance failed"));
    EXPECT_FALSE(failure.ok());
    EXPECT_EQ(failure.code(), "test.first_failed");
    EXPECT_EQ(first->state(), RuntimeState::destroyed);
    EXPECT_EQ(second->state(), RuntimeState::running);
    const auto second_health = second->observability().health();
    EXPECT_EQ(second_health.runtime_id, RuntimeId{"second"});
    EXPECT_EQ(second_health.state, RuntimeState::running);
    EXPECT_EQ(second_health.status, HealthStatus::healthy);
    EXPECT_EQ(second->observability().diagnostics(), second_diagnostics_before);
    for (const auto& diagnostic : second->observability().diagnostics()) {
        EXPECT_EQ(diagnostic.runtime_id, RuntimeId{"second"});
    }

    ASSERT_TRUE(host.destroy(RuntimeId{"first"}).ok());
    EXPECT_EQ(host.find(RuntimeId{"first"}), nullptr);
    EXPECT_EQ(host.size(), 1U);

    ASSERT_TRUE(host.destroy(RuntimeId{"second"}).ok());
    EXPECT_EQ(host.find(RuntimeId{"second"}), nullptr);
    EXPECT_EQ(host.size(), 0U);
}

TEST(RuntimeHostTest, RejectsDuplicateAndUnknownRuntimeIds) {
    RuntimeHost host;
    ASSERT_TRUE(host.create(RuntimeBuilder{RuntimeId{"owned"}}).ok());

    const auto duplicate = host.create(RuntimeBuilder{RuntimeId{"owned"}});
    EXPECT_FALSE(duplicate.ok());
    EXPECT_EQ(duplicate.code(), "CCA-RUNTIME-HOST-DUPLICATE");
    EXPECT_EQ(host.size(), 1U);

    const RuntimeId unknown{"unknown"};
    const auto start_unknown = host.start(unknown);
    const auto stop_unknown = host.stop(unknown);
    const auto destroy_unknown = host.destroy(unknown);
    EXPECT_FALSE(start_unknown.ok());
    EXPECT_FALSE(stop_unknown.ok());
    EXPECT_FALSE(destroy_unknown.ok());
    EXPECT_EQ(start_unknown.code(), "CCA-RUNTIME-HOST-UNKNOWN");
    EXPECT_EQ(stop_unknown.code(), "CCA-RUNTIME-HOST-UNKNOWN");
    EXPECT_EQ(destroy_unknown.code(), "CCA-RUNTIME-HOST-UNKNOWN");
    EXPECT_EQ(host.find(unknown), nullptr);

    ASSERT_TRUE(host.start(RuntimeId{"owned"}).ok());
    ASSERT_TRUE(host.destroy(RuntimeId{"owned"}).ok());
    EXPECT_EQ(host.size(), 0U);
}

} // namespace
