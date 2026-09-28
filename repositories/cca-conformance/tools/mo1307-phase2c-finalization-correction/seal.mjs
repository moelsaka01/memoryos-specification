import assert from 'node:assert/strict';
import {evidence,baseline,implementationSubject,bindingSubject,str,record,write,blobs,json,check} from './common.mjs';
assert.equal(str('branch','--show-current'),'main');
if(process.argv[2]==='inventory') {
  assert.equal(str('rev-parse','HEAD'),baseline);
  const names=[...new Set([...str('diff','--name-only',baseline).split('\n'),...str('ls-files','--others','--exclude-standard').split('\n')].filter(Boolean))].sort();
  for(const p of names) assert.ok(p.startsWith(evidence+'/')||p.startsWith('repositories/cca-conformance/tools/mo1307-phase2c-finalization-correction/')
    ||p.startsWith('repositories/memoryos-readiness/')||p==='repositories/cca-conformance/tests/mo1307_phase1_native_test.mjs'
    ||p.startsWith('repositories/cca-conformance/tests/mo1307_phase2c_finalization_')
    ||['docs/mo1307-contract-freeze-1.md','docs/mo1307-phase2c-publication-inspection-correction.md','docs/mo1307-phase2c-finalization-boundary-correction.md'].includes(p),p);
  assert.ok(names.length>0);
  write(evidence+'/changed-file-inventory.json',{kind:'MO1307FinalizationCorrectionInventory',version:'1.0.0',baseline,members:names.map(p=>record(p)),
    exclusions:['This inventory excludes itself; the binding child binds its actual committed bytes along with all implementation changes.'],
    scope:'TARGETED_FINALIZATION_BOUNDARY_AND_N24',noDirtyWorktreeImplementationImported:true});
  console.log(JSON.stringify({result:'PASS',members:names.length}));
} else if(process.argv[2]==='stage-check') {
  assert.equal(str('rev-parse','HEAD'),baseline);
  const inventory=evidence+'/changed-file-inventory.json',members=[...json(inventory).members,record(inventory)].sort((a,b)=>a.path<b.path?-1:1);
  assert.deepEqual(str('diff','--cached','--name-only').split('\n').filter(Boolean).sort(),members.map(m=>m.path));
  assert.equal(str('diff','--name-only'),'');assert.equal(str('ls-files','--others','--exclude-standard'),'');
  const bytes=blobs('',members.map(m=>m.path));members.forEach((m,i)=>check(m,bytes[i]));
  console.log(JSON.stringify({result:'PASS',exactStagedBlobs:members.length}));
} else if(process.argv[2]==='bind') {
  const commit=str('rev-parse','HEAD');assert.equal(str('rev-parse','HEAD^'),baseline);assert.equal(str('show','-s','--format=%s','HEAD'),implementationSubject);assert.equal(str('status','--porcelain'),'');
  const names=str('diff-tree','--no-commit-id','--name-only','-r',commit).split('\n').filter(Boolean).sort();const bytes=blobs(commit,names);
  write(evidence+'/binding.json',{kind:'MO1307FinalizationCorrectionBinding',version:'1.0.0',implementation:{commit,parent:baseline,tree:str('rev-parse',commit+'^{tree}'),subject:implementationSubject},
    members:names.map((p,i)=>record(p,bytes[i])),bindingSubject,productionChangesInBindingCommit:false,
    selfReference:'Only actual existing C2F commit/tree/blobs are bound; no C2FB or future hash is embedded.',
    continuation:'Existing dirty resumed2C must preserve its bytes and history, then reconcile against the actual verified direct conformance child C2FB. No reset/rebase or automatic continuation is authorized by this record.'});
  console.log(JSON.stringify({result:'PASS',C2F:commit,members:names.length}));
} else throw new Error('Use inventory, stage-check or bind');
