/** Measurement protocol 2: UTC is descriptive; each monotonic epoch is private. */
import {randomUUID,createHash} from 'node:crypto';
import {readFileSync} from 'node:fs';
import {schemaValidator} from '../../../memoryos-rest/src/schema.mjs';
const validateFailure=schemaValidator(JSON.parse(readFileSync(new URL('./failure-schema-2.0.0.json',import.meta.url))));
const nativeSchedule=globalThis.setTimeout,nativeCancel=globalThis.clearTimeout;
export const protocolVersion='2.0.0';
export function createClock({mono=()=>process.hrtime.bigint(),wall=Date.now,domain='MONOTONIC_ORCHESTRATOR:'+randomUUID()}={}){
 return {domain,mono,stamp(){return {domain,ns:mono().toString(),utcMs:wall()};}};
}
export const clock=createClock();
export const monoMs=()=>Number(clock.mono()/1000n)/1000;
export function relation(code,expected,leftName,left,rightName,right,{units='count',domain='PROTOCOL_STATE'}={}){
 const ok=expected==='=='?left===right:expected==='<='?left<=right:expected==='<'?left<right:expected==='>='?left>=right:expected==='>'?left>right:false;
 if(ok)return;
 const error=new Error(code);error.code=code;error.diagnostic={assertionCode:code,expectedRelationship:expected,leftOperand:{name:leftName,value:typeof left==='bigint'?left.toString():left},rightOperand:{name:rightName,value:typeof right==='bigint'?right.toString():right},units,clockDomain:domain};throw error;
}
export function ordered(code,leftName,left,rightName,right){
 relation('CLOCK_DOMAIN_MISMATCH','==',leftName+'.domain',left.domain,rightName+'.domain',right.domain,{units:'domain',domain:'CLOCK_DOMAIN_IDENTITY'});
 relation(code,'<=',leftName,BigInt(left.ns),rightName,BigInt(right.ns),{units:'ns',domain:left.domain});
}
export function elapsedNs(start,end){ordered('MONOTONIC_TIME_REVERSED','start',start,'end',end);return BigInt(end.ns)-BigInt(start.ns);}
export const elapsedUs=(start,end)=>Number((elapsedNs(start,end)+999n)/1000n);
export function wallObservation(start,end){const ns=elapsedNs(start,end);return {clockDomain:'WALL_UTC_INFORMATIONAL',startUtcMs:start.utcMs,endUtcMs:end.utcMs,wallDeltaMs:end.utcMs-start.utcMs,monotonicElapsedNs:ns.toString(),wallMinusMonotonicNs:(BigInt(end.utcMs-start.utcMs)*1000000n-ns).toString()};}
/** Native timers only request wakeups; the monotonic deadline authorizes expiry. */
export function armDeadline(deadline,callback,{source=clock,schedule=nativeSchedule,cancel=nativeCancel}={}){
 let active=true,timer;function arm(){const left=deadline-source.mono();timer=schedule(fire,left>0n?Math.min(2147483647,Number((left+999999n)/1000000n)):0);}
 function fire(){if(!active)return;if(source.mono()<deadline){arm();return;}active=false;callback();}
 arm();return {cancel(){active=false;cancel(timer);}};
}
export const scheduleTimeout=(callback,ms)=>armDeadline(clock.mono()+BigInt(ms)*1000000n,callback);
export const cancelTimeout=timer=>timer?.cancel();
export const delay=ms=>new Promise(resolve=>scheduleTimeout(resolve,ms));
export function bounded(promise,ms,code,{source=clock,onTimeout=()=>{},schedule,cancel}={}){
 const began=source.stamp(),deadline=BigInt(began.ns)+BigInt(ms)*1000000n;
 return new Promise((resolve,reject)=>{const timer=armDeadline(deadline,()=>{const now=source.stamp();const error=new Error(code);error.code=code;error.diagnostic={assertionCode:code,expectedRelationship:'<',leftOperand:{name:'observedNs',value:now.ns},rightOperand:{name:'deadlineNs',value:deadline.toString()},units:'ns',clockDomain:source.domain};onTimeout();reject(error);},{source,schedule,cancel});Promise.resolve(promise).then(v=>{timer.cancel();resolve(v);},e=>{timer.cancel();reject(e);});});
}
function operand(value){if(value===undefined)return null;if(typeof value==='bigint')return value.toString();if(value===null||['number','boolean'].includes(typeof value))return value;const bytes=Buffer.from(JSON.stringify(value));return {type:typeof value,byteLength:bytes.length,sha256:createHash('sha256').update(bytes).digest('hex')};}
export function failureEvidence(error,context={}){
 const assertion=error.diagnostic??{assertionCode:error.code??'MEASUREMENT_ASSERTION',expectedRelationship:error.operator??'assertion',leftOperand:{name:'actual',value:operand(error.actual)},rightOperand:{name:'expected',value:operand(error.expected)},units:'assertion-specific',clockDomain:'PROTOCOL_STATE'};
 const record={protocolVersion,state:'FAIL',case:null,phase:null,index:null,pid:null,candidateId:null,campaignId:null,runId:null,captureTicket:null,sequence:null,...context,assertion};if(!validateFailure('Failure',record))throw Error('INVALID_FAILURE_EVIDENCE_SCHEMA');return record;
}
