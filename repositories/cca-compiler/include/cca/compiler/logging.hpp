#pragma once

#include <iosfwd>
#include <memory>
#include <string>
#include <string_view>

namespace cca::compiler {

/// Severity assigned to a compiler log record.
enum class LogLevel {
    trace,
    debug,
    info,
    warning,
    error,
};

/// Returns the stable lowercase spelling of a log level.
[[nodiscard]] std::string_view to_string(LogLevel level) noexcept;

/// A structured record passed to an injected logger.
struct LogRecord final {
    LogLevel level{LogLevel::info};
    std::string component;
    std::string message;

    [[nodiscard]] bool operator==(const LogRecord&) const = default;
};

/// Logging abstraction used by compiler modules.
class ILogger {
  public:
    virtual ~ILogger() = default;

    virtual void log(LogRecord record) = 0;
};

/// Logger that intentionally discards all records.
class NullLogger final : public ILogger {
  public:
    void log(LogRecord record) override;
};

/// Thread-safe logger that writes one deterministic line per record.
class StreamLogger final : public ILogger {
  public:
    explicit StreamLogger(std::ostream& output);
    ~StreamLogger() override;

    StreamLogger(const StreamLogger&) = delete;
    StreamLogger& operator=(const StreamLogger&) = delete;
    StreamLogger(StreamLogger&&) = delete;
    StreamLogger& operator=(StreamLogger&&) = delete;

    void log(LogRecord record) override;

  private:
    class Impl;
    std::unique_ptr<Impl> impl_;
};

} // namespace cca::compiler
