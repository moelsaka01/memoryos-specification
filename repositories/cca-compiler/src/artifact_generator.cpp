#include "cca/compiler/artifact_generator.hpp"

#include <stdexcept>
#include <utility>

namespace cca::compiler {

ArtifactGenerator::ArtifactGenerator()
    : ArtifactGenerator{std::make_shared<NullLogger>(), std::make_shared<NullDiagnosticSink>()} {}

ArtifactGenerator::ArtifactGenerator(std::shared_ptr<ILogger> logger,
                                     std::shared_ptr<IDiagnosticSink> diagnostics)
    : logger_{std::move(logger)}, diagnostics_{std::move(diagnostics)} {
    if (!logger_ || !diagnostics_) {
        throw std::invalid_argument("artifact generator dependencies must not be null");
    }
}

Status ArtifactGenerator::generate(const ArtifactGenerationRequest& request) const {
    if (request.source.empty() || request.output_directory.empty()) {
        auto status = Status::invalid_argument(
            "artifact generator source and output directory must not be empty");
        diagnostics_->report({DiagnosticSeverity::error, "CCA-ARTIFACT-001", status.message()});
        logger_->log({LogLevel::error, "artifact-generator", status.message()});
        return status;
    }

    auto status =
        Status::not_implemented("artifact generation is not implemented in the foundation release");
    diagnostics_->report({DiagnosticSeverity::note, "CCA-ARTIFACT-900", status.message()});
    logger_->log({LogLevel::info, "artifact-generator", status.message()});
    return status;
}

} // namespace cca::compiler
