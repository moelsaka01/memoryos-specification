#pragma once

#include <string_view>

namespace cca::compiler::test {

inline constexpr std::string_view valid_specification{
    R"yaml($schema: cca://schemas/canonical-specification/1.0
format_version: 1.0.0
kind: canonical_specification
id: example.architecture
version: 1.2.0
metadata:
  name: Example Architecture
  description: Architecture-neutral compiler fixture.
  authors: [CCA Test]
  labels:
    stability: test
categories:
  - id: architecture
    name: Architecture
    description: Structural objects.
    annotations: {}
    extensions: {}
  - id: contracts
    name: Contracts
    annotations: {}
    extensions: {}
  - id: requirements
    name: Requirements
    annotations: {}
    extensions: {}
objects:
  - type: package
    id: example.package
    version: 1.0.0
    category: architecture
    metadata:
      name: Example Package
    members: [example.domain]
    properties: {}
    annotations: {}
    extensions: {}
  - type: domain
    id: example.domain
    version: 1.0.0
    category: architecture
    metadata:
      name: Example Domain
    components: [example.component]
    properties: {}
    annotations: {}
    extensions: {}
  - type: component
    id: example.component
    version: 1.1.0
    category: architecture
    metadata:
      name: Example Component
    contracts: [example.contract]
    requirements: [example.requirement]
    properties:
      role: coordinator
    annotations: {}
    extensions: {}
  - type: contract
    id: example.contract
    version: 1.0.0
    category: contracts
    metadata:
      name: Example Contract
    properties: {}
    annotations: {}
    extensions: {}
  - type: requirement
    id: example.requirement
    version: 1.0.0
    category: requirements
    metadata:
      name: Example Requirement
    satisfied_by: [example.component]
    properties: {}
    annotations: {}
    extensions: {}
relationships:
  - id: example.relationship
    type: exposes
    source: example.component
    target: example.contract
    metadata:
      name: Component exposes contract
    annotations: {}
    extensions: {}
dependencies:
  - id: example.dependency
    source: example.component
    target: example.contract
    version: ^1.0.0
    optional: false
    metadata:
      name: Contract dependency
    annotations: {}
    extensions: {}
validation_rules:
  - id: example.rule
    category: architecture
    severity: warning
    expression: objects.size > 0
    message: A specification should contain objects.
    suggestion: Add at least one object.
    annotations: {}
    extensions: {}
artifacts:
  - id: example.report
    type: specification_report
    output: specification-report.json
    options: {}
    annotations: {}
    extensions: {}
annotations: {}
extensions: {}
)yaml"};

} // namespace cca::compiler::test
