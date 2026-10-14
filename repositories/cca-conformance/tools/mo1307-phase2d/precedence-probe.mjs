// One bounded engineering reproduction of accepted mixed-error phase precedence.
import assert from 'node:assert/strict';
import {evidence,record,write} from './common.mjs';
import {loadBundle,envelopeFor,grantFor,repin} from '../mo1307-phase2b/test-support.mjs';
import {verifyEvidence} from '../../../memoryos-readiness/src/evidence-verifier.mjs';
import {assessInWorker} from '../../../memoryos-readiness/src/integration.mjs';
assert.match(process.argv[2]??'',/^(before|after)$/);
const b=loadBundle('qualified'),envelope=envelopeFor(b,'PROVIDER_CERTIFICATION','github');
envelope.claim.detail.support='SUPPORTED';repin(b);grantFor(b,envelope).claimDigest='sha256:'+'0'.repeat(64);
const input=repin(b,{grants:false}),observe=action=>{try{action();return {accepted:true};}catch(error){return {code:error.code,stage:error.stage,reference:error.reference};}};
const authority=observe(()=>verifyEvidence(input)),integrated=observe(()=>assessInWorker(input,false));
assert.equal(authority.code,'MO1307_EVIDENCE_AUTHORITY');assert.equal(authority.stage,'AUTHORITY');
const matches=integrated.code===authority.code&&integrated.stage===authority.stage;
write(evidence+'/development/phase-precedence/'+process.argv[2]+'.json',{kind:'MO1307IntegrationPrecedenceDiagnostic',version:'1.0.0',
 result:matches?'CORRECTED':'INTEGRATION_DEFECT_REPRODUCED',authority,integrated,
 sourceBindings:['integration','evidence-verifier','foundation'].map(p=>record('repositories/memoryos-readiness/src/'+p+'.mjs')),
 contract:'Accepted2B A33 requires earlier AUTHORITY failure over later provider EVALUATION contradiction; no normative change.'});
console.log(JSON.stringify({matches,authority,integrated}));
if(process.argv[2]==='after')assert.equal(matches,true);
