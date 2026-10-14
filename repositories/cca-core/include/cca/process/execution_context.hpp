#pragma once

#include <cca/process/execution_state.hpp>
#include <cca/process/process_definition.hpp>
#include <cca/representation/representation.hpp>

#include <memory>
#include <vector>

namespace cca::process {

class ProcessEngine;

class ExecutionContext {
  public:
    explicit ExecutionContext(ProcessDefinition definition);

    ~ExecutionContext();

    ExecutionContext(const ExecutionContext&) = delete;

    ExecutionContext& operator=(const ExecutionContext&) = delete;

    ExecutionContext(ExecutionContext&&) = delete;

    ExecutionContext& operator=(ExecutionContext&&) = delete;

    const ProcessDefinition& definition() const noexcept;

    ExecutionState state() const noexcept;

    const std::vector<cca::representation::RepresentationId>&
    trace() const noexcept;

  private:
    class Impl;

    std::unique_ptr<Impl> impl_;

    friend class ProcessEngine;
    friend class ProcessInternalAccess;
};

} // namespace cca::process
