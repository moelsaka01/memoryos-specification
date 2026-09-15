#pragma once

#include <cstddef>
#include <cstdint>
#include <filesystem>
#include <memory>
#include <optional>
#include <span>
#include <stdexcept>
#include <string>
#include <string_view>
#include <vector>

namespace memoryos {

class Investigation;
class InvestigationResult;
class RegressionReport;
class VerificationResult;

inline constexpr std::string_view sdkVersion{"1.1.0"};

struct Diagnostic final {
    std::string code;
    std::string operation{""};
    std::string message;
    std::string canonicalJson;
};

class PolicyPreparationFailure final {
  public:
    PolicyPreparationFailure(const PolicyPreparationFailure&) = default;
    PolicyPreparationFailure& operator=(const PolicyPreparationFailure&) = default;
    PolicyPreparationFailure(PolicyPreparationFailure&&) noexcept = default;
    PolicyPreparationFailure& operator=(PolicyPreparationFailure&&) noexcept = default;
    ~PolicyPreparationFailure() = default;

    [[nodiscard]] const std::string& code() const noexcept;
    [[nodiscard]] const std::string& phase() const noexcept;
    [[nodiscard]] const std::optional<std::string>& artifactKind() const noexcept;
    [[nodiscard]] const std::optional<std::string>& limitIdentifier() const noexcept;
    [[nodiscard]] std::string_view failureClass() const noexcept;

  private:
    PolicyPreparationFailure(std::string code,
                             std::string phase,
                             std::optional<std::string> artifactKind,
                             std::optional<std::string> limitIdentifier);
    std::string code_;
    std::string phase_;
    std::optional<std::string> artifact_kind_;
    std::optional<std::string> limit_identifier_;
    friend class SdkError;
};

class SdkError final : public std::runtime_error {
  public:
    SdkError(std::string code,
             std::string operation,
             std::string message,
             std::vector<Diagnostic> diagnostics,
             std::string phase = {},
             std::string artifactKind = {},
             std::string limitIdentifier = {},
             std::string failureClass = {},
             bool verificationFailure = false);

    [[nodiscard]] const std::string& code() const noexcept;
    [[nodiscard]] const std::string& operation() const noexcept;
    [[nodiscard]] const std::vector<Diagnostic>& diagnostics() const noexcept;
    [[nodiscard]] const std::string& phase() const noexcept;
    [[nodiscard]] const std::string& artifactKind() const noexcept;
    [[nodiscard]] const std::string& limitIdentifier() const noexcept;
    [[nodiscard]] const std::string& failureClass() const noexcept;
    [[nodiscard]] bool verificationFailure() const noexcept;
    [[nodiscard]] const std::optional<PolicyPreparationFailure>&
    preparationFailure() const noexcept;

  private:
    std::string code_;
    std::string operation_;
    std::vector<Diagnostic> diagnostics_;
    std::string phase_;
    std::string artifact_kind_;
    std::string limit_identifier_;
    std::string failure_class_;
    bool verification_failure_{false};
    std::optional<PolicyPreparationFailure> preparation_failure_;
};

struct SdkOptions final {
    std::filesystem::path nodeExecutable;
    std::filesystem::path coreHost;
};

struct ObserveOptions final {
    std::string identifier;
    std::string operation;
    std::string queryJson{"null"};
    std::string resultCode{"OK"};
};

struct ImportOptions final {
    std::string identifier;
    std::vector<std::string> supportedExtensions;
};

struct InvestigationQuery final {
    std::optional<std::string> category;
    std::optional<std::string> reflectionIdentifier;
    std::optional<std::string> transition;
};

namespace detail {
class Client;
class Json;
[[nodiscard]] Investigation investigationFrom(
    const std::shared_ptr<Client>& client,
    const Json& result);
[[nodiscard]] VerificationResult verificationFrom(
    const Json& value,
    bool valid,
    std::string_view operation,
    const Json* diagnostics);
}

class Workspace final {
  public:
    Workspace(const Workspace&) noexcept = default;
    Workspace& operator=(const Workspace&) noexcept = default;
    Workspace(Workspace&&) noexcept = default;
    Workspace& operator=(Workspace&&) noexcept = default;
    ~Workspace() = default;

