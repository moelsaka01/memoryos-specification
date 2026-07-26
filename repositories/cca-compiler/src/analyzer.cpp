#include "cca/compiler/analyzer.hpp"

#include <algorithm>
#include <map>
#include <set>
#include <stdexcept>
#include <string>
#include <string_view>
#include <utility>

#include "cca/compiler/canonical_value.hpp"

namespace cca::compiler {
namespace {

[[nodiscard]] const CanonicalValue::Array* array_field(const CanonicalValue& value,
                                                       const std::string_view name) {
    const auto* field = value.find(name);
    return field != nullptr && field->is_array() ? &field->as_array() : nullptr;
}

[[nodiscard]] std::string string_field(const CanonicalValue& value, const std::string_view name) {
    const auto* field = value.find(name);
    return field != nullptr && field->is_string() ? field->as_string() : std::string{};
}

[[nodiscard]] Diagnostic diagnostic(std::string identifier,
                                    std::string code,
                                    std::string message,
                                    std::string suggestion,
                                    const CanonicalValue& value,
                                    std::string category) {
    return Diagnostic{std::move(identifier),
                      std::move(code),
                      DiagnosticSeverity::error,
                      std::move(message),
                      std::move(suggestion),
                      value.location(),
                      std::move(category)};
}

void analyze_relationships(const CanonicalValue& root,
                           const std::set<std::string>& object_identifiers,
                           AnalysisResult& result) {
    const auto* relationships = array_field(root, "relationships");
    if (relationships == nullptr) {
        return;
    }

    result.summary.relationship_count = relationships->size();
    std::set<std::string> relationship_signatures;
    for (const auto& relationship : *relationships) {
        if (!relationship.is_object()) {
            continue;
        }

        const auto id = string_field(relationship, "id");
        const auto type = string_field(relationship, "type");
        const auto source = string_field(relationship, "source");
        const auto target = string_field(relationship, "target");
        const auto signature = type + '\x1f' + source + '\x1f' + target;
        if (!relationship_signatures.insert(signature).second) {
            result.validation.add(diagnostic(
                "cca.analysis.duplicate-relationship." + id,
                "CCA-ANALYSIS-004",
                "Relationship '" + id + "' duplicates an existing type/source/target tuple.",
                "Remove the duplicate relationship or change one of its endpoints.",
                relationship,
                "relationship"));
        }

        for (const auto& [role, reference] :
             {std::pair<std::string_view, std::string>{"source", source},
              std::pair<std::string_view, std::string>{"target", target}}) {
            if (!reference.empty() && !object_identifiers.contains(reference)) {
                result.validation.add(diagnostic(
                    "cca.analysis.unresolved-relationship-" + std::string{role} + '.' + id,
                    "CCA-ANALYSIS-003",
                    "Relationship '" + id + "' has unresolved " + std::string{role} +
                        " reference '" + reference + "'.",
                    "Reference an identifier declared in objects.",
                    relationship,
                    "reference"));
            }
        }
    }
}

void analyze_dependencies(const CanonicalValue& root,
                          const std::set<std::string>& object_identifiers,
                          AnalysisResult& result) {
    const auto* dependencies = array_field(root, "dependencies");
    if (dependencies == nullptr) {
        return;
    }

    result.summary.dependency_count = dependencies->size();
    for (const auto& dependency : *dependencies) {
        if (!dependency.is_object()) {
            continue;
        }

        const auto id = string_field(dependency, "id");
        const auto source = string_field(dependency, "source");
        const auto target = string_field(dependency, "target");
        for (const auto& [role, reference] :
             {std::pair<std::string_view, std::string>{"source", source},
              std::pair<std::string_view, std::string>{"target", target}}) {
            if (!reference.empty() && !object_identifiers.contains(reference)) {
                result.validation.add(
                    diagnostic("cca.analysis.unresolved-dependency-" + std::string{role} + '.' + id,
                               "CCA-ANALYSIS-005",
                               "Dependency '" + id + "' has unresolved " + std::string{role} +
                                   " reference '" + reference + "'.",
                               "Reference an identifier declared in objects.",
                               dependency,
                               "dependency"));
            }
        }
    }
}

void analyze_object_references(const CanonicalValue& object,
                               const std::string& object_id,
                               const std::set<std::string>& object_identifiers,
                               AnalysisResult& result) {
    const auto analyze_array = [&](const std::string_view field_name) {
        const auto* references = array_field(object, field_name);
        if (references == nullptr) {
            return;
        }
        for (const auto& reference_value : *references) {
            if (!reference_value.is_string()) {
                continue;
            }
            const auto& reference = reference_value.as_string();
            if (!object_identifiers.contains(reference)) {
                result.validation.add(
                    diagnostic("cca.analysis.unresolved-object-reference." + object_id + '.' +
                                   std::string{field_name} + '.' + reference,
                               "CCA-ANALYSIS-007",
                               "Object '" + object_id + "' has unresolved " +
                                   std::string{field_name} + " reference '" + reference + "'.",
                               "Reference an identifier declared in objects.",
                               reference_value,
                               "reference"));
            }
        }
    };

    analyze_array("members");
    analyze_array("components");
    analyze_array("contracts");
    analyze_array("requirements");
    analyze_array("satisfied_by");
}

} // namespace

std::size_t AnalysisSummary::object_count() const noexcept {
    return object_identifiers.size();
}

bool AnalysisResult::ok() const noexcept {
    return !validation.has_errors();
}

Analyzer::Analyzer()
    : Analyzer{std::make_shared<NullLogger>(), std::make_shared<NullDiagnosticSink>()} {}

Analyzer::Analyzer(std::shared_ptr<ILogger> logger, std::shared_ptr<IDiagnosticSink> diagnostics)
    : logger_{std::move(logger)}, diagnostics_{std::move(diagnostics)} {
    if (!logger_ || !diagnostics_) {
        throw std::invalid_argument("analyzer dependencies must not be null");
    }
}

AnalysisResult Analyzer::analyze(const ParsedDocument& document) const {
    AnalysisResult result;
    if (!document.root.is_object()) {
        result.validation.add(diagnostic("cca.analysis.invalid-root",
                                         "CCA-ANALYSIS-001",
                                         "Canonical document root is not an object.",
                                         "Use a YAML mapping at the document root.",
                                         document.root,
                                         "schema"));
        result.validation.sort();
        return result;
    }

    std::map<std::string, DiagnosticLocation, std::less<>> declared_identifiers;
    const auto register_identifier = [&](const std::string& identifier,
                                         const CanonicalValue& value,
                                         const std::string_view category) {
        if (identifier.empty()) {
            return;
        }
        if (!declared_identifiers.emplace(identifier, value.location()).second) {
            result.validation.add(diagnostic(
                "cca.analysis.duplicate-identifier." + identifier + '.' +
                    std::to_string(value.location().line),
                "CCA-ANALYSIS-002",
                "Identifier '" + identifier + "' is declared more than once.",
                "Give every category, object, relationship, dependency, rule, and artifact a "
                "unique identifier.",
                value,
                std::string{category}));
        }
    };

    register_identifier(string_field(document.root, "id"), document.root, "specification");

    std::set<std::string> category_identifiers;
    if (const auto* categories = array_field(document.root, "categories"); categories != nullptr) {
        for (const auto& category : *categories) {
            if (!category.is_object()) {
                continue;
            }
            const auto identifier = string_field(category, "id");
            register_identifier(identifier, category, "category");
            if (!identifier.empty()) {
                category_identifiers.insert(identifier);
            }
        }
    }

    std::set<std::string> object_identifiers;
    if (const auto* objects = array_field(document.root, "objects"); objects != nullptr) {
        for (const auto& object : *objects) {
            if (!object.is_object()) {
                continue;
            }

            const auto identifier = string_field(object, "id");
            const auto type = string_field(object, "type");
            if (!identifier.empty()) {
                register_identifier(identifier, object, "object");
                if (object_identifiers.insert(identifier).second) {
                    result.summary.object_identifiers.push_back(identifier);
                }
            }
            if (!type.empty()) {
                ++result.summary.objects_by_type[type];
            }
            const auto category = string_field(object, "category");
            if (!category.empty() && !category_identifiers.contains(category)) {
                result.validation.add(diagnostic(
                    "cca.analysis.unresolved-category." + identifier,
                    "CCA-ANALYSIS-006",
                    "Object '" + identifier + "' references unknown category '" + category + "'.",
                    "Reference a category declared in categories.",
                    object,
                    "reference"));
            }
        }
        for (const auto& object : *objects) {
            if (object.is_object()) {
                analyze_object_references(
                    object, string_field(object, "id"), object_identifiers, result);
            }
        }
    }

    for (const auto collection :
         {"relationships", "dependencies", "validation_rules", "artifacts"}) {
        if (const auto* values = array_field(document.root, collection); values != nullptr) {
            for (const auto& value : *values) {
                if (value.is_object()) {
                    register_identifier(string_field(value, "id"), value, collection);
                }
            }
        }
    }

    if (const auto* rules = array_field(document.root, "validation_rules"); rules != nullptr) {
        for (const auto& rule : *rules) {
            if (!rule.is_object()) {
                continue;
            }
            const auto id = string_field(rule, "id");
            const auto category = string_field(rule, "category");
            if (!category.empty() && !category_identifiers.contains(category)) {
                result.validation.add(diagnostic(
                    "cca.analysis.unresolved-rule-category." + id,
                    "CCA-ANALYSIS-008",
                    "Validation rule '" + id + "' references unknown category '" + category + "'.",
                    "Reference a category declared in categories.",
                    rule,
                    "reference"));
            }
        }
    }

    analyze_relationships(document.root, object_identifiers, result);
    analyze_dependencies(document.root, object_identifiers, result);

    std::ranges::sort(result.summary.object_identifiers);
    result.validation.sort();
    for (const auto& item : result.validation.diagnostics()) {
        diagnostics_->report(item);
    }
    logger_->log({result.ok() ? LogLevel::info : LogLevel::error,
                  "analyzer",
                  result.ok() ? "semantic analysis completed" : "semantic analysis failed"});
    return result;
}

Status Analyzer::analyze(const AnalysisRequest& request) const {
    if (request.source.empty()) {
        const auto status = Status::invalid_argument("analyzer source path must not be empty");
        diagnostics_->report({DiagnosticSeverity::error, "CCA-ANALYZER-001", status.message()});
        logger_->log({LogLevel::error, "analyzer", status.message()});
        return status;
    }
    return Status::invalid_argument(
        "path-only analysis is unavailable; load and parse the canonical document first");
}

} // namespace cca::compiler
