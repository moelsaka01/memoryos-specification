#include "cca/compiler/package_generator.hpp"

#include <stdexcept>
#include <utility>

namespace cca::compiler {

PackageGenerator::PackageGenerator()
    : PackageGenerator{std::make_shared<NullLogger>(), std::make_shared<NullDiagnosticSink>()} {}

PackageGenerator::PackageGenerator(std::shared_ptr<ILogger> logger,
                                   std::shared_ptr<IDiagnosticSink> diagnostics)
    : logger_{std::move(logger)}, diagnostics_{std::move(diagnostics)} {
    if (!logger_ || !diagnostics_) {
        throw std::invalid_argument("package generator dependencies must not be null");
    }
}

Status PackageGenerator::generate(const PackageGenerationRequest& request) const {
    if (request.input_directory.empty() || request.output_package.empty()) {
        auto status = Status::invalid_argument(
            "package generator input directory and output package must not be empty");
        diagnostics_->report({DiagnosticSeverity::error, "CCA-PACKAGE-001", status.message()});
        logger_->log({LogLevel::error, "package-generator", status.message()});
        return status;
    }

    auto status =
        Status::not_implemented("package generation is not implemented in the foundation release");
    diagnostics_->report({DiagnosticSeverity::note, "CCA-PACKAGE-900", status.message()});
    logger_->log({LogLevel::info, "package-generator", status.message()});
    return status;
}

} // namespace cca::compiler
