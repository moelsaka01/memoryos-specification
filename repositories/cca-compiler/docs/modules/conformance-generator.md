# Conformance Generator

`ConformanceGenerator` reserves generation of future CCA conformance material.
`ConformanceGenerationRequest` contains a source path and output directory.
Suite schemas, runners, and assertions are intentionally undefined.

Both paths must be non-empty. Complete requests emit
`CCA-CONFORMANCE-900` and return `not_implemented`; incomplete requests return
`invalid_argument`. The implementation performs no I/O.
Concurrent calls require thread-safe injected dependencies.

```cpp
#include <cca/compiler/conformance_generator.hpp>

const cca::compiler::ConformanceGenerator generator;
const auto result = generator.generate({"model.cca", "conformance-out"});
```

Implementation: `src/conformance_generator.cpp`. Test placeholder:
`tests/conformance_generator_test.cpp`.
