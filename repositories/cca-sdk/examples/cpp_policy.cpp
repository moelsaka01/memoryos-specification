#include <memoryos/memoryos.hpp>

#include <cstdint>
#include <fstream>
#include <iostream>
#include <iterator>
#include <stdexcept>
#include <string>
#include <utility>
#include <vector>

namespace {

std::string readText(const char* path) {
    std::ifstream input{path, std::ios::binary};
    if (!input) {
        throw std::runtime_error{"cannot open the deterministic observation"};
    }
    return {std::istreambuf_iterator<char>{input},
            std::istreambuf_iterator<char>{}};
}

memoryos::ObserveOptions observationOptions(std::string identifier) {
    memoryos::ObserveOptions options;
    options.identifier = std::move(identifier);
    return options;
}

} // namespace

int main() {
    try {
        memoryos::MemoryOS memory;
        const auto workspace = memory.openWorkspace("workspace-memoryos-release");
        const auto baseline = memory.observe(
            workspace, readText(MEMORYOS_SDK_REFERENCE_SNAPSHOT),
            observationOptions("cpp-policy-example-baseline"));
        const auto candidate = memory.observe(
            workspace, readText(MEMORYOS_SDK_CHANGED_SNAPSHOT),
            observationOptions("cpp-policy-example-candidate"));
        const std::string document =
            R"({"identifier":"p","kind":"MemoryOSInvestigationPolicy","policyVersion":"0.0.0","rules":[{"identifier":"r","parameters":{"allowedStates":["Observed"]},"type":"memoryos.require-lifecycle-state","version":"1.0.0"}],"version":"1.0.0"})";
        const std::vector<std::uint8_t> bytes(document.begin(), document.end());
        const auto prepared = memory.preparePolicy(bytes);
        const auto facts = memory.captureRegressionPolicyFacts(baseline, candidate);
        const auto& context = facts.policyFactContext();
        const auto& source = facts.regressionPolicyFactSource();

        memoryos::PolicyEvaluationOptions evaluationOptions;
        evaluationOptions.regressionSource = source;
        const auto evaluation = memory.evaluatePolicy(
            prepared, context, evaluationOptions);
        const auto contextInspection = memory.inspectPolicyFactContext(
            context.bytes(), {context.contextDigest()});
        const auto sourceInspection = memory.inspectRegressionPolicyFactSource(
            source.bytes(), {source.sourceDigest()});
        const auto identityCheck = memory.verifyEvaluationIdentityForEvaluation(
            evaluation.evaluationIdentityBytes(), prepared, context,
            evaluationOptions);
        memoryos::PolicyOutcomeEvaluationVerificationOptions outcomeOptions;
        outcomeOptions.regressionSource = source;
        outcomeOptions.expectedOutcomeDigest = evaluation.outcomeDigest();
        const auto outcomeCheck =
            memory.verifyPolicyEvaluationOutcomeForEvaluation(
                evaluation.canonicalOutcomeBytes(), prepared, context,
                outcomeOptions);

        std::cout << "{\"contextDigest\":\"" << contextInspection.contextDigest()
                  << "\",\"decision\":\"" << evaluation.decision()
                  << "\",\"documentDigest\":\"" << prepared.documentDigest()
                  << "\",\"identities\":" << memory.policyContractIdentities()
                  << ",\"identityVerified\":"
                  << (identityCheck.verified() ? "true" : "false")
                  << ",\"outcomeDigest\":\"" << evaluation.outcomeDigest()
                  << "\",\"outcomeVerified\":"
                  << (outcomeCheck.verified() ? "true" : "false")
                  << ",\"semanticDigest\":\"" << prepared.semanticDigest()
                  << "\",\"sourceDigest\":\"" << sourceInspection.sourceDigest()
                  << "\"}\n";
        return 0;
    } catch (const std::exception& error) {
        std::cerr << error.what() << '\n';
        return 1;
    }
}
