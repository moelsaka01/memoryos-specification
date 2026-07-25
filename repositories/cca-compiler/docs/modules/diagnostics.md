# Diagnostics

`Status` is the synchronous operation outcome. `IDiagnosticSink` receives
structured, potentially multiple diagnostics. `NullDiagnosticSink` discards
them; `CollectingDiagnosticSink` stores them behind a mutex and returns snapshot
copies.
`NullDiagnosticSink` is stateless and `CollectingDiagnosticSink` is safe for
concurrent `report()`, `snapshot()`, and `clear()` calls. Other sink
implementations define their own synchronization. `Status` supports concurrent
read-only access.

`StatusCode` values intentionally align with CLI outcomes where applicable:
success `0`, invalid argument `2`, not implemented `69`, and internal error
`70`. Module-specific identifiers are deterministic foundation values; their
long-term format and compatibility policy remain unspecified.

```cpp
#include <memory>

#include <cca/compiler/diagnostics.hpp>

std::shared_ptr<cca::compiler::IDiagnosticSink> ignored =
    std::make_shared<cca::compiler::NullDiagnosticSink>();
ignored->report({
    cca::compiler::DiagnosticSeverity::note,
    "CCA-EXAMPLE-000",
    "discarded",
});

auto diagnostics =
    std::make_shared<cca::compiler::CollectingDiagnosticSink>();
diagnostics->report({
    cca::compiler::DiagnosticSeverity::note,
    "CCA-EXAMPLE-001",
    "example",
});
const auto snapshot = diagnostics->snapshot();
const auto status = cca::compiler::Status::not_implemented("placeholder");
```

Implementation: `src/diagnostics.cpp`. Test placeholder:
`tests/diagnostics_test.cpp`.
