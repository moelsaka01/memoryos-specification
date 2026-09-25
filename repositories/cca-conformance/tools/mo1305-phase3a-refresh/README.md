# MO-1305 Phase 3A targeted Windows refresh

Certification tooling only. The release candidate is C3
`62a70cafac68e89366740ec197074bd13fbce934`, bound by C3B
`4ac43c4368f41ec14ea443aa303bf3a69503f2de`.
The corrected archive must be 191823 bytes with SHA-256
`faac95f7ad8939bcf7bbc33952efabebc1468d0c5654ea3eaac03f40402a7382`.
No production file is modified. Original Phase 3A evidence remains in Git at
`9bb679532b90016b9cc30bf5e1cdb41d376e2ff7` and is never rewritten.

Run from the dedicated `mo1305/phase3a-refresh` checkout with the explicit trusted
Python executable and `.cache/mo1304-phase3-toolchain/node-v24.21.0-win-x64/node.exe`.
The schema runtime is the complete identity-pinned cache documented by the
unchanged release-correction tooling. A copied cache is an engineering input,
not a product dependency.

1. `python -B -X utf8 repositories/cca-conformance/tools/mo1305-phase3a-refresh/preflight.py`
   runs all structural checks before runtime execution. Its `--check` mode is
   read-only and recomputes the receipt. It validates correction graph/evidence
   using fixed Git objects rather than the historical gate's `main` assumption.
2. Run `python -B -X utf8 repositories/cca-conformance/tools/mo1305-phase3a-refresh/capture.py` to record the executed harness inventory, then run `prepare.py` once. This
   detects the actual Windows host, verifies the full trusted toolchain, performs
   one external offline npm installation with an empty explicit cache, checks
   all 58 files and metadata, copies an independent SDK oracle from authoritative
   source files, and prepares private temporary test credentials.
3. Run `execute.mjs` with trusted Node. The gateway and clients use only the
   external installation/copied tools. The checkout is not hidden by the OS;
   source independence is established through verified closed imports, copied
   inputs, absolute paths, an empty service cwd, and a restricted environment.
4. `finish.py` verifies all installed hashes after execution and empty service
   cwd/temp directories, scans retained results for actual secret values, then
   removes only the task-owned external private credential directory. The
   non-secret installed package is retained for review.
5. Build and check the new canonical receipt using `validator.py`; run its
   mutation selftests, structural replay, workspace verification and
   `git diff --check`. These validators do not execute another gateway campaign.

The original resource characterization and accepted Windows limits campaign
remain reusable only through exact runtime/limits identity. The live semantic
deadline remains 31400 ms; the absolute policy ceiling remains 60000 ms. Fresh
checks cover bounded limit enforcement without rerunning resource measurement.

Modern Standby is evaluated with the unchanged host-guard policy and captured
Kernel-Power events. Preserve any interrupted attempt as `HOST_INTERRUPTED` and
replace only its affected probe group with its prerequisites; do not rerun the
entire historical campaign. The probe supports `--group=<name>` after its seven
positional inputs. Unknown host evidence is not reclassified as a proven sleep.

The historical helper files listed in `historical-harness.json` are copied
byte-for-byte from the original certification. The bounded fetch helper and
probe are refresh-owned adaptations. Tooling identities are captured before
execution, separate from later receipt-validator identities.

Remote evidence is limited to an assigned RFC1918 address on this same Windows
host. It does not establish off-host, public/wildcard, cloud, OS sandbox, or
firewall isolation. URL-acquisition evidence covers the supplied calibrated
loopback sentinel; it is not a system-wide network-denial claim. Trusted-launch
preload refusal does not imply an entrypoint can undo preloaded hostile code.

The commit is certification tooling/evidence/report only, parented directly by
C3B. Phase 3D must integrate this refresh together with independently completed
3B-R and 3C-R results; release binding and tagging are not performed here.