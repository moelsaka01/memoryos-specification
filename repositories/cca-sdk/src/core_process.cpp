#include "core_process.hpp"

#include <array>
#include <cstddef>
#include <stdexcept>
#include <string>
#include <utility>

#if defined(_WIN32)
#define NOMINMAX
#include <Windows.h>
#else
#include <cerrno>
#include <csignal>
#include <cstring>
#include <sys/types.h>
#include <sys/wait.h>
#include <unistd.h>
#endif

namespace memoryos::detail {
namespace {

constexpr std::size_t maximum_message_size = 64U * 1024U * 1024U;

[[noreturn]] void transportFailure(const std::string& message) {
    throw std::runtime_error{"MemoryOS Core transport failure: " + message};
}

#if defined(_WIN32)

class UniqueHandle final {
  public:
    UniqueHandle() noexcept = default;
    explicit UniqueHandle(HANDLE value) noexcept : value_(value) {}
    ~UniqueHandle() { reset(); }

    UniqueHandle(const UniqueHandle&) = delete;
    UniqueHandle& operator=(const UniqueHandle&) = delete;

    UniqueHandle(UniqueHandle&& other) noexcept
        : value_(std::exchange(other.value_, nullptr)) {}
    UniqueHandle& operator=(UniqueHandle&& other) noexcept {
        if (this != &other) {
            reset();
            value_ = std::exchange(other.value_, nullptr);
        }
        return *this;
    }

    [[nodiscard]] HANDLE get() const noexcept { return value_; }
    [[nodiscard]] HANDLE release() noexcept {
        return std::exchange(value_, nullptr);
    }
    void reset(HANDLE value = nullptr) noexcept {
        if (value_ != nullptr && value_ != INVALID_HANDLE_VALUE) {
            static_cast<void>(CloseHandle(value_));
        }
        value_ = value;
    }

  private:
    HANDLE value_{nullptr};
};

[[nodiscard]] std::wstring utf8ToWide(const std::string& value) {
    if (value.empty()) {
        return {};
    }
    const int size = MultiByteToWideChar(
        CP_UTF8, MB_ERR_INVALID_CHARS, value.data(),
        static_cast<int>(value.size()), nullptr, 0);
    if (size <= 0) {
        transportFailure("a process path is not valid UTF-8");
    }
    std::wstring result(static_cast<std::size_t>(size), L'\0');
    if (MultiByteToWideChar(
            CP_UTF8, MB_ERR_INVALID_CHARS, value.data(),
            static_cast<int>(value.size()), result.data(), size) != size) {
        transportFailure("a process path cannot be converted to UTF-16");
    }
    return result;
}

[[nodiscard]] std::wstring quoteWindowsArgument(std::wstring_view argument) {
    std::wstring quoted;
    quoted.push_back(L'"');
    std::size_t backslashes = 0U;
    for (const wchar_t character : argument) {
        if (character == L'\\') {
            ++backslashes;
            continue;
        }
        if (character == L'"') {
            quoted.append((backslashes * 2U) + 1U, L'\\');
            quoted.push_back(L'"');
            backslashes = 0U;
            continue;
        }
        quoted.append(backslashes, L'\\');
        backslashes = 0U;
        quoted.push_back(character);
    }
    quoted.append(backslashes * 2U, L'\\');
    quoted.push_back(L'"');
    return quoted;
}

#else

class UniqueFd final {
  public:
    UniqueFd() noexcept = default;
    explicit UniqueFd(int value) noexcept : value_(value) {}
    ~UniqueFd() { reset(); }

    UniqueFd(const UniqueFd&) = delete;
    UniqueFd& operator=(const UniqueFd&) = delete;

    UniqueFd(UniqueFd&& other) noexcept
        : value_(std::exchange(other.value_, -1)) {}
    UniqueFd& operator=(UniqueFd&& other) noexcept {
        if (this != &other) {
            reset();
            value_ = std::exchange(other.value_, -1);
        }
        return *this;
    }

    [[nodiscard]] int get() const noexcept { return value_; }
    [[nodiscard]] int release() noexcept { return std::exchange(value_, -1); }
    void reset(int value = -1) noexcept {
        if (value_ >= 0) {
            static_cast<void>(close(value_));
        }
        value_ = value;
    }

