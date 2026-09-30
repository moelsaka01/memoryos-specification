# MO-1307 slot-5 deadline correction validation

This write-once engineering harness binds the one production optimization and
executes four ordered gates: static mechanical equivalence/security, exactly two
uninstrumented CHECK_OUTPUT lifecycle witnesses, the complete native filesystem
suite, and both native TOCTOU controls. Each stage rechecks the same 89-member
source identity and its immediate predecessor. A first failure writes
`generation-stopped.json`; no later stage or retry is permitted.

The equivalence stage executes no helper and supplies no performance result. The
performance stage executes the retained byte-exact N17 slot-5 request first and
the retained byte-exact slot-4 comparator second, once each, under the unchanged
5,000 ms whole-lifecycle limit. The filesystem stage retains 35 cases and 39
helper invocations. The TOCTOU stage retains the two reversible-copy controls.

These correction gates do not accept a Phase 3A candidate. If they all pass, a
separately sealed coherent validation generation must execute every required
regression and security obligation fresh before candidate creation.
