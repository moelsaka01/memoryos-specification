// Builds the Phase 3D integration (I3) evidence from immutable inputs. Run once on the clean branch tip (E3A), then commit.
// Usage: node build-i3.mjs <path-to-mo1307-test-log>
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import assert from 'node:assert/strict';
import { spawnSync } from 'node:child_process';
import { pathToFileURL } from 'node:url';
import { root, evidenceRel, inventoryRel, docRel, toolRel, toolNames, ids, limits, authorities, sourceRel, hash, abs, record, recordBytes, json, gitText, gitBlob, canonicalBytes, requireNode } from './common.mjs';
import { derive } from './claims.mjs';
import { checkPackage, packageFiles } from '../mo1307-phase1/package.mjs';

requireNode();
const testLog = process.argv[2], baselineLog = process.argv[3]; assert.ok(testLog && fs.existsSync(testLog) && baselineLog && fs.existsSync(baselineLog), 'usage: build-i3.mjs <mo1307-test-log> <C3TB-baseline-test-log>');
assert.equal(gitText('rev-parse', 'HEAD'), ids.E3A, 'I3 must be built on the accepted 3AR2 evidence commit');
assert.equal(gitText('status', '--porcelain=v1', '--untracked-files=all', '--', '.', ':!' + docRel, ':!' + toolRel), '', 'worktree must be clean apart from the 3D doc and tools');
for (const rel of [evidenceRel, inventoryRel]) assert.equal(fs.existsSync(abs(rel)), false, rel + ' must not exist');
assert.ok(fs.existsSync(abs(docRel)), 'the Phase 3D report must exist before the inventory binds it');
for (const name of toolNames.concat(['claims.mjs'])) assert.ok(fs.existsSync(abs(toolRel + '/' + name)), name);

const out = (rel, bytes) => { const file = abs(rel); fs.mkdirSync(path.dirname(file), { recursive: true }); fs.writeFileSync(file, bytes, { flag: 'wx' }); return recordBytes(rel, bytes); };
const claims = derive();
// Known failing tests: stale limit expectations (superseded by the owner-authorized C3T/C3V bounds) and one one-shot witness write.
const staleTests = {
  C2C01: 'Asserts helperDeadlineMs 5000 / helperAggregateDeadlineMs 20000; superseded by authorized 8000 (C3T) then 9000 (C3V) and 28000. Fails identically at the accepted C3TB baseline.',
  C2C17: 'Hardcodes the 5000-ms per-helper boundary; superseded by the authorized helper bound. Fails identically at the accepted C3TB baseline.',
  C2C18: 'Hardcodes the 4 x 4999 ms / 20000-ms aggregate schedule; superseded by the authorized 28000-ms aggregate (C3V). Passed at C3TB (aggregate 20000), fails at C3VB by arithmetic.',
  R07: 'Hardcodes now = 5000 helper deadline; superseded. Fails identically at the accepted C3TB baseline.',
  R08: 'Hardcodes the 20000-ms aggregate boundary; superseded by 28000 (C3V). Passed at C3TB, fails at C3VB by arithmetic.',
  R09: 'Hardcodes the 5000/20000 helper/aggregate schedule; superseded. Fails identically at the accepted C3TB baseline.',
  NRT01: 'One-shot Phase 2C witness: its wx write of evidence/mo1307/phase2c-resumed/runtime/native-worker-deadline.json hits EEXIST on re-run (file preserved from the original run); the worker was terminated at 10013 ms as expected.',
};

// 1. Immutable copies of the accepted 3B/3C inputs.
const copies = [];
for (const [stream, claim] of [['3b', claims.phase3B], ['3c', claims.phase3C]]) {
  for (const member of claim.members) copies.push({ stream, source: member, copy: out(`${evidenceRel}/accepted-inputs/${stream}/${path.posix.basename(member.path)}`, gitBlob(member.commit, member.path)) });
}
for (const row of copies) assert.equal(row.copy.sha256, row.source.sha256);

