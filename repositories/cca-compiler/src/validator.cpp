#include "cca/compiler/validator.hpp"

#include <algorithm>
#include <array>
#include <cctype>
#include <set>
#include <stdexcept>
#include <string>
#include <string_view>
#include <utility>

#include "cca/compiler/internal_model.hpp"
#include "cca/compiler/source_loader.hpp"

namespace cca::compiler {
namespace {

using Object = CanonicalValue::Object;

[[nodiscard]] bool safe_relative_output(const std::string_view value) {
    if (value.empty() || value.front() == '/' || value.contains('\\')) {
        return false;
    }
    if (value.size() >= 2 && std::isalpha(static_cast<unsigned char>(value.front())) != 0 &&
        value[1] == ':') {
        return false;
    }
    std::size_t offset = 0;
    while (offset <= value.size()) {
        const auto separator = value.find('/', offset);
        const auto part = value.substr(offset,
                                       separator == std::string_view::npos ? value.size() - offset
                                                                           : separator - offset);
        if (part == "..") {
            return false;
        }
        if (separator == std::string_view::npos) {
            break;
        }
        offset = separator + 1;
    }
    return true;
}

class SchemaValidator final {
  public:
    SchemaValidator(const ParsedDocument& document, const std::shared_ptr<IDiagnosticSink>& sink)
        : document_{document}, sink_{sink} {}

    [[nodiscard]] ValidationResult run() {
        if (!document_.root.is_object()) {
            add("CCA-SCHEMA-001",
                "$",
                "canonical specification root must be an object",
                "Use a YAML mapping at the document root.",
                document_.root.location());
            return std::move(result_);
        }

        const auto& root = document_.root.as_object();
        validate_allowed(root,
                         {"$schema",
                          "format_version",
                          "kind",
                          "id",
                          "version",
                          "metadata",
                          "categories",
                          "objects",
                          "relationships",
                          "dependencies",
                          "validation_rules",
                          "artifacts",
                          "annotations",
                          "extensions"},
                         "$");

        validate_root_scalar(root, "$schema", "cca://schemas/canonical-specification/1.0");
        validate_format_version(root);
        validate_root_scalar(root, "kind", "canonical_specification");
        validate_identifier_member(root, "id", "$");
        validate_version_member(root, "version", "$");
        validate_metadata(required(root, "metadata", CanonicalValue::Type::object, "$"),
                          "$.metadata");
        validate_categories(required(root, "categories", CanonicalValue::Type::array, "$"));
        validate_objects(required(root, "objects", CanonicalValue::Type::array, "$"));
        validate_relationships(required(root, "relationships", CanonicalValue::Type::array, "$"));
        validate_dependencies(required(root, "dependencies", CanonicalValue::Type::array, "$"));
        validate_rules(required(root, "validation_rules", CanonicalValue::Type::array, "$"));
        validate_artifacts(required(root, "artifacts", CanonicalValue::Type::array, "$"));
        validate_keyed_map(required(root, "annotations", CanonicalValue::Type::object, "$"),
                           "$.annotations",
                           true);
        validate_keyed_map(
            required(root, "extensions", CanonicalValue::Type::object, "$"), "$.extensions", false);
        return std::move(result_);
    }

  private:
    void add(std::string code,
             const std::string& logical_path,
             std::string message,
             std::string suggestion,
             const DiagnosticLocation& location) {
        Diagnostic diagnostic{code + ":" + logical_path,
                              std::move(code),
                              DiagnosticSeverity::error,
                              std::move(message),
                              std::move(suggestion),
                              location,
                              "schema"};
        sink_->report(diagnostic);
        result_.add(std::move(diagnostic));
    }

