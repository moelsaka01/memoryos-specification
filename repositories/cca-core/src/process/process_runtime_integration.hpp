#pragma once

#include <cca/process/process.hpp>
#include <cca/runtime/provider.hpp>

namespace cca::runtime {

class RuntimeBuilder;

} // namespace cca::runtime

namespace cca::process::detail {

using ProcessEngineContract =
    runtime::ServiceContract<ProcessEngine, runtime::ServiceCardinality::exactly_one>;

class ProcessEngineProvider final : public ProcessEngine, public runtime::ServiceProvider {
  public:
    ProcessEngineProvider() noexcept = default;

    [[nodiscard]] runtime::RuntimeResult start(runtime::RuntimeContext& context) override;
    [[nodiscard]] runtime::RuntimeResult stop(runtime::RuntimeContext& context) override;
};

void add_process_runtime_integration(runtime::RuntimeBuilder& builder);

} // namespace cca::process::detail
