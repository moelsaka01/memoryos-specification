#pragma once

#include <filesystem>
#include <memory>

#include "cca/compiler/diagnostics.hpp"
#include "cca/compiler/logging.hpp"

namespace cca::compiler {

/// Input accepted by the documentation-generation boundary.
struct DocumentationGenerationRequest final {
    std::filesystem::path source;
    std::filesystem::path output_directory;
};

/// Documentation generator boundary. Output formats are intentionally deferred.
class DocumentationGenerator final {
  public:
    DocumentationGenerator();
    DocumentationGenerator(std::shared_ptr<ILogger> logger,
                           std::shared_ptr<IDiagnosticSink> diagnostics);

    [[nodiscard]] Status generate(const DocumentationGenerationRequest& request) const;

  private:
    std::shared_ptr<ILogger> logger_;
    std::shared_ptr<IDiagnosticSink> diagnostics_;
};

} // namespace cca::compiler
