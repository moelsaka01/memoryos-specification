// Zero-product, append-only derivation and rebinding of the H4 harness to the fresh H5 generation namespace.
//   --derive : materialize the H5 campaign tools from the sealed H4 tools (rename + the recorded edits). Writes only the H5 tool directory.
//   --check  : validate only; writes nothing.
//   (none)   : validate and write the H5 rebinding evidence namespace.
// Proves the H5 tools equal the sealed H4 tools after the namespace rename plus exactly the recorded edits and the one added
// harness-only instrumentation file; preserves the failed H4 generation. Starts no product, helper, worker, CLI, API, observer,
// interpreter or certification case.
import fs from 'node:fs';
import path from 'node:path';
import { createHash } from 'node:crypto';
import assert from 'node:assert/strict';
import { spawnSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';

const root = fileURLToPath(new URL('../../../../', import.meta.url));
const mode = process.argv[2] ?? 'write';
assert.ok(['write', '--check', '--derive'].includes(mode) && process.argv.length <= 3);
const evidenceRel = 'repositories/cca-conformance/evidence/mo1307/phase3ar2-final-h5-rebinding';
const evidence = path.join(root, evidenceRel);
const h4ToolRel = 'repositories/cca-conformance/tools/mo1307-phase3ar2-final-h4-corrected';
const h5ToolRel = 'repositories/cca-conformance/tools/mo1307-phase3ar2-final-h5-corrected';
const h4RebindingRel = 'repositories/cca-conformance/evidence/mo1307/phase3ar2-final-h4-rebinding';
const h4RebindingToolRel = 'repositories/cca-conformance/tools/mo1307-phase3ar2-final-h4-rebinding';
const rebindingToolRel = 'repositories/cca-conformance/tools/mo1307-phase3ar2-final-h5-rebinding';
const h4Rel = 'repositories/cca-conformance/evidence/mo1307/phase3ar2-final-h4-corrected';
const h4ReportRel = 'docs/mo1307-phase3ar2-final-h4-corrected.md';
const h5Rel = 'repositories/cca-conformance/evidence/mo1307/phase3ar2-final-h5-corrected';
const h5CacheRel = '.cache/phase3ar2-final-h5-corrected';
const h5ReportRel = 'docs/mo1307-phase3ar2-final-h5-corrected.md';
const sourceRel = 'repositories/memoryos-readiness';
const authorizationPath = 'C:/Users/melsa/Documents/Codex/mo1307-autonomous-authorization.txt';
const C3VB = '17fa84efe46d30e6f4be85fd2427485677a222a3', C3V = '98b766f9218b209f52251147213839b9775f6da3', productionTree = 'b9dabf54572e06c96bb5e48c4e20671f2cc24053';
const outputNames = ['authorization.txt', 'preserved-h4-generation.json', 'source-bindings.json', 'structural-validation.json', 'zero-execution-proof.json', 'receipt.json'];
const editedTools = ['campaign.mjs', 'prepare.mjs', 'record-harness-review.mjs', 'security.mjs', 'instrumentation.ps1'];
const addedTools = [];

const hash = bytes => 'sha256:' + createHash('sha256').update(bytes).digest('hex');
const record = file => { const bytes = fs.readFileSync(file); return { path: path.relative(root, file).replaceAll('\\', '/'), byteLength: bytes.length, sha256: hash(bytes) }; };
const walk = (base, prefix = '') => fs.readdirSync(path.join(base, prefix), { withFileTypes: true }).sort((a, b) => a.name < b.name ? -1 : 1).flatMap(entry => {
  const p = prefix ? prefix + '/' + entry.name : entry.name, full = path.join(base, p), stat = fs.lstatSync(full);
  assert.equal(stat.isSymbolicLink(), false, full);
  return stat.isDirectory() ? walk(base, p) : [{ ...record(full), path: p }];
});
const rooted = rel => walk(path.join(root, rel)).map(row => ({ ...row, path: rel + '/' + row.path }));
const treeHash = rows => hash(Buffer.from(rows.map(row => `${row.path}\0${row.byteLength}\0${row.sha256}\n`).join('')));
const json = rel => JSON.parse(fs.readFileSync(path.join(root, rel), 'utf8'));
let gitInvocations = 0;
const git = (...args) => { gitInvocations++; const r = spawnSync('C:/Program Files/Git/cmd/git.exe', ['-c', 'safe.directory=C:/Users/melsa/Documents/Codex/3ar2', ...args], { cwd: root, encoding: 'utf8', windowsHide: true, maxBuffer: 64 << 20 }); assert.ifError(r.error); assert.equal(r.status, 0, r.stderr); return r.stdout; };
const rename = text => text.replaceAll('phase3ar2-final-h4-corrected', 'phase3ar2-final-h5-corrected').replaceAll('_H4_CORRECTED', '_H5_CORRECTED');
const lineDiff = (before, after) => {
  const a = before.split('\n'), b = after.split('\n'), m = a.length, n = b.length, t = Array.from({ length: m + 1 }, () => new Uint32Array(n + 1));
  for (let i = m - 1; i >= 0; i--) for (let j = n - 1; j >= 0; j--) t[i][j] = a[i] === b[j] ? t[i + 1][j + 1] + 1 : Math.max(t[i + 1][j], t[i][j + 1]);
  const removed = [], added = []; let i = 0, j = 0;
  while (i < m && j < n) { if (a[i] === b[j]) { i++; j++; } else if (t[i + 1][j] >= t[i][j + 1]) removed.push({ line: i + 1, text: a[i++] }); else added.push({ line: j + 1, text: b[j++] }); }
  while (i < m) removed.push({ line: i + 1, text: a[i++] }); while (j < n) added.push({ line: j + 1, text: b[j++] });
  return { removed, added };
};

// ---- Preserved failed H4 generation (read-only facts used by the edits) ----
const h4Receipt = record(path.join(root, h4Rel, 'certification-receipt.json'));
assert.equal(h4Receipt.sha256.length, 71);
const h4Evidence = rooted(h4Rel);
const h4Tools = rooted(h4ToolRel);
const h4Report = record(path.join(root, h4ReportRel));
const h4Certification = json(h4Rel + '/certification-receipt.json');

// ---- Edits (applied to the renamed H4 text; every anchor must occur exactly the stated number of times) ----
const rbPrev = 'phase3ar2-final-h4-rebinding';
const edits = {
  'campaign.mjs': [
    ["'docs/mo1307-phase3ar2-final-h3-corrected.md','repositories/cca-conformance/evidence/mo1307/final-headless/authorization.txt'", "'docs/mo1307-phase3ar2-final-h3-corrected.md','docs/mo1307-phase3ar2-final-h4-corrected.md','repositories/cca-conformance/evidence/mo1307/final-headless/authorization.txt'", 1],
    [`  h4RebindingEvidence:'repositories/cca-conformance/evidence/mo1307/${rbPrev}'\n`,
      `  h4RebindingEvidence:'repositories/cca-conformance/evidence/mo1307/${rbPrev}',\n  preservedFailedH4Tools:'${h4ToolRel}',\n  preservedFailedH4Evidence:'${h4Rel}',\n  h5RebindingTools:'${rebindingToolRel}',\n  h5RebindingEvidence:'${evidenceRel}'\n`, 1],
    ['h4RebindingTools:3,h4RebindingEvidence:6}', `h4RebindingTools:3,h4RebindingEvidence:6,preservedFailedH4Tools:${h4Tools.length},preservedFailedH4Evidence:${h4Evidence.length},h5RebindingTools:3,h5RebindingEvidence:6}`, 1],
    ["assert.equal(seal.hostInstrumentation,'MO1307_HOST_INSTRUMENTATION@1.0.0');",
      `assert.equal(seal.hostInstrumentation,'MO1307_HOST_INSTRUMENTATION@1.0.0');assert.deepEqual(seal.h5Rebinding,record(path.join(root,prerequisiteNamespaces.h5RebindingEvidence,'receipt.json')));assert.deepEqual(seal.preservedFailedH4Generation,{path:prerequisiteNamespaces.preservedFailedH4Evidence+'/certification-receipt.json',byteLength:${h4Receipt.byteLength},sha256:'${h4Receipt.sha256}'});`, 1],
    ["||line==='?? docs/mo1307-phase3ar2-final-h3-corrected.md'||", "||line==='?? docs/mo1307-phase3ar2-final-h3-corrected.md'||line==='?? docs/mo1307-phase3ar2-final-h4-corrected.md'||", 1],
    ["hostInstrumentation:'MO1307_HOST_INSTRUMENTATION@1.0.0',preservedPhase3BR2:",
      "hostInstrumentation:'MO1307_HOST_INSTRUMENTATION@1.0.0',h5Rebinding:record(path.join(root,prerequisiteNamespaces.h5RebindingEvidence,'receipt.json')),preservedFailedH4Generation:record(path.join(root,prerequisiteNamespaces.preservedFailedH4Evidence,'certification-receipt.json')),preservedPhase3BR2:", 1],
    ['queueLengthMax:Math.max(...rows.map(r=>r.queueLength)),topProcessCpuMs:',
      "queueLengthMax:Math.max(...rows.map(r=>r.queueLength)),diskQueueMax:Math.max(...rows.map(r=>r.diskQueue??0)),diskTimePctMax:Math.max(...rows.map(r=>r.diskTimePct??0)),watchProcessCpuMs:Object.entries(rows.reduce((a,r)=>{for(const w of r.watchCpu??[])a[w.n]=(a[w.n]??0)+w.cpuMs;return a;},{})).sort((a,b)=>b[1]-a[1]).slice(0,8).map(([name,cpuMs])=>({name,cpuMs:+cpuMs.toFixed(0)})),topProcessCpuMs:", 1],
  ],
  'prepare.mjs': [
    [`const h4RebindingToolRel='${rebindingToolRel.replace('h5', 'h4')}';`,
      `const h4RebindingToolRel='${h4RebindingToolRel}';\nconst failedH4Rel='${h4Rel}';\nconst failedH4ToolRel='${h4ToolRel}';\nconst failedH4ReportRel='${h4ReportRel}';\nconst h5RebindingRel='${evidenceRel}';\nconst h5RebindingToolRel='${rebindingToolRel}';`, 1],
    ['failedH3ToolRel,failedH3Rel,h4RebindingToolRel,h4RebindingRel];', 'failedH3ToolRel,failedH3Rel,h4RebindingToolRel,h4RebindingRel,failedH4ToolRel,failedH4Rel,h5RebindingToolRel,h5RebindingRel];', 1],
    ["||line==='?? '+failedH3ReportRel||", "||line==='?? '+failedH3ReportRel||line==='?? '+failedH4ReportRel||", 1],
    ["assert.deepEqual(walk(path.join(root,toolRel)).map(row=>({...row,path:toolRel+'/'+row.path})),h4Sources.h4CampaignTools,'H4 campaign tools changed after zero-product rebinding');",
      "assert.deepEqual(walk(path.join(root,failedH4ToolRel)).map(row=>({...row,path:failedH4ToolRel+'/'+row.path})),h4Sources.h4CampaignTools,'Preserved failed H4 tools changed');const h5Rebinding=JSON.parse(fs.readFileSync(path.join(root,h5RebindingRel,'receipt.json'),'utf8')),h5Sources=JSON.parse(fs.readFileSync(path.join(root,h5RebindingRel,'source-bindings.json'),'utf8'));assert.equal(h5Rebinding.kind,'MO1307Phase3AR2FinalH5GenerationRebindingReceipt');assert.equal(h5Rebinding.result,'PASS');assert.deepEqual(h5Rebinding.bindings.sourceBindings,record(path.join(root,h5RebindingRel,'source-bindings.json')));assert.deepEqual(walk(path.join(root,toolRel)).map(row=>({...row,path:toolRel+'/'+row.path})),h5Sources.h5CampaignTools,'H5 campaign tools changed after zero-product rebinding');assert.deepEqual(walk(path.join(root,h5RebindingToolRel)).map(row=>({...row,path:h5RebindingToolRel+'/'+row.path})),h5Sources.h5RebindingTools);assert.deepEqual(walk(path.join(root,failedH4Rel)).map(row=>({...row,path:failedH4Rel+'/'+row.path})),h5Sources.preservedFailedH4Generation.evidence,'Preserved failed H4 evidence changed');assert.deepEqual(record(path.join(root,failedH4ReportRel)),h5Sources.preservedFailedH4Generation.report);",
      1],
    ["const authorizationBytes=fs.readFileSync(path.join(root,h4RebindingRel,'authorization.txt'));assert.deepEqual(h4Rebinding.bindings.authorization,record(path.join(root,h4RebindingRel,'authorization.txt')));",
      "assert.deepEqual(h4Rebinding.bindings.authorization,record(path.join(root,h4RebindingRel,'authorization.txt')));const authorizationBytes=fs.readFileSync(path.join(root,h5RebindingRel,'authorization.txt'));assert.deepEqual(h5Rebinding.bindings.authorization,record(path.join(root,h5RebindingRel,'authorization.txt')));", 1],
    ["preservedFailedH3Generation:record(path.join(root,failedH3Rel,'certification-receipt.json')),",
      "preservedFailedH3Generation:record(path.join(root,failedH3Rel,'certification-receipt.json')),h5Rebinding:record(path.join(root,h5RebindingRel,'receipt.json')),preservedFailedH4Generation:record(path.join(root,failedH4Rel,'certification-receipt.json')),", 2],
  ],
  'record-harness-review.mjs': [
    [`const failedH3ReceiptPath=path.join(root,'repositories/cca-conformance/evidence/mo1307/phase3ar2-final-h3-corrected/certification-receipt.json');`,
      `const failedH3ReceiptPath=path.join(root,'repositories/cca-conformance/evidence/mo1307/phase3ar2-final-h3-corrected/certification-receipt.json');const h5RebindingReceiptPath=path.join(root,'${evidenceRel}/receipt.json'),h5Rebinding=json(h5RebindingReceiptPath);assert.equal(h5Rebinding.kind,'MO1307Phase3AR2FinalH5GenerationRebindingReceipt');assert.equal(h5Rebinding.result,'PASS');const failedH4ReceiptPath=path.join(root,'${h4Rel}/certification-receipt.json');`, 1],
    ['preservedFailedH3Generation:record(failedH3ReceiptPath),', 'preservedFailedH3Generation:record(failedH3ReceiptPath),h5Rebinding:record(h5RebindingReceiptPath),preservedFailedH4Generation:record(failedH4ReceiptPath),', 1],
  ],
  'security.mjs': [
    ["const output=path.join(scratch,name),sequence=protocol.createHelperSequence('evaluate');",
      "const parent=path.join(scratch,name+'-parent'),output=path.join(parent,name),sequence=protocol.createHelperSequence('evaluate');fs.mkdirSync(parent);", 1],
  ],
};

function apply(name, text) {
  if (name === 'instrumentation.ps1') return fs.readFileSync(path.join(root, rebindingToolRel, 'instrumentation.ps1'), 'utf8');
  let out = rename(text);
  for (const [find, replace, count] of edits[name] ?? []) {
    assert.equal(out.split(find).length - 1, count, `${name}: anchor count for ${JSON.stringify(find.slice(0, 80))}`);
    out = out.replaceAll(find, () => replace);
  }
  return out;
}

// 1. Environment, candidate, zero product drift.
assert.equal(path.resolve(root).toLowerCase(), 'c:\\users\\melsa\\documents\\codex\\3ar2');
assert.equal(process.version, 'v24.21.0'); assert.equal(process.platform, 'win32'); assert.equal(process.arch, 'x64');
assert.equal(hash(fs.readFileSync(process.execPath)), 'sha256:ba4e6d110e8c1592a1ecd390f6b05f3da124b13871a5be62b341a07a853c6c32');
assert.equal(git('rev-parse', 'HEAD').trim(), C3VB); assert.equal(git('branch', '--show-current').trim(), 'codex/mo1307-phase3ar2-c3ub');
assert.equal(git('rev-parse', C3VB + ':' + sourceRel).trim(), productionTree); assert.equal(git('rev-parse', C3V + ':' + sourceRel).trim(), productionTree);
assert.equal(git('diff', '--name-only'), ''); assert.equal(git('diff', '--cached', '--name-only'), ''); assert.equal(git('diff', '--name-only', '--', sourceRel), '');
for (const absent of [h5CacheRel, h5ReportRel, h5Rel]) assert.equal(fs.existsSync(path.join(root, absent)), false, absent + ' must not exist');
if (mode === 'write') assert.equal(fs.existsSync(evidence), false, 'rebinding evidence namespace must not exist');
assert.equal(hash(fs.readFileSync(authorizationPath)), 'sha256:93b8b5ef732e515b9c4bf7d6d7afc33e1d4f3ebd3fc5db27869d624ccb5c486f');

// 2. Preserved failed H4 generation: exactly the recorded one-shot failure at step L (A-K PASS).
const h4Sources = json(h4RebindingRel + '/source-bindings.json');
assert.deepEqual(h4Tools, h4Sources.h4CampaignTools, 'H4 tools changed since rebinding');
assert.equal(h4Certification.result, 'PHASE3AR2_CONCRETE_BLOCKER');
assert.deepEqual(h4Certification.steps.map(row => row.result), [...Array(11).fill('PASS'), 'FAIL', 'NOT_RUN', 'NOT_RUN', 'NOT_RUN']);
assert.ok(h4Certification.completedMandatoryCases > 0);
const stepL = json(h4Rel + '/steps/L.json');
assert.equal(stepL.result, 'FAIL');
const securityL = json(h4Rel + '/security-L/receipt.json');
const failedCase = securityL.rows.find(row => row.result === 'FAIL');
assert.equal(failedCase.name, 'actual-publication-existing-final-preserved');
assert.ok(failedCase.error.includes('MO1307_OUTPUT'));
assert.equal(securityL.rows.filter(row => row.result === 'PASS').length, 20);
const diagnosis = json(h4Rel + '/instrumentation/diagnosis.json');
const helperLifecycles = diagnosis.helperPhases.flatMap(o => (o.requests ?? []).map(q => q.wholeLifecycleMs)).filter(v => typeof v === 'number').sort((a, b) => a - b);
const percentile = p => helperLifecycles[Math.min(helperLifecycles.length - 1, Math.floor(helperLifecycles.length * p))];
const preservedH4 = {
  kind: 'MO1307Phase3AR2FailedH4GenerationPreservation', version: '1.0.0', result: 'PRESERVED_FAILED_ONE_SHOT',
  namespace: h4Rel, evidence: h4Evidence, evidenceRecordSetSha256: treeHash(h4Evidence), receipt: h4Receipt, report: h4Report,
  tools: { path: h4ToolRel, members: h4Tools.length, memberRecordSetSha256: treeHash(h4Tools), unchangedSinceH4Rebinding: true },
  reached: 'Steps A-K PASS at the unchanged 9000-ms helper limit (including H boundary/aggregate controls); step L failed on case 21 of its security corpus; M, N, O NOT_RUN.',
  failureAnalysis: {
    failedCase: failedCase.name, productError: 'MO1307_OUTPUT from createPublication after INSPECT_OUTPUT_ROOT (publication.mjs sameChain over the stable parent prefix)',
    classification: 'H_PUBLICATION_FIXTURE_PARENT_ISOLATION_DEFECT (harness; not product, not environment, not authority, not a helper-limit timeout)',
    evidence: 'Invocations 026 and 031-034 (cases 1-2) report the shared scratch parent (fileId ...0acf29) byteLength 0 at CHECK_OUTPUT and after mkdir. Invocations 038-040 (case 3) report 0 at CHECK_OUTPUT slots 4 and 5 and 4096 at INSPECT_OUTPUT_ROOT after mkdir of the third sibling output directory. The product correctly refused the changed stable identity. Every publication case created its output directly under the one shared scratch directory (security.mjs publicationCase), so the third sibling pushed the NTFS directory index from resident (reported 0) to non-resident (reported 4096).',
    correction: 'Each publication case now creates its own dedicated, empty, quiescent parent directory (scratch/<case>-parent) containing exactly one child, the output directory. No predicate, expectation, limit or product byte changes.',
  },
  helperLatencyObservations: { helpers: helperLifecycles.length, minMs: helperLifecycles[0], medianMs: percentile(0.5), p90Ms: percentile(0.9), maxMs: helperLifecycles.at(-1), over3000Ms: helperLifecycles.filter(v => v > 3000).length, over4000Ms: helperLifecycles.filter(v => v > 4000).length,
    note: 'Heavy-tailed: one helper reached 8912 ms (spawn to first stdout 8871 ms; 35 ms afterwards) while host CPU was 31-56%, queue 0, CPU performance 114-126%; two consecutive helpers stalled in the same window, followed by Wi-Fi driver roam events. Not CPU saturation; 9000 ms is marginal on this host.' },
  productProcessesRunHere: 0, resumed: false, rewritten: false, deleted: false,
};

// 3. H5 tools: the sealed H4 tools after the namespace rename, the recorded edits, and the added instrumentation file.
if (mode === '--derive') {
  assert.equal(fs.existsSync(path.join(root, h5ToolRel)), false, 'H5 tool directory must not exist');
  fs.mkdirSync(path.join(root, h5ToolRel));
  for (const name of fs.readdirSync(path.join(root, h4ToolRel)).sort()) {
    const text = fs.readFileSync(path.join(root, h4ToolRel, name));
    fs.writeFileSync(path.join(root, h5ToolRel, name), editedTools.includes(name) ? Buffer.from(apply(name, text.toString('utf8'))) : Buffer.from(rename(text.toString('utf8'))), { flag: 'wx' });
  }
  process.stdout.write(JSON.stringify({ result: 'DERIVED', tools: fs.readdirSync(path.join(root, h5ToolRel)).length }) + '\n');
  process.exit(0);
}
const h4Names = fs.readdirSync(path.join(root, h4ToolRel), { recursive: false }).sort();
const h5Names = fs.readdirSync(path.join(root, h5ToolRel)).sort();
assert.deepEqual(h5Names, [...h4Names, ...addedTools].sort());
assert.equal(h4Names.length, 27); assert.equal(h5Names.length, 27);
const exact = [], renamedOnly = [], edited = {};
for (const name of h4Names) {
  const h4Bytes = fs.readFileSync(path.join(root, h4ToolRel, name)), h5Bytes = fs.readFileSync(path.join(root, h5ToolRel, name));
  const expected = editedTools.includes(name) ? apply(name, h4Bytes.toString('utf8')) : rename(h4Bytes.toString('utf8'));
  assert.deepEqual(h5Bytes, Buffer.from(expected, 'utf8'), name + ' differs from the derivation');
  if (editedTools.includes(name)) edited[name] = lineDiff(rename(h4Bytes.toString('utf8')), expected);
  else (h4Bytes.equals(h5Bytes) ? exact : renamedOnly).push(name);
}
const instrumentation = fs.readFileSync(path.join(root, h5ToolRel, 'instrumentation.ps1'), 'utf8');
for (const forbidden of ['Set-MpPreference', 'Add-MpPreference', 'Set-ItemProperty', 'New-ItemProperty', 'Stop-Process', 'Stop-Service', 'Restart-Service', 'Remove-Item', 'netsh', 'reg ', 'sc.exe', 'Invoke-WebRequest', 'memoryos-readiness', 'windows-inspect']) assert.equal(instrumentation.includes(forbidden), false, 'instrumentation must not contain ' + forbidden);
const added = Object.values(edited).flatMap(diff => diff.added.map(row => row.text)).join('\n');
const removed = Object.values(edited).flatMap(diff => diff.removed.map(row => row.text)).join('\n');
for (const protectedToken of ["const fixedLimits={helperWholeLifecycleMs:9000", "aggregateHelperEngineeringEnvelope={artificialEofDelayMs:5700", 'completedMandatoryCases===80', 'Refusing run', 'Refusing close']) assert.equal(removed.includes(protectedToken), false, protectedToken);
const declared = {
  common: fs.readFileSync(path.join(root, h5ToolRel, 'common.mjs'), 'utf8').match(/export const relativeE='([^']+)'/)[1],
  cache: fs.readFileSync(path.join(root, h5ToolRel, 'common.mjs'), 'utf8').match(/export const cache=path\.join\(root,'([^']+)'\)/)[1],
  report: fs.readFileSync(path.join(root, h5ToolRel, 'campaign.mjs'), 'utf8').match(/reportPath=path\.join\(root,'(docs\/[^']+)'\)/)[1],
  wrapper: fs.readFileSync(path.join(root, h5ToolRel, 'runtime-controls-run.py'), 'utf8').match(/E=ROOT\/'([^']+)'/)[1],
  observe: fs.readFileSync(path.join(root, h5ToolRel, 'observe-command.py'), 'utf8').match(/E=ROOT\/'([^']+)'/)[1],
};
assert.deepEqual(declared, { common: h5Rel, cache: h5CacheRel, report: h5ReportRel, wrapper: h5Rel, observe: h5Rel });
const h5Tools = rooted(h5ToolRel), rebindingTools = rooted(rebindingToolRel);
assert.deepEqual(rebindingTools.map(row => row.path.slice(rebindingToolRel.length + 1)), ['.gitattributes', 'instrumentation.ps1', 'validate.mjs']);

