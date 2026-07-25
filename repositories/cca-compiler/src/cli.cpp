#include "cca/compiler/cli.hpp"

#include <ostream>
#include <string_view>
#include <utility>

#include "cca/compiler/version.hpp"

namespace cca::compiler {
namespace {

constexpr std::string_view help_text{
    "CCA Compiler\n"
    "Usage: cca <command> [arguments]\n"
    "\n"
    "Commands:\n"
    "  compile <source>             Compile a CCA source (placeholder)\n"
    "  validate <source>            Validate a CCA source (placeholder)\n"
    "  generate <source> [output]   Generate CCA artifacts (placeholder)\n"
    "  doctor                       Report foundation readiness\n"
    "  version                      Print the compiler version\n"
    "  help                         Show this help\n"};

[[nodiscard]] constexpr int exit_code(const CliExitCode code) noexcept {
    return static_cast<int>(code);
}

} // namespace

class Cli::Impl final {
  public:
    Impl(std::ostream& output, std::ostream& error, CompilerConfiguration configuration)
        : output_{output}, error_{error}, configuration_{std::move(configuration)} {}

    [[nodiscard]] int run(const std::span<const std::string_view> arguments) const {
        if (arguments.empty() || arguments.front() == "help") {
            output_ << help_text;
            return exit_code(CliExitCode::success);
        }

        const auto command = arguments.front();
        if (command == "version") {
            output_ << "cca " << compiler_version << '\n';
            return exit_code(CliExitCode::success);
        }
        if (command == "doctor") {
            return run_doctor();
        }
        if (command == "compile" || command == "validate" || command == "generate") {
            return run_placeholder(command, arguments);
        }

        error_ << "cca: unknown command '" << command << "'.\n"
               << "Run 'cca help' for usage.\n";
        return exit_code(CliExitCode::usage_error);
    }

  private:
    [[nodiscard]] int run_doctor() const {
        const auto configuration_status = configuration_.validate();
        if (!configuration_status.ok()) {
            error_ << "cca doctor: " << configuration_status.message() << '\n';
            return exit_code(CliExitCode::software_error);
        }

        output_ << "CCA compiler doctor\n"
                << "status: foundation-ready\n"
                << "compiler pipeline: not implemented\n";
        return exit_code(CliExitCode::success);
    }

    [[nodiscard]] int run_placeholder(const std::string_view command,
                                      const std::span<const std::string_view> arguments) const {
        if (arguments.size() < 2 || arguments[1].empty()) {
            error_ << "cca: " << command << " requires <source>.\n";
            return exit_code(CliExitCode::usage_error);
        }

        error_ << "cca: " << command << " is not implemented in the foundation release.\n";
        return exit_code(CliExitCode::unavailable);
    }

    std::ostream& output_;
    std::ostream& error_;
    CompilerConfiguration configuration_;
};

Cli::Cli(std::ostream& output, std::ostream& error, CompilerConfiguration configuration)
    : impl_{std::make_unique<Impl>(output, error, std::move(configuration))} {}

Cli::~Cli() = default;

Cli::Cli(Cli&&) noexcept = default;

Cli& Cli::operator=(Cli&&) noexcept = default;

int Cli::run(const std::span<const std::string_view> arguments) const {
    return impl_->run(arguments);
}

} // namespace cca::compiler
