/** Complete only token restart/rebind after an immutable same-product partial attempt. */
import assert from 'node:assert/strict';
import {readFileSync,writeFileSync} from 'node:fs';
import {resolve} from 'node:path';
import {createHash,randomBytes} from 'node:crypto';
import {networkInterfaces} from 'node:os';
import {setup,launch,request,wire,response,writeConfig,cache,root,bounded} from './harness.mjs';

const started=process.hrtime.bigint(),priorPath='.cache/mo1305-phase2a/remote-attempt3-setup-failure.json';
const priorBytes=readFileSync(resolve(root,priorPath)),prior=JSON.parse(priorBytes),stage=await setup();
const staging={distributionManifestSha256:stage.manifestSha256,fileCount:stage.stagedFileCount,nodeVersion:process.version,platform:process.platform,architecture:process.arch};
assert.equal(prior.state,'FAIL');assert.equal(prior.completed.length,63);assert.ok(prior.completed.every(row=>row.state==='PASS'));
assert.equal(prior.staging.distributionManifestSha256,staging.distributionManifestSha256,'CHANGED_PRODUCT_CANNOT_REUSE');
assert.equal(prior.code,'ERR_ASSERTION');assert.ok(prior.message.startsWith('STAGING_COMMAND_FAILED'));
const remaining=['REMOTE-token-rotation-after-restart','REMOTE-repeat-rebind'];
for(const id of remaining)assert.ok(!prior.completed.some(row=>row.id===id));
assert.ok(stage.address,'NO_ASSIGNED_REMOTE_ADDRESS');
const assigned=Object.entries(networkInterfaces()).flatMap(([name,items])=>items.map(item=>({name,...item}))).find(item=>item.family==='IPv4'&&item.address===stage.address&&!item.internal);
assert.ok(assigned);assert.equal(prior.completed.find(row=>row.id==='REMOTE-actual-RFC1918').actual.remoteAddress,stage.address);
const configPath=await writeConfig(stage,'rotation',{...stage.config,mode:'remote',bindAddress:stage.address});
const oldToken=stage.token,newToken=randomBytes(32).toString('hex'),records=[];let active=null;
async function stop(){if(active&&!active.exited){active.child.stdin.end();try{await bounded(active.exit,17000,'REMOTE_CONTINUATION_CLEANUP_TIMEOUT',{onTimeout:()=>active.child.kill()});}finally{active=null;}}}
try{
 active=await launch(stage,{configPath,observe:false});const firstPid=active.child.pid;
 assert.equal(response(await wire(stage,request(stage,'getHealth'))).status,200);
 writeFileSync(stage.config.tokenFile,newToken);
 assert.equal(response(await wire(stage,request(stage,'getHealth'))).status,200);
 assert.equal(response(await wire(stage,request(stage,'getHealth',null,{headers:{Authorization:'Bearer '+newToken}}))).status,401);
 await active.stop();active=null;
 active=await launch(stage,{configPath,observe:false});const secondPid=active.child.pid;
 const oldStatus=response(await wire(stage,request(stage,'getHealth'))).status,newStatus=response(await wire(stage,request(stage,'getHealth',null,{headers:{Authorization:'Bearer '+newToken}}))).status;
 assert.equal(oldStatus,401);assert.equal(newStatus,200);assert.notEqual(firstPid,secondPid);
 records.push({id:remaining[0],state:'PASS',actual:{oldTokenStatus:oldStatus,newTokenStatus:newStatus,beforeRestartOldTokenStatus:200,beforeRestartNewTokenStatus:401,serverPids:[firstPid,secondPid],clientPid:process.pid,interfaceName:assigned.name,cidr:assigned.cidr,address:stage.address}});
 await active.stop();active=null;writeFileSync(stage.config.tokenFile,oldToken);
 active=await launch(stage,{configPath,observe:false});const reboundPid=active.child.pid;
 assert.equal(response(await wire(stage,request(stage,'getReadiness'))).status,200);await active.stop();active=null;
 records.push({id:remaining[1],state:'PASS',actual:{status:200,exitCode:0,serverPid:reboundPid,clientPid:process.pid}});
 const continuationElapsedMs=Number((process.hrtime.bigint()-started)/1000000n);
 const continuation={kind:'MemoryOSRESTPhase2ARemoteContinuationResults',version:'1.0.0',state:'PASS',staging,elapsedMs:continuationElapsedMs,cases:records.length,records};
 writeFileSync(resolve(cache,'remote-continuation-results.json'),JSON.stringify(continuation)+'\n');
 const all=[...prior.completed,...records],result={kind:'MemoryOSRESTPhase2ARemoteLifecycleResults',version:'1.0.0',state:'PASS',staging,elapsedMs:prior.elapsedMs+continuationElapsedMs,cases:all.length,passed:all.length,notExecuted:0,remoteAddress:stage.address,networkConfigurationChanged:false,records:all,reuse:{priorReceipt:{path:priorPath,byteLength:priorBytes.length,sha256:createHash('sha256').update(priorBytes).digest('hex')},retainedIds:prior.completed.map(row=>row.id),reason:'63 completed assertions retained from final-source attempt; separate fresh same-source stage completes token rotation and rebind after harness ACL failure'}};
 const bytes=JSON.stringify(result);assert.ok(!bytes.includes(oldToken)&&!bytes.includes(newToken));assert.ok(bytes.length<131072);writeFileSync(resolve(cache,'remote-results.json'),bytes+'\n');
 console.log(JSON.stringify({state:'PASS',cases:all.length,retained:prior.completed.length,newCases:records.length,continuationElapsedMs,manifestSha256:staging.distributionManifestSha256}));
}finally{await stop();writeFileSync(stage.config.tokenFile,oldToken);}
