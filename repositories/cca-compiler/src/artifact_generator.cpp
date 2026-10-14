#include "cca/compiler/artifact_generator.hpp"

#include <algorithm>
#include <cctype>
#include <fstream>
#include <sstream>
#include <stdexcept>
#include <string>
#include <string_view>
#include <tuple>
#include <utility>
#include <vector>

#include "cca/compiler/serialization.hpp"

namespace cca::compiler {
namespace {

struct ModelObject final {
    std::string id;
    std::string kind;
    std::string category;
    std::string name;
    std::string version;
};

struct GraphEdge final {
    std::string source;
    std::string target;
    std::string label;
};

template <typename Object>
void append_objects(std::vector<ModelObject>& objects,
                    const std::vector<Object>& values,
                    const std::string_view kind) {
    for (const auto& value : values) {
        ModelObject object{
            .id = value.header.id.value(),
            .kind = std::string{kind},
            .category = value.header.category.value(),
            .name = value.header.metadata.name,
            .version = value.header.version.to_string(),
        };
        objects.push_back(std::move(object));
    }
}

[[nodiscard]] std::vector<ModelObject> model_objects(const Specification& specification) {
    std::vector<ModelObject> objects;
    objects.reserve(specification.object_count());
    append_objects(objects, specification.packages, "package");
    append_objects(objects, specification.domains, "domain");
    append_objects(objects, specification.components, "component");
    append_objects(objects, specification.contracts, "contract");
    append_objects(objects, specification.requirements, "requirement");
    std::ranges::sort(objects, [](const ModelObject& left, const ModelObject& right) {
        return std::tie(left.id, left.kind) < std::tie(right.id, right.kind);
    });
    return objects;
}

[[nodiscard]] std::string markdown_text(std::string_view text) {
    std::string escaped;
    escaped.reserve(text.size());
    for (const auto character : text) {
        if (character == '|' || character == '\\') {
            escaped.push_back('\\');
        }
        if (character == '\r' || character == '\n') {
            escaped.push_back(' ');
        } else {
            escaped.push_back(character);
        }
    }
    return escaped;
}

[[nodiscard]] std::string mermaid_text(std::string_view text) {
    std::string escaped;
    escaped.reserve(text.size());
    for (const auto character : text) {
        switch (character) {
        case '"':
            escaped += "&quot;";
            break;
        case '\r':
        case '\n':
            escaped.push_back(' ');
            break;
        default:
            escaped.push_back(character);
            break;
        }
    }
    return escaped;
}

[[nodiscard]] std::string documentation_index(const Specification& specification) {
    std::ostringstream output;
    output << "# " << specification.metadata.name << " - Generated Documentation\n\n"
           << "Canonical specification: `" << specification.id.value() << "` "
           << specification.version.to_string() << "\n\n"
           << "This index is generated deterministically from the canonical specification.\n\n"
           << "## Reports\n\n"
           << "- [Architecture summary](architecture-summary.md)\n"
           << "- [Dependency graph](dependency-graph.mmd)\n"
           << "- [Object inventory](object-inventory.json)\n"
           << "- [Specification report](specification-report.json)\n"
           << "- [Validation report](validation-report.json)\n"
           << "- [Code-generation boundary](generated/README.md)\n";
    return output.str();
}

[[nodiscard]] std::string dependency_graph(const Specification& specification) {
    const auto objects = model_objects(specification);
    std::vector<std::string> node_ids;
    node_ids.reserve(objects.size() + specification.dependencies.size() * 2);
    for (const auto& object : objects) {
        node_ids.push_back(object.id);
    }
    for (const auto& dependency : specification.dependencies) {
        node_ids.push_back(dependency.source.value());
        node_ids.push_back(dependency.target.value());
    }
    std::ranges::sort(node_ids);
    node_ids.erase(std::unique(node_ids.begin(), node_ids.end()), node_ids.end());

    std::vector<GraphEdge> edges;
    for (const auto& dependency : specification.dependencies) {
        auto label = std::string{"dependency"};
        if (!dependency.version.empty()) {
            label += " " + dependency.version;
        }
        if (dependency.optional) {
            label += " (optional)";
        }
        edges.push_back({dependency.source.value(), dependency.target.value(), std::move(label)});
    }
    std::ranges::sort(edges, [](const GraphEdge& left, const GraphEdge& right) {
        return std::tie(left.source, left.target, left.label) <
               std::tie(right.source, right.target, right.label);
    });

    const auto node_name = [&node_ids](const std::string& id) {
        const auto iterator = std::ranges::lower_bound(node_ids, id);
        return std::string{"n"} + std::to_string(std::distance(node_ids.begin(), iterator));
    };

    std::ostringstream output;
    output << "graph TD\n";
    for (const auto& id : node_ids) {
        output << "  " << node_name(id) << "[\"" << mermaid_text(id) << "\"]\n";
    }
    for (const auto& edge : edges) {
        output << "  " << node_name(edge.source) << " -->|\"" << mermaid_text(edge.label) << "\"| "
               << node_name(edge.target) << '\n';
    }
    return output.str();
}

[[nodiscard]] std::string architecture_summary(const Specification& specification) {
    const auto objects = model_objects(specification);
    std::ostringstream output;
    output << "# Architecture Summary\n\n"
           << "## Specification\n\n"
           << "- Identifier: `" << specification.id.value() << "`\n"
           << "- Name: " << specification.metadata.name << "\n"
           << "- Version: `" << specification.version.to_string() << "`\n"
           << "- Canonical format: `" << specification.format_version.to_string() << "`\n\n"
           << "## Inventory\n\n"
           << "| Kind | Count |\n"
           << "| --- | ---: |\n"
           << "| Package | " << specification.packages.size() << " |\n"
           << "| Domain | " << specification.domains.size() << " |\n"
           << "| Component | " << specification.components.size() << " |\n"
           << "| Contract | " << specification.contracts.size() << " |\n"
           << "| Requirement | " << specification.requirements.size() << " |\n"
           << "| **Total** | **" << objects.size() << "** |\n\n"
           << "## Objects\n\n"
           << "| Identifier | Kind | Category | Version |\n"
           << "| --- | --- | --- | --- |\n";
    for (const auto& object : objects) {
        output << "| `" << markdown_text(object.id) << "` | " << markdown_text(object.kind)
               << " | `" << markdown_text(object.category) << "` | `"
               << markdown_text(object.version) << "` |\n";
    }
    output << "\nThis summary describes specification structure only. It does not implement a "
              "runtime or generated production code.\n";
    return output.str();
}

[[nodiscard]] std::string generated_readme(const Specification& specification) {
    return "# Generated Code Placeholder\n\n"
           "The IS-002 standards compiler intentionally does not generate production code.\n\n"
           "This directory reserves the code-generation boundary for a future increment. "
           "The canonical specification `" +
           specification.id.value() + "` remains the single source of truth.\n";
}

void write_file(const std::filesystem::path& path, const std::string& content) {
    std::ofstream output{path, std::ios::binary | std::ios::trunc};
    if (!output) {
        throw std::runtime_error{"cannot open output file: " + path.generic_string()};
    }
    output << content;
    if (content.empty() || content.back() != '\n') {
        output << '\n';
    }
    output.close();
    if (!output) {
        throw std::runtime_error{"cannot write output file: " + path.generic_string()};
    }
}

[[nodiscard]] Diagnostic generation_error(const std::filesystem::path& output_directory,
                                          const std::string& message) {
    return {
        "cca.generator.output-write-failed",
        "CCA-GEN-001",
        DiagnosticSeverity::error,
        message,
        "Choose a writable output directory and run the command again.",
        {output_directory, 1, 1},
        "artifact",
    };
}

} // namespace

GenerationResult ArtifactGenerator::generate(const Specification& specification,
                                             const ValidationResult& validation,
                                             const std::filesystem::path& output_directory) const {
    GenerationResult result{.validation = validation, .files = {}};
    if (output_directory.empty()) {
        result.validation.add(
            generation_error(output_directory, "artifact output directory must not be empty"));
        result.validation.sort();
        return result;
    }

    try {
        std::filesystem::create_directories(output_directory / "generated");

        const std::vector<std::pair<std::filesystem::path, std::string>> artifacts{
            {output_directory / "documentation-index.md", documentation_index(specification)},
            {output_directory / "dependency-graph.mmd", dependency_graph(specification)},
            {output_directory / "specification-report.json",
             serialize_specification_report(specification, validation)},
            {output_directory / "validation-report.json", serialize_validation_report(validation)},
            {output_directory / "object-inventory.json", serialize_object_inventory(specification)},
            {output_directory / "architecture-summary.md", architecture_summary(specification)},
            {output_directory / "generated" / "README.md", generated_readme(specification)},
        };

        result.files.reserve(artifacts.size());
        for (const auto& [path, content] : artifacts) {
            write_file(path, content);
            result.files.push_back(path);
        }
    } catch (const std::filesystem::filesystem_error& error) {
        result.files.clear();
        result.validation.add(generation_error(output_directory, error.what()));
    } catch (const std::exception& error) {
        result.files.clear();
        result.validation.add(generation_error(output_directory, error.what()));
    }
    result.validation.sort();
    return result;
}

} // namespace cca::compiler
