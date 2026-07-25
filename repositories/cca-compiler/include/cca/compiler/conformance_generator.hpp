#pragma once

#include <filesystem>
#include <memory>

#include "cca/compiler/diagnostics.hpp"
#include "cca/compiler/logging.hpp"

namespace cca::compiler {

/// Input accepted by the conformance-generation boundary.
struct ConformanceGenerationRequest final {
    std::filesystem::path source;
    std::filesystem::path output_directory;
};

/// Conformance generator boundary. Suite schemas are intentionally deferred.
class ConformanceGenerator final {
  public:
    ConformanceGenerator();
    ConformanceGenerator(std::shared_ptr<ILogger> logger,
                         std::shared_ptr<IDiagnosticSink> diagnostics);

    [[nodiscard]] Status generate(const ConformanceGenerationRequest& request) const;

  private:
    std::shared_ptr<ILogger> logger_;
    std::shared_ptr<IDiagnosticSink> diagnostics_;
};

} // namespace cca::compiler
