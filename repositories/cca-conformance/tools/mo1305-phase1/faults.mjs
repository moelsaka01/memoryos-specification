import {monoMs,clock,relation} from './clock.mjs';
import assert from 'node:assert/strict';
import {writeFileSync} from 'node:fs';
import {resolve} from 'node:path';
import {launch,stage,root,wire,response,request,delay} from './installed.mjs';
const records=[];
for(const fault of ['exit','throw','stdout','stderr','stale','duplicate','malformed','external','young','old','terminate-never','terminate-reject','metric-keys','timeout','late-publication']){
 const state=await launch({measurement:true,args:[resolve(import.meta.dirname,fault==='late-publication'?'late-publication-server.mjs':'fault-server.mjs'),stage,fault]}),start=monoMs();
 try{
  const bytes=await wire(request('getContractIdentities'),{allowClose:true,timeout:fault==='timeout'?33000:6000});
  const fatal=['external','young','old'].includes(fault)||fault.startsWith('terminate-');
  if(!fatal){const result=response(bytes);assert.equal(result.status,['timeout','late-publication'].includes(fault)?504:500,fault);assert.equal(result.body.error.code,['timeout','late-publication'].includes(fault)?'MO1305_OPERATION_TIMEOUT':'MO1305_INTERNAL_FAILURE',fault);await state.stop();}
  else{const result=await Promise.race([state.exit,delay(5000).then(()=>{throw Error('UNBOUNDED_FATAL '+fault);})]);assert.equal(result.code,1,fault);relation('FATAL_CLEANUP_BOUND','<','elapsedMs',Math.ceil(monoMs()-start),'maximumMs',5000,{units:'ms',domain:clock.domain});}
  assert.equal(state.stdout,'');records.push({id:'LIFECYCLE-'+fault,state:'PASS',elapsedMs:Math.ceil(monoMs()-start),exitCode:state.child.exitCode});console.log(JSON.stringify(records.at(-1)));
 }finally{if(state.child.exitCode===null)state.child.kill();}
}
writeFileSync(resolve(root,'.cache/mo1305-resource-review/worker-faults.json'),JSON.stringify({state:'PASS',kind:'MemoryOSRESTWorkerFaultTests',records}));
