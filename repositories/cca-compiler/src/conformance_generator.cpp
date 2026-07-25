#include "cca/compiler/conformance_generator.hpp"

#include <stdexcept>
#include <utility>

namespace cca::compiler {

ConformanceGenerator::ConformanceGenerator()
    : ConformanceGenerator{std::make_shared<NullLogger>(), std::make_shared<NullDiagnosticSink>()} {
}

ConformanceGenerator::ConformanceGenerator(std::shared_ptr<ILogger> logger,
                                           std::shared_ptr<IDiagnosticSink> diagnostics)
    : logger_{std::move(logger)}, diagnostics_{std::move(diagnostics)} {
    if (!logger_ || !diagnostics_) {
        throw std::invalid_argument("conformance generator dependencies must not be null");
    }
}

Status ConformanceGenerator::generate(const ConformanceGenerationRequest& request) const {
    if (request.source.empty() || request.output_directory.empty()) {
        auto status = Status::invalid_argument(
            "conformance generator source and output directory must not be empty");
        diagnostics_->report({DiagnosticSeverity::error, "CCA-CONFORMANCE-001", status.message()});
        logger_->log({LogLevel::error, "conformance-generator", status.message()});
        return status;
    }

    auto status = Status::not_implemented(
        "conformance generation is not implemented in the foundation release");
    diagnostics_->report({DiagnosticSeverity::note, "CCA-CONFORMANCE-900", status.message()});
    logger_->log({LogLevel::info, "conformance-generator", status.message()});
    return status;
}

} // namespace cca::compiler
