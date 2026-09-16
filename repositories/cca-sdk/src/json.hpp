#pragma once

#include <charconv>
#include <cmath>
#include <cstddef>
#include <cstdint>
#include <limits>
#include <locale>
#include <map>
#include <optional>
#include <sstream>
#include <stdexcept>
#include <string>
#include <string_view>
#include <variant>
#include <vector>

namespace memoryos::detail {

class Json final {
  public:
    using Array = std::vector<Json>;
    using Object = std::map<std::string, Json, std::less<>>;
    using Value = std::variant<std::nullptr_t, bool, std::int64_t, double,
                               std::string, Array, Object>;

    Json() noexcept : value_(nullptr) {}
    Json(std::nullptr_t) noexcept : value_(nullptr) {}
    Json(bool value) noexcept : value_(value) {}
    Json(std::int64_t value) noexcept : value_(value) {}
    Json(std::size_t value)
        : value_(checked_integer(value)) {}
    Json(double value) : value_(checked_number(value)) {}
    Json(std::string value) : value_(std::move(value)) {}
    Json(std::string_view value) : value_(std::string{value}) {}
    Json(const char* value) : value_(std::string{value}) {}
    Json(Array value) : value_(std::move(value)) {}
    Json(Object value) : value_(std::move(value)) {}

    [[nodiscard]] bool isNull() const noexcept {
        return std::holds_alternative<std::nullptr_t>(value_);
    }
    [[nodiscard]] bool isBool() const noexcept {
        return std::holds_alternative<bool>(value_);
    }
    [[nodiscard]] bool isInteger() const noexcept {
        return std::holds_alternative<std::int64_t>(value_);
    }
    [[nodiscard]] bool isNumber() const noexcept {
        return isInteger() || std::holds_alternative<double>(value_);
    }
    [[nodiscard]] bool isString() const noexcept {
        return std::holds_alternative<std::string>(value_);
    }
    [[nodiscard]] bool isArray() const noexcept {
        return std::holds_alternative<Array>(value_);
    }
    [[nodiscard]] bool isObject() const noexcept {
        return std::holds_alternative<Object>(value_);
    }

    [[nodiscard]] bool asBool() const { return std::get<bool>(value_); }
    [[nodiscard]] std::int64_t asInteger() const {
        return std::get<std::int64_t>(value_);
    }
    [[nodiscard]] const std::string& asString() const {
        return std::get<std::string>(value_);
    }
    [[nodiscard]] const Array& asArray() const { return std::get<Array>(value_); }
    [[nodiscard]] const Object& asObject() const {
        return std::get<Object>(value_);
    }

    [[nodiscard]] const Json* find(std::string_view name) const noexcept {
        if (!isObject()) {
            return nullptr;
        }
        const auto& object = asObject();
        const auto found = object.find(name);
        return found == object.end() ? nullptr : &found->second;
    }

    [[nodiscard]] const Json& require(std::string_view name) const {
        const auto* member = find(name);
        if (member == nullptr) {
            throw std::invalid_argument{"JSON member is missing"};
        }
        return *member;
    }

    [[nodiscard]] static Json parse(std::string_view source) {
        Parser parser{source};
        Json value = parser.parseValue();
        parser.skipWhitespace();
        if (!parser.atEnd()) {
            throw std::invalid_argument{"JSON has trailing input"};
        }
        return value;
    }

    [[nodiscard]] std::string serialize() const {
        std::string output;
        output.reserve(256U);
        appendSerialized(output, *this);
        return output;
    }

  private:
    template <typename Floating>
    [[nodiscard]] static std::optional<Floating>
    parseFloating(std::string_view token) {
        Floating value{};
        // Xcode 15.4's libc++ exposes integer but not floating-point from_chars.
        if constexpr (requires(const char* first,
                               const char* last,
                               Floating& candidate) {
                          std::from_chars(first,
                                          last,
                                          candidate,
                                          std::chars_format::general);
                      }) {
            const auto converted = std::from_chars(
                token.data(), token.data() + token.size(), value, std::chars_format::general);
            if (converted.ec != std::errc{} ||
                converted.ptr != token.data() + token.size()) {
                return std::nullopt;
            }
        } else {
            // JSON tokenization already fixed the grammar; retain locale-free conversion.
            std::istringstream input{std::string{token}};
            input.imbue(std::locale::classic());
            input >> std::noskipws >> value;
            if (input.fail() ||
                input.rdbuf()->sgetc() != std::char_traits<char>::eof()) {
                return std::nullopt;
            }
        }
        if (!std::isfinite(value)) {
            return std::nullopt;
        }
        return value;
    }

