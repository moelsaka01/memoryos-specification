/** Actual integrated I2 acceptance plus adversarial binding witnesses. No campaigns rerun. */
import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync,readdirSync} from 'node:fs';
import {resolve} from 'node:path';
import {schemaValidator} from '../../memoryos-rest/src/schema.mjs';
import {executionBinding} from '../tools/mo1305-phase2d/execution.mjs';
import {root,directory,read,parseCanonical,verifyReference,checkAttempt,checkInstallation,checkDistribution} from '../tools/mo1305-phase2d/evidence.mjs';
import {B1,sources,subjects,inventoryPath,bindingPath,b2Paths,checkBinding,checkCommit,checkB2Scope,expectedInventory,validateConformance} from '../tools/mo1305-phase2d/graph.mjs';
const binding=executionBinding();
const attempt=job=>read(read(directory+'/modules/'+job+'.json').accepted.path);
const installed=attempt('installation').result.result;
const distribution=attempt('distribution').result.result;
const graph=read(bindingPath);
function rejects(name,original,mutation,validate){
 test(name,()=>{const value=structuredClone(original);mutation(value);assert.throws(()=>validate(value));});
}

test('MO-1305 Phase 2 actual integrated receipts, package, preserved inputs and linear graph pass',()=>{
 assert.equal(process.platform,'win32');assert.equal(process.arch,'x64');assert.equal(process.versions.node,'24.21.0');
 const result=validateConformance();assert.equal(result.state,'PASS');assert.equal(result.evidence.modules,10);assert.equal(result.evidence.securityRecords,288);assert.equal(result.preserved,2359);
});
test('Phase 2 inventory satisfies the frozen closed schema and exact integrated state',()=>{
 const value=read(inventoryPath),schema=schemaValidator(read('repositories/cca-conformance/schema/mo1305-inventory-2.0.0.json'));
 assert.equal(schema('Inventory',value),true);assert.deepEqual(value,expectedInventory(graph.implementation));
 for(const mutate of [v=>v.unknown=true,v=>v.platformPolicy.linux='REQUIRED',v=>delete v.implementations.B1]){
  const invalid=structuredClone(value);mutate(invalid);assert.equal(schema('Inventory',invalid),false);
 }
});
test('Phase 2 is registered with Windows scope and the current inventory gate',()=>{
 const runner=readFileSync(resolve(root,'repositories/cca-conformance/tools/run-js-conformance.mjs'),'utf8');
 const expected=runner.match(/const expectedFiles = Object.freeze\(\[([\s\S]*?)\]\);/)[1];
 const names=[...expected.matchAll(/"([^"]+_test.mjs)"/g)].map(m=>m[1]);
 assert.deepEqual(names,readdirSync(resolve(root,'repositories/cca-conformance/tests')).filter(n=>n.endsWith('_test.mjs')).sort());
 assert.ok(runner.includes('mo1305Phase2Bound'));assert.ok(runner.includes('process.platform === "win32"'));
 const cmake=readFileSync(resolve(root,'repositories/cca-conformance/CMakeLists.txt'),'utf8');
 assert.ok(cmake.includes('tests/mo1305_phase2_conformance_test.mjs'));assert.ok(cmake.includes('conformance_area STREQUAL "mo1305-phase2"'));assert.ok(cmake.includes('MO1305_INVENTORY_STATE'));
});
test('canonical evidence rejects duplicate members, changed bytes and unsafe references',()=>{
 assert.throws(()=>parseCanonical(Buffer.from('{"x":1,"x":1}')));
 assert.throws(()=>parseCanonical(Buffer.from('{"x":1}\n')));
 const ref=read(directory+'/modules/lifecycle.json').accepted;
 assert.throws(()=>verifyReference({...ref,sha256:'0'.repeat(64)}));
 assert.throws(()=>verifyReference({...ref,path:'../escape'}));
});
for(const [name,mutation] of [
 ['unknown receipt field',v=>v.unexpected=true],
 ['stale integrated production binding',v=>v.binding.candidate.production[0].sha256='0'.repeat(64)],
 ['wrong archive identity',v=>v.binding.archive.sha256='0'.repeat(64)],
 ['false PASS over recorded failure',v=>v.failure={code:'FAILED'}],
 ['unproven host interruption',v=>v.state='HOST_INTERRUPTED'],
 ['forged host classification',v=>v.host.observation.classification='HOST_INTERRUPTED']
])rejects('Receipt rejects '+name,attempt('lifecycle'),mutation,v=>checkAttempt(v,binding));
for(const [name,mutation] of [
 ['missing lifecycle case',v=>v.result.result.records.pop()],
 ['false lifecycle cleanup',v=>v.result.result.records.find(r=>r.id==='shutdown-during-semantic').actual.cleanup=false],
 ['process memory budget violation',v=>{const row=v.result.result.records.find(r=>r.actual.sessions.length);row.actual.sessions[0].peakSampledBytes.rss=394*1048576;}],
 ['lost remote connection bound',v=>v.result.result.records.find(r=>r.id==='remote-connection-limit').actual.maximum=33]
])rejects('Lifecycle rejects '+name,attempt('lifecycle'),mutation,v=>checkAttempt(v,binding));
for(const [job,name,mutation] of [
 ['transport','missing transport case',r=>r.records.pop()],
 ['transport','false transport PASS',r=>r.records[0].state='FAIL'],
 ['dispatch','duplicate dispatch case',r=>r.records[0]=r.records[1]],
 ['interop','forged independent oracle',r=>r.provenance.oracle.restAsOracle=true],
 ['interop','missing semantic decision vector',r=>r.records.find(x=>x.decision==='COULD_NOT_EVALUATE').decision='PASS']
])rejects('Security rejects '+name,attempt(job),v=>{mutation(v.result.result);v.result.validatedLegacyFormat.result=structuredClone(v.result.result);},v=>checkAttempt(v,binding));
for(const [name,mutation] of [
 ['online installation',v=>v.offline.offlineMode=false],
 ['enabled lifecycle scripts',v=>v.offline.scriptsDisabled=false],
 ['missing offline command flag',v=>{const c=v.commands.find(c=>c.argv.includes('install'));c.argv=c.argv.filter(a=>a!=='--offline');}],
 ['checkout-dependent service cwd',v=>v.sourceIndependence.stageOutsideCheckout=false],
 ['substituted installed member',v=>v.packageInventory[0].sha256='0'.repeat(64)],
 ['missing installed route',v=>v.installations[0].execution.requests.splice(0,1)],
 ['forged semantic response digest',v=>v.installations[0].execution.requests.find(r=>r.case==='evaluate-policy-pass').responseBody.sha256='0'.repeat(64)],
 ['lost missing-Host authentication precedence',v=>v.installations[0].execution.remote.requests.find(r=>r.case==='missing-host-and-auth').status=403],
 ['disabled certificate verification',v=>v.installations[0].execution.remote.requests[0].certificateAuthorized=false],
 ['absent remote execution',v=>delete v.installations[0].execution.remote],
 ['unsafe runtime accepted',v=>v.trustedLauncherNegatives.nodeSubstitution='ACCEPTED'],
 ['package changed during execution',v=>v.installations[0].afterInventorySha256='0'.repeat(64)]
])rejects('Installation rejects '+name,installed,mutation,v=>checkInstallation(v,binding));
for(const [name,mutation] of [
 ['missing archive attack',v=>v.cases.pop()],
 ['false adversarial PASS',v=>v.cases.find(c=>c.expected==='reject').observed='accept'],
 ['substituted archive digest',v=>v.archive.sha256='0'.repeat(64)]
])rejects('Distribution rejects '+name,distribution,mutation,v=>checkDistribution(v,binding));
for(const [name,mutation] of [
 ['wrong source branch commit',v=>v.sourceCommits['2a']=sources['2b'].commit],
 ['missing Phase 1 binding',v=>delete v.phase1],
 ['self reference',v=>v.selfReference=graph.implementation],
 ['premature Windows certification',v=>v.windowsCertification='PASS'],
 ['premature Phase 3 completion',v=>v.phase3='COMPLETE'],
 ['unapproved Linux obligation',v=>v.linux='REQUIRED'],
 ['release tag claim',v=>v.releaseTag.state='PRESENT']
])rejects('Binding rejects '+name,graph,mutation,checkBinding);
test('Graph rejects a source branch substituted for the authoritative I2',()=>{
 assert.throws(()=>checkCommit(sources['2a'].commit,B1,subjects.I2));
 assert.throws(()=>checkCommit(graph.implementation,sources['2a'].commit,subjects.I2));
});
test('B2 permits exactly the binding, evidence and registration scope',()=>{
 checkB2Scope(b2Paths);assert.throws(()=>checkB2Scope([...b2Paths,'repositories/memoryos-rest/src/server.mjs']));
 assert.throws(()=>checkB2Scope(b2Paths.filter(p=>p!==bindingPath)));
});
