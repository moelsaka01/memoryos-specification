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

export const knownFindings = {};
export const impls = implemented;

// Declared host-only: not runnable on this host class, or an input that is not a program.
export const hostOnly = {
  '3C-F3': 'HOST_ONLY: links and junctions inside an export directory need NTFS reparse points (Step 3 Windows harness)',
  '3C-G2': 'HOST_ONLY: needs the MO-1307 native evaluate, which exists only on the Windows reference host',
};
