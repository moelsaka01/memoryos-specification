# Internal Model

`Specification` is the aggregate root constructed after validation and
dependency resolution. It owns categories, typed objects, relationships,
dependencies, validation-rule declarations, artifact requests, annotations,
and extensions.

`Identifier` and `Version` validate domain primitives. Package, Domain,
Component, Contract, and Requirement use composition rather than runtime
inheritance. Generators receive the model by const reference and do not
reinterpret source YAML.
