#include "cca/compiler/diagnostics.hpp"

#include <algorithm>
#include <mutex>
#include <tuple>
#include <utility>

namespace cca::compiler {
namespace {

[[nodiscard]] auto diagnostic_key(const Diagnostic& diagnostic) {
    return std::tuple{diagnostic.location.path.generic_string(),
                      diagnostic.location.line,
                      diagnostic.location.column,
                      diagnostic.code,
                      diagnostic.message,
                      diagnostic.identifier};
}

} // namespace

Status::Status(const StatusCode code, std::string message)
    : code_{code}, message_{std::move(message)} {}

Status Status::success() {
    return Status{StatusCode::success, {}};
}

Status Status::invalid_argument(std::string message) {
    return Status{StatusCode::invalid_argument, std::move(message)};
}

Status Status::not_implemented(std::string message) {
    return Status{StatusCode::not_implemented, std::move(message)};
}

Status Status::internal_error(std::string message) {
    return Status{StatusCode::internal_error, std::move(message)};
}

StatusCode Status::code() const noexcept {
    return code_;
}

const std::string& Status::message() const noexcept {
    return message_;
}

bool Status::ok() const noexcept {
    return code_ == StatusCode::success;
}

Diagnostic::Diagnostic(const DiagnosticSeverity severity_value,
                       std::string code_value,
                       std::string message_value)
    : severity{severity_value}, code{std::move(code_value)}, message{std::move(message_value)},
      identifier{code} {}

Diagnostic::Diagnostic(std::string identifier_value,
                       std::string code_value,
                       const DiagnosticSeverity severity_value,
                       std::string message_value,
                       std::string suggestion_value,
                       DiagnosticLocation location_value,
                       std::string category_value)
    : severity{severity_value}, code{std::move(code_value)}, message{std::move(message_value)},
      identifier{std::move(identifier_value)}, suggestion{std::move(suggestion_value)},
      location{std::move(location_value)}, category{std::move(category_value)} {}

std::string_view to_string(const DiagnosticSeverity severity) noexcept {
    switch (severity) {
    case DiagnosticSeverity::note:
        return "note";
    case DiagnosticSeverity::warning:
        return "warning";
    case DiagnosticSeverity::error:
        return "error";
    }
    return "error";
}

ValidationResult::ValidationResult(std::vector<Diagnostic> diagnostics)
    : diagnostics_{std::move(diagnostics)} {
    sort();
}

void ValidationResult::add(Diagnostic diagnostic) {
    diagnostics_.push_back(std::move(diagnostic));
    sort();
}

void ValidationResult::merge(const ValidationResult& other) {
    diagnostics_.insert(diagnostics_.end(), other.diagnostics_.begin(), other.diagnostics_.end());
    sort();
}

void ValidationResult::sort() {
    std::stable_sort(
        diagnostics_.begin(), diagnostics_.end(), [](const auto& lhs, const auto& rhs) {
            return diagnostic_key(lhs) < diagnostic_key(rhs);
        });
}

const std::vector<Diagnostic>& ValidationResult::diagnostics() const noexcept {
    return diagnostics_;
}

bool ValidationResult::empty() const noexcept {
    return diagnostics_.empty();
}

bool ValidationResult::has_errors() const noexcept {
    return error_count() != 0;
}

std::size_t ValidationResult::error_count() const noexcept {
    return static_cast<std::size_t>(
        std::count_if(diagnostics_.begin(), diagnostics_.end(), [](const auto& diagnostic) {
            return diagnostic.severity == DiagnosticSeverity::error;
        }));
}

std::size_t ValidationResult::warning_count() const noexcept {
    return static_cast<std::size_t>(
        std::count_if(diagnostics_.begin(), diagnostics_.end(), [](const auto& diagnostic) {
            return diagnostic.severity == DiagnosticSeverity::warning;
        }));
}

void NullDiagnosticSink::report(Diagnostic diagnostic) {
    static_cast<void>(diagnostic);
}

class CollectingDiagnosticSink::Impl final {
  public:
    void report(Diagnostic diagnostic) {
        const std::scoped_lock lock{mutex_};
        diagnostics_.push_back(std::move(diagnostic));
    }

    [[nodiscard]] std::vector<Diagnostic> snapshot() const {
        const std::scoped_lock lock{mutex_};
        auto result = diagnostics_;
        std::stable_sort(result.begin(), result.end(), [](const auto& lhs, const auto& rhs) {
            return diagnostic_key(lhs) < diagnostic_key(rhs);
        });
        return result;
    }

    void clear() {
        const std::scoped_lock lock{mutex_};
        diagnostics_.clear();
    }

  private:
    mutable std::mutex mutex_;
    std::vector<Diagnostic> diagnostics_;
};

CollectingDiagnosticSink::CollectingDiagnosticSink() : impl_{std::make_unique<Impl>()} {}

CollectingDiagnosticSink::~CollectingDiagnosticSink() = default;

void CollectingDiagnosticSink::report(Diagnostic diagnostic) {
    impl_->report(std::move(diagnostic));
}

std::vector<Diagnostic> CollectingDiagnosticSink::snapshot() const {
    return impl_->snapshot();
}

void CollectingDiagnosticSink::clear() {
    impl_->clear();
}

} // namespace cca::compiler
