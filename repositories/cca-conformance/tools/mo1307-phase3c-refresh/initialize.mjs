import fs from 'node:fs';
import path from 'node:path';
import assert from 'node:assert/strict';
import {spawnSync} from 'node:child_process';
import {createHash} from 'node:crypto';
const root=process.cwd(),old='C:/Users/melsa/Documents/Codex/cca-mo1307-3c',ev='repositories/cca-conformance/evidence/mo1307/phase3c-refresh';
const hash=b=>'sha256:'+createHash('sha256').update(b).digest('hex');
function git(cwd,...args){const r=spawnSync('git',args,{cwd,encoding:'utf8',maxBuffer:32*1024*1024,windowsHide:true});assert.equal(r.status,0,r.stderr);return r.stdout;}
function state(cwd){return {head:git(cwd,'rev-parse','HEAD').trim(),branch:git(cwd,'branch','--show-current').trim(),status:git(cwd,'status','--porcelain=v1','--untracked-files=all'),tree:git(cwd,'rev-parse','HEAD^{tree}').trim(),parents:git(cwd,'show','-s','--format=%P','HEAD').trim().split(' ')};}
assert.equal(path.resolve(root).toLowerCase(),'c:\\users\\melsa\\documents\\codex\\r3c');
const current=state(root),historical=state(old);assert.equal(current.head,'defe93989efc6501b1a730b82e79e705884b269b');assert.equal(current.branch,'codex/mo1307-phase3c-refresh');assert.equal(historical.head,'191f34748141afca2027e8e9db0c6f1b6a9c84c0');assert.equal(historical.status,'');
function inventory(cwd){return git(cwd,'ls-files','-z','--cached','--others','--exclude-standard').split('\0').filter(Boolean).sort().filter(p=>!p.includes('phase3c-refresh')).map(p=>{const full=path.join(cwd,p),s=fs.lstatSync(full);assert.ok(s.isFile(),p);const b=fs.readFileSync(full);return{path:p,byteLength:b.length,sha256:hash(b)};});}
fs.mkdirSync(ev,{recursive:true});const baseline={kind:'MO1307Phase3CRefreshBaseline',startedAt:'2026-09-29T13:16:00.000Z',capturedAt:new Date().toISOString(),workspace:root,C3RB:current,original3C:{workspace:old,...historical},initialGitStatusObservedClean:true,initialStatusEvidence:'Root tool read git status before any writes returned empty for both worktrees.',scope:'Targeted security refresh only; no production modification, runtime certification, package certification, push or tag.',runtime:{node:process.version,nodePath:process.execPath,nodeSha256:hash(fs.readFileSync(process.execPath))},currentInventory:inventory(root),originalInventory:inventory(old)};
fs.writeFileSync(ev+'/baseline.json',JSON.stringify(baseline,null,2)+'\n',{flag:'wx'});console.log(JSON.stringify({result:'PASS',currentFiles:baseline.currentInventory.length,originalFiles:baseline.originalInventory.length,C3RB:current.head,original3C:historical.head}));
