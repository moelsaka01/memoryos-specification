// Zero-product, append-only rebinding of the H2-corrected harness to the fresh H3 generation namespace.
// Proves the H3 tools equal the sealed H2 tools after the namespace rename, except the recorded binding/guard
// edits; preserves the blocked H2 generation (no product executed). Starts no product, helper, worker, CLI,
// API, observer, interpreter, or certification case.
import fs from 'node:fs';
import path from 'node:path';
import { createHash } from 'node:crypto';
import assert from 'node:assert/strict';
import { spawnSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';

const root = fileURLToPath(new URL('../../../../', import.meta.url));
const checkOnly = process.argv[2] === '--check';
assert.ok(process.argv.length === 2 || (process.argv.length === 3 && checkOnly));
const evidenceRel = 'repositories/cca-conformance/evidence/mo1307/phase3ar2-final-h3-rebinding';
const evidence = path.join(root, evidenceRel);
const h2ToolRel = 'repositories/cca-conformance/tools/mo1307-phase3ar2-final-h2-corrected';
const h3ToolRel = 'repositories/cca-conformance/tools/mo1307-phase3ar2-final-h3-corrected';
const rebindingToolRel = 'repositories/cca-conformance/tools/mo1307-phase3ar2-final-h3-rebinding';
const h2Rel = 'repositories/cca-conformance/evidence/mo1307/phase3ar2-final-h2-corrected';
const h2ReportRel = 'docs/mo1307-phase3ar2-final-h2-corrected.md';
const h2CorrectionRel = 'repositories/cca-conformance/evidence/mo1307/phase3ar2-final-h2-harness-correction';
const h3Rel = 'repositories/cca-conformance/evidence/mo1307/phase3ar2-final-h3-corrected';
const h3CacheRel = '.cache/phase3ar2-final-h3-corrected';
const h3ReportRel = 'docs/mo1307-phase3ar2-final-h3-corrected.md';
const sourceRel = 'repositories/memoryos-readiness';
const authorizationPath = 'C:/Users/melsa/Documents/Codex/3ar2-h2-resume-capture-20261004T094932Z/h3-authorization.txt';
const authorizationSha256 = 'sha256:1915615061b3058e6fd15e488dcba0f75e56a804b3d6d9c30cf96bd6be65ba68';
const C3VB = '17fa84efe46d30e6f4be85fd2427485677a222a3', C3V = '98b766f9218b209f52251147213839b9775f6da3', productionTree = 'b9dabf54572e06c96bb5e48c4e20671f2cc24053';
const outputNames = ['authorization.txt', 'preserved-h2-generation.json', 'source-bindings.json', 'structural-validation.json', 'zero-execution-proof.json', 'receipt.json'];
const editedTools = ['campaign.mjs', 'prepare.mjs', 'record-harness-review.mjs'];

const hash = bytes => 'sha256:' + createHash('sha256').update(bytes).digest('hex');
const record = file => { const bytes = fs.readFileSync(file); return {path: path.relative(root, file).replaceAll('\\', '/'), byteLength: bytes.length, sha256: hash(bytes)}; };
const walk = (base, prefix = '') => fs.readdirSync(path.join(base, prefix), {withFileTypes: true}).sort((a, b) => a.name < b.name ? -1 : 1).flatMap(entry => {
  const p = prefix ? prefix + '/' + entry.name : entry.name, full = path.join(base, p), stat = fs.lstatSync(full);
  assert.equal(stat.isSymbolicLink(), false, full);
  return stat.isDirectory() ? walk(base, p) : [{...record(full), path: p}];
});
const rooted = rel => walk(path.join(root, rel)).map(row => ({...row, path: rel + '/' + row.path}));
const treeHash = rows => hash(Buffer.from(rows.map(row => `${row.path}\0${row.byteLength}\0${row.sha256}\n`).join('')));
const json = rel => JSON.parse(fs.readFileSync(path.join(root, rel), 'utf8'));
let gitInvocations = 0;
const git = (...args) => { gitInvocations++; const r = spawnSync('C:/Program Files/Git/cmd/git.exe', ['-c', 'safe.directory=C:/Users/melsa/Documents/Codex/3ar2', ...args], {cwd: root, encoding: 'utf8', windowsHide: true, maxBuffer: 64 << 20}); assert.ifError(r.error); assert.equal(r.status, 0, r.stderr); return r.stdout; };
const rename = text => text.replace(/(?<!fixtures\/mo1307\/)phase3ar2-final-h2-corrected/g, 'phase3ar2-final-h3-corrected').replaceAll('_H2_CORRECTED', '_H3_CORRECTED');
const lineDiff = (before, after) => {
  const a = before.split('\n'), b = after.split('\n'), m = a.length, n = b.length, t = Array.from({length: m + 1}, () => new Uint32Array(n + 1));
  for (let i = m - 1; i >= 0; i--) for (let j = n - 1; j >= 0; j--) t[i][j] = a[i] === b[j] ? t[i + 1][j + 1] + 1 : Math.max(t[i + 1][j], t[i][j + 1]);
  const removed = [], added = []; let i = 0, j = 0;
  while (i < m && j < n) { if (a[i] === b[j]) { i++; j++; } else if (t[i + 1][j] >= t[i][j + 1]) removed.push({line: i + 1, text: a[i++]}); else added.push({line: j + 1, text: b[j++]}); }
  while (i < m) removed.push({line: i + 1, text: a[i++]}); while (j < n) added.push({line: j + 1, text: b[j++]});
  return {removed, added};
};

// 1. Environment, candidate, zero product drift, fresh H3 namespaces.
assert.equal(path.resolve(root).toLowerCase(), 'c:\\users\\melsa\\documents\\codex\\3ar2');
assert.equal(process.version, 'v24.21.0'); assert.equal(process.platform, 'win32'); assert.equal(process.arch, 'x64');
assert.equal(hash(fs.readFileSync(process.execPath)), 'sha256:ba4e6d110e8c1592a1ecd390f6b05f3da124b13871a5be62b341a07a853c6c32');
assert.equal(git('rev-parse', 'HEAD').trim(), C3VB); assert.equal(git('branch', '--show-current').trim(), 'codex/mo1307-phase3ar2-c3ub');
assert.equal(git('rev-parse', C3VB + ':' + sourceRel).trim(), productionTree); assert.equal(git('rev-parse', C3V + ':' + sourceRel).trim(), productionTree);
assert.equal(git('diff', '--name-only'), ''); assert.equal(git('diff', '--cached', '--name-only'), ''); assert.equal(git('diff', '--name-only', '--', sourceRel), '');
for (const absent of [evidenceRel, h3Rel, h3CacheRel, h3ReportRel]) assert.equal(fs.existsSync(path.join(root, absent)), false, absent + ' must not exist');
assert.equal(hash(fs.readFileSync(authorizationPath)), authorizationSha256);

// 2. H2 zero-product correction remains intact (receipt, bindings, all 37 bound tool/fixture files).
const h2CorrectionReceipt = record(path.join(root, h2CorrectionRel, 'receipt.json'));
assert.equal(h2CorrectionReceipt.sha256, 'sha256:c1bf0a503ef2c455123ad619f966482fbbe87c5c56273b10316872cec8adbcd6');
const h2Correction = json(h2CorrectionRel + '/receipt.json'), h2Sources = json(h2CorrectionRel + '/source-bindings.json');
for (const binding of Object.values(h2Correction.bindings)) assert.deepEqual(record(path.join(root, binding.path)), binding);
const h2Bound = [...h2Sources.h2CampaignTools, ...h2Sources.h2CorrectionTools, ...h2Sources.aggregateFixture, ...h2Sources.inputFixture];
assert.equal(h2Bound.length, 37);
for (const row of h2Bound) assert.deepEqual(record(path.join(root, row.path)), row);
assert.equal(treeHash(rooted('repositories/cca-conformance/evidence/mo1307/phase3ar2-final-h-corrected')), h2Sources.preservedFailedHCorrectedGeneration.evidence.memberRecordSetSha256);

// 3. Blocked H2 generation: preserved as written; prepare stopped before packaging; no seal, no run start, no product.
const h2Evidence = rooted(h2Rel);
assert.deepEqual(h2Evidence.map(row => row.path.slice(h2Rel.length + 1)), ['campaign-config.json', 'campaign-run-finished.json', 'certification-receipt.json', 'closure.json', 'generation-authorization.txt', 'generation-stopped.json', 'integrity-after.json', 'pre-execution-gate.json', 'resource-and-cleanup-observations.json']);
const h2Receipt = record(path.join(root, h2Rel, 'certification-receipt.json'));
assert.deepEqual(h2Receipt, {path: h2Rel + '/certification-receipt.json', byteLength: 13870, sha256: 'sha256:a740a4b6e7032af7f7db0beeb3b42ceac33489bf43188906c4de917a849cd0c0'});
const h2Closure = json(h2Rel + '/closure.json'), h2Stopped = json(h2Rel + '/generation-stopped.json'), h2Finished = json(h2Rel + '/campaign-run-finished.json'), h2Cert = json(h2Rel + '/certification-receipt.json');
assert.deepEqual(h2Closure.receipt, h2Receipt); assert.equal(h2Closure.result, 'PHASE3AR2_CONCRETE_BLOCKER');
assert.equal(h2Stopped.reason, 'INTERRUPTED_STARTED_CAMPAIGN'); assert.equal(h2Finished.result, 'FAILED_INCOMPLETE');
assert.deepEqual(h2Cert.steps.map(row => row.result), Array(15).fill('NOT_RUN')); assert.equal(h2Cert.completedMandatoryCases, 0);
for (const absent of ['campaign-seal.json', 'campaign-run-start.json', 'historical-before.json', 'baseline.json', 'installed-before.json', 'candidate-identity.json', 'runtime.json', 'package', 'steps', 'scheduler', 'semantics', 'runtime-H', 'runtime-I', 'topology-B']) assert.equal(fs.existsSync(path.join(root, h2Rel, absent)), false, absent);
assert.equal(fs.existsSync(path.join(root, '.cache/phase3ar2-final-h2-corrected')), false, 'No H2 cache, package, or installation exists');
const h2GenerationAuthorization = record(path.join(root, h2Rel, 'generation-authorization.txt'));
assert.equal(h2GenerationAuthorization.sha256, h2Correction.bindings.authorization.sha256);
const h2Report = record(path.join(root, h2ReportRel));
const preservedH2 = {
  kind: 'MO1307Phase3AR2BlockedH2GenerationPreservation', version: '1.0.0', result: 'PRESERVED_BLOCKED_NOT_EXECUTED',
  namespace: h2Rel, evidence: h2Evidence, evidenceRecordSetSha256: treeHash(h2Evidence), receipt: h2Receipt, closure: record(path.join(root, h2Rel, 'closure.json')), report: h2Report,
  tools: {path: h2ToolRel, members: h2Sources.h2CampaignTools.length, memberRecordSetSha256: treeHash(h2Sources.h2CampaignTools), unchangedSinceH2Correction: true},
  reached: 'prepare wrote pre-execution-gate.json, campaign-config.json and generation-authorization.txt, then stopped before historical-before.json; no package, cache, installation, inventory, seal or campaign-run-start.json exists; close later recorded INTERRUPTED_STARTED_CAMPAIGN with all 15 steps NOT_RUN.',
  productProcessesRun: 0, helperProcessesRun: 0, cliProcessesRun: 0, apiProcessesRun: 0, certificationCasesRun: 0, resumed: false, rewritten: false, deleted: false,
  prepareStopCause: 'NOT_RECORDED: prepare stdout/stderr were not retained in the generation; a read-only replay of the same prepare section against current bytes reaches historical-before.json without error.',
};

// 4. H3 tools: identical to the sealed H2 tools after the namespace rename, except the recorded edits.
const h2Names = fs.readdirSync(path.join(root, h2ToolRel)).sort(), h3Names = fs.readdirSync(path.join(root, h3ToolRel)).sort();
assert.deepEqual(h3Names, h2Names); assert.equal(h3Names.length, 26);
const exact = [], renamedOnly = [], edited = {};
for (const name of h3Names) {
  const h2Bytes = fs.readFileSync(path.join(root, h2ToolRel, name)), h3Bytes = fs.readFileSync(path.join(root, h3ToolRel, name));
  const expected = rename(h2Bytes.toString('utf8')), actual = h3Bytes.toString('utf8');
  assert.deepEqual(Buffer.from(actual, 'utf8'), h3Bytes, name + ' must be valid UTF-8');
  if (editedTools.includes(name)) { assert.notEqual(actual, expected); edited[name] = lineDiff(expected, actual); }
  else { assert.equal(actual, expected, name + ' differs beyond the namespace rename'); (h2Bytes.equals(h3Bytes) ? exact : renamedOnly).push(name); }
}
const added = Object.values(edited).flatMap(diff => diff.added.map(row => row.text)).join('\n');
const removed = Object.values(edited).flatMap(diff => diff.removed.map(row => row.text)).join('\n');
for (const guard of ["'Refusing run: '+name+' is missing; prepare, inventory, method, review and seal must all succeed in this generation first'", "'Refusing close: '+name+' is missing; close applies only to a sealed generation whose one-shot run was started'"]) assert.ok(added.includes(guard), 'missing guard');
for (const protectedToken of ["const fixedLimits={helperWholeLifecycleMs:9000", "'timely-helper',{eofDelayMs:0,maxMs:5000}", "aggregateHelperEngineeringEnvelope={artificialEofDelayMs:5700", 'completedMandatoryCases===80']) assert.equal(removed.includes(protectedToken), false, protectedToken);
const runtimeText = fs.readFileSync(path.join(root, h3ToolRel, 'runtime-controls.mjs'), 'utf8');
for (const token of ["evidence/mo1307/phase3ar2-final-h3-corrected/runtime-'+mode", ".cache/phase3ar2-final-h3-corrected/install/node_modules/memoryos-readiness", "aggregateFixtureRelative='repositories/cca-conformance/fixtures/mo1307/phase3ar2-final-h2-corrected'", "inputFixtureRelative='repositories/cca-conformance/fixtures/mo1307/phase3ar2-final-h2-corrected-input'", "'aggregate-helper-exhaustion',{eofDelayMs:5700,error:'MO1307_TIMEOUT',minMs:28000,maxMs:31000"]) assert.equal(runtimeText.split(token).length - 1, 1, token);
const declared = {
  common: fs.readFileSync(path.join(root, h3ToolRel, 'common.mjs'), 'utf8').match(/export const relativeE='([^']+)'/)[1],
  cache: fs.readFileSync(path.join(root, h3ToolRel, 'common.mjs'), 'utf8').match(/export const cache=path\.join\(root,'([^']+)'\)/)[1],
  report: fs.readFileSync(path.join(root, h3ToolRel, 'campaign.mjs'), 'utf8').match(/reportPath=path\.join\(root,'(docs\/[^']+)'\)/)[1],
  wrapper: fs.readFileSync(path.join(root, h3ToolRel, 'runtime-controls-run.py'), 'utf8').match(/E=ROOT\/'([^']+)'/)[1],
  observe: fs.readFileSync(path.join(root, h3ToolRel, 'observe-command.py'), 'utf8').match(/E=ROOT\/'([^']+)'/)[1],
};
assert.deepEqual(declared, {common: h3Rel, cache: h3CacheRel, report: h3ReportRel, wrapper: h3Rel, observe: h3Rel});
const h3Tools = rooted(h3ToolRel), rebindingTools = rooted(rebindingToolRel);
assert.deepEqual(rebindingTools.map(row => row.path.slice(rebindingToolRel.length + 1)), ['.gitattributes', 'validate.mjs']);

