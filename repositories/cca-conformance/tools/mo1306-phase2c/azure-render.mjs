import assert from 'node:assert/strict';
import fs from 'node:fs';
import { generate as generateAll } from '../../../memoryos-ci/src/generator.mjs';
import { generate, project, normalizeMetadata } from '../../../memoryos-ci/src/providers/azure.mjs';
import { configuration, digest } from '../../../memoryos-ci/src/contracts.mjs';
import { J } from '../../../memoryos-ci/src/serialization.mjs';
import { projections } from '../../../memoryos-ci/src/errors.mjs';

const fixture=new URL('../../fixtures/mo1306-phase2c/azure/',import.meta.url);
const config=configuration(fs.readFileSync(new URL('../../fixtures/mo1306/evaluate-policy-pass/memoryos-ci.json',import.meta.url)));
const pin='sha256:0123456789abcdef0123456789abcdef0123456789abcdef0123456789abcdef';
const deployment={kind:'MemoryOSCICDDeployment',version:'1.0.0',provider:'azure',distributionDigest:pin,options:{pool:'MemoryOS_Windows'}};
const first=generateAll(config,deployment,pin);
const primary=first.find(row=>row.path==='azure-pipelines.yml');
const rendered=primary.bytes.toString('utf8');
const skeleton=fs.readFileSync(new URL('../../../memoryos-ci/templates/azure.yml.tpl',import.meta.url),'utf8');
assert.equal(rendered,skeleton.replace('{{pool}}',deployment.options.pool).replace('{{configurationDigest}}',digest(J(config))).replace('{{distributionDigest}}',pin));
for(let i=0;i<12;i++)assert.deepEqual(generateAll(config,deployment,pin),first);
const reversed=object=>Object.fromEntries(Object.entries(object).reverse().map(([key,value])=>[key,value&&typeof value==='object'&&!Array.isArray(value)?reversed(value):value]));
assert.deepEqual(generateAll(reversed(config),reversed(deployment),pin),first);
const noDefaults=structuredClone(config);delete noDefaults.timeoutMs;delete noDefaults.providerExtensions;
assert.deepEqual(generateAll(noDefaults,deployment,pin),first);
const cases={PASS:[0,'SUCCESS','SUCCESS'],FAIL:[6,'POLICY_FAIL','FAILURE'],COULD_NOT_EVALUATE:[7,'NOT_EVALUATED','FAILURE'],CONFIGURATION_ERROR:[10,'ADAPTER_ERROR','FAILURE'],INPUT_ERROR:[11,'ADAPTER_ERROR','FAILURE'],SEMANTIC_ERROR:[12,'ADAPTER_ERROR','FAILURE'],TIMEOUT:[13,'TIMEOUT','FAILURE'],CANCELLED:[14,'CANCELLED','CANCELLED'],INTEGRITY_ERROR:[15,'ADAPTER_ERROR','FAILURE'],INTERNAL_ERROR:[16,'ADAPTER_ERROR','FAILURE'],ARTIFACT_ERROR:[17,'ADAPTER_ERROR','FAILURE']};
for(const [kind,[exitCode,klass,jobStatus]] of Object.entries(cases)){
  assert.deepEqual(project(kind),{class:klass,jobStatus});
  assert.equal(projections[kind].exitCode,exitCode);
}
const raw={BUILD_REPOSITORY_NAME:'MemoryOS/project',BUILD_SOURCEVERSION:'A'.repeat(40),BUILD_BUILDID:'42',SYSTEM_JOBID:'job-1',SYSTEM_JOBATTEMPT:'2',BUILD_REASON:'Manual',SYSTEM_PULLREQUEST_PULLREQUESTID:'123'};
assert.deepEqual(normalizeMetadata(raw),{provider:'azure',repository:'MemoryOS/project',revision:'a'.repeat(40),runId:'42',jobId:'job-1',attempt:2,event:'Manual',changeRequest:'123'});
const hostile=['x\n##vso[task.setvariable]','${{ variables.X }}','$[variables.X]','$(SECRET)','https://evil.invalid','C:\\evil.exe','../context','secret=sentinel','x\u0000','x\u001b[31m'];
for(const value of hostile)assert.throws(()=>normalizeMetadata({BUILD_REPOSITORY_NAME:value}));
for(const value of hostile)assert.throws(()=>generate(config,{...deployment,options:{pool:value}}));
const receipt={kind:'MemoryOSCICDAzurePureContract',version:'1.0.0',configurationDigest:digest(J(config)),distributionDigest:pin,pool:deployment.options.pool,
  primarySha256:digest(primary.bytes),primaryByteLength:primary.bytes.length,deterministicCalls:13,keyPermutation:'PASS',normalizedDefaults:'PASS',templateAgreement:'PASS',
  projectionCases:Object.entries(cases).map(([classification,[exitCode,klass,jobStatus]])=>({classification,exitCode,projection:{class:klass,jobStatus}})),metadataNegativeCount:hostile.length,deploymentNegativeCount:hostile.length};
if(process.argv[2]==='--retain'){
  fs.writeFileSync(new URL('azure-pipelines.yml',fixture),primary.bytes,{flag:'wx'});
  fs.writeFileSync(new URL('generation.json',fixture),J(receipt),{flag:'wx'});
}else{
  assert.deepEqual(fs.readFileSync(new URL('azure-pipelines.yml',fixture)),primary.bytes);
  assert.deepEqual(JSON.parse(fs.readFileSync(new URL('generation.json',fixture))),receipt);
}
console.log(J(receipt));
