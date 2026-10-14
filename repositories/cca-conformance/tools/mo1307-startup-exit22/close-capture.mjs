// Evidence closure only. No product, diagnostic, test or certification execution.
import fs from 'node:fs';import path from 'node:path';import assert from 'node:assert/strict';import {createHash} from 'node:crypto';import {spawnSync} from 'node:child_process';import {fileURLToPath} from 'node:url';
const root=fileURLToPath(new URL('../../../../',import.meta.url));
const E='repositories/cca-conformance/evidence/mo1307/startup-exit22',T='repositories/cca-conformance/tools/mo1307-startup-exit22',report='docs/mo1307-startup-exit22.md';
const base='93e515d8a93a76243c322f15ca2ec02de0d598d4',production='defe93989efc6501b1a730b82e79e705884b269b';
const historical={phase3B:'702c1b6381f6112a50ac844831d195275dac3350',phase3C:'b02fc0226a1a2d800185a02071674ca80bdf4a1d'};
const abs=p=>path.join(root,p),read=p=>fs.readFileSync(abs(p)),json=p=>JSON.parse(read(p));
const hash=b=>'sha256:'+createHash('sha256').update(b).digest('hex');
const record=p=>{const b=read(p);return{path:p,byteLength:b.length,sha256:hash(b)};};
const put=(p,v)=>fs.writeFileSync(abs(p),JSON.stringify(v,null,2)+'\n',{flag:'wx'});
function git(...args){const r=spawnSync('C:/Program Files/Git/cmd/git.exe',args,{cwd:root,windowsHide:true,encoding:null,maxBuffer:8*1024*1024,timeout:30000});assert.ifError(r.error);assert.equal(r.status,0,r.stderr.toString());return r.stdout;}
const text=(...args)=>git(...args).toString().trim();
const receiptPath=E+'/execution/receipt.json',r=json(receiptPath),d=json(E+'/execution/diagnosis.json'),seal=json(E+'/execution/seal.json');
assert.equal(r.result,'STARTUP_FAILURE_CAPTURED');assert.equal(r.classification,'STARTUP_HOST_ATTRIBUTION_FAILURE');assert.equal(r.helperInvocations,1);assert.equal(r.additionalCasesExecuted,0);assert.equal(r.retries,0);assert.equal(r.certificationStarted,false);assert.equal(r.candidate,null);assert.equal(r.fatal,null);
assert.equal(r.case.exitCode,22);assert.equal(r.case.exitSignal,null);assert.equal(r.case.stdoutTotalBytes,0);assert.equal(r.case.stderrTotalBytes,1651);assert.equal(r.case.captureTruncated,false);assert.equal(r.case.snapshot.cleanupConfirmed,false);assert.equal(r.sourceUnchanged,true);assert.equal(r.transportResult.error.code,'MO1307_INTERNAL');
assert.equal(d.scriptEntryOccurred,true);assert.equal(d.firstFailure.id,'S12.01');assert.equal(d.firstFailure.nativeReturn,0);assert.equal(d.lastSuccessfulId,'S08.01');assert.equal(d.cleanupLastSuccessfulId,'S22');assert.equal(d.firstFailure.win32Error,203);assert.equal(d.firstFailure.win32ErrorMeaningful,false);
const logRecords=read(E+'/execution/stderr.data').toString('utf8').trim().split(/\r?\n/).map(JSON.parse);assert.equal(logRecords.length,2);assert.equal(logRecords[0].event,'ENTRY');assert.deepEqual(logRecords[1].firstFailure,d.firstFailure);
const recent=logRecords[1].recent;assert.equal(recent.find(x=>x.id==='S08').nativeReturn,1);assert.equal(recent.find(x=>x.id==='S08.01').nativeReturn,r.case.pid);assert.equal(r.case.pid,d.firstFailure.selfPid);
for(const value of Object.values(r.case.streams))assert.equal(value,true);
assert.equal(r.source.length,89);assert.deepEqual(r.source,seal.source);for(const row of r.source)assert.deepEqual(record(row.path),row);
for(const row of seal.bindings)assert.deepEqual(record(row.path),row);
git('diff','--exit-code',base,'--','repositories/memoryos-readiness','repositories/cca-conformance/evidence/mo1307/wire-repair','repositories/cca-conformance/tools/mo1307-wire-repair','repositories/cca-conformance/evidence/mo1307/console-correction','repositories/cca-conformance/tools/mo1307-console-correction','docs/mo1307-detached-wire-repair.md');
const sourceIdentity=hash(Buffer.from(JSON.stringify(r.source)+'\n'));
const futurePath='repositories/cca-conformance/evidence/mo1307/wire-repair/future-3bc-refresh-requirements.json',future=json(futurePath);
assert.equal(future.failedRepairSourceIdentity,sourceIdentity);assert.equal(future.phase3C.affectedPrimaryIds.length,88);assert.equal(new Set(future.phase3C.affectedPrimaryIds).size,88);
const mode=process.argv[2];assert.equal(process.argv.length,3);assert.ok(['close','bind'].includes(mode));
if(mode==='close'){
 assert.equal(text('rev-parse','HEAD'),base);
 put(E+'/closure.json',{
  kind:'MO1307StartupExit22ConcreteBlockerClosure',outcome:'PHASE3A_CONCRETE_IMPLEMENTATION_BLOCKER',classification:r.classification,
  candidate:null,productionAuthority:production,acceptedHistorical:historical,sourceBaseCommit:base,unacceptedPackageTree:text('rev-parse',base+':repositories/memoryos-readiness'),sourceIdentity,productionMembers:r.source,productionChanged:false,
  captured:{scriptEntry:true,lastSuccessfulId:d.lastSuccessfulId,firstFailedId:d.firstFailure.id,firstFailure:d.firstFailure,outerException:d.outerException,outerCatch:'S23',cleanupLastSuccessfulId:d.cleanupLastSuccessfulId,consoleClientCount:1,soleClientPid:r.case.pid,windowHandle:0,exit:r.case.exitCode,signal:r.case.exitSignal,stdoutBytes:r.case.stdoutTotalBytes,stderrBytes:r.case.stderrTotalBytes,elapsedProductMs:r.case.elapsedProductMs,transport:r.transportResult,cleanupConfirmed:false,streamAndProcessSettlement:r.case.streams},
  rootCause:{source:'repositories/memoryos-readiness/helpers/windows-inspect.ps1',getConsoleWindowLine:139,rejectionLine:140,startupCatchLine:349,reason:'The current-console ownership branch requires nonzero GetConsoleWindow. The exact diagnostic execution returned zero after proving sole-self membership and threw MO1307_INTERNAL at that guard.',win32Error203:'Captured nonmeaningful residual state, also present after successful console enumeration; not the causal failure.',scope:'One instrumented execution under the fixed intended launch, with exact production reconstruction. No universal claim about all Windows consoles or future samples.'},
  repair:{implemented:false,productionDiff:[],reason:'Accepting zero HWND would remove the selected current-window-to-owner attribution premise; no host object was acquired. No clear local correction preserves this proof under the captured state. The user prohibits ownership redesign, so the concrete design incompatibility is reported without bypassing the guard.',notReached:['GetWindowThreadProcessId owner attribution','OpenProcess and held-object checks','QueryFullProcessImageNameW/image comparison','FreeConsole','host waits','final console absence'],cleanup:'FreeHGlobal completed at S22; this does not establish host quiescence.'},
  execution:{instrumentedStartupInvocations:1,unmodifiedProductionHelperInvocations:0,retries:0,alternateCases:0,wireSmokeAfterRepair:'NOT_RUN_NO_REPAIR',securityValidation:'NOT_RUN',regression107:'NOT_RUN',nativeFilesystem:'NOT_RUN',toctou:'NOT_RUN',executionsAfterCapture:0},
  phase3A:{accepted:false,started:false,groups:Object.fromEntries('ABCDEFGHIJKLMNO'.split('').map(id=>[id,'NOT_RUN'])),H:'NOT_ESTABLISHED',newCandidate:null,archive:null,offlineInstallation:null,certificationReceipt:null},
  phase3BC:{executed:false,latestInstruction:'Do not rerun Phase3B or Phase3C in this task',dependencyMatrix:record(futurePath),productionSourceIdentityMatchesMatrix:true,phase3BArtifactTamperControls:future.phase3B.artifactBoundTamperControls,phase3CExistingAffectedIds:future.phase3C.affectedPrimaryIds,phase3CCount:88,phase3CSupportingNativeRawWitnesses:future.phase3C.additionalNativeRawWitnesses,phase3CNewConsoleCases:future.phase3C.additionalConsoleCaseRequirements,scopeStatus:'Future dependency scope only; no new sealed refresh campaign or transferred historical PASS.'},
  limitsMs:{helper:5000,aggregate:20000,cli:30000,apiWorker:10000,cleanup:2000,nativeHostWait:1000},
  evidence:{receipt:record(receiptPath),diagnosis:record(E+'/execution/diagnosis.json'),stderr:record(E+'/execution/stderr.data'),stdout:record(E+'/execution/stdout.data'),seal:record(E+'/execution/seal.json'),stop:record(E+'/execution/stopped.json'),instrumentationProof:record(E+'/preparation-final/instrumentation-proof.json'),preexecutionReview:record(E+'/preexecution-review.json'),parserOnly:record(E+'/parser-check-final.json'),userRequest:record(E+'/user-request.txt')},
  previousGenerationsUnchanged:true,accepted3BAnd3CPreserved:true,pushPerformed:false,tagCreated:false,phase3DStarted:false,nextAction:'Stop this generation and report the captured selected-ownership implementation blocker. No second sample, speculative correction or further execution.'
 });
 console.log(JSON.stringify({closed:true,outcome:'PHASE3A_CONCRETE_IMPLEMENTATION_BLOCKER',sourceIdentity,productionChanged:false}));
}else{
 assert.equal(text('status','--porcelain'),'','Commit diagnostic evidence before binding');
 const evidenceCommit=text('rev-parse','HEAD');
 const entries=git('ls-tree','-rz','--full-tree',evidenceCommit,'--',E,T,report,'repositories/memoryos-readiness').toString().split('\0').filter(Boolean);
 const committed=entries.map(entry=>{const match=/^100644 blob ([a-f0-9]{40})\t(.+)$/.exec(entry);assert.ok(match,entry);const bytes=read(match[2]);const objectId=createHash('sha1').update(Buffer.from('blob '+bytes.length+'\0')).update(bytes).digest('hex');assert.equal(objectId,match[1],'Committed blob differs: '+match[2]);return record(match[2]);});
 assert.ok(committed.length>89);
 put(E+'/final-binding.json',{kind:'MO1307StartupExit22EvidenceBinding',outcome:'PHASE3A_CONCRETE_IMPLEMENTATION_BLOCKER',classification:r.classification,acceptedCandidate:null,diagnosticEvidenceCommit:evidenceCommit,sourceBaseCommit:base,unchangedUnacceptedPackageTree:text('rev-parse',evidenceCommit+':repositories/memoryos-readiness'),sourceIdentity,source:r.source,artifacts:committed.filter(row=>!row.path.startsWith('repositories/memoryos-readiness/')),productionChanged:false,productionAuthority:production,acceptedHistorical:historical,branch:text('branch','--show-current'),workingTreeCleanBeforeBinding:true,exactCommittedSourceAndArtifactsVerified:true,certificationReceipt:null,noAcceptance:true,selfReference:'This binding is committed separately; its own commit hash is reported after commit.'});
 console.log(JSON.stringify({bound:true,diagnosticEvidenceCommit:evidenceCommit,productionChanged:false,verifiedFiles:committed.length}));
}
