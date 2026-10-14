#include <gtest/gtest.h>
#include <memory>
#include <string>
#include <vector>

#include "cca/compiler/diagnostics.hpp"

namespace cca::compiler {
namespace {

TEST(DiagnosticsTest, CompatibilityConstructorCreatesStableIdentifier) {
    const Diagnostic diagnostic{DiagnosticSeverity::warning, "CCA-TEST-001", "example"};

    EXPECT_EQ(diagnostic.identifier, "CCA-TEST-001");
    EXPECT_EQ(diagnostic.code, "CCA-TEST-001");
    EXPECT_EQ(diagnostic.message, "example");
    EXPECT_EQ(diagnostic.category, "general");
}

TEST(DiagnosticsTest, FullDiagnosticPreservesActionableFields) {
    const Diagnostic diagnostic{"CCA-TEST-002:item",
                                "CCA-TEST-002",
                                DiagnosticSeverity::error,
                                "invalid item",
                                "Replace it.",
                                DiagnosticLocation{"spec.yaml", 4, 9},
                                "schema"};

    EXPECT_EQ(diagnostic.identifier, "CCA-TEST-002:item");
    EXPECT_EQ(diagnostic.suggestion, "Replace it.");
    EXPECT_EQ(diagnostic.location, (DiagnosticLocation{"spec.yaml", 4, 9}));
    EXPECT_EQ(diagnostic.category, "schema");
}

TEST(DiagnosticsTest, ValidationResultSortsAndCountsDiagnostics) {
    ValidationResult result;
    result.add({"second",
                "CCA-B",
                DiagnosticSeverity::warning,
                "warning",
                "review",
                {"b.yaml", 1, 1},
                "test"});
    result.add(
        {"first", "CCA-A", DiagnosticSeverity::error, "error", "fix", {"a.yaml", 2, 1}, "test"});

    ASSERT_EQ(result.diagnostics().size(), 2U);
    EXPECT_EQ(result.diagnostics().front().identifier, "first");
    EXPECT_TRUE(result.has_errors());
    EXPECT_EQ(result.error_count(), 1U);
    EXPECT_EQ(result.warning_count(), 1U);
    EXPECT_FALSE(result.empty());
}

TEST(DiagnosticsTest, ValidationResultMergesInDeterministicOrder) {
    ValidationResult left{{Diagnostic{
        "left", "CCA-Z", DiagnosticSeverity::note, "later", "", {"same.yaml", 9, 1}, "test"}}};
    const ValidationResult right{{Diagnostic{"right",
                                             "CCA-A",
                                             DiagnosticSeverity::warning,
                                             "earlier",
                                             "",
                                             {"same.yaml", 1, 1},
                                             "test"}}};

    left.merge(right);

    ASSERT_EQ(left.diagnostics().size(), 2U);
    EXPECT_EQ(left.diagnostics().front().identifier, "right");
}

TEST(DiagnosticsTest, CollectorReturnsSortedSnapshotAndClears) {
    CollectingDiagnosticSink sink;
    sink.report(
        {"later", "CCA-B", DiagnosticSeverity::note, "later", "", {"z.yaml", 1, 1}, "test"});
    sink.report(
        {"earlier", "CCA-A", DiagnosticSeverity::note, "earlier", "", {"a.yaml", 1, 1}, "test"});

    const auto snapshot = sink.snapshot();
    ASSERT_EQ(snapshot.size(), 2U);
    EXPECT_EQ(snapshot.front().identifier, "earlier");

    sink.clear();
    EXPECT_TRUE(sink.snapshot().empty());
}

TEST(DiagnosticsTest, StatusFactoriesPreserveCodesAndMessages) {
    EXPECT_TRUE(Status::success().ok());
    EXPECT_EQ(Status::invalid_argument("bad").code(), StatusCode::invalid_argument);
    EXPECT_EQ(Status::not_implemented("later").message(), "later");
    EXPECT_EQ(Status::internal_error("failure").code(), StatusCode::internal_error);
}

TEST(DiagnosticsTest, SeverityStringsAreStable) {
    EXPECT_EQ(to_string(DiagnosticSeverity::note), "note");
    EXPECT_EQ(to_string(DiagnosticSeverity::warning), "warning");
    EXPECT_EQ(to_string(DiagnosticSeverity::error), "error");
}

TEST(DiagnosticsTest, NullSinkSupportsPolymorphicInjection) {
    const std::shared_ptr<IDiagnosticSink> sink = std::make_shared<NullDiagnosticSink>();
    EXPECT_NO_THROW(sink->report({DiagnosticSeverity::note, "CCA-TEST-003", "discarded"}));
}

} // namespace
} // namespace cca::compiler
