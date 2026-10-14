#pragma once

#include <filesystem>
#include <memory>
#include <optional>

#include "cca/compiler/canonical_value.hpp"
#include "cca/compiler/diagnostics.hpp"
#include "cca/compiler/logging.hpp"
#include "cca/compiler/source_loader.hpp"

namespace cca::compiler {

/// Compatibility request that asks the parser to load a path directly.
struct ParseRequest final {
    std::filesystem::path source;
};

struct ParsedDocument final {
    std::filesystem::path source_path;
    CanonicalValue root;

    [[nodiscard]] bool operator==(const ParsedDocument&) const = default;
};

struct ParseResult final {
    std::optional<ParsedDocument> document;
    ValidationResult validation;

    [[nodiscard]] bool ok() const noexcept;
};

/// Converts one UTF-8 YAML source into the format-independent canonical tree.
class Parser final {
  public:
    Parser();
    Parser(std::shared_ptr<ILogger> logger, std::shared_ptr<IDiagnosticSink> diagnostics);

    [[nodiscard]] ParseResult parse(const SourceDocument& source) const;

    /// IM-001 compatibility overload. New orchestration should inject and call
    /// ISourceLoader before parse(SourceDocument).
    [[nodiscard]] Status parse(const ParseRequest& request) const;

  private:
    std::shared_ptr<ILogger> logger_;
    std::shared_ptr<IDiagnosticSink> diagnostics_;
};

} // namespace cca::compiler
