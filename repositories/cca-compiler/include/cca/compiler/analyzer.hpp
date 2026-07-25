#pragma once

#include <filesystem>
#include <memory>

#include "cca/compiler/diagnostics.hpp"
#include "cca/compiler/logging.hpp"

namespace cca::compiler {

/// Input accepted by the analysis boundary in the foundation release.
struct AnalysisRequest final {
    std::filesystem::path source;
};

/// Analyzer module boundary. Semantic models are intentionally deferred.
class Analyzer final {
  public:
    Analyzer();
    Analyzer(std::shared_ptr<ILogger> logger, std::shared_ptr<IDiagnosticSink> diagnostics);

    [[nodiscard]] Status analyze(const AnalysisRequest& request) const;

  private:
    std::shared_ptr<ILogger> logger_;
    std::shared_ptr<IDiagnosticSink> diagnostics_;
};

} // namespace cca::compiler
