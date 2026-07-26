# Validator

`Validator::validate(const ParsedDocument&)` enforces the Canonical
Specification 1.0 schema profile before semantic analysis.

```cpp
#include <cca/compiler/validator.hpp>

const cca::compiler::Validator validator;
const cca::compiler::ValidationResult validation =
    validator.validate(parsed_document);
if (validation.has_errors()) {
    // Do not continue to dependent stages.
}
```

The validator checks schema identity, format major, required fields, closed
records, metadata, identifiers, versions, object types, rule severities, and
artifact shapes. It accumulates independent schema errors in deterministic
order.

Duplicate identity, reference resolution, duplicate relationship edges, and
dependency cycles are semantic stages rather than schema checks.