    [[nodiscard]] const std::string& identifier() const noexcept;

  private:
    Workspace(std::string identifier, std::weak_ptr<detail::Client> client);

    std::shared_ptr<const std::string> identifier_;
    std::weak_ptr<detail::Client> client_;
    friend class MemoryOS;
};

class MemoryInvestigationPackage final {
  public:
    explicit MemoryInvestigationPackage(std::vector<std::uint8_t> bytes);
    explicit MemoryInvestigationPackage(std::span<const std::byte> bytes);

    [[nodiscard]] std::span<const std::uint8_t> bytes() const noexcept;

  private:
    std::shared_ptr<const std::vector<std::uint8_t>> bytes_;
};

class VerificationResult final {
  public:
    VerificationResult(const VerificationResult&) noexcept = default;
    VerificationResult& operator=(const VerificationResult&) noexcept = default;
    VerificationResult(VerificationResult&&) noexcept = default;
    VerificationResult& operator=(VerificationResult&&) noexcept = default;
    ~VerificationResult() = default;

    [[nodiscard]] bool valid() const noexcept;
    [[nodiscard]] const std::vector<Diagnostic>& diagnostics() const noexcept;
    [[nodiscard]] const std::string& canonicalJson() const noexcept;

  private:
    struct Impl;
    explicit VerificationResult(std::shared_ptr<const Impl> impl);

    std::shared_ptr<const Impl> impl_;
    friend class MemoryOS;
    friend class Investigation;
    friend VerificationResult detail::verificationFrom(
        const detail::Json&, bool, std::string_view, const detail::Json*);
};

class RegressionReport final {
  public:
    RegressionReport(const RegressionReport&) noexcept = default;
    RegressionReport& operator=(const RegressionReport&) noexcept = default;
    RegressionReport(RegressionReport&&) noexcept = default;
    RegressionReport& operator=(RegressionReport&&) noexcept = default;
    ~RegressionReport() = default;

    [[nodiscard]] const std::string& identifier() const noexcept;
    [[nodiscard]] bool regressionDetected() const noexcept;
    [[nodiscard]] const std::string& overall() const noexcept;
    [[nodiscard]] const std::string& canonicalJson() const noexcept;

  private:
    struct Impl;
    explicit RegressionReport(std::shared_ptr<const Impl> impl);

    std::shared_ptr<const Impl> impl_;
    friend class MemoryOS;
};

class InvestigationResult final {
  public:
    InvestigationResult(const InvestigationResult&) noexcept = default;
    InvestigationResult& operator=(const InvestigationResult&) noexcept = default;
    InvestigationResult(InvestigationResult&&) noexcept = default;
    InvestigationResult& operator=(InvestigationResult&&) noexcept = default;
    ~InvestigationResult() = default;

    [[nodiscard]] const std::string& identifier() const noexcept;
    [[nodiscard]] const std::string& regressionIdentifier() const noexcept;
    [[nodiscard]] const std::string& workspaceIdentifier() const noexcept;
    [[nodiscard]] const std::string& status() const noexcept;
    [[nodiscard]] std::size_t matchCount() const noexcept;
    [[nodiscard]] const std::string& canonicalJson() const noexcept;

  private:
    struct Impl;
    explicit InvestigationResult(std::shared_ptr<const Impl> impl);

    std::shared_ptr<const Impl> impl_;
    friend class MemoryOS;
};

class Checkpoint final {
  public:
    Checkpoint(const Checkpoint&) noexcept = default;
    Checkpoint& operator=(const Checkpoint&) noexcept = default;
    Checkpoint(Checkpoint&&) noexcept = default;
    Checkpoint& operator=(Checkpoint&&) noexcept = default;
    ~Checkpoint() = default;

    [[nodiscard]] const std::string& identifier() const noexcept;
    [[nodiscard]] const std::string& investigationIdentifier() const noexcept;
    [[nodiscard]] const std::string& canonicalJson() const noexcept;

  private:
    struct Impl;
    explicit Checkpoint(std::shared_ptr<const Impl> impl);

    std::shared_ptr<const Impl> impl_;
    friend class Investigation;
    friend class MemoryOS;
};

class ReplaySession;
class ComparisonSession;

class Investigation final {
  public:
    Investigation(const Investigation&) noexcept = default;
    Investigation& operator=(const Investigation&) noexcept = default;
    Investigation(Investigation&&) noexcept = default;
    Investigation& operator=(Investigation&&) noexcept = default;
    ~Investigation() = default;

