#pragma once

#include <cca/process/execution_context.hpp>
#include <cca/process/execution_result.hpp>
#include <cca/process/process_definition.hpp>
#include <cca/representation/representation.hpp>

namespace cca::process {

class ProcessEngine {
  public:
    ProcessEngine() noexcept = default;

    ExecutionResult execute(
        const cca::representation::RepresentationDocument& document) const;

    ExecutionResult execute(const ProcessDefinition& definition) const;

    ExecutionResult execute(ExecutionContext& context) const;
};

} // namespace cca::process
