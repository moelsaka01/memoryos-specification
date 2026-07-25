# Shared versioning

`SemanticVersion` is the public value type. `current_version()` reads values from
the build-generated `<cca/version.hpp>` header, making the root CMake project the
single source of truth.

```cpp
const auto version = cca::core::current_version();
std::cout << version.to_string() << '\n';
```

Release cadence, compatibility guarantees, and multi-repository version alignment
remain open governance decisions.

