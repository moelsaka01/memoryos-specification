#include "cca/compiler/source_loader.hpp"

#include <array>
#include <cstdint>
#include <fstream>
#include <iterator>
#include <string_view>
#include <system_error>
#include <utility>

namespace cca::compiler {
namespace {

constexpr std::array<unsigned char, 3> utf8_bom{0xEFU, 0xBBU, 0xBFU};

[[nodiscard]] Diagnostic load_diagnostic(const std::filesystem::path& path,
                                         std::string code,
                                         std::string message,
                                         std::string suggestion) {
    return Diagnostic{code + ":document",
                      std::move(code),
                      DiagnosticSeverity::error,
                      std::move(message),
                      std::move(suggestion),
                      DiagnosticLocation{path, 1, 1},
                      "source"};
}

[[nodiscard]] bool is_continuation(const unsigned char byte) noexcept {
    return (byte & 0xC0U) == 0x80U;
}

[[nodiscard]] bool is_valid_utf8(const std::string_view input) noexcept {
    std::size_t index = 0;
    while (index < input.size()) {
        const auto first = static_cast<unsigned char>(input[index]);
        if (first <= 0x7FU) {
            ++index;
            continue;
        }

        std::size_t length = 0;
        std::uint32_t code_point = 0;
        std::uint32_t minimum = 0;
        if ((first & 0xE0U) == 0xC0U) {
            length = 2;
            code_point = first & 0x1FU;
            minimum = 0x80U;
        } else if ((first & 0xF0U) == 0xE0U) {
            length = 3;
            code_point = first & 0x0FU;
            minimum = 0x800U;
        } else if ((first & 0xF8U) == 0xF0U) {
            length = 4;
            code_point = first & 0x07U;
            minimum = 0x10000U;
        } else {
            return false;
        }

        if (index + length > input.size()) {
            return false;
        }
        for (std::size_t offset = 1; offset < length; ++offset) {
            const auto next = static_cast<unsigned char>(input[index + offset]);
            if (!is_continuation(next)) {
                return false;
            }
            code_point = (code_point << 6U) | (next & 0x3FU);
        }

        if (code_point < minimum || code_point > 0x10FFFFU ||
            (code_point >= 0xD800U && code_point <= 0xDFFFU)) {
            return false;
        }
        index += length;
    }
    return true;
}

[[nodiscard]] bool starts_with_bom(const std::string_view content) noexcept {
    return content.size() >= utf8_bom.size() &&
           static_cast<unsigned char>(content[0]) == utf8_bom[0] &&
           static_cast<unsigned char>(content[1]) == utf8_bom[1] &&
           static_cast<unsigned char>(content[2]) == utf8_bom[2];
}

} // namespace

bool LoadResult::ok() const noexcept {
    return document.has_value() && !validation.has_errors();
}

LoadResult FileSourceLoader::load(const std::filesystem::path& path) const {
    LoadResult result;
    if (path.empty()) {
        result.validation.add(
            load_diagnostic(path,
                            "CCA-LOAD-001",
                            "source path must not be empty",
                            "Provide the path to one UTF-8 YAML canonical specification."));
        return result;
    }

    std::error_code error;
    const bool exists = std::filesystem::exists(path, error);
    if (error || !exists) {
        result.validation.add(
            load_diagnostic(path,
                            "CCA-LOAD-002",
                            "source file does not exist",
                            "Check the path and ensure the specification file is available."));
        return result;
    }

    const bool regular_file = std::filesystem::is_regular_file(path, error);
    if (error || !regular_file) {
        result.validation.add(load_diagnostic(path,
                                              "CCA-LOAD-003",
                                              "source path does not name a regular file",
                                              "Provide a path to a regular UTF-8 YAML file."));
        return result;
    }

    std::ifstream stream{path, std::ios::binary};
    if (!stream.is_open()) {
        result.validation.add(load_diagnostic(
            path,
            "CCA-LOAD-004",
            "source file could not be opened for reading",
            "Verify read permissions and that no other process has denied access."));
        return result;
    }

    std::string content{std::istreambuf_iterator<char>{stream}, std::istreambuf_iterator<char>{}};
    if (stream.bad()) {
        result.validation.add(
            load_diagnostic(path,
                            "CCA-LOAD-005",
                            "source file could not be read completely",
                            "Check the storage device and retry with an intact file."));
        return result;
    }

    if (starts_with_bom(content)) {
        content.erase(0, utf8_bom.size());
    }
    if (!is_valid_utf8(content)) {
        result.validation.add(load_diagnostic(
            path,
            "CCA-LOAD-006",
            "source file is not valid UTF-8",
            "Save the canonical specification as UTF-8 without invalid byte sequences."));
        return result;
    }

    result.document = SourceDocument{path, std::move(content)};
    return result;
}

} // namespace cca::compiler
