// Read-only correction evidence verification. Never reruns a native witness.
import fs from 'node:fs';
import path from 'node:path';
import assert from 'node:assert/strict';
import {fileURLToPath} from 'node:url';
import {root,evidence,baseline,productionBaseline,read,json,record,check,git,str,preservedR2,hash} from './common.mjs';
import {packageFiles,checkPackage} from '../mo1307-phase1/package.mjs';
import {checkSecurity} from './check-security.mjs';

function descriptors(value){
 if(!value||typeof value!=='object')return;
 if(typeof value.path==='string'&&Number.isInteger(value.byteLength)&&typeof value.sha256==='string'){check(value);return;}
 for(const child of Object.values(value))descriptors(child);
}
export function checkEvidence(){
 const findings=[];
 assert.equal(str('branch','--show-current'),'main');
 git('merge-base','--is-ancestor',baseline,'HEAD');
 git('merge-base','--is-ancestor',productionBaseline,'HEAD');
 const old=read(evidence+'/oracle/c3rb-windows-inspect.ps1');
 assert.deepEqual(old,git('show',productionBaseline+':repositories/memoryos-readiness/helpers/windows-inspect.ps1'));
 const current=read('repositories/memoryos-readiness/helpers/windows-inspect.ps1').toString('utf8');
 const start=current.indexOf('# Closed response shapes only.'),end=current.indexOf('# Fixed Win32 signatures');
 assert.ok(start>0&&end>start);
 assert.equal((current.slice(0,start)+current.slice(end)).replace('(Encode-Response $response)','(Encode-Value $response)'),old.toString('utf8'));
 descriptors(json(evidence+'/source-equivalence.json'));findings.push('Exact source recovery; only closed writer additions and one response call');
 const productChanges=str('diff','--name-only',productionBaseline,'--','repositories/memoryos-readiness').split('\n').filter(Boolean).sort();
 assert.deepEqual(productChanges,['distribution-manifest.json','helpers/windows-inspect.ps1','sbom.spdx.json'].map(p=>'repositories/memoryos-readiness/'+p).sort());
 const pkg=checkPackage();assert.equal(pkg.members,89);assert.equal(pkg.contractMembers,53);assert.equal(pkg.externalProductionDependencies,0);
 const preserved=json(evidence+'/preservation.json');
 assert.deepEqual(preservedR2().map(m=>m.path).sort(),preserved.R2.members.map(m=>m.path).sort());descriptors(preserved.R2.members);
 const args=['-c','safe.directory='+preserved.r3a.worktree,'-C',preserved.r3a.worktree];
 assert.equal(str(...args,'rev-parse','HEAD'),preserved.r3a.HEAD);
 assert.equal(git(...args,'status','--porcelain=v1','--untracked-files=all').toString('utf8'),preserved.r3a.status);
 findings.push('15 R2 files preserved; r3a HEAD and dirty status preserved; history not rewritten');
 const serializer=json(evidence+'/serialization/attempt1/receipt.json');
 assert.equal(serializer.result,'PASS');assert.equal(serializer.expectedCases,90);assert.equal(serializer.executedCases,90);assert.equal(serializer.passedCases,90);assert.equal(serializer.failedCases,0);assert.equal(serializer.nativeHelperLaunches,0);assert.deepEqual(serializer.unexecuted,[]);descriptors(serializer);
 assert.equal(serializer.cases.length,90);assert.equal(new Set(serializer.cases.map(r=>r.id)).size,90);
 const planned=json(evidence+'/serialization/attempt1/campaign.json').cases;assert.deepEqual(serializer.cases.map(r=>r.id),planned.map(r=>r.id));
 for(const [index,row] of serializer.cases.entries()){
  const detail=json(row.receipt.path);assert.equal(detail.result,'PASS');assert.equal(detail.id,row.id);assert.equal(detail.expectedFallback,planned[index].expectedFallback);descriptors(detail);
  const oldFrame=read(detail.observed.oracle.path),newFrame=read(detail.observed.candidate.path);assert.deepEqual(oldFrame,newFrame);assert.equal(hash(newFrame),detail.independentExpected.sha256);assert.equal(newFrame.length,detail.independentExpected.byteLength);assert.equal(newFrame.readUInt32BE(0),newFrame.length-4);assert.equal(newFrame.at(-1),10);assert.ok(newFrame.length<=16777216);
  const value=JSON.parse(newFrame.subarray(4));assert.equal(value.code,detail.independentExpected.code);assert.equal(value.status,detail.independentExpected.status);if(detail.expectedFallback)assert.equal(value.code,'MO1307_RESOURCE_LIMIT');
 }
 findings.push('90 exact complete-frame serializer comparisons and independent oracles');
 const security=checkSecurity();assert.equal(security.result,'PASS');findings.push('44 native security pairs / 88 executions; exact frames and native observations');
 const expected={cheap:null,package:8,'phase1-native':25,phase2c:219,phase2d:58,vectors:null};
 for(const [group,count] of Object.entries(expected)){
  const base=evidence+'/regressions/'+group,receipt=json(base+'/receipt.json');assert.equal(receipt.result,'PASS');assert.equal(receipt.group,group);assert.equal(receipt.sourcesUnchanged,true);assert.equal(receipt.expectedTests,count);
  if(group==='vectors')assert.equal(receipt.exactVectors,16);
  for(const command of receipt.commands)assert.equal(command.result,'PASS');descriptors(receipt);descriptors(json(base+'/inputs-before.json'));assert.deepEqual(json(base+'/inputs-before.json'),json(base+'/inputs-after.json'));
 }
 findings.push('Original package/native/Phase2C/Phase2D regressions and16 vectors');
 const perf=json(evidence+'/performance/receipt.json');assert.equal(perf.result,'PASS');assert.equal(perf.sourceBindingsUnchanged,true);assert.equal(perf.serialization.length,12);assert.equal(perf.productExecutions,2);assert.equal(perf.productRows.length,2);assert.equal(perf.retries,0);assert.equal(perf.certification,false);descriptors(perf);
 const perfPlan=json(evidence+'/performance/campaign.json');assert.deepEqual(perfPlan.serialization.order,['c3rb','candidate','candidate','c3rb','c3rb','candidate']);assert.deepEqual(perfPlan.serialization.workloads,['ready','mo1306']);
 assert.deepEqual(perf.serialization.map(r=>[r.case,r.side]),['ready','mo1306'].flatMap(name=>perfPlan.serialization.order.map(side=>[name,side])));assert.deepEqual(perf.comparison.map(r=>r.case),['ready','mo1306']);assert.deepEqual(perf.productRows.map(r=>r.case),['ready','mo1306']);
 for(const row of perf.comparison){
  const samples=side=>perf.serialization.filter(r=>r.case===row.case&&r.side===side).map(r=>{assert.equal(r.exactFrame,true);assert.ok(Number.isFinite(r.elapsedMs)&&r.elapsedMs>0);return r.elapsedMs;}).sort((a,b)=>a-b);
  const old=samples('c3rb'),next=samples('candidate');assert.equal(old.length,3);assert.equal(next.length,3);assert.equal(row.baselineMedianMs,old[1]);assert.equal(row.candidateMedianMs,next[1]);assert.equal(row.reductionPercent,100*(1-next[1]/old[1]));assert.ok(next[1]<=old[1]*0.9);assert.equal(row.result,'PASS');
 }
 for(const row of perf.productRows){assert.equal(row.result,'PASS');assert.ok(row.exchangeMs<5000);assert.ok(row.helperActiveMs<5000);assert.equal(row.snapshot.cleanupConfirmed,true);assert.equal(row.snapshot.helpers,1);assert.equal(row.snapshot.workers,0);}
 findings.push('Fixed12 serialization measurements and2 product witnesses under unchanged limits');
 const refresh=json(evidence+'/package/pass-1/receipt.json');assert.equal(refresh.result,'PASS');descriptors(refresh);
 const impact=json(evidence+'/certification-impact.json');assert.equal(impact.certification,false);assert.equal(impact.phase3A.status,'FRESH_INSTALLED_CERTIFICATION_REQUIRED');assert.equal(impact.phase3B.status,'TARGETED_REFRESH_REQUIRED');assert.equal(impact.phase3C.status,'TARGETED_REFRESH_REQUIRED');
 return {kind:'MO1307SerializationCorrectionEvidenceCheck',version:'1.0.0',result:'PASS',findings,package:pkg,helper:record('repositories/memoryos-readiness/helpers/windows-inspect.ps1'),packageMembers:packageFiles.length,certification:false};
}
if(path.resolve(process.argv[1]??'')===fileURLToPath(import.meta.url)){
 try{const result=checkEvidence();console.log(JSON.stringify(result));}catch(error){console.error(JSON.stringify({result:'FAIL',failure:{message:error.message,stack:error.stack}}));process.exitCode=1;}
}
