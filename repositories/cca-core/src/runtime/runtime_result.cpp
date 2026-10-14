#include <cca/runtime/runtime_result.hpp>

#include <stdexcept>
#include <utility>

namespace cca::runtime {

RuntimeResult RuntimeResult::success() {
    return RuntimeResult{true, {}, {}};
}

RuntimeResult RuntimeResult::failure(std::string code, std::string message) {
    if (code.empty()) {
        throw std::invalid_argument{"runtime failure code must not be empty"};
    }
    if (message.empty()) {
        throw std::invalid_argument{"runtime failure message must not be empty"};
    }
    return RuntimeResult{false, std::move(code), std::move(message)};
}

RuntimeResult::RuntimeResult(bool ok, std::string code, std::string message)
    : ok_(ok), code_(std::move(code)), message_(std::move(message)) {}

bool RuntimeResult::ok() const noexcept {
    return ok_;
}

RuntimeResult::operator bool() const noexcept {
    return ok();
}

const std::string& RuntimeResult::code() const noexcept {
    return code_;
}

const std::string& RuntimeResult::message() const noexcept {
    return message_;
}

} // namespace cca::runtime
