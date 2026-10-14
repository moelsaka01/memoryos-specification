# MO-1305 Phase 1 R6 HTTP timeout checkpoint

State: **MO-1305 PHASE 1 BLOCKED**. Verification correction V is
`75cee55784c590bab52feaf8f2214e4d1b9e657f`, with parent
`c2e3835b852fd966046ac9e984538fdcaf8b26bf`. I1 and B1 are absent.

The bounded campaign selected 15 resource vectors at 10 cold and 20 warm
observations each. R6 stopped organically with exit code 1 at
`maximum-permitted-headers`, warm index 2: HTTP 504 instead of the required 200.
It retains campaign UUID `68c962e3-dcd8-4998-a628-4f126ba89ea5`.

The measured source SHA-256 is
`3757c03536d73d0457b901155cab34b5b1c0e410c5a64ed0ba1e9dbbc1007949`.
The 185,947-byte archive SHA-256 is
`dc887ad9ef02358703544d16b5f872dc5588eab38131788f7f08a7b5ca9f045e`.
Both remain frozen under `.cache/mo1305-bounded-r6/frozen-measured/`.

## Evidence retained

- Eleven completed vectors: 330 successful observations.
- Partial maximum-permitted-headers vector: 10 cold and two warm successful
  observations, followed by the separately retained failed request.
- Total retained successful observations: 342 (120 cold, 222 warm).
- All 132 process/collector run identities, native capture data and exits
  validated. Complete vectors and the partial vector retain their original
  completion flags; the partial vector and R6 are not certified PASS.
- 299 output files, 20,884,954 bytes, copied and hash-checked under
  `.cache/mo1305-bounded-r6/recovery-r6-http-timeout/`.
- All 329 frozen repository inputs, eight external identities and 157
  historical R1/R4/R5 repository artifacts reverified unchanged after failure.
- Bounded process inspection found no surviving MO-1305 test process.

The authoritative record is
`repositories/cca-conformance/evidence/mo1305-phase1-measurement-attempt-r6.json`.
Its references preserve raw progress, failed request, diagnostic validation,
input checks and the output-copy manifest. Private test credential contents
are not included in repository evidence.

## Timing diagnosis and limits of the conclusion

The failed operation reports 60,443,611 microseconds in its own monotonic
process domain. The client round trip is 60,496,188 microseconds in the
orchestrator domain. These durations are calculated independently; their
absolute clock epochs are not compared.

The separate native collector recorded a 56.2543816-second capture duration
at sequence 103 during the failed request. Sequence 53 previously recorded
9.7303106 seconds during successful warm index 1. These are same-domain
collector durations. They are consistent with host scheduling or suspension
delays, but do not establish a root cause. A bounded System-event query for
16:15–16:21 UTC on 2026-09-24 returned no entries. No claim of a confirmed
sleep, power, collector or gateway defect is made.

The largest retained successful operation is 14,008,944 microseconds, from
warm index 1 of the partial vector. Its diagnostic headroom calculation is
56,100 ms, within the new 60,000 ms ceiling. It is not a final resource maximum.
The HTTP 504 observation is not a valid successful semantic sample and cannot
justify another ceiling increase. No failed or delayed observation was removed
or silently retried.

## Remaining work

The final resource and variance assessment, selected stress, final limits,
final 105-case functional coverage, all 20 adverse functional cases, final
boundaries/client/security/parity/install/package gates, required regressions,
inventory, PASS receipts, I1, B1 and post-B1 checks remain incomplete. The
updated finalization and receipt tooling has not been validated with final
campaign data.

Further work must first resolve the timeout/capture-stall cause and define a
new bounded attempt with a distinct identity. R6 must remain FAIL. This task
does not launch a replacement campaign, create I1/B1, push or tag. Phase 2,
Phase 3, Windows certification and final binding remain pending. Ubuntu/Linux,
VM and cross-platform parity remain NOT_REQUIRED.
