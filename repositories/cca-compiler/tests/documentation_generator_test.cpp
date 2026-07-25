#include <gtest/gtest.h>

#include "cca/compiler/documentation_generator.hpp"

namespace cca::compiler {
namespace {

TEST(DocumentationGeneratorTest, ReportsDeterministicPlaceholderStatus) {
    const DocumentationGenerator generator;
    EXPECT_EQ(
        generator.generate(DocumentationGenerationRequest{"model.cca", "documentation"}).code(),
        StatusCode::not_implemented);
}

TEST(DocumentationGeneratorTest, RejectsIncompleteRequest) {
    const DocumentationGenerator generator;
    EXPECT_EQ(generator.generate(DocumentationGenerationRequest{}).code(),
              StatusCode::invalid_argument);
}

} // namespace
} // namespace cca::compiler
