/** Independent public SDK oracle. No REST or MCP production imports. */
import {readFileSync,readdirSync,mkdirSync,writeFileSync} from 'node:fs';
import {resolve} from 'node:path';
import {createHash} from 'node:crypto';
import assert from 'node:assert/strict';
import {referenceSnapshot} from '../../../cca-studio/web/data/studio-snapshot.js';
import {MemoryOS} from '../../../cca-studio/web/js/memoryos-sdk.js';
import {computeMipIntegrity} from '../../../cca-studio/web/js/memory-investigation-package.js';
import {canonicalize} from '../../../cca-studio/web/js/mip-canonical.js';
const root=resolve(import.meta.dirname,'../../../..'), fixtureRoot=resolve(root,'repositories/cca-studio/tests/fixtures');
const b64=x=>Buffer.from(x).toString('base64'), bytes=x=>Buffer.from(JSON.stringify(x),'utf8');
const f={};for(const name of ['pass','fail','cne'])f[name]=readFileSync(resolve(root,`repositories/cca-conformance/tests/fixtures/github-policy-gate/1.0.0/hosted/${name}.memoryos-policy.json`));
f.mip=Buffer.from(readFileSync(resolve(fixtureRoot,'mip/minimal-observation.mip.b64'),'ascii').trim(),'base64');
const records=[];
function failure(error){return {status:'error',error:{code:'MO1305_SEMANTIC_REJECTED',semantic:{origin:'memoryos',code:error.code,phase:error.phase??null,artifactKind:error.artifactKind??null,limitIdentifier:error.limitIdentifier??null,failureClass:error.failureClass??null,verificationFailure:error.verificationFailure??null}}};}
function projectVerify(value){const result={status:'ok'};for(const key of ['artifactKind','artifactVersion','verified','authority','verificationScope','evaluationIdentityDigest','decision','outcomeDigest'])if(Object.hasOwn(value,key))result[key]=value[key];return result;}
function oracle(operation,input){
 const m=new MemoryOS();
 try {
  if(operation==='getContractIdentities')return {status:'ok',identities:m.policyContractIdentities()};
  if(operation==='preparePolicy'||operation==='preparePolicySet'){
   const set=operation==='preparePolicySet',p=set?m.preparePolicySet(Buffer.from(input.policySetBase64,'base64')):m.preparePolicy(Buffer.from(input.policyBase64,'base64'));
   return {status:'ok',artifactKind:p.kind,artifactVersion:p.version,canonicalArtifactBase64:b64(p.toBytes()),documentDigest:p.documentDigest,semanticDigest:p.semanticDigest};
  }
  if(operation==='evaluatePolicy'){
   const set=input.artifactKind==='policySet',p=set?m.preparePolicySet(Buffer.from(input.artifactBase64,'base64')):m.preparePolicy(Buffer.from(input.artifactBase64,'base64'));
   const c=m.capturePolicyFactContext(m.importPackage(Buffer.from(input.candidateMipBase64,'base64'),{identifier:'memoryos-policy-evaluation-candidate'}));
   const e=set?m.evaluatePolicySet(p,c,{}):m.evaluatePolicy(p,c,{});
   return {status:'ok',artifactKind:p.kind,semanticDigest:p.semanticDigest,decision:e.decision,evaluationIdentityBase64:b64(e.evaluationIdentityBytes()),evaluationIdentityDigest:e.evaluationIdentityDigest,outcomeBase64:b64(e.canonicalOutcomeBytes()),outcomeDigest:e.outcomeDigest};
  }
  if(operation==='verifyEvaluationIdentity')return projectVerify(m.verifyEvaluationIdentityArtifact(Buffer.from(input.evaluationIdentityBase64,'base64'),input.expectedEvaluationIdentityDigest));
  return projectVerify(m.verifyPolicyEvaluationOutcomeArtifact(Buffer.from(input.outcomeBase64,'base64'),{expectedEvaluationIdentityDigest:input.expectedEvaluationIdentityDigest,expectedOutcomeDigest:input.expectedOutcomeDigest}));
 }catch(error){return failure(error);}
}
function add(id,operation,input){const expected=oracle(operation,input);records.push({id,operation,input,expected});return expected;}
add('identities','getContractIdentities',null);
const m=new MemoryOS();
for(const name of ['pass','fail','cne']){
 const document=JSON.parse(f[name]),set=bytes({identifier:'s',kind:'MemoryOSInvestigationPolicySet',version:'1.0.0',policySetVersion:'1.0.0',policies:[{policy:document,expectedSemanticDigest:m.preparePolicy(f[name]).semanticDigest}]});
 for(const [kind,artifact] of [['policy',f[name]],['policySet',set]]){
  add('prepare-'+kind+'-'+name,kind==='policy'?'preparePolicy':'preparePolicySet',{[kind==='policy'?'policyBase64':'policySetBase64']:b64(artifact)});
  const result=add('evaluate-'+kind+'-'+name,'evaluatePolicy',{artifactKind:kind,artifactBase64:b64(artifact),candidateMipBase64:b64(f.mip)});
  assert.equal(result.decision,{pass:'PASS',fail:'FAIL',cne:'COULD_NOT_EVALUATE'}[name],kind+' '+name+' '+JSON.stringify(result));
  if(kind==='policy'&&name==='pass'){
   const identity={evaluationIdentityBase64:result.evaluationIdentityBase64,expectedEvaluationIdentityDigest:result.evaluationIdentityDigest};
   const outcome={outcomeBase64:result.outcomeBase64,expectedEvaluationIdentityDigest:result.evaluationIdentityDigest,expectedOutcomeDigest:result.outcomeDigest};
   add('verify-identity','verifyEvaluationIdentity',identity);add('verify-outcome','verifyPolicyOutcome',outcome);
   add('bad-identity-digest','verifyEvaluationIdentity',{...identity,expectedEvaluationIdentityDigest:'sha256:'+'0'.repeat(64)});
   add('bad-outcome-digest','verifyPolicyOutcome',{...outcome,expectedOutcomeDigest:'sha256:'+'0'.repeat(64)});
   add('tampered-outcome','verifyPolicyOutcome',{...outcome,outcomeBase64:b64(Buffer.from(result.outcomeBase64,'base64').subarray(1))});
  }
 }
}
// Independently authored additional rules complete the six-family transport coverage.
for(const [suffix,parameters] of [['require-replay-completed',{}],['require-artifact-cardinality',{artifactClass:'evidence',minimumCount:1}],['require-lifecycle-state',{allowedStates:['Observed']}]]){
 const document={identifier:'p',kind:'MemoryOSInvestigationPolicy',policyVersion:'1.0.0',version:'1.0.0',rules:[{identifier:'r',parameters,type:'memoryos.'+suffix,version:'1.0.0'}]};
 const artifact=bytes(document);
 const result=add('rule-'+suffix,'evaluatePolicy',{artifactKind:'policy',artifactBase64:b64(artifact),candidateMipBase64:b64(f.mip)});
 assert.equal(result.status,'ok',suffix+JSON.stringify(result));
}
add('invalid-policy','preparePolicy',{policyBase64:b64(bytes({}))});add('invalid-policy-set','preparePolicySet',{policySetBase64:b64(bytes({}))});
// Maximal valid MIP: inert noncritical extension, integrity computed by its existing owner.
const base=JSON.parse(f.mip);
function renderMip(length,source=base){const value=structuredClone(source);value.extensions['org.memoryos.rest.measurement']={critical:false,payload:{padding:'a'.repeat(length)},version:'1.0.0'};value.manifest.features.optional=[...value.manifest.features.optional,'org.memoryos.rest.measurement'].sort();value.integrity=computeMipIntegrity(value);return Buffer.from(canonicalize(value));}
const maximumMip=renderMip(524288-renderMip(0).length);assert.equal(maximumMip.length,524288);assert.equal(m.verifyPackage(maximumMip).valid,true);
let largest={policy:f.pass,policySet:bytes({identifier:'s',kind:'MemoryOSInvestigationPolicySet',version:'1.0.0',policySetVersion:'1.0.0',policies:[{policy:JSON.parse(f.pass),expectedSemanticDigest:m.preparePolicy(f.pass).semanticDigest}]})};
const carrierRoot=resolve(fixtureRoot,'investigation-policy/1.0.0/boundary-carriers');
for(const name of readdirSync(carrierRoot).sort())for(const kind of ['policy','policySet']){
 try{const source=readFileSync(resolve(carrierRoot,name));const prepared=kind==='policy'?m.preparePolicy(source):m.preparePolicySet(source);const data=Buffer.from(prepared.toBytes());if(data.length>largest[kind].length)largest[kind]=data;}catch{}
}
for(const kind of ['policy','policySet']){
 const bound=kind==='policy'?2048:4096;
 const padded=Buffer.concat([Buffer.alloc(bound-largest[kind].length,32),largest[kind]]);
 add('over-sdk-envelope-'+kind,kind==='policy'?'preparePolicy':'preparePolicySet',{[kind==='policy'?'policyBase64':'policySetBase64']:b64(padded)});
 const semanticBound=kind==='policy'?1024:2048;
 add('max-prepare-'+kind,kind==='policy'?'preparePolicy':'preparePolicySet',{[kind==='policy'?'policyBase64':'policySetBase64']:b64(Buffer.concat([Buffer.alloc(semanticBound-largest[kind].length,32),largest[kind]]))});
 add('schema-max-evaluate-'+kind,'evaluatePolicy',{artifactKind:kind,artifactBase64:b64(padded),candidateMipBase64:b64(maximumMip)});
 add('max-structure-'+kind,'evaluatePolicy',{artifactKind:kind,artifactBase64:b64(largest[kind]),candidateMipBase64:b64(maximumMip)});
 const reference=records.find(x=>x.id==='evaluate-'+kind+'-pass').input;
 add('max-mip-'+kind,'evaluatePolicy',{...reference,candidateMipBase64:b64(maximumMip)});
}
const complete=JSON.parse(Buffer.from(readFileSync(resolve(fixtureRoot,'mip/complete-investigation.mip.b64'),'ascii').trim(),'base64'));
const maximumComplete=renderMip(524288-renderMip(0,complete).length,complete);assert.equal(maximumComplete.length,524288);assert.equal(m.verifyPackage(maximumComplete).valid,true);
const evaluationReference=records.find(x=>x.id==='evaluate-policy-pass').input;
add('max-complete-mip','evaluatePolicy',{...evaluationReference,candidateMipBase64:b64(maximumComplete)});
// Reconstruct the released maximum serialized outcome solely through public SDK APIs.
const owner=new MemoryOS(), workspace=owner.openWorkspace(referenceSnapshot.workspaceIdentifier);
const baseline=owner.observe(workspace,structuredClone(referenceSnapshot),{identifier:'mo1301-authoritative-verification-baseline'});
const candidate=owner.observe(workspace,structuredClone(referenceSnapshot),{identifier:'mo1301-authoritative-verification-candidate'});candidate.verify();
const facts=owner.captureRegressionPolicyFacts(baseline,candidate);
const policies=['a','b','c','d'].map((letter,index)=>({identifier:'p'+letter,kind:'MemoryOSInvestigationPolicy',policyVersion:'0.0.0',version:'1.0.0',rules:[{identifier:'r'+letter,parameters:{},version:'1.0.0',type:index<2?'memoryos.require-mip-integrity':'memoryos.require-verification-completed'}]}));
const prepared=owner.preparePolicySet(bytes({identifier:'ss',kind:'MemoryOSInvestigationPolicySet',policySetVersion:'0.0.0',version:'1.0.0',policies:policies.map(policy=>({policy,expectedSemanticDigest:owner.preparePolicy(bytes(policy)).semanticDigest}))}));
const mipPolicies=policies.map(policy=>({...policy,rules:policy.rules.map(rule=>({...rule,type:'memoryos.require-mip-integrity'}))}));
const mipSet=owner.preparePolicySet(bytes({identifier:'ss',kind:'MemoryOSInvestigationPolicySet',policySetVersion:'0.0.0',version:'1.0.0',policies:mipPolicies.map(policy=>({policy,expectedSemanticDigest:owner.preparePolicy(bytes(policy)).semanticDigest}))}));
add('max-four-policy-mip-evaluation','evaluatePolicy',{artifactKind:'policySet',artifactBase64:b64(mipSet.toBytes()),candidateMipBase64:b64(maximumMip)});
add('max-output-without-regression','evaluatePolicy',{artifactKind:'policySet',artifactBase64:b64(prepared.toBytes()),candidateMipBase64:b64(maximumMip)});
const maximum=owner.evaluatePolicySet(prepared,facts.policyFactContext,{regressionSource:facts.regressionPolicyFactSource});
assert.equal(maximum.canonicalOutcomeBytes().length,4060);assert.equal(maximum.evaluationIdentityBytes().length,1186);
add('max-verify-outcome','verifyPolicyOutcome',{outcomeBase64:b64(maximum.canonicalOutcomeBytes()),expectedEvaluationIdentityDigest:maximum.evaluationIdentityDigest,expectedOutcomeDigest:maximum.outcomeDigest});
add('max-verify-identity','verifyEvaluationIdentity',{evaluationIdentityBase64:b64(maximum.evaluationIdentityBytes()),expectedEvaluationIdentityDigest:maximum.evaluationIdentityDigest});
add('schema-max-verify-identity','verifyEvaluationIdentity',{evaluationIdentityBase64:b64(Buffer.concat([Buffer.alloc(4060-maximum.evaluationIdentityBytes().length,32),maximum.evaluationIdentityBytes()])),expectedEvaluationIdentityDigest:maximum.evaluationIdentityDigest});
const golden=JSON.parse(readFileSync(resolve(fixtureRoot,'investigation-policy/1.0.0/final-evaluation-identity-outcome-golden-vectors.json'),'utf8')).records;
for(const row of golden){
 add('golden-identity-'+row.recordId,'verifyEvaluationIdentity',{evaluationIdentityBase64:b64(Buffer.from(row.canonicalIdentityBytes)),expectedEvaluationIdentityDigest:row.evaluationIdentityDigest});
 add('golden-outcome-'+row.recordId,'verifyPolicyOutcome',{outcomeBase64:b64(Buffer.from(row.canonicalOutcomeBytes)),expectedEvaluationIdentityDigest:row.evaluationIdentityDigest,expectedOutcomeDigest:row.outcomeDigest});
}
const output=resolve(root,'.cache/mo1305-resume/fixtures');mkdirSync(output,{recursive:true});
const catalog=bytes({kind:'MemoryOSRESTIndependentSDKVectors',version:'1.0.0',source:'authoritative public SDK 1.1.0; independently authored projections',records});
writeFileSync(resolve(output,'vectors.json'),catalog);
const durable=resolve(root,'repositories/cca-conformance/fixtures/mo1305-phase1');mkdirSync(durable,{recursive:true});
function canonical(value){if(Array.isArray(value))return value.map(canonical);if(value!==null&&typeof value==='object')return Object.fromEntries(Object.keys(value).sort().map(k=>[k,canonical(value[k])]));return value;}
const rows=[];for(const record of records){const name=record.id+'.json',data=bytes(canonical(record));writeFileSync(resolve(durable,name),data);rows.push({path:name,byteLength:data.length,sha256:createHash('sha256').update(data).digest('hex')});}
writeFileSync(resolve(durable,'index.json'),bytes(canonical({kind:'MemoryOSRESTFixtureIndex',version:'1.0.0',files:rows.sort((a,b)=>a.path<b.path?-1:1)})));

console.log(JSON.stringify({vectors:records.length,sha256:createHash('sha256').update(catalog).digest('hex'),byteLength:catalog.length,maxPreparation:records.filter(x=>x.id.startsWith('max-prepare')).map(x=>({id:x.id,status:x.expected.status,code:x.expected.error?.semantic?.code??null}))}));
