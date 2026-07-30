#include "process_runtime_integration.hpp"

#include <cca/runtime/runtime_builder.hpp>

#include <memory>

namespace cca::process::detail {

runtime::RuntimeResult ProcessEngineProvider::start(runtime::RuntimeContext& context) {
    static_cast<void>(context);
    return runtime::RuntimeResult::success();
}

runtime::RuntimeResult ProcessEngineProvider::stop(runtime::RuntimeContext& context) {
    static_cast<void>(context);
    return runtime::RuntimeResult::success();
}

void add_process_runtime_integration(runtime::RuntimeBuilder& builder) {
    builder.declare_contract<ProcessEngineContract>();
    builder.add_provider<ProcessEngineContract, ProcessEngineProvider>(
        [] { return std::make_unique<ProcessEngineProvider>(); });
}

} // namespace cca::process::detail
