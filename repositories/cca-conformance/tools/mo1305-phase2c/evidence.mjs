/** Canonical, hash-bound Phase 2C evidence. Verification needs only this checkout. */
import assert from 'node:assert/strict';
import {readFileSync,writeFileSync,readdirSync,mkdirSync,existsSync} from 'node:fs';
import {resolve,relative,isAbsolute} from 'node:path';
import {createHash} from 'node:crypto';
import {classify,policySha256} from '../mo1305-host-guard.mjs';

export const root=resolve(import.meta.dirname,'../../../..');
export const evidenceRoot=resolve(root,'repositories/cca-conformance/evidence/mo1305-phase2c');
export const baseline='b6c397b99e1f8bfcd04be972f35069f8737a4137';
export const nodeSha256='ba4e6d110e8c1592a1ecd390f6b05f3da124b13871a5be62b341a07a853c6c32';
export const modules=['transport','capabilities','interop','resources','dispatch','startup','regressions'];
// Independent acceptance membership: frozen section 12.3 projections plus affected REST/host guards.
// Counts are checked against the retained Phase 1 predecessor TAP and reviewed current guard suites.
const regressionGroups={
 'rest-security':{pass:27,files:['contracts.test.mjs','boundaries.test.mjs','runtime-guards.test.mjs','worker-boundary.test.mjs','integrity-race.test.mjs','openapi.test.mjs'].map(name=>'repositories/memoryos-rest/tests/'+name)},
 'host-interruption':{pass:21,files:['repositories/cca-conformance/tests/mo1305_host_guard_test.mjs']},
 'mo1301-sdk':{pass:131,files:['memoryos_policy_sdk_test.mjs','investigation_policy_test.mjs','investigation_policy_contracts_test.mjs','investigation_policy_engine_test.mjs','policy_canonical_test.mjs','policy_fact_context_test.mjs','regression_policy_fact_source_test.mjs','memoryos_sdk_test.mjs'].map(name=>'repositories/cca-studio/tests/'+name)},
 'core-mip':{pass:60,files:['mip_adversarial_conformance_test.mjs','mip_canonical_test.mjs','mip_derived_edge_conformance_test.mjs','mip_ordering_conformance_test.mjs','mip_pipeline_conformance_test.mjs','mip_schema_conformance_test.mjs','investigation_core_test.mjs'].map(name=>'repositories/cca-studio/tests/'+name)},
 'mo1302-projections':{pass:5,selector:'--test-name-pattern=CLI transport|real bundled orchestration|valid MO-1301 evaluation failures|artifact verifier rejections|wrong decision/exit',files:['repositories/cca-conformance/tests/mo1302_action_foundation_conformance_test.mjs']},
 'mo1303-io-inspection':{pass:6,selector:'--test-name-pattern=secure input|exact bytes|inspection|Policy|policy|artifact|verification',files:['repositories/memoryos-vscode/tests/runtime_foundation.test.mjs']},
 'mo1304-semantic-integrity':{pass:27,files:['contracts.test.mjs','delegation.test.mjs','integrity.test.mjs','dispatcher.test.mjs'].map(name=>'repositories/memoryos-mcp/tests/'+name)},
 'cli-secondary':{pass:6,files:['repositories/memoryos-cli/tests/policy-cli.test.mjs']}
};
export function regressionExpectations(){return Object.entries(regressionGroups).map(([name,group])=>({id:'REGRESSION-'+name,command:['node24.21.0','--test','--test-concurrency=1','--test-reporter=tap',...(group.selector?[group.selector]:[]),...group.files],sources:group.files.map(reference),counts:{tests:group.pass,pass:group.pass,fail:0,skipped:0}}));}
export function validateRegressionMembership(record){
 const expected=regressionExpectations().find(group=>group.id===record.id);assert.ok(expected,'UNKNOWN_REGRESSION_GROUP');
 assert.deepEqual(record.command,expected.command,'REGRESSION_COMMAND_MEMBERSHIP');
 assert.deepEqual(record.sources,expected.sources,'REGRESSION_SOURCE_MEMBERSHIP');
 assert.deepEqual(record.counts,expected.counts,'REGRESSION_EXACT_COUNTS');
}
export const errorStatuses=Object.fromEntries(Object.entries({BUSY:503,CLIENT_CANCELLED:null,FORBIDDEN:403,HEADER_LIMIT:431,HTTP_VERSION:505,INPUT_LIMIT:413,INTERNAL_FAILURE:500,LENGTH_REQUIRED:411,METHOD_NOT_ALLOWED:405,NOT_ACCEPTABLE:406,NOT_FOUND:404,OPERATION_TIMEOUT:504,OUTPUT_LIMIT:500,RATE_LIMIT:429,REQUEST_SCHEMA:400,REQUEST_SYNTAX:400,REQUEST_TIMEOUT:408,RUNTIME_INTEGRITY:503,SEMANTIC_REJECTED:422,TARGET_LIMIT:414,UNAUTHENTICATED:401,UNAVAILABLE:503,UNSUPPORTED_MEDIA:415}).map(([code,status])=>['MO1305_'+code,status]));
export const sha=bytes=>createHash('sha256').update(bytes).digest('hex');
function ordered(value){if(Array.isArray(value))return value.map(ordered);if(value!==null&&typeof value==='object')return Object.fromEntries(Object.keys(value).sort().map(key=>[key,ordered(value[key])]));return value;}
export const canonical=value=>Buffer.from(JSON.stringify(ordered(value)));
export function parseCanonical(bytes){assert.ok(Buffer.isBuffer(bytes));assert.ok(bytes.length<=16777216,'EVIDENCE_SIZE');const value=JSON.parse(new TextDecoder('utf-8',{fatal:true}).decode(bytes));assert.deepEqual(canonical(value),bytes,'NONCANONICAL_OR_DUPLICATE_JSON');return value;}
function local(path){assert.equal(typeof path,'string');assert.ok(!isAbsolute(path)&&!path.includes('\\')&&!path.split('/').some(x=>x==='..'||x==='.'||x===''),'UNSAFE_REFERENCE');const target=resolve(root,path);assert.ok(relative(root,target)&&!relative(root,target).startsWith('..'),'REFERENCE_ESCAPE');return target;}
export function reference(path){const bytes=readFileSync(local(path));return {path,byteLength:bytes.length,sha256:sha(bytes)};}
export function verifyReference(ref){assert.deepEqual(Object.keys(ref).sort(),['byteLength','path','sha256']);assert.ok(Number.isSafeInteger(ref.byteLength)&&ref.byteLength>=0);assert.match(ref.sha256,/^[0-9a-f]{64}$/);assert.deepEqual(reference(ref.path),ref,'REFERENCE_MISMATCH '+ref.path);return readFileSync(local(ref.path));}
export function assertClosed(value,names){assert.ok(value!==null&&typeof value==='object'&&!Array.isArray(value));assert.deepEqual(Object.keys(value).sort(),[...names].sort(),'UNKNOWN_OR_MISSING_FIELD');}
const unique=values=>{assert.equal(new Set(values).size,values.length,'DUPLICATE');};
const rel=path=>relative(root,path).replaceAll('\\','/');
export function writeCanonical(path,value,{immutable=false}={}){const target=local(path);mkdirSync(resolve(target,'..'),{recursive:true});writeFileSync(target,canonical(value),{flag:immutable?'wx':'w'});return reference(path);}
const catalogPath='repositories/cca-conformance/tools/mo1305-phase2c/case-catalog.json';
export function catalog(){const value=parseCanonical(readFileSync(local(catalogPath)));assert.equal(value.kind,'MemoryOSRESTPhase2CCaseCatalog');assert.equal(value.version,'1.0.0');assert.deepEqual(Object.keys(value.modules).sort(),[...modules].sort());for(const rows of Object.values(value.modules)){assert.ok(rows.length>0);unique(rows.map(row=>row.id));for(const row of rows){assert.deepEqual(Object.keys(row).sort(),['category','id','schema']);assert.ok(row.schema&&typeof row.schema==='object');assert.equal(typeof row.id,'string');assert.equal(typeof row.category,'string');}}return value;}
function regressionInputReferences(){
 const paths=new Set(Object.values(regressionGroups).flatMap(group=>group.files));
 const files=[
  'repositories/memoryos-cli/tests/test-helpers.mjs','repositories/memoryos-cli/package.json',
  'repositories/memoryos-mcp/tests/corpus.mjs','repositories/memoryos-mcp/package.json','repositories/memoryos-mcp/package-lock.json','repositories/memoryos-mcp/distribution/dependency-closure.json','repositories/memoryos-mcp/distribution/dependency-lock.json',
  'repositories/memoryos-vscode/tests/support/runtime-test-api.ts','repositories/memoryos-vscode/src/errors.ts','repositories/memoryos-vscode/scripts/esbuild-closed-source.mjs','repositories/memoryos-vscode/scripts/build-runtime-distribution.mjs','repositories/memoryos-vscode/package.json','repositories/memoryos-vscode/package-lock.json',
  'repositories/cca-conformance/tests/support/mo1302-action-foundation-support.mjs','repositories/cca-conformance/tools/json-schema-validator.mjs','repositories/cca-conformance/schema/github-policy-gate-test-vector-1.0.schema.json',
  'repositories/cca-studio/web/js/app.js','.github/actions/memoryos-policy-gate/distribution-manifest.json','.github/actions/memoryos-policy-gate/action.yml'
 ];
 const trees=[
  'repositories/memoryos-cli/src','repositories/memoryos-cli/bin',
  'repositories/memoryos-mcp/src','repositories/memoryos-mcp/runtime','repositories/memoryos-mcp/contracts',
  'repositories/memoryos-vscode/src/runtime','repositories/memoryos-vscode/runtime','repositories/memoryos-vscode/contracts',
  'repositories/cca-studio/tests/fixtures/mip','repositories/cca-studio/tests/fixtures/investigation-policy/1.0.0','repositories/cca-studio/tests/fixtures/adapters','repositories/cca-studio/web/js/adapters',
  'repositories/cca-conformance/tests/fixtures/github-policy-gate/1.0.0','repositories/cca-conformance/tests/fixtures/investigation-policy/1.0.0','.github/actions/memoryos-policy-gate/dist'
 ];
 const walk=path=>{for(const entry of readdirSync(local(path),{withFileTypes:true})){const member=path+'/'+entry.name;if(entry.isDirectory())walk(member);else{assert.ok(entry.isFile(),'REGRESSION_INPUT_NOT_FILE');paths.add(member);}}};
 for(const file of files)paths.add(file);for(const tree of trees)walk(tree);
 return [...paths].sort().map(reference);
}
export function bindInputs(){
  const packagePrefix='repositories/memoryos-rest/',manifest=JSON.parse(readFileSync(local(packagePrefix+'distribution-manifest.json')));
  const production=[reference(packagePrefix+'distribution-manifest.json')];
  for(const row of manifest.files){const ref=reference(packagePrefix+row.path);assert.equal(ref.byteLength,row.byteLength);assert.equal(ref.sha256,row.sha256);production.push(ref);}
  const limits=JSON.parse(readFileSync(local(packagePrefix+'contracts/limits.json')));assert.equal(limits.state,'FINAL');
  const closure=JSON.parse(readFileSync(local(packagePrefix+'runtime/runtime-closure-manifest.json')));
  const sdk=closure.files.map(row=>{const ref=reference(row.source);assert.equal(ref.byteLength,row.byteLength);assert.equal(ref.sha256,row.sha256);return ref;});assert.equal(sdk.length,25);
  const fixturePrefix='repositories/cca-conformance/fixtures/mo1305-phase1/',index=JSON.parse(readFileSync(local(fixturePrefix+'index.json')));
  const fixtures=[reference(fixturePrefix+'index.json'),...index.files.map(row=>{const ref=reference(fixturePrefix+row.path);assert.equal(ref.byteLength,row.byteLength);assert.equal(ref.sha256,row.sha256);return ref;})];
  const harnessPrefix='repositories/cca-conformance/tools/mo1305-phase2c/';
  const harness=readdirSync(import.meta.dirname).filter(name=>(name.endsWith('.mjs')||name==='case-catalog.json')).sort().map(name=>reference(harnessPrefix+name));
  const authority=['docs/mo1305-rest-gateway.md','docs/mo1305-contract-freeze-1.md','docs/mo1305-contract-freeze-1-platform-correction.md','docs/mo1305-contract-freeze-1-verification-methodology-correction.md','docs/mo1305-host-interruption-validity.md','repositories/cca-conformance/tools/mo1305-host-guard.mjs','repositories/cca-conformance/tools/mo1305-host-guard-policy.json','repositories/cca-conformance/tools/mo1305-host-events.ps1','repositories/cca-conformance/tools/mo1305-phase1/validate-launch.ps1','repositories/cca-conformance/evidence/mo1305-phase1-binding/binding.json'].map(reference);
  const regressionSources=regressionInputReferences();
  for(const list of [production,sdk,fixtures,harness,authority,regressionSources]){list.sort((a,b)=>a.path<b.path?-1:a.path>b.path?1:0);unique(list.map(ref=>ref.path));}
  return {baseline,node:{version:'24.21.0',sha256:nodeSha256},production,sdk,fixtures,harness,authority,regressionSources,caseCatalog:reference(catalogPath),limitsState:'FINAL'};
}
export function validateBinding(binding){assertClosed(binding,['baseline','node','production','sdk','fixtures','harness','authority','regressionSources','caseCatalog','limitsState']);assert.equal(binding.baseline,baseline);assert.deepEqual(binding.node,{version:'24.21.0',sha256:nodeSha256});assert.deepEqual(binding,bindInputs(),'CANDIDATE_OR_HARNESS_CHANGED');return sha(canonical(binding));}
export function normalizeRecord(record){
  const result={...record};
  if(Object.hasOwn(record,'errorCode')){if(Object.hasOwn(record,'code'))assert.equal(record.code,record.errorCode);result.code=record.errorCode;}
  if(Object.hasOwn(record,'httpStatus')){if(Object.hasOwn(record,'status'))assert.equal(record.status,record.httpStatus);result.status=record.httpStatus;}
  if(!Object.hasOwn(result,'status')&&Object.hasOwn(result,'probeStatus'))result.status=result.probeStatus;
  return result;
}

