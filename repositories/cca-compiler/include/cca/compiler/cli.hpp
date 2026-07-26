#pragma once

#include <filesystem>
#include <iosfwd>
#include <memory>
#include <span>
#include <string>
#include <string_view>

#include "cca/compiler/configuration.hpp"

namespace cca::compiler {

/// Stable process exit codes used by the `cca` executable.
enum class CliExitCode : int {
    success = 0,
    validation_error = 1,
    usage_error = 2,
    unavailable = 69,
    software_error = 70,
};

/// Compilation operation selected by the command line.
enum class CompilerCommand {
    validate,
    compile,
    analyze,
    report,
};

/// Normalized request passed from the CLI parser to the compiler pipeline.
struct CommandRequest final {
    CompilerCommand command{CompilerCommand::validate};
    std::filesystem::path source;
    std::filesystem::path output_directory;

    [[nodiscard]] bool operator==(const CommandRequest&) const = default;
};

/// Fully formatted, deterministic response returned by a command service.
struct CommandResult final {
    CliExitCode exit_code{CliExitCode::success};
    std::string json;
};

/// Injectable command boundary implemented by the standards compiler pipeline.
class ICommandService {
  public:
    virtual ~ICommandService() = default;

    [[nodiscard]] virtual CommandResult execute(const CommandRequest& request) const = 0;
};

/// Deterministic command-line parser and dispatcher.
class Cli final {
  public:
    /// Creates a CLI without a compiler service. Useful for help, version, and doctor.
    Cli(std::ostream& output,
        std::ostream& error,
        CompilerConfiguration configuration = CompilerConfiguration::defaults());
    Cli(std::ostream& output,
        std::ostream& error,
        std::shared_ptr<const ICommandService> command_service,
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
