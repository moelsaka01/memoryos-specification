#include <cca/testing/recording_log_sink.hpp>

namespace cca::testing {

void RecordingLogSink::write(const core::LogEntry& entry) {
    const std::scoped_lock lock{mutex_};
    entries_.push_back(entry);
}

std::vector<core::LogEntry> RecordingLogSink::snapshot() const {
    const std::scoped_lock lock{mutex_};
    return entries_;
}

void RecordingLogSink::clear() {
    const std::scoped_lock lock{mutex_};
    entries_.clear();
}

} // namespace cca::testing
