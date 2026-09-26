# MO-1306 Phase 2A — provider-neutral core and generic runner hardening

Phase 2A preserves the B1 interface manifest exactly. The seven pinned exports
and eleven schemas are unchanged. The package now has a closed private provider
IR that validates the frozen pure adapter shape before the generic reference
selects its sole executable adapter. Non-generic names continue to fail as
`MO1306_PROVIDER_UNSUPPORTED`; this phase adds no GitLab, Jenkins, Azure, or
GitHub implementation.

The common equivalence primitive binds PASS, FAIL, COULD_NOT_EVALUATE,
configuration failure, input failure, integrity failure, timeout, and
cancellation to the frozen result validator, exit mapping, and common
projection. It has no provider presentation branches and never examines or
reserializes normative SDK bytes.

The generic core now resolves its generic adapter through the same closed IR
before acquiring configuration or filesystem capabilities. It still invokes
only the existing supervisor/one-child model: no process topology, network
authority, environment allowlist, semantic worker protocol, or frozen limit is
changed. The affected distribution manifest is regenerated canonically.

Native execution evidence is recorded separately. This host has no frozen Node
24.21.0 binary, so the real generic PASS/FAIL/CNE lifecycle witness is
explicitly COULD_NOT_EXECUTE rather than being substituted with another runtime.
Phase 2D must rerun that focused installed witness on the pinned runtime; it
does not need to repeat the Phase 1 resource campaign absent a trigger.
