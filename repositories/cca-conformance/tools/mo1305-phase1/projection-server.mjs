import threads from 'node:worker_threads';
import {syncBuiltinESMExports} from 'node:module';
const Actual=threads.Worker;
threads.Worker=class extends Actual{constructor(entry,options){super(new URL('./projection-worker.mjs',import.meta.url),{...options,workerData:{...options.workerData,projection:process.argv[3]}});}};
syncBuiltinESMExports();await import('./measure-server.mjs');
