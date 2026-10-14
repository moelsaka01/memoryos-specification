#include <filesystem>
#include <gtest/gtest.h>
#include <memory>
#include <string>
#include <utility>

#include "cca/compiler/compiler_pipeline.hpp"
#include "test_specification.hpp"

namespace cca::compiler {
namespace {

class MemorySourceLoader final : public ISourceLoader {
  public:
    explicit MemorySourceLoader(std::string content) : content_{std::move(content)} {}

    [[nodiscard]] LoadResult load(const std::filesystem::path& path) const override {
        return LoadResult{
            .document = SourceDocument{path, content_},
            .validation = {},
        };
    }

  private:
    std::string content_;
};

[[nodiscard]] CompilerPipeline valid_pipeline() {
    return CompilerPipeline{
        std::make_shared<MemorySourceLoader>(std::string{test::valid_specification})};
}

TEST(CompilerPipelineTest, ValidateRunsThroughDependencyResolution) {
    const auto result = valid_pipeline().run(
        PipelineRequest{PipelineMode::validate, "specification.yaml", "unused"});

    EXPECT_TRUE(result.ok());
    EXPECT_EQ(
        result.completed_stages,
        (std::vector<std::string>{"load", "parse", "validate", "analyze", "resolve_dependencies"}));
    EXPECT_TRUE(result.analysis.has_value());
    EXPECT_TRUE(result.dependencies.has_value());
    EXPECT_FALSE(result.specification.has_value());
}

TEST(CompilerPipelineTest, AnalyzeBuildsTheTypedModelWithoutWritingFiles) {
    const auto result = valid_pipeline().run(
        PipelineRequest{PipelineMode::analyze, "specification.yaml", "unused"});

    EXPECT_TRUE(result.ok());
    ASSERT_TRUE(result.specification.has_value());
    EXPECT_EQ(result.specification->object_count(), 5U);
    EXPECT_TRUE(result.generated_files.empty());
    EXPECT_EQ(result.completed_stages.back(), "build_internal_model");
}

TEST(CompilerPipelineTest, CompileGeneratesTheCompleteDeterministicBundle) {
    const auto directory =
        std::filesystem::temp_directory_path() / "cca-is002-pipeline-test-output";
    std::filesystem::remove_all(directory);

    const auto result = valid_pipeline().run(
        PipelineRequest{PipelineMode::compile, "specification.yaml", directory});

    EXPECT_TRUE(result.ok());
    EXPECT_EQ(result.generated_files.size(), 7U);
    EXPECT_EQ(result.completed_stages.back(), "generate_reports");
    EXPECT_TRUE(std::filesystem::exists(directory / "validation-report.json"));
    EXPECT_TRUE(std::filesystem::exists(directory / "generated" / "README.md"));
    std::filesystem::remove_all(directory);
}

TEST(CompilerPipelineTest, StopsAfterParseErrors) {
    const CompilerPipeline pipeline{std::make_shared<MemorySourceLoader>("invalid: [")};
    const auto result =
        pipeline.run(PipelineRequest{PipelineMode::validate, "broken.yaml", "unused"});

    EXPECT_FALSE(result.ok());
    EXPECT_EQ(result.completed_stages, (std::vector<std::string>{"load", "parse"}));
}

TEST(CompilerPipelineTest, RejectsInvalidConstructionAndRequests) {
    EXPECT_THROW(CompilerPipeline{nullptr}, std::invalid_argument);
    EXPECT_FALSE(valid_pipeline().run(PipelineRequest{}).ok());
    EXPECT_FALSE(valid_pipeline()
                     .run(PipelineRequest{PipelineMode::compile, "specification.yaml", {}})
                     .ok());
}

} // namespace
} // namespace cca::compiler
