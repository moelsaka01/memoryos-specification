#include <memoryos/memoryos.hpp>

#include "client.hpp"
#include "json.hpp"

#include <algorithm>
#include <array>
#include <cstdlib>
#include <iterator>
#include <limits>
#include <utility>

#ifndef MEMORYOS_SDK_DEFAULT_NODE_EXECUTABLE
#define MEMORYOS_SDK_DEFAULT_NODE_EXECUTABLE "node"
#endif

#ifndef MEMORYOS_SDK_DEFAULT_CORE_HOST
#define MEMORYOS_SDK_DEFAULT_CORE_HOST ""
#endif

#ifndef MEMORYOS_SDK_INSTALL_CORE_HOST
#define MEMORYOS_SDK_INSTALL_CORE_HOST ""
#endif

namespace memoryos {
namespace {

using detail::Json;

[[noreturn]] void invalidArgument(std::string message) {
    throw SdkError{"INVALID_INPUT", "sdk", std::move(message), {}};
}

[[noreturn]] void invalidProtocol(std::string message) {
    throw SdkError{"SDK_PROTOCOL_ERROR", "transport", std::move(message), {}};
}

[[noreturn]] void replayUnavailable() {
    throw SdkError{
        "INVALID_TRANSITION", "replay", "Replay is not prepared.", {}};
}

[[noreturn]] void replaySessionMismatch() {
    throw SdkError{
        "SESSION_MISMATCH",
        "replay",
        "ReplaySession no longer identifies the active deterministic Replay.",
        {},
    };
}

[[nodiscard]] const std::string& requiredString(const Json& value,
                                                std::string_view name) {
    const Json* member = value.find(name);
    if (member == nullptr || !member->isString()) {
        invalidProtocol("The Core host result omitted string member '" +
                        std::string{name} + "'.");
    }
    return member->asString();
}

[[nodiscard]] std::size_t requiredSize(const Json& value,
                                       std::string_view name) {
    const Json* member = value.find(name);
    if (member == nullptr || !member->isInteger() ||
        member->asInteger() < 0) {
        invalidProtocol("The Core host result omitted count member '" +
                        std::string{name} + "'.");
    }
    const auto count = static_cast<std::uint64_t>(member->asInteger());
    if (count > static_cast<std::uint64_t>(
                    std::numeric_limits<std::size_t>::max())) {
        invalidProtocol("The Core host returned an unrepresentable count.");
    }
    return static_cast<std::size_t>(count);
}

[[nodiscard]] bool requiredBool(const Json& value, std::string_view name) {
    const Json* member = value.find(name);
    if (member == nullptr || !member->isBool()) {
        invalidProtocol("The Core host result omitted Boolean member '" +
                        std::string{name} + "'.");
    }
    return member->asBool();
}

[[nodiscard]] std::vector<Diagnostic> diagnosticsFrom(const Json* entries,
                                                       std::string_view operation) {
    std::vector<Diagnostic> result;
    if (entries == nullptr || !entries->isArray()) {
        return result;
    }
    result.reserve(entries->asArray().size());
    for (const auto& value : entries->asArray()) {
        if (!value.isObject()) {
            continue;
        }
        const Json* code = value.find("code");
        const Json* itemOperation = value.find("operation");
        const Json* message = value.find("message");
        result.push_back(Diagnostic{
            code != nullptr && code->isString() ? code->asString()
                                                : std::string{},
            itemOperation != nullptr && itemOperation->isString()
                ? itemOperation->asString()
                : std::string{operation},
            message != nullptr && message->isString() ? message->asString()
                                                      : std::string{},
            value.serialize(),
        });
    }
    return result;
}

[[nodiscard]] std::string base64Encode(
    std::span<const std::uint8_t> bytes) {
    constexpr std::string_view alphabet{
        "ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789+/"};
    std::string output;
    output.reserve(((bytes.size() + 2U) / 3U) * 4U);
    for (std::size_t index = 0U; index < bytes.size(); index += 3U) {
        const std::uint32_t first = bytes[index];
        const bool hasSecond = index + 1U < bytes.size();
        const bool hasThird = index + 2U < bytes.size();
        const std::uint32_t second = hasSecond ? bytes[index + 1U] : 0U;
        const std::uint32_t third = hasThird ? bytes[index + 2U] : 0U;
        const std::uint32_t value =
            (first << 16U) | (second << 8U) | third;
        output.push_back(alphabet[(value >> 18U) & 0x3FU]);
        output.push_back(alphabet[(value >> 12U) & 0x3FU]);
        output.push_back(hasSecond ? alphabet[(value >> 6U) & 0x3FU] : '=');
        output.push_back(hasThird ? alphabet[value & 0x3FU] : '=');
    }
    return output;
}

[[nodiscard]] int base64Value(char value) noexcept {
    if (value >= 'A' && value <= 'Z') return value - 'A';
    if (value >= 'a' && value <= 'z') return value - 'a' + 26;
    if (value >= '0' && value <= '9') return value - '0' + 52;
    if (value == '+') return 62;
    if (value == '/') return 63;
    return -1;
}

[[nodiscard]] std::vector<std::uint8_t> base64Decode(
    std::string_view text) {
    if (text.size() % 4U != 0U) {
        invalidProtocol("The Core host returned malformed Base64.");
    }
    std::vector<std::uint8_t> output;
    output.reserve((text.size() / 4U) * 3U);
    for (std::size_t index = 0U; index < text.size(); index += 4U) {
        const bool finalGroup = index + 4U == text.size();
        const bool padSecond = text[index + 2U] == '=';
        const bool padThird = text[index + 3U] == '=';
        const int first = base64Value(text[index]);
        const int second = base64Value(text[index + 1U]);
        const int third = padSecond ? 0 : base64Value(text[index + 2U]);
        const int fourth = padThird ? 0 : base64Value(text[index + 3U]);
        if (first < 0 || second < 0 || third < 0 || fourth < 0 ||
            (padSecond && !padThird) ||
            ((padSecond || padThird) && !finalGroup)) {
            invalidProtocol("The Core host returned malformed Base64.");
        }
        const auto value =
            (static_cast<std::uint32_t>(first) << 18U) |
            (static_cast<std::uint32_t>(second) << 12U) |
            (static_cast<std::uint32_t>(third) << 6U) |
            static_cast<std::uint32_t>(fourth);
        output.push_back(static_cast<std::uint8_t>((value >> 16U) & 0xFFU));
        if (!padSecond) {
            output.push_back(
                static_cast<std::uint8_t>((value >> 8U) & 0xFFU));
        }
        if (!padThird) {
            output.push_back(static_cast<std::uint8_t>(value & 0xFFU));
        }
    }
    return output;
}

[[nodiscard]] Json::Array extensionsJson(
    const std::vector<std::string>& extensions) {
    for (const auto& value : extensions) {
        if (value.empty()) {
            invalidArgument("Supported extension names must not be empty.");
        }
    }
    return detail::jsonStrings(extensions);
}

[[nodiscard]] std::filesystem::path environmentPath(const char* name) {
    const char* value = std::getenv(name);
    return value != nullptr ? std::filesystem::path{value}
                            : std::filesystem::path{};
}

[[nodiscard]] SdkOptions defaultOptions() {
    SdkOptions options;
    options.nodeExecutable = environmentPath("MEMORYOS_NODE_EXECUTABLE");
    if (options.nodeExecutable.empty()) {
        options.nodeExecutable = MEMORYOS_SDK_DEFAULT_NODE_EXECUTABLE;
    }
    options.coreHost = environmentPath("MEMORYOS_CORE_HOST");
    if (options.coreHost.empty()) {
        const std::filesystem::path sourceHost{MEMORYOS_SDK_DEFAULT_CORE_HOST};
        std::error_code error;
        if (!sourceHost.empty() &&
            std::filesystem::is_regular_file(sourceHost, error) && !error) {
            options.coreHost = sourceHost;
        } else {
            options.coreHost = MEMORYOS_SDK_INSTALL_CORE_HOST;
        }
    }
    return options;
}

} // namespace

struct VerificationResult::Impl final {
    bool valid{false};
    std::vector<Diagnostic> diagnostics;
    std::string canonical_json;
};

struct RegressionReport::Impl final {
    std::string identifier;
    bool regression_detected{false};
    std::string overall;
    std::string canonical_json;
};

struct InvestigationResult::Impl final {
    std::string identifier;
    std::string regression_identifier;
    std::string workspace_identifier;
    std::string status;
    std::size_t match_count{0U};
    std::string canonical_json;
};

struct Checkpoint::Impl final {
    std::shared_ptr<detail::Client> client;
    std::string identifier;
    std::string investigation_identifier;
    std::string canonical_json;
};

struct Investigation::Impl final {
    std::shared_ptr<detail::Client> client;
    std::string identifier;
    std::string workspace_identifier;
    std::string lifecycle;
    std::string phase;
    std::string source_kind;
    std::string active_replay_identifier;
    std::string transition_log_digest;
    std::size_t transition_count{0U};
    std::string canonical_json;
};

namespace detail {

Investigation investigationFrom(
    const std::shared_ptr<detail::Client>& client,
    const Json& result) {
    const Json* value = result.find("investigation");
    const Json* log = result.find("transitionLog");
    if (value == nullptr || !value->isObject() || log == nullptr ||
        !log->isObject()) {
        invalidProtocol("The Core host omitted an investigation result.");
    }
    auto impl = std::make_shared<Investigation::Impl>();
    impl->client = client;
    impl->identifier = requiredString(*value, "identifier");
    impl->workspace_identifier = requiredString(*value, "workspaceIdentifier");
    impl->lifecycle = requiredString(*value, "lifecycle");
    impl->phase = requiredString(*value, "phase");
    impl->source_kind = requiredString(*value, "sourceKind");
    const Json* replay = value->find("replay");
    if (replay == nullptr) {
        invalidProtocol("The Core host omitted the Replay projection.");
    }
    if (!replay->isNull()) {
        if (!replay->isObject()) {
            invalidProtocol("The Core host returned an invalid Replay projection.");
        }
        impl->active_replay_identifier = requiredString(*replay, "identifier");
        if (impl->active_replay_identifier.empty()) {
            invalidProtocol("The Core host returned an empty Replay identifier.");
        }
    }
    impl->transition_log_digest = requiredString(*log, "digest");
    impl->transition_count = requiredSize(*log, "count");
    impl->canonical_json = result.serialize();
    return Investigation{std::move(impl)};
}

VerificationResult verificationFrom(
    const Json& value,
    bool valid,
    std::string_view operation,
    const Json* diagnostics) {
    auto impl = std::make_shared<VerificationResult::Impl>();
    impl->valid = valid;
    impl->diagnostics = diagnosticsFrom(diagnostics, operation);
    impl->canonical_json = value.serialize();
    return VerificationResult{std::move(impl)};
}

} // namespace detail

SdkError::SdkError(std::string code,
                   std::string operation,
                   std::string message,
                   std::vector<Diagnostic> diagnostics)
    : std::runtime_error(std::move(message)), code_(std::move(code)),
      operation_(std::move(operation)), diagnostics_(std::move(diagnostics)) {}

const std::string& SdkError::code() const noexcept { return code_; }
const std::string& SdkError::operation() const noexcept { return operation_; }
const std::vector<Diagnostic>& SdkError::diagnostics() const noexcept {
    return diagnostics_;
}

Workspace::Workspace(std::string identifier,
                     std::weak_ptr<detail::Client> client)
    : identifier_(std::make_shared<const std::string>(std::move(identifier))),
      client_(std::move(client)) {}

const std::string& Workspace::identifier() const noexcept {
    return *identifier_;
}

MemoryInvestigationPackage::MemoryInvestigationPackage(
    std::vector<std::uint8_t> bytes)
    : bytes_(std::make_shared<const std::vector<std::uint8_t>>(
          std::move(bytes))) {}

MemoryInvestigationPackage::MemoryInvestigationPackage(
    std::span<const std::byte> bytes) {
    std::vector<std::uint8_t> converted;
    converted.reserve(bytes.size());
    std::transform(bytes.begin(), bytes.end(), std::back_inserter(converted),
                   [](std::byte value) { return std::to_integer<std::uint8_t>(value); });
    bytes_ = std::make_shared<const std::vector<std::uint8_t>>(
        std::move(converted));
}

std::span<const std::uint8_t>
MemoryInvestigationPackage::bytes() const noexcept {
    return *bytes_;
}

VerificationResult::VerificationResult(std::shared_ptr<const Impl> impl)
    : impl_(std::move(impl)) {}

bool VerificationResult::valid() const noexcept { return impl_->valid; }
const std::vector<Diagnostic>&
VerificationResult::diagnostics() const noexcept {
    return impl_->diagnostics;
}
const std::string& VerificationResult::canonicalJson() const noexcept {
    return impl_->canonical_json;
}

RegressionReport::RegressionReport(std::shared_ptr<const Impl> impl)
    : impl_(std::move(impl)) {}
const std::string& RegressionReport::identifier() const noexcept {
    return impl_->identifier;
}
bool RegressionReport::regressionDetected() const noexcept {
    return impl_->regression_detected;
}
const std::string& RegressionReport::overall() const noexcept {
    return impl_->overall;
}
const std::string& RegressionReport::canonicalJson() const noexcept {
    return impl_->canonical_json;
}

InvestigationResult::InvestigationResult(std::shared_ptr<const Impl> impl)
    : impl_(std::move(impl)) {}
const std::string& InvestigationResult::identifier() const noexcept {
    return impl_->identifier;
}
const std::string& InvestigationResult::regressionIdentifier() const noexcept {
    return impl_->regression_identifier;
}
const std::string& InvestigationResult::workspaceIdentifier() const noexcept {
    return impl_->workspace_identifier;
}
const std::string& InvestigationResult::status() const noexcept {
    return impl_->status;
}
std::size_t InvestigationResult::matchCount() const noexcept {
    return impl_->match_count;
}
const std::string& InvestigationResult::canonicalJson() const noexcept {
    return impl_->canonical_json;
}

Checkpoint::Checkpoint(std::shared_ptr<const Impl> impl)
    : impl_(std::move(impl)) {}
const std::string& Checkpoint::identifier() const noexcept {
    return impl_->identifier;
}
const std::string& Checkpoint::investigationIdentifier() const noexcept {
    return impl_->investigation_identifier;
}
const std::string& Checkpoint::canonicalJson() const noexcept {
    return impl_->canonical_json;
}

Investigation::Investigation(std::shared_ptr<const Impl> impl)
    : impl_(std::move(impl)) {}
const std::string& Investigation::identifier() const noexcept {
    return impl_->identifier;
}
const std::string& Investigation::workspaceIdentifier() const noexcept {
    return impl_->workspace_identifier;
}
const std::string& Investigation::lifecycle() const noexcept {
    return impl_->lifecycle;
}
const std::string& Investigation::phase() const noexcept { return impl_->phase; }
const std::string& Investigation::transitionLogDigest() const noexcept {
    return impl_->transition_log_digest;
}
std::size_t Investigation::transitionCount() const noexcept {
    return impl_->transition_count;
}
const std::string& Investigation::canonicalJson() const noexcept {
    return impl_->canonical_json;
}

Investigation Investigation::observe(std::string snapshotJson,
                                     ObserveOptions options) const {
    if (!options.identifier.empty()) {
        invalidArgument(
            "An appended Observation cannot replace the Investigation identifier.");
    }
    Json snapshot;
    Json query;
    try {
        snapshot = Json::parse(snapshotJson);
        query = Json::parse(options.queryJson);
    } catch (const std::exception&) {
        invalidArgument("Observation snapshot and query must be valid JSON.");
    }
    if (!snapshot.isObject()) {
        invalidArgument("Observation snapshot must be a JSON object.");
    }
    Json::Object params{
        {"investigationIdentifier", Json{identifier()}},
        {"query", std::move(query)},
        {"resultCode", Json{std::move(options.resultCode)}},
        {"snapshot", std::move(snapshot)},
    };
    if (!options.operation.empty()) {
        params.emplace("operation", Json{std::move(options.operation)});
    }
    return detail::investigationFrom(
        impl_->client, impl_->client->invoke("observe", std::move(params)));
}

Investigation Investigation::trace(std::string selection) const {
    if (selection.empty()) {
        invalidArgument("Trace requires one exact Reflection or MIP Trace selector.");
    }
    Json::Object params{
        {"investigationIdentifier", Json{identifier()}},
        {"selection", Json{std::move(selection)}},
    };
    return detail::investigationFrom(impl_->client,
        impl_->client->invoke("trace", std::move(params)));
}

ReplaySession Investigation::replay() const {
    Json::Object params{
        {"investigationIdentifier", Json{identifier()}},
    };
    Investigation current = detail::investigationFrom(
        impl_->client, impl_->client->invoke("load", std::move(params)));
    if (current.impl_->active_replay_identifier.empty()) {
        replayUnavailable();
    }
    return ReplaySession{current, current.impl_->active_replay_identifier};
}

ComparisonSession Investigation::comparisonSession(
    std::optional<std::string> evolutionIdentifier) const {
    if (impl_->source_kind == "native" && evolutionIdentifier.has_value()) {
        invalidArgument(
            "Native comparison requires an explicitly supplied null Evolution selector.");
    }
    if (impl_->source_kind == "mip" &&
        (!evolutionIdentifier.has_value() || evolutionIdentifier->empty())) {
        invalidArgument(
            "Package comparison requires an exact Cognitive Evolution identifier.");
    }
    if (impl_->source_kind != "native" && impl_->source_kind != "mip") {
        invalidProtocol("The Core host returned an unknown Investigation source kind.");
    }
    return ComparisonSession{*this, std::move(evolutionIdentifier), false};
}

ComparisonSession Investigation::compare(
    const ComparisonSession& session) const {
    if (session.investigation_.impl_->client != impl_->client ||
        session.investigation_.identifier() != identifier()) {
        invalidArgument(
            "A ComparisonSession belongs to a different investigation.");
    }
    if (session.entered_) {
        invalidArgument("A ComparisonSession is already active.");
    }
    Json::Object command{
        {"action", Json{"enter"}},
        {"evolutionIdentifier", Json{nullptr}},
    };
    if (session.evolution_identifier_.has_value()) {
        command.at("evolutionIdentifier") =
            Json{*session.evolution_identifier_};
    }
    Json::Object params{
        {"command", Json{std::move(command)}},
        {"investigationIdentifier", Json{identifier()}},
    };
    return ComparisonSession{
        detail::investigationFrom(
            impl_->client,
            impl_->client->invoke("compare", std::move(params))),
        session.evolution_identifier_,
        true,
    };
}

VerificationResult Investigation::verify() const {
    Json::Object params{
        {"investigationIdentifier", Json{identifier()}},
    };
    const Json result =
        impl_->client->invoke("verifyInvestigation", std::move(params));
    const Json* verification = result.find("verification");
    const bool valid = verification != nullptr && verification->isObject() &&
        verification->find("status") != nullptr &&
        verification->find("status")->isString() &&
        verification->find("status")->asString() == "passed";
    return detail::verificationFrom(
        result, valid, "verifyInvestigation",
        !valid && verification != nullptr ? verification->find("checks")
                                          : nullptr);
}

Checkpoint Investigation::checkpoint() const {
    Json::Object params{
        {"investigationIdentifier", Json{identifier()}},
    };
    const Json result = impl_->client->invoke("checkpoint", std::move(params));
    auto checkpoint = std::make_shared<Checkpoint::Impl>();
    checkpoint->client = impl_->client;
    checkpoint->identifier = requiredString(result, "checkpointToken");
    checkpoint->investigation_identifier =
        requiredString(result, "investigationIdentifier");
    checkpoint->canonical_json = result.serialize();
    return Checkpoint{std::move(checkpoint)};
}

Investigation Investigation::restore(const Checkpoint& checkpoint) const {
    if (checkpoint.impl_->client != impl_->client) {
        invalidArgument("A checkpoint belongs to a different MemoryOS instance.");
    }
    if (checkpoint.investigationIdentifier() != identifier()) {
        invalidArgument("A checkpoint belongs to a different investigation.");
    }
    Json::Object params{{"checkpointToken", Json{checkpoint.identifier()}}};
    return detail::investigationFrom(impl_->client,
        impl_->client->invoke("restore", std::move(params)));
}

Investigation Investigation::archive() const {
    Json::Object params{{"investigationIdentifier", Json{identifier()}}};
    return detail::investigationFrom(
        impl_->client, impl_->client->invoke("archive", std::move(params)));
}

Investigation Investigation::returnToWorld() const {
    Json::Object params{{"investigationIdentifier", Json{identifier()}}};
    return detail::investigationFrom(
        impl_->client,
        impl_->client->invoke("returnToWorld", std::move(params)));
}

ReplaySession::ReplaySession(Investigation investigation,
                             std::string replayIdentifier)
    : investigation_(std::move(investigation)),
      replay_identifier_(std::move(replayIdentifier)) {
    if (replay_identifier_.empty() ||
        investigation_.impl_->active_replay_identifier != replay_identifier_) {
        replaySessionMismatch();
    }
}
const Investigation& ReplaySession::investigation() const noexcept {
    return investigation_;
}
ReplaySession ReplaySession::command(std::string_view action) const {
    Investigation next = detail::investigationFrom(
        investigation_.impl_->client,
        investigation_.impl_->client->invokeReplay(
            investigation_.identifier(), replay_identifier_, action));
    return ReplaySession{std::move(next), replay_identifier_};
}
ReplaySession ReplaySession::play() const { return command("play"); }
ReplaySession ReplaySession::pause() const { return command("pause"); }
ReplaySession ReplaySession::next() const { return command("next"); }
ReplaySession ReplaySession::previous() const { return command("previous"); }
ReplaySession ReplaySession::restart() const { return command("restart"); }
ReplaySession ReplaySession::advance() const { return command("advance"); }

ComparisonSession::ComparisonSession(
    Investigation investigation,
    std::optional<std::string> evolutionIdentifier,
    bool entered)
    : investigation_(std::move(investigation)),
      evolution_identifier_(std::move(evolutionIdentifier)),
      entered_(entered) {}
const Investigation& ComparisonSession::investigation() const noexcept {
    return investigation_;
}
const std::optional<std::string>&
ComparisonSession::evolutionIdentifier() const noexcept {
    return evolution_identifier_;
}
ComparisonSession ComparisonSession::command(std::string_view action,
                                             std::string selector) const {
    if (!entered_) {
        invalidArgument(
            "Comparison must be activated through Investigation::compare first.");
    }
    Json::Object command{{"action", Json{action}}};
    if (action == "start") {
        command.emplace("targetNodeKey", Json{std::move(selector)});
    } else if (action == "startPackage") {
        command.at("action") = Json{"start"};
        command.emplace("comparativeIdentifier", Json{std::move(selector)});
    }
    Json::Object params{
        {"command", Json{std::move(command)}},
        {"investigationIdentifier", Json{investigation_.identifier()}},
    };
    return ComparisonSession{
        detail::investigationFrom(
            investigation_.impl_->client,
            investigation_.impl_->client->invoke("compare", std::move(params))),
        evolution_identifier_,
        true,
    };
}
ComparisonSession ComparisonSession::previousObservation() const {
    return command("previous");
}
ComparisonSession ComparisonSession::nextObservation() const {
    return command("next");
}
ComparisonSession ComparisonSession::start(
    std::string reflectionSelection) const {
    if (reflectionSelection.empty()) invalidArgument("Reflection selection is required.");
    if (investigation_.impl_->source_kind != "native") {
        invalidArgument(
            "Package comparison requires a Comparative Reconstruction identifier.");
    }
    return command("start", std::move(reflectionSelection));
}
ComparisonSession ComparisonSession::startPackage(
    std::string comparativeIdentifier) const {
    if (comparativeIdentifier.empty()) {
        invalidArgument("Comparative Reconstruction selection is required.");
    }
    if (investigation_.impl_->source_kind != "mip") {
        invalidArgument(
            "Native comparison requires an exact Reflection target node key.");
    }
    return command("startPackage", std::move(comparativeIdentifier));
}
ComparisonSession ComparisonSession::play() const { return command("play"); }
ComparisonSession ComparisonSession::pause() const { return command("pause"); }
ComparisonSession ComparisonSession::next() const { return command("nextStep"); }
ComparisonSession ComparisonSession::previous() const {
    return command("previousStep");
}
ComparisonSession ComparisonSession::reset() const { return command("reset"); }
ComparisonSession ComparisonSession::advance() const {
    return command("advance");
}
ComparisonSession ComparisonSession::back() const { return command("back"); }

MemoryOS::MemoryOS() : MemoryOS(defaultOptions()) {}

MemoryOS::MemoryOS(SdkOptions options) {
    if (options.nodeExecutable.empty() || options.coreHost.empty()) {
        invalidArgument(
            "A Node executable and private Investigation Core host are required.");
    }
    client_ = std::make_shared<detail::Client>(std::move(options));
}

MemoryOS::~MemoryOS() = default;
MemoryOS::MemoryOS(MemoryOS&&) noexcept = default;
MemoryOS& MemoryOS::operator=(MemoryOS&&) noexcept = default;

Workspace MemoryOS::openWorkspace(std::string identifier) const {
    if (identifier.empty()) {
        invalidArgument("Workspace identifier must not be empty.");
    }
    return Workspace{std::move(identifier), client_};
}

Investigation MemoryOS::observe(const Workspace& workspace,
                                std::string snapshotJson,
                                ObserveOptions options) const {
    if (workspace.client_.lock() != client_) {
        invalidArgument("A Workspace belongs to a different MemoryOS instance.");
    }
    Json snapshot;
    Json query;
    try {
        snapshot = Json::parse(snapshotJson);
        query = Json::parse(options.queryJson);
    } catch (const std::exception&) {
        invalidArgument("Observation snapshot and query must be valid JSON.");
    }
    if (!snapshot.isObject()) {
        invalidArgument("Observation snapshot must be a JSON object.");
    }
    Json::Object params{
        {"query", std::move(query)},
        {"resultCode", Json{std::move(options.resultCode)}},
        {"snapshot", std::move(snapshot)},
        {"workspaceIdentifier", Json{workspace.identifier()}},
    };
    if (!options.operation.empty()) {
        params.emplace("operation", Json{std::move(options.operation)});
    }
    if (!options.identifier.empty()) {
        params.emplace("identifier", Json{std::move(options.identifier)});
    }
    return detail::investigationFrom(client_,
        client_->invoke("observe", std::move(params)));
}

Investigation MemoryOS::importPackage(
    const MemoryInvestigationPackage& package,
    ImportOptions options) const {
    Json::Object params{
        {"bytesBase64", Json{base64Encode(package.bytes())}},
        {"supportedExtensions", Json{extensionsJson(options.supportedExtensions)}},
    };
    if (!options.identifier.empty()) {
        params.emplace("identifier", Json{std::move(options.identifier)});
    }
    return detail::investigationFrom(client_,
        client_->invoke("importPackage", std::move(params)));
}

MemoryInvestigationPackage MemoryOS::exportPackage(
    const Investigation& investigation,
    std::optional<std::vector<std::string>> supportedExtensions) const {
    if (investigation.impl_->client != client_) {
        invalidArgument("An Investigation belongs to a different MemoryOS instance.");
    }
    Json::Object params{
        {"investigationIdentifier", Json{investigation.identifier()}},
    };
    if (supportedExtensions.has_value()) {
        params.emplace("supportedExtensions",
                       Json{extensionsJson(*supportedExtensions)});
    }
    const Json result = client_->invoke("exportPackage", std::move(params));
    return MemoryInvestigationPackage{
        base64Decode(requiredString(result, "bytesBase64"))};
}

VerificationResult MemoryOS::verifyPackage(
    const MemoryInvestigationPackage& package,
    std::vector<std::string> supportedExtensions) const {
    Json::Object params{
        {"bytesBase64", Json{base64Encode(package.bytes())}},
        {"supportedExtensions", Json{extensionsJson(supportedExtensions)}},
    };
    const Json result = client_->invoke("verifyPackage", std::move(params));
    const Json* valid = result.find("valid");
    if (valid == nullptr || !valid->isBool()) {
        invalidProtocol("The Core host omitted package verification status.");
    }
    return detail::verificationFrom(result, valid->asBool(), "verifyPackage",
                            result.find("diagnostics"));
}

RegressionReport MemoryOS::regression(
    const Investigation& baseline,
    const Investigation& candidate) const {
    if (baseline.impl_->client != client_ || candidate.impl_->client != client_) {
        invalidArgument(
            "Regression investigations belong to a different MemoryOS instance.");
    }
    Json::Object params{
        {"baselineInvestigationIdentifier", Json{baseline.identifier()}},
        {"candidateInvestigationIdentifier", Json{candidate.identifier()}},
    };
    const Json result = client_->invoke("regression", std::move(params));
    const Json* report = result.find("regression");
    if (report == nullptr || !report->isObject()) {
        invalidProtocol("The Core host omitted the Cognitive Regression report.");
    }
    const std::string& kind = requiredString(*report, "kind");
    const std::string& version = requiredString(*report, "version");
    const std::string& identifier = requiredString(*report, "identifier");
    const std::string& overall = requiredString(*report, "overall");
    const bool detected = requiredBool(*report, "regressionDetected");
    const Json* categories = report->find("categories");
    constexpr std::array<std::string_view, 8U> categoryNames{
        "replay", "reflection", "evidence", "retrieval", "evolution",
        "verification", "transition", "lifecycle",
    };
    bool validCategories = categories != nullptr && categories->isArray() &&
        categories->asArray().size() == categoryNames.size();
    if (validCategories) {
        for (std::size_t index = 0U; index < categoryNames.size(); ++index) {
            const Json& category = categories->asArray()[index];
            const Json* name = category.isObject()
                ? category.find("category")
                : nullptr;
            if (name == nullptr || !name->isString() ||
                name->asString() != categoryNames[index]) {
                validCategories = false;
                break;
            }
        }
    }
    if (kind != "MemoryOSCognitiveRegressionReport" || version != "1.0.0" ||
        identifier.empty() ||
        (overall != "identical" && overall != "regressionDetected") ||
        detected != (overall == "regressionDetected") || !validCategories) {
        invalidProtocol(
            "The Core host returned an invalid Cognitive Regression report.");
    }
    auto impl = std::make_shared<RegressionReport::Impl>();
    impl->identifier = identifier;
    impl->regression_detected = detected;
    impl->overall = overall;
    impl->canonical_json = report->serialize();
    return RegressionReport{std::move(impl)};
}

InvestigationResult MemoryOS::investigate(
    const RegressionReport& report,
    InvestigationQuery query) const {
    const auto queryMember = [](std::optional<std::string> value,
                                std::string_view name) {
        if (value.has_value() && value->empty()) {
            invalidArgument("Investigation query '" + std::string{name} +
                            "' must be absent or a non-empty string.");
        }
        return value.has_value() ? Json{std::move(*value)} : Json{};
    };

    Json reportValue;
    try {
        reportValue = Json::parse(report.canonicalJson());
    } catch (const std::exception&) {
        invalidProtocol(
            "The SDK-owned Cognitive Regression report is not valid JSON.");
    }
    Json::Object queryValue{
        {"category", queryMember(std::move(query.category), "category")},
        {"reflectionIdentifier",
         queryMember(std::move(query.reflectionIdentifier),
                     "reflectionIdentifier")},
        {"transition",
         queryMember(std::move(query.transition), "transition")},
    };
    Json::Object params{
        {"query", Json{std::move(queryValue)}},
        {"report", std::move(reportValue)},
    };
    const Json response = client_->invoke("investigate", std::move(params));
    const Json* result = response.find("investigationResult");
    if (result == nullptr || !result->isObject()) {
        invalidProtocol(
            "The Core host omitted the Cognitive Investigation result.");
    }
    const std::string& kind = requiredString(*result, "kind");
    const std::string& version = requiredString(*result, "version");
    const std::string& identifier = requiredString(*result, "identifier");
    const std::string& regressionIdentifier =
        requiredString(*result, "regressionIdentifier");
    const std::string& workspaceIdentifier =
        requiredString(*result, "workspaceIdentifier");
    const std::string& status = requiredString(*result, "status");
    const std::size_t matchCount = requiredSize(*result, "matchCount");
    const Json* normalizedQuery = result->find("query");
    const Json* matches = result->find("matches");
    const bool validStatus = status == "matched" || status == "empty";
    const bool validCount = matches != nullptr && matches->isArray() &&
        matches->asArray().size() == matchCount &&
        ((status == "empty" && matchCount == 0U) ||
         (status == "matched" && matchCount > 0U));
    if (kind != "MemoryOSCognitiveInvestigationResult" ||
        version != "1.0.0" || identifier.empty() ||
        regressionIdentifier != report.identifier() ||
        workspaceIdentifier.empty() || !validStatus || !validCount ||
        normalizedQuery == nullptr || !normalizedQuery->isObject()) {
        invalidProtocol(
            "The Core host returned an invalid Cognitive Investigation result.");
    }
    for (std::size_t index = 0U; index < matchCount; ++index) {
        const Json& match = matches->asArray()[index];
        const Json* subject = match.find("subject");
        const Json* baseline = match.find("baseline");
        const Json* candidate = match.find("candidate");
        if (!match.isObject() || requiredSize(match, "index") != index ||
            requiredString(match, "category").empty() ||
            requiredString(match, "change").empty() || subject == nullptr ||
            !subject->isObject() || baseline == nullptr ||
            (!baseline->isNull() && !baseline->isObject()) ||
            candidate == nullptr ||
            (!candidate->isNull() && !candidate->isObject())) {
            invalidProtocol(
                "The Core host returned an invalid Cognitive Investigation match.");
        }
    }

    auto impl = std::make_shared<InvestigationResult::Impl>();
    impl->identifier = identifier;
    impl->regression_identifier = regressionIdentifier;
    impl->workspace_identifier = workspaceIdentifier;
    impl->status = status;
    impl->match_count = matchCount;
    impl->canonical_json = result->serialize();
    return InvestigationResult{std::move(impl)};
}

Investigation MemoryOS::restore(const Checkpoint& checkpoint) const {
    if (checkpoint.impl_->client != client_) {
        invalidArgument("A checkpoint belongs to a different MemoryOS instance.");
    }
    Json::Object params{{"checkpointToken", Json{checkpoint.identifier()}}};
    return detail::investigationFrom(
        client_, client_->invoke("restore", std::move(params)));
}

} // namespace memoryos
