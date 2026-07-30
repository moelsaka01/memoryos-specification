#pragma once

#include <cca/process/execution_state.hpp>
#include <cca/representation/representation.hpp>

#include <string>
#include <string_view>
#include <vector>

namespace cca::process {

class ProcessEngine;

class ExecutionResult {
  public:
    enum class Code {
        Success,
        InvalidRepresentation
    };

    ExecutionResult(const ExecutionResult&) = default;

    ExecutionResult& operator=(const ExecutionResult&) = default;

    ExecutionResult(ExecutionResult&&) noexcept = default;

    ExecutionResult& operator=(ExecutionResult&&) noexcept = default;

    ~ExecutionResult() = default;

    bool succeeded() const noexcept;

    ExecutionState state() const noexcept;

    Code code() const noexcept;

    std::string_view message() const noexcept;

    const std::vector<cca::representation::RepresentationId>&
    trace() const noexcept;

    const std::vector<cca::representation::Diagnostic>&
    diagnostics() const noexcept;

  private:
    ExecutionResult(
        ExecutionState state,
        Code code,
        std::string message,
        std::vector<cca::representation::RepresentationId> trace,
        std::vector<cca::representation::Diagnostic> diagnostics);

    ExecutionState state_;
    Code code_;
    std::string message_;
    std::vector<cca::representation::RepresentationId> trace_;
    std::vector<cca::representation::Diagnostic> diagnostics_;

    friend class ProcessEngine;
};

} // namespace cca::process
