// Zero-product, append-only derivation and rebinding of the H3 harness to the fresh H4 generation namespace.
//   --derive : materialize the H4 campaign tools from the sealed H3 tools (rename + the recorded edits). Writes only the H4 tool directory.
//   --check  : validate only; writes nothing.
//   (none)   : validate and write the H4 rebinding evidence namespace.
// Proves the H4 tools equal the sealed H3 tools after the namespace rename plus exactly the recorded edits and the one added
// harness-only instrumentation file; preserves the failed H3 generation. Starts no product, helper, worker, CLI, API, observer,
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
const evidenceRel = 'repositories/cca-conformance/evidence/mo1307/phase3ar2-final-h4-rebinding';
const evidence = path.join(root, evidenceRel);
const h3ToolRel = 'repositories/cca-conformance/tools/mo1307-phase3ar2-final-h3-corrected';
const h4ToolRel = 'repositories/cca-conformance/tools/mo1307-phase3ar2-final-h4-corrected';
const h3RebindingRel = 'repositories/cca-conformance/evidence/mo1307/phase3ar2-final-h3-rebinding';
const h3RebindingToolRel = 'repositories/cca-conformance/tools/mo1307-phase3ar2-final-h3-rebinding';
const rebindingToolRel = 'repositories/cca-conformance/tools/mo1307-phase3ar2-final-h4-rebinding';
const h3Rel = 'repositories/cca-conformance/evidence/mo1307/phase3ar2-final-h3-corrected';
const h3ReportRel = 'docs/mo1307-phase3ar2-final-h3-corrected.md';
const h4Rel = 'repositories/cca-conformance/evidence/mo1307/phase3ar2-final-h4-corrected';
const h4CacheRel = '.cache/phase3ar2-final-h4-corrected';
const h4ReportRel = 'docs/mo1307-phase3ar2-final-h4-corrected.md';
const sourceRel = 'repositories/memoryos-readiness';
const authorizationPath = 'C:/Users/melsa/Documents/Codex/mo1307-autonomous-authorization.txt';
const C3VB = '17fa84efe46d30e6f4be85fd2427485677a222a3', C3V = '98b766f9218b209f52251147213839b9775f6da3', productionTree = 'b9dabf54572e06c96bb5e48c4e20671f2cc24053';
const outputNames = ['authorization.txt', 'preserved-h3-generation.json', 'source-bindings.json', 'structural-validation.json', 'zero-execution-proof.json', 'receipt.json'];
const editedTools = ['campaign.mjs', 'prepare.mjs', 'record-harness-review.mjs'];
const addedTools = ['instrumentation.ps1'];

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
const rename = text => text.replaceAll('phase3ar2-final-h3-corrected', 'phase3ar2-final-h4-corrected').replaceAll('_H3_CORRECTED', '_H4_CORRECTED');
const lineDiff = (before, after) => {
  const a = before.split('\n'), b = after.split('\n'), m = a.length, n = b.length, t = Array.from({ length: m + 1 }, () => new Uint32Array(n + 1));
  for (let i = m - 1; i >= 0; i--) for (let j = n - 1; j >= 0; j--) t[i][j] = a[i] === b[j] ? t[i + 1][j + 1] + 1 : Math.max(t[i + 1][j], t[i][j + 1]);
  const removed = [], added = []; let i = 0, j = 0;
  while (i < m && j < n) { if (a[i] === b[j]) { i++; j++; } else if (t[i + 1][j] >= t[i][j + 1]) removed.push({ line: i + 1, text: a[i++] }); else added.push({ line: j + 1, text: b[j++] }); }
  while (i < m) removed.push({ line: i + 1, text: a[i++] }); while (j < n) added.push({ line: j + 1, text: b[j++] });
  return { removed, added };
};

// ---- Preserved failed H3 generation (read-only facts used by the edits) ----
const h3Receipt = record(path.join(root, h3Rel, 'certification-receipt.json'));
assert.equal(h3Receipt.sha256.length, 71);
const h3Evidence = rooted(h3Rel);
const h3Tools = rooted(h3ToolRel);
const h3Report = record(path.join(root, h3ReportRel));
const h3Certification = json(h3Rel + '/certification-receipt.json');

