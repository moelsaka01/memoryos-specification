// Offline analysis only. No helper/process launch and no response contents logged.
import assert from 'node:assert/strict';
import {evidence,baseline,json,read,record,check,write,hash} from './common.mjs';
import {decodeHelperRequest,encodeHelperResponse} from '../../../memoryos-readiness/src/helper-protocol.mjs';
const plan=json(evidence+'/sample-plan.json'),campaign=json(evidence+'/campaign.json');
check(campaign.plan);for(const p of plan.sourceBindings)check(p);
const samples=campaign.samples.map(row=>{check(row.receipt);return json(row.receipt.path);});
assert.equal(campaign.actualHelperExecutions,samples.length);assert.equal(samples.length,1);assert.equal(samples[0].sampleId,'01-E');
assert.equal(campaign.result,'STOPPED');assert.equal(campaign.retries,0);assert.equal(campaign.sourceIntegrityUnchanged,true);
const failed=samples[0],request=decodeHelperRequest(read(failed.request.path));
const possibleCodes=['MO1307_INPUT','MO1307_FILESYSTEM_BOUNDARY','MO1307_RESOURCE_LIMIT','MO1307_INTERNAL'];
const candidates=possibleCodes.map(code=>{
 const frame=encodeHelperResponse({code,files:[],kind:'MemoryOSReadinessHelperResponse',operation:request.operation,roots:[],sequence:request.sequence,session:request.session,status:'ERROR',version:'2.0.0'},request);
 return {code,byteLength:frame.length,sha256:hash(frame),matchesRecordedResponse:frame.length===failed.response.byteLength&&hash(frame)===failed.response.sha256};
});
const matches=candidates.filter(c=>c.matchesRecordedResponse);assert.equal(matches.length,1);assert.equal(matches[0].code,'MO1307_FILESYSTEM_BOUNDARY');
write(evidence+'/response-classification.json',{kind:'MO1307UncensoredResponseClassification',result:'VALID_MATCHING_ERROR_FRAME_UNEXPECTED_SEMANTIC_RESULT',baseline,sample:campaign.samples[0].receipt,request:failed.request,responseIdentity:failed.response,
 method:'Offline reconstruction in memory of each of the four canonical protocol-allowed empty ERROR frames with the exact retained request operation/session/sequence. Unique byte-length and SHA-256 equality identifies the recorded frame. No new helper execution and no payload logged.',
 candidates,identifiedStatus:'ERROR',identifiedCode:matches[0].code,expectedStatus:'ABSENT',
 originalFlagExplanation:'The immutable sample receipt records validation.protocol=false because its bundled success gate asserts expected ABSENT before setting that flag. The unchanged transport already accepted a matching valid frame; this supplementary digest equality confirms a canonical error frame. It is not a malformed-frame finding or a successful control.',
 rootCause:'NOT_ESTABLISHED; filesystem-boundary refusal is an observed native result, not proof that source content changed or the observer caused it.',
 nativeExecutions:0,fileContentsLogged:false,productionChanges:false,certification:false});
const summarize=values=>{const sorted=[...values].sort((a,b)=>a-b),n=values.length;return {n,raw:values,min:n?sorted[0]:null,max:n?sorted.at(-1):null,median:n?(n%2?sorted[(n-1)/2]:(sorted[n/2-1]+sorted[n/2])/2):null};};
const qualifying=samples.filter(s=>s.result==='QUALIFYING_COMPLETION');
const stats={kind:'MO1307UncensoredStatistics',baseline,result:'STOPPED_CHARACTERIZATION_DEFECT',plan:campaign.plan,campaign:record(evidence+'/campaign.json'),sampleCount:samples.length,
 plannedCounts:plan.counts,executedCounts:{C:samples.filter(s=>s.case==='C').length,E:samples.filter(s=>s.case==='E').length},qualifyingCount:qualifying.length,
 withinProductBoundCount:qualifying.filter(s=>s.classification==='WITHIN_PRODUCT_BOUND').length,beyondProductBoundCount:qualifying.filter(s=>s.classification==='SUCCESSFUL_COMPLETION_BEYOND_PRODUCT_BOUND').length,
 engineeringGuardExceedanceCount:samples.filter(s=>s.classification==='ENGINEERING_GUARD_EXCEEDED').length,unexpectedSemanticFailureCount:1,malformedProtocolFramesEstablished:0,inputOrSourceIntegrityFailuresEstablished:0,
 byCase:['C','E'].map(caseId=>({case:caseId,planned:plan.counts[caseId],executed:samples.filter(s=>s.case===caseId).length,qualifying:qualifying.filter(s=>s.case===caseId).length,successfulCompletionMs:summarize(qualifying.filter(s=>s.case===caseId).map(s=>s.wholeLifecycleMs))})),
 rawLedger:samples.map(s=>({sampleId:s.sampleId,case:s.case,result:s.result,classification:s.classification,transportQuiescentDurationMs:s.wholeLifecycleMs,qualifyingSuccessfulCompletion:false,response:s.response,decodedStatus:'ERROR',decodedCode:'MO1307_FILESYSTEM_BOUNDARY',nativeObserver:s.nativeObserver})),
 unexecuted:plan.order.slice(samples.length),retries:0,replacements:0,discardedSamples:0,adaptiveExpansion:false,claimType:plan.method?json(plan.method.path).claimType:null,
 toleranceStatistic:'NOT_ESTABLISHED: zero Case-C observations and no qualifying control. The finite predeclared campaign did not establish an empirical C envelope.',historicalPooling:false,nativeExecutionsByAnalysis:0};
