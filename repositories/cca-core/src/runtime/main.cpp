#include <cca/core/logging.hpp>
#include <cca/runtime/runtime_builder.hpp>
#include <cca/runtime/runtime_host.hpp>

#include <cstdlib>
#include <iostream>
#include <memory>
#include <utility>

namespace {

[[nodiscard]] int report_failure(const cca::runtime::RuntimeResult& result) {
    std::cerr << result.code() << ": " << result.message() << '\n';
    return EXIT_FAILURE;
}

} // namespace

int main() {
    auto sink = std::make_shared<cca::core::OstreamLogSink>(std::cerr);
    cca::runtime::RuntimeHost host;
    cca::runtime::RuntimeBuilder builder{cca::runtime::RuntimeId{"cca-runtime-default"}};
    builder.use_log_sink(std::move(sink));

    const auto create_result = host.create(std::move(builder));
    if (!create_result) {
        return report_failure(create_result);
    }

    const cca::runtime::RuntimeId runtime_id{"cca-runtime-default"};
    const auto start_result = host.start(runtime_id);
    if (!start_result) {
        return report_failure(start_result);
    }

    const auto stop_result = host.stop(runtime_id);
    if (!stop_result) {
        return report_failure(stop_result);
    }

    const auto destroy_result = host.destroy(runtime_id);
    return destroy_result ? EXIT_SUCCESS : report_failure(destroy_result);
}
