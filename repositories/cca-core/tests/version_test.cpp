#include <cca/core/version.hpp>

#include <gtest/gtest.h>

namespace {

TEST(SemanticVersionTest, FormatsPrereleaseAndBuildMetadata) {
    const cca::core::SemanticVersion version{
        .major = 1U,
        .minor = 2U,
        .patch = 3U,
        .prerelease = "alpha.1",
        .build_metadata = "local",
    };

    EXPECT_EQ(version.to_string(), "1.2.3-alpha.1+local");
}

TEST(VersionTest, ExposesTheGeneratedWorkspaceVersion) {
    const auto version = cca::core::current_version();

    EXPECT_FALSE(version.to_string().empty());
}

} // namespace
