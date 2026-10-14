#include <gtest/gtest.h>

#include "cca/compiler/configuration.hpp"

namespace cca::compiler {
namespace {

TEST(ConfigurationTest, DefaultsAreValidAndDeterministic) {
    const auto configuration = CompilerConfiguration::defaults();

    EXPECT_TRUE(configuration.validate().ok());
    EXPECT_EQ(configuration.output_directory(), std::filesystem::path{"cca-out"});
    EXPECT_EQ(configuration.minimum_log_level(), LogLevel::info);
    EXPECT_TRUE(configuration.diagnostics_enabled());
}

TEST(ConfigurationTest, EmptyOutputDirectoryIsInvalid) {
    const CompilerConfiguration configuration{"", LogLevel::info, true};
    EXPECT_EQ(configuration.validate().code(), StatusCode::invalid_argument);
}

} // namespace
} // namespace cca::compiler