    [[nodiscard]] const CanonicalValue* required(const Object& object,
                                                 const std::string_view key,
                                                 const CanonicalValue::Type type,
                                                 const std::string& logical_path) {
        const auto iterator = object.find(key);
        const auto member_path = logical_path + "." + std::string{key};
        if (iterator == object.end()) {
            const auto location = object.empty() ? DiagnosticLocation{document_.source_path, 1, 1}
                                                 : object.begin()->second.location();
            add("CCA-SCHEMA-002",
                member_path,
                "required field '" + std::string{key} + "' is missing",
                "Add the required '" + std::string{key} + "' field.",
                location);
            return nullptr;
        }
        if (iterator->second.type() != type) {
            add("CCA-SCHEMA-003",
                member_path,
                "field '" + std::string{key} + "' must be " + std::string{to_string(type)} +
                    ", not " + std::string{to_string(iterator->second.type())},
                "Change '" + std::string{key} + "' to the required type.",
                iterator->second.location());
            return nullptr;
        }
        return &iterator->second;
    }

    [[nodiscard]] const CanonicalValue* optional(const Object& object,
                                                 const std::string_view key,
                                                 const CanonicalValue::Type type,
                                                 const std::string& logical_path) {
        const auto iterator = object.find(key);
        if (iterator == object.end()) {
            return nullptr;
        }
        if (iterator->second.type() != type) {
            add("CCA-SCHEMA-003",
                logical_path + "." + std::string{key},
                "field '" + std::string{key} + "' must be " + std::string{to_string(type)} +
                    ", not " + std::string{to_string(iterator->second.type())},
                "Change '" + std::string{key} + "' to the required type.",
                iterator->second.location());
            return nullptr;
        }
        return &iterator->second;
    }

    void validate_allowed(const Object& object,
                          const std::initializer_list<std::string_view> allowed,
                          const std::string& logical_path) {
        const std::set<std::string_view> names{allowed.begin(), allowed.end()};
        for (const auto& [name, value] : object) {
            if (!names.contains(name)) {
                add("CCA-SCHEMA-007",
                    logical_path + "." + name,
                    "unknown field '" + name + "'",
                    "Remove the field or place vendor data under 'extensions'.",
                    value.location());
            }
        }
    }

    void validate_keyed_map(const CanonicalValue* value,
                            const std::string& logical_path,
                            const bool scalar_values_only) {
        if (value == nullptr) {
            return;
        }
        for (const auto& [name, item] : value->as_object()) {
            if (!Identifier::is_valid(name)) {
                add("CCA-SCHEMA-005",
                    logical_path + "." + name,
                    "map key '" + name + "' is not a canonical identifier",
                    "Use lowercase dotted or hyphenated identifier segments.",
                    item.location());
            }
            if (scalar_values_only && (item.is_array() || item.is_object())) {
                add("CCA-SCHEMA-003",
                    logical_path + "." + name,
                    "annotation values must be scalar or null",
                    "Move structured vendor data under extensions.",
                    item.location());
            }
        }
    }

    void validate_root_scalar(const Object& root,
                              const std::string_view key,
                              const std::string_view expected) {
        const auto* value = required(root, key, CanonicalValue::Type::string, "$");
        if (value != nullptr && value->as_string() != expected) {
            add("CCA-SCHEMA-004",
                "$." + std::string{key},
                "field '" + std::string{key} + "' has unsupported value '" + value->as_string() +
                    "'",
                "Use '" + std::string{expected} + "'.",
                value->location());
        }
    }

    void validate_format_version(const Object& root) {
        const auto* value = required(root, "format_version", CanonicalValue::Type::string, "$");
        if (value == nullptr) {
            return;
        }
        const auto version = Version::parse(value->as_string());
        if (!version || version->major() != 1) {
            add("CCA-SCHEMA-006",
                "$.format_version",
                "format_version must be a supported 1.x semantic version",
                "Use a format version such as '1.0.0'.",
                value->location());
        }
    }

    void validate_identifier_member(const Object& object,
                                    const std::string_view key,
                                    const std::string& logical_path) {
        const auto* value = required(object, key, CanonicalValue::Type::string, logical_path);
        if (value != nullptr && !Identifier::is_valid(value->as_string())) {
            add("CCA-SCHEMA-005",
                logical_path + "." + std::string{key},
                "field '" + std::string{key} + "' is not a canonical identifier",
                "Use lowercase dotted or hyphenated segments, for example 'core.contract-1'.",
                value->location());
        }
    }

