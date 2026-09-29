// Ten fixed offline calibrations of actual sequence methods. No helper launch.
import fs from 'node:fs';
import path from 'node:path';
import assert from 'node:assert/strict';
import {createHash} from 'node:crypto';
import {performance} from 'node:perf_hooks';
import {fileURLToPath} from 'node:url';
import {createHelperSequence,decodeHelperRequest,decodeHelperResponse,encodeHelperRequest,encodeHelperResponse} from '../../../memoryos-readiness/src/helper-protocol.mjs';

const root=fileURLToPath(new URL('../../../../',import.meta.url));
const evidence='repositories/cca-conformance/evidence/mo1307/helper-deadline-uncensored';
const target=path.resolve(root,evidence,'private-sequence-transfer.json');
assert.equal(fs.existsSync(target),false);
assert.equal(process.version,'v24.21.0');assert.equal(process.platform,'win32');assert.equal(process.arch,'x64');
const hash=b=>'sha256:'+createHash('sha256').update(b).digest('hex');
assert.equal(hash(fs.readFileSync(process.execPath)),'sha256:ba4e6d110e8c1592a1ecd390f6b05f3da124b13871a5be62b341a07a853c6c32');
const source=p=>{const bytes=fs.readFileSync(path.resolve(root,p));return {path:p,byteLength:bytes.length,sha256:hash(bytes)};};
const read=p=>fs.readFileSync(path.resolve(root,p));
const oldRoot='C:/Users/melsa/Documents/Codex/cca-mo1307-3a/repositories/cca-conformance/evidence/mo1307/phase3a/diagnostic/attempt1';
const primaryRequest='repositories/cca-conformance/evidence/mo1307/helper-deadline-characterization/requests/C.request.bin';
const primaryResponse='repositories/cca-conformance/evidence/mo1307/helper-deadline-design/samples/02-C/response.bin';
const exactFrame=read(primaryRequest),responseFrame=read(primaryResponse),request=decodeHelperRequest(exactFrame);
const response=decodeHelperResponse(responseFrame,request);
assert.equal(exactFrame.length,7570);assert.equal(hash(exactFrame),'sha256:9894070ce2c90b6a52682f12cfa9eabec0cce4f87cdb734f664c86fe690b80d5');
assert.equal(request.sequence,3);assert.equal(request.operation,'READ_SET');assert.equal(request.files.length,65);assert.equal(response.status,'OK');
assert.equal(response.files.reduce((n,f)=>n+Buffer.from(f.bytes.join(''),'base64').length,0),2004208);
const bootstraps=[1,2].map(sequence=>{
 const prefix=String(sequence).padStart(2,'0'),requestPath=oldRoot+'/'+prefix+'.request.bin',responsePath=oldRoot+'/'+prefix+'.response.bin';
 const originalRequest=decodeHelperRequest(read(requestPath)),originalResponse=decodeHelperResponse(read(responsePath),originalRequest);
 assert.equal(originalRequest.sequence,sequence);assert.equal(originalResponse.status,'OK');
 const derivativeRequest={...originalRequest,session:request.session};
 const derivativeResponse={...originalResponse,session:request.session};
 return {request:derivativeRequest,requestFrame:encodeHelperRequest(derivativeRequest),responseFrame:encodeHelperResponse(derivativeResponse,derivativeRequest),
         sources:[source(requestPath),source(responsePath)],originalSession:originalRequest.session};
});
const startedAtUtc=new Date().toISOString(),rows=[];
for(let ordinal=1;ordinal<=10;ordinal++){
 const sequence=createHelperSequence('evaluate',{session:request.session});
 for(const bootstrap of bootstraps){assert.deepEqual(sequence.begin(bootstrap.request),bootstrap.requestFrame);sequence.complete(bootstrap.responseFrame);sequence.helperExited();}
 const t0=performance.now();
 const frame=sequence.begin(request);
 const t1=performance.now();
 const transportRequest=decodeHelperRequest(frame);const detached=Buffer.from(frame);
 const t2=performance.now();
 const completed=sequence.complete(responseFrame);
 const t3=performance.now();
 sequence.helperExited();
 const t4=performance.now();
 assert.deepEqual(frame,exactFrame);assert.deepEqual(detached,exactFrame);assert.equal(transportRequest.session,request.session);assert.equal(completed.files.length,65);
 rows.push({ordinal,timestamps:{beforeBegin:t0,afterBegin:t1,afterTransportDecodeClone:t2,afterComplete:t3,afterHelperExited:t4},
            beginMs:t1-t0,transportDecodeCloneMs:t2-t1,completeMs:t3-t2,helperExitedMs:t4-t3,totalMeasuredTransferMs:t4-t0,
            exactPrimaryFrame:true,actualSequenceMethods:true,defaultMonotonicClock:true,nativeLaunches:0});
 sequence.abort();
}
const summarize=values=>{const sorted=[...values].sort((a,b)=>a-b);return {count:values.length,raw:values,min:sorted[0],max:sorted.at(-1),median:(sorted[4]+sorted[5])/2};};
const summary=Object.fromEntries(['beginMs','transportDecodeCloneMs','completeMs','helperExitedMs','totalMeasuredTransferMs'].map(key=>[key,summarize(rows.map(r=>r[key]))]));
const sources=[source(primaryRequest),source(primaryResponse),...bootstraps.flatMap(b=>b.sources),
 ...['helper-protocol.mjs','helper-transport.mjs','acquisition.mjs','runtime.mjs','canonical.mjs','windows-paths.mjs','errors.mjs','constants.mjs'].map(p=>source('repositories/memoryos-readiness/src/'+p)),
 source('repositories/memoryos-readiness/contracts/definitions.json'),source(process.execPath),source('repositories/cca-conformance/tools/mo1307-helper-deadline-uncensored/transfer-calibration.mjs')];
