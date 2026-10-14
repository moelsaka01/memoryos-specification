#pragma once

#include <compare>
#include <string>

namespace cca::runtime {

/// Stable identity for one Runtime instance.
///
/// A RuntimeId is supplied explicitly by the caller or by a RuntimeHost-local
/// allocation policy. It owns its text and rejects an empty value. Comparison is
/// lexical and deterministic. Immutable RuntimeId values are safe for concurrent
/// reads. This implementation does not define a cross-process identity format.
class RuntimeId final {
  public:
    explicit RuntimeId(std::string value);

    [[nodiscard]] const std::string& value() const noexcept;

    auto operator<=>(const RuntimeId&) const noexcept = default;

  private:
    std::string value_;
};

} // namespace cca::runtime