    void validate_version_member(const Object& object,
                                 const std::string_view key,
                                 const std::string& logical_path) {
        const auto* value = required(object, key, CanonicalValue::Type::string, logical_path);
        if (value != nullptr && !Version::parse(value->as_string())) {
            add("CCA-SCHEMA-006",
                logical_path + "." + std::string{key},
                "field '" + std::string{key} + "' must be a semantic version",
                "Use major.minor.patch, optionally followed by prerelease or build metadata.",
                value->location());
        }
    }

    void validate_nonempty_string_member(const Object& object,
                                         const std::string_view key,
                                         const std::string& logical_path) {
        const auto* value = required(object, key, CanonicalValue::Type::string, logical_path);
        if (value != nullptr && value->as_string().empty()) {
            add("CCA-SCHEMA-004",
                logical_path + "." + std::string{key},
                "field '" + std::string{key} + "' must not be empty",
                "Provide a deterministic non-empty value.",
                value->location());
        }
    }

    void validate_identifier_array(const Object& object,
                                   const std::string_view key,
                                   const std::string& logical_path) {
        const auto* value = required(object, key, CanonicalValue::Type::array, logical_path);
        if (value == nullptr) {
            return;
        }
        for (std::size_t index = 0; index < value->as_array().size(); ++index) {
            const auto& item = value->as_array()[index];
            const auto item_path =
                logical_path + "." + std::string{key} + "[" + std::to_string(index) + "]";
            if (!item.is_string()) {
                add("CCA-SCHEMA-003",
                    item_path,
                    "identifier array entries must be strings",
                    "Replace the entry with a canonical identifier string.",
                    item.location());
            } else if (!Identifier::is_valid(item.as_string())) {
                add("CCA-SCHEMA-005",
                    item_path,
                    "array entry is not a canonical identifier",
                    "Use lowercase dotted or hyphenated segments.",
                    item.location());
            }
        }
    }

    void validate_metadata(const CanonicalValue* value, const std::string& logical_path) {
        if (value == nullptr) {
            return;
        }
        const auto& metadata = value->as_object();
        validate_allowed(metadata, {"name", "description", "authors", "labels"}, logical_path);
        validate_nonempty_string_member(metadata, "name", logical_path);
        static_cast<void>(
            optional(metadata, "description", CanonicalValue::Type::string, logical_path));
        const auto* authors =
            optional(metadata, "authors", CanonicalValue::Type::array, logical_path);
        if (authors != nullptr) {
            for (std::size_t index = 0; index < authors->as_array().size(); ++index) {
                const auto& author = authors->as_array()[index];
                if (!author.is_string() || author.as_string().empty()) {
                    add("CCA-SCHEMA-003",
                        logical_path + ".authors[" + std::to_string(index) + "]",
                        "metadata authors must be non-empty strings",
                        "Provide the author's name as a non-empty string.",
                        author.location());
                }
            }
        }
        const auto* labels =
            optional(metadata, "labels", CanonicalValue::Type::object, logical_path);
        if (labels != nullptr) {
            for (const auto& [name, label] : labels->as_object()) {
                if (!Identifier::is_valid(name)) {
                    add("CCA-SCHEMA-005",
                        logical_path + ".labels." + name,
                        "metadata label key is not a canonical identifier",
                        "Use lowercase dotted or hyphenated identifier segments.",
                        label.location());
                }
                if (!label.is_string()) {
                    add("CCA-SCHEMA-003",
                        logical_path + ".labels." + name,
                        "metadata label values must be strings",
                        "Convert the label value to a string.",
                        label.location());
                }
            }
        }
    }

