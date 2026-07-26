#include <atomic>
#include <filesystem>
#include <fstream>
#include <gtest/gtest.h>
#include <string>

#include "cca/compiler/source_loader.hpp"

namespace cca::compiler {
namespace {

class SourceLoaderTest : public ::testing::Test {
  protected:
    void SetUp() override {
        static std::atomic<unsigned int> sequence{0};
        directory_ = std::filesystem::temp_directory_path() /
                     ("cca-source-loader-" + std::to_string(sequence.fetch_add(1)));
        std::filesystem::create_directories(directory_);
    }

    void TearDown() override {
        std::error_code ignored;
        std::filesystem::remove_all(directory_, ignored);
    }

    void write(const std::filesystem::path& path, const std::string& bytes) {
        std::ofstream stream{path, std::ios::binary};
        stream.write(bytes.data(), static_cast<std::streamsize>(bytes.size()));
    }

    std::filesystem::path directory_;
    FileSourceLoader loader_;
};

TEST_F(SourceLoaderTest, RejectsEmptyAndMissingPaths) {
    const auto empty = loader_.load({});
    ASSERT_TRUE(empty.validation.has_errors());
    EXPECT_EQ(empty.validation.diagnostics().front().code, "CCA-LOAD-001");

    const auto missing = loader_.load(directory_ / "missing.yaml");
    ASSERT_TRUE(missing.validation.has_errors());
    EXPECT_EQ(missing.validation.diagnostics().front().code, "CCA-LOAD-002");
}

TEST_F(SourceLoaderTest, RejectsDirectories) {
    const auto result = loader_.load(directory_);

    ASSERT_TRUE(result.validation.has_errors());
    EXPECT_EQ(result.validation.diagnostics().front().code, "CCA-LOAD-003");
}

TEST_F(SourceLoaderTest, LoadsUtf8AndRemovesBom) {
    const auto path = directory_ / "spec.yaml";
    write(path, std::string{"\xEF\xBB\xBF"} + "name: caf\xC3\xA9\n");

    const auto result = loader_.load(path);

    ASSERT_TRUE(result.ok());
    ASSERT_TRUE(result.document.has_value());
    EXPECT_EQ(result.document->path, path);
    EXPECT_EQ(result.document->content, "name: caf\xC3\xA9\n");
}

TEST_F(SourceLoaderTest, RejectsMalformedUtf8) {
    const auto path = directory_ / "invalid.yaml";
    write(path, std::string{"value: \xC0\xAF\n", 10});

    const auto result = loader_.load(path);

    ASSERT_TRUE(result.validation.has_errors());
    EXPECT_EQ(result.validation.diagnostics().front().code, "CCA-LOAD-006");
    EXPECT_FALSE(result.document.has_value());
}

} // namespace
} // namespace cca::compiler
