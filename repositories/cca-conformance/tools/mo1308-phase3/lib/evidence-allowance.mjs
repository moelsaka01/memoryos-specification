// MO-1308 Phase 3 shared library: which evidence a stream branch may carry beside the candidate (A8.9, A8.10).
//  * the owner's recorded A3.x precondition evidence: evidence/mo1308/phase3-precondition(-gN)/
//  * the protocol's rehearsal evidence (section 5.3): evidence/mo1308/phase3<a|b|c|d>-rehearsal-rN/
//  * the independent harness review record of a stream (protocol: a sealed input): exactly evidence/mo1308/phase3<a|b|c|d>-harness-review/review.json, nothing else in that directory
//  * a certifying generation directory (A8.10): evidence/mo1308/phase3<a|b|c|d>(-gN)/, but ONLY when its evidence seal verifies under the protocol
//    (verifyEvidence); a certifying directory that does not verify, and every other evidence path, is rejected.
import path from 'node:path';
import { verifyEvidence } from './runner.mjs';

const PRECONDITION = /\/evidence\/mo1308\/phase3-precondition(-g\d+)?\//u;
const REHEARSAL = /\/evidence\/mo1308\/phase3[abcd]-rehearsal-r\d+\//u;
const REVIEW = /\/evidence\/mo1308\/phase3[abcd]-harness-review\/review\.json$/u;
const CERTIFYING = /^(.*\/evidence\/mo1308\/(phase3[abcd](?:-g\d+)?))\//u;

// { kind, directory } for an evidence path; kind is null when the path is not allowed.
export function classifyEvidencePath(name) {
  if (PRECONDITION.test(name)) return { kind: 'PRECONDITION', directory: null };
  if (REHEARSAL.test(name)) return { kind: 'REHEARSAL', directory: null };
  if (REVIEW.test(name)) return { kind: 'REVIEW', directory: null };
  const match = CERTIFYING.exec(name);
  if (match) return { kind: 'CERTIFYING', directory: match[1] };
  return { kind: null, directory: null };
}

// The problems (empty when every evidence path in `names` is allowed). Each certifying directory is verified once, from `root`.
export function checkEvidenceAllowance({ root, names, inventory }) {
  const problems = [];
  const verified = new Map();
  for (const name of names) {
    if (!name.includes('/evidence/')) continue;
    const { kind, directory } = classifyEvidencePath(name);
    if (kind === null) { problems.push(`${name}: only A3.x precondition evidence, protocol-defined rehearsal evidence and sealed certifying generations may be carried`); continue; }
    if (kind !== 'CERTIFYING' || verified.has(directory)) continue;
    const result = verifyEvidence({ root, evidenceDir: path.join(root, ...directory.split('/')), inventory });
    verified.set(directory, result.problems);
    for (const problem of result.problems) problems.push(`${directory}: the certifying generation does not verify: ${problem}`);
  }
  return problems;
}