    void validate_categories(const CanonicalValue* value) {
        if (value == nullptr) {
            return;
        }
        const auto& categories = value->as_array();
        for (std::size_t index = 0; index < categories.size(); ++index) {
            const auto path = "$.categories[" + std::to_string(index) + "]";
            const auto& category = categories[index];
            if (!category.is_object()) {
                add("CCA-SCHEMA-003",
                    path,
                    "category entries must be objects",
                    "Replace the entry with a category object.",
                    category.location());
                continue;
            }
            const auto& object = category.as_object();
            validate_allowed(
                object, {"id", "name", "description", "annotations", "extensions"}, path);
            validate_identifier_member(object, "id", path);
            validate_nonempty_string_member(object, "name", path);
            static_cast<void>(optional(object, "description", CanonicalValue::Type::string, path));
            validate_keyed_map(required(object, "annotations", CanonicalValue::Type::object, path),
                               path + ".annotations",
                               true);
            validate_keyed_map(required(object, "extensions", CanonicalValue::Type::object, path),
                               path + ".extensions",
                               false);
        }
    }

    void validate_objects(const CanonicalValue* value) {
        if (value == nullptr) {
            return;
        }
        const auto& objects = value->as_array();
        for (std::size_t index = 0; index < objects.size(); ++index) {
            const auto path = "$.objects[" + std::to_string(index) + "]";
            const auto& item = objects[index];
            if (!item.is_object()) {
                add("CCA-SCHEMA-003",
                    path,
                    "object entries must be objects",
                    "Replace the entry with a canonical object.",
                    item.location());
                continue;
            }
            validate_object(item.as_object(), path);
        }
    }

    void validate_object(const Object& object, const std::string& path) {
        const auto* type = required(object, "type", CanonicalValue::Type::string, path);
        std::string type_name;
        if (type != nullptr) {
            type_name = type->as_string();
        }

        auto allowed = std::set<std::string_view>{"type",
                                                  "id",
                                                  "version",
                                                  "category",
                                                  "metadata",
                                                  "properties",
                                                  "annotations",
                                                  "extensions"};
        if (type_name == "package") {
            allowed.emplace("members");
        } else if (type_name == "domain") {
            allowed.emplace("components");
        } else if (type_name == "component") {
            allowed.emplace("contracts");
            allowed.emplace("requirements");
        } else if (type_name == "requirement") {
            allowed.emplace("satisfied_by");
        } else if (type_name != "contract" && type != nullptr) {
            add("CCA-SCHEMA-004",
                path + ".type",
                "unknown canonical object type '" + type_name + "'",
                "Use package, domain, component, contract, or requirement.",
                type->location());
        }
        for (const auto& [name, member] : object) {
            if (!allowed.contains(name)) {
                add("CCA-SCHEMA-007",
                    path + "." + name,
                    "unknown field '" + name + "' for object type '" + type_name + "'",
                    "Remove the field or place vendor data under 'extensions'.",
                    member.location());
            }
        }

        validate_identifier_member(object, "id", path);
        validate_version_member(object, "version", path);
        validate_identifier_member(object, "category", path);
        validate_metadata(required(object, "metadata", CanonicalValue::Type::object, path),
                          path + ".metadata");
        static_cast<void>(required(object, "properties", CanonicalValue::Type::object, path));
        validate_keyed_map(required(object, "annotations", CanonicalValue::Type::object, path),
                           path + ".annotations",
                           true);
        validate_keyed_map(required(object, "extensions", CanonicalValue::Type::object, path),
                           path + ".extensions",
                           false);

        if (type_name == "package") {
            validate_identifier_array(object, "members", path);
        } else if (type_name == "domain") {
            validate_identifier_array(object, "components", path);
        } else if (type_name == "component") {
            validate_identifier_array(object, "contracts", path);
            validate_identifier_array(object, "requirements", path);
        } else if (type_name == "requirement") {
            validate_identifier_array(object, "satisfied_by", path);
        }
    }

