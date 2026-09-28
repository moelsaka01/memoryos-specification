// Engineering-only, finite diagnosis of the unchanged Phase 1 publication seam.
// All protocol identities below are synthetic; none establishes native safety.
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { createHash } from 'node:crypto';
import { spawnSync } from 'node:child_process';
import { performance } from 'node:perf_hooks';
import { DEFINITIONS as D } from '../../../memoryos-readiness/src/constants.mjs';
import { encodeHelperRequest, decodeHelperRequest, encodeHelperResponse,
  decodeHelperResponse, createHelperSequence } from '../../../memoryos-readiness/src/helper-protocol.mjs';
import { assertComponentChain } from '../../../memoryos-readiness/src/windows-paths.mjs';
import { createPublication } from '../../../memoryos-readiness/src/publication.mjs';

const started = performance.now();
const root = fileURLToPath(new URL('../../../../', import.meta.url));
const git = 'C:\\Program Files\\Git\\cmd\\git.exe';
const ps = 'C:\\Windows\\System32\\WindowsPowerShell\\v1.0\\powershell.exe';
const python = 'C:\\Users\\melsa\\.cache\\codex-runtimes\\codex-primary-runtime\\dependencies\\python\\python.exe';
const expectedHead = '3883ca889911fcc5a6f46c24e569478a8c32648e';
const expectedI1 = '7aa5ede6ec52b36d0428273d78c8ca7aa37a39ee';
const expectedFreeze = 'e0cb8e9cc6aa73e26945db30756a6667a8d9e322';
const expectedBranch = 'codex/mo1307-phase2c-acquisition-publication';
const evidence = 'repositories/cca-conformance/evidence/mo1307/phase2c/';
const hash = bytes => 'sha256:' + createHash('sha256').update(bytes).digest('hex');
const row = name => { const b = fs.readFileSync(path.join(root, name)); return { path: name, byteLength: b.length, sha256: hash(b) }; };
const commands = [];
function run(id, executable, args, env) {
  const begin = performance.now();
  const child = spawnSync(executable, args, { cwd: root, env, windowsHide: true,
    encoding: 'utf8', timeout: 60000, maxBuffer: 4 * 1024 * 1024 });
  const record = { id, executable, args, exit: child.status, signal: child.signal,
    errorCode: child.error?.code ?? null, elapsedMs: Number((performance.now() - begin).toFixed(3)),
    stdout: child.stdout ?? '', stderr: child.stderr ?? '' };
  commands.push(record);
  assert.equal(record.errorCode, null, id); assert.equal(record.exit, 0, id);
  return record.stdout.trim();
}
const receipt = { kind: 'MemoryOSReadinessPhase2CBlockerReceipt', version: '1.0.0',
  campaign: row(evidence + 'blocker-campaign.json'), startedAt: new Date().toISOString(),
  taskStartedAt: '2026-09-28T14:59:00Z', taskStartPrecision: 'minute; first timestamped preflight at 14:59:32Z',
  classification: 'FROZEN_PUBLICATION_INSPECTION_SEAM_INSUFFICIENT', productionCertification: false,
  commands, probes: [], limitations: [
    'Protocol records use synthetic identities and do not prove checked native handles or filesystem policy.',
    'No evaluation worker, native acquisition, publication or process-topology campaign was run.',
    'Existing Phase 1 receipts are revalidated, not represented as a newly run Phase 1 regression.',
    'An authorized contract/interface correction is required before dependent implementation.'
  ] };
