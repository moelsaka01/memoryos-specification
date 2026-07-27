#pragma once

#include <cca/runtime/runtime_builder.hpp>
#include <cca/runtime/runtime_id.hpp>
#include <cca/runtime/runtime_result.hpp>

#include <map>
#include <memory>
#include <mutex>
#include <vector>

namespace cca::runtime {

class Runtime;

/// Headless owner and composition boundary for multiple Runtime instances.
///
/// RuntimeHost is the C++ host API behind the `cca-runtime` executable. It is
/// not a Runtime Foundation component and is never a singleton. Each host owns
/// an instance map and permits lifecycle operations on different instances
/// without shared Runtime state. Map operations are synchronized. A pointer
/// returned by find() is non-owning and must not race with destroy() for the same
/// RuntimeId.
class RuntimeHost final {
  public:
    RuntimeHost() = default;
    ~RuntimeHost();

    RuntimeHost(const RuntimeHost&) = delete;
    RuntimeHost& operator=(const RuntimeHost&) = delete;
    RuntimeHost(RuntimeHost&&) = delete;
    RuntimeHost& operator=(RuntimeHost&&) = delete;

    [[nodiscard]] RuntimeResult create(RuntimeBuilder builder);
    [[nodiscard]] RuntimeResult start(const RuntimeId& runtime_id);
    [[nodiscard]] RuntimeResult stop(const RuntimeId& runtime_id);
    [[nodiscard]] RuntimeResult destroy(const RuntimeId& runtime_id);

    [[nodiscard]] Runtime* find(const RuntimeId& runtime_id);
    [[nodiscard]] const Runtime* find(const RuntimeId& runtime_id) const;
    [[nodiscard]] std::vector<RuntimeId> runtime_ids() const;
    [[nodiscard]] std::size_t size() const;

  private:
    [[nodiscard]] std::shared_ptr<Runtime> acquire(const RuntimeId& runtime_id) const;

    mutable std::mutex mutex_;
    std::map<RuntimeId, std::shared_ptr<Runtime>> runtimes_;
};

} // namespace cca::runtime
