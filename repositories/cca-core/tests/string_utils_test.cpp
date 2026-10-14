#include <cca/core/string_utils.hpp>

#include <gtest/gtest.h>

namespace {

TEST(StringUtilsTest, TrimsOnlyAsciiWhitespace) {
    EXPECT_EQ(cca::core::strings::trim_ascii("\t  CCA\n"), "CCA");
    EXPECT_EQ(cca::core::strings::trim_ascii(" \r\n"), "");
}

TEST(StringUtilsTest, LowercaseConversionIsLocaleIndependent) {
    EXPECT_EQ(cca::core::strings::to_lower_ascii("CCA-123"), "cca-123");
}

TEST(StringUtilsTest, IdentifiesBlankStrings) {
    EXPECT_TRUE(cca::core::strings::is_blank_ascii(" \t\n"));
    EXPECT_FALSE(cca::core::strings::is_blank_ascii(" cca "));
}

} // namespace
