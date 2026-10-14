# Disposition of differential-gate generation 1 (preserved, never promoted)

Classification: **HARNESS_DEFECT** (the gate tool's own rule, not the product). Recorded verdict `FAILED_PRESERVED`: zero regressions and zero new failures
were found, but the tool required the failure set of every shared failing unit to be *identical* on both sides. `conformance:mo1308_phase3d_test.mjs`
fails two tests on BASELINE and one on CANDIDATE (`D07 the validator CLI is read-only and its exit code follows the result` passes on the candidate and fails on
BF, because the accepted MO-1308 3D evidence is present on main and not at BF). A3.2 rule 4 only requires shared failures to be listed PRE_EXISTING; a candidate that
fails fewer tests is not a regression. The tool rule was corrected to "the candidate adds no failing test" (`noNewFailures`, with a negative control in
`tests/mo1309_audit_test.mjs`), and generation 2 was run. Generation 1 is kept unedited next to this note.
