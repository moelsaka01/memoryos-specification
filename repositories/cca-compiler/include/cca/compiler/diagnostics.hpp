#pragma once

#include <memory>
#include <string>
#include <vector>

namespace cca::compiler {

/// Deterministic foundation-release outcome codes.
enum class StatusCode : int {
    success = 0,
    invalid_argument = 2,
    not_implemented = 69,
    internal_error = 70,
};

/// An immutable operation outcome with a stable code and human-readable detail.
class Status final {
  public:
    [[nodiscard]] static Status success();
    [[nodiscard]] static Status invalid_argument(std::string message);
    [[nodiscard]] static Status not_implemented(std::string message);
    [[nodiscard]] static Status internal_error(std::string message);

    [[nodiscard]] StatusCode code() const noexcept;
    [[nodiscard]] const std::string& message() const noexcept;
    [[nodiscard]] bool ok() const noexcept;

  private:
    Status(StatusCode code, std::string message);

    StatusCode code_;
    std::string message_;
};

/// Severity assigned to a structured compiler diagnostic.
enum class DiagnosticSeverity {
    note,
    warning,
    error,
};

/// Structured diagnostic emitted through an injected sink.
struct Diagnostic final {
    DiagnosticSeverity severity{DiagnosticSeverity::note};
    std::string code;
    std::string message;

    [[nodiscard]] bool operator==(const Diagnostic&) const = default;
};

/// Receives diagnostics without imposing storage or presentation policy.
class IDiagnosticSink {
  public:
    virtual ~IDiagnosticSink() = default;

    virtual void report(Diagnostic diagnostic) = 0;
};

/// Diagnostic sink that intentionally discards all diagnostics.
class NullDiagnosticSink final : public IDiagnosticSink {
  public:
    void report(Diagnostic diagnostic) override;
};

/// Thread-safe in-memory diagnostic sink for tools and tests.
class CollectingDiagnosticSink final : public IDiagnosticSink {
  public:
    CollectingDiagnosticSink();
    ~CollectingDiagnosticSink() override;

    CollectingDiagnosticSink(const CollectingDiagnosticSink&) = delete;
    CollectingDiagnosticSink& operator=(const CollectingDiagnosticSink&) = delete;
    CollectingDiagnosticSink(CollectingDiagnosticSink&&) = delete;
    CollectingDiagnosticSink& operator=(CollectingDiagnosticSink&&) = delete;

    void report(Diagnostic diagnostic) override;
    [[nodiscard]] std::vector<Diagnostic> snapshot() const;
    void clear();

  private:
    class Impl;
    std::unique_ptr<Impl> impl_;
};

} // namespace cca::compiler
