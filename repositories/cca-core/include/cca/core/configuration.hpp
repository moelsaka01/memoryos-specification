#pragma once

#include <compare>
#include <cstddef>
#include <functional>
#include <map>
#include <optional>
#include <string>

namespace cca::core {

/// A validated, strongly typed key used to address configuration values.
///
/// Empty keys are rejected with std::invalid_argument. Keys are compared
/// lexicographically so configuration iteration and test output are deterministic.
class ConfigurationKey final {
  public:
    explicit ConfigurationKey(std::string value);

    [[nodiscard]] const std::string& value() const noexcept;

    auto operator<=>(const ConfigurationKey&) const noexcept = default;

  private:
    std::string value_;
};

/// An immutable snapshot of string configuration values.
///
/// Configuration deliberately has no knowledge of files, environment variables,
/// or command-line precedence. Those policies require an authoritative CCA
/// specification and can be layered on top without changing this value type.
class Configuration final {
  public:
    using ValueReference = std::reference_wrapper<const std::string>;

    Configuration() = default;

    [[nodiscard]] std::optional<ValueReference> find(const ConfigurationKey& key) const noexcept;
    [[nodiscard]] std::string get_or(const ConfigurationKey& key, std::string fallback) const;
    [[nodiscard]] bool contains(const ConfigurationKey& key) const noexcept;
    [[nodiscard]] std::size_t size() const noexcept;
    [[nodiscard]] bool empty() const noexcept;

  private:
    friend class ConfigurationBuilder;

    explicit Configuration(std::map<ConfigurationKey, std::string> values);

    std::map<ConfigurationKey, std::string> values_;
};

/// Builds immutable Configuration snapshots without exposing mutation afterward.
///
/// Setting an existing key replaces its value. This deterministic, last-write
/// behavior applies only inside the builder and does not define source precedence.
class ConfigurationBuilder final {
  public:
    ConfigurationBuilder() = default;

    ConfigurationBuilder& set(ConfigurationKey key, std::string value);

    [[nodiscard]] Configuration build() const&;
    [[nodiscard]] Configuration build() &&;

  private:
    std::map<ConfigurationKey, std::string> values_;
};

} // namespace cca::core
