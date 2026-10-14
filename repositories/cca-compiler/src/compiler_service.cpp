#include "cca/compiler/compiler_service.hpp"

#include <algorithm>
#include <sstream>
#include <stdexcept>
#include <string_view>
#include <utility>
#include <vector>

#include "cca/compiler/serialization.hpp"

namespace cca::compiler {
namespace {

[[nodiscard]] PipelineMode pipeline_mode(const CompilerCommand command) noexcept {
    switch (command) {
    case CompilerCommand::validate:
        return PipelineMode::validate;
    case CompilerCommand::analyze:
        return PipelineMode::analyze;
    case CompilerCommand::compile:
        return PipelineMode::compile;
    case CompilerCommand::report:
        return PipelineMode::report;
    }
    return PipelineMode::validate;
}

[[nodiscard]] std::string_view command_name(const CompilerCommand command) noexcept {
    switch (command) {
    case CompilerCommand::validate:
        return "validate";
    case CompilerCommand::analyze:
        return "analyze";
    case CompilerCommand::compile:
        return "compile";
    case CompilerCommand::report:
        return "report";
    }
    return "validate";
}

[[nodiscard]] std::string_view success_status(const CompilerCommand command) noexcept {
    switch (command) {
    case CompilerCommand::validate:
        return "valid";
    case CompilerCommand::analyze:
        return "analyzed";
    case CompilerCommand::compile:
        return "compiled";
    case CompilerCommand::report:
        return "reported";
    }
    return "valid";
}

void append_string_array(std::ostringstream& output, const std::vector<std::string>& values) {
    output << '[';
    for (std::size_t index = 0; index < values.size(); ++index) {
        if (index != 0) {
            output << ',';
        }
        output << json_string(values[index]);
    }
    output << ']';
}

[[nodiscard]] std::vector<std::string>
relative_generated_files(const PipelineResult& result,
                         const std::filesystem::path& output_directory) {
    std::vector<std::string> files;
    files.reserve(result.generated_files.size());
    for (const auto& path : result.generated_files) {
        auto relative = path.lexically_relative(output_directory);
        if (relative.empty()) {
            relative = path.filename();
        }
        files.push_back(relative.generic_string());
    }
    std::ranges::sort(files);
    return files;
}

[[nodiscard]] std::string serialize_command_result(const CommandRequest& request,
                                                   const PipelineResult& result) {
    const auto files = relative_generated_files(result, request.output_directory);
    std::ostringstream output;
    output << "{\"command\":" << json_string(command_name(request.command))
           << ",\"dependency_order\":";
    if (result.dependencies.has_value()) {
        append_string_array(output, result.dependencies->order);
    } else {
        output << "[]";
    }
    output << ",\"generated_files\":";
    append_string_array(output, files);
    output << ",\"stages\":";
    append_string_array(output, result.completed_stages);
    output << ",\"status\":" << json_string(result.ok() ? success_status(request.command) : "error")
           << ",\"summary\":{";
    if (result.analysis.has_value()) {
        output << "\"dependencies\":" << result.analysis->dependency_count
               << ",\"objects\":" << result.analysis->object_count() << ",\"objects_by_type\":{";
        bool first = true;
        for (const auto& [type, count] : result.analysis->objects_by_type) {
            if (!std::exchange(first, false)) {
                output << ',';
            }
            output << json_string(type) << ':' << count;
        }
        output << "},\"relationships\":" << result.analysis->relationship_count;
    } else {
        output << "\"dependencies\":0,\"objects\":0,\"objects_by_type\":{},\"relationships\":0";
    }
    output << "},\"validation\":" << serialize_validation_report(result.validation) << '}';
    return output.str();
}

} // namespace

CompilerCommandService::CompilerCommandService()
    : CompilerCommandService{std::make_shared<CompilerPipeline>()} {}

CompilerCommandService::CompilerCommandService(std::shared_ptr<const CompilerPipeline> pipeline)
    : pipeline_{std::move(pipeline)} {
    if (!pipeline_) {
        throw std::invalid_argument("compiler command service pipeline must not be null");
    }
}

CommandResult CompilerCommandService::execute(const CommandRequest& request) const {
    const auto result = pipeline_->run(PipelineRequest{
        .mode = pipeline_mode(request.command),
        .source = request.source,
        .output_directory = request.output_directory,
    });
    return CommandResult{
        .exit_code = result.ok() ? CliExitCode::success : CliExitCode::validation_error,
        .json = serialize_command_result(request, result),
    };
}

} // namespace cca::compiler
