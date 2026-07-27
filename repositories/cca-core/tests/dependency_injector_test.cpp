#include <cca/runtime/dependency_injector.hpp>
#include <cca/runtime/provider.hpp>
#include <cca/runtime/service_registry.hpp>

#include <functional>
#include <gtest/gtest.h>
#include <memory>
#include <optional>
#include <vector>

namespace {

using cca::runtime::DependencyInjector;
using cca::runtime::ProviderDependencyEdge;
using cca::runtime::ProviderId;
using cca::runtime::RuntimeContext;
using cca::runtime::RuntimeResult;
using cca::runtime::ServiceCardinality;
using cca::runtime::ServiceContract;
using cca::runtime::ServiceProvider;
using cca::runtime::ServiceRegistry;

class SuccessfulProvider : public ServiceProvider {
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

struct RootService {
    virtual ~RootService() = default;
    [[nodiscard]] virtual int value() const noexcept = 0;
};

struct LeftService {
    virtual ~LeftService() = default;
    [[nodiscard]] virtual const RootService& root() const noexcept = 0;
};

struct RightService {
    virtual ~RightService() = default;
    [[nodiscard]] virtual const RootService& root() const noexcept = 0;
};

struct LeafService {
    virtual ~LeafService() = default;
    [[nodiscard]] virtual int total() const noexcept = 0;
};

using RootContract = ServiceContract<RootService, ServiceCardinality::exactly_one>;
using LeftContract = ServiceContract<LeftService, ServiceCardinality::exactly_one>;
using RightContract = ServiceContract<RightService, ServiceCardinality::exactly_one>;
using LeafContract = ServiceContract<LeafService, ServiceCardinality::exactly_one>;

class RootProvider final : public RootService, public SuccessfulProvider {
  public:
    explicit RootProvider(const int value = 4) noexcept : value_(value) {}

    [[nodiscard]] int value() const noexcept override {
        return value_;
    }

  private:
    int value_;
};

class LeftProvider final : public LeftService, public SuccessfulProvider {
  public:
    explicit LeftProvider(RootService& root) noexcept : root_(root) {}

    [[nodiscard]] const RootService& root() const noexcept override {
        return root_.get();
    }

  private:
    std::reference_wrapper<RootService> root_;
};

class RightProvider final : public RightService, public SuccessfulProvider {
  public:
    explicit RightProvider(RootService& root) noexcept : root_(root) {}

    [[nodiscard]] const RootService& root() const noexcept override {
        return root_.get();
    }

  private:
    std::reference_wrapper<RootService> root_;
};

class LeafProvider final : public LeafService, public SuccessfulProvider {
  public:
    LeafProvider(LeftService& left, RightService& right) noexcept : left_(left), right_(right) {}

    [[nodiscard]] int total() const noexcept override {
        return left_.get().root().value() + right_.get().root().value();
    }

  private:
    std::reference_wrapper<LeftService> left_;
    std::reference_wrapper<RightService> right_;
};

struct ChainMiddleService {
    virtual ~ChainMiddleService() = default;
};

struct ChainTailService {
    virtual ~ChainTailService() = default;
};

using ChainMiddleContract = ServiceContract<ChainMiddleService, ServiceCardinality::exactly_one>;
using ChainTailContract = ServiceContract<ChainTailService, ServiceCardinality::exactly_one>;

class ChainMiddleProvider final : public ChainMiddleService, public SuccessfulProvider {
  public:
    explicit ChainMiddleProvider(RootService& root) noexcept {
        static_cast<void>(root);
    }
};

class ChainTailProvider final : public ChainTailService, public SuccessfulProvider {
  public:
    explicit ChainTailProvider(ChainMiddleService& middle) noexcept {
        static_cast<void>(middle);
    }
};

struct RevisionOptionalService {
    virtual ~RevisionOptionalService() = default;
};

using RevisionOptionalContract =
    ServiceContract<RevisionOptionalService, ServiceCardinality::zero_or_one>;

class RevisionOptionalProvider final : public RevisionOptionalService, public SuccessfulProvider {};

struct OptionalConsumerService {
    virtual ~OptionalConsumerService() = default;
    [[nodiscard]] virtual bool dependency_present() const noexcept = 0;
};

using OptionalConsumerContract =
    ServiceContract<OptionalConsumerService, ServiceCardinality::exactly_one>;

class OptionalConsumerProvider final : public OptionalConsumerService, public SuccessfulProvider {
  public:
    explicit OptionalConsumerProvider(
        const std::optional<std::reference_wrapper<RevisionOptionalService>>& dependency) noexcept
        : dependency_present_(dependency.has_value()) {}

