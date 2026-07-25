# Artifact Generator

`ArtifactGenerator` reserves the boundary for future compiled artifacts.
`ArtifactGenerationRequest::source` names an input and
`output_directory` names the intended destination. Artifact schemas and writes
are not part of this milestone.

Both paths are required. An incomplete request returns `invalid_argument`; a
complete request emits `CCA-ARTIFACT-900` and returns `not_implemented`.
Neither path is inspected or created.
Concurrent calls require thread-safe injected dependencies.

```cpp
#include <cca/compiler/artifact_generator.hpp>

const cca::compiler::ArtifactGenerator generator;
const auto result = generator.generate({"model.cca", "cca-out"});
```

Implementation: `src/artifact_generator.cpp`. Test placeholder:
`tests/artifact_generator_test.cpp`.
