#pragma once

#include <cca/memory/long_term_memory.hpp>
#include <cca/representation/representation.hpp>

#include <memory>

namespace cca::memory::detail {

// Private bridge between the Long-Term Memory value and the complete
// Workspace Asset representation owned by CCA-PERSIST.
class LongTermMemoryPersistence {
  public:
    static std::unique_ptr<cca::representation::RepresentationDocument>
    project(const LongTermMemory& memory);

    static LongTermMemory reconstruct(
        const cca::representation::RepresentationDocument& workspace);

    static LongTermMemory roundTrip(const LongTermMemory& memory);
};

} // namespace cca::memory::detail
