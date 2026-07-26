#include "cca/compiler/parser.hpp"

#include <algorithm>
#include <cctype>
#include <charconv>
#include <cmath>
#include <cstdint>
#include <limits>
#include <stdexcept>
#include <string>
#include <string_view>
#include <utility>
#include <vector>
#include <yaml-cpp/yaml.h>

namespace cca::compiler {
namespace {

[[nodiscard]] DiagnosticLocation source_location(const std::filesystem::path& path,
                                                 const YAML::Mark& mark) {
    const auto line = mark.line >= 0 ? static_cast<std::size_t>(mark.line) + 1 : 1;
    const auto column = mark.column >= 0 ? static_cast<std::size_t>(mark.column) + 1 : 1;
    return DiagnosticLocation{path, line, column};
}

[[nodiscard]] Diagnostic parse_diagnostic(const std::filesystem::path& path,
                                          const YAML::Mark& mark,
                                          std::string identifier_suffix,
                                          std::string code,
                                          std::string message,
                                          std::string suggestion) {
    return Diagnostic{code + ":" + std::move(identifier_suffix),
                      std::move(code),
                      DiagnosticSeverity::error,
                      std::move(message),
                      std::move(suggestion),
                      source_location(path, mark),
                      "syntax"};
}

[[nodiscard]] std::string lowercase(std::string value) {
    std::transform(value.begin(), value.end(), value.begin(), [](const unsigned char character) {
        return static_cast<char>(std::tolower(character));
    });
    return value;
}

[[nodiscard]] bool is_plain_scalar(const YAML::Node& node) {
    const auto tag = node.Tag();
    return tag.empty() || tag == "?";
}

[[nodiscard]] bool is_tag(const YAML::Node& node, const std::string_view short_name) {
    const auto tag = node.Tag();
    return tag == std::string{"!!"} + std::string{short_name} ||
           tag == std::string{"tag:yaml.org,2002:"} + std::string{short_name};
}

[[nodiscard]] std::optional<std::int64_t> parse_integer(const std::string_view text) {
    if (text.empty()) {
        return std::nullopt;
    }
    const bool explicitly_positive = text.front() == '+';
    const auto number = explicitly_positive ? text.substr(1) : text;
    if (number.empty()) {
        return std::nullopt;
    }
    std::int64_t value = 0;
    const auto [end, error] =
        std::from_chars(number.data(), number.data() + number.size(), value, 10);
    if (error != std::errc{} || end != number.data() + number.size()) {
        return std::nullopt;
    }
    return value;
}

[[nodiscard]] std::optional<double> parse_number(const std::string_view text) {
    if (text.empty()) {
        return std::nullopt;
    }
    double value = 0.0;
    const auto [end, error] =
        std::from_chars(text.data(), text.data() + text.size(), value, std::chars_format::general);
    if (error != std::errc{} || end != text.data() + text.size() || !std::isfinite(value)) {
        return std::nullopt;
    }
    return value;
}

class Converter final {
  public:
    Converter(const std::filesystem::path& path,
              ValidationResult& validation,
              const std::shared_ptr<IDiagnosticSink>& sink)
        : path_{path}, validation_{validation}, sink_{sink} {}

    [[nodiscard]] CanonicalValue convert(const YAML::Node& node, const std::string& logical_path) {
        const auto location = source_location(path_, node.Mark());
        if (!node.IsDefined() || node.IsNull()) {
            return CanonicalValue{nullptr, location};
        }
        if (node.IsScalar()) {
            return convert_scalar(node, location);
        }

        for (const auto& ancestor : active_) {
            if (node.is(ancestor)) {
                report(parse_diagnostic(path_,
                                        node.Mark(),
                                        logical_path,
                                        "CCA-PARSE-005",
                                        "recursive YAML aliases are not supported",
                                        "Replace the recursive alias with an acyclic value."));
                return CanonicalValue{nullptr, location};
            }
        }
        active_.push_back(node);

        if (node.IsSequence()) {
            CanonicalValue::Array values;
            values.reserve(node.size());
            for (std::size_t index = 0; index < node.size(); ++index) {
                values.push_back(
                    convert(node[index], logical_path + "[" + std::to_string(index) + "]"));
            }
            active_.pop_back();
            return CanonicalValue{std::move(values), location};
        }

        CanonicalValue::Object values;
        for (const auto& pair : node) {
            if (!pair.first.IsScalar()) {
                report(
                    parse_diagnostic(path_,
                                     pair.first.Mark(),
                                     logical_path,
                                     "CCA-PARSE-003",
                                     "YAML mapping keys must be strings",
                                     "Replace the complex mapping key with a unique string key."));
                continue;
            }
            const auto key = pair.first.Scalar();
            const auto child_path = logical_path + "." + key;
            if (values.contains(key)) {
                report(parse_diagnostic(path_,
                                        pair.first.Mark(),
                                        child_path,
                                        "CCA-PARSE-002",
                                        "duplicate YAML mapping key '" + key + "'",
                                        "Remove or rename the duplicate mapping key."));
                continue;
            }
            values.emplace(key, convert(pair.second, child_path));
        }
        active_.pop_back();
        return CanonicalValue{std::move(values), location};
    }

