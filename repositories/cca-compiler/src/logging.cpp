#include "cca/compiler/logging.hpp"

#include <mutex>
#include <ostream>
#include <utility>

namespace cca::compiler {

std::string_view to_string(const LogLevel level) noexcept {
    switch (level) {
    case LogLevel::trace:
        return "trace";
    case LogLevel::debug:
        return "debug";
    case LogLevel::info:
        return "info";
    case LogLevel::warning:
        return "warning";
    case LogLevel::error:
        return "error";
    }
    return "unknown";
}

void NullLogger::log(LogRecord record) {
    static_cast<void>(record);
}

class StreamLogger::Impl final {
  public:
    explicit Impl(std::ostream& output) : output_{output} {}

    void log(const LogRecord& record) {
        const std::scoped_lock lock{mutex_};
        output_ << '[' << to_string(record.level) << "] " << record.component << ": "
                << record.message << '\n';
    }

  private:
    std::ostream& output_;
    std::mutex mutex_;
};

StreamLogger::StreamLogger(std::ostream& output) : impl_{std::make_unique<Impl>(output)} {}

StreamLogger::~StreamLogger() = default;

void StreamLogger::log(LogRecord record) {
    impl_->log(record);
}

} // namespace cca::compiler