// 4. Evidence.
const createdAt = new Date().toISOString();
const structural = {
  kind: 'MO1307Phase3AR2FinalH5RebindingStructuralValidation', version: '1.0.0', createdAt, result: 'PASS',
  rename: { pattern: 'phase3ar2-final-h4-corrected -> phase3ar2-final-h5-corrected; _H4_CORRECTED -> _H5_CORRECTED', fixtureRootsUnchanged: true },
  byteIdenticalToH4: exact, renameOnly: renamedOnly, edited: Object.fromEntries(Object.entries(edited)), addedFiles: addedTools,
  editPurpose: {
    'prepare.mjs': 'Bind the H5 rebinding receipt/tools/authorization; preserve and recheck the failed H4 generation, its tools and report; keep the H3/H4 bindings; allow the preserved H4 paths in the pre-preparation status check.',
    'record-harness-review.mjs': 'Bind the H5 rebinding receipt and the preserved failed H4 receipt in the review.',
    'campaign.mjs': 'Seal the failed H4 tools/evidence/report and the H5 rebinding as prerequisites; bind them in the seal; extend the instrumentation summary with disk and AV/indexer watch-list fields. Tool count stays 27.',
    'security.mjs': 'H_PUBLICATION_FIXTURE_PARENT_ISOLATION_DEFECT correction: publicationCase gives every case its own dedicated empty parent directory (scratch/<case>-parent) containing only the output directory, so the shared scratch directory can no longer change NTFS-reported size between the stable-identity inspections. No expectation, predicate or limit changes.',
    'instrumentation.ps1': 'Harness-only sampler extended with PhysicalDisk queue/time counters and a per-process CPU watch-list (Defender/McAfee/indexer/update/WMI/svchost). Still passive and read-only.',
  },
  correctedDefect: { classification: 'H_PUBLICATION_FIXTURE_PARENT_ISOLATION_DEFECT', failedCase: 'actual-publication-existing-final-preserved', step: 'L' },
  declaredWriteNamespaces: declared, harnessLogicChanged: false, harnessFixtureLayoutChanged: true, instrumentationExtended: true, expectationsChanged: [], limitsChanged: false, productionChanged: false,
};
const sourceBindings = {
  kind: 'MO1307Phase3AR2FinalH5RebindingSourceBindings', version: '1.0.0', createdAt, result: 'PASS',
  candidate: { name: 'C3VB', commit: C3VB, productionCommit: C3V, productionTree },
  authorizationSource: { path: authorizationPath, ...(({ byteLength, sha256 }) => ({ byteLength, sha256 }))(record(authorizationPath)) },
  h4CampaignTools: h4Tools, h5CampaignTools: h5Tools, h5RebindingTools: rebindingTools,
  preservedFailedH4Generation: { evidence: h4Evidence, report: h4Report, receipt: h4Receipt },
};
const zero = {
  kind: 'MO1307Phase3AR2FinalH5RebindingZeroExecutionProof', version: '1.0.0', createdAt, result: 'PASS',
  scope: 'Static byte/hash/structure comparison and read-only git queries only.', gitInvocations,
  executionCounters: { productInvocations: 0, helperInvocations: 0, workerInvocations: 0, cliInvocations: 0, apiInvocations: 0, nativeObserverInvocations: 0, engineeringInterpreterInvocations: 0, packageBuilds: 0, packageInstalls: 0, certificationCases: 0, retries: 0 },
  repositoryWritesOutsideThisNamespace: 0, historicalEvidenceMutation: false,
};
if (mode === '--check') {
  process.stdout.write(JSON.stringify({ result: 'CHECK_PASS', exact: exact.length, renameOnly: renamedOnly.length, edited: Object.keys(edited), h5Tools: h5Tools.length, writes: 0 }) + '\n');
  process.exit(0);
}
fs.mkdirSync(evidence);
const put = (name, bytes) => { const file = path.join(evidence, name); fs.writeFileSync(file, bytes, { flag: 'wx' }); return record(file); };
const write = (name, value) => put(name, Buffer.from(JSON.stringify(value, null, 2) + '\n'));
const bindings = {
  authorization: put('authorization.txt', fs.readFileSync(authorizationPath)),
  preservedH4Generation: write('preserved-h4-generation.json', preservedH4),
  sourceBindings: write('source-bindings.json', sourceBindings),
  structuralValidation: write('structural-validation.json', structural),
  zeroExecutionProof: write('zero-execution-proof.json', zero),
};
write('receipt.json', {
  kind: 'MO1307Phase3AR2FinalH5GenerationRebindingReceipt', version: '1.0.0', createdAt, result: 'PASS', outcome: 'H5_GENERATION_REBOUND_ZERO_PRODUCT',
  candidate: sourceBindings.candidate, newGenerationNamespace: h5Rel, newCacheNamespace: h5CacheRel, newReport: h5ReportRel,
  preservedFailedH4Generation: h4Receipt, harnessLogicChanged: false, harnessFixtureLayoutChanged: true, instrumentationExtended: true, expectationsChanged: [], limitsChanged: false, productionChanged: false,
  helperLimitMs: 9000, execution: zero.executionCounters, expectedEvidenceMembers: outputNames, bindings, retry: false, push: false, tag: false, phase3DStarted: false,
});
assert.deepEqual(walk(evidence).map(row => row.path), [...outputNames].sort());
process.stdout.write(JSON.stringify({ result: 'PASS', receipt: record(path.join(evidence, 'receipt.json')) }) + '\n');
