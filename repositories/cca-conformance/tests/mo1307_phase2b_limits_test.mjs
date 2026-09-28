import test from 'node:test';
import assert from 'node:assert/strict';
import { canonicalBytes, snapshotBytes } from '../../memoryos-readiness/src/canonical.mjs';
import { DEFINITIONS } from '../../memoryos-readiness/src/constants.mjs';
import { inspectFoundationInputs, validateEnvelope, validateManifest, validateRecord } from '../../memoryos-readiness/src/foundation.mjs';
import { verifyEvidence } from '../../memoryos-readiness/src/evidence-verifier.mjs';
import { loadBundle, inputOf, repin, envelopeFor, grantFor, throwsCode } from '../tools/mo1307-phase2b/test-support.mjs';

const L=DEFINITIONS.limits,hash='sha256:'+'a'.repeat(64);
const ids=(count,prefix='item')=>Array.from({length:count},(_,i)=>prefix+'.'+String(i).padStart(4,'0'));
const code=(fn,expected,stage)=>throwsCode(assert,fn,expected,stage);
const clone=structuredClone;

test('L01 authority byte admission includes the exact ceiling and rejects plus one before parse/copy',()=>{
  assert.equal(snapshotBytes(Buffer.alloc(L.authorityBytes),L.authorityBytes).length,1048576);
  const at=inputOf(loadBundle());at.authorityBytes=Buffer.alloc(L.authorityBytes);
  // The boundary passes byte admission, then rejects malformed bytes; this is
  // deliberately not a fabricated successful million-byte authority record.
  code(()=>inspectFoundationInputs(at),'INPUT','CONFIGURATION');
  const over=inputOf(loadBundle());over.authorityBytes=Buffer.alloc(L.authorityBytes+1);
  code(()=>verifyEvidence(over),'RESOURCE_LIMIT','CONFIGURATION');
});

test('L02 envelope byte ceiling is enforced in acquisition before snapshot copying',()=>{
  assert.equal(snapshotBytes(Buffer.alloc(L.envelopeBytes),L.envelopeBytes).length,262144);
  const at=inputOf(loadBundle());at.files.find(f=>f.id==='envelope.security').bytes=Buffer.alloc(L.envelopeBytes);
  code(()=>inspectFoundationInputs(at),'INTEGRITY','INTEGRITY');
  const over=inputOf(loadBundle());over.files.find(f=>f.id==='envelope.security').bytes=Buffer.alloc(L.envelopeBytes+1);
  code(()=>verifyEvidence(over),'RESOURCE_LIMIT','ACQUISITION');
});

test('L03 manifest claim admission is 64 envelopes, independent of the finite gate authority limit',()=>{
  const b=loadBundle(),template=b.manifest.entries.find(e=>e.type==='ENVELOPE');
  b.manifest.entries=ids(L.claims,'envelope').map(id=>({...clone(template),id,path:'envelopes/'+id+'.json'}));
  validateManifest(b.manifest);assert.equal(b.manifest.entries.length,64);
  b.manifest.entries.push({...clone(template),id:'envelope.overflow',path:'envelopes/overflow.json'});
  code(()=>validateManifest(b.manifest),'RESOURCE_LIMIT');
});

test('L04 grant representation admits 64 and rejects 65 without claiming all grants fit the closed profile',()=>{
  const b=loadBundle(),template=b.authority.assessment.grants[0];
  b.authority.assessment.grants=ids(L.grants,'grant').map(id=>({...clone(template),id}));
  validateRecord('Authority',b.authority);assert.equal(b.authority.assessment.grants.length,64);
  b.authority.assessment.grants.push({...clone(template),id:'grant.overflow'});
  code(()=>validateRecord('Authority',b.authority),'RESOURCE_LIMIT');
});

test('L05 claim dependencies and every explicit dependency reference list admit 1024 and reject 1025',()=>{
  const b=loadBundle(),e=envelopeFor(b,'SECURITY_AUDIT'),g=grantFor(b,e),entry=b.manifest.entries.find(x=>x.id===g.envelopeId);
  e.claim.dependencies=ids(L.dependenciesPerClaim,'component').map(componentId=>({componentId,role:'SOURCE_MEMBER',byteLength:1,sha256:hash}));
  validateEnvelope(e);
  e.claim.dependencies.push({componentId:'component.overflow',role:'SOURCE_MEMBER',byteLength:1,sha256:hash});
  code(()=>validateEnvelope(e),'RESOURCE_LIMIT');
  for(const [definition,record] of [['Grant',g],['ManifestEntry',entry]]){
    record.dependencyIds=ids(L.dependenciesPerClaim,'component');validateRecord(definition,record);
    record.dependencyIds.push('component.overflow');code(()=>validateRecord(definition,record),'RESOURCE_LIMIT');
  }
});

