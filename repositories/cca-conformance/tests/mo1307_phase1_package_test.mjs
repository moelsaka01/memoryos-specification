import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { packageFiles,packageMetadata,canonical,buildPackage,checkPackage,defaultRoot } from '../tools/mo1307-phase1/package.mjs';

const workspace=fileURLToPath(new URL('../../../',import.meta.url));
const scratch=path.join(workspace,'.cache/mo1307-phase1-package-tests');
fs.mkdirSync(scratch,{recursive:true});
function fixture(){
  const root=fs.mkdtempSync(path.join(scratch,'case-'));
  for(const member of packageFiles){
    if(['contracts/contract.json','sbom.spdx.json','distribution-manifest.json'].includes(member))continue;
    fs.mkdirSync(path.dirname(path.join(root,member)),{recursive:true});
    fs.copyFileSync(path.join(defaultRoot,member),path.join(root,member));
  }
  buildPackage(root);return root;
}
function put(root,member,value){fs.writeFileSync(path.join(root,member),canonical(value)+'\n');}
test('package metadata and deterministic nonrecursive bindings',()=>{
  const root=fixture();
  assert.equal(packageMetadata.private,true);assert.equal(packageMetadata.type,'module');
  assert.deepEqual(packageMetadata.exports,{'.':'./src/index.mjs'});
  assert.deepEqual(packageMetadata.dependencies,{});
  const targets=['contracts/contract.json','sbom.spdx.json','distribution-manifest.json'];
  const before=targets.map(p=>fs.readFileSync(path.join(root,p)));
  buildPackage(root);targets.forEach((p,i)=>assert.deepEqual(fs.readFileSync(path.join(root,p)),before[i]));
  assert.equal(checkPackage(root).members,packageFiles.length);
});
test('unexpected member is rejected without refreshing the binding',()=>{
  const root=fixture();fs.writeFileSync(path.join(root,'unexpected.txt'),'unlisted');
  assert.throws(()=>buildPackage(root),/UNEXPECTED_MEMBER/);
});
test('changed shipped source fails exact distribution binding',()=>{
  const root=fixture();fs.appendFileSync(path.join(root,'src/index.mjs'),'\n// altered after binding\n');
  assert.throws(()=>checkPackage(root),/SBOM_BINDING|DISTRIBUTION_BINDING/);
});
test('schema drift cannot be hidden by rebuilding manifests',()=>{
  const root=fixture();const schema=JSON.parse(fs.readFileSync(path.join(root,'schemas/id-1.0.0.schema.json')));schema.title='unexpected';
  put(root,'schemas/id-1.0.0.schema.json',schema);assert.throws(()=>buildPackage(root),/SCHEMA_DATA_DRIFT/);
});
test('constants drift cannot be hidden by rebuilding manifests',()=>{
  const root=fixture();fs.appendFileSync(path.join(root,'src/constants.mjs'),'\n');
  assert.throws(()=>buildPackage(root),/CONSTANTS_DRIFT/);
});
test('dependencies, lifecycle hooks, extra exports and traversal allowlist are rejected',()=>{
  for(const mutate of [p=>{p.dependencies.extra='1.0.0';},p=>{p.scripts={install:'not-authorized'};},p=>{p.exports['./internal']='./src/foundation.mjs';},p=>{p.files.push('../outside');}]){
    const root=fixture(),pkg=structuredClone(packageMetadata);mutate(pkg);put(root,'package.json',pkg);
    assert.throws(()=>buildPackage(root),/PACKAGE_METADATA/);
  }
});
test('network and external imports are rejected before manifest regeneration',()=>{
  for(const statement of ["import 'node:https';\n","import external from 'not-installed';\n","import('../not-shipped.mjs');\n"]){
    const root=fixture();fs.appendFileSync(path.join(root,'src/index.mjs'),statement);
    assert.throws(()=>buildPackage(root),/NETWORK_OR_UNKNOWN_BUILTIN|EXTERNAL_IMPORT|IMPORT_CLOSURE/);
  }
});
test('missing fixed helper and mutated manifest rows are rejected',()=>{
  const root=fixture();fs.unlinkSync(path.join(root,'helpers/windows-inspect.ps1'));
  assert.throws(()=>checkPackage(root),/MISSING_MEMBER/);
  const second=fixture(),manifest=JSON.parse(fs.readFileSync(path.join(second,'distribution-manifest.json')));
  manifest.files[0].path='../escape';put(second,'distribution-manifest.json',manifest);
  assert.throws(()=>checkPackage(second),/DISTRIBUTION_BINDING/);
});
