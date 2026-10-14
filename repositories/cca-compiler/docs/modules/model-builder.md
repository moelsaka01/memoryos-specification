# Model Builder

`ModelBuilder::build(const ParsedDocument&)` converts a schema-valid canonical
tree into the typed `Specification` model. It performs no I/O and does not
repeat semantic analysis or dependency resolution.

The builder preserves metadata, properties, annotations, extensions,
categories, typed object references, relationships, dependencies, declared
validation rules, and artifact requests. Defensive construction failures
produce `CCA-MODEL-001`; normal orchestration calls this stage only after
validation and dependency resolution succeed.

```cpp
const cca::compiler::ModelBuilder builder;
const auto result = builder.build(parsed_document);
if (result.ok()) {
    const auto& specification = *result.specification;
}
```
