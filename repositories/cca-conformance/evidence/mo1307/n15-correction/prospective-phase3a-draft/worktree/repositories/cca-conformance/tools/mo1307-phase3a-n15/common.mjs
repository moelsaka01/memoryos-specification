import fs from 'node:fs';
import path from 'node:path';
import assert from 'node:assert/strict';
import {createHash} from 'node:crypto';
import {spawnSync} from 'node:child_process';
import {fileURLToPath} from 'node:url';
export const root=fileURLToPath(new URL('../../../../',import.meta.url));
export const relativeE='repositories/cca-conformance/evidence/mo1307/phase3a-n15';
export const E=path.join(root,relativeE),T=path.dirname(fileURLToPath(import.meta.url));
export const cache=path.join(root,'.cache/m7n1');
export const packageRoot=path.join(root,'.cache/m7n1/install/node_modules/memoryos-readiness');
export const pkg=packageRoot;
const activation=JSON.parse(fs.readFileSync(path.join(E,'activation.json'),'utf8'));
assert.equal(activation.kind,'MO1307N15Phase3AActivation');
assert.equal(activation.status,'CANDIDATE_BOUND_AFTER_ALL_VALIDATION_PASS');
assert.match(activation.candidate,/^[0-9a-f]{40}$/u);
assert.equal(activation.worktree,'C:/m7n1');
assert.equal(activation.branch,'codex/mo1307-phase3a-n15');
export const HEAD=activation.candidate,C3RB='defe93989efc6501b1a730b82e79e705884b269b',C3R='58c98b7eb0aa2d07bab78753ce66b564066aafeb';
const campaignConfig=JSON.parse(fs.readFileSync(path.join(E,'campaign-config.json'),'utf8'));
export const startedAt=campaignConfig.startedAt,hardStopAt=campaignConfig.hardStopAt;
assert.equal(campaignConfig.candidate,HEAD);assert.ok(Number.isFinite(Date.parse(startedAt)));assert.ok(Number.isFinite(Date.parse(hardStopAt))&&Date.parse(hardStopAt)>Date.parse(startedAt));
export const env={SystemRoot:'C:\\Windows',WINDIR:'C:\\Windows'};
export const hash=b=>'sha256:'+createHash('sha256').update(b).digest('hex');
export const read=p=>fs.readFileSync(path.resolve(root,p));
export const json=p=>JSON.parse(read(p));
export const record=p=>{const b=read(p);return {path:path.relative(root,path.resolve(root,p)).replaceAll('\\','/'),byteLength:b.length,sha256:hash(b)};};
export const check=r=>assert.deepEqual(record(r.path),r);
export const walk=(p,relative='')=>fs.readdirSync(p,{withFileTypes:true}).sort((a,b)=>a.name<b.name?-1:1).flatMap(d=>{const q=path.join(p,d.name),n=relative?relative+'/'+d.name:d.name;const s=fs.lstatSync(q);assert.ok(!s.isSymbolicLink()&&(s.isDirectory()||s.isFile()),'Regular inventory member required: '+q);return s.isDirectory()?walk(q,n):[{...record(q),path:n}];});
export const inventory=walk;
export const put=(name,b)=>{const f=path.resolve(E,name);assert.ok(f.startsWith(E+path.sep));fs.mkdirSync(path.dirname(f),{recursive:true});fs.writeFileSync(f,b,{flag:'wx'});return record(f);};
export const write=(name,o)=>put(name,Buffer.from(JSON.stringify(o,null,2)+'\n'));
export const git=(...args)=>{const r=spawnSync('C:\\Program Files\\Git\\cmd\\git.exe',['-c','safe.directory=C:/m7n1',...args],{cwd:root,encoding:null,windowsHide:true,timeout:60000,maxBuffer:128*1024*1024});assert.ifError(r.error);assert.equal(r.status,0,r.stderr.toString());return r.stdout;};
export const str=(...args)=>git(...args).toString().trim();
export function identity(){assert.equal(path.resolve(root).toLowerCase(),'c:\\m7n1');assert.equal(process.platform,'win32');assert.equal(process.version,'v24.21.0');assert.equal(process.arch,'x64');assert.equal(hash(read(process.execPath)),'sha256:ba4e6d110e8c1592a1ecd390f6b05f3da124b13871a5be62b341a07a853c6c32');assert.equal(str('rev-parse','HEAD'),HEAD);assert.equal(str('branch','--show-current'),activation.branch);assert.equal(str('rev-parse',HEAD+':repositories/memoryos-readiness'),activation.packageTree);assert.ok(Date.now()<Date.parse(hardStopAt));}
export function canonical(x){const order=v=>Array.isArray(v)?v.map(order):v!==null&&typeof v==='object'?Object.fromEntries(Object.keys(v).sort().map(k=>[k,order(v[k])])):v;return Buffer.from(JSON.stringify(order(x))+'\n');}


