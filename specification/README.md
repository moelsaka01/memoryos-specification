# CCA specification boundary

This directory is reserved for the authoritative Cognitive Computing
Architecture specification and its governed supporting material.

No CCA specification was supplied for the engineering-foundation milestone, so
this directory deliberately contains no invented:

- source grammar or syntax;
- semantic model or terminology definitions;
- compiler stage contracts or intermediate representations;
- validation or analysis rules;
- artifact, documentation, conformance, or package schemas;
- MemoryOS, AI, reasoning, LLM, database, plugin, or network behavior.

Compiler headers, placeholder statuses, tests, class names, and examples are
engineering seams. They are not normative CCA semantics.

Before normative material is added here, an authorized project owner must
identify the specification authority, provenance, version, change-control
process, normative language, and relationship to conformance evidence. This is
the blocker recorded as CCA-A002 in the
[ambiguity register](../docs/ambiguity-register.md).

The workspace [architecture](../ARCHITECTURE.md) remains authoritative for
implementation boundaries. A future CCA specification will define domain
semantics only through an explicitly approved relationship to that
architecture; code must never silently redefine either record.
