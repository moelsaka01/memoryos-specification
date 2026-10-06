// MO-1308 Phase 3C: all case implementations, and the declaration of those that cannot run in the cloud.
import { makeEnv } from './env.mjs';
import { tamper } from './cases-tamper.mjs';
import { admission } from './cases-admission.mjs';
import { sha } from './cases-sha.mjs';
import { purge } from './cases-purge.mjs';
import { data } from './cases-data.mjs';
import { authority } from './cases-authority.mjs';
import { hostileCases } from './cases-hostile.mjs';

export { makeEnv };
const implemented = { ...tamper, ...admission, ...sha, ...purge, ...data, ...authority, ...hostileCases };

// Cases that fail today for a documented reason. A certifying generation runs them unchanged and they fail for real; only a
// non-certifying rehearsal turns the failure into a visible skip, so a rehearsal can complete without hiding anything.
const PENDING_DOCUMENTATION = 'PENDING: the CLI documents do not yet describe the history namespace (written after the qualification outcomes are recorded)';
const KNOWN_FINDING = {
  '3C-F4': 'KNOWN_FINDING: `history export --output` accepts a path inside the ledger directory and corrupts the ledger (reported to the owner as a candidate product defect)',
  '3C-G4': PENDING_DOCUMENTATION, '3C-K1': PENDING_DOCUMENTATION, '3C-K2': PENDING_DOCUMENTATION, '3C-K3': PENDING_DOCUMENTATION,
};
export const knownFindings = KNOWN_FINDING;
export const impls = Object.fromEntries(Object.entries(implemented).map(([id, impl]) => [id, KNOWN_FINDING[id] === undefined ? impl : async (handle, env) => {
  try { return await impl(handle, env); } catch (error) {
    if (env.certifying !== false) throw error;
    handle.observe({ rehearsalOnly: true, problem: String(error.message).slice(0, 300) });
    return handle.skip(KNOWN_FINDING[id]);
  }
}]));

// Declared host-only: not runnable on this host class, or an input that is not a program.
export const hostOnly = {
  '3C-D9': 'REVIEW_INPUT: the independent sub-agent review of the hand-written SHA-256 is a recorded input, not a program',
  '3C-F3': 'HOST_ONLY: links and junctions inside an export directory need NTFS reparse points (Step 3 Windows harness)',
  '3C-G2': 'HOST_ONLY: needs the MO-1307 native evaluate, which exists only on the Windows reference host',
};
