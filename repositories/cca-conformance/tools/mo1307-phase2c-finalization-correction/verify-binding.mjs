// Read-only graph/blob/evidence/history validation; never edits another worktree.
import fs from 'node:fs';
import path from 'node:path';
import assert from 'node:assert/strict';
import {root,evidence,baseline,implementationSubject,bindingSubject,read,json,check,git,str,blobs,write} from './common.mjs';
import {checkSealedEvidence} from './check-evidence.mjs';
const binding=json(evidence+'/binding.json'),commit=binding.implementation.commit;
assert.equal(binding.implementation.parent,baseline);assert.equal(str('rev-parse',commit+'^'),baseline);
assert.equal(str('show','-s','--format=%s',commit),implementationSubject);
assert.equal(str('rev-parse',commit+'^{tree}'),binding.implementation.tree);
const graph=[baseline,'904908245483d3c64fb21d63aa5a6ebfd22102cb','3883ca889911fcc5a6f46c24e569478a8c32648e',
  '7aa5ede6ec52b36d0428273d78c8ca7aa37a39ee','e0cb8e9cc6aa73e26945db30756a6667a8d9e322'];
for(let i=0;i<graph.length-1;i++)assert.equal(str('rev-parse',graph[i]+'^'),graph[i+1]);
const changed=str('diff-tree','--no-commit-id','--name-only','-r',commit).split('\n').filter(Boolean).sort();
assert.deepEqual(binding.members.map(m=>m.path),changed);
const committed=blobs(commit,changed);binding.members.forEach((m,i)=>{check(m,committed[i]);check(m);});
const inventory=json(evidence+'/changed-file-inventory.json');assert.equal(inventory.baseline,baseline);
assert.deepEqual(inventory.members.map(m=>m.path),changed.filter(p=>p!==evidence+'/changed-file-inventory.json'));
for(const m of inventory.members)check(m);
checkSealedEvidence();
const initial=json(evidence+'/baseline.json');assert.equal(initial.main.head,baseline);assert.equal(initial.main.initialCleanVerifiedBeforeNewCorrectionFiles,true);
check(initial.originalCommittedSources);const history=json(initial.originalCommittedSources.path);
assert.equal(history.commit,baseline);assert.equal(history.tree,str('rev-parse',baseline+'^{tree}'));
const oldBlobs=blobs(baseline,history.members.map(m=>m.path));history.members.forEach((m,i)=>check(m,oldBlobs[i]));
// Prior binding/evidence/tools remain byte-exact on main; changed product/docs retain immutable old Git blobs.
for(const m of history.members)if(m.path.startsWith('repositories/cca-conformance/'))check(m);
let preservedDirtyFiles=0;
for(const worktree of initial.worktrees){
  check(worktree.inventory);check(worktree.statusFile);const captured=json(worktree.inventory.path);
  const args=['-c','safe.directory='+worktree.path,'-C',worktree.path];
  for(const [key,command] of [['head',['rev-parse','HEAD']],['parent',['rev-parse','HEAD^']],['branch',['branch','--show-current']]])
    assert.equal(str(...args,...command),worktree[key]);
  assert.equal(git(...args,'status','--porcelain=v1','--untracked-files=all').toString('utf8'),captured.before.status);
  const names=[...new Set([...str(...args,'diff','--name-only','HEAD').split('\n'),...str(...args,'ls-files','--others','--exclude-standard').split('\n')].filter(Boolean))].sort();
  assert.deepEqual(names,captured.files.map(m=>m.path));
  for(const m of captured.files){check(m,fs.readFileSync(path.join(worktree.path,m.path)));if(m.retainedCopy)check(m.retainedCopy);}
  assert.equal(captured.fileCount,worktree.changedFiles);preservedDirtyFiles+=captured.fileCount;
}
const diagnostic=json(evidence+'/diagnostic-binding.json');
for(const m of diagnostic.retainedArtifacts){check(m,fs.readFileSync(path.join(diagnostic.originalWorktree,m.originalPath)));
  check({...m.retained,path:evidence+'/'+m.retained.path});}
check({...diagnostic.statusBinding,path:evidence+'/'+diagnostic.statusBinding.path});
assert.equal(str('rev-parse','memoryos-1.3-mo1306'),'9dd37b7757314b8cecbfc018ff7cdd8c2aa0cab8');
assert.equal(str('rev-parse','memoryos-1.3-mo1306^{}'),'332ab0d2c35643ea8d155bcbea9c5019b304bbe3');
assert.equal(str('branch','--show-current'),'main');
let child=null;
if(process.argv.includes('--bound')){
  child=str('rev-parse','HEAD');assert.equal(str('rev-parse',child+'^'),commit);assert.equal(str('show','-s','--format=%s',child),bindingSubject);
  assert.deepEqual(str('diff-tree','--no-commit-id','--name-only','-r',child).split('\n').sort(),
    [evidence+'/binding.json',evidence+'/binding-verification.json'].sort());
  assert.equal(str('status','--porcelain'),'');
  const verification=json(evidence+'/binding-verification.json');assert.equal(verification.result,'PASS');assert.equal(verification.C2F,commit);
}else assert.equal(str('rev-parse','HEAD'),commit);
const result={kind:'MO1307FinalizationBindingVerification',version:'1.0.0',result:'PASS',graph:'PASS',diagnostic:'BOUND',
  sourceAndEvidenceBinding:'PASS',boundBlobs:changed.length,historicalBaselineBlobs:history.members.length,preservedDirtyFiles,
  C2F:commit,C2FB:child,productionChangesInBindingCommit:false,selfReference:false,scope:'FOUNDATION_CORRECTION_ONLY'};
if(process.argv.includes('--record')){assert.equal(child,null);write(evidence+'/binding-verification.json',result);}
console.log(JSON.stringify(result));
