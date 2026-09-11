#pragma once

#include <cca/memory/procedural_memory.hpp>
#include <cca/representation/representation.hpp>

#include <memory>

namespace cca::memory::detail {

// Private bridge between the Procedural Memory value and the complete
// Workspace Asset representation owned by CCA-PERSIST.
class ProceduralMemoryPersistence {
  public:
    static std::unique_ptr<cca::representation::RepresentationDocument>
    project(const ProceduralMemory& memory);

    static ProceduralMemory reconstruct(
        const cca::representation::RepresentationDocument& workspace);

    static ProceduralMemory roundTrip(const ProceduralMemory& memory);
};

} // namespace cca::memory::detail
