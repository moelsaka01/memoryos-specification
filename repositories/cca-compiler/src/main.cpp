#include <cstddef>
#include <exception>
#include <iostream>
#include <string_view>
#include <vector>

#include "cca/compiler/cli.hpp"

int main(const int argc, char* argv[]) {
    std::vector<std::string_view> arguments;
    if (argc > 1) {
        arguments.reserve(static_cast<std::size_t>(argc - 1));
    }
    for (int index = 1; index < argc; ++index) {
        arguments.emplace_back(argv[index]);
    }

    try {
        cca::compiler::Cli cli{std::cout, std::cerr};
        return cli.run(arguments);
    } catch (const std::exception& exception) {
        std::cerr << "cca: internal error: " << exception.what() << '\n';
    } catch (...) {
        std::cerr << "cca: unknown internal error\n";
    }
    return static_cast<int>(cca::compiler::CliExitCode::software_error);
}
