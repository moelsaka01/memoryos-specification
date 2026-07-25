#pragma once

#include <filesystem>
#include <memory>

#include "cca/compiler/diagnostics.hpp"
#include "cca/compiler/logging.hpp"

namespace cca::compiler {

/// Input accepted by the validation boundary in the foundation release.
struct ValidationRequest final {
    std::filesystem::path source;
};

/// Validator module boundary. Validation rules are intentionally deferred.
class Validator final {
  public:
    Validator();
    Validator(std::shared_ptr<ILogger> logger, std::shared_ptr<IDiagnosticSink> diagnostics);

    [[nodiscard]] Status validate(const ValidationRequest& request) const;

  private:
    std::shared_ptr<ILogger> logger_;
    std::shared_ptr<IDiagnosticSink> diagnostics_;
};

} // namespace cca::compiler
