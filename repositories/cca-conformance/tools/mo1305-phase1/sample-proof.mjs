/** Protocol 2 proves causality without comparing independent clock epochs. */
import assert from 'node:assert/strict';
import {osSummary} from './monitor.mjs';
import {relation,ordered,elapsedNs,elapsedUs,wallObservation,protocolVersion} from './clock.mjs';
const eq=(code,a,x,b,y,domain='PROTOCOL_STATE',units='count')=>relation(code,'==',a,x,b,y,{domain,units});
export function stamp(value){assert.deepEqual(Object.keys(value).sort(),['domain','ns','utcMs']);assert.match(value.domain,/^MONOTONIC_(ORCHESTRATOR|PROCESS|COLLECTOR):/u);assert.match(value.ns,/^(0|[1-9][0-9]*)$/u);assert.ok(Number.isSafeInteger(value.utcMs));}
export function barrierProof(proof){
 assert.deepEqual(Object.keys(proof).sort(),['afterSequence','capture','completed','cutoff','persistedSequence','received','requestedTicket','sampleTicket','sequence'].sort());
 for(const k of ['afterSequence','persistedSequence','requestedTicket','sampleTicket','sequence'])assert.ok(Number.isSafeInteger(proof[k])&&proof[k]>=0);
 for(const k of ['capture','completed','cutoff','received'])stamp(proof[k]);
 ordered('CAPTURE_ORDER','capture',proof.capture,'completed',proof.completed);ordered('CAPTURE_DELIVERY_ORDER','cutoff',proof.cutoff,'received',proof.received);
 eq('CAPTURE_TICKET_ACK','sampleTicket',proof.sampleTicket,'requestedTicket',proof.requestedTicket,'CAPTURE_TICKET');
 relation('FRESH_CAPTURE_SEQUENCE','<','afterSequence',proof.afterSequence,'sequence',proof.sequence,{domain:'COLLECTOR_SEQUENCE'});
 eq('CAPTURE_PERSISTED','persistedSequence',proof.persistedSequence,'sequence',proof.sequence,'COLLECTOR_SEQUENCE');
 relation('CAPTURE_FRESHNESS_TIMEOUT','<=','elapsedNs',elapsedNs(proof.cutoff,proof.received),'maximumNs',10000000000n,{units:'ns',domain:proof.cutoff.domain});
}
export function projectBarrier(proof){const r=proof.row;return {requestedTicket:proof.requestedTicket,sampleTicket:r.ticket,afterSequence:proof.afterSequence,sequence:r.sequence,persistedSequence:r.persistedSequence,cutoff:proof.cutoff,received:proof.received,capture:{domain:r.monoDomain,ns:r.captureNs,utcMs:r.captureUtcMs},completed:{domain:r.monoDomain,ns:r.completedNs,utcMs:r.utcMs}};}
export function makeWindow(pre,start,end,post){return {protocolVersion,baseline:projectBarrier(pre),requestStart:start,responseEnd:end,cleanup:projectBarrier(post),wallObservations:[wallObservation(pre.cutoff,pre.received),wallObservation(start,end),wallObservation(post.cutoff,post.received)]};}
export function validateTiming(timing,metrics){
 if(!timing){assert.ok(!metrics.workerCreated);return;}
 assert.match(timing.clockDomain,/^MONOTONIC_PROCESS:/u);assert.match(timing.startNs,/^[0-9]+$/u);assert.match(timing.endNs,/^[0-9]+$/u);
 relation('SEMANTIC_MONOTONIC_ORDER','<=','startNs',BigInt(timing.startNs),'endNs',BigInt(timing.endNs),{units:'ns',domain:timing.clockDomain});
 eq('SEMANTIC_DURATION_DERIVATION','durationUs',timing.durationUs,'derivedUs',Number((BigInt(timing.endNs)-BigInt(timing.startNs)+999n)/1000n),timing.clockDomain,'us');
 if(timing.boundary==='published')eq('SEMANTIC_REPORTED_DURATION','durationUs',timing.durationUs,'operationUs',metrics.operationUs,timing.clockDomain,'us');
 else relation('SEMANTIC_REPORTED_BOUND','<=','operationUs',metrics.operationUs??0,'observedDurationUs',timing.durationUs,{units:'us',domain:timing.clockDomain});
}
export function validateWindow(row){
 const p=row.provenance,w=row.nativeWindow;assert.ok(p&&w,'MISSING_NATIVE_PROVENANCE');
 assert.deepEqual(Object.keys(p).sort(),['archiveSha256','campaignId','pid','processStartedUtcMs','sessionId','sourceTreeSha256'].sort());
 for(const k of ['archiveSha256','sourceTreeSha256'])assert.match(p[k],/^[0-9a-f]{64}$/u);
 for(const k of ['campaignId','sessionId'])assert.match(p[k],/^[0-9a-f-]{36}$/u);for(const k of ['pid','processStartedUtcMs'])assert.ok(Number.isSafeInteger(p[k])&&p[k]>0);
 assert.deepEqual(Object.keys(w).sort(),['protocolVersion','baseline','requestStart','responseEnd','cleanup','wallObservations'].sort());eq('WINDOW_PROTOCOL','protocolVersion',w.protocolVersion,'requiredVersion',protocolVersion);
 barrierProof(w.baseline);barrierProof(w.cleanup);stamp(w.requestStart);stamp(w.responseEnd);
 const sequence=[['baseline.cutoff',w.baseline.cutoff],['baseline.received',w.baseline.received],['requestStart',w.requestStart],['responseEnd',w.responseEnd],['cleanup.cutoff',w.cleanup.cutoff],['cleanup.received',w.cleanup.received]];
 for(let i=1;i<sequence.length;i++)ordered('REQUEST_CAPTURE_ORDER',...sequence[i-1],...sequence[i]);
 relation('BASELINE_FRESHNESS','<=','elapsedNs',elapsedNs(w.baseline.cutoff,w.requestStart),'maximumNs',10000000000n,{units:'ns',domain:w.requestStart.domain});
 relation('POST_TICKET_NEW','<','preTicket',w.baseline.requestedTicket,'postTicket',w.cleanup.requestedTicket,{domain:'CAPTURE_TICKET'});
 relation('POST_SEQUENCE_NEW','<=','preSequence',w.baseline.sequence,'postAfterSequence',w.cleanup.afterSequence,{domain:'COLLECTOR_SEQUENCE'});
 eq('WINDOW_NATIVE_COUNT','native.count',row.native.count,'sequenceCount',w.cleanup.sequence-w.baseline.sequence+1,'COLLECTOR_SEQUENCE');assert.ok(row.native.count>=2);
 eq('ROUND_TRIP_DURATION','roundTripUs',row.roundTripUs,'derivedUs',elapsedUs(w.requestStart,w.responseEnd),w.requestStart.domain,'us');
 assert.deepEqual(w.wallObservations,[wallObservation(w.baseline.cutoff,w.baseline.received),wallObservation(w.requestStart,w.responseEnd),wallObservation(w.cleanup.cutoff,w.cleanup.received)]);validateTiming(row.operationTiming,row.metrics);
}
export function validateProcess(run,raw){
 eq('MEASURED_PROCESS_EXIT','exitCode',run.exitCode,'expectedExit',0);assert.ok(Number.isSafeInteger(run.collectorPid)&&run.collectorPid>0);eq('COLLECTOR_EXIT','collectorExitCode',run.collectorExitCode,'expectedExit',0);
 for(const k of ['sessionId','pid','processStartedUtcMs','candidateId','archiveSha256','campaignId'])eq('NATIVE_PROCESS_BINDING_'+k,k,raw[k],'run.'+k,run[k],'PROCESS_CANDIDATE_RUN_IDENTITY','identity');
 eq('COLLECTOR_PROTOCOL','protocolVersion',raw.protocolVersion,'requiredVersion',protocolVersion);assert.equal(raw.intervalMs,20);assert.ok(raw.records.length>=2);
 for(let i=0;i<raw.records.length;i++){const r=raw.records[i];for(const k of ['sessionId','pid','processStartedUtcMs','candidateId','archiveSha256','campaignId','monoDomain','protocolVersion'])eq('NATIVE_ROW_BINDING_'+k,k,r[k],'metadata.'+k,raw[k],'PROCESS_CANDIDATE_RUN_IDENTITY','identity');eq('NATIVE_SEQUENCE','sequence',r.sequence,'expectedSequence',i+1,'COLLECTOR_SEQUENCE');eq('NATIVE_PERSISTENCE','persistedSequence',r.persistedSequence,'sequence',r.sequence,'COLLECTOR_SEQUENCE');relation('NATIVE_CAPTURE_ORDER','<=','captureNs',BigInt(r.captureNs),'completedNs',BigInt(r.completedNs),{units:'ns',domain:raw.monoDomain});if(i){relation('NATIVE_MONOTONIC_REVERSED','<=','previousCompletedNs',BigInt(raw.records[i-1].completedNs),'captureNs',BigInt(r.captureNs),{units:'ns',domain:raw.monoDomain});relation('NATIVE_TICKET_REVERSED','<=','previousTicket',raw.records[i-1].ticket,'ticket',r.ticket,{domain:'CAPTURE_TICKET'});}}
 return raw.records;
}
export function validateChunk(chunk,campaign,readRaw){
 assert.ok(chunk.complete);assert.equal(chunk.campaignId,campaign.campaignId);assert.equal(chunk.runs.length,campaign.coldRequired+(campaign.warmRequired?1:0));assert.equal(new Set(chunk.runs.map(r=>r.sessionId)).size,chunk.runs.length);
 const runs=new Map(chunk.runs.map(run=>[run.sessionId,{run,rows:validateProcess(run,readRaw(run.raw))}]));
 for(const s of chunk.records){validateWindow(s);const p=s.provenance,w=s.nativeWindow;
 for(const [key,expected] of [['campaignId',campaign.campaignId],['sourceTreeSha256',campaign.binding.sourceTreeSha256],['archiveSha256',campaign.binding.archive.sha256]])eq('SAMPLE_IDENTITY_'+key,key,p[key],'campaign.'+key,expected,'PROCESS_CANDIDATE_RUN_IDENTITY','identity');
 const e=runs.get(p.sessionId);assert.ok(e,'UNRELATED_NATIVE_SESSION');for(const k of ['pid','processStartedUtcMs'])eq('SAMPLE_PROCESS_'+k,k,p[k],'run.'+k,e.run[k],'PROCESS_IDENTITY','identity');eq('COLLECTOR_CANDIDATE','candidateId',e.run.candidateId,'sourceTreeSha256',p.sourceTreeSha256,'PROCESS_CANDIDATE_RUN_IDENTITY','identity');eq('COLLECTOR_CAMPAIGN','campaignId',e.run.campaignId,'sampleCampaign',p.campaignId,'PROCESS_CANDIDATE_RUN_IDENTITY','identity');assert.equal(e.run.phase,s.phase);if(s.phase==='cold')assert.equal(e.run.index,s.index);
 const selected=e.rows.slice(w.baseline.sequence-1,w.cleanup.sequence);for(const [proof,r] of [[w.baseline,selected[0]],[w.cleanup,selected.at(-1)]]){assert.equal(r.ticket,proof.sampleTicket);assert.deepEqual(proof.capture,{domain:r.monoDomain,ns:r.captureNs,utcMs:r.captureUtcMs});assert.deepEqual(proof.completed,{domain:r.monoDomain,ns:r.completedNs,utcMs:r.utcMs});}assert.deepEqual(osSummary(selected),s.native,'NATIVE_SUMMARY_DRIFT');
 }
 for(const {run} of runs.values()){const rows=chunk.records.filter(s=>s.provenance.sessionId===run.sessionId);assert.equal(rows.length,run.phase==='cold'?1:campaign.warmRequired);}
}
export function validateAdverse(record,campaign,readRaw){
 assert.equal(record.campaignId,campaign.campaignId);assert.deepEqual(record.binding,campaign.binding);assert.ok(record.runs.length>0);assert.equal(new Set(record.runs.map(r=>r.sessionId)).size,record.runs.length);
 stamp(record.timing.start);stamp(record.timing.end);eq('ADVERSE_DURATION','elapsedMs',record.adverseElapsedMs,'derivedMs',Number((elapsedNs(record.timing.start,record.timing.end)+999999n)/1000000n),record.timing.start.domain,'ms');assert.deepEqual(record.timing.wall,wallObservation(record.timing.start,record.timing.end));
 const processes=new Map(),all=[];for(const run of record.runs){const rows=validateProcess(run,readRaw(run.raw));assert.equal(run.candidateId,campaign.binding.sourceTreeSha256);assert.equal(run.campaignId,campaign.campaignId);barrierProof(run.pre);barrierProof(run.post);relation('ADVERSE_POST_TICKET','<','preTicket',run.pre.requestedTicket,'postTicket',run.post.requestedTicket,{domain:'CAPTURE_TICKET'});processes.set(run.sessionId,run);all.push(...rows);}
 assert.deepEqual(osSummary(all),record.native,'ADVERSE_NATIVE_SUMMARY_DRIFT');for(const s of record.operationSamples){const p=s.provenance;assert.ok(p);assert.equal(p.campaignId,campaign.campaignId);const run=processes.get(p.sessionId);assert.ok(run);assert.equal(p.pid,run.pid);stamp(p.observed);ordered('ADVERSE_SAMPLE_OWNERSHIP','pre.received',run.pre.received,'observed',p.observed);validateTiming(s.operationTiming,s);}
}
