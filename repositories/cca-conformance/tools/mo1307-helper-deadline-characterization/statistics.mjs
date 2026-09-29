// Offline derivation only. All observations, failures and censored responses remain.
import assert from 'node:assert/strict';
import {evidence,baseline,json,read,record,check,write} from './common.mjs';
import {decodeHelperRequest,decodeHelperResponse} from '../../../memoryos-readiness/src/helper-protocol.mjs';
const plan=json(evidence+'/sample-plan.json'),campaign=json(evidence+'/campaign.json');
assert.equal(campaign.result,'COMPLETE');assert.equal(campaign.actualHelperExecutions,25);
export function describe(values){const raw=values.filter(v=>typeof v==='number'&&Number.isFinite(v)),sorted=[...raw].sort((a,b)=>a-b),n=sorted.length;return {n,raw,min:n?sorted[0]:null,max:n?sorted[n-1]:null,median:n?(n%2?sorted[(n-1)/2]:(sorted[n/2-1]+sorted[n/2])/2):null};}
const marginLabel=m=>m>=1500?'large':m>=750?'moderate':m>0?'thin':'violation';
const deltaMs=(a,b)=>Number(BigInt(a)-BigInt(b))/10000;
const rows=campaign.samples.map(item=>{
 check(item.receipt);const r=json(item.receipt.path);check(r.processObservation);const o=json(r.processObservation.path);
 const helper=o.lifetimes.find(l=>l.role==='helper'),console=o.lifetimes.find(l=>l.role==='console_host');
 const finalNative=helper?.nativeTimes,consoleNative=console?.nativeTimes;
 const hasHelperExit=finalNative&&BigInt(finalNative.exitTime100ns)>0n,hasConsoleExit=consoleNative&&BigInt(consoleNative.exitTime100ns)>0n;
 const before=o.contextBefore.cpuCumulative,after=o.contextAfter.cpuCumulative;
 const idle=BigInt(after.idle100ns)-BigInt(before.idle100ns),total=BigInt(after.kernel100ns)-BigInt(before.kernel100ns)+BigInt(after.user100ns)-BigInt(before.user100ns);
 const helperMemory=o.events.filter(e=>e.event==='sample').flatMap(e=>e.processes.filter(p=>p.role==='helper').map(p=>p.memory).filter(Boolean));
 let rootIdentities=null;
 if(r.result==='SUCCESS'){const response=decodeHelperResponse(read(r.response.path),decodeHelperRequest(read(r.request.path)));rootIdentities=response.roots;}
 const nativeHelperElapsedMs=hasHelperExit?deltaMs(finalNative.exitTime100ns,finalNative.creationTime100ns):null;
 const consoleExitMinusHelperExitMs=hasHelperExit&&hasConsoleExit?deltaMs(consoleNative.exitTime100ns,finalNative.exitTime100ns):null;
 return {sampleId:r.sampleId,case:r.case,result:r.result,receipt:item.receipt,observation:r.processObservation,wallClockUtc:r.wallClockUtc,
  durations:r.durations,marginClassification:marginLabel(r.durations.deadlineMarginMs),requestFrameBytes:r.requestFrameBytes,responseFrameBytes:r.responseFrameBytes,
  deadlineArmed:r.snapshot.events.find(e=>e.type==='start'&&e.role==='helper'),terminalAt:r.snapshot.terminalAt,cleanupDeadline:r.snapshot.cleanupDeadline,
  nativeHelperElapsedMs,helperCpuMs:o.helperCpuMs,consoleCpuMs:o.consoleCpuMs,elapsedMinusHelperCpuMs:nativeHelperElapsedMs===null||o.helperCpuMs===null?null:nativeHelperElapsedMs-o.helperCpuMs,
  consoleLifetimeMs:hasConsoleExit?deltaMs(consoleNative.exitTime100ns,consoleNative.creationTime100ns):null,
  helperCreationToConsoleExitMs:hasConsoleExit&&finalNative?deltaMs(consoleNative.exitTime100ns,finalNative.creationTime100ns):null,
  consoleExitMinusHelperExitMs,postHelperConsoleQuiescenceWaitMs:consoleExitMinusHelperExitMs===null?null:Math.max(0,consoleExitMinusHelperExitMs),
  nativeTimingMeaning:'GetProcessTimes creation/exit FILETIME values of retained identified objects; polling recognition is later. Difference within native FILETIME domain only; wall-clock adjustment not independently excluded.',
  systemCpuUtilizationPercent:total>0n?Number(total-idle)/Number(total)*100:null,
  availableMemoryBytesBefore:o.contextBefore.memory.availablePhysicalBytes,availableMemoryBytesAfter:o.contextAfter.memory.availablePhysicalBytes,
  processCountBefore:o.contextBefore.processCount,processCountAfter:o.contextAfter.processCount,
  observedWorkingSetBytes:describe(helperMemory.map(m=>m.workingSetSize)),maximumReportedPeakWorkingSetBytes:helperMemory.length?Math.max(...helperMemory.map(m=>m.peakWorkingSetSize)):null,
  samplingOverheadMs:o.samplingOverheadMs,maximumSampleGapMs:o.maximumSampleGapMs,activeControlWriteMs:r.activeControlWriteMs,
  observedHelperCount:o.observedHelperCount,observedConsoleHostCount:o.observedConsoleHostCount,allObservedObjectsSignaled:o.allObservedObjectsSignaled,
  productCleanupConfirmed:r.cleanupConfirmed,requiredCleanupViolation:o.requiredCleanupViolation,completeDescendantCoverageEstablished:o.completeDescendantCoverageEstablished,
  rootIdentities,rootIdentityStatus:rootIdentities?'PRODUCTION_RESPONSE':'NO_RESPONSE_NOT_OBSERVABLE',censoredCompletion:r.result==='TIMEOUT'};
});
const byCase=plan.cases.map(c=>{const samples=rows.filter(r=>r.case===c.id),values=samples.map(r=>r.durations.launchToTransportSettlementMs),d=describe(values),margin=5000-d.max;
 return {case:c.id,operation:c.operation,fileCount:c.fileCount,aggregateBytes:c.aggregateBytes,requestFrameBytes:c.requestFrameBytes,responseFrameBytes:[...new Set(samples.filter(r=>r.result==='SUCCESS').map(r=>r.responseFrameBytes))],
  sampleIds:samples.map(r=>r.sampleId),rawWholeMs:values,minMs:d.min,maxMs:d.max,medianMs:d.median,minimumMarginMs:margin,marginClassification:marginLabel(margin),
  samplesBelow5000:values.filter(v=>v<5000).length,samplesAtOrAbove5000:values.filter(v=>v>=5000).length,timeouts:samples.filter(r=>r.result==='TIMEOUT').length,
  durationStatistics:Object.fromEntries(Object.keys(samples[0].durations).map(k=>[k,describe(samples.map(r=>r.durations[k]))])),
  helperCpuMs:describe(samples.map(r=>r.helperCpuMs)),nativeHelperElapsedMs:describe(samples.map(r=>r.nativeHelperElapsedMs)),
  elapsedMinusHelperCpuMs:describe(samples.map(r=>r.elapsedMinusHelperCpuMs)),systemCpuUtilizationPercent:describe(samples.map(r=>r.systemCpuUtilizationPercent))};});
