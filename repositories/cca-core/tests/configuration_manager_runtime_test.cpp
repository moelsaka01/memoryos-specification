#include <cca/core/configuration.hpp>
#include <cca/runtime/configuration_manager.hpp>

#include <gtest/gtest.h>
#include <utility>

namespace {

using cca::core::ConfigurationBuilder;
using cca::core::ConfigurationKey;
using cca::runtime::ConfigurationManager;

TEST(ConfigurationManagerRuntimeTest, RequiresOneConfigurationSnapshotBeforeFreeze) {
    ConfigurationManager manager;

    EXPECT_FALSE(manager.configured());
    EXPECT_EQ(manager.snapshot(), nullptr);

    const auto validation = manager.validate();
    EXPECT_FALSE(validation.ok());
    EXPECT_EQ(validation.code(), "configuration.missing");

    const auto freeze = manager.freeze();
    EXPECT_FALSE(freeze.ok());
    EXPECT_FALSE(manager.frozen());
}

TEST(ConfigurationManagerRuntimeTest, OwnsAnImmutableSnapshot) {
    ConfigurationBuilder builder;
    builder.set(ConfigurationKey{"runtime.mode"}, "headless");
    auto input = builder.build();

    ConfigurationManager manager;
    ASSERT_TRUE(manager.configure(input).ok());
    builder.set(ConfigurationKey{"runtime.mode"}, "changed-outside-manager");

    const auto snapshot = manager.snapshot();
    ASSERT_NE(snapshot, nullptr);
    EXPECT_EQ(snapshot->get_or(ConfigurationKey{"runtime.mode"}, "missing"), "headless");
    EXPECT_TRUE(manager.validate().ok());
}

TEST(ConfigurationManagerRuntimeTest, PermitsReplacementBeforeFreeze) {
    ConfigurationManager manager;
    ConfigurationBuilder first;
    first.set(ConfigurationKey{"runtime.policy"}, "first");
    ConfigurationBuilder second;
    second.set(ConfigurationKey{"runtime.policy"}, "second");

    ASSERT_TRUE(manager.configure(std::move(first).build()).ok());
    ASSERT_TRUE(manager.configure(std::move(second).build()).ok());

    const auto snapshot = manager.snapshot();
    ASSERT_NE(snapshot, nullptr);
    EXPECT_EQ(snapshot->get_or(ConfigurationKey{"runtime.policy"}, "missing"), "second");
}

TEST(ConfigurationManagerRuntimeTest, RejectsReplacementAfterFreezeWithoutChangingSnapshot) {
    ConfigurationManager manager;
    ConfigurationBuilder accepted;
    accepted.set(ConfigurationKey{"runtime.policy"}, "accepted");
    ASSERT_TRUE(manager.configure(std::move(accepted).build()).ok());
    ASSERT_TRUE(manager.freeze().ok());
    ASSERT_TRUE(manager.frozen());

    const auto before = manager.snapshot();
    ConfigurationBuilder rejected;
    rejected.set(ConfigurationKey{"runtime.policy"}, "rejected");
    const auto result = manager.configure(std::move(rejected).build());

    EXPECT_FALSE(result.ok());
    EXPECT_EQ(result.code(), "configuration.frozen");
    EXPECT_EQ(manager.snapshot(), before);
    EXPECT_EQ(manager.snapshot()->get_or(ConfigurationKey{"runtime.policy"}, "missing"),
              "accepted");
}

} // namespace
