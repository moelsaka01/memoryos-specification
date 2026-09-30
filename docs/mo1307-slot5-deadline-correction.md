# MO-1307 Phase 3A slot-5 CHECK_OUTPUT deadline correction

The stopped N17 generation established one mandatory failure: the slot-5
CHECK_OUTPUT helper lifecycle did not settle before the frozen 5,000 ms limit.
The engineering `spawnSync` launcher returned after timeout and termination at
5,024.2634 ms with no response or stderr. That record does not localize an
unfinished internal stage, and the return time is not a measured helper
completion time.

The failed 294-byte request and the same-generation passing slot-4 request are
identical except for the sequence byte. Current-helper N15 records also show
both slots completing successfully. The implementation performs no additional
native observation for slot 5.

The authorized correction removes one repeated lexical `Assert-Root` pass from
`Open-Chain`. All three internal call sites receive only paths already admitted
at the closed request boundary: a validated normalized root, that root joined
to a validated relative path under the combined length bound, a shorter
CHECK_OUTPUT parent, or the fixed pending name under its existing bound. The
removed work obtains no native fact.

Every security-authoritative operation remains: initial native chain identity,
exact-leaf absence accepting only `ERROR_FILE_NOT_FOUND`, held-handle
reinspection, fresh reopen and reinspection, final-path checks, seven-field
identity comparison, handle closure, canonical response framing, helper process
termination, and all redirected pipe settlement. Protocol 2.0.0, response and
error semantics, topology, and the 5,000/20,000/30,000/10,000/2,000 ms limits
are unchanged. No cache, retry, grace, epsilon, or timeout forgiveness exists.

Validation is ordered and write-once. Static mechanical inverse and closed-call
site proofs run first without executing the helper. Exactly two uninstrumented
whole-lifecycle witnesses then use the retained byte-exact requests, slot 5
first and slot 4 second, once each. The complete native filesystem suite and
both TOCTOU controls follow only after those gates pass. A first mandatory
failure stops the generation. Passing these correction gates does not accept a
candidate; complete fresh regression/security/package validation and a fresh
installed-runtime A-O generation remain mandatory.
