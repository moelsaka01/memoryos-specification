#include <cca/process/process.hpp>
#include <cca/representation/representation.hpp>
#include <cca/runtime/runtime.hpp>
#include <cca/runtime/runtime_builder.hpp>
#include <cca/runtime/runtime_id.hpp>

#include "../src/process/process_runtime_integration.hpp"

#include <utility>

int main() {
    cca::runtime::RuntimeBuilder builder{
        cca::runtime::RuntimeId{"process-example"}};
    cca::process::detail::add_process_runtime_integration(builder);
    auto runtime = std::move(builder).build();

    if (!runtime->start().ok()) {
        return 1;
    }

    using ProcessContract =
        cca::process::detail::ProcessEngineContract;
    auto& engine =
        runtime->service_registry().resolve<ProcessContract>();

    cca::representation::RepresentationDocument model;
    const auto result = engine.execute(model);
    const auto stop_result = runtime->stop();

    return result.succeeded() && stop_result.ok() ? 0 : 1;
}
