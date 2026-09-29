// Offline evidence closure only: no helper execution, package regeneration or source-worktree mutation.
import fs from 'node:fs';
import path from 'node:path';
import assert from 'node:assert/strict';
import {spawnSync} from 'node:child_process';
import {performance} from 'node:perf_hooks';
import {fileURLToPath} from 'node:url';
import {root,evidence,baseline,commitSubject,read,json,record,check,write,git,str,blobs,hash} from './common.mjs';
import {packageFiles} from '../mo1307-phase1/package.mjs';
import {decodeHelperRequest,encodeHelperResponse,decodeHelperResponse} from '../../../memoryos-readiness/src/helper-protocol.mjs';

const C3RB='defe93989efc6501b1a730b82e79e705884b269b';
const BASELINE='1e78a9a963ea945847a9192f8ec3a9ce2b4e7cc5';
const BASELINE_PARENT='6d444e323f8048712908eaff22712eeac8a4e6b3';
const toolRoot='repositories/cca-conformance/tools/mo1307-helper-deadline-uncensored';
const report='docs/mo1307-helper-deadline-uncensored.md';
const historicalTrees=['characterization','design'].flatMap(s=>[
  'repositories/cca-conformance/evidence/mo1307/helper-deadline-'+s,
  'repositories/cca-conformance/tools/mo1307-helper-deadline-'+s
]);
const python='C:/Users/melsa/.cache/codex-runtimes/codex-primary-runtime/dependencies/python/python.exe';
const inventoryPath=evidence+'/changed-file-inventory.json';
const exists=p=>fs.existsSync(path.resolve(root,p));
const allowed=p=>p.startsWith(evidence+'/')||p.startsWith(toolRoot+'/')||p===report||p==='.gitattributes';
const normalized=p=>path.resolve(root,p);
const inEvidence=p=>normalized(p).startsWith(normalized(evidence)+path.sep);
const walk=p=>fs.readdirSync(normalized(p)).sort().flatMap(n=>{
  const q=p+'/'+n,st=fs.lstatSync(normalized(q));
  assert.equal(st.isSymbolicLink(),false,q);
  return st.isDirectory()?walk(q):[q];
});
function emit(p,value){
  assert.ok(inEvidence(p)||path.isAbsolute(p),'Receipt output requires this evidence tree or an explicit absolute external path');
  const target=normalized(p);fs.mkdirSync(path.dirname(target),{recursive:true});
  fs.writeFileSync(target,JSON.stringify(value,null,2)+'\n',{flag:'wx'});
}
function baselineCheck(){
  assert.equal(baseline,BASELINE);assert.equal(str('branch','--show-current'),'main');
  assert.equal(str('rev-parse','HEAD'),BASELINE);
  assert.equal(str('show','-s','--format=%P',BASELINE),BASELINE_PARENT);
  assert.equal(str('show','-s','--format=%s',BASELINE),'docs(memoryos-1.3): design MO-1307 helper deadline correction');
}
function pinCheck(p){
  const bytes=fs.readFileSync(path.resolve(p.sourceRoot??root,p.path));
  assert.equal(bytes.length,p.byteLength,p.path);
  assert.equal(hash(bytes).replace(/^sha256:/,''),p.sha256.replace(/^sha256:/,''),p.path);
}
function nestedPins(value){
  let n=0;
  if(value&&typeof value==='object'){
    if(typeof value.path==='string'&&Number.isInteger(value.byteLength)&&typeof value.sha256==='string'&&/^(sha256:)?[a-f0-9]{64}$/.test(value.sha256)){pinCheck(value);n++;}
    for(const v of Object.values(value))n+=nestedPins(v);
  }
  return n;
}
export function productIntegrity(phase='CURRENT'){
  assert.equal(packageFiles.length,89);
  const names=packageFiles.map(p=>'repositories/memoryos-readiness/'+p),original=blobs(C3RB,names);
  const members=names.map((p,i)=>{assert.deepEqual(read(p),original[i],p);return record(p);});
  const helper=members.find(p=>p.path.endsWith('/helpers/windows-inspect.ps1'));
  assert.ok(helper);assert.equal(helper.byteLength,30210);
  assert.equal(helper.sha256,'sha256:35381850f1ef8c322e528156ebd8779071ad3288cdccd4d0ebab51ce6f9c6ac8');
  return {kind:'MO1307UncensoredHelperIntegrity',version:'1.0.0',result:'PASS',phase,capturedAtUtc:new Date().toISOString(),baseline,C3RB,members,shippedFiles:89,allExactC3RBBlobs:true,productionChanges:false,packageRegeneration:false,nativeExecutions:0};
}
export function historyIntegrity(){
  const tree=git('ls-tree','-r','--full-tree','-z',baseline,'--',...historicalTrees,'docs').toString('utf8').split('\0').filter(Boolean).map(s=>{
    const [meta,p]=s.split('\t'),[mode,type,blob]=meta.split(' ');return {mode,type,blob,path:p};
  }).filter(x=>historicalTrees.some(p=>x.path.startsWith(p+'/'))||/^docs\/mo1307.*\.md$/.test(x.path));
  assert.ok(tree.length>100);
  for(const prefix of historicalTrees)assert.deepEqual(walk(prefix).sort(),tree.filter(x=>x.path.startsWith(prefix+'/')).map(x=>x.path).sort(),prefix+' exact names');
  const bodies=blobs(baseline,tree.map(x=>x.path));
  const members=tree.map((x,i)=>{assert.equal(x.type,'blob');assert.deepEqual(read(x.path),bodies[i],x.path);return {...x,...record(x.path)};});
  return {kind:'MO1307UncensoredHelperHistoricalIntegrity',version:'1.0.0',result:'PASS',baseline,scope:'All prior helper-deadline characterization and design evidence/tools plus every baseline MO1307 Markdown authority/report. Exact baseline Git blobs; no historical evidence restamped.',members,unchanged:true,nativeExecutions:0};
}
function changedNames(){
  return [...new Set([...git('diff','--name-only','-z',baseline).toString('utf8').split('\0'),...git('ls-files','--others','--exclude-standard','-z').toString('utf8').split('\0')].filter(Boolean))].sort();
}
function inventoryRead(){
  const inventory=json(inventoryPath);assert.equal(inventory.baseline,baseline);assert.equal(inventory.commitSubject,commitSubject);
  assert.equal(new Set(inventory.members.map(x=>x.path)).size,inventory.members.length);
  for(const m of inventory.members){assert.ok(allowed(m.path),m.path);check(m);}
  check(inventory.validation);
  validation(inventory.validation.path);
  return [...inventory.members,record(inventoryPath)].sort((a,b)=>a.path.localeCompare(b.path,'en'));
}
function validation(p){
  assert.ok(inEvidence(p),'Validation must be a retained receipt in this evidence tree');
  const v=json(p);assert.equal(v.kind,'MO1307UncensoredHelperFinalValidation');assert.equal(v.result,'PASS');assert.equal(v.baseline,baseline);
  assert.equal(v.packageBuild,false);assert.equal(v.nativeExecutions,0);
  for(const m of v.sourceBindings)check(m);
  const ids=v.commands.map(x=>x.id);
  for(const id of ['evidence','package','workspace','diff','staged-diff'])assert.equal(ids.filter(x=>x===id).length,1,id);
  assert.equal(new Set(ids).size,ids.length);
  for(const [id,args] of Object.entries({evidence:[toolRoot+'/closure.mjs','check'],package:['repositories/cca-conformance/tools/mo1307-phase1/package.mjs','check'],workspace:['-B','tools/verify_workspace.py','--root','.'],diff:['diff','--check'],'staged-diff':['diff','--cached','--check']}))assert.deepEqual(v.commands.find(r=>r.id===id).args,args,id);
  for(const row of v.commands){assert.equal(row.result,'PASS');assert.equal(row.exit,0);assert.equal(row.error,null);check(row.stdout);check(row.stderr);}
  return record(p);
}

