#include <cstddef>
#include <exception>
#include <iostream>
#include <memory>
#include <string_view>
#include <vector>

#include "cca/compiler/cli.hpp"
#include "cca/compiler/compiler_service.hpp"
#include "cca/compiler/serialization.hpp"

int main(const int argc, char* argv[]) {
    std::vector<std::string_view> arguments;
    if (argc > 1) {
        arguments.reserve(static_cast<std::size_t>(argc - 1));
    }
    for (int index = 1; index < argc; ++index) {
        arguments.emplace_back(argv[index]);
    }

    try {
        const auto command_service = std::make_shared<cca::compiler::CompilerCommandService>();
        cca::compiler::Cli cli{std::cout, std::cerr, std::move(command_service)};
        return cli.run(arguments);
    } catch (const std::exception& exception) {
        std::cerr << "{\"error\":{\"code\":\"CCA-CLI-999\",\"message\":"
                  << cca::compiler::json_string(exception.what()) << "},\"status\":\"error\"}\n";
    } catch (...) {
        std::cerr << "{\"error\":{\"code\":\"CCA-CLI-999\",\"message\":"
                     "\"unknown internal error\"},\"status\":\"error\"}\n";
    }
    return static_cast<int>(cca::compiler::CliExitCode::software_error);
}
