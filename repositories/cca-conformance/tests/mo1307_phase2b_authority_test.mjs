import test from 'node:test';
import assert from 'node:assert/strict';
import { canonicalBytes, canonicalDigest, digest, proofBindingDigest } from '../../memoryos-readiness/src/canonical.mjs';
import { inspectFoundationInputs } from '../../memoryos-readiness/src/foundation.mjs';
import { verifyEvidence } from '../../memoryos-readiness/src/evidence-verifier.mjs';
import { loadBundle, inputOf, repin, envelopeFor, grantFor, throwsCode } from '../tools/mo1307-phase2b/test-support.mjs';

const otherDigest='sha256:'+'f'.repeat(64);
const code=(fn,expected,stage)=>throwsCode(assert,fn,expected,stage);
const check=(b)=>verifyEvidence(inputOf(b));
const envelopeEntry=(b,e)=>b.manifest.entries.find(x=>x.id===grantFor(b,e).envelopeId);
const sortIds=rows=>rows.sort((a,b)=>a.id<b.id?-1:a.id>b.id?1:0);

test('A01 all sixteen frozen bundles produce only verified claims and exact independent graph/audit identities',()=>{
  for(const name of ['ready','qualified','rest-qualified','not-ready','could-not-evaluate','mixed-precedence','informational-ready','history-blocker-unavailable','metadata-only','selective-reuse','post-tag-ready','post-tag-absent','post-tag-wrong-target','post-tag-lightweight','pre-tag-present','mo1306-qualified']){
    const b=loadBundle(name),actual=check(b),expected=b.result;
    assert.deepEqual(canonicalBytes(actual.projection.graph),canonicalBytes(expected.assessment.graph),name);
    assert.equal(actual.projection.graphDigest,expected.assessment.graphDigest,name);
    assert.equal(actual.projection.authorityIdentityDigest,expected.assessment.authorityIdentityDigest,name);
    assert.deepEqual(canonicalBytes(actual.audit),canonicalBytes(expected.audit),name);
    assert.equal(proofBindingDigest(expected.readinessDigest,actual.audit),expected.proofBindingDigest,name);
    assert.ok(!Object.hasOwn(actual.projection,'readiness'));
    assert.equal(actual.projection.claims.length,b.authority.assessment.grants.length,name);
  }
});

test('A02 operator authority pin is separate and rejects an independently wrong trust root',()=>{
  const b=loadBundle(),input=inputOf(b);input.trustedAuthorityDigest=otherDigest;
  code(()=>verifyEvidence(input),'EVIDENCE_AUTHORITY','CONFIGURATION');
  const forged=inputOf(b);forged.trustedAuthorityDigest=undefined;
  code(()=>verifyEvidence(forged),'USAGE','LAUNCH');
  b.configuration.trustedAuthorityDigest=b.pins.trustedAuthorityDigest;
  code(()=>verifyEvidence(repin(b)),'CONFIGURATION','CONFIGURATION');
});

test('A03 an evidence-controlled authority mutation cannot select its own new pin',()=>{
  const b=loadBundle(),input=inputOf(b);b.authority.assessment.grants[0].claimDigest=otherDigest;
  input.authorityBytes=canonicalBytes(b.authority);
  code(()=>verifyEvidence(input),'EVIDENCE_AUTHORITY','CONFIGURATION');
});

test('A04 raw source bytes and raw length are verified independently of intact claim identity',()=>{
  for(const operation of ['bytes','length']){
    const b=loadBundle(),input=inputOf(b),file=input.files.find(f=>f.id==='fixture.source');
    file.bytes=Buffer.from(file.bytes);
    if(operation==='bytes')file.bytes[0]^=1;else file.bytes=Buffer.concat([file.bytes,Buffer.from('x')]);
    code(()=>verifyEvidence(input),'INTEGRITY','INTEGRITY');
  }
});

test('A05 raw manifest identity and envelope hash cannot be repaired by a self-consistent claim hash',()=>{
  const b=loadBundle(),input=inputOf(b);b.manifest.entries[0].sha256=otherDigest;input.manifestBytes=canonicalBytes(b.manifest);
  code(()=>verifyEvidence(input),'INTEGRITY','CONFIGURATION');
  const changed=loadBundle(),e=envelopeFor(changed,'SECURITY_AUDIT');e.metadata.runId='raw-metadata-mutated';
  code(()=>verifyEvidence(repin(changed,{grants:false})),'EVIDENCE_AUTHORITY','AUTHORITY');
});

