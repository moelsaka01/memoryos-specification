// Zero-product, append-only validation of the Phase 3AR2 H2 harness correction.
// Starts no product, CLI, API, worker, helper, native observer, or certification case.
// Engineering interpreter use: exactly two pure validators (observer replay, fixture sandbox).
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { createHash } from 'node:crypto';
import assert from 'node:assert/strict';
import { spawnSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';

const root = fileURLToPath(new URL('../../../../', import.meta.url));
const checkOnly = process.argv[2] === '--check';
assert.ok(process.argv.length === 2 || (process.argv.length === 3 && checkOnly));
const evidenceRel = 'repositories/cca-conformance/evidence/mo1307/phase3ar2-final-h2-harness-correction';
const evidence = path.join(root, evidenceRel);
const toolRel = 'repositories/cca-conformance/tools/mo1307-phase3ar2-final-h2-corrected';
const correctionToolRel = 'repositories/cca-conformance/tools/mo1307-phase3ar2-final-h2-harness-correction';
const consumedRel = 'repositories/cca-conformance/evidence/mo1307/phase3ar2-final-h-corrected';
const consumedToolRel = 'repositories/cca-conformance/tools/mo1307-phase3ar2-final-h-corrected';
const consumedReportRel = 'docs/mo1307-phase3ar2-final-h-corrected.md';
const aggregateFixtureRel = 'repositories/cca-conformance/fixtures/mo1307/phase3ar2-final-h2-corrected';
const inputFixtureRel = 'repositories/cca-conformance/fixtures/mo1307/phase3ar2-final-h2-corrected-input';
const generationRel = 'repositories/cca-conformance/evidence/mo1307/phase3ar2-final-h2-corrected';
const generationCacheRel = '.cache/phase3ar2-final-h2-corrected';
const generationReportRel = 'docs/mo1307-phase3ar2-final-h2-corrected.md';
const sourceRel = 'repositories/memoryos-readiness';
const capture = 'C:/Users/melsa/Documents/Codex/3ar2-h2-resume-capture-20261004T094932Z';
const authorizationPath = capture + '/authorization.txt';
const authorizationSha256 = 'sha256:51fa5b436e63a58e141089322f67859c0146e7381128492bb7de08bae745fbb6';
const baselinePath = capture + '/preservation-baseline.json';
const baselineSha256 = 'sha256:2d8863305b59bec85a7dfc8ec9a6ddb574e2ab76bd5946a1a1b56a11cf9a5ee0';
const reviewPath = capture + '/h2-independent-review.json';
const python = 'C:/Users/melsa/.cache/codex-runtimes/codex-primary-runtime/dependencies/python/python.exe';
const gitExe = 'C:/Program Files/Git/cmd/git.exe';
const C3VB = '17fa84efe46d30e6f4be85fd2427485677a222a3';
const C3V = '98b766f9218b209f52251147213839b9775f6da3';
const productionTree = 'b9dabf54572e06c96bb5e48c4e20671f2cc24053';
const classifications = ['H_AGGREGATE_FIXTURE_INPUT_ISOLATION_DEFECT', 'H_OBSERVER_EVENT_ORDERING_DEFECT'];
const aggregateControl = {artificialEofDelayMs: 5700, engineeringMinMs: 28000, engineeringMaxMs: 31000, maxHelperSlots: 5, publicationStateMutations: 0, expectedError: 'MO1307_TIMEOUT', productAggregateDeadlineMs: 28000};
const outputNames = ['authorization.txt', 'failure-analysis.json', 'fixture-isolation.json', 'independent-review.json', 'observer-validation.json', 'source-bindings.json', 'structural-validation.json', 'zero-execution-proof.json', 'receipt.json'];

const hash = bytes => 'sha256:' + createHash('sha256').update(bytes).digest('hex');
const relative = file => path.relative(root, file).replaceAll('\\', '/');
const record = file => { const bytes = fs.readFileSync(file); return {path: relative(file), byteLength: bytes.length, sha256: hash(bytes)}; };
const externalRecord = file => { const bytes = fs.readFileSync(file); return {path: file.replaceAll('\\', '/'), byteLength: bytes.length, sha256: hash(bytes)}; };
const json = file => JSON.parse(fs.readFileSync(path.resolve(root, file), 'utf8'));
const text = file => fs.readFileSync(path.resolve(root, file), 'utf8');
const walk = (base, prefix = '') => fs.readdirSync(path.join(base, prefix), {withFileTypes: true}).sort((a, b) => a.name < b.name ? -1 : 1).flatMap(entry => {
  const memberPath = prefix ? prefix + '/' + entry.name : entry.name, full = path.join(base, memberPath), stat = fs.lstatSync(full);
  assert.equal(stat.isSymbolicLink(), false, full);
  return stat.isDirectory() ? walk(base, memberPath) : [{...record(full), path: memberPath}];
});
const walkDirs = (base, prefix = '') => fs.readdirSync(path.join(base, prefix), {withFileTypes: true}).filter(entry => entry.isDirectory()).flatMap(entry => { const p = prefix ? prefix + '/' + entry.name : entry.name; return [p, ...walkDirs(base, p)]; });
const rooted = (rel, rows) => rows.map(row => ({...row, path: rel + '/' + row.path}));
const treeHash = members => hash(Buffer.from(members.map(row => `${row.path}\0${row.byteLength}\0${row.sha256}\n`).join('')));
const count = (haystack, needle) => haystack.split(needle).length - 1;
const git = (...args) => { const r = spawnSync(gitExe, ['-c', 'safe.directory=C:/Users/melsa/Documents/Codex/3ar2', ...args], {cwd: root, encoding: null, windowsHide: true, maxBuffer: 64 * 1024 * 1024}); assert.ifError(r.error); assert.equal(r.status, 0, String(r.stderr)); return r.stdout.toString(); };
const counters = {gitInvocations: 0, engineeringInterpreterInvocations: 0};
const gitCounted = (...args) => { counters.gitInvocations++; return git(...args); };

// 1. Environment, candidate and zero product drift.
assert.equal(path.resolve(root).toLowerCase(), 'c:\\users\\melsa\\documents\\codex\\3ar2');
assert.equal(process.platform, 'win32'); assert.equal(process.arch, 'x64'); assert.equal(process.version, 'v24.21.0');
assert.equal(hash(fs.readFileSync(process.execPath)), 'sha256:ba4e6d110e8c1592a1ecd390f6b05f3da124b13871a5be62b341a07a853c6c32');
assert.equal(hash(fs.readFileSync(python)), 'sha256:4278cf2a296f31737cae77cafeeb3dc71683094cf3b8fd6f3f02c968687e771c');
assert.equal(gitCounted('rev-parse', 'HEAD').trim(), C3VB);
assert.equal(gitCounted('branch', '--show-current').trim(), 'codex/mo1307-phase3ar2-c3ub');
assert.equal(gitCounted('show', '-s', '--format=%P', C3VB).trim(), C3V);
assert.equal(gitCounted('rev-parse', C3VB + ':' + sourceRel).trim(), productionTree);
assert.equal(gitCounted('rev-parse', C3V + ':' + sourceRel).trim(), productionTree);
assert.equal(gitCounted('diff', '--name-only'), '');
assert.equal(gitCounted('diff', '--cached', '--name-only'), '');
assert.equal(gitCounted('diff', '--name-only', C3V, C3VB, '--', sourceRel), '');
assert.equal(gitCounted('diff', '--name-only', '--', sourceRel), '');
for (const absent of [evidenceRel, generationRel, generationCacheRel, generationReportRel, aggregateFixtureRel + '/absent-output']) assert.equal(fs.existsSync(path.join(root, absent)), false, absent + ' must not exist');

// 2. Production bytes and enforced identity components (static reads only).
const sourceMembers = walk(path.join(root, sourceRel));
assert.equal(sourceMembers.length, 89);
assert.equal(treeHash(sourceMembers), 'sha256:d837cc9ca6b654441b6218bce21024b40ea2f08080b4217192bb595e9cee9668');
const definitions = json(sourceRel + '/contracts/definitions.json');
const limits = {helperDeadlineMs: definitions.limits.helperDeadlineMs, helperAggregateDeadlineMs: definitions.limits.helperAggregateDeadlineMs, apiDeadlineMs: definitions.limits.apiDeadlineMs, cliDeadlineMs: definitions.limits.cliDeadlineMs, cleanupAllowanceMs: definitions.limits.cleanupAllowanceMs};
assert.deepEqual(limits, {helperDeadlineMs: 9000, helperAggregateDeadlineMs: 28000, apiDeadlineMs: 10000, cliDeadlineMs: 30000, cleanupAllowanceMs: 2000});
const helperSource = sourceMembers.find(row => row.path === 'helpers/windows-inspect.ps1');
assert.deepEqual(helperSource, {path: 'helpers/windows-inspect.ps1', byteLength: 29153, sha256: 'sha256:97ef5ae9ce7ab390548b04a2aefba9f922c3e1c6b9b80581c6c274f0b21f0127'});
const identityRules = {
  windowsPathsIdentityKeys: "const IDENTITY_KEYS = ['attributes', 'byteLength', 'fileId', 'finalPath', 'isDirectory', 'linkCount', 'volumeSerial'];",
  windowsPathsComparison: 'if (IDENTITY_KEYS.some(key => before[key] !== after[key])) boundary(',
  helperProtocolChainComparison: 'chain.forEach((item, index) => assertStableIdentity(state.parent[index], item, { directory: true }));',
  helperSameIdentity: "foreach ($key in @('attributes', 'byteLength', 'fileId', 'finalPath', 'isDirectory', 'linkCount', 'volumeSerial')) {",
  helperByteLengthSource: '$length = [long] [BitConverter]::ToUInt32($raw, 32) * 4294967296 + [BitConverter]::ToUInt32($raw, 36)'
};
assert.equal(count(text(sourceRel + '/src/windows-paths.mjs'), identityRules.windowsPathsIdentityKeys), 1);
assert.equal(count(text(sourceRel + '/src/windows-paths.mjs'), identityRules.windowsPathsComparison), 1);
assert.equal(count(text(sourceRel + '/src/helper-protocol.mjs'), identityRules.helperProtocolChainComparison), 1);
assert.equal(count(text(sourceRel + '/helpers/windows-inspect.ps1'), identityRules.helperSameIdentity), 1);
assert.equal(count(text(sourceRel + '/helpers/windows-inspect.ps1'), identityRules.helperByteLengthSource), 1);

// 3. Consumed generation byte preservation against the Section 1 baseline and its own seal.
assert.equal(hash(fs.readFileSync(baselinePath)), baselineSha256);
const baseline = JSON.parse(fs.readFileSync(baselinePath, 'utf8'));
const consumedNow = rooted(consumedRel, walk(path.join(root, consumedRel)));
assert.equal(consumedNow.length, 407);
const byPath = rows => [...rows].sort((a, b) => a.path < b.path ? -1 : a.path > b.path ? 1 : 0).map(row => ({path: row.path, byteLength: row.byteLength, sha256: row.sha256}));
assert.deepEqual(byPath(consumedNow), byPath(baseline.consumedGeneration), 'Consumed generation differs from the Section 1 baseline');
const consumedReceipt = json(consumedRel + '/certification-receipt.json'), consumedSeal = json(consumedRel + '/campaign-seal.json'), consumedClosure = json(consumedRel + '/closure.json'), consumedStart = json(consumedRel + '/campaign-run-start.json');
for (const binding of [consumedClosure.receipt, consumedClosure.report, consumedClosure.integrity, consumedStart.seal, consumedReceipt.seal, consumedReceipt.campaignRunStart, consumedReceipt.campaignRunFinished.binding, ...consumedReceipt.evidenceMembers, ...consumedSeal.tools]) assert.deepEqual(record(path.join(root, binding.path)), binding);
assert.equal(consumedReceipt.evidenceMembers.length, 405); assert.equal(consumedSeal.tools.length, 26);
assert.equal(consumedReceipt.result, 'PHASE3AR2_CONCRETE_BLOCKER');
assert.deepEqual(consumedReceipt.steps.map(row => [row.step, row.result]), 'ABCDEFGHIJKLMNO'.split('').map(step => [step, 'ABCDEFG'.includes(step) ? 'PASS' : step === 'H' ? 'FAIL' : 'NOT_RUN']));
assert.equal(consumedReceipt.completedMandatoryCases, 25); assert.equal(consumedReceipt.remainingMandatoryCases.length, 55); assert.equal(consumedReceipt.package.members, 89);
const consumedTools = rooted(consumedToolRel, walk(path.join(root, consumedToolRel)));
assert.equal(consumedTools.length, 26);
assert.deepEqual(consumedTools, consumedSeal.tools.map(row => ({path: row.path, byteLength: row.byteLength, sha256: row.sha256})).sort((a, b) => a.path < b.path ? -1 : 1));

// 4. Exact consumed failure facts (data only).
const runtimeH = consumedRel + '/runtime-H';
const aggregateCase = json(runtimeH + '/aggregate-helper-exhaustion.json');
assert.equal(aggregateCase.result, 'FAIL'); assert.equal(aggregateCase.elapsedMs, 23579.1962);
assert.deepEqual(aggregateCase.error, {code: 'MO1307_FILESYSTEM_BOUNDARY', message: 'MO1307_FILESYSTEM_BOUNDARY'});
assert.equal(aggregateCase.snapshot.helpers, 5); assert.equal(aggregateCase.snapshot.workers, 1); assert.equal(aggregateCase.snapshot.terminalCode, null); assert.equal(aggregateCase.snapshot.terminalAt, null);
const chainOf = ordinal => { const textBytes = fs.readFileSync(path.join(root, runtimeH, ordinal + '.response.bin')).toString('latin1'); return [...textBytes.matchAll(/"byteLength":(\d+),"fileId":"([0-9a-f]+)","finalPath":"([^"]+)"/g)].map(m => ({byteLength: Number(m[1]), fileId: m[2], finalPath: m[3].replaceAll('\\\\', '\\')})); };
const slot4 = chainOf('009'), slot5 = chainOf('010');
assert.equal(slot4.length, slot5.length);
const changedChain = slot4.map((row, index) => ({before: row, after: slot5[index]})).filter(pair => JSON.stringify(pair.before) !== JSON.stringify(pair.after));
assert.equal(changedChain.length, 1);
assert.deepEqual([changedChain[0].before.byteLength, changedChain[0].after.byteLength, changedChain[0].before.fileId === changedChain[0].after.fileId], [16384, 24576, true]);
assert.ok(changedChain[0].before.finalPath.toLowerCase().endsWith('\\evidence\\mo1307\\phase3ar2-final-h-corrected\\runtime-h'));

// 5. Tool structure: exact change specification versus the consumed tooling.
const consumedText = name => text(consumedToolRel + '/' + name).replaceAll('phase3ar2-final-h-corrected', 'phase3ar2-final-h2-corrected');
const h2Text = name => text(toolRel + '/' + name);
const unchanged = ['.gitattributes', 'cleanup-topology.mjs', 'core.mjs', 'decisions-tags.mjs', 'determinism.mjs', 'errors-observer.mjs', 'finalization-lock.ps1', 'finalization.mjs', 'observer-entry.mjs', 'runtime-controls-worker.mjs', 'runtime-observer.mjs', 'security-worker.mjs', 'stage.mjs', 'topology_identity_policy.py', 'transport-observer.mjs'];
for (const name of unchanged) assert.deepEqual(fs.readFileSync(path.join(root, toolRel, name)), fs.readFileSync(path.join(root, consumedToolRel, name)), name);
const namespaceOnly = ['common.mjs', 'observe-command.py', 'runtime-controls-run.py', 'security.mjs'];
for (const name of namespaceOnly) assert.equal(h2Text(name), consumedText(name), name);
const runtimeSubstitutions = [
  ["const inputRoot=path.join(evidence,'input');fs.mkdirSync(inputRoot);for(const id of ['authority','config','candidate','manifest','small'])fs.writeFileSync(path.join(inputRoot,id+'.bin'),'{}\\n');const outputRoot=path.join(evidence,'absent-output');",
   "const aggregateFixtureRelative='repositories/cca-conformance/fixtures/mo1307/phase3ar2-final-h2-corrected';\nconst aggregateFixtureRoot=path.join(root,aggregateFixtureRelative),outputRoot=path.join(aggregateFixtureRoot,'absent-output');\nconst fixtureSnapshot=()=>fs.readdirSync(aggregateFixtureRoot,{withFileTypes:true}).sort((a,b)=>a.name.localeCompare(b.name)).map(entry=>{const target=path.join(aggregateFixtureRoot,entry.name),stat=fs.lstatSync(target);assert.equal(stat.isDirectory(),false,'Aggregate fixture must contain only sealed files');const bytes=fs.readFileSync(target);return {name:entry.name,byteLength:bytes.length,sha256:'sha256:'+hash(bytes)};});\nassert.equal(fs.existsSync(outputRoot),false,'Sealed aggregate absent-output target must be absent');const aggregateFixtureBefore=fixtureSnapshot();assert.ok(aggregateFixtureBefore.length>0,'Sealed aggregate fixture is empty');\nconst inputFixtureRelative='repositories/cca-conformance/fixtures/mo1307/phase3ar2-final-h2-corrected-input';\nconst inputRoot=path.join(root,inputFixtureRelative),inputNames=['authority','config','candidate','manifest','small'].map(id=>id+'.bin');\nconst inputSnapshot=()=>fs.readdirSync(inputRoot,{withFileTypes:true}).sort((a,b)=>a.name.localeCompare(b.name)).map(entry=>{const target=path.join(inputRoot,entry.name),stat=fs.lstatSync(target);assert.equal(stat.isFile(),true,'Input fixture must contain only sealed files');const bytes=fs.readFileSync(target);return {name:entry.name,byteLength:bytes.length,sha256:'sha256:'+hash(bytes)};});\nconst inputFixtureBefore=inputSnapshot();assert.deepEqual(inputFixtureBefore.map(row=>row.name),[...inputNames].sort());assert.ok(inputFixtureBefore.every(row=>row.byteLength===3&&row.sha256==='sha256:'+hash('{}\\n')),'Sealed input fixture bytes changed');"],
  ["historicalCharacterizationH:'NOT_ESTABLISHED',runtime:{node:", "historicalCharacterizationH:'NOT_ESTABLISHED',aggregateFixture:{root:aggregateFixtureRelative,target:'absent-output',sealedMembers:aggregateFixtureBefore,runtimeWrites:0},inputFixture:{root:inputFixtureRelative,sealedMembers:inputFixtureBefore,runtimeWrites:0},runtime:{node:"],
  ['Engineering stdin EOF delays force actual native helper waiting; late controls defer', 'Engineering stdin EOF delays force actual native helper waiting; the aggregate 5700-ms EOF delay makes the unchanged 28000-ms product aggregate deadline terminate the fifth helper before any publication-state operation, so the sealed absent-output fixture remains immutable. Late controls defer'],
  ["await run('aggregate-helper-exhaustion',{eofDelayMs:4000,", "await run('aggregate-helper-exhaustion',{eofDelayMs:5700,"],
  ["for(let slot=1;slot<=9;slot++){if(slot===6)fs.mkdirSync(outputRoot);if(slot===8)fs.writeFileSync(path.join(outputRoot,'memoryos-readiness-result.json.pending'),'{}\\n',{flag:'wx'});const q=", "for(let slot=1;slot<=9;slot++){assert.ok(slot<=5,'Aggregate deadline must terminate before publication-state operations');const q="],
  ["assert.deepEqual(pins(),before,'Installed dependencies mutated');\n}catch", "assert.deepEqual(pins(),before,'Installed dependencies mutated');assert.equal(fs.existsSync(outputRoot),false,'Aggregate fixture target mutated');assert.deepEqual(fixtureSnapshot(),aggregateFixtureBefore,'Aggregate fixture root mutated');assert.deepEqual(inputSnapshot(),inputFixtureBefore,'Input fixture root mutated');\n}catch"],
  ["finally{write('receipt.json',", "finally{const aggregateFixtureAfter=fixtureSnapshot(),inputFixtureAfter=inputSnapshot();write('receipt.json',"],
  ['dependenciesAfter:pins(),noProductChanges:true,', "dependenciesAfter:pins(),aggregateFixture:{root:aggregateFixtureRelative,target:'absent-output',before:aggregateFixtureBefore,after:aggregateFixtureAfter,targetAbsent:!fs.existsSync(outputRoot),runtimeWrites:0},inputFixture:{root:inputFixtureRelative,before:inputFixtureBefore,after:inputFixtureAfter,runtimeWrites:0},noProductChanges:true,"],
  ["file identities are real.','No valid response", "file identities are real.','The aggregate 5700-ms EOF delay is an engineering-only scheduling seam: it changes no product deadline and forces the unchanged 28000-ms aggregate boundary before any publication-state operation or fixture mutation.','No valid response"],
];
const observerSubstitutions = [
  ['POLICY_SPEC.loader.exec_module(IDENTITY_POLICY)\n', "POLICY_SPEC.loader.exec_module(IDENTITY_POLICY)\nORDERING_PATH = Path(__file__).resolve().parents[1] / 'mo1307-phase3ar2-final-h2-harness-correction' / 'observer_event_ordering.py'\nORDERING_SPEC = importlib.util.spec_from_file_location('mo1307_observer_event_ordering', ORDERING_PATH)\nEVENT_ORDERING = importlib.util.module_from_spec(ORDERING_SPEC)\nORDERING_SPEC.loader.exec_module(EVENT_ORDERING)\n"],
  ["                    if entry:\n                        row['lastSeenAt'] = sample_start\n                    live.append(metrics(row, entry))\n", "                    observation = metrics(row, entry)\n                    row['lastSeenAt'] = EVENT_ORDERING.corrected_last_seen(\n                        row['lastSeenAt'], sample_start, entry, observation)\n                    live.append(observation)\n"],
  ['                  identityPolicy=IDENTITY_POLICY.POLICY_IDENTITY,\n', '                  identityPolicy=IDENTITY_POLICY.POLICY_IDENTITY,\n                  eventOrderingRule=EVENT_ORDERING.RULE,\n'],
];
const applyExact = (source, substitutions, name) => substitutions.reduce((value, [from, to]) => { assert.equal(count(value, from), 1, name + ' substitution source must occur exactly once: ' + from.slice(0, 60)); return value.replace(from, () => to); }, source);
assert.equal(h2Text('runtime-controls.mjs'), applyExact(consumedText('runtime-controls.mjs'), runtimeSubstitutions, 'runtime-controls.mjs'), 'runtime-controls.mjs differs beyond the specified H2 changes');
assert.equal(h2Text('runtime-controls-observer.py'), applyExact(consumedText('runtime-controls-observer.py'), observerSubstitutions, 'runtime-controls-observer.py'), 'runtime-controls-observer.py differs beyond the specified H2 changes');
const bookkeeping = ['campaign.mjs', 'method.mjs', 'prepare.mjs', 'record-harness-review.mjs', 'recover-inventory.mjs'];
const lineDiff = (before, after) => {
  const a = before.split('\n'), b = after.split('\n'), m = a.length, n = b.length, table = Array.from({length: m + 1}, () => new Uint32Array(n + 1));
  for (let i = m - 1; i >= 0; i--) for (let j = n - 1; j >= 0; j--) table[i][j] = a[i] === b[j] ? table[i + 1][j + 1] + 1 : Math.max(table[i + 1][j], table[i][j + 1]);
  const removed = [], added = []; let i = 0, j = 0;
  while (i < m && j < n) { if (a[i] === b[j]) { i++; j++; } else if (table[i + 1][j] >= table[i][j + 1]) removed.push({line: i + 1, text: a[i++]}); else added.push({line: j + 1, text: b[j++]}); }
  while (i < m) removed.push({line: i + 1, text: a[i++]}); while (j < n) added.push({line: j + 1, text: b[j++]});
  return {removed, added};
};
const bookkeepingDiffs = Object.fromEntries(bookkeeping.map(name => [name, lineDiff(consumedText(name), h2Text(name))]));
const h2Tools = rooted(toolRel, walk(path.join(root, toolRel)));
assert.equal(h2Tools.length, 26);
assert.deepEqual(h2Tools.map(row => row.path.slice(toolRel.length + 1)).sort(), consumedTools.map(row => row.path.slice(consumedToolRel.length + 1)).sort());
const correctionTools = rooted(correctionToolRel, walk(path.join(root, correctionToolRel)));
assert.deepEqual(correctionTools.map(row => row.path.slice(correctionToolRel.length + 1)), ['.gitattributes', 'observer_event_ordering.py', 'validate.mjs', 'validate_fixture.py', 'validate_observer.py']);

// 6. Expectations, boundaries and resource authority (structural).
const runtimeText = h2Text('runtime-controls.mjs'), consumedRuntimeText = consumedText('runtime-controls.mjs');
const runLines = source => Object.fromEntries([...source.matchAll(/await run\('([a-z-]+)',([^\n]*)/g)].map(m => [m[1], m[2]]));
const caseOptionsBefore = runLines(consumedRuntimeText), caseOptionsAfter = runLines(runtimeText);
assert.deepEqual(Object.keys(caseOptionsAfter), ['timely-helper', 'cancel-before-helper', 'helper-timeout', 'late-helper-success-rejected', 'cancel-during-helper', 'cancel-between-helper-worker', 'aggregate-helper-exhaustion', 'worker-timeout', 'worker-cancellation', 'late-worker-result-rejected', 'cancel-after-worker-before-publication'].filter(name => name in caseOptionsAfter));
const changedOptions = Object.keys(caseOptionsAfter).filter(name => caseOptionsAfter[name] !== caseOptionsBefore[name]);
assert.deepEqual(changedOptions, ['aggregate-helper-exhaustion']);
const aggregateOptionHead = "'aggregate-helper-exhaustion',{eofDelayMs:5700,error:'MO1307_TIMEOUT',minMs:28000,maxMs:31000";
assert.equal(count(runtimeText, aggregateOptionHead), 1);
assert.equal(count(consumedRuntimeText, "'aggregate-helper-exhaustion',{eofDelayMs:4000,error:'MO1307_TIMEOUT',minMs:28000,maxMs:31000"), 1);
const structuralTokens = {
  timelyHelper: "'timely-helper',{eofDelayMs:0,maxMs:5000}",
  boundary8000: "['former-equality-8000-now-success',8000,'PASS']",
  boundary8999: "['strict-before-9000',8999,'PASS']",
  boundary9000: "['equality-9000-timeout',9000,'MO1307_TIMEOUT']",
  aggregateExpectation: aggregateOptionHead,
  aggregateAtTimeout: 'Math.abs(atTimeout-28000)<100',
  aggregateSelectedDeadline: 'DEFINITIONS.limits.helperAggregateDeadlineMs-DEFINITIONS.limits.helperDeadlineMs',
  runtimeLimits: 'limits:{helperMs:9000,aggregateMs:28000,workerMs:10000,cliMs:30000,cleanupMs:2000}',
  helperRelations: "limitRelations={helperSuccess:'elapsedMs < 9000',helperTimeout:'elapsedMs >= 9000',aggregateSuccess:'helperActiveMs < 28000',aggregateTimeout:'helperActiveMs >= 28000'}",
};
for (const [name, token] of Object.entries(structuralTokens)) assert.equal(count(runtimeText, token), 1, name);
const campaignLimits = "const fixedLimits={helperWholeLifecycleMs:9000,helperSuccess:'elapsedMs < 9000',helperTimeout:'elapsedMs >= 9000',aggregateHelperActiveMs:28000,aggregateSuccess:'helperActiveMs < 28000',aggregateTimeout:'helperActiveMs >= 28000',cliRenameAdmissionMs:30000,apiWorkerMs:10000,failureCleanupMs:2000};";
assert.equal(count(h2Text('campaign.mjs'), campaignLimits), 1); assert.equal(count(consumedText('campaign.mjs'), campaignLimits), 1);
const inventoryCaseIds = "  H: ['timely-helper', 'cancel-before-helper', 'helper-timeout', 'late-helper-success-rejected', 'cancel-during-helper', 'cancel-between-helper-worker', 'aggregate-helper-exhaustion'],";
assert.equal(count(h2Text('recover-inventory.mjs'), inventoryCaseIds), 1);
assert.equal(count(h2Text('recover-inventory.mjs'), 'assert.equal(inventory.steps.flatMap(row => row.cases).length, 80);'), 1);
for (const removed of Object.values(bookkeepingDiffs).flatMap(diff => diff.removed)) for (const protectedToken of [campaignLimits, inventoryCaseIds, structuralTokens.timelyHelper]) assert.equal(removed.text.includes(protectedToken), false, 'Protected token removed');

// 7. Fixture isolation: computed path sets (A) and source scans.
const norm = p => path.resolve(root, p).replaceAll('\\', '/').toLowerCase();
const ancestors = p => { const out = []; let current = path.resolve(root, p); for (;;) { out.unshift(current); const parent = path.dirname(current); if (parent === current) break; current = parent; } return out.map(item => item.replaceAll('\\', '/').toLowerCase()); };
const under = (child, parent) => child === parent || child.startsWith(parent.endsWith('/') ? parent : parent + '/');
const match1 = (source, regex, label) => { const m = source.match(regex); assert.ok(m, label); return m[1]; };
const declared = {
  commonEvidence: match1(h2Text('common.mjs'), /export const relativeE='([^']+)'/, 'common evidence'),
  commonCache: match1(h2Text('common.mjs'), /export const cache=path\.join\(root,'([^']+)'\)/, 'common cache'),
  prepareEvidence: match1(h2Text('prepare.mjs'), /const rel='([^']+)'/, 'prepare evidence'),
  prepareCache: match1(h2Text('prepare.mjs'), /cache=path\.join\(root,'([^']+)'\)/, 'prepare cache'),
  prepareReport: match1(h2Text('prepare.mjs'), /const reportRel='([^']+)'/, 'prepare report'),
  runtimeEvidence: match1(runtimeText, /const evidence = path\.join\(root, '([^']+)'\+mode\)/, 'runtime evidence'),
  runtimeInstalled: match1(runtimeText, /const installed = path\.join\(root, '([^']+)'\)/, 'runtime installed'),
  wrapperEvidence: match1(h2Text('runtime-controls-run.py'), /E=ROOT\/'([^']+)'/, 'wrapper evidence'),
  observeEvidence: match1(h2Text('observe-command.py'), /E=ROOT\/'([^']+)'/, 'observe evidence'),
  securityScratch: match1(h2Text('security.mjs'), /path\.join\(root, '(\.cache\/[^']+)'\+mode\)/, 'security scratch'),
  campaignReport: match1(h2Text('campaign.mjs'), /reportPath=path\.join\(root,'(docs\/[^']+)'\)/, 'campaign report'),
};
assert.equal(declared.commonEvidence, generationRel); assert.equal(declared.prepareEvidence, generationRel); assert.equal(declared.wrapperEvidence, generationRel); assert.equal(declared.observeEvidence, generationRel);
assert.ok(declared.runtimeEvidence.startsWith(generationRel + '/'));
assert.equal(declared.commonCache, generationCacheRel); assert.equal(declared.prepareCache, generationCacheRel);
assert.ok(declared.runtimeInstalled.startsWith(generationCacheRel + '/')); assert.ok(declared.securityScratch.startsWith(generationCacheRel + '/'));
assert.equal(declared.prepareReport, generationReportRel); assert.equal(declared.campaignReport, generationReportRel);
const writeRoots = [generationRel, generationCacheRel].map(norm);
const writeFiles = [generationReportRel].map(norm);
const entryMutatedDirectories = [...new Set([...writeRoots, ...writeFiles].map(p => path.posix.dirname(p)))];
const consumedWrittenDirectories = [consumedRel, ...walkDirs(path.join(root, consumedRel)).map(d => consumedRel + '/' + d), '.cache/phase3ar2-final-h-corrected', ...walkDirs(path.join(root, '.cache/phase3ar2-final-h-corrected')).map(d => '.cache/phase3ar2-final-h-corrected/' + d)];
const mappedConsumedDirectories = consumedWrittenDirectories.map(d => norm(d.replaceAll('phase3ar2-final-h-corrected', 'phase3ar2-final-h2-corrected')));
assert.ok(mappedConsumedDirectories.every(d => writeRoots.some(rootPath => under(d, rootPath))), 'Empirical write set exceeds declared write roots');
const inspected = {
  aggregate: [...ancestors(aggregateFixtureRel), norm(aggregateFixtureRel + '/absent-output')],
  input: [...ancestors(inputFixtureRel), ...fs.readdirSync(path.join(root, inputFixtureRel)).map(name => norm(inputFixtureRel + '/' + name))],
};
const violations = [];
for (const [fixture, paths] of Object.entries(inspected)) for (const p of paths) {
  for (const writeRoot of writeRoots) if (under(p, writeRoot) || under(writeRoot, p) && !ancestors(writeRoot).includes(p)) violations.push({fixture, path: p, writeRoot, type: 'INSPECTED_PATH_UNDER_WRITE_ROOT'});
  for (const file of writeFiles) if (file === p) violations.push({fixture, path: p, type: 'INSPECTED_PATH_IS_WRITE_FILE'});
  if (entryMutatedDirectories.includes(p)) violations.push({fixture, path: p, type: 'INSPECTED_PATH_RECEIVES_ENTRY_WRITES'});
}
for (const writeRoot of writeRoots) for (const fixtureRoot of [aggregateFixtureRel, inputFixtureRel].map(norm)) if (under(writeRoot, fixtureRoot)) violations.push({writeRoot, fixtureRoot, type: 'WRITE_ROOT_UNDER_FIXTURE'});
assert.deepEqual(violations, []);
const commonAncestors = inspected.aggregate.filter(p => writeRoots.some(w => ancestors(w).includes(p)));
const consumedPattern = {
  consumedInputRoot: match1(consumedRuntimeText, /const inputRoot=path\.join\((evidence,'input')\)/, 'consumed input root'),
  consumedOutputRoot: match1(consumedRuntimeText, /const outputRoot=path\.join\((evidence,'absent-output')\)/, 'consumed output root'),
};
const requestRoots = match1(runtimeText, /roots:\[\{id:sequence>=4\?'output':'input',path:(sequence>=4\?outputRoot:inputRoot)\}\]/, 'request roots');
const fixtureTokenScan = Object.fromEntries(h2Tools.map(row => row.path.slice(toolRel.length + 1)).filter(name => !name.startsWith('.')).map(name => [name, count(h2Text(name), 'fixtures/mo1307/phase3ar2-final-h2-corrected')]));
for (const forbidden of ['fs.mkdirSync(outputRoot', 'path.join(outputRoot,', 'fs.mkdirSync(inputRoot', "path.join(evidence,'input')", "path.join(evidence,'absent-output')", 'writeFileSync(path.join(inputRoot', 'writeFileSync(path.join(aggregateFixtureRoot', 'mkdirSync(aggregateFixtureRoot']) assert.equal(count(runtimeText, forbidden), 0, forbidden);
assert.deepEqual(Object.entries(fixtureTokenScan).filter(([, n]) => n > 0).map(([name]) => name).sort(), ['campaign.mjs', 'prepare.mjs', 'record-harness-review.mjs', 'runtime-controls.mjs']);
const otherSectionScan = {
  K: {tool: 'finalization.mjs', inputs: match1(h2Text('finalization.mjs'), /(scratch = path\.join\(cache, 'finalization'\))/, 'finalization scratch'), location: 'harness-private cache scratch created before K cases; not an evidence directory', sharesHFixtureUnderEvidencePattern: false},
  LM: {tool: 'security.mjs', inputs: match1(h2Text('security.mjs'), /(const input=path\.join\(scratch,'input'\))/, 'security input'), location: 'harness-private cache scratch per step; not an evidence directory', sharesHFixtureUnderEvidencePattern: false},
};

