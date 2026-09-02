#include <memoryos/memoryos.hpp>

#include <gtest/gtest.h>

#include <algorithm>
#include <cctype>
#include <cstdint>
#include <fstream>
#include <future>
#include <iterator>
#include <optional>
#include <stdexcept>
#include <string>
#include <string_view>
#include <type_traits>
#include <utility>
#include <vector>

namespace {

constexpr std::string_view reflection_key{
    "reflection:reflection-release-integrity:0"};
constexpr std::string_view package_trace{"trace-observation-b"};
constexpr std::string_view package_evolution{
    "evolution-observation-a-observation-b"};
constexpr std::string_view package_comparative{
    "comparative-observation-a-observation-b"};

[[nodiscard]] std::string readText(const char* path) {
    std::ifstream input{path, std::ios::binary};
    if (!input) {
        throw std::runtime_error{"cannot open test fixture"};
    }
    return {std::istreambuf_iterator<char>{input},
            std::istreambuf_iterator<char>{}};
}

[[nodiscard]] int base64Value(char value) noexcept {
    if (value >= 'A' && value <= 'Z') return value - 'A';
    if (value >= 'a' && value <= 'z') return value - 'a' + 26;
    if (value >= '0' && value <= '9') return value - '0' + 52;
    if (value == '+') return 62;
    if (value == '/') return 63;
    return -1;
}

[[nodiscard]] std::vector<std::uint8_t> readPackage(
    const char* path = MEMORYOS_SDK_COMPLETE_MIP_B64) {
    std::string encoded = readText(path);
    encoded.erase(std::remove_if(encoded.begin(), encoded.end(),
                                 [](unsigned char value) {
                                     return std::isspace(value) != 0;
                                 }),
                  encoded.end());
    if (encoded.empty() || encoded.size() % 4U != 0U) {
        throw std::runtime_error{"invalid Base64 test fixture"};
    }

    std::vector<std::uint8_t> output;
    output.reserve((encoded.size() / 4U) * 3U);
    for (std::size_t index = 0U; index < encoded.size(); index += 4U) {
        const bool pad2 = encoded[index + 2U] == '=';
        const bool pad3 = encoded[index + 3U] == '=';
        const int first = base64Value(encoded[index]);
        const int second = base64Value(encoded[index + 1U]);
        const int third = pad2 ? 0 : base64Value(encoded[index + 2U]);
        const int fourth = pad3 ? 0 : base64Value(encoded[index + 3U]);
        if (first < 0 || second < 0 || third < 0 || fourth < 0 ||
            (pad2 && !pad3)) {
            throw std::runtime_error{"invalid Base64 test fixture"};
        }
        const auto value =
            (static_cast<std::uint32_t>(first) << 18U) |
            (static_cast<std::uint32_t>(second) << 12U) |
            (static_cast<std::uint32_t>(third) << 6U) |
            static_cast<std::uint32_t>(fourth);
        output.push_back(static_cast<std::uint8_t>((value >> 16U) & 0xFFU));
        if (!pad2) {
            output.push_back(
                static_cast<std::uint8_t>((value >> 8U) & 0xFFU));
        }
        if (!pad3) {
            output.push_back(static_cast<std::uint8_t>(value & 0xFFU));
        }
    }
    return output;
}

[[nodiscard]] memoryos::ObserveOptions observationOptions(
    std::string identifier) {
    memoryos::ObserveOptions options;
    options.identifier = std::move(identifier);
    return options;
}

[[nodiscard]] memoryos::ReplaySession completeReplay(
    memoryos::ReplaySession replay) {
    for (std::size_t index = 0U; index < 10'000U; ++index) {
        if (replay.investigation().lifecycle() == "ReplayComplete") {
            return replay;
        }
        replay = replay.next();
    }
    throw std::runtime_error{"deterministic Replay did not complete"};
}

template <typename Callable>
void expectSdkError(std::string_view code,
                    std::string_view operation,
                    Callable&& callable) {
    try {
        std::forward<Callable>(callable)();
        FAIL() << "operation unexpectedly succeeded";
    } catch (const memoryos::SdkError& error) {
        EXPECT_EQ(error.code(), code);
        EXPECT_EQ(error.operation(), operation);
    }
}

template <typename Callable>
void expectInvalidInput(Callable&& callable) {
    expectSdkError("INVALID_INPUT", "sdk",
                   std::forward<Callable>(callable));
}

TEST(MemoryOsSdk, ExposesVersionedImmutableValueHandles) {
    static_assert(memoryos::sdkVersion == "1.0.0");
    static_assert(std::is_copy_constructible_v<memoryos::Workspace>);
    static_assert(std::is_copy_constructible_v<memoryos::Investigation>);
    static_assert(std::is_copy_constructible_v<memoryos::ReplaySession>);
    static_assert(std::is_copy_constructible_v<memoryos::ComparisonSession>);
    static_assert(std::is_copy_constructible_v<memoryos::VerificationResult>);
    static_assert(std::is_copy_constructible_v<memoryos::RegressionReport>);
    static_assert(std::is_copy_constructible_v<memoryos::Checkpoint>);

    memoryos::MemoryOS memory;
    const auto workspace = memory.openWorkspace("workspace-memoryos-release");
    EXPECT_EQ(workspace.identifier(), "workspace-memoryos-release");
}

TEST(MemoryOsSdk, DelegatesImmutableDeterministicRegressionToCore) {
    memoryos::MemoryOS memory;
    const auto workspace = memory.openWorkspace("workspace-memoryos-release");
    const auto baseline = memory.observe(
        workspace, readText(MEMORYOS_SDK_REFERENCE_SNAPSHOT),
        observationOptions("cpp-regression-baseline"));
    const auto candidate = memory.observe(
        workspace, readText(MEMORYOS_SDK_CHANGED_SNAPSHOT),
        observationOptions("cpp-regression-candidate"));

    const auto first = memory.regression(baseline, candidate);
    const auto second = memory.regression(baseline, candidate);
    EXPECT_TRUE(first.regressionDetected());
    EXPECT_EQ(first.overall(), "regressionDetected");
    EXPECT_EQ(first.identifier(), second.identifier());
    EXPECT_EQ(first.canonicalJson(), second.canonicalJson());
    EXPECT_NE(first.canonicalJson().find("\"category\":\"evidence\""),
              std::string::npos);

    const auto identical = memory.regression(baseline, baseline);
    EXPECT_FALSE(identical.regressionDetected());
    EXPECT_EQ(identical.overall(), "identical");
}

TEST(MemoryOsSdk, DefaultObservationOperationsMatchCrossLanguageDigests) {
    memoryos::MemoryOS memory;
    const auto workspace = memory.openWorkspace("workspace-memoryos-release");
    const auto initial = memory.observe(
        workspace, readText(MEMORYOS_SDK_REFERENCE_SNAPSHOT),
        observationOptions("sdk-default-parity"));
    const auto initial_digest = initial.transitionLogDigest();
    const auto appended =
        initial.observe(readText(MEMORYOS_SDK_CHANGED_SNAPSHOT));

    EXPECT_EQ(
        initial_digest,
        "sha256:73d96188aee03223d8cab1693ea89a5f856a52aca3412250ff0693ad81e1a35e");
    EXPECT_EQ(
        appended.transitionLogDigest(),
        "sha256:d71ea86ef5987acf507f57dfb61ca538e2ced64bad381cc799828a46060e142b");
}

TEST(MemoryOsSdk, DelegatesObservationTraceReplayVerifyAndRestore) {
    memoryos::MemoryOS memory;
    const auto workspace = memory.openWorkspace("workspace-memoryos-release");
    auto investigation = memory.observe(
        workspace, readText(MEMORYOS_SDK_REFERENCE_SNAPSHOT),
        observationOptions("cpp-native-investigation"));

    EXPECT_EQ(investigation.lifecycle(), "Observed");
    EXPECT_EQ(investigation.phase(), "observe");
    expectSdkError("INVALID_TRANSITION", "replay", [&investigation] {
        static_cast<void>(investigation.replay());
    });
    expectInvalidInput(
        [&investigation] { static_cast<void>(investigation.trace("")); });

    const auto checkpoint = investigation.checkpoint();
    EXPECT_EQ(checkpoint.investigationIdentifier(), investigation.identifier());
    const auto restored = memory.restore(checkpoint);
    EXPECT_EQ(restored.transitionLogDigest(), investigation.transitionLogDigest());

    investigation = investigation.trace(std::string{reflection_key});
    EXPECT_EQ(investigation.lifecycle(), "ReplayReady");
    auto replay = investigation.replay().play().pause().next().previous();
    replay = replay.restart();
    EXPECT_EQ(replay.investigation().lifecycle(), "ReplayReady");
    replay = completeReplay(std::move(replay));
    EXPECT_EQ(replay.investigation().lifecycle(), "ReplayComplete");

    const auto verification = replay.investigation().verify();
    EXPECT_TRUE(verification.valid());
    EXPECT_TRUE(verification.diagnostics().empty());
    EXPECT_FALSE(verification.canonicalJson().empty());
    const auto archived = replay.investigation().archive();
    EXPECT_EQ(archived.lifecycle(), "Archived");
}

TEST(MemoryOsSdk, RejectsReplayHandleAfterActiveReplayIsReplaced) {
    memoryos::MemoryOS memory;
    const auto workspace = memory.openWorkspace("workspace-memoryos-release");
    auto investigation = memory.observe(
        workspace, readText(MEMORYOS_SDK_REFERENCE_SNAPSHOT),
        observationOptions("cpp-stale-replay"));
    investigation = investigation.trace(std::string{reflection_key});
    const auto stale = investigation.replay();

    investigation = investigation.returnToWorld();
    investigation =
        investigation.observe(readText(MEMORYOS_SDK_CHANGED_SNAPSHOT));
    investigation = investigation.trace(std::string{reflection_key});
    const auto current = investigation.replay().next();
    const auto digest = current.investigation().transitionLogDigest();

    expectSdkError("SESSION_MISMATCH", "replay", [&stale] {
        static_cast<void>(stale.next());
    });
    const auto refreshed = current.investigation().replay();
    EXPECT_EQ(refreshed.investigation().transitionLogDigest(), digest);
}

TEST(MemoryOsSdk, ReachesNativeComparisonThroughTwoExplicitObservations) {
    memoryos::MemoryOS memory;
    const auto workspace = memory.openWorkspace("workspace-memoryos-release");
    auto investigation = memory.observe(
        workspace, readText(MEMORYOS_SDK_REFERENCE_SNAPSHOT),
        observationOptions("cpp-native-comparison"));
    investigation =
        investigation.observe(readText(MEMORYOS_SDK_CHANGED_SNAPSHOT));
    investigation = investigation.trace(std::string{reflection_key});
    auto replay = completeReplay(investigation.replay());

    expectInvalidInput([&replay] {
        static_cast<void>(replay.investigation().comparisonSession(
            std::optional<std::string>{"not-a-native-evolution"}));
    });
    auto configured =
        replay.investigation().comparisonSession(std::nullopt);
    expectInvalidInput(
        [&configured] { static_cast<void>(configured.nextObservation()); });

    auto comparison = replay.investigation().compare(configured);
    EXPECT_EQ(comparison.investigation().lifecycle(), "ComparisonReady");
    expectInvalidInput([&replay, &comparison] {
        static_cast<void>(replay.investigation().compare(comparison));
    });
    comparison = comparison.previousObservation().nextObservation();
    expectInvalidInput([&comparison] {
        static_cast<void>(comparison.startPackage(
            std::string{package_comparative}));
    });
    comparison = comparison.start(std::string{reflection_key});
    EXPECT_EQ(comparison.investigation().lifecycle(), "Comparing");
    comparison = comparison.play().pause().next().previous().reset().advance();
    EXPECT_EQ(comparison.investigation().lifecycle(), "Comparing");
    comparison = comparison.back().back();
    const auto returned = comparison.investigation().returnToWorld();
    EXPECT_EQ(returned.lifecycle(), "Observed");
}

TEST(MemoryOsSdk, PreservesExactMipAndEveryComparisonStage) {
    const auto source = readPackage();
    memoryos::MemoryOS memory;
    auto investigation = memory.importPackage(
        memoryos::MemoryInvestigationPackage{source},
        memoryos::ImportOptions{
            .identifier = "cpp-complete-mip",
            .supportedExtensions = {},
        });

    const auto exported = memory.exportPackage(investigation);
    EXPECT_EQ(std::vector<std::uint8_t>(exported.bytes().begin(),
                                       exported.bytes().end()),
              source);
    EXPECT_TRUE(memory.verifyPackage(exported).valid());

    investigation = investigation.trace(std::string{package_trace});
    auto replay = completeReplay(investigation.replay());
    expectInvalidInput([&replay] {
        static_cast<void>(
            replay.investigation().comparisonSession(std::nullopt));
    });
    auto configured = replay.investigation().comparisonSession(
        std::optional<std::string>{package_evolution});
    EXPECT_EQ(configured.investigation().lifecycle(), "ReplayComplete");
    auto comparison = replay.investigation().compare(configured);
    EXPECT_EQ(comparison.investigation().lifecycle(), "ComparisonReady");
    expectInvalidInput([&comparison] {
        static_cast<void>(comparison.start(std::string{reflection_key}));
    });

    comparison = comparison.previousObservation().nextObservation();
    comparison = comparison.startPackage(std::string{package_comparative});
    EXPECT_EQ(comparison.investigation().lifecycle(), "Comparing");
    comparison = comparison.play().pause().next().previous().reset().advance();
    EXPECT_EQ(comparison.investigation().lifecycle(), "Comparing");
    comparison = comparison.back();
    EXPECT_EQ(comparison.investigation().lifecycle(), "ComparisonReady");
}

TEST(MemoryOsSdk, PreservesStoredExtensionPolicyWhenExportOverrideIsOmitted) {
    const auto source = readPackage(MEMORYOS_SDK_EXTENSION_MIP_B64);
    memoryos::MemoryOS memory;
    const auto investigation = memory.importPackage(
        memoryos::MemoryInvestigationPackage{source},
        memoryos::ImportOptions{
            .identifier = "cpp-extension-roundtrip",
            .supportedExtensions = {"org.example.audit"},
        });
    const auto exported = memory.exportPackage(investigation);
    EXPECT_EQ(std::vector<std::uint8_t>(exported.bytes().begin(),
                                       exported.bytes().end()),
              source);
}

TEST(MemoryOsSdk, ReportsPackageFailuresWithoutPublishingAValue) {
    memoryos::MemoryOS memory;
    auto corrupted = readPackage();
    ASSERT_GT(corrupted.size(), 2U);
    corrupted[corrupted.size() - 2U] ^= 1U;

    const memoryos::MemoryInvestigationPackage package{corrupted};
    const auto first = memory.verifyPackage(package);
    const auto second = memory.verifyPackage(package);
    EXPECT_FALSE(first.valid());
    EXPECT_FALSE(first.diagnostics().empty());
    EXPECT_EQ(first.canonicalJson(), second.canonicalJson());
}

TEST(MemoryOsSdk, EmptyPackageFailsAsMipValidationNotTransportInput) {
    memoryos::MemoryOS memory;
    const memoryos::MemoryInvestigationPackage empty{
        std::vector<std::uint8_t>{}};
    const auto result = memory.verifyPackage(empty);
    EXPECT_FALSE(result.valid());
    EXPECT_FALSE(result.diagnostics().empty());
}

TEST(MemoryOsSdk, RejectsCrossInstanceAndNativeExport) {
    memoryos::MemoryOS first;
    memoryos::MemoryOS second;
    const auto workspace = first.openWorkspace("workspace-memoryos-release");
    expectInvalidInput([&second, &workspace] {
        static_cast<void>(second.observe(
            workspace, readText(MEMORYOS_SDK_REFERENCE_SNAPSHOT)));
    });

    const auto native = first.observe(
        workspace, readText(MEMORYOS_SDK_REFERENCE_SNAPSHOT),
        observationOptions("cpp-native-no-export"));
    try {
        static_cast<void>(first.exportPackage(native));
        FAIL() << "native observation unexpectedly exported a MIP";
    } catch (const memoryos::SdkError& error) {
        EXPECT_EQ(error.code(), "CAPABILITY_UNAVAILABLE");
    }

    const auto package = memoryos::MemoryInvestigationPackage{readPackage()};
    const auto foreign = second.importPackage(
        package,
        memoryos::ImportOptions{
            .identifier = "cpp-foreign",
            .supportedExtensions = {},
        });
    expectInvalidInput([&first, &native, &foreign] {
        static_cast<void>(first.regression(native, foreign));
    });
    expectInvalidInput([&second, &native, &foreign] {
        static_cast<void>(second.regression(native, foreign));
    });
    const auto configured = foreign.comparisonSession(
        std::optional<std::string>{package_evolution});
    expectInvalidInput(
        [&native, &configured] { static_cast<void>(native.compare(configured)); });

    const auto checkpoint = native.checkpoint();
    expectInvalidInput([&foreign, &checkpoint] {
        static_cast<void>(foreign.restore(checkpoint));
    });
    expectInvalidInput([&second, &checkpoint] {
        static_cast<void>(second.restore(checkpoint));
    });
}

TEST(MemoryOsSdk, KeepsConcurrentInstancesDeterministicAndIsolated) {
    const auto source = readPackage();
    auto execute = [&source] {
        memoryos::MemoryOS memory;
        auto investigation = memory.importPackage(
            memoryos::MemoryInvestigationPackage{source},
            memoryos::ImportOptions{
                .identifier = "cpp-concurrent-isolation",
                .supportedExtensions = {},
            });
        investigation = investigation.trace(std::string{package_trace});
        const auto replay = completeReplay(investigation.replay());
        const auto package = memory.exportPackage(replay.investigation());
        return std::pair{
            replay.investigation().transitionLogDigest(),
            std::vector<std::uint8_t>{package.bytes().begin(),
                                      package.bytes().end()}};
    };

    auto first = std::async(std::launch::async, execute);
    auto second = std::async(std::launch::async, execute);
    const auto firstResult = first.get();
    const auto secondResult = second.get();
    EXPECT_EQ(firstResult.first, secondResult.first);
    EXPECT_EQ(firstResult.second, source);
    EXPECT_EQ(secondResult.second, source);
}

} // namespace
