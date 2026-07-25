#include "cca/compiler/parser.hpp"

#include <stdexcept>
#include <utility>

namespace cca::compiler {

Parser::Parser() : Parser{std::make_shared<NullLogger>(), std::make_shared<NullDiagnosticSink>()} {}

Parser::Parser(std::shared_ptr<ILogger> logger, std::shared_ptr<IDiagnosticSink> diagnostics)
    : logger_{std::move(logger)}, diagnostics_{std::move(diagnostics)} {
    if (!logger_ || !diagnostics_) {
        throw std::invalid_argument("parser dependencies must not be null");
    }
}

Status Parser::parse(const ParseRequest& request) const {
    if (request.source.empty()) {
        auto status = Status::invalid_argument("parser source path must not be empty");
        diagnostics_->report({DiagnosticSeverity::error, "CCA-PARSER-001", status.message()});
        logger_->log({LogLevel::error, "parser", status.message()});
        return status;
    }

    auto status = Status::not_implemented("parser is not implemented in the foundation release");
    diagnostics_->report({DiagnosticSeverity::note, "CCA-PARSER-900", status.message()});
    logger_->log({LogLevel::info, "parser", status.message()});
    return status;
}

} // namespace cca::compiler