// 5. Evidence.
const createdAt = new Date().toISOString();
const structural = {
  kind: 'MO1307Phase3AR2FinalH3RebindingStructuralValidation', version: '1.0.0', createdAt, result: 'PASS',
  rename: {pattern: "phase3ar2-final-h2-corrected -> phase3ar2-final-h3-corrected, except fixtures/mo1307/phase3ar2-final-h2-corrected[-input]; _H2_CORRECTED -> _H3_CORRECTED", fixtureRootsUnchanged: true, h2HarnessCorrectionRuleModuleUnchanged: true},
  byteIdenticalToH2: exact, renameOnly: renamedOnly, edited: Object.fromEntries(Object.entries(edited).map(([name, diff]) => [name, diff])),
  editPurpose: {
    'prepare.mjs': 'Bind the H3 rebinding receipt/tools/authorization; preserve and recheck the blocked H2 generation, its tools and report; compare observer/policy by hash (path moved); allow the preserved H2 paths in the pre-preparation status check.',
    'record-harness-review.mjs': 'Compare observer/policy by hash (path moved); bind the H3 rebinding receipt in the review.',
    'campaign.mjs': 'Seal the blocked H2 tools/evidence/report and the H3 rebinding as prerequisites; bind them in seal/receipt/handoff; guard run (refuses unless every prepared input and the seal exist) and close (refuses unless every prepared input, the seal and campaign-run-start.json exist), both before any write.',
  },
  declaredWriteNamespaces: declared, harnessLogicChanged: false, expectationsChanged: [], limitsChanged: false, productionChanged: false,
};
const sourceBindings = {
  kind: 'MO1307Phase3AR2FinalH3RebindingSourceBindings', version: '1.0.0', createdAt, result: 'PASS',
  candidate: {name: 'C3VB', commit: C3VB, productionCommit: C3V, productionTree},
  authorizationSource: {path: authorizationPath, ...(({byteLength, sha256}) => ({byteLength, sha256}))(record(authorizationPath))},
  h2HarnessCorrectionReceipt: h2CorrectionReceipt, h2CampaignTools: h2Sources.h2CampaignTools,
  h3CampaignTools: h3Tools, h3RebindingTools: rebindingTools, preservedBlockedH2Generation: {evidence: h2Evidence, report: h2Report, receipt: h2Receipt},
};
const zero = {
  kind: 'MO1307Phase3AR2FinalH3RebindingZeroExecutionProof', version: '1.0.0', createdAt, result: 'PASS',
  scope: 'Static byte/hash/structure comparison and read-only git queries only.', gitInvocations,
  executionCounters: {productInvocations: 0, helperInvocations: 0, workerInvocations: 0, cliInvocations: 0, apiInvocations: 0, nativeObserverInvocations: 0, engineeringInterpreterInvocations: 0, packageBuilds: 0, packageInstalls: 0, certificationCases: 0, retries: 0},
  repositoryWritesOutsideThisNamespace: 0, historicalEvidenceMutation: false,
};
if (checkOnly) {
  const preflight = process.env.MO1307_H3_PREFLIGHT_DIR;
  if (preflight) {
    assert.ok(path.isAbsolute(preflight) && !(path.resolve(preflight) + path.sep).toLowerCase().startsWith((path.resolve(root) + path.sep).toLowerCase()) && fs.readdirSync(preflight).length === 0);
    fs.writeFileSync(path.join(preflight, 'source-bindings.json'), JSON.stringify(sourceBindings, null, 2) + '\n', {flag: 'wx'});
    fs.writeFileSync(path.join(preflight, 'authorization.txt'), fs.readFileSync(authorizationPath), {flag: 'wx'});
  }
  process.stdout.write(JSON.stringify({result: 'CHECK_PASS', exact: exact.length, renameOnly: renamedOnly.length, edited: Object.keys(edited), h3Tools: h3Tools.length, writes: 0}) + '\n');
  process.exit(0);
}
fs.mkdirSync(evidence);
const put = (name, bytes) => { const file = path.join(evidence, name); fs.writeFileSync(file, bytes, {flag: 'wx'}); return record(file); };
const write = (name, value) => put(name, Buffer.from(JSON.stringify(value, null, 2) + '\n'));
const bindings = {
  authorization: put('authorization.txt', fs.readFileSync(authorizationPath)),
  preservedH2Generation: write('preserved-h2-generation.json', preservedH2),
  sourceBindings: write('source-bindings.json', sourceBindings),
  structuralValidation: write('structural-validation.json', structural),
  zeroExecutionProof: write('zero-execution-proof.json', zero),
};
write('receipt.json', {
  kind: 'MO1307Phase3AR2FinalH3GenerationRebindingReceipt', version: '1.0.0', createdAt, result: 'PASS', outcome: 'H3_GENERATION_REBOUND_ZERO_PRODUCT',
  candidate: sourceBindings.candidate, newGenerationNamespace: h3Rel, newCacheNamespace: h3CacheRel, newReport: h3ReportRel,
  preservedBlockedH2Generation: h2Receipt, h2HarnessCorrection: h2CorrectionReceipt, harnessLogicChanged: false, expectationsChanged: [], limitsChanged: false, productionChanged: false,
  guards: {run: 'refuses unless all prepared inputs and campaign-seal.json exist', close: 'refuses unless all prepared inputs, campaign-seal.json and campaign-run-start.json exist'},
  execution: zero.executionCounters, expectedEvidenceMembers: outputNames, bindings, retry: false, push: false, tag: false, phase3DStarted: false,
});
assert.deepEqual(walk(evidence).map(row => row.path), [...outputNames].sort());
process.stdout.write(JSON.stringify({result: 'PASS', receipt: record(path.join(evidence, 'receipt.json'))}) + '\n');
