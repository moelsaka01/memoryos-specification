import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { DEFINITIONS as D } from '../../memoryos-readiness/src/constants.mjs';
import * as api from '../../memoryos-readiness/src/index.mjs';
import { canonicalBytes as J, parseCanonical as P, digest, canonicalDigest, readinessDigest, proofBindingDigest, blockerId, snapshotBytes } from '../../memoryos-readiness/src/canonical.mjs';
import { ReadinessError, serializeError, errorExit, evaluationExit } from '../../memoryos-readiness/src/errors.mjs';
import { validateRecord, validateGraphStructure, selectPhaseError, validateManifest, validateEnvelope, validateCandidate, inspectFoundationInputs, checkDecisionBinding, validateResultIdentity, aggregateReference, validateProviderDetail } from '../../memoryos-readiness/src/foundation.mjs';
import { validateSchema } from '../../memoryos-readiness/src/schema.mjs';

const utf=s=>Buffer.from(s,'utf8');
const code=(fn,expected)=>assert.throws(fn,e=>e.code==='MO1307_'+expected);
test('C01 frozen public exports contain exactly two async functions',()=>{
  assert.deepEqual(Object.keys(api),['evaluateReadiness','verifyReadiness']);
  for(const fn of Object.values(api))assert.equal(fn.constructor.name,'AsyncFunction');
});
test('C02 closed counts and every frozen exit',()=>{
  assert.equal(D.errors.length,21);assert.deepEqual(D.errors.map(e=>e.exit),Array.from({length:21},(_,i)=>10+i));
  assert.equal(Object.keys(D.coverage).length,14);assert.equal(D.gateDefinitions.length,22);
  for(const [state,exit] of Object.entries({READY:0,READY_WITH_QUALIFICATIONS:2,NOT_READY:3,COULD_NOT_EVALUATE:4}))assert.equal(evaluationExit(state),exit);
  code(()=>evaluationExit('UNKNOWN'),'INPUT');
});
test('C03 deterministic key order includes numeric-looking ASCII keys',()=>{
  assert.equal(J({'2':'b','10':'a',z:0,a:1}).toString(),'{"10":"a","2":"b","a":1,"z":0}\n');
  assert.equal(J({b:1,a:2}).toString(),J({a:2,b:1}).toString());
});
test('C04 Unicode scalars are not normalized or escaped unnecessarily',()=>{
  const x={a:'é/𝄞',b:'e\u0301'};assert.equal(J(P(J(x))).toString(),J(x).toString());assert.notEqual(canonicalDigest({x:x.a}),canonicalDigest({x:x.b}));
});
const parserNegatives=[
  ['duplicate-key','{"a":1,"a":2}\n','INPUT'],['escaped-duplicate-key','{"a":1,"\\u0061":2}\n','INPUT'],
  ['unknown-token','undefined\n','INPUT'],['negative-zero','-0\n','INPUT'],['negative-integer','-1\n','INPUT'],
  ['fraction','1.5\n','INPUT'],['exponent','1e2\n','INPUT'],['unsafe-integer','9007199254740992\n','INPUT'],
  ['leading-zero','01\n','INPUT'],['unpaired-surrogate','"\\ud800"\n','INPUT'],['control-string','"\\n"\n','INPUT'],
  ['del-string','"\\u007f"\n','INPUT'],['non-ascii-key','{"é":1}\n','INPUT'],['trailing-garbage','{}x\n','INPUT'],
  ['trailing-comma','{"a":1,}\n','INPUT'],['empty-document','','INPUT'],['noncanonical-spaces','{ "a":1}\n','INTEGRITY'],
  ['missing-lf','{}','INTEGRITY'],['double-lf','{}\n\n','INTEGRITY'],['key-order','{"b":1,"a":2}\n','INTEGRITY'],
  ['unnecessary-escape','"\\u0061"\n','INTEGRITY'],['escaped-solidus','"\\/"\n','INTEGRITY'],['crlf','{}\r\n','INTEGRITY'],
];
for(const [name,bytes,error] of parserNegatives)test('C05 parser '+name,()=>code(()=>P(utf(bytes)),error));
test('C06 invalid UTF-8 and BOM reject',()=>{
  code(()=>P(Buffer.from([0xc0,0xaf])),'INPUT');code(()=>P(Buffer.concat([Buffer.from([239,187,191]),utf('{}\n')])),'INPUT');
});
test('C07 depth limit admits16 and rejects17',()=>{
  const nest=n=>{let x=0;for(let i=1;i<n;i++)x=[x];return x;};P(J(nest(16)));code(()=>J(nest(17)),'RESOURCE_LIMIT');
});
test('C08 members/key/string exact boundaries',()=>{
  const o=Object.fromEntries(Array.from({length:64},(_,i)=>['k'+i,i]));P(J(o));code(()=>J({...o,overflow:0}),'RESOURCE_LIMIT');
  P(J({['k'.repeat(64)]:'x'.repeat(4096)}));code(()=>J({['k'.repeat(65)]:0}),'RESOURCE_LIMIT');code(()=>J('x'.repeat(4097)),'RESOURCE_LIMIT');
  code(()=>J('𝄞'.repeat(2049)),'RESOURCE_LIMIT');
});
test('C09 total values boundary and bounded copy',()=>{
  J(Array(131071).fill(0));code(()=>J(Array(131072).fill(0)),'RESOURCE_LIMIT');
  assert.equal(snapshotBytes(utf('abc'),3).length,3);code(()=>snapshotBytes(utf('abcd'),3),'RESOURCE_LIMIT');
});
test('C10 shared buffers/accessors/sparse arrays/cycles/undefined reject',()=>{
  code(()=>P(new Uint8Array(new SharedArrayBuffer(4))),'INPUT');
  code(()=>J({get leak(){throw Error('secret');}}),'INPUT');code(()=>J(Array(1)),'INPUT');
  const x={};x.x=x;code(()=>J(x),'INPUT');code(()=>J({x:undefined}),'INPUT');code(()=>J(new Date()),'INPUT');
});
test('C11 SHA256 raw/claim/candidate identity and independent proof layer',()=>{
  assert.equal(digest(utf('abc')),'sha256:ba7816bf8f01cfea414140de5dae2223b00361a396177a9cb410ff61f20015ad');
  const a={readiness:'READY'},r=readinessDigest(a);
  assert.notEqual(proofBindingDigest(r,{locator:'one'}),proofBindingDigest(r,{locator:'two'}));
  assert.equal(readinessDigest(a),r);assert.notEqual(r,canonicalDigest(a));
});
test('C12 every error has immutable fields and fixed safe diagnostic',()=>{
  for(const row of D.errors){const e=new ReadinessError(row.suffix,'INTEGRITY','candidate');assert.equal(errorExit(e),row.exit);assert.throws(()=>{e.code='secret';});
    const bytes=serializeError(e);assert.ok(bytes.length<=D.limits.errorRecordBytes);assert.equal(P(bytes).code,row.code);assert.ok(!bytes.includes(utf('stack')));}
  assert.equal(serializeError(Error('token=private-secret')).includes(utf('private-secret')),false);
});
test('C13 errors select numeric exit then ASCII reference within a phase',()=>{
  const checks=[()=>{throw new ReadinessError('INTEGRITY','INTEGRITY','z');},()=>{throw new ReadinessError('INPUT','INTEGRITY','b');},()=>{throw new ReadinessError('INPUT','INTEGRITY','a');}];
  assert.throws(()=>selectPhaseError(checks,'INTEGRITY'),e=>e.code==='MO1307_INPUT'&&e.reference==='a');
});
const config={kind:'MemoryOSReadinessConfiguration',version:'1.0.0',profile:{id:'cicd',version:'1.0.0'},stage:'PRE_TAG_READINESS',candidate:'candidate.json',manifest:'manifest.json'};
test('C14 exact configuration accepted and unknown fields/profiles/versions rejected',()=>{
  validateRecord('Configuration',config);code(()=>validateRecord('Configuration',{...config,token:'secret'}),'INPUT');
  code(()=>validateRecord('Configuration',{...config,version:'2.0.0'}),'EVIDENCE_VERSION');
  code(()=>validateRecord('Configuration',{...config,profile:{id:'core',version:'1.0.0'}}),'PROFILE_MISMATCH');
});
test('C15 no discovery or output/trust fields in configuration',()=>{
  for(const key of ['outputRoot','authority','trustedAuthorityDigest','environment','include','extends'])code(()=>validateRecord('Configuration',{...config,[key]:'x'}),'INPUT');
});
test('C16 deterministic blocker ID excludes mutable claim provenance',()=>{
  const input={gateId:'semantic',reasonCode:'CHECK_FAILED',checkCode:'SEMANTIC_PARITY',conditionId:null};
  assert.match(blockerId(input),/^blocker\.[0-9a-f]{64}$/u);assert.equal(blockerId(input),blockerId({...input,claimDigest:'unused'}));
});
test('C17 error schema is closed and operational outcomes are not readiness states',()=>{
  code(()=>validateSchema('Readiness','MO1307_INPUT'),'INPUT');
  code(()=>validateRecord('Error',{...P(serializeError(new ReadinessError('INPUT','INTEGRITY'))),message:'secret'}),'INPUT');
});
test('C18 no future runtime result from foundation public entry points',async()=>{
  await assert.rejects(api.evaluateReadiness({}),e=>e.code==='MO1307_INPUT');
  await assert.rejects(api.verifyReadiness({}),e=>e.code==='MO1307_INPUT');
  const controller=new AbortController();controller.abort();
  await assert.rejects(api.evaluateReadiness({}, {signal:controller.signal}),e=>e.code==='MO1307_CANCELLED');
});
test('C19 shared definitions are deeply immutable',()=>{
  assert.ok(Object.isFrozen(D));assert.ok(Object.isFrozen(D.limits));assert.throws(()=>{D.limits.apiDeadlineMs=1;});
});
test('C20 generated definitions equal source canonical bytes',()=>{
  const file=new URL('../../memoryos-readiness/contracts/definitions.json',import.meta.url);
  assert.equal(J(D).toString(),readFileSync(file,'utf8'));
});
const fixtureRoot=new URL('../fixtures/mo1307/',import.meta.url);
const fixture=path=>P(readFileSync(new URL(path,fixtureRoot)));
function readyInput(){
  const base='bundles/ready/',manifest=fixture(base+'manifest.json'),pins=fixture(base+'pins.json');
  return {configurationBytes:readFileSync(new URL(base+'configuration.json',fixtureRoot)),candidateBytes:readFileSync(new URL(base+'candidate.json',fixtureRoot)),manifestBytes:readFileSync(new URL(base+'manifest.json',fixtureRoot)),authorityBytes:readFileSync(new URL(base+'authority.json',fixtureRoot)),files:manifest.entries.map(e=>({id:e.id,bytes:readFileSync(new URL(base+e.path,fixtureRoot))})),expectedCandidateDigest:pins.expectedCandidateDigest,trustedAuthorityDigest:pins.trustedAuthorityDigest};
}
test('C21 serializer stops at byte budget before expansive allocation',()=>{
  const shared='x'.repeat(4096);code(()=>J(Array(131000).fill(shared),{maxBytes:16384}),'RESOURCE_LIMIT');
  assert.equal(J('x',{maxBytes:4}).length,4);code(()=>J('x',{maxBytes:3}),'RESOURCE_LIMIT');
});
test('C22 arrays reject hidden properties without reading getters',()=>{
  const a=[1];Object.defineProperty(a,'hidden',{value:'ignored'});code(()=>J(a),'INPUT');
  const b=[1];Object.defineProperty(b,'hidden',{get(){throw Error('secret');}});code(()=>J(b),'INPUT');
});
test('C23 admission errors precede restrictive schema predicates',()=>{
  const m=fixture('bundles/ready/manifest.json');m.entries[0].byteLength=2097153;code(()=>validateManifest(m),'RESOURCE_LIMIT');
  const c=fixture('bundles/ready/candidate.json');c.components=Array(1025).fill(c.components[0]);code(()=>validateCandidate(c),'RESOURCE_LIMIT');
});
test('C24 nested evidence version and coverage mappings',()=>{
  const e=fixture('positive/evidence-security_audit.json');e.claim.version='2.0.0';
  assert.throws(()=>validateEnvelope(e,'selected.claim'),x=>x.code==='MO1307_EVIDENCE_VERSION'&&x.reference==='selected.claim');
  e.claim.version='1.0.0';e.claim.passed.pop();code(()=>validateEnvelope(e),'INTEGRITY');
});
test('C25 profile product mismatch precedes schema INPUT',()=>{
  const c=fixture('bundles/ready/candidate.json');c.product.name='memoryos-rest';code(()=>validateCandidate(c),'PROFILE_MISMATCH');
});
test('C26 defensive internal cycle has GRAPH_CYCLE and bound has GRAPH_LIMIT',()=>{
  code(()=>validateGraphStructure(fixture('negative/graph-cycle.json')),'GRAPH_CYCLE');
  code(()=>validateGraphStructure(fixture('negative/graph-node-limit.json')),'GRAPH_LIMIT');
});
test('C27 configuration errors precede evidence acquisition errors',()=>{
  const input=readyInput();const config=P(input.configurationBytes);config.unknown=true;input.configurationBytes=J(config);input.files=null;
  assert.throws(()=>inspectFoundationInputs(input),e=>e.code==='MO1307_CONFIGURATION'&&e.stage==='CONFIGURATION');
});
test('C28 API holder shape rejects getters/symbols/hidden fields safely',()=>{
  const input=readyInput();Object.defineProperty(input,'secret',{value:1});code(()=>inspectFoundationInputs(input),'INPUT');
  const other=readyInput();other[Symbol('secret')]=1;code(()=>inspectFoundationInputs(other),'INPUT');
  const getter=readyInput();Object.defineProperty(getter,'expectedCandidateDigest',{get(){throw Error('secret');}});code(()=>inspectFoundationInputs(getter),'INPUT');
});
test('C29 well formed bundle reaches explicit foundation guard, never READY',async()=>{
  const input=readyInput();assert.ok(inspectFoundationInputs(input).parsed.candidate);
  await assert.rejects(api.evaluateReadiness(input),e=>e.code==='MO1307_INTERNAL'&&e.stage==='EVALUATION');
});
test('C30 malformed verification versions use their own mismatch categories',()=>{
  const r=fixture('bundles/ready/expected-result.json');const bad=structuredClone(r);bad.version='2.0.0';code(()=>validateResultIdentity(bad),'RESULT_MISMATCH');
  const d={kind:'MemoryOSReadinessHumanDecision',version:'2.0.0',candidateDigest:r.assessment.candidateDigest,readinessDigest:r.readinessDigest,proofBindingDigest:r.proofBindingDigest,decision:'APPROVE',reason:'fixture',actor:null,timestamp:null,authenticity:'NOT_VERIFIED_BY_MEMORYOS',attestation:null};code(()=>checkDecisionBinding(d,r),'DECISION_MISMATCH');
});
test('C31 reference aggregation rejects empty vectors and dangling CNE',()=>{
  code(()=>aggregateReference({gates:[],blockers:[],qualifications:[],cneReasons:[],history:[],providers:[]}),'PROFILE_MISMATCH');
  const a=fixture('bundles/ready/expected-result.json').assessment;
  code(()=>aggregateReference({...a,cneReasons:[{gateId:'made.up',reason:'MISSING',checkCode:null}]}),'INPUT');
});
test('C32 provider representation cannot assert hosted certificate without vectors',()=>{
  const p=fixture('positive/provider-detail.json');p.execution='HOSTED_EXECUTION_CERTIFIED';p.sourceExecutionLabel='HOSTED_EXECUTION_CERTIFIED';p.support='SUPPORTED';code(()=>validateProviderDetail(p),'QUALIFICATION_MISMATCH');
});
test('C33 malformed nested verification records preserve mismatch code and reference',()=>{
  const r=fixture('bundles/qualified/expected-result.json');
  for(const mutate of [value=>{value.assessment.qualifications[0].version='2.0.0';},value=>{value.assessment.profile.id='future';},value=>{value.assessment.candidate.components[0].id='bad\u0000id';}]){
    const bad=structuredClone(r);mutate(bad);
    assert.throws(()=>validateResultIdentity(bad),e=>e.code==='MO1307_RESULT_MISMATCH'&&e.stage==='VERIFICATION'&&e.reference==='result');
  }
  const d={kind:'MemoryOSReadinessHumanDecision',version:'1.0.0',candidateDigest:r.assessment.candidateDigest,readinessDigest:r.readinessDigest,proofBindingDigest:r.proofBindingDigest,decision:'APPROVE',reason:'bad\u0000reason',actor:null,timestamp:null,authenticity:'NOT_VERIFIED_BY_MEMORYOS',attestation:null};
  assert.throws(()=>checkDecisionBinding(d,r),e=>e.code==='MO1307_DECISION_MISMATCH'&&e.stage==='VERIFICATION'&&e.reference==='decision');
});
test('C34 nested authority profile errors use PROFILE_MISMATCH during bootstrap',()=>{
  for(const profile of [{id:'future',version:'1.0.0'},{id:'cicd',version:'2.0.0'}]){
    const input=readyInput(),authority=P(input.authorityBytes);authority.assessment.profile=profile;
    assert.throws(()=>validateRecord('Authority',authority,{stage:'CONFIGURATION',reference:'authority'}),e=>e.code==='MO1307_PROFILE_MISMATCH'&&e.stage==='CONFIGURATION'&&e.reference==='authority');
    input.authorityBytes=J(authority);input.trustedAuthorityDigest=digest(input.authorityBytes);
    assert.throws(()=>inspectFoundationInputs(input),e=>e.code==='MO1307_PROFILE_MISMATCH'&&e.stage==='CONFIGURATION');
  }
});
test('C35 verification shape remapping does not hide admission limits',()=>{
  const r=fixture('bundles/ready/expected-result.json');r.assessment.candidate.components=Array(1025).fill(r.assessment.candidate.components[0]);
  code(()=>validateResultIdentity(r),'RESOURCE_LIMIT');
});
test('C36 known lower GitHub minimum remains valid without fabricated hosted cases',()=>{
  const p={provider:'github',implementation:'NOT_IMPLEMENTED',validation:'NOT_VALIDATED',execution:'NOT_CERTIFIED',sourceExecutionLabel:'NOT_CERTIFIED',support:'UNSUPPORTED',hostedCases:null};
  assert.equal(validateProviderDetail(p),p);
  code(()=>validateProviderDetail({...p,execution:'HOSTED_EXECUTION_CERTIFIED',sourceExecutionLabel:'HOSTED_EXECUTION_CERTIFIED',support:'SUPPORTED'}),'QUALIFICATION_MISMATCH');
});
