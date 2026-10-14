import fs from 'node:fs';import workerThreads from 'node:worker_threads';
import { pathToFileURL } from 'node:url';import { resolve } from 'node:path';
import { syncBuiltinESMExports } from 'node:module';
import { guards,freshAudit } from './phase2-guard.mjs';
const [root,receipt]=process.argv.slice(2),write=fs.writeFileSync.bind(fs),RealWorker=workerThreads.Worker;
const audit=freshAudit(),workers=[];
workerThreads.Worker=class extends RealWorker {
 constructor(url,options){super(new URL('./phase2-worker-guard.mjs',import.meta.url),{...options,workerData:{...options.workerData,phase2OriginalWorker:String(url),phase2AuditRoot:root}});this.on('message',message=>{if(message.phase2Audit){if(workers.length>=100)throw Error('AUDIT_BOUND');workers.push(message.phase2Audit);}});}
};syncBuiltinESMExports();
process.once('exit',code=>write(receipt,JSON.stringify({code,parent:audit,workers})+'\n'));
const validators=guards(root,audit);await validators();
await import(pathToFileURL(resolve(root,'bin/memoryos-mcp.mjs')).href);
