#include <cca/runtime/runtime.hpp>
#include <cca/runtime/runtime_builder.hpp>

#include <stdexcept>
#include <utility>

namespace cca::runtime {

RuntimeBuilder::RuntimeBuilder(RuntimeId runtime_id)
    : runtime_id_(std::move(runtime_id)), log_sink_(std::make_shared<core::NullLogSink>()) {}

const RuntimeId& RuntimeBuilder::runtime_id() const noexcept {
    return runtime_id_;
}

RuntimeBuilder& RuntimeBuilder::set_configuration(core::ConfigurationKey key, std::string value) {
    configuration_builder_.set(std::move(key), std::move(value));
    return *this;
}

RuntimeBuilder& RuntimeBuilder::use_log_sink(std::shared_ptr<core::LogSink> sink) {
    if (sink == nullptr) {
        throw std::invalid_argument{"RuntimeBuilder log sink must not be null"};
    }
    log_sink_ = std::move(sink);
    return *this;
}

RuntimeBuilder& RuntimeBuilder::use_startup_policy(const StartupExecutionPolicy policy) noexcept {
    startup_policy_ = policy;
    return *this;
}

std::unique_ptr<Runtime> RuntimeBuilder::build() && {
    return std::unique_ptr<Runtime>{new Runtime{std::move(*this)}};
}

} // namespace cca::runtime