// ---- Edits (applied to the renamed H3 text; every anchor must occur exactly the stated number of times) ----
const instrumentationBlock = fs.readFileSync(path.join(root, rebindingToolRel, 'instrumentation-campaign-block.txt'), 'utf8');
const rb = 'phase3ar2-final-h3-rebinding', rb4 = 'phase3ar2-final-h4-rebinding';
const edits = {
  'campaign.mjs': [
    ["import {spawnSync} from 'node:child_process';", "import {spawnSync,spawn} from 'node:child_process';", 1],
    ["'docs/mo1307-phase3ar2-final-h2-corrected.md','repositories/cca-conformance/evidence/mo1307/final-headless/authorization.txt'", "'docs/mo1307-phase3ar2-final-h2-corrected.md','docs/mo1307-phase3ar2-final-h3-corrected.md','repositories/cca-conformance/evidence/mo1307/final-headless/authorization.txt'", 1],
    [`  h3RebindingEvidence:'repositories/cca-conformance/evidence/mo1307/${rb}'\n`,
      `  h3RebindingEvidence:'repositories/cca-conformance/evidence/mo1307/${rb}',\n  preservedFailedH3Tools:'${h3ToolRel}',\n  preservedFailedH3Evidence:'${h3Rel}',\n  h4RebindingTools:'${rebindingToolRel}',\n  h4RebindingEvidence:'${evidenceRel}'\n`, 1],
    ['h3RebindingTools:2,h3RebindingEvidence:6}', `h3RebindingTools:2,h3RebindingEvidence:6,preservedFailedH3Tools:${h3Tools.length},preservedFailedH3Evidence:${h3Evidence.length},h4RebindingTools:3,h4RebindingEvidence:6}`, 1],
    ["'security-worker.mjs','determinism.mjs'];", "'security-worker.mjs','determinism.mjs','instrumentation.ps1'];", 1],
    ['assert.equal(tools.length,26);', 'assert.equal(tools.length,27);', 1],
    ["assert.deepEqual(seal.preservedBlockedH2Generation,{path:prerequisiteNamespaces.preservedBlockedH2Evidence+'/certification-receipt.json',byteLength:13870,sha256:'sha256:a740a4b6e7032af7f7db0beeb3b42ceac33489bf43188906c4de917a849cd0c0'});",
      `assert.deepEqual(seal.preservedBlockedH2Generation,{path:prerequisiteNamespaces.preservedBlockedH2Evidence+'/certification-receipt.json',byteLength:13870,sha256:'sha256:a740a4b6e7032af7f7db0beeb3b42ceac33489bf43188906c4de917a849cd0c0'});assert.deepEqual(seal.h4Rebinding,record(path.join(root,prerequisiteNamespaces.h4RebindingEvidence,'receipt.json')));assert.deepEqual(seal.preservedFailedH3Generation,{path:prerequisiteNamespaces.preservedFailedH3Evidence+'/certification-receipt.json',byteLength:${h3Receipt.byteLength},sha256:'${h3Receipt.sha256}'});assert.equal(seal.hostInstrumentation,'MO1307_HOST_INSTRUMENTATION@1.0.0');`, 1],
    ["||line==='?? docs/mo1307-phase3ar2-final-h2-corrected.md'||", "||line==='?? docs/mo1307-phase3ar2-final-h2-corrected.md'||line==='?? docs/mo1307-phase3ar2-final-h3-corrected.md'||", 1],
    ["preservedBlockedH2Generation:record(path.join(root,prerequisiteNamespaces.preservedBlockedH2Evidence,'certification-receipt.json')),preservedPhase3BR2:",
      "preservedBlockedH2Generation:record(path.join(root,prerequisiteNamespaces.preservedBlockedH2Evidence,'certification-receipt.json')),h4Rebinding:record(path.join(root,prerequisiteNamespaces.h4RebindingEvidence,'receipt.json')),preservedFailedH3Generation:record(path.join(root,prerequisiteNamespaces.preservedFailedH3Evidence,'certification-receipt.json')),hostInstrumentation:'MO1307_HOST_INSTRUMENTATION@1.0.0',preservedPhase3BR2:", 1],
    ["if(mode==='seal'){\n", instrumentationBlock + "if(mode==='seal'){\n", 1],
    ["  let failure=null,currentStep=null;\n", "  const instrumentation=startInstrumentation();\n  let failure=null,currentStep=null;\n", 1],
    ["}finally{write('campaign-run-finished.json',", "}finally{finishInstrumentation(instrumentation,failure);write('campaign-run-finished.json',", 1],
    ["integrity:record(path.join(E,'integrity-after.json')),historicalEvidencePreserved", "integrity:record(path.join(E,'integrity-after.json')),instrumentation:(exists('instrumentation/diagnosis.json')?record(path.join(E,'instrumentation/diagnosis.json')):null),historicalEvidencePreserved", 1],
  ],
  'prepare.mjs': [
    [`const h3RebindingToolRel='repositories/cca-conformance/tools/mo1307-${rb}';`,
      `const h3RebindingToolRel='repositories/cca-conformance/tools/mo1307-${rb}';\nconst failedH3Rel='${h3Rel}';\nconst failedH3ToolRel='${h3ToolRel}';\nconst failedH3ReportRel='${h3ReportRel}';\nconst h4RebindingRel='${evidenceRel}';\nconst h4RebindingToolRel='${rebindingToolRel}';`, 1],
    ['blockedH2ToolRel,blockedH2Rel,h3RebindingToolRel,h3RebindingRel];', 'blockedH2ToolRel,blockedH2Rel,h3RebindingToolRel,h3RebindingRel,failedH3ToolRel,failedH3Rel,h4RebindingToolRel,h4RebindingRel];', 1],
    ["||line==='?? '+blockedH2ReportRel||", "||line==='?? '+blockedH2ReportRel||line==='?? '+failedH3ReportRel||", 1],
    ["assert.deepEqual(walk(path.join(root,toolRel)).map(row=>({...row,path:toolRel+'/'+row.path})),h3Sources.h3CampaignTools,'H3 campaign tools changed after zero-product rebinding');",
      "assert.deepEqual(walk(path.join(root,failedH3ToolRel)).map(row=>({...row,path:failedH3ToolRel+'/'+row.path})),h3Sources.h3CampaignTools,'Preserved failed H3 tools changed');const h4Rebinding=JSON.parse(fs.readFileSync(path.join(root,h4RebindingRel,'receipt.json'),'utf8')),h4Sources=JSON.parse(fs.readFileSync(path.join(root,h4RebindingRel,'source-bindings.json'),'utf8'));assert.equal(h4Rebinding.kind,'MO1307Phase3AR2FinalH4GenerationRebindingReceipt');assert.equal(h4Rebinding.result,'PASS');assert.deepEqual(h4Rebinding.bindings.sourceBindings,record(path.join(root,h4RebindingRel,'source-bindings.json')));assert.deepEqual(walk(path.join(root,toolRel)).map(row=>({...row,path:toolRel+'/'+row.path})),h4Sources.h4CampaignTools,'H4 campaign tools changed after zero-product rebinding');assert.deepEqual(walk(path.join(root,h4RebindingToolRel)).map(row=>({...row,path:h4RebindingToolRel+'/'+row.path})),h4Sources.h4RebindingTools);assert.deepEqual(walk(path.join(root,failedH3Rel)).map(row=>({...row,path:failedH3Rel+'/'+row.path})),h4Sources.preservedFailedH3Generation.evidence,'Preserved failed H3 evidence changed');assert.deepEqual(record(path.join(root,failedH3ReportRel)),h4Sources.preservedFailedH3Generation.report);",
      1],
    ["const authorizationBytes=fs.readFileSync(path.join(root,h3RebindingRel,'authorization.txt'));assert.deepEqual(h3Rebinding.bindings.authorization,record(path.join(root,h3RebindingRel,'authorization.txt')));",
      "assert.deepEqual(h3Rebinding.bindings.authorization,record(path.join(root,h3RebindingRel,'authorization.txt')));const authorizationBytes=fs.readFileSync(path.join(root,h4RebindingRel,'authorization.txt'));assert.deepEqual(h4Rebinding.bindings.authorization,record(path.join(root,h4RebindingRel,'authorization.txt')));", 1],
    ["h3Rebinding:record(path.join(root,h3RebindingRel,'receipt.json')),preservedBlockedH2Generation:record(path.join(root,blockedH2Rel,'certification-receipt.json')),",
      "h3Rebinding:record(path.join(root,h3RebindingRel,'receipt.json')),preservedBlockedH2Generation:record(path.join(root,blockedH2Rel,'certification-receipt.json')),h4Rebinding:record(path.join(root,h4RebindingRel,'receipt.json')),preservedFailedH3Generation:record(path.join(root,failedH3Rel,'certification-receipt.json')),", 2],
  ],
  'record-harness-review.mjs': [
    ["h3Rebinding=json(h3RebindingReceiptPath);", `h3Rebinding=json(h3RebindingReceiptPath);const h4RebindingReceiptPath=path.join(root,'${evidenceRel}/receipt.json'),h4Rebinding=json(h4RebindingReceiptPath);assert.equal(h4Rebinding.kind,'MO1307Phase3AR2FinalH4GenerationRebindingReceipt');assert.equal(h4Rebinding.result,'PASS');const failedH3ReceiptPath=path.join(root,'${h3Rel}/certification-receipt.json');`, 1],
    ['h3Rebinding:record(h3RebindingReceiptPath),', 'h3Rebinding:record(h3RebindingReceiptPath),h4Rebinding:record(h4RebindingReceiptPath),preservedFailedH3Generation:record(failedH3ReceiptPath),hostInstrumentation:{policy:\'MO1307_HOST_INSTRUMENTATION@1.0.0\',file:\'instrumentation.ps1\',decisive:false},', 1],
    ['assert.equal(reviewedModules.length,26);', 'assert.equal(reviewedModules.length,27);', 1],
  ],
};
function apply(name, text) {
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
for (const absent of [h4CacheRel, h4ReportRel, h4Rel]) assert.equal(fs.existsSync(path.join(root, absent)), false, absent + ' must not exist');
if (mode === 'write') assert.equal(fs.existsSync(evidence), false, 'rebinding evidence namespace must not exist');
assert.equal(hash(fs.readFileSync(authorizationPath)), 'sha256:93b8b5ef732e515b9c4bf7d6d7afc33e1d4f3ebd3fc5db27869d624ccb5c486f');

// 2. Preserved failed H3 generation: exactly the recorded one-shot failure at step A.
const h3Sources = json(h3RebindingRel + '/source-bindings.json');
assert.deepEqual(h3Tools, h3Sources.h3CampaignTools, 'H3 tools changed since rebinding');
assert.equal(h3Certification.result, 'PHASE3AR2_CONCRETE_BLOCKER');
assert.deepEqual(h3Certification.steps.map(row => row.result), ['FAIL', ...Array(14).fill('NOT_RUN')]);
assert.equal(h3Certification.completedMandatoryCases, 0);
const stepA = json(h3Rel + '/steps/A.json');
assert.equal(stepA.result, 'FAIL');
const observation = json(h3Rel + '/semantics/A-mo1306-qualified/evaluate/observation.json');
const helperRows = observation.requests.map(q => ({ ordinal: q.ordinal, operation: q.operation, disposition: q.disposition, spawnCallLatencyMs: +(q.spawnAt - q.enteredAt).toFixed(1), spawnToFirstStdoutMs: q.stdoutFirstAt == null ? null : +(q.stdoutFirstAt - q.spawnAt).toFixed(1), firstStdoutToExitMs: q.exitAt == null || q.stdoutFirstAt == null ? null : +(q.exitAt - q.stdoutFirstAt).toFixed(1), wholeLifecycleMs: +q.durationMs.toFixed(1), stdoutBytes: q.stdoutBytes, exitCode: q.exitCode }));
assert.equal(helperRows.length, 3);
assert.equal(helperRows[2].disposition, 'REJECTED'); assert.ok(helperRows[2].wholeLifecycleMs >= 9000);
assert.ok(helperRows[0].wholeLifecycleMs < 9000 && helperRows[1].wholeLifecycleMs < 9000);
const preservedH3 = {
  kind: 'MO1307Phase3AR2FailedH3GenerationPreservation', version: '1.0.0', result: 'PRESERVED_FAILED_ONE_SHOT',
  namespace: h3Rel, evidence: h3Evidence, evidenceRecordSetSha256: treeHash(h3Evidence), receipt: h3Receipt, report: h3Report,
  tools: { path: h3ToolRel, members: h3Tools.length, memberRecordSetSha256: treeHash(h3Tools), unchangedSinceH3Rebinding: true },
  reached: 'Full offline install and sealed campaign; step A (mo1306-qualified evaluate) failed with MO1307_TIMEOUT (exit 29, expected 2); steps B-O NOT_RUN; 0 of 80 mandatory cases complete.',
  failureAnalysis: {
    observedHelperLifecycles: helperRows,
    deadlineMs: 9000,
    observation: 'Helper 1 and 2 completed in 6027.6 and 4685.7 ms; helper 3 reached the 9000-ms whole-lifecycle deadline (9058.1 ms) with no stdout byte, so the product returned MO1307_TIMEOUT correctly. Almost all helper time (5886 ms and 4.5 s for helpers 1 and 2) elapsed between spawn and first stdout byte, i.e. inside PowerShell startup, script load/Reflection.Emit and request processing; post-first-byte time was about 115 ms.',
    comparison: 'The corrected pre-certification B gate on the same candidate and host ran nine helpers in 15054 ms total (about 1.7 s each). Out-of-namespace DIAGNOSTIC executions after H3 measured the same helper at 1.1-2.7 s (median about 1.4-1.7 s) while chrome and claude processes consumed more CPU than the helpers themselves.',
    classification: 'ENVIRONMENT_HOST_CPU_CONTENTION_SUSPECTED (not product, not harness, not authority); root cause evidence in H3 is limited to timing because no host sampler existed.',
    nextGenerationChange: 'H4 changes no limit, expectation or product byte. It adds harness-only instrumentation (per-helper phase timings, 1-Hz host CPU/memory/queue and per-process CPU sampling, Defender/PowerShell/System event windows, post-failure cold-launch probes) so any further failure has measured evidence.',
  },
  productProcessesRunHere: 0, resumed: false, rewritten: false, deleted: false,
};

// 3. H4 tools: the sealed H3 tools after the namespace rename, the recorded edits, and the added instrumentation file.
if (mode === '--derive') {
  assert.equal(fs.existsSync(path.join(root, h4ToolRel)), false, 'H4 tool directory must not exist');
  fs.mkdirSync(path.join(root, h4ToolRel));
  for (const name of fs.readdirSync(path.join(root, h3ToolRel)).sort()) {
    const text = fs.readFileSync(path.join(root, h3ToolRel, name));
    fs.writeFileSync(path.join(root, h4ToolRel, name), editedTools.includes(name) ? Buffer.from(apply(name, text.toString('utf8'))) : Buffer.from(rename(text.toString('utf8'))), { flag: 'wx' });
  }
  process.stdout.write(JSON.stringify({ result: 'DERIVED', tools: fs.readdirSync(path.join(root, h4ToolRel)).length }) + '\n');
  process.exit(0);
}
const h3Names = fs.readdirSync(path.join(root, h3ToolRel), { recursive: false }).sort();
const h4Names = fs.readdirSync(path.join(root, h4ToolRel)).sort();
assert.deepEqual(h4Names, [...h3Names, ...addedTools].sort());
assert.equal(h3Names.length, 26); assert.equal(h4Names.length, 27);
const exact = [], renamedOnly = [], edited = {};
for (const name of h3Names) {
  const h3Bytes = fs.readFileSync(path.join(root, h3ToolRel, name)), h4Bytes = fs.readFileSync(path.join(root, h4ToolRel, name));
  const expected = editedTools.includes(name) ? apply(name, h3Bytes.toString('utf8')) : rename(h3Bytes.toString('utf8'));
  assert.deepEqual(h4Bytes, Buffer.from(expected, 'utf8'), name + ' differs from the derivation');
  if (editedTools.includes(name)) edited[name] = lineDiff(rename(h3Bytes.toString('utf8')), expected);
  else (h3Bytes.equals(h4Bytes) ? exact : renamedOnly).push(name);
}
const instrumentation = fs.readFileSync(path.join(root, h4ToolRel, 'instrumentation.ps1'), 'utf8');
for (const forbidden of ['Set-MpPreference', 'Add-MpPreference', 'Set-ItemProperty', 'New-ItemProperty', 'Stop-Process', 'Stop-Service', 'Restart-Service', 'Remove-Item', 'netsh', 'reg ', 'sc.exe', 'Invoke-WebRequest', 'memoryos-readiness', 'windows-inspect']) assert.equal(instrumentation.includes(forbidden), false, 'instrumentation must not contain ' + forbidden);
const added = Object.values(edited).flatMap(diff => diff.added.map(row => row.text)).join('\n');
const removed = Object.values(edited).flatMap(diff => diff.removed.map(row => row.text)).join('\n');
for (const protectedToken of ["const fixedLimits={helperWholeLifecycleMs:9000", "aggregateHelperEngineeringEnvelope={artificialEofDelayMs:5700", 'completedMandatoryCases===80', 'Refusing run', 'Refusing close']) assert.equal(removed.includes(protectedToken), false, protectedToken);
const declared = {
  common: fs.readFileSync(path.join(root, h4ToolRel, 'common.mjs'), 'utf8').match(/export const relativeE='([^']+)'/)[1],
  cache: fs.readFileSync(path.join(root, h4ToolRel, 'common.mjs'), 'utf8').match(/export const cache=path\.join\(root,'([^']+)'\)/)[1],
  report: fs.readFileSync(path.join(root, h4ToolRel, 'campaign.mjs'), 'utf8').match(/reportPath=path\.join\(root,'(docs\/[^']+)'\)/)[1],
  wrapper: fs.readFileSync(path.join(root, h4ToolRel, 'runtime-controls-run.py'), 'utf8').match(/E=ROOT\/'([^']+)'/)[1],
  observe: fs.readFileSync(path.join(root, h4ToolRel, 'observe-command.py'), 'utf8').match(/E=ROOT\/'([^']+)'/)[1],
};
assert.deepEqual(declared, { common: h4Rel, cache: h4CacheRel, report: h4ReportRel, wrapper: h4Rel, observe: h4Rel });
const h4Tools = rooted(h4ToolRel), rebindingTools = rooted(rebindingToolRel);
assert.deepEqual(rebindingTools.map(row => row.path.slice(rebindingToolRel.length + 1)), ['.gitattributes', 'instrumentation-campaign-block.txt', 'validate.mjs']);

