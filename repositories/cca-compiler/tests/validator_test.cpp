#include <algorithm>
#include <gtest/gtest.h>
#include <set>
#include <string>

#include "cca/compiler/parser.hpp"
#include "cca/compiler/validator.hpp"

namespace cca::compiler {
namespace {

constexpr std::string_view valid_specification = R"(
$schema: "cca://schemas/canonical-specification/1.0"
format_version: 1.0.0
kind: canonical_specification
id: example.system
version: 1.2.0
metadata:
  name: Example System
  description: Architecture-neutral example.
  authors: [CCA Team]
  labels:
    maturity: draft
categories:
  - id: architecture
    name: Architecture
    description: Architecture definitions.
    annotations: {}
    extensions: {}
objects:
  - type: component
    id: core.component
    version: 1.0.0
    category: architecture
    metadata:
      name: Core component
      description: A neutral component.
      authors: []
      labels: {}
    contracts: [core.contract]
    requirements: [core.requirement]
    properties:
      enabled: true
    annotations: {}
    extensions: {}
relationships: []
dependencies:
  - id: core.dependency
    source: core.component
    target: core.contract
    version: ^1.0.0
    optional: false
    metadata:
      name: Core dependency
      description: Component to contract.
      authors: []
      labels: {}
    annotations: {}
    extensions: {}
validation_rules:
  - id: rule.identifiers
    category: architecture
    severity: warning
    expression: identifiers_are_unique
    message: Identifiers must be unique.
    suggestion: Rename duplicate identifiers.
    annotations: {}
    extensions: {}
artifacts:
  - id: report.inventory
    type: object_inventory
    output: object-inventory.json
    options: {}
    annotations: {}
    extensions: {}
annotations: {}
extensions: {}
)";

[[nodiscard]] ParsedDocument parse_valid() {
    const Parser parser;
    auto result = parser.parse(SourceDocument{"valid.yaml", std::string{valid_specification}});
    if (!result.document) {
        throw std::runtime_error("valid test fixture did not parse");
    }
    return std::move(*result.document);
}

[[nodiscard]] std::set<std::string> codes(const ValidationResult& result) {
    std::set<std::string> values;
    for (const auto& diagnostic : result.diagnostics()) {
        values.emplace(diagnostic.code);
    }
    return values;
}

TEST(ValidatorTest, AcceptsCompleteCanonicalSpecification) {
    const Validator validator;
    const auto result = validator.validate(parse_valid());

    EXPECT_FALSE(result.has_errors());
    EXPECT_TRUE(result.empty());
}

TEST(ValidatorTest, RejectsNonObjectRoot) {
    const Validator validator;
    const ParsedDocument document{"scalar.yaml", CanonicalValue{"text"}};

    const auto result = validator.validate(document);

    ASSERT_EQ(result.error_count(), 1U);
    EXPECT_EQ(result.diagnostics().front().code, "CCA-SCHEMA-001");
}

TEST(ValidatorTest, ReportsMissingUnknownAndInvalidRootFields) {
    auto document = parse_valid();
    auto& root = document.root.as_object();
    root.erase("$schema");
    root.emplace("unexpected", CanonicalValue{"value"});
    root["format_version"] = CanonicalValue{"2.0.0"};
    root["id"] = CanonicalValue{"Invalid_Id"};

    const auto result = Validator{}.validate(document);
    const auto result_codes = codes(result);

    EXPECT_TRUE(result_codes.contains("CCA-SCHEMA-002"));
    EXPECT_TRUE(result_codes.contains("CCA-SCHEMA-005"));
    EXPECT_TRUE(result_codes.contains("CCA-SCHEMA-006"));
    EXPECT_TRUE(result_codes.contains("CCA-SCHEMA-007"));
}

TEST(ValidatorTest, ReportsMetadataShapeViolations) {
    auto document = parse_valid();
    auto& metadata = document.root.find("metadata")->as_object();
    metadata["name"] = CanonicalValue{std::int64_t{7}};
    metadata["authors"] = CanonicalValue{CanonicalValue::Array{CanonicalValue{std::int64_t{1}}}};
    metadata["labels"] = CanonicalValue{CanonicalValue::Object{{"numeric", CanonicalValue{true}}}};

    const auto result = Validator{}.validate(document);

    EXPECT_GE(result.error_count(), 3U);
    EXPECT_TRUE(codes(result).contains("CCA-SCHEMA-003"));
}

TEST(ValidatorTest, RejectsUnknownObjectTypesAndTypeSpecificShapeErrors) {
    auto document = parse_valid();
    auto& object = document.root.find("objects")->as_array().front().as_object();
    object["type"] = CanonicalValue{"runtime"};
    object["category"] = CanonicalValue{false};
    object.erase("properties");
    object.emplace("depends_on", CanonicalValue{CanonicalValue::Array{}});

    const auto result = Validator{}.validate(document);
    const auto result_codes = codes(result);

    EXPECT_TRUE(result_codes.contains("CCA-SCHEMA-002"));
    EXPECT_TRUE(result_codes.contains("CCA-SCHEMA-003"));
    EXPECT_TRUE(result_codes.contains("CCA-SCHEMA-004"));
    EXPECT_TRUE(result_codes.contains("CCA-SCHEMA-007"));
}

TEST(ValidatorTest, ValidatesDependencyRuleAndArtifactMembers) {
    auto document = parse_valid();
    auto& dependency = document.root.find("dependencies")->as_array().front().as_object();
    dependency["version"] = CanonicalValue{">= tomorrow"};
    dependency["optional"] = CanonicalValue{"false"};
    auto& rule = document.root.find("validation_rules")->as_array().front().as_object();
    rule["severity"] = CanonicalValue{"fatal"};
    rule["expression"] = CanonicalValue{""};
    rule.erase("suggestion");
    auto& artifact = document.root.find("artifacts")->as_array().front().as_object();
    artifact["type"] = CanonicalValue{"unknown_report"};
    artifact["output"] = CanonicalValue{"../object-inventory.json"};

    const auto result = Validator{}.validate(document);
    const auto result_codes = codes(result);

    EXPECT_TRUE(result_codes.contains("CCA-SCHEMA-003"));
    EXPECT_TRUE(result_codes.contains("CCA-SCHEMA-004"));
    EXPECT_TRUE(result_codes.contains("CCA-SCHEMA-008"));
}

TEST(ValidatorTest, ValidatesIdentifierKeyedExtensibilityMaps) {
    auto document = parse_valid();
    auto& root = document.root.as_object();
    root["annotations"] = CanonicalValue{CanonicalValue::Object{
        {"Bad_Key", CanonicalValue{CanonicalValue::Array{CanonicalValue{"nested"}}}},
    }};
    root["extensions"] =
        CanonicalValue{CanonicalValue::Object{{"Bad_Key", CanonicalValue{"value"}}}};
    auto& labels = root["metadata"].as_object()["labels"].as_object();
    labels.emplace("Bad_Key", CanonicalValue{"value"});

    const auto result = Validator{}.validate(document);

    EXPECT_TRUE(codes(result).contains("CCA-SCHEMA-003"));
    EXPECT_TRUE(codes(result).contains("CCA-SCHEMA-005"));
}

TEST(ValidatorTest, ReportsDiagnosticsThroughInjectedSink) {
    auto sink = std::make_shared<CollectingDiagnosticSink>();
    const Validator validator{std::make_shared<NullLogger>(), sink};
    auto document = parse_valid();
    document.root.as_object().erase("kind");

    static_cast<void>(validator.validate(document));

    ASSERT_FALSE(sink->snapshot().empty());
    EXPECT_EQ(sink->snapshot().front().category, "schema");
}

TEST(ValidatorTest, CompatibilityOverloadRejectsEmptySourcePath) {
    const Validator validator;
    EXPECT_EQ(validator.validate(ValidationRequest{}).code(), StatusCode::invalid_argument);
}

} // namespace
} // namespace cca::compiler
