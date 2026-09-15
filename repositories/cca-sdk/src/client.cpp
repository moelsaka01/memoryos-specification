#include "client.hpp"

#include "core_process.hpp"

#include <limits>
#include <stdexcept>
#include <utility>

namespace memoryos::detail {
namespace {

constexpr std::string_view protocol_version{"1.0.0"};
constexpr std::uint64_t maximum_safe_integer = 9'007'199'254'740'991ULL;

[[nodiscard]] std::string optionalString(const Json& value,
                                         std::string_view name) {
    const Json* member = value.find(name);
    return member != nullptr && member->isString() ? member->asString()
                                                   : std::string{};
}

[[nodiscard]] std::vector<Diagnostic> diagnosticsFrom(const Json& value) {
    std::vector<Diagnostic> diagnostics;
    const Json* entries = value.find("diagnostics");
    if (entries == nullptr || !entries->isArray()) {
        return diagnostics;
    }
    diagnostics.reserve(entries->asArray().size());
    for (const auto& entry : entries->asArray()) {
        if (!entry.isObject()) {
            continue;
        }
        diagnostics.push_back(Diagnostic{
            optionalString(entry, "code"),
            optionalString(entry, "operation"),
            optionalString(entry, "message"),
            entry.serialize(),
        });
    }
    return diagnostics;
}

[[noreturn]] void protocolFailure(std::string message) {
    throw SdkError{"SDK_PROTOCOL_ERROR", "transport", std::move(message), {}};
}

[[nodiscard]] const std::string* replayIdentifierFrom(const Json& result) {
    const Json* investigation = result.find("investigation");
    if (investigation == nullptr || !investigation->isObject()) {
        protocolFailure("The Core host omitted an Investigation projection.");
    }
    const Json* replay = investigation->find("replay");
    if (replay == nullptr || replay->isNull()) {
        return nullptr;
    }
    if (!replay->isObject()) {
        protocolFailure("The Core host returned an invalid Replay projection.");
    }
    const Json* identifier = replay->find("identifier");
    if (identifier == nullptr || !identifier->isString() ||
        identifier->asString().empty()) {
        protocolFailure("The Core host omitted the active Replay identifier.");
    }
    return &identifier->asString();
}

} // namespace

Client::Client(SdkOptions options)
    : process_(std::make_unique<CoreProcess>(options.nodeExecutable,
                                             options.coreHost)) {
    const Json health = invoke("health", {});
    const Json* protocol = health.find("protocolVersion");
    const Json* core = health.find("investigationCoreVersion");
    if (protocol == nullptr || !protocol->isString() ||
        protocol->asString() != protocol_version || core == nullptr ||
        !core->isString() || core->asString() != "1.0.0") {
        protocolFailure(
            "The private host does not expose the required Core protocol.");
    }
}

Client::~Client() = default;

Json Client::invoke(std::string_view method, Json::Object params) {
    std::scoped_lock lock{mutex_};
    return invokeUnlocked(method, std::move(params));
}

Json Client::invokeReplay(std::string_view investigationIdentifier,
                          std::string_view replayIdentifier,
                          std::string_view action) {
    std::scoped_lock lock{mutex_};
    Json::Object loadParams{
        {"investigationIdentifier", Json{investigationIdentifier}},
    };
    const Json current = invokeUnlocked("load", std::move(loadParams));
    const std::string* active = replayIdentifierFrom(current);
    if (active == nullptr || *active != replayIdentifier) {
        throw SdkError{
            "SESSION_MISMATCH",
            "replay",
            "ReplaySession no longer identifies the active deterministic Replay.",
            {},
        };
    }
    Json::Object commandParams{
        {"action", Json{action}},
        {"investigationIdentifier", Json{investigationIdentifier}},
    };
    return invokeUnlocked("replay", std::move(commandParams));
}

Json Client::invokeUnlocked(std::string_view method, Json::Object params) {
    if (next_request_id_ > maximum_safe_integer) {
        throw SdkError{"SDK_RESOURCE_LIMIT", "transport",
                       "The SDK request sequence exhausted its safe range.", {}};
    }
    const std::uint64_t requestId = next_request_id_++;
    Json::Object request{
        {"id", Json{static_cast<std::int64_t>(requestId)}},
        {"method", Json{method}},
        {"params", Json{std::move(params)}},
        {"version", Json{protocol_version}},
    };

    std::string responseLine;
    try {
        process_->writeLine(Json{std::move(request)}.serialize());
        responseLine = process_->readLine();
    } catch (const SdkError&) {
        throw;
    } catch (const std::exception& error) {
        throw SdkError{"SDK_TRANSPORT_ERROR", "transport", error.what(), {}};
    }

    Json response;
    try {
        response = Json::parse(responseLine);
    } catch (const std::exception&) {
        protocolFailure("The Core host returned invalid JSON.");
    }
    const Json* responseVersion = response.find("version");
    const Json* responseId = response.find("id");
    const Json* responseOk = response.find("ok");
    if (!response.isObject() || responseVersion == nullptr ||
        !responseVersion->isString() ||
        responseVersion->asString() != protocol_version ||
        responseId == nullptr || !responseId->isInteger() ||
        responseId->asInteger() != static_cast<std::int64_t>(requestId) ||
        responseOk == nullptr || !responseOk->isBool()) {
        protocolFailure("The Core host returned an invalid response envelope.");
    }
    if (responseOk->asBool()) {
        const Json* result = response.find("result");
        if (result == nullptr) {
            protocolFailure("The Core host omitted a successful result.");
        }
        return *result;
    }

    const Json* error = response.find("error");
    if (error == nullptr || !error->isObject()) {
        protocolFailure("The Core host omitted a failure diagnostic.");
    }
    const std::string code = optionalString(*error, "code");
    const std::string operation = optionalString(*error, "operation");
    const std::string message = optionalString(*error, "message");
    throw SdkError{
        code.empty() ? "SDK_PROTOCOL_ERROR" : code,
        operation.empty() ? std::string{method} : operation,
        message.empty() ? "The Investigation Core rejected the request."
                        : message,
        diagnosticsFrom(*error),
        optionalString(*error, "phase"),
        optionalString(*error, "artifactKind"),
        optionalString(*error, "limitIdentifier"),
        optionalString(*error, "failureClass"),
        error->find("verificationFailure") != nullptr &&
            error->find("verificationFailure")->isBool() &&
            error->find("verificationFailure")->asBool(),
    };
}

} // namespace memoryos::detail
