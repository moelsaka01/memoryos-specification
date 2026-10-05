// MO-1308 Phase 2B characterization (Freeze section 14.2): time and memory of admission at the frozen limits.
// Values are recorded, not pass/fail. Run: node --expose-gc characterize.mjs
import crypto from 'node:crypto';
import { admitHistoryRecord } from '../../../cca-studio/web/js/memoryos-history-admission.js';
import { canonicalize, mipDigest } from '../../../cca-studio/web/js/mip-canonical.js';
import { InvestigationCore } from '../../../cca-studio/web/js/investigation-core.js';
import fs from 'node:fs';

const enc = new TextEncoder();
const view = { workspaceIdentifier: 'workspace-investigation', entries: [] };
const sha = bytes => 'sha256:' + crypto.createHash('sha256').update(bytes).digest('hex');
const rows = [];
function measure(label, action) {
  if (globalThis.gc) globalThis.gc();
  const before = process.memoryUsage().heapUsed;
  const start = process.hrtime.bigint();
  let outcome = 'accepted';
  try { action(); } catch (error) { outcome = error.code ?? String(error); }
  const milliseconds = Math.round(Number(process.hrtime.bigint() - start) / 1e6);
  const heapMiB = Math.round((process.memoryUsage().heapUsed - before) / 104857.6) / 10;
  rows.push({ label, outcome, milliseconds, heapDeltaMiB: heapMiB });
  console.error(`${label}: ${outcome}, ${milliseconds} ms, heap +${heapMiB} MiB`);
}
const record = (recordKind, name, bytes) => () => admitHistoryRecord({ recordKind, members: [{ name, bytes }], ledger: view });

// MIP package (reference investigation) and its checkpoint.
const mip = new Uint8Array(Buffer.from(fs.readFileSync(new URL('../../../cca-studio/tests/fixtures/mip/complete-investigation.mip.b64', import.meta.url), 'ascii').trim(), 'base64'));
measure(`MIP_PACKAGE ${mip.length} bytes`, record('MIP_PACKAGE', 'package.mip', mip));
const core = new InvestigationCore();
core.import(mip, { identifier: 'characterize' });
const base = JSON.parse(JSON.stringify(core.checkpoint('characterize')));
const asBytes = value => new Uint8Array(enc.encode(canonicalize(value)));
measure(`INVESTIGATION_CHECKPOINT, 2 transitions, ${asBytes(base).length} bytes`, record('INVESTIGATION_CHECKPOINT', 'checkpoint.json', asBytes(base)));

// Many transitions. Amendment A4.5 made checkpoint admission linear; the checkpoints are built here with native
// incremental hashing so that generating them is not the cost being measured.
function withTransitions(count) {
  const value = structuredClone(base);
  const id = value.investigationIdentifier;
  const kinds = ['TRACE_SELECTED', 'REPLAY_PREPARED', 'REPLAY_ACTION', 'EVOLUTION_ENTERED', 'RETURNED_TO_WORLD', 'VERIFIED'];
  for (let index = 2; index < count; index += 1) {
    value.transitionLog.transitions.push({ kind: kinds[index % kinds.length], version: '1.0.0', investigationIdentifier: id, index, payload: index % 7 === 0 ? { step: index } : {}, previousLogDigest: '', identifier: '' });
  }
  const D = (domain, ...parts) => { const h = crypto.createHash('sha256').update('MIP-1').update(Buffer.from([0])).update(domain); for (const part of parts) h.update(Buffer.from([0])).update(part); return h; };
  let prior = 'sha256:' + D('INVESTIGATION-CORE-LOG-1.0', id, '[]').digest('hex');
  const running = D('INVESTIGATION-CORE-LOG-1.0', id, '[');
  value.transitionLog.transitions.forEach((transition, index) => {
    transition.previousLogDigest = prior;
    transition.identifier = 'sha256:' + D('INVESTIGATION-CORE-TRANSITION-1.0', canonicalize({ investigationIdentifier: id, index, kind: transition.kind, payload: transition.payload, previousLogDigest: prior })).digest('hex');
    running.update((index === 0 ? '' : ',') + canonicalize({ identifier: transition.identifier, index, investigationIdentifier: id, kind: transition.kind, payload: transition.payload, previousLogDigest: prior }));
    prior = 'sha256:' + running.copy().update(']').digest('hex');
  });
  value.transitionLog.digest = prior; value.transitionLogDigest = prior; value.transitionCount = count;
  value.identifier = 'sha256:' + D('INVESTIGATION-CORE-CHECKPOINT-1.0', id, prior, value.stateDigest).digest('hex');
  return value;
}
for (const count of [100, 1000, 3000, 10000]) {
  const bytes = asBytes(withTransitions(count));
  measure(`INVESTIGATION_CHECKPOINT, ${count} transitions, ${bytes.length} bytes`, record('INVESTIGATION_CHECKPOINT', 'checkpoint.json', bytes));
}

// READINESS_RESULT near the 4 MiB limit: a re-sealed released result with a large audit array (J limits: 4096-unit strings).
const readiness = JSON.parse(fs.readFileSync(new URL('../../fixtures/mo1307/bundles/ready/expected-result.json', import.meta.url), 'utf8'));
const jText = value => canonicalize(value) + '\n';
function readinessOfSize(strings) {
  const value = structuredClone(readiness);
  value.audit.padding = Array.from({ length: strings }, (_, index) => `${index}`.padEnd(4096, 'x'));
  value.readinessDigest = sha(enc.encode(jText({ kind: 'MemoryOSReadinessIdentity', version: '1.0.0', assessment: value.assessment })));
  value.proofBindingDigest = sha(enc.encode(jText({ kind: 'MemoryOSReadinessProofBinding', version: '1.0.0', readinessDigest: value.readinessDigest, audit: value.audit })));
  return new Uint8Array(enc.encode(jText(value)));
}
for (const strings of [1, 500, 1000]) {
  const bytes = readinessOfSize(strings);
  measure(`READINESS_RESULT ${bytes.length} bytes`, record('READINESS_RESULT', 'memoryos-readiness-result.json', bytes));
}
console.log(JSON.stringify({ kind: 'MO1308Phase2BCharacterization', node: process.version, rows }, null, 2));
