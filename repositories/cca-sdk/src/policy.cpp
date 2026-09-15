#include <memoryos/memoryos.hpp>

#include "client.hpp"
#include "json.hpp"

#include <cstdint>
#include <utility>

namespace memoryos {
namespace {

using detail::Json;

[[noreturn]] void invalidPolicyArgument(std::string message) {
    throw SdkError{"INVALID_INPUT", "sdk", std::move(message), {}};
}

[[noreturn]] void untrustedPolicyFactContext(std::string_view operation) {
    throw SdkError{
        "POLICY_FACT_CONTEXT_PROVENANCE_UNTRUSTED",
        std::string{operation},
        "PolicyFactContext is not authoritative for this MemoryOS instance.",
        {},
        "policyFactContext",
        "MemoryOSPolicyFactContext",
        {},
        "preparation",
    };
}

[[noreturn]] void untrustedRegressionPolicyFactSource(
    std::string_view operation) {
    throw SdkError{
        "DETERMINISTIC_FACT_SOURCE_PROVENANCE_UNTRUSTED",
        std::string{operation},
        "Regression source is not authoritative for this MemoryOS instance.",
        {},
        "regressionPolicyFactSource",
        "MemoryOSRegressionPolicyFactSource",
        {},
        "preparation",
    };
}

[[noreturn]] void invalidPolicyProtocol(std::string message) {
    throw SdkError{"SDK_PROTOCOL_ERROR", "transport", std::move(message), {}};
}

[[nodiscard]] const std::string& requiredText(const Json& value,
                                              std::string_view name) {
    const Json* member = value.find(name);
    if (member == nullptr || !member->isString()) {
        invalidPolicyProtocol("The policy host result omitted string member '" +
                              std::string{name} + "'.");
    }
    return member->asString();
}

[[nodiscard]] const Json& requiredObject(const Json& value,
                                         std::string_view name) {
    const Json* member = value.find(name);
    if (member == nullptr || !member->isObject()) {
        invalidPolicyProtocol("The policy host result omitted object member '" +
                              std::string{name} + "'.");
    }
    return *member;
}

[[nodiscard]] std::optional<std::string> optionalText(const Json& value,
                                                       std::string_view name) {
    const Json* member = value.find(name);
    if (member == nullptr || member->isNull()) {
        return std::nullopt;
    }
    if (!member->isString()) {
        invalidPolicyProtocol("The policy host returned invalid optional member '" +
                              std::string{name} + "'.");
    }
    return member->asString();
}

[[nodiscard]] std::optional<std::string> optionalObjectJson(
    const Json& value,
    std::string_view name) {
    const Json* member = value.find(name);
    if (member == nullptr || member->isNull()) {
        return std::nullopt;
    }
    if (!member->isObject()) {
        invalidPolicyProtocol("The policy host returned invalid optional object '" +
                              std::string{name} + "'.");
    }
    return member->serialize();
}

[[nodiscard]] bool requiredBoolean(const Json& value,
                                   std::string_view name) {
    const Json* member = value.find(name);
    if (member == nullptr || !member->isBool()) {
        invalidPolicyProtocol("The policy host result omitted Boolean member '" +
                              std::string{name} + "'.");
    }
    return member->asBool();
}

[[nodiscard]] std::string encodeBase64(
    std::span<const std::uint8_t> bytes) {
    constexpr std::string_view alphabet{
        "ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789+/"};
    std::string output;
    output.reserve(((bytes.size() + 2U) / 3U) * 4U);
    for (std::size_t index = 0U; index < bytes.size(); index += 3U) {
        const std::uint32_t first = bytes[index];
        const bool hasSecond = index + 1U < bytes.size();
        const bool hasThird = index + 2U < bytes.size();
        const std::uint32_t second = hasSecond ? bytes[index + 1U] : 0U;
        const std::uint32_t third = hasThird ? bytes[index + 2U] : 0U;
        const std::uint32_t value = (first << 16U) | (second << 8U) | third;
        output.push_back(alphabet[(value >> 18U) & 0x3FU]);
        output.push_back(alphabet[(value >> 12U) & 0x3FU]);
        output.push_back(hasSecond ? alphabet[(value >> 6U) & 0x3FU] : '=');
        output.push_back(hasThird ? alphabet[value & 0x3FU] : '=');
    }
    return output;
}

[[nodiscard]] int base64Digit(char value) noexcept {
    if (value >= 'A' && value <= 'Z') return value - 'A';
    if (value >= 'a' && value <= 'z') return value - 'a' + 26;
    if (value >= '0' && value <= '9') return value - '0' + 52;
    if (value == '+') return 62;
    if (value == '/') return 63;
    return -1;
}

[[nodiscard]] std::vector<std::uint8_t> decodeBase64(
    std::string_view text) {
    if (text.size() % 4U != 0U) {
        invalidPolicyProtocol("The policy host returned malformed Base64.");
    }
    std::vector<std::uint8_t> output;
    output.reserve((text.size() / 4U) * 3U);
    for (std::size_t index = 0U; index < text.size(); index += 4U) {
        const bool finalGroup = index + 4U == text.size();
        const bool padSecond = text[index + 2U] == '=';
        const bool padThird = text[index + 3U] == '=';
        const int first = base64Digit(text[index]);
        const int second = base64Digit(text[index + 1U]);
        const int third = padSecond ? 0 : base64Digit(text[index + 2U]);
        const int fourth = padThird ? 0 : base64Digit(text[index + 3U]);
        if (first < 0 || second < 0 || third < 0 || fourth < 0 ||
            (padSecond && !padThird) ||
            ((padSecond || padThird) && !finalGroup)) {
            invalidPolicyProtocol("The policy host returned malformed Base64.");
        }
        const auto value =
            (static_cast<std::uint32_t>(first) << 18U) |
            (static_cast<std::uint32_t>(second) << 12U) |
            (static_cast<std::uint32_t>(third) << 6U) |
            static_cast<std::uint32_t>(fourth);
        output.push_back(static_cast<std::uint8_t>((value >> 16U) & 0xFFU));
        if (!padSecond) {
            output.push_back(static_cast<std::uint8_t>((value >> 8U) & 0xFFU));
        }
        if (!padThird) {
            output.push_back(static_cast<std::uint8_t>(value & 0xFFU));
        }
    }
    return output;
}

[[nodiscard]] std::vector<std::uint8_t> requiredBytes(const Json& result,
                                                       std::string_view name) {
    return decodeBase64(requiredText(result, name));
}

void addOptional(Json::Object& params,
                 std::string_view name,
                 const std::optional<std::string>& value) {
    if (value.has_value()) {
        params.emplace(std::string{name}, Json{*value});
    }
}

} // namespace

struct PreparedPolicy::Impl final {
    std::string kind;
    std::string version;
    std::string identifier;
    std::string artifact_json;
    std::string semantic_projection_json;
    std::string document_digest;
    std::string semantic_digest;
    std::vector<std::uint8_t> bytes;
};

struct PolicyFactContextInspection::Impl final {
    std::string kind;
    std::string version;
    std::string fact_model_version;
    std::string context_digest;
    std::string artifact_json;
    std::vector<std::uint8_t> bytes;
};

struct AuthoritativePolicyFactContext::Impl final {
    std::shared_ptr<detail::Client> client;
    std::string token;
    std::string kind;
    std::string version;
    std::string fact_model_version;
    std::string context_digest;
    std::string artifact_json;
    std::vector<std::uint8_t> bytes;
};

struct RegressionPolicyFactSourceInspection::Impl final {
    std::string kind;
    std::string version;
    std::string domain;
    std::string source_model_version;
    std::string source_digest;
    std::string artifact_json;
    std::vector<std::uint8_t> bytes;
};

struct AuthoritativeRegressionPolicyFactSource::Impl final {
    std::shared_ptr<detail::Client> client;
    std::string token;
    std::string context_token;
    std::string kind;
    std::string version;
    std::string domain;
    std::string source_model_version;
    std::string source_digest;
    std::string artifact_json;
    std::vector<std::uint8_t> bytes;
};

struct RegressionReportInspection::Impl final {
    std::string kind;
    std::string version;
    std::string report_identifier;
    std::string artifact_json;
    std::vector<std::uint8_t> bytes;
};

struct PolicyEvaluation::Impl final {
    std::string outcome_kind;
    std::string decision;
    std::string evaluation_identity_json;
    std::string evaluation_identity_digest;
    std::vector<std::uint8_t> evaluation_identity_bytes;
    std::string outcome_json;
    std::string outcome_digest;
    std::vector<std::uint8_t> canonical_outcome_bytes;
    std::string cache_disposition;
};

struct PolicyArtifactVerification::Impl final {
    std::string artifact_kind;
    std::string artifact_version;
    std::string authority;
    std::string verification_scope;
    bool verified{false};
    std::vector<std::uint8_t> bytes;
    std::optional<std::string> evaluation_identity_json;
    std::optional<std::string> evaluation_identity_digest;
    std::optional<std::string> outcome_json;
    std::optional<std::string> outcome_digest;
    std::optional<std::string> decision;
};

PreparedPolicy::PreparedPolicy(std::shared_ptr<const Impl> impl)
    : impl_(std::move(impl)) {}
const std::string& PreparedPolicy::kind() const noexcept { return impl_->kind; }
const std::string& PreparedPolicy::version() const noexcept { return impl_->version; }
const std::string& PreparedPolicy::identifier() const noexcept { return impl_->identifier; }
const std::string& PreparedPolicy::artifactJson() const noexcept { return impl_->artifact_json; }
const std::string& PreparedPolicy::semanticProjectionJson() const noexcept { return impl_->semantic_projection_json; }
const std::string& PreparedPolicy::documentDigest() const noexcept { return impl_->document_digest; }
const std::string& PreparedPolicy::semanticDigest() const noexcept { return impl_->semantic_digest; }
std::span<const std::uint8_t> PreparedPolicy::bytes() const noexcept { return impl_->bytes; }

PolicyFactContextInspection::PolicyFactContextInspection(std::shared_ptr<const Impl> impl)
    : impl_(std::move(impl)) {}
const std::string& PolicyFactContextInspection::kind() const noexcept { return impl_->kind; }
const std::string& PolicyFactContextInspection::version() const noexcept { return impl_->version; }
const std::string& PolicyFactContextInspection::factModelVersion() const noexcept { return impl_->fact_model_version; }
const std::string& PolicyFactContextInspection::contextDigest() const noexcept { return impl_->context_digest; }
const std::string& PolicyFactContextInspection::artifactJson() const noexcept { return impl_->artifact_json; }
std::span<const std::uint8_t> PolicyFactContextInspection::bytes() const noexcept { return impl_->bytes; }
std::string_view PolicyFactContextInspection::authority() const noexcept { return "inspectionOnly"; }

AuthoritativePolicyFactContext::AuthoritativePolicyFactContext(std::shared_ptr<const Impl> impl)
    : impl_(std::move(impl)) {}
const std::string& AuthoritativePolicyFactContext::kind() const noexcept { return impl_->kind; }
const std::string& AuthoritativePolicyFactContext::version() const noexcept { return impl_->version; }
const std::string& AuthoritativePolicyFactContext::factModelVersion() const noexcept { return impl_->fact_model_version; }
const std::string& AuthoritativePolicyFactContext::contextDigest() const noexcept { return impl_->context_digest; }
const std::string& AuthoritativePolicyFactContext::artifactJson() const noexcept { return impl_->artifact_json; }
std::span<const std::uint8_t> AuthoritativePolicyFactContext::bytes() const noexcept { return impl_->bytes; }
std::string_view AuthoritativePolicyFactContext::authority() const noexcept { return "authoritative"; }

RegressionPolicyFactSourceInspection::RegressionPolicyFactSourceInspection(std::shared_ptr<const Impl> impl)
    : impl_(std::move(impl)) {}
const std::string& RegressionPolicyFactSourceInspection::kind() const noexcept { return impl_->kind; }
const std::string& RegressionPolicyFactSourceInspection::version() const noexcept { return impl_->version; }
const std::string& RegressionPolicyFactSourceInspection::domain() const noexcept { return impl_->domain; }
const std::string& RegressionPolicyFactSourceInspection::sourceModelVersion() const noexcept { return impl_->source_model_version; }
const std::string& RegressionPolicyFactSourceInspection::sourceDigest() const noexcept { return impl_->source_digest; }
const std::string& RegressionPolicyFactSourceInspection::artifactJson() const noexcept { return impl_->artifact_json; }
std::span<const std::uint8_t> RegressionPolicyFactSourceInspection::bytes() const noexcept { return impl_->bytes; }
std::string_view RegressionPolicyFactSourceInspection::authority() const noexcept { return "inspectionOnly"; }

AuthoritativeRegressionPolicyFactSource::AuthoritativeRegressionPolicyFactSource(std::shared_ptr<const Impl> impl)
    : impl_(std::move(impl)) {}
const std::string& AuthoritativeRegressionPolicyFactSource::kind() const noexcept { return impl_->kind; }
const std::string& AuthoritativeRegressionPolicyFactSource::version() const noexcept { return impl_->version; }
const std::string& AuthoritativeRegressionPolicyFactSource::domain() const noexcept { return impl_->domain; }
const std::string& AuthoritativeRegressionPolicyFactSource::sourceModelVersion() const noexcept { return impl_->source_model_version; }
const std::string& AuthoritativeRegressionPolicyFactSource::sourceDigest() const noexcept { return impl_->source_digest; }
const std::string& AuthoritativeRegressionPolicyFactSource::artifactJson() const noexcept { return impl_->artifact_json; }
std::span<const std::uint8_t> AuthoritativeRegressionPolicyFactSource::bytes() const noexcept { return impl_->bytes; }
std::string_view AuthoritativeRegressionPolicyFactSource::authority() const noexcept { return "authoritative"; }

RegressionReportInspection::RegressionReportInspection(std::shared_ptr<const Impl> impl)
    : impl_(std::move(impl)) {}
const std::string& RegressionReportInspection::kind() const noexcept { return impl_->kind; }
const std::string& RegressionReportInspection::version() const noexcept { return impl_->version; }
const std::string& RegressionReportInspection::reportIdentifier() const noexcept { return impl_->report_identifier; }
const std::string& RegressionReportInspection::artifactJson() const noexcept { return impl_->artifact_json; }
std::span<const std::uint8_t> RegressionReportInspection::bytes() const noexcept { return impl_->bytes; }
std::string_view RegressionReportInspection::authority() const noexcept { return "inspectionOnly"; }

AuthoritativeRegressionPolicyFacts::AuthoritativeRegressionPolicyFacts(
    AuthoritativePolicyFactContext context,
    AuthoritativeRegressionPolicyFactSource source)
    : context_(std::move(context)), source_(std::move(source)) {}
const AuthoritativePolicyFactContext& AuthoritativeRegressionPolicyFacts::policyFactContext() const noexcept { return context_; }
const AuthoritativeRegressionPolicyFactSource& AuthoritativeRegressionPolicyFacts::regressionPolicyFactSource() const noexcept { return source_; }

PolicyEvaluation::PolicyEvaluation(std::shared_ptr<const Impl> impl)
    : impl_(std::move(impl)) {}
const std::string& PolicyEvaluation::outcomeKind() const noexcept { return impl_->outcome_kind; }
const std::string& PolicyEvaluation::decision() const noexcept { return impl_->decision; }
const std::string& PolicyEvaluation::evaluationIdentityJson() const noexcept { return impl_->evaluation_identity_json; }
const std::string& PolicyEvaluation::evaluationIdentityDigest() const noexcept { return impl_->evaluation_identity_digest; }
std::span<const std::uint8_t> PolicyEvaluation::evaluationIdentityBytes() const noexcept { return impl_->evaluation_identity_bytes; }
const std::string& PolicyEvaluation::outcomeJson() const noexcept { return impl_->outcome_json; }
const std::string& PolicyEvaluation::outcomeDigest() const noexcept { return impl_->outcome_digest; }
std::span<const std::uint8_t> PolicyEvaluation::canonicalOutcomeBytes() const noexcept { return impl_->canonical_outcome_bytes; }
const std::string& PolicyEvaluation::cacheDisposition() const noexcept { return impl_->cache_disposition; }

PolicyArtifactVerification::PolicyArtifactVerification(std::shared_ptr<const Impl> impl)
    : impl_(std::move(impl)) {}
const std::string& PolicyArtifactVerification::artifactKind() const noexcept { return impl_->artifact_kind; }
const std::string& PolicyArtifactVerification::artifactVersion() const noexcept { return impl_->artifact_version; }
const std::string& PolicyArtifactVerification::authority() const noexcept { return impl_->authority; }
const std::string& PolicyArtifactVerification::verificationScope() const noexcept { return impl_->verification_scope; }
bool PolicyArtifactVerification::verified() const noexcept { return impl_->verified; }
std::span<const std::uint8_t> PolicyArtifactVerification::bytes() const noexcept { return impl_->bytes; }
const std::optional<std::string>& PolicyArtifactVerification::evaluationIdentityJson() const noexcept { return impl_->evaluation_identity_json; }
const std::optional<std::string>& PolicyArtifactVerification::evaluationIdentityDigest() const noexcept { return impl_->evaluation_identity_digest; }
const std::optional<std::string>& PolicyArtifactVerification::outcomeJson() const noexcept { return impl_->outcome_json; }
const std::optional<std::string>& PolicyArtifactVerification::outcomeDigest() const noexcept { return impl_->outcome_digest; }
const std::optional<std::string>& PolicyArtifactVerification::decision() const noexcept { return impl_->decision; }

PreparedPolicy MemoryOS::preparePolicy(
    std::span<const std::uint8_t> bytes) const {
    const Json result = client_->invoke("preparePolicy", {
        {"bytesBase64", Json{encodeBase64(bytes)}},
    });
    auto impl = std::make_shared<PreparedPolicy::Impl>();
    impl->kind = requiredText(result, "kind");
    impl->version = requiredText(result, "version");
    impl->identifier = requiredText(result, "identifier");
    impl->artifact_json = requiredObject(result, "artifact").serialize();
    impl->semantic_projection_json =
        requiredObject(result, "semanticProjection").serialize();
    impl->document_digest = requiredText(result, "documentDigest");
    impl->semantic_digest = requiredText(result, "semanticDigest");
    impl->bytes = requiredBytes(result, "bytesBase64");
    if (impl->kind != "MemoryOSInvestigationPolicy") {
        invalidPolicyProtocol("The policy host returned the wrong prepared artifact kind.");
    }
    return PreparedPolicy{std::move(impl)};
}

PreparedPolicy MemoryOS::preparePolicySet(
    std::span<const std::uint8_t> bytes) const {
    const Json result = client_->invoke("preparePolicySet", {
        {"bytesBase64", Json{encodeBase64(bytes)}},
    });
    auto impl = std::make_shared<PreparedPolicy::Impl>();
    impl->kind = requiredText(result, "kind");
    impl->version = requiredText(result, "version");
    impl->identifier = requiredText(result, "identifier");
    impl->artifact_json = requiredObject(result, "artifact").serialize();
    impl->semantic_projection_json =
        requiredObject(result, "semanticProjection").serialize();
    impl->document_digest = requiredText(result, "documentDigest");
    impl->semantic_digest = requiredText(result, "semanticDigest");
    impl->bytes = requiredBytes(result, "bytesBase64");
    if (impl->kind != "MemoryOSInvestigationPolicySet") {
        invalidPolicyProtocol("The policy host returned the wrong prepared artifact kind.");
    }
    return PreparedPolicy{std::move(impl)};
}

PolicyFactContextInspection MemoryOS::inspectPolicyFactContext(
    std::span<const std::uint8_t> bytes,
    PolicyFactContextInspectionOptions options) const {
    Json::Object params{{"bytesBase64", Json{encodeBase64(bytes)}}};
    addOptional(params, "expectedContextDigest", options.expectedContextDigest);
    const Json result = client_->invoke("inspectPolicyFactContext", std::move(params));
    auto impl = std::make_shared<PolicyFactContextInspection::Impl>();
    impl->kind = requiredText(result, "kind");
    impl->version = requiredText(result, "version");
    impl->fact_model_version = requiredText(result, "factModelVersion");
    impl->context_digest = requiredText(result, "contextDigest");
    impl->artifact_json = requiredObject(result, "artifact").serialize();
    impl->bytes = requiredBytes(result, "bytesBase64");
    return PolicyFactContextInspection{std::move(impl)};
}

RegressionPolicyFactSourceInspection MemoryOS::inspectRegressionPolicyFactSource(
    std::span<const std::uint8_t> bytes,
    RegressionPolicyFactSourceInspectionOptions options) const {
    Json::Object params{{"bytesBase64", Json{encodeBase64(bytes)}}};
    addOptional(params, "expectedSourceDigest", options.expectedSourceDigest);
    const Json result = client_->invoke(
        "inspectRegressionPolicyFactSource", std::move(params));
    auto impl = std::make_shared<RegressionPolicyFactSourceInspection::Impl>();
    impl->kind = requiredText(result, "kind");
    impl->version = requiredText(result, "version");
    impl->domain = requiredText(result, "domain");
    impl->source_model_version = requiredText(result, "sourceModelVersion");
    impl->source_digest = requiredText(result, "sourceDigest");
    impl->artifact_json = requiredObject(result, "artifact").serialize();
    impl->bytes = requiredBytes(result, "bytesBase64");
    return RegressionPolicyFactSourceInspection{std::move(impl)};
}

RegressionReportInspection MemoryOS::inspectRegressionReport(
    std::span<const std::uint8_t> bytes) const {
    const Json result = client_->invoke("inspectRegressionReport", {
        {"bytesBase64", Json{encodeBase64(bytes)}},
    });
    auto impl = std::make_shared<RegressionReportInspection::Impl>();
    impl->kind = requiredText(result, "kind");
    impl->version = requiredText(result, "version");
    impl->report_identifier = requiredText(result, "reportIdentifier");
    impl->artifact_json = requiredObject(result, "artifact").serialize();
    impl->bytes = requiredBytes(result, "bytesBase64");
    return RegressionReportInspection{std::move(impl)};
}

AuthoritativePolicyFactContext MemoryOS::capturePolicyFactContext(
    const Investigation& investigation) const {
    if (!ownsInvestigation(investigation)) {
        invalidPolicyArgument(
            "An Investigation belongs to a different MemoryOS instance.");
    }
    const Json result = client_->invoke("capturePolicyFactContext", {
        {"investigationIdentifier", Json{investigation.identifier()}},
    });
    auto impl = std::make_shared<AuthoritativePolicyFactContext::Impl>();
    impl->client = client_;
    impl->token = requiredText(result, "capabilityToken");
    impl->kind = requiredText(result, "kind");
    impl->version = requiredText(result, "version");
    impl->fact_model_version = requiredText(result, "factModelVersion");
    impl->context_digest = requiredText(result, "contextDigest");
    impl->artifact_json = requiredObject(result, "artifact").serialize();
    impl->bytes = requiredBytes(result, "bytesBase64");
    return AuthoritativePolicyFactContext{std::move(impl)};
}

AuthoritativeRegressionPolicyFacts MemoryOS::captureRegressionPolicyFacts(
    const Investigation& baseline,
    const Investigation& candidate) const {
    if (!ownsInvestigation(baseline) || !ownsInvestigation(candidate)) {
        invalidPolicyArgument(
            "Regression investigations belong to a different MemoryOS instance.");
    }
    const Json result = client_->invoke("captureRegressionPolicyFacts", {
        {"baselineInvestigationIdentifier", Json{baseline.identifier()}},
        {"candidateInvestigationIdentifier", Json{candidate.identifier()}},
    });
    const Json& contextValue = requiredObject(result, "policyFactContext");
    auto contextImpl = std::make_shared<AuthoritativePolicyFactContext::Impl>();
    contextImpl->client = client_;
    contextImpl->token = requiredText(contextValue, "capabilityToken");
    contextImpl->kind = requiredText(contextValue, "kind");
    contextImpl->version = requiredText(contextValue, "version");
    contextImpl->fact_model_version = requiredText(contextValue, "factModelVersion");
    contextImpl->context_digest = requiredText(contextValue, "contextDigest");
    contextImpl->artifact_json = requiredObject(contextValue, "artifact").serialize();
    contextImpl->bytes = requiredBytes(contextValue, "bytesBase64");
    AuthoritativePolicyFactContext context{contextImpl};

    const Json& sourceValue = requiredObject(result, "regressionPolicyFactSource");
    auto sourceImpl = std::make_shared<AuthoritativeRegressionPolicyFactSource::Impl>();
    sourceImpl->client = client_;
    sourceImpl->token = requiredText(sourceValue, "capabilityToken");
    sourceImpl->context_token = contextImpl->token;
    sourceImpl->kind = requiredText(sourceValue, "kind");
    sourceImpl->version = requiredText(sourceValue, "version");
    sourceImpl->domain = requiredText(sourceValue, "domain");
    sourceImpl->source_model_version = requiredText(sourceValue, "sourceModelVersion");
    sourceImpl->source_digest = requiredText(sourceValue, "sourceDigest");
    sourceImpl->artifact_json = requiredObject(sourceValue, "artifact").serialize();
    sourceImpl->bytes = requiredBytes(sourceValue, "bytesBase64");
    AuthoritativeRegressionPolicyFactSource source{sourceImpl};
    return AuthoritativeRegressionPolicyFacts{std::move(context), std::move(source)};
}

PolicyEvaluation MemoryOS::evaluatePolicy(
    const PreparedPolicy& policy,
    const AuthoritativePolicyFactContext& context,
    PolicyEvaluationOptions options) const {
    if (context.impl_->client != client_) {
        untrustedPolicyFactContext("evaluatePolicy");
    }
    if (policy.kind() != "MemoryOSInvestigationPolicy") {
        invalidPolicyArgument("evaluatePolicy requires a prepared Policy.");
    }
    Json::Object params{
        {"artifactBytesBase64", Json{encodeBase64(policy.bytes())}},
        {"policyFactContextToken", Json{context.impl_->token}},
    };
    if (options.regressionSource.has_value()) {
        if (options.regressionSource->impl_->client != client_) {
            untrustedRegressionPolicyFactSource("evaluatePolicy");
        }
        params.emplace("regressionPolicyFactSourceToken",
                       Json{options.regressionSource->impl_->token});
    }
    const Json result = client_->invoke("evaluatePolicy", std::move(params));
    auto impl = std::make_shared<PolicyEvaluation::Impl>();
    const Json& outcome = requiredObject(result, "outcome");
    impl->outcome_kind = requiredText(outcome, "kind");
    impl->decision = requiredText(result, "decision");
    impl->evaluation_identity_json =
        requiredObject(result, "evaluationIdentity").serialize();
    impl->evaluation_identity_digest = requiredText(result, "evaluationIdentityDigest");
    impl->evaluation_identity_bytes = requiredBytes(result, "evaluationIdentityBytesBase64");
    impl->outcome_json = outcome.serialize();
    impl->outcome_digest = requiredText(result, "outcomeDigest");
    impl->canonical_outcome_bytes = requiredBytes(result, "canonicalOutcomeBytesBase64");
    impl->cache_disposition = requiredText(result, "cacheDisposition");
    return PolicyEvaluation{std::move(impl)};
}

PolicyEvaluation MemoryOS::evaluatePolicySet(
    const PreparedPolicy& policySet,
    const AuthoritativePolicyFactContext& context,
    PolicyEvaluationOptions options) const {
    if (context.impl_->client != client_) {
        untrustedPolicyFactContext("evaluatePolicySet");
    }
    if (policySet.kind() != "MemoryOSInvestigationPolicySet") {
        invalidPolicyArgument("evaluatePolicySet requires a prepared Policy Set.");
    }
    Json::Object params{
        {"artifactBytesBase64", Json{encodeBase64(policySet.bytes())}},
        {"policyFactContextToken", Json{context.impl_->token}},
    };
    if (options.regressionSource.has_value()) {
        if (options.regressionSource->impl_->client != client_) {
            untrustedRegressionPolicyFactSource("evaluatePolicySet");
        }
        params.emplace("regressionPolicyFactSourceToken",
                       Json{options.regressionSource->impl_->token});
    }
    const Json result = client_->invoke("evaluatePolicySet", std::move(params));
    auto impl = std::make_shared<PolicyEvaluation::Impl>();
    const Json& outcome = requiredObject(result, "outcome");
    impl->outcome_kind = requiredText(outcome, "kind");
    impl->decision = requiredText(result, "decision");
    impl->evaluation_identity_json =
        requiredObject(result, "evaluationIdentity").serialize();
    impl->evaluation_identity_digest = requiredText(result, "evaluationIdentityDigest");
    impl->evaluation_identity_bytes = requiredBytes(result, "evaluationIdentityBytesBase64");
    impl->outcome_json = outcome.serialize();
    impl->outcome_digest = requiredText(result, "outcomeDigest");
    impl->canonical_outcome_bytes = requiredBytes(result, "canonicalOutcomeBytesBase64");
    impl->cache_disposition = requiredText(result, "cacheDisposition");
    return PolicyEvaluation{std::move(impl)};
}

PolicyArtifactVerification MemoryOS::verifyEvaluationIdentityArtifact(
    std::span<const std::uint8_t> bytes,
    std::optional<std::string> expectedEvaluationIdentityDigest) const {
    Json::Object params{{"bytesBase64", Json{encodeBase64(bytes)}}};
    addOptional(params, "expectedEvaluationIdentityDigest",
                expectedEvaluationIdentityDigest);
    const Json result = client_->invoke(
        "verifyEvaluationIdentityArtifact", std::move(params));
    auto impl = std::make_shared<PolicyArtifactVerification::Impl>();
    impl->artifact_kind = requiredText(result, "artifactKind");
    impl->artifact_version = requiredText(result, "artifactVersion");
    impl->authority = requiredText(result, "authority");
    impl->verification_scope = requiredText(result, "verificationScope");
    impl->verified = requiredBoolean(result, "verified");
    impl->bytes = requiredBytes(result, "bytesBase64");
    impl->evaluation_identity_json = optionalObjectJson(result, "evaluationIdentity");
    impl->evaluation_identity_digest = optionalText(result, "evaluationIdentityDigest");
    impl->outcome_json = optionalObjectJson(result, "outcome");
    impl->outcome_digest = optionalText(result, "outcomeDigest");
    impl->decision = optionalText(result, "decision");
    return PolicyArtifactVerification{std::move(impl)};
}

PolicyArtifactVerification MemoryOS::verifyEvaluationIdentityForEvaluation(
    std::span<const std::uint8_t> bytes,
    const PreparedPolicy& artifact,
    const AuthoritativePolicyFactContext& context,
    PolicyEvaluationOptions options) const {
    if (context.impl_->client != client_) {
        untrustedPolicyFactContext("verifyEvaluationIdentityForEvaluation");
    }
    Json::Object params{
        {"artifactBytesBase64", Json{encodeBase64(artifact.bytes())}},
        {"artifactKind", Json{artifact.kind()}},
        {"bytesBase64", Json{encodeBase64(bytes)}},
        {"policyFactContextToken", Json{context.impl_->token}},
    };
    if (options.regressionSource.has_value()) {
        if (options.regressionSource->impl_->client != client_) {
            untrustedRegressionPolicyFactSource(
                "verifyEvaluationIdentityForEvaluation");
        }
        params.emplace("regressionPolicyFactSourceToken",
                       Json{options.regressionSource->impl_->token});
    }
    const Json result = client_->invoke(
        "verifyEvaluationIdentityForEvaluation", std::move(params));
    auto impl = std::make_shared<PolicyArtifactVerification::Impl>();
    impl->artifact_kind = requiredText(result, "artifactKind");
    impl->artifact_version = requiredText(result, "artifactVersion");
    impl->authority = requiredText(result, "authority");
    impl->verification_scope = requiredText(result, "verificationScope");
    impl->verified = requiredBoolean(result, "verified");
    impl->bytes = requiredBytes(result, "bytesBase64");
    impl->evaluation_identity_json = optionalObjectJson(result, "evaluationIdentity");
    impl->evaluation_identity_digest = optionalText(result, "evaluationIdentityDigest");
    impl->outcome_json = optionalObjectJson(result, "outcome");
    impl->outcome_digest = optionalText(result, "outcomeDigest");
    impl->decision = optionalText(result, "decision");
    return PolicyArtifactVerification{std::move(impl)};
}

PolicyArtifactVerification MemoryOS::verifyPolicyEvaluationOutcomeArtifact(
    std::span<const std::uint8_t> bytes,
    PolicyOutcomeArtifactVerificationOptions options) const {
    if (options.expectedIdentity.has_value() &&
        options.expectedEvaluationIdentityDigest.has_value()) {
        invalidPolicyArgument(
            "Expected identity bytes and digest are mutually exclusive.");
    }
    Json::Object params{{"bytesBase64", Json{encodeBase64(bytes)}}};
    if (options.expectedIdentity.has_value()) {
        params.emplace("expectedEvaluationIdentityBytesBase64",
                       Json{encodeBase64(*options.expectedIdentity)});
    }
    addOptional(params, "expectedEvaluationIdentityDigest",
                options.expectedEvaluationIdentityDigest);
    addOptional(params, "expectedOutcomeDigest", options.expectedOutcomeDigest);
    const Json result = client_->invoke(
        "verifyPolicyEvaluationOutcomeArtifact", std::move(params));
    auto impl = std::make_shared<PolicyArtifactVerification::Impl>();
    impl->artifact_kind = requiredText(result, "artifactKind");
    impl->artifact_version = requiredText(result, "artifactVersion");
    impl->authority = requiredText(result, "authority");
    impl->verification_scope = requiredText(result, "verificationScope");
    impl->verified = requiredBoolean(result, "verified");
    impl->bytes = requiredBytes(result, "bytesBase64");
    impl->evaluation_identity_json = optionalObjectJson(result, "evaluationIdentity");
    impl->evaluation_identity_digest = optionalText(result, "evaluationIdentityDigest");
    impl->outcome_json = optionalObjectJson(result, "outcome");
    impl->outcome_digest = optionalText(result, "outcomeDigest");
    impl->decision = optionalText(result, "decision");
    return PolicyArtifactVerification{std::move(impl)};
}

PolicyArtifactVerification MemoryOS::verifyPolicyEvaluationOutcomeForEvaluation(
    std::span<const std::uint8_t> bytes,
    const PreparedPolicy& artifact,
    const AuthoritativePolicyFactContext& context,
    PolicyOutcomeEvaluationVerificationOptions options) const {
    if (context.impl_->client != client_) {
        untrustedPolicyFactContext(
            "verifyPolicyEvaluationOutcomeForEvaluation");
    }
    Json::Object params{
        {"artifactBytesBase64", Json{encodeBase64(artifact.bytes())}},
        {"artifactKind", Json{artifact.kind()}},
        {"bytesBase64", Json{encodeBase64(bytes)}},
        {"policyFactContextToken", Json{context.impl_->token}},
    };
    if (options.regressionSource.has_value()) {
        if (options.regressionSource->impl_->client != client_) {
            untrustedRegressionPolicyFactSource(
                "verifyPolicyEvaluationOutcomeForEvaluation");
        }
        params.emplace("regressionPolicyFactSourceToken",
                       Json{options.regressionSource->impl_->token});
    }
    addOptional(params, "expectedOutcomeDigest", options.expectedOutcomeDigest);
    const Json result = client_->invoke(
        "verifyPolicyEvaluationOutcomeForEvaluation", std::move(params));
    auto impl = std::make_shared<PolicyArtifactVerification::Impl>();
    impl->artifact_kind = requiredText(result, "artifactKind");
    impl->artifact_version = requiredText(result, "artifactVersion");
    impl->authority = requiredText(result, "authority");
    impl->verification_scope = requiredText(result, "verificationScope");
    impl->verified = requiredBoolean(result, "verified");
    impl->bytes = requiredBytes(result, "bytesBase64");
    impl->evaluation_identity_json = optionalObjectJson(result, "evaluationIdentity");
    impl->evaluation_identity_digest = optionalText(result, "evaluationIdentityDigest");
    impl->outcome_json = optionalObjectJson(result, "outcome");
    impl->outcome_digest = optionalText(result, "outcomeDigest");
    impl->decision = optionalText(result, "decision");
    return PolicyArtifactVerification{std::move(impl)};
}

std::string MemoryOS::policyContractIdentities() const {
    const Json result = client_->invoke("policyContractIdentities", {});
    return requiredObject(result, "identities").serialize();
}

} // namespace memoryos
