import fs from 'node:fs';
import path from 'node:path';
import os from 'node:os';
import assert from 'node:assert/strict';
import {root,evidence,baseline,read,json,record,check,write,str,hash,blobs} from './common.mjs';
import {packageFiles} from '../mo1307-phase1/package.mjs';
import {helperLaunchSpecification} from '../../../memoryos-readiness/src/helper-transport.mjs';
import {decodeHelperRequest} from '../../../memoryos-readiness/src/helper-protocol.mjs';
assert.equal(str('rev-parse','HEAD'),baseline);assert.equal(str('branch','--show-current'),'main');
assert.equal(process.version,'v24.21.0');assert.equal(process.platform,'win32');assert.equal(process.arch,'x64');
assert.equal(hash(read(process.execPath)),'sha256:ba4e6d110e8c1592a1ecd390f6b05f3da124b13871a5be62b341a07a853c6c32');
const tools='repositories/cca-conformance/tools/mo1307-helper-deadline-uncensored';
const c3rb='defe93989efc6501b1a730b82e79e705884b269b', prior='repositories/cca-conformance/evidence/mo1307/helper-deadline-characterization';
const members=packageFiles.map(p=>record('repositories/memoryos-readiness/'+p));assert.equal(members.length,89);
blobs(c3rb,members.map(m=>m.path)).forEach((b,i)=>check(members[i],b));
const helper=members.find(m=>m.path.endsWith('/helpers/windows-inspect.ps1'));
assert.equal(helper.byteLength,30210);assert.equal(helper.sha256,'sha256:35381850f1ef8c322e528156ebd8779071ad3288cdccd4d0ebab51ce6f9c6ac8');
write(evidence+'/integrity-before.json',{kind:'MO1307UncensoredIntegrityBefore',result:'PASS',baseline,c3rb,members,count:89,capturedAtUtc:new Date().toISOString(),productionChanges:false});
const cases=json(prior+'/sample-plan.json').cases.filter(c=>['C','E'].includes(c.id));
for(const c of cases){check(c.request);for(const m of c.members)check(m);if(c.manifest)check(c.manifest);const req=decodeHelperRequest(read(c.request.path));assert.equal(req.operation,c.operation);if(c.id==='E')assert.equal(fs.existsSync(c.root),false);}
assert.deepEqual(cases.map(c=>[c.id,c.fileCount,c.aggregateBytes,c.requestFrameBytes]),[['C',65,2004208,7570],['E',0,0,345]]);
const runtime=json(prior+'/runtime-environment.json');check(runtime.node.executable);check(runtime.powershell.executable);
write(evidence+'/runtime-environment.json',{kind:'MO1307UncensoredRuntimeEnvironment',result:'IDENTITY_VERIFIED',capturedAtUtc:new Date().toISOString(),node:{version:process.version,executable:record(process.execPath)},powershell:{executable:runtime.powershell.executable,versionSource:record(prior+'/runtime-environment.json'),versionDisposition:'Prior version observation applies to the identical executable hash; no new PowerShell probe launched.'},launch:helperLaunchSpecification(),os:{platform:process.platform,arch:process.arch,release:os.release(),version:os.version(),totalMemoryBytes:os.totalmem(),availableMemoryBytes:os.freemem()},ordinaryLoad:{stress:false,tuning:false,cacheFlush:false,reboot:false,priorityChange:false,defenderChange:false,unrelatedProcessClosure:false,limitations:'Single ordinary-load time window. Fresh process, not cold start. Integrity reads and fixed offline calibration may warm caches; no deliberate warmup helpers.'}});
const method={kind:'MO1307UncensoredInferenceMethod',version:'1.0.0',declaredAtUtc:new Date().toISOString(),baseline,
 claimType:'FINITE_OBSERVED_ENGINEERING_ENVELOPE',iidExchangeability:'NOT_ESTABLISHED',
 reason:'One sequential ordinary-load window with deterministic interleaving, uncontrolled activity, common caches and startup state cannot establish exchangeability. 60 observations alone do not authorize 95/95 inference.',
 U:{rule:'If all planned 60 Case-C samples have qualifying uncensored semantic/exit/console completion, report the maximum whole-lifecycle completion as U_observed for this finite campaign only. Otherwise report the observed qualifying maximum descriptively and leave selection U NOT_ESTABLISHED.',scope:'No population coverage, future-load guarantee, zero-timeout probability, worst-case Windows bound or mathematical maximum.'},
 V:{rule:'For the finite observed envelope V_observed=0 because its observed ordinary-load/startup variability is already in its maximum. Future variability beyond this single window is not numerically bounded and must remain explicit; do not manufacture a reserve or double-count the range.'},
 Q:{rule:'Measure monotonic call/timer granularity, IPC/control and snapshot calibration outside the helper clock; retain actual event-order differences and exact native handle identities. Measure private-sequence transfer separately without double-counting transport decode. These finite observations do not automatically upper-bound future measurement/transfer cost.',unknownRule:'Unbounded residual uncertainty remains NOT_ESTABLISHED. Upward rounding can absorb it only if a defensible numerical upper bound proves it fits the rounding remainder. Unknown uncertainty cannot be absorbed by assertion.'},
 R:{formula:'R=U+V+Q',gate:'A finite observed U is not alone a transferable replacement-bound claim. Every required transfer/residual variability term must be defensibly bounded; otherwise R remains NOT_ESTABLISHED.'},
 rounding:{formula:'H=500*ceil(R/500)',granularityMs:500,minimumExclusiveMs:5000,maximumInclusiveMs:20000,changeAfterOutcomes:false},
 comparison:'Retained product campaigns are separate corroboration, never pooled or used as successful observations when censored. Controls detect broad slowdown but do not derive Case-C U.',
 decisionBranches:['BOUND_SELECTED','BOUND_NOT_ESTABLISHED','ENGINEERING_GUARD_EXCEEDED','CHARACTERIZATION_DEFECT'],
 noArbitraryPadding:true,noGuessedOverheadSubtraction:true,certification:false};
