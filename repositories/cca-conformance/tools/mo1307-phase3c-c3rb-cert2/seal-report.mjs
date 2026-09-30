// Post-stop report sealing and preservation only. Does not run certification or product code.
import fs from 'node:fs';
import assert from 'node:assert/strict';
import {createHash} from 'node:crypto';
import {execFileSync,spawnSync} from 'node:child_process';
const ev='repositories/cca-conformance/evidence/mo1307/phase3c-c3rb-cert2',td='repositories/cca-conformance/tools/mo1307-phase3c-c3rb-cert2',report='docs/mo1307-phase3c-c3rb-cert2.md';
const read=p=>fs.readFileSync(p),json=p=>JSON.parse(read(p)),sha=b=>'sha256:'+createHash('sha256').update(b).digest('hex');
const pin=p=>{const b=read(p);return{path:p,byteLength:b.length,sha256:sha(b)}};
const write=(p,v)=>fs.writeFileSync(p,JSON.stringify(v,null,2)+'\n',{flag:'wx'});
const toolchain=json(ev+'/git-resolution.json');assert.equal(sha(read(toolchain.git.absolute)),toolchain.git.sha256);assert.equal(sha(read(toolchain.core.absolute)),toolchain.core.sha256);
const git=(...args)=>execFileSync(toolchain.git.absolute,['-c','core.longpaths=true',...args],{windowsHide:true,maxBuffer:32*1024*1024});
const text=(...args)=>git(...args).toString().trim();
const allowed=p=>p===report||p.startsWith(ev+'/')||p.startsWith(td+'/');
const verifyPin=r=>assert.deepEqual(pin(r.path),r,'Changed pinned bytes: '+r.path);
const pre=json(ev+'/pre-execution-seal.json');for(const r of pre.members)verifyPin(r);
const receiptPath=ev+'/certification-receipt.json',receipt=json(receiptPath);assert.equal(receipt.result,'FAILED/INCOMPLETE');assert.equal(receipt.campaign.controls.currentControlsNotRun,551);
const mode=process.argv[2];
if(mode==='seal'){
  assert.equal(text('rev-parse','HEAD'),receipt.candidate);
  const staged=git('diff','--cached','--name-only','-z').toString().split('\0').filter(Boolean);assert.ok(staged.length>0);assert.ok(staged.every(allowed));
  for(const p of staged){assert.equal(text('diff','--cached','--diff-filter=A','--name-only','--',p),p);assert.deepEqual(git('show',':'+p),read(p),'Staged bytes differ: '+p);}
  const check=spawnSync(toolchain.git.absolute,['-c','core.longpaths=true','diff','--cached','--check'],{windowsHide:true});
  fs.writeFileSync(ev+'/staged-whitespace.stdout.txt',check.stdout,{flag:'wx'});fs.writeFileSync(ev+'/staged-whitespace.stderr.txt',check.stderr,{flag:'wx'});assert.equal(check.status,0,'Staged whitespace check failed');
  write(ev+'/post-stop-diagnostics.json',{kind:'MO1307Phase3CCert2PostStopDiagnostics',purpose:'Preservation/reporting only',stagedScope:'Only new generation evidence, engineering tools and report',stagedAddedFilesVerified:staged.length,stagedBytesMatchWorkingFiles:true,whitespace:{absoluteExecutable:toolchain.git.absolute,args:['-c','core.longpaths=true','diff','--cached','--check'],exitCode:check.status,stdout:pin(ev+'/staged-whitespace.stdout.txt'),stderr:pin(ev+'/staged-whitespace.stderr.txt')},preExecutionBytesUnchanged:pre.members.length,certificationRerun:false,productExecution:false,commitCleanStatus:'To be checked after commit; not claimed by this pre-commit diagnostic'});
  write(ev+'/final-report-review.json',{kind:'IndependentPhase3CCert2ReportingReview',scope:'Read-only report, receipts, remaining inventory and preservation audit',result:'CONSISTENT_FAILED_INCOMPLETE_NO_PROMOTION',checks:{requiredReportItems:22,uniquePrimaryControls:551,rejectionControls:426,primaryPass:0,primaryFail:0,primaryNotRun:551,stagesPass:1,stagesFail:1,stagesNotRun:11,bindingChecksPass:6,engineeringValidationPass:8,engineeringNegativePass:6},failureInterpretation:'PowerShell stage exit1; no Git exit value established; root cause unconfirmed',futureCleanStatusNotClaimed:true,priorFailedReceiptUnchanged:true,noAcceptedPhase3DHandoff:true,noCertificationExecutionDuringReview:true});
  receipt.report=pin(report);receipt.finalReportReview=pin(ev+'/final-report-review.json');receipt.postStopDiagnostics=pin(ev+'/post-stop-diagnostics.json');fs.writeFileSync(receiptPath,JSON.stringify(receipt,null,2)+'\n');
  function list(d){return fs.readdirSync(d,{withFileTypes:true}).flatMap(e=>{assert.ok(!e.isSymbolicLink());return e.isDirectory()?list(d+'/'+e.name):[d+'/'+e.name]});}
  const members=[report,...list(ev),...list(td)].sort().map(pin);
  write(ev+'/evidence-manifest.json',{kind:'MO1307Phase3CCert2FailureEvidenceManifest',result:'FAILED/INCOMPLETE',candidate:receipt.candidate,members,excludes:[ev+'/evidence-manifest.json',ev+'/final-seal.json'],selfReference:false});
  write(ev+'/final-seal.json',{kind:'MO1307Phase3CCert2FailureSeal',sealedAt:new Date().toISOString(),result:'SEALED_FAILED_GENERATION',accepted:false,candidate:receipt.candidate,manifest:pin(ev+'/evidence-manifest.json'),receipt:pin(receiptPath),report:pin(report),firstFailure:pin(ev+'/first-failure.json'),preExecutionBytesUnchanged:pre.members.length,certificationAfterStop:false,phase3DHandoff:null,commitIdentity:'Containing conformance-only commit; exact hash supplied externally after creation.'});
  console.log(JSON.stringify({result:'SEALED_FAILED_GENERATION',members:members.length,preExecutionBytesUnchanged:pre.members.length,stagedWhitespaceExit:check.status}));
}else if(mode==='verify-staged'||mode==='verify-committed'){
  const seal=json(ev+'/final-seal.json');for(const key of ['manifest','receipt','report','firstFailure'])verifyPin(seal[key]);
  const manifest=json(ev+'/evidence-manifest.json');for(const r of manifest.members)verifyPin(r);
  const all=[...manifest.members.map(r=>r.path),ev+'/evidence-manifest.json',ev+'/final-seal.json'].sort();
  const args=mode==='verify-staged'?['diff','--cached','--name-only','-z']:['diff-tree','--no-commit-id','--name-only','-r','-z','HEAD'];
  const changed=git(...args).toString().split('\0').filter(Boolean).sort();assert.deepEqual(changed,all);assert.ok(all.every(allowed));
  for(const p of all)assert.deepEqual(git('show',(mode==='verify-staged'?':':'HEAD:')+p),read(p),'Git bytes differ: '+p);
  const whitespace=spawnSync(toolchain.git.absolute,['-c','core.longpaths=true',...(mode==='verify-staged'?['diff','--cached','--check']:['show','--format=','--check','HEAD'])],{windowsHide:true});assert.equal(whitespace.status,0);
  assert.equal(text('diff','--name-only'),'');
  if(mode==='verify-committed'){assert.equal(text('rev-parse','HEAD^'),receipt.candidate);assert.equal(text('rev-list','--parents','-n','1','HEAD').split(' ').length,2);assert.equal(text('status','--porcelain=v1','--untracked-files=all'),'');}
  console.log(JSON.stringify({mode,result:'PASS_PRESERVATION_ONLY',commit:text('rev-parse','HEAD'),branch:text('branch','--show-current'),verifiedNewFiles:all.length,preExecutionSealedMembersUnchanged:pre.members.length,productionChanged:false,whitespaceExit:0,status:mode==='verify-committed'?'CLEAN':'STAGED_NEW_CONFORMANCE_ONLY'}));
}else throw new Error('Reporting modes only: seal / verify-staged / verify-committed');
