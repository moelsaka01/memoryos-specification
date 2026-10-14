// Engineering helpers only; no product import, network or outside-workspace write.
import fs from 'node:fs';
import path from 'node:path';
import assert from 'node:assert/strict';
import { spawnSync } from 'node:child_process';
import { createHash } from 'node:crypto';
import { fileURLToPath } from 'node:url';
export const root = fileURLToPath(new URL('../../../../', import.meta.url));
export const evidence = 'repositories/cca-conformance/evidence/mo1307/phase2c-finalization-correction';
export const baseline = '0d68ac211b3b204635e7af252cd693dce5bd70b1';
export const implementationSubject = 'fix(memoryos-1.3): correct MO-1307 publication finalization boundary';
export const bindingSubject = 'conformance(memoryos-1.3): bind MO-1307 finalization correction';
export const hash = b => 'sha256:' + createHash('sha256').update(b).digest('hex');
export const read = p => fs.readFileSync(path.resolve(root,p));
export const json = p => JSON.parse(read(p).toString('utf8'));
export const record = (p,b=read(p)) => ({path:p,byteLength:b.length,sha256:hash(b)});
export function check(m,b=read(m.path)) { assert.equal(b.length,m.byteLength,m.path); assert.equal(hash(b),m.sha256,m.path); }
export function git(...args) { const r=spawnSync('git',args,{cwd:root,encoding:null,timeout:20000,maxBuffer:32*1024*1024,windowsHide:true}); assert.ifError(r.error); assert.equal(r.status,0,r.stderr.toString()); return r.stdout; }
export const str=(...args)=>git(...args).toString('utf8').trim();
export const write=(p,v)=>{const target=path.resolve(root,p);assert.ok(target.startsWith(path.resolve(root)+path.sep));fs.mkdirSync(path.dirname(target),{recursive:true});fs.writeFileSync(target,JSON.stringify(v,null,2)+'\n',{flag:'wx'});};
// One process reads immutable Git blobs, preserving exact binary bytes.
export function blobs(revision,paths) {
  const input=paths.map(p=>revision+':'+p+'\n').join('');
  const r=spawnSync('git',['cat-file','--batch'],{cwd:root,input,encoding:null,timeout:60000,maxBuffer:32*1024*1024,windowsHide:true});
  assert.ifError(r.error);assert.equal(r.status,0);let offset=0;
  const result=paths.map(p=>{const end=r.stdout.indexOf(10,offset);assert.ok(end>=offset);const header=r.stdout.subarray(offset,end).toString();
    assert.match(header,/^[a-f0-9]{40} blob [0-9]+$/);const size=Number(header.split(' ')[2]);offset=end+1;
    const bytes=r.stdout.subarray(offset,offset+size);assert.equal(bytes.length,size,p);offset+=size;assert.equal(r.stdout[offset++],10,p);return bytes;});
  assert.equal(offset,r.stdout.length);return result;
}