write(evidence+'/statistics.json',stats);
write(evidence+'/raw-sample-ledger.json',{kind:'MO1307UncensoredRawLedger',rows:stats.rawLedger,unexecuted:stats.unexecuted,sourceReceipts:campaign.samples.map(s=>s.receipt),noFileContents:true});
const native=json(failed.nativeObserver.path),start=json(evidence+'/campaign-start.json'),observer=json(evidence+'/observer/receipt.json'),validation=json(evidence+'/harness-validation.json');
const overhead={kind:'MO1307UncensoredObserverOverhead',result:'MEASURED_NOT_SUBTRACTED',sample:campaign.samples[0].receipt,nativeObservation:failed.nativeObserver,
 startupSnapshotCalibrationMs:start.observer.ready.calibration.map(x=>x.elapsedMs),startupCalibrationObserverCpuMs:start.observer.ready.calibrationObserverCpuMs,
 observerTotalCpuAfterCalibrationMs:observer.observerCpuMsAfterCalibration,
 actualSample:{controlWriteMs:failed.observerControlWriteMs,allSnapshotQueryMs:native.snapshotQueryMs,inClockDiscoverySnapshotMs:native.discoverySnapshots.filter(x=>x.reason!=='FINAL_SETTLED').reduce((n,x)=>n+x.elapsedMs,0),nativeObservationWorkMs:native.nativeObservationWorkMs,discoverySnapshotCount:native.discoverySnapshots.filter(x=>x.reason!=='FINAL_SETTLED').length,finalSnapshotMs:native.discoverySnapshots.find(x=>x.reason==='FINAL_SETTLED').elapsedMs},
 monotonicCalibration:validation.clockCalibration,
 limitations:['Snapshots and IPC can perturb scheduling; their measured wall work is concurrent and not subtractable helper latency.','One failed E control provides no observer effect estimate for Case C.','QPC/FILETIME and Node events are retained in their native domains; no invented universal cross-clock bound.','Preflight1 Python buffered-reader shutdown failure and repaired preflight2/3 are separate zero-helper attempts, not sample replacements.'],source:record(evidence+'/harness-validation.json'),nativeExecutionsByAnalysis:0};
write(evidence+'/observer-overhead.json',overhead);
const transfer=record(evidence+'/private-sequence-transfer.json');
write(evidence+'/u-analysis.json',{kind:'MO1307UncensoredUAnalysis',valueMs:null,status:'NOT_ESTABLISHED',method:'Predeclared finite observed engineering envelope required all60 qualifying C observations; zero C ran after first E semantic stop.',observedCaseCSuccesses:0,statistics:record(evidence+'/statistics.json'),noPopulationClaim:true});
write(evidence+'/v-analysis.json',{kind:'MO1307UncensoredVAnalysis',valueMs:null,status:'NOT_ESTABLISHED',rationale:'V_observed=0 was conditional on a completed finite C envelope already including observed variance. With zero C observations that condition is absent. No arbitrary reserve and no independently bounded future ordinary-load/startup variability.',method:plan.method});
write(evidence+'/q-analysis.json',{kind:'MO1307UncensoredQAnalysis',valueMs:null,status:'NOT_ESTABLISHED',transfer,overhead:record(evidence+'/observer-overhead.json'),finiteTransferSummary:json(transfer.path).summary.totalMeasuredTransferMs,
 rationale:'The measured finite transfer and calibration costs are observations, not a numerical upper bound on transfer/scheduling/event/console-attribution uncertainty. They cannot establish Q for an unobserved C envelope. Unknown residual uncertainty cannot be asserted to fit a rounding remainder.',noDoubleCounting:true,noOverheadSubtraction:true,noArbitraryPadding:true});
