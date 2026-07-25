#include "cca/compiler/analyzer.hpp"

#include <stdexcept>
#include <utility>

namespace cca::compiler {

Analyzer::Analyzer()
    : Analyzer{std::make_shared<NullLogger>(), std::make_shared<NullDiagnosticSink>()} {}

Analyzer::Analyzer(std::shared_ptr<ILogger> logger, std::shared_ptr<IDiagnosticSink> diagnostics)
    : logger_{std::move(logger)}, diagnostics_{std::move(diagnostics)} {
    if (!logger_ || !diagnostics_) {
        throw std::invalid_argument("analyzer dependencies must not be null");
    }
}

Status Analyzer::analyze(const AnalysisRequest& request) const {
    if (request.source.empty()) {
        auto status = Status::invalid_argument("analyzer source path must not be empty");
        diagnostics_->report({DiagnosticSeverity::error, "CCA-ANALYZER-001", status.message()});
        logger_->log({LogLevel::error, "analyzer", status.message()});
        return status;
    }

    auto status = Status::not_implemented("analyzer is not implemented in the foundation release");
    diagnostics_->report({DiagnosticSeverity::note, "CCA-ANALYZER-900", status.message()});
    logger_->log({LogLevel::info, "analyzer", status.message()});
    return status;
}

} // namespace cca::compiler
