import threads from 'node:worker_threads';
import {syncBuiltinESMExports} from 'node:module';
const Actual=threads.Worker,fault=process.argv[3];
threads.Worker=class extends Actual{
 constructor(entry,options){super(new URL('./fault-worker.mjs',import.meta.url),{...options,workerData:{...options.workerData,fault}});}
 terminate(){if(fault==='terminate-never')return Promise.resolve(0);if(fault==='terminate-reject')return Promise.reject(Error('INJECTED_TERMINATE_FAILURE'));return super.terminate();}
};
syncBuiltinESMExports();await import('./measure-server.mjs');
