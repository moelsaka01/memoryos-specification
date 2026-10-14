// Engineering receipt cross-binding only. Does not run tests or characterization.
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { createHash } from 'node:crypto';
import assert from 'node:assert/strict';
export const root=path.resolve(path.dirname(fileURLToPath(import.meta.url)),'../../../..');
export const evidence='repositories/cca-conformance/evidence/mo1307/phase1/';
export const read=p=>fs.readFileSync(path.join(root,p));
export const json=p=>JSON.parse(read(p));
export const hash=b=>'sha256:'+createHash('sha256').update(b).digest('hex');
export const row=p=>{const b=read(p);return {path:p,byteLength:b.length,sha256:hash(b)};};
export function checkRow(expected){const actual=row(expected.path);assert.equal(actual.byteLength,expected.byteLength,expected.path);assert.equal(actual.sha256,expected.sha256,expected.path);}
export function checkAcceptance(){
  const receipt=json(evidence+'acceptance/receipt.json');assert.equal(receipt.result,'PASS');
  for(const id of ['schemas','fixtures','package','phase1-tests','workspace','diff-check'])assert.equal(receipt.commands.filter(c=>c.id===id).length,1,id);
  for(const command of receipt.commands){
    assert.match(command.id,/^[a-z][a-z0-9-]*$/);assert.equal(command.result,'PASS');assert.equal(command.exit,0);assert.equal(command.error,null);
    for(const stream of ['stdout','stderr'])checkRow({path:evidence+'acceptance/'+command.id+'.'+stream+'.txt',...command[stream]});
  }
  const tests=receipt.commands.find(c=>c.id==='phase1-tests');assert.equal(tests.tests.count,105);assert.equal(tests.tests.pass,105);
  for(const key of ['fail','cancelled','skipped','todo'])assert.equal(tests.tests[key],0,key);
  assert.equal(tests.testNames.length,tests.tests.count);
  const schemas=json(evidence+'acceptance/schemas.stdout.txt');assert.equal(schemas.result,'PASS');assert.deepEqual(schemas.failures,[]);
  const sourceBindings=[schemas.catalog,schemas.tool,schemas.lock,...schemas.schemaFiles,...schemas.packageDocuments,schemas.spdxSBOM,schemas.spdxSBOM.schema].map(({path,byteLength,sha256})=>({path,byteLength,sha256}));
  for(const r of sourceBindings)checkRow(r);
  const cat=json(schemas.catalog.path);assert.equal(schemas.checkedFixtures,cat.entries.filter(r=>r.schemaValid!==null).length);
  assert.equal(schemas.parserFixturesSkipped.length,cat.entries.filter(r=>r.schemaValid===null).length);
  return {receipt,sourceBindings:sourceBindings.sort((a,b)=>a.path<b.path?-1:1)};
}
const directories={small:'repositories/cca-conformance/fixtures/mo1307/bundles/ready','mo1306-shaped':'repositories/cca-conformance/fixtures/mo1307/bundles/mo1306-qualified',maximum:'.cache/mo1307/phase1/characterization-inputs/maximum'};
const generator='repositories/cca-conformance/tools/mo1307-phase1/generate-fixtures.mjs';
export function captureInputs(name){
  assert.ok(Object.hasOwn(directories,name));const directory=directories[name],get=p=>read(directory+'/'+p),obj=p=>JSON.parse(get(p));
  const manifest=obj('manifest.json'),candidate=obj('candidate.json'),result=obj('expected-result.json'),pins=obj('pins.json');
  const files=[...['authority.json','candidate.json','configuration.json','expected-result.json','manifest.json','pins.json'],...manifest.entries.map(e=>e.path)].sort().map(p=>{const b=get(p);return {path:p,byteLength:b.length,sha256:hash(b)};});
  for(const e of manifest.entries){const f=files.find(f=>f.path===e.path);assert.equal(f.byteLength,e.byteLength);assert.equal(f.sha256,e.sha256);}
  assert.equal(hash(get('candidate.json')),pins.expectedCandidateDigest);assert.equal(hash(get('authority.json')),pins.trustedAuthorityDigest);
  assert.equal(result.readinessDigest,pins.expectedReadinessDigest);assert.equal(result.proofBindingDigest,pins.expectedProofBindingDigest);
  return {kind:'MemoryOSReadinessPhase1CharacterizationInputBinding',version:'1.0.0',case:name,sourceDirectory:directory,sourceType:name==='maximum'?'RECONSTRUCTIBLE_GENERATED_FIXTURE':'TRACKED_FIXTURE',generator:row(generator),files,
    identities:{candidate:pins.expectedCandidateDigest,authority:pins.trustedAuthorityDigest,manifest:hash(get('manifest.json')),result:hash(get('expected-result.json')),readiness:result.readinessDigest,proof:result.proofBindingDigest},
    sizes:{configuration:get('configuration.json').length,candidate:get('candidate.json').length,manifest:get('manifest.json').length,authority:get('authority.json').length,aggregateEvidence:manifest.entries.reduce((n,e)=>n+e.byteLength,0),largestSource:Math.max(...manifest.entries.filter(e=>e.type!=='ENVELOPE').map(e=>e.byteLength)),largestEnvelope:Math.max(...manifest.entries.filter(e=>e.type==='ENVELOPE').map(e=>e.byteLength)),result:get('expected-result.json').length},
    counts:{components:candidate.components.length,manifestFiles:manifest.entries.length,claims:manifest.entries.filter(e=>e.type==='ENVELOPE').length,graphNodes:result.assessment.graph.nodes.length,graphEdges:result.assessment.graph.edges.length,gates:result.assessment.gates.length,qualifications:result.assessment.qualifications.length,history:result.assessment.history.length}};
}
export function checkCharacterization(name,child,observer,binding){
  assert.equal(child.case,name);assert.equal(observer.case,name);assert.equal(binding.case,name);assert.equal(binding.sourceDirectory,directories[name]);checkRow(binding.generator);
  assert.equal(child.result,'PASS');assert.equal(child.foundationOnly,true);assert.equal(child.productionCertification,false);assert.equal(observer.status,'OBSERVED');assert.equal(observer.childExitCode,0);
  assert.ok(child.worker.inputAndPureDurationMs<10000&&child.supervisorElapsedMs<10000&&observer.elapsedMs<30000);
  assert.ok(observer.peakAggregateWorkingSetBytes>0&&observer.peakAggregateWorkingSetBytes<=536870912);
  assert.ok(observer.samples>=2&&observer.lateNodeSamples>=1&&observer.lastActiveNodeSampleMs>=250);assert.equal(child.worker.samplingHoldMs,2000);
  assert.deepEqual(child.worker.identities,binding.identities);assert.deepEqual(child.worker.counts,binding.counts);
  for(const [key,value] of Object.entries(binding.sizes))assert.equal(child.worker.sizes[key],value,name+':'+key);
  const localAvailable=fs.existsSync(path.join(root,binding.sourceDirectory));
  if(binding.sourceType==='TRACKED_FIXTURE'||localAvailable)assert.deepEqual(captureInputs(name),binding);
  else assert.equal(binding.sourceType,'RECONSTRUCTIBLE_GENERATED_FIXTURE');
  if(name==='maximum'){
    assert.equal(binding.counts.components,1024);assert.equal(binding.counts.manifestFiles,128);assert.equal(binding.sizes.aggregateEvidence,8388608);
    assert.equal(binding.sizes.largestSource,2097152);assert.equal(binding.sizes.largestEnvelope,262144);assert.ok(binding.counts.graphNodes<=2048&&binding.counts.graphEdges<=8192);
  }
  assert.equal(binding.files.find(r=>r.path==='candidate.json').sha256,binding.identities.candidate);
  assert.equal(binding.files.find(r=>r.path==='authority.json').sha256,binding.identities.authority);
  assert.equal(binding.files.find(r=>r.path==='manifest.json').sha256,binding.identities.manifest);
  assert.equal(binding.files.find(r=>r.path==='expected-result.json').sha256,binding.identities.result);
}
