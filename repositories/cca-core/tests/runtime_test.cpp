#include <cca/core/configuration.hpp>
#include <cca/runtime/dependency_injector.hpp>
#include <cca/runtime/execution_policy.hpp>
#include <cca/runtime/provider.hpp>
#include <cca/runtime/runtime.hpp>
#include <cca/runtime/runtime_builder.hpp>

#include <chrono>
#include <condition_variable>
#include <cstddef>
#include <gtest/gtest.h>
#include <memory>
#include <mutex>
#include <string>
#include <utility>
#include <vector>

namespace {

using namespace std::chrono_literals;

using cca::core::ConfigurationKey;
using cca::runtime::DiagnosticCategory;
using cca::runtime::ProviderDependencyEdge;
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
using cca::runtime::StartupExecutionPolicy;

struct RootService {
    virtual ~RootService() = default;
};

struct LeftService {
    virtual ~LeftService() = default;
};

struct RightService {
    virtual ~RightService() = default;
};

struct LeafService {
    virtual ~LeafService() = default;
};

struct RuntimeEvent final {
    int value;
};

using RootContract = ServiceContract<RootService, ServiceCardinality::exactly_one>;
using LeftContract = ServiceContract<LeftService, ServiceCardinality::exactly_one>;
using RightContract = ServiceContract<RightService, ServiceCardinality::exactly_one>;
using LeafContract = ServiceContract<LeafService, ServiceCardinality::exactly_one>;

class LifecycleTrace final {
  public:
    void append(std::string event) {
        const std::scoped_lock lock{mutex_};
        events_.push_back(std::move(event));
    }

    [[nodiscard]] std::vector<std::string> snapshot() const {
        const std::scoped_lock lock{mutex_};
        return events_;
    }

  private:
    mutable std::mutex mutex_;
    std::vector<std::string> events_;
};

struct FreezeObservation final {
    std::shared_ptr<Runtime*> runtime_slot{std::make_shared<Runtime*>(nullptr)};
    std::mutex mutex;
    bool captured{false};
    bool runtime_available{false};
    bool runtime_frozen{false};
    bool configuration_frozen{false};
    bool registry_frozen{false};
    bool injector_frozen{false};
    bool event_bus_frozen{false};
    bool expected_configuration{false};
    RuntimeState state{RuntimeState::constructed};

    void capture(RuntimeContext& context) {
        const std::scoped_lock lock{mutex};
        if (captured) {
            return;
        }

        captured = true;
        auto* runtime = *runtime_slot;
        runtime_available = runtime != nullptr;
        if (runtime == nullptr) {
            return;
        }

        runtime_frozen = runtime->frozen();
        configuration_frozen = runtime->configuration_manager().frozen();
        registry_frozen = runtime->service_registry().frozen();
        injector_frozen = runtime->dependency_injector().frozen();
        event_bus_frozen = runtime->event_bus().frozen();
        expected_configuration = context.configuration().get_or(ConfigurationKey{"runtime.mode"},
                                                                "missing") == "headless";
        state = runtime->state();
    }
};

class TracedProvider : public ServiceProvider {
  public:
    TracedProvider(std::shared_ptr<LifecycleTrace> trace,
                   std::shared_ptr<FreezeObservation> freeze,
                   std::string name,
                   const bool fail_start,
                   const bool fail_stop)
        : trace_(std::move(trace)), freeze_(std::move(freeze)), name_(std::move(name)),
          fail_start_(fail_start), fail_stop_(fail_stop) {}

    ~TracedProvider() override {
        trace_->append("destroy:" + name_);
    }

    [[nodiscard]] RuntimeResult start(RuntimeContext& context) override {
        if (freeze_ != nullptr) {
            freeze_->capture(context);
        }
        trace_->append("start:" + name_);
        if (fail_start_) {
            return RuntimeResult::failure("test.start_failure", name_ + " failed to start");
        }
        return RuntimeResult::success();
    }

    [[nodiscard]] RuntimeResult stop(RuntimeContext& context) override {
        static_cast<void>(context);
        trace_->append("stop:" + name_);
        if (fail_stop_) {
            return RuntimeResult::failure("test.stop_failure", name_ + " failed to stop");
        }
        return RuntimeResult::success();
    }

