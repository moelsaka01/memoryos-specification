import {spawn} from 'node:child_process';
import {resolve} from 'node:path';
import {createInterface} from 'node:readline';
import assert from 'node:assert/strict';
import {randomUUID} from 'node:crypto';
import {clock,relation,armDeadline,bounded,protocolVersion} from './clock.mjs';
const python='C:/Users/melsa/.cache/codex-runtimes/codex-primary-runtime/dependencies/python/python.exe';
/** A capture is acknowledged only after the collector flushes its journal row. */
export function collectorSession(collector,{timeoutMs=10000,source=clock,pid,identity,schedule,cancel}={}){
 const rows=[],waiters=new Set();let protocolReady=false,received=0,ticket=0,closed=false,fatal=null;
 const domain='MONOTONIC_COLLECTOR:'+identity.sessionId;
 const compare=(code,a,x,b,y,units='count',clockDomain='COLLECTOR_SEQUENCE')=>relation(code,'==',a,x,b,y,{units,domain:clockDomain});
 function settle(){for(const waiter of waiters){const row=rows.at(-1);if(protocolReady&&row&&received>waiter.after&&row.ticket===waiter.ticket){waiter.timer.cancel();waiters.delete(waiter);waiter.resolve({row,cutoff:waiter.cutoff,afterSequence:waiter.after,requestedTicket:waiter.ticket,received:source.stamp()});}}}
 function fail(error){error.capture??={requestedTicket:ticket,lastSequence:received,lastTicket:rows.at(-1)?.ticket??null};fatal??=error;for(const waiter of waiters){waiter.timer.cancel();waiter.reject(fatal);}waiters.clear();}
 const exited=new Promise(resolveExit=>{collector.once('error',fail);collector.once('close',code=>{closed=true;if(waiters.size){try{compare('COLLECTOR_EXIT_BEFORE_REQUIRED_SAMPLE','collectorClosed',true,'requiredOpen',false,'boolean','PROTOCOL_STATE');}catch(error){fail(error);}}resolveExit(code);});});
 createInterface({input:collector.stdout}).on('line',line=>{
  try{
   if(line==='READY'){protocolReady=true;settle();return;}
   const row=JSON.parse(line);
   for(const key of ['captureUtcMs','utcMs','pid','processStartedUtcMs','sequence','ticket','persistedSequence','WorkingSetSize','PeakWorkingSetSize','PrivateUsage','PagefileUsage','PeakPagefileUsage','handles','threads'])compare('INVALID_OS_FIELD_'+key,key,Number.isSafeInteger(row[key]),'safeInteger',true,'boolean','PROTOCOL_STATE');
   compare('OS_PROTOCOL_MISMATCH','protocolVersion',row.protocolVersion,'expectedProtocolVersion',protocolVersion,'version','PROTOCOL_STATE');
   compare('OS_PROCESS_MISMATCH','pid',row.pid,'expectedPid',pid,'pid','PROCESS_IDENTITY');
   for(const key of ['sessionId','candidateId','archiveSha256','campaignId'])compare('OS_IDENTITY_MISMATCH_'+key,key,row[key],'expected.'+key,identity[key],'identity','PROCESS_CANDIDATE_RUN_IDENTITY');
   compare('OS_SEQUENCE_MISMATCH','sequence',row.sequence,'expectedSequence',received+1);
   compare('OS_PERSISTENCE_MISMATCH','persistedSequence',row.persistedSequence,'sequence',row.sequence);
   compare('OS_MONOTONIC_DOMAIN','monoDomain',row.monoDomain,'expectedDomain',domain,'domain','CLOCK_DOMAIN_IDENTITY');
   for(const key of ['captureNs','completedNs'])compare('INVALID_OS_MONOTONIC_'+key,key,typeof row[key]==='string'&&/^(0|[1-9][0-9]*)$/u.test(row[key]),'unsignedDecimal',true,'boolean',domain);
   relation('OS_CAPTURE_ORDER','<=','captureNs',BigInt(row.captureNs),'completedNs',BigInt(row.completedNs),{units:'ns',domain});
   relation('OS_TICKET_MISMATCH','<=','sampleTicket',row.ticket,'issuedTicket',ticket,{domain:'CAPTURE_TICKET'});
   relation('OS_TICKET_NEGATIVE','>=','sampleTicket',row.ticket,'zero',0,{domain:'CAPTURE_TICKET'});
   if(rows.length){compare('OS_PROCESS_REUSED','processStartedUtcMs',row.processStartedUtcMs,'initialProcessCreationIdentity',rows[0].processStartedUtcMs,'identity','PROCESS_IDENTITY');relation('OS_CAPTURE_REVERSED','<=','previousCompletedNs',BigInt(rows.at(-1).completedNs),'captureNs',BigInt(row.captureNs),{units:'ns',domain});relation('OS_TICKET_REVERSED','<=','previousTicket',rows.at(-1).ticket,'ticket',row.ticket,{domain:'CAPTURE_TICKET'});}
   rows.push(row);received++;settle();
  }catch(error){fail(error);collector.kill();}
 });
 function next(requestedTicket){const cutoff=source.stamp(),after=received;return new Promise((resolveRow,reject)=>{
  if(closed||fatal){reject(fatal??Error('COLLECTOR_CLOSED'));return;}
  const deadline=BigInt(cutoff.ns)+BigInt(timeoutMs)*1000000n;
  const waiter={after,cutoff,ticket:requestedTicket,resolve:resolveRow,reject,timer:null};
  waiter.timer=armDeadline(deadline,()=>{waiters.delete(waiter);try{relation(requestedTicket?'COLLECTOR_SAMPLE_TIMEOUT':'COLLECTOR_READINESS_TIMEOUT','<','observedNs',source.mono(),'deadlineNs',deadline,{units:'ns',domain:source.domain});}catch(error){error.capture={requestedTicket,afterSequence:after,lastSequence:received,lastTicket:rows.at(-1)?.ticket??null};reject(error);}},{source,schedule,cancel});
  waiters.add(waiter);if(requestedTicket)collector.stdin.write('CAPTURE '+requestedTicket+'\n');settle();
 });}
 const ready=next(0).then(proof=>proof.row);
 return {rows,ready,exited,barrier(){return next(++ticket);},checkpoint(){return next(++ticket).then(proof=>proof.row);},async stop(){const code=await bounded(exited,5000,'COLLECTOR_SHUTDOWN_TIMEOUT',{source,onTimeout:()=>collector.kill(),schedule,cancel});if(fatal)throw fatal;compare('COLLECTOR_EXIT','exitCode',code,'expectedExit',0,'exit-code','PROTOCOL_STATE');return rows;}};
}
export async function monitor(child,path,{candidateId='diagnostic',archiveSha256='diagnostic',campaignId='diagnostic'}={}){
 const sessionId=randomUUID(),identity={sessionId,candidateId,archiveSha256,campaignId};
 const collector=spawn(python,['-B',resolve(import.meta.dirname,'os_monitor.py'),String(child.pid),path,'--stream','--session',sessionId,'--identity',JSON.stringify(identity)],{windowsHide:true,stdio:['pipe','pipe','pipe']});
 const session=collectorSession(collector,{pid:child.pid,identity});session.identity={...identity,pid:child.pid,collectorPid:collector.pid,rawPath:path};
 try{await session.ready;return session;}catch(error){error.identity=session.identity;collector.kill();await session.exited;throw error;}
}
export function osSummary(rows){assert.ok(rows.length>0,'MISSING_OS_SAMPLES');const names=['WorkingSetSize','PeakWorkingSetSize','PrivateUsage','PagefileUsage','PeakPagefileUsage','handles','threads'];return {count:rows.length,baseline:Object.fromEntries(names.map(k=>[k,rows[0][k]])),peak:Object.fromEntries(names.map(k=>[k,Math.max(...rows.map(r=>r[k]))])),cleanup:Object.fromEntries(names.map(k=>[k,rows.at(-1)[k]]))};}
export function stateSummary(rows){assert.ok(rows.length>0,'MISSING_PARENT_SAMPLES');const memoryNames=['rss','heapTotal','heapUsed','external','arrayBuffers'];const names=['connections','requestSlots','writeSlots','workers','semanticOwners','bodyBuffers','bodyBufferBytes','published'];return {count:rows.length,baseline:Object.fromEntries(memoryNames.map(k=>[k,rows[0].memory[k]])),peak:Object.fromEntries([...memoryNames.map(k=>[k,Math.max(...rows.map(r=>r.memory[k]))]),...names.map(k=>[k,Math.max(...rows.map(r=>r[k]??0))])]),cleanup:Object.fromEntries([...memoryNames.map(k=>[k,rows.at(-1).memory[k]]),...names.map(k=>[k,rows.at(-1)[k]??0])])};}
