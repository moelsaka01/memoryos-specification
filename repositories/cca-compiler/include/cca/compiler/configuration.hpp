#pragma once

#include <filesystem>

#include "cca/compiler/diagnostics.hpp"
#include "cca/compiler/logging.hpp"

namespace cca::compiler {

/// Immutable compiler process configuration.
class CompilerConfiguration final {
  public:
    CompilerConfiguration(std::filesystem::path output_directory,
                          LogLevel minimum_log_level,
                          bool diagnostics_enabled);

    /// Returns the deterministic IS-002 compiler configuration.
    [[nodiscard]] static CompilerConfiguration defaults();

    [[nodiscard]] const std::filesystem::path& output_directory() const noexcept;
    [[nodiscard]] LogLevel minimum_log_level() const noexcept;
    [[nodiscard]] bool diagnostics_enabled() const noexcept;
    [[nodiscard]] Status validate() const;

  private:
    std::filesystem::path output_directory_;
    LogLevel minimum_log_level_;
    bool diagnostics_enabled_;
};

} // namespace cca::compiler
