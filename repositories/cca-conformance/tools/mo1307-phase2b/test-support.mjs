// Engineering-only fixture mutations; never imported by the product.
import fs from 'node:fs';
import { fileURLToPath } from 'node:url';
import { canonicalBytes, canonicalDigest, digest } from '../../../memoryos-readiness/src/canonical.mjs';
export const fixtureRoot = new URL('../../fixtures/mo1307/', import.meta.url);
export const readFixture = relative => fs.readFileSync(new URL(relative, fixtureRoot));
export const fixtureJson = relative => JSON.parse(readFixture(relative));
export function loadBundle(name='ready') {
  const base = `bundles/${name}/`;
  const configuration=fixtureJson(base+'configuration.json'),candidate=fixtureJson(base+'candidate.json');
  const manifest=fixtureJson(base+'manifest.json'),authority=fixtureJson(base+'authority.json');
  const files=new Map(manifest.entries.map(e=>[e.id,readFixture(base+e.path)]));
  const envelopes=new Map(manifest.entries.filter(e=>e.type==='ENVELOPE').map(e=>[e.id,JSON.parse(files.get(e.id))]));
  const pins=fixtureJson(base+'pins.json'),result=fixtureJson(base+'expected-result.json');
  return {name,configuration,candidate,manifest,authority,files,envelopes,pins,result};
}
export function inputOf(b) {
  return {configurationBytes:canonicalBytes(b.configuration),candidateBytes:canonicalBytes(b.candidate),
    manifestBytes:canonicalBytes(b.manifest),authorityBytes:canonicalBytes(b.authority),
    files:[...b.files].map(([id,bytes])=>({id,bytes:Buffer.from(bytes)})).sort((a,b)=>a.id<b.id?-1:1),
    expectedCandidateDigest:b.pins.expectedCandidateDigest,trustedAuthorityDigest:b.pins.trustedAuthorityDigest};
}
// Refresh test-owned pins explicitly. This does not invent trust in production.
// Grant source/dependency/scope fields and manifest origin bindings are preserved
// so mutations can test their independent correspondence.
export function repin(b,{grants=true}={}) {
  for(const [id,envelope] of b.envelopes)b.files.set(id,canonicalBytes(envelope));
  for(const entry of b.manifest.entries){const raw=b.files.get(entry.id);if(raw){entry.byteLength=raw.length;entry.sha256=digest(raw);}}
  if(grants)for(const grant of b.authority.assessment.grants){const e=b.envelopes.get(grant.envelopeId);if(e){grant.claimDigest=canonicalDigest(e.claim);grant.envelopeSha256=digest(b.files.get(grant.envelopeId));}}
  b.authority.manifestSha256=canonicalDigest(b.manifest);
  b.pins.expectedCandidateDigest=canonicalDigest(b.candidate);
  b.pins.trustedAuthorityDigest=canonicalDigest(b.authority);
  return inputOf(b);
}
export const envelopeFor = (b,type,provider=null) => [...b.envelopes.values()].find(e=>e.claim.type===type && (provider===null || e.claim.detail.provider===provider));
export const grantFor = (b,envelope) => b.authority.assessment.grants.find(g=>b.envelopes.get(g.envelopeId)===envelope);
export const throwsCode = (assert,fn,code,stage) => assert.throws(fn,e=>e.code===`MO1307_${code}` && (stage===undefined||e.stage===stage));
export const nativeNode = 'C:/Users/melsa/Documents/Codex/cca-workspace/.cache/mo1304-phase3-toolchain/node-v24.21.0-win-x64/node.exe';
