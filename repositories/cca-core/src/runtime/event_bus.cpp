#include <cca/runtime/event_bus.hpp>

#include <algorithm>
#include <chrono>
#include <exception>
#include <mutex>
#include <unordered_map>
#include <utility>
#include <vector>

namespace cca::runtime {

struct EventBus::State final {
    State(RuntimeId id, Observability& instance_observability)
        : runtime_id(std::move(id)), observability(instance_observability) {}

    RuntimeId runtime_id;
    Observability& observability;
    mutable std::mutex mutex;
    bool frozen{false};
    bool accepting_publications{true};
    std::unordered_map<std::type_index, std::vector<ErasedHandler>> handlers;
    std::vector<std::shared_future<EventDeliveryResult>> deliveries;
};

namespace {

[[nodiscard]] std::shared_future<EventDeliveryResult>
ready_delivery(const EventDeliveryResult result) {
    std::promise<EventDeliveryResult> promise;
    promise.set_value(result);
    return promise.get_future().share();
}

} // namespace

EventBus::EventBus(RuntimeId runtime_id, Observability& observability)
    : state_(std::make_unique<State>(std::move(runtime_id), observability)) {}

EventBus::~EventBus() {
    close();
    drain();
}

void EventBus::close() noexcept {
    const std::scoped_lock lock{state_->mutex};
    state_->accepting_publications = false;
}

RuntimeResult EventBus::freeze() {
    const std::scoped_lock lock{state_->mutex};
    if (!state_->accepting_publications) {
        return RuntimeResult::failure("event_bus.closed", "Event Bus is no longer accepting work");
    }
    state_->frozen = true;
    return RuntimeResult::success();
}

bool EventBus::frozen() const {
    const std::scoped_lock lock{state_->mutex};
    return state_->frozen;
}

void EventBus::drain() {
    for (;;) {
        std::vector<std::shared_future<EventDeliveryResult>> deliveries;
        {
            const std::scoped_lock lock{state_->mutex};
            deliveries = state_->deliveries;
        }

        for (const auto& delivery : deliveries) {
            delivery.wait();
        }

        {
            const std::scoped_lock lock{state_->mutex};
            std::erase_if(state_->deliveries, [](const auto& delivery) {
                return delivery.wait_for(std::chrono::seconds{0}) == std::future_status::ready;
            });
            if (state_->deliveries.empty()) {
                return;
            }
        }
    }
}

std::size_t EventBus::pending_deliveries() const {
    const std::scoped_lock lock{state_->mutex};
    return static_cast<std::size_t>(
        std::ranges::count_if(state_->deliveries, [](const auto& delivery) {
            return delivery.wait_for(std::chrono::seconds{0}) != std::future_status::ready;
        }));
}

const RuntimeId& EventBus::runtime_id() const noexcept {
    return state_->runtime_id;
}

RuntimeResult EventBus::add_subscription(const std::type_index event_type, ErasedHandler handler) {
    const std::scoped_lock lock{state_->mutex};
    if (!state_->accepting_publications) {
        return RuntimeResult::failure("event_bus.closed", "Event Bus is no longer accepting work");
    }
    if (state_->frozen) {
        return RuntimeResult::failure("event_bus.frozen",
                                      "Event Bus subscriptions cannot change after Runtime Freeze");
    }
    state_->handlers[event_type].push_back(std::move(handler));
    return RuntimeResult::success();
}

std::shared_future<EventDeliveryResult>
EventBus::publish_erased(const std::type_index event_type, std::shared_ptr<const void> event) {
    std::unique_lock lock{state_->mutex};
    if (!state_->accepting_publications) {
        return ready_delivery(EventDeliveryResult{
            .accepted = false,
            .subscriber_count = 0,
            .delivered_count = 0,
            .failure_count = 0,
        });
    }

    auto handlers = std::vector<ErasedHandler>{};
    if (const auto iterator = state_->handlers.find(event_type);
        iterator != state_->handlers.end()) {
        handlers = iterator->second;
    }

    state_->observability.increment_metric(RuntimeMetric::event_publications);
    auto delivery =
        std::async(std::launch::async,
                   [handlers = std::move(handlers),
                    event = std::move(event),
                    observability = &state_->observability]() {
                       auto result = EventDeliveryResult{
                           .accepted = true,
                           .subscriber_count = handlers.size(),
                           .delivered_count = 0,
                           .failure_count = 0,
                       };

                       for (const auto& handler : handlers) {
                           try {
                               handler(event.get());
                               ++result.delivered_count;
                           } catch (const std::exception& error) {
                               ++result.failure_count;
                               try {
                                   observability->record_event_bus_failure(
                                       observability->state(),
                                       "event_bus.handler_exception",
                                       std::string{"event handler threw: "} + error.what());
                               } catch (...) {
                                   // Delivery remains explicit even if diagnostic
                                   // allocation itself cannot complete.
                               }
                           } catch (...) {
                               ++result.failure_count;
                               try {
                                   observability->record_event_bus_failure(
                                       observability->state(),
                                       "event_bus.handler_exception",
                                       "event handler threw a non-standard exception");
                               } catch (...) {
                                   // Delivery remains explicit even if diagnostic
                                   // allocation itself cannot complete.
                               }
                           }
                       }

                       observability->increment_metric(
                           RuntimeMetric::event_deliveries,
                           static_cast<std::uint64_t>(result.delivered_count));
                       return result;
                   })
            .share();

    std::erase_if(state_->deliveries, [](const auto& existing) {
        return existing.wait_for(std::chrono::seconds{0}) == std::future_status::ready;
    });
    state_->deliveries.push_back(delivery);
    return delivery;
}

} // namespace cca::runtime
