/** Phase 2A engineering observer/fault injector. Never shipped or selected by product config. */
import {resolve} from 'node:path';
import {pathToFileURL} from 'node:url';
import tls from 'node:tls';
import threads from 'node:worker_threads';
import {syncBuiltinESMExports} from 'node:module';
const [stage,configPath,fault='none']=process.argv.slice(2),root=resolve(stage,'package');
let pending=0,gateway,listener;
function emit(type,record){
  if(!process.connected)return;
  if(++pending>256)throw Error('OBSERVER_BACKLOG');
  process.send({type,record},error=>{pending--;if(error)process.exit(1);});
}
const {verifyRuntime,verifyDistribution}=await import(pathToFileURL(resolve(root,'src/integrity.mjs')));
verifyRuntime();const manifest=verifyDistribution(root);
const {rejectEnvironment,loadConfig}=await import(pathToFileURL(resolve(root,'src/config.mjs')));
rejectEnvironment();const config=loadConfig(configPath);
const nativeCreate=tls.createServer;
tls.createServer=function(...args){
  listener=nativeCreate.apply(this,args);
  if(fault==='blocked-write'||fault==='listener-close-stall')listener.prependListener('secureConnection',socket=>{
    // Forward actual TLS bytes but hold successful Writable completion. Small
    // bounded product responses otherwise fit the host TCP receive buffers.
    for(const name of ['_write','_writev']){const native=socket[name];socket[name]=function(...values){const callback=values.pop();return native.call(this,...values,error=>{if(error)callback(error);else this.once('close',()=>callback());});};}
  });
  if(fault==='listener-close-stall'){
    const close=listener.close;
    listener.close=function(callback){return close.call(this,()=>{});};
  }
  return listener;
};
{
  const Actual=threads.Worker;
  threads.Worker=class extends Actual{
    constructor(entry,options){
      const selected={'worker-exit':'exit','worker-hold':'timeout','worker-terminate-never':'terminate-never','worker-stale':'stale'}[fault];
      super(selected?new URL('../mo1305-phase1/fault-worker.mjs',import.meta.url):entry,selected?{...options,workerData:{...options.workerData,fault:selected}}:options);
      const generation=options.workerData.generation,threadId=this.threadId;
      emit('worker',{state:'created',generation,threadId});
      this.once('exit',code=>emit('worker',{state:'reaped',generation,threadId,code}));
    }
    terminate(){return fault==='worker-terminate-never'?Promise.resolve(0):super.terminate();}
  };
  syncBuiltinESMExports();
}
const {Ownership}=await import(pathToFileURL(resolve(root,'src/admission.mjs')));
const reserve=Ownership.prototype.reserve;
Ownership.prototype.reserve=function(...args){
  if(fault==='generation-exhaustion')this.generation=Number.MAX_SAFE_INTEGER;
  const owner=reserve.apply(this,args);let state=owner.state;
  Object.defineProperty(owner,'state',{get(){return state;},set(next){state=next;emit('owner',{state:next,generation:owner.generation});if(fault==='shutdown-'+next&&gateway)void gateway.shutdown(0);}});
  emit('owner',{state,generation:owner.generation});return owner;
};
const {startGateway}=await import(pathToFileURL(resolve(root,'src/server.mjs')));
const controller=new AbortController();let requested=null;
function stop(code){requested=Math.max(requested??0,code);controller.abort(requested);if(gateway)void gateway.shutdown(requested);}
process.on('SIGINT',()=>stop(0));process.on('SIGTERM',()=>stop(0));
process.stdin.on('data',()=>stop(1));process.stdin.once('end',()=>stop(0));process.stdin.on('error',()=>stop(1));process.stdin.resume();
process.on('message',message=>{
  if(message==='listener-error')listener.emit('error',new Error('INJECTED_LISTENER_FAILURE'));
  else if(message==='shutdown')stop(0);
  else if(message==='fatal')stop(1);
});
if(fault==='startup-aborted')controller.abort(0);
try{
  gateway=await startGateway(config,manifest,{signal:controller.signal,observe:r=>emit('sample',r),observeState:r=>emit('state',r),observeLifecycle:state=>emit('lifecycle',{state})});
  if(requested!==null)void gateway.shutdown(requested);
  process.exitCode=await gateway.closed;
}catch{process.exitCode=2;}
process.stdin.pause();if(process.connected)process.disconnect();
