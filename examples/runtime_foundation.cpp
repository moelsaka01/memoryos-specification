#include <cca/runtime/runtime_builder.hpp>
#include <cca/runtime/runtime_host.hpp>

#include <cstdlib>
#include <iostream>
#include <utility>

namespace {

[[nodiscard]] int report(const cca::runtime::RuntimeResult& result) {
    std::cerr << result.code() << ": " << result.message() << '\n';
    return EXIT_FAILURE;
}

} // namespace

int main() {
    const cca::runtime::RuntimeId runtime_id{"example-runtime"};
    cca::runtime::RuntimeBuilder builder{runtime_id};
    cca::runtime::RuntimeHost host;

    if (const auto result = host.create(std::move(builder)); !result) {
        return report(result);
    }
    if (const auto result = host.start(runtime_id); !result) {
        return report(result);
    }
    if (const auto result = host.stop(runtime_id); !result) {
        return report(result);
    }
    if (const auto result = host.destroy(runtime_id); !result) {
        return report(result);
    }

    return EXIT_SUCCESS;
}
