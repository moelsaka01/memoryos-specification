# Validator

`Validator` is the future validation-rule boundary.
`Validator::validate(const ValidationRequest&)` accepts a source path but does
not inspect it. Rule definitions, validation phases, and parsed-model contracts
remain deferred.

An empty `ValidationRequest::source` returns `invalid_argument`. A non-empty
source emits `CCA-VALIDATOR-900` through the injected diagnostic sink and
returns `not_implemented`. Default construction uses null sinks; callers may
inject shared `ILogger` and `IDiagnosticSink` instances.
Concurrent calls require thread-safe injected dependencies.

```cpp
#include <cca/compiler/validator.hpp>

const cca::compiler::Validator validator;
const auto result = validator.validate({"model.cca"});
```

Implementation: `src/validator.cpp`. Test placeholder:
`tests/validator_test.cpp`.
