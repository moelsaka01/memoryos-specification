import assert from 'node:assert/strict';
import {resolve} from 'node:path';
import {classify,queryEvents} from './mo1305-host-guard.mjs';
import {read,ref,put,base} from './mo1305-modular-resource.mjs';
import {guardedAdverse} from './mo1305-host-proof.mjs';
process.env.PATH=resolve(process.env.SystemRoot,'System32/WindowsPowerShell/v1.0')+';'+(process.env.PATH??'');
for(const layer of ['adverse-functional','stress-confirmation']){
 const folder=base+'/'+layer,p=read(folder+'/index.json');assert.equal(p.state,'PASS');const rows=p.completed.map(x=>({x,host:read(folder+'/'+x.name+'-'+x.repeat+'-host.json'),record:read(folder+'/'+x.name+'-'+x.repeat+'.json')}));
 const first=Math.min(...rows.map(r=>r.host.guard.validityWindow.start.utcMs)),last=Math.max(...rows.map(r=>r.host.guard.validityWindow.end.utcMs)),events=await queryEvents(first,last+60000);assert.equal(events.state,'AVAILABLE');const eventRef=put(folder+'/retrospective-host-events.json',events),records=[];
 for(const {x,host,record} of rows){const g=host.guard,guard=classify({start:g.validityWindow.start,end:g.validityWindow.end,operationInterval:record.timing,attemptId:p.campaignId,candidateId:p.binding.sourceTreeSha256,caseId:x.name,phase:p.mode,index:x.repeat,sampleId:host.sampleId},events);records.push({name:x.name,repeat:x.repeat,original:ref(folder+'/'+x.name+'-'+x.repeat+'-host.json'),guard});}
 const valid=records.every(x=>x.guard.evidenceState==='AVAILABLE'&&x.guard.classification==='NORMAL');put(folder+'/host-revalidation.json',{kind:'MemoryOSRESTRetrospectiveStressHostValidation',state:valid?'PASS':'HOST_INTERRUPTED',binding:p.binding,events:eventRef,reason:'The isolated final-acceptance PATH omitted Windows PowerShell. Original unavailable-query observations remain normal and subject to every assertion; this independent OS query supplies complete retrospective validity without rerunning unaffected work.',records});assert.ok(valid,'HOST_INTERRUPTED_REPETITION_REPLACEMENT_REQUIRED');const v=guardedAdverse(folder+'/index.json');put(folder+'/guarded-validation.json',v);console.log(JSON.stringify({layer,state:'PASS',repetitions:v.repetitions,originalUnavailable:rows.filter(x=>x.host.guard.evidenceState!=='AVAILABLE').length}));
}
