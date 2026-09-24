/** Review-only sampling wrapper. Installed worker and semantic runtime bytes are unchanged. */
import threads from 'node:worker_threads';
import v8 from 'node:v8';
import {syncBuiltinESMExports} from 'node:module';
const {port,entry}=threads.workerData.__resourceAudit;delete threads.workerData.__resourceAudit;
const original=v8.getHeapSpaceStatistics;
let sequence=0;
v8.getHeapSpaceStatistics=()=>{
 const spaces=original();
 port.postMessage({event:'workerSample',sequence:sequence++,utcMs:Date.now(),threadId:threads.threadId,resourceLimits:threads.resourceLimits,execArgv:process.execArgv,environmentNames:Object.keys(process.env),memory:process.memoryUsage(),heap:v8.getHeapStatistics(),spaces});
 return spaces;
};
syncBuiltinESMExports();v8.getHeapSpaceStatistics();
await import(entry);
port.close();
