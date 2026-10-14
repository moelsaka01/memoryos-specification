#include <cca/runtime/runtime.hpp>
#include <cca/runtime/runtime_builder.hpp>

#include <exception>
#include <future>
#include <string>
#include <utility>

namespace cca::runtime {
namespace {

[[nodiscard]] RuntimeResult provider_exception(const std::exception& exception) {
    return RuntimeResult::failure("CCA-RUNTIME-PROVIDER-EXCEPTION",
                                  std::string{"Provider lifecycle operation threw: "} +
                                      exception.what());
}

[[nodiscard]] RuntimeResult unknown_provider() {
    return RuntimeResult::failure("CCA-RUNTIME-PROVIDER-MISSING",
                                  "Validated Provider instance is unavailable.");
}

[[nodiscard]] std::future<RuntimeResult> ready_result(RuntimeResult result) {
    std::promise<RuntimeResult> promise;
    promise.set_value(std::move(result));
    return promise.get_future();
}

} // namespace

Runtime::Runtime(RuntimeBuilder&& builder)
    : runtime_id_(std::move(builder.runtime_id_)),
      configuration_plan_(std::move(builder.configuration_builder_).build()),
      startup_policy_(builder.startup_policy_),
      registry_actions_(std::move(builder.registry_actions_)),
      event_actions_(std::move(builder.event_actions_)),
      observability_(runtime_id_,
                     core::Logger{std::move(builder.log_sink_), core::LogLevel::debug}),
      lifecycle_manager_(observability_), service_registry_(observability_),
      event_bus_(runtime_id_, observability_),
      context_(runtime_id_, configuration_manager_, event_bus_, observability_) {}

Runtime::~Runtime() {
    try {
        if (state() == RuntimeState::running) {
            static_cast<void>(stop());
        } else {
            event_bus_.close();
            event_bus_.drain();
            destroy_provider_instances();
        }
    } catch (...) {
        // Destruction releases the owned component graph through RAII. Public
        // lifecycle operations retain explicit diagnostics before this boundary.
    }
}

const RuntimeId& Runtime::runtime_id() const noexcept {
    return runtime_id_;
}

RuntimeState Runtime::state() const {
    return lifecycle_manager_.state();
}

std::vector<RuntimeState> Runtime::lifecycle_history() const {
    return lifecycle_manager_.history();
}

bool Runtime::frozen() const {
    return configuration_manager_.frozen() && service_registry_.frozen() &&
           dependency_injector_.frozen() && event_bus_.frozen();
}

RuntimeResult Runtime::start() {
    const std::scoped_lock lock{operation_mutex_};

    auto result = lifecycle_manager_.transition(RuntimeState::initializing);
    if (!result) {
        return result;
    }

    result = configure_and_register();
    if (!result) {
        return rollback(result, false);
    }

    result = resolve_validate_and_freeze();
    if (!result) {
        return rollback(result, false);
    }

    result = lifecycle_manager_.transition(RuntimeState::starting);
    if (!result) {
        return result;
    }

    result = start_providers();
    if (!result) {
        return rollback(result, false);
    }

    result = lifecycle_manager_.transition(RuntimeState::running);
    return result;
}

RuntimeResult Runtime::stop() {
    const std::scoped_lock lock{operation_mutex_};

    auto result = lifecycle_manager_.transition(RuntimeState::stopping);
    if (!result) {
        return result;
    }

    result = stop_started_providers();
    if (!result) {
        return rollback(result, true);
    }

    result = lifecycle_manager_.transition(RuntimeState::stopped);
    if (!result) {
        return result;
    }

    event_bus_.close();
    event_bus_.drain();
    destroy_provider_instances();
    const auto cleanup_result = RuntimeResult::success();
    observability_.record_cleanup(RuntimeState::stopped, cleanup_result);

    return lifecycle_manager_.transition(RuntimeState::destroyed);
}

RuntimeResult Runtime::fail(RuntimeResult cause) {
    const std::scoped_lock lock{operation_mutex_};
    if (cause) {
        cause = RuntimeResult::failure("CCA-RUNTIME-FAILURE-CAUSE",
                                       "Runtime::fail requires an explicit failure result.");
    }
    if (state() != RuntimeState::running) {
        return lifecycle_manager_.transition(RuntimeState::failed);
    }
    return rollback(cause, false);
}

const LifecycleManager& Runtime::lifecycle_manager() const noexcept {
    return lifecycle_manager_;
}

const ServiceRegistry& Runtime::service_registry() const noexcept {
    return service_registry_;
}

const DependencyInjector& Runtime::dependency_injector() const noexcept {
    return dependency_injector_;
}

EventBus& Runtime::event_bus() noexcept {
    return event_bus_;
}

const EventBus& Runtime::event_bus() const noexcept {
    return event_bus_;
}

const ConfigurationManager& Runtime::configuration_manager() const noexcept {
    return configuration_manager_;
}

const Observability& Runtime::observability() const noexcept {
    return observability_;
}

RuntimeContext& Runtime::context() noexcept {
    return context_;
}

const RuntimeContext& Runtime::context() const noexcept {
    return context_;
}

RuntimeResult Runtime::configure_and_register() {
    auto result = lifecycle_manager_.transition(RuntimeState::configuring);
    if (!result) {
        return result;
    }

    result = configuration_manager_.configure(configuration_plan_);
    observability_.record_configuration(RuntimeState::configuring, result);
    if (!result) {
        return result;
    }

    result = lifecycle_manager_.transition(RuntimeState::registering_services);
    if (!result) {
        return result;
    }

    for (auto& action : registry_actions_) {
        result = action(service_registry_);
        observability_.record_service_registry(RuntimeState::registering_services, result);
        if (!result) {
            return result;
        }
    }
    for (auto& action : event_actions_) {
        result = action(event_bus_);
        if (!result) {
            observability_.record_event_bus_failure(
                RuntimeState::registering_services, result.code(), result.message());
            return result;
        }
    }

    return RuntimeResult::success();
}

RuntimeResult Runtime::resolve_validate_and_freeze() {
    auto result = lifecycle_manager_.transition(RuntimeState::resolving_dependencies);
    if (!result) {
        return result;
    }

    const auto graph_result = dependency_injector_.build_and_validate(service_registry_);

    result = lifecycle_manager_.transition(RuntimeState::validating);
    if (!result) {
        return result;
    }
    observability_.record_dependency_graph(RuntimeState::validating, graph_result);
    if (!graph_result) {
        return graph_result;
    }

    result = configuration_manager_.validate();
    observability_.record_configuration(RuntimeState::validating, result);
    if (!result) {
        return result;
    }

    result = service_registry_.validate();
    observability_.record_validation(RuntimeState::validating, result);
    if (!result) {
        return result;
    }

    result = dependency_injector_.instantiate(service_registry_);
    observability_.record_dependency_graph(RuntimeState::validating, result);
    if (!result) {
        return result;
    }

    result = configuration_manager_.freeze();
    if (!result) {
        return result;
    }
    result = service_registry_.freeze();
    if (!result) {
        return result;
    }
    result = dependency_injector_.freeze();
    if (!result) {
        return result;
    }
    result = event_bus_.freeze();
    if (!result) {
        return result;
    }

    return lifecycle_manager_.transition(RuntimeState::runtime_freeze);
}

RuntimeResult Runtime::start_providers() {
    const auto& levels = dependency_injector_.levels();
    for (std::size_t dependency_level = 0U; dependency_level < levels.size(); ++dependency_level) {
        const auto result =
            startup_policy_ == StartupExecutionPolicy::parallel_within_level
                ? start_level_parallel(levels[dependency_level], dependency_level)
                : start_level_sequential(levels[dependency_level], dependency_level);
        if (!result) {
            return result;
        }
    }
    return RuntimeResult::success();
}

RuntimeResult Runtime::start_level_sequential(const std::vector<ProviderId>& level,
                                              const std::size_t dependency_level) {
    for (const ProviderId id : level) {
        auto result = service_registry_.mark_start_attempted(id);
        if (!result) {
            return result;
        }

        auto* provider = service_registry_.lifecycle_provider(id);
        if (provider == nullptr) {
            return unknown_provider();
        }

        try {
            result = provider->start(context_);
        } catch (const std::exception& exception) {
            result = provider_exception(exception);
        } catch (...) {
            result = RuntimeResult::failure("CCA-RUNTIME-PROVIDER-EXCEPTION",
                                            "Provider lifecycle operation threw.");
        }

        observability_.record_startup(RuntimeState::starting, id, dependency_level, result);
        if (!result) {
            return result;
        }
        result = service_registry_.mark_started(id);
        if (!result) {
            return result;
        }
    }
    return RuntimeResult::success();
}

RuntimeResult Runtime::start_level_parallel(const std::vector<ProviderId>& level,
                                            const std::size_t dependency_level) {
    std::vector<std::future<RuntimeResult>> futures;
    futures.reserve(level.size());

    for (const ProviderId id : level) {
        auto mark_result = service_registry_.mark_start_attempted(id);
        if (!mark_result) {
            futures.push_back(ready_result(std::move(mark_result)));
            continue;
        }

        auto* provider = service_registry_.lifecycle_provider(id);
        if (provider == nullptr) {
            futures.push_back(ready_result(unknown_provider()));
            continue;
        }

        try {
            futures.push_back(std::async(std::launch::async, [this, provider] {
                try {
                    return provider->start(context_);
                } catch (const std::exception& exception) {
                    return provider_exception(exception);
                } catch (...) {
                    return RuntimeResult::failure("CCA-RUNTIME-PROVIDER-EXCEPTION",
                                                  "Provider lifecycle operation threw.");
                }
            }));
        } catch (const std::exception& exception) {
            futures.push_back(ready_result(provider_exception(exception)));
        }
    }

    RuntimeResult first_failure = RuntimeResult::success();
    for (std::size_t index = 0; index < level.size(); ++index) {
        auto result = futures[index].get();
        observability_.record_startup(
            RuntimeState::starting, level[index], dependency_level, result);
        if (result) {
            result = service_registry_.mark_started(level[index]);
        }
        if (!result && first_failure) {
            first_failure = result;
        }
    }
    return first_failure;
}

RuntimeResult Runtime::stop_started_providers() {
    const auto& levels = dependency_injector_.levels();
    for (std::size_t level_count = levels.size(); level_count > 0U; --level_count) {
        const std::size_t dependency_level = level_count - 1U;
        const auto& level = levels[dependency_level];
        for (auto provider_iterator = level.rbegin(); provider_iterator != level.rend();
             ++provider_iterator) {
            const ProviderId id = *provider_iterator;
            if (!service_registry_.started(id)) {
                continue;
            }

            auto* provider = service_registry_.lifecycle_provider(id);
            RuntimeResult result =
                provider == nullptr ? unknown_provider() : RuntimeResult::success();
            if (provider != nullptr) {
                try {
                    result = provider->stop(context_);
                } catch (const std::exception& exception) {
                    result = provider_exception(exception);
                } catch (...) {
                    result = RuntimeResult::failure("CCA-RUNTIME-PROVIDER-EXCEPTION",
                                                    "Provider lifecycle operation threw.");
                }
            }

            observability_.record_shutdown(state(), id, dependency_level, result);
            if (!result) {
                return result;
            }
            result = service_registry_.mark_stopped(id);
            if (!result) {
                return result;
            }
        }
    }

    return RuntimeResult::success();
}

RuntimeResult Runtime::rollback(const RuntimeResult& cause, const bool stop_already_attempted) {
    observability_.record_failure(state(), cause);

    auto transition_result = lifecycle_manager_.transition(RuntimeState::failed);
    if (!transition_result) {
        return transition_result;
    }
    transition_result = lifecycle_manager_.transition(RuntimeState::rollback);
    if (!transition_result) {
        return transition_result;
    }

    RuntimeResult cleanup_result = RuntimeResult::success();
    if (!stop_already_attempted) {
        cleanup_result = stop_started_providers();
    }
    event_bus_.close();
    event_bus_.drain();
    destroy_provider_instances();

    observability_.record_rollback(RuntimeState::rollback, cleanup_result);
    observability_.record_cleanup(RuntimeState::rollback, cleanup_result);
    transition_result = lifecycle_manager_.transition(RuntimeState::destroyed);
    return transition_result ? cause : transition_result;
}

void Runtime::destroy_provider_instances() noexcept {
    for (auto level_iterator = dependency_injector_.levels().rbegin();
         level_iterator != dependency_injector_.levels().rend();
         ++level_iterator) {
        for (auto provider_iterator = level_iterator->rbegin();
             provider_iterator != level_iterator->rend();
             ++provider_iterator) {
            service_registry_.destroy_provider(*provider_iterator);
        }
    }
}

} // namespace cca::runtime
