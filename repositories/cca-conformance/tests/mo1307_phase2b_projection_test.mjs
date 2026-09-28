import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import { canonicalBytes, canonicalDigest, digest, readinessDigest, proofBindingDigest } from '../../memoryos-readiness/src/canonical.mjs';
import { verifyEvidence, verifyResultEvidence } from '../../memoryos-readiness/src/evidence-verifier.mjs';
import { loadBundle, inputOf, repin, envelopeFor, grantFor } from '../tools/mo1307-phase2b/test-support.mjs';
const equalBytes=(a,b)=>assert.deepEqual(canonicalBytes(a),canonicalBytes(b));
const code=(fn,suffix)=>assert.throws(fn,e=>e.code===`MO1307_${suffix}`);
const names=fs.readdirSync(new URL('../fixtures/mo1307/bundles/',import.meta.url)).sort();

for(const name of names)test(`P2B projection and independent result evidence: ${name}`,()=>{
  const b=loadBundle(name),v=verifyEvidence(inputOf(b)),p=v.projection,a=b.result.assessment;
  for(const key of ['candidate','candidateDigest','profile','stage','authorityIdentityDigest','qualifications','history','providers','graph','graphDigest'])equalBytes(p[key],a[key]);
  equalBytes(v.audit,b.result.audit);equalBytes(verifyResultEvidence(inputOf(b),canonicalBytes(b.result)),v);
  assert.equal('readiness' in p,false);assert.equal('gates' in p,false);assert.equal('blockers' in p,false);
  assert.equal(p.claims.length,b.authority.assessment.grants.length);
  assert.equal(p.slots.length,22);assert.equal(p.reuse.length,p.claims.length);
});

test('P2B verified snapshots detach and freeze every returned fact',()=>{
  const b=loadBundle(),input=inputOf(b),v=verifyEvidence(input),before=canonicalBytes(v);
  input.candidateBytes.fill(0);input.files[0].bytes.fill(0);b.authority.assessment.scopeId='altered';
  assert.throws(()=>{v.projection.claims[0].claim.verdict='FAIL';},TypeError);
  assert.deepEqual(canonicalBytes(v),before);
});

test('P2B metadata changes only raw proof binding and diagnostics',()=>{
  const a=verifyEvidence(inputOf(loadBundle('ready'))),b=verifyEvidence(inputOf(loadBundle('metadata-only')));
  equalBytes(a.projection,b.projection);assert.notDeepEqual(a.audit,b.audit);assert.notDeepEqual(a.diagnostics,b.diagnostics);
  const identity='sha256:'+'a'.repeat(64);assert.notEqual(proofBindingDigest(identity,a.audit),proofBindingDigest(identity,b.audit));
});

test('P2B opaque bounded advisory timestamp has no age window or invented syntax',()=>{
  const b=loadBundle('qualified'),e=envelopeFor(b,'SUPPLY_CHAIN_REVIEW'),prior=verifyEvidence(inputOf(b)).projection;
  for(const observedAt of [null,'1900-01-01T00:00:00Z','2099-12-31T23:59:59Z','review snapshot supplied by issuer']){
    e.metadata.observedAt=observedAt;const after=verifyEvidence(repin(b));equalBytes(after.projection,prior);
  }
});

test('P2B deterministic internal projection uses canonical records, not object insertion order',()=>{
  function reverseObjectKeys(value){if(Array.isArray(value))return value.map(reverseObjectKeys);if(value&&typeof value==='object')return Object.fromEntries(Object.keys(value).reverse().map(k=>[k,reverseObjectKeys(value[k])]));return value;}
  const b=loadBundle('qualified'),prior=verifyEvidence(inputOf(b));
  b.candidate=reverseObjectKeys(b.candidate);b.authority=reverseObjectKeys(b.authority);b.manifest=reverseObjectKeys(b.manifest);b.configuration=reverseObjectKeys(b.configuration);
  b.envelopes=new Map([...b.envelopes].reverse().map(([id,e])=>[id,reverseObjectKeys(e)]));b.files=new Map([...b.files].reverse());
  equalBytes(verifyEvidence(repin(b)),prior);
});