  private:
    int value_{-1};
};

#endif

} // namespace

class CoreProcess::Impl final {
  public:
#if defined(_WIN32)
    UniqueHandle process;
    UniqueHandle standard_input;
    UniqueHandle standard_output;
#else
    pid_t process{-1};
    int standard_input{-1};
    int standard_output{-1};
#endif
    std::string read_buffer;
};

CoreProcess::CoreProcess(const std::filesystem::path& nodeExecutable,
                         const std::filesystem::path& coreHost)
    : impl_(std::make_unique<Impl>()) {
    if (nodeExecutable.empty() || coreHost.empty()) {
        throw std::invalid_argument{
            "MemoryOS SDK requires a Node executable and Core host path"};
    }

#if defined(_WIN32)
    SECURITY_ATTRIBUTES security{};
    security.nLength = sizeof(security);
    security.bInheritHandle = TRUE;

    HANDLE child_output_read = nullptr;
    HANDLE child_output_write = nullptr;
    if (CreatePipe(&child_output_read, &child_output_write, &security, 0) ==
        FALSE) {
        transportFailure("cannot create the Core output pipe");
    }
    UniqueHandle output_read{child_output_read};
    UniqueHandle output_write{child_output_write};

    HANDLE child_input_read = nullptr;
    HANDLE child_input_write = nullptr;
    if (CreatePipe(&child_input_read, &child_input_write, &security, 0) ==
        FALSE) {
        transportFailure("cannot create the Core input pipe");
    }
    UniqueHandle input_read{child_input_read};
    UniqueHandle input_write{child_input_write};

    if (SetHandleInformation(output_read.get(), HANDLE_FLAG_INHERIT, 0) ==
            FALSE ||
        SetHandleInformation(input_write.get(), HANDLE_FLAG_INHERIT, 0) ==
            FALSE) {
        transportFailure("cannot isolate the parent pipe handles");
    }

    const auto nodeBytes = nodeExecutable.u8string();
    const auto hostBytes = coreHost.u8string();
    const std::string nodeText{
        reinterpret_cast<const char*>(nodeBytes.data()), nodeBytes.size()};
    const std::string hostText{
        reinterpret_cast<const char*>(hostBytes.data()), hostBytes.size()};
    const std::wstring node = utf8ToWide(nodeText);
    std::wstring command = quoteWindowsArgument(node);
    command.push_back(L' ');
    command.append(quoteWindowsArgument(utf8ToWide(hostText)));
    command.push_back(L'\0');

    STARTUPINFOW startup{};
    startup.cb = sizeof(startup);
    startup.dwFlags = STARTF_USESTDHANDLES;
    startup.hStdInput = input_read.get();
    startup.hStdOutput = output_write.get();
    startup.hStdError = GetStdHandle(STD_ERROR_HANDLE);

    PROCESS_INFORMATION process{};
    if (CreateProcessW(node.c_str(), command.data(), nullptr, nullptr, TRUE,
                       CREATE_NO_WINDOW, nullptr, nullptr, &startup,
                       &process) == FALSE) {
        transportFailure("cannot start the private Core host");
    }
    UniqueHandle thread{process.hThread};
    impl_->process.reset(process.hProcess);
    impl_->standard_input.reset(input_write.release());
    impl_->standard_output.reset(output_read.release());
#else
    int child_input[2]{};
    if (pipe(child_input) != 0) {
        transportFailure(std::string{"cannot create Core pipes: "} +
                         std::strerror(errno));
    }
    UniqueFd input_read{child_input[0]};
    UniqueFd input_write{child_input[1]};

    int child_output[2]{};
    if (pipe(child_output) != 0) {
        transportFailure(std::string{"cannot create Core pipes: "} +
                         std::strerror(errno));
    }
    UniqueFd output_read{child_output[0]};
    UniqueFd output_write{child_output[1]};

    const pid_t child = fork();
    if (child < 0) {
        transportFailure(std::string{"cannot fork the Core host: "} +
                         std::strerror(errno));
    }
    if (child == 0) {
        if (dup2(input_read.get(), STDIN_FILENO) < 0 ||
            dup2(output_write.get(), STDOUT_FILENO) < 0) {
            _exit(126);
        }
        input_read.reset();
        input_write.reset();
        output_read.reset();
        output_write.reset();
        const std::string node = nodeExecutable.string();
        const std::string host = coreHost.string();
        execl(node.c_str(), node.c_str(), host.c_str(),
              static_cast<char*>(nullptr));
        _exit(127);
    }
    input_read.reset();
    output_write.reset();
    impl_->process = child;
    impl_->standard_input = input_write.release();
    impl_->standard_output = output_read.release();
#endif
}

CoreProcess::~CoreProcess() {
    if (impl_ == nullptr) {
        return;
    }
#if defined(_WIN32)
    impl_->standard_input.reset();
    if (impl_->process.get() != nullptr) {
        const DWORD result = WaitForSingleObject(impl_->process.get(), 5000U);
        if (result == WAIT_TIMEOUT) {
            static_cast<void>(TerminateProcess(impl_->process.get(), 1U));
            static_cast<void>(WaitForSingleObject(impl_->process.get(), 1000U));
        }
    }
#else
    if (impl_->standard_input >= 0) {
        static_cast<void>(close(impl_->standard_input));
        impl_->standard_input = -1;
    }
    if (impl_->process > 0) {
        int status = 0;
        while (waitpid(impl_->process, &status, 0) < 0 && errno == EINTR) {
        }
    }
    if (impl_->standard_output >= 0) {
        static_cast<void>(close(impl_->standard_output));
        impl_->standard_output = -1;
    }
#endif
}

void CoreProcess::writeLine(const std::string& line) {
    if (line.size() > maximum_message_size ||
        line.find('\n') != std::string::npos ||
        line.find('\r') != std::string::npos) {
        throw std::length_error{"MemoryOS Core request violates JSONL limits"};
    }
    std::string framed = line;
    framed.push_back('\n');
    std::size_t written = 0U;
    while (written < framed.size()) {
#if defined(_WIN32)
        DWORD count = 0U;
        const auto remaining = framed.size() - written;
        const DWORD chunk = static_cast<DWORD>(
            (remaining > static_cast<std::size_t>(MAXDWORD))
                ? static_cast<std::size_t>(MAXDWORD)
                : remaining);
        if (WriteFile(impl_->standard_input.get(), framed.data() + written,
                      chunk, &count, nullptr) == FALSE || count == 0U) {
            transportFailure("cannot write a request");
        }
        written += static_cast<std::size_t>(count);
#else
        const ssize_t count = write(impl_->standard_input,
                                    framed.data() + written,
                                    framed.size() - written);
        if (count < 0 && errno == EINTR) {
            continue;
        }
        if (count <= 0) {
            transportFailure("cannot write a request");
        }
        written += static_cast<std::size_t>(count);
#endif
    }
}

std::string CoreProcess::readLine() {
    while (true) {
        const auto newline = impl_->read_buffer.find('\n');
        if (newline != std::string::npos) {
            if (newline > maximum_message_size) {
                throw std::length_error{
                    "MemoryOS Core response exceeds JSONL limits"};
            }
            std::string line = impl_->read_buffer.substr(0U, newline);
            impl_->read_buffer.erase(0U, newline + 1U);
            if (!line.empty() && line.back() == '\r') {
                line.pop_back();
            }
            return line;
        }
        if (impl_->read_buffer.size() > maximum_message_size) {
            throw std::length_error{"MemoryOS Core response exceeds JSONL limits"};
        }
        std::array<char, 8192U> buffer{};
#if defined(_WIN32)
        DWORD count = 0U;
        if (ReadFile(impl_->standard_output.get(), buffer.data(),
                     static_cast<DWORD>(buffer.size()), &count, nullptr) ==
                FALSE ||
            count == 0U) {
            transportFailure("the Core host closed its output unexpectedly");
        }
        impl_->read_buffer.append(buffer.data(),
                                  static_cast<std::size_t>(count));
#else
        const ssize_t count =
            read(impl_->standard_output, buffer.data(), buffer.size());
        if (count < 0 && errno == EINTR) {
            continue;
        }
        if (count <= 0) {
            transportFailure("the Core host closed its output unexpectedly");
        }
        impl_->read_buffer.append(buffer.data(),
                                  static_cast<std::size_t>(count));
#endif
    }
}

} // namespace memoryos::detail
