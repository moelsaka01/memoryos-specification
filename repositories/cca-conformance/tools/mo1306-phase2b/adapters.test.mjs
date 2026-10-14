import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import { spawnSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';
import * as generic from '../../../memoryos-ci/src/providers/generic.mjs';
import * as gitlab from '../../../memoryos-ci/src/providers/gitlab.mjs';
import * as jenkins from '../../../memoryos-ci/src/providers/jenkins.mjs';
import { generate } from '../../../memoryos-ci/src/generator.mjs';
import { configuration,digest } from '../../../memoryos-ci/src/contracts.mjs';
import { diagnosticWriter,projections } from '../../../memoryos-ci/src/errors.mjs';
import { J } from '../../../memoryos-ci/src/serialization.mjs';

const root=fileURLToPath(new URL('../../../../',import.meta.url)),baseline='dbafc0061aa493da2517ee5564f9ea6adb90f52d';
const historical=spawnSync('git',['show',baseline+':repositories/memoryos-ci/contracts/projection.json'],{cwd:root,windowsHide:true});
assert.equal(historical.status,0,historical.stderr?.toString());
// The oracle is the immutable B1 contract, never an adapter's own output.
const expected=JSON.parse(historical.stdout).classifications,adapters={generic,gitlab,jenkins};
const rawConfig=JSON.parse(fs.readFileSync(new URL('../../fixtures/mo1306/evaluate-policy-pass/memoryos-ci.json',import.meta.url)));
const config=configuration(Buffer.from(J(rawConfig))),pin='sha256:'+'a'.repeat(64),sentinel='SECRET-SENTINEL';
const deployFor=provider=>({kind:'MemoryOSCICDDeployment',version:'1.0.0',provider,distributionDigest:pin,options:provider==='gitlab'?{runnerTag:'windows'}:{agentLabel:'windows'}});
function rejected(operation,codes) {
  let error;try { operation(); } catch(caught) {error=caught;}
  assert.ok(error instanceof Error,'Unsafe input was accepted');
  if(codes)assert.ok(codes.includes(error.code),'Unexpected rejection: '+error.code);
  const records=[];diagnosticWriter(value=>records.push(value))(error);
  assert.equal(records.length,1);assert.ok(Buffer.byteLength(records[0])<=1024);
  assert.ok(!records[0].includes(sentinel));assert.equal(JSON.parse(records[0]).message,'The requested operation could not complete.');
}
function reversed(value) {
  if(Array.isArray(value))return value.map(reversed);
  if(value&&typeof value==='object')return Object.fromEntries(Object.entries(value).reverse().map(([key,item])=>[key,reversed(item)]));
  return value;
}
function frozen(value) {
  if(value&&typeof value==='object'){for(const item of Object.values(value))frozen(item);Object.freeze(value);}return value;
}

test('equivalence: current projection contract is byte-identical to B1',()=>{
  const current=fs.readFileSync(new URL('../../../memoryos-ci/contracts/projection.json',import.meta.url));
  assert.deepEqual(current,historical.stdout);
  assert.deepEqual(Object.keys(expected).sort(),['ARTIFACT_ERROR','CANCELLED','CONFIGURATION_ERROR','COULD_NOT_EVALUATE','FAIL','INPUT_ERROR','INTEGRITY_ERROR','INTERNAL_ERROR','PASS','SEMANTIC_ERROR','TIMEOUT']);
  assert.deepEqual(projections,expected);
});
for(const [provider,adapter] of Object.entries(adapters)) {
  for(const [classification,row] of Object.entries(expected))test('equivalence: '+provider+' '+classification,()=>{
    const first=adapter.project(classification),second=adapter.project(classification);
    assert.deepEqual(first,row.projection);assert.notEqual(first,second);
    first.class='SECRET-SENTINEL';first.jobStatus='SECRET-SENTINEL';
    assert.deepEqual(adapter.project(classification),row.projection);
    assert.equal(projections[classification].exitCode,row.exitCode);
  });
  for(const [name,value] of Object.entries({unknown:'SECRET-SENTINEL',lowercase:'pass',prototype:'__proto__',constructor:'constructor',empty:'',missing:undefined,null:null,number:0,array:['PASS'],boxed:new String('PASS')}))test('equivalence negative: '+provider+' '+name,()=>rejected(()=>adapter.project(value),['MO1306_INTERNAL_FAILURE']));
}

// Independent field mapping from frozen contract section 7; no mappings import.
const mappings={
  generic:{},
  gitlab:{CI_PROJECT_PATH:['repository','org/repo'],CI_COMMIT_SHA:['revision','A'.repeat(40)],CI_PIPELINE_ID:['runId','123'],CI_JOB_ID:['jobId','456'],CI_PIPELINE_SOURCE:['event','merge_request_event'],CI_MERGE_REQUEST_IID:['changeRequest','789']},
  jenkins:{JOB_NAME:['repository','folder/job'],GIT_COMMIT:['revision','A'.repeat(40)],BUILD_NUMBER:['runId','123'],BUILD_TAG:['jobId','jenkins-job-123'],CHANGE_ID:['changeRequest','789']}
};
const empty=provider=>({provider,repository:null,revision:null,runId:null,jobId:null,attempt:null,event:null,changeRequest:null});
const metadataHostile={newline:sentinel+'\nnext',cr:sentinel+'\rnext',tab:sentinel+'\tnext',nul:sentinel+'\0',escape:sentinel+'\u001b',del:sentinel+'\u007f',url:'https://'+sentinel,absolute:'/'+sentinel,drive:'C:'+sentinel,backslash:'a\\'+sentinel,traversal:'a/../'+sentinel,shell:sentinel+';whoami',expression:'${'+sentinel+'}',placeholder:'${{secrets.'+sentinel+'}}',object:{value:sentinel},number:7};
for(const [provider,adapter] of Object.entries(adapters)) {
  test('metadata: '+provider+' frozen field mapping and null semantics',()=>{
    assert.deepEqual(adapter.normalizeMetadata({}),empty(provider));
    const env=Object.fromEntries(Object.entries(mappings[provider]).map(([key,[,value]])=>[key,value]));
    const want={...empty(provider),...Object.fromEntries(Object.values(mappings[provider]).map(([key,value])=>[key,key==='revision'?value.toLowerCase():value]))};
    assert.deepEqual(adapter.normalizeMetadata(frozen(env)),want);
    for(const blank of [undefined,null,''])assert.deepEqual(adapter.normalizeMetadata(Object.fromEntries(Object.keys(mappings[provider]).map(key=>[key,blank]))),empty(provider));
    const changed=adapter.normalizeMetadata(env);changed.repository=sentinel;assert.deepEqual(adapter.normalizeMetadata(env),want);
  });
  for(const key of Object.keys(mappings[provider]))for(const [kind,value] of Object.entries(metadataHostile))test('metadata negative: '+provider+' '+key+' '+kind,()=>rejected(()=>adapter.normalizeMetadata({[key]:value}),['MO1306_METADATA_INVALID']));
  for(const key of ['actor','ref','timestamp','workspace','providerURL','runner','environment','semantic','policy','SECRET-SENTINEL'])test('metadata negative: '+provider+' unlisted '+key,()=>rejected(()=>adapter.normalizeMetadata({[key]:sentinel}),['MO1306_METADATA_INVALID']));
  for(const [name,value] of Object.entries({null:null,array:[],text:sentinel,prototype:Object.create({provider:sentinel})}))test('metadata negative: '+provider+' record '+name,()=>rejected(()=>adapter.normalizeMetadata(value),['MO1306_METADATA_INVALID']));
}
for(const [provider,adapter] of Object.entries({gitlab,jenkins}))for(const [key,[field,value]] of Object.entries(mappings[provider]))test('metadata bounds: '+provider+' '+key,()=>{
  const limit={repository:256,runId:128,jobId:128,event:64,revision:40,changeRequest:20}[field];
  const maximum=(field==='revision'?'A':field==='changeRequest'?'1':'x').repeat(limit);
  const normalized=adapter.normalizeMetadata({[key]:maximum});assert.equal(normalized[field],field==='revision'?maximum.toLowerCase():maximum);
  rejected(()=>adapter.normalizeMetadata({[key]:maximum+'x'}),['MO1306_METADATA_INVALID']);
  if(field==='revision')rejected(()=>adapter.normalizeMetadata({[key]:value.slice(1)}),['MO1306_METADATA_INVALID']);
});

const unsafeLabels={empty:'',space:'a b',newline:sentinel+'\nnext',cr:sentinel+'\rnext',nul:sentinel+'\0',tab:sentinel+'\t',escape:sentinel+'\u001b',del:sentinel+'\u007f',singleQuote:"a'b",doubleQuote:'a"b',backtick:'a`b',semicolon:sentinel+';whoami',pipe:sentinel+'|cmd',expression:'${'+sentinel+'}',subexpression:'$('+sentinel+')',yaml:'a: b',path:'../'+sentinel,absolute:'C:\\'+sentinel,placeholder:'${{secrets.'+sentinel+'}}',oversized:'x'.repeat(65),unicode:'wíndows',array:['windows'],number:1,object:{value:sentinel}};
const deploymentMutations={
  missingOptions:v=>delete v.options,unknownOption:v=>v.options.extra=sentinel,runnerOverride:v=>v.options.runner=sentinel,
  configurationOverride:v=>v.options.configPath='../'+sentinel,metadata:v=>v.metadata={actor:sentinel},secret:v=>v.options.secret=sentinel,
  digestMissing:v=>delete v.distributionDigest,digestMalformed:v=>v.distributionDigest=sentinel,
  digestUppercase:v=>v.distributionDigest='sha256:'+'A'.repeat(64),digestInjection:v=>v.distributionDigest=pin+'\n'+sentinel,
  version:v=>v.version='2.0.0',kind:v=>v.kind=sentinel,provider:v=>v.provider='generic',unknown:v=>v.extra=sentinel
};
const configMutations={
  unknown:v=>v.extra=sentinel,provider:v=>v.provider=sentinel,inline:v=>v.context.inline={value:sentinel},
  extensions:v=>v.providerExtensions={value:sentinel},environment:v=>v.environment={value:sentinel},
  output:v=>v.output.directory='../'+sentinel,policyPin:v=>v.policy.expectedSemanticDigest=sentinel,
  timeout:v=>v.timeoutMs=60001,version:v=>v.version='2.0.0',operation:v=>v.operation=sentinel,
  collision:v=>v.context.candidateMip=v.policy.path.toUpperCase(),conflict:v=>v.policySet=v.policy
};
const unsafePaths={parent:'../'+sentinel,absolute:'C:/'+sentinel,unc:'\\\\server\\'+sentinel,control:sentinel+'\nfile',shell:sentinel+';cmd',template:'${'+sentinel+'}',reserved:'CON',emptySegment:'a//'+sentinel,trailing:'a. ',private:'.memoryos-ci/out/'+sentinel};
for(const [provider,adapter] of Object.entries({gitlab,jenkins})) {
  const labelKey=provider==='gitlab'?'runnerTag':'agentLabel';
  test('generation: '+provider+' normalized defaults, order, immutable inputs and fresh bytes',()=>{
    const deploy=deployFor(provider),before=J({config,deploy}),first=adapter.generate(frozen(structuredClone(config)),frozen(structuredClone(deploy)));
    assert.deepEqual(first,adapter.generate(reversed(config),reversed(deploy)));
    const omitted=structuredClone(config);delete omitted.timeoutMs;delete omitted.providerExtensions;
    assert.deepEqual(first,adapter.generate(omitted,deploy));assert.equal(J({config,deploy}),before);
    const artifact=first[0];assert.equal(artifact.path,provider==='gitlab'?'.gitlab-ci.yml':'Jenkinsfile');
    const text=new TextDecoder('utf-8',{fatal:true}).decode(artifact.bytes);assert.deepEqual(Buffer.from(text),artifact.bytes);
    assert.ok(text.includes("-ConfigurationDigest '"+digest(J(config))+"'"));assert.ok(text.includes("-DistributionDigest '"+pin+"'"));
    assert.ok(!text.includes('\r'));assert.ok(text.endsWith('\n'));assert.ok(!text.endsWith('\n\n'));
    assert.deepEqual(generate(config,deploy,pin),generate(reversed(config),reversed(deploy),pin));
    assert.deepEqual(generate(config,deploy,pin),generate(omitted,deploy,pin));
    artifact.bytes.fill(0);assert.ok(adapter.generate(config,deploy)[0].bytes.every(value=>value!==0));
  });
  for(const label of ['windows','Windows_2026-x64','a'.repeat(64),'true','false','null','yes','on','0','__proto__'])test('generation data: '+provider+' label '+label,()=>{
    const deploy=deployFor(provider);deploy.options[labelKey]=label;const first=adapter.generate(config,deploy);
    assert.deepEqual(first,adapter.generate(config,deploy));assert.ok(first[0].bytes.toString().includes("'"+label+"'"));
  });
  for(const [name,label] of Object.entries(unsafeLabels))test('generation negative: '+provider+' label '+name,()=>{
    const deploy=deployFor(provider);deploy.options[labelKey]=label;
    rejected(()=>adapter.generate(config,deploy),['MO1306_GENERATION_INVALID']);rejected(()=>generate(config,deploy,pin),['MO1306_GENERATION_INVALID']);
  });
  for(const [name,mutate] of Object.entries(deploymentMutations))test('generation negative: '+provider+' deployment '+name,()=>{
    const deploy=deployFor(provider);mutate(deploy);rejected(()=>adapter.generate(config,deploy));
  });
  for(const [name,mutate] of Object.entries(configMutations))test('generation negative: '+provider+' configuration '+name,()=>{
    const altered=structuredClone(config);mutate(altered);rejected(()=>adapter.generate(altered,deployFor(provider)));
  });
  for(const [name,value] of Object.entries(unsafePaths))test('generation negative: '+provider+' path '+name,()=>{
    for(const target of ['policy','candidate','baseline']) {
      const altered=structuredClone(config);
      if(target==='policy')altered.policy.path=value;else altered.context[target==='candidate'?'candidateMip':'baselineMip']=value;
      rejected(()=>adapter.generate(altered,deployFor(provider)));
    }
  });
  for(const [name,value] of Object.entries({missing:undefined,null:null,array:[],text:sentinel,prototype:Object.create(config),constructor:{...config,constructor:sentinel},proto:JSON.parse('{"__proto__":"SECRET-SENTINEL"}')}))test('generation negative: '+provider+' config API '+name,()=>rejected(()=>adapter.generate(value,deployFor(provider))));
  for(const [name,value] of Object.entries({missing:undefined,null:null,array:[],text:sentinel,prototype:Object.create(deployFor(provider)),constructor:{...deployFor(provider),constructor:sentinel},proto:JSON.parse('{"__proto__":"SECRET-SENTINEL"}')}))test('generation negative: '+provider+' deploy API '+name,()=>rejected(()=>adapter.generate(config,value)));
}
