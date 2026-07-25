# CLI

`Cli` dispatches arguments supplied without the executable name. It owns a
pImpl and a `CompilerConfiguration`, while the injected output and error
streams remain caller-owned. `src/main.cpp` is the executable composition root.

Foundation-release exit codes are deterministic: success `0`, usage error `2`,
unavailable placeholder `69`, and internal software error `70`. They are not a
long-term compatibility promise. No arguments and `help` print help; `version`
prints the canonical generated workspace version; `doctor` reports foundation
readiness. `compile`, `validate`, and `generate` require a source then report
that the operation is unavailable.
`Cli` does not synchronize its caller-owned streams and is not safe for
concurrent `run()` calls without external synchronization.

```cpp
#include <array>
#include <sstream>
#include <string_view>

#include <cca/compiler/cli.hpp>

std::ostringstream output;
std::ostringstream error;
const cca::compiler::Cli cli{output, error};
const std::array<std::string_view, 1> arguments{"doctor"};
const int exit_status = cli.run(arguments);
```

Implementation: `src/cli.cpp` and `src/main.cpp`. Test placeholder:
`tests/cli_test.cpp`.
