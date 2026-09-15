#include <memoryos/memoryos.hpp>

#include "../src/json.hpp"

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

[[nodiscard]] std::vector<std::uint8_t> bytesFrom(
    std::string_view value) {
    return {value.begin(), value.end()};
}

[[nodiscard]] std::vector<std::uint8_t> bytesFrom(
    std::span<const std::uint8_t> value) {
    return {value.begin(), value.end()};
}

[[nodiscard]] std::string policyDocument(
    std::string_view identifier,
    std::string_view ruleType,
    std::string_view parametersJson,
    std::string_view description = {}) {
    std::string metadata;
    if (!description.empty()) {
        metadata = "\"metadata\":{\"description\":\"" +
                   std::string{description} + "\"},";
    }
    return "{\"identifier\":\"" + std::string{identifier} +
           "\",\"kind\":\"MemoryOSInvestigationPolicy\"," + metadata +
           "\"policyVersion\":\"0.0.0\",\"rules\":[{\"identifier\":\"r\"," +
           "\"parameters\":" + std::string{parametersJson} +
           ",\"type\":\"" + std::string{ruleType} +
           "\",\"version\":\"1.0.0\"}],\"version\":\"1.0.0\"}";
}

[[nodiscard]] std::string policySetDocument(
    std::string_view identifier,
    std::string_view childPolicy,
    std::string_view childSemanticDigest) {
    return "{\"identifier\":\"" + std::string{identifier} +
           "\",\"kind\":\"MemoryOSInvestigationPolicySet\",\"policies\":[{" +
           "\"expectedSemanticDigest\":\"" +
           std::string{childSemanticDigest} + "\",\"policy\":" +
           std::string{childPolicy} +
           "}],\"policySetVersion\":\"0.0.0\",\"version\":\"1.0.0\"}";
}