test('A06 exact canonical claim digest is recomputed under an intact reviewed envelope grant',()=>{
  const b=loadBundle(),g=grantFor(b,envelopeFor(b,'SECURITY_AUDIT'));g.claimDigest=otherDigest;
  code(()=>verifyEvidence(repin(b,{grants:false})),'EVIDENCE_AUTHORITY','AUTHORITY');
});

test('A07 ungranted external evidence cannot satisfy a gate',()=>{
  const b=loadBundle();b.authority.assessment.grants=b.authority.assessment.grants.filter(g=>g.id!=='grant.security');
  code(()=>verifyEvidence(repin(b)),'INPUT','AUTHORITY');
});

test('A08 unknown evidence type and evidence version fail closed',()=>{
  const b=loadBundle();envelopeFor(b,'SECURITY_AUDIT').claim.type='ARBITRARY_CERTIFICATE';
  code(()=>verifyEvidence(repin(b)),'INPUT','INTEGRITY');
  const v=loadBundle();envelopeFor(v,'SECURITY_AUDIT').claim.version='2.0.0';
  code(()=>verifyEvidence(repin(v)),'EVIDENCE_VERSION','INTEGRITY');
});

test('A09 granting the wrong existing claim for a compiled gate is rejected',()=>{
  const b=loadBundle();b.authority.assessment.slots.find(s=>s.gateId==='security').grantIds=['grant.semantic'];
  code(()=>verifyEvidence(repin(b)),'EVIDENCE_AUTHORITY','AUTHORITY');
});

test('A10 exact grant source IDs cannot substitute or omit the envelope lineage',()=>{
  const b=loadBundle(),g=grantFor(b,envelopeFor(b,'SECURITY_AUDIT'));g.sourceIds=['authority.fixture'];
  code(()=>verifyEvidence(repin(b)),'EVIDENCE_AUTHORITY','AUTHORITY');
});

test('A11 source bytes cannot appoint themselves as authority provenance',()=>{
  const b=loadBundle(),g=grantFor(b,envelopeFor(b,'SECURITY_AUDIT'));g.authoritySourceIds=['fixture.source'];
  code(()=>verifyEvidence(repin(b)),'EVIDENCE_AUTHORITY','AUTHORITY');
});

test('A12 authority source Git fields, classification, length, hash and released target bind exactly',()=>{
  for(const property of ['blob','revision','tree','path','byteLength','sha256','classification']){
    const b=loadBundle(),source=b.authority.provenance[0];
    if(property==='path')source.path='different/source.data';
    else if(property==='byteLength')source.byteLength++;
    else if(property==='classification')source.classification='FREEZE_SCOPE_AUTHORITY';
    else if(property==='sha256')source.sha256=otherDigest;
    else source[property]='9'.repeat(40);
    code(()=>verifyEvidence(repin(b)),'EVIDENCE_AUTHORITY','AUTHORITY');
  }
  const b=loadBundle('mo1306-qualified'),source=b.authority.provenance.find(s=>s.classification==='RELEASED_BINDING');
  source.releaseTag.target='9'.repeat(40);
  code(()=>verifyEvidence(repin(b)),'EVIDENCE_AUTHORITY','AUTHORITY');
});

test('A13 candidate, manifest and independently reviewed component/contract closures cannot be substituted',()=>{
  const b=loadBundle(),input=inputOf(b);input.expectedCandidateDigest=otherDigest;
  code(()=>verifyEvidence(input),'CANDIDATE_MISMATCH','CONFIGURATION');
  for(const member of ['candidateDigest','requiredComponents','semanticContracts']){
    const v=loadBundle();
    if(member==='candidateDigest')v.authority.assessment.candidateDigest=otherDigest;
    else v.authority.assessment[member][0].sha256=otherDigest;
    code(()=>verifyEvidence(repin(v)),'CANDIDATE_MISMATCH','AUTHORITY');
  }
});

test('A14 whole-candidate claims cannot use an earlier candidate root',()=>{
  const b=loadBundle(),e=envelopeFor(b,'FINAL_BINDING');e.claim.originCandidate=otherDigest;
  envelopeEntry(b,e).candidateBinding=otherDigest;
  code(()=>verifyEvidence(repin(b)),'CANDIDATE_MISMATCH','AUTHORITY');
});