const value={kind:'MO1307UncensoredPrivateSequenceTransfer',version:'1.0.0',result:'OFFLINE_CALIBRATION_COMPLETE_NOT_A_Q_BOUND',startedAtUtc,endedAtUtc:new Date().toISOString(),
 baseline:'1e78a9a963ea945847a9192f8ec3a9ce2b4e7cc5',claim:'Ten fixed observations of the actual production sequence functions, default real monotonic clock, no native helpers and no simulated native execution time. Describes this offline window only.',
 sourceBindings:sources,iterations:10,rows,summary,
 bootstrap:{derivative:true,scope:'In-memory session-only rebinding of the two retained older successful request/response pairs to advance the actual sequence to slot3. Original native identity/path/file bytes remain unchanged. This is a pure calibration bootstrap, not a replay or new inspection of those original native calls.',originalSessions:bootstraps.map(b=>b.originalSession),calibrationSession:request.session,serializedFrames:false},
 measured:{begin:'Actual begin checkpoint, request validation, canonical framing and its decode/copy/bookkeeping; the internal sequence launch origin is captured before this work.',transportPrelude:'Actual exported decodeHelperRequest and Buffer.from performed by the transport before supervisor.runOwned. Does not include the supervisor admission/checkpoint function itself.',complete:'Actual sequence.complete checkpoint and second full response parse/validation plus state transition and final checkpoint.',helperExited:'Actual checkpoint and aggregate/state bookkeeping.',total:'Contiguous outer monotonic bracket around these four offline components, including its local timestamp calls. No successful native duration is included.'},
 doubleCounting:{nativeStartupAndRequest:'Already in standalone whole-helper lifecycle; do not add again.',transportResponseDecode:'First full decode/validation in helper-transport.finish is already inside standalone completion; excluded from this transfer sum.',secondResponseDecode:'Sequence.complete repeats full response decode after transport returns; measured here because standalone supervisor helperUsedMs excludes it.',postSequenceAcquisition:'Root stability, snapshots, content/config validation after helperExited are CLI work outside this per-helper sequence interval, so excluded from this transfer sum.'},
 retainedEvidence:{priorDesign:'repositories/cca-conformance/evidence/mo1307/helper-deadline-design/aggregate-analysis.json',limitation:'Retained full CLI transport observers start after sequence.begin and stop before sequence.complete/helperExited. Their timestamps cannot reconstruct a precise full sequence-origin or exit-checkpoint interval.'},
 unmeasured:['Actual asynchronous continuation scheduling between transport settlement and sequence.complete in a live CLI.', 'Supervisor pre-run admission/checkpoint overhead and observer/harness ordering differences not represented by the measured transport decode/clone.', 'Unobserved host scheduling/GC/load variation outside this ten-iteration offline window.', 'A mathematical bound on timer resolution, event ordering or attributable-console observation uncertainty.'],
 Q:{status:'NOT_ESTABLISHED_BY_CALIBRATION',numericBoundMs:null,empiricalTransferMaximumMs:summary.totalMeasuredTransferMs.max,roundingAbsorption:'No deterministic rounding interval is proved to dominate unbounded/unquantified residual uncertainty; observed maximum alone is not a global upper bound.'},
 nativeLaunches:0,productionChanges:false,clockOverride:false,certification:false};
fs.mkdirSync(path.dirname(target),{recursive:true});fs.writeFileSync(target,JSON.stringify(value,null,2)+'\n',{flag:'wx'});
console.log(JSON.stringify({result:value.result,iterations:10,summary,nativeLaunches:0,evidence:source(evidence+'/private-sequence-transfer.json')}));
