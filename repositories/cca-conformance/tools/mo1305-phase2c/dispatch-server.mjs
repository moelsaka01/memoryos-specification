/** Supplemental observer: forwards the exact production Worker entry/options.
 * No semantic substitution, alternative SDK, test worker, or product file edit. */
import assert from 'node:assert/strict';
import threads from 'node:worker_threads';
import tls from 'node:tls';
import {syncBuiltinESMExports} from 'node:module';
import {resolve} from 'node:path';
import {pathToFileURL} from 'node:url';
const [stage,mode]=process.argv.slice(2);
assert.ok(['dispatch','write-hold'].includes(mode));
const entry=resolve(stage,'package/bin/memoryos-rest.mjs');
const ActualWorker=threads.Worker;
let created=0,reaped=0,holdWrites=mode==='write-hold',writeCompletions=0;
const held=new Set();
threads.Worker=class extends ActualWorker {
  constructor(workerEntry,options){
    super(workerEntry,options);created++;
    this.once('exit',()=>{reaped++;});
  }
};
if(holdWrites){
  const create=tls.createServer;
  tls.createServer=function(...args){
    const server=create.apply(this,args);
    server.prependListener('secureConnection',socket=>{
      for(const name of ['_write','_writev']){
        const original=socket[name];
        socket[name]=function(...values){
          const done=values.pop();
          return original.call(this,...values,error=>{
            if(error||!holdWrites)return done(error);
            let active=true;
            const release=()=>{if(!active)return;active=false;held.delete(release);writeCompletions++;done();};
            held.add(release);socket.once('close',release);
          });
        };
      }
    });
    return server;
  };
}
syncBuiltinESMExports();
process.on('message',message=>{
  if(message?.type==='release'){holdWrites=false;for(const release of [...held])release();}
  if(message?.type==='snapshot'||message?.type==='release'){
    process.send({type:'snapshot',ticket:message.ticket,created,reaped,heldWrites:held.size,writeCompletions});
  }
});
process.argv=[process.execPath,entry,'--config',resolve(stage,'private/config.json')];
await import(pathToFileURL(entry).href);
if(process.connected)process.disconnect();
