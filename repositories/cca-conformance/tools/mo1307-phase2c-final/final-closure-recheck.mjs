// Read-only source, history and external worktree verification; new receipt only.
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { createHash } from 'node:crypto';
import { spawnSync } from 'node:child_process';
const root=path.resolve(path.dirname(fileURLToPath(import.meta.url)),'../../../..');
const base='repositories/cca-conformance/evidence/mo1307/phase2c-final/';
const parent='08de262d1ef3149b6e540bcaea0cf910e02732bd',oldBase='0d68ac211b3b204635e7af252cd693dce5bd70b1',B1='3883ca889911fcc5a6f46c24e569478a8c32648e';
const sha=b=>createHash('sha256').update(b).digest('hex');
const read=p=>fs.readFileSync(path.join(root,p));
const bind=p=>{const bytes=read(p);return{path:p,byteLength:bytes.length,sha256:'sha256:'+sha(bytes)};};
const git=(directory,...args)=>{const result=spawnSync('C:/Program Files/Git/cmd/git.exe',['-c','safe.directory='+directory,'-C',directory,...args],{windowsHide:true,encoding:null,timeout:15000,maxBuffer:16*1024*1024});assert.equal(result.error,undefined);assert.equal(result.status,0,result.stderr?.toString());return result.stdout;};
const checkWorktree=(directory,expected)=>{
 const head=git(directory,'rev-parse','HEAD').toString().trim(),status=git(directory,'status','--porcelain=v1','--untracked-files=all').toString();
 assert.equal(head,expected);assert.equal(status,'');return{path:directory,head,clean:true,modified:false};
};
const main=checkWorktree('C:/Users/melsa/Documents/Codex/cca-workspace',parent);
assert.equal(git(main.path,'rev-parse','HEAD^').toString().trim(),'a61a8ff6fe01028fd21f8abe7208d5ffbe9c5152');
assert.equal(git(root,'rev-parse','HEAD').toString().trim(),oldBase);
const compatibility=JSON.parse(read(base+'compatibility.json'));assert.equal(compatibility.result,'PASS');
const streams=compatibility.streams.map(stream=>{
 const worktree=checkWorktree(stream.sourceWorktree.path,stream.commit);
 assert.equal(git(worktree.path,'rev-parse','HEAD^').toString().trim(),B1);
 let shared=0,committed=0;
 for(const row of stream.pureClosure){
  const bytes=row.source==='RESUMED_UNCHANGED_SHARED_DEPENDENCY'?read(row.path):git(worktree.path,'show',stream.commit+':'+row.path);
  assert.equal(bytes.length,row.byteLength);assert.equal('sha256:'+sha(bytes),row.sha256);
  row.source==='RESUMED_UNCHANGED_SHARED_DEPENDENCY'?shared++:committed++;
 }
 return{stream:stream.stream,commit:stream.commit,classification:'UNCHANGED_REUSABLE',worktree,sharedCurrentClosureFiles:shared,acceptedCommitClosureFiles:committed,retainedAcceptance:stream.retainedAcceptance,semanticTestsRerun:false};
});
const inventory=JSON.parse(read(base+'preservation/inventory.json'));let immutable=0;
for(const item of inventory.rows){
 const bytes=read(base+item.snapshot);assert.equal(bytes.length,item.byteLength);assert.equal(sha(bytes),item.sha256.replace(/^sha256:/,''));
 if(['docs/mo1307-phase2c-resumed.md','docs/mo1307-phase2c-continuation.md'].includes(item.path)||/^repositories\/cca-conformance\/evidence\/mo1307\/phase2c-(?:resumed|continuation)\//.test(item.path)){
  assert.deepEqual(read(item.path),bytes);immutable++;
 }
}
assert.equal(inventory.rows.length,593);assert.equal(immutable,547);
const historical=JSON.parse(read(base+'historical-preservation.json'));
assert.equal(git(historical.worktree,'rev-parse','HEAD').toString().trim(),B1);
for(const item of historical.artifacts){const bytes=fs.readFileSync(path.join(historical.worktree,item.path));assert.equal(bytes.length,item.byteLength);assert.equal('sha256:'+sha(bytes),item.sha256);assert.deepEqual(bytes,read(item.boundHistoricalCopy));}
assert.equal(historical.artifacts.length,5);
const testClosures=['timer-attempt3','phase1-attempt1'].map(name=>{
 const receipt=JSON.parse(read(base+name+'/receipt.json'));assert.equal(receipt.result,'PASS');
 const before=JSON.parse(read(base+name+'/source-binding-before.json')),after=JSON.parse(read(base+name+'/source-binding-after.json'));
 assert.deepEqual(before,after);for(const item of before)assert.deepEqual(bind(item.path),item);
 return{directory:base+name,receipt:bind(base+name+'/receipt.json'),tests:receipt.tests,boundSourceFiles:before.length,currentSourceBytesUnchanged:true};
});
const result={kind:'MO1307Phase2CFinalNearSealClosureReview',version:'1.0.0',result:'PASS',checkedAt:new Date().toISOString(),main,sourceWorktreeHead:oldBase,streams,
 history:{preservedSnapshotsVerified:inventory.rows.length,immutableCurrentHistoricalFiles:immutable,originalStoppedArtifactsVerified:historical.artifacts.length,stoppedReportsUnchanged:true},
 testClosures,packageSequence:'Current source closure excludes root sbom.spdx.json and distribution-manifest.json; regenerate and verify those final metadata bindings only after all relevant tests, then ensure other source bytes remain unchanged.',
 exact2DHandoff:compatibility.exactHandoff,
 noProductOrTestExecution:true,noOtherWorktreeWrites:true,noCacheDirectoriesCreated:true,noSemanticIntegration:true};
fs.writeFileSync(path.join(root,base+'near-seal-closure-review.json'),JSON.stringify(result,null,2)+'\n',{flag:'wx'});
process.stdout.write(JSON.stringify({result:result.result,mainClean:true,streams:streams.map(x=>({stream:x.stream,classification:x.classification,shared:x.sharedCurrentClosureFiles,committed:x.acceptedCommitClosureFiles})),history:result.history,testClosures:testClosures.map(x=>({count:x.tests.tests,pass:x.tests.pass,boundSourceFiles:x.boundSourceFiles}))})+'\n');