    class Parser final {
      public:
        explicit Parser(std::string_view source) : source_(source) {}

        [[nodiscard]] Json parseValue() {
            skipWhitespace();
            if (atEnd()) {
                throw std::invalid_argument{"JSON value is missing"};
            }
            switch (peek()) {
            case 'n':
                consumeLiteral("null");
                return Json{};
            case 't':
                consumeLiteral("true");
                return Json{true};
            case 'f':
                consumeLiteral("false");
                return Json{false};
            case '"':
                return Json{parseString()};
            case '[':
                return Json{parseArray()};
            case '{':
                return Json{parseObject()};
            default:
                return parseNumber();
            }
        }

        void skipWhitespace() noexcept {
            while (!atEnd()) {
                const char value = peek();
                if (value != ' ' && value != '\n' && value != '\r' &&
                    value != '\t') {
                    break;
                }
                ++position_;
            }
        }

        [[nodiscard]] bool atEnd() const noexcept {
            return position_ == source_.size();
        }

      private:
        [[nodiscard]] char peek() const { return source_[position_]; }

        [[nodiscard]] char consume() {
            if (atEnd()) {
                throw std::invalid_argument{"Unexpected end of JSON"};
            }
            return source_[position_++];
        }

        void expect(char expected) {
            if (consume() != expected) {
                throw std::invalid_argument{"Unexpected JSON token"};
            }
        }

        void consumeLiteral(std::string_view literal) {
            if (source_.substr(position_, literal.size()) != literal) {
                throw std::invalid_argument{"Invalid JSON literal"};
            }
            position_ += literal.size();
        }

        [[nodiscard]] static unsigned hexDigit(char value) {
            if (value >= '0' && value <= '9') {
                return static_cast<unsigned>(value - '0');
            }
            if (value >= 'a' && value <= 'f') {
                return static_cast<unsigned>(value - 'a') + 10U;
            }
            if (value >= 'A' && value <= 'F') {
                return static_cast<unsigned>(value - 'A') + 10U;
            }
            throw std::invalid_argument{"Invalid JSON Unicode escape"};
        }

        [[nodiscard]] std::uint32_t parseHexCodeUnit() {
            std::uint32_t value = 0U;
            for (unsigned index = 0U; index < 4U; ++index) {
                value = (value << 4U) | hexDigit(consume());
            }
            return value;
        }

        static void appendUtf8(std::string& output, std::uint32_t codePoint) {
            if (codePoint <= 0x7FU) {
                output.push_back(static_cast<char>(codePoint));
            } else if (codePoint <= 0x7FFU) {
                output.push_back(static_cast<char>(0xC0U | (codePoint >> 6U)));
                output.push_back(static_cast<char>(0x80U | (codePoint & 0x3FU)));
            } else if (codePoint <= 0xFFFFU) {
                output.push_back(static_cast<char>(0xE0U | (codePoint >> 12U)));
                output.push_back(static_cast<char>(
                    0x80U | ((codePoint >> 6U) & 0x3FU)));
                output.push_back(static_cast<char>(0x80U | (codePoint & 0x3FU)));
            } else if (codePoint <= 0x10FFFFU) {
                output.push_back(static_cast<char>(0xF0U | (codePoint >> 18U)));
                output.push_back(static_cast<char>(
                    0x80U | ((codePoint >> 12U) & 0x3FU)));
                output.push_back(static_cast<char>(
                    0x80U | ((codePoint >> 6U) & 0x3FU)));
                output.push_back(static_cast<char>(0x80U | (codePoint & 0x3FU)));
            } else {
                throw std::invalid_argument{"Invalid JSON code point"};
            }
        }

