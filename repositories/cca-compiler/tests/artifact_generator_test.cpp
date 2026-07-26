#include <array>
#include <filesystem>
#include <fstream>
#include <gtest/gtest.h>
#include <iterator>
#include <string>

#include "cca/compiler/artifact_generator.hpp"

namespace cca::compiler {
namespace {

[[nodiscard]] std::string read_file(const std::filesystem::path& path) {
    std::ifstream input{path, std::ios::binary};
    return {std::istreambuf_iterator<char>{input}, std::istreambuf_iterator<char>{}};
}

[[nodiscard]] ObjectHeader header(const std::string& id) {
    ObjectHeader value;
    value.id = Identifier{id};
    value.version = Version{1, 0, 0};
    value.category = Identifier{"architecture"};
    value.metadata.name = id;
    return value;
}

[[nodiscard]] Specification example_specification() {
    Specification specification;
    specification.schema_uri = "cca://schemas/canonical-specification/1.0";
    specification.format_version = Version{1, 0, 0};
    specification.kind = "canonical_specification";
    specification.id = Identifier{"example.system"};
    specification.version = Version{1, 2, 3};
    specification.metadata.name = "Example System";
    specification.components.push_back(Component{
        .header = header("example.consumer"),
        .contracts = {},
        .requirements = {},
    });
    auto provider = header("example.provider");
    specification.components.push_back(Component{
        .header = std::move(provider),
        .contracts = {},
        .requirements = {},
    });
    specification.relationships.push_back(Relationship{
        .id = Identifier{"example.relationship"},
        .type = "uses",
        .source = Identifier{"example.provider"},
        .target = Identifier{"example.consumer"},
        .metadata = {},
        .annotations = {},
        .extensions = {},
    });
    specification.dependencies.push_back(Dependency{
        .id = Identifier{"example.dependency"},
        .source = Identifier{"example.provider"},
        .target = Identifier{"example.consumer"},
        .version = "^1.0.0",
        .optional = false,
        .metadata = {},
        .annotations = {},
        .extensions = {},
    });
    return specification;
}

class ArtifactGeneratorTest : public ::testing::Test {
  protected:
    void SetUp() override {
        std::filesystem::remove_all(first_);
        std::filesystem::remove_all(second_);
    }

    void TearDown() override {
        std::filesystem::remove_all(first_);
        std::filesystem::remove_all(second_);
    }

    std::filesystem::path first_{"artifact-generator-test-output-a"};
    std::filesystem::path second_{"artifact-generator-test-output-b"};
};

TEST_F(ArtifactGeneratorTest, WritesTheExactDeterministicBundle) {
    const ArtifactGenerator generator;
    const auto first = generator.generate(example_specification(), ValidationResult{}, first_);
    const auto second = generator.generate(example_specification(), ValidationResult{}, second_);

    ASSERT_FALSE(first.validation.has_errors());
    ASSERT_FALSE(second.validation.has_errors());
    ASSERT_EQ(first.files.size(), 7U);
    constexpr std::array expected{
        "documentation-index.md",
        "dependency-graph.mmd",
        "specification-report.json",
        "validation-report.json",
        "object-inventory.json",
        "architecture-summary.md",
        "generated/README.md",
    };
    for (std::size_t index = 0; index < expected.size(); ++index) {
        EXPECT_EQ(first.files[index], first_ / expected[index]);
        EXPECT_TRUE(std::filesystem::is_regular_file(first.files[index]));
        EXPECT_EQ(read_file(first_ / expected[index]), read_file(second_ / expected[index]));
    }
}

TEST_F(ArtifactGeneratorTest, WritesStableGraphAndExplicitCodePlaceholder) {
    const ArtifactGenerator generator;
    const auto result = generator.generate(example_specification(), ValidationResult{}, first_);

    ASSERT_FALSE(result.validation.has_errors());
    EXPECT_EQ(read_file(first_ / "dependency-graph.mmd"),
              "graph TD\n"
              "  n0[\"example.consumer\"]\n"
              "  n1[\"example.provider\"]\n"
              "  n1 -->|\"dependency ^1.0.0\"| n0\n");
    const auto placeholder = read_file(first_ / "generated" / "README.md");
    EXPECT_NE(placeholder.find("does not generate production code"), std::string::npos);
    EXPECT_EQ(placeholder.find("MemoryOS"), std::string::npos);
}

TEST_F(ArtifactGeneratorTest, CarriesValidationAndRejectsEmptyOutputDirectory) {
    ValidationResult validation;
    validation.add(Diagnostic{
        "cca.test.warning",
        "CCA-TEST-001",
        DiagnosticSeverity::warning,
        "warning",
        "review it",
        {"specification.yaml", 1, 1},
        "test",
    });
    const ArtifactGenerator generator;
    const auto result = generator.generate(example_specification(), validation, {});

    EXPECT_TRUE(result.files.empty());
    EXPECT_TRUE(result.validation.has_errors());
    EXPECT_EQ(result.validation.error_count(), 1U);
    EXPECT_EQ(result.validation.warning_count(), 1U);
    ASSERT_EQ(result.validation.diagnostics().size(), 2U);
    EXPECT_EQ(result.validation.diagnostics().front().code, "CCA-GEN-001");
}

} // namespace
} // namespace cca::compiler
