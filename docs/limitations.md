# IS-002 limitations and exclusions

IS-002 is a working Standards Compiler for one canonical format. It is not a
CCA runtime or a general-purpose compiler platform.

## Implemented boundary

- one UTF-8 YAML document;
- Canonical Specification format major version 1;
- five architecture-neutral object types;
- built-in schema and semantic validation;
- in-document reference and dependency resolution;
- typed internal model;
- deterministic Markdown, Mermaid, and JSON reports;
- four compiler CLI operations.

## Deliberate limitations

- The compiler implements the canonical schema profile; it is not a reusable
  JSON Schema evaluation library.
- YAML aliases, custom tags, multiple documents, and non-JSON scalar types are
  outside the canonical profile.
- Dependency resolution is in-document. There is no registry, download,
  package manager, lock file, or remote resolver.
- Custom validation-rule expressions are preserved but not executed.
- Extensions are preserved data; they are not dynamically loaded behavior.
- Generation writes a fixed bundle and is not transactional or incremental.
- The output directory has no rollback, signing, provenance attestation, or
  concurrent-writer coordination.
- `generated/README.md` is a placeholder; no production code is emitted.
- Compatibility is defined for canonical format 1.x, not as a frozen C++ ABI.
- Cross-platform source support is an engineering target; each platform still
  requires recorded build and test evidence.

## Explicitly out of scope

The milestone contains no:

- MemoryOS or other runtime implementation;
- cognition, reasoning, machine learning, AI, or LLM integration;
- database, persistence, cache, or event store;
- plugin loader or executable extension system;
- network protocol, service, client, or registry;
- Studio/frontend application;
- SDK or language binding;
- conformance certification engine;
- package manager, installer, or deployment system;
- generated production source or binary;
- authentication, authorization, telemetry, or cloud integration.

Reserved repository directories remain empty boundaries and do not imply these
features exist.

## Recommended IS-003

The next increment should harden the specification/compiler contract before
adding another subsystem:

1. publish a diagnostic compatibility catalog and golden JSON fixtures;
2. define schema-minor migration and deprecation rules;
3. add a governed custom validation-rule language or explicitly defer it;
4. add source spans and traceability from requirements to generated reports;
5. define atomic output and reproducibility-manifest behavior;
6. expand cross-platform, fuzz, malformed-input, and performance tests;
7. record dependency supply-chain and release policies;
8. resolve licensing and contribution governance.

IS-003 should not begin MemoryOS, AI, networking, plugins, persistence, Studio,
or production code generation without a separate approved architecture.
