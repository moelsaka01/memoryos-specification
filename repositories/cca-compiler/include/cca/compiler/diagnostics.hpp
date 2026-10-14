#pragma once

#include <cstddef>
#include <filesystem>
#include <memory>
#include <string>
#include <string_view>
#include <vector>

namespace cca::compiler {

/// Deterministic status codes retained for compatibility with IM-001 seams.
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

/// A 1-based source location. A path with line and column set to one denotes
/// the document as a whole.
struct DiagnosticLocation final {
    std::filesystem::path path;
    std::size_t line{1};
    std::size_t column{1};

    [[nodiscard]] bool operator==(const DiagnosticLocation&) const = default;
};

/// Structured, actionable diagnostic emitted by every compiler stage.
struct Diagnostic final {
    // Keep these first three fields for source compatibility with IM-001
    // aggregate-style call sites.
    DiagnosticSeverity severity{DiagnosticSeverity::note};
    std::string code;
    std::string message;
    std::string identifier;
    std::string suggestion;
    DiagnosticLocation location;
    std::string category{"general"};

    Diagnostic() = default;
    Diagnostic(DiagnosticSeverity severity, std::string code, std::string message);
    Diagnostic(std::string identifier,
               std::string code,
               DiagnosticSeverity severity,
               std::string message,
               std::string suggestion,
               DiagnosticLocation location,
               std::string category);

    [[nodiscard]] bool operator==(const Diagnostic&) const = default;
};

/// Returns the stable lowercase representation used in machine-readable output.
[[nodiscard]] std::string_view to_string(DiagnosticSeverity severity) noexcept;

/// Deterministically ordered diagnostics accumulated across compiler stages.
class ValidationResult final {
  public:
    ValidationResult() = default;
    explicit ValidationResult(std::vector<Diagnostic> diagnostics);

    void add(Diagnostic diagnostic);
    void merge(const ValidationResult& other);
    void sort();

    [[nodiscard]] const std::vector<Diagnostic>& diagnostics() const noexcept;
    [[nodiscard]] bool empty() const noexcept;
    [[nodiscard]] bool has_errors() const noexcept;
    [[nodiscard]] std::size_t error_count() const noexcept;
    [[nodiscard]] std::size_t warning_count() const noexcept;

  private:
    std::vector<Diagnostic> diagnostics_;
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
