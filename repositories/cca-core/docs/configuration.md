# Configuration module

`ConfigurationKey` prevents untyped string keys from leaking through public APIs.
`ConfigurationBuilder` is the sole mutation point; `Configuration` is an immutable
snapshot and can be injected by value or const reference.

```cpp
auto config = cca::core::ConfigurationBuilder{}
                  .set(cca::core::ConfigurationKey{"compiler.mode"}, "validate")
                  .build();

const auto mode =
    config.get_or(cca::core::ConfigurationKey{"compiler.mode"}, "compile");
```

The module does not define a file format, environment-variable mapping, secret
handling policy, or source precedence. Those choices remain specification
ambiguities and must be resolved before source adapters are added.

