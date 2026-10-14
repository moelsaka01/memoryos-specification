#pragma once

#include <iosfwd>
#include <memory>
#include <mutex>
#include <string>
#include <string_view>

namespace cca::core {

/// Severity levels ordered from most verbose to most severe.
enum class LogLevel {
    debug = 0,
    info = 1,
    warning = 2,
    error = 3,
};

/// Returns a stable lowercase representation of a log level.
[[nodiscard]] std::string_view to_string(LogLevel level) noexcept;

/// A transport-neutral log entry.
///
/// Timestamps and process metadata are intentionally absent: callers can decorate
/// entries in future sinks without making core behavior nondeterministic.
struct LogEntry final {
    LogLevel level;
    std::string component;
    std::string message;

    bool operator==(const LogEntry&) const = default;
};

/// Receives log entries from Logger.
///
/// Implementations own their synchronization policy. LogSink instances can be
/// shared by multiple Logger objects, which is why Logger accepts shared ownership.
class LogSink {
  public:
    virtual ~LogSink() = default;

    virtual void write(const LogEntry& entry) = 0;

  protected:
    LogSink() = default;
    LogSink(const LogSink&) = default;
    LogSink& operator=(const LogSink&) = default;
    LogSink(LogSink&&) = default;
    LogSink& operator=(LogSink&&) = default;
};

/// A small, dependency-injected logger with deterministic severity filtering.
class Logger final {
  public:
    explicit Logger(std::shared_ptr<LogSink> sink, LogLevel minimum_level = LogLevel::info);

    void log(LogLevel level, std::string_view component, std::string_view message) const;
    void debug(std::string_view component, std::string_view message) const;
    void info(std::string_view component, std::string_view message) const;
    void warning(std::string_view component, std::string_view message) const;
    void error(std::string_view component, std::string_view message) const;

    [[nodiscard]] LogLevel minimum_level() const noexcept;

  private:
    std::shared_ptr<LogSink> sink_;
    LogLevel minimum_level_;
};

/// A sink that deliberately discards all entries.
class NullLogSink final : public LogSink {
  public:
    void write(const LogEntry& entry) override;
};

/// Writes one stable, human-readable line per entry to a caller-owned stream.
///
/// The referenced stream must outlive the sink. Writes are serialized so one sink
/// may safely be shared by multiple Logger instances.
class OstreamLogSink final : public LogSink {
  public:
    explicit OstreamLogSink(std::ostream& stream) noexcept;

    void write(const LogEntry& entry) override;

  private:
    std::ostream& stream_;
    std::mutex mutex_;
};

} // namespace cca::core