    void validate_relationships(const CanonicalValue* value) {
        if (value == nullptr) {
            return;
        }
        validate_object_array(
            value, "$.relationships", [&](const Object& object, const std::string& path) {
                validate_allowed(
                    object,
                    {"id", "type", "source", "target", "metadata", "annotations", "extensions"},
                    path);
                validate_identifier_member(object, "id", path);
                validate_identifier_member(object, "type", path);
                validate_identifier_member(object, "source", path);
                validate_identifier_member(object, "target", path);
                validate_metadata(required(object, "metadata", CanonicalValue::Type::object, path),
                                  path + ".metadata");
                validate_keyed_map(
                    required(object, "annotations", CanonicalValue::Type::object, path),
                    path + ".annotations",
                    true);
                validate_keyed_map(
                    required(object, "extensions", CanonicalValue::Type::object, path),
                    path + ".extensions",
                    false);
            });
    }

    void validate_dependencies(const CanonicalValue* value) {
        if (value == nullptr) {
            return;
        }
        validate_object_array(
            value, "$.dependencies", [&](const Object& object, const std::string& path) {
                validate_allowed(object,
                                 {"id",
                                  "source",
                                  "target",
                                  "version",
                                  "optional",
                                  "metadata",
                                  "annotations",
                                  "extensions"},
                                 path);
                validate_identifier_member(object, "id", path);
                validate_identifier_member(object, "source", path);
                validate_identifier_member(object, "target", path);
                const auto* version =
                    required(object, "version", CanonicalValue::Type::string, path);
                if (version != nullptr && !valid_version_constraint(version->as_string())) {
                    add("CCA-SCHEMA-008",
                        path + ".version",
                        "dependency version is not a supported semantic-version constraint",
                        "Use '*', an exact version, '^major.minor.patch', or '~major.minor.patch'.",
                        version->location());
                }
                static_cast<void>(
                    required(object, "optional", CanonicalValue::Type::boolean, path));
                validate_metadata(required(object, "metadata", CanonicalValue::Type::object, path),
                                  path + ".metadata");
                validate_keyed_map(
                    required(object, "annotations", CanonicalValue::Type::object, path),
                    path + ".annotations",
                    true);
                validate_keyed_map(
                    required(object, "extensions", CanonicalValue::Type::object, path),
                    path + ".extensions",
                    false);
            });
    }

    void validate_rules(const CanonicalValue* value) {
        if (value == nullptr) {
            return;
        }
        validate_object_array(
            value, "$.validation_rules", [&](const Object& object, const std::string& path) {
                validate_allowed(object,
                                 {"id",
                                  "category",
                                  "severity",
                                  "expression",
                                  "message",
                                  "suggestion",
                                  "annotations",
                                  "extensions"},
                                 path);
                validate_identifier_member(object, "id", path);
                validate_identifier_member(object, "category", path);
                const auto* severity =
                    required(object, "severity", CanonicalValue::Type::string, path);
                if (severity != nullptr) {
                    constexpr std::array values{"note", "warning", "error"};
                    if (std::ranges::find(values, severity->as_string()) == values.end()) {
                        add("CCA-SCHEMA-004",
                            path + ".severity",
                            "validation rule severity is unsupported",
                            "Use note, warning, or error.",
                            severity->location());
                    }
                }
                validate_nonempty_string_member(object, "expression", path);
                validate_nonempty_string_member(object, "message", path);
                static_cast<void>(
                    required(object, "suggestion", CanonicalValue::Type::string, path));
                validate_keyed_map(
                    required(object, "annotations", CanonicalValue::Type::object, path),
                    path + ".annotations",
                    true);
                validate_keyed_map(
                    required(object, "extensions", CanonicalValue::Type::object, path),
                    path + ".extensions",
                    false);
            });
    }