  private:
    std::shared_ptr<LifecycleTrace> trace_;
    std::shared_ptr<FreezeObservation> freeze_;
    std::string name_;
    bool fail_start_;
    bool fail_stop_;
};

template <typename Interface> class BasicProvider final : public Interface, public TracedProvider {
  public:
    BasicProvider(std::shared_ptr<LifecycleTrace> trace,
                  std::shared_ptr<FreezeObservation> freeze,
                  std::string name,
                  const bool fail_start = false,
                  const bool fail_stop = false)
        : TracedProvider(
              std::move(trace), std::move(freeze), std::move(name), fail_start, fail_stop) {}
};

using RootProvider = BasicProvider<RootService>;
using LeftProvider = BasicProvider<LeftService>;
using RightProvider = BasicProvider<RightService>;
using LeafProvider = BasicProvider<LeafService>;

[[nodiscard]] std::unique_ptr<Runtime>
make_diamond_runtime(const RuntimeId& runtime_id,
                     const std::shared_ptr<LifecycleTrace>& trace,
                     const std::shared_ptr<FreezeObservation>& freeze,
                     const std::string& failing_start_provider = {},
                     const std::string& failing_stop_provider = {}) {
    RuntimeBuilder builder{runtime_id};
    builder.set_configuration(ConfigurationKey{"runtime.mode"}, "headless")
        .declare_contract<RootContract>()
        .declare_contract<LeftContract>()
        .declare_contract<RightContract>()
        .declare_contract<LeafContract>()
        .add_provider<RootContract, RootProvider>(
            [trace, freeze, failing_start_provider, failing_stop_provider] {
                return std::make_unique<RootProvider>(trace,
                                                      freeze,
                                                      "root",
                                                      failing_start_provider == "root",
                                                      failing_stop_provider == "root");
            })
        .add_provider<LeftContract, LeftProvider, RootContract>(
            [trace, freeze, failing_start_provider, failing_stop_provider](RootService& root) {
                static_cast<void>(root);
                return std::make_unique<LeftProvider>(trace,
                                                      freeze,
                                                      "left",
                                                      failing_start_provider == "left",
                                                      failing_stop_provider == "left");
            })
        .add_provider<RightContract, RightProvider, RootContract>(
            [trace, freeze, failing_start_provider, failing_stop_provider](RootService& root) {
                static_cast<void>(root);
                return std::make_unique<RightProvider>(trace,
                                                       freeze,
                                                       "right",
                                                       failing_start_provider == "right",
                                                       failing_stop_provider == "right");
            })
        .add_provider<LeafContract, LeafProvider, LeftContract, RightContract>(
            [trace, freeze, failing_start_provider, failing_stop_provider](LeftService& left,
                                                                           RightService& right) {
                static_cast<void>(left);
                static_cast<void>(right);
                return std::make_unique<LeafProvider>(trace,
                                                      freeze,
                                                      "leaf",
                                                      failing_start_provider == "leaf",
                                                      failing_stop_provider == "leaf");
            });
    return std::move(builder).build();
}

TEST(RuntimeTest, FreezesCompositionBeforeDeterministicStartupAndUsesReverseShutdown) {
    const auto trace = std::make_shared<LifecycleTrace>();
    const auto freeze = std::make_shared<FreezeObservation>();
    auto runtime = make_diamond_runtime(RuntimeId{"diamond-runtime"}, trace, freeze);
    *freeze->runtime_slot = runtime.get();

    ASSERT_TRUE(runtime->start().ok());

    EXPECT_TRUE(freeze->captured);
    EXPECT_TRUE(freeze->runtime_available);
    EXPECT_TRUE(freeze->runtime_frozen);
    EXPECT_TRUE(freeze->configuration_frozen);
    EXPECT_TRUE(freeze->registry_frozen);
    EXPECT_TRUE(freeze->injector_frozen);
    EXPECT_TRUE(freeze->event_bus_frozen);
    EXPECT_TRUE(freeze->expected_configuration);
    EXPECT_EQ(freeze->state, RuntimeState::starting);
    EXPECT_EQ(runtime->state(), RuntimeState::running);
    EXPECT_EQ(trace->snapshot(),
              (std::vector<std::string>{
                  "start:root",
                  "start:left",
                  "start:right",
                  "start:leaf",
              }));

    std::vector<std::pair<std::size_t, std::size_t>> startup_evidence;
    for (const auto& diagnostic : runtime->observability().diagnostics()) {
        if (diagnostic.category != DiagnosticCategory::startup) {
            continue;
        }
        ASSERT_TRUE(diagnostic.provider_id.has_value());
        ASSERT_TRUE(diagnostic.dependency_level.has_value());
        startup_evidence.emplace_back(diagnostic.provider_id->value(),
                                      *diagnostic.dependency_level);
    }
    EXPECT_EQ(startup_evidence,
              (std::vector<std::pair<std::size_t, std::size_t>>{
                  {0U, 0U},
                  {1U, 1U},
                  {2U, 1U},
                  {3U, 2U},
              }));

    EXPECT_EQ(runtime->dependency_injector().levels(),
              (std::vector<std::vector<ProviderId>>{
                  {ProviderId{0U}},
                  {ProviderId{1U}, ProviderId{2U}},
                  {ProviderId{3U}},
              }));
    EXPECT_EQ(runtime->dependency_injector().edges(),
              (std::vector<ProviderDependencyEdge>{
                  ProviderDependencyEdge{.dependent = ProviderId{1U}, .dependency = ProviderId{0U}},
                  ProviderDependencyEdge{.dependent = ProviderId{2U}, .dependency = ProviderId{0U}},
                  ProviderDependencyEdge{.dependent = ProviderId{3U}, .dependency = ProviderId{1U}},
                  ProviderDependencyEdge{.dependent = ProviderId{3U}, .dependency = ProviderId{2U}},
              }));

    auto& root = runtime->service_registry().resolve<RootContract>();
    EXPECT_NE(&root, nullptr);

    struct LateEvent final {};
    const auto late_subscription =
        runtime->event_bus().subscribe<LateEvent>([](const LateEvent&) {});
    EXPECT_FALSE(late_subscription.ok());
    EXPECT_EQ(late_subscription.code(), "event_bus.frozen");

    ASSERT_TRUE(runtime->stop().ok());

    EXPECT_EQ(runtime->state(), RuntimeState::destroyed);
    EXPECT_EQ(runtime->lifecycle_history(),
              (std::vector<RuntimeState>{
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
              }));
    EXPECT_EQ(trace->snapshot(),
              (std::vector<std::string>{
                  "start:root",
                  "start:left",
                  "start:right",
                  "start:leaf",
                  "stop:leaf",
                  "stop:right",
                  "stop:left",
                  "stop:root",
                  "destroy:leaf",
                  "destroy:right",
                  "destroy:left",
                  "destroy:root",
              }));

    std::vector<std::pair<std::size_t, std::size_t>> shutdown_evidence;
    for (const auto& diagnostic : runtime->observability().diagnostics()) {
        if (diagnostic.category != DiagnosticCategory::shutdown) {
            continue;
        }
        ASSERT_TRUE(diagnostic.provider_id.has_value());
        ASSERT_TRUE(diagnostic.dependency_level.has_value());
        shutdown_evidence.emplace_back(diagnostic.provider_id->value(),
                                       *diagnostic.dependency_level);
    }
    EXPECT_EQ(shutdown_evidence,
              (std::vector<std::pair<std::size_t, std::size_t>>{
                  {3U, 2U},
                  {2U, 1U},
                  {1U, 1U},
                  {0U, 0U},
              }));

    const auto rejected_publication = runtime->event_bus().publish(RuntimeEvent{.value = 1}).get();
    EXPECT_FALSE(rejected_publication.accepted);
    EXPECT_FALSE(rejected_publication.ok());
}

enum class ParallelRole {
    root,
    sibling,
    leaf,
};

class ParallelCoordinator final {
  public:
    [[nodiscard]] RuntimeResult enter(const ParallelRole role) {
        std::unique_lock lock{mutex_};
        switch (role) {
        case ParallelRole::root:
            root_completed_ = true;
            condition_.notify_all();
            return RuntimeResult::success();
        case ParallelRole::sibling:
            if (!root_completed_) {
                level_violation_ = true;
            }
            ++siblings_started_;
            condition_.notify_all();
            if (!condition_.wait_for(lock, 5s, [this] { return siblings_started_ == 2U; })) {
                rendezvous_timed_out_ = true;
                return RuntimeResult::failure("test.parallel_timeout",
                                              "Sibling provider rendezvous timed out");
            }
            ++siblings_completed_;
            condition_.notify_all();
            return RuntimeResult::success();
        case ParallelRole::leaf:
            leaf_started_after_siblings_ = root_completed_ && siblings_completed_ == 2U;
            if (!leaf_started_after_siblings_) {
                level_violation_ = true;
            }
            return RuntimeResult::success();
        }
        return RuntimeResult::failure("test.parallel_role", "Unknown parallel role");
    }

