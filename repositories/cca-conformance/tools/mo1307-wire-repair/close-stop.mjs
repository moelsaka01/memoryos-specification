// Evidence-only closure after the first mandatory smoke failure. No product runs.
import fs from 'node:fs';
import path from 'node:path';
import assert from 'node:assert/strict';
import {createHash} from 'node:crypto';
import {spawnSync} from 'node:child_process';
import {fileURLToPath} from 'node:url';
const root=fileURLToPath(new URL('../../../../',import.meta.url));
const E='repositories/cca-conformance/evidence/mo1307/wire-repair';
const T='repositories/cca-conformance/tools/mo1307-wire-repair';
const report='docs/mo1307-detached-wire-repair.md';
const hash=b=>'sha256:'+createHash('sha256').update(b).digest('hex');
const read=p=>fs.readFileSync(path.join(root,p));
const record=p=>{const b=read(p);return{path:p,byteLength:b.length,sha256:hash(b)};};
const json=p=>JSON.parse(read(p));
const put=(p,v)=>fs.writeFileSync(path.join(root,p),Buffer.isBuffer(v)?v:Buffer.from(JSON.stringify(v,null,2)+'\n'),{flag:'wx'});
const git=(...args)=>{const r=spawnSync('C:/Program Files/Git/cmd/git.exe',args,{cwd:root,windowsHide:true,encoding:null,maxBuffer:8*1024*1024});assert.ifError(r.error);assert.equal(r.status,0,r.stderr?.toString());return r.stdout;};
const gitText=(...args)=>git(...args).toString().trim();
const receiptPath=E+'/minimum-wire-smoke/receipt.json',r=json(receiptPath),seal=json(E+'/minimum-wire-smoke/seal.json');
assert.equal(r.result,'FAIL');assert.equal(r.helperInvocations,1);assert.equal(r.case.exitCode,22);assert.equal(r.failure.code,'MO1307_INTERNAL');
assert.equal(r.case.stdoutTotalBytes,0);assert.equal(r.case.stderrTotalBytes,0);assert.equal(r.case.snapshot.cleanupConfirmed,false);
assert.equal(r.sourceUnchanged,true);assert.equal(r.additionalCasesExecuted,0);assert.equal(r.certificationStarted,false);assert.equal(r.candidate,null);
assert.equal(r.source.length,89);assert.deepEqual(r.source,seal.source);for(const row of r.source)assert.deepEqual(record(row.path),row);
assert.deepEqual(record(seal.driver.path),seal.driver);assert.equal(seal.launch.options.detached,false);
assert.equal(hash(read('repositories/memoryos-readiness/helpers/windows-inspect.ps1')),hash(git('show','865978ff56229b60cca77bdb797987fc7d49aa4e:repositories/memoryos-readiness/helpers/windows-inspect.ps1')));
const sourceIdentity=hash(Buffer.from(JSON.stringify(r.source)+'\n'));
const baseline='defe93989efc6501b1a730b82e79e705884b269b',priorHead='cd8926e1e14db736db4b2957858b9032b75425b0';
const accepted3B='702c1b6381f6112a50ac844831d195275dac3350',accepted3C='b02fc0226a1a2d800185a02071674ca80bdf4a1d';
const preservationPaths=['repositories/cca-conformance/evidence/mo1307/console-correction','repositories/cca-conformance/tools/mo1307-console-correction','docs/mo1307-console-ownership-correction.md','docs/mo1307-console-ownership-final-report.md'];
git('diff','--exit-code',priorHead,'--',...preservationPaths);
const changed=gitText('diff','--name-only',baseline,'--','repositories/memoryos-readiness').split(/\r?\n/).filter(Boolean);
assert.equal(changed.length,5);
for(const row of r.source.filter(x=>x.path.includes('/schemas/')||x.path.includes('/contracts/')))assert.equal(row.sha256,hash(git('show',baseline+':'+row.path)),'Contract/schema must remain byte-identical');
const mode=process.argv[2];assert.equal(process.argv.length,3);assert.ok(['close','bind'].includes(mode));
if(mode==='close'){
 assert.equal(gitText('rev-parse','HEAD'),priorHead);
 const input=read(seal.input.path);assert.equal(hash(input),seal.input.sha256);put(E+'/minimum-wire-smoke/input-small.bin.data',input);
 const requestAttachment='C:/Users/melsa/.codex/attachments/142eef35-ed32-4904-8339-95024320b242/Pasted text.txt';
 put(E+'/user-request.txt',fs.readFileSync(requestAttachment));
 const oldScope='repositories/cca-conformance/evidence/mo1307/console-correction/future-3bc-refresh-requirements.json';
 const future=json(oldScope);
 future.kind='MO1307WireRepairFuture3BCRefreshRequirements';future.status='FUTURE_ONLY_BLOCKED_BY_MINIMUM_WIRE_FAILURE';future.candidate=null;future.packageTree=null;
 future.failedRepairSourceIdentity=sourceIdentity;future.basis=record(oldScope);
 future.applicability='No refresh is admitted. Scope below is the dependency selection for these failed repaired bytes, not a sealed campaign. Any later edit requires reconciliation; only successful security/regressions, a new candidate, and fresh Phase3A acceptance admit parallel scoped3B/3C refresh.';
 future.actualChangedShippedMembers=changed.map(p=>p.replace('repositories/memoryos-readiness/',''));
 future.phase3C.reasons=future.phase3C.reasons.map(s=>s.replace('bind detached:true and the corrected console policy explicitly','bind detached:false and the corrected console policy explicitly'));
 future.actualDiffReconciliation={helperUnchangedFromFailedCorrection:true,detachedMatchesC3RB:true,transportSourceStillChanged:true,changedSecurityPolicyStillApplies:true,existingAffectedPrimaryControls:88,reason:'All helper/native-frame-dependent closures still consume the changed security helper. The fixed-launch behavior has returned to detached:false, but its source binding and console policy require fresh candidate evidence. Keep the same88 explicit IDs conservatively; no execution or inherited PASS is asserted.',historicalRemaining:463,remainingReuse:'Only after exact dependency proof; not granted here.'};
 put(E+'/future-3bc-refresh-requirements.json',future);
 put(E+'/closure.json',{
  kind:'MO1307WireRepairStoppedClosure',outcome:'PHASE3A_CONCRETE_IMPLEMENTATION_BLOCKER',candidate:null,acceptedCandidate:false,
  sourceBaseHead:priorHead,productionAuthority:baseline,acceptedHistorical:{phase3B:accepted3B,phase3C:accepted3C},sourceIdentity,source:r.source,
  cause:{established:'In the two fixed engineering probes, detached:true exited0 with no entry witness/output; detached:false entered and echoed the exact350-byte request through valid pipes.',notEstablished:'Internal PowerShell early-exit branch; original product internal startup path; Stream.Null hypothesis.',repair:'detached:true to detached:false; security helper and wire/settlement implementation unchanged.'},
  failure:{step:'FIRST_MINIMUM_NATIVE_WIRE_SMOKE',exit:22,signal:null,stdoutBytes:0,stderrBytes:0,transport:r.failure.code,stage:r.failure.stage,elapsedMs:r.case.elapsedProductMs,cleanupConfirmed:false,allProcessAndStreamSettlementFlags:r.case.streams,internalStartupBranch:'NOT_ESTABLISHED'},
  execution:{diagnosticEngineeringLaunches:2,productionHelperInvocations:1,wireSmoke:'FAIL',additionalSecurityCases:0,regressionTestsExecuted:0,nativeFilesystemCasesExecuted:0,toctouCasesExecuted:0,retries:0,productionExecutionAfterFailure:0},
  preSmokePreparation:{packageBuildCheck:{members:89,contractMembers:53,externalProductionDependencies:0,archiveCertification:false},syntaxOnly:['launch-probe.mjs','launch-probe.ps1','minimum-wire-smoke.mjs','regressions.mjs','native-filesystem.mjs','toctou.mjs','validation-bindings.mjs']},
  phase3A:{status:'NOT_ACCEPTED',started:false,groups:Object.fromEntries('ABCDEFGHIJKLMNO'.split('').map(k=>[k,'NOT_RUN'])),helperDeadlineAcceptance:'NOT_ESTABLISHED',certificationReceipt:null,archive:null,offlineInstall:null},
  limitsMs:{helper:5000,aggregate:20000,cli:30000,apiWorker:10000,cleanup:2000,nativeHostWait:1000},
  evidence:{smoke:record(receiptPath),seal:record(E+'/minimum-wire-smoke/seal.json'),stop:record(E+'/minimum-wire-smoke/stopped.json'),input:record(E+'/minimum-wire-smoke/input-small.bin.data'),diagnostic:record(E+'/launch-diagnostic/receipt.json'),futureScope:record(E+'/future-3bc-refresh-requirements.json'),userRequest:record(E+'/user-request.txt')},
  historicalEvidenceUnchanged:true,accepted3BAnd3CPreserved:true,pushPerformed:false,tagCreated:false,phase3DStarted:false,
  nextAction:'Stop. This failed generation admits no further executions. A later scoped implementation instruction must address the silent startup refusal while preserving the security invariant before a fresh mandatory validation generation.'
 });
 console.log(JSON.stringify({closed:true,outcome:'PHASE3A_CONCRETE_IMPLEMENTATION_BLOCKER',sourceIdentity}));
}else{
 assert.equal(gitText('status','--porcelain'),'','Commit unaccepted repair and evidence before final binding');
 const evidenceCommit=gitText('rev-parse','HEAD'),packageTree=gitText('rev-parse','HEAD:repositories/memoryos-readiness');
 for(const row of r.source)assert.equal(hash(git('show',evidenceCommit+':'+row.path)),row.sha256);
 const files=gitText('ls-tree','-r','--name-only',evidenceCommit,'--',E,T,report).split(/\r?\n/).filter(Boolean).map(record);
 for(const row of files)assert.equal(hash(git('show',evidenceCommit+':'+row.path)),row.sha256);
 put(E+'/final-binding.json',{kind:'MO1307WireRepairFailedRevisionBinding',outcome:'PHASE3A_CONCRETE_IMPLEMENTATION_BLOCKER',acceptedCandidate:null,failedRepairEvidenceCommit:evidenceCommit,unacceptedPackageTree:packageTree,sourceIdentity,source:r.source,artifacts:files,productionAuthority:baseline,acceptedHistorical:{phase3B:accepted3B,phase3C:accepted3C},branch:gitText('branch','--show-current'),workingTreeCleanBeforeBinding:true,exactCommittedSourceAndArtifactsVerified:true,certificationReceipt:null,noAcceptance:true,selfReference:'This binding is committed separately and does not contain its own final commit hash.'});
 console.log(JSON.stringify({bound:true,failedRepairEvidenceCommit:evidenceCommit,unacceptedPackageTree:packageTree,artifacts:files.length}));
}