const globalMetrics=Object.fromEntries(['nativeHelperElapsedMs','helperCpuMs','consoleCpuMs','elapsedMinusHelperCpuMs','consoleLifetimeMs','helperCreationToConsoleExitMs','consoleExitMinusHelperExitMs','postHelperConsoleQuiescenceWaitMs','systemCpuUtilizationPercent','samplingOverheadMs','maximumSampleGapMs','activeControlWriteMs','availableMemoryBytesBefore','availableMemoryBytesAfter','processCountBefore','processCountAfter','maximumReportedPeakWorkingSetBytes'].map(k=>[k,describe(rows.map(r=>r[k]))]));
const durationStatistics=Object.fromEntries(Object.keys(rows[0].durations).map(k=>[k,describe(rows.map(r=>r.durations[k]))]));
write(evidence+'/statistics.json',{kind:'MO1307HelperDeadlineStatistics',version:'1.0.0',result:'PASS',baseline,plan:record(evidence+'/sample-plan.json'),campaign:record(evidence+'/campaign.json'),sampleCount:rows.length,timeoutCount:rows.filter(r=>r.result==='TIMEOUT').length,samplesBelow5000:rows.filter(r=>r.durations.launchToTransportSettlementMs<5000).length,samplesAtOrAbove5000:rows.filter(r=>r.durations.launchToTransportSettlementMs>=5000).length,byCase,rows,globalMetrics,durationStatistics,
 metric:'Whole supervisor T0 to observed transport settlement, including post-terminal cleanup when timeout. A killed sample is right-censored for successful completion; its settlement is not a successful latency.',
 quantiles:'p90 omitted: n=5 per case cannot meaningfully characterize tails.',bootstrap:'NOT_OBSERVABLE',cpuCaveat:'Process CPU sums all threads and can exceed elapsed time. No subtraction estimates scheduler delay; no observer-overhead subtraction is applied.',certification:false});
write(evidence+'/margin-analysis.json',{kind:'MO1307HelperDeadlineMarginAnalysis',version:'1.0.0',result:'PASS',baseline,statistics:record(evidence+'/statistics.json'),predeclaredThresholds:plan.marginLabels,byCase:byCase.map(({case:id,minimumMarginMs,marginClassification,timeouts})=>({case:id,minimumMarginMs,marginClassification,timeouts})),minimumObservedMarginMs:Math.min(...rows.map(r=>r.durations.deadlineMarginMs)),minimumSuccessfulMarginMs:Math.min(...rows.filter(r=>r.result==='SUCCESS').map(r=>r.durations.deadlineMarginMs)),noOutliersDiscarded:true,noRetries:true,limitsChanged:false,certification:false});
console.log(JSON.stringify({result:'PASS',sampleCount:rows.length,byCase:byCase.map(({durationStatistics,helperCpuMs,nativeHelperElapsedMs,elapsedMinusHelperCpuMs,systemCpuUtilizationPercent,...r})=>r),globalMetrics:Object.fromEntries(Object.entries(globalMetrics).map(([k,{raw,...v}])=>[k,v])),durationStatistics:Object.fromEntries(Object.entries(durationStatistics).map(([k,{raw,...v}])=>[k,v]))}));
