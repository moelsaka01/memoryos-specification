// Explicit reviewed file integration, not a merge/cherry-pick or branch-order resolution.
import fs from 'node:fs';
import path from 'node:path';
import assert from 'node:assert/strict';
import {root,evidence,baseline,sources,str,blobs,read,json,check,record,write,sourceState} from './common.mjs';
assert.equal(str('rev-parse','HEAD'),baseline);assert.equal(str('branch','--show-current'),'main');
const overlaps=json(evidence+'/overlap-matrix.json'),pending=new Set(overlaps.threeWay);
assert.equal(pending.size,4);assert.ok(overlaps.pairs.every(p=>p.count===4));
const gates=sources.map(s=>{const p=evidence+'/source-gate-'+s.id+'.json',gate=json(p);assert.equal(gate.result,'PASS');assert.equal(gate.commit,s.commit);return record(p);});
const planned=[];
for(const s of sources){const before=sourceState(s);assert.equal(before.commit,s.commit);assert.deepEqual(before.parents,[s.base]);assert.equal(before.status,'');
 const inventory=json(evidence+'/source-inventories/'+s.id+'.json'),members=inventory.members.filter(m=>!pending.has(m.path));
 const existingAtBase=new Set(str('ls-tree','-r','--name-only',s.base).split('\n'));
 const existing=members.filter(m=>existingAtBase.has(m.path)),baseBytes=blobs(s.base,existing.map(m=>m.path));
 existing.forEach((m,i)=>assert.ok(read(m.path).equals(baseBytes[i]),'Main authority differs from source base; manual review required: '+m.path));
 for(const m of members.filter(m=>!existingAtBase.has(m.path)))assert.equal(fs.existsSync(path.join(root,m.path)),false,'Unexpected existing destination: '+m.path);
 const bytes=blobs(s.commit,members.map(m=>m.path));members.forEach((m,i)=>{check(m,bytes[i]);planned.push({source:s.id,commit:s.commit,member:m,bytes:bytes[i]});});
 assert.deepEqual(sourceState(s),before);
}
assert.equal(new Set(planned.map(p=>p.member.path)).size,planned.length);
// Validate every source and destination before the first mutation.
write(evidence+'/source-gate.json',{kind:'MO1307Phase2DSourceGate',version:'1.0.0',result:'PASS',baseline,sourceReviews:gates,
 acceptedSources:sources,correctionBinding:json(evidence+'/baseline.json').correctionBinding,
 policy:'All three exact clean source commits and reviewed acceptance evidence passed before importing any production path.'});
for(const item of planned){const target=path.resolve(root,item.member.path);assert.ok(target.startsWith(path.resolve(root)+path.sep));
 fs.mkdirSync(path.dirname(target),{recursive:true});fs.writeFileSync(target,item.bytes);}
write(evidence+'/source-import.json',{kind:'MO1307Phase2DReviewedSourceImport',version:'1.0.0',result:'PASS',
 policy:'Unique changed paths are adopted as exact accepted Git blobs only after all source gates pass. Four reviewed overlaps are deliberately withheld for explicit package union. Production integration adapter and pending documentation are reconciled afterward with their own source bindings.',
 members:planned.map(p=>({source:p.source,commit:p.commit,...p.member})),withheldOverlaps:[...pending].sort(),
 noMerge:true,noCherryPick:true,noSourceWorktreeWrites:true});
console.log(JSON.stringify({result:'PASS',importedPaths:planned.length,withheldOverlaps:pending.size}));
