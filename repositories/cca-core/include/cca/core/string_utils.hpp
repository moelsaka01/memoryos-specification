#pragma once

#include <string>
#include <string_view>

namespace cca::core::strings {

/// Removes leading and trailing ASCII whitespace.
[[nodiscard]] std::string trim_ascii(std::string_view value);

/// Converts ASCII A-Z to a-z without depending on the process locale.
[[nodiscard]] std::string to_lower_ascii(std::string_view value);

/// Returns true when value is empty or contains only ASCII whitespace.
[[nodiscard]] bool is_blank_ascii(std::string_view value) noexcept;

} // namespace cca::core::strings
