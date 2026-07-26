#include "cca/compiler/serialization.hpp"

#include <algorithm>
#include <array>
#include <cstddef>
#include <iomanip>
#include <sstream>
#include <string>
#include <tuple>
#include <utility>
#include <vector>

#include "cca/compiler/internal_model.hpp"

namespace cca::compiler {
namespace {

struct InventoryEntry final {
    std::string id;
    std::string kind;
    std::string category;
    std::string name;
    std::string version;
};

template <typename Object>
void append_inventory(std::vector<InventoryEntry>& entries,
                      const std::vector<Object>& objects,
                      const std::string_view kind) {
    for (const auto& object : objects) {
        entries.push_back({
            .id = object.header.id.value(),
            .kind = std::string{kind},
            .category = object.header.category.value(),
            .name = object.header.metadata.name,
            .version = object.header.version.to_string(),
        });
    }
}

[[nodiscard]] std::vector<InventoryEntry> inventory(const Specification& specification) {
    std::vector<InventoryEntry> entries;
    entries.reserve(specification.packages.size() + specification.domains.size() +
                    specification.components.size() + specification.contracts.size() +
                    specification.requirements.size());
    append_inventory(entries, specification.packages, "package");
    append_inventory(entries, specification.domains, "domain");
    append_inventory(entries, specification.components, "component");
    append_inventory(entries, specification.contracts, "contract");
    append_inventory(entries, specification.requirements, "requirement");
    std::ranges::sort(entries, [](const InventoryEntry& left, const InventoryEntry& right) {
        return std::tie(left.id, left.kind) < std::tie(right.id, right.kind);
    });
    return entries;
}

[[nodiscard]] std::vector<const Diagnostic*>
ordered_diagnostics(const ValidationResult& validation) {
    std::vector<const Diagnostic*> ordered;
    ordered.reserve(validation.diagnostics().size());
    for (const auto& diagnostic : validation.diagnostics()) {
        ordered.push_back(&diagnostic);
    }
    std::ranges::sort(ordered, [](const Diagnostic* left, const Diagnostic* right) {
        return std::tuple{
                   left->location.path.generic_string(),
                   left->location.line,
                   left->location.column,
                   left->code,
                   left->message,
                   left->identifier,
               } < std::tuple{
                       right->location.path.generic_string(),
                       right->location.line,
                       right->location.column,
                       right->code,
                       right->message,
                       right->identifier,
                   };
    });
    return ordered;
}

[[nodiscard]] std::size_t note_count(const ValidationResult& validation) {
    return static_cast<std::size_t>(
        std::ranges::count_if(validation.diagnostics(), [](const Diagnostic& diagnostic) {
            return diagnostic.severity == DiagnosticSeverity::note;
        }));
}

} // namespace

std::string json_string(const std::string_view value) {
    std::ostringstream output;
    output << '"';
    for (const auto character : value) {
        const auto byte = static_cast<unsigned char>(character);
        switch (character) {
        case '"':
            output << "\\\"";
            break;
        case '\\':
            output << "\\\\";
            break;
        case '\b':
            output << "\\b";
            break;
        case '\f':
            output << "\\f";
            break;
        case '\n':
            output << "\\n";
            break;
        case '\r':
            output << "\\r";
            break;
        case '\t':
            output << "\\t";
            break;
        default:
            if (byte < 0x20U) {
                output << "\\u00" << std::hex << std::setw(2) << std::setfill('0')
                       << static_cast<unsigned int>(byte) << std::dec;
            } else {
                output << character;
            }
            break;
        }
    }
    output << '"';
    return output.str();
}

std::string serialize_validation_report(const ValidationResult& validation) {
    std::ostringstream output;
    output << "{\"diagnostics\":[";
    bool first = true;
    for (const auto* diagnostic : ordered_diagnostics(validation)) {
        if (!std::exchange(first, false)) {
            output << ',';
        }
        output << "{\"category\":" << json_string(diagnostic->category)
               << ",\"code\":" << json_string(diagnostic->code)
               << ",\"identifier\":" << json_string(diagnostic->identifier)
               << ",\"location\":{\"column\":" << diagnostic->location.column
               << ",\"line\":" << diagnostic->location.line
               << ",\"path\":" << json_string(diagnostic->location.path.generic_string()) << '}'
               << ",\"message\":" << json_string(diagnostic->message)
               << ",\"severity\":" << json_string(to_string(diagnostic->severity))
               << ",\"suggestion\":" << json_string(diagnostic->suggestion) << '}';
    }
    output << "],\"summary\":{\"errors\":" << validation.error_count()
           << ",\"notes\":" << note_count(validation)
           << ",\"total\":" << validation.diagnostics().size()
           << ",\"warnings\":" << validation.warning_count() << "}}";
    return output.str();
}

std::string serialize_specification_report(const Specification& specification,
                                           const ValidationResult& validation) {
    const auto object_total = specification.packages.size() + specification.domains.size() +
                              specification.components.size() + specification.contracts.size() +
                              specification.requirements.size();
    std::ostringstream output;
    output << "{\"categories\":" << specification.categories.size()
           << ",\"dependencies\":" << specification.dependencies.size()
           << ",\"diagnostics\":{\"errors\":" << validation.error_count()
           << ",\"warnings\":" << validation.warning_count() << '}'
           << ",\"format_version\":" << json_string(specification.format_version.to_string())
           << ",\"id\":" << json_string(specification.id.value())
           << ",\"kind\":" << json_string(specification.kind)
           << ",\"objects\":{\"components\":" << specification.components.size()
           << ",\"contracts\":" << specification.contracts.size()
           << ",\"domains\":" << specification.domains.size()
           << ",\"packages\":" << specification.packages.size()
           << ",\"requirements\":" << specification.requirements.size()
           << ",\"total\":" << object_total << '}'
           << ",\"relationships\":" << specification.relationships.size()
           << ",\"schema\":" << json_string(specification.schema_uri)
           << ",\"version\":" << json_string(specification.version.to_string()) << '}';
    return output.str();
}

std::string serialize_object_inventory(const Specification& specification) {
    const auto entries = inventory(specification);
    std::ostringstream output;
    output << "{\"objects\":[";
    bool first = true;
    for (const auto& entry : entries) {
        if (!std::exchange(first, false)) {
            output << ',';
        }
        output << "{\"category\":" << json_string(entry.category)
               << ",\"id\":" << json_string(entry.id) << ",\"kind\":" << json_string(entry.kind)
               << ",\"name\":" << json_string(entry.name)
               << ",\"version\":" << json_string(entry.version) << '}';
    }
    output << "],\"total\":" << entries.size() << '}';
    return output.str();
}

} // namespace cca::compiler
