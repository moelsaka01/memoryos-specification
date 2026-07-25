# Contributing to the CCA reference workspace

The project is at the engineering-foundation stage. Contributions must preserve
architectural clarity and deterministic behavior before optimizing performance
or expanding features.

## Before contributing

1. Read [ARCHITECTURE.md](ARCHITECTURE.md).
2. Check the explicit milestone exclusions in [README.md](README.md).
3. Review [docs/ambiguity-register.md](docs/ambiguity-register.md).
4. Follow [docs/developer-setup.md](docs/developer-setup.md) and
   [docs/build-instructions.md](docs/build-instructions.md).
5. Apply [docs/coding-standards.md](docs/coding-standards.md).

The licensing model and inbound contribution terms are unresolved. Until an
authorized owner resolves that blocker, external contribution intake must not
be assumed to be licensed. See [LICENSE](LICENSE).

## Architecture-first changes

[ARCHITECTURE.md](ARCHITECTURE.md) is authoritative. An implementation change
must not silently introduce a new dependency direction, data model, file
format, execution pipeline, error contract, compatibility promise, or CCA
semantic rule.

If a proposed change needs an architectural decision that is not already
recorded:

1. add or update an entry in the ambiguity register;
2. describe the options and affected components without selecting an option;
3. obtain an explicit architecture decision from the authorized owner;
4. record the decision before implementing it.

Small implementation details that do not affect public contracts or component
boundaries may be handled locally. If there is doubt, treat the issue as
architectural.

## Scope discipline

Current changes may establish workspace infrastructure, shared foundation
interfaces, compiler skeletons, tests, and documentation. Do not add MemoryOS,
AI, reasoning, LLM, database, plugin, or networking behavior. Do not implement
compiler semantics under the label of a placeholder.

## Public interfaces

Every public class must have:

- API documentation that states purpose, ownership, inputs, outputs, errors,
  side effects, determinism, thread-safety status, and milestone limitations;
- a unit-test placeholder or test that establishes its intended seam without
  claiming unimplemented semantics;
- example usage, either adjacent to the owning repository or linked from
  [examples/README.md](examples/README.md).

The full conceptual contract is in
[docs/public-api-contract.md](docs/public-api-contract.md).

## C++ expectations

Use C++23, RAII, strong types, const-correct interfaces, namespaces, and
header/source separation. Use `std::unique_ptr` for sole ownership and
`std::shared_ptr` only when ownership is truly shared. Raw owning pointers,
avoidable global state, and macros other than include guards or `#pragma once`
are not accepted. Prefer dependency injection at system boundaries.

Run the repository's formatting, build, test, and analysis workflows described
in [docs/build-instructions.md](docs/build-instructions.md). Tool availability
and successful local runs must be reported accurately; configured tooling is
not proof that a check passed.

## Change quality

A reviewable change should:

- have one clear purpose;
- keep generated output and local build directories out of source control;
- update documentation when public behavior or developer workflow changes;
- include tests or honest placeholders appropriate to implemented behavior;
- avoid unrelated formatting or refactoring;
- identify unresolved risks or ambiguities in the change description.

Commit and pull-request conventions are not yet standardized. Do not infer a
required branching model, commit-message grammar, or hosting platform until the
project records those decisions.
