#include <gtest/gtest.h>

#include "cca/compiler/analyzer.hpp"

namespace cca::compiler {
namespace {

TEST(AnalyzerTest, ReportsDeterministicPlaceholderStatus) {
    const Analyzer analyzer;
    EXPECT_EQ(analyzer.analyze(AnalysisRequest{"model.cca"}).code(), StatusCode::not_implemented);
}

TEST(AnalyzerTest, RejectsEmptySourcePath) {
    const Analyzer analyzer;
    EXPECT_EQ(analyzer.analyze(AnalysisRequest{}).code(), StatusCode::invalid_argument);
}

} // namespace
} // namespace cca::compiler
