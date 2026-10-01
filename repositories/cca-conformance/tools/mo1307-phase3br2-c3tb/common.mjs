// Engineering-only C3TB artifact certification support. Never imported by production.
import fs from 'node:fs';
import path from 'node:path';
import assert from 'node:assert/strict';
import crypto from 'node:crypto';
import {spawnSync} from 'node:child_process';
import {gunzipSync} from 'node:zlib';
import {fileURLToPath} from 'node:url';
import {isBuiltin} from 'node:module';
import {packageFiles,checkPackage,canonical} from '../mo1307-phase1/package.mjs';

export const root=fileURLToPath(new URL('../../../../',import.meta.url));
export const T='repositories/cca-conformance/tools/mo1307-phase3br2-c3tb';
export const E='repositories/cca-conformance/evidence/mo1307/phase3br2-c3tb';
export const S='repositories/memoryos-readiness';
export const D='docs/mo1307-phase3br2-c3tb.md';
export const C3TB='119e68bdcf0ffc906b4ca03a912aadcb25908346';
export const C3T='65e24b2debdd70ecb8e52fbccbd6c101621f1917';
export const C3T_PARENT='79ef47e608c67edc70f3e9f51d494b169794f903';
export const C3RB='defe93989efc6501b1a730b82e79e705884b269b';
export const HISTORICAL_3B='702c1b6381f6112a50ac844831d195275dac3350';
export const HISTORICAL_3B_SOURCE='5cb213eeab8a6deec39a8f8f93ea13a70e053231';
export const PRODUCTION_TREE='324bf600b6cbfaa8564db27fce2d999711270cb8';
export const PACKAGE_IDENTITY='2869cc0745fc555d5338f35634e7738b49cb628f6693dd92c5868f36ec113729';
export const HELPER_SHA256='97ef5ae9ce7ab390548b04a2aefba9f922c3e1c6b9b80581c6c274f0b21f0127';
export const DISTRIBUTION_SHA256='91dc9624de1b89b5d83bdf795ccbc0f745b41d958fc8c1dd7abb997f0f88d73c';
export const SBOM_SHA256='1510fdb9c0366023b4e49b81ce20cceeb1527a1dfaa2f7b4ded52a9bff737fda';
export const BRANCH='codex/mo1307-phase3br2-c3tb';
export const limits=Object.freeze({helperDeadlineMs:8000,helperAggregateDeadlineMs:20000,cliDeadlineMs:30000,apiDeadlineMs:10000,workerDeadlineMs:10000,cleanupAllowanceMs:2000});
export const artifactTamperControls=Object.freeze(['archive-byte-tamper','missing-member','unexpected-member','unsafe-tar-path','nonregular-tar-member','duplicate-member','missing-tar-terminator','trailing-tar-data','helper-tamper','distribution-hash-tamper','distribution-length-tamper','sbom-checksum-tamper','extra-package-file','missing-package-file','provenance-byte-tamper','installed-helper-mutation']);
export const closureTamperControls=Object.freeze(['schema-tamper','unexpected-production-dependency','external-runtime-import','source-worktree-import','network-builtin-import','runtime-identity-mismatch']);
export const node='C:/Users/melsa/Documents/Codex/cca-workspace/.cache/mo1304-phase3-toolchain/node-v24.21.0-win-x64/node.exe';
export const npm=path.join(path.dirname(node),'node_modules/npm/bin/npm-cli.js');
export const python='C:/Users/melsa/.cache/codex-runtimes/codex-primary-runtime/dependencies/python/python.exe';
export const cache=path.join(root,'.cache/mo1307-phase3br2-c3tb');