  private:
    [[nodiscard]] CanonicalValue convert_scalar(const YAML::Node& node,
                                                const DiagnosticLocation& location) const {
        const auto scalar = node.Scalar();
        const auto normalized = lowercase(scalar);
        const bool plain = is_plain_scalar(node);

        if (is_tag(node, "null") || (plain && (normalized == "null" || normalized == "~"))) {
            return CanonicalValue{nullptr, location};
        }
        if (is_tag(node, "bool") || (plain && (normalized == "true" || normalized == "false"))) {
            return CanonicalValue{normalized == "true", location};
        }
        if (is_tag(node, "int") || plain) {
            if (const auto integer = parse_integer(scalar)) {
                return CanonicalValue{*integer, location};
            }
        }
        if (is_tag(node, "float") || plain) {
            if (const auto number = parse_number(scalar)) {
                return CanonicalValue{*number, location};
            }
        }
        return CanonicalValue{scalar, location};
    }

    void report(Diagnostic diagnostic) {
        sink_->report(diagnostic);
        validation_.add(std::move(diagnostic));
    }

    const std::filesystem::path& path_;
    ValidationResult& validation_;
    const std::shared_ptr<IDiagnosticSink>& sink_;
    std::vector<YAML::Node> active_;
};

} // namespace

Parser::Parser() : Parser{std::make_shared<NullLogger>(), std::make_shared<NullDiagnosticSink>()} {}

Parser::Parser(std::shared_ptr<ILogger> logger, std::shared_ptr<IDiagnosticSink> diagnostics)
    : logger_{std::move(logger)}, diagnostics_{std::move(diagnostics)} {
    if (!logger_ || !diagnostics_) {
        throw std::invalid_argument("parser dependencies must not be null");
    }
}

bool ParseResult::ok() const noexcept {
    return document.has_value() && !validation.has_errors();
}

ParseResult Parser::parse(const SourceDocument& source) const {
    ParseResult result;
    try {
        const auto documents = YAML::LoadAll(source.content);
        if (documents.empty()) {
            auto diagnostic = parse_diagnostic(source.path,
                                               YAML::Mark{},
                                               "document",
                                               "CCA-PARSE-001",
                                               "YAML source does not contain a document",
                                               "Add one canonical specification mapping.");
            diagnostics_->report(diagnostic);
            result.validation.add(std::move(diagnostic));
            return result;
        }
        if (documents.size() != 1) {
            auto diagnostic = parse_diagnostic(source.path,
                                               documents[1].Mark(),
                                               "document",
                                               "CCA-PARSE-004",
                                               "exactly one YAML document is required",
                                               "Keep one canonical specification per source file.");
            diagnostics_->report(diagnostic);
            result.validation.add(std::move(diagnostic));
            return result;
        }

        Converter converter{source.path, result.validation, diagnostics_};
        result.document = ParsedDocument{source.path, converter.convert(documents.front(), "$")};
        if (result.validation.has_errors()) {
            logger_->log({LogLevel::error, "parser", "YAML parsing produced diagnostics"});
        } else {
            logger_->log({LogLevel::debug, "parser", "YAML source parsed successfully"});
        }
        return result;
    } catch (const YAML::Exception& exception) {
        auto diagnostic = parse_diagnostic(source.path,
                                           exception.mark,
                                           "document",
                                           "CCA-PARSE-001",
                                           "invalid YAML syntax: " + exception.msg,
                                           "Correct the YAML syntax at the reported location.");
        diagnostics_->report(diagnostic);
        result.validation.add(std::move(diagnostic));
        logger_->log({LogLevel::error, "parser", "invalid YAML syntax"});
        return result;
    } catch (const std::exception&) {
        auto diagnostic = parse_diagnostic(
            source.path,
            YAML::Mark{},
            "document",
            "CCA-PARSE-006",
            "YAML source could not be converted",
            "Simplify the YAML source and retry; report this input if it persists.");
        diagnostics_->report(diagnostic);
        result.validation.add(std::move(diagnostic));
        logger_->log({LogLevel::error, "parser", "YAML conversion failed"});
        return result;
    }
}

Status Parser::parse(const ParseRequest& request) const {
    if (request.source.empty()) {
        auto status = Status::invalid_argument("parser source path must not be empty");
        diagnostics_->report({DiagnosticSeverity::error, "CCA-PARSER-001", status.message()});
        logger_->log({LogLevel::error, "parser", status.message()});
        return status;
    }

    const FileSourceLoader loader;
    auto load_result = loader.load(request.source);
    if (!load_result.ok()) {
        for (const auto& diagnostic : load_result.validation.diagnostics()) {
            diagnostics_->report(diagnostic);
        }
        return Status::invalid_argument("parser source could not be loaded");
    }

    const auto result = parse(*load_result.document);
    return result.ok() ? Status::success() : Status::invalid_argument("source is not valid YAML");
}

} // namespace cca::compiler
