// One implementation commit and one binding child; no future/self identity.
import assert from 'node:assert/strict';
import {evidence,baseline,str,record,write,blobs,json,check} from './common.mjs';
const implementationSubject='feat(memoryos-1.3): integrate MO-1307 release readiness';
const bindingSubject='conformance(memoryos-1.3): bind MO-1307 phase 2 integration';
assert.equal(str('branch','--show-current'),'main');
const inventoryPath=evidence+'/changed-file-inventory.json';
if(process.argv[2]==='inventory'){
 assert.equal(str('rev-parse','HEAD'),baseline);assert.equal(str('diff','--cached','--name-only'),'');
 assert.equal(json(evidence+'/final-validation/receipt.json').result,'PASS');
 const names=[...new Set([...str('diff','--name-only',baseline).split('\n'),...str('ls-files','--others','--exclude-standard').split('\n')].filter(Boolean))].sort();
 assert.ok(names.length>1951);assert.ok(!names.includes(inventoryPath));
 for(const p of names)assert.ok(p==='.gitattributes'||p.startsWith('repositories/memoryos-readiness/')||p.startsWith('repositories/cca-conformance/evidence/mo1307/')||p.startsWith('repositories/cca-conformance/fixtures/mo1307/')||p.startsWith('repositories/cca-conformance/tests/mo1307_')||p.startsWith('repositories/cca-conformance/tools/mo1307-')||p.startsWith('docs/mo1307-'),p);
 write(inventoryPath,{kind:'MO1307Phase2DChangedFileInventory',version:'1.0.0',baseline,members:names.map(p=>record(p)),
  exclusions:['This inventory excludes itself. The B2 child binds its actual I2 bytes and every other changed file.'],
  implementationSubject,bindingSubject,implementationIdentity:'Bound only after actual I2 exists; no future hash.',sourceGate:'PASS',normativeBlocker:false});
 console.log(JSON.stringify({result:'PASS',members:names.length}));
}else if(process.argv[2]==='stage-check'){
 assert.equal(str('rev-parse','HEAD'),baseline);
 const members=[...json(inventoryPath).members,record(inventoryPath)].sort((a,b)=>a.path<b.path?-1:1);
 assert.deepEqual(str('diff','--cached','--name-only').split('\n').filter(Boolean).sort(),members.map(m=>m.path));
 assert.equal(str('diff','--name-only'),'');assert.equal(str('ls-files','--others','--exclude-standard'),'');
 const bytes=blobs('',members.map(m=>m.path));members.forEach((m,i)=>{check(m,bytes[i]);check(m);});
 console.log(JSON.stringify({result:'PASS',exactStagedBlobs:members.length}));
}else if(process.argv[2]==='bind'){
 const commit=str('rev-parse','HEAD');assert.deepEqual(str('show','-s','--format=%P',commit).split(' '),[baseline]);assert.equal(str('show','-s','--format=%s',commit),implementationSubject);assert.equal(str('status','--porcelain'),'');
 const names=str('diff-tree','--no-commit-id','--name-only','-r',commit).split('\n').filter(Boolean).sort(),bytes=blobs(commit,names);
 write(evidence+'/binding.json',{kind:'MO1307Phase2DImplementationBinding',version:'1.0.0',implementation:{commit,parent:baseline,tree:str('rev-parse',commit+'^{tree}'),subject:implementationSubject},
  members:names.map((p,i)=>record(p,bytes[i])),bindingSubject,productionChangesInBindingCommit:false,
  selfReference:'Only the existing actual I2 commit/tree/blobs are bound. No B2 identity or future commit hash is embedded.',
  phase3:'Only recommend later separately authorized 3A/3B/3C work from actual verified B2; none created by this task.'});
 console.log(JSON.stringify({result:'PASS',I2:commit,members:names.length}));
}else throw Error('Use inventory, stage-check or bind');
