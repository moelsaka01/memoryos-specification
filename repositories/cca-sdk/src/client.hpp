#pragma once

#include "json.hpp"

#include <memoryos/memoryos.hpp>

#include <cstdint>
#include <memory>
#include <mutex>
#include <string>
#include <string_view>

namespace memoryos::detail {

class CoreProcess;

class Client final {
  public:
    explicit Client(SdkOptions options);
    ~Client();

    Client(const Client&) = delete;
    Client& operator=(const Client&) = delete;

    [[nodiscard]] Json invoke(std::string_view method, Json::Object params);
    [[nodiscard]] Json invokeReplay(
        std::string_view investigationIdentifier,
        std::string_view replayIdentifier,
        std::string_view action);

  private:
    [[nodiscard]] Json invokeUnlocked(std::string_view method,
                                      Json::Object params);

    std::mutex mutex_;
    std::unique_ptr<CoreProcess> process_;
    std::uint64_t next_request_id_{0U};
};

} // namespace memoryos::detail
