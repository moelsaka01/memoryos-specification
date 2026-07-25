#include <cca/core/configuration.hpp>

#include <gtest/gtest.h>
#include <stdexcept>
#include <string>

namespace {

using cca::core::ConfigurationBuilder;
using cca::core::ConfigurationKey;

TEST(ConfigurationKeyTest, RejectsEmptyKeys) {
    EXPECT_THROW(static_cast<void>(ConfigurationKey{""}), std::invalid_argument);
}

TEST(ConfigurationTest, BuildsAnImmutableSnapshot) {
    ConfigurationBuilder builder;
    builder.set(ConfigurationKey{"compiler.mode"}, "validate");

    const auto configuration = builder.build();
    builder.set(ConfigurationKey{"compiler.mode"}, "generate");

    ASSERT_TRUE(configuration.find(ConfigurationKey{"compiler.mode"}).has_value());
    EXPECT_EQ(configuration.find(ConfigurationKey{"compiler.mode"})->get(), "validate");
    EXPECT_EQ(configuration.size(), 1U);
}

TEST(ConfigurationTest, ReplacesDuplicateKeysDeterministically) {
    ConfigurationBuilder builder;
    builder.set(ConfigurationKey{"diagnostics.format"}, "text");
    builder.set(ConfigurationKey{"diagnostics.format"}, "json");

    const auto configuration = std::move(builder).build();

    EXPECT_EQ(configuration.get_or(ConfigurationKey{"diagnostics.format"}, "none"), "json");
    EXPECT_EQ(configuration.get_or(ConfigurationKey{"missing"}, "fallback"), "fallback");
}

} // namespace