export const hash=(b,algo='sha256')=>crypto.createHash(algo).update(b).digest('hex');
export const read=p=>fs.readFileSync(path.resolve(root,p));
export const json=p=>JSON.parse(read(p));
export const rec=(p,b=read(p))=>({path:p,byteLength:b.length,sha256:hash(b)});
export const canonicalBytes=value=>Buffer.from(canonical(value)+'\n');
export function write(p,value){const target=path.resolve(root,p),prefix=path.resolve(root)+path.sep;assert.ok(target.startsWith(prefix),target);fs.mkdirSync(path.dirname(target),{recursive:true});fs.writeFileSync(target,typeof value==='string'||Buffer.isBuffer(value)?value:JSON.stringify(value,null,2)+'\n');}
export function git(args,cwd=root){const r=spawnSync('C:/Program Files/Git/cmd/git.exe',['-c','safe.directory='+cwd.replaceAll('\\','/'),...args],{cwd,windowsHide:true,encoding:'utf8',timeout:120000,maxBuffer:64*1024*1024});assert.ifError(r.error);assert.equal(r.status,0,r.stderr);return r.stdout.trim();}
export function gitBytes(commit,p){assert.ok(/^[0-9a-f]{40}$/.test(commit));assert.ok(!/[\r\n]/.test(p));const r=spawnSync('C:/Program Files/Git/cmd/git.exe',['-c','safe.directory='+root.replaceAll('\\','/'),'show',commit+':'+p],{cwd:root,windowsHide:true,encoding:null,timeout:120000,maxBuffer:64*1024*1024});assert.ifError(r.error);assert.equal(r.status,0,r.stderr?.toString());return r.stdout;}
export function gitObjectRecord(commit,p){const b=gitBytes(commit,p);return {commit,...rec(p,b)};}
export function walk(base,rel=''){return fs.readdirSync(path.join(base,rel)).sort().flatMap(n=>{const p=rel?rel+'/'+n:n,st=fs.lstatSync(path.join(base,p));assert.ok(!st.isSymbolicLink(),p);if(st.isDirectory())return walk(base,p);assert.ok(st.isFile(),p);return [p];}).sort();}
export const inventory=base=>walk(base).map(p=>rec(p,fs.readFileSync(path.join(base,p))));
export function packageIdentity(rows){const normalized=rows.map(r=>({path:r.path,byteLength:r.byteLength,sha256:'sha256:'+r.sha256}));return hash(canonicalBytes(normalized));}
export function controlledEnv(home){fs.mkdirSync(home,{recursive:true});const temp=path.join(home,'tmp');fs.mkdirSync(temp,{recursive:true});return {SystemRoot:'C:\\Windows',WINDIR:'C:\\Windows',COMSPEC:'C:\\Windows\\System32\\cmd.exe',PATH:path.dirname(node)+';C:\\Windows\\System32',TEMP:temp,TMP:temp,USERPROFILE:home,APPDATA:home,LOCALAPPDATA:home,HOME:home,NODE_PATH:'',NODE_OPTIONS:'',NPM_CONFIG_UPDATE_NOTIFIER:'false'};}
export function command(name,exe,args,{cwd=root,env=controlledEnv(path.join(cache,'env')),expected=0,timeout=120000}={}){const started=new Date().toISOString(),t=performance.now();const r=spawnSync(exe,args,{cwd,env,windowsHide:true,encoding:null,timeout,maxBuffer:64*1024*1024});write(E+'/logs/'+name+'.stdout.txt',r.stdout??Buffer.alloc(0));write(E+'/logs/'+name+'.stderr.txt',r.stderr??Buffer.alloc(0));const result={name,executable:exe,args,cwd,startedUtc:started,elapsedMs:performance.now()-t,status:r.status,signal:r.signal,error:r.error?.message??null,stdout:rec(E+'/logs/'+name+'.stdout.txt'),stderr:rec(E+'/logs/'+name+'.stderr.txt')};write(E+'/commands/'+name+'.json',result);assert.ifError(r.error);assert.equal(r.status,expected,JSON.stringify(result)+'\n'+(r.stderr??Buffer.alloc(0)).toString());return {...result,output:(r.stdout??Buffer.alloc(0)).toString()};}
export function validateTarRows(rows){const names=rows.map(r=>r.path);assert.equal(names.length,packageFiles.length,'MEMBER_COUNT');assert.equal(new Set(names.map(n=>n.toLowerCase())).size,names.length,'DUPLICATE');for(const r of rows){assert.match(r.path,/^package\/[A-Za-z0-9._-]+(?:\/[A-Za-z0-9._-]+)*$/,'UNSAFE_PATH');assert.ok(!r.path.split('/').some(s=>s==='.'||s==='..'||s.endsWith('.')||/^(con|prn|aux|nul|com[1-9]|lpt[1-9])(?:\.|$)/i.test(s)),'UNSAFE_PATH');assert.equal(r.type,'0','NONREGULAR');assert.equal(r.uid,0);assert.equal(r.gid,0);assert.equal(r.mode,420);assert.equal(r.mtime,499162500);assert.equal(r.linkName,'');}assert.deepEqual(names.map(n=>n.slice(8)).sort(),packageFiles,'ALLOWLIST');}
export function tarMembers(bytes){const tar=gunzipSync(bytes),rows=[];let o=0,sawTerminator=false;while(o+512<=tar.length){const h=tar.subarray(o,o+512);if(h.every(x=>x===0)){assert.ok(tar.subarray(o).every(x=>x===0),'TRAILING_TAR_DATA');assert.ok(tar.length-o>=1024,'TAR_TERMINATOR');assert.equal(tar.length%512,0,'TAR_ALIGNMENT');sawTerminator=true;break;}const str=(a,n)=>h.subarray(a,a+n).toString().split('\0')[0],oct=(a,n)=>parseInt(str(a,n).trim()||'0',8);let sum=0;for(let i=0;i<512;i++)sum+=i>=148&&i<156?32:h[i];assert.equal(sum,oct(148,8),'TAR_HEADER_CHECKSUM');assert.equal(str(257,5),'ustar');const size=oct(124,12),prefix=str(345,155),name=(prefix?prefix+'/':'')+str(0,100),data=tar.subarray(o+512,o+512+size);assert.equal(data.length,size);rows.push({path:name,byteLength:size,sha256:hash(data),sha1:hash(data,'sha1'),type:str(156,1)||'0',mode:oct(100,8),uid:oct(108,8),gid:oct(116,8),mtime:oct(136,12),linkName:str(157,100),data});o+=512+Math.ceil(size/512)*512;}assert.ok(sawTerminator,'TAR_TERMINATOR');validateTarRows(rows);return rows;}
export function archiveIdentity(p){const b=read(p);return {...rec(p,b),sha512:hash(b,'sha512'),integrity:'sha512-'+crypto.createHash('sha512').update(b).digest('base64')};}
export function runtimeClosure(base){
  const edges=[],fixedEdges=[],modules=packageFiles.filter(p=>p.endsWith('.mjs'));
  for(const member of modules){
    const text=fs.readFileSync(path.join(base,member),'utf8');
    const matches=[...text.matchAll(/\b(?:import\s+(?:[^'";]*?\s+from\s*)?|export\s+[^'";]*?\s+from\s*)['"]([^'"]+)['"]/gu)].map(m=>m[1]);
    const dynamics=[...text.matchAll(/\bimport\s*\(\s*(['"])([^'"]+)\1\s*\)/gu)];
    assert.equal([...text.matchAll(/\bimport\s*\(/gu)].length,dynamics.length);matches.push(...dynamics.map(m=>m[2]));assert.ok(!/\brequire\s*\(/.test(text));
    for(const specifier of matches){
      if(specifier.startsWith('node:')){assert.ok(isBuiltin(specifier));assert.ok(!/^node:(http|https|http2|net|tls|dns|dgram)(\/|$)/.test(specifier));edges.push({from:member,specifier,target:specifier,kind:'BUILTIN'});}
      else{assert.match(specifier,/^\.\.?\//);const target=path.posix.normalize(path.posix.join(path.posix.dirname(member),specifier));assert.ok(modules.includes(target));edges.push({from:member,specifier,target,kind:'PACKAGE'});}
    }
    const fixedUrls=[...text.matchAll(/\bnew URL\(\s*(['"])([^'"]+)\1\s*,\s*import\.meta\.url\s*\)/gu)].map(m=>m[2]);
    if(member==='src/runtime.mjs'){assert.deepEqual(fixedUrls,['./worker-entry.mjs']);fixedEdges.push({from:member,specifier:fixedUrls[0],target:'src/worker-entry.mjs',kind:'FIXED_WORKER_URL'});}
    if(member==='src/helper-transport.mjs'){assert.deepEqual(fixedUrls,['../helpers/windows-inspect.ps1','../']);fixedEdges.push({from:member,specifier:fixedUrls[0],target:'helpers/windows-inspect.ps1',kind:'FIXED_POWERSHELL_SCRIPT'});}
  }
  assert.deepEqual(fixedEdges.map(e=>e.kind).sort(),['FIXED_POWERSHELL_SCRIPT','FIXED_WORKER_URL']);edges.push(...fixedEdges);
  return {result:'PASS',modules:modules.map(p=>rec(p,fs.readFileSync(path.join(base,p)))),edges,builtins:[...new Set(edges.filter(e=>e.kind==='BUILTIN').map(e=>e.target))].sort(),externalProductionDependencies:0,externalPlatform:['Node 24.21.0 win-x64','Windows PowerShell 5.1'],helper:rec('helpers/windows-inspect.ps1',fs.readFileSync(path.join(base,'helpers/windows-inspect.ps1'))),limitation:'Static import and source-derived fixed worker/helper closure, plus installed-only smoke resolution; not a hostile-host sandbox or Phase 3C certification.'};
}
export function verifyRecord(row,bytes=read(row.path)){assert.equal(bytes.length,row.byteLength,row.path);assert.equal(hash(bytes),row.sha256.replace(/^sha256:/,''),row.path);return true;}
export {packageFiles,checkPackage,canonical};