    [[nodiscard]] const std::string& identifier() const noexcept;
    [[nodiscard]] const std::string& workspaceIdentifier() const noexcept;
    [[nodiscard]] const std::string& lifecycle() const noexcept;
    [[nodiscard]] const std::string& phase() const noexcept;
    [[nodiscard]] const std::string& transitionLogDigest() const noexcept;
    [[nodiscard]] std::size_t transitionCount() const noexcept;
    [[nodiscard]] const std::string& canonicalJson() const noexcept;

    [[nodiscard]] Investigation observe(
        std::string snapshotJson,
        ObserveOptions options = {}) const;
    [[nodiscard]] Investigation trace(std::string selection) const;
    [[nodiscard]] ReplaySession replay() const;
    [[nodiscard]] ComparisonSession comparisonSession(
        std::optional<std::string> evolutionIdentifier) const;
    [[nodiscard]] ComparisonSession compare(
        const ComparisonSession& session) const;
    [[nodiscard]] VerificationResult verify() const;
    [[nodiscard]] Checkpoint checkpoint() const;
    [[nodiscard]] Investigation restore(const Checkpoint& checkpoint) const;
    [[nodiscard]] Investigation archive() const;
    [[nodiscard]] Investigation returnToWorld() const;

  private:
    struct Impl;
    explicit Investigation(std::shared_ptr<const Impl> impl);

    std::shared_ptr<const Impl> impl_;
    friend class MemoryOS;
    friend class ReplaySession;
    friend class ComparisonSession;
    friend Investigation detail::investigationFrom(
        const std::shared_ptr<detail::Client>&, const detail::Json&);
};

class ReplaySession final {
  public:
    ReplaySession(const ReplaySession&) noexcept = default;
    ReplaySession& operator=(const ReplaySession&) noexcept = default;
    ReplaySession(ReplaySession&&) noexcept = default;
    ReplaySession& operator=(ReplaySession&&) noexcept = default;
    ~ReplaySession() = default;

    [[nodiscard]] const Investigation& investigation() const noexcept;
    [[nodiscard]] ReplaySession play() const;
    [[nodiscard]] ReplaySession pause() const;
    [[nodiscard]] ReplaySession next() const;
    [[nodiscard]] ReplaySession previous() const;
    [[nodiscard]] ReplaySession restart() const;
    [[nodiscard]] ReplaySession advance() const;

  private:
    ReplaySession(Investigation investigation, std::string replayIdentifier);
    [[nodiscard]] ReplaySession command(std::string_view action) const;

    Investigation investigation_;
    std::string replay_identifier_;
    friend class Investigation;
};

class ComparisonSession final {
  public:
    ComparisonSession(const ComparisonSession&) noexcept = default;
    ComparisonSession& operator=(const ComparisonSession&) noexcept = default;
    ComparisonSession(ComparisonSession&&) noexcept = default;
    ComparisonSession& operator=(ComparisonSession&&) noexcept = default;
    ~ComparisonSession() = default;

    [[nodiscard]] const Investigation& investigation() const noexcept;
    [[nodiscard]] const std::optional<std::string>&
    evolutionIdentifier() const noexcept;
    [[nodiscard]] ComparisonSession previousObservation() const;
    [[nodiscard]] ComparisonSession nextObservation() const;
    [[nodiscard]] ComparisonSession start(
        std::string reflectionSelection) const;
    [[nodiscard]] ComparisonSession startPackage(
        std::string comparativeIdentifier) const;
    [[nodiscard]] ComparisonSession play() const;
    [[nodiscard]] ComparisonSession pause() const;
    [[nodiscard]] ComparisonSession next() const;
    [[nodiscard]] ComparisonSession previous() const;
    [[nodiscard]] ComparisonSession reset() const;
    [[nodiscard]] ComparisonSession advance() const;
    [[nodiscard]] ComparisonSession back() const;

  private:
    ComparisonSession(Investigation investigation,
                      std::optional<std::string> evolutionIdentifier,
                      bool entered = false);
    [[nodiscard]] ComparisonSession command(std::string_view action,
                                            std::string selector = {}) const;

