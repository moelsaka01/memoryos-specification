#include <array>
#include <gtest/gtest.h>
#include <sstream>
#include <string>
#include <string_view>

#include "cca/compiler/cli.hpp"
#include "cca/compiler/version.hpp"

namespace cca::compiler {
namespace {

TEST(CliTest, HelpAndVersionSucceed) {
    std::ostringstream output;
    std::ostringstream error;
    const Cli cli{output, error};

    const std::array<std::string_view, 1> help{"help"};
    EXPECT_EQ(cli.run(help), static_cast<int>(CliExitCode::success));
    EXPECT_NE(output.str().find("Usage: cca"), std::string::npos);

    output.str(std::string{});
    const std::array<std::string_view, 1> version{"version"};
    EXPECT_EQ(cli.run(version), static_cast<int>(CliExitCode::success));
    EXPECT_EQ(output.str(), std::string{"cca "} + std::string{compiler_version} + '\n');
}

TEST(CliTest, PlaceholderCommandsUseUnavailableExitCode) {
    std::ostringstream output;
    std::ostringstream error;
    const Cli cli{output, error};
    const std::array<std::string_view, 2> arguments{"compile", "model.cca"};

    EXPECT_EQ(cli.run(arguments), static_cast<int>(CliExitCode::unavailable));
    EXPECT_NE(error.str().find("not implemented"), std::string::npos);
}

TEST(CliTest, MissingAndUnknownArgumentsUseUsageExitCode) {
    std::ostringstream output;
    std::ostringstream error;
    const Cli cli{output, error};

    const std::array<std::string_view, 1> incomplete{"validate"};
    EXPECT_EQ(cli.run(incomplete), static_cast<int>(CliExitCode::usage_error));

    const std::array<std::string_view, 1> unknown{"unknown"};
    EXPECT_EQ(cli.run(unknown), static_cast<int>(CliExitCode::usage_error));
}

TEST(CliTest, DoctorReportsFoundationReadiness) {
    std::ostringstream output;
    std::ostringstream error;
    const Cli cli{output, error};
    const std::array<std::string_view, 1> arguments{"doctor"};

    EXPECT_EQ(cli.run(arguments), static_cast<int>(CliExitCode::success));
    EXPECT_NE(output.str().find("foundation-ready"), std::string::npos);
}

} // namespace
} // namespace cca::compiler