// 2. Reproducible package identity: two independent clean assemblies of the exact C3VB production tree.
const npmCli = path.join(path.dirname(process.execPath), 'node_modules/npm/bin/npm-cli.js');
assert.equal(hash(fs.readFileSync(npmCli)), 'sha256:3ce7cba6f5128dd5f54c98b6a5036b0f850496878cc2e21044b675fe3c594e3e');
function assemble(label) {
  const base = fs.mkdtempSync(path.join(os.tmpdir(), `mo1307-3d-${label}-`)), src = path.join(base, 'src'), dest = path.join(base, 'out');
  for (const dir of [src, dest, path.join(base, 'cache')]) fs.mkdirSync(dir);
  for (const rel of ['user.npmrc', 'global.npmrc']) fs.writeFileSync(path.join(base, rel), '');
  const members = gitText('ls-tree', '-r', '--name-only', `${ids.C3VB}:${sourceRel}`).split('\n');
  for (const member of members) { const file = path.join(src, member); fs.mkdirSync(path.dirname(file), { recursive: true }); fs.writeFileSync(file, gitBlob(ids.C3VB, `${sourceRel}/${member}`)); }
  const env = { SystemRoot: 'C:\\Windows', WINDIR: 'C:\\Windows', PATH: path.dirname(process.execPath), TEMP: base, TMP: base };
  const r = spawnSync(process.execPath, [npmCli, 'pack', '--json', '--pack-destination', dest, '--offline', '--ignore-scripts', '--no-audit', '--no-fund', '--cache', path.join(base, 'cache'), '--userconfig', path.join(base, 'user.npmrc'), '--globalconfig', path.join(base, 'global.npmrc')], { cwd: src, env, encoding: null, windowsHide: true, shell: false, timeout: 180000 });
  assert.ifError(r.error); assert.equal(r.status, 0, r.stderr.toString());
  const packed = JSON.parse(r.stdout.toString()); assert.equal(packed.length, 1);
  assert.deepEqual(packed[0].files.map(f => f.path).sort(), [...packageFiles]);
  const archive = fs.readFileSync(path.join(dest, packed[0].filename));
  const check = checkPackage(src);
  return { archive: { byteLength: archive.length, sha256: hash(archive) }, members: packed[0].files.length, check, base, src };
}
const first = assemble('a'), second = assemble('b');
const acceptedArchive = claims.phase3A.receipt && json('repositories/cca-conformance/evidence/mo1307/phase3ar2-final-h5-corrected/phase3d-handoff.json').packageIdentity;
const e3aArchive = record('repositories/cca-conformance/evidence/mo1307/phase3ar2-final-h5-corrected/package/memoryos-readiness-0.1.0.tgz');
assert.deepEqual(first.archive, second.archive, 'two independent assemblies must be byte-identical');
assert.equal(first.archive.sha256, e3aArchive.sha256, 'independent assembly must equal the archive installed by the accepted 3AR2 generation');
assert.equal(first.archive.byteLength, e3aArchive.byteLength);
const reproducibility = out(`${evidenceRel}/package-reproducibility.json`, canonicalBytes({
  kind: 'MO1307Phase3DPackageReproducibility', version: '1.0.0', result: 'PASS', candidate: ids.C3VB, productionTree: ids.productionTree,
  assemblies: [{ id: 'assembly-a', ...first.archive, members: first.members }, { id: 'assembly-b', ...second.archive, members: second.members }],
  acceptedGenerationArchive: e3aArchive, byteIdentical: true, packageIdentity: acceptedArchive, externalProductionDependencies: 0,
  method: 'Independent clean exports of the exact C3VB production Git blobs; offline npm pack with --ignore-scripts, empty user/global npmrc and separate caches; no network.',
  packageCheck: first.check,
}));
for (const run of [first, second]) fs.rmSync(run.base, { recursive: true, force: true });

