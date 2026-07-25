#include "cca/compiler/documentation_generator.hpp"

#include <stdexcept>
#include <utility>

namespace cca::compiler {

DocumentationGenerator::DocumentationGenerator()
    : DocumentationGenerator{std::make_shared<NullLogger>(),
                             std::make_shared<NullDiagnosticSink>()} {}

DocumentationGenerator::DocumentationGenerator(std::shared_ptr<ILogger> logger,
                                               std::shared_ptr<IDiagnosticSink> diagnostics)
    : logger_{std::move(logger)}, diagnostics_{std::move(diagnostics)} {
    if (!logger_ || !diagnostics_) {
        throw std::invalid_argument("documentation generator dependencies must not be null");
    }
}

Status DocumentationGenerator::generate(const DocumentationGenerationRequest& request) const {
    if (request.source.empty() || request.output_directory.empty()) {
        auto status = Status::invalid_argument(
            "documentation generator source and output directory must not be empty");
        diagnostics_->report(
            {DiagnosticSeverity::error, "CCA-DOCUMENTATION-001", status.message()});
        logger_->log({LogLevel::error, "documentation-generator", status.message()});
        return status;
    }

    auto status = Status::not_implemented(
        "documentation generation is not implemented in the foundation release");
    diagnostics_->report({DiagnosticSeverity::note, "CCA-DOCUMENTATION-900", status.message()});
    logger_->log({LogLevel::info, "documentation-generator", status.message()});
    return status;
}

} // namespace cca::compiler
