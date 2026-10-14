#pragma once

#include <string>
#include <string_view>

#include "cca/compiler/diagnostics.hpp"

namespace cca::compiler {

struct Specification;

/// Escapes a UTF-8 string as a JSON string value, including surrounding quotes.
[[nodiscard]] std::string json_string(std::string_view value);

/// Serializes structured diagnostics using stable key and diagnostic ordering.
[[nodiscard]] std::string serialize_validation_report(const ValidationResult& validation);

/// Serializes the high-level canonical specification summary.
[[nodiscard]] std::string serialize_specification_report(const Specification& specification,
                                                         const ValidationResult& validation);

/// Serializes all typed canonical objects in stable identifier order.
[[nodiscard]] std::string serialize_object_inventory(const Specification& specification);

} // namespace cca::compiler
