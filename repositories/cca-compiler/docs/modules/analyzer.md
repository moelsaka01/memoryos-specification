# Analyzer

`Analyzer` reserves the semantic-analysis boundary. The foundation method
`Analyzer::analyze(const AnalysisRequest&)` accepts
`AnalysisRequest::source`; no semantic model, symbol table, or reasoning logic
is defined.

Empty paths return `invalid_argument`. Non-empty paths emit
`CCA-ANALYZER-900` and return `not_implemented`. The module supports the same
null-object defaults and injected logger/diagnostic dependencies as the parser
and validator.
Concurrent calls require thread-safe injected dependencies.

```cpp
#include <cca/compiler/analyzer.hpp>

const cca::compiler::Analyzer analyzer;
const auto result = analyzer.analyze({"model.cca"});
```

Implementation: `src/analyzer.cpp`. Test placeholder:
`tests/analyzer_test.cpp`.
