// Read-only source-worktree capture; writes new main-workspace evidence only.
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { createHash } from 'node:crypto';
import { spawnSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';
const root=path.resolve(path.dirname(fileURLToPath(import.meta.url)),'../../../..');
const base='0d68ac211b3b204635e7af252cd693dce5bd70b1';
const parent='904908245483d3c64fb21d63aa5a6ebfd22102cb';
const prefix='repositories/cca-conformance/evidence/mo1307/phase2c-finalization-correction';
const output=path.join(root,prefix);
const sha=raw=>'sha256:'+createHash('sha256').update(raw).digest('hex');
const binding=(member,raw)=>({path:member,byteLength:raw.length,sha256:sha(raw)});
const git=(location,args,input)=>{const run=spawnSync('git',['-c','safe.directory='+location.replaceAll('\\','/'),'-C',location,...args],{input,encoding:null,windowsHide:true,timeout:30000,maxBuffer:64*1024*1024});assert.ifError(run.error);assert.equal(run.status,0,run.stderr.toString());return run.stdout;};
const text=(location,...args)=>git(location,args).toString('utf8').trim();
const states=location=>({head:text(location,'rev-parse','HEAD'),parent:text(location,'rev-parse','HEAD^'),branch:text(location,'branch','--show-current'),status:git(location,['status','--porcelain=v1','--untracked-files=all']).toString('utf8')});
const write=(member,value)=>{const destination=path.join(output,member);fs.mkdirSync(path.dirname(destination),{recursive:true});fs.writeFileSync(destination,Buffer.isBuffer(value)?value:JSON.stringify(value,null,2)+'\n',{flag:'wx'});return binding(prefix+'/'+member,fs.readFileSync(destination));};
assert.equal(process.platform,'win32');assert.equal(process.version,'v24.21.0');assert.equal(sha(fs.readFileSync(process.execPath)),'sha256:ba4e6d110e8c1592a1ecd390f6b05f3da124b13871a5be62b341a07a853c6c32');
assert.equal(text(root,'rev-parse','HEAD'),base);assert.equal(text(root,'rev-parse','HEAD^'),parent);assert.equal(text(root,'branch','--show-current'),'main');
assert.equal(text(root,'show','-s','--format=%s','HEAD'),'conformance(memoryos-1.3): bind MO-1307 publication inspection correction');
fs.mkdirSync(output,{recursive:true});
const capturedAt=new Date().toISOString();
const worktrees=[
 {id:'phase2a',path:'C:/Users/melsa/Documents/Codex/cca-mo1307-2a',head:'b628349b4e678a8f71086b1b5c807ffe2edf9a5d',parent:'3883ca889911fcc5a6f46c24e569478a8c32648e',clean:true},
 {id:'phase2b',path:'C:/Users/melsa/Documents/Codex/cca-mo1307-2b',head:'b2877ab32c317bb67896414ba9cec64f6f436ca5',parent:'3883ca889911fcc5a6f46c24e569478a8c32648e',clean:true},
 {id:'original-phase2c',path:'C:/Users/melsa/Documents/Codex/cca-mo1307-2c',head:'3883ca889911fcc5a6f46c24e569478a8c32648e',clean:false},
 {id:'resumed-phase2c',path:'C:/Users/melsa/Documents/Codex/cca-mo1307-2c-resumed',head:base,parent,clean:false},
];
const worktreeRows=[];
for(const target of worktrees){
 const before=states(target.path);assert.equal(before.head,target.head);if(target.parent)assert.equal(before.parent,target.parent);assert.equal(before.status==='',target.clean);
 const changed=git(target.path,['diff','--name-only','-z','HEAD']).toString('utf8').split('\0').filter(Boolean);
 const untracked=git(target.path,['ls-files','--others','--exclude-standard','-z']).toString('utf8').split('\0').filter(Boolean);
 const names=[...new Set([...changed,...untracked])].sort(),members=[];
 for(const member of names){const absolute=path.resolve(target.path,member);assert.ok(absolute.toLowerCase().startsWith(path.resolve(target.path).toLowerCase()+path.sep));const stat=fs.lstatSync(absolute);assert.ok(stat.isFile()&&!stat.isSymbolicLink());const raw=fs.readFileSync(absolute);const row={...binding(member,raw),trackedChange:changed.includes(member),untracked:untracked.includes(member)};
  const keep=target.id==='original-phase2c'||(target.id==='resumed-phase2c'&&(
   /^docs\/mo1307-phase2c-(resumed|continuation)\.md$/.test(member)||
   /^repositories\/cca-conformance\/evidence\/mo1307\/phase2c-continuation\/[^/]+\.json$/.test(member)||
   /^repositories\/cca-conformance\/evidence\/mo1307\/phase2c-continuation\/(rename-boundary-diagnostic|production-launch-attempt1|launch-security-attempt1)\//.test(member)||
   member==='repositories/cca-conformance/evidence/mo1307/phase2c-resumed/stop-disposition.json'||
   member==='repositories/cca-conformance/tools/mo1307-phase2c-resumed/rename-boundary-diagnostic.mjs'||
   member==='repositories/memoryos-readiness/src/runtime.mjs'||member==='repositories/memoryos-readiness/src/publication.mjs'));
  if(keep)row.retainedCopy=write('history/'+target.id+'/'+member+'.data',raw);members.push(row);
 }
 for(const member of members){const raw=fs.readFileSync(path.resolve(target.path,member.path));assert.equal(raw.length,member.byteLength);assert.equal(sha(raw),member.sha256);}
 const after=states(target.path);assert.deepEqual(after,before);
 const statusFile=write('history/'+target.id+'/git-status.txt',Buffer.from(before.status));
 const inventory=write('history/'+target.id+'/changed-file-inventory.json',{kind:'MO1307ReadOnlyWorktreeInventory',version:'1.0.0',capturedAt,worktree:target.path,before,after,modified:false,files:members,fileCount:members.length,totalBytes:members.reduce((sum,row)=>sum+row.byteLength,0),retainedCopyCount:members.filter(row=>row.retainedCopy).length,statusFile,ignoredCacheExcluded:true});
 worktreeRows.push({id:target.id,path:target.path,head:before.head,parent:before.parent,branch:before.branch,clean:before.status==='',changedFiles:members.length,totalBytes:members.reduce((sum,row)=>sum+row.byteLength,0),inventory,statusFile,modified:false});
}
const paths=['repositories/memoryos-readiness','docs/mo1307-contract-freeze-1.md','docs/mo1307-phase2c-publication-inspection-correction.md',
 'repositories/cca-conformance/evidence/mo1307/phase2c-correction','repositories/cca-conformance/tools/mo1307-phase2c-correction'];
const tree=git(root,['ls-tree','-r','-z','--full-tree',base,'--',...paths]).toString('utf8').split('\0').filter(Boolean).map(line=>{const match=/^(\d+) (\w+) ([0-9a-f]{40})\t(.+)$/.exec(line);assert.ok(match);return {mode:match[1],type:match[2],gitBlob:match[3],path:match[4]};}).sort((a,b)=>a.path<b.path?-1:a.path>b.path?1:0);
const batch=git(root,['cat-file','--batch'],Buffer.from(tree.map(row=>row.gitBlob+'\n').join('')));let offset=0;const baselineFiles=[];
for(const member of tree){assert.ok(['100644','100755'].includes(member.mode));assert.equal(member.type,'blob');const end=batch.indexOf(10,offset),header=batch.subarray(offset,end).toString('ascii').split(' ');assert.equal(header[0],member.gitBlob);assert.equal(header[1],'blob');const size=Number(header[2]);offset=end+1;const raw=batch.subarray(offset,offset+size);assert.equal(raw.length,size);offset+=size;assert.equal(batch[offset++],10);baselineFiles.push({...binding(member.path,raw),gitBlob:member.gitBlob,mode:member.mode});}
assert.equal(offset,batch.length);
const originalInventory=write('baseline-committed-source-inventory.json',{kind:'MO1307FinalizationBaselineCommittedSources',version:'1.0.0',commit:base,tree:text(root,'rev-parse',base+'^{tree}'),members:baselineFiles,packageFileCount:baselineFiles.filter(row=>row.path.startsWith('repositories/memoryos-readiness/')).length,source:'Exact Git blobs, including complete original package, current authoritative documents, prior correction tools and evidence; no working-tree reinterpretation.'});
const resumed=worktrees.find(row=>row.id==='resumed-phase2c').path;
const readResumed=member=>JSON.parse(fs.readFileSync(path.join(resumed,member)));
const prior=readResumed('repositories/cca-conformance/evidence/mo1307/phase2c-resumed/stop-disposition.json');
const current=readResumed('repositories/cca-conformance/evidence/mo1307/phase2c-continuation/final-disposition.json');
assert.equal(prior.status,'STOPPED');assert.equal(prior.classification,'ENVIRONMENT_BLOCKER');assert.equal(current.status,'STOPPED');assert.equal(current.classification,'CONTRACT_DEFECT');assert.equal(current.previousEnvironmentBlocker.exactAuthorizedProductionLaunch,'PASS');
write('history-disposition.json',{kind:'MO1307FinalizationHistoryDisposition',version:'1.0.0',result:'PRESERVED',prior:{status:prior.status,classification:prior.classification,completion:prior.completion},current:{status:current.status,classification:current.classification,completion:current.completion},environmentBlocker:{historicalFailurePreserved:true,resolvedOnlyByExactUserAuthorizedProcessScopedLaunch:true,freshLaunchElapsedMs:current.previousEnvironmentBlocker.elapsedMs,persistentPolicyMutation:false},currentBlocker:'Already-submitted native rename can commit after a terminal timeout while prior finalization contract prohibits that mutation.',nativeRenameDiagnosticRetained:true,phase2CComplete:false,phase2DStarted:false,worktreesModified:false,authority:'No stopped attempt is rewritten as PASS. The exact dirty current source and prior source/evidence snapshots remain in their original worktree; the new inventories bind every changed/untracked non-ignored file.'});
write('baseline.json',{kind:'MO1307FinalizationCorrectionBaseline',version:'1.0.0',capturedAt,main:{head:base,parent,tree:text(root,'rev-parse',base+'^{tree}'),branch:'main',subject:text(root,'show','-s','--format=%s',base),initialReadOnlyStatusObserved:'',initialCleanVerifiedBeforeNewCorrectionFiles:true,initialObservationSource:'Independent read-only Git check at task start, before this capture tool or other correction files were created.'},originalCommittedSources:originalInventory,worktrees:worktreeRows,network:false,sourceWorktreesModified:false,runner:binding(path.relative(root,fileURLToPath(import.meta.url)).replaceAll('\\','/'),fs.readFileSync(fileURLToPath(import.meta.url)))});
console.log(JSON.stringify({result:'PASS',baseline:base,baselineFiles:baselineFiles.length,worktrees:worktreeRows.map(row=>({id:row.id,changedFiles:row.changedFiles,totalBytes:row.totalBytes,clean:row.clean}))}));
