#pragma once

#include <map>
#include <string>
#include <vector>

#include "cca/compiler/diagnostics.hpp"
#include "cca/compiler/parser.hpp"

namespace cca::compiler {

/// Deterministic dependency graph and dependency-first object ordering.
struct DependencyResolution final {
    std::map<std::string, std::vector<std::string>> graph;
    std::vector<std::string> order;
    ValidationResult validation;

    [[nodiscard]] bool ok() const noexcept;
};

/// Resolves canonical dependency declarations and checks cycles and versions.
class DependencyResolver final {
  public:
    [[nodiscard]] DependencyResolution resolve(const ParsedDocument& document) const;
};

} // namespace cca::compiler
