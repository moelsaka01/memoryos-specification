#include <filesystem>
#include <fstream>
#include <gtest/gtest.h>
#include <memory>
#include <string>

#include "cca/compiler/parser.hpp"

namespace cca::compiler {
namespace {

TEST(ParserTest, ConvertsYamlToFormatIndependentDeterministicTree) {
    const Parser parser;
    const auto result = parser.parse(SourceDocument{"model.yaml",
                                                    R"(text: "true"
enabled: true
count: 3
ratio: 1.5
nothing: null
items:
  - first
  - 2
)"});

    ASSERT_TRUE(result.ok());
    ASSERT_TRUE(result.document.has_value());
    const auto& root = result.document->root;
    ASSERT_TRUE(root.is_object());
    EXPECT_EQ(root.as_object().begin()->first, "count");
    EXPECT_EQ(root.find("text")->as_string(), "true");
    EXPECT_TRUE(root.find("enabled")->as_boolean());
    EXPECT_EQ(root.find("count")->as_integer(), 3);
    EXPECT_DOUBLE_EQ(root.find("ratio")->as_number(), 1.5);
    EXPECT_TRUE(root.find("nothing")->is_null());
    ASSERT_EQ(root.find("items")->as_array().size(), 2U);
    EXPECT_EQ(root.find("enabled")->location().line, 2U);
}

TEST(ParserTest, ReportsYamlSyntaxErrorsWithSourceLocation) {
    const Parser parser;
    const auto result = parser.parse(SourceDocument{"broken.yaml", "items: [one,\n"});

    ASSERT_FALSE(result.ok());
    ASSERT_EQ(result.validation.error_count(), 1U);
    const auto& diagnostic = result.validation.diagnostics().front();
    EXPECT_EQ(diagnostic.code, "CCA-PARSE-001");
    EXPECT_EQ(diagnostic.location.path, "broken.yaml");
    EXPECT_FALSE(diagnostic.suggestion.empty());
}

TEST(ParserTest, RejectsMultipleDocuments) {
    const Parser parser;
    const auto result =
        parser.parse(SourceDocument{"multi.yaml", "---\nfirst: 1\n---\nsecond: 2\n"});

    ASSERT_FALSE(result.ok());
    EXPECT_EQ(result.validation.diagnostics().front().code, "CCA-PARSE-004");
    EXPECT_FALSE(result.document.has_value());
}

TEST(ParserTest, ReportsDuplicateAndComplexMappingKeys) {
    const Parser parser;
    const auto duplicates =
        parser.parse(SourceDocument{"duplicate.yaml", "item: first\nitem: second\n"});
    ASSERT_TRUE(duplicates.document.has_value());
    ASSERT_TRUE(duplicates.validation.has_errors());
    EXPECT_EQ(duplicates.validation.diagnostics().front().code, "CCA-PARSE-002");
    EXPECT_EQ(duplicates.document->root.find("item")->as_string(), "first");

    const auto complex =
        parser.parse(SourceDocument{"complex.yaml", "? [first, second]\n: value\n"});
    ASSERT_TRUE(complex.document.has_value());
    ASSERT_TRUE(complex.validation.has_errors());
    EXPECT_EQ(complex.validation.diagnostics().front().code, "CCA-PARSE-003");
}

TEST(ParserTest, RejectsRecursiveAliasesWithoutRecursingForever) {
    const Parser parser;
    const auto result = parser.parse(SourceDocument{"aliases.yaml", "loop: &loop\n  - *loop\n"});

    ASSERT_TRUE(result.document.has_value());
    ASSERT_TRUE(result.validation.has_errors());
    EXPECT_EQ(result.validation.diagnostics().front().code, "CCA-PARSE-005");
}

TEST(ParserTest, InjectedSinkReceivesParserDiagnostics) {
    auto diagnostics = std::make_shared<CollectingDiagnosticSink>();
    const Parser parser{std::make_shared<NullLogger>(), diagnostics};

    static_cast<void>(parser.parse(SourceDocument{"broken.yaml", "value: [\n"}));

    ASSERT_EQ(diagnostics->snapshot().size(), 1U);
    EXPECT_EQ(diagnostics->snapshot().front().category, "syntax");
}

TEST(ParserTest, CompatibilityOverloadRejectsEmptySourcePath) {
    const Parser parser;
    EXPECT_EQ(parser.parse(ParseRequest{}).code(), StatusCode::invalid_argument);
}

} // namespace
} // namespace cca::compiler
