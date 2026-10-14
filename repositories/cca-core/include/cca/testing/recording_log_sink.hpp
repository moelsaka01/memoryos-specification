#pragma once

#include <cca/core/logging.hpp>

#include <mutex>
#include <vector>

namespace cca::testing {

/// A thread-safe LogSink that records entries for assertions and local examples.
///
/// Snapshot returns a copy so tests never retain references across concurrent writes.
class RecordingLogSink final : public core::LogSink {
  public:
    void write(const core::LogEntry& entry) override;

    [[nodiscard]] std::vector<core::LogEntry> snapshot() const;
    void clear();

  private:
    mutable std::mutex mutex_;
    std::vector<core::LogEntry> entries_;
};

} // namespace cca::testing
