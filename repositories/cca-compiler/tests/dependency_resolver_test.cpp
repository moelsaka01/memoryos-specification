#include <algorithm>
#include <gtest/gtest.h>
#include <stdexcept>
#include <string>

#include "cca/compiler/dependency_resolver.hpp"
#include "cca/compiler/parser.hpp"
#include "test_specification.hpp"

namespace cca::compiler {
namespace {

[[nodiscard]] ParsedDocument dependency_document(std::string text) {
    const auto result = Parser{}.parse(SourceDocument{"dependencies.yaml", std::move(text)});
    if (!result.document.has_value()) {
        throw std::runtime_error{"test YAML did not parse"};
    }
    return *result.document;
}

TEST(DependencyResolverTest, ProducesAStableDependencyFirstOrder) {
    const auto result =
        DependencyResolver{}.resolve(dependency_document(std::string{test::valid_specification}));

    ASSERT_TRUE(result.ok());
    const auto target = std::ranges::find(result.order, "example.contract");
    const auto source = std::ranges::find(result.order, "example.component");
    ASSERT_NE(target, result.order.end());
    ASSERT_NE(source, result.order.end());
    EXPECT_LT(std::distance(result.order.begin(), target),
              std::distance(result.order.begin(), source));
}

TEST(DependencyResolverTest, ReportsIncompatibleVersions) {
    auto text = std::string{test::valid_specification};
    const auto constraint = text.find("version: ^1.0.0", text.find("dependencies:"));
    ASSERT_NE(constraint, std::string::npos);
    text.replace(constraint, std::string{"version: ^1.0.0"}.size(), "version: ^2.0.0");

    const auto result = DependencyResolver{}.resolve(dependency_document(std::move(text)));

    EXPECT_FALSE(result.ok());
    EXPECT_EQ(result.validation.diagnostics().front().code, "CCA-DEPENDENCY-002");
}

TEST(DependencyResolverTest, ReportsCircularDependencies) {
    auto text = std::string{test::valid_specification};
    const auto rules = text.find("validation_rules:");
    ASSERT_NE(rules, std::string::npos);
    text.insert(rules,
                "  - id: reverse.dependency\n"
                "    source: example.contract\n"
                "    target: example.component\n"
                "    version: ~1.1.0\n"
                "    optional: false\n"
                "    metadata:\n"
                "      name: Reverse dependency\n"
                "    annotations: {}\n"
                "    extensions: {}\n");

    const auto result = DependencyResolver{}.resolve(dependency_document(std::move(text)));

    EXPECT_FALSE(result.ok());
    EXPECT_TRUE(std::ranges::any_of(result.validation.diagnostics(), [](const Diagnostic& item) {
        return item.code == "CCA-DEPENDENCY-001";
    }));
}

} // namespace
} // namespace cca::compiler
