import fs from 'node:fs';
import path from 'node:path';
import { createHash } from 'node:crypto';
import { packageRoot, readChecked, nodePathCheck, sameFile, checkPaths } from './filesystem.mjs';
import { digest } from './contracts.mjs';
import { J } from './serialization.mjs';
import { reject } from './errors.mjs';
export const nodeDigest='sha256:ba4e6d110e8c1592a1ecd390f6b05f3da124b13871a5be62b341a07a853c6c32';
export const semanticContractDigest='sha256:d81c0b8aece4a106324131d4d356c7d0aac0e8618fac080c6b8b5e3a2381ee65';
const failure=()=>reject('RUNTIME_INTEGRITY');
export function verifyNode({launch=true}={}) {
  if(process.versions.node!=='24.21.0'||process.platform!=='win32'||process.arch!=='x64')failure();
  if(launch && (process.execArgv.length!==1 || process.execArgv[0]!=='--max-old-space-size=128'))failure();
  if(process.env.NODE_OPTIONS || process.env.NODE_PATH || process.env.NODE_INSPECT_RESUME_ON_START || process.env.NODE_REPL_EXTERNAL_MODULE)failure();
  const full=nodePathCheck(process.execPath),before=fs.lstatSync(full,{bigint:true});
  if(!before.isFile()||before.nlink!==1n||before.size!==93580104n)failure();
  const fd=fs.openSync(full,'r'),buffer=Buffer.alloc(65536),hash=createHash('sha256');let count;
  try {
    if(!sameFile(before,fs.fstatSync(fd,{bigint:true})))failure();
    while((count=fs.readSync(fd,buffer,0,buffer.length,null))>0)hash.update(buffer.subarray(0,count));
    if('sha256:'+hash.digest('hex')!==nodeDigest||!sameFile(before,fs.fstatSync(fd,{bigint:true}))||!sameFile(before,fs.lstatSync(full,{bigint:true})))failure();
  } finally {fs.closeSync(fd);}
}
function inventory(bytes,kind) {
  const value=JSON.parse(bytes);
  if(value.kind!==kind || value.version!=='1.0.0' || J(value)!==bytes.toString('utf8') || !Array.isArray(value.files) || value.files.length>256)failure();
  let prior='';const seen=new Set();
  for(const row of value.files) {
    if(Object.keys(row).sort().join(',')!=='byteLength,path,sha256'||!Number.isSafeInteger(row.byteLength)||row.byteLength<0||row.byteLength>8388608||!/^sha256:[a-f0-9]{64}$/.test(row.sha256)||!/^[A-Za-z0-9_.\/-]+$/.test(row.path)||row.path.split('/').some(p=>!p||p==='.'||p==='..')||row.path<=prior||seen.has(row.path.toLowerCase()))failure();
    seen.add(row.path.toLowerCase());prior=row.path;
  }
  return value;
}
function readDistribution(root=packageRoot) {
  const manifestBytes=readChecked(path.join(root,'distribution-manifest.json'),262144);
  const manifest=inventory(manifestBytes,'MemoryOSCICDDistributionManifest');
  if(Object.keys(manifest).sort().join(',')!=='files,kind,package,packageVersion,version'||manifest.package!=='memoryos-ci'||manifest.packageVersion!=='0.1.0')failure();
  const contents=new Map();
  for(const row of manifest.files) {
    const bytes=readChecked(path.join(root,row.path),row.byteLength);
    if(bytes.length!==row.byteLength||digest(bytes)!==row.sha256)failure();contents.set(row.path,bytes);
  }
  const expected=new Set(['distribution-manifest.json',...contents.keys()]);
  function walk(folder,prefix='') {
    for(const item of fs.readdirSync(folder,{withFileTypes:true})) {
      const name=prefix+item.name,full=path.join(folder,item.name),stat=fs.lstatSync(full);
      if(stat.isSymbolicLink())failure();
      if(stat.isDirectory()) {if(![...expected].some(p=>p.startsWith(name+'/')))failure();walk(full,name+'/');}
      else if(!stat.isFile()||stat.nlink!==1||!expected.delete(name))failure();
    }
  }
  walk(root);if(expected.size)failure();
  const contractBytes=contents.get('contracts/contract.json');
  const contract=inventory(contractBytes,'MemoryOSCICDContract');
  if(Object.keys(contract).sort().join(',')!=='files,id,kind,version'||contract.id!=='memoryos.cicd')failure();
  const contractPaths=[...contents.keys()].filter(p=>p.startsWith('schemas/')||p.startsWith('templates/')||p.startsWith('contracts/')&&p!=='contracts/contract.json').sort();
  if(J(contract.files.map(r=>r.path))!==J(contractPaths))failure();
  for(const row of contract.files)if(!contents.has(row.path)||contents.get(row.path).length!==row.byteLength||digest(contents.get(row.path))!==row.sha256)failure();
  const closureBytes=contents.get('runtime/runtime-closure-manifest.json'),closure=JSON.parse(closureBytes);
  if(closure.kind!=='MemoryOSCICDRuntimeClosureManifest'||closure.version!=='1.0.0'||closure.files.length!==25)failure();
  for(const row of closure.files)if(!contents.has('runtime/'+row.path)||contents.get('runtime/'+row.path).length!==row.byteLength||digest(contents.get('runtime/'+row.path))!=='sha256:'+row.sha256)failure();
  if(digest(contents.get('contracts/policy-contract-identities-1.0.0.json'))!==semanticContractDigest)failure();
  const closureRows=entries=>entries.map(p=>manifest.files.find(row=>row.path===p));
  function moduleClosure(entry,seen=new Set()) {
    if(seen.has(entry))return seen;
    const data=contents.get(entry);if(!data)failure();seen.add(entry);
    for(const match of data.toString('utf8').matchAll(/(?:from\s*|import\s*)['"]([^'"]+)['"]/g)) {
      if(match[1].startsWith('node:'))continue;
      if(!match[1].startsWith('.'))failure();
      const dep=path.posix.normalize(path.posix.join(path.posix.dirname(entry),match[1]));moduleClosure(dep,seen);
    }
    return seen;
  }
  const adapterPaths=[...moduleClosure('src/providers/generic.mjs')].sort();
  const generatorPaths=[...moduleClosure('src/generator.mjs')].sort();
  const identities={contractDigest:digest(contractBytes),limitsDigest:digest(contents.get('contracts/limits.json')),distributionDigest:digest(manifestBytes),adapterDigest:digest(J(closureRows(adapterPaths))),runtimeClosureDigest:digest(closureBytes),nodeDigest};
  return {manifest,identities,generatorDigest:digest(J(closureRows(generatorPaths))),contents};
}
export function verifyDistribution(root=packageRoot) {
  try { return readDistribution(root); }
  catch { failure(); } // Every trusted installation defect maps to integrity exit 15.
}
export async function verifyInstallation(options) {
  verifyNode();
  const verified=verifyDistribution();
  await checkPaths([{path:process.execPath,allowMissingLeaf:false},{path:packageRoot,allowMissingLeaf:false},...verified.manifest.files.map(row=>({path:path.join(packageRoot,row.path),allowMissingLeaf:false}))],options);
  return verified;
}
