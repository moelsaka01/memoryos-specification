/** Windows-side oracle generation; this does not certify the Windows host. */
import assert from 'node:assert/strict';
import { readFile,writeFile,mkdir } from 'node:fs/promises';
import { resolve,dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import { spawnSync } from 'node:child_process';
import { createHash } from 'node:crypto';
import { MemoryOS } from '../../../cca-studio/web/js/memoryos-sdk.js';
import { fixtures,measurementCorpus,b64 } from '../../../memoryos-mcp/tests/corpus.mjs';
import { catalog,names,discoveryResult } from '../../../memoryos-mcp/src/contracts.mjs';
import { J } from '../../../memoryos-mcp/src/deterministic.mjs';
const workspace=resolve(dirname(fileURLToPath(import.meta.url)),'../../../..');
const destination=resolve(workspace,'.cache/mo1304-phase3-stage/inputs');await mkdir(destination,{recursive:true});
assert.equal(process.versions.node,'24.21.0');
const hash=x=>createHash('sha256').update(x).digest('hex');
const f=await fixtures(),vectors=[],cliEvidence=[];
for(const key of ['pass','fail','cne','set','mip'])await writeFile(resolve(destination,key),f[key]);
function cli(label,args){
 const r=spawnSync(process.execPath,[resolve(workspace,'repositories/memoryos-cli/bin/memoryos.js'),'policy',...args,'--json'],{encoding:'utf8',windowsHide:true,timeout:30000,maxBuffer:65536});assert.equal(r.error,undefined);
 const result=JSON.parse(r.stdout||r.stderr);cliEvidence.push({label,exitCode:r.status,outputSha256:hash(Buffer.from(r.stdout||r.stderr))});return {status:r.status,value:result};
}
const memory=new MemoryOS(),identities=memory.policyContractIdentities();
assert.deepEqual(cli('identities',['identities']).value.result,identities);
vectors.push({id:'identities',name:names[0],arguments:{},expected:{status:'ok',identities}});
for(const set of [false,true]){
 const key=set?'set':'pass',prepared=set?memory.preparePolicySet(f[key]):memory.preparePolicy(f[key]);
 const output=resolve(destination,key+'.canonical');const c=cli('prepare-'+key,['digest',set?'--policy-set':'--policy',resolve(destination,key),'--canonical-output',output]);assert.equal(c.status,0);
 assert.equal(c.value.result.documentDigest,prepared.documentDigest);assert.equal(c.value.result.semanticDigest,prepared.semanticDigest);assert.deepEqual(await readFile(output),Buffer.from(prepared.toBytes()));
 vectors.push({id:'prepare-'+key,name:set?names[3]:names[2],arguments:{[set?'policySetBase64':'policyBase64']:b64(f[key])},expected:{status:'ok',artifactKind:prepared.kind,artifactVersion:prepared.version,canonicalArtifactBase64:b64(prepared.toBytes()),documentDigest:prepared.documentDigest,semanticDigest:prepared.semanticDigest}});
}
for(const [key,decision,exitCode] of [['pass','PASS',0],['fail','FAIL',6],['cne','COULD_NOT_EVALUATE',7],['set','PASS',0]]){
 const m=new MemoryOS(),set=key==='set',prepared=set?m.preparePolicySet(f[key]):m.preparePolicy(f[key]);const context=m.capturePolicyFactContext(m.importPackage(f.mip,{identifier:'memoryos-policy-evaluation-candidate'}));
 const sdk=set?m.evaluatePolicySet(prepared,context,{}):m.evaluatePolicy(prepared,context,{});assert.equal(sdk.decision,decision);
 const identity=resolve(destination,key+'.identity'),outcome=resolve(destination,key+'.outcome');const c=cli('evaluate-'+key,['evaluate',set?'--policy-set':'--policy',resolve(destination,key),'--package',resolve(destination,'mip'),'--identity-output',identity,'--outcome',outcome]);
 assert.equal(c.status,exitCode);assert.equal(c.value.result.decision,decision);assert.equal(c.value.result.evaluationIdentityDigest,sdk.evaluationIdentityDigest);assert.equal(c.value.result.outcomeDigest,sdk.outcomeDigest);assert.deepEqual(await readFile(identity),Buffer.from(sdk.evaluationIdentityBytes()));assert.deepEqual(await readFile(outcome),Buffer.from(sdk.canonicalOutcomeBytes()));
 const expected={status:'ok',artifactKind:prepared.kind,semanticDigest:prepared.semanticDigest,decision,evaluationIdentityBase64:b64(sdk.evaluationIdentityBytes()),evaluationIdentityDigest:sdk.evaluationIdentityDigest,outcomeBase64:b64(sdk.canonicalOutcomeBytes()),outcomeDigest:sdk.outcomeDigest};
 vectors.push({id:'evaluate-'+key,name:names[1],arguments:{artifactKind:set?'policySet':'policy',artifactBase64:b64(f[key]),candidateMipBase64:b64(f.mip)},expected});
 if(key==='pass'){
  for(const outcomeMode of [false,true]){
   const r=outcomeMode?m.verifyPolicyEvaluationOutcomeArtifact(sdk.canonicalOutcomeBytes(),{expectedEvaluationIdentityDigest:sdk.evaluationIdentityDigest,expectedOutcomeDigest:sdk.outcomeDigest}):m.verifyEvaluationIdentityArtifact(sdk.evaluationIdentityBytes(),sdk.evaluationIdentityDigest);
   const args=outcomeMode?{outcomeBase64:expected.outcomeBase64,expectedEvaluationIdentityDigest:sdk.evaluationIdentityDigest,expectedOutcomeDigest:sdk.outcomeDigest}:{evaluationIdentityBase64:expected.evaluationIdentityBase64,expectedEvaluationIdentityDigest:sdk.evaluationIdentityDigest};
   const c=cli(outcomeMode?'verify-outcome':'verify-identity',[outcomeMode?'verify-outcome':'verify-identity',outcomeMode?outcome:identity,'--mode','artifact','--expected-evaluation-identity-digest',sdk.evaluationIdentityDigest,...(outcomeMode?['--expected-outcome-digest',sdk.outcomeDigest]:[])]);assert.equal(c.status,0);
   vectors.push({id:outcomeMode?'verify-outcome':'verify-identity',name:outcomeMode?names[5]:names[4],arguments:args,expected:{status:'ok',artifactKind:r.artifactKind,artifactVersion:r.artifactVersion,verified:r.verified,authority:r.authority,verificationScope:r.verificationScope,evaluationIdentityDigest:r.evaluationIdentityDigest,...(outcomeMode?{decision:r.decision,outcomeDigest:r.outcomeDigest}:{})}});
  }
 }
}
await writeFile(resolve(destination,'invalid'),'{}');const invalid=cli('invalid',['digest','--policy',resolve(destination,'invalid')]);assert.notEqual(invalid.status,0);
let sdkError;try{memory.preparePolicy(Buffer.from('{}'));}catch(e){sdkError=e.code;}assert.equal(sdkError,invalid.value.error.code);
const maximal=await measurementCorpus();
const data={kind:'MemoryOSMO1304Phase3Inputs',version:'1.0.0',implementation:'18453aa6d0d347acece20598cf5b1bc3d174c5af',binding:'461a67f3dbb7a32132f9c76e0ea40358e6776583',provenance:'Authoritative SDK and actual CLI executed only to generate reference bytes; not Windows certification',node:process.versions.node,cliEvidence,identities,catalog:catalog(identities),discovery:discoveryResult(),vectors,invalidMemoryOSCode:sdkError,maximal,limits:JSON.parse(await readFile(resolve(workspace,'repositories/memoryos-mcp/contracts/limits.json'))).values};
const bytes=Buffer.from(J(data)+'\n');assert.ok(bytes.length<4*1024*1024);await writeFile(resolve(destination,'inputs.json'),bytes);console.log(JSON.stringify({byteLength:bytes.length,sha256:hash(bytes),vectors:vectors.length,maximumVectors:maximal.length,cliRuns:cliEvidence.length}));
