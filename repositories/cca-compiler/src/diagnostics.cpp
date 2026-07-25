#include "cca/compiler/diagnostics.hpp"

#include <mutex>
#include <utility>

namespace cca::compiler {

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
        return diagnostics_;
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
