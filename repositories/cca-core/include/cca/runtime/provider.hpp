#pragma once

#include <cca/runtime/runtime_result.hpp>

#include <compare>
#include <concepts>
#include <cstddef>
#include <type_traits>

namespace cca::runtime {

class RuntimeContext;

/// The three provider cardinalities approved by CCA-RF-1.0.
enum class ServiceCardinality {
    exactly_one,
    zero_or_one,
    one_or_more,
};

/// Compile-time identity and provider cardinality for a Service Contract.
///
/// Contract is the consumer-visible interface. Provider implementation types are
/// registered separately and remain internal to Runtime composition.
template <typename Contract, ServiceCardinality Cardinality> struct ServiceContract final {
    using interface_type = Contract;
    static constexpr ServiceCardinality cardinality = Cardinality;
};

/// Identifies one provider registration within one Runtime instance.
///
/// Values are assigned in deterministic registration order. They have no meaning
/// outside their owning Runtime and are not a cross-instance lookup mechanism.
class ProviderId final {
  public:
    explicit constexpr ProviderId(const std::size_t value) noexcept : value_(value) {}

    [[nodiscard]] constexpr std::size_t value() const noexcept {
        return value_;
    }

    auto operator<=>(const ProviderId&) const noexcept = default;

  private:
    std::size_t value_;
};

/// Consumer-implemented lifecycle boundary for an internal service Provider.
///
/// The Runtime owns every Provider. start() and stop() receive a non-owning
/// RuntimeContext that is valid only for the call and for the containing Runtime
/// lifetime. Implementations return explicit failures and must use constructor
/// injection for required Service Contract collaboration. Concurrent start calls
/// occur only for distinct Providers in one dependency level when enabled.
class ServiceProvider {
  public:
    virtual ~ServiceProvider() = default;

    [[nodiscard]] virtual RuntimeResult start(RuntimeContext& context) = 0;
    [[nodiscard]] virtual RuntimeResult stop(RuntimeContext& context) = 0;

  protected:
    ServiceProvider() = default;
    ServiceProvider(const ServiceProvider&) = default;
    ServiceProvider& operator=(const ServiceProvider&) = default;
    ServiceProvider(ServiceProvider&&) = default;
    ServiceProvider& operator=(ServiceProvider&&) = default;
};

template <typename Candidate>
concept ServiceContractType =
    requires {
        typename Candidate::interface_type;
        { Candidate::cardinality } -> std::convertible_to<ServiceCardinality>;
    } && std::is_class_v<typename Candidate::interface_type> &&
    !std::is_const_v<typename Candidate::interface_type> &&
    !std::is_volatile_v<typename Candidate::interface_type>;

} // namespace cca::runtime