    [[nodiscard]] bool root_completed() const {
        const std::scoped_lock lock{mutex_};
        return root_completed_;
    }

    [[nodiscard]] std::size_t siblings_started() const {
        const std::scoped_lock lock{mutex_};
        return siblings_started_;
    }

    [[nodiscard]] std::size_t siblings_completed() const {
        const std::scoped_lock lock{mutex_};
        return siblings_completed_;
    }

    [[nodiscard]] bool leaf_started_after_siblings() const {
        const std::scoped_lock lock{mutex_};
        return leaf_started_after_siblings_;
    }

    [[nodiscard]] bool rendezvous_timed_out() const {
        const std::scoped_lock lock{mutex_};
        return rendezvous_timed_out_;
    }

    [[nodiscard]] bool level_violation() const {
        const std::scoped_lock lock{mutex_};
        return level_violation_;
    }

  private:
    mutable std::mutex mutex_;
    std::condition_variable condition_;
    bool root_completed_{false};
    std::size_t siblings_started_{0U};
    std::size_t siblings_completed_{0U};
    bool leaf_started_after_siblings_{false};
    bool rendezvous_timed_out_{false};
    bool level_violation_{false};
};

template <typename Interface>
class ParallelProvider final : public Interface, public ServiceProvider {
  public:
    ParallelProvider(std::shared_ptr<ParallelCoordinator> coordinator, const ParallelRole role)
        : coordinator_(std::move(coordinator)), role_(role) {}

