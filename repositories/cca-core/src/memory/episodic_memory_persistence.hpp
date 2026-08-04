#pragma once

#include <cca/memory/episodic_memory.hpp>
#include <cca/representation/representation.hpp>

#include <memory>

namespace cca::memory::detail {

// Private bridge between the Episodic Memory value and the complete
// Workspace Asset representation owned by CCA-PERSIST.
class EpisodicMemoryPersistence {
  public:
    static std::unique_ptr<cca::representation::RepresentationDocument>
    project(const EpisodicMemory& memory);

    static EpisodicMemory reconstruct(
        const cca::representation::RepresentationDocument& workspace);

    static EpisodicMemory roundTrip(const EpisodicMemory& memory);
};

} // namespace cca::memory::detail
