#pragma once

#include <cca/runtime/observability.hpp>
#include <cca/runtime/runtime_id.hpp>
#include <cca/runtime/runtime_result.hpp>

#include <concepts>
#include <cstddef>
#include <functional>
#include <future>
#include <memory>
#include <type_traits>
#include <typeindex>
#include <utility>

namespace cca::runtime {

class Runtime;

struct EventDeliveryResult final {
    bool accepted;
    std::size_t subscriber_count;
    std::size_t delivered_count;
    std::size_t failure_count;

    [[nodiscard]] bool ok() const noexcept {
        return accepted && failure_count == 0;
    }

    bool operator==(const EventDeliveryResult&) const = default;
};

/// Instance-local, typed asynchronous Runtime Event Bus.
///
/// Event identity is the C++ event type; no string lookup is exposed. Handlers
/// are snapshotted at publish time and invoked in subscription order by one
/// asynchronous delivery task. There is intentionally no queue bound,
/// backpressure, priority, or delivery retry policy. Callers must quiesce
/// publication before a bounded drain. The destructor rejects new publications
/// and drains already accepted work. The injected Observability component must
/// outlive the EventBus.
class EventBus final {
  public:
    EventBus(RuntimeId runtime_id, Observability& observability);
    ~EventBus();

    EventBus(const EventBus&) = delete;
    EventBus& operator=(const EventBus&) = delete;
    EventBus(EventBus&&) = delete;
    EventBus& operator=(EventBus&&) = delete;

    template <typename Event, typename Handler>
        requires std::is_object_v<Event> && std::invocable<std::decay_t<Handler>&, const Event&> &&
                 std::same_as<std::invoke_result_t<std::decay_t<Handler>&, const Event&>, void>
    [[nodiscard]] RuntimeResult subscribe(Handler&& handler) {
        using HandlerType = std::decay_t<Handler>;
        auto owned_handler = std::make_shared<HandlerType>(std::forward<Handler>(handler));

        return add_subscription(std::type_index{typeid(Event)},
                                [owned_handler = std::move(owned_handler)](const void* event) {
                                    std::invoke(*owned_handler, *static_cast<const Event*>(event));
                                });
    }

    template <typename Event>
        requires std::is_object_v<Event> && std::move_constructible<Event>
    [[nodiscard]] std::shared_future<EventDeliveryResult> publish(Event event) {
        auto owned_event = std::make_shared<const Event>(std::move(event));
        return publish_erased(std::type_index{typeid(Event)}, std::move(owned_event));
    }

    [[nodiscard]] RuntimeResult freeze();
    [[nodiscard]] bool frozen() const;

    /// Waits until the tracked set of accepted deliveries is observed empty.
    ///
    /// This does not close the Event Bus or establish a cutoff for concurrent
    /// publication. Callers that require a bounded completion boundary must first
    /// quiesce publishers; Runtime lifecycle cleanup closes the bus before draining.
    void drain();
    [[nodiscard]] std::size_t pending_deliveries() const;

    [[nodiscard]] const RuntimeId& runtime_id() const noexcept;

  private:
    friend class Runtime;

    using ErasedHandler = std::function<void(const void*)>;

    struct State;

    void close() noexcept;
    [[nodiscard]] RuntimeResult add_subscription(std::type_index event_type, ErasedHandler handler);
    [[nodiscard]] std::shared_future<EventDeliveryResult>
    publish_erased(std::type_index event_type, std::shared_ptr<const void> event);

    std::unique_ptr<State> state_;
};

} // namespace cca::runtime