function sourcePreservation(){
  const before=json(evidence+'/source-before.json'),after=json(evidence+'/source-after.json');
  assert.equal(before.phase,'BEFORE');assert.equal(after.phase,'AFTER');
  for(const r of [before,after]){
    assert.equal(r.result,'PASS');assert.equal(r.baseline,baseline);assert.equal(r.allInventoriedFilesAndGitStatusUnchanged,true);assert.equal(r.sourceWorktreeWrites,false);
    assert.equal(r.sourceFilesChecked,37396);assert.equal(r.inputFilesChecked,128);
    for(const s of r.sources){assert.equal(s.filesChecked,s.fileCount);assert.equal(s.fileNamesUnchanged,true);assert.equal(s.allFilesUnchanged,true);assert.equal(s.gitMetadataAndStatusUnchanged,true);}
    for(const s of r.inputRoots){assert.equal(s.filesChecked,s.fileCount);assert.equal(s.fileNamesUnchanged,true);assert.equal(s.allFilesUnchanged,true);}
    nestedPins({inventory:r.inventory,priorAfter:r.priorAfter});
  }
  assert.deepEqual(before.sources,after.sources);assert.deepEqual(before.inputRoots,after.inputRoots);
  assert.equal(after.before.path,evidence+'/source-before.json');pinCheck(after.before);
  const inventory=json(after.inventory.path);
  assert.equal(inventory.sources.reduce((n,s)=>n+s.files.length,0),37396);
  assert.equal(inventory.inputRoots.reduce((n,s)=>n+s.files.length,0),128);
  for(const s of after.sources){
    const args=['-c','safe.directory='+s.root,'-C',s.root];
    assert.equal(str(...args,'rev-parse','HEAD'),s.head);
    assert.deepEqual(str(...args,'show','-s','--format=%P','HEAD').split(' '),s.parents);
    assert.equal(str(...args,'show','-s','--format=%s','HEAD'),s.subject);
    assert.equal(str(...args,'branch','--show-current'),s.branch);
    assert.equal(git(...args,'status','--porcelain=v1','--untracked-files=all').toString('utf8'),s.statusPorcelain);
  }
  return {result:'PASS',before:record(evidence+'/source-before.json'),after:record(evidence+'/source-after.json'),sourceFiles:37396,inputFiles:128,scope:'Byte-bound before/after full-inventory audits and current exact Git metadata/status; historical inventory itself checked against baseline Git bytes by history integrity.'};
}
function planCheck(){
  const plan=json(evidence+'/sample-plan.json');assert.equal(plan.baseline,baseline);
  assert.equal(plan.maximumExecutions,70);assert.deepEqual(plan.counts,{C:60,E:10});
  assert.equal(plan.retries,0);assert.equal(plan.replacements,0);assert.equal(plan.discardedSamples,0);assert.equal(plan.adaptiveExpansion,false);
  assert.deepEqual(plan.limits,{productMs:5000,engineeringGuardMs:20000,engineeringCleanupMs:2000,productionAggregateMs:20000,productionCliMs:30000,productionApiMs:10000,productionWorkerMs:10000});
  assert.equal(plan.order.length,70);assert.equal(new Set(plan.order.map(s=>s.sampleId)).size,70);
  for(const key of ['C','E'])assert.equal(plan.order.filter(r=>r.case===key).length,plan.counts[key]);
  assert.equal(plan.phase3AR,'BLOCKED');assert.equal(plan.productionChanges,false);assert.equal(plan.freezeChanges,false);assert.equal(plan.certification,false);
  nestedPins(plan);
  const previous=json('repositories/cca-conformance/evidence/mo1307/helper-deadline-characterization/sample-plan.json');
  assert.deepEqual(plan.cases,previous.cases.filter(c=>['C','E'].includes(c.id)));
  assert.deepEqual(plan.cases.map(c=>[c.id,c.fileCount,c.aggregateBytes,c.requestFrameBytes]),[['C',65,2004208,7570],['E',0,0,345]]);
  for(const c of plan.cases){const request=decodeHelperRequest(read(c.request.path));assert.equal(request.operation,c.operation);assert.equal(request.files.length,c.fileCount);}
  return plan;
}
function retainedPreflights(){
  const names=fs.readdirSync(normalized(evidence)).filter(n=>/^preflight-attempt-\d+\.json$/.test(n)).sort();
  const attempts=[];
  for(const name of names){
    const p=evidence+'/'+name,r=json(p);assert.ok(['MO1307UncensoredPreflightAttempt','MO1307UncensoredHarnessValidation'].includes(r.kind));assert.equal(r.nativeHelperExecutions,0);
    const number=Number(name.match(/\d+/)[0]),retainedDir=evidence+'/observer-preflight'+(number===1?'':'-'+number);
    const retained=[...(r.retainedSources??[]),...walk(retainedDir).filter(p=>p.endsWith('.source')).map(p=>record(p))];
    function historicalPins(value){
      if(value&&typeof value==='object'){
        if(typeof value.path==='string'&&Number.isInteger(value.byteLength)&&typeof value.sha256==='string'){
          const saved=retained.find(s=>s.path.endsWith('/'+path.basename(value.path)+'.source')&&s.byteLength===value.byteLength&&s.sha256===value.sha256);
          pinCheck(saved??value);
        }
        for(const v of Object.values(value))historicalPins(v);
      }
    }
    historicalPins(r);
    for(const row of r.ready?[{ready:r.ready}]:(r.checks??[]).filter(c=>c.ready)){
      const ready=json(row.ready.path);assert.equal(ready.productProcessesLaunched,0);historicalPins(ready);
    }
    attempts.push({receipt:record(p),result:r.result,nativeHelperExecutions:0,scope:'Engineering preflight only; excluded from campaign sample/outcome counts'});
  }
  return attempts;
}
function harnessCheck(){
  const r=json(evidence+'/harness-validation.json');assert.equal(r.kind,'MO1307UncensoredHarnessValidation');assert.equal(r.result,'PASS');assert.equal(r.nativeHelperExecutions,0);nestedPins(r);
  for(const row of r.checks)assert.equal(row.result,'PASS');
  const byName=name=>{const rows=r.checks.filter(x=>x.name===name);assert.equal(rows.length,1,name);return rows[0];};
  assert.equal(byName('ordinary_success_requires_owner_closure_and_quiescence').snapshot.transportCleanupConfirmed,true);
  assert.equal(byName('missing_quiescence_is_not_success').snapshot.transportCleanupConfirmed,false);
  const observer=byName('native_observer_startup_and_normal_close_without_helpers');assert.equal(observer.observerResult.code,0);assert.equal(observer.observerResult.signal,null);assert.equal(observer.observerResult.stderr,'');
  const ready=json(observer.ready.path);assert.equal(ready.productProcessesLaunched,0);nestedPins(ready);
  const guard=byName('real_20000ms_guard_terminates_owned_double_and_late_completion_cannot_restore_success');assert.equal(guard.nativeHelpers,0);assert.equal(guard.snapshot.terminalCode,'ENGINEERING_GUARD_EXCEEDED');assert.equal(guard.snapshot.completedAt,null);assert.ok(guard.snapshot.terminalAt-guard.snapshot.origin>=20000);near(guard.snapshot.cleanupDeadline-guard.snapshot.terminalAt,2000,'cleanup allowance');
  return {result:'PASS',receipt:record(evidence+'/harness-validation.json'),checks:r.checks.length,nativeHelperExecutions:0};
}