    void validate_artifacts(const CanonicalValue* value) {
        if (value == nullptr) {
            return;
        }
        validate_object_array(
            value, "$.artifacts", [&](const Object& object, const std::string& path) {
                validate_allowed(
                    object, {"id", "type", "output", "options", "annotations", "extensions"}, path);
                validate_identifier_member(object, "id", path);
                const auto* type = required(object, "type", CanonicalValue::Type::string, path);
                if (type != nullptr) {
                    constexpr std::array types{"documentation_index",
                                               "dependency_graph",
                                               "specification_report",
                                               "validation_report",
                                               "object_inventory",
                                               "architecture_summary",
                                               "placeholder_code"};
                    if (std::ranges::find(types, type->as_string()) == types.end()) {
                        add("CCA-SCHEMA-004",
                            path + ".type",
                            "artifact type is unsupported",
                            "Use one of the artifact types defined by Canonical Specification 1.0.",
                            type->location());
                    }
                }
                const auto* output = required(object, "output", CanonicalValue::Type::string, path);
                if (output != nullptr && !safe_relative_output(output->as_string())) {
                    add("CCA-SCHEMA-004",
                        path + ".output",
                        "artifact output must be a safe relative path",
                        "Use a non-empty relative path without parent segments or backslashes.",
                        output->location());
                }
                static_cast<void>(required(object, "options", CanonicalValue::Type::object, path));
                validate_keyed_map(
                    required(object, "annotations", CanonicalValue::Type::object, path),
                    path + ".annotations",
                    true);
                validate_keyed_map(
                    required(object, "extensions", CanonicalValue::Type::object, path),
                    path + ".extensions",
                    false);
            });
    }

    template <typename Callback>
    void validate_object_array(const CanonicalValue* value,
                               const std::string& logical_path,
                               Callback callback) {
        const auto& array = value->as_array();
        for (std::size_t index = 0; index < array.size(); ++index) {
            const auto path = logical_path + "[" + std::to_string(index) + "]";
            if (!array[index].is_object()) {
                add("CCA-SCHEMA-003",
                    path,
                    "array entry must be an object",
                    "Replace the entry with a canonical object.",
                    array[index].location());
                continue;
            }
            callback(array[index].as_object(), path);
        }
    }

    [[nodiscard]] static bool valid_version_constraint(const std::string_view constraint) {
        if (constraint == "*") {
            return true;
        }
        if (constraint.starts_with('^') || constraint.starts_with('~')) {
            return Version::parse(constraint.substr(1)).has_value();
        }
        return Version::parse(constraint).has_value();
    }

    const ParsedDocument& document_;
    const std::shared_ptr<IDiagnosticSink>& sink_;
    ValidationResult result_;
};

} // namespace

Validator::Validator()
    : Validator{std::make_shared<NullLogger>(), std::make_shared<NullDiagnosticSink>()} {}

Validator::Validator(std::shared_ptr<ILogger> logger, std::shared_ptr<IDiagnosticSink> diagnostics)
    : logger_{std::move(logger)}, diagnostics_{std::move(diagnostics)} {
    if (!logger_ || !diagnostics_) {
        throw std::invalid_argument("validator dependencies must not be null");
    }
}

ValidationResult Validator::validate(const ParsedDocument& document) const {
    auto result = SchemaValidator{document, diagnostics_}.run();
    logger_->log({result.has_errors() ? LogLevel::error : LogLevel::debug,
                  "validator",
                  result.has_errors() ? "canonical schema validation failed"
                                      : "canonical schema validation succeeded"});
    return result;
}

Status Validator::validate(const ValidationRequest& request) const {
    if (request.source.empty()) {
        auto status = Status::invalid_argument("validator source path must not be empty");
        diagnostics_->report({DiagnosticSeverity::error, "CCA-VALIDATOR-001", status.message()});
        logger_->log({LogLevel::error, "validator", status.message()});
        return status;
    }

    const FileSourceLoader loader;
    auto loaded = loader.load(request.source);
    if (!loaded.ok()) {
        for (const auto& diagnostic : loaded.validation.diagnostics()) {
            diagnostics_->report(diagnostic);
        }
        return Status::invalid_argument("validator source could not be loaded");
    }

    const Parser parser{logger_, diagnostics_};
    auto parsed = parser.parse(*loaded.document);
    if (!parsed.ok()) {
        return Status::invalid_argument("validator source is not valid YAML");
    }
    const auto result = validate(*parsed.document);
    return result.has_errors() ? Status::invalid_argument("canonical schema validation failed")
                               : Status::success();
}

} // namespace cca::compiler