// 8. Pure engineering validators (observer replay; fixture sandbox).
const sandboxTemp = os.tmpdir();
assert.ok(!norm(sandboxTemp).startsWith(norm('.') + '/') && norm(sandboxTemp) !== norm('.'), 'Sandbox temp must be outside the repository');
const runPython = file => { counters.engineeringInterpreterInvocations++; const r = spawnSync(python, ['-I', '-S', '-B', path.join(root, correctionToolRel, file)], {cwd: sandboxTemp, env: {SystemRoot: 'C:\\Windows', WINDIR: 'C:\\Windows', TEMP: sandboxTemp, TMP: sandboxTemp}, encoding: null, windowsHide: true, maxBuffer: 64 * 1024 * 1024, timeout: 120000}); assert.ifError(r.error); assert.equal(r.status, 0, String(r.stderr)); assert.equal(r.stderr.length, 0, String(r.stderr)); return r.stdout; };
const observerBytes = runPython('validate_observer.py'), observer = JSON.parse(observerBytes.toString('utf8'));
assert.equal(observer.result, 'PASS'); assert.equal(observer.allCasesMatchExpected, true); assert.equal(observer.rule, 'MO1307_OBSERVER_EVENT_ORDERING@1.0.0'); assert.equal(observer.policy, 'MO1307_TOPOLOGY_IDENTITY_POLICY@1.0.0');
assert.deepEqual(Object.fromEntries(Object.entries(observer.cases).map(([id, row]) => [id, [row.expected, row.actual, row.result]])), {E: ['PASS', 'PASS', 'PASS'], F: ['FAIL', 'FAIL', 'PASS'], G: ['FAIL', 'FAIL', 'PASS'], H: ['FAIL', 'FAIL', 'PASS'], I: ['PASS', 'PASS', 'PASS']});
assert.equal(observer.cases.E.classification, 'TERMINATED_KNOWN_IDENTITY'); assert.equal(observer.cases.F.classification, 'LIFETIME_CONTRADICTION'); assert.equal(observer.cases.G.classification, 'PID_REUSE_OR_REPLACEMENT_EVIDENCE'); assert.equal(observer.cases.H.classification, 'NO_PRIOR_POSITIVE_IDENTITY'); assert.equal(observer.cases.I.classification, 'POST_IDENTITY_REQUERY_UNAVAILABLE');
assert.equal(observer.replay.terminatedKnownIdentity.length, 21); assert.equal(observer.replay.oldRuleReproducesAllConsumedLastSeenAt.mismatches, 0);
assert.deepEqual(observer.pid2124.consumedDecision, {accepted: false, classification: 'LIFETIME_CONTRADICTION'}); assert.deepEqual(observer.pid2124.consumedFailedCheck, ['positiveObservationProvenance']);
const fixtureBytes = runPython('validate_fixture.py'), fixture = JSON.parse(fixtureBytes.toString('utf8'));
assert.equal(fixture.result, 'PASS'); assert.equal(fixture.sandboxRemoved, true);
assert.deepEqual(Object.fromEntries(Object.entries(fixture.cases).map(([id, row]) => [id, [row.expected, row.actual]])), {B: ['PASS', 'PASS'], C: ['FAIL', 'FAIL'], D: ['PASS', 'PASS']});
assert.equal(fixture.realAggregateTargetAbsent, true);
assert.equal(counters.engineeringInterpreterInvocations, 2);