        [[nodiscard]] std::string parseString() {
            expect('"');
            std::string output;
            while (true) {
                const unsigned char value =
                    static_cast<unsigned char>(consume());
                if (value == static_cast<unsigned char>('"')) {
                    return output;
                }
                if (value < 0x20U) {
                    throw std::invalid_argument{"Control character in JSON string"};
                }
                if (value != static_cast<unsigned char>('\\')) {
                    output.push_back(static_cast<char>(value));
                    continue;
                }
                const char escape = consume();
                switch (escape) {
                case '"': output.push_back('"'); break;
                case '\\': output.push_back('\\'); break;
                case '/': output.push_back('/'); break;
                case 'b': output.push_back('\b'); break;
                case 'f': output.push_back('\f'); break;
                case 'n': output.push_back('\n'); break;
                case 'r': output.push_back('\r'); break;
                case 't': output.push_back('\t'); break;
                case 'u': {
                    std::uint32_t codePoint = parseHexCodeUnit();
                    if (codePoint >= 0xD800U && codePoint <= 0xDBFFU) {
                        if (consume() != '\\' || consume() != 'u') {
                            throw std::invalid_argument{
                                "Unpaired JSON high surrogate"};
                        }
                        const std::uint32_t low = parseHexCodeUnit();
                        if (low < 0xDC00U || low > 0xDFFFU) {
                            throw std::invalid_argument{
                                "Unpaired JSON high surrogate"};
                        }
                        codePoint = 0x10000U +
                            ((codePoint - 0xD800U) << 10U) +
                            (low - 0xDC00U);
                    } else if (codePoint >= 0xDC00U &&
                               codePoint <= 0xDFFFU) {
                        throw std::invalid_argument{
                            "Unpaired JSON low surrogate"};
                    }
                    appendUtf8(output, codePoint);
                    break;
                }
                default:
                    throw std::invalid_argument{"Invalid JSON escape"};
                }
            }
        }

        [[nodiscard]] Array parseArray() {
            expect('[');
            skipWhitespace();
            Array values;
            if (!atEnd() && peek() == ']') {
                ++position_;
                return values;
            }
            while (true) {
                values.push_back(parseValue());
                skipWhitespace();
                const char delimiter = consume();
                if (delimiter == ']') {
                    return values;
                }
                if (delimiter != ',') {
                    throw std::invalid_argument{"Invalid JSON array"};
                }
            }
        }

        [[nodiscard]] Object parseObject() {
            expect('{');
            skipWhitespace();
            Object values;
            if (!atEnd() && peek() == '}') {
                ++position_;
                return values;
            }
            while (true) {
                skipWhitespace();
                if (atEnd() || peek() != '"') {
                    throw std::invalid_argument{"Invalid JSON object key"};
                }
                std::string key = parseString();
                skipWhitespace();
                expect(':');
                Json value = parseValue();
                if (!values.emplace(std::move(key), std::move(value)).second) {
                    throw std::invalid_argument{"Duplicate JSON object key"};
                }
                skipWhitespace();
                const char delimiter = consume();
                if (delimiter == '}') {
                    return values;
                }
                if (delimiter != ',') {
                    throw std::invalid_argument{"Invalid JSON object"};
                }
            }
        }

        [[nodiscard]] Json parseNumber() {
            const std::size_t begin = position_;
            if (peek() == '-') {
                ++position_;
            }
            if (atEnd()) {
                throw std::invalid_argument{"Invalid JSON number"};
            }
            if (peek() == '0') {
                ++position_;
            } else {
                if (peek() < '1' || peek() > '9') {
                    throw std::invalid_argument{"Invalid JSON number"};
                }
                while (!atEnd() && peek() >= '0' && peek() <= '9') {
                    ++position_;
                }
            }
            bool integral = true;
            if (!atEnd() && peek() == '.') {
                integral = false;
                ++position_;
                if (atEnd() || peek() < '0' || peek() > '9') {
                    throw std::invalid_argument{"Invalid JSON number"};
                }
                while (!atEnd() && peek() >= '0' && peek() <= '9') {
                    ++position_;
                }
            }
            if (!atEnd() && (peek() == 'e' || peek() == 'E')) {
                integral = false;
                ++position_;
                if (!atEnd() && (peek() == '+' || peek() == '-')) {
                    ++position_;
                }
                if (atEnd() || peek() < '0' || peek() > '9') {
                    throw std::invalid_argument{"Invalid JSON number"};
                }
                while (!atEnd() && peek() >= '0' && peek() <= '9') {
                    ++position_;
                }
            }
            const auto token = source_.substr(begin, position_ - begin);
            if (integral) {
                std::int64_t integer = 0;
                const auto converted = std::from_chars(
                    token.data(), token.data() + token.size(), integer);
                if (converted.ec == std::errc{} &&
                    converted.ptr == token.data() + token.size()) {
                    return Json{integer};
                }
            }
            const auto number = Json::parseFloating<double>(token);
            if (!number.has_value()) {
                throw std::invalid_argument{"Invalid JSON number"};
            }
            return Json{*number};
        }

