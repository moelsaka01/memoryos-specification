// MO-1308 Phase 3C step C (the admission matrix, driven through the real CLI so that exit codes and "no change on rejection"
// are observed on disk) and the known limits of admission (Q12).
import fs from 'node:fs';
import path from 'node:path';
import crypto from 'node:crypto';
import { work, recordById, memo, conclude } from './env.mjs';
import { createHistoryStore } from '../../../memoryos-cli/src/history-store.js';
import { cli, appendArgs, buildDiskLedger, dec, enc, filler, flipFirstHex, jcs, resealCheckpoint, sha, treeDigest, withMember, dropMember, MemoryLedger, attempt, CORPUS_WORKSPACE, sdk, D, tempDir } from './support.mjs';

const OTHER_WORKSPACE = 'workspace-other';
const LIMITS = { MIP_PACKAGE: 16777216, INVESTIGATION_CHECKPOINT: 33554432, POLICY_EVALUATION: 4060, REGRESSION_REPORT: 16777216, CICD_RUN: 49152, READINESS_RESULT: 4194304, HUMAN_DECISION_CLAIM: 8192 };

const rec = (env, id) => recordById(env, id);
const nativeCheckpoint = (env) => {
  const value = JSON.parse(dec.decode(rec(env, 'checkpoint-c00').members[0].bytes));
  value.transitionLog.transitions[0].payload.sourceKind = 'native';
  return { recordKind: 'INVESTIGATION_CHECKPOINT', members: [{ name: 'checkpoint.json', bytes: enc.encode(jcs(resealCheckpoint(value))) }] };
};
const forgedTail = (env) => {
  const record = rec(env, 'checkpoint-c00');
  return withMember(record, 'checkpoint.json', flipFirstHex(record.members[0].bytes, '"transitionLogDigest":"sha256:'));
};
const staleCount = (env) => {
  const record = rec(env, 'checkpoint-c00');
  const value = JSON.parse(dec.decode(record.members[0].bytes));
  value.transitionCount += 1;
  return withMember(record, 'checkpoint.json', enc.encode(jcs(value)));
};
const oversized = (kind, name) => ({ recordKind: kind, members: [{ name, bytes: filler(LIMITS[kind] + 1) }] });
const memberOf = (record) => record.members[0].name;

