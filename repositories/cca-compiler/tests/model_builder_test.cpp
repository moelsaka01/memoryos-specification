#include <gtest/gtest.h>
#include <stdexcept>
#include <string>

#include "cca/compiler/model_builder.hpp"
#include "cca/compiler/parser.hpp"
#include "test_specification.hpp"

namespace cca::compiler {
namespace {

[[nodiscard]] ParsedDocument model_document() {
    const auto result =
        Parser{}.parse(SourceDocument{"model.yaml", std::string{test::valid_specification}});
    if (!result.document.has_value()) {
        throw std::runtime_error{"test YAML did not parse"};
    }
    return *result.document;
}

TEST(ModelBuilderTest, BuildsAllTypedObjectsAndExtensibilityData) {
    const auto result = ModelBuilder{}.build(model_document());

    ASSERT_TRUE(result.ok());
    ASSERT_TRUE(result.specification.has_value());
    EXPECT_EQ(result.specification->object_count(), 5U);
    ASSERT_EQ(result.specification->packages.size(), 1U);
    EXPECT_EQ(result.specification->packages.front().members.front().value(), "example.domain");
    ASSERT_EQ(result.specification->components.size(), 1U);
    EXPECT_EQ(result.specification->components.front().contracts.front().value(),
              "example.contract");
    EXPECT_EQ(result.specification->dependencies.front().version, "^1.0.0");
}

TEST(ModelBuilderTest, FailsDefensivelyForAnInvalidTree) {
    const ParsedDocument document{"invalid.yaml", CanonicalValue{"not-an-object"}};
    const auto result = ModelBuilder{}.build(document);

    EXPECT_FALSE(result.ok());
    EXPECT_EQ(result.validation.error_count(), 1U);
}

} // namespace
} // namespace cca::compiler
