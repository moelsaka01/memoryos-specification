#include <cca/testing/recording_log_sink.hpp>

#include <gtest/gtest.h>

namespace {

TEST(RecordingLogSinkTest, SnapshotIsIndependentAndClearRemovesEntries) {
    cca::testing::RecordingLogSink sink;
    sink.write(cca::core::LogEntry{
        .level = cca::core::LogLevel::debug,
        .component = "test",
        .message = "entry",
    });

    const auto snapshot = sink.snapshot();
    sink.clear();

    ASSERT_EQ(snapshot.size(), 1U);
    EXPECT_TRUE(sink.snapshot().empty());
}

} // namespace
