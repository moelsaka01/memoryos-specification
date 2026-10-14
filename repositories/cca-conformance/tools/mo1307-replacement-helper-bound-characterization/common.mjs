import fs from 'node:fs';
import path from 'node:path';
import assert from 'node:assert/strict';
import {spawnSync} from 'node:child_process';
import {createHash} from 'node:crypto';
import {fileURLToPath} from 'node:url';

export const root=fileURLToPath(new URL('../../../../',import.meta.url));
export const evidence='repositories/cca-conformance/evidence/mo1307/replacement-helper-bound-characterization';
export const tools='repositories/cca-conformance/tools/mo1307-replacement-helper-bound-characterization';
export const baseline='b82ecc778e3b1abdb7aa5384e01280b28a000874';
export const productionTree='6a0bf13aaf40e20b68e469989b5a34ef74cf2903';
export const helperSha='sha256:97ef5ae9ce7ab390548b04a2aefba9f922c3e1c6b9b80581c6c274f0b21f0127';
export const nodeExe='C:/Users/melsa/Documents/Codex/cca-workspace/.cache/mo1304-phase3-toolchain/node-v24.21.0-win-x64/node.exe';
export const nodeSha='sha256:ba4e6d110e8c1592a1ecd390f6b05f3da124b13871a5be62b341a07a853c6c32';
export const authorizationSource='C:/Users/melsa/.codex/attachments/208b2083-89e1-4460-b5e0-c64ccc089c5e/Pasted text.txt';
export const authorizationSha='sha256:f87842cce57b4f5f713f2cdc9a0ffb5637d6611d0ee85f0c76d5828f0bdfeed9';
export const powershellExe='C:/Windows/System32/WindowsPowerShell/v1.0/powershell.exe';
export const hash=b=>'sha256:'+createHash('sha256').update(b).digest('hex');
export const abs=p=>path.isAbsolute(p)?p:path.resolve(root,p);
export const read=p=>fs.readFileSync(abs(p));
export const json=p=>JSON.parse(read(p).toString('utf8'));
export const record=(p,b=read(p))=>({path:path.isAbsolute(p)?p:path.relative(root,abs(p)).replaceAll('\\','/'),byteLength:b.length,sha256:hash(b)});
export function check(r,b=read(r.path)){assert.equal(b.length,r.byteLength,r.path);assert.equal(hash(b),r.sha256,r.path);}
export function writeJson(p,v){const t=abs(p);fs.mkdirSync(path.dirname(t),{recursive:true});fs.writeFileSync(t,JSON.stringify(v,null,2)+'\n',{flag:'wx'});return record(p);}
export function writeBytes(p,b){const t=abs(p);fs.mkdirSync(path.dirname(t),{recursive:true});fs.writeFileSync(t,b,{flag:'wx'});return record(p,b);}
export function git(...args){const r=spawnSync('git',args,{cwd:root,env:{...process.env,GIT_OPTIONAL_LOCKS:'0'},encoding:null,windowsHide:true,timeout:120000,maxBuffer:512*1024*1024});assert.ifError(r.error);assert.equal(r.status,0,r.stderr.toString());return r.stdout;}
export const str=(...args)=>git(...args).toString('utf8').trim();
export function gitBlob(rev,p){return git('show',rev+':'+p);}
export const ns=()=>process.hrtime.bigint();
export const nsText=v=>BigInt(v).toString();
export const ms=v=>Number(BigInt(v))/1e6;
export function assertRuntime(){assert.equal(process.execPath.toLowerCase(),path.resolve(nodeExe).toLowerCase());assert.equal(process.version,'v24.21.0');assert.equal(process.platform,'win32');assert.equal(process.arch,'x64');assert.equal(hash(read(nodeExe)),nodeSha);}
export function assertAuthority(){assertRuntime();assert.equal(str('rev-parse','HEAD'),baseline);assert.equal(str('rev-parse','HEAD:repositories/memoryos-readiness'),productionTree);assert.equal(hash(read('repositories/memoryos-readiness/helpers/windows-inspect.ps1')),helperSha);assert.equal(hash(read(authorizationSource)),authorizationSha);}
export function deterministicBytes(length,label){const out=Buffer.alloc(length);let at=0,counter=0;while(at<length){const block=createHash('sha256').update(label+'\0'+counter++).digest();block.copy(out,at,0,Math.min(block.length,length-at));at+=Math.min(block.length,length-at);}return out;}
export const normalizedPath=p=>path.resolve(p).replaceAll('/','\\');
function hex(value,width){return BigInt(value).toString(16).padStart(width,'0').toLowerCase();}
export function capturePathState(p,{content=true}={}){
  p=normalizedPath(p);
  try{
    const s=fs.lstatSync(p,{bigint:true}),isLink=s.isSymbolicLink(),isFile=s.isFile(),isDirectory=s.isDirectory();
    const value={path:p,exists:true,type:isLink?'REPARSE_LINK':isFile?'FILE':isDirectory?'DIRECTORY':'OTHER',
      volumeSerial:hex(s.dev,8),fileId:hex(s.ino,16),linkCount:Number(s.nlink),byteLength:Number(s.size),
      mode:hex(s.mode,4),realPath:normalizedPath(fs.realpathSync.native(p))};
    if(isLink){value.linkTarget=fs.readlinkSync(p);value.resolvedTarget=normalizedPath(fs.realpathSync.native(p));}
    if(isFile&&content){const b=fs.readFileSync(p);value.byteLength=b.length;value.sha256=hash(b);}
    return value;
  }catch(error){if(error?.code==='ENOENT')return {path:p,exists:false};throw error;}
}
export function checkPathState(expected){assert.deepEqual(capturePathState(expected.path,{content:expected.sha256!==undefined}),expected,expected.path);}
export function captureTree(rootPath){
  rootPath=normalizedPath(rootPath);const rows=[];
  const visit=(p,relative)=>{const state=capturePathState(p);rows.push({relative,...state});if(state.exists&&state.type==='DIRECTORY')for(const name of fs.readdirSync(p).sort())visit(path.join(p,name),relative?relative+'/'+name:name);};
  visit(rootPath,'');return {root:rootPath,entries:rows};
}
export function checkTree(tree){assert.deepEqual(captureTree(tree.root),tree,tree.root);}
export function identityCore(state,{directory=false}={}){assert.equal(state.exists,true,state.path);return {volumeSerial:state.volumeSerial,fileId:state.fileId,linkCount:state.linkCount,
  byteLength:state.byteLength,attributes:null,isDirectory:directory,finalPath:state.realPath};}
