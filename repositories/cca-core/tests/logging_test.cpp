#include <cca/core/logging.hpp>
#include <cca/testing/recording_log_sink.hpp>

#include <gtest/gtest.h>
#include <memory>
#include <sstream>
#include <stdexcept>
#include <utility>

namespace {

TEST(LoggerTest, RejectsNullSink) {
    EXPECT_THROW(static_cast<void>(cca::core::Logger{std::shared_ptr<cca::core::LogSink>{}}),
                 std::invalid_argument);
}

TEST(LoggerTest, FiltersEntriesBelowTheMinimumLevel) {
    const auto sink = std::make_shared<cca::testing::RecordingLogSink>();
    const cca::core::Logger logger{sink, cca::core::LogLevel::warning};

    logger.info("compiler", "not recorded");
    logger.error("compiler", "recorded");

    const auto entries = sink->snapshot();
    ASSERT_EQ(entries.size(), 1U);
    EXPECT_EQ(entries.front().level, cca::core::LogLevel::error);
    EXPECT_EQ(entries.front().component, "compiler");
    EXPECT_EQ(entries.front().message, "recorded");
}

TEST(NullLogSinkTest, SupportsPolymorphicInjection) {
    std::shared_ptr<cca::core::LogSink> sink = std::make_shared<cca::core::NullLogSink>();
    const cca::core::Logger logger{std::move(sink)};

    EXPECT_NO_THROW(logger.info("compiler", "deliberately discarded"));
}

TEST(OstreamLogSinkTest, UsesStableFormatting) {
    std::ostringstream stream;
    const auto sink = std::make_shared<cca::core::OstreamLogSink>(stream);
    const cca::core::Logger logger{sink};

    logger.warning("validator", "placeholder");

    EXPECT_EQ(stream.str(), "[warning] validator: placeholder\n");
}

} // namespace
