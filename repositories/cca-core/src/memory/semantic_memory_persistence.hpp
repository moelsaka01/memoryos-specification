#pragma once

#include <cca/memory/semantic_memory.hpp>
#include <cca/representation/representation.hpp>

#include <memory>

namespace cca::memory::detail {

// Private bridge between the Semantic Memory value and the complete
// Workspace Asset representation owned by CCA-PERSIST.
class SemanticMemoryPersistence {
  public:
    static std::unique_ptr<cca::representation::RepresentationDocument>
    project(const SemanticMemory& memory);

    static SemanticMemory reconstruct(
        const cca::representation::RepresentationDocument& workspace);

    static SemanticMemory roundTrip(const SemanticMemory& memory);
};

} // namespace cca::memory::detail
