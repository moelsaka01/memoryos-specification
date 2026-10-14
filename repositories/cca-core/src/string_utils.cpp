#include <cca/core/string_utils.hpp>

#include <algorithm>

namespace cca::core::strings {
namespace {

[[nodiscard]] constexpr bool is_ascii_whitespace(const char value) noexcept {
    return value == ' ' || value == '\t' || value == '\n' || value == '\r' || value == '\f' ||
           value == '\v';
}

} // namespace

std::string trim_ascii(const std::string_view value) {
    const auto first = std::find_if_not(value.begin(), value.end(), is_ascii_whitespace);
    const auto last = std::find_if_not(value.rbegin(), value.rend(), is_ascii_whitespace).base();

    if (first >= last) {
        return {};
    }
    return std::string{first, last};
}

std::string to_lower_ascii(const std::string_view value) {
    std::string result{value};
    std::ranges::transform(result, result.begin(), [](const char character) {
        if (character >= 'A' && character <= 'Z') {
            return static_cast<char>(character + ('a' - 'A'));
        }
        return character;
    });
    return result;
}

bool is_blank_ascii(const std::string_view value) noexcept {
    return std::ranges::all_of(value, is_ascii_whitespace);
}

} // namespace cca::core::strings
