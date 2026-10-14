import fs from 'node:fs';
import path from 'node:path';
import assert from 'node:assert/strict';
import {fileURLToPath} from 'node:url';
import {verifyDistribution} from '../../../memoryos-ci/src/integrity.mjs';
import {verifyBundle} from '../../../memoryos-ci/src/verification.mjs';
import {J} from '../../../memoryos-ci/src/serialization.mjs';
import {digest} from '../../../memoryos-ci/src/contracts.mjs';
const root=fileURLToPath(new URL('../../../../',import.meta.url));
const pkg=path.join(root,'repositories/memoryos-ci'),out=path.join(root,'repositories/cca-conformance/evidence/mo1306/phase2d');
const batch=fs.mkdtempSync(path.join(root,'.cache/mo1306-phase2d-retry/security-'));
const native=JSON.parse(fs.readFileSync(path.join(out,'native-execution.json'))),source=path.join(root,native.cases.find(c=>c.id==='generic-pass').bundle);
const installation=verifyDistribution(pkg),cases=[];
for(const [name,file] of [['adapter','src/providers/github.mjs'],['generator','src/generator.mjs'],['SDK','runtime/authoritative/web/js/memoryos-sdk.js']]) {
 const target=path.join(batch,name);fs.cpSync(pkg,target,{recursive:true});fs.appendFileSync(path.join(target,file),'\n// tamper\n');
 assert.throws(()=>verifyDistribution(target));cases.push({id:name+'-substitution',status:'PASS'});
}
function rebind(bundle) {
 const result=fs.readFileSync(path.join(bundle,'memoryos-ci-result.json'));
 const ep=path.join(bundle,'memoryos-ci-evidence.json'),e=JSON.parse(fs.readFileSync(ep));e.resultSha256=digest(result);fs.writeFileSync(ep,J(e));
 const mp=path.join(bundle,'memoryos-ci-artifacts.json'),m=JSON.parse(fs.readFileSync(mp));
 for(const row of m.files){const bytes=fs.readFileSync(path.join(bundle,row.path));row.byteLength=bytes.length;row.sha256=digest(bytes);}
 fs.writeFileSync(mp,J(m));const cp=path.join(bundle,'memoryos-ci-complete.json'),c=JSON.parse(fs.readFileSync(cp));c.manifestSha256=digest(fs.readFileSync(mp));fs.writeFileSync(cp,J(c));
}
const edits={
 'result-byte-tamper':b=>fs.appendFileSync(path.join(b,'memoryos-ci-result.json'),' '),
 'evidence-byte-tamper':b=>fs.appendFileSync(path.join(b,'memoryos-ci-evidence.json'),' '),
 'extra-artifact':b=>fs.writeFileSync(path.join(b,'unexpected.txt'),'x'),
 'provider-rebound-wrong-adapter':b=>{for(const [name,mutate] of [['memoryos-ci-result.json',r=>r.provider='github'],['memoryos-ci-evidence.json',r=>{r.metadata.provider='github';r.adapter.id='memoryos.cicd.adapter.github';}]]){const p=path.join(b,name),v=JSON.parse(fs.readFileSync(p));mutate(v);fs.writeFileSync(p,J(v));}rebind(b);},
 'distribution-rebound':b=>{const p=path.join(b,'memoryos-ci-evidence.json'),v=JSON.parse(fs.readFileSync(p));v.distributionSha256='sha256:'+'0'.repeat(64);fs.writeFileSync(p,J(v));rebind(b);},
 'semantic-rebound':b=>{const p=path.join(b,'policy-outcome.json'),v=JSON.parse(fs.readFileSync(p));v.decision='FAIL';fs.writeFileSync(p,J(v));rebind(b);}
};
await verifyBundle(source,installation);
for(const [name,edit] of Object.entries(edits)) {
 const bundle=path.join(batch,name,path.basename(source));fs.cpSync(source,bundle,{recursive:true});edit(bundle);
 await assert.rejects(()=>verifyBundle(bundle,installation));cases.push({id:name,status:'PASS'});
}
process.stdout.write(J({status:'PASS',passed:cases.length,cases,distributionDigest:installation.identities.distributionDigest,positiveBundleAccepted:true}));
