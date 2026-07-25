#pragma once

#include <filesystem>
#include <memory>

#include "cca/compiler/diagnostics.hpp"
#include "cca/compiler/logging.hpp"

namespace cca::compiler {

/// Input accepted by the artifact-generation boundary.
struct ArtifactGenerationRequest final {
    std::filesystem::path source;
    std::filesystem::path output_directory;
};

/// Artifact generator boundary. Artifact formats are intentionally deferred.
class ArtifactGenerator final {
  public:
    ArtifactGenerator();
    ArtifactGenerator(std::shared_ptr<ILogger> logger,
                      std::shared_ptr<IDiagnosticSink> diagnostics);

    [[nodiscard]] Status generate(const ArtifactGenerationRequest& request) const;

  private:
    std::shared_ptr<ILogger> logger_;
    std::shared_ptr<IDiagnosticSink> diagnostics_;
};

} // namespace cca::compiler
