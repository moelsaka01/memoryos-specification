#pragma once

#include <filesystem>
#include <memory>

#include "cca/compiler/diagnostics.hpp"
#include "cca/compiler/logging.hpp"
#include "cca/compiler/parser.hpp"

namespace cca::compiler {

/// Compatibility request that validates a source path end-to-end.
struct ValidationRequest final {
    std::filesystem::path source;
};

/// Validates the normative canonical-schema structure before semantic analysis.
class Validator final {
  public:
    Validator();
    Validator(std::shared_ptr<ILogger> logger, std::shared_ptr<IDiagnosticSink> diagnostics);

    [[nodiscard]] ValidationResult validate(const ParsedDocument& document) const;

    /// IM-001 compatibility overload.
    [[nodiscard]] Status validate(const ValidationRequest& request) const;

  private:
    std::shared_ptr<ILogger> logger_;
    std::shared_ptr<IDiagnosticSink> diagnostics_;
};

} // namespace cca::compiler
