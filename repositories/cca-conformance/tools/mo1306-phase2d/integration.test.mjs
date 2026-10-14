import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import {fileURLToPath} from 'node:url';
import {configuration,digest} from '../../../memoryos-ci/src/contracts.mjs';
import {J} from '../../../memoryos-ci/src/serialization.mjs';
import {generate} from '../../../memoryos-ci/src/generator.mjs';
import {providerIR,providerNames} from '../../../memoryos-ci/src/provider-ir.mjs';
import {validateGeneratedStructure} from '../../../memoryos-ci/src/generated-structure.mjs';
import {verifyDistribution} from '../../../memoryos-ci/src/integrity.mjs';
import {projections,project} from '../../../memoryos-ci/src/errors.mjs';
const root=fileURLToPath(new URL('../../../..',import.meta.url)),pkg=path.join(root,'repositories/memoryos-ci');
const pin='sha256:'+'a'.repeat(64),config=configuration(fs.readFileSync(new URL('../../fixtures/mo1306/evaluate-policy-pass/memoryos-ci.json',import.meta.url)));
const options={generic:{},gitlab:{runnerTag:'windows'},jenkins:{agentLabel:'windows'},azure:{pool:'windows'},github:{repository:'owner/repo',toolRevision:'b'.repeat(40),configPath:'config/review config.json'}};
const artifact={generic:null,gitlab:'.gitlab-ci.yml',jenkins:'Jenkinsfile',azure:'azure-pipelines.yml',github:'.github/workflows/memoryos-ci.yml'};
const installation=verifyDistribution();
for(const provider of providerNames){
 const deployment={kind:'MemoryOSCICDDeployment',version:'1.0.0',provider,distributionDigest:pin,options:options[provider]};
 test('integrated '+provider+' deterministic closed artifacts and pins',()=>{
  const first=generate(config,deployment,installation.generatorDigest);
  for(let i=0;i<12;i++)assert.deepEqual(generate(Object.fromEntries(Object.entries(config).reverse()),Object.fromEntries(Object.entries(deployment).reverse()),installation.generatorDigest),first);
  assert.deepEqual(first.map(f=>f.path),[...(artifact[provider]?[artifact[provider],'memoryos-ci.json'].sort():['memoryos-ci.json']),'memoryos-ci-generation.json']);
  const manifest=JSON.parse(first.at(-1).bytes);assert.equal(manifest.provider,provider);assert.equal(manifest.generator.sha256,installation.generatorDigest);
  assert.deepEqual(manifest.files,first.slice(0,-1).map(f=>({path:f.path,byteLength:f.bytes.length,sha256:digest(f.bytes)})));
  const {timeoutMs,providerExtensions,...withoutDefaults}=config;
  assert.deepEqual(generate(withoutDefaults,deployment,installation.generatorDigest),first);
  for(const f of first){assert.ok(!f.bytes.includes(13));assert.equal(new TextDecoder('utf8',{fatal:true}).decode(f.bytes),f.bytes.toString('utf8'));}
 });
 test('integrated '+provider+' selected closure and common projections',()=>{
  const selected=verifyDistribution(pkg,provider);assert.equal(selected.identities.adapterDigest,installation.adapterDigests[provider]);
  const adapter=providerIR(provider);for(const classification of Object.keys(projections))assert.deepEqual(adapter.project(classification),project(classification));
  for(const invalid of ['unknown','constructor','__proto__',{},[],null])assert.throws(()=>adapter.project(invalid));
 });
 if(provider==='generic')continue;
 const original=providerIR(provider).generate(config,deployment);
 const mutations={path:f=>f[0].path='../'+f[0].path,extra:f=>f.push(f[0]),extraKey:f=>f[0].extra=true,crlf:f=>f[0].bytes=Buffer.from(f[0].bytes.toString().replaceAll('\n','\r\n')),bom:f=>f[0].bytes=Buffer.concat([Buffer.from([239,187,191]),f[0].bytes]),injection:f=>f[0].bytes=Buffer.concat([f[0].bytes,Buffer.from("injected: 'yes'\n")]),pin:f=>f[0].bytes=Buffer.from(f[0].bytes.toString().replace(pin,'sha256:'+'c'.repeat(64))),unicodeIndent:f=>f[0].bytes=Buffer.from(f[0].bytes.toString().replace('\n  ','\n\u00a0 '))};
 for(const [name,mutate] of Object.entries(mutations))test('integrated '+provider+' structural rejection '+name,()=>{const files=original.map(f=>({...f,bytes:Buffer.from(f.bytes)}));mutate(files);assert.throws(()=>validateGeneratedStructure(config,deployment,files));});
}
test('integrated adapter identity set is exactly five distinct closures',()=>{assert.deepEqual(Object.keys(installation.adapterDigests).sort(),Object.keys(options).sort());assert.equal(new Set(Object.values(installation.adapterDigests)).size,5);});
for(const template of ['gitlab.yml.tpl','jenkins.groovy.tpl','azure.yml.tpl','github.yml.tpl'])test('integrated integrity rejects altered '+template,()=>{
 const cache=path.join(root,'.cache/mo1306-phase2d-retry');fs.mkdirSync(cache,{recursive:true});const copy=fs.mkdtempSync(path.join(cache,'tamper-'));fs.cpSync(pkg,copy,{recursive:true});fs.appendFileSync(path.join(copy,'templates',template),'# changed\n');assert.throws(()=>verifyDistribution(copy));
});
