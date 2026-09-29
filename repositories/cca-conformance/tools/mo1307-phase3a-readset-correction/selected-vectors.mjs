// Read-only selected exact semantics; never invokes native acquisition.
import assert from 'node:assert/strict';
import {hash} from './common.mjs';
import {bundleNames,loadProjection} from '../mo1307-phase2a/fixture-projection.mjs';
import {loadBundle,inputOf} from '../mo1307-phase2b/test-support.mjs';
import {computeReadiness} from '../../../memoryos-readiness/src/readiness-core.mjs';
import {projectReadinessResult} from '../../../memoryos-readiness/src/readiness-result.mjs';
import {verifyEvidence,verifyResultEvidence} from '../../../memoryos-readiness/src/evidence-verifier.mjs';
import {adaptVerifiedEvidence} from '../../../memoryos-readiness/src/integration.mjs';
import {canonicalBytes} from '../../../memoryos-readiness/src/canonical.mjs';
const vectors=[];
for(const name of bundleNames){
 const f=loadProjection(name),a=computeReadiness(f.verified);assert.deepEqual(a.resultBytes,f.expectedBytes);assert.deepEqual(projectReadinessResult(a.result,'json'),f.summaryBytes);
 const bundle=loadBundle(name),input=inputOf(bundle),verified=verifyEvidence(input),actual=computeReadiness(adaptVerifiedEvidence(verified));verifyResultEvidence(input,canonicalBytes(bundle.result));
 assert.deepEqual(actual.resultBytes,f.expectedBytes);assert.equal(actual.readinessDigest,a.readinessDigest);assert.equal(actual.proofBindingDigest,a.proofBindingDigest);
 vectors.push({name,result:'PASS',readiness:actual.result.assessment.readiness,exit:actual.exitCode,gates:actual.result.assessment.gates.length,qualifications:actual.result.assessment.qualifications.length,resultBytes:{byteLength:actual.resultBytes.length,sha256:hash(actual.resultBytes)},readinessDigest:actual.readinessDigest,proofBindingDigest:actual.proofBindingDigest,projectionDigest:hash(canonicalBytes(verified.projection)),auditDigest:hash(canonicalBytes(verified.audit)),exact2A:true,exact2B:true,exactIntegrated:true});
}
assert.equal(vectors.length,16);console.log(JSON.stringify({kind:'MO1307ReadSetSemanticPreservation',result:'PASS',vectors,productionSemanticsChanged:false,nativeAcquisitionClaim:false}));