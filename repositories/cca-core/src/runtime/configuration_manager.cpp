#include <cca/runtime/configuration_manager.hpp>

#include <utility>

namespace cca::runtime {

RuntimeResult ConfigurationManager::configure(core::Configuration configuration) {
    auto replacement = std::make_shared<const core::Configuration>(std::move(configuration));

    const std::scoped_lock lock{mutex_};
    if (frozen_) {
        return RuntimeResult::failure("configuration.frozen",
                                      "configuration cannot be replaced after Runtime Freeze");
    }

    configuration_ = std::move(replacement);
    return RuntimeResult::success();
}

RuntimeResult ConfigurationManager::validate() const {
    const std::scoped_lock lock{mutex_};
    if (!configuration_) {
        return RuntimeResult::failure("configuration.missing",
                                      "a configuration snapshot has not been supplied");
    }
    return RuntimeResult::success();
}

RuntimeResult ConfigurationManager::freeze() {
    const std::scoped_lock lock{mutex_};
    if (!configuration_) {
        return RuntimeResult::failure("configuration.missing",
                                      "configuration must be validated before Runtime Freeze");
    }

    frozen_ = true;
    return RuntimeResult::success();
}

bool ConfigurationManager::configured() const {
    const std::scoped_lock lock{mutex_};
    return configuration_ != nullptr;
}

bool ConfigurationManager::frozen() const {
    const std::scoped_lock lock{mutex_};
    return frozen_;
}

std::shared_ptr<const core::Configuration> ConfigurationManager::snapshot() const {
    const std::scoped_lock lock{mutex_};
    return configuration_;
}

} // namespace cca::runtime