    Investigation investigation_;
    std::optional<std::string> evolution_identifier_;
    bool entered_{false};
    friend class Investigation;
};

class PreparedPolicy final {
  public:
    PreparedPolicy(const PreparedPolicy&) noexcept = default;
    PreparedPolicy& operator=(const PreparedPolicy&) noexcept = default;
    PreparedPolicy(PreparedPolicy&&) noexcept = default;
    PreparedPolicy& operator=(PreparedPolicy&&) noexcept = default;
    ~PreparedPolicy() = default;

    [[nodiscard]] const std::string& kind() const noexcept;
    [[nodiscard]] const std::string& version() const noexcept;
    [[nodiscard]] const std::string& identifier() const noexcept;
    [[nodiscard]] const std::string& artifactJson() const noexcept;
    [[nodiscard]] const std::string& semanticProjectionJson() const noexcept;
    [[nodiscard]] const std::string& documentDigest() const noexcept;
    [[nodiscard]] const std::string& semanticDigest() const noexcept;
    [[nodiscard]] std::span<const std::uint8_t> bytes() const noexcept;

  private:
    struct Impl;
    explicit PreparedPolicy(std::shared_ptr<const Impl> impl);
    std::shared_ptr<const Impl> impl_;
    friend class MemoryOS;
};

class PolicyFactContextInspection final {
  public:
    PolicyFactContextInspection(const PolicyFactContextInspection&) noexcept = default;
    PolicyFactContextInspection& operator=(const PolicyFactContextInspection&) noexcept = default;
    PolicyFactContextInspection(PolicyFactContextInspection&&) noexcept = default;
    PolicyFactContextInspection& operator=(PolicyFactContextInspection&&) noexcept = default;
    ~PolicyFactContextInspection() = default;

    [[nodiscard]] const std::string& kind() const noexcept;
    [[nodiscard]] const std::string& version() const noexcept;
    [[nodiscard]] const std::string& factModelVersion() const noexcept;
    [[nodiscard]] const std::string& contextDigest() const noexcept;
    [[nodiscard]] const std::string& artifactJson() const noexcept;
    [[nodiscard]] std::span<const std::uint8_t> bytes() const noexcept;
    [[nodiscard]] std::string_view authority() const noexcept;

  private:
    struct Impl;
    explicit PolicyFactContextInspection(std::shared_ptr<const Impl> impl);
    std::shared_ptr<const Impl> impl_;
    friend class MemoryOS;
};

class AuthoritativePolicyFactContext final {
  public:
    AuthoritativePolicyFactContext(const AuthoritativePolicyFactContext&) noexcept = default;
    AuthoritativePolicyFactContext& operator=(const AuthoritativePolicyFactContext&) noexcept = default;
    AuthoritativePolicyFactContext(AuthoritativePolicyFactContext&&) noexcept = default;
    AuthoritativePolicyFactContext& operator=(AuthoritativePolicyFactContext&&) noexcept = default;
    ~AuthoritativePolicyFactContext() = default;

    [[nodiscard]] const std::string& kind() const noexcept;
    [[nodiscard]] const std::string& version() const noexcept;
    [[nodiscard]] const std::string& factModelVersion() const noexcept;
    [[nodiscard]] const std::string& contextDigest() const noexcept;
    [[nodiscard]] const std::string& artifactJson() const noexcept;
    [[nodiscard]] std::span<const std::uint8_t> bytes() const noexcept;
    [[nodiscard]] std::string_view authority() const noexcept;

  private:
    struct Impl;
    explicit AuthoritativePolicyFactContext(std::shared_ptr<const Impl> impl);
    std::shared_ptr<const Impl> impl_;
    friend class MemoryOS;
    friend class AuthoritativeRegressionPolicyFacts;
};

class RegressionPolicyFactSourceInspection final {
  public:
    RegressionPolicyFactSourceInspection(const RegressionPolicyFactSourceInspection&) noexcept = default;
    RegressionPolicyFactSourceInspection& operator=(const RegressionPolicyFactSourceInspection&) noexcept = default;
    RegressionPolicyFactSourceInspection(RegressionPolicyFactSourceInspection&&) noexcept = default;
    RegressionPolicyFactSourceInspection& operator=(RegressionPolicyFactSourceInspection&&) noexcept = default;
    ~RegressionPolicyFactSourceInspection() = default;

