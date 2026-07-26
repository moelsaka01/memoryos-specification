#include "cca/compiler/internal_model.hpp"

#include <charconv>
#include <limits>
#include <regex>
#include <stdexcept>
#include <utility>

namespace cca::compiler {
namespace {

const std::regex identifier_pattern{R"(^[a-z][a-z0-9]*(?:[.-][a-z0-9]+)*$)",
                                    std::regex::ECMAScript | std::regex::optimize};

const std::regex version_pattern{
    R"(^(0|[1-9][0-9]*)\.(0|[1-9][0-9]*)\.(0|[1-9][0-9]*)(?:-([0-9A-Za-z-]+(?:\.[0-9A-Za-z-]+)*))?(?:\+([0-9A-Za-z-]+(?:\.[0-9A-Za-z-]+)*))?$)",
    std::regex::ECMAScript | std::regex::optimize};

[[nodiscard]] std::optional<std::uint32_t> parse_component(const std::string& text) {
    std::uint64_t parsed = 0;
    const auto [end, error] = std::from_chars(text.data(), text.data() + text.size(), parsed);
    if (error != std::errc{} || end != text.data() + text.size() ||
        parsed > std::numeric_limits<std::uint32_t>::max()) {
        return std::nullopt;
    }
    return static_cast<std::uint32_t>(parsed);
}

} // namespace

Identifier::Identifier(std::string value) : value_{std::move(value)} {
    if (!is_valid(value_)) {
        throw std::invalid_argument("invalid canonical identifier: " + value_);
    }
}

const std::string& Identifier::value() const noexcept {
    return value_;
}

bool Identifier::empty() const noexcept {
    return value_.empty();
}

bool Identifier::is_valid(const std::string_view value) noexcept {
    if (value.empty()) {
        return false;
    }
    try {
        return std::regex_match(value.begin(), value.end(), identifier_pattern);
    } catch (...) {
        return false;
    }
}

Version::Version(const std::uint32_t major,
                 const std::uint32_t minor,
                 const std::uint32_t patch,
                 std::string prerelease,
                 std::string build_metadata)
    : major_{major}, minor_{minor}, patch_{patch}, prerelease_{std::move(prerelease)},
      build_metadata_{std::move(build_metadata)} {}

std::optional<Version> Version::parse(const std::string_view value) {
    std::match_results<std::string_view::const_iterator> match;
    if (!std::regex_match(value.begin(), value.end(), match, version_pattern)) {
        return std::nullopt;
    }

    const auto major = parse_component(match[1].str());
    const auto minor = parse_component(match[2].str());
    const auto patch = parse_component(match[3].str());
    if (!major || !minor || !patch) {
        return std::nullopt;
    }
    return Version{*major, *minor, *patch, match[4].str(), match[5].str()};
}

std::uint32_t Version::major() const noexcept {
    return major_;
}

std::uint32_t Version::minor() const noexcept {
    return minor_;
}

std::uint32_t Version::patch() const noexcept {
    return patch_;
}

const std::string& Version::prerelease() const noexcept {
    return prerelease_;
}

const std::string& Version::build_metadata() const noexcept {
    return build_metadata_;
}

std::string Version::to_string() const {
    auto result =
        std::to_string(major_) + "." + std::to_string(minor_) + "." + std::to_string(patch_);
    if (!prerelease_.empty()) {
        result += "-" + prerelease_;
    }
    if (!build_metadata_.empty()) {
        result += "+" + build_metadata_;
    }
    return result;
}

std::size_t Specification::object_count() const noexcept {
    return packages.size() + domains.size() + components.size() + contracts.size() +
           requirements.size();
}

} // namespace cca::compiler
