import assert from 'node:assert/strict';
import { readFile,writeFile,mkdir,mkdtemp,chmod } from 'node:fs/promises';
import { resolve,dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import { execFileSync } from 'node:child_process';
import { crc32,inflateRawSync } from 'node:zlib';
import { PACKAGE_ROOT,safeMember,regularBytes,exactFiles,sha256,verifyRuntime,verifyDependencies } from '../src/integrity.mjs';
import { J } from '../src/deterministic.mjs';
import { verifyFoundation } from './inventory.mjs';
export const MANIFEST='distribution/distribution-manifest.json';
export const ARCHIVE='memoryos-mcp-0.1.0.tgz';
export const RECEIPT=resolve(PACKAGE_ROOT,'measurements/phase2-package-receipt.json');
const workspace=resolve(PACKAGE_ROOT,'../..');
const MAX_BYTES=64*1024*1024,MAX_FILES=20000;
const identity=(bytes)=>({byteLength:bytes.length,sha256:sha256(bytes)});
const same=(a,b)=>assert.equal(J(a),J(b));
function string(bytes){const at=bytes.indexOf(0);if(at>=0){assert.ok(bytes.subarray(at).every(x=>x===0));bytes=bytes.subarray(0,at);}assert.ok(bytes.every(x=>x<128));return bytes.toString('ascii');}
function octal(bytes){const value=bytes.toString('ascii').replace(/[\0 ]+$/u,'').replace(/^ +/u,'');assert.match(value,/^[0-7]+$/u);const result=parseInt(value,8);assert.ok(Number.isSafeInteger(result));return result;}
/** Validate gzip and every tar member before writing a single extracted byte. */
export function archiveMembers(bytes) {
 assert.ok(Buffer.isBuffer(bytes)&&bytes.length>18&&bytes.length<=MAX_BYTES);
 assert.equal(bytes.readUInt16LE(0),0x8b1f);assert.equal(bytes[2],8);assert.equal(bytes[3],0);
 const inflated=inflateRawSync(bytes.subarray(10),{info:true,maxOutputLength:MAX_BYTES});
 const tar=inflated.buffer,footer=10+inflated.engine.bytesWritten;
 assert.equal(footer+8,bytes.length,'trailing/concatenated gzip data');
 assert.equal(bytes.readUInt32LE(footer),crc32(tar));assert.equal(bytes.readUInt32LE(footer+4),tar.length);
 assert.equal(tar.length%512,0);
 const members=new Map(),folded=new Set();let offset=0,ended=false;
 while(offset+512<=tar.length){
  const header=tar.subarray(offset,offset+512);offset+=512;
  if(header.every(x=>x===0)){assert.ok(offset+512<=tar.length);assert.ok(tar.subarray(offset).every(x=>x===0));ended=true;break;}
  let checksum=0;for(let i=0;i<512;i++)checksum+=i>=148&&i<156?32:header[i];assert.equal(octal(header.subarray(148,156)),checksum);
  assert.equal(string(header.subarray(257,263)),'ustar');
  const prefix=string(header.subarray(345,500));const name=(prefix?prefix+'/':'')+string(header.subarray(0,100));
  safeMember(name);assert.ok(name.startsWith('package/'));const path=safeMember(name.slice(8));
  assert.ok(!folded.has(path.toLowerCase()),'duplicate/case collision');folded.add(path.toLowerCase());
  assert.ok(members.size<MAX_FILES);assert.ok(header[156]===0||header[156]===48,'non-regular tar member');
  assert.equal(string(header.subarray(157,257)),'','tar link target');
  const mode=octal(header.subarray(100,108));assert.ok(mode===0o644||mode===0o755,'unexpected mode');
  const size=octal(header.subarray(124,136));assert.ok(size<=16*1024*1024&&offset+size<=tar.length);
  const content=tar.subarray(offset,offset+size);const padded=Math.ceil(size/512)*512;
  assert.ok(tar.subarray(offset+size,offset+padded).every(x=>x===0),'nonzero padding');offset+=padded;
  members.set(path,{path,mode,bytes:content});
 }
 assert.ok(ended,'missing archive terminator');return members;
}
function validateManifest(bytes) {
 const manifest=JSON.parse(bytes);assert.equal(bytes.toString(),J(manifest)+'\n');
 assert.equal(manifest.kind,'MemoryOSMCPDistributionManifest');assert.equal(manifest.version,'1.0.0');
 assert.equal(manifest.packageName,'memoryos-mcp');assert.equal(manifest.packageVersion,'0.1.0');assert.equal(manifest.selfExcluded,MANIFEST);
 assert.ok(Array.isArray(manifest.files)&&manifest.files.length>0&&manifest.files.length<MAX_FILES);
 const names=manifest.files.map(x=>safeMember(x.path));same(names,[...new Set(names)].sort());assert.ok(!names.includes(MANIFEST));
 assert.equal(new Set(names.map(x=>x.toLowerCase())).size,names.length);
 for(const entry of manifest.files){same(Object.keys(entry).sort(),['byteLength','path','sha256']);assert.ok(Number.isSafeInteger(entry.byteLength)&&entry.byteLength>=0&&entry.byteLength<=16*1024*1024);assert.match(entry.sha256,/^[a-f0-9]{64}$/u);}
 return manifest;
}
function productChecks(get) {
 const pkg=JSON.parse(get('package.json'));assert.equal(pkg.name,'memoryos-mcp');assert.equal(pkg.version,'0.1.0');assert.equal(pkg.private,true);
 same(pkg.bin,{'memoryos-mcp':'bin/memoryos-mcp.mjs'});assert.equal(pkg.engines.node,'24.21.0');
 same(pkg.dependencies,{'@modelcontextprotocol/core':'2.0.0','@modelcontextprotocol/server':'2.0.0',zod:'4.6.5'});
 for(const hook of ['preinstall','install','postinstall','prepare'])assert.equal(pkg.scripts?.[hook],undefined);
 for(const file of ['LICENSE','NOTICE.md','THIRD_PARTY_NOTICES.txt'])assert.ok(get(file).length>0);
 const deps=JSON.parse(get('distribution/dependency-closure.json'));
 assert.equal(deps.packages.length,3);assert.ok(!deps.packages.some(x=>x.name==='@modelcontextprotocol/client'));
 for(const item of deps.files)same(identity(get(item.path)),{byteLength:item.byteLength,sha256:item.sha256});
 const runtime=JSON.parse(get('runtime/runtime-closure-manifest.json'));assert.equal(runtime.files.length,25);
 for(const item of runtime.files)same(identity(get('runtime/'+item.path)),{byteLength:item.byteLength,sha256:item.sha256});
 assert.equal(sha256(get('distribution/dependency-lock.json')),'bc5fe0dbbad8cd46f3562420c39b721fde59500294c3f55fd39f585a733181df');
 assert.equal(sha256(get('contracts/policy-contract-identities-1.0.0.json')),'d81c0b8aece4a106324131d4d356c7d0aac0e8618fac080c6b8b5e3a2381ee65');
 const limits=JSON.parse(get('contracts/limits.json'));assert.equal(limits.status,'measured');
 return {dependencies:3,runtimeFiles:25};
}
export function verifyArchive(bytes,receipt) {
 same(identity(bytes),receipt.archive);assert.equal(receipt.archiveFilename,ARCHIVE);
 assert.equal(receipt.packageName,'memoryos-mcp');assert.equal(receipt.packageVersion,'0.1.0');
 const members=archiveMembers(bytes),manifestBytes=members.get(MANIFEST)?.bytes;assert.ok(manifestBytes);
 same(identity(manifestBytes),receipt.distributionManifest);const manifest=validateManifest(manifestBytes);
 same([...members.keys()].sort(),[...manifest.files.map(x=>x.path),MANIFEST].sort());
 for(const item of manifest.files)same(identity(members.get(item.path).bytes),{byteLength:item.byteLength,sha256:item.sha256});
 // Supported launch uses absolute Node, not an executable-bit-dependent shell shim.
 const summary=productChecks(path=>{const value=members.get(path);assert.ok(value,path);return value.bytes;});
 return {members,manifest,summary:{...summary,files:members.size,archiveSha256:sha256(bytes)}};
}
export async function verifyInstalled(root,receipt) {
 const manifestBytes=await regularBytes(root,MANIFEST);same(identity(manifestBytes),receipt.distributionManifest);const manifest=validateManifest(manifestBytes);
 same(await exactFiles(root),[...manifest.files.map(x=>x.path),MANIFEST].sort());
 const files=new Map();for(const item of manifest.files){const bytes=await regularBytes(root,item.path);same(identity(bytes),{byteLength:item.byteLength,sha256:item.sha256});files.set(item.path,bytes);}
 const summary=productChecks(path=>{assert.ok(files.has(path),path);return files.get(path);});return {...summary,files:manifest.files.length+1};
}
export async function buildPackage() {
 assert.equal(process.versions.node,'24.21.0');await verifyRuntime();const deps=await verifyDependencies();
 // The reviewed source inventory is the allowlist; unexpected source files fail verification.
 const foundation=await verifyFoundation();
 const members=foundation.files.map(x=>x.path).filter(x=>x!=='package-lock.json');
 members.push(...deps.files.map(x=>x.path));members.sort();same(members,[...new Set(members)].sort());
 const files=[],contents=new Map();for(const path of members){const bytes=await regularBytes(PACKAGE_ROOT,path);files.push({path,...identity(bytes)});contents.set(path,bytes);}
 const manifest={kind:'MemoryOSMCPDistributionManifest',version:'1.0.0',packageName:'memoryos-mcp',packageVersion:'0.1.0',selfExcluded:MANIFEST,files};
 const manifestBytes=Buffer.from(J(manifest)+'\n');contents.set(MANIFEST,manifestBytes);
 const cache=resolve(workspace,'.cache/mo1304-phase2');await mkdir(cache,{recursive:true});
 const assemble=async()=>{const destination=await mkdtemp(resolve(cache,'stage-'));for(const [path,bytes] of contents){const target=resolve(destination,path);await mkdir(dirname(target),{recursive:true});await writeFile(target,bytes);await chmod(target,path==='bin/memoryos-mcp.mjs'?0o755:0o644);}return destination;};
 const stage=await assemble();
 const out=resolve(PACKAGE_ROOT,'out/phase2');await mkdir(out,{recursive:true});
 const npm=resolve(dirname(process.execPath),'node_modules/npm/bin/npm-cli.js');
 const env={...process.env,NO_COLOR:'1',TZ:'UTC'};delete env.NODE_OPTIONS;delete env.NODE_PATH;
 assert.equal(execFileSync(process.execPath,[npm,'--version'],{env,windowsHide:true,encoding:'utf8'}).trim(),'11.19.0');
 const command=['pack','--ignore-scripts','--offline','--json','--loglevel=error','--cache',resolve(workspace,'.cache/mo1304-npm'),'--pack-destination',out];
 execFileSync(process.execPath,[npm,...command],{cwd:stage,env,windowsHide:true,stdio:'pipe'});
 const first=await readFile(resolve(out,ARCHIVE));
 const secondStage=await assemble();
 execFileSync(process.execPath,[npm,...command],{cwd:secondStage,env,windowsHide:true,stdio:'pipe'});
 const second=await readFile(resolve(out,ARCHIVE));assert.ok(first.equals(second),'non-deterministic npm archive');
 const record=path=>({path,...identity(contents.get(path))});
 const receipt={kind:'MemoryOSMCPPhase2PackageReceipt',version:'1.0.0',packageName:'memoryos-mcp',packageVersion:'0.1.0',archiveFilename:ARCHIVE,archive:identity(first),distributionManifest:identity(manifestBytes),runtimeManifest:record('runtime/runtime-closure-manifest.json'),dependencyLock:record('distribution/dependency-lock.json'),dependencyClosure:record('distribution/dependency-closure.json'),contractPin:record('contracts/policy-contract-identities-1.0.0.json'),limits:record('contracts/limits.json'),node:'24.21.0',npm:'11.19.0',protocol:'2026-07-28',identicalAssemblyRuns:2,archiveFileCount:files.length+1,platformCertification:'PENDING_PHASE3',license:'Private local artifact; root licensing decision notice preserved, no new grant'};
 const verified=verifyArchive(first,receipt);await writeFile(RECEIPT,J(receipt)+'\n');await writeFile(resolve(out,'distribution-manifest.json'),manifestBytes);
 return {...verified.summary,stage,archive:resolve(out,ARCHIVE),receipt:RECEIPT};
}
if(process.argv[1]&&resolve(process.argv[1])===fileURLToPath(import.meta.url))process.stdout.write(J(await buildPackage())+'\n');
