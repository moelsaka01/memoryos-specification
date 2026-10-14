#pragma once

#include <memory>

#include "cca/compiler/cli.hpp"
#include "cca/compiler/compiler_pipeline.hpp"

namespace cca::compiler {

/// Adapts the typed compiler pipeline to the CLI's deterministic command seam.
class CompilerCommandService final : public ICommandService {
  public:
    CompilerCommandService();
    explicit CompilerCommandService(std::shared_ptr<const CompilerPipeline> pipeline);

    [[nodiscard]] CommandResult execute(const CommandRequest& request) const override;

  private:
    std::shared_ptr<const CompilerPipeline> pipeline_;
};

} // namespace cca::compiler