test('P2B Freeze-mandated set ordering rejects permutations instead of normalizing signed identity',()=>{
  for(const kind of ['manifest','grants','dependencies','history','providers','files']){
    const b=loadBundle(kind==='history'?'mo1306-qualified':'ready');
    if(kind==='manifest')b.manifest.entries.reverse();
    if(kind==='grants')b.authority.assessment.grants.reverse();
    if(kind==='dependencies')envelopeFor(b,'SEMANTIC_CONFORMANCE').claim.dependencies.reverse();
    if(kind==='history')envelopeFor(b,'HISTORICAL_DISPOSITION').claim.detail.records.reverse();
    if(kind==='providers')b.candidate.providers.reverse();
    const input=repin(b);if(kind==='files')input.files.reverse();
    assert.throws(()=>verifyEvidence(input),e=>e.code==='MO1307_INPUT'||e.code==='MO1307_HISTORY_MISMATCH',kind);
  }
});

test('P2B explicit reuse dispositions preserve unrelated dependency closure',()=>{
  const b=loadBundle('selective-reuse'),v=verifyEvidence(inputOf(b));
  assert.ok(v.projection.reuse.some(r=>r.disposition==='REUSED'));
  for(const r of v.projection.reuse){if(r.disposition==='REUSED'){assert.equal(r.binding,'DEPENDENCY_SET');assert.notEqual(r.originCandidate,r.candidateDigest);}else assert.equal(r.originCandidate,r.candidateDigest);}
  const e=envelopeFor(b,'SEMANTIC_CONFORMANCE');e.claim.dependencies[0].sha256='sha256:'+'0'.repeat(64);code(()=>verifyEvidence(repin(b)),'STALE_EVIDENCE');
});

test('P2B independently reverified source mutation cannot hide behind result self-hashes',()=>{
  const b=loadBundle(),input=inputOf(b),source=input.files.find(f=>b.manifest.entries.find(e=>e.id===f.id).type==='SOURCE');source.bytes[0]^=1;
  code(()=>verifyResultEvidence(input,canonicalBytes(b.result)),'INTEGRITY');
});

for(const field of ['candidate','authorityIdentityDigest','qualification','history','provider','graph','audit','gateBinding'])test(`P2B result evidence tamper: ${field}`,()=>{
  const b=loadBundle('mo1306-qualified'),r=structuredClone(b.result),a=r.assessment;
  if(field==='candidate')a.candidate.expectedTag.target='0'.repeat(40);
  if(field==='authorityIdentityDigest')a.authorityIdentityDigest='sha256:'+'0'.repeat(64);
  if(field==='qualification')a.qualifications.pop();
  if(field==='history')a.history.pop();
  if(field==='provider'){const p=a.providers.find(p=>p.provider==='gitlab');p.execution='LIVE_PROVIDER_CERTIFIED';p.sourceExecutionLabel=p.execution;p.support='SUPPORTED';}
  if(field==='graph'){a.graph.edges.pop();a.graphDigest=canonicalDigest(a.graph);}
  if(field==='audit')r.audit.configurationSha256='sha256:'+'0'.repeat(64);
  if(field==='gateBinding')a.gates[0].claimDigest='sha256:'+'0'.repeat(64);
  a.candidateDigest=canonicalDigest(a.candidate);r.readinessDigest=readinessDigest(a);r.proofBindingDigest=proofBindingDigest(r.readinessDigest,r.audit);
  code(()=>verifyResultEvidence(inputOf(b),canonicalBytes(r)),'RESULT_MISMATCH');
});

test('P2B proof material is exact frozen audit, independent of final readiness calculation',()=>{
  const b=loadBundle('ready'),v=verifyEvidence(inputOf(b));
  assert.equal(proofBindingDigest(b.result.readinessDigest,v.audit),b.result.proofBindingDigest);
  equalBytes(Object.keys(v.audit).sort(),['authoritySources','bindings','candidateFileSha256','configurationSha256','inputs','manifestSha256','trustedAuthorityDigest']);
  assert.equal(v.audit.inputs.length,b.manifest.entries.length);
});
