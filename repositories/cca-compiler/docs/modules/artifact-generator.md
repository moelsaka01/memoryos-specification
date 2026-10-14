# Artifact Generator

`ArtifactGenerator::generate()` receives a validated `Specification`, the
accumulated validation result, and an explicit output directory.

```cpp
#include <cca/compiler/artifact_generator.hpp>

const cca::compiler::ArtifactGenerator generator;
const auto result =
    generator.generate(specification, validation, "cca-out");
```

It writes the fixed IS-002 documentation index, dependency graph,
specification report, validation report, object inventory, architecture
summary, and generated-code placeholder README. Returned file paths identify
successful outputs.

Generation is deterministic and performs no source parsing, dependency lookup,
network access, package creation, or production code generation. An I/O failure
returns an artifact diagnostic and no successful file list.
