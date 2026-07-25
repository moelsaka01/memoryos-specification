#include "cca/compiler/validator.hpp"

#include <stdexcept>
#include <utility>

namespace cca::compiler {

Validator::Validator()
    : Validator{std::make_shared<NullLogger>(), std::make_shared<NullDiagnosticSink>()} {}

Validator::Validator(std::shared_ptr<ILogger> logger, std::shared_ptr<IDiagnosticSink> diagnostics)
    : logger_{std::move(logger)}, diagnostics_{std::move(diagnostics)} {
    if (!logger_ || !diagnostics_) {
        throw std::invalid_argument("validator dependencies must not be null");
    }
}

Status Validator::validate(const ValidationRequest& request) const {
    if (request.source.empty()) {
        auto status = Status::invalid_argument("validator source path must not be empty");
        diagnostics_->report({DiagnosticSeverity::error, "CCA-VALIDATOR-001", status.message()});
        logger_->log({LogLevel::error, "validator", status.message()});
        return status;
    }

    auto status = Status::not_implemented("validator is not implemented in the foundation release");
    diagnostics_->report({DiagnosticSeverity::note, "CCA-VALIDATOR-900", status.message()});
    logger_->log({LogLevel::info, "validator", status.message()});
    return status;
}

} // namespace cca::compiler