[[nodiscard]] const std::string& fixtureText(
    const memoryos::detail::Json& value,
    std::string_view name) {
    const auto* member = value.find(name);
    if (member == nullptr || !member->isString()) {
        throw std::runtime_error{"invalid Policy golden-vector fixture member"};
    }
    return member->asString();
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

template <typename Callable>
void expectPolicyPreparationFailure(
    std::string_view code,
    std::string_view operation,
    std::string_view phase,
    std::string_view artifactKind,
    Callable&& callable) {
    try {
        std::forward<Callable>(callable)();
        FAIL() << "untrusted Policy capability unexpectedly accepted";
    } catch (const memoryos::SdkError& error) {
        EXPECT_EQ(error.code(), code);
        EXPECT_EQ(error.operation(), operation);
        EXPECT_EQ(error.phase(), phase);
        EXPECT_EQ(error.artifactKind(), artifactKind);
        EXPECT_EQ(error.failureClass(), "preparation");
        ASSERT_TRUE(error.preparationFailure().has_value());
        EXPECT_EQ(error.preparationFailure()->code(), code);
        EXPECT_EQ(error.preparationFailure()->phase(), phase);
        ASSERT_TRUE(error.preparationFailure()->artifactKind().has_value());
        EXPECT_EQ(*error.preparationFailure()->artifactKind(), artifactKind);
        EXPECT_EQ(error.preparationFailure()->failureClass(), "preparation");
    }
}

TEST(MemoryOsSdk, ExposesVersionedImmutableValueHandles) {
    static_assert(memoryos::sdkVersion == "1.1.0");
    static_assert(std::is_copy_constructible_v<memoryos::Workspace>);
    static_assert(std::is_copy_constructible_v<memoryos::Investigation>);
    static_assert(std::is_copy_constructible_v<memoryos::ReplaySession>);
    static_assert(std::is_copy_constructible_v<memoryos::ComparisonSession>);
    static_assert(std::is_copy_constructible_v<memoryos::VerificationResult>);
    static_assert(std::is_copy_constructible_v<memoryos::RegressionReport>);
    static_assert(std::is_copy_constructible_v<memoryos::InvestigationResult>);
    static_assert(std::is_copy_constructible_v<memoryos::InvestigationQuery>);
    static_assert(std::is_copy_constructible_v<memoryos::Checkpoint>);
    static_assert(std::is_copy_constructible_v<memoryos::PreparedPolicy>);
    static_assert(std::is_copy_constructible_v<
                  memoryos::PolicyFactContextInspection>);
    static_assert(std::is_copy_constructible_v<
                  memoryos::AuthoritativePolicyFactContext>);
    static_assert(std::is_copy_constructible_v<
                  memoryos::RegressionPolicyFactSourceInspection>);
    static_assert(std::is_copy_constructible_v<
                  memoryos::AuthoritativeRegressionPolicyFactSource>);
    static_assert(std::is_copy_constructible_v<
                  memoryos::RegressionReportInspection>);
    static_assert(std::is_copy_constructible_v<
                  memoryos::AuthoritativeRegressionPolicyFacts>);
    static_assert(std::is_copy_constructible_v<memoryos::PolicyEvaluation>);
    static_assert(std::is_copy_constructible_v<
                  memoryos::PolicyArtifactVerification>);
    static_assert(std::is_copy_constructible_v<
                  memoryos::PolicyPreparationFailure>);

    memoryos::MemoryOS memory;
    const auto workspace = memory.openWorkspace("workspace-memoryos-release");
    EXPECT_EQ(workspace.identifier(), "workspace-memoryos-release");
}

TEST(MemoryOsSdk, DelegatesPolicySemanticsAndRetainsExactBytes) {
    memoryos::MemoryOS preparationMemory;
    memoryos::MemoryOS memory;
    const auto workspace = memory.openWorkspace("workspace-memoryos-policy");
    const auto investigation = memory.observe(
        workspace, readText(MEMORYOS_SDK_REFERENCE_SNAPSHOT),
        observationOptions("cpp-policy-candidate"));
    const std::string document = policyDocument(
        "p", "memoryos.require-lifecycle-state",
        R"({"allowedStates":["Observed"]})");
    const auto bytes = bytesFrom(document);

    const auto prepared = preparationMemory.preparePolicy(bytes);
    const auto context = memory.capturePolicyFactContext(investigation);
    const auto evaluation = memory.evaluatePolicy(prepared, context);

    expectPolicyPreparationFailure(
        "POLICY_FACT_CONTEXT_PROVENANCE_UNTRUSTED",
        "evaluatePolicy",
        "policyFactContext",
        "MemoryOSPolicyFactContext",
        [&] {
            static_cast<void>(preparationMemory.evaluatePolicy(prepared, context));
        });

    EXPECT_EQ(prepared.kind(), "MemoryOSInvestigationPolicy");
    EXPECT_EQ(bytesFrom(prepared.bytes()), bytes);
    EXPECT_EQ(evaluation.outcomeKind(), "MemoryOSPolicyEvaluationOutcome");
    EXPECT_EQ(evaluation.decision(), "PASS");
    EXPECT_FALSE(evaluation.canonicalOutcomeBytes().empty());
    EXPECT_FALSE(evaluation.evaluationIdentityBytes().empty());
    EXPECT_EQ(evaluation.outcomeDigest().substr(0U, 7U), "sha256:");
    EXPECT_EQ(bytesFrom(evaluation.evaluationIdentityBytes()),
              bytesFrom(evaluation.evaluationIdentityJson()));
    EXPECT_EQ(bytesFrom(evaluation.canonicalOutcomeBytes()),
              bytesFrom(evaluation.outcomeJson()));

    std::optional<memoryos::PolicyEvaluation> retainedEvaluation;
    std::span<const std::uint8_t> retainedOutcomeBytes;
    {
        const auto transient = memory.evaluatePolicy(prepared, context);
        retainedEvaluation = transient;
        retainedOutcomeBytes = transient.canonicalOutcomeBytes();
    }
    ASSERT_TRUE(retainedEvaluation.has_value());
    EXPECT_EQ(bytesFrom(retainedOutcomeBytes),
              bytesFrom(retainedEvaluation->canonicalOutcomeBytes()));
    EXPECT_EQ(bytesFrom(retainedOutcomeBytes),
              bytesFrom(evaluation.canonicalOutcomeBytes()));

    const auto detached = memory.inspectPolicyFactContext(
        context.bytes(), {context.contextDigest()});
    EXPECT_EQ(detached.contextDigest(), context.contextDigest());
    EXPECT_EQ(detached.bytes().size(), context.bytes().size());

    const auto identity = memory.verifyEvaluationIdentityArtifact(
        evaluation.evaluationIdentityBytes(),
        evaluation.evaluationIdentityDigest());
    EXPECT_TRUE(identity.verified());
    EXPECT_EQ(identity.authority(), "inspectionOnly");

    memoryos::PolicyOutcomeArtifactVerificationOptions options;
    options.expectedEvaluationIdentityDigest =
        evaluation.evaluationIdentityDigest();
    options.expectedOutcomeDigest = evaluation.outcomeDigest();
    const auto outcome = memory.verifyPolicyEvaluationOutcomeArtifact(
        evaluation.canonicalOutcomeBytes(), std::move(options));
    EXPECT_TRUE(outcome.verified());
    ASSERT_TRUE(outcome.decision().has_value());
    EXPECT_EQ(*outcome.decision(), "PASS");

    memoryos::PolicyOutcomeArtifactVerificationOptions mismatchOptions;
    mismatchOptions.expectedOutcomeDigest = "sha256:" + std::string(64U, '0');
    try {
        static_cast<void>(memory.verifyPolicyEvaluationOutcomeArtifact(
            evaluation.canonicalOutcomeBytes(), std::move(mismatchOptions)));
        FAIL() << "mismatched outcome unexpectedly verified";
    } catch (const memoryos::SdkError& error) {
        EXPECT_EQ(error.code(), "VERIFICATION_FAILED");
        EXPECT_EQ(error.failureClass(), "operational");
        EXPECT_TRUE(error.verificationFailure());
    }

    EXPECT_EQ(memory.policyContractIdentities(),
        R"({"deterministicFactSourceRegistry":{"registryDigest":"sha256:392d688acb866753c6ff85b7030131b38990b27d8a2a0ef6e8e052c8c4e048de","registryVersion":"1.0.0","sources":[{"domain":"cognitiveRegression","sourceModelDigest":"sha256:e7d1fdf24758f2a0ac9ad609df578f95c058bf3cbab9f02a650f9cc12dab1c0d","sourceModelVersion":"1.0.0","wireVersion":"1.0.0"}]},"evaluatorVersion":"1.0.0","factModel":{"factModelDigest":"sha256:b36b9488161cb67d8e971e802d15ad76d662d46f96e1304182de343ba69ef7a8","factModelVersion":"1.0.0"},"kind":"MemoryOSPolicyContractIdentities","outcomeContractVersion":"1.0.0","resourceProfile":{"identifier":"memoryos.policy.resource-profile.standard","resourceProfileDigest":"sha256:c091573dfd05481f5759ef077e15af16689382a7432fa546c6630c4caeaa5239","version":"1.0.0"},"ruleRegistry":{"ruleRegistryDigest":"sha256:aaa19116563d209f680b063cdccf49d899069683f9778271c4ca2c4559b94fd7","ruleRegistryVersion":"1.0.0"},"version":"1.0.0"})");
}

TEST(MemoryOsSdk, EvaluatesPolicySetAndCneAsNormalOutcomes) {
    memoryos::MemoryOS memory;
    const auto workspace = memory.openWorkspace("workspace-memoryos-release");
    const auto investigation = memory.observe(
        workspace, readText(MEMORYOS_SDK_REFERENCE_SNAPSHOT),
        observationOptions("cpp-policy-set-candidate"));
    const auto context = memory.capturePolicyFactContext(investigation);

    const auto cneDocument = policyDocument(
        "c", "memoryos.prohibit-regression-findings",
        R"({"categories":["reflection"]})");
    const auto cne = memory.evaluatePolicy(
        memory.preparePolicy(bytesFrom(cneDocument)), context);
    EXPECT_EQ(cne.outcomeKind(), "MemoryOSPolicyEvaluationOutcome");
    EXPECT_EQ(cne.decision(), "COULD_NOT_EVALUATE");
    EXPECT_NE(cne.outcomeJson().find(
                  "PROHIBIT_REGRESSION_FINDINGS_SOURCE_NOT_SUPPLIED"),
              std::string::npos);

    const auto childDocument = policyDocument(
        "m", "memoryos.require-mip-integrity", "{}");
    const auto child = memory.preparePolicy(bytesFrom(childDocument));
    const auto setDocument = policySetDocument(
        "s", childDocument, child.semanticDigest());
    const auto preparedSet = memory.preparePolicySet(bytesFrom(setDocument));
    const auto evaluation = memory.evaluatePolicySet(preparedSet, context);

    EXPECT_EQ(preparedSet.kind(), "MemoryOSInvestigationPolicySet");
    EXPECT_EQ(bytesFrom(preparedSet.bytes()), bytesFrom(setDocument));
    EXPECT_EQ(evaluation.outcomeKind(), "MemoryOSPolicyEvaluationOutcome");
    EXPECT_EQ(evaluation.decision(), "FAIL");
    EXPECT_NE(evaluation.outcomeJson().find("MemoryOSPolicySetResult"),
              std::string::npos);

    const auto identity = memory.verifyEvaluationIdentityForEvaluation(
        evaluation.evaluationIdentityBytes(), preparedSet, context);
    EXPECT_TRUE(identity.verified());
    EXPECT_EQ(identity.authority(), "authoritativeReconstruction");

    memoryos::PolicyOutcomeEvaluationVerificationOptions options;
    options.expectedOutcomeDigest = evaluation.outcomeDigest();
    const auto outcome = memory.verifyPolicyEvaluationOutcomeForEvaluation(
        evaluation.canonicalOutcomeBytes(), preparedSet, context,
        std::move(options));
    EXPECT_TRUE(outcome.verified());
    EXPECT_EQ(outcome.authority(), "authoritativeReconstruction");
    EXPECT_EQ(bytesFrom(outcome.bytes()),
              bytesFrom(evaluation.canonicalOutcomeBytes()));
}

TEST(MemoryOsSdk, PreservesMetadataIsolationAndExactCachedBytes) {
    memoryos::MemoryOS memory;
    const auto workspace = memory.openWorkspace("workspace-memoryos-release");
    const auto investigation = memory.observe(
        workspace, readText(MEMORYOS_SDK_REFERENCE_SNAPSHOT),
        observationOptions("cpp-policy-cache-candidate"));
    const auto context = memory.capturePolicyFactContext(investigation);
    const auto firstDocument = policyDocument(
        "c", "memoryos.require-lifecycle-state",
        R"({"allowedStates":["Observed"]})", "a");
    const auto secondDocument = policyDocument(
        "c", "memoryos.require-lifecycle-state",
        R"({"allowedStates":["Observed"]})", "b");
    const auto firstPolicy = memory.preparePolicy(bytesFrom(firstDocument));
    const auto secondPolicy = memory.preparePolicy(bytesFrom(secondDocument));

    EXPECT_NE(firstPolicy.documentDigest(), secondPolicy.documentDigest());
    EXPECT_EQ(firstPolicy.semanticDigest(), secondPolicy.semanticDigest());
    const auto first = memory.evaluatePolicy(firstPolicy, context);
    const auto second = memory.evaluatePolicy(secondPolicy, context);
    EXPECT_EQ(second.cacheDisposition(),
              "HIT_RETURN_EXACT_RETAINED_BYTES");
    EXPECT_EQ(first.evaluationIdentityDigest(),
              second.evaluationIdentityDigest());
    EXPECT_EQ(first.outcomeDigest(), second.outcomeDigest());
    EXPECT_EQ(bytesFrom(first.evaluationIdentityBytes()),
              bytesFrom(second.evaluationIdentityBytes()));
    EXPECT_EQ(bytesFrom(first.canonicalOutcomeBytes()),
              bytesFrom(second.canonicalOutcomeBytes()));
}

TEST(MemoryOsSdk, EvaluatesAnAuthoritativeMipBackedContext) {
    memoryos::MemoryOS memory;
    const auto investigation = memory.importPackage(
        memoryos::MemoryInvestigationPackage{readPackage()},
        memoryos::ImportOptions{
            .identifier = "cpp-policy-mip-candidate",
            .supportedExtensions = {},
        });
    const auto context = memory.capturePolicyFactContext(investigation);
    const auto document = policyDocument(
        "m", "memoryos.require-mip-integrity", "{}");
    const auto evaluation = memory.evaluatePolicy(
        memory.preparePolicy(bytesFrom(document)), context);

    EXPECT_EQ(context.authority(), "authoritative");
    EXPECT_NE(context.artifactJson().find("\"sourceKind\":\"mip\""),
              std::string::npos);
    EXPECT_EQ(evaluation.decision(), "PASS");
}

TEST(MemoryOsSdk, CapturesAndVerifiesTrustedRegressionPolicyFacts) {
    memoryos::MemoryOS memory;
    const auto workspace = memory.openWorkspace("workspace-memoryos-release");
    const auto baseline = memory.observe(
        workspace, readText(MEMORYOS_SDK_REFERENCE_SNAPSHOT),
        observationOptions("cpp-policy-regression-baseline"));
    const auto candidate = memory.observe(
        workspace, readText(MEMORYOS_SDK_CHANGED_SNAPSHOT),
        observationOptions("cpp-policy-regression-candidate"));

    const auto detachedReport = memory.regression(baseline, candidate);
    const auto reportBytes = bytesFrom(detachedReport.canonicalJson());
    const auto reportInspection = memory.inspectRegressionReport(reportBytes);
    EXPECT_EQ(reportInspection.authority(), "inspectionOnly");
    EXPECT_EQ(reportInspection.reportIdentifier(), detachedReport.identifier());
    EXPECT_EQ(bytesFrom(reportInspection.bytes()), reportBytes);

    const auto facts = memory.captureRegressionPolicyFacts(baseline, candidate);
    const auto& context = facts.policyFactContext();
    const auto& source = facts.regressionPolicyFactSource();
    EXPECT_EQ(context.authority(), "authoritative");
    EXPECT_EQ(source.authority(), "authoritative");
    EXPECT_EQ(source.domain(), "cognitiveRegression");
    EXPECT_EQ(source.sourceModelVersion(), "1.0.0");
    const auto sourceInspection = memory.inspectRegressionPolicyFactSource(
        source.bytes(), {source.sourceDigest()});
    EXPECT_EQ(sourceInspection.authority(), "inspectionOnly");
    EXPECT_EQ(sourceInspection.sourceDigest(), source.sourceDigest());
    EXPECT_EQ(bytesFrom(sourceInspection.bytes()), bytesFrom(source.bytes()));

    const auto document = policyDocument(
        "r", "memoryos.prohibit-regression-findings",
        R"({"categories":["reflection"]})");
    const auto prepared = memory.preparePolicy(bytesFrom(document));
    memoryos::PolicyEvaluationOptions evaluationOptions;
    evaluationOptions.regressionSource = source;
    const auto evaluation = memory.evaluatePolicy(
        prepared, context, evaluationOptions);
    EXPECT_EQ(evaluation.decision(), "FAIL");
    EXPECT_NE(evaluation.evaluationIdentityJson().find(source.sourceDigest()),
              std::string::npos);

    const auto identity = memory.verifyEvaluationIdentityForEvaluation(
        evaluation.evaluationIdentityBytes(), prepared, context,
        evaluationOptions);
    EXPECT_TRUE(identity.verified());
    EXPECT_EQ(identity.authority(), "authoritativeReconstruction");
    EXPECT_EQ(bytesFrom(identity.bytes()),
              bytesFrom(evaluation.evaluationIdentityBytes()));

    memoryos::PolicyOutcomeEvaluationVerificationOptions outcomeOptions;
    outcomeOptions.regressionSource = source;
    outcomeOptions.expectedOutcomeDigest = evaluation.outcomeDigest();
    const auto outcome = memory.verifyPolicyEvaluationOutcomeForEvaluation(
        evaluation.canonicalOutcomeBytes(), prepared, context,
        outcomeOptions);
    EXPECT_TRUE(outcome.verified());
    ASSERT_TRUE(outcome.outcomeDigest().has_value());
    EXPECT_EQ(*outcome.outcomeDigest(), evaluation.outcomeDigest());

    const auto otherContext = memory.capturePolicyFactContext(candidate);
    EXPECT_EQ(otherContext.contextDigest(), context.contextDigest());
    const auto expectCandidateBindingMismatch = [](auto&& operation) {
        try {
            std::forward<decltype(operation)>(operation)();
            FAIL() << "candidate-mismatched Regression source unexpectedly accepted";
        } catch (const memoryos::SdkError& error) {
            EXPECT_EQ(error.code(),
                      "REGRESSION_POLICY_FACT_SOURCE_CANDIDATE_BINDING_MISMATCH");
            EXPECT_EQ(error.phase(), "regressionPolicyFactSource");
            EXPECT_EQ(error.failureClass(), "preparation");
            EXPECT_EQ(error.artifactKind(),
                      "MemoryOSRegressionPolicyFactSource");
        }
    };
    expectCandidateBindingMismatch([&] {
        static_cast<void>(memory.evaluatePolicy(
            prepared, otherContext, evaluationOptions));
    });
    const auto preparedSet = memory.preparePolicySet(bytesFrom(
        policySetDocument("rs", document, prepared.semanticDigest())));
    expectCandidateBindingMismatch([&] {
        static_cast<void>(memory.evaluatePolicySet(
            preparedSet, otherContext, evaluationOptions));
    });
    expectCandidateBindingMismatch([&] {
        static_cast<void>(memory.verifyEvaluationIdentityForEvaluation(
            evaluation.evaluationIdentityBytes(), prepared, otherContext,
            evaluationOptions));
    });
    memoryos::PolicyOutcomeEvaluationVerificationOptions mismatchOptions;
    mismatchOptions.regressionSource = source;
    mismatchOptions.expectedOutcomeDigest = evaluation.outcomeDigest();
    expectCandidateBindingMismatch([&] {
        static_cast<void>(memory.verifyPolicyEvaluationOutcomeForEvaluation(
            evaluation.canonicalOutcomeBytes(), prepared, otherContext,
            mismatchOptions));
    });

    memoryos::MemoryOS foreignMemory;
    const auto foreignWorkspace = foreignMemory.openWorkspace(
        "workspace-memoryos-policy-foreign");
    const auto foreignInvestigation = foreignMemory.observe(
        foreignWorkspace, readText(MEMORYOS_SDK_CHANGED_SNAPSHOT),
        observationOptions("cpp-policy-regression-foreign"));
    const auto foreignContext = foreignMemory.capturePolicyFactContext(
        foreignInvestigation);

    const auto expectForeignContext = [&](std::string_view operation,
                                          auto&& action) {
        expectPolicyPreparationFailure(
            "POLICY_FACT_CONTEXT_PROVENANCE_UNTRUSTED",
            operation,
            "policyFactContext",
            "MemoryOSPolicyFactContext",
            std::forward<decltype(action)>(action));
    };
    expectForeignContext("evaluatePolicy", [&] {
        static_cast<void>(memory.evaluatePolicy(
            prepared, foreignContext, evaluationOptions));
    });
    expectForeignContext("evaluatePolicySet", [&] {
        static_cast<void>(memory.evaluatePolicySet(
            preparedSet, foreignContext, evaluationOptions));
    });
    expectForeignContext("verifyEvaluationIdentityForEvaluation", [&] {
        static_cast<void>(memory.verifyEvaluationIdentityForEvaluation(
            evaluation.evaluationIdentityBytes(), prepared, foreignContext,
            evaluationOptions));
    });
    memoryos::PolicyOutcomeEvaluationVerificationOptions foreignContextOptions;
    foreignContextOptions.regressionSource = source;
    foreignContextOptions.expectedOutcomeDigest = evaluation.outcomeDigest();
    expectForeignContext("verifyPolicyEvaluationOutcomeForEvaluation", [&] {
        static_cast<void>(memory.verifyPolicyEvaluationOutcomeForEvaluation(
            evaluation.canonicalOutcomeBytes(), prepared, foreignContext,
            foreignContextOptions));
    });

    const auto expectForeignSource = [&](std::string_view operation,
                                         auto&& action) {
        expectPolicyPreparationFailure(
            "DETERMINISTIC_FACT_SOURCE_PROVENANCE_UNTRUSTED",
            operation,
            "regressionPolicyFactSource",
            "MemoryOSRegressionPolicyFactSource",
            std::forward<decltype(action)>(action));
    };
    expectForeignSource("evaluatePolicy", [&] {
        static_cast<void>(foreignMemory.evaluatePolicy(
            prepared, foreignContext, evaluationOptions));
    });
    expectForeignSource("evaluatePolicySet", [&] {
        static_cast<void>(foreignMemory.evaluatePolicySet(
            preparedSet, foreignContext, evaluationOptions));
    });
    expectForeignSource("verifyEvaluationIdentityForEvaluation", [&] {
        static_cast<void>(foreignMemory.verifyEvaluationIdentityForEvaluation(
            evaluation.evaluationIdentityBytes(), prepared, foreignContext,
            evaluationOptions));
    });
    memoryos::PolicyOutcomeEvaluationVerificationOptions foreignSourceOptions;
    foreignSourceOptions.regressionSource = source;
    foreignSourceOptions.expectedOutcomeDigest = evaluation.outcomeDigest();
    expectForeignSource("verifyPolicyEvaluationOutcomeForEvaluation", [&] {
        static_cast<void>(foreignMemory.verifyPolicyEvaluationOutcomeForEvaluation(
            evaluation.canonicalOutcomeBytes(), prepared, foreignContext,
            foreignSourceOptions));
    });

    try {
        static_cast<void>(memory.inspectRegressionPolicyFactSource(
            source.bytes(), {"sha256:" + std::string(64U, '0')}));
        FAIL() << "source digest mismatch unexpectedly inspected";
    } catch (const memoryos::SdkError& error) {
        EXPECT_EQ(error.code(),
                  "REGRESSION_POLICY_FACT_SOURCE_DIGEST_MISMATCH");
        EXPECT_EQ(error.failureClass(), "preparation");
    }
}

TEST(MemoryOsSdk, VerifiesAllFrozenPolicyEvaluationArtifactsExactly) {
    const auto fixture = memoryos::detail::Json::parse(
        readText(MEMORYOS_SDK_POLICY_GOLDEN_VECTORS));
    const auto* records = fixture.find("records");
    if (records == nullptr || !records->isArray()) {
        throw std::runtime_error{"invalid Policy golden-vector fixture"};
    }
    ASSERT_EQ(records->asArray().size(), 17U);

    memoryos::MemoryOS memory;
    for (const auto& record : records->asArray()) {
        const auto& recordIdentifier = fixtureText(record, "recordId");
        SCOPED_TRACE(recordIdentifier);
        const auto& identityText = fixtureText(record, "canonicalIdentityBytes");
        const auto& identityDigest = fixtureText(
            record, "evaluationIdentityDigest");
        const auto identityBytes = bytesFrom(identityText);
        const auto identity = memory.verifyEvaluationIdentityArtifact(
            identityBytes, identityDigest);
        EXPECT_TRUE(identity.verified());
        EXPECT_EQ(identity.artifactKind(),
                  "MemoryOSPolicyEvaluationIdentity");
        ASSERT_TRUE(identity.evaluationIdentityDigest().has_value());
        EXPECT_EQ(*identity.evaluationIdentityDigest(), identityDigest);
        EXPECT_EQ(bytesFrom(identity.bytes()), identityBytes);
        ASSERT_TRUE(identity.evaluationIdentityJson().has_value());
        EXPECT_EQ(*identity.evaluationIdentityJson(), identityText);

        const auto& outcomeText = fixtureText(record, "canonicalOutcomeBytes");
        const auto& outcomeDigest = fixtureText(record, "outcomeDigest");
        const auto outcomeBytes = bytesFrom(outcomeText);
        memoryos::PolicyOutcomeArtifactVerificationOptions options;
        options.expectedIdentity = identityBytes;
        options.expectedOutcomeDigest = outcomeDigest;
        const auto outcome = memory.verifyPolicyEvaluationOutcomeArtifact(
            outcomeBytes, std::move(options));
        EXPECT_TRUE(outcome.verified());
        EXPECT_EQ(outcome.artifactKind(),
                  "MemoryOSPolicyEvaluationOutcome");
        ASSERT_TRUE(outcome.evaluationIdentityDigest().has_value());
        EXPECT_EQ(*outcome.evaluationIdentityDigest(), identityDigest);
        ASSERT_TRUE(outcome.outcomeDigest().has_value());
        EXPECT_EQ(*outcome.outcomeDigest(), outcomeDigest);
        EXPECT_EQ(bytesFrom(outcome.bytes()), outcomeBytes);
        ASSERT_TRUE(outcome.outcomeJson().has_value());
        EXPECT_EQ(*outcome.outcomeJson(), outcomeText);
        ASSERT_TRUE(outcome.decision().has_value());
        const auto& logicalResult = record.require("logicalOutcome")
                                        .require("result");
        EXPECT_EQ(*outcome.decision(),
                  fixtureText(logicalResult, "decision"));
        EXPECT_NE(outcomeText.find(fixtureText(logicalResult, "kind")),
                  std::string::npos);
    }
}

TEST(MemoryOsSdk, PreservesStablePolicyErrorsAcrossTheBridge) {
    memoryos::MemoryOS memory;
    const std::vector<std::uint8_t> malformed{'{'};
    try {
        static_cast<void>(memory.preparePolicy(malformed));
        FAIL() << "invalid Policy unexpectedly prepared";
    } catch (const memoryos::SdkError& error) {
        EXPECT_EQ(error.code(), "POLICY_SYNTAX_INVALID");
        EXPECT_EQ(error.phase(), "policyArtifact");
        EXPECT_EQ(error.failureClass(), "preparation");
        ASSERT_TRUE(error.preparationFailure().has_value());
        EXPECT_EQ(error.preparationFailure()->code(), error.code());
        EXPECT_EQ(error.preparationFailure()->phase(), error.phase());
        ASSERT_TRUE(error.preparationFailure()->artifactKind().has_value());
        EXPECT_EQ(*error.preparationFailure()->artifactKind(),
                  "MemoryOSInvestigationPolicy");
        EXPECT_EQ(error.preparationFailure()->failureClass(), "preparation");
    }

    auto oversized = bytesFrom(policyDocument(
        "p", "memoryos.require-lifecycle-state",
        R"({"allowedStates":["Observed"]})"));
    oversized.resize(1025U, static_cast<std::uint8_t>(' '));
    try {
        static_cast<void>(memory.preparePolicy(oversized));
        FAIL() << "oversized Policy unexpectedly prepared";
    } catch (const memoryos::SdkError& error) {
        EXPECT_EQ(error.code(), "POLICY_INPUT_RESOURCE_LIMIT_EXCEEDED");
        EXPECT_EQ(error.phase(), "policyArtifact");
        EXPECT_EQ(error.failureClass(), "preparation");
        EXPECT_EQ(error.artifactKind(), "MemoryOSInvestigationPolicy");
        EXPECT_EQ(error.limitIdentifier(), "policy.raw-document-bytes");
        ASSERT_TRUE(error.preparationFailure().has_value());
        ASSERT_TRUE(error.preparationFailure()->limitIdentifier().has_value());
        EXPECT_EQ(*error.preparationFailure()->limitIdentifier(),
                  "policy.raw-document-bytes");
    }
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

TEST(MemoryOsSdk, NavigatesRegressionEvidenceExclusivelyThroughCore) {
    memoryos::MemoryOS memory;
    const auto workspace = memory.openWorkspace("workspace-memoryos-release");
    const auto baseline = memory.observe(
        workspace, readText(MEMORYOS_SDK_REFERENCE_SNAPSHOT),
        observationOptions("cpp-explorer-baseline"));
    const auto candidate = memory.observe(
        workspace, readText(MEMORYOS_SDK_CHANGED_SNAPSHOT),
        observationOptions("cpp-explorer-candidate"));
    const auto report = memory.regression(baseline, candidate);

    memoryos::InvestigationQuery reflectionQuery;
    reflectionQuery.category = "reflection";
    const auto first = memory.investigate(report, reflectionQuery);
    const auto second = memory.investigate(report, reflectionQuery);
    EXPECT_EQ(first.regressionIdentifier(), report.identifier());
    EXPECT_EQ(first.workspaceIdentifier(), workspace.identifier());
    EXPECT_EQ(first.status(), "matched");
    EXPECT_GT(first.matchCount(), 0U);
    EXPECT_EQ(first.identifier(), second.identifier());
    EXPECT_EQ(first.canonicalJson(), second.canonicalJson());
    EXPECT_NE(first.canonicalJson().find("\"category\":\"reflection\""),
              std::string::npos);

    memoryos::InvestigationQuery replayQuery;
    replayQuery.category = "replay";
    const auto empty = memory.investigate(report, replayQuery);
    EXPECT_EQ(empty.status(), "empty");
    EXPECT_EQ(empty.matchCount(), 0U);

    expectSdkError("INVALID_QUERY", "investigate", [&memory, &report] {
        memoryos::InvestigationQuery query;
        query.category = "not-a-category";
        static_cast<void>(memory.investigate(report, std::move(query)));
    });
    expectInvalidInput([&memory, &report] {
        memoryos::InvestigationQuery query;
        query.transition = std::string{};
        static_cast<void>(memory.investigate(report, std::move(query)));
    });
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
