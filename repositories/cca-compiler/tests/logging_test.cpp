#include <gtest/gtest.h>
#include <memory>
#include <sstream>

#include "cca/compiler/logging.hpp"

namespace cca::compiler {
namespace {

TEST(LoggingTest, StreamLoggerProducesDeterministicLine) {
    std::ostringstream output;
    StreamLogger logger{output};

    logger.log({LogLevel::warning, "parser", "placeholder"});

    EXPECT_EQ(output.str(), "[warning] parser: placeholder\n");
}

TEST(LoggingTest, LogLevelNamesAreStable) {
    EXPECT_EQ(to_string(LogLevel::error), "error");
    EXPECT_EQ(to_string(LogLevel::info), "info");
}

TEST(LoggingTest, NullLoggerSupportsPolymorphicInjection) {
    const std::shared_ptr<ILogger> logger = std::make_shared<NullLogger>();
    EXPECT_NO_THROW(logger->log({LogLevel::info, "test", "discarded"}));
}

} // namespace
} // namespace cca::compiler
