#include <cca/runtime/runtime_id.hpp>

#include <stdexcept>
#include <utility>

namespace cca::runtime {

RuntimeId::RuntimeId(std::string value) : value_(std::move(value)) {
    if (value_.empty()) {
        throw std::invalid_argument{"runtime id must not be empty"};
    }
}

const std::string& RuntimeId::value() const noexcept {
    return value_;
}

} // namespace cca::runtime
