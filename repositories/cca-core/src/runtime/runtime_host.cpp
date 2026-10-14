#include <cca/runtime/runtime.hpp>
#include <cca/runtime/runtime_host.hpp>

#include <utility>

namespace cca::runtime {
namespace {

[[nodiscard]] RuntimeResult unknown_runtime() {
    return RuntimeResult::failure("CCA-RUNTIME-HOST-UNKNOWN", "RuntimeHost does not own that id.");
}

} // namespace

RuntimeHost::~RuntimeHost() {
    std::vector<std::shared_ptr<Runtime>> instances;
    {
        const std::scoped_lock lock{mutex_};
        instances.reserve(runtimes_.size());
        for (const auto& [runtime_id, runtime] : runtimes_) {
            static_cast<void>(runtime_id);
            instances.push_back(runtime);
        }
        runtimes_.clear();
    }

    for (const auto& runtime : instances) {
        if (runtime->state() == RuntimeState::running) {
            static_cast<void>(runtime->stop());
        }
    }
}

RuntimeResult RuntimeHost::create(RuntimeBuilder builder) {
    const RuntimeId runtime_id = builder.runtime_id();
    auto runtime = std::shared_ptr<Runtime>{std::move(builder).build()};

    const std::scoped_lock lock{mutex_};
    if (runtimes_.contains(runtime_id)) {
        return RuntimeResult::failure("CCA-RUNTIME-HOST-DUPLICATE",
                                      "RuntimeHost already owns that RuntimeId.");
    }
    runtimes_.emplace(runtime_id, std::move(runtime));
    return RuntimeResult::success();
}

RuntimeResult RuntimeHost::start(const RuntimeId& runtime_id) {
    const auto runtime = acquire(runtime_id);
    return runtime == nullptr ? unknown_runtime() : runtime->start();
}

RuntimeResult RuntimeHost::stop(const RuntimeId& runtime_id) {
    const auto runtime = acquire(runtime_id);
    return runtime == nullptr ? unknown_runtime() : runtime->stop();
}

RuntimeResult RuntimeHost::destroy(const RuntimeId& runtime_id) {
    const auto runtime = acquire(runtime_id);
    if (runtime == nullptr) {
        return unknown_runtime();
    }

    if (runtime->state() == RuntimeState::running) {
        const auto stop_result = runtime->stop();
        if (!stop_result) {
            return stop_result;
        }
    }
    if (runtime->state() != RuntimeState::destroyed) {
        return RuntimeResult::failure(
            "CCA-RUNTIME-HOST-NOT-DESTROYED",
            "Runtime must complete normal shutdown or rollback before host removal.");
    }

    const std::scoped_lock lock{mutex_};
    const auto iterator = runtimes_.find(runtime_id);
    if (iterator != runtimes_.end() && iterator->second == runtime) {
        runtimes_.erase(iterator);
    }
    return RuntimeResult::success();
}

Runtime* RuntimeHost::find(const RuntimeId& runtime_id) {
    const auto runtime = acquire(runtime_id);
    return runtime.get();
}

const Runtime* RuntimeHost::find(const RuntimeId& runtime_id) const {
    const auto runtime = acquire(runtime_id);
    return runtime.get();
}

std::vector<RuntimeId> RuntimeHost::runtime_ids() const {
    const std::scoped_lock lock{mutex_};
    std::vector<RuntimeId> ids;
    ids.reserve(runtimes_.size());
    for (const auto& [runtime_id, runtime] : runtimes_) {
        static_cast<void>(runtime);
        ids.push_back(runtime_id);
    }
    return ids;
}

std::size_t RuntimeHost::size() const {
    const std::scoped_lock lock{mutex_};
    return runtimes_.size();
}

std::shared_ptr<Runtime> RuntimeHost::acquire(const RuntimeId& runtime_id) const {
    const std::scoped_lock lock{mutex_};
    const auto iterator = runtimes_.find(runtime_id);
    return iterator == runtimes_.end() ? nullptr : iterator->second;
}

} // namespace cca::runtime
