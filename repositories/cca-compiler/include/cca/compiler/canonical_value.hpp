#pragma once

#include <cstdint>
#include <map>
#include <string>
#include <string_view>
#include <variant>
#include <vector>

#include "cca/compiler/diagnostics.hpp"

namespace cca::compiler {

/// Serialization-format-independent recursive value used at the parse boundary.
class CanonicalValue final {
  public:
    using Array = std::vector<CanonicalValue>;
    using Object = std::map<std::string, CanonicalValue, std::less<>>;

    enum class Type {
        null,
        boolean,
        integer,
        number,
        string,
        array,
        object,
    };

    CanonicalValue();
    explicit CanonicalValue(std::nullptr_t, DiagnosticLocation location = {});
    explicit CanonicalValue(bool value, DiagnosticLocation location = {});
    explicit CanonicalValue(std::int64_t value, DiagnosticLocation location = {});
    explicit CanonicalValue(double value, DiagnosticLocation location = {});
    explicit CanonicalValue(std::string value, DiagnosticLocation location = {});
    explicit CanonicalValue(const char* value, DiagnosticLocation location = {});
    explicit CanonicalValue(Array value, DiagnosticLocation location = {});
    explicit CanonicalValue(Object value, DiagnosticLocation location = {});

    [[nodiscard]] Type type() const noexcept;
    [[nodiscard]] bool is_null() const noexcept;
    [[nodiscard]] bool is_boolean() const noexcept;
    [[nodiscard]] bool is_integer() const noexcept;
    [[nodiscard]] bool is_number() const noexcept;
    [[nodiscard]] bool is_string() const noexcept;
    [[nodiscard]] bool is_array() const noexcept;
    [[nodiscard]] bool is_object() const noexcept;

    [[nodiscard]] bool as_boolean() const;
    [[nodiscard]] std::int64_t as_integer() const;
    [[nodiscard]] double as_number() const;
    [[nodiscard]] const std::string& as_string() const;
    [[nodiscard]] const Array& as_array() const;
    [[nodiscard]] const Object& as_object() const;
    [[nodiscard]] Array& as_array();
    [[nodiscard]] Object& as_object();

    [[nodiscard]] const CanonicalValue* find(std::string_view key) const noexcept;
    [[nodiscard]] CanonicalValue* find(std::string_view key) noexcept;
    [[nodiscard]] const DiagnosticLocation& location() const noexcept;

    [[nodiscard]] bool operator==(const CanonicalValue&) const = default;

  private:
    using Storage =
        std::variant<std::nullptr_t, bool, std::int64_t, double, std::string, Array, Object>;

    Storage storage_;
    DiagnosticLocation location_;
};

[[nodiscard]] std::string_view to_string(CanonicalValue::Type type) noexcept;

} // namespace cca::compiler