test('A15 a manifest cannot relabel a claim origin or dependency identity',()=>{
  const b=loadBundle(),e=envelopeFor(b,'SECURITY_AUDIT');envelopeEntry(b,e).candidateBinding=otherDigest;
  code(()=>verifyEvidence(repin(b)),'INTEGRITY','AUTHORITY');
  const d=loadBundle(),claim=envelopeFor(d,'SECURITY_AUDIT');envelopeEntry(d,claim).dependencyIds=[];
  code(()=>verifyEvidence(repin(d)),'INTEGRITY','AUTHORITY');
});

test('A16 declared dependency role, length and content are checked against the current inventory',()=>{
  for(const member of ['role','byteLength','sha256']){
    const b=loadBundle(),e=envelopeFor(b,'SECURITY_AUDIT'),d=e.claim.dependencies[0];
    if(member==='role')d.role='DOCUMENTATION';else if(member==='byteLength')d.byteLength++;else d.sha256=otherDigest;
    code(()=>verifyEvidence(repin(b)),'STALE_EVIDENCE','AUTHORITY');
  }
});

test('A17 minimum dependency closure cannot omit any relevant current component',()=>{
  const b=loadBundle(),e=envelopeFor(b,'SECURITY_AUDIT'),g=grantFor(b,e);
  e.claim.dependencies=e.claim.dependencies.filter(d=>d.role!=='SECURITY_CONTROL');
  g.dependencyIds=e.claim.dependencies.map(d=>d.componentId);envelopeEntry(b,e).dependencyIds=[...g.dependencyIds];
  code(()=>verifyEvidence(repin(b)),'EVIDENCE_AUTHORITY','AUTHORITY');
});

test('A18 changed declared grant closure and dangling dependency IDs reject rather than first-win',()=>{
  const b=loadBundle(),e=envelopeFor(b,'SECURITY_AUDIT');grantFor(b,e).dependencyIds=[];
  code(()=>verifyEvidence(repin(b)),'EVIDENCE_AUTHORITY','AUTHORITY');
  const dangling=loadBundle(),claim=envelopeFor(dangling,'SECURITY_AUDIT'),g=grantFor(dangling,claim);
  claim.claim.dependencies[0].componentId='missing-component';claim.claim.dependencies.sort((a,b)=>a.componentId<b.componentId?-1:1);
  g.dependencyIds=claim.claim.dependencies.map(d=>d.componentId);envelopeEntry(dangling,claim).dependencyIds=[...g.dependencyIds];
  code(()=>verifyEvidence(repin(dangling)),'INPUT','AUTHORITY');
});

test('A19 scope escalation and unapproved/changed assumptions are stale',()=>{
  for(const mutation of ['scope','assumption','grant-assumption']){
    const b=loadBundle(),e=envelopeFor(b,'SECURITY_AUDIT'),g=grantFor(b,e);
    if(mutation==='scope')e.claim.scopeId='escalated.scope';
    if(mutation==='assumption')e.claim.assumptions=[{id:'unapproved',sha256:otherDigest}];
    if(mutation==='grant-assumption'){e.claim.assumptions=[{id:'unapproved',sha256:otherDigest}];g.assumptions=structuredClone(e.claim.assumptions);}
    code(()=>verifyEvidence(repin(b)),'STALE_EVIDENCE','AUTHORITY');
  }
});

test('A20 unrelated root assumptions do not stale an approved claim subset',()=>{
  const b=loadBundle();b.authority.assessment.assumptions=[{id:'unrelated',sha256:otherDigest}];repin(b);
  assert.equal(check(b).projection.claims.length,b.authority.assessment.grants.length);
});

test('A21 selective reuse is explicit and unchanged dependencies retain their exact claims',()=>{
  const before=loadBundle(),after=loadBundle('selective-reuse'),a=check(after);
  const original=envelopeFor(before,'SECURITY_AUDIT'),reused=envelopeFor(after,'SECURITY_AUDIT');
  assert.notEqual(before.pins.expectedCandidateDigest,after.pins.expectedCandidateDigest);
  assert.equal(canonicalDigest(original.claim),canonicalDigest(reused.claim));
  assert.ok(a.projection.reuse.length>0);
  assert.ok(a.projection.claims.some(c=>c.claimDigest===canonicalDigest(reused.claim)));
  reused.claim.dependencies[0].sha256=otherDigest;
  code(()=>verifyEvidence(repin(after)),'STALE_EVIDENCE','AUTHORITY');
});

