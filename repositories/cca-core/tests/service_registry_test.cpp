#include <cca/runtime/dependency_injector.hpp>
#include <cca/runtime/observability.hpp>
#include <cca/runtime/provider.hpp>
#include <cca/runtime/service_registry.hpp>
#include <cca/testing/recording_log_sink.hpp>

#include <concepts>
#include <functional>
#include <gtest/gtest.h>
#include <memory>
#include <optional>
#include <stdexcept>
#include <utility>
#include <vector>

namespace {

using cca::runtime::DependencyInjector;
using cca::runtime::DiagnosticCategory;
using cca::runtime::DiagnosticSeverity;
using cca::runtime::Observability;
using cca::runtime::RuntimeContext;
using cca::runtime::RuntimeId;
using cca::runtime::RuntimeMetric;
using cca::runtime::RuntimeResult;
using cca::runtime::RuntimeState;
using cca::runtime::ServiceCardinality;
using cca::runtime::ServiceContract;
using cca::runtime::ServiceProvider;
using cca::runtime::ServiceRegistry;

struct ExactlyOneService {
    virtual ~ExactlyOneService() = default;
    [[nodiscard]] virtual int value() const noexcept = 0;
};

struct OptionalService {
    virtual ~OptionalService() = default;
    [[nodiscard]] virtual int value() const noexcept = 0;
};

struct ManyService {
    virtual ~ManyService() = default;
    [[nodiscard]] virtual int value() const noexcept = 0;
};

struct LateService {
    virtual ~LateService() = default;
};

using ExactlyOneContract = ServiceContract<ExactlyOneService, ServiceCardinality::exactly_one>;
using OptionalContract = ServiceContract<OptionalService, ServiceCardinality::zero_or_one>;
using ManyContract = ServiceContract<ManyService, ServiceCardinality::one_or_more>;
using LateContract = ServiceContract<LateService, ServiceCardinality::zero_or_one>;

template <typename Expected, typename Contract>
concept ResolvesAs = requires(const ServiceRegistry& registry) {
    { registry.template resolve<Contract>() } -> std::same_as<Expected>;
};

template <typename Contract>
concept ResolvableContract =
    requires(const ServiceRegistry& registry) { registry.template resolve<Contract>(); };

struct NotAServiceContract final {};

static_assert(
    std::same_as<decltype(std::declval<const ServiceRegistry&>().resolve<ExactlyOneContract>()),
                 ExactlyOneService&>);
static_assert(
    std::same_as<decltype(std::declval<const ServiceRegistry&>().resolve<OptionalContract>()),
                 std::optional<std::reference_wrapper<OptionalService>>>);
static_assert(std::same_as<decltype(std::declval<const ServiceRegistry&>().resolve<ManyContract>()),
                           std::vector<std::reference_wrapper<ManyService>>>);
static_assert(ResolvesAs<ExactlyOneService&, ExactlyOneContract>);
static_assert(!ResolvesAs<OptionalService&, ExactlyOneContract>);
static_assert(ResolvableContract<ExactlyOneContract>);
static_assert(!ResolvableContract<NotAServiceContract>);

template <typename Interface> class ValueProvider : public Interface, public ServiceProvider {
  public:
    explicit ValueProvider(const int value) noexcept : value_(value) {}

    [[nodiscard]] int value() const noexcept override {
        return value_;
    }

    [[nodiscard]] RuntimeResult start(RuntimeContext& context) override {
        static_cast<void>(context);
        return RuntimeResult::success();
    }

    [[nodiscard]] RuntimeResult stop(RuntimeContext& context) override {
        static_cast<void>(context);
        return RuntimeResult::success();
    }

  private:
    int value_;
};

class AlternateExactlyOneProvider final : public ExactlyOneService, public ServiceProvider {
  public:
    [[nodiscard]] int value() const noexcept override {
        return 99;
    }

    [[nodiscard]] RuntimeResult start(RuntimeContext& context) override {
        static_cast<void>(context);
        return RuntimeResult::success();
    }

    [[nodiscard]] RuntimeResult stop(RuntimeContext& context) override {
        static_cast<void>(context);
        return RuntimeResult::success();
    }
};

class AlternateOptionalProvider final : public OptionalService, public ServiceProvider {
  public:
    [[nodiscard]] int value() const noexcept override {
        return 99;
    }

    [[nodiscard]] RuntimeResult start(RuntimeContext& context) override {
        static_cast<void>(context);
        return RuntimeResult::success();
    }

    [[nodiscard]] RuntimeResult stop(RuntimeContext& context) override {
        static_cast<void>(context);
        return RuntimeResult::success();
    }
};

class AlternateManyProvider final : public ManyService, public ServiceProvider {
  public:
    [[nodiscard]] int value() const noexcept override {
        return 20;
    }

    [[nodiscard]] RuntimeResult start(RuntimeContext& context) override {
        static_cast<void>(context);
        return RuntimeResult::success();
    }

