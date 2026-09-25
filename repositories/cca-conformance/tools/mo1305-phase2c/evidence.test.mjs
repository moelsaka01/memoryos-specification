import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {canonical,parseCanonical,bindInputs,validateBinding,validateRecordSet,validateAttempt,catalog,sha,baseline,nodeSha256,reference,verifyReference,normalizeRecord,regressionExpectations,validateRegressionMembership} from './evidence.mjs';
import {classify} from '../mo1305-host-guard.mjs';
const binding=bindInputs(),bindingHash=sha(canonical(binding));
const expected=[{id:'case',category:'authentication'}];
const valid=[{id:'case',category:'authentication',state:'PASS',code:'MO1305_UNAUTHENTICATED',status:401}];

function sampleShape(schema){if(Object.hasOwn(schema,'const'))return structuredClone(schema.const);if(schema.oneOf)return sampleShape(schema.oneOf[0]);if(schema.type==='null')return null;if(schema.type==='object')return Object.fromEntries(Object.entries(schema.fields).map(([key,child])=>[key,sampleShape(child)]));if(schema.type==='array')return [];if(schema.type==='number')return 123;if(schema.type==='boolean')return false;return schema.pattern?'a'.repeat(64):'fixture';}
function interopResult(){return {records:catalog().modules.interop.map(row=>sampleShape(row.schema)),limitations:[],provenance:{perClient:{'raw-tls':17,'node-fetch':17,curl:17},closedOperations:['evaluatePolicy','getContractIdentities','getHealth','getReadiness','getVersion','preparePolicy','preparePolicySet','verifyEvaluationIdentity','verifyPolicyOutcome'],oracle:{source:'repositories/cca-studio/web/js/memoryos-sdk.js',sdkVersion:'1.1.0',freshlyComputed:true,restAsOracle:false,closureFilesChecked:25,closureManifestSha256:binding.production.find(ref=>ref.path.endsWith('/runtime/runtime-closure-manifest.json')).sha256},gateway:{entry:'package/bin/memoryos-rest.mjs',productionWorker:true,workerSubstitution:false,exitCode:0,processId:123},clients:{node:{version:'24.21.0',sha256:nodeSha256},curl:{sha256:'a'.repeat(64),certificateVerification:true,httpVersion:'1.1',tlsMinimum:'1.3',tlsMaximum:'1.3'}}}};}