// A cell: the ledger set-up (workspace, records appended first, records purged) and the final record with its expected outcome.
// `expect` is 'ACCEPT' or the MO1308_ code the CLI must report (exit category 2).
export function cells(env) {
  const r = (id) => rec(env, id);
  const out = [];
  const add = (kind, cell, record, expect, setup = {}) => out.push({ kind, cell, record, expect, setup });
  // MIP_PACKAGE
  const mip = r('mip-reference');
  add('MIP_PACKAGE', 'valid', mip, 'ACCEPT');
  add('MIP_PACKAGE', 'forged', withMember(mip, 'package.mip', (() => { const b = new Uint8Array(mip.members[0].bytes); b[Math.floor(b.length / 2)] ^= 0x01; return b; })()), 'MO1308_RECORD_INVALID');
  add('MIP_PACKAGE', 'stale-truncated', withMember(mip, 'package.mip', mip.members[0].bytes.slice(0, 5000)), 'MO1308_RECORD_INVALID');
  add('MIP_PACKAGE', 'wrong-workspace', mip, 'MO1308_WORKSPACE_MISMATCH', { workspace: OTHER_WORKSPACE });
  add('MIP_PACKAGE', 'wrong-content', rec(env, 'policy-0').members.length ? { recordKind: 'MIP_PACKAGE', members: [{ name: 'package.mip', bytes: rec(env, 'regression-reference').members[0].bytes }] } : mip, 'MO1308_RECORD_INVALID');
  add('MIP_PACKAGE', 'oversized', oversized('MIP_PACKAGE', 'package.mip'), 'MO1308_RESOURCE_LIMIT');
  add('MIP_PACKAGE', 'duplicate', mip, 'MO1308_RECORD_DUPLICATE', { pre: ['mip-reference'] });
  add('MIP_PACKAGE', 'purged', mip, 'MO1308_RECORD_PURGED', { pre: ['mip-reference'], purge: [0] });
  // INVESTIGATION_CHECKPOINT
  const checkpoint = r('checkpoint-c00');
  add('INVESTIGATION_CHECKPOINT', 'valid', checkpoint, 'ACCEPT');
  add('INVESTIGATION_CHECKPOINT', 'forged-log-digest', forgedTail(env), 'MO1308_RECORD_INVALID');
  add('INVESTIGATION_CHECKPOINT', 'native-checkpoint', nativeCheckpoint(env), 'MO1308_RECORD_INVALID');
  add('INVESTIGATION_CHECKPOINT', 'stale-transition-count', staleCount(env), 'MO1308_RECORD_INVALID');
  add('INVESTIGATION_CHECKPOINT', 'wrong-workspace', checkpoint, 'MO1308_WORKSPACE_MISMATCH', { workspace: OTHER_WORKSPACE });
  add('INVESTIGATION_CHECKPOINT', 'wrong-content', { recordKind: 'INVESTIGATION_CHECKPOINT', members: [{ name: 'checkpoint.json', bytes: enc.encode('{}') }] }, 'MO1308_RECORD_INVALID');
  add('INVESTIGATION_CHECKPOINT', 'oversized', oversized('INVESTIGATION_CHECKPOINT', 'checkpoint.json'), 'MO1308_RESOURCE_LIMIT');
  add('INVESTIGATION_CHECKPOINT', 'duplicate', checkpoint, 'MO1308_RECORD_DUPLICATE', { pre: ['checkpoint-c00'] });
  add('INVESTIGATION_CHECKPOINT', 'purged', checkpoint, 'MO1308_RECORD_PURGED', { pre: ['checkpoint-c00'], purge: [0] });
  // POLICY_EVALUATION
  const policy = r('policy-0');
  const other = r('policy-1');
  add('POLICY_EVALUATION', 'valid', policy, 'ACCEPT');
  add('POLICY_EVALUATION', 'valid-in-another-workspace', policy, 'ACCEPT', { workspace: OTHER_WORKSPACE });
  add('POLICY_EVALUATION', 'forged-identity', withMember(policy, 'evaluation-identity.json', flipFirstHex(policy.members.find((m) => m.name === 'evaluation-identity.json').bytes)), 'MO1308_RECORD_INVALID');
  add('POLICY_EVALUATION', 'stale-cross-bound-pair', { recordKind: 'POLICY_EVALUATION', members: [policy.members.find((m) => m.name === 'evaluation-identity.json'), other.members.find((m) => m.name === 'policy-outcome.json')] }, 'MO1308_RECORD_INVALID');
  add('POLICY_EVALUATION', 'wrong-members-swapped', { recordKind: 'POLICY_EVALUATION', members: [{ name: 'evaluation-identity.json', bytes: policy.members.find((m) => m.name === 'policy-outcome.json').bytes }, { name: 'policy-outcome.json', bytes: policy.members.find((m) => m.name === 'evaluation-identity.json').bytes }] }, 'MO1308_RECORD_INVALID');
  add('POLICY_EVALUATION', 'oversized', withMember(policy, 'policy-outcome.json', filler(LIMITS.POLICY_EVALUATION + 1)), 'MO1308_RESOURCE_LIMIT');
  add('POLICY_EVALUATION', 'duplicate', policy, 'MO1308_RECORD_DUPLICATE', { pre: ['policy-0'] });
  add('POLICY_EVALUATION', 'purged', policy, 'MO1308_RECORD_PURGED', { pre: ['policy-0'], purge: [0] });
  // REGRESSION_REPORT
  const regression = r('regression-reference');
  add('REGRESSION_REPORT', 'valid', regression, 'ACCEPT');
  add('REGRESSION_REPORT', 'forged', withMember(regression, 'regression-report.json', flipFirstHex(regression.members[0].bytes, '"identifier":"sha256:')), 'MO1308_RECORD_INVALID');
  add('REGRESSION_REPORT', 'wrong-workspace', regression, 'MO1308_WORKSPACE_MISMATCH', { workspace: OTHER_WORKSPACE });
  add('REGRESSION_REPORT', 'wrong-content', { recordKind: 'REGRESSION_REPORT', members: [{ name: 'regression-report.json', bytes: rec(env, 'policy-0').members[1].bytes }] }, 'MO1308_RECORD_INVALID');
  add('REGRESSION_REPORT', 'oversized', oversized('REGRESSION_REPORT', 'regression-report.json'), 'MO1308_RESOURCE_LIMIT');
  add('REGRESSION_REPORT', 'duplicate', regression, 'MO1308_RECORD_DUPLICATE', { pre: ['regression-reference'] });
  add('REGRESSION_REPORT', 'purged', regression, 'MO1308_RECORD_PURGED', { pre: ['regression-reference'], purge: [0] });
  // CICD_RUN
  const six = r('cicd-6');
  const four = r('cicd-4');
  add('CICD_RUN', 'valid-6-files', six, 'ACCEPT');
  add('CICD_RUN', 'valid-4-files', four, 'ACCEPT');
  add('CICD_RUN', 'missing-completion-marker', dropMember(six, 'memoryos-ci-complete.json'), 'MO1308_RECORD_INVALID');
  add('CICD_RUN', 'wrong-cardinality-5-files', { ...six, members: six.members.slice(0, 5) }, 'MO1308_RECORD_INVALID');
  add('CICD_RUN', 'bad-manifest-member-altered', withMember(six, six.members[1].name, (() => { const b = new Uint8Array(six.members[1].bytes); b[b.length - 2] ^= 0x01; return b; })()), 'MO1308_RECORD_INVALID');
  add('CICD_RUN', 'stale-marker-from-another-run', withMember(six, 'memoryos-ci-complete.json', four.members.find((m) => m.name === 'memoryos-ci-complete.json').bytes), 'MO1308_RECORD_INVALID');
  add('CICD_RUN', 'extra-file', { ...six, members: [...six.members, { name: 'extra.txt', bytes: enc.encode('x') }] }, 'MO1308_RECORD_INVALID');
  add('CICD_RUN', 'oversized', withMember(six, six.members[0].name, filler(LIMITS.CICD_RUN + 1)), 'MO1308_RESOURCE_LIMIT');
  add('CICD_RUN', 'duplicate', six, 'MO1308_RECORD_DUPLICATE', { pre: ['cicd-6'] });
  add('CICD_RUN', 'purged', six, 'MO1308_RECORD_PURGED', { pre: ['cicd-6'], purge: [0] });
  // READINESS_RESULT
  const ready = r('readiness-ready');
  add('READINESS_RESULT', 'valid', ready, 'ACCEPT');
  add('READINESS_RESULT', 'valid-not-ready', r('readiness-not-ready'), 'ACCEPT');
  add('READINESS_RESULT', 'forged-readiness-digest', withMember(ready, 'memoryos-readiness-result.json', flipFirstHex(ready.members[0].bytes, '"readinessDigest":"sha256:')), 'MO1308_RECORD_INVALID');
  add('READINESS_RESULT', 'stale-proof-binding-of-another-result', withMember(ready, 'memoryos-readiness-result.json', enc.encode(dec.decode(ready.members[0].bytes).replace(/"proofBindingDigest":"sha256:[0-9a-f]{64}"/, `"proofBindingDigest":"${JSON.parse(dec.decode(r('readiness-qualified').members[0].bytes)).proofBindingDigest}"`))), 'MO1308_RECORD_INVALID');
  add('READINESS_RESULT', 'oversized', oversized('READINESS_RESULT', 'memoryos-readiness-result.json'), 'MO1308_RESOURCE_LIMIT');
  add('READINESS_RESULT', 'duplicate', ready, 'MO1308_RECORD_DUPLICATE', { pre: ['readiness-ready'] });
  add('READINESS_RESULT', 'purged', ready, 'MO1308_RECORD_PURGED', { pre: ['readiness-ready'], purge: [0] });
  // HUMAN_DECISION_CLAIM
  const approve = r('decision-ready-approve');
  add('HUMAN_DECISION_CLAIM', 'valid-consistent', approve, 'ACCEPT', { pre: ['readiness-ready'], label: 'CONSISTENT' });
  add('HUMAN_DECISION_CLAIM', 'valid-contrary', r('decision-not-ready-approve'), 'ACCEPT', { pre: ['readiness-not-ready'], label: 'CONTRARY_TO_READINESS' });
  add('HUMAN_DECISION_CLAIM', 'unbound-no-result', approve, 'MO1308_DECISION_UNBOUND');
  add('HUMAN_DECISION_CLAIM', 'unbound-wrong-digests', withMember(approve, 'human-decision.json', flipFirstHex(approve.members[0].bytes, '"candidateDigest":"sha256:')), 'MO1308_DECISION_UNBOUND', { pre: ['readiness-ready'] });
  add('HUMAN_DECISION_CLAIM', 'unbound-purged-result', approve, 'MO1308_DECISION_UNBOUND', { pre: ['readiness-ready'], purge: [0] });
  add('HUMAN_DECISION_CLAIM', 'forged-extra-field', withMember(approve, 'human-decision.json', enc.encode(dec.decode(approve.members[0].bytes).replace(/^\{/, '{"extra":1,'))), 'MO1308_RECORD_INVALID', { pre: ['readiness-ready'] });
  add('HUMAN_DECISION_CLAIM', 'oversized', withMember(approve, 'human-decision.json', filler(LIMITS.HUMAN_DECISION_CLAIM + 1)), 'MO1308_RESOURCE_LIMIT', { pre: ['readiness-ready'] });
  add('HUMAN_DECISION_CLAIM', 'duplicate', approve, 'MO1308_RECORD_DUPLICATE', { pre: ['readiness-ready', 'decision-ready-approve'] });
  add('HUMAN_DECISION_CLAIM', 'purged-claim', approve, 'MO1308_RECORD_PURGED', { pre: ['readiness-ready', 'decision-ready-approve'], purge: [1] });
  return out;
}

const KIND_PREFIX = { MIP_PACKAGE: 'C1', INVESTIGATION_CHECKPOINT: 'C2', POLICY_EVALUATION: 'C3', REGRESSION_REPORT: 'C4', CICD_RUN: 'C5', READINESS_RESULT: 'C6', HUMAN_DECISION_CLAIM: 'C7' };
const KIND_BY_CASE = Object.fromEntries(Object.entries(KIND_PREFIX).map(([kind, id]) => [`3C-${id}`, kind]));

// Runs one cell through the CLI in a fresh ledger and reports what happened, including whether a rejection changed the disk.
function runCell(env, cell, index) {
  const directory = work(env);
  const workspace = cell.setup.workspace ?? CORPUS_WORKSPACE;
  const ledger = path.join(directory, `ledger-${index}`);
  // Cells with the same setup start from the same ledger: it is built once through the CLI (init, pre-appends, purges) and copied byte for
  // byte for each cell, so a cell costs one append process instead of a dozen (the step guard of 3C-C is 5 minutes).
  const key = JSON.stringify({ workspace, pre: cell.setup.pre ?? [], purge: cell.setup.purge ?? [] });
  const templates = memo(env, 'cell-templates', () => new Map());
  if (!templates.has(key)) {
    const template = path.join(work(env), 'template');
    const init = cli(['history', 'init', '--ledger', template, '--name', 'p3c-cell', '--workspace', workspace, '--json']);
    if (init.status !== 0) throw new Error(`init failed: ${init.stderr.slice(0, 200)}`);
    for (const id of cell.setup.pre ?? []) {
      const result = cli(appendArgs(template, recordById(env, id), path.join(directory, `pre-${id}`)));
      if (result.status !== 0) throw new Error(`pre-append ${id} failed: ${result.code}`);
    }
    for (const target of cell.setup.purge ?? []) {
      const result = cli(['history', 'tombstone', '--ledger', template, '--target', String(target), '--reason', 'OPERATOR_CORRECTION', '--authority-reference', 'P3C-CELL', '--json']);
      if (result.status !== 0) throw new Error(`purge ${target} failed: ${result.code}`);
    }
    templates.set(key, template);
  }
  fs.cpSync(templates.get(key), ledger, { recursive: true, errorOnExist: true, force: false });
  const before = treeDigest(ledger);
  const run = cli(appendArgs(ledger, cell.record, path.join(directory, 'record')));
  const after = treeDigest(ledger);
  let label = null;
  if (run.status === 0 && cell.setup.label !== undefined) {
    const query = cli(['history', 'query', '--ledger', ledger, '--kind', 'HUMAN_DECISION_CLAIM', '--retention', 'RETAINED', '--from', '0', '--limit', '10', '--json']);
    label = query.json?.result?.entries?.[0]?.decisionConsistency ?? null;
  }
  // the real SDK and the production store verify the ledger in this process (the CLI verify is the same composition)
  let verifies = true;
  try { createHistoryStore({ engine: sdk }).verify(ledger); } catch { verifies = false; }
  return { status: run.status, code: run.code, exit: run.exit, changed: before !== after, label, ledgerVerifiesAfter: verifies };
}

const results = (env) => memo(env, 'cell-results', () => new Map());
function runKind(env, kind) {
  const all = cells(env).map((cell, index) => ({ cell, index })).filter(({ cell }) => cell.kind === kind);
  const problems = [];
  const rows = [];
  for (const { cell, index } of all) {
    const outcome = runCell(env, cell, index);
    results(env).set(`${kind}/${cell.cell}`, { ...outcome, expect: cell.expect });
    const accepted = outcome.status === 0;
    const got = accepted ? 'ACCEPT' : outcome.code;
    rows.push([cell.cell, got]);
    if (got !== cell.expect) problems.push(`${cell.cell}: expected ${cell.expect}, got ${got} (exit ${outcome.status})`);
    if (!accepted && outcome.exit !== 2) problems.push(`${cell.cell}: a rejection must exit 2, not ${outcome.exit}`);
    if (!accepted && outcome.changed) problems.push(`${cell.cell}: a rejected admission changed the ledger on disk`);
    if (!outcome.ledgerVerifiesAfter) problems.push(`${cell.cell}: the ledger does not verify afterwards`);
    if (cell.setup.label !== undefined && outcome.label !== cell.setup.label) problems.push(`${cell.cell}: decisionConsistency ${outcome.label}, expected ${cell.setup.label}`);
  }
  return { problems, rows };
}

export const admission = {};
for (const [caseId, kind] of Object.entries(KIND_BY_CASE)) {
  admission[caseId] = (h, env) => {
    const { problems, rows } = runKind(env, kind);
    conclude(h, problems, { kind, cells: rows.length, outcomes: Object.fromEntries(rows) });
  };
}

admission['3C-C8'] = (h, env) => {
  const store = results(env);
  if (store.size === 0) throw new Error('the admission matrix has not run');
  const rejected = [...store].filter(([, row]) => row.status !== 0);
  const problems = rejected.filter(([, row]) => row.changed).map(([name]) => `${name}: the ledger changed on disk`);
  const accepted = [...store].filter(([, row]) => row.status === 0);
  conclude(h, problems, { rejections: rejected.length, acceptances: accepted.length, unchanged: rejected.length - problems.length, codes: [...new Set(rejected.map(([, row]) => row.code))].sort() });
};

admission['3C-C9'] = (h, env) => {
  const store = results(env);
  const problems = [];
  const by = (suffix) => [...store].filter(([name]) => name.endsWith(`/${suffix}`));
  for (const [name, row] of by('duplicate')) if (row.code !== 'MO1308_RECORD_DUPLICATE') problems.push(`${name}: ${row.code}`);
  for (const [name, row] of by('purged')) if (row.code !== 'MO1308_RECORD_PURGED') problems.push(`${name}: ${row.code}`);
  for (const [name, row] of by('wrong-workspace')) if (row.code !== 'MO1308_WORKSPACE_MISMATCH') problems.push(`${name}: ${row.code}`);
  // DECLARED records are accepted in whatever ledger the operator chose; INTRINSIC ones must match the ledger Workspace.
  const declared = store.get('POLICY_EVALUATION/valid-in-another-workspace');
  if (declared === undefined || declared.status !== 0) problems.push('a DECLARED record was refused in a ledger of another Workspace');
  // one Workspace per ledger and the association recorded per entry
  const directory = work(env);
  const ledger = buildDiskLedger(directory, 'p3c-c9', ['policy-0', 'readiness-ready', 'regression-reference', 'mip-reference']);
  const query = cli(['history', 'query', '--ledger', ledger, '--retention', 'ANY', '--from', '0', '--limit', '100', '--json']);
  const association = Object.fromEntries((query.json?.result?.entries ?? []).map((entry) => [entry.recordKind, entry.workspaceAssociation]));
  const expected = { POLICY_EVALUATION: 'DECLARED', READINESS_RESULT: 'DECLARED', REGRESSION_REPORT: 'INTRINSIC', MIP_PACKAGE: 'INTRINSIC' };
  for (const [kind, value] of Object.entries(expected)) if (association[kind] !== value) problems.push(`${kind}: association ${association[kind]}, expected ${value}`);
  const descriptor = JSON.parse(fs.readFileSync(path.join(ledger, 'memoryos-history-ledger.json'), 'utf8'));
  if (Object.keys(descriptor).filter((key) => key.toLowerCase().includes('workspace')).length !== 1) problems.push('a ledger descriptor must carry exactly one Workspace');
  const noWorkspace = cli(['history', 'init', '--ledger', path.join(directory, 'none'), '--name', 'p3c-none', '--json']);
  if (noWorkspace.status !== 1) problems.push(`init without a Workspace exited ${noWorkspace.status}, expected the usage exit 1`);
  conclude(h, problems, { duplicates: by('duplicate').length, purged: by('purged').length, workspaceMismatches: by('wrong-workspace').length, association });
};

// Q12: the known limits of admission, demonstrated. Outcome CONFIRMED only when both limits are observed.
admission['3C-C10'] = (h, env) => {
  const probe = new MemoryLedger('p3c-limits');
  const policy = recordById(env, 'policy-0');
  const outcomeBytes = policy.members.find((m) => m.name === 'policy-outcome.json').bytes;
  const text = dec.decode(outcomeBytes);
  const candidates = [...text.matchAll(/sha256:[0-9a-f]{64}/g)].map((match) => ({ index: match.index + 'sha256:'.length, value: match[0] }));
  const accepted = [];
  for (const candidate of candidates) {
    const altered = enc.encode(`${text.slice(0, candidate.index)}${text[candidate.index] === '0' ? '1' : '0'}${text.slice(candidate.index + 1)}`);
    const members = policy.members.map((m) => (m.name === 'policy-outcome.json' ? { name: m.name, bytes: altered } : m));
    if (attempt(() => probe.admit({ recordKind: 'POLICY_EVALUATION', members })).accepted) accepted.push(candidate.index);
  }
  // READINESS_RESULT: flip the assessment to READY and recompute both self-digests (MO-1307 Freeze section 14 construction)
  const notReady = JSON.parse(dec.decode(recordById(env, 'readiness-not-ready').members[0].bytes));
  const forged = structuredClone(notReady);
  forged.assessment.readiness = 'READY';
  const j = (value) => enc.encode(`${jcs(value)}\n`);
  forged.readinessDigest = sha(j({ kind: 'MemoryOSReadinessIdentity', version: '1.0.0', assessment: forged.assessment }));
  forged.proofBindingDigest = sha(j({ kind: 'MemoryOSReadinessProofBinding', version: '1.0.0', readinessDigest: forged.readinessDigest, audit: forged.audit }));
  const readinessAttempt = attempt(() => probe.admit({ recordKind: 'READINESS_RESULT', members: [{ name: 'memoryos-readiness-result.json', bytes: j(forged) }] }));
  const policyLimit = accepted.length > 0;
  const readinessLimit = readinessAttempt.accepted;
  const observed = {
    digestFieldsInOutcome: candidates.length, alteredAndStillAdmitted: accepted.length, policyAdmissionIsInspectionOnly: policyLimit,
    forgedReadyResultAdmitted: readinessLimit, readinessCode: readinessAttempt.accepted ? null : readinessAttempt.code,
    outcome: policyLimit && readinessLimit ? 'CONFIRMED' : 'NOT_CONFIRMED',
  };
  conclude(h, [], observed);
};
void sha; void D; void tempDir; void crypto; void sdk;
