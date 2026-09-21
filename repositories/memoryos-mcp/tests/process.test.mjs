import test from 'node:test';import assert from 'node:assert/strict';import { spawn } from 'node:child_process';
import { once } from 'node:events';import { mkdtemp,cp,unlink,rm } from 'node:fs/promises';import { tmpdir } from 'node:os';import { resolve,relative,sep } from 'node:path';
import { PACKAGE_ROOT } from '../src/integrity.mjs';import { loadLimits } from '../src/limits.mjs';import { meta } from './support.mjs';
const limits=await loadLimits();
async function launch({root=PACKAGE_ROOT,env={},bytes=Buffer.alloc(0),expectReply=false,flags=[]}={}) {
  const child=spawn(process.execPath,[...flags,resolve(root,'bin/memoryos-mcp.mjs')],{cwd:root,env:{SystemRoot:process.env.SystemRoot,...env},windowsHide:true,stdio:['pipe','pipe','pipe']});
  let stdout='',stderr='';child.stdout.on('data',x=>{stdout+=x;if(expectReply&&stdout.includes('\n'))child.stdin.end();});child.stderr.on('data',x=>stderr+=x);child.stdin.on('error',()=>{});
  const timer=setTimeout(()=>child.kill(),limits.shutdownMs+5000);
  if(expectReply)child.stdin.write(bytes);else child.stdin.end(bytes);
  try{const [code,signal]=await once(child,'exit');return {code,signal,stdout,stderr};}finally{clearTimeout(timer);}
}
test('entry point clean EOF exits zero with no stdout/stderr',async()=>{assert.deepEqual(await launch(),{code:0,signal:null,stdout:'',stderr:''});});
test('entry point produces protocol-only UTF-8 stdout and no logs for a real semantic call',async()=>{
  const message={jsonrpc:'2.0',id:1,method:'tools/call',params:{_meta:meta,name:'memoryos_contract_identities',arguments:{}}};
  const result=await launch({bytes:Buffer.from(JSON.stringify(message)+'\n'),expectReply:true});assert.equal(result.code,0);assert.equal(result.stderr,'');
  assert.ok(result.stdout.endsWith('\n'));const lines=result.stdout.trim().split('\n');assert.equal(lines.length,1);assert.equal(JSON.parse(lines[0]).result.structuredContent.status,'ok');
});
test('entry point fatal framing and disallowed launch state emit only bounded fixed diagnostics',async()=>{
  for(const options of [{bytes:Buffer.from([0xc0,0xaf,10])},{bytes:Buffer.from('{')},{bytes:Buffer.alloc(limits.requestFrameBytes+1,32)},
    {env:{NODE_OPTIONS:'--no-warnings'}},{env:{NODE_PATH:'private-not-read'}},{flags:['--import=data:text/javascript,void%200']}]){
    const result=await launch(options);assert.equal(result.code,1);assert.equal(result.stdout,'');assert.equal(result.stderr,'MO1304_FATAL\n');assert.equal(Buffer.byteLength(result.stderr),limits.diagnosticBytes);
  }
});
test('entry point fails closed when resource constants are absent before dependency loading',async()=>{
  const base=resolve(tmpdir()),root=await mkdtemp(resolve(base,'memoryos-mo1304-startup-'));
  try{
    for(const item of ['package.json','bin','src','contracts'])await cp(resolve(PACKAGE_ROOT,item),resolve(root,item),{recursive:true});
    await unlink(resolve(root,'contracts/limits.json'));const result=await launch({root});assert.equal(result.code,1);assert.equal(result.stdout,'');assert.equal(result.stderr,'MO1304_FATAL\n');
  }finally{const rel=relative(base,resolve(root));assert.ok(rel.startsWith('memoryos-mo1304-startup-')&&!rel.includes(sep));await rm(root,{recursive:true,force:true});}
});