function attempt(){
  const id='validator-fixture',module='interop',start={ns:'1000000000',domain:'MONOTONIC_VALIDATOR',utcMs:1790000001000},end={ns:'2000000000',domain:'MONOTONIC_VALIDATOR',utcMs:1790000002000};
  const events={state:'AVAILABLE',events:[]},observation=classify({start,end,attemptId:id,candidateId:bindingHash,caseId:module,phase:'phase2c',index:0,sampleId:id},events);
  return {kind:'MemoryOSRESTPhase2CAttempt',version:'1.0.0',module,id,index:0,state:'PASS',binding,bindingSha256:bindingHash,runtime:{version:'24.21.0',sha256:nodeSha256,platform:'win32',architecture:'x64'},platform:{platform:'win32',architecture:'x64',type:'Windows_NT',version:'Windows 11 Home',build:'26200',release:'10.0.26200',editionId:'Core',displayVersion:'25H2',productName:'Windows 11 Home',currentBuild:'26200',ubr:9457,fullBuild:'10.0.26200.9457'},host:{events,observation},processes:[{pid:123,entry:'package/bin/memoryos-rest.mjs',started:true,exitCode:0,signal:null,launchMode:'production-entrypoint'}],result:interopResult(),failure:null};
}
test('canonical round trip and current binding',()=>{assert.deepEqual(parseCanonical(canonical({b:2,a:1})),{a:1,b:2});assert.equal(validateBinding(binding),bindingHash);});
for(const [name,value] of [['duplicate keys','{"a":1,"a":1}'],['noncanonical order','{"b":2,"a":1}'],['trailing whitespace','{"a":1}\n'],['negative zero','{"a":-0}'],['exponent token','{"a":1e1}'],['BOM','\ufeff{"a":1}']])test('reject '+name,()=>assert.throws(()=>parseCanonical(Buffer.from(value))));
test('reject malformed UTF-8',()=>assert.throws(()=>parseCanonical(Buffer.from([0xff,0xfe]))));
test('accept exact record set',()=>assert.deepEqual(validateRecordSet(valid,expected),valid));
for(const [name,change] of [
 ['missing case',rows=>rows.pop()],['extra case',rows=>rows.push({...rows[0],id:'extra'})],['duplicate ID',rows=>rows.push({...rows[0]})],
 ['unknown ID',rows=>rows[0].id='unknown'],['wrong category',rows=>rows[0].category='tls'],['false PASS',rows=>rows[0].state='FAIL'],
 ['missing state',rows=>delete rows[0].state],['unknown gateway code',rows=>rows[0].code='MO1305_UNKNOWN'],['wrong HTTP mapping',rows=>rows[0].status=200],
 ['inconsistent client alias',rows=>rows[0].httpStatus=500]
])test('reject '+name,()=>{const rows=structuredClone(valid);change(rows);assert.throws(()=>validateRecordSet(rows,expected));});
test('normalize independent client aliases and resource probe status',()=>{assert.equal(normalizeRecord({errorCode:'MO1305_BUSY',httpStatus:503}).status,503);assert.equal(normalizeRecord({code:'MO1305_BUSY',probeStatus:503}).status,503);});
test('cancelled has no HTTP mapping',()=>{const rows=[{...valid[0],code:'MO1305_CLIENT_CANCELLED',status:null,wire:false}];validateRecordSet(rows,expected);rows[0].status=200;assert.throws(()=>validateRecordSet(rows,expected));});
for(const [name,change] of [
 ['unknown field',value=>value.extra=true],
 ['baseline',value=>value.baseline='0'.repeat(40)],['runtime hash',value=>value.node.sha256='0'.repeat(64)],
 ['production hash',value=>value.production[0].sha256='0'.repeat(64)],['missing production row',value=>value.production.pop()],
 ['source closure hash',value=>value.sdk[0].sha256='0'.repeat(64)],['missing source row',value=>value.sdk.pop()],
 ['harness hash',value=>value.harness[0].sha256='0'.repeat(64)],['fixture hash',value=>value.fixtures[0].sha256='0'.repeat(64)],
 ['regression input hash',value=>value.regressionSources[0].sha256='0'.repeat(64)],['missing regression input',value=>value.regressionSources.pop()],
 ['FINAL state',value=>value.limitsState='PRELIMINARY']
])test('reject altered binding '+name,()=>{const value=structuredClone(binding);change(value);assert.throws(()=>validateBinding(value));});
test('reference integrity and traversal protection',()=>{const ref=reference('repositories/memoryos-rest/contracts/limits.json');verifyReference(ref);assert.throws(()=>verifyReference({...ref,sha256:'0'.repeat(64)}));assert.throws(()=>verifyReference({...ref,path:'../outside'}));});
test('accept structurally complete synthetic attempt without publishing it',()=>validateAttempt(attempt()));
for(const [name,change] of [
 ['stripped observed response',value=>delete value.result.records[0].responseBody],['forged normative hash',value=>value.result.records.find(row=>row.normativeProducts.canonicalArtifact).normativeProducts.canonicalArtifact.sha256='0'.repeat(64)],['false fresh oracle',value=>value.result.provenance.oracle.freshlyComputed=false],['worker substitution claim',value=>value.result.provenance.gateway.workerSubstitution=true],
 ['unknown field',value=>value.untrusted=true],['process never started',value=>value.processes[0].started=false],['unknown process field',value=>value.processes[0].unexpected=true],['wrong full OS build',value=>value.platform.fullBuild='10.0.26200.1'],
 ['PASS with failure',value=>value.failure={code:'TEST_FAILURE'}],['missing records',value=>value.result.records.pop()],
 ['duplicate records',value=>value.result.records[0]=value.result.records[1]],['missing process proof',value=>value.processes=[]],
 ['unreaped process',value=>value.processes[0].exitCode=null],['wrong runtime',value=>value.runtime.version='25.0.0'],
 ['wrong candidate digest',value=>value.bindingSha256='0'.repeat(64)],['host classification',value=>value.host.observation.classification='HOST_INTERRUPTED'],
 ['clock domain',value=>value.host.observation.validityWindow.end.domain='MONOTONIC_OTHER'],
 ['clock order',value=>value.host.observation.validityWindow.end.ns='0'],
 ['host policy identity',value=>value.host.observation.policySha256='0'.repeat(64)],
 ['host evidence substitution',value=>value.host.events.state='UNAVAILABLE']
])test('reject attempt '+name,()=>{const value=attempt();change(value);assert.throws(()=>validateAttempt(value));});
test('host evidence unavailable never excuses an assertion failure',()=>{const value=attempt();value.host.events={state:'UNAVAILABLE',events:[]};const {start,end}=value.host.observation.validityWindow;value.host.observation=classify({start,end,attemptId:value.id,candidateId:value.bindingSha256,caseId:value.module,phase:'phase2c',index:0,sampleId:value.id},value.host.events);value.failure={code:'ASSERTION'};value.state='FAIL';assert.equal(validateAttempt(value).state,'FAIL');value.state='HOST_INTERRUPTED';assert.throws(()=>validateAttempt(value));});
test('the frozen catalog has all seven independent modules',()=>{const value=catalog();assert.deepEqual(Object.fromEntries(Object.entries(value.modules).map(([name,rows])=>[name,rows.length])),{capabilities:141,dispatch:23,interop:51,regressions:8,resources:45,startup:5,transport:164});});

