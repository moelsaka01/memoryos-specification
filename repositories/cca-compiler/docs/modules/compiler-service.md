# Compiler Service

`CompilerCommandService` adapts `CompilerPipeline` to the `ICommandService`
boundary consumed by `Cli`. It maps the four public commands to pipeline modes,
serializes a deterministic JSON result, and maps validation failures to
`CliExitCode::validation_error`.

The default constructor composes a production pipeline. Tests and embedders can
inject a shared immutable pipeline:

```cpp
auto pipeline = std::make_shared<cca::compiler::CompilerPipeline>(loader);
cca::compiler::CompilerCommandService service{pipeline};
const auto result = service.execute({
    .command = cca::compiler::CompilerCommand::validate,
    .source = "specification.yaml",
    .output_directory = "cca-out",
});
```

The service owns no global state. The returned JSON contains the command,
dependency order, generated files, completed stages, status, analysis summary,
and structured validation report.
