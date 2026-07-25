#include <gtest/gtest.h>

#include "cca/compiler/validator.hpp"

namespace cca::compiler {
namespace {

TEST(ValidatorTest, ReportsDeterministicPlaceholderStatus) {
    const Validator validator;
    EXPECT_EQ(validator.validate(ValidationRequest{"model.cca"}).code(),
              StatusCode::not_implemented);
}

TEST(ValidatorTest, RejectsEmptySourcePath) {
    const Validator validator;
    EXPECT_EQ(validator.validate(ValidationRequest{}).code(), StatusCode::invalid_argument);
}

} // namespace
} // namespace cca::compiler
