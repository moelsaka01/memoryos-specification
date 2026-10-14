/** Early blocking probe, not a substitute for the required 30/100 full campaign. */
import {launch,request,wire,response,vectors,delay,root} from './installed.mjs';
import {readFileSync,writeFileSync} from 'node:fs';
import {resolve} from 'node:path';
import {createHash} from 'node:crypto';
import assert from 'node:assert/strict';
const state=await launch({measurement:true}),records=[];let blocked=false;
try{
 for(const id of ['identities','max-mip-policy','max-mip-policySet','max-verify-outcome']){
  const vector=vectors().find(v=>v.id===id);const started=process.hrtime.bigint();
  assert.deepEqual(response(await wire(request(vector.operation,vector.input))).body,vector.expected);
  for(let i=0;i<100&&!state.observations.length;i++)await delay(10);
  assert.equal(state.observations.length,1);
  const record={id,roundTripUs:Number((process.hrtime.bigint()-started)/1000n),observation:state.observations.shift().record};
  records.push(record);console.log(JSON.stringify(record));
  const requiredYoungMiB=Math.ceil(1.5*record.observation.youngBytes/1048576);
  if(requiredYoungMiB>128){blocked=true;console.log(JSON.stringify({state:'BLOCKED',dimension:'workerYoungMiB',observedCommittedBytes:record.observation.youngBytes,requiredMiB:requiredYoungMiB,ceilingMiB:128}));break;}
 }
}finally{await state.stop();}
const artifact=path=>{const data=readFileSync(resolve(root,path));return {path,byteLength:data.length,sha256:createHash('sha256').update(data).digest('hex')};};
const result={kind:'MemoryOSRESTEarlyMeasurementProbe',version:'1.0.0',state:blocked?'BLOCKED':'PROBE_ONLY',fullCampaignExecuted:false,coldSamples:0,warmSamples:records.length,records,
 method:'Worker new_space + new_large_object_space physical_space_size; allocated/used recorded separately. Required bound ceilMiB(1.5 * committed peak).',
 artifacts:[artifact('.cache/mo1305-resume/build/memoryos-rest-0.1.0.tgz'),artifact('.cache/mo1305-resume/build/source-tree.json'),artifact('.cache/mo1305-resume/fixtures/vectors.json'),artifact('repositories/memoryos-rest/distribution-manifest.json'),artifact('repositories/cca-conformance/tools/mo1305-phase1/measurement_probe.mjs')],
 shutdownExitCode:state.child.exitCode,phase1Complete:false,I1:null,B1:null};
writeFileSync(resolve(root,'.cache/mo1305-resume/measurement-probe.json'),JSON.stringify(result));
if(blocked)process.exitCode=2;