    [[nodiscard]] RuntimeResult stop(RuntimeContext& context) override {
        static_cast<void>(context);
        return RuntimeResult::success();
    }
};

using ExactlyOneProvider = ValueProvider<ExactlyOneService>;
using OptionalProvider = ValueProvider<OptionalService>;
using ManyProvider = ValueProvider<ManyService>;

[[nodiscard]] RuntimeResult compose_and_freeze(ServiceRegistry& registry,
                                               DependencyInjector& injector) {
    auto result = injector.build_and_validate(registry);
    if (!result) {
        return result;
    }
    result = injector.instantiate(registry);
    if (!result) {
        return result;
    }
    result = registry.freeze();
    if (!result) {
        return result;
    }
    return injector.freeze();
}

TEST(ServiceRegistryTest, EnforcesExactlyOneCardinality) {
    ServiceRegistry empty;
    ASSERT_TRUE(empty.declare_contract<ExactlyOneContract>().ok());
    EXPECT_FALSE(empty.validate().ok());

    ServiceRegistry one;
    ASSERT_TRUE(one.declare_contract<ExactlyOneContract>().ok());
    ASSERT_TRUE((one.register_provider<ExactlyOneContract, ExactlyOneProvider>(
                        [] { return std::make_unique<ExactlyOneProvider>(1); })
                     .ok()));
    EXPECT_TRUE(one.validate().ok());

    ServiceRegistry two;
    ASSERT_TRUE(two.declare_contract<ExactlyOneContract>().ok());
    ASSERT_TRUE((two.register_provider<ExactlyOneContract, ExactlyOneProvider>(
                        [] { return std::make_unique<ExactlyOneProvider>(1); })
                     .ok()));
    ASSERT_TRUE((two.register_provider<ExactlyOneContract, AlternateExactlyOneProvider>(
                        [] { return std::make_unique<AlternateExactlyOneProvider>(); })
                     .ok()));
    EXPECT_FALSE(two.validate().ok());
}

TEST(ServiceRegistryTest, EnforcesZeroOrOneCardinality) {
    ServiceRegistry empty;
    ASSERT_TRUE(empty.declare_contract<OptionalContract>().ok());
    EXPECT_TRUE(empty.validate().ok());

    ServiceRegistry one;
    ASSERT_TRUE(one.declare_contract<OptionalContract>().ok());
    ASSERT_TRUE((one.register_provider<OptionalContract, OptionalProvider>(
                        [] { return std::make_unique<OptionalProvider>(1); })
                     .ok()));
    EXPECT_TRUE(one.validate().ok());

    ServiceRegistry two;
    ASSERT_TRUE(two.declare_contract<OptionalContract>().ok());
    ASSERT_TRUE((two.register_provider<OptionalContract, OptionalProvider>(
                        [] { return std::make_unique<OptionalProvider>(1); })
                     .ok()));
    ASSERT_TRUE((two.register_provider<OptionalContract, AlternateOptionalProvider>(
                        [] { return std::make_unique<AlternateOptionalProvider>(); })
                     .ok()));
    EXPECT_FALSE(two.validate().ok());
}

TEST(ServiceRegistryTest, EnforcesOneOrMoreCardinalityAndPermitsDistinctProviders) {
    ServiceRegistry empty;
    ASSERT_TRUE(empty.declare_contract<ManyContract>().ok());
    EXPECT_FALSE(empty.validate().ok());

    ServiceRegistry registry;
    ASSERT_TRUE(registry.declare_contract<ManyContract>().ok());
    ASSERT_TRUE((registry
                     .register_provider<ManyContract, ManyProvider>(
                         [] { return std::make_unique<ManyProvider>(10); })
                     .ok()));
    ASSERT_TRUE((registry
                     .register_provider<ManyContract, AlternateManyProvider>(
                         [] { return std::make_unique<AlternateManyProvider>(); })
                     .ok()));
    EXPECT_TRUE(registry.validate().ok());
}

TEST(ServiceRegistryTest, RejectsExactDuplicateTypedBindings) {
    ServiceRegistry registry;
    ASSERT_TRUE(registry.declare_contract<ManyContract>().ok());
    ASSERT_TRUE((registry
                     .register_provider<ManyContract, ManyProvider>(
                         [] { return std::make_unique<ManyProvider>(10); })
                     .ok()));

    const auto duplicate = registry.register_provider<ManyContract, ManyProvider>(
        [] { return std::make_unique<ManyProvider>(11); });

    EXPECT_FALSE(duplicate.ok());
    EXPECT_EQ(duplicate.code(), "CCA-RUNTIME-REGISTRY-DUPLICATE-BINDING");
    EXPECT_TRUE(registry.validate().ok());
}

TEST(ServiceRegistryTest, ResolvesOnlyAfterFreezeWithCardinalityDependentTypes) {
    ServiceRegistry registry;
    DependencyInjector injector;
    ASSERT_TRUE(registry.declare_contract<ExactlyOneContract>().ok());
    ASSERT_TRUE(registry.declare_contract<OptionalContract>().ok());
    ASSERT_TRUE(registry.declare_contract<ManyContract>().ok());
    ASSERT_TRUE((registry
                     .register_provider<ExactlyOneContract, ExactlyOneProvider>(
                         [] { return std::make_unique<ExactlyOneProvider>(7); })
                     .ok()));
    ASSERT_TRUE((registry
                     .register_provider<ManyContract, ManyProvider>(
                         [] { return std::make_unique<ManyProvider>(10); })
                     .ok()));
    ASSERT_TRUE((registry
                     .register_provider<ManyContract, AlternateManyProvider>(
                         [] { return std::make_unique<AlternateManyProvider>(); })
                     .ok()));

    EXPECT_THROW(static_cast<void>(registry.resolve<ExactlyOneContract>()), std::logic_error);
    ASSERT_TRUE(compose_and_freeze(registry, injector).ok());

    EXPECT_EQ(registry.resolve<ExactlyOneContract>().value(), 7);
    EXPECT_FALSE(registry.resolve<OptionalContract>().has_value());
    const auto many = registry.resolve<ManyContract>();
    ASSERT_EQ(many.size(), 2U);
    EXPECT_EQ(many[0].get().value(), 10);
    EXPECT_EQ(many[1].get().value(), 20);
}

TEST(ServiceRegistryTest, MakesTypedResolutionFailuresObservableWhenWired) {
    const auto sink = std::make_shared<cca::testing::RecordingLogSink>();
    cca::core::Logger logger{sink, cca::core::LogLevel::debug};
    Observability observability{RuntimeId{"registry-observability"}, logger};
    ServiceRegistry registry{observability};

    try {
        static_cast<void>(registry.resolve<ExactlyOneContract>());
        FAIL() << "resolution before Runtime Freeze must throw";
    } catch (const std::logic_error& error) {
        EXPECT_STREQ(error.what(),
                     "Service Contracts cannot be resolved publicly before Runtime Freeze");
    }

    EXPECT_EQ(observability.metric_value(RuntimeMetric::service_registry_failures), 1U);
    const auto diagnostics = observability.diagnostics();
    ASSERT_EQ(diagnostics.size(), 1U);
    EXPECT_EQ(diagnostics.front().runtime_id, RuntimeId{"registry-observability"});
    EXPECT_EQ(diagnostics.front().state, RuntimeState::constructed);
    EXPECT_EQ(diagnostics.front().severity, DiagnosticSeverity::error);
    EXPECT_EQ(diagnostics.front().category, DiagnosticCategory::service_registry);
    EXPECT_EQ(diagnostics.front().code, "CCA-RUNTIME-REGISTRY-RESOLUTION-BEFORE-FREEZE");

    const auto logs = sink->snapshot();
    ASSERT_EQ(logs.size(), 1U);
    EXPECT_NE(logs.front().message.find("[registry-observability]"), std::string::npos);
}

TEST(ServiceRegistryTest, RejectsMutationAfterFreezeWithoutChangingComposition) {
    ServiceRegistry registry;
    DependencyInjector injector;
    ASSERT_TRUE(registry.declare_contract<OptionalContract>().ok());
    ASSERT_TRUE(compose_and_freeze(registry, injector).ok());

    const auto declaration = registry.declare_contract<LateContract>();
    const auto registration = registry.register_provider<OptionalContract, OptionalProvider>(
        [] { return std::make_unique<OptionalProvider>(1); });

    EXPECT_FALSE(declaration.ok());
    EXPECT_FALSE(registration.ok());
    EXPECT_EQ(declaration.code(), "CCA-RUNTIME-REGISTRY-FROZEN");
    EXPECT_EQ(registration.code(), "CCA-RUNTIME-REGISTRY-FROZEN");
    EXPECT_FALSE(registry.resolve<OptionalContract>().has_value());
}

TEST(ServiceRegistryTest, KeepsRuntimeInstanceRegistriesIsolated) {
    ServiceRegistry first;
    ServiceRegistry second;
    DependencyInjector first_injector;
    DependencyInjector second_injector;

    ASSERT_TRUE(first.declare_contract<ExactlyOneContract>().ok());
    ASSERT_TRUE(second.declare_contract<ExactlyOneContract>().ok());
    ASSERT_TRUE((first
                     .register_provider<ExactlyOneContract, ExactlyOneProvider>(
                         [] { return std::make_unique<ExactlyOneProvider>(1); })
                     .ok()));
    ASSERT_TRUE((second
                     .register_provider<ExactlyOneContract, ExactlyOneProvider>(
                         [] { return std::make_unique<ExactlyOneProvider>(2); })
                     .ok()));

    ASSERT_TRUE(compose_and_freeze(first, first_injector).ok());
    ASSERT_TRUE(compose_and_freeze(second, second_injector).ok());

    EXPECT_EQ(first.resolve<ExactlyOneContract>().value(), 1);
    EXPECT_EQ(second.resolve<ExactlyOneContract>().value(), 2);
    EXPECT_NE(&first.resolve<ExactlyOneContract>(), &second.resolve<ExactlyOneContract>());
}

} // namespace
