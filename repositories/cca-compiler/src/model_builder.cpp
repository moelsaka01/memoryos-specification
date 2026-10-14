#include "cca/compiler/model_builder.hpp"

#include <stdexcept>
#include <string>
#include <string_view>
#include <utility>

#include "cca/compiler/canonical_value.hpp"

namespace cca::compiler {
namespace {

[[nodiscard]] const CanonicalValue* field(const CanonicalValue& value,
                                          const std::string_view name) {
    return value.find(name);
}

[[nodiscard]] std::string string_field(const CanonicalValue& value, const std::string_view name) {
    const auto* item = field(value, name);
    return item != nullptr && item->is_string() ? item->as_string() : std::string{};
}

[[nodiscard]] bool
bool_field(const CanonicalValue& value, const std::string_view name, const bool fallback = false) {
    const auto* item = field(value, name);
    return item != nullptr && item->is_boolean() ? item->as_boolean() : fallback;
}

[[nodiscard]] CanonicalValue::Object object_field(const CanonicalValue& value,
                                                  const std::string_view name) {
    const auto* item = field(value, name);
    return item != nullptr && item->is_object() ? item->as_object() : CanonicalValue::Object{};
}

[[nodiscard]] Version version_field(const CanonicalValue& value, const std::string_view name) {
    const auto parsed = Version::parse(string_field(value, name));
    if (!parsed.has_value()) {
        throw std::invalid_argument("invalid semantic version in model builder");
    }
    return *parsed;
}

[[nodiscard]] Metadata build_metadata(const CanonicalValue& parent) {
    Metadata result;
    const auto* metadata = field(parent, "metadata");
    if (metadata == nullptr || !metadata->is_object()) {
        return result;
    }
    result.name = string_field(*metadata, "name");
    result.description = string_field(*metadata, "description");

    if (const auto* authors = field(*metadata, "authors");
        authors != nullptr && authors->is_array()) {
        for (const auto& author : authors->as_array()) {
            if (author.is_string()) {
                result.authors.push_back(author.as_string());
            }
        }
    }
    if (const auto* labels = field(*metadata, "labels"); labels != nullptr && labels->is_object()) {
        for (const auto& [key, value] : labels->as_object()) {
            if (value.is_string()) {
                result.labels.emplace(key, value.as_string());
            }
        }
    }
    return result;
}

[[nodiscard]] std::vector<Identifier> identifier_array(const CanonicalValue& parent,
                                                       const std::string_view name) {
    std::vector<Identifier> result;
    const auto* values = field(parent, name);
    if (values == nullptr || !values->is_array()) {
        return result;
    }
    result.reserve(values->as_array().size());
    for (const auto& value : values->as_array()) {
        if (value.is_string()) {
            result.emplace_back(value.as_string());
        }
    }
    return result;
}

[[nodiscard]] ObjectHeader build_header(const CanonicalValue& value) {
    return ObjectHeader{
        Identifier{string_field(value, "id")},
        version_field(value, "version"),
        Identifier{string_field(value, "category")},
        build_metadata(value),
        object_field(value, "properties"),
        object_field(value, "annotations"),
        object_field(value, "extensions"),
    };
}

[[nodiscard]] Diagnostic model_error(const ParsedDocument& document, const std::string& message) {
    return Diagnostic{"cca.model.construction-failed",
                      "CCA-MODEL-001",
                      DiagnosticSeverity::error,
                      "Internal model construction failed: " + message + ".",
                      "Resolve all validation errors before building the internal model.",
                      DiagnosticLocation{document.source_path, 1, 1},
                      "model"};
}

} // namespace

bool ModelBuildResult::ok() const noexcept {
    return specification.has_value() && !validation.has_errors();
}

ModelBuildResult ModelBuilder::build(const ParsedDocument& document) const {
    ModelBuildResult result;
    if (!document.root.is_object()) {
        result.validation.add(model_error(document, "document root is not an object"));
        return result;
    }

    try {
        Specification specification;
        specification.schema_uri = string_field(document.root, "$schema");
        specification.format_version = version_field(document.root, "format_version");
        specification.kind = string_field(document.root, "kind");
        specification.id = Identifier{string_field(document.root, "id")};
        specification.version = version_field(document.root, "version");
        specification.metadata = build_metadata(document.root);
        specification.annotations = object_field(document.root, "annotations");
        specification.extensions = object_field(document.root, "extensions");

        if (const auto* categories = field(document.root, "categories");
            categories != nullptr && categories->is_array()) {
            for (const auto& value : categories->as_array()) {
                if (!value.is_object()) {
                    continue;
                }
                Category category{
                    Identifier{string_field(value, "id")},
                    string_field(value, "name"),
                    std::nullopt,
                    object_field(value, "annotations"),
                    object_field(value, "extensions"),
                };
                const auto description = string_field(value, "description");
                if (!description.empty()) {
                    category.description = description;
                }
                specification.categories.push_back(std::move(category));
            }
        }

        if (const auto* objects = field(document.root, "objects");
            objects != nullptr && objects->is_array()) {
            for (const auto& value : objects->as_array()) {
                if (!value.is_object()) {
                    continue;
                }
                auto header = build_header(value);
                const auto type = string_field(value, "type");
                if (type == "package") {
                    specification.packages.push_back(
                        Package{std::move(header), identifier_array(value, "members")});
                } else if (type == "domain") {
                    specification.domains.push_back(
                        Domain{std::move(header), identifier_array(value, "components")});
                } else if (type == "component") {
                    specification.components.push_back(
                        Component{std::move(header),
                                  identifier_array(value, "contracts"),
                                  identifier_array(value, "requirements")});
                } else if (type == "contract") {
                    specification.contracts.push_back(Contract{std::move(header)});
                } else if (type == "requirement") {
                    specification.requirements.push_back(
                        Requirement{std::move(header), identifier_array(value, "satisfied_by")});
                }
            }
        }

        if (const auto* relationships = field(document.root, "relationships");
            relationships != nullptr && relationships->is_array()) {
            for (const auto& value : relationships->as_array()) {
                if (!value.is_object()) {
                    continue;
                }
                specification.relationships.push_back(Relationship{
                    Identifier{string_field(value, "id")},
                    string_field(value, "type"),
                    Identifier{string_field(value, "source")},
                    Identifier{string_field(value, "target")},
                    build_metadata(value),
                    object_field(value, "annotations"),
                    object_field(value, "extensions"),
                });
            }
        }

        if (const auto* dependencies = field(document.root, "dependencies");
            dependencies != nullptr && dependencies->is_array()) {
            for (const auto& value : dependencies->as_array()) {
                if (!value.is_object()) {
                    continue;
                }
                specification.dependencies.push_back(Dependency{
                    Identifier{string_field(value, "id")},
                    Identifier{string_field(value, "source")},
                    Identifier{string_field(value, "target")},
                    string_field(value, "version"),
                    bool_field(value, "optional"),
                    build_metadata(value),
                    object_field(value, "annotations"),
                    object_field(value, "extensions"),
                });
            }
        }

        if (const auto* validation_rules = field(document.root, "validation_rules");
            validation_rules != nullptr && validation_rules->is_array()) {
            for (const auto& value : validation_rules->as_array()) {
                if (!value.is_object()) {
                    continue;
                }
                const auto severity_name = string_field(value, "severity");
                const auto severity = severity_name == "warning"
                                          ? DiagnosticSeverity::warning
                                          : (severity_name == "note" ? DiagnosticSeverity::note
                                                                     : DiagnosticSeverity::error);
                specification.validation_rules.push_back(ValidationRule{
                    Identifier{string_field(value, "id")},
                    Identifier{string_field(value, "category")},
                    severity,
                    string_field(value, "expression"),
                    string_field(value, "message"),
                    string_field(value, "suggestion"),
                    object_field(value, "annotations"),
                    object_field(value, "extensions"),
                });
            }
        }

        if (const auto* artifacts = field(document.root, "artifacts");
            artifacts != nullptr && artifacts->is_array()) {
            for (const auto& value : artifacts->as_array()) {
                if (!value.is_object()) {
                    continue;
                }
                specification.artifacts.push_back(ArtifactRequest{
                    Identifier{string_field(value, "id")},
                    string_field(value, "type"),
                    string_field(value, "output"),
                    object_field(value, "options"),
                    object_field(value, "annotations"),
                    object_field(value, "extensions"),
                });
            }
        }

        result.specification = std::move(specification);
    } catch (const std::exception& exception) {
        result.validation.add(model_error(document, exception.what()));
    }
    result.validation.sort();
    return result;
}

} // namespace cca::compiler
