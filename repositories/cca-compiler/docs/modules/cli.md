# CLI

`Cli` parses arguments supplied without the executable name and delegates
compiler operations through `ICommandService`. The executable composes
`CompilerCommandService` with `CompilerPipeline`.

```cpp
#include <array>
#include <sstream>
#include <string_view>

#include <cca/compiler/cli.hpp>

std::ostringstream output;
std::ostringstream error;
const cca::compiler::Cli cli{output, error, command_service};
const std::array<std::string_view, 2> arguments{
    "validate", "specification.yaml"};
const int status = cli.run(arguments);
```

Compiler commands are `validate`, `analyze`, `compile`, and `report`. `-o` or
`--output` supplies an explicit output directory. Compiler results are
deterministic JSON; failures are written to the injected error stream.

The streams remain caller-owned and must outlive `Cli`. Concurrent `run()`
calls require external synchronization.
