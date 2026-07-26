#include <array>
#include <gtest/gtest.h>
#include <memory>
#include <sstream>
#include <string>
#include <string_view>
#include <utility>

#include "cca/compiler/cli.hpp"
#include "cca/compiler/version.hpp"

namespace cca::compiler {
namespace {

class RecordingCommandService final : public ICommandService {
  public:
    explicit RecordingCommandService(CommandResult result = {CliExitCode::success,
                                                             "{\"status\":\"ok\"}"})
        : result_{std::move(result)} {}

    [[nodiscard]] CommandResult execute(const CommandRequest& request) const override {
        request_ = request;
        return result_;
    }

    [[nodiscard]] const CommandRequest& request() const noexcept {
        return request_;
    }

  private:
    CommandResult result_;
    mutable CommandRequest request_;
};

TEST(CliTest, HelpAndVersionSucceed) {
    std::ostringstream output;
    std::ostringstream error;
    const Cli cli{output, error};

    const std::array<std::string_view, 1> help{"help"};
    EXPECT_EQ(cli.run(help), static_cast<int>(CliExitCode::success));
    EXPECT_NE(output.str().find("Usage: cca"), std::string::npos);
    EXPECT_NE(output.str().find("analyze"), std::string::npos);
    EXPECT_NE(output.str().find("report"), std::string::npos);

    output.str(std::string{});
    const std::array<std::string_view, 1> version{"version"};
    EXPECT_EQ(cli.run(version), static_cast<int>(CliExitCode::success));
    EXPECT_EQ(output.str(), std::string{"cca "} + std::string{compiler_version} + '\n');
}

TEST(CliTest, DispatchesNormalizedCompileRequest) {
    std::ostringstream output;
    std::ostringstream error;
    const auto service = std::make_shared<RecordingCommandService>();
    const Cli cli{output, error, service};
    const std::array<std::string_view, 4> arguments{
        "compile", "specification.yaml", "--output", "build/reports"};

    EXPECT_EQ(cli.run(arguments), static_cast<int>(CliExitCode::success));
    EXPECT_EQ(service->request(),
              (CommandRequest{CompilerCommand::compile, "specification.yaml", "build/reports"}));
    EXPECT_EQ(output.str(), "{\"status\":\"ok\"}\n");
    EXPECT_TRUE(error.str().empty());
}

TEST(CliTest, DispatchesEveryCompilerCommand) {
    struct Example final {
        std::string_view name;
        CompilerCommand command;
    };
    constexpr std::array examples{
        Example{"validate", CompilerCommand::validate},
        Example{"compile", CompilerCommand::compile},
        Example{"analyze", CompilerCommand::analyze},
        Example{"report", CompilerCommand::report},
    };

    for (const auto& example : examples) {
        std::ostringstream output;
        std::ostringstream error;
        const auto service = std::make_shared<RecordingCommandService>();
        const Cli cli{output, error, service};
        const std::array arguments{example.name, std::string_view{"specification.yaml"}};

        EXPECT_EQ(cli.run(arguments), static_cast<int>(CliExitCode::success));
        EXPECT_EQ(service->request().command, example.command);
        EXPECT_EQ(service->request().output_directory, std::filesystem::path{"cca-out"});
    }
}

TEST(CliTest, RoutesFailedCommandJsonToErrorStream) {
    std::ostringstream output;
    std::ostringstream error;
    const auto service = std::make_shared<RecordingCommandService>(
        CommandResult{CliExitCode::validation_error, "{\"status\":\"invalid\"}"});
    const Cli cli{output, error, service};
    const std::array<std::string_view, 2> arguments{"validate", "invalid.yaml"};

    EXPECT_EQ(cli.run(arguments), static_cast<int>(CliExitCode::validation_error));
    EXPECT_TRUE(output.str().empty());
    EXPECT_EQ(error.str(), "{\"status\":\"invalid\"}\n");
}

TEST(CliTest, RejectsMissingSourceUnknownOptionsAndDuplicateOutput) {
    std::ostringstream output;
    std::ostringstream error;
    const auto service = std::make_shared<RecordingCommandService>();
    const Cli cli{output, error, service};

    const std::array<std::string_view, 1> incomplete{"validate"};
    EXPECT_EQ(cli.run(incomplete), static_cast<int>(CliExitCode::usage_error));
    EXPECT_NE(error.str().find("CCA-CLI-002"), std::string::npos);

    error.str(std::string{});
    const std::array<std::string_view, 3> unexpected{"analyze", "spec.yaml", "--verbose"};
    EXPECT_EQ(cli.run(unexpected), static_cast<int>(CliExitCode::usage_error));
    EXPECT_NE(error.str().find("CCA-CLI-003"), std::string::npos);

    error.str(std::string{});
    const std::array<std::string_view, 6> duplicate{
        "report", "spec.yaml", "-o", "first", "--output", "second"};
    EXPECT_EQ(cli.run(duplicate), static_cast<int>(CliExitCode::usage_error));
    EXPECT_NE(error.str().find("CCA-CLI-003"), std::string::npos);
}

TEST(CliTest, UnknownCommandUsesStructuredUsageError) {
    std::ostringstream output;
    std::ostringstream error;
    const Cli cli{output, error};
    const std::array<std::string_view, 1> unknown{"unknown"};

    EXPECT_EQ(cli.run(unknown), static_cast<int>(CliExitCode::usage_error));
    EXPECT_EQ(error.str(),
              "{\"command\":\"unknown\",\"error\":{\"code\":\"CCA-CLI-001\",\"message\":"
              "\"unknown command; run 'cca help' for usage\"},\"status\":\"error\"}\n");
}

TEST(CliTest, DoctorReportsReadinessAsDeterministicJson) {
    std::ostringstream output;
    std::ostringstream error;
    const Cli cli{output, error};
    const std::array<std::string_view, 1> arguments{"doctor"};

    EXPECT_EQ(cli.run(arguments), static_cast<int>(CliExitCode::success));
    EXPECT_EQ(output.str(),
              std::string{"{\"command\":\"doctor\",\"compiler_version\":\""} +
                  std::string{compiler_version} +
                  "\",\"format_version\":\"1.x\",\"status\":\"ready\"}\n");
}

TEST(CliTest, RejectsNullCommandService) {
    std::ostringstream output;
    std::ostringstream error;
    EXPECT_THROW((Cli{output, error, std::shared_ptr<const ICommandService>{}}),
                 std::invalid_argument);
}

} // namespace
} // namespace cca::compiler
