/** Original installed bytes, independent client oracle and external OS accounting. */
import {launch,request,wire,response,vectors,delay,root,stage} from './installed.mjs';
import {spawn} from 'node:child_process';
import {readFileSync,writeFileSync} from 'node:fs';
import {resolve} from 'node:path';
import {createHash} from 'node:crypto';
import assert from 'node:assert/strict';
const output=process.argv[2]??'original-reproduction';
const state=await launch({measurement:true,auditYoung:process.argv[3]===undefined?null:Number(process.argv[3])}),records=[];
const monitor=spawn('C:/Users/melsa/.cache/codex-runtimes/codex-primary-runtime/dependencies/python/python.exe',['-B',resolve(import.meta.dirname,'os_monitor.py'),String(state.child.pid),resolve(root,'.cache/mo1305-resource-review/'+output+'-os.json')],{windowsHide:true,stdio:['ignore','pipe','pipe']});
let monitorError='';monitor.stderr.on('data',x=>monitorError+=x);const monitorExit=new Promise(r=>monitor.once('exit',r));
const fixtures=vectors();
try{
 await delay(200);
 const ids=process.argv[4]==='all'?Array.from({length:3},()=>fixtures.map(v=>v.id)).flat():['identities','max-mip-policy','max-mip-policySet','max-verify-outcome','max-mip-policy'];
 for(const id of ids){
  const vector=fixtures.find(v=>v.id===id);assert.ok(vector,id);const started=process.hrtime.bigint(),utcStartMs=Date.now();
  assert.deepEqual(response(await wire(request(vector.operation,vector.input))).body,vector.expected);
  for(let i=0;i<100&&!state.observations.length;i++)await delay(10);
  assert.equal(state.observations.length,1);
  const record={id,utcStartMs,utcEndMs:Date.now(),roundTripUs:Number((process.hrtime.bigint()-started)/1000n),observation:state.observations.shift().record};
  records.push(record);console.log(JSON.stringify({id,youngBytes:record.observation.youngBytes,requiredYoungMiB:Math.ceil(1.5*record.observation.youngBytes/1048576),operationUs:record.observation.operationUs}));
  await delay(200);
 }
}finally{await state.stop();}
assert.equal(await monitorExit,0,monitorError);
const bytes=readFileSync(resolve(stage,'package/distribution-manifest.json'));
writeFileSync(resolve(root,'.cache/mo1305-resource-review/'+output+'.json'),JSON.stringify({kind:'MemoryOSRESTResourceReviewReproduction',version:'1.0.0',fullCampaign:false,stage,distributionSha256:createHash('sha256').update(bytes).digest('hex'),records,audit:state.audit,auditYoung:process.argv[3]??null,exitCode:state.child.exitCode}));
