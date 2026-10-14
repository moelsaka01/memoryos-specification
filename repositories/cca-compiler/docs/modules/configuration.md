# Configuration

`CompilerConfiguration` is an immutable process-level value containing the
output directory, minimum log level, and diagnostics-enabled flag. Defaults are
`cca-out`, `LogLevel::info`, and enabled diagnostics.

`validate()` checks only that the configured output directory is non-empty.
Configuration files, environment variables, command-line merging, and schema
selection remain future architecture decisions.
The value has no mutating operations and supports concurrent read-only access.

```cpp
#include <cca/compiler/configuration.hpp>

const auto configuration =
    cca::compiler::CompilerConfiguration::defaults();
if (!configuration.validate().ok()) {
    // Reject configuration before composing compiler modules.
}
```

Implementation: `src/configuration.cpp`. Tests:
`tests/configuration_test.cpp`.
