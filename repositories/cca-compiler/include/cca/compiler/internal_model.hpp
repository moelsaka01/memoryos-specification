#pragma once

#include <compare>
#include <cstdint>
#include <map>
#include <optional>
#include <string>
#include <string_view>
#include <vector>

#include "cca/compiler/canonical_value.hpp"
#include "cca/compiler/diagnostics.hpp"

namespace cca::compiler {

/// Strong canonical identifier. The default value is an empty construction
/// sentinel; non-empty construction rejects values outside the canonical grammar.
class Identifier final {
  public:
    Identifier() = default;
    explicit Identifier(std::string value);

    [[nodiscard]] const std::string& value() const noexcept;
    [[nodiscard]] bool empty() const noexcept;
    [[nodiscard]] static bool is_valid(std::string_view value) noexcept;

    [[nodiscard]] auto operator<=>(const Identifier&) const = default;

  private:
    std::string value_;
};

/// Strong semantic version used for the format, specification, and objects.
class Version final {
  public:
    Version() = default;
    Version(std::uint32_t major,
            std::uint32_t minor,
            std::uint32_t patch,
            std::string prerelease = {},
            std::string build_metadata = {});

    [[nodiscard]] static std::optional<Version> parse(std::string_view value);
    [[nodiscard]] std::uint32_t major() const noexcept;
    [[nodiscard]] std::uint32_t minor() const noexcept;
    [[nodiscard]] std::uint32_t patch() const noexcept;
    [[nodiscard]] const std::string& prerelease() const noexcept;
    [[nodiscard]] const std::string& build_metadata() const noexcept;
    [[nodiscard]] std::string to_string() const;

    [[nodiscard]] bool operator==(const Version&) const = default;

  private:
    std::uint32_t major_{0};
    std::uint32_t minor_{0};
    std::uint32_t patch_{0};
    std::string prerelease_;
    std::string build_metadata_;
};

struct Metadata final {
    std::string name;
    std::string description;
    std::vector<std::string> authors;
    std::map<std::string, std::string, std::less<>> labels;

    [[nodiscard]] bool operator==(const Metadata&) const = default;
};

struct Category final {
    Identifier id;
    std::string name;
    std::optional<std::string> description;
    CanonicalValue::Object annotations;
    CanonicalValue::Object extensions;

    [[nodiscard]] bool operator==(const Category&) const = default;
};

/// Data shared by every canonical object kind through composition.
struct ObjectHeader final {
    Identifier id;
    Version version;
    Identifier category;
    Metadata metadata;
    CanonicalValue::Object properties;
    CanonicalValue::Object annotations;
    CanonicalValue::Object extensions;

    [[nodiscard]] bool operator==(const ObjectHeader&) const = default;
};

struct Package final {
    ObjectHeader header;
    std::vector<Identifier> members;
    [[nodiscard]] bool operator==(const Package&) const = default;
};

struct Domain final {
    ObjectHeader header;
    std::vector<Identifier> components;
    [[nodiscard]] bool operator==(const Domain&) const = default;
};

struct Component final {
    ObjectHeader header;
    std::vector<Identifier> contracts;
    std::vector<Identifier> requirements;
    [[nodiscard]] bool operator==(const Component&) const = default;
};

struct Contract final {
    ObjectHeader header;
    [[nodiscard]] bool operator==(const Contract&) const = default;
};

struct Requirement final {
    ObjectHeader header;
    std::vector<Identifier> satisfied_by;
    [[nodiscard]] bool operator==(const Requirement&) const = default;
};

struct Relationship final {
    Identifier id;
    std::string type;
    Identifier source;
    Identifier target;
    Metadata metadata;
    CanonicalValue::Object annotations;
    CanonicalValue::Object extensions;

    [[nodiscard]] bool operator==(const Relationship&) const = default;
};

struct Dependency final {
    Identifier id;
    Identifier source;
    Identifier target;
    std::string version;
    bool optional{false};
    Metadata metadata;
    CanonicalValue::Object annotations;
    CanonicalValue::Object extensions;

    [[nodiscard]] bool operator==(const Dependency&) const = default;
};

struct ValidationRule final {
    Identifier id;
    Identifier category;
    DiagnosticSeverity severity{DiagnosticSeverity::error};
    std::string expression;
    std::string message;
    std::string suggestion;
    CanonicalValue::Object annotations;
    CanonicalValue::Object extensions;

    [[nodiscard]] bool operator==(const ValidationRule&) const = default;
};

struct ArtifactRequest final {
    Identifier id;
    std::string type;
    std::string output;
    CanonicalValue::Object options;
    CanonicalValue::Object annotations;
    CanonicalValue::Object extensions;

    [[nodiscard]] bool operator==(const ArtifactRequest&) const = default;
};

/// Typed, architecture-neutral single source of truth built after validation.
struct Specification final {
    std::string schema_uri;
    Version format_version;
    std::string kind;
    Identifier id;
    Version version;
    Metadata metadata;
    std::vector<Category> categories;
    std::vector<Package> packages;
    std::vector<Domain> domains;
    std::vector<Component> components;
    std::vector<Contract> contracts;
    std::vector<Requirement> requirements;
    std::vector<Relationship> relationships;
    std::vector<Dependency> dependencies;
    std::vector<ValidationRule> validation_rules;
    std::vector<ArtifactRequest> artifacts;
    CanonicalValue::Object annotations;
    CanonicalValue::Object extensions;

    [[nodiscard]] std::size_t object_count() const noexcept;
    [[nodiscard]] bool operator==(const Specification&) const = default;
};

} // namespace cca::compiler
