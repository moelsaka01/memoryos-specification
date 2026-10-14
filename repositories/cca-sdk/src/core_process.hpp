#pragma once

#include <filesystem>
#include <memory>
#include <string>

namespace memoryos::detail {

class CoreProcess final {
  public:
    CoreProcess(const std::filesystem::path& nodeExecutable,
                const std::filesystem::path& coreHost);
    ~CoreProcess();

    CoreProcess(const CoreProcess&) = delete;
    CoreProcess& operator=(const CoreProcess&) = delete;

    void writeLine(const std::string& line);
    [[nodiscard]] std::string readLine();

  private:
    class Impl;
    std::unique_ptr<Impl> impl_;
};

} // namespace memoryos::detail
