#include "cca/compiler/dependency_resolver.hpp"

#include <algorithm>
#include <charconv>
#include <cstdint>
#include <map>
#include <queue>
#include <set>
#include <sstream>
#include <string_view>
#include <tuple>
#include <utility>

#include "cca/compiler/canonical_value.hpp"

namespace cca::compiler {
namespace {

struct SemanticVersion final {
    std::uint64_t major{0};
    std::uint64_t minor{0};
    std::uint64_t patch{0};

    [[nodiscard]] auto operator<=>(const SemanticVersion&) const = default;
};

[[nodiscard]] const CanonicalValue::Array* array_field(const CanonicalValue& value,
                                                       const std::string_view name) {
    const auto* field = value.find(name);
    return field != nullptr && field->is_array() ? &field->as_array() : nullptr;
}

[[nodiscard]] std::string string_field(const CanonicalValue& value, const std::string_view name) {
    const auto* field = value.find(name);
    return field != nullptr && field->is_string() ? field->as_string() : std::string{};
}

[[nodiscard]] bool parse_part(const std::string_view text, std::uint64_t& output) {
    if (text.empty()) {
        return false;
    }
    const auto* begin = text.data();
    const auto* end = begin + text.size();
    const auto result = std::from_chars(begin, end, output);
    return result.ec == std::errc{} && result.ptr == end;
}

[[nodiscard]] bool parse_version(std::string_view text, SemanticVersion& output) {
    if (const auto separator = text.find_first_of("+-"); separator != std::string_view::npos) {
        text = text.substr(0, separator);
    }
    const auto first = text.find('.');
    const auto second =
        first == std::string_view::npos ? std::string_view::npos : text.find('.', first + 1);
    if (first == std::string_view::npos || second == std::string_view::npos ||
        text.find('.', second + 1) != std::string_view::npos) {
        return false;
    }

    return parse_part(text.substr(0, first), output.major) &&
           parse_part(text.substr(first + 1, second - first - 1), output.minor) &&
           parse_part(text.substr(second + 1), output.patch);
}

[[nodiscard]] bool satisfies(const std::string_view constraint,
                             const std::string_view candidate_text) {
    if (constraint == "*") {
        return true;
    }

    const auto marker =
        !constraint.empty() && (constraint.front() == '^' || constraint.front() == '~')
            ? constraint.front()
            : '\0';
    const auto version_text = marker == '\0' ? constraint : constraint.substr(1);
    SemanticVersion minimum;
    SemanticVersion candidate;
    if (!parse_version(version_text, minimum) || !parse_version(candidate_text, candidate)) {
        return false;
    }
    if (marker == '\0') {
        return constraint == candidate_text;
    }
    if (candidate < minimum) {
        return false;
    }
    if (marker == '~') {
        return candidate.major == minimum.major && candidate.minor == minimum.minor;
    }
    if (minimum.major > 0) {
        return candidate.major == minimum.major;
    }
    if (minimum.minor > 0) {
        return candidate.major == 0 && candidate.minor == minimum.minor;
    }
    return candidate.major == 0 && candidate.minor == 0 && candidate.patch == minimum.patch;
}

[[nodiscard]] Diagnostic error(std::string identifier,
                               std::string code,
                               std::string message,
                               std::string suggestion,
                               const CanonicalValue& value) {
    return Diagnostic{std::move(identifier),
                      std::move(code),
                      DiagnosticSeverity::error,
                      std::move(message),
                      std::move(suggestion),
                      value.location(),
                      "dependency"};
}

[[nodiscard]] std::string join(const std::vector<std::string>& values) {
    std::ostringstream output;
    for (std::size_t index = 0; index < values.size(); ++index) {
        if (index != 0) {
            output << ", ";
        }
        output << values[index];
    }
    return output.str();
}

} // namespace

bool DependencyResolution::ok() const noexcept {
    return !validation.has_errors();
}

DependencyResolution DependencyResolver::resolve(const ParsedDocument& document) const {
    DependencyResolution result;
    if (!document.root.is_object()) {
        return result;
    }

    std::map<std::string, std::string> versions;
    if (const auto* objects = array_field(document.root, "objects"); objects != nullptr) {
        for (const auto& object : *objects) {
            if (!object.is_object()) {
                continue;
            }
            const auto identifier = string_field(object, "id");
            if (!identifier.empty()) {
                versions.emplace(identifier, string_field(object, "version"));
                result.graph.try_emplace(identifier);
            }
        }
    }

    std::map<std::string, std::size_t> dependency_count;
    std::map<std::string, std::vector<std::string>> dependents;
    for (const auto& [identifier, version] : versions) {
        static_cast<void>(version);
        dependency_count.emplace(identifier, 0);
        dependents.emplace(identifier, std::vector<std::string>{});
    }

    if (const auto* dependencies = array_field(document.root, "dependencies");
        dependencies != nullptr) {
        for (const auto& dependency : *dependencies) {
            if (!dependency.is_object()) {
                continue;
            }
            const auto id = string_field(dependency, "id");
            const auto source = string_field(dependency, "source");
            const auto target = string_field(dependency, "target");
            const auto constraint = string_field(dependency, "version");
            if (!versions.contains(source) || !versions.contains(target)) {
                continue;
            }

            if (std::ranges::find(result.graph[source], target) == result.graph[source].end()) {
                result.graph[source].push_back(target);
                dependents[target].push_back(source);
                ++dependency_count[source];
            }

            if (!satisfies(constraint, versions[target])) {
                result.validation.add(
                    error("cca.dependency.incompatible-version." + id,
                          "CCA-DEPENDENCY-002",
                          "Dependency '" + id + "' requires '" + constraint + "', but target '" +
                              target + "' declares version '" + versions[target] + "'.",
                          "Change the constraint or use a compatible target version.",
                          dependency));
            }
        }
    }

    for (auto& [identifier, targets] : result.graph) {
        static_cast<void>(identifier);
        std::ranges::sort(targets);
        targets.erase(std::ranges::unique(targets).begin(), targets.end());
    }
    for (auto& [identifier, values] : dependents) {
        static_cast<void>(identifier);
        std::ranges::sort(values);
        values.erase(std::ranges::unique(values).begin(), values.end());
    }

    std::priority_queue<std::string, std::vector<std::string>, std::greater<>> ready;
    for (const auto& [identifier, count] : dependency_count) {
        if (count == 0) {
            ready.push(identifier);
        }
    }
    while (!ready.empty()) {
        auto identifier = ready.top();
        ready.pop();
        result.order.push_back(identifier);
        for (const auto& dependent : dependents[identifier]) {
            if (--dependency_count[dependent] == 0) {
                ready.push(dependent);
            }
        }
    }

    if (result.order.size() != versions.size()) {
        std::vector<std::string> cycle_members;
        for (const auto& [identifier, count] : dependency_count) {
            if (count != 0) {
                cycle_members.push_back(identifier);
            }
        }
        result.validation.add(Diagnostic{
            "cca.dependency.circular",
            "CCA-DEPENDENCY-001",
            DiagnosticSeverity::error,
            "Circular dependency detected among: " + join(cycle_members) + ".",
            "Remove at least one dependency edge so the graph is acyclic.",
            document.root.location(),
            "dependency",
        });
    }

    result.validation.sort();
    return result;
}

} // namespace cca::compiler
