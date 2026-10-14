import test from 'node:test';
import assert from 'node:assert/strict';
import {Worker} from 'node:worker_threads';
test('isolated worker denies network/DNS, process creation, nested workers, native addons and file writes',async()=>{
 const source=`const {parentPort}=require('node:worker_threads');
 (async()=>{
 const {installWorkerBoundary}=await import(${JSON.stringify(new URL('../src/worker-boundary.mjs',import.meta.url).href)});installWorkerBoundary();
 const calls=[()=>fetch('http://127.0.0.1'),()=>new WebSocket('ws://127.0.0.1'),()=>require('node:net').connect(1),()=>new (require('node:net').Socket)().connect(1),()=>require('node:tls').connect(1),()=>require('node:http').get('http://127.0.0.1'),()=>require('node:https').request('https://127.0.0.1'),()=>require('node:http2').connect('https://127.0.0.1'),()=>require('node:dgram').createSocket('udp4'),()=>require('node:dns').lookup('localhost',()=>{}),()=>require('node:dns').resolve('localhost',()=>{}),()=>require('node:dns').promises.lookup('localhost'),()=>new (require('node:dns').Resolver)().resolve('localhost',()=>{}),()=>require('node:child_process').spawn('cmd'),()=>new (require('node:worker_threads').Worker)(''),()=>process.dlopen({},'native.node'),()=>require('node:fs').writeFileSync('forbidden','data'),()=>require('node:fs').openSync('forbidden','w'),()=>require('node:fs/promises').writeFile('forbidden','data'),()=>require('node:fs/promises').open('forbidden','w')];
 const readonly=await require('node:fs/promises').open(${JSON.stringify(new URL('../src/worker-boundary.mjs',import.meta.url).pathname.replace(/^\//,''))},'r');
 calls.push(()=>new (require('node:net').Server)().listen(1),()=>new (require('node:http').Agent)().createConnection({port:1}),()=>new (require('node:https').Agent)().createConnection({port:1}),()=>new (require('node:child_process').ChildProcess)().spawn({}),()=>readonly.chmod(0o666),()=>readonly.writeFile('denied'),()=>readonly.truncate(0));
 let denied=0;for(const call of calls){try{await call();}catch(error){if(error.message==='MO1305_WORKER_AUTHORITY_DENIED')denied++;else throw error;}}
 await readonly.close();parentPort.postMessage({denied,total:calls.length});parentPort.close();
 })().catch(()=>process.exit(1));`;
 const worker=new Worker(source,{eval:true,env:{},execArgv:[],stdout:true,stderr:true});let result,output=0;
 worker.stdout.on('data',b=>output+=b.length);worker.stderr.on('data',b=>output+=b.length);worker.on('message',v=>result=v);
 const exit=await new Promise((resolve,reject)=>{worker.once('exit',resolve);worker.once('error',reject);});
 assert.equal(exit,0);assert.equal(output,0);assert.equal(result.denied,27);assert.equal(result.denied,result.total);
});
