import fs from 'node:fs';
import path from 'node:path';
import assert from 'node:assert/strict';
import {createHash} from 'node:crypto';
import {spawnSync} from 'node:child_process';
import {fileURLToPath} from 'node:url';
export const root=fileURLToPath(new URL('../../../../',import.meta.url));
export const E=path.join(root,'repositories/cca-conformance/evidence/mo1307/phase3a-refresh');
export const cache=path.join(root,'.cache/m7r');
export const packageRoot=path.join(cache,'install/node_modules/memoryos-readiness');
export const C3RB='defe93989efc6501b1a730b82e79e705884b269b', C3R='58c98b7eb0aa2d07bab78753ce66b564066aafeb';
export const startedAt='2026-09-29T13:16:00Z';
export const env={SystemRoot:'C:\\Windows',WINDIR:'C:\\Windows'};
export const hash=b=>'sha256:'+createHash('sha256').update(b).digest('hex');
export const read=p=>fs.readFileSync(path.resolve(root,p));
export const json=p=>JSON.parse(read(p));
export const record=p=>{const b=read(p);return {path:path.relative(root,path.resolve(root,p)).replaceAll('\\','/'),byteLength:b.length,sha256:hash(b)};};
export const check=m=>{const r=record(m.path);assert.equal(r.byteLength,m.byteLength,m.path);assert.equal(r.sha256,m.sha256,m.path);};
export const walk=p=>fs.readdirSync(p,{withFileTypes:true}).sort((a,b)=>a.name<b.name?-1:1).flatMap(d=>{assert.ok(!d.isSymbolicLink());const q=path.join(p,d.name);return d.isDirectory()?walk(q):[q];});
export const inventory=p=>walk(p).map(f=>({...record(f),path:path.relative(p,f).replaceAll('\\','/')}));
export const put=(name,b)=>{const p=path.resolve(E,name);assert.ok(p.startsWith(E+path.sep));fs.mkdirSync(path.dirname(p),{recursive:true});fs.writeFileSync(p,b,{flag:'wx'});return record(p);};
export const write=(name,o)=>put(name,Buffer.from(JSON.stringify(o,null,2)+'\n'));
export const git=(...args)=>{const r=spawnSync('C:\\Program Files\\Git\\cmd\\git.exe',args,{cwd:root,encoding:null,windowsHide:true,timeout:60000,maxBuffer:128*1024*1024});assert.ifError(r.error);assert.equal(r.status,0,r.stderr.toString());return r.stdout;};
export const str=(...args)=>git(...args).toString().trim();
export function identity(){assert.equal(path.resolve(root).toLowerCase(),'c:\\users\\melsa\\documents\\codex\\r3a');assert.equal(process.version,'v24.21.0');assert.equal(process.platform,'win32');assert.equal(process.arch,'x64');assert.equal(hash(fs.readFileSync(process.execPath)),'sha256:ba4e6d110e8c1592a1ecd390f6b05f3da124b13871a5be62b341a07a853c6c32');assert.equal(str('rev-parse','HEAD'),C3RB);}
export function canonical(x){const order=v=>Array.isArray(v)?v.map(order):v!==null&&typeof v==='object'?Object.fromEntries(Object.keys(v).sort().map(k=>[k,order(v[k])])):v;return Buffer.from(JSON.stringify(order(x))+'\n');}