// 3. Gate/vector/graph audit: contract constants from the exact production module plus the retained conformance-suite run.
const constants = await import(pathToFileURL(abs(`${sourceRel}/src/constants.mjs`)).href);
const D = constants.DEFINITIONS, L = D.limits;
assert.equal(D.gateDefinitions.length, 22); assert.equal(D.errors.length, 21);
assert.equal(L.helperDeadlineMs, limits.helperWholeLifecycleMs); assert.equal(L.helperAggregateDeadlineMs, limits.aggregateHelperActiveMs); assert.equal(L.cliDeadlineMs, limits.cliRenameAdmissionMs); assert.equal(L.apiDeadlineMs, limits.apiWorkerMs); assert.equal(L.cleanupAllowanceMs, limits.failureCleanupMs);
const logText = fs.readFileSync(testLog, 'utf8');
const metric = name => { const m = logText.match(new RegExp('(?:ℹ|#)\\s+' + name + '\\s+(\\d+)')); assert.ok(m, 'test summary ' + name); return Number(m[1]); };
const tests = { total: metric('tests'), pass: metric('pass'), fail: metric('fail'), cancelled: metric('cancelled'), skipped: metric('skipped'), todo: metric('todo') };
assert.equal(tests.cancelled, 0); assert.ok(tests.total > 0 && tests.pass === tests.total - tests.fail - tests.skipped - tests.todo);
const failing = new Set([...logText.matchAll(/^✖ (\S+) /gm)].map(m => m[1]).filter(n => n !== 'failing')); failing.delete('tests');
assert.deepEqual([...failing].sort(), Object.keys(staleTests).sort(), 'the failing set must be exactly the disclosed stale/one-shot tests');
assert.equal(tests.fail, failing.size);
const baselineText = fs.readFileSync(baselineLog, 'utf8');
const baselineFailing = [...new Set([...baselineText.matchAll(/^✖ (\S+) /gm)].map(m => m[1]).filter(n => n !== 'failing'))].sort();
for (const name of baselineFailing) assert.ok(name in staleTests, 'unexpected baseline failure ' + name);
const suites = fs.readdirSync(abs('repositories/cca-conformance/tests')).filter(n => /^mo1307_.*_test\.mjs$/.test(n)).sort().map(n => record('repositories/cca-conformance/tests/' + n));
const diagnosis = json('repositories/cca-conformance/evidence/mo1307/phase3ar2-final-h5-corrected/instrumentation/diagnosis.json');
const lifecycles = diagnosis.helperPhases.flatMap(o => (o.requests ?? []).map(q => q.wholeLifecycleMs)).filter(v => typeof v === 'number').sort((a, b) => a - b);
const pct = p => lifecycles[Math.min(lifecycles.length - 1, Math.floor(lifecycles.length * p))];
const audit = out(`${evidenceRel}/audit-results.json`, canonicalBytes({
  kind: 'MO1307Phase3DFinalAudit', version: '1.0.0', result: 'PASS_WITH_DISCLOSED_STALE_TEST_BASELINE', candidate: ids.C3VB,
  contract: { gates: D.gateDefinitions.length, gateIds: D.gateDefinitions.map(g => g.id), operationalErrors: D.errors.length, evidenceTypes: D.enums.evidenceTypes.length, readinessStates: D.enums.readiness, gateStates: D.enums.gateStates, qualificationCodes: D.enums.qualificationCodes, graphNodeTypes: D.enums.graphNodeTypes, graphEdgeTypes: D.enums.graphEdgeTypes,
    limits: { helperDeadlineMs: L.helperDeadlineMs, helperAggregateDeadlineMs: L.helperAggregateDeadlineMs, cliDeadlineMs: L.cliDeadlineMs, apiDeadlineMs: L.apiDeadlineMs, cleanupAllowanceMs: L.cleanupAllowanceMs, graphNodes: L.graphNodes, graphEdges: L.graphEdges, helperRequests: L.helperRequests, helperVerifyRequests: L.helperVerifyRequests } },
  conformanceSuite: { runner: 'node --test --test-concurrency=1 tests/mo1307_*_test.mjs', node: process.version, files: suites.length, suiteFiles: suites, ...tests, failingTests: Object.fromEntries([...failing].sort().map(n => [n, staleTests[n]])), classification: 'TEST_EXPECTATION_STALE_AFTER_AUTHORIZED_LIMIT_AMENDMENT_OR_ONE_SHOT_WITNESS (not product defects; no tracked test was edited)', c3tbBaselineFailing: baselineFailing, log: recordBytes('(external) ' + path.basename(testLog), fs.readFileSync(testLog)), c3tbBaselineLog: recordBytes('(external) ' + path.basename(baselineLog), fs.readFileSync(baselineLog)) },
  acceptedGenerationVectors: { cases: 80, steps: 'A-O', receipt: claims.phase3A.receipt },
  hostLatencyDisclosure: { helperLifecyclesObservedInAcceptedGeneration: lifecycles.length, minMs: lifecycles[0], medianMs: pct(0.5), p90Ms: pct(0.9), maxMs: lifecycles.at(-1), deadlineMs: 9000, marginAtMaxMs: 9000 - lifecycles.at(-1),
    note: 'Heavy-tailed host latency is a retained environment qualification: helper lifecycles are dominated by PowerShell startup/script load. A prior generation observed 8912 ms of 9000 ms, and another failed at the deadline. The accepted generation passed with the observed margin; this is not a claim about worst-case host latency.' },
}));

// 4. Inventory (binds everything above plus the tooling and the report; it never embeds its own or a future hash).
const inventory = {
  kind: 'MO1307Phase3DFinalReleaseInventory', version: '1.0.0', result: 'I3_COMPLETE_PENDING_BF_BINDING', createdAt: new Date().toISOString(),
  scope: 'MO-1307 memoryos-readiness Phase 3D integration of exact accepted 3A/3B/3C evidence against the single final candidate C3VB.',
  candidate: { binding: ids.C3VB, production: ids.C3V, productionTree: ids.productionTree, evidenceCommit: ids.E3A, authorities, limits },
  claims, reproducibility, audit, acceptedInputCopies: copies,
  tooling: toolNames.concat(['claims.mjs']).sort().map(n => record(`${toolRel}/${n}`)), document: record(docRel),
  qualificationsAndDisclosures: [
    'Historical helper characterization H remains NOT_ESTABLISHED; no historical PASS is promoted.',
    'Phases 3B and 3C were accepted against C3TB and are reconciled to C3VB only by the exact changed-dependency deltas (7 changed production files, 82 unchanged); they are not re-run.',
    'The Phase 3CR2 acceptance receipt records PENDING_CONTAINING_COMMIT; its containing commit is the accepted 3C input commit recorded above.',
    'Heavy-tailed host helper latency is a retained environment qualification (see audit hostLatencyDisclosure).',
    'Evidence files record one-shot failed generations H, H2 (operator), H3, H4 and their corrections; none was resumed, edited or promoted.',
  ],
  tagPolicy: { releaseTag: 'ABSENT', humanTagReviewRequired: true, computedReadyIsNotAHumanDecision: true, tagMustTargetBF: true, push: false, tag: false },
  selfReference: 'I3 binds only existing bytes. The binding-only BF child binds the exact I3 commit; neither embeds its own future hash.',
};
const written = out(inventoryRel, canonicalBytes(inventory));
process.stdout.write(JSON.stringify({ result: 'I3_BUILT', inventory: written, reproducibility, audit, tests, copies: copies.length }) + '\n');
