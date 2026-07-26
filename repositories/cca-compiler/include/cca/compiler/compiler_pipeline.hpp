#pragma once

#include <filesystem>
#include <memory>
#include <optional>
#include <string>
#include <vector>

#include "cca/compiler/analyzer.hpp"
#include "cca/compiler/dependency_resolver.hpp"
#include "cca/compiler/diagnostics.hpp"
#include "cca/compiler/internal_model.hpp"
#include "cca/compiler/source_loader.hpp"

namespace cca::compiler {

/// Selects the furthest stage required by a public compiler operation.
enum class PipelineMode {
    validate,
    analyze,
    compile,
    report,
};

struct PipelineRequest final {
    PipelineMode mode{PipelineMode::validate};
    std::filesystem::path source;
    std::filesystem::path output_directory{"cca-out"};
};

/// Complete observable result of an ordered compiler run.
struct PipelineResult final {
    ValidationResult validation;
    std::vector<std::string> completed_stages;
    std::optional<AnalysisSummary> analysis;
    std::optional<DependencyResolution> dependencies;
    std::optional<Specification> specification;
    std::vector<std::filesystem::path> generated_files;

    [[nodiscard]] bool ok() const noexcept;
};

/// Ordered, dependency-injected Standards Compiler orchestration.
class CompilerPipeline final {
  public:
    CompilerPipeline();
    explicit CompilerPipeline(std::shared_ptr<const ISourceLoader> source_loader);

    [[nodiscard]] PipelineResult run(const PipelineRequest& request) const;

  private:
    std::shared_ptr<const ISourceLoader> source_loader_;
};

} // namespace cca::compiler
