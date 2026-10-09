# MO-1308 Phase 3 step 3: Windows harness status (3A and 3C)

Status: NOT CERTIFIED. Harness authored; rehearsals are non-certifying and never promotable.

* 3A: all 108 cases implemented (`tools/mo1308-phase3a`, observers under `observers/`, every observer launch recorded). Rehearsal r2
  (`evidence/mo1308/phase3a-rehearsal-r2`): steps A-E PASS; step F stopped at **3A-F7 ESCALATE** (owner decision D6): 2 of 10 F7 runs saw a
  staging EPERM (one record each ended with a typed IO; no contract violation). Q02 outcome recorded CONFIRMED. A rerun needs an owner
  approval reference (protocol 5.5, 8.3). G-M and JC have not run in a rehearsal; they passed individually as development runs.
* 3C: F3 and G2 implemented. Rehearsals r1 (step C over its guard: kept) and r2 (67/67 PASS, all steps inside guards).
* Product observations to classify (not changed): see the task report (D4 staging links followed on create, G3 purge deletes through a swapped
  junction, L3 unhandled EPIPE on a closed stdout pipe, ADS accepted as input, literal trailing-dot/space/reserved ledger names accepted).
* `--tolerate 3A-L3` exists for rehearsals only; a certifying seal refuses it.