write(evidence+'/inference-method.json',method);
const order=[];for(let block=0;block<10;block++)for(let slot=0;slot<7;slot++){const caseId=slot===block%7?'E':'C';order.push({ordinal:order.length+1,sampleId:String(order.length+1).padStart(2,'0')+'-'+caseId,case:caseId,block:block+1});}
for(const row of order)fs.mkdirSync(path.join(root,evidence,'samples',row.sampleId),{recursive:true});
const sourceBindings=[...members,record(process.execPath),runtime.powershell.executable,record('C:/Users/melsa/.cache/codex-runtimes/codex-primary-runtime/dependencies/python/python.exe'),...['common.mjs','plan.mjs','campaign.mjs','engineering-supervisor.mjs','native-observer.py'].map(p=>record(tools+'/'+p)),record(evidence+'/inference-method.json'),record(evidence+'/runtime-environment.json'),record(prior+'/sample-plan.json'),record(evidence+'/private-sequence-transfer.json'),record(evidence+'/harness-validation.json')];
write(evidence+'/request-identities.json',{kind:'MO1307UncensoredRequestIdentities',cases,exactRetainedFrames:true,descriptorOrderRootsAndInputHashes:'EXACT',newFileContentsLogged:false});
write(evidence+'/sample-plan.json',{kind:'MO1307UncensoredSamplePlan',version:'1.0.0',baseline,createdAtUtc:new Date().toISOString(),sourceBindings,cases,order,counts:{C:60,E:10},maximumExecutions:70,retries:0,replacements:0,discardedSamples:0,adaptiveExpansion:false,
 method:record(evidence+'/inference-method.json'),limits:{productMs:5000,engineeringGuardMs:20000,engineeringCleanupMs:2000,productionAggregateMs:20000,productionCliMs:30000,productionApiMs:10000,productionWorkerMs:10000},
 lifecycleOrigin:'Monotonic capture inside engineering runOwned before start callback / child creation, matching production supervisor origin semantics. Both comparisons use that same origin. Includes unchanged production transport response decode, process/pipe settlement and native console quiescence proof. Request decode/copy precedes this origin and is separately included in transfer analysis.',
 success:'Exact production transport response validation, matching sequence/session, exit0, EOF/closed pipes, process termination, valid exact-helper native console-quiescence proof; independent retained process/console handles and exact response/input equality checked without logging contents.',
 productClassification:{within:'completion<=5000:WITHIN_PRODUCT_BOUND',beyond:'5000<completion<=20000:SUCCESSFUL_COMPLETION_BEYOND_PRODUCT_BOUND with PRODUCT_DEADLINE_EXCEEDED counterfactual, never product PASS',guard:'No qualifying completion by20000:ENGINEERING_GUARD_EXCEEDED'},
 observer:'One engineering observer process, no extra product role. Native snapshot discovery at200ms only until console handle attribution; event waits on retained handles thereafter, final snapshot; memory observations, no WMI/CIM/file polling/per-file helper instrumentation. Measure overhead without subtracting it.',
 stopConditions:['ENGINEERING_GUARD_EXCEEDED','UNCONFIRMED_ENGINEERING_CLEANUP','PROTOCOL_OR_SEMANTIC_MISMATCH','INPUT_OR_SOURCE_INTEGRITY_MISMATCH','UNEXPECTED_PROCESS_TOPOLOGY','EVIDENCE_CORRUPTION','HOST_STABILITY_RESOURCE_EXHAUSTION'],hostStabilityPrelaunchAvailableMemoryFloorBytes:268435456,
 noStopMerelyBeyond5000:true,campaignGuardMs:1800000,absoluteLastLaunchUtc:'2026-09-29T20:16:00Z',taskStartUtc:'2026-09-29T18:26:31Z',hardStopUtc:'2026-09-29T20:26:31Z',
 productionChanges:false,freezeChanges:false,phase3AR:'BLOCKED',phase3D:false,certification:false,push:false,tag:false});
console.log(JSON.stringify({result:'SEALED',counts:{C:60,E:10},order:order.map(x=>x.sampleId),claim:method.claimType,plan:record(evidence+'/sample-plan.json')}));
