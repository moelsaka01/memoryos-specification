#include <cca/runtime/event_bus.hpp>
#include <cca/testing/recording_log_sink.hpp>

#include <atomic>
#include <chrono>
#include <future>
#include <gtest/gtest.h>
#include <memory>
#include <mutex>
#include <stdexcept>
#include <thread>
#include <vector>

namespace {

using namespace std::chrono_literals;

using cca::runtime::DiagnosticCategory;
using cca::runtime::EventBus;
using cca::runtime::Observability;
using cca::runtime::RuntimeId;
using cca::runtime::RuntimeMetric;

struct FirstEvent final {
    int value;
};

struct SecondEvent final {
    int value;
};

struct EventBusFixture final {
    std::shared_ptr<cca::testing::RecordingLogSink> sink{
        std::make_shared<cca::testing::RecordingLogSink>()};
    cca::core::Logger logger{sink, cca::core::LogLevel::debug};
    Observability observability{RuntimeId{"event-runtime"}, logger};
    EventBus bus{RuntimeId{"event-runtime"}, observability};
};

TEST(EventBusTest, SeparatesEventTypesWithoutStringIdentity) {
    EventBusFixture fixture;
    std::atomic<int> first_total{0};
    std::atomic<int> second_total{0};
    ASSERT_TRUE(fixture.bus
                    .subscribe<FirstEvent>(
                        [&first_total](const FirstEvent& event) { first_total += event.value; })
                    .ok());
    ASSERT_TRUE(fixture.bus
                    .subscribe<SecondEvent>(
                        [&second_total](const SecondEvent& event) { second_total += event.value; })
                    .ok());

    const auto result = fixture.bus.publish(FirstEvent{.value = 7}).get();

    EXPECT_TRUE(result.ok());
    EXPECT_EQ(result.subscriber_count, 1U);
    EXPECT_EQ(first_total, 7);
    EXPECT_EQ(second_total, 0);
}

TEST(EventBusTest, DeliveryRunsAsynchronouslyRatherThanInline) {
    EventBusFixture fixture;
    std::promise<std::thread::id> handler_thread;
    auto observed_thread = handler_thread.get_future();
    ASSERT_TRUE(fixture.bus
                    .subscribe<FirstEvent>([&handler_thread](const FirstEvent&) {
                        handler_thread.set_value(std::this_thread::get_id());
                    })
                    .ok());

    const auto caller_thread = std::this_thread::get_id();
    const auto delivery = fixture.bus.publish(FirstEvent{.value = 1});

    EXPECT_NE(observed_thread.get(), caller_thread);
    EXPECT_TRUE(delivery.get().ok());
}

TEST(EventBusTest, InvokesSnapshottedHandlersInSubscriptionOrder) {
    EventBusFixture fixture;
    std::mutex order_mutex;
    std::vector<int> order;
    for (int handler = 1; handler <= 3; ++handler) {
        ASSERT_TRUE(fixture.bus
                        .subscribe<FirstEvent>([&order_mutex, &order, handler](const FirstEvent&) {
                            const std::scoped_lock lock{order_mutex};
                            order.push_back(handler);
                        })
                        .ok());
    }

    const auto result = fixture.bus.publish(FirstEvent{.value = 0}).get();

    EXPECT_TRUE(result.ok());
    EXPECT_EQ(order, (std::vector<int>{1, 2, 3}));
}

TEST(EventBusTest, ContinuesAfterHandlerFailureAndRecordsIt) {
    EventBusFixture fixture;
    std::atomic<int> successful_handlers{0};
    ASSERT_TRUE(fixture.bus
                    .subscribe<FirstEvent>(
                        [](const FirstEvent&) { throw std::runtime_error{"handler failure"}; })
                    .ok());
    ASSERT_TRUE(fixture.bus
                    .subscribe<FirstEvent>(
                        [&successful_handlers](const FirstEvent&) { ++successful_handlers; })
                    .ok());

    const auto result = fixture.bus.publish(FirstEvent{.value = 0}).get();

    EXPECT_FALSE(result.ok());
    EXPECT_EQ(result.subscriber_count, 2U);
    EXPECT_EQ(result.delivered_count, 1U);
    EXPECT_EQ(result.failure_count, 1U);
    EXPECT_EQ(successful_handlers, 1);
    EXPECT_EQ(fixture.observability.metric_value(RuntimeMetric::event_handler_failures), 1U);

    const auto diagnostics = fixture.observability.diagnostics();
    ASSERT_EQ(diagnostics.size(), 1U);
    EXPECT_EQ(diagnostics.front().category, DiagnosticCategory::event_bus);
    EXPECT_EQ(diagnostics.front().code, "event_bus.handler_exception");
    EXPECT_EQ(diagnostics.front().runtime_id, RuntimeId{"event-runtime"});
}

TEST(EventBusTest, FreezeRejectsSubscriptionMutationWithoutRemovingHandlers) {
    EventBusFixture fixture;
    std::atomic<int> deliveries{0};
    ASSERT_TRUE(
        fixture.bus.subscribe<FirstEvent>([&deliveries](const FirstEvent&) { ++deliveries; }).ok());
    ASSERT_TRUE(fixture.bus.freeze().ok());

    const auto rejected = fixture.bus.subscribe<FirstEvent>([](const FirstEvent&) {});
    EXPECT_FALSE(rejected.ok());
    EXPECT_EQ(rejected.code(), "event_bus.frozen");
    EXPECT_TRUE(fixture.bus.publish(FirstEvent{.value = 0}).get().ok());
    EXPECT_EQ(deliveries, 1);
}

TEST(EventBusTest, DrainWaitsForAcceptedDeliveries) {
    EventBusFixture fixture;
    std::promise<void> handler_started;
    auto started = handler_started.get_future();
    std::promise<void> release_handler;
    auto release = release_handler.get_future().share();
    ASSERT_TRUE(fixture.bus
                    .subscribe<FirstEvent>([&handler_started, release](const FirstEvent&) mutable {
                        handler_started.set_value();
                        release.wait();
                    })
                    .ok());

    const auto delivery = fixture.bus.publish(FirstEvent{.value = 0});
    started.wait();
    EXPECT_EQ(fixture.bus.pending_deliveries(), 1U);

    auto drain = std::async(std::launch::async, [&fixture] { fixture.bus.drain(); });
    EXPECT_EQ(drain.wait_for(20ms), std::future_status::timeout);
    release_handler.set_value();
    drain.get();

    EXPECT_TRUE(delivery.get().ok());
    EXPECT_EQ(fixture.bus.pending_deliveries(), 0U);
}

TEST(EventBusTest, ConcurrentPublishIsSafe) {
    EventBusFixture fixture;
    constexpr int publication_count = 32;
    std::atomic<int> delivered_total{0};
    ASSERT_TRUE(fixture.bus
                    .subscribe<FirstEvent>([&delivered_total](const FirstEvent& event) {
                        delivered_total += event.value;
                    })
                    .ok());

    std::vector<std::future<cca::runtime::EventDeliveryResult>> publications;
    publications.reserve(publication_count);
    for (int publication = 0; publication < publication_count; ++publication) {
        publications.push_back(std::async(std::launch::async, [&fixture] {
            return fixture.bus.publish(FirstEvent{.value = 1}).get();
        }));
    }
    for (auto& publication : publications) {
        EXPECT_TRUE(publication.get().ok());
    }

    EXPECT_EQ(delivered_total, publication_count);
    EXPECT_EQ(fixture.observability.metric_value(RuntimeMetric::event_publications),
              static_cast<std::uint64_t>(publication_count));
    EXPECT_EQ(fixture.observability.metric_value(RuntimeMetric::event_deliveries),
              static_cast<std::uint64_t>(publication_count));
}

TEST(EventBusTest, SeparateBusesRemainInstanceLocal) {
    const auto first_sink = std::make_shared<cca::testing::RecordingLogSink>();
    const auto second_sink = std::make_shared<cca::testing::RecordingLogSink>();
    Observability first_observability{RuntimeId{"first-runtime"}, cca::core::Logger{first_sink}};
    Observability second_observability{RuntimeId{"second-runtime"}, cca::core::Logger{second_sink}};
    EventBus first_bus{RuntimeId{"first-runtime"}, first_observability};
    EventBus second_bus{RuntimeId{"second-runtime"}, second_observability};
    std::atomic<int> first_count{0};
    std::atomic<int> second_count{0};
    ASSERT_TRUE(
        first_bus.subscribe<FirstEvent>([&first_count](const FirstEvent&) { ++first_count; }).ok());
    ASSERT_TRUE(
        second_bus.subscribe<FirstEvent>([&second_count](const FirstEvent&) { ++second_count; })
            .ok());

    EXPECT_TRUE(first_bus.publish(FirstEvent{.value = 0}).get().ok());

    EXPECT_EQ(first_count, 1);
    EXPECT_EQ(second_count, 0);
    EXPECT_EQ(first_bus.runtime_id(), RuntimeId{"first-runtime"});
    EXPECT_EQ(second_bus.runtime_id(), RuntimeId{"second-runtime"});
}

} // namespace
