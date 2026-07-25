#pragma once

#include <filesystem>
#include <memory>

#include "cca/compiler/diagnostics.hpp"
#include "cca/compiler/logging.hpp"

namespace cca::compiler {

/// Input accepted by the parser boundary in the foundation release.
struct ParseRequest final {
    std::filesystem::path source;
};

/// Parser module boundary. Syntax-tree semantics are intentionally deferred.
class Parser final {
  public:
    Parser();
    Parser(std::shared_ptr<ILogger> logger, std::shared_ptr<IDiagnosticSink> diagnostics);

    [[nodiscard]] Status parse(const ParseRequest& request) const;

  private:
    std::shared_ptr<ILogger> logger_;
    std::shared_ptr<IDiagnosticSink> diagnostics_;
};

} // namespace cca::compiler
