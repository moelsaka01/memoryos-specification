#include <gtest/gtest.h>
#include <string>

#include "cca/compiler/internal_model.hpp"
#include "cca/compiler/serialization.hpp"

namespace cca::compiler {
namespace {

[[nodiscard]] ObjectHeader
header(const std::string& id, const std::string& category, const std::string& name) {
    ObjectHeader value;
    value.id = Identifier{id};
    value.version = Version{1, 0, 0};
    value.category = Identifier{category};
    value.metadata.name = name;
    return value;
}

TEST(SerializationTest, EscapesJsonControlCharactersAndQuotes) {
    EXPECT_EQ(json_string("a\"b\\c\n\t"), "\"a\\\"b\\\\c\\n\\t\"");
    EXPECT_EQ(json_string(std::string{"x\x01y", 3}), "\"x\\u0001y\"");
}

TEST(SerializationTest, ValidationReportUsesStableDiagnosticOrder) {
    ValidationResult validation;
    validation.add(Diagnostic{
        "diag-b",
        "CCA-VAL-002",
        DiagnosticSeverity::warning,
        "second",
        "fix second",
        {"z.yaml", 2, 3},
        "reference",
    });
    validation.add(Diagnostic{
        "diag-a",
        "CCA-VAL-001",
        DiagnosticSeverity::error,
        "first",
        "fix first",
        {"a.yaml", 1, 1},
        "schema",
    });

    EXPECT_EQ(serialize_validation_report(validation),
              "{\"diagnostics\":[{\"category\":\"schema\",\"code\":\"CCA-VAL-001\","
              "\"identifier\":\"diag-a\",\"location\":{\"column\":1,\"line\":1,\"path\":"
              "\"a.yaml\"},\"message\":\"first\",\"severity\":\"error\",\"suggestion\":"
              "\"fix first\"},{\"category\":\"reference\",\"code\":\"CCA-VAL-002\","
              "\"identifier\":\"diag-b\",\"location\":{\"column\":3,\"line\":2,\"path\":"
              "\"z.yaml\"},\"message\":\"second\",\"severity\":\"warning\",\"suggestion\":"
              "\"fix second\"}],\"summary\":{\"errors\":1,\"notes\":0,\"total\":2,"
              "\"warnings\":1}}");
}

TEST(SerializationTest, SpecificationReportsAreDeterministic) {
    Specification specification;
    specification.schema_uri = "cca://schemas/canonical-specification/1.0";
    specification.format_version = Version{1, 0, 0};
    specification.kind = "canonical_specification";
    specification.id = Identifier{"example.system"};
    specification.version = Version{2, 1, 0};
    specification.metadata.name = "Example";
    specification.components.push_back(Component{
        .header = header("example.z", "architecture", "Zed"),
        .contracts = {},
        .requirements = {},
    });
    specification.domains.push_back(Domain{
        .header = header("example.a", "architecture", "Alpha"),
        .components = {},
    });

    const ValidationResult validation;
    EXPECT_EQ(serialize_specification_report(specification, validation),
              "{\"categories\":0,\"dependencies\":0,\"diagnostics\":{\"errors\":0,"
              "\"warnings\":0},\"format_version\":\"1.0.0\",\"id\":\"example.system\","
              "\"kind\":\"canonical_specification\",\"objects\":{\"components\":1,"
              "\"contracts\":0,\"domains\":1,\"packages\":0,\"requirements\":0,\"total\":2},"
              "\"relationships\":0,\"schema\":\"cca://schemas/canonical-specification/1.0\","
              "\"version\":\"2.1.0\"}");
    EXPECT_EQ(serialize_object_inventory(specification),
              "{\"objects\":[{\"category\":\"architecture\",\"id\":\"example.a\","
              "\"kind\":\"domain\",\"name\":\"Alpha\",\"version\":\"1.0.0\"},"
              "{\"category\":\"architecture\",\"id\":\"example.z\",\"kind\":\"component\","
              "\"name\":\"Zed\",\"version\":\"1.0.0\"}],\"total\":2}");
}

} // namespace
} // namespace cca::compiler