test('A22 REUSED cannot conceal a whole-candidate claim',()=>{
  const b=loadBundle(),e=envelopeFor(b,'FINAL_BINDING');grantFor(b,e).applicability='REUSED';
  code(()=>verifyEvidence(repin(b)),'CANDIDATE_MISMATCH','AUTHORITY');
});

test('A23 old audit snapshots do not invent expiry and bounded disclosure remains mandatory',()=>{
  const b=loadBundle('qualified'),e=envelopeFor(b,'SUPPLY_CHAIN_REVIEW');e.metadata.observedAt='1900-01-01T00:00:00Z';repin(b);
  const verified=check(b);
  assert.ok(verified.projection.qualifications.some(q=>q.reasonCode==='BOUNDED_ADVISORY_REVIEW'));
});

test('A24 permitted fresh raw metadata pins change proof audit but preserve normative projection',()=>{
  const a=check(loadBundle()),b=check(loadBundle('metadata-only'));
  assert.deepEqual(canonicalBytes(a.projection),canonicalBytes(b.projection));
  assert.notEqual(canonicalDigest(a.audit),canonicalDigest(b.audit));
});

test('A25 duplicate IDs, copied normalized grants and unconsumed evidence fail closed',()=>{
  const duplicate=loadBundle();duplicate.authority.assessment.grants.push(structuredClone(duplicate.authority.assessment.grants[0]));sortIds(duplicate.authority.assessment.grants);
  code(()=>verifyEvidence(repin(duplicate)),'INPUT');
  const copied=loadBundle(),g=structuredClone(copied.authority.assessment.grants[0]);g.id='grant.zz-copy';copied.authority.assessment.grants.push(g);sortIds(copied.authority.assessment.grants);
  code(()=>verifyEvidence(repin(copied)),'INPUT','AUTHORITY');
  const extra=loadBundle(),entry=structuredClone(extra.manifest.entries.find(e=>e.id==='fixture.source'));
  entry.id='unconsumed';entry.path='sources/unconsumed.data';extra.manifest.entries.push(entry);sortIds(extra.manifest.entries);extra.files.set(entry.id,Buffer.from('unconsumed'));
  code(()=>verifyEvidence(repin(extra)),'EVIDENCE_AUTHORITY','AUTHORITY');
});

test('A26 explicit unavailable slots omit evidence safely and optional provider slots mirror the parent',()=>{
  const b=loadBundle('could-not-evaluate'),p=check(b).projection;
  assert.ok(p.slots.some(s=>s.availability==='UNAVAILABLE'&&s.claimDigest===null&&s.grantDigest===null));
  const altered=loadBundle();altered.authority.assessment.slots.find(s=>s.gateId==='provider.github.hosted').grantIds=[];
  code(()=>verifyEvidence(repin(altered)),'EVIDENCE_AUTHORITY','AUTHORITY');
});

test('A27 all admitted bytes are snapshots independent of subsequent caller mutations',()=>{
  const b=loadBundle(),input=inputOf(b),verified=verifyEvidence(input),before=canonicalBytes(verified);
  input.files[0].bytes.fill(0);input.authorityBytes.fill(0);input.candidateBytes.fill(0);
  assert.deepEqual(canonicalBytes(verified),before);
});

test('A28 raw source byte ceiling admits exact boundary and rejects plus one',()=>{
  for(const [length,accepted] of [[2097152,true],[2097153,false]]){
    const b=loadBundle();b.files.set('fixture.source',Buffer.alloc(length,65));const input=repin(b);
    if(accepted)assert.ok(verifyEvidence(input).projection.claims.length);else code(()=>verifyEvidence(input),'RESOURCE_LIMIT');
  }
});

test('A29 explicit source and authority references cannot dangle',()=>{
  for(const field of ['sourceIds','authoritySourceIds']){
    const b=loadBundle(),e=envelopeFor(b,'SECURITY_AUDIT');grantFor(b,e)[field]=['missing-reference'];
    if(field==='sourceIds')e.sources=['missing-reference'];
    code(()=>verifyEvidence(repin(b)),'INPUT','AUTHORITY');
  }
});

test('A30 canonical set orders remain normative and are never silently sorted by the verifier',()=>{
  const b=loadBundle();b.manifest.entries.reverse();
  code(()=>verifyEvidence(repin(b)),'INPUT','CONFIGURATION');
  const files=inputOf(loadBundle());files.files.reverse();code(()=>verifyEvidence(files),'INPUT','ACQUISITION');
  const dependencies=loadBundle();envelopeFor(dependencies,'SECURITY_AUDIT').claim.dependencies.reverse();
  code(()=>verifyEvidence(repin(dependencies)),'INPUT','INTEGRITY');
});

