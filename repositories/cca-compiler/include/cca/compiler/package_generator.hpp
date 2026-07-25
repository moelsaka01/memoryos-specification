#pragma once

#include <filesystem>
#include <memory>

#include "cca/compiler/diagnostics.hpp"
#include "cca/compiler/logging.hpp"

namespace cca::compiler {

/// Input accepted by the package-generation boundary.
struct PackageGenerationRequest final {
    std::filesystem::path input_directory;
    std::filesystem::path output_package;
};

/// Package generator boundary. Package formats are intentionally deferred.
class PackageGenerator final {
  public:
    PackageGenerator();
    PackageGenerator(std::shared_ptr<ILogger> logger, std::shared_ptr<IDiagnosticSink> diagnostics);

    [[nodiscard]] Status generate(const PackageGenerationRequest& request) const;

  private:
    std::shared_ptr<ILogger> logger_;
    std::shared_ptr<IDiagnosticSink> diagnostics_;
};

} // namespace cca::compiler
