import fs from 'node:fs';import path from 'node:path';import assert from 'node:assert/strict';import {spawn} from 'node:child_process';import {performance} from 'node:perf_hooks';
import {packageRoot,checkPaths,nodePathCheck,readChecked,childEnvironment} from '../../../memoryos-ci/src/filesystem.mjs';
import {verifyDistribution,verifyNode} from '../../../memoryos-ci/src/integrity.mjs';
import {verifyBundle} from '../../../memoryos-ci/src/verification.mjs';
import {J} from '../../../memoryos-ci/src/serialization.mjs';
import {digest} from '../../../memoryos-ci/src/contracts.mjs';
const [work,sourceBundle]=process.argv.slice(2),cases=[];
fs.mkdirSync(work);
async function check(id,fn){const start=performance.now();try{await fn();cases.push({id,status:'PASS',elapsedMs:Math.round(performance.now()-start)});}catch(e){cases.push({id,status:'FAIL',reason:e.message});throw e;}finally{process.stdout.write(JSON.stringify(cases.at(-1))+'\n');}}
const options={deadline:performance.now()+60000};
await check('hardlink-rejected',()=>{
 const a=path.join(work,'a'),b=path.join(work,'b');fs.writeFileSync(a,'data');fs.linkSync(a,b);assert.throws(()=>readChecked(a,20),e=>e.code==='MO1306_FILESYSTEM_BOUNDARY');
});
await check('junction-rejected',async()=>{
 const dir=path.join(work,'real');fs.mkdirSync(dir);const link=path.join(work,'junction');fs.symlinkSync(dir,link,'junction');
 assert.throws(()=>nodePathCheck(link),e=>e.code==='MO1306_FILESYSTEM_BOUNDARY');
 await assert.rejects(checkPaths([{path:link,allowMissingLeaf:false}],options),e=>e.code==='MO1306_FILESYSTEM_BOUNDARY');
});
await check('file-symlink-or-host-restriction',async()=>{
 const link=path.join(work,'file-link');
 try{fs.symlinkSync(path.join(work,'a'),link,'file');}
 catch(e){if(e.code==='EPERM'){cases.push({id:'file-symlink-creation',status:'NOT_AVAILABLE',reason:'Host does not grant symlink privilege; real junction exercises ReparsePoint rejection'});return;}throw e;}
 assert.throws(()=>readChecked(link,20),e=>e.code==='MO1306_FILESYSTEM_BOUNDARY');
});
const installation=verifyDistribution();
function repairBundle(dir){
 const manifest=JSON.parse(fs.readFileSync(path.join(dir,'memoryos-ci-artifacts.json')));
 for(const row of manifest.files){const b=fs.readFileSync(path.join(dir,row.path));row.byteLength=b.length;row.sha256=digest(b);}
 const bytes=J(manifest);fs.writeFileSync(path.join(dir,'memoryos-ci-artifacts.json'),bytes);
 const marker=JSON.parse(fs.readFileSync(path.join(dir,'memoryos-ci-complete.json')));marker.manifestSha256=digest(bytes);fs.writeFileSync(path.join(dir,'memoryos-ci-complete.json'),J(marker));
}
for(const [name,file,mutate,repair] of [
 ['result-projection','memoryos-ci-result.json',v=>v.process.exitCode=6,true],
 ['evidence-contract','memoryos-ci-evidence.json',v=>v.contract.sha256='sha256:'+'0'.repeat(64),true],
 ['evidence-unknown','memoryos-ci-evidence.json',v=>v.unknown=true,true],
 ['result-unknown-error','memoryos-ci-result.json',v=>{v.classification='CONFIG_ERROR';v.semantic=null;v.error={code:'MO1306_UNKNOWN',stage:'configuration',semanticCode:null};},true],
 ['identity-tamper','evaluation-identity.json',v=>v.unknown=true,true],
 ['marker-binding','memoryos-ci-complete.json',v=>v.manifestSha256='sha256:'+'0'.repeat(64),false]
]){
 await check(name,async()=>{
  const parent=path.join(work,name);fs.mkdirSync(parent);const dir=path.join(parent,path.basename(sourceBundle));fs.cpSync(sourceBundle,dir,{recursive:true,errorOnExist:true});
  const p=path.join(dir,file),v=JSON.parse(fs.readFileSync(p));mutate(v);fs.writeFileSync(p,J(v));if(repair)repairBundle(dir);
  await assert.rejects(verifyBundle(dir,installation,options));
 });
}
await check('distribution-source-substitution',()=>{
 const copy=path.join(work,'package-copy');fs.cpSync(packageRoot,copy,{recursive:true,errorOnExist:true});
 fs.appendFileSync(path.join(copy,'runtime/authoritative/web/js/memoryos-sdk.js'),'\n// substitute\n');
 assert.throws(()=>verifyDistribution(copy),e=>e.code==='MO1306_RUNTIME_INTEGRITY');
});
await check('actual-child-environment',async()=>{
 const actual=await new Promise((resolve,reject)=>{
  const child=spawn(process.execPath,['-e','console.log(JSON.stringify(Object.keys(process.env).sort()))'],{shell:false,windowsHide:true,env:childEnvironment(),stdio:['ignore','pipe','pipe']});
  let out='',err='';child.stdout.on('data',b=>out+=b);child.stderr.on('data',b=>err+=b);child.on('error',reject);child.on('close',code=>code===0?resolve(JSON.parse(out)):reject(new Error(err)));
 });assert.deepEqual(actual,['SystemRoot','WINDIR']);
});
fs.writeFileSync(path.join(work,'cases.json'),J(cases));
