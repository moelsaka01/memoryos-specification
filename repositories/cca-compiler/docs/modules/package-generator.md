# Package Generator

`PackageGenerator` reserves assembly of generated files into a future CCA
package. `PackageGenerationRequest::input_directory` names prepared input and
`output_package` names the intended package. The package format is not selected
by this skeleton.

Both paths must be non-empty. Complete requests emit `CCA-PACKAGE-900` and
return `not_implemented`; incomplete requests return `invalid_argument`.
Directories and package paths are not accessed.
Concurrent calls require thread-safe injected dependencies.

```cpp
#include <cca/compiler/package_generator.hpp>

const cca::compiler::PackageGenerator generator;
const auto result = generator.generate({"cca-out", "bundle.cca"});
```

Implementation: `src/package_generator.cpp`. Test placeholder:
`tests/package_generator_test.cpp`.
