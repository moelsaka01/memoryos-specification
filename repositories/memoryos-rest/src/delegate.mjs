import { decodeBase64 } from './schema.mjs';
import { identities } from './contracts.mjs';
import { J } from './serialization.mjs';
import { reject, projectSemanticError } from './errors.mjs';
const b64=bytes=>Buffer.from(bytes).toString('base64');
function verification(result, outcome=false){
  const value={status:'ok',artifactKind:result.artifactKind,artifactVersion:result.artifactVersion,
    verified:result.verified,authority:result.authority,verificationScope:result.verificationScope,
    evaluationIdentityDigest:result.evaluationIdentityDigest};
  if(outcome){value.decision=result.decision;value.outcomeDigest=result.outcomeDigest;}
  return value;
}
/** SDK imports are supplied only after the worker has verified bytes and installed denial hooks. */
export function delegate(operation, input, sdk, mip) {
  const memory=new sdk.MemoryOS();
  if(sdk.MEMORYOS_SDK_VERSION!=='1.1.0'||J(memory.policyContractIdentities())!==J(identities))reject('RUNTIME_INTEGRITY');
  try {
    if(operation==='getContractIdentities')return {status:'ok',identities:memory.policyContractIdentities()};
    if(operation==='preparePolicy'||operation==='preparePolicySet'){
      const set=operation==='preparePolicySet', prepared=set?memory.preparePolicySet(decodeBase64(input.policySetBase64,4096)):memory.preparePolicy(decodeBase64(input.policyBase64,2048));
      return {status:'ok',artifactKind:prepared.kind,artifactVersion:prepared.version,canonicalArtifactBase64:b64(prepared.toBytes()),documentDigest:prepared.documentDigest,semanticDigest:prepared.semanticDigest};
    }
    if(operation==='evaluatePolicy'){
      const set=input.artifactKind==='policySet', bytes=decodeBase64(input.artifactBase64,set?4096:2048);
      const prepared=set?memory.preparePolicySet(bytes):memory.preparePolicy(bytes);
      const investigation=memory.importPackage(decodeBase64(input.candidateMipBase64,524288),{identifier:'memoryos-policy-evaluation-candidate'});
      const context=memory.capturePolicyFactContext(investigation);
      const evaluation=set?memory.evaluatePolicySet(prepared,context,{}):memory.evaluatePolicy(prepared,context,{});
      const identity=evaluation.evaluationIdentityBytes(),outcome=evaluation.canonicalOutcomeBytes();
      memory.verifyEvaluationIdentityArtifact(identity,evaluation.evaluationIdentityDigest);
      memory.verifyPolicyEvaluationOutcomeArtifact(outcome,{expectedEvaluationIdentityDigest:evaluation.evaluationIdentityDigest,expectedOutcomeDigest:evaluation.outcomeDigest});
      return {status:'ok',artifactKind:prepared.kind,semanticDigest:prepared.semanticDigest,decision:evaluation.decision,
        evaluationIdentityBase64:b64(identity),evaluationIdentityDigest:evaluation.evaluationIdentityDigest,outcomeBase64:b64(outcome),outcomeDigest:evaluation.outcomeDigest};
    }
    if(operation==='verifyEvaluationIdentity')return verification(memory.verifyEvaluationIdentityArtifact(decodeBase64(input.evaluationIdentityBase64,4060),input.expectedEvaluationIdentityDigest));
    if(operation==='verifyPolicyOutcome')return verification(memory.verifyPolicyEvaluationOutcomeArtifact(decodeBase64(input.outcomeBase64,4060),{expectedEvaluationIdentityDigest:input.expectedEvaluationIdentityDigest,expectedOutcomeDigest:input.expectedOutcomeDigest}),true);
    reject('INTERNAL_FAILURE');
  } catch(error){return projectSemanticError(error,{...sdk,...mip});}
}
