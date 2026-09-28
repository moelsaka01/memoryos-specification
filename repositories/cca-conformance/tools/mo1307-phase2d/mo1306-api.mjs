// Actual byte-only public API; separate from native acquisition limitations.
import fs from 'node:fs';
import path from 'node:path';
import assert from 'node:assert/strict';
import {performance} from 'node:perf_hooks';
import {root,evidence,record,check,write,hash} from './common.mjs';
import {packageFiles} from '../mo1307-phase1/package.mjs';
import {loadBundle,inputOf} from '../mo1307-phase2b/test-support.mjs';
import {canonicalBytes} from '../../../memoryos-readiness/src/canonical.mjs';
import {evaluateReadiness,verifyReadiness} from '../../../memoryos-readiness/src/index.mjs';
assert.equal(process.version,'v24.21.0');assert.equal(hash(fs.readFileSync(process.execPath)),'sha256:ba4e6d110e8c1592a1ecd390f6b05f3da124b13871a5be62b341a07a853c6c32');
const output=evidence+'/api/mo1306-attempt1';assert.equal(fs.existsSync(path.join(root,output)),false);fs.mkdirSync(path.join(root,output),{recursive:true});
const walk=p=>fs.readdirSync(path.join(root,p)).sort().flatMap(n=>{const next=p+'/'+n;return fs.statSync(path.join(root,next)).isDirectory()?walk(next):[next];});
const bindings=[...packageFiles.map(p=>'repositories/memoryos-readiness/'+p),...walk('repositories/cca-conformance/fixtures/mo1307/bundles/mo1306-qualified'),
 'repositories/cca-conformance/tools/mo1307-phase2d/mo1306-api.mjs','repositories/cca-conformance/tools/mo1307-phase2d/common.mjs','repositories/cca-conformance/tools/mo1307-phase2b/test-support.mjs'].map(p=>record(p));
write(output+'/campaign.json',{kind:'MO1307ReleasedVectorPublicApiCampaign',sourceBindings:bindings,actualFixedWorker:true,byteOnly:true,nativeAcquisitionClaim:false,retries:0});
const start=performance.now();let result='PASS',failure=null,details=null;
try{
 const b=loadBundle('mo1306-qualified'),input=inputOf(b),expected=canonicalBytes(b.result),evaluated=await evaluateReadiness(input);
 assert.deepEqual(Buffer.from(evaluated.resultBytes),expected);assert.equal(evaluated.readinessDigest,b.result.readinessDigest);assert.equal(evaluated.proofBindingDigest,b.result.proofBindingDigest);
 const decisionBytes=canonicalBytes({kind:'MemoryOSReadinessHumanDecision',version:'1.0.0',candidateDigest:b.result.assessment.candidateDigest,readinessDigest:b.result.readinessDigest,proofBindingDigest:b.result.proofBindingDigest,decision:'REJECT',actor:null,timestamp:null,reason:'Phase2D MO1306 byte API decision binding',attestation:null,authenticity:'NOT_VERIFIED_BY_MEMORYOS'});
 const verified=await verifyReadiness({...input,resultBytes:evaluated.resultBytes,decisionBytes});assert.deepEqual(Buffer.from(verified.resultBytes),expected);assert.equal(verified.readinessDigest,evaluated.readinessDigest);assert.equal(verified.proofBindingDigest,evaluated.proofBindingDigest);assert.equal(verified.decision.decision,'REJECT');assert.equal(verified.decision.authenticity,'NOT_VERIFIED_BY_MEMORYOS');
 assert.equal(b.result.assessment.readiness,'READY_WITH_QUALIFICATIONS');assert.equal(b.result.assessment.gates.length,22);assert.equal(b.result.assessment.qualifications.length,10);
 fs.writeFileSync(path.join(root,output,'result.json'),expected,{flag:'wx'});fs.writeFileSync(path.join(root,output,'decision.json'),decisionBytes,{flag:'wx'});
 details={readiness:b.result.assessment.readiness,readinessExitProjection:2,gates:22,qualifications:10,decision:verified.decision,readinessDigest:evaluated.readinessDigest,proofBindingDigest:evaluated.proofBindingDigest,resultBytes:record(output+'/result.json'),decisionBytes:record(output+'/decision.json'),actualPublicEvaluate:true,actualPublicVerify:true,actualFixedWorker:true};
 for(const m of bindings)check(m);
}catch(error){result='FAIL';failure={code:error.code??null,message:error.message,stack:error.stack};}
write(output+'/receipt.json',{kind:'MO1307ReleasedVectorPublicApiReceipt',result,failure,details,sourceBindings:bindings,elapsedMs:performance.now()-start,nativeAcquisitionClaim:false});
console.log(JSON.stringify({result,details,failure,elapsedMs:performance.now()-start}));process.exitCode=result==='PASS'?0:1;
