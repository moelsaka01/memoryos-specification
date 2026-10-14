#include <cca/core/version.hpp>
#include <cca/version.hpp>

namespace cca::core {

std::string SemanticVersion::to_string() const {
    auto value = std::to_string(major) + '.' + std::to_string(minor) + '.' + std::to_string(patch);
    if (!prerelease.empty()) {
        value += '-' + prerelease;
    }
    if (!build_metadata.empty()) {
        value += '+' + build_metadata;
    }
    return value;
}

SemanticVersion current_version() {
    return SemanticVersion{
        .major = version::major,
        .minor = version::minor,
        .patch = version::patch,
        .prerelease = std::string{version::prerelease},
        .build_metadata = std::string{version::build_metadata},
    };
}

} // namespace cca::core