// 4. Evidence.
const createdAt = new Date().toISOString();
const structural = {
  kind: 'MO1307Phase3AR2FinalH4RebindingStructuralValidation', version: '1.0.0', createdAt, result: 'PASS',
  rename: { pattern: 'phase3ar2-final-h3-corrected -> phase3ar2-final-h4-corrected; _H3_CORRECTED -> _H4_CORRECTED', fixtureRootsUnchanged: true },
  byteIdenticalToH3: exact, renameOnly: renamedOnly, edited: Object.fromEntries(Object.entries(edited)), addedFiles: addedTools,
  editPurpose: {
    'prepare.mjs': 'Bind the H4 rebinding receipt/tools/authorization; preserve and recheck the failed H3 generation, its tools and report; keep the H3 rebinding binding; allow the preserved H3 paths in the pre-preparation status check.',
    'record-harness-review.mjs': 'Bind the H4 rebinding receipt and the preserved failed H3 receipt in the review; reviewed module count 26 -> 27 (instrumentation.ps1).',
    'campaign.mjs': 'Seal the failed H3 tools/evidence/report and the H4 rebinding as prerequisites; bind them in the seal; tool count 26 -> 27; add harness-only host instrumentation (startInstrumentation/finishInstrumentation) around the one-shot run and bind its diagnosis in the close receipt. Instrumentation is best-effort and never decisive.',
    'instrumentation.ps1 (added)': 'Passive 1-Hz sampler (system CPU, CPU performance, free memory, run queue, per-process CPU deltas) and read-only post-run event-log/AV-status collector. Reads host counters and event logs only; sets no AV, Defender, OS or security setting; only lowers its own process priority.',
  },
  declaredWriteNamespaces: declared, harnessLogicChanged: false, instrumentationAdded: true, expectationsChanged: [], limitsChanged: false, productionChanged: false,
};
const sourceBindings = {
  kind: 'MO1307Phase3AR2FinalH4RebindingSourceBindings', version: '1.0.0', createdAt, result: 'PASS',
  candidate: { name: 'C3VB', commit: C3VB, productionCommit: C3V, productionTree },
  authorizationSource: { path: authorizationPath, ...(({ byteLength, sha256 }) => ({ byteLength, sha256 }))(record(authorizationPath)) },
  h3CampaignTools: h3Tools, h4CampaignTools: h4Tools, h4RebindingTools: rebindingTools,
  preservedFailedH3Generation: { evidence: h3Evidence, report: h3Report, receipt: h3Receipt },
};
const zero = {
  kind: 'MO1307Phase3AR2FinalH4RebindingZeroExecutionProof', version: '1.0.0', createdAt, result: 'PASS',
  scope: 'Static byte/hash/structure comparison and read-only git queries only.', gitInvocations,
  executionCounters: { productInvocations: 0, helperInvocations: 0, workerInvocations: 0, cliInvocations: 0, apiInvocations: 0, nativeObserverInvocations: 0, engineeringInterpreterInvocations: 0, packageBuilds: 0, packageInstalls: 0, certificationCases: 0, retries: 0 },
  repositoryWritesOutsideThisNamespace: 0, historicalEvidenceMutation: false,
};
if (mode === '--check') {
  process.stdout.write(JSON.stringify({ result: 'CHECK_PASS', exact: exact.length, renameOnly: renamedOnly.length, edited: Object.keys(edited), h4Tools: h4Tools.length, writes: 0 }) + '\n');
  process.exit(0);
}
fs.mkdirSync(evidence);
const put = (name, bytes) => { const file = path.join(evidence, name); fs.writeFileSync(file, bytes, { flag: 'wx' }); return record(file); };
const write = (name, value) => put(name, Buffer.from(JSON.stringify(value, null, 2) + '\n'));
const bindings = {
  authorization: put('authorization.txt', fs.readFileSync(authorizationPath)),
  preservedH3Generation: write('preserved-h3-generation.json', preservedH3),
  sourceBindings: write('source-bindings.json', sourceBindings),
  structuralValidation: write('structural-validation.json', structural),
  zeroExecutionProof: write('zero-execution-proof.json', zero),
};
write('receipt.json', {
  kind: 'MO1307Phase3AR2FinalH4GenerationRebindingReceipt', version: '1.0.0', createdAt, result: 'PASS', outcome: 'H4_GENERATION_REBOUND_ZERO_PRODUCT',
  candidate: sourceBindings.candidate, newGenerationNamespace: h4Rel, newCacheNamespace: h4CacheRel, newReport: h4ReportRel,
  preservedFailedH3Generation: h3Receipt, harnessLogicChanged: false, instrumentationAdded: true, expectationsChanged: [], limitsChanged: false, productionChanged: false,
  helperLimitMs: 9000, execution: zero.executionCounters, expectedEvidenceMembers: outputNames, bindings, retry: false, push: false, tag: false, phase3DStarted: false,
});
assert.deepEqual(walk(evidence).map(row => row.path), [...outputNames].sort());
process.stdout.write(JSON.stringify({ result: 'PASS', receipt: record(path.join(evidence, 'receipt.json')) }) + '\n');
