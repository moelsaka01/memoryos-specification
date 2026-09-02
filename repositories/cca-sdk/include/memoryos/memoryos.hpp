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
class RegressionReport;
class VerificationResult;

inline constexpr std::string_view sdkVersion{"1.0.0"};

struct Diagnostic final {
    std::string code;
    std::string operation{""};
    std::string message;
    std::string canonicalJson;
};

class SdkError final : public std::runtime_error {
  public:
    SdkError(std::string code,
             std::string operation,
             std::string message,
             std::vector<Diagnostic> diagnostics);

    [[nodiscard]] const std::string& code() const noexcept;
    [[nodiscard]] const std::string& operation() const noexcept;
    [[nodiscard]] const std::vector<Diagnostic>& diagnostics() const noexcept;

  private:
    std::string code_;
    std::string operation_;
    std::vector<Diagnostic> diagnostics_;
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
    [[nodiscard]] Investigation restore(const Checkpoint& checkpoint) const;

  private:
    std::shared_ptr<detail::Client> client_;
};

// Reserved for a future query capability. MO-1204 intentionally defines no
// query behavior.
class InvestigationQuery;

} // namespace memoryos
