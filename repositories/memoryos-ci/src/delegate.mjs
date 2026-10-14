import { J } from './serialization.mjs';
import { semanticIdentities, semanticErrorCodes, validate } from './contracts.mjs';
import { decodeBase64 } from './schema.mjs';
import { CIError, reject, errorObject } from './errors.mjs';

export function delegate(request,sdk,mip) {
  validate('WorkerRequest',request,'WORKER_PROTOCOL');
  const set=request.operation==='evaluatePolicySet';
  if((set?request.policyBase64:request.policySetBase64)!==null || (set?request.policySetBase64:request.policyBase64)===null)reject('WORKER_PROTOCOL');
  const memory=new sdk.MemoryOS();
  if(sdk.MEMORYOS_SDK_VERSION!=='1.1.0'||J(memory.policyContractIdentities())!==J(semanticIdentities))reject('RUNTIME_INTEGRITY');
  try {
    const prepared=set?memory.preparePolicySet(decodeBase64(request.policySetBase64,4096)):memory.preparePolicy(decodeBase64(request.policyBase64,2048));
    if(prepared.semanticDigest!==request.expectedSemanticDigest)reject('POLICY_PIN');
    const candidate=memory.importPackage(decodeBase64(request.candidateMipBase64,524288),{identifier:'memoryos-policy-evaluation-candidate'});
    let context,options={};
    if(request.baselineMipBase64===null) context=memory.capturePolicyFactContext(candidate);
    else {
      const baseline=memory.importPackage(decodeBase64(request.baselineMipBase64,524288),{identifier:'memoryos-policy-evaluation-baseline'});
      const bundle=memory.captureRegressionPolicyFacts(baseline,candidate);
      context=bundle.policyFactContext;options={regressionSource:bundle.regressionPolicyFactSource};
    }
    const evaluation=set?memory.evaluatePolicySet(prepared,context,options):memory.evaluatePolicy(prepared,context,options);
    const identity=evaluation.evaluationIdentityBytes(),outcome=evaluation.canonicalOutcomeBytes();
    if(identity.length>4060||outcome.length>4060)reject('SEMANTIC_INTEGRITY');
    memory.verifyEvaluationIdentityArtifact(identity,evaluation.evaluationIdentityDigest);
    memory.verifyPolicyEvaluationOutcomeArtifact(outcome,{expectedEvaluationIdentityDigest:evaluation.evaluationIdentityDigest,expectedOutcomeDigest:evaluation.outcomeDigest});
    memory.verifyEvaluationIdentityForEvaluation(identity,prepared,context,options);
    memory.verifyPolicyEvaluationOutcomeForEvaluation(outcome,prepared,context,options);
    return {artifactKind:set?'policySet':'policy',documentDigest:prepared.documentDigest,semanticDigest:prepared.semanticDigest,decision:evaluation.decision,evaluationIdentityDigest:evaluation.evaluationIdentityDigest,outcomeDigest:evaluation.outcomeDigest,evaluationIdentityBase64:Buffer.from(identity).toString('base64'),outcomeBase64:Buffer.from(outcome).toString('base64')};
  } catch(error) {
    if(error instanceof CIError)throw error;
    if(error instanceof sdk.MemoryOSPolicyPreparationError||error instanceof sdk.MemoryOSPolicyOperationalError||error instanceof mip.MemoryInvestigationPackageError) {
      const code=error.code ?? error.diagnostics?.[0]?.code;
      if(typeof code==='string'&&semanticErrorCodes.has(code)&&/^[A-Z][A-Z0-9_]{0,127}$/.test(code))reject('SEMANTIC_VALIDATION',code);
    }
    reject('SEMANTIC_INVOCATION');
  }
}