// 9. Independent static review of the exact final tool bytes.
const reviewedFilesNow = [...h2Tools, ...correctionTools, ...rooted(aggregateFixtureRel, walk(path.join(root, aggregateFixtureRel))), ...rooted(inputFixtureRel, walk(path.join(root, inputFixtureRel)))];
const reviewPending = checkOnly && !fs.existsSync(reviewPath);
const reviewBytes = reviewPending ? null : fs.readFileSync(reviewPath), review = reviewPending ? null : JSON.parse(reviewBytes.toString('utf8'));
if (!reviewPending) { assert.equal(review.result, 'PASS'); assert.deepEqual(review.blockingFindings, []); assert.deepEqual(review.reviewedFiles, reviewedFilesNow, 'Independent review does not match the exact current H2 bytes'); }
assert.equal(hash(fs.readFileSync(authorizationPath)), authorizationSha256);

// 10. Evidence documents.
const createdAt = new Date().toISOString();
const executionCounters = {productInvocations: 0, semanticEvaluations: 0, helperInvocations: 0, workerInvocations: 0, cliInvocations: 0, apiInvocations: 0, nativeObserverInvocations: 0, packageBuilds: 0, packageInstalls: 0, certificationCases: 0, diagnosticsRun: 0, retries: 0, replacementExecutions: 0, historicalEvidencePromotions: 0};
const gate = {
  A: {title: 'isolated aggregate fixture outside live evidence tree', expected: 'PASS', actual: violations.length === 0 ? 'PASS' : 'FAIL', evidence: 'fixture-isolation.json#pathSetAnalysis'},
  B: {title: 'evidence writes cannot mutate aggregate fixture identity', expected: 'PASS', actual: fixture.cases.B.actual, evidence: 'fixture-isolation.json#synthetic.cases.B and #pathSetAnalysis'},
  C: {title: 'synthetic mutation inside fixture root', expected: 'FAIL', actual: fixture.cases.C.actual, detected: fixture.cases.C.detected, evidence: 'fixture-isolation.json#synthetic.cases.C'},
  D: {title: 'byteLength remains an enforced identity component', expected: 'PASS', actual: fixture.cases.D.actual === 'PASS' ? 'PASS' : 'FAIL', staticRules: identityRules, evidence: 'fixture-isolation.json#synthetic.cases.D and structural-validation.json#productIdentityRules'},
  E: {title: 'known process with consistent termination provenance', expected: 'PASS', actual: observer.cases.E.actual, evidence: 'observer-validation.json#cases.E'},
  F: {title: 'known process with contradictory lifetime', expected: 'FAIL', actual: observer.cases.F.actual, evidence: 'observer-validation.json#cases.F'},
  G: {title: 'PID reuse', expected: 'FAIL', actual: observer.cases.G.actual, evidence: 'observer-validation.json#cases.G'},
  H: {title: 'unknown process', expected: 'FAIL', actual: observer.cases.H.actual, evidence: 'observer-validation.json#cases.H'},
  I: {title: 'authorized post-termination unavailable requery with exact provenance', expected: 'PASS', actual: observer.cases.I.actual, evidence: 'observer-validation.json#cases.I'},
};
assert.ok(Object.values(gate).every(row => row.expected === row.actual), JSON.stringify(gate));
const failureAnalysis = {
  kind: 'MO1307Phase3AR2FinalH2HarnessFailureAnalysis', version: '1.0.0', createdAt, result: 'PASS', classifications,
  classificationUniverse: ['HARNESS', 'PRODUCT', 'ENVIRONMENT', 'AUTHORITY'], classificationDomain: 'HARNESS',
  preservedGeneration: {path: consumedRel, receipt: record(path.join(root, consumedRel, 'certification-receipt.json')), steps: Object.fromEntries(consumedReceipt.steps.map(row => [row.step, row.result])), completedMandatoryCases: 25, resumed: false, rewritten: false, retried: false, promoted: false},
  aggregate: {case: 'aggregate-helper-exhaustion', expected: 'MO1307_TIMEOUT', actual: aggregateCase.error.code, elapsedMs: aggregateCase.elapsedMs, helperUsedMs: aggregateCase.snapshot.helperUsedMs, helpers: aggregateCase.snapshot.helpers, workers: aggregateCase.snapshot.workers, terminalCode: aggregateCase.snapshot.terminalCode, artificialEofDelayMs: 4000,
    changedChainElement: changedChain[0], slot4Chain: slot4, slot5Chain: slot5,
    diagnosis: 'The consumed harness placed absent-output beneath the live runtime-H evidence directory and wrote request/response/stderr evidence into that directory on every helper call. Between the slot-4 and slot-5 CHECK_OUTPUT stable-identity proofs the runtime-H directory byteLength changed from 16384 to 24576 with the same file ID; the product compared the full ancestor chain and correctly returned MO1307_FILESYSTEM_BOUNDARY.',
    rejected: {PRODUCT: 'Rejected: the product enforced its unchanged stable-identity rule over a chain element the harness itself mutated.', AUTHORITY: 'Rejected: MO1307_TIMEOUT remains the authorized expectation; no authority conflict exists.', ENVIRONMENT: 'Rejected: the mutation was caused by the harness evidence writes, not by an external process.'}},
  observer: {pid: 2124, classification: 'H_OBSERVER_EVENT_ORDERING_DEFECT', facts: observer.pid2124,
    rejected: {PRODUCT: 'Rejected: the external observer, not the product, produced the contradiction.', POLICY: 'Rejected: the identity policy correctly rejected an inconsistent lastSeenAt; the defect is in observer bookkeeping.'}},
  corrections: {aggregateControl, aggregateFixtureRoot: aggregateFixtureRel, inputFixtureRoot: inputFixtureRel, eventOrderingRule: 'MO1307_OBSERVER_EVENT_ORDERING@1.0.0'},
  productionChange: false, authorityChange: false, limitChange: false, expectationChange: false, policyChange: false, retry: false,
};
const fixtureIsolation = {
  kind: 'MO1307Phase3AR2FinalH2FixtureIsolationValidation', version: '1.0.0', createdAt, result: 'PASS',
  pathSetAnalysis: {declaredWriteSources: declared, writeRoots, writeFiles, entryMutatedDirectories, empiricalConsumedWriteDirectories: consumedWrittenDirectories.length, empiricalWithinDeclaredWriteRoots: true, inspectedPaths: inspected, sharedAncestorsWithWriteRoots: commonAncestors, sharedAncestorsReceiveEntryWrites: false, violations},
  hCaseScan: {consumed: {readSetInputRoot: consumedPattern.consumedInputRoot, checkOutputTarget: consumedPattern.consumedOutputRoot, pattern: 'Both the READ_SET input root used by every H case and the aggregate CHECK_OUTPUT target lived beneath live runtime-H evidence.'}, h2: {requestRoots, inputRoot: inputFixtureRel, outputTarget: aggregateFixtureRel + '/absent-output', fixtureUnderEvidence: false}, otherCasesWithPattern: [], fixtureTokenScan, otherSections: otherSectionScan},
  synthetic: JSON.parse(fixtureBytes.toString('utf8')),
  gate: {A: gate.A, B: gate.B, C: gate.C, D: gate.D},
};
const sourceBindings = {
  kind: 'MO1307Phase3AR2FinalH2HarnessCorrectionSourceBindings', version: '1.0.0', createdAt, result: 'PASS',
  candidate: {name: 'C3VB', commit: C3VB, productionCommit: C3V, productionTree},
  authorizationSource: externalRecord(authorizationPath), preservationBaseline: externalRecord(baselinePath), independentReviewSource: reviewPending ? null : externalRecord(reviewPath),
  h2CampaignTools: h2Tools, h2CorrectionTools: correctionTools,
  aggregateFixture: rooted(aggregateFixtureRel, walk(path.join(root, aggregateFixtureRel))), inputFixture: rooted(inputFixtureRel, walk(path.join(root, inputFixtureRel))),
  correctedObserver: record(path.join(root, toolRel, 'runtime-controls-observer.py')), policy: record(path.join(root, toolRel, 'topology_identity_policy.py')),
  eventOrderingRule: record(path.join(root, correctionToolRel, 'observer_event_ordering.py')), correctedRuntimeControls: record(path.join(root, toolRel, 'runtime-controls.mjs')),
  preservedFailedHCorrectedGeneration: {tools: {path: consumedToolRel, members: consumedTools.length, memberRecordSetSha256: treeHash(consumedTools)}, evidence: {path: consumedRel, members: consumedNow.length, memberRecordSetSha256: treeHash(consumedNow)}, receipt: record(path.join(root, consumedRel, 'certification-receipt.json')), closure: record(path.join(root, consumedRel, 'closure.json')), seal: record(path.join(root, consumedRel, 'campaign-seal.json')), report: record(path.join(root, consumedReportRel))},
  productionSource: {path: sourceRel, members: sourceMembers.length, memberRecordSetSha256: treeHash(sourceMembers), helper: helperSource, limits},
  sessionIncident: 'During this preparation session prepare.mjs, recover-inventory.mjs, record-harness-review.mjs and campaign.mjs were accidentally truncated by a local editing command before any validation; each was reconstructed from the consumed tooling plus the namespace-only rename and verified byte-exact against the Section 1 preservation baseline before the H2 edits were reapplied. No evidence, fixture, production, or sealed file was affected.',
};
const structuralValidation = {
  kind: 'MO1307Phase3AR2FinalH2HarnessStructuralValidation', version: '1.0.0', createdAt, result: 'PASS',
  unchangedTools: unchanged, namespaceOnlyTools: namespaceOnly,
  runtimeControls: {exactSubstitutions: runtimeSubstitutions.length, equalsConsumedPlusSpecifiedChanges: true, changedCaseOptions: changedOptions, caseOptionsBefore, caseOptionsAfter},
  observer: {exactSubstitutions: observerSubstitutions.length, equalsConsumedPlusSpecifiedChanges: true, policyByteIdentical: true},
  bookkeepingDiffs,
  structuralTokens, campaignLimits, inventoryCaseIds,
  changedExpectations: [], changedRequiredMethods: [{case: 'aggregate-helper-exhaustion', from: {perHelperEofDelayMs: 4000, slots: 9, slot6: 'create output root before request', slot8: 'create pending before request'}, to: {perHelperEofDelayMs: 5700, maxSlots: 5, publicationStateMutations: 0}, authority: 'User transfer authorization sections 15-16 (bound as authorization.txt): the isolated absent-output fixture must remain immutable and must not be mutated into a later publication state; expected MO1307_TIMEOUT preserved.'}],
  boundaries: {timelyHelper: 'intact', strict8000: 'PASS', strict8999: 'PASS', strict9000: 'MO1307_TIMEOUT', aggregateExpected: 'MO1307_TIMEOUT'},
  resourceAuthority: {helperMs: 9000, aggregateMs: 28000, cliMs: 30000, apiWorkerMs: 10000, cleanupMs: 2000, productDefinitions: limits, unchanged: true},
  productIdentityRules: identityRules, productionBytesUnchanged: true, historicalCharacterizationH: 'NOT_ESTABLISHED',
};
const zeroExecutionProof = {
  kind: 'MO1307Phase3AR2FinalH2HarnessCorrectionZeroExecutionProof', version: '1.0.0', createdAt, result: 'PASS',
  scope: 'Static filesystem/byte-hash/JSON/source-structure validation, read-only git queries, and two pure engineering interpreter validators (observer data replay; temporary-sandbox fixture identity demonstration).',
  executionCounters, gitInvocations: counters.gitInvocations, engineeringInterpreterInvocations: counters.engineeringInterpreterInvocations,
  productLoaded: false, productModulesImported: false, helperLoaded: false, helperSpawned: false, workerSpawned: false, cliSpawned: false, apiStarted: false, nativeObserverSpawned: false,
  repositoryWritesOutsideThisNamespace: 0, sandboxWritesOutsideRepository: true, sandboxRemoved: fixture.sandboxRemoved, networkAccess: false, packageMutation: false, historicalEvidenceMutation: false, retry: false, noRetry: true,
};
if (checkOnly) {
  const preflight = process.env.MO1307_H2_PREFLIGHT_DIR;
  if (preflight) {
    assert.ok(path.isAbsolute(preflight) && !norm(preflight).startsWith(norm('.') + '/') && fs.readdirSync(preflight).length === 0, 'Preflight directory must be an empty directory outside the repository');
    const emit = (name, bytes) => fs.writeFileSync(path.join(preflight, name), bytes, {flag: 'wx'});
    emit('source-bindings.json', Buffer.from(JSON.stringify(sourceBindings, null, 2) + '\n'));
    emit('authorization.txt', fs.readFileSync(authorizationPath));
    emit('receipt.json', Buffer.from(JSON.stringify({kind: 'MO1307Phase3AR2FinalH2HarnessCorrectionReceipt', result: 'PASS', zeroProductValidation: 'PASS', classifications, aggregateControl, retry: false, fullCertificationStarted: false, execution: {certificationRuns: 0, helperRuns: 0, nativeObserverRuns: 0, productRuns: 0, workerRuns: 0, engineeringInterpreterInvocations: counters.engineeringInterpreterInvocations}, preflightOnly: true}, null, 2) + '\n'));
  }
  process.stdout.write(JSON.stringify({result: 'CHECK_PASS', independentReview: reviewPending ? 'PENDING' : 'BOUND', reviewedFiles: reviewedFilesNow.length, gate: Object.fromEntries(Object.entries(gate).map(([id, row]) => [id, row.actual])), counters, writes: 0}) + '\n');
  process.exit(0);
}
fs.mkdirSync(evidence);
const put = (name, bytes) => { const file = path.join(evidence, name); fs.writeFileSync(file, bytes, {flag: 'wx'}); return record(file); };
const write = (name, value) => put(name, Buffer.from(JSON.stringify(value, null, 2) + '\n'));
const bindings = {
  authorization: put('authorization.txt', fs.readFileSync(authorizationPath)),
  failureAnalysis: write('failure-analysis.json', failureAnalysis),
  fixtureIsolation: write('fixture-isolation.json', fixtureIsolation),
  independentReview: put('independent-review.json', reviewBytes),
  observerValidation: put('observer-validation.json', observerBytes),
  sourceBindings: write('source-bindings.json', sourceBindings),
  structuralValidation: write('structural-validation.json', structuralValidation),
  zeroExecutionProof: write('zero-execution-proof.json', zeroExecutionProof),
};
const receipt = {
  kind: 'MO1307Phase3AR2FinalH2HarnessCorrectionReceipt', version: '1.0.0', createdAt, result: 'PASS', outcome: 'H2_HARNESS_CORRECTION_VALIDATED',
  candidate: {name: 'C3VB', commit: C3VB, productionCommit: C3V, productionTree}, classifications, aggregateControl,
  fixtures: {aggregate: sourceBindings.aggregateFixture, input: sourceBindings.inputFixture, aggregateTarget: aggregateFixtureRel + '/absent-output', targetAbsent: true},
  observerCorrection: {rule: 'MO1307_OBSERVER_EVENT_ORDERING@1.0.0', policy: 'MO1307_TOPOLOGY_IDENTITY_POLICY@1.0.0', policyChanged: false, cases: Object.fromEntries(Object.entries(observer.cases).map(([id, row]) => [id, {expected: row.expected, actual: row.actual, classification: row.classification}]))},
  gate, zeroProductValidation: 'PASS', structuralValidation: 'PASS', changedExpectations: [],
  productionChanged: false, helperChanged: false, authoritiesChanged: false, limitsChanged: false, policyChanged: false, preservedFailedGenerationChanged: false,
  executionCounters, execution: {certificationRuns: 0, helperRuns: 0, nativeObserverRuns: 0, productRuns: 0, workerRuns: 0, engineeringInterpreterInvocations: counters.engineeringInterpreterInvocations},
  newGenerationNamespace: generationRel, retry: false, noRetry: true, fullCertificationStarted: false,
  expectedEvidenceMembers: outputNames, bindings, push: false, tag: false, phase3DStarted: false,
};
write('receipt.json', receipt);
assert.deepEqual(walk(evidence).map(row => row.path), [...outputNames].sort());
process.stdout.write(JSON.stringify({result: receipt.result, outcome: receipt.outcome, gate: Object.fromEntries(Object.entries(gate).map(([id, row]) => [id, row.actual])), receipt: record(path.join(evidence, 'receipt.json'))}) + '\n');
