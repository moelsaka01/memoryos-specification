# Shared versioning

`SemanticVersion` is the public value type. `current_version()` reads values from
the build-generated `<cca/version.hpp>` header, making the root CMake project the
single source of truth.

```cpp
const auto version = cca::core::current_version();
std::cout << version.to_string() << '\n';
```

## MemoryOS Standard scope

CCA-MEMORYOS-1.0 independently versions the MemoryOS Standard, Reference
Implementation, MIP format, Investigation Core, adapter contract, SDK, CLI,
Regression report, Explorer result, and conformance suite. MemoryOS 1.2.0 is
the initial Reference Implementation assessed against Standard 1.0; matching
component version numbers are not implied and implementation documentation is
not normative. See the
[official conformance suite](../../cca-conformance/README.md).

General CCA release cadence, C++ API/ABI and source-compatibility guarantees,
and multi-repository version alignment outside that MemoryOS assessment remain
open governance decisions.
