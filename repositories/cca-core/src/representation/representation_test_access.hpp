#pragma once

#include <cca/representation/representation.hpp>

#include <cstdint>
#include <string>

namespace cca::representation {

enum class RepresentationLifecycleState {
    Mutable,
    Validated,
    Frozen,
};

class RepresentationInternalAccess {
  public:
    static RepresentationLifecycleState
    lifecycleState(const RepresentationDocument& document) noexcept;

    static void setIdentifierState(RepresentationDocument& document,
                                   std::uint64_t next_ordinal,
                                   bool exhausted) noexcept;

    static void replaceId(RepresentationEntity& entity,
                          RepresentationId id);

    static void renameProperty(RepresentationProperty& property,
                               std::string name);

    static void setEndpoints(RepresentationRelationship& relationship,
                             RepresentationEntity& source,
                             RepresentationEntity& target) noexcept;
};

} // namespace cca::representation