for(const [label,module,id,field] of [['wire status','transport',null,'status'],['authentication source mechanism','transport','auth-fixed-size-timing-safe-mechanism','sourceSha256'],['boundary observed bytes','resources',null,'bytes']])test('reject missing observed '+label,()=>{const expected=catalog().modules[module].find(row=>id?row.id===id:row.schema.fields[field]);assert.ok(expected);const record=sampleShape(expected.schema);delete record[field];assert.throws(()=>validateRecordSet([record],[expected]));});

// Synthetic membership values exercise validation only; no subprocess or regression execution.
test('accept exactly eight regression memberships and 283 leaf checks',()=>{const groups=regressionExpectations();assert.equal(groups.length,8);assert.equal(groups.reduce((sum,group)=>sum+group.counts.pass,0),283);for(const group of groups)validateRegressionMembership(group);});
for(const [name,change] of [
 ['empty command',value=>value.command=[]],['missing command argument',value=>value.command.splice(2,1)],['extra command argument',value=>value.command.push('--test-only')],
 ['altered command file',value=>value.command[4]='repositories/cca-studio/tests/investigation_core_test.mjs'],['narrowed test selector',value=>value.command.splice(4,0,'--test-name-pattern=only one')],
 ['empty source membership',value=>value.sources=[]],['missing source member',value=>value.sources.pop()],['extra source member',value=>value.sources.push(reference('repositories/cca-studio/tests/investigation_core_test.mjs'))],
 ['reordered source membership',value=>value.sources.reverse()],['altered source member',value=>value.sources[0]=reference('repositories/cca-studio/tests/investigation_core_test.mjs')],['altered source hash',value=>value.sources[0].sha256='0'.repeat(64)],
 ['unknown regression group',value=>value.id='REGRESSION-other'],['lowered regression count',value=>{value.counts.pass=1;value.counts.tests=1;}],['missing regression count',value=>delete value.counts.tests],['extra regression count',value=>value.counts.todo=0]
])test('reject regression '+name,()=>{const value=regressionExpectations().find(group=>group.id==='REGRESSION-mo1301-sdk');change(value);assert.throws(()=>validateRegressionMembership(value));});
