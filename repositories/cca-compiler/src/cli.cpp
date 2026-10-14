#include "cca/compiler/cli.hpp"

#include <algorithm>
#include <ostream>
#include <stdexcept>
#include <string>
#include <utility>

#include "cca/compiler/serialization.hpp"
#include "cca/compiler/version.hpp"

namespace cca::compiler {
namespace {

constexpr std::string_view help_text{
    "CCA Standards Compiler\n"
    "Usage: cca <command> <specification.yaml> [--output <directory>]\n"
    "\n"
    "Commands:\n"
    "  validate <source>            Validate a canonical specification\n"
    "  compile <source>             Run the complete standards compiler pipeline\n"
    "  analyze <source>             Analyze objects and dependencies\n"
    "  report <source>              Generate deterministic specification reports\n"
    "  doctor                       Report compiler readiness as JSON\n"
    "  version                      Print the compiler version\n"
    "  help                         Show this help\n"
    "\n"
    "Options:\n"
    "  -o, --output <directory>     Artifact output directory (default: cca-out)\n"
    "  -h, --help                   Show this help\n"
    "  --version                    Print the compiler version\n"};

[[nodiscard]] constexpr int exit_code(const CliExitCode code) noexcept {
    return static_cast<int>(code);
}

[[nodiscard]] std::string_view command_name(const CompilerCommand command) noexcept {
    switch (command) {
    case CompilerCommand::validate:
        return "validate";
    case CompilerCommand::compile:
        return "compile";
    case CompilerCommand::analyze:
        return "analyze";
    case CompilerCommand::report:
        return "report";
    }
    return "unknown";
}

[[nodiscard]] std::string usage_error_json(const std::string_view command,
                                           const std::string_view code,
                                           const std::string_view message) {
    return "{\"command\":" + json_string(command) + ",\"error\":{\"code\":" + json_string(code) +
           ",\"message\":" + json_string(message) + "},\"status\":\"error\"}";
}

void write_json_line(std::ostream& stream, const std::string& json) {
    stream << json;
    if (json.empty() || json.back() != '\n') {
        stream << '\n';
    }
}

class UnconfiguredCommandService final : public ICommandService {
  public:
    [[nodiscard]] CommandResult execute(const CommandRequest& request) const override {
        const auto command = command_name(request.command);
        return {
            CliExitCode::software_error,
            "{\"command\":" + json_string(command) +
                ",\"error\":{\"code\":\"CCA-CLI-004\",\"message\":"
                "\"compiler command service is not configured\"},\"status\":\"error\"}",
        };
    }
};

[[nodiscard]] bool is_command(const std::string_view value) noexcept {
    return value == "validate" || value == "compile" || value == "analyze" || value == "report";
}

[[nodiscard]] CompilerCommand parse_command(const std::string_view value) {
    if (value == "validate") {
        return CompilerCommand::validate;
    }
    if (value == "compile") {
        return CompilerCommand::compile;
    }
    if (value == "analyze") {
        return CompilerCommand::analyze;
    }
    if (value == "report") {
        return CompilerCommand::report;
    }
    throw std::invalid_argument{"unknown compiler command"};
}

} // namespace

class Cli::Impl final {
  public:
    Impl(std::ostream& output,
         std::ostream& error,
         std::shared_ptr<const ICommandService> command_service,
         CompilerConfiguration configuration)
        : output_{output}, error_{error}, command_service_{std::move(command_service)},
          configuration_{std::move(configuration)} {
        if (!command_service_) {
            throw std::invalid_argument{"command service must not be null"};
        }
    }

    [[nodiscard]] int run(const std::span<const std::string_view> arguments) const {
        if (arguments.empty() || arguments.front() == "help" || arguments.front() == "--help" ||
            arguments.front() == "-h") {
            output_ << help_text;
            return exit_code(CliExitCode::success);
        }

        const auto command = arguments.front();
        if (command == "version" || command == "--version") {
            output_ << "cca " << compiler_version << '\n';
            return exit_code(CliExitCode::success);
        }
        if (command == "doctor") {
            return run_doctor(arguments);
        }
        if (is_command(command)) {
            return run_compiler_command(parse_command(command), arguments);
        }

        write_json_line(
            error_,
            usage_error_json(command, "CCA-CLI-001", "unknown command; run 'cca help' for usage"));
        return exit_code(CliExitCode::usage_error);
    }

  private:
    [[nodiscard]] int run_doctor(const std::span<const std::string_view> arguments) const {
        if (arguments.size() != 1) {
            write_json_line(
                error_,
                usage_error_json("doctor", "CCA-CLI-002", "doctor does not accept arguments"));
            return exit_code(CliExitCode::usage_error);
        }

        const auto configuration_status = configuration_.validate();
        if (!configuration_status.ok()) {
            write_json_line(
                error_, usage_error_json("doctor", "CCA-CLI-005", configuration_status.message()));
            return exit_code(CliExitCode::software_error);
        }

        output_ << "{\"command\":\"doctor\",\"compiler_version\":" << json_string(compiler_version)
                << ",\"format_version\":\"1.x\",\"status\":\"ready\"}\n";
        return exit_code(CliExitCode::success);
    }

    [[nodiscard]] int
    run_compiler_command(const CompilerCommand command,
                         const std::span<const std::string_view> arguments) const {
        const auto name = command_name(command);
        if (arguments.size() < 2 || arguments[1].empty() || arguments[1].starts_with('-')) {
            write_json_line(
                error_,
                usage_error_json(name, "CCA-CLI-002", "command requires <specification.yaml>"));
            return exit_code(CliExitCode::usage_error);
        }

        std::filesystem::path output_directory = configuration_.output_directory();
        bool output_seen = false;
        for (std::size_t index = 2; index < arguments.size(); ++index) {
            const auto argument = arguments[index];
            if (argument != "--output" && argument != "-o") {
                write_json_line(
                    error_,
                    usage_error_json(name, "CCA-CLI-003", "unexpected command-line argument"));
                return exit_code(CliExitCode::usage_error);
            }
            if (output_seen || index + 1 >= arguments.size() || arguments[index + 1].empty()) {
                write_json_line(error_,
                                usage_error_json(name, "CCA-CLI-003", "invalid --output option"));
                return exit_code(CliExitCode::usage_error);
            }
            output_directory = std::filesystem::path{arguments[++index]};
            output_seen = true;
        }

        const CommandRequest request{
            .command = command,
            .source = std::filesystem::path{arguments[1]},
            .output_directory = std::move(output_directory),
        };
        const auto result = command_service_->execute(request);
        auto& stream = result.exit_code == CliExitCode::success ? output_ : error_;
        write_json_line(stream, result.json);
        return exit_code(result.exit_code);
    }

    std::ostream& output_;
    std::ostream& error_;
    std::shared_ptr<const ICommandService> command_service_;
    CompilerConfiguration configuration_;
};

Cli::Cli(std::ostream& output, std::ostream& error, CompilerConfiguration configuration)
    : Cli{output, error, std::make_shared<UnconfiguredCommandService>(), std::move(configuration)} {
}

Cli::Cli(std::ostream& output,
         std::ostream& error,
         std::shared_ptr<const ICommandService> command_service,
         CompilerConfiguration configuration)
    : impl_{std::make_unique<Impl>(
          output, error, std::move(command_service), std::move(configuration))} {}

Cli::~Cli() = default;

Cli::Cli(Cli&&) noexcept = default;

Cli& Cli::operator=(Cli&&) noexcept = default;

int Cli::run(const std::span<const std::string_view> arguments) const {
    return impl_->run(arguments);
}

} // namespace cca::compiler