export function validateShape(value,schema){
  if(Object.hasOwn(schema,'const')){assert.deepEqual(value,schema.const,'OBSERVED_VALUE_CHANGED');return;}
  if(schema.oneOf){assert.ok(schema.oneOf.some(option=>{try{validateShape(value,option);return true;}catch{return false;}}),'OBSERVED_VARIANT');return;}
  if(schema.type==='null'){assert.equal(value,null);return;}
  if(schema.type==='array'){assert.ok(Array.isArray(value));return;}
  assert.equal(typeof value,schema.type,'OBSERVED_FIELD_TYPE');
  if(schema.type==='object'){assert.ok(value!==null&&!Array.isArray(value));for(const [key,child] of Object.entries(schema.fields)){assert.ok(Object.hasOwn(value,key),'MISSING_OBSERVED_FIELD '+key);validateShape(value[key],child);}}
  if(schema.type==='number')assert.ok(Number.isSafeInteger(value)&&value>=0,'INVALID_OBSERVED_NUMBER');
  if(schema.pattern)assert.match(value,new RegExp(schema.pattern,'u'));
}
function validateInterop(attempt){
 const {records,provenance}=attempt.result;assert.ok(provenance,'MISSING_INDEPENDENT_ORACLE');
 const clients=['raw-tls','node-fetch','curl'];assert.deepEqual(provenance.perClient,Object.fromEntries(clients.map(client=>[client,17])));
 const operations=['evaluatePolicy','getContractIdentities','getHealth','getReadiness','getVersion','preparePolicy','preparePolicySet','verifyEvaluationIdentity','verifyPolicyOutcome'];
 assert.deepEqual(provenance.closedOperations,operations);
 for(const client of clients){const rows=records.filter(row=>row.client===client);assert.equal(rows.length,17);assert.deepEqual([...new Set(rows.map(row=>row.operation))].sort(),operations);assert.deepEqual([...new Set(rows.map(row=>row.decision).filter(Boolean))].sort(),['COULD_NOT_EVALUATE','FAIL','PASS']);}
 const baselineRows=records.filter(row=>row.client==='raw-tls');
 for(const row of baselineRows)for(const client of clients.slice(1)){const other=records.find(item=>item.id===client+'-'+row.id.slice('raw-tls-'.length));assert.ok(other);assert.deepEqual(other.responseBody,row.responseBody,'CLIENT_RESPONSE_PARITY');assert.deepEqual(other.normativeProducts,row.normativeProducts,'CLIENT_NORMATIVE_PARITY');}
 const oracle=provenance.oracle;assert.equal(oracle.source,'repositories/cca-studio/web/js/memoryos-sdk.js');assert.equal(oracle.sdkVersion,'1.1.0');assert.equal(oracle.freshlyComputed,true);assert.equal(oracle.restAsOracle,false);assert.equal(oracle.closureFilesChecked,25);assert.equal(oracle.closureManifestSha256,attempt.binding.production.find(ref=>ref.path.endsWith('/runtime/runtime-closure-manifest.json')).sha256);
 const gateway=provenance.gateway;assert.equal(gateway.entry,'package/bin/memoryos-rest.mjs');assert.equal(gateway.productionWorker,true);assert.equal(gateway.workerSubstitution,false);assert.equal(gateway.exitCode,0);assert.ok(attempt.processes.some(item=>item.pid===gateway.processId&&item.started&&item.exitCode===0));
 for(const record of records)assert.equal(record.gatewayProcessId,gateway.processId);
 assert.deepEqual(provenance.clients.node,{version:'24.21.0',sha256:nodeSha256});assert.match(provenance.clients.curl.sha256,/^[0-9a-f]{64}$/u);assert.equal(provenance.clients.curl.certificateVerification,true);assert.equal(provenance.clients.curl.httpVersion,'1.1');assert.equal(provenance.clients.curl.tlsMinimum,'1.3');assert.equal(provenance.clients.curl.tlsMaximum,'1.3');
}

