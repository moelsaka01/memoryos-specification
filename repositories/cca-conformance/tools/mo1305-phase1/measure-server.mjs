/** Engineering instrumentation: executes the unchanged installed server in its own process.
 * No measurement interface is exposed by the product executable or over HTTP. */
import {pathToFileURL} from 'node:url';
import {resolve} from 'node:path';
const stage=process.argv[2],root=resolve(stage,'package');
const {verifyRuntime,verifyDistribution}=await import(pathToFileURL(resolve(root,'src/integrity.mjs')));
verifyRuntime();const manifest=verifyDistribution(root);
const {rejectEnvironment,loadConfig}=await import(pathToFileURL(resolve(root,'src/config.mjs')));
// Non-shipping observer: return every original clock value unchanged.
// Ownership state publication follows the runtime's operationUs calculation synchronously.
const {randomUUID}=await import('node:crypto');
const nativeHrtime=process.hrtime.bigint;let lastTick=null,lastOwner=null,operationTiming=null;
const timingDomain='MONOTONIC_PROCESS:'+process.pid+':'+randomUUID();
process.hrtime.bigint=()=>{lastTick=nativeHrtime();return lastTick;};
const {Ownership}=await import(pathToFileURL(resolve(root,'src/admission.mjs')));
const reserve=Ownership.prototype.reserve;
Ownership.prototype.reserve=function(...args){const owner=reserve.apply(this,args);lastOwner=owner;operationTiming=null;let state=owner.state;
 Object.defineProperty(owner,'state',{enumerable:true,configurable:true,get(){return state;},set(value){state=value;if((value==='published'||value==='aborted')&&typeof owner.started==='bigint'&&lastTick!==null){operationTiming={clockDomain:timingDomain,startNs:owner.started.toString(),endNs:lastTick.toString(),durationUs:Number((lastTick-owner.started+999n)/1000n),boundary:value,generation:owner.generation};}}});return owner;};
const {startGateway}=await import(pathToFileURL(resolve(root,'src/server.mjs')));
rejectEnvironment();
let sent=0;
function emit(type,record){
 if(!process.connected||sent>=256)throw Error('MEASUREMENT_BACKLOG');sent++;
 process.send({type,record,...(type==='sample'?{operationTiming:record.workerCreated?operationTiming:null}:{})},error=>{sent--;if(error)throw error;});
}
const server=await startGateway(loadConfig(resolve(stage,'private/config.json')),manifest,{observe:record=>emit('sample',record),observeState:record=>emit('state',record)});
process.once('SIGINT',()=>server.shutdown(0));process.once('SIGTERM',()=>server.shutdown(0));
process.stdin.on('data',()=>server.shutdown(1));process.stdin.once('end',()=>server.shutdown(0));process.stdin.resume();
process.exitCode=await server.closed;process.stdin.pause();process.disconnect();
