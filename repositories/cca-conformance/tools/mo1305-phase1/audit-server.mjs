/** Review-only diagnostic wiring; all production file bytes remain installed and verified. */
import threads from 'node:worker_threads';
import {syncBuiltinESMExports} from 'node:module';
import v8 from 'node:v8';
const ActualWorker=threads.Worker;let liveWorkers=0,sequence=0,pending=0;
const sample=(event,extra={})=>{
 if(!process.connected||pending>=256)throw Error('AUDIT_BACKLOG');
 pending++;process.send({type:'audit',record:{event,sequence:sequence++,utcMs:Date.now(),liveWorkers,memory:process.memoryUsage(),heap:v8.getHeapStatistics(),spaces:v8.getHeapSpaceStatistics(),...extra}},error=>{pending--;if(error)throw error;});
};
threads.Worker=class extends ActualWorker{
 constructor(entry,options){
  const {port1,port2}=new threads.MessageChannel(),requested={...options.resourceLimits};
  const young=Number(process.argv[3]);
  const resourceLimits={...requested,...(young>0?{maxYoungGenerationSizeMb:young}:{})};
  sample('beforeWorker',{requested,configured:resourceLimits});
  super(new URL('./audit-worker.mjs',import.meta.url),{...options,resourceLimits,workerData:{...options.workerData,__resourceAudit:{port:port2,entry:entry.href}},transferList:[port2]});
  liveWorkers++;sample('workerCreated',{threadId:this.threadId,resourceLimits:this.resourceLimits});
  port1.on('message',record=>{pending++;if(pending>256)throw Error('AUDIT_BACKLOG');process.send({type:'audit',record:{...record,liveWorkers}},error=>{pending--;if(error)throw error;});});
  this.once('exit',code=>{liveWorkers--;port1.close();sample('workerReaped',{code,resourceLimits:this.resourceLimits});});
 }
};
syncBuiltinESMExports();sample('beforeServer');
await import('./measure-server.mjs');
