#pragma once

#include <filesystem>
#include <vector>

#include "cca/compiler/diagnostics.hpp"
#include "cca/compiler/internal_model.hpp"

namespace cca::compiler {

/// Outcome of writing the deterministic IS-002 artifact bundle.
struct GenerationResult final {
    ValidationResult validation;
    std::vector<std::filesystem::path> files;
};

/// Writes architecture-neutral reports from the typed canonical model.
class ArtifactGenerator final {
  public:
    [[nodiscard]] GenerationResult generate(const Specification& specification,
                                            const ValidationResult& validation,
                                            const std::filesystem::path& output_directory) const;
};

} // namespace cca::compiler
