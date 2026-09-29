// Mechanical package metadata regeneration; no package/contract version changes.
import fs from 'node:fs';
import path from 'node:path';
import assert from 'node:assert/strict';
import {spawnSync} from 'node:child_process';
import {performance} from 'node:perf_hooks';
import {root,evidence,hash,record,check,write} from './common.mjs';
import {packageFiles,checkPackage} from '../mo1307-phase1/package.mjs';
assert.equal(process.version,'v24.21.0');assert.equal(hash(fs.readFileSync(process.execPath)),'sha256:ba4e6d110e8c1592a1ecd390f6b05f3da124b13871a5be62b341a07a853c6c32');
assert.deepEqual(process.argv.slice(2,3),['--pass']);assert.equal(process.argv.length,4);assert.ok(['1','2'].includes(process.argv[3]));
const pass=Number(process.argv[3]),output=evidence+'/package/pass-'+pass;assert.equal(fs.existsSync(path.join(root,output)),false);fs.mkdirSync(path.join(root,output),{recursive:true});
const product='repositories/memoryos-readiness/',generated=['contracts/contract.json','sbom.spdx.json','distribution-manifest.json'];
const sourceBindings=packageFiles.filter(p=>!generated.includes(p)).map(p=>record(product+p));sourceBindings.push(record('repositories/cca-conformance/tools/mo1307-phase1/package.mjs'),record('repositories/cca-conformance/tools/mo1307-phase3a-readset-correction/package-refresh.mjs'));
const before=generated.map(p=>record(product+p));const started=performance.now(),child=spawnSync(process.execPath,['repositories/cca-conformance/tools/mo1307-phase1/package.mjs','build'],{cwd:root,windowsHide:true,encoding:null,timeout:30000,maxBuffer:1024*1024});
for(const [n,b] of [['stdout.txt',child.stdout??Buffer.alloc(0)],['stderr.txt',child.stderr??Buffer.alloc(0)]])fs.writeFileSync(path.join(root,output,n),b,{flag:'wx'});
let result='PASS',failure=null,packageCheck=null;try{assert.ifError(child.error);assert.equal(child.status,0);for(const b of sourceBindings)check(b);packageCheck=checkPackage();assert.equal(packageCheck.members,89);assert.equal(packageCheck.contractMembers,53);assert.equal(packageCheck.externalProductionDependencies,0);}catch(error){result='FAIL';failure={code:error.code??null,message:error.message,stack:error.stack};}
const snapshots=generated.map(p=>{const bytes=fs.readFileSync(path.join(root,product+p)),name=output+'/'+p.replaceAll('/','_')+'.data';fs.writeFileSync(path.join(root,name),bytes,{flag:'wx'});return {generated:record(product+p),snapshot:record(name)};});
write(output+'/receipt.json',{kind:'MO1307ReadSetPackageRefresh',result,failure,pass,elapsedMs:performance.now()-started,command:{exit:child.status,error:child.error?.code??null,stdout:record(output+'/stdout.txt'),stderr:record(output+'/stderr.txt')},sourceBindings,before,generatedSnapshots:snapshots,after:packageFiles.map(p=>record(product+p)),packageCheck,packageVersion:'0.1.0',contractVersion:'1.0.0',helper:record(product+'helpers/windows-inspect.ps1'),archiveCertification:false});
console.log(JSON.stringify({result,pass,packageCheck,helper:record(product+'helpers/windows-inspect.ps1'),failure}));process.exitCode=result==='PASS'?0:1;