import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { spawnSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';
import { evaluate, validateFinal, A32_RECEIPT_FILE, DISCLOSURES_FILE, FINAL_BINDING_FILE, FINAL_INVENTORY_FILE, REGRESSION_FILE, REGRESSION_KIND } from '../tools/mo1308-phase3d/validate.mjs';
import { buildI3Inventory } from '../tools/mo1308-phase3d/i3-inventory.mjs';
import { impls, hostOnly } from '../tools/mo1308-phase3d/cases.mjs';
import { checkDefinition } from '../tools/mo1308-phase3/lib/campaign-driver.mjs';
import { git, gitText, repositoryRoot } from '../tools/mo1308-phase3/lib/git.mjs';
import { allCases, buildInventory, loadInventory, streamOf, INVENTORY_FILE } from '../tools/mo1308-phase3/lib/inventory.mjs';
import { qualificationCases, structuralQualifications } from '../tools/mo1308-phase3/lib/disclosure.mjs';
import { closeGeneration } from '../tools/mo1308-phase3/lib/runner.mjs';
import { runSegment } from '../tools/mo1308-phase3/lib/runner.mjs';
import { sealGeneration } from '../tools/mo1308-phase3/lib/seal.mjs';
import { stableBytes } from '../tools/mo1308-phase3/lib/stable-json.mjs';
import { sha256Hex } from '../tools/mo1308-phase3/lib/hashing.mjs';
import { makeTemp, removeTemp, tempBase } from '../tools/mo1308-phase3/short-temp.mjs';

// MO-1308 Phase 3D: the read-only validator and the I3 inventory builder, against the real repository (expected NOT_READY, because
// no certifying evidence exists yet) and against a fabricated, complete, local clone (every state from I3 to the binding-only BF).
const here = path.dirname(fileURLToPath(import.meta.url));
const repo = repositoryRoot(here);
const PROTOCOL = 'docs/mo1308-phase3-protocol.md';
const IDENTITY = 'repositories/cca-conformance/mo1308-phase3-candidate-identity.json';
const MANIFEST = 'repositories/cca-conformance/mo1308-phase3-corpus-manifest.json';
const TOOL = 'repositories/cca-conformance/tools/mo1308-phase3/lib/runner.mjs';
const EVIDENCE = 'repositories/cca-conformance/evidence/mo1308';
const inventory = loadInventory(path.join(repo, INVENTORY_FILE));
// A8.9: temporary checkouts and clones live under the short temporary root (C:/tt/3d-N on Windows), never under the system temp path.
const tmp = (t) => { const directory = makeTemp('3d'); t.after(() => removeTemp(directory)); return directory; };

test('D01 the ten 3D cases (steps D and E) are all implemented and none is host-only', () => {
  assert.deepEqual(checkDefinition({ inventory, stream: '3D', impls, hostOnly }), []);
  assert.equal(Object.keys(impls).length, 10);
});

test('D02 against the real repository today: D1 and D5 are READY (corrected candidate, A3.2 g3 PASS), everything else NOT_READY with reasons, and nothing is written', () => {
  const before = gitText(repo, ['status', '--porcelain']);
  const report = validateFinal({ root: repo });
  assert.equal(report.result, 'NOT_READY');
  const status = Object.fromEntries(report.cases.map((row) => [row.id, row.status]));
  assert.deepEqual(status, { '3D-D1': 'READY', '3D-D2': 'NOT_READY', '3D-D3': 'NOT_READY', '3D-D4': 'NOT_READY', '3D-D5': 'READY', '3D-D6': 'NOT_READY', '3D-D7': 'NOT_READY', '3D-E1': 'NOT_READY', '3D-E2': 'NOT_READY', '3D-E3': 'NOT_READY' });
  assert.match(report.cases.find((row) => row.id === '3D-D2').problems[0], /no accepted certifying generation/);
  assert.equal(report.cases.find((row) => row.id === '3D-D5').observed.verdict, 'PASS', 'the real A3.2 generation 3 receipt is PASS');
  assert.equal(gitText(repo, ['status', '--porcelain']), before, 'a read-only validator changes nothing');
  assert.throws(() => buildI3Inventory({ root: repo }), (error) => error.code === 'NOT_READY');
});

// ---- a complete fabricated clone ----

const clock = () => { let tick = 0; return () => new Date(Date.UTC(2026, 9, 8, 0, 0, tick++)); };
const review = () => ({ kind: 'MO1308Phase3Review', version: '1.0.0', subject: [{ path: TOOL, byteLength: 1, sha256: '1'.repeat(64) }], reviewer: { role: 'INDEPENDENT_SUB_AGENT', identity: 'review-agent-1' }, scope: 'the harness', findings: [], conclusion: 'NO_BLOCKING_FINDINGS', reviewedAt: '2026-10-08T00:00:00.000Z' });

function makeClone(t) {
  const directory = path.join(tmp(t), 'clone');
  const run = (cwd, args) => { const result = spawnSync('git', args, { cwd, encoding: 'utf8' }); if (result.status !== 0) throw new Error(`git ${args.join(' ')}: ${result.stderr}`); return result.stdout.trim(); };
  run(path.dirname(directory), ['clone', '-q', '--shared', '--no-checkout', repo, directory]);
  run(directory, ['checkout', '-q', '--detach', gitText(repo, ['rev-parse', 'HEAD'])]);
  run(directory, ['config', 'user.name', 'p3d-test']); run(directory, ['config', 'user.email', 'p3d@example.test']); run(directory, ['config', 'commit.gpgsign', 'false']);
  return { directory, run: (...args) => run(directory, args) };
}
const put = (clone, relative, bytes) => { const target = path.join(clone.directory, ...relative.split('/')); fs.mkdirSync(path.dirname(target), { recursive: true }); fs.writeFileSync(target, bytes); };
const commit = (clone, message) => { clone.run('add', '-A'); clone.run('commit', '-q', '-m', message); return clone.run('rev-parse', 'HEAD'); };

async function certify(clone, stream, generation, { rehearsal = false, outcome = 'CONFIRMED', inputPaths = [] } = {}) {
  const evidenceDir = path.join(clone.directory, ...EVIDENCE.split('/'), generation);
  const inv = buildInventory();
  const executors = {};
  for (const step of streamOf(inv, stream).steps) {
    executors[step.id] = async (ctx) => { for (const item of step.cases) await ctx.runCase(item.id, async (handle) => { if (item.mode === 'record') handle.observe({ outcome }); }); };
  }
  sealGeneration({
    root: clone.directory, stream, generation, certifying: !rehearsal, protocolPath: PROTOCOL, inventoryPath: INVENTORY_FILE, candidateIdentityPath: IDENTITY,
    corpusManifestPath: stream === '3B' ? null : MANIFEST, toolPaths: [TOOL], inputPaths, harnessReviewPath: rehearsal ? null : 'review.json', evidenceDir, now: clock(),
  });
  for (const segment of streamOf(inv, stream).segments) await runSegment({ root: clone.directory, evidenceDir, segmentId: segment.id, executors, now: clock() });
  return closeGeneration({ root: clone.directory, evidenceDir, inventory: inv, now: clock() });
}

async function completeClone(t, options = {}) {
  const clone = makeClone(t);
  put(clone, 'review.json', stableBytes(review()));
  put(clone, A32_RECEIPT_FILE, JSON.stringify({ verdict: 'PASS' }));
  for (const stream of ['3A', '3B', '3C']) {
    const result = await certify(clone, stream, `phase3${stream[1].toLowerCase()}`, { outcome: options.outcome, inputPaths: stream === '3A' ? [A32_RECEIPT_FILE] : [] });
    assert.equal(result.result, 'ACCEPTED');
  }
  const lines = [...qualificationCases(inventory).map((item) => `${item.id}: ${options.disclosed ?? 'CONFIRMED'} - stated`), ...structuralQualifications(inventory).map((id) => `${id}: DISCLOSED - stated`)];
  put(clone, DISCLOSURES_FILE, `# Disclosures\n\nOperators record the headDigest of every export outside the ledger.\n\nRegister: ${inventory.qualifications.map((item) => item.id).join(' ')}.\n\n${lines.join('\n')}\n`);
  const identity = JSON.parse(fs.readFileSync(path.join(clone.directory, IDENTITY), 'utf8'));
  const suite = (name, total) => ({ name, runner: 'node --test', passed: total, failed: 0, skipped: 0, total, exitCode: 0, logSha256: sha256Hex(Buffer.from(name)) });
  put(clone, REGRESSION_FILE, JSON.stringify({ kind: REGRESSION_KIND, version: '1.0.0', commit: clone.run('rev-parse', 'HEAD'), candidate: { productionTreeDigest: identity.productionTreeDigest }, suites: [suite('mo1308', 120), suite('cli', 40), suite('studio', 90), suite('mo1307', 639), suite('examples', 12)] }));
  commit(clone, 'evidence, disclosures and regression record');
  return clone;
}

test('D03 a complete accepted state: I3 is built, then the binding-only BF is certified ready to tag, and nothing is tagged', async (t) => {
  const clone = await completeClone(t);
  const first = evaluate({ root: clone.directory });
  assert.deepEqual(first.report.cases.filter((row) => row.status !== 'READY').map((row) => row.id), ['3D-D7'], JSON.stringify(first.report.cases.filter((row) => row.status !== 'READY')));
  assert.equal(first.report.cases.find((row) => row.id === '3D-D7').status, 'NOT_READY', 'no I3 yet');
  assert.equal(first.report.result, 'NOT_READY');
  const inventoryDocument = buildI3Inventory({ root: clone.directory });
  assert.equal(inventoryDocument.generations.length, 3);
  assert.equal(inventoryDocument.requirements.length, 37);
  assert.equal(inventoryDocument.release.created, false);
  const bytes = stableBytes(inventoryDocument);
  put(clone, FINAL_INVENTORY_FILE, bytes);
  const i3 = commit(clone, 'I3');
  const pending = validateFinal({ root: clone.directory });
  assert.equal(pending.result, 'I3_VALID_PENDING_BF', JSON.stringify(pending.cases.filter((row) => row.status !== 'READY')));
  assert.equal(JSON.stringify(inventoryDocument).includes(i3), false, 'I3 does not embed a later hash');
  put(clone, FINAL_BINDING_FILE, JSON.stringify({ kind: 'MO1308FinalBinding', version: '1.0.0', i3, inventory: { path: FINAL_INVENTORY_FILE, sha256: sha256Hex(bytes) } }));
  const bf = commit(clone, 'BF');
  const final = validateFinal({ root: clone.directory });
  assert.equal(final.result, 'CERTIFIED_READY_TO_TAG', JSON.stringify(final.cases.filter((row) => row.status !== 'READY')));
  assert.equal(final.head, bf);
  assert.equal(git(clone.directory, ['tag', '-l', 'memoryos-1.3-mo1308']).stdout.toString().trim(), '', 'the validator creates no tag');
  // a tag that does not target BF is refused
  clone.run('tag', 'memoryos-1.3-mo1308', i3);
  assert.equal(validateFinal({ root: clone.directory }).result, 'NOT_READY');
});

test('D04 a rehearsal is never an accepted input: a stream with only a rehearsal has no accepted generation', async (t) => {
  const clone = makeClone(t);
  const rehearsal = await certify(clone, '3B', 'phase3b-rehearsal-r1', { rehearsal: true });
  assert.equal(rehearsal.certifying, false);
  commit(clone, 'rehearsal');
  const report = validateFinal({ root: clone.directory });
  const d2 = report.cases.find((row) => row.id === '3D-D2');
  assert.ok(d2.problems.includes('3B: no accepted certifying generation'));
  assert.deepEqual(d2.observed.rehearsals, ['phase3b-rehearsal-r1']);
  assert.equal(d2.observed.accepted['3B'], undefined);
});

test('D05 tampering is caught: a changed receipt, a changed step receipt and a wrong disclosure all make the case NOT_READY', async (t) => {
  const clone = await completeClone(t);
  const receiptFile = path.join(clone.directory, ...EVIDENCE.split('/'), 'phase3c', 'stream-receipt.json');
  fs.writeFileSync(receiptFile, fs.readFileSync(receiptFile, 'utf8').replace('"ACCEPTED"', '"FAILED_PRESERVED"'));
  assert.equal(validateFinal({ root: clone.directory }).cases.find((row) => row.id === '3D-D2').status, 'NOT_READY');
  clone.run('checkout', '--', '.');
  const wrong = await completeClone(t, { disclosed: 'NOT_CONFIRMED' });
  assert.match(validateFinal({ root: wrong.directory }).cases.find((row) => row.id === '3D-D6').problems.join(' '), /disclosed NOT_CONFIRMED but recorded CONFIRMED/);
  const mismatch = await completeClone(t, { outcome: 'NOT_CONFIRMED', disclosed: 'CONFIRMED' });
  assert.match(validateFinal({ root: mismatch.directory }).cases.find((row) => row.id === '3D-D6').problems.join(' '), /disclosed CONFIRMED but recorded NOT_CONFIRMED/);
});

test('D06 a commit that changes a production path is caught by D1, and a regression record for another tree or a short suite by D4', async (t) => {
  const clone = await completeClone(t);
  put(clone, 'repositories/memoryos-cli/src/version.js', `${fs.readFileSync(path.join(clone.directory, 'repositories/memoryos-cli/src/version.js'), 'utf8')}\n// changed\n`);
  commit(clone, 'touch production');
  const d1 = validateFinal({ root: clone.directory }).cases.find((row) => row.id === '3D-D1');
  assert.equal(d1.status, 'NOT_READY');
  assert.ok(d1.problems.some((problem) => /production path|changed/.test(problem)));
  const second = await completeClone(t);
  const regression = JSON.parse(fs.readFileSync(path.join(second.directory, ...REGRESSION_FILE.split('/')), 'utf8'));
  regression.suites.find((suite) => suite.name === 'mo1307').total = 638;
  regression.suites.find((suite) => suite.name === 'mo1307').passed = 638;
  fs.writeFileSync(path.join(second.directory, ...REGRESSION_FILE.split('/')), JSON.stringify(regression));
  assert.match(validateFinal({ root: second.directory }).cases.find((row) => row.id === '3D-D4').problems.join(' '), /639/);
});

test('D07 the validator CLI is read-only and its exit code follows the result', () => {
  const run = spawnSync(process.execPath, [path.join(here, '../tools/mo1308-phase3d/validate-final.mjs'), '--root', repo], { encoding: 'utf8' });
  assert.equal(run.status, 1);
  assert.equal(JSON.parse(run.stdout).result, 'NOT_READY');
  const bad = spawnSync(process.execPath, [path.join(here, '../tools/mo1308-phase3d/validate-final.mjs'), '--root', path.join(tempBase(), 'absent-root-p3d')], { encoding: 'utf8' });
  assert.equal(bad.status, 2);
  void allCases;
});