    [[nodiscard]] const std::string& kind() const noexcept;
    [[nodiscard]] const std::string& version() const noexcept;
    [[nodiscard]] const std::string& domain() const noexcept;
    [[nodiscard]] const std::string& sourceModelVersion() const noexcept;
    [[nodiscard]] const std::string& sourceDigest() const noexcept;
    [[nodiscard]] const std::string& artifactJson() const noexcept;
    [[nodiscard]] std::span<const std::uint8_t> bytes() const noexcept;
    [[nodiscard]] std::string_view authority() const noexcept;

  private:
    struct Impl;
    explicit RegressionPolicyFactSourceInspection(std::shared_ptr<const Impl> impl);
    std::shared_ptr<const Impl> impl_;
    friend class MemoryOS;
};

class AuthoritativeRegressionPolicyFactSource final {
  public:
    AuthoritativeRegressionPolicyFactSource(const AuthoritativeRegressionPolicyFactSource&) noexcept = default;
    AuthoritativeRegressionPolicyFactSource& operator=(const AuthoritativeRegressionPolicyFactSource&) noexcept = default;
    AuthoritativeRegressionPolicyFactSource(AuthoritativeRegressionPolicyFactSource&&) noexcept = default;
    AuthoritativeRegressionPolicyFactSource& operator=(AuthoritativeRegressionPolicyFactSource&&) noexcept = default;
    ~AuthoritativeRegressionPolicyFactSource() = default;

    [[nodiscard]] const std::string& kind() const noexcept;
    [[nodiscard]] const std::string& version() const noexcept;
    [[nodiscard]] const std::string& domain() const noexcept;
    [[nodiscard]] const std::string& sourceModelVersion() const noexcept;
    [[nodiscard]] const std::string& sourceDigest() const noexcept;
    [[nodiscard]] const std::string& artifactJson() const noexcept;
    [[nodiscard]] std::span<const std::uint8_t> bytes() const noexcept;
    [[nodiscard]] std::string_view authority() const noexcept;

  private:
    struct Impl;
    explicit AuthoritativeRegressionPolicyFactSource(std::shared_ptr<const Impl> impl);
    std::shared_ptr<const Impl> impl_;
    friend class MemoryOS;
    friend class AuthoritativeRegressionPolicyFacts;
};

class RegressionReportInspection final {
  public:
    RegressionReportInspection(const RegressionReportInspection&) noexcept = default;
    RegressionReportInspection& operator=(const RegressionReportInspection&) noexcept = default;
    RegressionReportInspection(RegressionReportInspection&&) noexcept = default;
    RegressionReportInspection& operator=(RegressionReportInspection&&) noexcept = default;
    ~RegressionReportInspection() = default;

    [[nodiscard]] const std::string& kind() const noexcept;
    [[nodiscard]] const std::string& version() const noexcept;
    [[nodiscard]] const std::string& reportIdentifier() const noexcept;
    [[nodiscard]] const std::string& artifactJson() const noexcept;
    [[nodiscard]] std::span<const std::uint8_t> bytes() const noexcept;
    [[nodiscard]] std::string_view authority() const noexcept;

  private:
    struct Impl;
    explicit RegressionReportInspection(std::shared_ptr<const Impl> impl);
    std::shared_ptr<const Impl> impl_;
    friend class MemoryOS;
};

class AuthoritativeRegressionPolicyFacts final {
  public:
    AuthoritativeRegressionPolicyFacts(const AuthoritativeRegressionPolicyFacts&) noexcept = default;
    AuthoritativeRegressionPolicyFacts& operator=(const AuthoritativeRegressionPolicyFacts&) noexcept = default;
    AuthoritativeRegressionPolicyFacts(AuthoritativeRegressionPolicyFacts&&) noexcept = default;
    AuthoritativeRegressionPolicyFacts& operator=(AuthoritativeRegressionPolicyFacts&&) noexcept = default;
    ~AuthoritativeRegressionPolicyFacts() = default;

