# MO-1307 final prospective aggregate-helper authority

Status: **`PROSPECTIVE_HELPER_AGGREGATE_BOUND@2.0.0` ADOPTED / C3V PREPARED FOR BINDING**.

The final prospective helper-active aggregate ceiling is 28,000 ms. Aggregate
acceptance requires helper-active time strictly below 28,000 ms; equality or
later is `MO1307_TIMEOUT`. The unchanged runtime formula selects the earliest
of the absolute CLI deadline, the 9,000 ms whole-helper deadline, and the
remaining aggregate-helper allowance.

This authority changes only the aggregate helper-active value from 20,000 ms
to 28,000 ms. It preserves `PROSPECTIVE_HELPER_BOUND@2.0.0`, including helper
success `< 9000 ms` and timeout `>= 9000 ms`; the CLI ceiling remains 30,000
ms, API and worker ceilings remain 10,000 ms, and terminal-failure cleanup
remains 2,000 ms. Neither 9,000 ms nor 28,000 ms is historical H; H remains
`NOT_ESTABLISHED`.

The correction is derived from C3UB and preserves its security, native
filesystem, headless-process, publication, and finalization behavior. The
wire stays 2.0.0, all 52 schemas and generated schema data are unchanged, the
package remains exactly 89 members with zero external production dependencies,
and no helper topology or PowerShell architecture changes are introduced.

C3V is the production candidate and C3VB is its binding-only child. The failed
C3TB and C3UB Phase 3AR2 generations, the C3UB B failure, and the stopped
diagnostic remain immutable ancestry. No prior Phase 3A result is promoted.
Phase 3BR2 commit `4d92f0f21c9c3aad8202f4558d61b9229c7214fc` remains preserved and is not
rerun. Phase 3CR2 and Phase 3D are not performed by this adoption.
