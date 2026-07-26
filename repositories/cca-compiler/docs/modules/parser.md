# Parser

`Parser::parse(const SourceDocument&)` converts one loaded UTF-8 YAML document
to a `ParsedDocument`. The recursive `CanonicalValue` result is independent of
yaml-cpp and preserves 1-based source locations for diagnostics.

```cpp
#include <cca/compiler/parser.hpp>
#include <cca/compiler/source_loader.hpp>

const cca::compiler::FileSourceLoader loader;
const auto loaded = loader.load("specification.yaml");
if (loaded.ok()) {
    const cca::compiler::Parser parser;
    const auto parsed = parser.parse(*loaded.document);
}
```

Malformed YAML, multiple documents, or unsupported source values produce
structured syntax diagnostics. Parsing does not perform schema or reference
validation and does not build the internal model.

The path-only `ParseRequest` overload is retained for IM-001 source
compatibility. New orchestration loads explicitly and uses the typed result.
