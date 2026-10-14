# Source Loader

`ISourceLoader` is the input dependency seam. `FileSourceLoader` reads the
explicit filesystem path into `SourceDocument`; tests may inject an in-memory
implementation.

```cpp
#include <cca/compiler/source_loader.hpp>

const cca::compiler::FileSourceLoader loader;
const auto result = loader.load("specification.yaml");
if (!result.ok()) {
    // Inspect result.validation.diagnostics().
}
```

The loader does not search parent directories, read environment variables, or
access the network. Returned diagnostics carry the requested path and a stable
source-category identity.
