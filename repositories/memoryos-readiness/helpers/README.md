# Fixed Windows helper foundation

`windows-inspect.ps1` is the fixed Windows PowerShell 5.1 protocol foundation.
It validates a bounded request and returns a closed `ERROR/MO1307_INTERNAL`
response for valid requests. It performs no acquisition, creates no files, and
does not claim that any path or handle has passed native inspection. Full
checked-handle acquisition and CLI orchestration belong to Phase 2C.

The caller uses the trusted installation's absolute Windows directory followed
by `System32/WindowsPowerShell/v1.0/powershell.exe`, with fixed `-NoLogo
-NoProfile -NonInteractive -File <absolute-packaged-script>` arguments. Its only
environment entries are the validated `SystemRoot` and `WINDIR`. It supplies
one frame and closes stdin, bounds the helper to 5 seconds within the remaining
CLI budget, accepts no overlapping helper or evaluation worker, and bounds
stdout to 16,777,216 bytes. These caller responsibilities are represented by
the pure admission interface and native test; no product process orchestration
is implemented in this foundation.

The engineering native test adds the fixed process-only `-ExecutionPolicy
Bypass` option, following the retained MO-1306 engineering harness precedent
when Windows PowerShell's policy scopes are undefined/default Restricted. It
does not change machine, user or enterprise policy. No product launcher or
policy override is implemented by the Phase 1 CLI guard.

Each frame is a four-byte unsigned big-endian body length followed by precisely
one canonical JSON value and its LF. The request ceiling (65,536 bytes) and
response ceiling include the header. The JavaScript definitions are authoritative
for the private closed field representation. Requests carry sorted root
capabilities and sorted logical file IDs with explicit relative paths and caps.
The serial sequence is config/authority, candidate/manifest, evidence files,
then result/decision or CHECK_OUTPUT. A failed or outstanding request cannot be
retried within a sequence. No commands, script strings or discovery are accepted.

READ_SET success responses will carry checked root/file identities and canonical
base64 snapshots in `bytes` arrays of 4096-character chunks (the final chunk may
be shorter; an empty snapshot is an empty array). Chunking preserves the JSON
string ceiling. The decoder checks the encoded bound before decoding and then
checks each decoded byte count and the 8,388,608-byte evidence aggregate.
CHECK_OUTPUT success identifies the existing parent and says `ABSENT`; it cannot
invent an identity for an absent output directory. Error responses carry no
paths, contents, exception details or identities. No success response is emitted
by this Phase 1 helper.

Publication primitives require an explicit trusted native inspection hook;
there is no Node-lstat fallback claiming complete Windows reparse checks. An
opaque token binds an exclusively created directory, one exclusive pending file,
exact bytes and checked identities. Finalization is single use and the same
directory rename is the commit point. It rejects a destination present at the
last absence check. Node's Windows rename can replace a file at the kernel
level, so nonreplacement relies on Freeze section 17's explicit private,
exclusive roots and absence of concurrent adversarial namespace mutation.
It does not claim a syscall guarantee against an excluded concurrent attacker.
Failures retain owned pending bytes; there is no completion marker or cleanup
that deletes failed attempts.