export function validateRecordSet(records,expected){
  assert.ok(Array.isArray(records));assert.equal(records.length,expected.length,'CASE_COUNT');unique(records.map(record=>record.id));
  const index=new Map(expected.map(row=>[row.id,row.category])),schemas=new Map(expected.map(row=>[row.id,row.schema]));
  for(const original of records){const record=normalizeRecord(original);assert.equal(record.state,'PASS','CASE_NOT_PASS');assert.equal(record.category,index.get(record.id),'CASE_ID_OR_CATEGORY');if(schemas.get(record.id))validateShape(original,schemas.get(record.id));
    if(typeof record.code==='string'&&record.code.startsWith('MO1305_')){assert.ok(Object.hasOwn(errorStatuses,record.code),'UNKNOWN_GATEWAY_CODE');const status=record.status??record.probeStatus??null;assert.equal(status,errorStatuses[record.code],'FROZEN_ERROR_HTTP_MAPPING');if(record.code==='MO1305_CLIENT_CANCELLED')assert.equal(record.wire,false);}
  }
  return records;
}
function verifyEmbeddedReferences(value){
  if(Array.isArray(value)){for(const item of value)verifyEmbeddedReferences(item);return;}
  if(value===null||typeof value!=='object')return;
  if(Object.hasOwn(value,'path')&&Object.hasOwn(value,'byteLength')&&Object.hasOwn(value,'sha256')){verifyReference(value);return;}
  for(const item of Object.values(value))verifyEmbeddedReferences(item);
}
export function validateAttempt(attempt,{checkBindings=true}={}){
  assertClosed(attempt,['kind','version','module','id','index','state','binding','bindingSha256','runtime','platform','host','processes','result','failure']);
  assert.equal(attempt.kind,'MemoryOSRESTPhase2CAttempt');assert.equal(attempt.version,'1.0.0');assert.ok(modules.includes(attempt.module));assert.match(attempt.id,/^[A-Za-z0-9_-]+$/);
  const bindingHash=checkBindings?validateBinding(attempt.binding):sha(canonical(attempt.binding));assert.equal(attempt.bindingSha256,bindingHash);
  assert.deepEqual(attempt.runtime,{version:'24.21.0',sha256:nodeSha256,platform:'win32',architecture:'x64'});
  assertClosed(attempt.platform,['platform','architecture','type','release','version','build','editionId','displayVersion','productName','currentBuild','ubr','fullBuild']);
  assert.equal(attempt.platform.currentBuild,attempt.platform.build);assert.ok(Number.isSafeInteger(attempt.platform.ubr)&&attempt.platform.ubr>=0);assert.equal(attempt.platform.fullBuild,attempt.platform.release+'.'+attempt.platform.ubr);for(const key of ['editionId','displayVersion','productName'])assert.ok(typeof attempt.platform[key]==='string'&&attempt.platform[key].length>0);
  assert.equal(attempt.platform.platform,'win32');assert.equal(attempt.platform.architecture,'x64');assert.ok(Number(attempt.platform.build)>=22000);assert.match(attempt.platform.release,/^10\.0\./);
  const host=attempt.host;assertClosed(host,['events','observation']);assert.equal(host.observation.policySha256,policySha256);const window=host.observation.validityWindow;
  assert.equal(window.start.domain,window.end.domain);assert.match(window.start.domain,/^MONOTONIC_/);for(const stamp of [window.start,window.end]){assert.match(stamp.ns,/^\d+$/);assert.ok(Number.isSafeInteger(stamp.utcMs));}assert.ok(BigInt(window.end.ns)>=BigInt(window.start.ns));
  const expected=classify({start:window.start,end:window.end,attemptId:attempt.id,candidateId:bindingHash,caseId:attempt.module,phase:'phase2c',index:attempt.index,sampleId:attempt.id},host.events);
  assert.deepEqual(host.observation,expected,'HOST_CLASSIFICATION_MISMATCH');
  if(expected.classification==='HOST_INTERRUPTED'){assert.equal(attempt.state,'HOST_INTERRUPTED');return attempt;}
  if(attempt.failure!==null){assert.equal(attempt.state,'FAIL');return attempt;}
  assert.equal(attempt.state,'PASS');assert.equal(attempt.failure,null);assert.ok(attempt.result&&typeof attempt.result==='object');validateRecordSet(attempt.result.records,catalog().modules[attempt.module]);
  verifyEmbeddedReferences(attempt.result);if(attempt.module==='interop')validateInterop(attempt);
  if(attempt.module==='regressions'){
    for(const record of attempt.result.records){validateRegressionMembership(record);assert.equal(record.exitCode,0);const log=verifyReference(record.log).toString().replaceAll('\r\n','\n');const summaries=[...log.matchAll(/^# (tests|pass|fail|skipped) (\d+)$/gm)];assert.equal(summaries.length,4,'REGRESSION_SUMMARY_COUNT');assert.deepEqual(Object.fromEntries(summaries.map(match=>[match[1],Number(match[2])])),record.counts,'REGRESSION_COUNTS');}
    return attempt;
  }
  assert.ok(Array.isArray(attempt.processes)&&attempt.processes.length>0,'MISSING_PROCESS_EVIDENCE');
  for(const item of attempt.processes){assertClosed(item,['pid','entry','launchMode','started','exitCode','signal']);assert.equal(typeof item.started,'boolean');assert.equal(typeof item.entry,'string');assert.ok(item.entry.length>0&&item.entry.length<512);assert.ok(['production-entrypoint','production-forwarding-observer','explicit-test-launcher'].includes(item.launchMode));assert.ok(Number.isInteger(item.pid)&&item.pid>0);assert.ok(Number.isInteger(item.exitCode),'PROCESS_NOT_REAPED');assert.ok([0,1,2].includes(item.exitCode));}
  assert.ok(attempt.processes.some(item=>item.started&&(item.launchMode==='production-entrypoint'||item.launchMode==='production-forwarding-observer')),'NO_GATEWAY_PROCESS');
  return attempt;
}
export function persistAttempt(attempt){validateAttempt(attempt);return writeCanonical(`repositories/cca-conformance/evidence/mo1305-phase2c/runs/${attempt.id}.json`,attempt,{immutable:true});}
export function publishModule(module,attempts){
  assert.ok(modules.includes(module));assert.ok(attempts.length>=1&&attempts.length<=4);const values=attempts.map(ref=>validateAttempt(parseCanonical(verifyReference(ref))));
  for(const [index,value] of values.entries()){assert.equal(value.module,module);assert.equal(value.index,index);if(index<values.length-1)assert.equal(value.state,'HOST_INTERRUPTED');}
  unique(values.map(value=>value.id));const last=values.at(-1),state=last.state==='PASS'?'PASS':last.state==='HOST_INTERRUPTED'?'BLOCKED':'FAIL';
  const receipt={kind:'MemoryOSRESTPhase2CModuleReceipt',version:'1.0.0',module,state,bindingSha256:last.bindingSha256,attempts,accepted:state==='PASS'?attempts.at(-1):null,testCount:state==='PASS'?last.result.records.length:0};
  const ref=writeCanonical(`repositories/cca-conformance/evidence/mo1305-phase2c/${module}.json`,receipt);return {ref,receipt};
}
export function verifyModule(module){
  const ref=reference(`repositories/cca-conformance/evidence/mo1305-phase2c/${module}.json`),receipt=parseCanonical(verifyReference(ref));
  assertClosed(receipt,['kind','version','module','state','bindingSha256','attempts','accepted','testCount']);
  assert.equal(receipt.kind,'MemoryOSRESTPhase2CModuleReceipt');assert.equal(receipt.version,'1.0.0');assert.equal(receipt.module,module);assert.equal(receipt.state,'PASS');assert.ok(receipt.attempts.length>=1&&receipt.attempts.length<=4);
  const attempts=receipt.attempts.map(item=>validateAttempt(parseCanonical(verifyReference(item))));unique(attempts.map(value=>value.id));
  for(const [index,value] of attempts.entries()){assert.equal(value.module,module);assert.equal(value.index,index);assert.equal(value.bindingSha256,receipt.bindingSha256);assert.equal(value.state,index===attempts.length-1?'PASS':'HOST_INTERRUPTED');}
  assert.deepEqual(receipt.accepted,receipt.attempts.at(-1));assert.equal(receipt.testCount,attempts.at(-1).result.records.length);
  return {ref,receipt,accepted:attempts.at(-1)};
}
async function products(){
  const verified=modules.map(verifyModule),bindings=verified.map(value=>value.receipt.bindingSha256);assert.equal(new Set(bindings).size,1,'MIXED_CANDIDATES');
  const records=verified.flatMap(value=>value.accepted.result.records.map(normalizeRecord));unique(records.map(record=>record.id));
  const {errorCatalog}=await import('./resources.mjs');const errors=errorCatalog(records);validateRecordSet(errors.records,Object.keys(errorStatuses).map(code=>({id:'CATALOG-'+code.slice(7),category:'error-catalog'})));
  for(const ref of errors.reused)verifyReference(ref);
  const all=[...records,...errors.records],categories=[...new Set(all.map(record=>record.category))].sort();
  return {verified,bindingSha256:bindings[0],records,errors,categories:categories.map(category=>({kind:'MemoryOSRESTPhase2CCategoryReceipt',version:'1.0.0',state:'PASS',category,bindingSha256:bindings[0],modules:verified.filter(value=>value.accepted.result.records.some(record=>record.category===category)||category==='error-catalog').map(value=>value.ref),records:all.filter(record=>record.category===category),reused:category==='error-catalog'?errors.reused:[],reuseJustification:category==='error-catalog'?errors.reuseJustification:null,limitations:category==='error-catalog'?errors.limitations:verified.filter(value=>value.accepted.result.records.some(record=>record.category===category)).flatMap(value=>value.accepted.result.limitations??[])}))};
}
export function verifyValidator(){
  const ref=reference('repositories/cca-conformance/evidence/mo1305-phase2c/validator.json'),value=parseCanonical(verifyReference(ref));
  assertClosed(value,['kind','version','state','exitCode','testCount','nodeVersion','nodeSha256','sources','log']);
  assert.equal(value.kind,'MemoryOSRESTPhase2CValidatorTests');assert.equal(value.version,'1.0.0');assert.equal(value.state,'PASS');assert.equal(value.exitCode,0);assert.equal(value.testCount,76);assert.equal(value.nodeVersion,'24.21.0');assert.equal(value.nodeSha256,nodeSha256);
  const paths=['repositories/cca-conformance/tools/mo1305-phase2c/evidence.mjs','repositories/cca-conformance/tools/mo1305-phase2c/evidence.test.mjs','repositories/cca-conformance/tools/mo1305-phase2c/case-catalog.json','repositories/cca-conformance/tools/mo1305-host-guard.mjs','repositories/cca-conformance/tools/mo1305-host-guard-policy.json'];
  assert.deepEqual(value.sources,paths.map(reference));
  const log=verifyReference(value.log).toString().replaceAll('\r\n','\n');assert.match(log,/^# tests 76$/m);assert.match(log,/^# pass 76$/m);assert.match(log,/^# fail 0$/m);assert.match(log,/^# skipped 0$/m);
  return ref;
}
export async function aggregate(){
  const value=await products(),categories=value.categories.map(category=>writeCanonical(`repositories/cca-conformance/evidence/mo1305-phase2c/categories/${category.category}.json`,category));
  const validator=verifyValidator();
  const result={kind:'MemoryOSRESTPhase2CSecurityAcceptance',version:'1.0.0',state:'PASS',baseline,bindingSha256:value.bindingSha256,modules:value.verified.map(item=>item.ref),categories,testCount:value.records.length,errorCatalogCount:value.errors.records.length,validator,validatorTestCount:76,hostInterruptedAttempts:value.verified.reduce((sum,item)=>sum+item.receipt.attempts.length-1,0),scope:'Phase 2C security and interoperability; Phase 2A remote lifecycle, Phase 2B distribution and Phase 2D/B2 integration remain separate.'};
  writeCanonical('repositories/cca-conformance/evidence/mo1305-phase2c/index.json',result);return verifyAll();
}
export async function verifyAll(){
  const value=await products(),index=parseCanonical(readFileSync(resolve(evidenceRoot,'index.json')));
  assertClosed(index,['kind','version','state','baseline','bindingSha256','modules','categories','testCount','errorCatalogCount','validator','validatorTestCount','hostInterruptedAttempts','scope']);
  assert.equal(index.kind,'MemoryOSRESTPhase2CSecurityAcceptance');assert.equal(index.version,'1.0.0');assert.equal(index.state,'PASS');assert.equal(index.baseline,baseline);assert.equal(index.bindingSha256,value.bindingSha256);assert.deepEqual(index.modules,value.verified.map(item=>item.ref));assert.equal(index.testCount,value.records.length);assert.equal(index.errorCatalogCount,23);assert.deepEqual(index.validator,verifyValidator());assert.equal(index.validatorTestCount,76);assert.equal(index.hostInterruptedAttempts,value.verified.reduce((sum,item)=>sum+item.receipt.attempts.length-1,0));assert.equal(index.categories.length,value.categories.length);
  unique(index.categories.map(ref=>ref.path));for(const [offset,ref] of index.categories.entries())assert.deepEqual(parseCanonical(verifyReference(ref)),value.categories[offset]);
  return {state:'PASS',modules:value.verified.length,cases:index.testCount,errorCatalogCodes:index.errorCatalogCount,validatorTests:index.validatorTestCount,categories:index.categories.length,hostInterruptedAttempts:index.hostInterruptedAttempts};
}
