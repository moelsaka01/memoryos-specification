# Analyzer

`Analyzer::analyze(const ParsedDocument&)` performs deterministic semantic
checks after schema validation. It builds an object symbol table, validates
identities and references, detects duplicate relationship edges, and returns
an `AnalysisSummary`.

```cpp
#include <cca/compiler/analyzer.hpp>

const cca::compiler::Analyzer analyzer;
const auto result = analyzer.analyze(parsed_document);
if (result.ok()) {
    const auto total = result.summary.object_count();
}
```

The summary contains object counts by type, a lexically ordered identifier
list, and relationship/dependency counts. Dependency cycle and version
constraint resolution belong to `DependencyResolver`.

The path-only `AnalysisRequest` overload remains a compatibility seam and is
not the pipeline entry point.