    [[nodiscard]] bool dependency_present() const noexcept override {
        return dependency_present_;
    }

  private:
    bool dependency_present_;
};

void declare_diamond_contracts(ServiceRegistry& registry) {
    ASSERT_TRUE(registry.declare_contract<RootContract>().ok());
    ASSERT_TRUE(registry.declare_contract<LeftContract>().ok());
    ASSERT_TRUE(registry.declare_contract<RightContract>().ok());
    ASSERT_TRUE(registry.declare_contract<LeafContract>().ok());
}

void register_diamond_providers(ServiceRegistry& registry) {
    ASSERT_TRUE((registry
                     .register_provider<RootContract, RootProvider>(
                         [] { return std::make_unique<RootProvider>(); })
                     .ok()));
    ASSERT_TRUE((registry
                     .register_provider<LeftContract, LeftProvider, RootContract>(
                         [](RootService& root) { return std::make_unique<LeftProvider>(root); })
                     .ok()));
    ASSERT_TRUE((registry
                     .register_provider<RightContract, RightProvider, RootContract>(
                         [](RootService& root) { return std::make_unique<RightProvider>(root); })
                     .ok()));
    ASSERT_TRUE((registry
                     .register_provider<LeafContract, LeafProvider, LeftContract, RightContract>(
                         [](LeftService& left, RightService& right) {
                             return std::make_unique<LeafProvider>(left, right);
                         })
                     .ok()));
}

TEST(DependencyInjectorTest, RejectsMissingRequiredDependency) {
    ServiceRegistry registry;
    DependencyInjector injector;
    ASSERT_TRUE(registry.declare_contract<RootContract>().ok());
    ASSERT_TRUE(registry.declare_contract<LeftContract>().ok());
    ASSERT_TRUE((registry
                     .register_provider<LeftContract, LeftProvider, RootContract>(
                         [](RootService& root) { return std::make_unique<LeftProvider>(root); })
                     .ok()));

    const auto result = injector.build_and_validate(registry);

    EXPECT_FALSE(result.ok());
    EXPECT_EQ(result.code(), "CCA-RUNTIME-INJECTOR-MISSING-DEPENDENCY");
    EXPECT_FALSE(injector.valid());
}

struct UndeclaredService {
    virtual ~UndeclaredService() = default;
};

struct UndeclaredConsumerService {
    virtual ~UndeclaredConsumerService() = default;
};

using UndeclaredContract = ServiceContract<UndeclaredService, ServiceCardinality::exactly_one>;
using UndeclaredConsumerContract =
    ServiceContract<UndeclaredConsumerService, ServiceCardinality::exactly_one>;

class UndeclaredConsumerProvider final : public UndeclaredConsumerService,
                                         public SuccessfulProvider {
  public:
    explicit UndeclaredConsumerProvider(UndeclaredService& service) noexcept {
        static_cast<void>(service);
    }
};

TEST(DependencyInjectorTest, RejectsUndeclaredDependency) {
    ServiceRegistry registry;
    DependencyInjector injector;
    ASSERT_TRUE(registry.declare_contract<UndeclaredConsumerContract>().ok());
    ASSERT_TRUE((registry
                     .register_provider<UndeclaredConsumerContract,
                                        UndeclaredConsumerProvider,
                                        UndeclaredContract>([](UndeclaredService& service) {
                         return std::make_unique<UndeclaredConsumerProvider>(service);
                     })
                     .ok()));

    const auto result = injector.build_and_validate(registry);

    EXPECT_FALSE(result.ok());
    EXPECT_EQ(result.code(), "CCA-RUNTIME-INJECTOR-UNDECLARED-DEPENDENCY");
}

TEST(DependencyInjectorTest, RejectsDuplicateDependencyDeclarations) {
    ServiceRegistry registry;
    DependencyInjector injector;
    ASSERT_TRUE(registry.declare_contract<RootContract>().ok());
    ASSERT_TRUE(registry.declare_contract<LeftContract>().ok());
    ASSERT_TRUE((registry
                     .register_provider<RootContract, RootProvider>(
                         [] { return std::make_unique<RootProvider>(); })
                     .ok()));
    ASSERT_TRUE((registry
                     .register_provider<LeftContract, LeftProvider, RootContract, RootContract>(
                         [](RootService& first, RootService& second) {
                             static_cast<void>(second);
                             return std::make_unique<LeftProvider>(first);
                         })
                     .ok()));

    const auto result = injector.build_and_validate(registry);

    EXPECT_FALSE(result.ok());
    EXPECT_EQ(result.code(), "CCA-RUNTIME-INJECTOR-DUPLICATE-DEPENDENCY");
}

TEST(DependencyInjectorTest, DetectsSelfCycle) {
    ServiceRegistry registry;
    DependencyInjector injector;
    ASSERT_TRUE(registry.declare_contract<RootContract>().ok());
    ASSERT_TRUE(
        (registry
             .register_provider<RootContract, RootProvider, RootContract>([](RootService& root) {
                 static_cast<void>(root);
                 return std::make_unique<RootProvider>();
             })
             .ok()));

    const auto result = injector.build_and_validate(registry);

    EXPECT_FALSE(result.ok());
    EXPECT_EQ(result.code(), "CCA-RUNTIME-INJECTOR-CYCLE");
}

struct CycleAService {
    virtual ~CycleAService() = default;
};

struct CycleBService {
    virtual ~CycleBService() = default;
};

using CycleAContract = ServiceContract<CycleAService, ServiceCardinality::exactly_one>;
using CycleBContract = ServiceContract<CycleBService, ServiceCardinality::exactly_one>;

class CycleAProvider final : public CycleAService, public SuccessfulProvider {
  public:
    explicit CycleAProvider(CycleBService& dependency) noexcept {
        static_cast<void>(dependency);
    }
};

class CycleBProvider final : public CycleBService, public SuccessfulProvider {
  public:
    explicit CycleBProvider(CycleAService& dependency) noexcept {
        static_cast<void>(dependency);
    }
};

TEST(DependencyInjectorTest, DetectsMultiNodeCycle) {
    ServiceRegistry registry;
    DependencyInjector injector;
    ASSERT_TRUE(registry.declare_contract<CycleAContract>().ok());
    ASSERT_TRUE(registry.declare_contract<CycleBContract>().ok());
    ASSERT_TRUE((registry
                     .register_provider<CycleAContract, CycleAProvider, CycleBContract>(
                         [](CycleBService& dependency) {
                             return std::make_unique<CycleAProvider>(dependency);
                         })
                     .ok()));
    ASSERT_TRUE((registry
                     .register_provider<CycleBContract, CycleBProvider, CycleAContract>(
                         [](CycleAService& dependency) {
                             return std::make_unique<CycleBProvider>(dependency);
                         })
                     .ok()));

    const auto result = injector.build_and_validate(registry);

    EXPECT_FALSE(result.ok());
    EXPECT_EQ(result.code(), "CCA-RUNTIME-INJECTOR-CYCLE");
}

TEST(DependencyInjectorTest, DerivesDeterministicDiamondLevelsAndEdges) {
    ServiceRegistry registry;
    DependencyInjector injector;
    declare_diamond_contracts(registry);
    register_diamond_providers(registry);

    ASSERT_TRUE(injector.build_and_validate(registry).ok());

    const std::vector<std::vector<ProviderId>> expected_levels{
        {ProviderId{0}},
        {ProviderId{1}, ProviderId{2}},
        {ProviderId{3}},
    };
    const std::vector<ProviderDependencyEdge> expected_edges{
        {.dependent = ProviderId{1}, .dependency = ProviderId{0}},
        {.dependent = ProviderId{2}, .dependency = ProviderId{0}},
        {.dependent = ProviderId{3}, .dependency = ProviderId{1}},
        {.dependent = ProviderId{3}, .dependency = ProviderId{2}},
    };
    EXPECT_EQ(injector.levels(), expected_levels);
    EXPECT_EQ(injector.edges(), expected_edges);
}

TEST(DependencyInjectorTest, EquivalentDiamondCompositionsProduceEquivalentDependencyOrder) {
    ServiceRegistry first_registry;
    ServiceRegistry second_registry;
    DependencyInjector first_injector;
    DependencyInjector second_injector;
    declare_diamond_contracts(first_registry);
    register_diamond_providers(first_registry);
    declare_diamond_contracts(second_registry);
    register_diamond_providers(second_registry);

    ASSERT_TRUE(first_injector.build_and_validate(first_registry).ok());
    ASSERT_TRUE(second_injector.build_and_validate(second_registry).ok());

    EXPECT_EQ(first_injector.levels(), second_injector.levels());
    EXPECT_EQ(first_injector.edges(), second_injector.edges());
}

TEST(DependencyInjectorTest, DerivesDependencyFirstLevelsForReverseRegisteredChain) {
    ServiceRegistry registry;
    DependencyInjector injector;
    ASSERT_TRUE(registry.declare_contract<RootContract>().ok());
    ASSERT_TRUE(registry.declare_contract<ChainMiddleContract>().ok());
    ASSERT_TRUE(registry.declare_contract<ChainTailContract>().ok());
    ASSERT_TRUE((registry
                     .register_provider<ChainTailContract, ChainTailProvider, ChainMiddleContract>(
                         [](ChainMiddleService& middle) {
                             return std::make_unique<ChainTailProvider>(middle);
                         })
                     .ok()));
    ASSERT_TRUE(
        (registry
             .register_provider<ChainMiddleContract, ChainMiddleProvider, RootContract>(
                 [](RootService& root) { return std::make_unique<ChainMiddleProvider>(root); })
             .ok()));
    ASSERT_TRUE((registry
                     .register_provider<RootContract, RootProvider>(
                         [] { return std::make_unique<RootProvider>(); })
                     .ok()));

    ASSERT_TRUE(injector.build_and_validate(registry).ok());

    const std::vector<std::vector<ProviderId>> expected_levels{
        {ProviderId{2}},
        {ProviderId{1}},
        {ProviderId{0}},
    };
    EXPECT_EQ(injector.levels(), expected_levels);
}

TEST(DependencyInjectorTest, InjectsTypedDependenciesInLevelOrder) {
    ServiceRegistry registry;
    DependencyInjector injector;
    declare_diamond_contracts(registry);
    register_diamond_providers(registry);
    ASSERT_TRUE(injector.build_and_validate(registry).ok());

    ASSERT_TRUE(injector.instantiate(registry).ok());
    ASSERT_TRUE(registry.freeze().ok());
    ASSERT_TRUE(injector.freeze().ok());

    EXPECT_EQ(registry.resolve<LeafContract>().total(), 8);
    EXPECT_EQ(&registry.resolve<LeftContract>().root(), &registry.resolve<RootContract>());
    EXPECT_EQ(&registry.resolve<RightContract>().root(), &registry.resolve<RootContract>());
}

TEST(DependencyInjectorTest, RejectsInstantiationWithDifferentRegistryInstance) {
    ServiceRegistry validated_registry;
    ServiceRegistry other_registry;
    DependencyInjector injector;
    declare_diamond_contracts(validated_registry);
    register_diamond_providers(validated_registry);
    declare_diamond_contracts(other_registry);
    register_diamond_providers(other_registry);
    ASSERT_TRUE(injector.build_and_validate(validated_registry).ok());

    const auto mismatch = injector.instantiate(other_registry);

    EXPECT_FALSE(mismatch.ok());
    EXPECT_EQ(mismatch.code(), "CCA-RUNTIME-INJECTOR-REGISTRY-MISMATCH");
    EXPECT_FALSE(injector.instantiated());
    EXPECT_TRUE(injector.instantiate(validated_registry).ok());
}

TEST(DependencyInjectorTest, RejectsGraphBuildFromFrozenRegistry) {
    ServiceRegistry registry;
    DependencyInjector composing_injector;
    DependencyInjector late_injector;
    ASSERT_TRUE(registry.declare_contract<RootContract>().ok());
    ASSERT_TRUE((registry
                     .register_provider<RootContract, RootProvider>(
                         [] { return std::make_unique<RootProvider>(); })
                     .ok()));
    ASSERT_TRUE(composing_injector.build_and_validate(registry).ok());
    ASSERT_TRUE(composing_injector.instantiate(registry).ok());
    ASSERT_TRUE(registry.freeze().ok());
    ASSERT_TRUE(composing_injector.freeze().ok());

    const auto result = late_injector.build_and_validate(registry);

    EXPECT_FALSE(result.ok());
    EXPECT_EQ(result.code(), "CCA-RUNTIME-REGISTRY-FROZEN");
    EXPECT_FALSE(late_injector.valid());
    EXPECT_TRUE(late_injector.levels().empty());
    EXPECT_TRUE(late_injector.edges().empty());
}

TEST(DependencyInjectorTest, RejectsStaleGraphAfterRegistryCompositionMutation) {
    ServiceRegistry registry;
    DependencyInjector injector;
    ASSERT_TRUE(registry.declare_contract<RootContract>().ok());
    ASSERT_TRUE(registry.declare_contract<RevisionOptionalContract>().ok());
    ASSERT_TRUE((registry
                     .register_provider<RootContract, RootProvider>(
                         [] { return std::make_unique<RootProvider>(); })
                     .ok()));
    ASSERT_TRUE(injector.build_and_validate(registry).ok());
    ASSERT_TRUE((registry
                     .register_provider<RevisionOptionalContract, RevisionOptionalProvider>(
                         [] { return std::make_unique<RevisionOptionalProvider>(); })
                     .ok()));

    const auto stale = injector.instantiate(registry);

    EXPECT_FALSE(stale.ok());
    EXPECT_EQ(stale.code(), "CCA-RUNTIME-INJECTOR-STALE-GRAPH");
    EXPECT_FALSE(injector.instantiated());
    ASSERT_TRUE(injector.build_and_validate(registry).ok());
    EXPECT_TRUE(injector.instantiate(registry).ok());
}

TEST(DependencyInjectorTest, InjectsAbsentAndPresentZeroOrOneDependencies) {
    {
        ServiceRegistry registry;
        DependencyInjector injector;
        ASSERT_TRUE(registry.declare_contract<RevisionOptionalContract>().ok());
        ASSERT_TRUE(registry.declare_contract<OptionalConsumerContract>().ok());
        ASSERT_TRUE(
            (registry
                 .register_provider<OptionalConsumerContract,
                                    OptionalConsumerProvider,
                                    RevisionOptionalContract>(
                     [](std::optional<std::reference_wrapper<RevisionOptionalService>> dependency) {
                         return std::make_unique<OptionalConsumerProvider>(dependency);
                     })
                 .ok()));
        ASSERT_TRUE(injector.build_and_validate(registry).ok());
        ASSERT_TRUE(injector.instantiate(registry).ok());
        ASSERT_TRUE(registry.freeze().ok());
        ASSERT_TRUE(injector.freeze().ok());

        EXPECT_FALSE(registry.resolve<OptionalConsumerContract>().dependency_present());
    }

    {
        ServiceRegistry registry;
        DependencyInjector injector;
        ASSERT_TRUE(registry.declare_contract<RevisionOptionalContract>().ok());
        ASSERT_TRUE(registry.declare_contract<OptionalConsumerContract>().ok());
        ASSERT_TRUE((registry
                         .register_provider<RevisionOptionalContract, RevisionOptionalProvider>(
                             [] { return std::make_unique<RevisionOptionalProvider>(); })
                         .ok()));
        ASSERT_TRUE(
            (registry
                 .register_provider<OptionalConsumerContract,
                                    OptionalConsumerProvider,
                                    RevisionOptionalContract>(
                     [](std::optional<std::reference_wrapper<RevisionOptionalService>> dependency) {
                         return std::make_unique<OptionalConsumerProvider>(dependency);
                     })
                 .ok()));
        ASSERT_TRUE(injector.build_and_validate(registry).ok());
        ASSERT_TRUE(injector.instantiate(registry).ok());
        ASSERT_TRUE(registry.freeze().ok());
        ASSERT_TRUE(injector.freeze().ok());

        EXPECT_TRUE(registry.resolve<OptionalConsumerContract>().dependency_present());
    }
}

TEST(DependencyInjectorTest, NullFactoryFailsInstantiationAndPreventsRetry) {
    ServiceRegistry registry;
    DependencyInjector injector;
    ASSERT_TRUE(registry.declare_contract<RootContract>().ok());
    ASSERT_TRUE((registry
                     .register_provider<RootContract, RootProvider>(
                         []() -> std::unique_ptr<RootProvider> { return nullptr; })
                     .ok()));
    ASSERT_TRUE(injector.build_and_validate(registry).ok());

    const auto first = injector.instantiate(registry);
    const auto second = injector.instantiate(registry);

    EXPECT_FALSE(first.ok());
    EXPECT_EQ(first.code(), "CCA-RUNTIME-REGISTRY-NULL-PROVIDER");
    EXPECT_FALSE(second.ok());
    EXPECT_EQ(second.code(), "CCA-RUNTIME-INJECTOR-INSTANTIATION-ATTEMPTED");
    EXPECT_FALSE(injector.instantiated());
}

struct ManyService {
    virtual ~ManyService() = default;
    [[nodiscard]] virtual int value() const noexcept = 0;
};

struct AggregateService {
    virtual ~AggregateService() = default;
    [[nodiscard]] virtual int total() const noexcept = 0;
};

using ManyContract = ServiceContract<ManyService, ServiceCardinality::one_or_more>;
using AggregateContract = ServiceContract<AggregateService, ServiceCardinality::exactly_one>;

class FirstManyProvider final : public ManyService, public SuccessfulProvider {
  public:
    [[nodiscard]] int value() const noexcept override {
        return 2;
    }
};

class SecondManyProvider final : public ManyService, public SuccessfulProvider {
  public:
    [[nodiscard]] int value() const noexcept override {
        return 3;
    }
};

class AggregateProvider final : public AggregateService, public SuccessfulProvider {
  public:
    explicit AggregateProvider(
        const std::vector<std::reference_wrapper<ManyService>>& services) noexcept {
        for (const auto service : services) {
            total_ += service.get().value();
        }
    }

