# Diagnostics

`Diagnostic` carries stable identifier, compact code, severity, message,
suggestion, source location, and category. `ValidationResult` owns and
deterministically orders diagnostics accumulated across stages.

```cpp
#include <cca/compiler/diagnostics.hpp>

cca::compiler::ValidationResult validation;
validation.add({
    "cca.example.invalid",
    "CCA-EXAMPLE-001",
    cca::compiler::DiagnosticSeverity::error,
    "Example value is invalid.",
    "Replace it with a canonical value.",
    {"specification.yaml", 4, 3},
    "example",
});
validation.sort();
```

`IDiagnosticSink` supports embedding. `NullDiagnosticSink` discards reports;
`CollectingDiagnosticSink` owns thread-safe in-memory copies. Returned
`ValidationResult` remains the operation result, while logging is separate
operational observation.

`Status` remains for compact compatibility operations. New typed compiler
stages return a domain result plus validation.