const near=(actual,expected,label)=>assert.ok(Number.isFinite(actual)&&Number.isFinite(expected)&&Math.abs(actual-expected)<1e-7,label+': '+actual+' != '+expected);
function nativeObservation(r){
  if(r.nativeObserver===null){
    assert.notEqual(r.result,'QUALIFYING_COMPLETION');assert.ok(['CHARACTERIZATION_DEFECT','ENGINEERING_GUARD_EXCEEDED'].includes(r.classification));assert.equal(r.nativeSummary,null);
    assert.equal(r.engineeringCleanupConfirmed,false);return null;
  }
  const native=json(r.nativeObserver.path);assert.equal(native.sampleId,r.sampleId);assert.equal(native.requestedHelperPid,r.pid);
  assert.equal(native.productProcessesLaunched,0);assert.equal(native.processTerminationPerformed,false);assert.equal(native.completeDescendantCoverageEstablished,false);
  const helpers=native.lifetimes.filter(l=>l.role==='helper'),consoles=native.lifetimes.filter(l=>l.role==='console_host'),unexpected=native.lifetimes.filter(l=>l.role==='unexpected_descendant');
  assert.equal(helpers.length+consoles.length+unexpected.length,native.lifetimes.length);
  const allSignaled=native.lifetimes.length>0&&native.lifetimes.every(l=>l.signaledAt!==null);
  const proof=helpers.length===1&&consoles.length===1&&allSignaled&&native.identityFailures.length===0;
  assert.equal(native.observedHelperCount,helpers.length);assert.equal(native.observedConsoleHostCount,consoles.length);
  assert.equal(native.allObservedObjectsSignaled,allSignaled);assert.equal(native.externalConsoleExitProof,proof);
  assert.equal(native.unexpectedProcessTopology,unexpected.length>0||consoles.length>1);
  assert.deepEqual(r.nativeSummary,{helperCount:helpers.length,consoleCount:consoles.length,allSignaled,unexpectedChildren:unexpected.map(l=>l.identity),completeDescendantCoverage:false,externalConsoleExitProof:proof,identityFailureCount:native.identityFailures.length});
  for(const life of native.lifetimes){
    const born=BigInt(life.identity.creationTime100ns),exit=BigInt(life.nativeTimes.exitTime100ns);
    assert.equal(life.identity.creationTime100ns,life.nativeTimes.creationTime100ns);assert.ok(born>0n);assert.ok(exit===0n||exit>=born);
    if(life.signaledAt!==null){assert.ok(exit>0n);assert.ok(life.firstObservedAt.qpc<=life.signaledAt.qpc&&life.signaledAt.qpc<=native.finishedAt.qpc);}
    if(life.role==='helper'){
      assert.equal(life.identity.pid,r.pid);assert.equal(life.identity.executable.toLowerCase(),'c:\\windows\\system32\\windowspowershell\\v1.0\\powershell.exe');assert.equal(life.parentIdentity,null);
      assert.ok(born>=BigInt(native.preparedAt.systemTime100ns));
    }else if(life.role==='console_host'){
      assert.equal(life.identity.executable.toLowerCase(),'c:\\windows\\system32\\conhost.exe');
      const parent=helpers.find(h=>h.identity.pid===life.parentIdentity.pid);assert.ok(parent);assert.deepEqual(life.parentIdentity,parent.identity);
      assert.ok(born>=BigInt(parent.identity.creationTime100ns));
      const parentExit=BigInt(parent.nativeTimes.exitTime100ns);if(parentExit!==0n)assert.ok(born<=parentExit);
    }
    near(life.cpuMs,Number(BigInt(life.nativeTimes.kernelTime100ns)+BigInt(life.nativeTimes.userTime100ns))/10000,'native CPU');
  }
  return native;
}
function campaignCheck(plan){
  const campaign=json(evidence+'/campaign.json');assert.equal(campaign.kind,'MO1307UncensoredCampaign');assert.equal(campaign.baseline,baseline);
  assert.ok(Date.parse(json(evidence+'/integrity-before.json').capturedAtUtc)<=Date.parse(campaign.startedAtUtc));
  assert.ok(Date.parse(json(evidence+'/integrity-after.json').capturedAtUtc)>=Date.parse(campaign.endedAtUtc));
  assert.ok(Date.parse(json(evidence+'/source-before.json').capturedAtUtc)<=Date.parse(campaign.startedAtUtc));
  assert.ok(Date.parse(json(evidence+'/source-after.json').capturedAtUtc)>=Date.parse(campaign.endedAtUtc));
  assert.ok(['COMPLETE','STOPPED'].includes(campaign.result));nestedPins(campaign);
  assert.equal(campaign.maximum,plan.maximumExecutions);assert.equal(campaign.retries,0);assert.equal(campaign.replacements,0);assert.equal(campaign.discardedSamples,0);assert.equal(campaign.adaptiveExpansion,false);
  assert.equal(campaign.sourceIntegrityUnchanged,true);assert.equal(campaign.productionChanges,false);assert.equal(campaign.productionDeadlineChanged,false);assert.equal(campaign.certification,false);assert.equal(campaign.fileContentsLogged,false);
  assert.equal(campaign.actualHelperExecutions,campaign.launches.length);assert.ok(campaign.actualHelperExecutions<=plan.maximumExecutions);
  assert.equal(campaign.completedSampleReceipts,campaign.samples.length);assert.equal(campaign.samples.length,campaign.launches.length,'Every launched helper requires a retained sample receipt');
  assert.deepEqual(campaign.samples.map(r=>r.sampleId),plan.order.slice(0,campaign.samples.length).map(r=>r.sampleId));
  assert.deepEqual(campaign.launches.map(r=>r.sampleId),campaign.samples.map(r=>r.sampleId));
  if(campaign.result==='COMPLETE'){assert.equal(campaign.samples.length,plan.order.length);assert.equal(campaign.stopReason,null);}else assert.notEqual(campaign.stopReason,null);
  const actualReceiptPaths=walk(evidence+'/samples').filter(p=>p.endsWith('/receipt.json')).sort();
  assert.deepEqual(actualReceiptPaths,campaign.samples.map(r=>r.receipt.path).sort(),'No omitted sample receipts');
  const samples=[],counts={C:0,E:0,withinProduct:0,beyondProduct:0,engineeringGuardExceeded:0,characterizationDefects:0};
  for(const [index,row] of campaign.samples.entries()){
    const r=json(row.receipt.path),expected=plan.order[index],c=plan.cases.find(v=>v.id===r.case),request=decodeHelperRequest(read(c.request.path));
    for(const key of ['ordinal','sampleId','case'])assert.equal(r[key],expected[key]);assert.equal(row.result,r.result);assert.equal(row.classification,r.classification);nestedPins(r);
    assert.deepEqual(r.request,c.request);assert.equal(r.inputIdentity,'EXACT_RETAINED_ROOTS_DESCRIPTORS_ORDER_HASHES');
    assert.equal(r.spawnCount,1);assert.equal(r.pid,campaign.launches[index].pid);assert.equal(r.snapshot.launches,1);
    assert.equal(r.helperCopy,false);assert.equal(r.productionChanges,false);assert.equal(r.productExecutionResult,false);assert.equal(r.certification,false);assert.equal(r.fileContentsLogged,false);
    assert.equal(r.completeDescendantCoverageEstablished,false);
    assert.match(r.response.sha256,/^sha256:[a-f0-9]{64}$/);assert.ok(Number.isSafeInteger(r.response.byteLength)&&r.response.byteLength>=0&&r.response.byteLength<=16777216);
    assert.deepEqual(Object.keys(r.response).sort(),['byteLength','sha256']);
    assert.equal(r.snapshot.mode,'ENGINEERING_OBSERVATION_ONLY');assert.equal(r.snapshot.origin,r.times.origin);
    assert.ok(r.times.exchangeBegin<=r.times.origin&&r.times.origin<=r.times.spawnEntered&&r.times.spawnEntered<=r.times.spawnReturned);
    near(r.transportSettlementMs,r.times.transportSettled-r.times.origin,'transport settlement');
    const native=nativeObservation(r);
    counts[r.case]++;
    if(r.result==='QUALIFYING_COMPLETION'){
      assert.equal(r.error,null);assert.equal(r.validation.protocol,true);assert.equal(r.validation.exactInputBytes,true);assert.equal(r.validation.responseStatus,r.case==='C'?'OK':'ABSENT');
      assert.equal(r.validation.files.length,request.files.length);assert.deepEqual(r.validation.files.map(v=>v.id),request.files.map(v=>v.id));
      for(const file of r.validation.files){const descriptor=request.files.find(d=>d.id===file.id);assert.equal(path.resolve(file.input.path),path.resolve(c.root,...descriptor.path.split('/')));pinCheck(file.input);assert.equal(file.byteLength,file.input.byteLength);assert.equal(file.sha256,file.input.sha256);assert.ok(file.identity&&typeof file.identity==='object');}
      assert.equal(r.snapshot.terminalCode,null);assert.equal(r.snapshot.transportCleanupConfirmed,true);assert.equal(r.transportNativeConsoleProof,true);assert.equal(r.engineeringCleanupConfirmed,true);
      assert.equal(native.result,'OBSERVED');assert.equal(native.observedHelperCount,1);assert.equal(native.observedConsoleHostCount,1);assert.equal(native.allObservedObjectsSignaled,true);assert.equal(native.externalConsoleExitProof,true);assert.equal(native.unexpectedProcessTopology,false);assert.deepEqual(native.identityFailures,[]);
      assert.equal(native.lifetimes.length,2);for(const life of native.lifetimes)assert.notEqual(life.signaledAt,null);
      assert.deepEqual(r.pipes,{stdin:true,stdout:true,stderr:true});assert.equal(r.stderrBytes,0);assert.equal(r.times.exited.code,0);assert.equal(r.times.exited.signal,null);assert.equal(r.times.closed.code,0);assert.equal(r.times.closed.signal,null);
      near(r.wholeLifecycleMs,r.snapshot.completedAt-r.snapshot.origin,'whole lifecycle');assert.ok(r.wholeLifecycleMs>=0&&r.wholeLifecycleMs<=plan.limits.engineeringGuardMs);
      assert.equal(r.engineeringGuardClassification,'SUCCESSFUL_COMPLETION_WITHIN_ENGINEERING_GUARD');
      if(r.wholeLifecycleMs<=plan.limits.productMs){counts.withinProduct++;assert.equal(r.classification,'WITHIN_PRODUCT_BOUND');assert.equal(r.productClassification,'WITHIN_PRODUCT_BOUND');assert.equal(r.productCounterfactual,null);}
      else {counts.beyondProduct++;assert.equal(r.classification,'SUCCESSFUL_COMPLETION_BEYOND_PRODUCT_BOUND');assert.equal(r.productClassification,'PRODUCT_DEADLINE_EXCEEDED');assert.equal(typeof r.productCounterfactual,'string');}
    }else{
      assert.equal(index,campaign.samples.length-1,'Campaign must stop at its first nonqualifying sample');assert.equal(campaign.result,'STOPPED');
      assert.equal(r.productClassification,'NO_SUCCESS_CLASSIFICATION');
      if(r.classification==='ENGINEERING_GUARD_EXCEEDED'){counts.engineeringGuardExceeded++;assert.equal(r.snapshot.terminalCode,'ENGINEERING_GUARD_EXCEEDED');assert.ok(r.snapshot.terminalAt-r.snapshot.origin>=plan.limits.engineeringGuardMs);}
      else {counts.characterizationDefects++;assert.equal(r.classification,'CHARACTERIZATION_DEFECT');}
    }
    samples.push(r);
  }
  const rpc=json(evidence+'/observer-rpc.json');nestedPins(rpc);assert.equal(rpc.fileContentsLogged,false);
  if(exists(evidence+'/observer/receipt.json')){
    const observer=json(evidence+'/observer/receipt.json');nestedPins(observer);
    assert.equal(observer.productProcessesLaunched,0);assert.equal(observer.processTerminationPerformed,false);
    assert.deepEqual(observer.completedSamples.map(r=>r.sampleId),campaign.samples.slice(0,observer.completedSamples.length).map(r=>r.sampleId));
    if(campaign.result==='COMPLETE'){assert.equal(observer.completedSamples.length,campaign.samples.length);assert.equal(observer.result,'OBSERVED');assert.equal(observer.failure,null);}
  }else assert.equal(campaign.result,'STOPPED','Missing observer receipt is a retained campaign defect, never successful completion');
  if(campaign.result==='COMPLETE'){assert.equal(rpc.exit.code,0);assert.equal(rpc.exit.signal,null);}
  return {result:'PASS',campaignResult:campaign.result,planned:plan.counts,executed:campaign.samples.length,unexecuted:plan.order.length-campaign.samples.length,counts,samples,receipt:record(evidence+'/campaign.json'),scope:'Source-bound transport/codec proof and input digests; raw response contents intentionally were not logged.'};
}
function summaryCheck(actual,values){
  const sorted=[...values].sort((a,b)=>a-b),n=values.length;assert.equal(actual.n??actual.count,n);assert.deepEqual(actual.raw,values);
  if(n===0){assert.equal(actual.min,null);assert.equal(actual.max,null);assert.equal(actual.median,null);}
  else {near(actual.min,sorted[0],'minimum');near(actual.max,sorted.at(-1),'maximum');near(actual.median,n%2?sorted[(n-1)/2]:(sorted[n/2-1]+sorted[n/2])/2,'median');}
}
function decisionCheck(campaign){
  const plan=json(evidence+'/sample-plan.json'),stats=json(evidence+'/statistics.json'),decision=json(evidence+'/decision.json'),samples=campaign.samples,qualifying=samples.filter(s=>s.result==='QUALIFYING_COMPLETION');
  const names=['inference-method','request-identities','runtime-environment','campaign-start','statistics','raw-sample-ledger','response-classification','observer-overhead','u-analysis','v-analysis','q-analysis','r-calculation','h-rounding','aggregate-analysis','cli-analysis','security-analysis','recertification-impact','authority-binding','private-sequence-transfer','failure-analysis','decision'];
  let boundPins=0;for(const name of names)boundPins+=nestedPins(json(evidence+'/'+name+'.json'));
  assert.equal(stats.baseline,baseline);assert.equal(stats.sampleCount,samples.length);assert.deepEqual(stats.plannedCounts,plan.counts);
  assert.deepEqual(stats.executedCounts,{C:campaign.counts.C,E:campaign.counts.E});assert.equal(stats.qualifyingCount,qualifying.length);
  assert.equal(stats.withinProductBoundCount,campaign.counts.withinProduct);assert.equal(stats.beyondProductBoundCount,campaign.counts.beyondProduct);
  assert.equal(stats.engineeringGuardExceedanceCount,campaign.counts.engineeringGuardExceeded);assert.equal(stats.unexpectedSemanticFailureCount,samples.filter(s=>s.result==='PROTOCOL_OR_SEMANTIC_MISMATCH').length);
  assert.deepEqual(stats.unexecuted,plan.order.slice(samples.length));for(const key of ['retries','replacements','discardedSamples'])assert.equal(stats[key],0);assert.equal(stats.adaptiveExpansion,false);assert.equal(stats.historicalPooling,false);assert.equal(stats.nativeExecutionsByAnalysis,0);
  assert.deepEqual(stats.byCase.map(r=>r.case),['C','E']);
  for(const row of stats.byCase){assert.equal(row.planned,plan.counts[row.case]);assert.equal(row.executed,samples.filter(r=>r.case===row.case).length);const values=qualifying.filter(r=>r.case===row.case).map(r=>r.wholeLifecycleMs);assert.equal(row.qualifying,values.length);summaryCheck(row.successfulCompletionMs,values);}
  assert.equal(stats.rawLedger.length,samples.length);
  for(const [i,row] of stats.rawLedger.entries()){
    const sample=samples[i];for(const key of ['sampleId','case','result','classification'])assert.equal(row[key],sample[key]);
    assert.equal(row.transportQuiescentDurationMs,sample.wholeLifecycleMs);assert.equal(row.qualifyingSuccessfulCompletion,sample.result==='QUALIFYING_COMPLETION');assert.deepEqual(row.response,sample.response);assert.deepEqual(row.nativeObserver,sample.nativeObserver);
  }
  const ledger=json(evidence+'/raw-sample-ledger.json');assert.deepEqual(ledger.rows,stats.rawLedger);assert.deepEqual(ledger.unexecuted,stats.unexecuted);assert.equal(ledger.noFileContents,true);
  const classification=json(evidence+'/response-classification.json'),failed=json(classification.sample.path),request=decodeHelperRequest(read(failed.request.path));
  assert.equal(classification.result,'VALID_MATCHING_ERROR_FRAME_UNEXPECTED_SEMANTIC_RESULT');assert.deepEqual(classification.responseIdentity,failed.response);assert.deepEqual(classification.request,failed.request);
  assert.equal(classification.nativeExecutions,0);assert.equal(classification.fileContentsLogged,false);assert.equal(classification.productionChanges,false);assert.equal(classification.certification,false);
  const codes=['MO1307_INPUT','MO1307_FILESYSTEM_BOUNDARY','MO1307_RESOURCE_LIMIT','MO1307_INTERNAL'];
  const candidates=codes.map(code=>{
    const frame=encodeHelperResponse({code,files:[],kind:'MemoryOSReadinessHelperResponse',operation:request.operation,roots:[],sequence:request.sequence,session:request.session,status:'ERROR',version:'2.0.0'},request);
    assert.equal(decodeHelperResponse(frame,request).code,code);
    return {code,byteLength:frame.length,sha256:hash(frame),matchesRecordedResponse:frame.length===failed.response.byteLength&&hash(frame)===failed.response.sha256};
  });
  assert.deepEqual(classification.candidates,candidates);const matches=candidates.filter(r=>r.matchesRecordedResponse);assert.equal(matches.length,1);assert.equal(classification.identifiedCode,matches[0].code);assert.equal(classification.identifiedStatus,'ERROR');assert.equal(classification.expectedStatus,failed.case==='E'?'ABSENT':'OK');
  assert.equal(stats.malformedProtocolFramesEstablished,0);assert.equal(stats.inputOrSourceIntegrityFailuresEstablished,0);
  const matchedLedger=stats.rawLedger.find(r=>r.sampleId===failed.sampleId);assert.ok(matchedLedger);assert.equal(matchedLedger.decodedStatus,'ERROR');assert.equal(matchedLedger.decodedCode,matches[0].code);
  const transfer=json(evidence+'/private-sequence-transfer.json');assert.equal(transfer.nativeLaunches,0);assert.equal(transfer.rows.length,transfer.iterations);assert.equal(transfer.clockOverride,false);assert.equal(transfer.productionChanges,false);assert.equal(transfer.Q.numericBoundMs,null);
  for(const row of transfer.rows){const t=row.timestamps;near(row.beginMs,t.afterBegin-t.beforeBegin,'transfer begin');near(row.transportDecodeCloneMs,t.afterTransportDecodeClone-t.afterBegin,'transport decode');near(row.completeMs,t.afterComplete-t.afterTransportDecodeClone,'sequence complete');near(row.helperExitedMs,t.afterHelperExited-t.afterComplete,'helper exit admission');near(row.totalMeasuredTransferMs,t.afterHelperExited-t.beforeBegin,'total transfer');near(row.totalMeasuredTransferMs,row.beginMs+row.transportDecodeCloneMs+row.completeMs+row.helperExitedMs,'transfer sum');assert.equal(row.exactPrimaryFrame,true);assert.equal(row.actualSequenceMethods,true);assert.equal(row.defaultMonotonicClock,true);assert.equal(row.nativeLaunches,0);}
  for(const [key,value] of Object.entries(transfer.summary))summaryCheck(value,transfer.rows.map(r=>r[key]));
  const overhead=json(evidence+'/observer-overhead.json'),native=json(failed.nativeObserver.path),start=json(evidence+'/campaign-start.json'),observer=json(evidence+'/observer/receipt.json');
  assert.equal(overhead.result,'MEASURED_NOT_SUBTRACTED');assert.deepEqual(overhead.startupSnapshotCalibrationMs,start.observer.ready.calibration.map(r=>r.elapsedMs));near(overhead.startupCalibrationObserverCpuMs,start.observer.ready.calibrationObserverCpuMs,'startup CPU');near(overhead.observerTotalCpuAfterCalibrationMs,observer.observerCpuMsAfterCalibration,'observer CPU');
  const o=overhead.actualSample;near(o.controlWriteMs,failed.observerControlWriteMs,'control write');near(o.allSnapshotQueryMs,native.snapshotQueryMs,'snapshot work');near(o.inClockDiscoverySnapshotMs,native.discoverySnapshots.filter(x=>x.reason!=='FINAL_SETTLED').reduce((n,r)=>n+r.elapsedMs,0),'in-clock discovery');near(o.nativeObservationWorkMs,native.nativeObservationWorkMs,'native work');assert.equal(o.discoverySnapshotCount,native.discoverySnapshots.filter(r=>r.reason!=='FINAL_SETTLED').length);near(o.finalSnapshotMs,native.discoverySnapshots.find(r=>r.reason==='FINAL_SETTLED').elapsedMs,'final snapshot');
  assert.equal(decision.baseline,baseline);assert.ok(['BOUND_SELECTED','BOUND_NOT_ESTABLISHED','ENGINEERING_GUARD_EXCEEDED','CHARACTERIZATION_DEFECT'].includes(decision.result));
  assert.deepEqual(decision.counts,{plannedC:plan.counts.C,executedC:campaign.counts.C,plannedE:plan.counts.E,executedE:campaign.counts.E,qualifying:qualifying.length,beyond5000:campaign.counts.beyondProduct,guardExceedances:campaign.counts.engineeringGuardExceeded,unexpectedSemanticFailures:stats.unexpectedSemanticFailureCount,unexecuted:campaign.unexecuted,retries:0});
  assert.deepEqual(decision.currentLimits,{helperMs:5000,aggregateMs:20000,cliMs:30000,apiMs:10000,workerMs:10000,cleanupMs:2000});assert.equal(decision.engineeringGuardMs,20000);
  assert.equal(decision.phase3AR,'BLOCKED');assert.equal(decision.phase3BR,'UNCHANGED_ACCEPTED_C3RB_ONLY');assert.equal(decision.phase3CR,'UNCHANGED_ACCEPTED_C3RB_ONLY');
  for(const key of ['productionChanges','freezeChanges','packageRegeneration','versionChanges','certification','push','tag','phase3D'])assert.equal(decision[key],false);
  assert.equal(decision.nativeExecutionsByAnalysis,0);assert.equal(decision.nextTask.authorizationRequired,true);assert.equal(decision.nextTask.executedHere,false);assert.equal(decision.nextTask.automaticFollowup,false);assert.equal(decision.nextTask.productionCorrectionAuthorized,false);
  assert.equal(decision.claimType,json(plan.method.path).claimType);assert.equal(decision.iidExchangeability,'NOT_ESTABLISHED');
  // This actual retained campaign stopped on a semantic defect. Its descriptive
  // process duration is not admitted as a successful tolerance observation.
  assert.ok(campaign.counts.characterizationDefects>0);assert.equal(decision.result,'CHARACTERIZATION_DEFECT');assert.equal(decision.boundSelected,false);
  for(const key of ['U','V','Q','R','H'])assert.equal(decision[key],null);
  for(const key of ['u','v','q']){const a=json(evidence+'/'+key+'-analysis.json');assert.equal(a.valueMs,null);assert.equal(a.status,'NOT_ESTABLISHED');}
  const r=json(evidence+'/r-calculation.json'),h=json(evidence+'/h-rounding.json');assert.equal(r.formula,'R=U+V+Q');for(const key of ['U','V','Q','R'])assert.equal(r[key],null);assert.equal(h.formula,'H=500*ceil(R/500)');assert.equal(h.granularityMs,500);assert.equal(h.minimumExclusiveMs,5000);assert.equal(h.maximumInclusiveMs,20000);assert.equal(h.R,null);assert.equal(h.H,null);assert.equal(h.roundingApplied,false);
  assert.equal(decision.cleanup.transportCleanupConfirmed,samples.every(s=>s.snapshot.transportCleanupConfirmed));assert.equal(decision.cleanup.engineeringCleanupConfirmed,samples.every(s=>s.engineeringCleanupConfirmed));assert.equal(decision.cleanup.helperAndAttributableConsoleSignaled,samples.every(s=>s.nativeSummary?.allSignaled===true));assert.equal(decision.cleanup.completeDescendantCoverageEstablished,false);
  const diagnostic=json(evidence+'/failure-analysis.json');assert.equal(diagnostic.result,'REFUSAL_IDENTIFIED_CAUSE_NOT_ESTABLISHED');assert.equal(diagnostic.nativeHelperExecutions,0);assert.equal(diagnostic.executionContext.effectiveWindowsTokenCaptured,false);assert.equal(diagnostic.executionContext.equivalenceToAcceptedRunSecurityContext,'NOT_ESTABLISHED');assert.equal(diagnostic.nextDiagnosticProposal.executedHere,false);
  return {result:decision.result,decision:record(evidence+'/decision.json'),statistics:record(evidence+'/statistics.json'),identifiedResponse:matches[0].code,claimType:decision.claimType,U:null,V:null,Q:null,R:null,H:null,boundPinsChecked:boundPins};
}
export function checkEvidence(){
  baselineCheck();
  const before=json(evidence+'/integrity-before.json'),after=json(evidence+'/integrity-after.json');
  for(const r of [before,after]){assert.equal(r.result,'PASS');assert.equal(r.shippedFiles??r.count,89);assert.equal(r.members.length,89);assert.equal(r.baseline,baseline);assert.equal(r.C3RB??r.c3rb,C3RB);nestedPins(r.members);}
  assert.deepEqual(before.members,after.members);
  const product=productIntegrity(),history=historyIntegrity(),preservation=sourcePreservation(),campaign=campaignCheck(planCheck()),decision=decisionCheck(campaign),preflights=retainedPreflights(),harness=harnessCheck();
  const boundHistory=json(evidence+'/historical-binding.json');assert.deepEqual(boundHistory.members,history.members);
  const base=json(evidence+'/baseline.json');assert.equal(base.baseline,baseline);assert.equal(base.parent,BASELINE_PARENT);assert.equal(base.branch,'main');assert.equal(base.result,'PASS');nestedPins(base);
  const {samples,...campaignSummary}=campaign;
  return {kind:'MO1307UncensoredHelperOfflineCheck',version:'1.0.0',result:'PASS',baseline,product:{result:'PASS',files:product.members.length,before:record(evidence+'/integrity-before.json'),after:record(evidence+'/integrity-after.json')},history:{result:'PASS',files:history.members.length},preservation,campaign:campaignSummary,decision,preflights,harness,nativeExecutions:0,productionChanges:false,certification:false};
}
function prepareClosure(){
  baselineCheck();
  if(!exists(evidence+'/baseline.json'))write(evidence+'/baseline.json',{
    kind:'MO1307UncensoredBaseline',version:'1.0.0',result:'PASS',baseline,parent:BASELINE_PARENT,
    subject:str('show','-s','--format=%s',baseline),branch:'main',capturedAtUtc:new Date().toISOString(),
    initialCleanGate:{reportedBy:'Parent agent before task edits',independentlyRecreated:false},
    prelaunchIntegrity:record(evidence+'/integrity-before.json'),productionBytes:'EXACT_C3RB_89_MEMBERS',productionChanges:false
  });
  const history=historyIntegrity(),integrity=productIntegrity('AFTER');
  if(!exists(evidence+'/historical-binding.json'))write(evidence+'/historical-binding.json',history);
  else assert.deepEqual(json(evidence+'/historical-binding.json').members,history.members);
  if(!exists(evidence+'/integrity-after.json'))write(evidence+'/integrity-after.json',integrity);
  else assert.deepEqual(json(evidence+'/integrity-after.json').members,integrity.members);
  return {result:'PASS',baseline:record(evidence+'/baseline.json'),history:record(evidence+'/historical-binding.json'),integrity:record(evidence+'/integrity-after.json'),historicalFiles:history.members.length,shippedFiles:89};
}
function finalValidation(dir){
  baselineCheck();assert.ok(inEvidence(dir));assert.equal(exists(dir),false,'Every validation attempt needs a fresh named directory');
  prepareClosure();
  fs.mkdirSync(normalized(dir),{recursive:true});
  let sourceBindings=[];
  const commands=[];let failure=null;
  function run(id,exe,args){
    const start=performance.now(),r=spawnSync(exe,args,{cwd:root,windowsHide:true,encoding:null,timeout:120000,maxBuffer:16*1024*1024});
    for(const [suffix,bytes] of [['stdout.txt',r.stdout??Buffer.alloc(0)],['stderr.txt',r.stderr??Buffer.alloc(0)]])fs.writeFileSync(normalized(dir+'/'+id+'.'+suffix),bytes,{flag:'wx'});
    commands.push({id,exe,args,exit:r.status,error:r.error?.code??null,elapsedMs:performance.now()-start,stdout:record(dir+'/'+id+'.stdout.txt'),stderr:record(dir+'/'+id+'.stderr.txt'),result:r.status===0&&!r.error?'PASS':'FAIL'});
    assert.ifError(r.error);assert.equal(r.status,0,(r.stderr??Buffer.alloc(0)).toString());
  }
  try{
    sourceBindings=[...walk(toolRoot),report,'.gitattributes',...packageFiles.map(p=>'repositories/memoryos-readiness/'+p)].sort().map(p=>record(p));
    for(const p of walk(toolRoot).filter(p=>p.endsWith('.mjs')))run('syntax-'+path.basename(p),process.execPath,['--check',p]);
    for(const p of walk(toolRoot).filter(p=>p.endsWith('.py')))run('syntax-'+path.basename(p),python,['-B','-c','import ast,pathlib,sys; ast.parse(pathlib.Path(sys.argv[1]).read_text(encoding="utf-8"))',p]);
    run('evidence',process.execPath,[toolRoot+'/closure.mjs','check']);
    run('package',process.execPath,['repositories/cca-conformance/tools/mo1307-phase1/package.mjs','check']);
    run('workspace',python,['-B','tools/verify_workspace.py','--root','.']);
    run('diff','git',['diff','--check']);run('staged-diff','git',['diff','--cached','--check']);
    for(const m of sourceBindings)check(m);
  }catch(e){failure={message:e.message,stack:e.stack};}
  const value={kind:'MO1307UncensoredHelperFinalValidation',version:'1.0.0',result:failure?'FAIL':'PASS',baseline,failure,commands,sourceBindings,nativeExecutions:0,packageBuild:false,certification:false};
  write(dir+'/receipt.json',value);process.exitCode=failure?1:0;
  return {result:value.result,commands:commands.length,receipt:record(dir+'/receipt.json')};
}
function runCli(){
  assert.equal(process.version,'v24.21.0');assert.equal(process.platform,'win32');assert.equal(process.arch,'x64');
  assert.equal(hash(read(process.execPath)),'sha256:ba4e6d110e8c1592a1ecd390f6b05f3da124b13871a5be62b341a07a853c6c32');
  const mode=process.argv[2],tail=process.argv.slice(3),options={};
  assert.ok(['prepare','integrity-before','integrity-after','history','check','finalize','inventory','stage-check','postcommit'].includes(mode));
  assert.equal(tail.length%2,0);
  for(let i=0;i<tail.length;i+=2){assert.ok(['--output','--validation'].includes(tail[i]));assert.equal(Object.hasOwn(options,tail[i]),false);options[tail[i]]=tail[i+1];}
  const output=options['--output'];if(output)assert.ok(inEvidence(output)||path.isAbsolute(output));
  if(options['--validation'])assert.equal(mode,'inventory');
  let value;
  if(mode==='prepare'){
    assert.equal(output,undefined);value=prepareClosure();
  }else if(mode==='integrity-before'||mode==='integrity-after'){
    baselineCheck();value=productIntegrity(mode==='integrity-before'?'BEFORE':'AFTER');
    emit(output??evidence+'/'+mode+'.json',value);
  }else if(mode==='history'){
    baselineCheck();value=historyIntegrity();emit(output??evidence+'/historical-binding.json',value);
  }else if(mode==='check'){
    value=checkEvidence();if(output)emit(output,value);
  }else if(mode==='finalize'){
    value=finalValidation(output??evidence+'/final-validation/attempt-1');
  }else if(mode==='inventory'){
    baselineCheck();assert.equal(output,undefined);assert.equal(exists(inventoryPath),false,'Preserve earlier inventories; select the final validation before first sealing');
    const receipt=validation(options['--validation']??evidence+'/final-validation/attempt-1/receipt.json');
    const names=changedNames().filter(n=>n!==inventoryPath);for(const n of names)assert.ok(allowed(n),n);
    const inventory={kind:'MO1307UncensoredHelperChangedFileInventory',version:'1.0.0',baseline,commitSubject,members:names.map(n=>record(n)),validation:receipt,exclusions:['This inventory excludes itself; staged and committed exact bytes are checked separately.'],noFutureCommitSelfReference:true,productionChanges:false,certification:false};
    write(inventoryPath,inventory);value={result:'PASS',members:names.length,inventory:record(inventoryPath),validation:receipt};
  }else if(mode==='stage-check'){
    baselineCheck();const members=inventoryRead(),names=members.map(x=>x.path).sort();
    assert.deepEqual(str('diff','--cached','--name-only').split('\n').filter(Boolean).sort(),names);
    assert.equal(str('diff','--name-only'),'');assert.equal(str('ls-files','--others','--exclude-standard'),'');
    const staged=blobs('',names);names.forEach((p,i)=>assert.deepEqual(read(p),staged[i],p));
    git('diff','--cached','--check');value={kind:'MO1307UncensoredHelperStageCheck',result:'PASS',exactStagedBlobs:names.length,baseline};if(output)emit(output,value);
  }else{
    assert.equal(str('branch','--show-current'),'main');assert.equal(str('show','-s','--format=%P','HEAD'),baseline);
    assert.equal(str('show','-s','--format=%s','HEAD'),commitSubject);assert.equal(str('status','--porcelain=v1','--untracked-files=all'),'');
    const members=inventoryRead(),names=members.map(x=>x.path).sort();
    assert.deepEqual(str('diff-tree','--no-commit-id','--name-only','-r','HEAD').split('\n').filter(Boolean).sort(),names);
    const committed=blobs('HEAD',names);names.forEach((p,i)=>assert.deepEqual(read(p),committed[i],p));
    productIntegrity();historyIntegrity();git('diff','--check');git('diff','--cached','--check');
    value={kind:'MO1307UncensoredHelperPostcommit',result:'PASS',commit:str('rev-parse','HEAD'),parent:baseline,subject:commitSubject,exactCommittedBlobs:names.length,clean:true,productionChanges:false,certification:false};
    if(output){assert.ok(!inEvidence(output),'Postcommit output must be external/ignored to preserve a clean tracked tree');emit(output,value);assert.equal(str('status','--porcelain=v1','--untracked-files=all'),'');}
  }
  console.log(JSON.stringify(['integrity-before','integrity-after','history'].includes(mode)?{result:value.result,members:value.members.length,receipt:output??evidence+'/'+(mode==='history'?'historical-binding':mode)+'.json'}:value));
}
if(process.argv[1]&&path.resolve(process.argv[1])===fileURLToPath(import.meta.url))runCli();