export function responseIdentityCore(value){return {volumeSerial:value.volumeSerial,fileId:value.fileId,linkCount:value.linkCount,
  byteLength:value.byteLength,attributes:value.attributes,isDirectory:value.isDirectory,finalPath:normalizedPath(value.finalPath)};}
export function captureChain(target,leaf=null){
  target=normalizedPath(target);const parsed=path.win32.parse(target),rest=target.slice(parsed.root.length).split('\\').filter(Boolean);let at=parsed.root;const states=[capturePathState(at,{content:false})];
  for(const part of rest){at=path.win32.join(at,part);states.push(capturePathState(at,{content:false}));}
  if(leaf){at=path.win32.join(at,leaf);states.push(capturePathState(at));}
  for(const state of states)assert.equal(state.exists,true,state.path);return states.map((state,index)=>identityCore(state,{directory:leaf?index<states.length-1:true}));
}
export function gitObjectRecord(rev,p){const b=gitBlob(rev,p);return {commit:rev,path:p,byteLength:b.length,sha256:hash(b),blob:str('rev-parse',`${rev}:${p}`)};}
export function captureHost(){const script=`$ErrorActionPreference='Stop';$os=Get-CimInstance Win32_OperatingSystem;$cpu=Get-CimInstance Win32_Processor|Select-Object -First 1;$cs=Get-CimInstance Win32_ComputerSystem;$v=Get-CimInstance Win32_LogicalDisk -Filter "DeviceID='C:'";$p=(powercfg /getactivescheme | Out-String).Trim();[ordered]@{powershell=$PSVersionTable.PSVersion.ToString();edition=$PSVersionTable.PSEdition;is64=[Environment]::Is64BitProcess;windows=[ordered]@{caption=$os.Caption;version=$os.Version;build=$os.BuildNumber};cpu=[ordered]@{name=$cpu.Name;logical=$cpu.NumberOfLogicalProcessors;cores=$cpu.NumberOfCores};ramBytes=[int64]$cs.TotalPhysicalMemory;volume=[ordered]@{device=$v.DeviceID;filesystem=$v.FileSystem;label=$v.VolumeName;serial=$v.VolumeSerialNumber};powerScheme=$p}|ConvertTo-Json -Depth 5 -Compress`;const r=spawnSync(powershellExe,['-NoLogo','-NoProfile','-NonInteractive','-Command',script],{cwd:root,windowsHide:true,encoding:'utf8',timeout:60000,maxBuffer:1024*1024});assert.ifError(r.error);assert.equal(r.status,0,r.stderr);return JSON.parse(r.stdout.trim());}
