/** Git graph and exact artifact identities for the linear B1 -> I2 -> B2 lineage. */
import assert from 'node:assert/strict';
import {readFileSync,existsSync} from 'node:fs';
import {resolve} from 'node:path';
import {spawnSync} from 'node:child_process';
import {root,directory,read,canonical,sha,reference,verifyReference,parseCanonical,validateAll} from './evidence.mjs';
import {assertClosed} from '../mo1305-phase2c/evidence.mjs';
import {executionBinding} from './execution.mjs';
export const B1='b6c397b99e1f8bfcd04be972f35069f8737a4137';
export const subjects={I2:'feat(memoryos-1.3): integrate MO-1305 REST Gateway phase 2',B2:'conformance(memoryos-1.3): bind MO-1305 phase 2 integration'};
export const sources={
 '2a':{commit:'24d4aaaacc57c359be7726d5ec0df05b16884b50',branch:'mo1305/phase2a',subject:'feat(memoryos-1.3): complete MO-1305 remote lifecycle'},
 '2b':{commit:'77fa29606f600344e2ce500bb09dafd666f90588',branch:'mo1305/phase2b',subject:'build(memoryos-1.3): complete MO-1305 REST distribution'},
 '2c':{commit:'d3d4f2976249d45ce0355ec4823efc4a05bcb405',branch:'mo1305/phase2c',subject:'test(memoryos-1.3): complete MO-1305 REST security acceptance'}
};
export const inventoryPath='repositories/cca-conformance/mo1305-conformance-inventory.json';
export const bindingPath=directory+'/binding.json';
export const implementationPath=directory+'/implementation.json';
export const b2Paths=[
 inventoryPath,bindingPath,'docs/mo1305-phase2-binding.md',
 'repositories/cca-conformance/CMakeLists.txt','repositories/cca-conformance/tools/run-js-conformance.mjs',
 'repositories/cca-conformance/tests/mo1305_phase2_conformance_test.mjs',
 directory+'/conformance-pre-b2.tap',directory+'/conformance-pre-b2.json'
].sort();
export function git(args,{binary=false}={}){
 const r=spawnSync('C:/Program Files/Git/cmd/git.exe',['-c','safe.directory='+root.replaceAll('\\','/'),...args],{cwd:root,windowsHide:true,env:{...process.env,GIT_OPTIONAL_LOCKS:'0'},encoding:binary?undefined:'utf8',timeout:60000,maxBuffer:134217728});
 assert.equal(r.error,undefined);assert.equal(r.status,0,String(r.stderr));return binary?r.stdout:r.stdout.trim();
}
export function blobs(revision,paths){
 assert.match(revision,/^[0-9a-f]{40}$/);assert.equal(new Set(paths).size,paths.length);
 const r=spawnSync('C:/Program Files/Git/cmd/git.exe',['-c','safe.directory='+root.replaceAll('\\','/'),'cat-file','--batch'],{cwd:root,windowsHide:true,input:paths.map(p=>revision+':'+p+'\n').join(''),env:{...process.env,GIT_OPTIONAL_LOCKS:'0'},timeout:60000,maxBuffer:268435456});
 assert.equal(r.status,0,String(r.stderr));let offset=0;const result=new Map();
 for(const path of paths){const end=r.stdout.indexOf(10,offset);assert.ok(end>=offset);const header=r.stdout.subarray(offset,end).toString();assert.match(header,/^[0-9a-f]{40} blob [0-9]+$/);const length=Number(header.split(' ')[2]);offset=end+1;const bytes=r.stdout.subarray(offset,offset+length);assert.equal(bytes.length,length);offset+=length;assert.equal(r.stdout[offset++],10);result.set(path,bytes);}assert.equal(offset,r.stdout.length);return result;
}
const refBytes=(path,bytes)=>({path,byteLength:bytes.length,sha256:sha(bytes)});
export function checkCommit(commit,parent,subject){
 assert.match(commit,/^[0-9a-f]{40}$/);assert.equal(git(['show','-s','--format=%P',commit]),parent,'COMMIT_PARENT');assert.equal(git(['show','-s','--format=%s',commit]),subject,'COMMIT_SUBJECT');
}
export function checkSourceInputs(review=read(directory+'/integration-review.json')){
 assert.equal(review.baseline,B1);assert.equal(review.state,'REVIEWED');
 const union=new Map();
 const regenerated=new Set(['.gitattributes','repositories/memoryos-rest/README.md','repositories/memoryos-rest/src/server.mjs','repositories/memoryos-rest/dependency-manifest.json','repositories/memoryos-rest/distribution-manifest.json','repositories/memoryos-rest/sbom.spdx.json']);
 for(const [label,source] of Object.entries(sources)){
  const input=review.inputs[label];assert.equal(input.commit,source.commit);checkCommit(source.commit,B1,source.subject);assert.equal(git(['rev-parse',source.branch]),source.commit);
  const paths=git(['diff','--name-only',B1,source.commit]).split('\n');assert.deepEqual(input.files.map(r=>r.path).sort(),paths.sort());
  const data=blobs(source.commit,paths);
  for(const row of input.files){
   assert.deepEqual(refBytes(row.path,data.get(row.path)),{path:row.path,byteLength:row.byteLength,sha256:row.sha256});
   if(!regenerated.has(row.path))assert.deepEqual(reference(row.path),refBytes(row.path,data.get(row.path)),'SOURCE_BYTES_LOST '+row.path);
   if(!union.has(row.path))union.set(row.path,[]);union.get(row.path).push(label);
  }
  const validation=JSON.parse(readFileSync(resolve(root,directory+'/'+label+'-validation.json')));assert.equal(validation.state,'PASS');assert.equal(validation.exitCode,0);assert.equal(validation.sourceReadOnly,true);
 }
 assert.equal(review.overlapMatrix.length,union.size);
 for(const row of review.overlapMatrix)assert.deepEqual(row.sources,union.get(row.path));
 assert.deepEqual([...union].filter(([,labels])=>labels.length>1).map(([p])=>p).sort(),['.gitattributes','repositories/memoryos-rest/distribution-manifest.json','repositories/memoryos-rest/src/server.mjs']);
 const server='repositories/memoryos-rest/src/server.mjs';
 const a=blobs(sources['2a'].commit,[server]).get(server).toString();
 const b=blobs(B1,[server]).get(server).toString();
 const c=blobs(sources['2c'].commit,[server]).get(server).toString();
 const cLines=c.split('\n'),bLines=b.split('\n');
 const removed=bLines.filter(line=>!cLines.includes(line)),added=cLines.filter(line=>!bLines.includes(line));
 assert.equal(removed.length,1);assert.equal(added.length,2);assert.ok(added.some(line=>line.includes('requireHostHeader:false')));
 assert.ok(a.includes(removed[0]));assert.equal(readFileSync(resolve(root,server),'utf8'),a.replace(removed[0],added.join('\n')),'SERVER_RECONCILIATION');
 return {paths:union.size,overlaps:3};
}
export function checkPreservation(){
 const records=read(directory+'/baseline-preserved.json');assert.equal(records.length,2359);
 const original=blobs(B1,records.map(r=>r.path));
 for(const row of records){
  const committed=original.get(row.path);
  if(!b2Paths.includes(row.path))assert.deepEqual(reference(row.path),row,'BASELINE_CHANGED '+row.path);
  if(sha(committed)===row.sha256)assert.deepEqual(refBytes(row.path,committed),row);
  else{assert.ok(!b2Paths.includes(row.path));const current=readFileSync(resolve(root,row.path));assert.deepEqual(Buffer.from(current.toString('utf8').replaceAll('\r\n','\n')),committed,'BASELINE_CHECKOUT_NEWLINES');}
 }
 const old=blobs(B1,[inventoryPath]).get(inventoryPath);
 assert.deepEqual(readFileSync(resolve(root,directory+'/phase1-inventory.json')),old);
 return records.length;
}
export function checkB2Scope(paths,{pre=false}={}){
 assert.ok(paths.length>0);assert.equal(new Set(paths).size,paths.length);
 for(const path of paths)assert.ok(b2Paths.includes(path),'B2_SCOPE '+path);
 for(const path of b2Paths)if(!(pre&&path.includes('/conformance-pre-b2.')))assert.ok(paths.includes(path),'B2_MISSING '+path);
}
export function expectedBinding(i2){
 const binding=executionBinding(),index=reference(directory+'/index.json'),prior=read(directory+'/phase1-inventory.json');
 return {kind:'MemoryOSRESTPhase2Binding',version:'1.0.0',state:'PHASE2_BOUND',baseline:B1,sourceCommits:Object.fromEntries(Object.entries(sources).map(([key,value])=>[key,value.commit])),implementation:i2,implementationManifest:reference(implementationPath),production:binding.candidate.production,productionSha256:sha(canonical(binding.candidate.production)),package:{archive:binding.archive,distributionManifest:reference('repositories/memoryos-rest/distribution-manifest.json'),sourceTree:binding.sourceTree,sourceTreeSha256:read('.cache/mo1305-phase2d/build/source-tree.json').sha256,fileCount:58,closureCount:25,dependencies:0},contracts:prior.contracts,runtime:prior.runtime,phase1:{revision:B1,binding:reference('repositories/cca-conformance/evidence/mo1305-phase1-binding/binding.json'),inventory:reference(directory+'/phase1-inventory.json'),resource:prior.receipts.resource,stress:prior.receipts.stress,state:'COMPLETE'},integratedEvidence:index,review:reference(directory+'/integration-review.json'),phase2:'COMPLETE',phase3:'PENDING',windowsCertification:'PENDING',ubuntu:'NOT_REQUIRED',linux:'NOT_REQUIRED',vm:'NOT_REQUIRED',crossPlatformParity:'NOT_REQUIRED',finalBinding:'PENDING',releaseTag:{name:'memoryos-1.3-mo1305',state:'ABSENT'},selfReference:null};
}
export function expectedInventory(i2){
 const value=read(directory+'/phase1-inventory.json');value.state='PHASE2_BOUND';value.implementations.B1=B1;value.implementations.I2=i2;
 const binding=expectedBinding(i2);value.package={name:'memoryos-rest',version:'0.1.0',archive:binding.package.archive,distributionManifest:binding.package.distributionManifest,sourceTreeSha256:binding.package.sourceTreeSha256};
 value.dependencies.manifest=reference('repositories/memoryos-rest/dependency-manifest.json');value.dependencies.sbom=reference('repositories/memoryos-rest/sbom.spdx.json');value.dependencies.review=reference(directory+'/integration-review.json');
 const mod=job=>reference(directory+'/modules/'+job+'.json');
 value.receipts.package=[mod('distribution'),mod('reproducibility')];value.receipts.http=[mod('transport')];value.receipts.security=['transport','dispatch','startup','resources'].map(mod);value.receipts.functional=[mod('lifecycle'),mod('rest-units')];value.receipts.boundary=[mod('resources')];value.receipts.parity=[mod('interop')];value.receipts.installation=[mod('installation')];value.receipts.supplyChain=[mod('distribution')];
 return value;
}
export function checkBinding(value){
 assert.match(value.implementation,/^[0-9a-f]{40}$/);assert.deepEqual(value,expectedBinding(value.implementation),'BINDING_CONTENT');return value.implementation;
}
export function checkGraph(){
 const value=read(bindingPath),i2=checkBinding(value);checkCommit(i2,B1,subjects.I2);
 assert.deepEqual(read(inventoryPath),expectedInventory(i2),'INVENTORY_CONTENT');
 assert.equal(git(['branch','--show-current']),'main');
 const manifest=read(implementationPath);assertClosed(manifest,['kind','version','baseline','files']);assert.equal(manifest.kind,'MemoryOSRESTPhase2Implementation');assert.equal(manifest.version,'1.0.0');assert.equal(manifest.baseline,B1);
 const paths=git(['diff','--name-only',B1,i2]).split('\n');
 const allowed=new Set(read(directory+'/integration-review.json').overlapMatrix.map(r=>r.path));for(const path of paths)assert.ok(allowed.has(path)||path.startsWith(directory+'/')||path.startsWith('repositories/cca-conformance/tools/mo1305-phase2d/')||path==='docs/mo1305-phase2d-integration.md','I2_UNRELATED_SCOPE '+path);
 assert.deepEqual(paths.sort(),[implementationPath,...manifest.files.map(r=>r.path)].sort(),'I2_SCOPE');
 const data=blobs(i2,[implementationPath,...manifest.files.map(r=>r.path)]);
 assert.deepEqual(data.get(implementationPath),readFileSync(resolve(root,implementationPath)));
 for(const ref of manifest.files){assert.deepEqual(refBytes(ref.path,data.get(ref.path)),ref,'I2_BLOB');if(!b2Paths.includes(ref.path))verifyReference(ref);}
 const head=git(['rev-parse','HEAD']);
 if(head===i2){const changed=git(['diff','--name-only',i2]).split('\n').filter(Boolean);const untracked=git(['ls-files','--others','--exclude-standard']).split('\n').filter(Boolean);checkB2Scope([...new Set([...changed,...untracked])],{pre:true});}
 else{
  checkCommit(head,i2,subjects.B2);checkB2Scope(git(['diff','--name-only',i2,head]).split('\n'));
  const committed=blobs(head,b2Paths);for(const [path,bytes] of committed)assert.deepEqual(bytes,readFileSync(resolve(root,path)),'B2_WORKTREE_DRIFT');
  const receipt=read(directory+'/conformance-pre-b2.json');assertClosed(receipt,['kind','version','state','I2','exitCode','testCount','nodeSha256','sources','binding','inventory','log']);assert.equal(receipt.kind,'MemoryOSRESTPhase2ConformanceRun');assert.equal(receipt.version,'1.0.0');assert.equal(receipt.state,'PASS');assert.equal(receipt.I2,i2);assert.equal(receipt.exitCode,0);assert.ok(Number.isInteger(receipt.testCount)&&receipt.testCount>0);assert.equal(receipt.nodeSha256,executionBinding().candidate.node.sha256);assert.deepEqual(receipt.binding,reference(bindingPath));assert.deepEqual(receipt.inventory,reference(inventoryPath));
  const sourcePaths=['repositories/cca-conformance/tests/mo1305_phase2_conformance_test.mjs','repositories/cca-conformance/tools/mo1305-phase2d/evidence.mjs','repositories/cca-conformance/tools/mo1305-phase2d/graph.mjs','repositories/cca-conformance/tools/mo1305-phase2d/verify-package.py'];assert.deepEqual(receipt.sources,sourcePaths.map(reference));
  const tap=verifyReference(receipt.log).toString().replaceAll('\r\n','\n');for(const line of ['tests '+receipt.testCount,'pass '+receipt.testCount,'fail 0','cancelled 0','skipped 0','todo 0'])assert.ok(tap.split('\n').includes('# '+line),'CONFORMANCE_TAP');
 }
 assert.equal(git(['tag','--list','memoryos-1.3-mo1305']),'');
 const tags=read(directory+'/predecessor-tags.json');
 for(const tag of tags){assert.equal(git(['rev-parse',tag.name]),tag.object);assert.equal(git(['rev-parse',tag.name+'^{}']),tag.target);}
 return {I2:i2,B2:head===i2?null:head,state:'PASS'};
}
export function checkIndex(){
 const index=read(directory+'/index.json'),binding=executionBinding();
 assertClosed(index,['kind','version','state','baseline','bindingSha256','production','productionSha256','archive','sourceTree','sourceTreeSha256','modules','historical','resourcePolicy','results']);
 assert.equal(index.kind,'MemoryOSRESTPhase2DIndex');assert.equal(index.version,'1.0.0');assert.equal(index.state,'PASS');assert.equal(index.baseline,B1);
 assert.equal(index.bindingSha256,sha(canonical(binding)));assert.deepEqual(index.production,binding.candidate.production);assert.equal(index.productionSha256,sha(canonical(index.production)));assert.deepEqual(index.archive,binding.archive);assert.deepEqual(index.sourceTree,binding.sourceTree);assert.equal(index.sourceTreeSha256,read('.cache/mo1305-phase2d/build/source-tree.json').sha256);
 const result=validateAll();assert.deepEqual(index.results,result);
 assert.deepEqual(index.modules,['lifecycle','transport','dispatch','startup','resources','interop','rest-units','distribution','installation','reproducibility'].map(job=>reference(directory+'/modules/'+job+'.json')));
 const review=read(directory+'/integration-review.json');const historical=[...new Set(Object.values(review.inputs).flatMap(input=>input.files.filter(row=>['documentation','evidence'].includes(row.category)).map(row=>row.path)))].sort().map(reference);assert.deepEqual(index.historical,historical,'HISTORICAL_MEMBERSHIP');for(const ref of index.historical)verifyReference(ref);
 assert.deepEqual(index.resourcePolicy,{phase1Characterization:'REUSED_UNCHANGED',newCharacterizationObservations:0,limitsState:'FINAL',semanticDeadlineMs:31400,ceilingMs:60000});
 return result;
}
export function validateConformance(){
 const evidence=checkIndex(),inputs=checkSourceInputs(),preserved=checkPreservation(),graph=checkGraph();
 return {state:'PASS',evidence,inputs,preserved,graph};
}
