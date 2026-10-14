// Offline engineering only. Source worktrees are always read-only.
import fs from 'node:fs';
import path from 'node:path';
import assert from 'node:assert/strict';
import {spawnSync} from 'node:child_process';
import {createHash} from 'node:crypto';
import {fileURLToPath} from 'node:url';
export const root=fileURLToPath(new URL('../../../../',import.meta.url));
export const evidence='repositories/cca-conformance/evidence/mo1307/phase3a-readset-correction';
export const baseline='976d4a04d75dadc02e30215dd5a8ddeaa2352df8';
export const implementationSubject='fix(memoryos-1.3): optimize MO-1307 native READ_SET acquisition';
export const bindingSubject='conformance(memoryos-1.3): bind MO-1307 READ_SET optimization';
export const hash=b=>'sha256:'+createHash('sha256').update(b).digest('hex');
export const read=p=>fs.readFileSync(path.resolve(root,p));
export const json=p=>JSON.parse(read(p).toString('utf8'));
export const record=(p,b=read(p))=>({path:p,byteLength:b.length,sha256:hash(b)});
export function check(m,b=read(m.path)){assert.equal(b.length,m.byteLength,m.path);assert.equal(hash(b),m.sha256,m.path);}
export function git(...args){const r=spawnSync('git',args,{cwd:root,encoding:null,windowsHide:true,timeout:60000,maxBuffer:256*1024*1024});assert.ifError(r.error);assert.equal(r.status,0,r.stderr.toString());return r.stdout;}
export const str=(...a)=>git(...a).toString('utf8').trim();
export function write(p,value){const target=path.resolve(root,p);assert.ok(target.startsWith(path.resolve(root)+path.sep));fs.mkdirSync(path.dirname(target),{recursive:true});fs.writeFileSync(target,JSON.stringify(value,null,2)+'\n',{flag:'wx'});}
export function blobs(revision,paths){const r=spawnSync('git',['cat-file','--batch'],{cwd:root,input:paths.map(p=>revision+':'+p+'\n').join(''),encoding:null,windowsHide:true,timeout:60000,maxBuffer:256*1024*1024});assert.ifError(r.error);assert.equal(r.status,0);let off=0;
 const values=paths.map(p=>{const end=r.stdout.indexOf(10,off);assert.ok(end>=off);const header=r.stdout.subarray(off,end).toString();assert.match(header,/^[a-f0-9]{40} blob \d+$/);const size=Number(header.split(' ')[2]);off=end+1;const bytes=r.stdout.subarray(off,off+size);off+=size;assert.equal(r.stdout[off++],10,p);return bytes;});assert.equal(off,r.stdout.length);return values;}
export function sourceState(s){const a=['-c','safe.directory='+s.worktree,'-C',s.worktree];return {commit:str(...a,'rev-parse','HEAD'),parents:str(...a,'show','-s','--format=%P','HEAD').split(' '),subject:str(...a,'show','-s','--format=%s','HEAD'),branch:str(...a,'branch','--show-current'),status:git(...a,'status','--porcelain=v1','--untracked-files=all').toString('utf8')};}