        std::string_view source_;
        std::size_t position_{0U};
    };

    [[nodiscard]] static std::int64_t checked_integer(std::size_t value) {
        constexpr auto maximum =
            static_cast<std::size_t>(std::numeric_limits<std::int64_t>::max());
        if (value > maximum) {
            throw std::out_of_range{"JSON integer is out of range"};
        }
        return static_cast<std::int64_t>(value);
    }

    [[nodiscard]] static double checked_number(double value) {
        if (!std::isfinite(value)) {
            throw std::invalid_argument{"JSON number must be finite"};
        }
        return value;
    }

    static void appendString(std::string& output, std::string_view value) {
        constexpr char hex[] = "0123456789abcdef";
        output.push_back('"');
        for (const char rawCharacter : value) {
            const auto character = static_cast<unsigned char>(rawCharacter);
            switch (character) {
            case '"': output.append("\\\""); break;
            case '\\': output.append("\\\\"); break;
            case '\b': output.append("\\b"); break;
            case '\f': output.append("\\f"); break;
            case '\n': output.append("\\n"); break;
            case '\r': output.append("\\r"); break;
            case '\t': output.append("\\t"); break;
            default:
                if (character < 0x20U) {
                    output.append("\\u00");
                    output.push_back(hex[(character >> 4U) & 0x0FU]);
                    output.push_back(hex[character & 0x0FU]);
                } else {
                    output.push_back(static_cast<char>(character));
                }
                break;
            }
        }
        output.push_back('"');
    }

    static void appendSerialized(std::string& output, const Json& value) {
        if (value.isNull()) {
            output.append("null");
        } else if (value.isBool()) {
            output.append(value.asBool() ? "true" : "false");
        } else if (value.isInteger()) {
            char buffer[32]{};
            const auto result = std::to_chars(
                buffer, buffer + sizeof(buffer), value.asInteger());
            if (result.ec != std::errc{}) {
                throw std::runtime_error{"Failed to serialize JSON integer"};
            }
            output.append(buffer, result.ptr);
        } else if (std::holds_alternative<double>(value.value_)) {
            char buffer[64]{};
            const auto result = std::to_chars(
                buffer, buffer + sizeof(buffer),
                std::get<double>(value.value_), std::chars_format::general);
            if (result.ec != std::errc{}) {
                throw std::runtime_error{"Failed to serialize JSON number"};
            }
            output.append(buffer, result.ptr);
        } else if (value.isString()) {
            appendString(output, value.asString());
        } else if (value.isArray()) {
            output.push_back('[');
            bool first = true;
            for (const auto& member : value.asArray()) {
                if (!first) {
                    output.push_back(',');
                }
                first = false;
                appendSerialized(output, member);
            }
            output.push_back(']');
        } else {
            output.push_back('{');
            bool first = true;
            for (const auto& [name, member] : value.asObject()) {
                if (!first) {
                    output.push_back(',');
                }
                first = false;
                appendString(output, name);
                output.push_back(':');
                appendSerialized(output, member);
            }
            output.push_back('}');
        }
    }

    Value value_;
};

inline Json::Array jsonStrings(const std::vector<std::string>& values) {
    Json::Array result;
    result.reserve(values.size());
    for (const auto& value : values) {
        result.emplace_back(value);
    }
    return result;
}

} // namespace memoryos::detail
