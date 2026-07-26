#pragma once

#include <optional>

#include "cca/compiler/diagnostics.hpp"
#include "cca/compiler/internal_model.hpp"
#include "cca/compiler/parser.hpp"

namespace cca::compiler {

/// Result of converting a validated canonical tree into the typed model.
struct ModelBuildResult final {
    std::optional<Specification> specification;
    ValidationResult validation;

    [[nodiscard]] bool ok() const noexcept;
};

/// Builds the architecture-neutral internal model without performing I/O.
class ModelBuilder final {
  public:
    [[nodiscard]] ModelBuildResult build(const ParsedDocument& document) const;
};

} // namespace cca::compiler
