#include <gtest/gtest.h>
#include <memory>

#include "cca/compiler/diagnostics.hpp"

namespace cca::compiler {
namespace {

TEST(DiagnosticsTest, CollectorPreservesAndClearsDiagnostics) {
    CollectingDiagnosticSink sink;
    sink.report({DiagnosticSeverity::warning, "CCA-TEST-001", "example"});

    const auto snapshot = sink.snapshot();
    ASSERT_EQ(snapshot.size(), 1U);
    EXPECT_EQ(snapshot.front().code, "CCA-TEST-001");

    sink.clear();
    EXPECT_TRUE(sink.snapshot().empty());
}

TEST(DiagnosticsTest, StatusFactoriesPreserveCodeAndMessage) {
    const auto status = Status::not_implemented("placeholder");
    EXPECT_FALSE(status.ok());
    EXPECT_EQ(status.code(), StatusCode::not_implemented);
    EXPECT_EQ(status.message(), "placeholder");
}

TEST(DiagnosticsTest, NullSinkSupportsPolymorphicInjection) {
    const std::shared_ptr<IDiagnosticSink> sink = std::make_shared<NullDiagnosticSink>();
    EXPECT_NO_THROW(sink->report({DiagnosticSeverity::note, "CCA-TEST-002", "discarded"}));
}

} // namespace
} // namespace cca::compiler
