import {readFileSync} from 'node:fs';
import {execFile} from 'node:child_process';
import {promisify} from 'node:util';
import {createHash} from 'node:crypto';
export const policy=JSON.parse(readFileSync(new URL('./mo1305-host-guard-policy.json',import.meta.url)));
export const policySha256=createHash('sha256').update(readFileSync(new URL('./mo1305-host-guard-policy.json',import.meta.url))).digest('hex');
const exec=promisify(execFile),provider=policy.provider;
function wellFormed(xml){
 const stack=[];let offset=0,roots=0;
 for(const token of xml.matchAll(/<[^>]*>/gu)){const text=xml.slice(offset,token.index);if(text.includes('<')||text.includes('>'))throw Error('MALFORMED_XML');const tag=token[0];const close=/^<\/([A-Za-z][\w:-]*)>$/u.exec(tag);if(close){if(stack.pop()!==close[1])throw Error('MALFORMED_XML');}else{const open=/^<([A-Za-z][\w:-]*)(?:\s+[A-Za-z_][\w:.-]*=(?:"[^"<>]*"|'[^'<>]*'))*\s*\/?>(?:)$/u.exec(tag);if(!open)throw Error('MALFORMED_XML');if(!stack.length){roots++;if(open[1]!=='Event')throw Error('MALFORMED_XML');}if(!tag.endsWith('/>'))stack.push(open[1]);}offset=token.index+tag.length;}
 if(stack.length||roots!==1||xml.slice(offset).trim())throw Error('MALFORMED_XML');
}
function parse(row){
 const x=row.xml;if(typeof x!=='string'||x.length>32768||/<!|&(?:[^a]|a(?!mp;))/u.test(x))throw Error('MALFORMED_EVENT');
 wellFormed(x);
 const attr=(tag,name)=>new RegExp('<'+tag+'\\b[^>]*\\b'+name+'=[\"\u0027]([^\"\u0027]+)[\"\u0027]','u').exec(x)?.[1];
 const val=tag=>new RegExp('<'+tag+'>([^<]+)</'+tag+'>','u').exec(x)?.[1];
 if(attr('Provider','Name')!==provider)throw Error('WRONG_PROVIDER');
 const id=Number(val('EventID')),recordId=Number(val('EventRecordID')),utc=attr('TimeCreated','SystemTime'),ms=Date.parse(utc);
 if(id!==row.Id||recordId!==row.RecordId||!Number.isSafeInteger(recordId)||!Number.isFinite(ms)||Math.abs(Date.parse(row.utc)-ms)>1)throw Error('EVENT_IDENTITY');
 const data={};for(const m of x.matchAll(/<Data Name=["']([^"']+)["']>([^<]*)<\/Data>/gu)){if(Object.hasOwn(data,m[1]))throw Error('DUPLICATE_DATA');data[m[1]]=m[2];}
 return {id,recordId,utc,ms,data,provider};
}
export function intervals(source){
 if(source?.state!=='AVAILABLE'||!Array.isArray(source.events)||source.events.length>policy.maximumEvents)return {state:'UNKNOWN',reason:'OS_EVIDENCE_UNAVAILABLE',intervals:[]};
 try{
  const rows=source.events.map(parse).sort((a,b)=>a.recordId-b.recordId),seen=new Set(),entries=new Map(),result=[];
  for(const r of rows){if(seen.has(r.recordId))throw Error('DUPLICATE_EVENT');seen.add(r.recordId);if(![506,507].includes(r.id))continue;
   const d=r.data;if(!/^\d+$/u.test(d.BootId??'')||!/^\d+$/u.test(d.ScenarioInstanceIdV2??''))throw Error('MISSING_PAIR_ID');const key=d.BootId+':'+d.ScenarioInstanceIdV2;
   if(r.id===506){entries.set(key,r);continue;}if(d.SleepEntered==='false')continue;if(d.SleepEntered!=='true')throw Error('INVALID_SLEEP_ENTERED');
   if(!/^\d+$/u.test(d.SleepDurationInUs??'')||!/^\d+$/u.test(d.DurationInUs??''))throw Error('INVALID_SLEEP_DURATION');const sleepUs=Number(d.SleepDurationInUs),totalUs=Number(d.DurationInUs);if(!Number.isSafeInteger(sleepUs)||sleepUs<=0||!Number.isSafeInteger(totalUs)||totalUs<sleepUs)throw Error('INVALID_SLEEP_DURATION');
   const entry=entries.get(key);if(!entry)continue;if(entry.recordId>=r.recordId||Math.abs((r.ms-entry.ms)-totalUs/1000)>policy.eventPairToleranceMs)throw Error('INCONSISTENT_PAIR');
   const startMs=r.ms-sleepUs/1000;if(startMs<entry.ms-policy.eventPairToleranceMs)throw Error('INCONSISTENT_SLEEP');
   result.push({provider,eventIds:[506,507],recordIds:[entry.recordId,r.recordId],bootId:d.BootId,scenarioId:d.ScenarioInstanceIdV2,entryUtc:entry.utc,sleepStartUtc:new Date(startMs).toISOString(),sleepEndUtc:r.utc,sleepStartMs:startMs,sleepEndMs:r.ms,sleepDurationUs:sleepUs});
  }return {state:'AVAILABLE',reason:null,intervals:result};
 }catch(e){return {state:'UNKNOWN',reason:e.message,intervals:[]};}
}
export function classify({start,end,operationInterval=null,attemptId,candidateId,caseId,phase,index,sampleId},source){
 const result={kind:'MemoryOSRESTHostInterruptionObservation',policySha256,attemptId,candidateId,case:caseId,phase,index,sampleId,operationInterval,validityWindow:{start,end},utcCorrelation:{startUtcMs:start?.utcMs,endUtcMs:end?.utcMs},classification:'NORMAL',evidenceState:'UNKNOWN',reason:null,overlaps:[]};
 try{
  if(start.domain!==end.domain||!/^MONOTONIC_/u.test(start.domain)||!/^\d+$/u.test(start.ns)||!/^\d+$/u.test(end.ns)||!Number.isSafeInteger(start.utcMs)||!Number.isSafeInteger(end.utcMs))throw Error('INVALID_WINDOW');
  const elapsed=Number(BigInt(end.ns)-BigInt(start.ns))/1e6;if(elapsed<0||Math.abs(end.utcMs-start.utcMs-elapsed)>policy.utcMonotonicToleranceMs)throw Error('UTC_CORRELATION_UNRELIABLE');
  const parsed=intervals(source);result.evidenceState=parsed.state;result.reason=parsed.reason;
  if(parsed.state==='AVAILABLE')for(const interval of parsed.intervals){const overlapMs=Math.min(end.utcMs,interval.sleepEndMs)-Math.max(start.utcMs,interval.sleepStartMs);if(overlapMs>policy.overlapMarginMs)result.overlaps.push({...interval,overlapMs});}
  if(result.overlaps.length){result.classification='HOST_INTERRUPTED';result.reason='PROVEN_OS_SLEEP_OVERLAP';}
 }catch(e){result.reason=e.message;}
 return result;
}
export async function queryEvents(startUtcMs,endUtcMs=Date.now()){
 try{const {stdout}=await exec('powershell.exe',['-NoProfile','-NonInteractive','-ExecutionPolicy','Bypass','-File',new URL('./mo1305-host-events.ps1',import.meta.url).pathname.replace(/^\/([A-Za-z]:)/u,'$1'),'-StartUtc',new Date(startUtcMs-policy.queryLookbackMs).toISOString(),'-EndUtc',new Date(endUtcMs+1000).toISOString()],{timeout:15000,maxBuffer:8*1024*1024,windowsHide:true});return JSON.parse(stdout);}catch(e){return {state:'UNAVAILABLE',error:e.code??e.message,events:[]};}
}
export function replacementAllowed(slotCount,vectorCount=0){return slotCount<=policy.maximumReplacementsPerSlot&&vectorCount<=policy.maximumResourceReplacementsPerVectorPerTask;}
