# Compiler Pipeline

`CompilerPipeline::run(const PipelineRequest&)` is the ordered orchestration
entry point. `PipelineMode` selects validate, analyze, compile, or report.

```cpp
#include <cca/compiler/compiler_pipeline.hpp>

const cca::compiler::CompilerPipeline pipeline;
const auto result = pipeline.run({
    .mode = cca::compiler::PipelineMode::validate,
    .source = "specification.yaml",
    .output_directory = "cca-out",
});
if (!result.ok()) {
    // Inspect result.validation and result.completed_stages.
}
```

The default pipeline composes a file source loader. The injection constructor
accepts an `ISourceLoader` for deterministic tests and embedding. Generation
runs only for generation modes after all required earlier stages succeed.
