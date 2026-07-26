#pragma once

#include <cstddef>
#include <filesystem>
#include <map>
#include <memory>
#include <string>
#include <vector>

#include "cca/compiler/diagnostics.hpp"
#include "cca/compiler/logging.hpp"
#include "cca/compiler/parser.hpp"

namespace cca::compiler {

/// Compatibility request for callers that used the IM-001 path-only seam.
struct AnalysisRequest final {
    std::filesystem::path source;
};

/// Deterministic, architecture-neutral facts discovered in a canonical document.
struct AnalysisSummary final {
    std::map<std::string, std::size_t> objects_by_type;
    std::vector<std::string> object_identifiers;
    std::size_t relationship_count{0};
    std::size_t dependency_count{0};

    [[nodiscard]] std::size_t object_count() const noexcept;
    [[nodiscard]] bool operator==(const AnalysisSummary&) const = default;
};

/// Result of semantic analysis before dependency resolution or model construction.
struct AnalysisResult final {
    AnalysisSummary summary;
    ValidationResult validation;

    [[nodiscard]] bool ok() const noexcept;
};

/// Performs deterministic identifier, reference, and relationship analysis.
///
/// The analyzer is stateless. It does not resolve dependency ordering and does
/// not construct the typed internal model.
class Analyzer final {
  public:
    Analyzer();
    Analyzer(std::shared_ptr<ILogger> logger, std::shared_ptr<IDiagnosticSink> diagnostics);

    [[nodiscard]] AnalysisResult analyze(const ParsedDocument& document) const;

    /// Retained for source compatibility; path-only analysis is not sufficient.
    [[nodiscard]] Status analyze(const AnalysisRequest& request) const;

  private:
    std::shared_ptr<ILogger> logger_;
    std::shared_ptr<IDiagnosticSink> diagnostics_;
};

} // namespace cca::compiler
