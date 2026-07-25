#include <gtest/gtest.h>

#include "cca/compiler/package_generator.hpp"

namespace cca::compiler {
namespace {

TEST(PackageGeneratorTest, ReportsDeterministicPlaceholderStatus) {
    const PackageGenerator generator;
    EXPECT_EQ(generator.generate(PackageGenerationRequest{"artifacts", "bundle.cca"}).code(),
              StatusCode::not_implemented);
}

TEST(PackageGeneratorTest, RejectsIncompleteRequest) {
    const PackageGenerator generator;
    EXPECT_EQ(generator.generate(PackageGenerationRequest{}).code(), StatusCode::invalid_argument);
}

} // namespace
} // namespace cca::compiler