    [[nodiscard]] RuntimeResult start(RuntimeContext& context) override {
        static_cast<void>(context);
        return coordinator_->enter(role_);
    }

    [[nodiscard]] RuntimeResult stop(RuntimeContext& context) override {
        static_cast<void>(context);
        return RuntimeResult::success();
    }

  private:
    std::shared_ptr<ParallelCoordinator> coordinator_;
    ParallelRole role_;
};

using ParallelRootProvider = ParallelProvider<RootService>;
using ParallelLeftProvider = ParallelProvider<LeftService>;
using ParallelRightProvider = ParallelProvider<RightService>;
using ParallelLeafProvider = ParallelProvider<LeafService>;

TEST(RuntimeTest, ParallelPolicyOverlapsOnlyProvidersWithinTheCurrentLevel) {
    const auto coordinator = std::make_shared<ParallelCoordinator>();
    RuntimeBuilder builder{RuntimeId{"parallel-runtime"}};
    builder.use_startup_policy(StartupExecutionPolicy::parallel_within_level)
        .declare_contract<RootContract>()
        .declare_contract<LeftContract>()
        .declare_contract<RightContract>()
        .declare_contract<LeafContract>()
        .add_provider<RootContract, ParallelRootProvider>([coordinator] {
            return std::make_unique<ParallelRootProvider>(coordinator, ParallelRole::root);
        })
        .add_provider<LeftContract, ParallelLeftProvider, RootContract>(
            [coordinator](RootService& root) {
                static_cast<void>(root);
                return std::make_unique<ParallelLeftProvider>(coordinator, ParallelRole::sibling);
            })
        .add_provider<RightContract, ParallelRightProvider, RootContract>(
            [coordinator](RootService& root) {
                static_cast<void>(root);
                return std::make_unique<ParallelRightProvider>(coordinator, ParallelRole::sibling);
            })
        .add_provider<LeafContract, ParallelLeafProvider, LeftContract, RightContract>(
            [coordinator](LeftService& left, RightService& right) {
                static_cast<void>(left);
                static_cast<void>(right);
                return std::make_unique<ParallelLeafProvider>(coordinator, ParallelRole::leaf);
            });
    auto runtime = std::move(builder).build();

    ASSERT_TRUE(runtime->start().ok());

    EXPECT_TRUE(coordinator->root_completed());
    EXPECT_EQ(coordinator->siblings_started(), 2U);
    EXPECT_EQ(coordinator->siblings_completed(), 2U);
    EXPECT_TRUE(coordinator->leaf_started_after_siblings());
    EXPECT_FALSE(coordinator->rendezvous_timed_out());
    EXPECT_FALSE(coordinator->level_violation());

    EXPECT_TRUE(runtime->stop().ok());
}

TEST(RuntimeTest, StartFailureRunsFailureRollbackAndDeterministicCleanup) {
    const auto trace = std::make_shared<LifecycleTrace>();
    const auto freeze = std::make_shared<FreezeObservation>();
    auto runtime = make_diamond_runtime(RuntimeId{"failing-runtime"}, trace, freeze, "left");
    *freeze->runtime_slot = runtime.get();

    const auto result = runtime->start();

    EXPECT_FALSE(result.ok());
    EXPECT_EQ(result.code(), "test.start_failure");
    EXPECT_EQ(runtime->state(), RuntimeState::destroyed);
    EXPECT_EQ(runtime->lifecycle_history(),
              (std::vector<RuntimeState>{
                  RuntimeState::constructed,
                  RuntimeState::initializing,
                  RuntimeState::configuring,
                  RuntimeState::registering_services,
                  RuntimeState::resolving_dependencies,
                  RuntimeState::validating,
                  RuntimeState::runtime_freeze,
                  RuntimeState::starting,
                  RuntimeState::failed,
                  RuntimeState::rollback,
                  RuntimeState::destroyed,
              }));
    EXPECT_EQ(trace->snapshot(),
              (std::vector<std::string>{
                  "start:root",
                  "start:left",
                  "stop:root",
                  "destroy:leaf",
                  "destroy:right",
                  "destroy:left",
                  "destroy:root",
              }));
    EXPECT_EQ(runtime->observability().metric_value(RuntimeMetric::providers_started), 1U);
    EXPECT_EQ(runtime->observability().metric_value(RuntimeMetric::providers_stopped), 1U);
    EXPECT_EQ(runtime->observability().metric_value(RuntimeMetric::runtime_failures), 1U);
    EXPECT_EQ(runtime->observability().metric_value(RuntimeMetric::rollbacks), 1U);
    EXPECT_EQ(runtime->observability().metric_value(RuntimeMetric::cleanup_operations), 1U);
}

TEST(RuntimeTest, EquivalentStartFailuresProduceEquivalentRollbackCleanup) {
    const auto first_trace = std::make_shared<LifecycleTrace>();
    const auto first_freeze = std::make_shared<FreezeObservation>();
    auto first_runtime = make_diamond_runtime(
        RuntimeId{"equivalent-failure-one"}, first_trace, first_freeze, "left");
    *first_freeze->runtime_slot = first_runtime.get();

    const auto second_trace = std::make_shared<LifecycleTrace>();
    const auto second_freeze = std::make_shared<FreezeObservation>();
    auto second_runtime = make_diamond_runtime(
        RuntimeId{"equivalent-failure-two"}, second_trace, second_freeze, "left");
    *second_freeze->runtime_slot = second_runtime.get();

    const auto first_result = first_runtime->start();
    const auto second_result = second_runtime->start();

    ASSERT_FALSE(first_result.ok());
    ASSERT_FALSE(second_result.ok());
    EXPECT_EQ(first_result.code(), second_result.code());
    EXPECT_EQ(first_runtime->lifecycle_history(), second_runtime->lifecycle_history());
    EXPECT_EQ(first_trace->snapshot(), second_trace->snapshot());
    EXPECT_EQ(first_runtime->observability().metrics(), second_runtime->observability().metrics());
}

TEST(RuntimeTest, ValidationFailurePreventsFreezeAndProviderStartup) {
    RuntimeBuilder builder{RuntimeId{"invalid-cardinality-runtime"}};
    builder.declare_contract<RootContract>();
    auto runtime = std::move(builder).build();

    const auto result = runtime->start();

    EXPECT_FALSE(result.ok());
    EXPECT_EQ(result.code(), "CCA-RUNTIME-REGISTRY-CARDINALITY");
    EXPECT_FALSE(runtime->frozen());
    EXPECT_FALSE(runtime->service_registry().frozen());
    EXPECT_FALSE(runtime->dependency_injector().frozen());
    EXPECT_FALSE(runtime->event_bus().frozen());
    EXPECT_EQ(runtime->observability().metric_value(RuntimeMetric::providers_started), 0U);
    EXPECT_EQ(runtime->lifecycle_history(),
              (std::vector<RuntimeState>{
                  RuntimeState::constructed,
                  RuntimeState::initializing,
                  RuntimeState::configuring,
                  RuntimeState::registering_services,
                  RuntimeState::resolving_dependencies,
                  RuntimeState::validating,
                  RuntimeState::failed,
                  RuntimeState::rollback,
                  RuntimeState::destroyed,
              }));
}

TEST(RuntimeTest, ExplicitFailureFromRunningRollsBackWithoutNormalShutdownStates) {
    const auto trace = std::make_shared<LifecycleTrace>();
    const auto freeze = std::make_shared<FreezeObservation>();
    auto runtime = make_diamond_runtime(RuntimeId{"explicit-failure-runtime"}, trace, freeze);
    *freeze->runtime_slot = runtime.get();
    ASSERT_TRUE(runtime->start().ok());

    const auto result =
        runtime->fail(RuntimeResult::failure("test.explicit_failure", "explicit failure"));

    EXPECT_FALSE(result.ok());
    EXPECT_EQ(result.code(), "test.explicit_failure");
    EXPECT_EQ(runtime->state(), RuntimeState::destroyed);
    EXPECT_EQ(runtime->lifecycle_history(),
              (std::vector<RuntimeState>{
                  RuntimeState::constructed,
                  RuntimeState::initializing,
                  RuntimeState::configuring,
                  RuntimeState::registering_services,
                  RuntimeState::resolving_dependencies,
                  RuntimeState::validating,
                  RuntimeState::runtime_freeze,
                  RuntimeState::starting,
                  RuntimeState::running,
                  RuntimeState::failed,
                  RuntimeState::rollback,
                  RuntimeState::destroyed,
              }));
    EXPECT_EQ(trace->snapshot(),
              (std::vector<std::string>{
                  "start:root",
                  "start:left",
                  "start:right",
                  "start:leaf",
                  "stop:leaf",
                  "stop:right",
                  "stop:left",
                  "stop:root",
                  "destroy:leaf",
                  "destroy:right",
                  "destroy:left",
                  "destroy:root",
              }));

    const auto rejected_publication = runtime->event_bus().publish(RuntimeEvent{.value = 1}).get();
    EXPECT_FALSE(rejected_publication.accepted);
}

TEST(RuntimeTest, ExplicitFailureRejectsASuccessCauseAndStillCleansUp) {
    auto runtime = RuntimeBuilder{RuntimeId{"invalid-failure-cause-runtime"}}.build();
    ASSERT_TRUE(runtime->start().ok());

    const auto result = runtime->fail(RuntimeResult::success());

    EXPECT_FALSE(result.ok());
    EXPECT_EQ(result.code(), "CCA-RUNTIME-FAILURE-CAUSE");
    EXPECT_EQ(runtime->state(), RuntimeState::destroyed);
}

TEST(RuntimeTest, StopFailureDoesNotStopDependenciesAndUsesReverseDestruction) {
    const auto trace = std::make_shared<LifecycleTrace>();
    const auto freeze = std::make_shared<FreezeObservation>();
    auto runtime = make_diamond_runtime(
        RuntimeId{"stop-failure-runtime"}, trace, freeze, std::string{}, "leaf");
    *freeze->runtime_slot = runtime.get();
    ASSERT_TRUE(runtime->start().ok());

    const auto result = runtime->stop();

    EXPECT_FALSE(result.ok());
    EXPECT_EQ(result.code(), "test.stop_failure");
    EXPECT_EQ(runtime->state(), RuntimeState::destroyed);
    EXPECT_EQ(runtime->lifecycle_history(),
              (std::vector<RuntimeState>{
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
                  RuntimeState::failed,
                  RuntimeState::rollback,
                  RuntimeState::destroyed,
              }));
    EXPECT_EQ(trace->snapshot(),
              (std::vector<std::string>{
                  "start:root",
                  "start:left",
                  "start:right",
                  "start:leaf",
                  "stop:leaf",
                  "destroy:leaf",
                  "destroy:right",
                  "destroy:left",
                  "destroy:root",
              }));
    EXPECT_EQ(runtime->observability().metric_value(RuntimeMetric::providers_stopped), 0U);
    EXPECT_EQ(runtime->observability().metric_value(RuntimeMetric::runtime_failures), 1U);
    EXPECT_EQ(runtime->observability().metric_value(RuntimeMetric::rollbacks), 1U);
}

} // namespace
