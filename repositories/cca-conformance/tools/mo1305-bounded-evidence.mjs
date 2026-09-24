/** Version 2 layers: recalculate bounded measurements instead of accepting PASS projections. */
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {resolve} from 'node:path';
import {ordinary,adverse} from './mo1305-phase1/bounded-proof.mjs';
import {modularAggregate,guardedAdverse} from './mo1305-host-proof.mjs';
const root=resolve(import.meta.dirname,'../../..');
const read=p=>JSON.parse(readFileSync(resolve(root,p)));
const budgets=[['workerOldMiB','workerOldBytes',32],['workerYoungMiB','workerYoungBytes',8],['workerExternalMiB','workerExternalBytes',8],['parentHeapMiB','parentHeapBytes',32],['parentExternalMiB','parentExternalBytes',8],['processRssMiB','processRssBytes',128]];
export function validateBoundedResource(receipt,h){
 const p=receipt.payload,d=p.derivation,campaign=read(d.campaign.path),selection=JSON.parse(h.artifact(d.selection));
 assert.equal(d.methodologyVersion,'2.0.0');assert.equal(selection.state,'FROZEN_BEFORE_REPETITIONS');assert.equal(selection.methodologyRevision,h.revisions.V);
 assert.ok(selection.vectors.length<=20&&selection.vectors.length>0);assert.deepEqual(campaign.vectors.map(r=>read(r.path).id),selection.vectors.map(r=>r.id));
 const o=modularAggregate(d.campaign.path),a=guardedAdverse(d.adverse.path);assert.equal(a.mode,'stress');assert.equal(o.extensionRequired,false,'TARGETED_VARIANCE_EXTENSION_REQUIRED');
 assert.equal(o.binding.sourceTreeSha256,receipt.sourceTreeSha256);assert.equal(a.binding.sourceTreeSha256,receipt.sourceTreeSha256);assert.equal(o.binding.archive.sha256,a.binding.archive.sha256);
 const measured=read(d.measuredSourceTree.path),distribution=read(d.measuredDistribution.path);assert.equal(measured.sha256,receipt.sourceTreeSha256);assert.equal(h.sha(Buffer.from(h.J(measured.files))),measured.sha256);
 const frozen='.cache/mo1305-bounded-r6/frozen-measured/';const inputs=read(frozen+'inputs.json'),byPath=new Map(inputs.map(r=>[r.path,r]));
 for(const row of measured.files)assert.deepEqual(byPath.get(row.path),row);
 for(const row of inputs)h.artifact({...row,path:frozen+'inputs/'+row.path});
 const checks=read(frozen+'input-checks.json');assert.deepEqual(checks.map(c=>c.label),['before-resource']);for(const c of checks){assert.equal(c.state,'PASS');h.artifact(c.inputs);h.artifact(c.external);}
 const complete=read('repositories/cca-conformance/evidence/mo1305-phase1-resume/measurement-completion.json');assert.equal(complete.state,'PASS');assert.equal(complete.sourceTreeSha256,measured.sha256);assert.equal(complete.reusedR6Observations,341);h.artifact(complete.resourceValidation);h.artifact(complete.stressValidation);
 const guard=JSON.parse(h.artifact(complete.guard));assert.equal(guard.state,'PASS');assert.equal(guard.tests,21);assert.equal(guard.positive,5);assert.equal(guard.negative,15);assert.equal(guard.replacementPolicy,1);assert.equal(guard.classificationRevalidatedFromRawEvents,true);assert.deepEqual(guard.files.map(x=>x.path),['tools/mo1305-host-guard.mjs','tools/mo1305-host-guard-policy.json','tools/mo1305-host-events.ps1','tests/mo1305_host_guard_test.mjs'].map(x=>'repositories/cca-conformance/'+x));for(const file of guard.files)h.artifact(file);const guardTap=h.artifact(guard.testLog).toString('utf8');for(const field of ['tests 21','pass 21','fail 0'])assert.ok(guardTap.split(/\r?\n/u).includes('# '+field));for(const r of JSON.parse(h.artifact(complete.historicalManifest)))h.artifact(r);assert.deepEqual(complete.inputs,campaign.inputs);
 const preserved=h.reference(frozen+'memoryos-rest-0.1.0.tgz');assert.equal(preserved.sha256,o.binding.archive.sha256);assert.equal(preserved.byteLength,o.binding.archive.byteLength);
 assert.equal(h.sha(Buffer.from(h.J(distribution))),o.binding.distributionManifest.sha256);
 const prior=read('.cache/mo1305-bounded-r6/historical-evidence-before.json');for(const row of prior)h.artifact(row);
 for(const name of ['mo1305-phase1-measurement-attempt1.json','mo1305-phase1-measurement-attempt-r4.json','mo1305-phase1-measurement-attempt-r5.json','mo1305-phase1-measurement-attempt-r6.json'])assert.equal(read('repositories/cca-conformance/evidence/'+name).state,'FAIL');
 const limits=JSON.parse(h.artifact(p.limits)),preliminary=JSON.parse(h.artifact(d.preliminaryLimits)),analytical=JSON.parse(h.artifact(d.analyticalBounds));
 assert.equal(limits.state,'FINAL');assert.equal(preliminary.state,'PRELIMINARY');assert.equal(preliminary.measured.operationMs,60000);assert.deepEqual(limits.fixed,preliminary.fixed);
 const maximum={...o.maxima,operations:Object.fromEntries(Object.keys(limits.measured.operations).map(k=>[k,o.operations[k]??{requestBytes:0,responseBytes:0}]))};for(const [k,v] of Object.entries(a.maxima))maximum[k]=Math.max(maximum[k],v);
 assert.deepEqual(p.maxima,maximum,'MAXIMA_DRIFT');
 for(const [key,metric,minimum] of budgets){const expected=Math.max(minimum,Math.ceil(1.5*maximum[metric]/1048576));assert.equal(limits.measured[key],expected,'MEMORY_DERIVATION');assert.ok(expected<=preliminary.measured[key],'MEMORY_CEILING');}
 assert.equal(limits.measured.operationMs,Math.ceil(Math.max(1000,4*maximum.operationUs/1000)/100)*100);assert.ok(limits.measured.operationMs<=60000);
 for(const [name,bound] of Object.entries(limits.measured.operations)){const schema=analytical.operations[name],m=maximum.operations[name];assert.equal(bound.requestBytes,schema.requestSchemaBytes?Math.ceil(1.25*Math.max(schema.requestSchemaBytes,m.requestBytes)/1024)*1024:0);assert.equal(bound.responseBytes,Math.ceil(1.25*Math.max(schema.responseSchemaBytes,m.responseBytes,maximum.earlyErrorBytes)/1024)*1024);assert.ok(bound.requestBytes<=1048576&&bound.responseBytes<=65536);}
 assert.equal(limits.measured.earlyErrorBytes,Math.ceil(1.25*maximum.earlyErrorBytes/1024)*1024);
 assert.deepEqual(receipt.results.map(r=>r.id),selection.vectors.map(r=>r.id));for(const result of receipt.results)assert.deepEqual(result.actual,{state:'PASS',caseCount:30,coldSamples:10,warmSamples:20,adverseRepetitions:0,failures:0});
 const stress=read(d.adverse.path);const expectedChunks=[...campaign.vectors,...stress.completed.map(r=>h.reference('repositories/cca-conformance/evidence/mo1305-phase1-resume/stress/'+r.name+'-'+r.repeat+'.json'))].sort((a,b)=>a.path.localeCompare(b.path,'en'));
 assert.deepEqual(p.samples.slice().sort((a,b)=>a.path.localeCompare(b.path,'en')),expectedChunks);for(const r of p.samples)h.artifact(r);
 h.validateFinalAdjustment(d.finalAdjustment,receipt.sourceTreeSha256,p.limits);return maximum;
}
export function validateLayer(receipt,h){
 const p=receipt.payload;let ids=[],expectedCount=1,expectedCold=0,expectedAdverse=0;
 if(receipt.type==='functional'){
  const result=ordinary(p.campaign.path);assert.equal(result.mode,'functional');assert.equal(result.cases,105);assert.equal(result.samples,105);assert.equal(result.binding.sourceTreeSha256,receipt.sourceTreeSha256);assert.deepEqual(JSON.parse(h.artifact(p.validation)),result);
  ids=read(p.campaign.path).completed.map(r=>r.id);expectedCold=1;
 }else if(receipt.type==='boundary'){
  for(const ref of p.records){const record=JSON.parse(h.artifact(ref));assert.equal(record.state,'PASS');assert.ok(record.records.length);for(const row of record.records){assert.equal(row.state,'PASS');ids.push(row.id);}}
 }else if(receipt.type==='stress'){
  for(const path of [p.functional.path,p.confirmation.path]){const expected=path.replace(/index\.json$/u,'host-revalidation.json'),bound=receipt.artifacts.find(r=>r.path===expected);assert.ok(bound,'MISSING_BOUND_HOST_REVALIDATION');h.artifact(bound);}
  const functional=guardedAdverse(p.functional.path),measured=guardedAdverse(p.measured.path),confirmation=guardedAdverse(p.confirmation.path);assert.equal(functional.scenarios,20);assert.equal(functional.repetitions,20);assert.equal(confirmation.binding.sourceTreeSha256,receipt.sourceTreeSha256);assert.equal(functional.binding.sourceTreeSha256,receipt.sourceTreeSha256);
  const selection=JSON.parse(h.artifact(p.selection));assert.equal(selection.cases.length,measured.scenarios);assert.equal(confirmation.scenarios,measured.scenarios);assert.equal(confirmation.repetitions,selection.cases.length*2);assert.equal(selection.durationMs,10000);assert.equal(selection.repetitions,2);
  for(const [prefix,path] of [['ADVERSE',p.functional.path],['STRESS',p.confirmation.path]])for(const row of read(path).completed)ids.push(prefix+'-'+row.name+'-'+row.repeat);
  expectedAdverse=1;const limits=read('repositories/memoryos-rest/contracts/limits.json');const index=read(p.confirmation.path);for(const item of index.completed){const row=read(p.confirmation.path.replace(/index\.json$/u,item.name+'-'+item.repeat+'.json'));assert.ok(row.counts.requests>0);if(item.name.endsWith('-32'))assert.equal(row.parent.peak.connections,32);if(item.name==='body-buffers-4')assert.equal(row.parent.peak.bodyBufferBytes,4*limits.measured.operations.evaluatePolicy.requestBytes);if(item.name==='blocked-writers-4')assert.equal(row.parent.peak.writeSlots,4);if(item.name==='request-flood')assert.ok(row.counts.rejected>0);}for(const [key,metric] of budgets.filter(x=>x[1].startsWith('parent')||x[1]==='processRssBytes'))assert.ok(confirmation.maxima[metric]<=limits.measured[key]*1048576,'FINAL_STRESS_MEMORY_BOUND');
 }else if(receipt.type==='parity'){
  const run=JSON.parse(h.artifact(p.cases));assert.equal(run.sourceTreeSha256,receipt.sourceTreeSha256);h.validateRawExecution(run);ids=run.records.map(r=>r.id);
 }else if(receipt.type==='installation'){
  const result=JSON.parse(h.artifact(p.installation));assert.equal(result.state,'PASS');assert.equal(result.postInstallEveryFileMatches,true);assert.equal(result.cacheInitiallyEmpty,true);assert.equal(result.exitCode,0);assert.deepEqual(result.command,['npm','ci','--offline','--ignore-scripts','--no-audit','--no-fund','--cache','FRESH_EMPTY_EXPLICIT_CACHE']);ids=['OFFLINE-INSTALL'];expectedCount=result.installedFileCount;
 }else if(receipt.type==='supplyChain'){
  const result=JSON.parse(h.artifact(p.review));assert.equal(result.state,'PASS');assert.equal(result.reviewDate,'2026-09-24');ids=['SUPPLY-CHAIN-REVIEW'];
 }else throw Error('UNKNOWN_LAYER');
 assert.deepEqual(receipt.results.map(r=>r.id),ids.slice().sort());for(const row of receipt.results)assert.deepEqual(row.actual,{state:'PASS',caseCount:expectedCount,coldSamples:expectedCold,warmSamples:0,adverseRepetitions:expectedAdverse,failures:0});
}
