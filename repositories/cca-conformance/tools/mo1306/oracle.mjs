/** Independent source SDK invocation, never imported by the product. */
import fs from 'node:fs';
import path from 'node:path';
import { MemoryOS } from '../../../cca-studio/web/js/memoryos-sdk.js';
const directory=process.argv[2],config=JSON.parse(fs.readFileSync(path.join(directory,'memoryos-ci.json')));
const sdk=new MemoryOS(),isSet=config.operation==='evaluatePolicySet';
const selected=isSet?config.policySet:config.policy;
const prepared=isSet?sdk.preparePolicySet(fs.readFileSync(path.join(directory,selected.path))):sdk.preparePolicy(fs.readFileSync(path.join(directory,selected.path)));
const candidate=sdk.importPackage(fs.readFileSync(path.join(directory,config.context.candidateMip)),{identifier:'memoryos-policy-evaluation-candidate'});
let facts,options={};
if(config.context.baselineMip) {
 const baseline=sdk.importPackage(fs.readFileSync(path.join(directory,config.context.baselineMip)),{identifier:'memoryos-policy-evaluation-baseline'});
 const pair=sdk.captureRegressionPolicyFacts(baseline,candidate);facts=pair.policyFactContext;options={regressionSource:pair.regressionPolicyFactSource};
} else facts=sdk.capturePolicyFactContext(candidate);
const result=isSet?sdk.evaluatePolicySet(prepared,facts,options):sdk.evaluatePolicy(prepared,facts,options);
fs.writeFileSync(path.join(directory,'oracle-identity.json'),result.evaluationIdentityBytes(),{flag:'wx'});
fs.writeFileSync(path.join(directory,'oracle-outcome.json'),result.canonicalOutcomeBytes(),{flag:'wx'});
process.stdout.write(JSON.stringify({decision:result.decision,documentDigest:prepared.documentDigest,semanticDigest:prepared.semanticDigest,evaluationIdentityDigest:result.evaluationIdentityDigest,outcomeDigest:result.outcomeDigest})+'\n');