    [[nodiscard]] const AuthoritativePolicyFactContext& policyFactContext() const noexcept;
    [[nodiscard]] const AuthoritativeRegressionPolicyFactSource& regressionPolicyFactSource() const noexcept;

  private:
    AuthoritativeRegressionPolicyFacts(AuthoritativePolicyFactContext context,
                                       AuthoritativeRegressionPolicyFactSource source);
    AuthoritativePolicyFactContext context_;
    AuthoritativeRegressionPolicyFactSource source_;
    friend class MemoryOS;
};

class PolicyEvaluation final {
  public:
    PolicyEvaluation(const PolicyEvaluation&) noexcept = default;
    PolicyEvaluation& operator=(const PolicyEvaluation&) noexcept = default;
    PolicyEvaluation(PolicyEvaluation&&) noexcept = default;
    PolicyEvaluation& operator=(PolicyEvaluation&&) noexcept = default;
    ~PolicyEvaluation() = default;

    [[nodiscard]] const std::string& outcomeKind() const noexcept;
    [[nodiscard]] const std::string& decision() const noexcept;
    [[nodiscard]] const std::string& evaluationIdentityJson() const noexcept;
    [[nodiscard]] const std::string& evaluationIdentityDigest() const noexcept;
    [[nodiscard]] std::span<const std::uint8_t> evaluationIdentityBytes() const noexcept;
    [[nodiscard]] const std::string& outcomeJson() const noexcept;
    [[nodiscard]] const std::string& outcomeDigest() const noexcept;
    [[nodiscard]] std::span<const std::uint8_t> canonicalOutcomeBytes() const noexcept;
    [[nodiscard]] const std::string& cacheDisposition() const noexcept;

  private:
    struct Impl;
    explicit PolicyEvaluation(std::shared_ptr<const Impl> impl);
    std::shared_ptr<const Impl> impl_;
    friend class MemoryOS;
};

class PolicyArtifactVerification final {
  public:
    PolicyArtifactVerification(const PolicyArtifactVerification&) noexcept = default;
    PolicyArtifactVerification& operator=(const PolicyArtifactVerification&) noexcept = default;
    PolicyArtifactVerification(PolicyArtifactVerification&&) noexcept = default;
    PolicyArtifactVerification& operator=(PolicyArtifactVerification&&) noexcept = default;
    ~PolicyArtifactVerification() = default;

    [[nodiscard]] const std::string& artifactKind() const noexcept;
    [[nodiscard]] const std::string& artifactVersion() const noexcept;
    [[nodiscard]] const std::string& authority() const noexcept;
    [[nodiscard]] const std::string& verificationScope() const noexcept;
    [[nodiscard]] bool verified() const noexcept;
    [[nodiscard]] std::span<const std::uint8_t> bytes() const noexcept;
    [[nodiscard]] const std::optional<std::string>& evaluationIdentityJson() const noexcept;
    [[nodiscard]] const std::optional<std::string>& evaluationIdentityDigest() const noexcept;
    [[nodiscard]] const std::optional<std::string>& outcomeJson() const noexcept;
    [[nodiscard]] const std::optional<std::string>& outcomeDigest() const noexcept;
    [[nodiscard]] const std::optional<std::string>& decision() const noexcept;

  private:
    struct Impl;
    explicit PolicyArtifactVerification(std::shared_ptr<const Impl> impl);
    std::shared_ptr<const Impl> impl_;
    friend class MemoryOS;
};

struct PolicyFactContextInspectionOptions final {
    std::optional<std::string> expectedContextDigest;
};

struct RegressionPolicyFactSourceInspectionOptions final {
    std::optional<std::string> expectedSourceDigest;
};

struct PolicyEvaluationOptions final {
    std::optional<AuthoritativeRegressionPolicyFactSource> regressionSource;
};

struct PolicyOutcomeArtifactVerificationOptions final {
    std::optional<std::vector<std::uint8_t>> expectedIdentity;
    std::optional<std::string> expectedEvaluationIdentityDigest;
    std::optional<std::string> expectedOutcomeDigest;
};

struct PolicyOutcomeEvaluationVerificationOptions final {
    std::optional<AuthoritativeRegressionPolicyFactSource> regressionSource;
    std::optional<std::string> expectedOutcomeDigest;
};

class MemoryOS final {
  public:
    MemoryOS();
    explicit MemoryOS(SdkOptions options);
    ~MemoryOS();

