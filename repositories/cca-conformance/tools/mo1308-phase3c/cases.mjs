// MO-1308 Phase 3C: all case implementations, and the declaration of those that cannot run in the cloud.
import { makeEnv } from './env.mjs';
import { tamper } from './cases-tamper.mjs';
import { admission } from './cases-admission.mjs';
import { sha } from './cases-sha.mjs';
import { purge } from './cases-purge.mjs';
import { data } from './cases-data.mjs';
import { authority } from './cases-authority.mjs';
import { hostileCases } from './cases-hostile.mjs';
import { linkCases } from './cases-links.mjs';
import { nativeCases } from './cases-native.mjs';

export { makeEnv };
const implemented = { ...tamper, ...admission, ...sha, ...purge, ...data, ...authority, ...hostileCases, ...linkCases, ...nativeCases };

export const knownFindings = {};
export const impls = implemented;

// Nothing is declared host-only any more: F3 and G2 are implemented by the Windows harness (links.mjs, cases-links.mjs, cases-native.mjs).
export const hostOnly = {};
