import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import { parseJSON } from '../../../memoryos-ci/src/json.mjs';
import { J } from '../../../memoryos-ci/src/serialization.mjs';
import { configuration,deployment,relativeFile,validate,limits } from '../../../memoryos-ci/src/contracts.mjs';
import { metadata,mappings } from '../../../memoryos-ci/src/metadata.mjs';
import { catalog,projections,project,diagnosticWriter,CIError } from '../../../memoryos-ci/src/errors.mjs';
import { absolutePath,childEnvironment } from '../../../memoryos-ci/src/filesystem.mjs';
import { generate } from '../../../memoryos-ci/src/generator.mjs';
import { workerArguments } from '../../../memoryos-ci/src/supervisor.mjs';
const raw=fs.readFileSync(new URL('../../fixtures/mo1306/evaluate-policy-pass/memoryos-ci.json',import.meta.url)),config=configuration(raw),pin='sha256:'+'0'.repeat(64);
const rejects=(fn,code)=>assert.throws(fn,e=>e instanceof CIError && (!code||e.code==='MO1306_'+code));
test('CF-CONFIG defaults and canonical golden',()=>{
  assert.equal(config.timeoutMs,60000);assert.deepEqual(config.providerExtensions,{});
  assert.equal(J({b:1,a:{z:true,x:[2,1]}}),'{"a":{"x":[2,1],"z":true},"b":1}\n');
  assert.equal(J(configuration(Buffer.from(J(config)))),J(config));
});
const invalidJSON=['{"a":1,"a":2}','{"a":1,"\\u0061":2}','{"constructor":0}','{"__proto__":0}','{"prototype":0}','{"a":-0}','{"a":-1}','{"a":1.5}','{"a":1e2}','{"a":9007199254740992}','{"a":"\\ud800"}','{"a":"\\udfff"}','{"a":"\\u0000"}','{"a":1} true','{"a":1,}','[1,]','undefined','NaN','Infinity','{"'+ 'x'.repeat(65)+'":0}','['.repeat(9)+']'.repeat(9),'{'+Array.from({length:257},(_,i)=>'"x'+i+'":0').join(',')+'}',JSON.stringify(Array(1024).fill(0))];
for(const [index,value]of invalidJSON.entries())test('CF-CONFIG strict JSON '+index,()=>rejects(()=>parseJSON(Buffer.from(value)),'CONFIG_INVALID'));
test('CF-CONFIG UTF8 and BOM',()=>{for(const bytes of [Buffer.from([0xc0,0xaf]),Buffer.concat([Buffer.from([239,187,191]),raw])])rejects(()=>parseJSON(bytes));});
test('CF-CONFIG byte bounds',()=>{const exact=Buffer.from(' '.repeat(16382)+'{}');assert.deepEqual({...parseJSON(exact)},{});rejects(()=>parseJSON(Buffer.concat([exact,Buffer.from(' ')])));});
for(const [name,mutate]of Object.entries({
  unknown:v=>v.extra=true,version:v=>v.version='2.0.0',operation:v=>v.operation='evaluate',
  conflict:v=>v.policySet=v.policy,neither:v=>delete v.policy,provider:v=>v.provider='github',
  context:v=>v.context.inline={},override:v=>v.environment={},pin:v=>v.policy.expectedSemanticDigest='bad',
  timeoutLow:v=>v.timeoutMs=999,timeoutHigh:v=>v.timeoutMs=60001,extensions:v=>v.providerExtensions.x=0,output:v=>v.output.directory='out'
}))test('CF-CONFIG closed '+name,()=>{const value=structuredClone(config);mutate(value);rejects(()=>configuration(Buffer.from(J(value))));});
const badPaths=['','../a','a/../b','a//b','a/./b','/a','C:/a','C:a','\\a','\\\\server\\share','\\\\?\\C:\\a','a:b','CON','nul.txt','LPT9.json','a.',' a','a ','a*','a?','a\\b','.memoryos-ci/out/a','a'.repeat(101),'a/$()','a;whoami','a\nnext','a/'+ 'x/'.repeat(120)];
for(const [index,value]of badPaths.entries())test('CF-FILESYSTEM relative '+index,()=>rejects(()=>relativeFile(value),'FILESYSTEM_BOUNDARY'));
for(const value of ['C:relative','\\root','\\\\server\\share','\\\\?\\C:\\x','C:\\x:y','C:\\x\\..\\a','C:\\nul.txt','C:\\a.','C:\\a;echo','C:\\a$()'])test('CF-FILESYSTEM absolute '+JSON.stringify(value),()=>rejects(()=>absolutePath(value)));
test('CF-FILESYSTEM spaces and collision',()=>{assert.equal(relativeFile('folder/a b.json'),'folder/a b.json');const value=structuredClone(config);value.context.candidateMip='POLICY.JSON';rejects(()=>configuration(Buffer.from(J(value))),'FILESYSTEM_BOUNDARY');});
test('CF-SECRETS child environment',()=>assert.deepEqual(Object.keys(childEnvironment()).sort(),['SystemRoot','WINDIR']));
test('CF-GENERIC worker argv',()=>{const args=workerArguments();assert.equal(args.length,5);assert.equal(args[0],'--permission');assert.equal(args[2],'--max-old-space-size=256');assert.equal(args[3],'--max-semi-space-size=16');assert.ok(!args.some(v=>/allow-(child|worker|fs-write|addons|wasi|inspector)/.test(v)));});
for(const [code,row]of Object.entries(catalog.errors))test('CF-ERRORS '+code,()=>{assert.equal(new CIError(code).code,code);assert.equal(projections[row[0]].exitCode,row[1]);assert.ok(['LAUNCH','CONFIGURATION','ACQUISITION','METADATA','GENERATION','INTEGRITY','SEMANTIC','PUBLICATION','VERIFICATION','CLEANUP','INTERNAL'].includes(row[2]));});
for(const [name,row]of Object.entries(projections))test('CF-PROJECTION '+name,()=>assert.deepEqual(project(name),row.projection));
test('CF-ERRORS unknown code and bounded diagnostics',()=>{assert.throws(()=>new CIError('UNKNOWN'));const records=[],write=diagnosticWriter(s=>records.push(s));for(let i=0;i<80;i++)write(new Error('SECRET-SENTINEL'));assert.ok(records.length<=32);assert.ok(records.join('').length<=16384);assert.ok(records.every(s=>Buffer.byteLength(s)<=1024));assert.equal(JSON.parse(records.at(-1)).code,'MO1306_DIAGNOSTICS_TRUNCATED');assert.ok(!records.join('').includes('SECRET-SENTINEL'));});
test('CF-METADATA fourteen classifications',()=>{const value=JSON.parse(fs.readFileSync(new URL('../../../memoryos-ci/contracts/metadata.json',import.meta.url)));assert.equal(Object.keys(value.classifications).length,14);assert.ok(!Object.values(value.classifications).includes('SEMANTIC'));rejects(()=>metadata('generic',{workspace:'C:\\data'}),'METADATA_INVALID');});
for(const provider of Object.keys(mappings))test('CF-METADATA '+provider,()=>{const env=Object.fromEntries(mappings[provider].filter(Boolean).map(k=>[k,null]));assert.equal(metadata(provider,env).provider,provider);rejects(()=>metadata(provider,{...env,actor:'SECRET'}),'METADATA_INVALID');});
for(const value of ['https://host/a','/root','C:drive','../repo','repo/../a','\\host','repo\n::error::bad','a;echo','SECRET-SENTINEL$[]','x'.repeat(257)])test('CF-METADATA hostile '+JSON.stringify(value),()=>rejects(()=>metadata('github',{GITHUB_REPOSITORY:value}),'METADATA_INVALID'));
test('CF-METADATA revision and attempt',()=>{assert.equal(metadata('github',{GITHUB_SHA:'A'.repeat(40),GITHUB_RUN_ATTEMPT:'1000'}).revision,'a'.repeat(40));rejects(()=>metadata('github',{GITHUB_RUN_ATTEMPT:'1001'}));});
test('CF-GENERATION golden and deterministic ordering',()=>{
  const deploy={kind:'MemoryOSCICDDeployment',version:'1.0.0',provider:'generic',distributionDigest:pin,options:{}};
  const first=generate(config,deploy,pin),second=generate(Object.fromEntries(Object.entries(config).reverse()),deploy,pin);
  assert.equal(first.length,2);assert.equal(first[0].path,'memoryos-ci.json');assert.equal(first[0].bytes.toString(),J(config));assert.deepEqual(first,second);assert.equal(JSON.parse(first[1].bytes).files[0].path,'memoryos-ci.json');
  for(const provider of ['github','gitlab','jenkins','azure']) {const options={github:{repository:'a/b',toolRevision:'a'.repeat(40),configPath:'memoryos-ci.json'},gitlab:{runnerTag:'windows'},jenkins:{agentLabel:'windows'},azure:{pool:'windows'}}[provider];rejects(()=>generate(config,{...deploy,provider,options},pin),'PROVIDER_UNSUPPORTED');}
});
for(const value of ['a\nb','a\rb','a\u0000b','a\u001bb',"a'b",'a"b','a\x60b','a;b','a|b','a$()','a'+'$'+'{{x}}','a$[x]','a'+String.fromCharCode(36,123)+'x}','a b'])test('CF-INJECTION label '+JSON.stringify(value),()=>rejects(()=>deployment(Buffer.from(J({kind:'MemoryOSCICDDeployment',version:'1.0.0',provider:'gitlab',distributionDigest:pin,options:{runnerTag:value}}))),'GENERATION_INVALID'));
test('CF-RESOURCE envelope math',()=>{assert.equal(limits.fixed.semanticInputBytes,524288*2+4096);assert.ok(4*Math.ceil(524288/3)*2+4*Math.ceil(4096/3)+1024<=limits.fixed.workerRequestBytes);assert.equal(limits.fixed.semanticMaxMs+limits.fixed.overallAllowanceMs,75000);assert.equal(limits.fixed.processCount,3);assert.equal(limits.fixed.semanticQueue,0);});
