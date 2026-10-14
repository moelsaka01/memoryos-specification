#include <memoryos/memoryos.hpp>

#include <fstream>
#include <iostream>
#include <iterator>
#include <stdexcept>
#include <string>
#include <utility>

namespace {

[[nodiscard]] std::string readText(const char* path) {
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
        memoryos::ObserveOptions baselineOptions;
        baselineOptions.identifier = "cpp-regression-baseline";
        const auto baseline = memory.observe(
            workspace,
            readText(MEMORYOS_SDK_REFERENCE_SNAPSHOT),
            std::move(baselineOptions));
        memoryos::ObserveOptions candidateOptions;
        candidateOptions.identifier = "cpp-regression-candidate";
        const auto candidate = memory.observe(
            workspace,
            readText(MEMORYOS_SDK_CHANGED_SNAPSHOT),
            std::move(candidateOptions));
        const auto report = memory.regression(baseline, candidate);
        if (!report.regressionDetected() ||
            report.overall() != "regressionDetected") {
            return 1;
        }
        std::cout << report.canonicalJson() << '\n';
        return 0;
    } catch (const std::exception& error) {
        std::cerr << error.what() << '\n';
        return 1;
    }
}
