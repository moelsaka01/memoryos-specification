#include <gtest/gtest.h>
#include <memory>

#include "cca/compiler/parser.hpp"

namespace cca::compiler {
namespace {

TEST(ParserTest, ReportsDeterministicPlaceholderStatus) {
    auto diagnostics = std::make_shared<CollectingDiagnosticSink>();
    Parser parser{std::make_shared<NullLogger>(), diagnostics};

    const auto status = parser.parse(ParseRequest{"model.cca"});

    EXPECT_EQ(status.code(), StatusCode::not_implemented);
    ASSERT_EQ(diagnostics->snapshot().size(), 1U);
    EXPECT_EQ(diagnostics->snapshot().front().code, "CCA-PARSER-900");
}

TEST(ParserTest, RejectsEmptySourcePath) {
    const Parser parser;
    EXPECT_EQ(parser.parse(ParseRequest{}).code(), StatusCode::invalid_argument);
}

} // namespace
} // namespace cca::compiler
