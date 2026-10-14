/** Recalculate bounded Layer A/B/D evidence from hashes, native rows and protocol proofs. */
import assert from 'node:assert/strict';
import {readFileSync,writeFileSync} from 'node:fs';
import {resolve} from 'node:path';
import {createHash} from 'node:crypto';
import {validateChunk,validateAdverse} from './sample-proof.mjs';
const root=resolve(import.meta.dirname,'../../../..');
const sha=b=>createHash('sha256').update(b).digest('hex');
const read=p=>JSON.parse(readFileSync(resolve(root,p)));
export function artifact(ref){const b=readFileSync(resolve(root,ref.path));assert.equal(b.length,ref.byteLength);assert.equal(sha(b),ref.sha256);return JSON.parse(b);}
const median=xs=>{const v=xs.slice().sort((a,b)=>a-b);return (v[Math.floor((v.length-1)/2)]+v[Math.floor(v.length/2)])/2;};
export function ordinary(path){
 const p=read(path);assert.equal(p.state,'PASS');assert.equal(p.methodologyVersion,'2.0.0');const plan=artifact(p.plan);
 assert.equal(p.mode,plan.layer);assert.equal(p.coldRequired,plan.cold);assert.equal(p.warmRequired,plan.warm);
 assert.deepEqual(p.completed.map(c=>c.id),plan.cases.slice().sort());assert.equal(p.totalCases,plan.cases.length);
 if(p.mode==='functional'){assert.equal(plan.cases.length,105);assert.equal(plan.cold,1);assert.equal(plan.warm,0);}else if(p.mode==='resource'){assert.ok(plan.cases.length<=20);assert.equal(plan.cold,10);assert.equal(plan.warm,20);const selection=artifact(plan.selection);assert.deepEqual(selection.vectors.map(v=>v.id),plan.cases);}
 else{assert.equal(p.mode,'extension');assert.ok(plan.extensionReason);assert.ok(plan.cases.length<=20&&plan.cold<=30&&plan.warm<=50);}
 const cat=read('repositories/cca-conformance/fixtures/mo1305-phase1/measurement/catalog.json').records;
 const maximum={workerYoungBytes:0,workerOldBytes:0,workerExternalBytes:0,parentHeapBytes:0,parentExternalBytes:0,processRssBytes:0,operationUs:0,earlyErrorBytes:0};
 const operations={},processes=new Set(),variance=[];let count=0;
 for(const entry of p.completed){
  const c=artifact(entry.samples),fixture=cat.find(x=>x.id===entry.id);assert.ok(fixture);artifact(fixture.fixture);assert.equal(c.fixtureSha256,fixture.fixtureSha256);
  assert.equal(c.records.length,plan.cold+plan.warm);validateChunk(c,p,artifact);
  for(const phase of ['cold','warm'])assert.deepEqual(c.records.filter(r=>r.phase===phase).map(r=>r.index),Array.from({length:phase==='cold'?plan.cold:plan.warm},(_,i)=>i));
  for(const run of c.runs){const id=run.pid+':'+run.processStartedUtcMs;assert.ok(!processes.has(id));processes.add(id);}
  for(const r of c.records){assert.equal(r.state,'PASS');assert.equal(r.status,fixture.expected.statusCode);assert.equal(r.responseSha256,fixture.expected.responseSha256);
   for(const key of ['workers','semanticOwners','connections','requestSlots','writeSlots'])assert.equal(r.parent.cleanup[key],0);
   assert.ok(r.parent.peak.workers<=1&&r.parent.peak.semanticOwners<=1);
   for(const [a,b] of [['workerYoungBytes','youngBytes'],['workerOldBytes','oldBytes'],['workerExternalBytes','externalBytes'],['parentHeapBytes','parentHeapBytes'],['parentExternalBytes','parentExternalBytes'],['processRssBytes','processRssBytes'],['operationUs','operationUs']])maximum[a]=Math.max(maximum[a],r.metrics[b]??0);
   maximum.parentHeapBytes=Math.max(maximum.parentHeapBytes,r.parent.peak.heapTotal);maximum.parentExternalBytes=Math.max(maximum.parentExternalBytes,r.parent.peak.external);maximum.processRssBytes=Math.max(maximum.processRssBytes,r.parent.peak.rss,r.native.peak.PeakWorkingSetSize);
   const op=operations[fixture.operation]??={requestBytes:0,responseBytes:0};op.responseBytes=Math.max(op.responseBytes,r.responseBytes);if(fixture.mechanism.startsWith('independent')||fixture.id==='maximum-permitted-headers')op.requestBytes=Math.max(op.requestBytes,r.bodyBytes);
   if(r.status>=400)maximum.earlyErrorBytes=Math.max(maximum.earlyErrorBytes,r.responseBytes);count++;
  }
  if(plan.warm>=20){const warm=c.records.filter(r=>r.phase==='warm'),values=warm.map(r=>r.metrics.operationUs??0);const reasons=[];
   if(median(values)>0&&Math.max(...values)>3*median(values))reasons.push('SEMANTIC_MAX_ABOVE_THREE_TIMES_MEDIAN');
   for(const key of ['operationUs','oldBytes','youngBytes','externalBytes','parentHeapBytes','parentExternalBytes','processRssBytes']){const early=median(warm.slice(0,10).map(r=>r.metrics[key]??0)),late=median(warm.slice(-10).map(r=>r.metrics[key]??0));if(early>0&&late>1.5*early)reasons.push('LATE_MEDIAN_GROWTH_'+key);}
   variance.push({case:entry.id,reasons,extensionRequired:reasons.length>0,operationMedianUs:median(values),operationMaxUs:Math.max(...values)});
  }
 }
 assert.equal(processes.size,plan.cases.length*(plan.cold+(plan.warm?1:0)));
 return {kind:'MemoryOSRESTBoundedOrdinaryValidation',state:'PASS',mode:p.mode,campaignId:p.campaignId,binding:p.binding,cases:p.completed.length,cold:p.completed.length*plan.cold,warm:p.completed.length*plan.warm,samples:count,processes:processes.size,maxima:maximum,operations,variance,extensionRequired:variance.some(x=>x.extensionRequired)};
}
export function adverse(path){
 const p=read(path);assert.equal(p.state,'PASS');assert.equal(p.methodologyVersion,'2.0.0');assert.ok(['adverse-functional','stress','stress-confirmation'].includes(p.mode));
 assert.ok(p.requiredMs>=3000&&p.requiredMs<=20000);assert.ok(p.requiredRepetitions>=1&&p.requiredRepetitions<=3);
 if(p.mode==='adverse-functional'){assert.equal(p.catalog.length,20);assert.equal(p.requiredMs,3000);assert.equal(p.requiredRepetitions,1);}else assert.ok(p.catalog.length<=10);
 assert.deepEqual(p.completed,p.catalog.flatMap(name=>Array.from({length:p.requiredRepetitions},(_,repeat)=>({name,repeat,state:'PASS'}))));
 const maxima={parentHeapBytes:0,parentExternalBytes:0,processRssBytes:0};let totalMs=0;
 for(const entry of p.completed){const row=read(path.replace(/index\.json$/u,entry.name+'-'+entry.repeat+'.json'));validateAdverse(row,p,artifact);assert.equal(row.state,'PASS');assert.equal(row.requiredMs,p.requiredMs);assert.ok(row.adverseElapsedMs>=p.requiredMs);totalMs+=row.adverseElapsedMs;
  for(const key of ['connections','requestSlots','writeSlots','workers','semanticOwners','bodyBuffers','bodyBufferBytes'])assert.equal(row.parent.cleanup[key],0);
  assert.ok(row.parent.peak.connections<=32&&row.parent.peak.workers<=1&&row.parent.peak.semanticOwners<=1&&row.parent.peak.requestSlots<=4&&row.parent.peak.writeSlots<=4);
  maxima.parentHeapBytes=Math.max(maxima.parentHeapBytes,row.parent.peak.heapTotal);maxima.parentExternalBytes=Math.max(maxima.parentExternalBytes,row.parent.peak.external);maxima.processRssBytes=Math.max(maxima.processRssBytes,row.parent.peak.rss,row.native.peak.PeakWorkingSetSize);
 }
 return {kind:'MemoryOSRESTBoundedAdverseValidation',state:'PASS',mode:p.mode,campaignId:p.campaignId,binding:p.binding,scenarios:p.catalog.length,repetitions:p.completed.length,totalAdverseMs:totalMs,maxima};
}
if(process.argv[1]&&resolve(process.argv[1])===resolve(import.meta.filename)){
 const result=process.argv[2]==='ordinary'?ordinary(process.argv[3]):adverse(process.argv[3]);writeFileSync(resolve(root,process.argv[4]),JSON.stringify(result));console.log(JSON.stringify(result));
}
