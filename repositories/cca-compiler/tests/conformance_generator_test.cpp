#include <gtest/gtest.h>

#include "cca/compiler/conformance_generator.hpp"

namespace cca::compiler {
namespace {

TEST(ConformanceGeneratorTest, ReportsDeterministicPlaceholderStatus) {
    const ConformanceGenerator generator;
    EXPECT_EQ(generator.generate(ConformanceGenerationRequest{"model.cca", "conformance"}).code(),
              StatusCode::not_implemented);
}

TEST(ConformanceGeneratorTest, RejectsIncompleteRequest) {
    const ConformanceGenerator generator;
    EXPECT_EQ(generator.generate(ConformanceGenerationRequest{}).code(),
              StatusCode::invalid_argument);
}

} // namespace
} // namespace cca::compiler
