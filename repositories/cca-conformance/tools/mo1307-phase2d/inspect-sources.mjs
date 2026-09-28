import assert from 'node:assert/strict';
import {root,evidence,baseline,sources,git,str,blobs,record,check,json,write,sourceState} from './common.mjs';
assert.equal(str('branch','--show-current'),'main');assert.equal(str('rev-parse','HEAD'),baseline);
assert.equal(str('show','-s','--format=%s','HEAD'),'conformance(memoryos-1.3): bind MO-1307 finalization correction');
// The initial clean observation was made before creating these engineering files.
assert.equal(str('diff','--name-only'),'');assert.equal(str('diff','--cached','--name-only'),'');
const old='repositories/cca-conformance/evidence/mo1307/phase2c-finalization-correction';
const binding=json(old+'/binding.json'),implementation=binding.implementation.commit;
assert.equal(str('rev-parse',baseline+'^'),implementation);assert.equal(implementation,'a61a8ff6fe01028fd21f8abe7208d5ffbe9c5152');
assert.equal(str('rev-parse',implementation+'^'),'0d68ac211b3b204635e7af252cd693dce5bd70b1');
assert.equal(str('rev-parse',implementation+'^{tree}'),binding.implementation.tree);
assert.deepEqual(str('diff-tree','--no-commit-id','--name-only','-r',baseline).split('\n').sort(),[old+'/binding.json',old+'/binding-verification.json'].sort());
const prior=blobs(implementation,binding.members.map(m=>m.path));binding.members.forEach((m,i)=>{check(m,prior[i]);check(m);});
function category(p){if(p.startsWith('repositories/memoryos-readiness/')){
 if(/\/(?:distribution-manifest|sbom\.spdx|package)\.json$/.test(p))return 'package metadata';
 if(/\/(?:contracts|schemas)\//.test(p))return 'schema/contract';
 if(p.endsWith('.md'))return 'documentation';return 'production';}
 if(p.startsWith('docs/'))return 'documentation';if(p.includes('/evidence/'))return 'evidence';if(p.includes('/fixtures/'))return 'fixture';if(p.includes('/tests/'))return 'test';return 'engineering-only';}
const inventories=[];
for(const source of sources){const before=sourceState(source);assert.equal(before.commit,source.commit);assert.deepEqual(before.parents,[source.base]);assert.equal(before.subject,source.subject);assert.equal(before.status,'');
 const names=str('diff','--name-only',source.base,source.commit).split('\n').filter(Boolean).sort();
 const bytes=blobs(source.commit,names),members=names.map((p,i)=>({...record(p,bytes[i]),category:category(p)}));
 const counts=Object.fromEntries(['production','schema/contract','test','fixture','package metadata','evidence','documentation','engineering-only'].map(c=>[c,members.filter(m=>m.category===c).length]));
 assert.deepEqual(sourceState(source),before);
 const inventory={kind:'MO1307IntegrationSourceInventory',version:'1.0.0',...source,before,changedPaths:members.length,counts,members};
 write(evidence+'/source-inventories/'+source.id+'.json',inventory);inventories.push(inventory);
}
const sets=inventories.map(i=>new Set(i.members.map(m=>m.path))),intersection=(a,b)=>[...a].filter(p=>b.has(p)).sort();
const pairs=[['2a','2b',intersection(sets[0],sets[1])],['2a','2c',intersection(sets[0],sets[2])],['2b','2c',intersection(sets[1],sets[2])]];
const overlapPaths=[...new Set(pairs.flatMap(p=>p[2]))].sort();
const overlaps=overlapPaths.map(p=>({path:p,classification:/\/(?:distribution-manifest|sbom\.spdx|package)\.json$/.test(p)?'generated-metadata conflict':'shared-interface reconciliation',
 sourceMembers:inventories.flatMap(i=>i.members.filter(m=>m.path===p).map(m=>({stream:i.id,base:i.base,commit:i.commit,...m}))),
 main:record(p),mainAuthority:baseline,decision:'PENDING_MANUAL_RECONCILIATION'}));
write(evidence+'/overlap-matrix.json',{kind:'MO1307IntegrationOverlapMatrix',version:'1.0.0',pairs:pairs.map(([left,right,paths])=>({left,right,count:paths.length,paths})),threeWay:intersection(new Set(intersection(sets[0],sets[1])),sets[2]),overlaps});
write(evidence+'/baseline.json',{kind:'MO1307Phase2DMainBaseline',version:'1.0.0',capturedAt:new Date().toISOString(),taskStartedAt:'2026-09-28T22:09:52Z',main:{commit:baseline,branch:'main',initialStatus:'CLEAN',initialObservation:'Read-only task-start Git status before creation of any Phase2D engineering files.'},
 correctionBinding:{result:'PASS',implementation,tree:binding.implementation.tree,exactBoundCurrentBlobs:binding.members.length,scope:'Actual C2F/C2FB graph and bytes; historical dirty-worktree expectations are not applied to the newly accepted 2C commit.'},
 sourceIdentities:'PASS',sourceAcceptanceEvidence:'PENDING_INDEPENDENT_GATE_REVIEWS',sourceInventories:inventories.map(i=>record(evidence+'/source-inventories/'+i.id+'.json')),phase2DProductionImported:false});
console.log(JSON.stringify({result:'IDENTITY_AND_INVENTORY_PASS',counts:inventories.map(i=>({stream:i.id,paths:i.changedPaths,counts:i.counts})),pairs:pairs.map(([a,b,p])=>({pair:a+'/'+b,count:p.length})),threeWay:intersection(new Set(intersection(sets[0],sets[1])),sets[2])}));
