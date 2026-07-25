#include <gtest/gtest.h>

#include "cca/compiler/artifact_generator.hpp"

namespace cca::compiler {
namespace {

TEST(ArtifactGeneratorTest, ReportsDeterministicPlaceholderStatus) {
    const ArtifactGenerator generator;
    EXPECT_EQ(generator.generate(ArtifactGenerationRequest{"model.cca", "out"}).code(),
              StatusCode::not_implemented);
}

TEST(ArtifactGeneratorTest, RejectsIncompleteRequest) {
    const ArtifactGenerator generator;
    EXPECT_EQ(generator.generate(ArtifactGenerationRequest{}).code(), StatusCode::invalid_argument);
}

} // namespace
} // namespace cca::compiler
