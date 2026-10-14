#pragma once

#include <filesystem>
#include <optional>
#include <string>

#include "cca/compiler/diagnostics.hpp"

namespace cca::compiler {

/// Immutable UTF-8 source supplied to the parser.
struct SourceDocument final {
    std::filesystem::path path;
    std::string content;

    [[nodiscard]] bool operator==(const SourceDocument&) const = default;
};

/// Result of loading one canonical specification source.
struct LoadResult final {
    std::optional<SourceDocument> document;
    ValidationResult validation;

    [[nodiscard]] bool ok() const noexcept;
};

/// Injectable source boundary used by the compiler pipeline and tests.
class ISourceLoader {
  public:
    virtual ~ISourceLoader() = default;

    [[nodiscard]] virtual LoadResult load(const std::filesystem::path& path) const = 0;
};

/// Binary file loader that validates UTF-8 and removes one optional UTF-8 BOM.
class FileSourceLoader final : public ISourceLoader {
  public:
    [[nodiscard]] LoadResult load(const std::filesystem::path& path) const override;
};

} // namespace cca::compiler