    [[nodiscard]] int total() const noexcept override {
        return total_;
    }

  private:
    int total_{0};
};

TEST(DependencyInjectorTest, BindsOneOrMoreDependencyToEveryMatchingProvider) {
    ServiceRegistry registry;
    DependencyInjector injector;
    ASSERT_TRUE(registry.declare_contract<ManyContract>().ok());
    ASSERT_TRUE(registry.declare_contract<AggregateContract>().ok());
    ASSERT_TRUE((registry
                     .register_provider<ManyContract, FirstManyProvider>(
                         [] { return std::make_unique<FirstManyProvider>(); })
                     .ok()));
    ASSERT_TRUE((registry
                     .register_provider<ManyContract, SecondManyProvider>(
                         [] { return std::make_unique<SecondManyProvider>(); })
                     .ok()));
    ASSERT_TRUE((registry
                     .register_provider<AggregateContract, AggregateProvider, ManyContract>(
                         [](std::vector<std::reference_wrapper<ManyService>> services) {
                             return std::make_unique<AggregateProvider>(services);
                         })
                     .ok()));

    ASSERT_TRUE(injector.build_and_validate(registry).ok());
    const std::vector<ProviderDependencyEdge> expected_edges{
        {.dependent = ProviderId{2}, .dependency = ProviderId{0}},
        {.dependent = ProviderId{2}, .dependency = ProviderId{1}},
    };
    EXPECT_EQ(injector.edges(), expected_edges);
    ASSERT_TRUE(injector.instantiate(registry).ok());
    ASSERT_TRUE(registry.freeze().ok());
    ASSERT_TRUE(injector.freeze().ok());
    EXPECT_EQ(registry.resolve<AggregateContract>().total(), 5);
}

TEST(DependencyInjectorTest, RejectsGraphMutationAfterFreezeAndPreservesSnapshots) {
    ServiceRegistry registry;
    DependencyInjector injector;
    declare_diamond_contracts(registry);
    register_diamond_providers(registry);
    ASSERT_TRUE(injector.build_and_validate(registry).ok());
    ASSERT_TRUE(injector.instantiate(registry).ok());
    ASSERT_TRUE(registry.freeze().ok());
    ASSERT_TRUE(injector.freeze().ok());
    const auto levels = injector.levels();
    const auto edges = injector.edges();

    const auto rebuild = injector.build_and_validate(registry);
    const auto second_instantiation = injector.instantiate(registry);

    EXPECT_FALSE(rebuild.ok());
    EXPECT_FALSE(second_instantiation.ok());
    EXPECT_EQ(rebuild.code(), "CCA-RUNTIME-INJECTOR-FROZEN");
    EXPECT_EQ(second_instantiation.code(), "CCA-RUNTIME-INJECTOR-FROZEN");
    EXPECT_EQ(injector.levels(), levels);
    EXPECT_EQ(injector.edges(), edges);
}

} // namespace
