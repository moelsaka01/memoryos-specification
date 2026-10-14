#include "cca/compiler/canonical_value.hpp"

#include <stdexcept>
#include <utility>

namespace cca::compiler {

CanonicalValue::CanonicalValue() : CanonicalValue{nullptr} {}

CanonicalValue::CanonicalValue(std::nullptr_t, DiagnosticLocation location)
    : storage_{nullptr}, location_{std::move(location)} {}

CanonicalValue::CanonicalValue(const bool value, DiagnosticLocation location)
    : storage_{value}, location_{std::move(location)} {}

CanonicalValue::CanonicalValue(const std::int64_t value, DiagnosticLocation location)
    : storage_{value}, location_{std::move(location)} {}

CanonicalValue::CanonicalValue(const double value, DiagnosticLocation location)
    : storage_{value}, location_{std::move(location)} {}

CanonicalValue::CanonicalValue(std::string value, DiagnosticLocation location)
    : storage_{std::move(value)}, location_{std::move(location)} {}

CanonicalValue::CanonicalValue(const char* value, DiagnosticLocation location)
    : CanonicalValue{std::string{value == nullptr ? "" : value}, std::move(location)} {}

CanonicalValue::CanonicalValue(Array value, DiagnosticLocation location)
    : storage_{std::move(value)}, location_{std::move(location)} {}

CanonicalValue::CanonicalValue(Object value, DiagnosticLocation location)
    : storage_{std::move(value)}, location_{std::move(location)} {}

CanonicalValue::Type CanonicalValue::type() const noexcept {
    return static_cast<Type>(storage_.index());
}

bool CanonicalValue::is_null() const noexcept {
    return std::holds_alternative<std::nullptr_t>(storage_);
}

bool CanonicalValue::is_boolean() const noexcept {
    return std::holds_alternative<bool>(storage_);
}

bool CanonicalValue::is_integer() const noexcept {
    return std::holds_alternative<std::int64_t>(storage_);
}

bool CanonicalValue::is_number() const noexcept {
    return is_integer() || std::holds_alternative<double>(storage_);
}

bool CanonicalValue::is_string() const noexcept {
    return std::holds_alternative<std::string>(storage_);
}

bool CanonicalValue::is_array() const noexcept {
    return std::holds_alternative<Array>(storage_);
}

bool CanonicalValue::is_object() const noexcept {
    return std::holds_alternative<Object>(storage_);
}

bool CanonicalValue::as_boolean() const {
    return std::get<bool>(storage_);
}

std::int64_t CanonicalValue::as_integer() const {
    return std::get<std::int64_t>(storage_);
}

double CanonicalValue::as_number() const {
    if (is_integer()) {
        return static_cast<double>(as_integer());
    }
    return std::get<double>(storage_);
}

const std::string& CanonicalValue::as_string() const {
    return std::get<std::string>(storage_);
}

const CanonicalValue::Array& CanonicalValue::as_array() const {
    return std::get<Array>(storage_);
}

const CanonicalValue::Object& CanonicalValue::as_object() const {
    return std::get<Object>(storage_);
}

CanonicalValue::Array& CanonicalValue::as_array() {
    return std::get<Array>(storage_);
}

CanonicalValue::Object& CanonicalValue::as_object() {
    return std::get<Object>(storage_);
}

const CanonicalValue* CanonicalValue::find(const std::string_view key) const noexcept {
    if (!is_object()) {
        return nullptr;
    }
    const auto iterator = as_object().find(key);
    return iterator == as_object().end() ? nullptr : &iterator->second;
}

CanonicalValue* CanonicalValue::find(const std::string_view key) noexcept {
    if (!is_object()) {
        return nullptr;
    }
    const auto iterator = as_object().find(key);
    return iterator == as_object().end() ? nullptr : &iterator->second;
}

const DiagnosticLocation& CanonicalValue::location() const noexcept {
    return location_;
}

std::string_view to_string(const CanonicalValue::Type type) noexcept {
    switch (type) {
    case CanonicalValue::Type::null:
        return "null";
    case CanonicalValue::Type::boolean:
        return "boolean";
    case CanonicalValue::Type::integer:
        return "integer";
    case CanonicalValue::Type::number:
        return "number";
    case CanonicalValue::Type::string:
        return "string";
    case CanonicalValue::Type::array:
        return "array";
    case CanonicalValue::Type::object:
        return "object";
    }
    return "unknown";
}

} // namespace cca::compiler
