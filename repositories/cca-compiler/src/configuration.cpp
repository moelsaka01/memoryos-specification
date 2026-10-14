#include "cca/compiler/configuration.hpp"

#include <utility>

namespace cca::compiler {

CompilerConfiguration::CompilerConfiguration(std::filesystem::path output_directory,
                                             const LogLevel minimum_log_level,
                                             const bool diagnostics_enabled)
    : output_directory_{std::move(output_directory)}, minimum_log_level_{minimum_log_level},
      diagnostics_enabled_{diagnostics_enabled} {}

CompilerConfiguration CompilerConfiguration::defaults() {
    return CompilerConfiguration{
        std::filesystem::path{"cca-out"},
        LogLevel::info,
        true,
    };
}

const std::filesystem::path& CompilerConfiguration::output_directory() const noexcept {
    return output_directory_;
}

LogLevel CompilerConfiguration::minimum_log_level() const noexcept {
    return minimum_log_level_;
}

bool CompilerConfiguration::diagnostics_enabled() const noexcept {
    return diagnostics_enabled_;
}

Status CompilerConfiguration::validate() const {
    if (output_directory_.empty()) {
        return Status::invalid_argument("configuration output directory must not be empty");
    }
    return Status::success();
}

} // namespace cca::compiler
