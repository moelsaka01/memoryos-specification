#pragma once

#include <iosfwd>
#include <memory>
#include <span>
#include <string_view>

#include "cca/compiler/configuration.hpp"

namespace cca::compiler {

/// Deterministic foundation-release exit codes used by the `cca` executable.
enum class CliExitCode : int {
    success = 0,
    usage_error = 2,
    unavailable = 69,
    software_error = 70,
};

/// Command-line dispatcher with injected output streams and configuration.
class Cli final {
  public:
    Cli(std::ostream& output,
        std::ostream& error,
        CompilerConfiguration configuration = CompilerConfiguration::defaults());
    ~Cli();

    Cli(const Cli&) = delete;
    Cli& operator=(const Cli&) = delete;
    Cli(Cli&&) noexcept;
    Cli& operator=(Cli&&) noexcept;

    /// Runs with arguments that do not include the executable name.
    [[nodiscard]] int run(std::span<const std::string_view> arguments) const;

  private:
    class Impl;
    std::unique_ptr<Impl> impl_;
};

} // namespace cca::compiler
