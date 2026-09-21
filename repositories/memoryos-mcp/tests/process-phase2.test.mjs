import test from 'node:test';import assert from 'node:assert/strict';
import { raw } from './phase2-support.mjs';import { meta } from './support.mjs';import { names,META } from '../src/contracts.mjs';import { loadLimits } from '../src/limits.mjs';
const request=(id,method,params={})=>({jsonrpc:'2.0',id,method,params:{_meta:meta,...params}});
const semantic=id=>request(id,'tools/call',{name:names[0],arguments:{}});
test('actual process pipes preserve sequential IDs, closed metadata, protocol-only stdout and clean EOF',async()=>{
 const h=await raw();try{
  for(let id=0;id<8;id++){h.send(semantic(id));const frame=await h.next(id);assert.equal(frame.id,id);assert.equal(frame.result.structuredContent.status,'ok');assert.deepEqual(frame.result._meta,META);assert.equal(frame.result.content.length,1);}
  assert.deepEqual(await h.end(),{code:0,signal:null});assert.equal(h.stderr(),'');assert.equal(h.partial(),0);
 }finally{if(h.child.exitCode===null)await h.stop();}
});
test('raw OS-pipe malformed frames stay bounded and do not acquire semantic authority',async()=>{
 const h=await raw();try{
  const values=['null','[]','{"jsonrpc":"2.0","id":1,"id":2,"method":"tools/list"}','{"x":"\\ud800"}','\ufeff{}','{"x":1,}',JSON.stringify(request(1.5,'server/discover')),JSON.stringify(request(1,'server/discover',{_meta:{...meta,'io.modelcontextprotocol/protocolVersion':'2025-11-25'}})),JSON.stringify(request(2,'initialize')),JSON.stringify(request(3,'resources/read',{uri:'file:///private'}))];
  for(let i=0;i<values.length;i++){h.child.stdin.write(values[i]+'\n');const result=await h.next(i);assert.ok(result.error);assert.ok([-32700,-32600,-32602,-32022,-32601].includes(result.error.code));assert.ok(!JSON.stringify(result).includes('file:///private'));}
  assert.deepEqual(await h.end(),{code:0,signal:null});assert.equal(h.stderr(),'');assert.equal(h.partial(),0);
 }finally{if(h.child.exitCode===null)await h.stop();}
});
for(const state of ['idle','semantic','cancellation','subscription','malformed-complete'])test(`actual process EOF cleanup: ${state}`,async()=>{
 const h=await raw();try{
  if(state==='semantic'||state==='cancellation')h.send(semantic(1));
  if(state==='cancellation')h.send({jsonrpc:'2.0',method:'notifications/cancelled',params:{requestId:1,reason:'private'}});
  if(state==='subscription')h.send(request('subscription','subscriptions/listen',{notifications:{}}));
  if(state==='malformed-complete')h.child.stdin.write('{bad}\n');
  assert.deepEqual(await h.end(),{code:0,signal:null});assert.equal(h.stderr(),'');assert.equal(h.partial(),0);
  if(state==='semantic'||state==='cancellation')assert.equal(h.frames.filter(x=>x.id===1).length,0);
  if(state==='subscription')assert.ok(h.frames.every(x=>['notifications/subscriptions/acknowledged','notifications/cancelled'].includes(x.method)));
  if(state==='malformed-complete')assert.equal(h.frames[0].error.code,-32700);
 }finally{if(h.child.exitCode===null)await h.stop();}
});
for(const mode of ['partial-eof','invalid-utf8','overflow','node-options','node-path','inspect-port','preload'])test(`actual process bounded fatal rejection: ${mode}`,async()=>{
 const options=mode==='node-options'?{env:{NODE_OPTIONS:'--no-warnings'}}:mode==='node-path'?{env:{NODE_PATH:'C:/private'}}:mode==='inspect-port'?{flags:['--inspect-port=0']}:mode==='preload'?{flags:['--import=data:text/javascript,void%200']}:{},h=await raw(undefined,options);
 try{
  if(mode==='partial-eof')h.child.stdin.write('{');
  if(mode==='invalid-utf8')h.child.stdin.write(Buffer.from([0xc0,0xaf,10]));
  if(mode==='overflow')h.child.stdin.write(Buffer.alloc((await loadLimits()).requestFrameBytes+1,32));
  assert.deepEqual(await h.end(),{code:1,signal:null});assert.equal(h.stderr(),'MO1304_FATAL\n');assert.equal(h.frames.length,0);
 }finally{if(h.child.exitCode===null)await h.stop();}
});

for(const mode of ['clean','subscription','partial-tail','drain-timeout'])test(`actual process EOF with unread stdout pipe: ${mode}`,async()=>{
 const { spawn }=await import('node:child_process'),{ resolve }=await import('node:path'),{ setTimeout:delay }=await import('node:timers/promises');
 const { PACKAGE_ROOT }=await import('../src/integrity.mjs'),{env}=await import('./phase2-support.mjs');
 const child=spawn(process.execPath,[resolve(PACKAGE_ROOT,'bin/memoryos-mcp.mjs')],{cwd:PACKAGE_ROOT,env:env(),windowsHide:true,stdio:['pipe','pipe','pipe']});
 let stderr='';child.stderr.on('data',x=>{stderr+=x;assert.ok(stderr.length<=13);});child.stdin.on('error',()=>{});
 const exited=new Promise((done,reject)=>{child.on('error',reject);child.on('exit',(code,signal)=>done({code,signal}));});
 const values=[];if(mode==='subscription')values.push(request('sub','subscriptions/listen',{notifications:{}}));
 for(let id=values.length;id<20;id++)values.push(request(id,'tools/list'));
 child.stdin.write(values.map(x=>JSON.stringify(x)+'\n').join('')+(mode==='partial-tail'?'{':''));
 const deadline=setTimeout(()=>child.kill(),40000);
 try{
  for(let i=0;i<2000&&!child.stdout.readableLength&&child.exitCode===null;i++)await delay(5);
  assert.ok(child.stdout.readableLength>0,'pipe contains protocol output without an active reader');await delay(200);
  if(mode!=='drain-timeout')child.stdin.end();
  const fatal=mode==='partial-tail'||mode==='drain-timeout';assert.deepEqual(await exited,{code:fatal?1:0,signal:null});assert.equal(stderr,fatal?'MO1304_FATAL\n':'');
 }finally{clearTimeout(deadline);if(child.exitCode===null){child.kill();await exited;}child.stdout.destroy();}
});
