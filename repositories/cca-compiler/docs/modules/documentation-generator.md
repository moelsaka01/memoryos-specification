# Documentation Generator

`DocumentationGenerator` reserves generation of architecture-approved
documentation. `DocumentationGenerationRequest` contains a source path and an
output directory; the repository defines no documentation syntax or output
format.

Both paths must be non-empty. Complete requests emit
`CCA-DOCUMENTATION-900` and return `not_implemented`; incomplete requests
return `invalid_argument`. No files are read or written.
Concurrent calls require thread-safe injected dependencies.

```cpp
#include <cca/compiler/documentation_generator.hpp>

const cca::compiler::DocumentationGenerator generator;
const auto result = generator.generate({"model.cca", "docs-out"});
```

Implementation: `src/documentation_generator.cpp`. Test placeholder:
`tests/documentation_generator_test.cpp`.
