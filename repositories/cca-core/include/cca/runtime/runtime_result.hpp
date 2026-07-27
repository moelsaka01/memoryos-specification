#pragma once

#include <string>

namespace cca::runtime {

/// Explicit outcome returned by Runtime Foundation operations.
///
/// Success carries no diagnostic. Failure owns a stable code and human-readable
/// message. The code, rather than exact message prose, is the machine-facing
/// discriminator. Values have no I/O, global state, or synchronization needs and
/// are safe for concurrent reads.
class RuntimeResult final {
  public:
    [[nodiscard]] static RuntimeResult success();
    [[nodiscard]] static RuntimeResult failure(std::string code, std::string message);

    [[nodiscard]] bool ok() const noexcept;
    [[nodiscard]] explicit operator bool() const noexcept;
    [[nodiscard]] const std::string& code() const noexcept;
    [[nodiscard]] const std::string& message() const noexcept;

  private:
    RuntimeResult(bool ok, std::string code, std::string message);

    bool ok_;
    std::string code_;
    std::string message_;
};

} // namespace cca::runtime
