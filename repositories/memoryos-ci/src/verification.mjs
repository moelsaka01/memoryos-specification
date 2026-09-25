import fs from 'node:fs';
import path from 'node:path';
import { decodeBase64 } from './schema.mjs';
import { validate,digest,checkResult } from './contracts.mjs';
import { J } from './serialization.mjs';
import { parseJSON } from './json.mjs';
import { reject } from './errors.mjs';
import { checkPaths,readChecked,absolutePath } from './filesystem.mjs';
import { semanticContractDigest } from './integrity.mjs';

export async function verifySemantic(value) {
  const {evaluationIdentityBase64,outcomeBase64,...semantic}=value;
  const identity=decodeBase64(evaluationIdentityBase64,4060),outcome=decodeBase64(outcomeBase64,4060);
  const {MemoryOS}=await import('../runtime/authoritative/web/js/memoryos-sdk.js');
  const memory=new MemoryOS();
  try {
    const a=memory.verifyEvaluationIdentityArtifact(identity,semantic.evaluationIdentityDigest);
    const b=memory.verifyPolicyEvaluationOutcomeArtifact(outcome,{expectedEvaluationIdentityDigest:semantic.evaluationIdentityDigest,expectedOutcomeDigest:semantic.outcomeDigest});
    const parsedIdentity=JSON.parse(identity);
    const expectedKind=semantic.artifactKind==='policy'?'MemoryOSInvestigationPolicy':'MemoryOSInvestigationPolicySet';
    if(parsedIdentity.evaluatedArtifact.kind!==expectedKind||parsedIdentity.evaluatedArtifact.semanticDigest!==semantic.semanticDigest)reject('SEMANTIC_INTEGRITY');
    if(!a.verified||!b.verified||b.decision!==semantic.decision)reject('SEMANTIC_INTEGRITY');
  } catch {reject('SEMANTIC_INTEGRITY');}
  return {semantic,identity,outcome};
}
const caps={'memoryos-ci-result.json':8192,'memoryos-ci-evidence.json':16384,'evaluation-identity.json':4060,'policy-outcome.json':4060,'memoryos-ci-artifacts.json':8192,'memoryos-ci-complete.json':1024};
export async function verifyBundle(directory,installation,options={}) {
  absolutePath(directory);
  const names=fs.readdirSync(directory).sort();
  const semanticNames=['evaluation-identity.json','policy-outcome.json'];
  const basic=Object.keys(caps).filter(x=>!semanticNames.includes(x)).sort();
  if(J(names)!==J(basic)&&J(names)!==J(Object.keys(caps).sort()))reject('BUNDLE_INTEGRITY');
  await checkPaths(names.map(name=>({path:path.join(directory,name),allowMissingLeaf:false})),options);
  const contents=new Map(names.map(name=>[name,readChecked(path.join(directory,name),caps[name])]));
  if([...contents.values()].reduce((sum,b)=>sum+b.length,0)>49152)reject('BUNDLE_INTEGRITY');
  function json(name,schema) {
    const bytes=contents.get(name),value=validate(schema,parseJSON(bytes,caps[name],'BUNDLE_INTEGRITY'),'BUNDLE_INTEGRITY');
    if(J(value)!==bytes.toString('utf8'))reject('BUNDLE_INTEGRITY');return value;
  }
  const result=checkResult(json('memoryos-ci-result.json','Result'));
  const evidence=json('memoryos-ci-evidence.json','Evidence'),manifest=json('memoryos-ci-artifacts.json','Artifacts'),marker=json('memoryos-ci-complete.json','Complete');
  const runId=result.runId,ids=installation.identities;
  if(path.basename(directory)!==runId||[evidence,manifest,marker].some(v=>v.runId!==runId)||marker.manifestSha256!==digest(contents.get('memoryos-ci-artifacts.json')))reject('BUNDLE_INTEGRITY');
  const members=names.filter(n=>n!=='memoryos-ci-artifacts.json'&&n!=='memoryos-ci-complete.json');
  if(J(manifest.files.map(r=>r.path))!==J(members))reject('BUNDLE_INTEGRITY');
  for(const row of manifest.files)if(row.byteLength!==contents.get(row.path).length||row.sha256!==digest(contents.get(row.path)))reject('BUNDLE_INTEGRITY');
  if(evidence.resultSha256!==digest(contents.get('memoryos-ci-result.json'))||evidence.projectionSha256!==digest(J(result.projection))||evidence.configurationSha256!==result.configurationDigest||evidence.contract.sha256!==ids.contractDigest||evidence.contract.limitsSha256!==ids.limitsDigest||result.contractDigest!==ids.contractDigest||result.limitsDigest!==ids.limitsDigest||result.adapterDigest!==ids.adapterDigest||evidence.adapter.sha256!==ids.adapterDigest||evidence.adapter.id!=='memoryos.cicd.adapter.'+result.provider||evidence.metadata.provider!==result.provider||evidence.distributionSha256!==ids.distributionDigest||evidence.runtimeClosureSha256!==ids.runtimeClosureDigest||evidence.runtime.nodeSha256!==ids.nodeDigest||evidence.semanticContractSha256!==semanticContractDigest)reject('BUNDLE_INTEGRITY');
  const roles=evidence.inputs.map(r=>r.role);
  if(roles.length && !['policy','policySet'].includes(roles[0]) || roles.length>1&&roles[1]!=='candidateMip'||roles.length>2&&roles[2]!=='baselineMip')reject('BUNDLE_INTEGRITY');
  if(result.inputDigest!==null&&result.inputDigest!==digest(J(evidence.inputs)))reject('BUNDLE_INTEGRITY');
  if(result.semantic) {
    if(names.length!==6||roles.length<2||result.inputDigest===null||result.configurationDigest===null)reject('BUNDLE_INTEGRITY');
    await verifySemantic({...result.semantic,evaluationIdentityBase64:contents.get('evaluation-identity.json').toString('base64'),outcomeBase64:contents.get('policy-outcome.json').toString('base64')});
  } else if(names.length!==4)reject('BUNDLE_INTEGRITY');
  return {result,evidence,manifest,marker};
}
