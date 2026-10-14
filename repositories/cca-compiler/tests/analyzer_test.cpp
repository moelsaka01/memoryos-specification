#include <algorithm>
#include <gtest/gtest.h>
#include <stdexcept>
#include <string>

#include "cca/compiler/analyzer.hpp"
#include "cca/compiler/parser.hpp"
#include "test_specification.hpp"

namespace cca::compiler {
namespace {

[[nodiscard]] ParsedDocument parse_document(std::string text) {
    const auto result = Parser{}.parse(SourceDocument{"analysis.yaml", std::move(text)});
    if (!result.document.has_value()) {
        throw std::runtime_error{"test YAML did not parse"};
    }
    return *result.document;
}

TEST(AnalyzerTest, SummarizesAValidCanonicalDocument) {
    const auto document = parse_document(std::string{test::valid_specification});
    const auto result = Analyzer{}.analyze(document);

    EXPECT_TRUE(result.ok());
    EXPECT_EQ(result.summary.object_count(), 5U);
    EXPECT_EQ(result.summary.objects_by_type.at("component"), 1U);
    EXPECT_EQ(result.summary.relationship_count, 1U);
    EXPECT_EQ(result.summary.dependency_count, 1U);
    EXPECT_TRUE(std::ranges::is_sorted(result.summary.object_identifiers));
}

TEST(AnalyzerTest, ReportsDuplicateAndUnresolvedIdentifiers) {
    auto text = std::string{test::valid_specification};
    const auto requirement = text.find("id: example.requirement");
    ASSERT_NE(requirement, std::string::npos);
    text.replace(
        requirement, std::string{"id: example.requirement"}.size(), "id: example.component");
    const auto relationship_target = text.find("target: example.contract");
    ASSERT_NE(relationship_target, std::string::npos);
    text.replace(relationship_target,
                 std::string{"target: example.contract"}.size(),
                 "target: missing.contract");

    const auto result = Analyzer{}.analyze(parse_document(std::move(text)));

    EXPECT_FALSE(result.ok());
    EXPECT_GE(result.validation.error_count(), 2U);
}

TEST(AnalyzerTest, ReportsDuplicateRelationshipTuples) {
    auto text = std::string{test::valid_specification};
    const auto dependency = text.find("dependencies:");
    ASSERT_NE(dependency, std::string::npos);
    const auto relationship = text.substr(text.find("  - id: example.relationship"),
                                          dependency - text.find("  - id: example.relationship"));
    auto duplicate = relationship;
    duplicate.replace(duplicate.find("example.relationship"),
                      std::string{"example.relationship"}.size(),
                      "example.relationship-copy");
    text.insert(dependency, duplicate);

    const auto result = Analyzer{}.analyze(parse_document(std::move(text)));

    EXPECT_FALSE(result.ok());
    EXPECT_TRUE(std::ranges::any_of(result.validation.diagnostics(), [](const Diagnostic& item) {
        return item.code == "CCA-ANALYSIS-004";
    }));
}

TEST(AnalyzerTest, CompatibilityOverloadRejectsInsufficientRequests) {
    const Analyzer analyzer;
    EXPECT_EQ(analyzer.analyze(AnalysisRequest{}).code(), StatusCode::invalid_argument);
    EXPECT_EQ(analyzer.analyze(AnalysisRequest{"model.yaml"}).code(), StatusCode::invalid_argument);
}

} // namespace
} // namespace cca::compiler