write(evidence+'/r-calculation.json',{kind:'MO1307UncensoredRCalculation',formula:'R=U+V+Q',U:null,V:null,Q:null,R:null,status:'NOT_ESTABLISHED',reason:'Required terms are not defensibly established.'});
write(evidence+'/h-rounding.json',{kind:'MO1307UncensoredHRounding',formula:'H=500*ceil(R/500)',granularityMs:500,minimumExclusiveMs:5000,maximumInclusiveMs:20000,R:null,H:null,status:'NOT_ESTABLISHED',roundingApplied:false,ruleUnchanged:true,reason:'No R exists to round; no value is selected first.'});
const bindingNames=['inference-method','sample-plan','request-identities','runtime-environment','campaign','statistics','raw-sample-ledger','response-classification','observer-overhead','u-analysis','v-analysis','q-analysis','private-sequence-transfer','r-calculation','h-rounding','aggregate-analysis','cli-analysis','security-analysis','recertification-impact','authority-binding','source-before','source-after','integrity-before','harness-validation','preflight-attempt-1','preflight-attempt-2'];
write(evidence+'/decision.json',{kind:'MO1307UncensoredDecision',version:'1.0.0',baseline,result:'CHARACTERIZATION_DEFECT',evidenceClosureComplete:true,boundSelected:false,
 reason:'The exact first E control returned a valid canonical MO1307_FILESYSTEM_BOUNDARY ERROR instead of ABSENT. The predeclared unexpected-semantic stop ended the campaign afterone helper; all60 C andremaining9E were unexecuted. Root cause is not established; this decision identifies an unusable characterization, not a proven product-code defect.',
 counts:{plannedC:60,executedC:0,plannedE:10,executedE:1,qualifying:0,beyond5000:0,guardExceedances:0,unexpectedSemanticFailures:1,unexecuted:69,retries:0},
 claimType:'FINITE_OBSERVED_ENGINEERING_ENVELOPE',iidExchangeability:'NOT_ESTABLISHED',U:null,V:null,Q:null,R:null,H:null,
 currentLimits:{helperMs:5000,aggregateMs:20000,cliMs:30000,apiMs:10000,workerMs:10000,cleanupMs:2000},engineeringGuardMs:20000,
 C1:'Conditional previous design remains; no numeric candidate exists to evaluate. No evidence establishes a need to broaden aggregate/CLI/API/worker/cleanup.',
 cleanup:{helperAndAttributableConsoleSignaled:true,transportCleanupConfirmed:true,engineeringCleanupConfirmed:true,unexpectedObservedTopology:false,completeDescendantCoverageEstablished:false,guardCleanupInvoked:false},
 nextTask:{title:'MO-1307 CONTROL-E FILESYSTEM-BOUNDARY REFUSAL DIAGNOSTIC AUTHORITY',authorizationRequired:true,executedHere:false,
 scope:'Separately authorize a finite diagnostic of the exact retained CHECK_OUTPUT request/root and this recorded MO1307_FILESYSTEM_BOUNDARY refusal, first distinguishing fixture/filesystem identity/sharing preconditions from observer/launch effects. Bind this stopped campaign and its exact bytes; preserve all current product bounds and history. Do not rerun, replace, or expand this campaign. Any later fresh uncensored campaign requires its own sealed plan and authority.',
 productionCorrectionAuthorized:false,automaticFollowup:false},
 phase3AR:'BLOCKED',phase3BR:'UNCHANGED_ACCEPTED_C3RB_ONLY',phase3CR:'UNCHANGED_ACCEPTED_C3RB_ONLY',phase3D:false,
 futureCorrectionImpact:{phase3AR:'FRESH_AUTHORIZED_CERTIFICATION_REQUIRED',phase3BR:'TARGETED_PACKAGE_REFRESH_REQUIRED',phase3CR:'TARGETED_SECURITY_BOUNDARY_REFRESH_REQUIRED'},
 bindings:bindingNames.map(n=>record(evidence+'/'+n+'.json')),productionChanges:false,freezeChanges:false,packageRegeneration:false,versionChanges:false,certification:false,push:false,tag:false,nativeExecutionsByAnalysis:0});
console.log(JSON.stringify({result:'CHARACTERIZATION_DEFECT',executed:{C:0,E:1},response:'MO1307_FILESYSTEM_BOUNDARY',unexecuted:69,U:null,V:null,Q:null,R:null,H:null}));