try {
  assert.equal(process.platform, 'win32'); assert.equal(process.arch, 'x64'); assert.equal(process.version, 'v24.21.0');
  const exe = fs.readFileSync(process.execPath);
  assert.equal(exe.length, 93580104);
  assert.equal(hash(exe), 'sha256:ba4e6d110e8c1592a1ecd390f6b05f3da124b13871a5be62b341a07a853c6c32');
  receipt.runtime = { executable: process.execPath, version: process.version, platform: process.platform,
    arch: process.arch, byteLength: exe.length, sha256: hash(exe), execArgv: process.execArgv };
  const head = run('head', git, ['rev-parse', 'HEAD']); assert.equal(head, expectedHead);
  const branch = run('branch', git, ['branch', '--show-current']); assert.equal(branch, expectedBranch);
  const parent = run('b1-parent', git, ['rev-parse', 'HEAD^']); assert.equal(parent, expectedI1);
  assert.equal(run('i1-parent', git, ['rev-parse', expectedI1 + '^']), expectedFreeze);
  run('freeze-ancestry', git, ['merge-base', '--is-ancestor', expectedFreeze, head]);
  run('i1-ancestry', git, ['merge-base', '--is-ancestor', expectedI1, head]);
  assert.equal(run('b1-subject', git, ['show', '-s', '--format=%s', 'HEAD']),
    'conformance(memoryos-1.3): bind MO-1307 phase 1 foundation');
  const b1Paths = run('b1-paths', git, ['diff', '--name-only', expectedI1, head]).split('\n').sort();
  assert.deepEqual(b1Paths, ['ROADMAP.md', 'repositories/cca-conformance/evidence/mo1307/phase1/binding.json']);
  assert.equal(run('tracked-worktree-diff', git, ['diff', '--name-only', 'HEAD']), '');
  receipt.baseline = { head, parent, branch, freeze: expectedFreeze, b1Paths,
    initialStatus: 'CLEAN (preflight before evidence creation)', trackedFilesUnchanged: true };
  const psBytes = fs.readFileSync(ps);
  assert.equal(hash(psBytes), 'sha256:8bb6fa8c283b4d92120b1ef249a9b311b0f804d4cabbe9981159976c8be76a5e');
  const psIdentity = JSON.parse(run('powershell-identity', ps, ['-NoLogo', '-NoProfile', '-NonInteractive', '-Command',
    '[pscustomobject]@{version=$PSVersionTable.PSVersion.ToString();edition=$PSVersionTable.PSEdition;is64BitProcess=[Environment]::Is64BitProcess;os=[Environment]::OSVersion.Version.ToString();systemDirectory=[Environment]::SystemDirectory} | ConvertTo-Json -Compress'],
    { SystemRoot: 'C:\\Windows', WINDIR: 'C:\\Windows' }));
  assert.match(psIdentity.version, /^5\.1\./); assert.equal(psIdentity.is64BitProcess, true);
  receipt.powershell = { executable: ps, byteLength: psBytes.length, sha256: hash(psBytes), ...psIdentity,
    scope: 'engineering identity query; product helper not invoked' };
  receipt.phase1Binding = JSON.parse(run('phase1-inventory', process.execPath,
    ['repositories/cca-conformance/tools/mo1307-phase1/verify-binding.mjs', '--inventory']));
  receipt.phase1BoundModeNote = '--bound is historical main-only and requires a clean tree. Exact B1 identity/parent/change set and I1/Freeze ancestry are checked above on the user-required branch; no main-branch claim is made.';

  const identity = (finalPath, directory = true) => ({ attributes: directory ? 16 : 32, byteLength: 0,
    fileId: '0000000000000001', finalPath, isDirectory: directory, linkCount: 1, volumeSerial: '00000001' });
  const request = sequence => ({ kind: 'MemoryOSReadinessHelperRequest', version: '1.0.0', sequence,
    operation: sequence === 4 ? 'CHECK_OUTPUT' : 'READ_SET',
    roots: [{ id: sequence === 4 ? 'output' : 'input', path: sequence === 4 ? 'C:\\Private\\NewOutput' : 'C:\\Input' }],
    files: sequence === 1 ? [{id:'authority',maxBytes:D.limits.authorityBytes,path:'authority.json',root:'input'}, {id:'config',maxBytes:D.limits.configurationBytes,path:'config.json',root:'input'}]
      : sequence === 2 ? [{id:'candidate',maxBytes:D.limits.candidateBytes,path:'candidate.json',root:'input'}, {id:'manifest',maxBytes:D.limits.manifestBytes,path:'manifest.json',root:'input'}] : [] });
  const response = req => ({ kind:'MemoryOSReadinessHelperResponse', version:'1.0.0', sequence:req.sequence,
    operation:req.operation, code:null, status:req.operation === 'CHECK_OUTPUT' ? 'ABSENT' : 'OK',
    roots:req.operation === 'CHECK_OUTPUT' ? [{id:'output-parent',identity:identity('C:\\Private')}]
      : [{id:'input',identity:identity('C:\\Input')}],
    files:req.files.map(f => ({id:f.id,identity:identity('C:\\Input\\'+f.path,false),bytes:[]})) });
  const q4 = request(4), r4 = response(q4);
  async function probe(id, description, action) {
    try { await action(); receipt.probes.push({ id, description, result:'PASS' }); }
    catch (error) { receipt.probes.push({ id, description, result:'FAIL', errorCode:error.code ?? error.name }); throw error; }
  }
  const rejects = (action, code) => assert.throws(action, error => error.code === 'MO1307_' + code);
  await probe('B01','Unmodified CHECK_OUTPUT round-trip carries ABSENT plus only output-parent', () => {
    const actual = decodeHelperResponse(encodeHelperResponse(r4, q4), q4);
    assert.equal(actual.status,'ABSENT'); assert.equal(actual.roots.length,1); assert.equal(actual.files.length,0);
    assert.equal(actual.roots[0].identity.finalPath,'C:\\Private');
  });
  await probe('B02','CHECK_OUTPUT cannot return the newly created root as output-parent', () => {
    const changed=structuredClone(r4); changed.roots[0].identity.finalPath='C:\\Private\\NewOutput';
    rejects(() => encodeHelperResponse(changed,q4),'FILESYSTEM_BOUNDARY');
  });
  await probe('B03','CHECK_OUTPUT cannot return both parent and created root', () => {
    const changed=structuredClone(r4); changed.roots.push({id:'output',identity:identity('C:\\Private\\NewOutput')});
    changed.roots.sort((a,b)=>a.id<b.id?-1:1); rejects(()=>encodeHelperResponse(changed,q4),'INPUT');
  });
  await probe('B04','CHECK_OUTPUT cannot return pending file identity or bytes', () => {
    const changed=structuredClone(r4); changed.files=[{id:'pending',identity:identity('C:\\Private\\NewOutput\\memoryos-readiness-result.json.pending',false),bytes:[]}];
    rejects(()=>encodeHelperResponse(changed,q4),'INPUT');
  });
  await probe('B05','A new ancestor chain response field is not wire compatible', () => {
    rejects(()=>encodeHelperResponse({...r4,chain:[identity('C:\\'),identity('C:\\Private')]},q4),'INPUT');
  });
  await probe('B06','An existing-output response status is not accepted', () => {
    rejects(()=>encodeHelperResponse({...r4,status:'OK'},q4),'INPUT');
  });
  await probe('B07','CHECK_OUTPUT request cannot ask to inspect a pending file', () => {
    rejects(()=>encodeHelperRequest({...q4,files:[{id:'pending',root:'output',path:'memoryos-readiness-result.json.pending',maxBytes:D.limits.resultBytes}]}),'INPUT');
  });
  await probe('B08','READ_SET cannot acquire the output capability', () => {
    rejects(()=>encodeHelperRequest({...q4,operation:'READ_SET',files:[{id:'result',root:'output',path:'memoryos-readiness-result.json.pending',maxBytes:D.limits.resultBytes}]}),'INPUT');
  });
  await probe('B09','Sequence 5 is rejected', () => {
    rejects(()=>encodeHelperRequest({...q4,sequence:5}),'INPUT');
  });
  await probe('B10','Four completed synthetic slots cannot be followed by another inspection', () => {
    const sequence=createHelperSequence('evaluate');
    for(let n=1;n<=4;n++){const q=request(n); decodeHelperRequest(sequence.begin(q)); sequence.complete(encodeHelperResponse(response(q),q));}
    rejects(()=>sequence.begin(q4),'INPUT');
  });
  await probe('B11','One parent identity cannot supply the complete parent ancestor chain', () => {
    rejects(()=>assertComponentChain('C:\\Private',null,r4.roots.map(r=>r.identity)),'FILESYSTEM_BOUNDARY');
  });
  await probe('B12','Publication without native inspect fails before filesystem mutation', async () => {
    await assert.rejects(()=>createPublication('C:\\Private\\NewOutput'),e=>e.code==='MO1307_OUTPUT');
  });
  run('workspace',python,['-B','tools/verify_workspace.py','--root','.']);
  run('diff-check',git,['diff','--check']);
  const authorities = [
    'docs/mo1307-contract-freeze-1.md', 'docs/mo1307-phase1-foundation.md',
    'repositories/memoryos-readiness/src/helper-protocol.mjs', 'repositories/memoryos-readiness/src/publication.mjs',
    'repositories/memoryos-readiness/src/windows-paths.mjs', 'repositories/memoryos-readiness/helpers/windows-inspect.ps1',
    'repositories/memoryos-readiness/helpers/README.md', 'repositories/memoryos-readiness/contracts/definitions.json',
    'repositories/memoryos-readiness/src/index.mjs', 'repositories/memoryos-readiness/src/cli-args.mjs',
    'repositories/memoryos-readiness/package.json', 'repositories/cca-conformance/tests/mo1307_phase1_native_test.mjs',
    'repositories/cca-conformance/evidence/mo1307/phase1/binding.json',
    'repositories/cca-conformance/evidence/mo1307/phase1/acceptance/receipt.json',
    'repositories/cca-conformance/evidence/mo1307/phase1/characterization/summary.json',
    'repositories/cca-conformance/tools/mo1307-phase2c/blocker-probe.mjs'
  ];
  receipt.bindings=authorities.map(row);
  receipt.result='BLOCKER_REPRODUCED'; receipt.probeSummary={count:12,pass:12,fail:0};
} catch(error) {
  receipt.result='DIAGNOSTIC_FAILURE'; receipt.error={name:error.name,code:error.code??null,message:error.message};
  process.exitCode=1;
}
receipt.finishedAt=new Date().toISOString();
receipt.elapsedMs=Number((performance.now()-started).toFixed(3));
fs.writeFileSync(path.join(root,evidence+'blocker-receipt.json'),JSON.stringify(receipt,null,2)+'\n',{flag:'wx'});
process.stdout.write(JSON.stringify({result:receipt.result,probeSummary:receipt.probeSummary??null,elapsedMs:receipt.elapsedMs})+'\n');
