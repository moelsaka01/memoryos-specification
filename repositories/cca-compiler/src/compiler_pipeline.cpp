#include "cca/compiler/compiler_pipeline.hpp"

#include <stdexcept>
#include <utility>

#include "cca/compiler/artifact_generator.hpp"
#include "cca/compiler/model_builder.hpp"
#include "cca/compiler/parser.hpp"
#include "cca/compiler/validator.hpp"

namespace cca::compiler {
namespace {

[[nodiscard]] Diagnostic invalid_request(const std::filesystem::path& source,
                                         const std::string& message,
                                         const std::string& suggestion) {
    return Diagnostic{"cca.pipeline.invalid-request",
                      "CCA-PIPELINE-001",
                      DiagnosticSeverity::error,
                      message,
                      suggestion,
                      DiagnosticLocation{source, 1, 1},
                      "pipeline"};
}

void finish(PipelineResult& result) {
    result.validation.sort();
}

} // namespace

bool PipelineResult::ok() const noexcept {
    return !validation.has_errors();
}

CompilerPipeline::CompilerPipeline() : CompilerPipeline{std::make_shared<FileSourceLoader>()} {}

CompilerPipeline::CompilerPipeline(std::shared_ptr<const ISourceLoader> source_loader)
    : source_loader_{std::move(source_loader)} {
    if (!source_loader_) {
        throw std::invalid_argument("compiler pipeline source loader must not be null");
    }
}

PipelineResult CompilerPipeline::run(const PipelineRequest& request) const {
    PipelineResult result;
    if (request.source.empty()) {
        result.validation.add(
            invalid_request(request.source,
                            "Canonical specification source path must not be empty.",
                            "Provide the path to a canonical YAML specification."));
        finish(result);
        return result;
    }
    if ((request.mode == PipelineMode::compile || request.mode == PipelineMode::report) &&
        request.output_directory.empty()) {
        result.validation.add(
            invalid_request(request.source,
                            "Artifact output directory must not be empty.",
                            "Provide --output <directory> or use the default output directory."));
        finish(result);
        return result;
    }

    auto load = source_loader_->load(request.source);
    result.completed_stages.emplace_back("load");
    result.validation.merge(load.validation);
    if (!load.ok()) {
        finish(result);
        return result;
    }

    const Parser parser;
    auto parse = parser.parse(*load.document);
    result.completed_stages.emplace_back("parse");
    result.validation.merge(parse.validation);
    if (!parse.ok()) {
        finish(result);
        return result;
    }

    const Validator validator;
    auto schema_validation = validator.validate(*parse.document);
    result.completed_stages.emplace_back("validate");
    result.validation.merge(schema_validation);
    if (schema_validation.has_errors()) {
        finish(result);
        return result;
    }

    const Analyzer analyzer;
    auto analysis = analyzer.analyze(*parse.document);
    result.completed_stages.emplace_back("analyze");
    result.validation.merge(analysis.validation);
    result.analysis = analysis.summary;
    if (!analysis.ok()) {
        finish(result);
        return result;
    }

    const DependencyResolver resolver;
    auto dependencies = resolver.resolve(*parse.document);
    result.completed_stages.emplace_back("resolve_dependencies");
    result.validation.merge(dependencies.validation);
    result.dependencies = dependencies;
    if (!dependencies.ok() || request.mode == PipelineMode::validate) {
        finish(result);
        return result;
    }

    const ModelBuilder builder;
    auto model = builder.build(*parse.document);
    result.completed_stages.emplace_back("build_internal_model");
    result.validation.merge(model.validation);
    if (!model.ok()) {
        finish(result);
        return result;
    }
    result.specification = std::move(model.specification);
    if (request.mode == PipelineMode::analyze) {
        finish(result);
        return result;
    }

    const ArtifactGenerator generator;
    auto generation =
        generator.generate(*result.specification, result.validation, request.output_directory);
    result.completed_stages.emplace_back("generate_artifacts");
    result.completed_stages.emplace_back("generate_reports");
    result.validation = std::move(generation.validation);
    result.generated_files = std::move(generation.files);
    finish(result);
    return result;
}

} // namespace cca::compiler
