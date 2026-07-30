#pragma once

#include <cca/representation/representation.hpp>

#include <cstddef>
#include <memory>
#include <vector>

namespace cca::process {

class ProcessEngine;

class ProcessDefinition {
  public:
    explicit ProcessDefinition(
        const cca::representation::RepresentationDocument& document);

    ~ProcessDefinition();

    ProcessDefinition(const ProcessDefinition& other);

    ProcessDefinition& operator=(const ProcessDefinition& other);

    ProcessDefinition(ProcessDefinition&& other) noexcept;

    ProcessDefinition& operator=(ProcessDefinition&& other) noexcept;

    const std::vector<cca::representation::RepresentationId>&
    executionOrder() const noexcept;

    std::size_t entityCount() const noexcept;

    std::size_t relationshipCount() const noexcept;

    std::size_t propertyCount() const noexcept;

  private:
    class Impl;

    std::unique_ptr<Impl> impl_;

    friend class ProcessEngine;
};

} // namespace cca::process