    MemoryOS(const MemoryOS&) = delete;
    MemoryOS& operator=(const MemoryOS&) = delete;
    MemoryOS(MemoryOS&&) noexcept;
    MemoryOS& operator=(MemoryOS&&) noexcept;

    [[nodiscard]] Workspace openWorkspace(std::string identifier) const;
    [[nodiscard]] Investigation observe(const Workspace& workspace,
                                        std::string snapshotJson,
                                        ObserveOptions options = {}) const;
    [[nodiscard]] Investigation importPackage(
        const MemoryInvestigationPackage& package,
        ImportOptions options = {}) const;
    [[nodiscard]] MemoryInvestigationPackage exportPackage(
        const Investigation& investigation,
        std::optional<std::vector<std::string>> supportedExtensions =
            std::nullopt) const;
    [[nodiscard]] VerificationResult verifyPackage(
        const MemoryInvestigationPackage& package,
        std::vector<std::string> supportedExtensions = {}) const;
    [[nodiscard]] RegressionReport regression(
        const Investigation& baseline,
        const Investigation& candidate) const;
    [[nodiscard]] InvestigationResult investigate(
        const RegressionReport& report,
        InvestigationQuery query = {}) const;
    [[nodiscard]] Investigation restore(const Checkpoint& checkpoint) const;
    [[nodiscard]] PreparedPolicy preparePolicy(
        std::span<const std::uint8_t> bytes) const;
    [[nodiscard]] PreparedPolicy preparePolicySet(
        std::span<const std::uint8_t> bytes) const;
    [[nodiscard]] PolicyFactContextInspection inspectPolicyFactContext(
        std::span<const std::uint8_t> bytes,
        PolicyFactContextInspectionOptions options = {}) const;
    [[nodiscard]] RegressionPolicyFactSourceInspection inspectRegressionPolicyFactSource(
        std::span<const std::uint8_t> bytes,
        RegressionPolicyFactSourceInspectionOptions options = {}) const;
    [[nodiscard]] RegressionReportInspection inspectRegressionReport(
        std::span<const std::uint8_t> bytes) const;
    [[nodiscard]] AuthoritativePolicyFactContext capturePolicyFactContext(
        const Investigation& investigation) const;
    [[nodiscard]] AuthoritativeRegressionPolicyFacts captureRegressionPolicyFacts(
        const Investigation& baseline,
        const Investigation& candidate) const;
    [[nodiscard]] PolicyEvaluation evaluatePolicy(
        const PreparedPolicy& policy,
        const AuthoritativePolicyFactContext& context,
        PolicyEvaluationOptions options = {}) const;
    [[nodiscard]] PolicyEvaluation evaluatePolicySet(
        const PreparedPolicy& policySet,
        const AuthoritativePolicyFactContext& context,
        PolicyEvaluationOptions options = {}) const;
    [[nodiscard]] PolicyArtifactVerification verifyEvaluationIdentityArtifact(
        std::span<const std::uint8_t> bytes,
        std::optional<std::string> expectedEvaluationIdentityDigest = std::nullopt) const;
    [[nodiscard]] PolicyArtifactVerification verifyEvaluationIdentityForEvaluation(
        std::span<const std::uint8_t> bytes,
        const PreparedPolicy& artifact,
        const AuthoritativePolicyFactContext& context,
        PolicyEvaluationOptions options = {}) const;
    [[nodiscard]] PolicyArtifactVerification verifyPolicyEvaluationOutcomeArtifact(
        std::span<const std::uint8_t> bytes,
        PolicyOutcomeArtifactVerificationOptions options = {}) const;
    [[nodiscard]] PolicyArtifactVerification verifyPolicyEvaluationOutcomeForEvaluation(
        std::span<const std::uint8_t> bytes,
        const PreparedPolicy& artifact,
        const AuthoritativePolicyFactContext& context,
        PolicyOutcomeEvaluationVerificationOptions options = {}) const;
    [[nodiscard]] std::string policyContractIdentities() const;

  private:
    [[nodiscard]] bool ownsInvestigation(
        const Investigation& investigation) const noexcept;
    std::shared_ptr<detail::Client> client_;
};

} // namespace memoryos