test('L06 root, grant and claim assumption sets admit 32 and reject 33',()=>{
  const b=loadBundle(),e=envelopeFor(b,'SECURITY_AUDIT'),g=grantFor(b,e);
  const assumptions=ids(L.assumptions,'assumption').map(id=>({id,sha256:hash}));
  for(const [definition,record,target] of [['Authority',b.authority,b.authority.assessment],['Grant',g,g],['Evidence',e,e.claim]]){
    target.assumptions=clone(assumptions);validateRecord(definition,record);
    target.assumptions.push({id:'assumption.overflow',sha256:hash});code(()=>validateRecord(definition,record),'RESOURCE_LIMIT');
    target.assumptions=[];
  }
});

test('L07 history representation admits 128 immutable rows and rejects 129',()=>{
  const b=loadBundle('mo1306-qualified'),e=envelopeFor(b,'HISTORICAL_DISPOSITION'),template=e.claim.detail.records[0];
  e.claim.detail.records=ids(L.historyRecords,'history').map((id,i)=>({...clone(template),id,conditionId:'condition.'+String(i).padStart(4,'0')}));
  validateRecord('Evidence',e);assert.equal(e.claim.detail.records.length,128);
  e.claim.detail.records.push({...clone(template),id:'history.overflow',conditionId:'condition.overflow'});
  code(()=>validateRecord('Evidence',e),'RESOURCE_LIMIT');
});

test('L08 qualification representation admits 128 and rejects 129 without truncation',()=>{
  const b=loadBundle(),e=envelopeFor(b,'SECURITY_AUDIT');
  const q={id:'q.example',type:'MemoryOSReadinessQualification',version:'1.0.0',gateIds:['security'],provider:null,scopeId:e.claim.scopeId,reasonCode:'ENVIRONMENT_LIMITATION',impact:'INFORMATIONAL',disclosureCode:'ENVIRONMENT_LIMITATION',conditionIds:[]};
  e.claim.qualifications=ids(L.qualifications,'q').map(id=>({...clone(q),id}));
  validateRecord('Evidence',e);assert.equal(e.claim.qualifications.length,128);
  e.claim.qualifications.push({...q,id:'q.overflow'});code(()=>validateRecord('Evidence',e),'RESOURCE_LIMIT');
});

test('L09 scope qualification/condition reference sets each enforce their exact 128 cap',()=>{
  for(const member of ['qualificationIds','conditionIds']){
    const b=loadBundle(),e=envelopeFor(b,'SCOPE_AUTHORITY');
    e.claim.detail[member]=ids(128,member==='conditionIds'?'condition':'q');validateRecord('Evidence',e);
    e.claim.detail[member].push('zz-overflow');code(()=>validateRecord('Evidence',e),'RESOURCE_LIMIT');
  }
});

test('L10 source references admit 128 and authority source references admit 32 at their declared schemas',()=>{
  const b=loadBundle(),e=envelopeFor(b,'SECURITY_AUDIT'),g=grantFor(b,e);
  for(const [record,definition,member,count] of [[e,'Evidence','sources',128],[g,'Grant','sourceIds',128],[g,'Grant','authoritySourceIds',32]]){
    record[member]=ids(count);validateRecord(definition,record);
    record[member].push('zz-overflow');code(()=>validateRecord(definition,record),'RESOURCE_LIMIT');
    record[member]=['fixture.source'];
  }
});

test('L11 normalized authority and audit digest reference capacities are explicit, not generic INPUT errors',()=>{
  const b=loadBundle(),verified=verifyEvidence(inputOf(b));
  const a=clone(verified.projection.normalizedAuthority);
  const digests=Array.from({length:64},(_,i)=>'sha256:'+i.toString(16).padStart(64,'0'));
  a.normalizedGrants=[...digests];validateRecord('NormalizedAuthority',a);
  a.normalizedGrants.push('sha256:'+'f'.repeat(64));code(()=>validateRecord('NormalizedAuthority',a),'RESOURCE_LIMIT');
  const q={id:'q.example',type:'MemoryOSReadinessQualification',version:'1.0.0',gateIds:['security'],provider:null,scopeId:'fixture.scope',reasonCode:'ENVIRONMENT_LIMITATION',impact:'INFORMATIONAL',disclosureCode:'ENVIRONMENT_LIMITATION',conditionIds:[],candidateDigest:b.pins.expectedCandidateDigest,evidenceClaimDigests:[hash],grantDigests:[hash]};
  for(const member of ['evidenceClaimDigests','grantDigests']){
    q[member]=[...digests];validateRecord('DerivedQualification',q);
    q[member].push('sha256:'+'f'.repeat(64));code(()=>validateRecord('DerivedQualification',q),'RESOURCE_LIMIT');
    q[member]=[hash];
  }
});

test('L12 independent cap failures never fabricate a partial verified projection',()=>{
  const b=loadBundle();b.authority.assessment.assumptions=ids(33,'assumption').map(id=>({id,sha256:hash}));
  let output=null;code(()=>{output=verifyEvidence(repin(b));},'RESOURCE_LIMIT');assert.equal(output,null);
  // Parser/value/Unicode/depth boundaries are the shared Phase 1 C05-C10/C21
  // regressions, exercised without duplicating or replacing that serializer.
  assert.ok(canonicalBytes({closed:true}).length>0);
});
