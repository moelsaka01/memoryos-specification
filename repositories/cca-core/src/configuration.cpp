#include <cca/core/configuration.hpp>

#include <stdexcept>
#include <utility>

namespace cca::core {

ConfigurationKey::ConfigurationKey(std::string value) : value_(std::move(value)) {
    if (value_.empty()) {
        throw std::invalid_argument{"configuration key must not be empty"};
    }
}

const std::string& ConfigurationKey::value() const noexcept {
    return value_;
}

Configuration::Configuration(std::map<ConfigurationKey, std::string> values)
    : values_(std::move(values)) {}

std::optional<Configuration::ValueReference>
Configuration::find(const ConfigurationKey& key) const noexcept {
    const auto iterator = values_.find(key);
    if (iterator == values_.end()) {
        return std::nullopt;
    }
    return std::cref(iterator->second);
}

std::string Configuration::get_or(const ConfigurationKey& key, std::string fallback) const {
    const auto value = find(key);
    return value.has_value() ? value->get() : std::move(fallback);
}

bool Configuration::contains(const ConfigurationKey& key) const noexcept {
    return values_.contains(key);
}

std::size_t Configuration::size() const noexcept {
    return values_.size();
}

bool Configuration::empty() const noexcept {
    return values_.empty();
}

ConfigurationBuilder& ConfigurationBuilder::set(ConfigurationKey key, std::string value) {
    values_.insert_or_assign(std::move(key), std::move(value));
    return *this;
}

Configuration ConfigurationBuilder::build() const& {
    return Configuration{values_};
}

Configuration ConfigurationBuilder::build() && {
    return Configuration{std::move(values_)};
}

} // namespace cca::core