test('A31 input map insertion and object member order do not affect verified canonical projection',()=>{
  const b=loadBundle(),before=check(b);b.files=new Map([...b.files].reverse());
  const input=inputOf(b),reordered=Object.fromEntries(Object.entries(input).reverse());
  assert.deepEqual(canonicalBytes(verifyEvidence(reordered)),canonicalBytes(before));
});

test('A32 raw integrity failure wins over later root candidate mismatch',()=>{
  const b=loadBundle();b.authority.assessment.candidateDigest=otherDigest;const input=repin(b);
  input.files.find(f=>f.id==='fixture.source').bytes[0]^=1;
  code(()=>inspectFoundationInputs(input),'INTEGRITY','INTEGRITY');
});

test('A33 an authority failure wins over a later structurally valid provider contradiction',()=>{
  const b=loadBundle('qualified'),e=envelopeFor(b,'PROVIDER_CERTIFICATION','github');
  e.claim.detail.support='SUPPORTED';repin(b);
  grantFor(b,e).claimDigest=otherDigest;
  code(()=>verifyEvidence(repin(b,{grants:false})),'EVIDENCE_AUTHORITY','AUTHORITY');
});

function addSource(b,id,bytes){
  const template=structuredClone(b.manifest.entries.find(e=>e.id==='fixture.source'));
  Object.assign(template,{id,path:'sources/'+id+'.data',byteLength:bytes.length,sha256:digest(bytes)});
  b.manifest.entries.push(template);sortIds(b.manifest.entries);b.files.set(id,bytes);
  const envelope=envelopeFor(b,'SECURITY_AUDIT'),grant=grantFor(b,envelope);
  envelope.sources.push(id);envelope.sources.sort();grant.sourceIds=[...envelope.sources];
}

test('A34 manifest file ceiling admits exactly 128 consumed files and rejects 129',()=>{
  const b=loadBundle();
  while(b.manifest.entries.length<128)addSource(b,'additional.'+String(b.manifest.entries.length).padStart(3,'0'),Buffer.from('opaque source'));
  assert.equal(b.manifest.entries.length,128);assert.ok(verifyEvidence(repin(b)).projection.claims.length);
  addSource(b,'additional.overflow',Buffer.from('opaque source'));
  code(()=>verifyEvidence(repin(b)),'RESOURCE_LIMIT');
});

test('A35 aggregate raw source admission accepts 8 MiB exactly and rejects one additional byte',()=>{
  const b=loadBundle();b.files.set('fixture.source',Buffer.alloc(2097152,65));
  addSource(b,'additional.one',Buffer.alloc(2097152,66));
  addSource(b,'additional.two',Buffer.alloc(2097152,67));
  addSource(b,'additional.remainder',Buffer.alloc(0));repin(b);
  const rest=b.manifest.entries.reduce((sum,e)=>sum+e.byteLength,0);
  b.files.set('additional.remainder',Buffer.alloc(8388608-rest,68));const input=repin(b);
  assert.equal(b.manifest.entries.reduce((sum,e)=>sum+e.byteLength,0),8388608);
  assert.ok(verifyEvidence(input).projection.claims.length);
  b.files.set('additional.remainder',Buffer.concat([b.files.get('additional.remainder'),Buffer.from('x')]));
  code(()=>verifyEvidence(repin(b)),'RESOURCE_LIMIT');
});

test('A36 authority source ceiling admits 32 explicit provenance records and rejects 33',()=>{
  const b=loadBundle(),original=b.authority.provenance[0],entry=b.manifest.entries.find(e=>e.id===original.id);
  const add=()=>{
    const n=b.authority.provenance.length,id='authority.additional.'+String(n).padStart(2,'0');
    const source={...structuredClone(original),id,path:'reviewed/authority-'+n+'.data'};
    b.authority.provenance.push(source);sortIds(b.authority.provenance);
    const additional={...structuredClone(entry),id,path:'authority-sources/'+id+'.data'};
    additional.git.path=source.path;b.manifest.entries.push(additional);sortIds(b.manifest.entries);b.files.set(id,Buffer.from(b.files.get(original.id)));
  };
  while(b.authority.provenance.length<32)add();
  assert.ok(verifyEvidence(repin(b)).projection.claims.length);
  add();code(()=>verifyEvidence(repin(b)),'RESOURCE_LIMIT');
});
