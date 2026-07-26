#include <filesystem>
#include <gtest/gtest.h>
#include <memory>
#include <string>
#include <utility>

#include "cca/compiler/compiler_service.hpp"
#include "test_specification.hpp"

namespace cca::compiler {
namespace {

class ServiceSourceLoader final : public ISourceLoader {
  public:
    explicit ServiceSourceLoader(std::string content) : content_{std::move(content)} {}

    [[nodiscard]] LoadResult load(const std::filesystem::path& path) const override {
        return LoadResult{SourceDocument{path, content_}, {}};
    }

  private:
    std::string content_;
};

[[nodiscard]] CompilerCommandService service_with(std::string source) {
    return CompilerCommandService{std::make_shared<CompilerPipeline>(
        std::make_shared<ServiceSourceLoader>(std::move(source)))};
}

TEST(CompilerServiceTest, ReturnsDeterministicStructuredValidationOutput) {
    const auto service = service_with(std::string{test::valid_specification});
    const CommandRequest request{CompilerCommand::validate, "specification.yaml", "unused"};

    const auto first = service.execute(request);
    const auto second = service.execute(request);

    EXPECT_EQ(first.exit_code, CliExitCode::success);
    EXPECT_EQ(first.json, second.json);
    EXPECT_NE(first.json.find("\"status\":\"valid\""), std::string::npos);
    EXPECT_NE(first.json.find("\"objects\":5"), std::string::npos);
    EXPECT_NE(first.json.find("\"validation\":{\"diagnostics\":[]"), std::string::npos);
}

TEST(CompilerServiceTest, MapsCompilerDiagnosticsToValidationExitCode) {
    const auto service = service_with("invalid: [");
    const auto result =
        service.execute(CommandRequest{CompilerCommand::validate, "broken.yaml", "unused"});

    EXPECT_EQ(result.exit_code, CliExitCode::validation_error);
    EXPECT_NE(result.json.find("\"status\":\"error\""), std::string::npos);
    EXPECT_NE(result.json.find("CCA-PARSE-001"), std::string::npos);
}

TEST(CompilerServiceTest, RejectsANullPipeline) {
    EXPECT_THROW(CompilerCommandService{nullptr}, std::invalid_argument);
}

} // namespace
} // namespace cca::compiler
