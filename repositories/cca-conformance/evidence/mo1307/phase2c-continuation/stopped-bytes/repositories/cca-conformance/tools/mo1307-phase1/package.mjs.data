// Engineering-only deterministic package metadata, never an archive certification.
import fs from 'node:fs';
import path from 'node:path';
import crypto from 'node:crypto';
import { fileURLToPath } from 'node:url';
import { isBuiltin } from 'node:module';

export const defaultRoot=fileURLToPath(new URL('../../../memoryos-readiness/',import.meta.url));
const schemaNames=['assessment','assumption','audit','authority','authority-source','blocker','candidate','claim','cne-reason','code','component','configuration','contract-manifest','decision-projection','dependency','derived-qualification','digest','distribution-manifest','error','evidence','file-member','gate-definition','gate-result','grant','graph','history','history-projection','human-decision','id','identity','integer','manifest','manifest-entry','normalized-authority','normalized-authority-source','normalized-grant','normalized-slot','product-version','proof-binding','provider-detail','qualification','relative-file','result','revision','semantic-contract','shared','slot','string','summary','tag-name','tag-observation','timestamp'];
const sourceNames=['acquisition','api-input','cli','helper-transport','integration','output','runtime','worker-entry','worker-policy','canonical','cli-args','constants','errors','foundation','helper-protocol','index','projections','publication','schema-data','schema','windows-paths'];
export const packageFiles=Object.freeze([
  'LICENSE-NOTICE.md','NOTICES.md','README.md','bin/memoryos-readiness.mjs',
  'contracts/contract.json','contracts/definitions.json','distribution-manifest.json',
  'helpers/README.md','helpers/windows-inspect.ps1','package.json','sbom.spdx.json',
  ...schemaNames.map(n=>`schemas/${n}-1.0.0.schema.json`),...sourceNames.map(n=>`src/${n}.mjs`),
].sort());
const generatedFiles=new Set(['contracts/contract.json','sbom.spdx.json','distribution-manifest.json']);
const contractFiles=packageFiles.filter(p=>p.startsWith('schemas/')||p==='contracts/definitions.json');
export const packageMetadata=Object.freeze({
  name:'memoryos-readiness',version:'0.1.0',private:true,type:'module',
  description:'Offline MemoryOS release-readiness operations; semantic integration pending',
  license:'UNLICENSED',engines:{node:'24.21.0'},packageManager:'npm@11.19.0',
  bin:{'memoryos-readiness':'bin/memoryos-readiness.mjs'},exports:{'.':'./src/index.mjs'},
  files:packageFiles,dependencies:{},
});
export function canonical(value) {
  return value===null||typeof value!=='object'?JSON.stringify(value):Array.isArray(value)?'['+value.map(canonical).join(',')+']':'{'+Object.keys(value).sort().map(k=>JSON.stringify(k)+':'+canonical(value[k])).join(',')+'}';
}
const bytes=value=>Buffer.from(canonical(value)+'\n');
const sha=(data,algorithm='sha256')=>crypto.createHash(algorithm).update(data).digest('hex');
function reject(reason){throw new Error(`MO1307_PACKAGE_${reason}`);}
const read=(root,member)=>fs.readFileSync(path.join(root,member));
const json=(root,member)=>{
  const raw=read(root,member);let data;try{data=JSON.parse(raw.toString('utf8'));}catch{reject('JSON');}
  if(!raw.equals(bytes(data)))reject('NONCANONICAL_JSON');return data;
};
function walk(root,relative=''){
  const rows=[];
  for(const name of fs.readdirSync(path.join(root,relative)).sort()){
    const member=relative?relative+'/'+name:name;
    const stat=fs.lstatSync(path.join(root,member));
    if(stat.isSymbolicLink())reject('LINK');
    if(stat.isDirectory())rows.push(...walk(root,member));
    else if(stat.isFile()){if(stat.nlink!==1)reject('HARDLINK');rows.push(member);}
    else reject('NONREGULAR_MEMBER');
  }
  return rows.sort();
}
function same(a,b){return canonical(a)===canonical(b);}
function checkPath(member){
  if(typeof member!=='string'||member.length<1||member.length>180||!/^[A-Za-z0-9._-]+(?:\/[A-Za-z0-9._-]+)*$/u.test(member))reject('PATH');
  if(member.split('/').some(s=>s==='.'||s==='..'||s.endsWith('.')||/^(?:con|prn|aux|nul|com[1-9]|lpt[1-9])(?:\.|$)/iu.test(s)))reject('PATH');
}
function checkLocalRefs(value){
  if(!value||typeof value!=='object')return;
  if(typeof value.$ref==='string'){
    const file=value.$ref.split('#')[0];
    if(file && !schemaNames.some(n=>file===`${n}-1.0.0.schema.json`))reject('SCHEMA_REFERENCE');
  }
  for(const child of Object.values(value))checkLocalRefs(child);
}
function checkImports(root){
  const forbidden=/^node:(?:http|https|http2|net|tls|dns|dgram)(?:\/|$)/u;
  for(const member of packageFiles.filter(p=>p.endsWith('.mjs'))){
    const text=read(root,member).toString('utf8'),imports=[];
    const staticPattern=/\b(?:import\s+(?:[^'";]*?\s+from\s*)?|export\s+[^'";]*?\s+from\s*)['"]([^'"]+)['"]/gu;
    for(const match of text.matchAll(staticPattern))imports.push(match[1]);
    const dynamicPattern=/\bimport\s*\(\s*(['"])([^'"]+)\1\s*\)/gu;
    for(const match of text.matchAll(dynamicPattern))imports.push(match[2]);
    if([...text.matchAll(/\bimport\s*\(/gu)].length!==[...text.matchAll(dynamicPattern)].length)reject('DYNAMIC_IMPORT');
    for(const specifier of imports){
      if(specifier.startsWith('node:')){if(!isBuiltin(specifier)||forbidden.test(specifier))reject('NETWORK_OR_UNKNOWN_BUILTIN');continue;}
      if(!specifier.startsWith('./')&&!specifier.startsWith('../'))reject('EXTERNAL_IMPORT');
      if(specifier.includes('\\')||specifier.includes('?')||specifier.includes('#'))reject('IMPORT_PATH');
      const target=path.posix.normalize(path.posix.join(path.posix.dirname(member),specifier));
      if(!packageFiles.includes(target)||!target.endsWith('.mjs'))reject('IMPORT_CLOSURE');
    }
  }
}
export function checkGeneratedData(root=defaultRoot){
  const definitions=json(root,'contracts/definitions.json');
  const schemas=Object.fromEntries(schemaNames.map(n=>`${n}-1.0.0.schema.json`).sort().map(n=>[n,json(root,`schemas/${n}`)]));
  for(const schema of Object.values(schemas))checkLocalRefs(schema);
  const freeze='function freeze(x){if(x && typeof x==="object"){for(const v of Object.values(x))freeze(v);Object.freeze(x);}return x;}\n';
  const expectedConstants='// Generated from contracts/definitions.json; regenerate with conformance tooling.\n'+freeze+'export const DEFINITIONS=freeze('+JSON.stringify(definitions)+');\n';
  const expectedSchemas='// Generated from the shipped local schemas; no runtime filesystem or remote refs.\n'+freeze+'export const SCHEMAS=freeze('+JSON.stringify(schemas)+');\n';
  if(!read(root,'src/constants.mjs').equals(Buffer.from(expectedConstants)))reject('CONSTANTS_DRIFT');
  if(!read(root,'src/schema-data.mjs').equals(Buffer.from(expectedSchemas)))reject('SCHEMA_DATA_DRIFT');
}
function checkClosure(root,allowMissingGenerated=false){
  const actual=walk(root),allowed=new Set(packageFiles),folded=new Set();
  for(const member of actual){checkPath(member);if(folded.has(member.toLowerCase()))reject('CASE_COLLISION');folded.add(member.toLowerCase());if(!allowed.has(member))reject('UNEXPECTED_MEMBER');}
  for(const member of packageFiles)if(!actual.includes(member)&&!(allowMissingGenerated&&generatedFiles.has(member)))reject('MISSING_MEMBER');
  const pkg=json(root,'package.json');
  if(!same(pkg,packageMetadata))reject('PACKAGE_METADATA');
  if(Object.hasOwn(pkg,'scripts')||Object.keys(pkg.dependencies).length)reject('DEPENDENCIES_OR_HOOKS');
  checkGeneratedData(root);checkImports(root);
}
const memberRows=(root,members)=>members.map(member=>{const raw=read(root,member);return {path:member,byteLength:raw.length,sha256:'sha256:'+sha(raw)};});
function contract(root){return {kind:'MemoryOSReadinessContract',version:'1.0.0',id:'memoryos.readiness',files:memberRows(root,contractFiles)};}
function spdx(root){
  // These two generated files are excluded to avoid a self-hash/circular binding.
  // The final distribution manifest binds the complete SBOM bytes independently.
  const excluded=['distribution-manifest.json','sbom.spdx.json'];
  const files=packageFiles.filter(p=>!excluded.includes(p)).map(member=>{
    const raw=read(root,member);
    return {fileName:member,SPDXID:'SPDXRef-File-'+sha(Buffer.from(member),'sha1'),checksums:[{algorithm:'SHA1',checksumValue:sha(raw,'sha1')},{algorithm:'SHA256',checksumValue:sha(raw)}],licenseConcluded:'NOASSERTION',copyrightText:'NOASSERTION'};
  });
  const verification=sha(Buffer.from(files.map(f=>f.checksums[0].checksumValue).sort().join('')),'sha1');
  const closure=sha(bytes(files));
  return {spdxVersion:'SPDX-2.3',dataLicense:'CC0-1.0',SPDXID:'SPDXRef-DOCUMENT',name:'memoryos-readiness-0.1.0',documentNamespace:'https://memoryos.invalid/spdx/memoryos-readiness/0.1.0/'+closure,
    creationInfo:{creators:['Tool: memoryos-readiness-phase1-package'],created:'2026-09-28T00:00:00Z'},
    comment:'Phase 1 deterministic file inventory only; no release, execution, security, advisory or archive certification. SPDX metadata licensing does not grant a product license. SBOM and distribution-manifest self/cycle exclusions are explicit; the distribution manifest binds the SBOM.',
    packages:[{name:'memoryos-readiness',SPDXID:'SPDXRef-memoryos-readiness',versionInfo:'0.1.0',downloadLocation:'NOASSERTION',filesAnalyzed:true,packageVerificationCode:{packageVerificationCodeValue:verification,packageVerificationCodeExcludedFiles:excluded},licenseConcluded:'NOASSERTION',licenseDeclared:'NOASSERTION',copyrightText:'NOASSERTION',externalRefs:[],comment:'Zero external production npm dependencies. Node 24.21.0 win-x64 and Windows PowerShell 5.1 are separately provisioned and are not contained in this package.'}],
    files,relationships:[{spdxElementId:'SPDXRef-DOCUMENT',relationshipType:'DESCRIBES',relatedSpdxElement:'SPDXRef-memoryos-readiness'},...files.map(file=>({spdxElementId:'SPDXRef-memoryos-readiness',relationshipType:'CONTAINS',relatedSpdxElement:file.SPDXID}))],
  };
}
function distribution(root){return {kind:'MemoryOSReadinessDistributionManifest',version:'1.0.0',package:{name:'memoryos-readiness',version:'0.1.0'},files:memberRows(root,packageFiles.filter(p=>p!=='distribution-manifest.json'))};}
export function checkPackage(root=defaultRoot){
  checkClosure(root);
  if(!same(json(root,'contracts/contract.json'),contract(root)))reject('CONTRACT_BINDING');
  if(!same(json(root,'sbom.spdx.json'),spdx(root)))reject('SBOM_BINDING');
  if(!same(json(root,'distribution-manifest.json'),distribution(root)))reject('DISTRIBUTION_BINDING');
  return {kind:'MO1307Phase1PackageCheck',version:'1.0.0',members:packageFiles.length,contractMembers:contractFiles.length,externalProductionDependencies:0,archiveCertification:false};
}
export function buildPackage(root=defaultRoot){
  // Validate generated source equality before refreshing any hashes; a refresh
  // cannot conceal a stale/edited schema-data or constants implementation.
  checkClosure(root,true);
  fs.writeFileSync(path.join(root,'contracts/contract.json'),bytes(contract(root)));
  fs.writeFileSync(path.join(root,'sbom.spdx.json'),bytes(spdx(root)));
  fs.writeFileSync(path.join(root,'distribution-manifest.json'),bytes(distribution(root)));
  return checkPackage(root);
}
if(process.argv[1] && path.resolve(process.argv[1])===fileURLToPath(import.meta.url)){
  if(process.argv.length!==3||!['build','check'].includes(process.argv[2]))throw new Error('Usage: package.mjs build|check');
  process.stdout.write(JSON.stringify(process.argv[2]==='build'?buildPackage():checkPackage())+'\n');
}
