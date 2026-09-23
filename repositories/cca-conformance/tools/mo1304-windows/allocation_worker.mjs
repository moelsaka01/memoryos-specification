// Certification-only allocation witness; never installed as product code.
import { workerData } from 'node:worker_threads';
if(workerData.mode==='heap'){const retained=[];while(true)retained.push(new Array(100000).fill(retained.length));}
else {globalThis.certificationBuffer=Buffer.alloc(workerData.bytes,1);setInterval(()=>{},1000);}
