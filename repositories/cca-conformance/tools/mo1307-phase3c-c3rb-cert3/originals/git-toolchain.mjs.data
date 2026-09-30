import fs from 'node:fs';
import path from 'node:path';
import {createHash} from 'node:crypto';
import {spawnSync} from 'node:child_process';
import {fileURLToPath} from 'node:url';
const sha=b=>'sha256:'+createHash('sha256').update(b).digest('hex');
const manifestPath=fileURLToPath(new URL('./engineering-toolchain.json',import.meta.url));
function failure(code,detail){const e=new Error(code+': '+detail);e.code=code;throw e;}
export function validateIdentity(record){
 if(!record||!path.isAbsolute(record.absolute))failure('ENGINEERING_GIT_PATH','absolute path required');
 let s,b;try{s=fs.lstatSync(record.absolute);if(!s.isFile()||s.isSymbolicLink())failure('ENGINEERING_GIT_FILE','ordinary file required');b=fs.readFileSync(record.absolute)}catch(e){if(e.code?.startsWith('ENGINEERING_'))throw e;failure('ENGINEERING_GIT_MISSING',e.code??'unreadable')}
 if(b.length!==record.byteLength||sha(b)!==record.sha256)failure('ENGINEERING_GIT_IDENTITY','length or SHA256 mismatch');
 return {absolute:record.absolute,byteLength:b.length,sha256:sha(b)};
}
export function gitExecute(args,options={},manifest=JSON.parse(fs.readFileSync(manifestPath))){
 const before=validateIdentity(manifest.git);if(manifest.core)validateIdentity(manifest.core);
 const r=spawnSync(before.absolute,args,{...options,shell:false,windowsHide:true,timeout:options.timeout??60000,maxBuffer:options.maxBuffer??128*1024*1024,env:{SystemRoot:'C:\\Windows',WINDIR:'C:\\Windows'}});
 if(r.error)failure('ENGINEERING_GIT_EXECUTION',r.error.code??r.error.message);
 if(r.signal||r.status!==0)failure('ENGINEERING_GIT_EXIT',String(r.status)+' '+String(r.signal));
 validateIdentity(manifest.git);if(manifest.core)validateIdentity(manifest.core);
 return r.stdout;
}
export function validateToolchain(manifest=JSON.parse(fs.readFileSync(manifestPath))){
 const identity=validateIdentity(manifest.git);const version=gitExecute(['--version'],{encoding:'utf8',timeout:10000,maxBuffer:16384},manifest).trim();
 if(version!==manifest.git.version)failure('ENGINEERING_GIT_VERSION','unexpected version');
 return {result:'PASS_ENGINEERING_ONLY',identity,version,ambientPathFallback:false};
}
if(process.argv[2]==='--validate-only'){
 try{const m=process.argv[3]?JSON.parse(fs.readFileSync(process.argv[3])):undefined;console.log(JSON.stringify(validateToolchain(m)));}
 catch(e){console.error(JSON.stringify({result:'REFUSED_ENGINEERING_TOOLCHAIN',code:e.code??e.name,message:e.message,ambientPathFallback:false}));process.exitCode=1;}
}
