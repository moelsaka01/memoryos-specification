#include <cca/core/logging.hpp>

#include <ostream>
#include <stdexcept>
#include <utility>

namespace cca::core {

std::string_view to_string(const LogLevel level) noexcept {
    switch (level) {
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

Logger::Logger(std::shared_ptr<LogSink> sink, const LogLevel minimum_level)
    : sink_(std::move(sink)), minimum_level_(minimum_level) {
    if (!sink_) {
        throw std::invalid_argument{"logger sink must not be null"};
    }
}

void Logger::log(const LogLevel level,
                 const std::string_view component,
                 const std::string_view message) const {
    if (level < minimum_level_) {
        return;
    }

    sink_->write(LogEntry{
        .level = level,
        .component = std::string{component},
        .message = std::string{message},
    });
}

void Logger::debug(const std::string_view component, const std::string_view message) const {
    log(LogLevel::debug, component, message);
}

void Logger::info(const std::string_view component, const std::string_view message) const {
    log(LogLevel::info, component, message);
}

void Logger::warning(const std::string_view component, const std::string_view message) const {
    log(LogLevel::warning, component, message);
}

void Logger::error(const std::string_view component, const std::string_view message) const {
    log(LogLevel::error, component, message);
}

LogLevel Logger::minimum_level() const noexcept {
    return minimum_level_;
}

void NullLogSink::write(const LogEntry& entry) {
    static_cast<void>(entry);
}

OstreamLogSink::OstreamLogSink(std::ostream& stream) noexcept : stream_(stream) {}

void OstreamLogSink::write(const LogEntry& entry) {
    const std::scoped_lock lock{mutex_};
    stream_ << '[' << to_string(entry.level) << "] " << entry.component << ": " << entry.message
            << '\n';
}

} // namespace cca::core
