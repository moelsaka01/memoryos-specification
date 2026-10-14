#include <memoryos/memoryos.hpp>

#include <fstream>
#include <iostream>
#include <iterator>
#include <stdexcept>
#include <string>

namespace {

std::string readText(const char* path) {
    std::ifstream input{path, std::ios::binary};
    if (!input) {
        throw std::runtime_error{"cannot open the deterministic observation"};
    }
    return {std::istreambuf_iterator<char>{input},
            std::istreambuf_iterator<char>{}};
}

} // namespace

int main() {
    try {
        memoryos::MemoryOS memory;
        const auto workspace = memory.openWorkspace("workspace-memoryos-release");
        auto investigation = memory.observe(
            workspace, readText(MEMORYOS_SDK_REFERENCE_SNAPSHOT));
        investigation = investigation.trace(
            "reflection:reflection-release-integrity:0");
        auto replay = investigation.replay().next();
        const auto verification = replay.investigation().verify();
        if (!verification.valid()) {
            return 1;
        }
        std::cout << replay.investigation().identifier() << '\n';
        return 0;
    } catch (const std::exception& error) {
        std::cerr << error.what() << '\n';
        return 1;
    }
}
