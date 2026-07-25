# Parser

`Parser` is the future source-to-syntax boundary. The foundation contract is
`Parser::parse(const ParseRequest&)`, where `ParseRequest::source` names the
source without reading it. Syntax-tree representation and grammar behavior are
deliberately absent.

The default constructor installs null logging and diagnostic sinks. The
dependency-injection constructor accepts shared `ILogger` and
`IDiagnosticSink` instances and rejects null dependencies. An empty path
returns `invalid_argument`; any non-empty path emits `CCA-PARSER-900` and
returns `not_implemented`.
Concurrent calls require thread-safe injected dependencies.

```cpp
#include <cca/compiler/parser.hpp>

cca::compiler::Parser parser;
const auto result = parser.parse({std::filesystem::path{"model.cca"}});
if (result.code() == cca::compiler::StatusCode::not_implemented) {
    // Expected in the foundation release.
}
```

Implementation: `src/parser.cpp`. Test placeholder:
`tests/parser_test.cpp`.
