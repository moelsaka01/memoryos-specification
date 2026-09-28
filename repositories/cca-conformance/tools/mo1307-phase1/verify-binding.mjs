// Read-only Phase 1 inventory and actual-parent B1 checker; no future/self hashes.
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { createHash } from 'node:crypto';
import { execFileSync } from 'node:child_process';
import assert from 'node:assert/strict';
import { checkPackage } from './package.mjs';
import { checkAcceptance, checkRow, checkCharacterization } from './binding-checks.mjs';
const root=path.resolve(path.dirname(fileURLToPath(import.meta.url)),'../../../..');
const prefix='repositories/cca-conformance/';
const inventoryPath=prefix+'mo1307-conformance-inventory.json';
const bindingPath=prefix+'evidence/mo1307/phase1/binding.json';
const freeze='e0cb8e9cc6aa73e26945db30756a6667a8d9e322';
const hash=b=>'sha256:'+createHash('sha256').update(b).digest('hex');
const read=p=>fs.readFileSync(path.join(root,p));
const json=p=>JSON.parse(read(p));
const git=(...args)=>execFileSync('git',args,{cwd:root,encoding:'utf8',windowsHide:true,maxBuffer:16*1024*1024}).trim();
const mode=process.argv[2]??'--bound';assert.ok(['--inventory','--pending','--bound'].includes(mode));
const inventory=json(inventoryPath);
assert.equal(inventory.freezeCommit,freeze);assert.equal(inventory.phase1,'FOUNDATION_CANDIDATE');assert.equal(inventory.phase2,'NOT_STARTED');assert.equal(inventory.phase3,'NOT_STARTED');assert.equal(inventory.release,'NOT_READY');
let previous='';
for(const row of inventory.artifacts){
  assert.ok(row.path>previous&&!row.path.includes('..')&&!path.isAbsolute(row.path));previous=row.path;
  const bytes=read(row.path);assert.equal(bytes.length,row.byteLength,row.path);assert.equal(hash(bytes),row.sha256,row.path);
}
const {sourceBindings}=checkAcceptance();assert.deepEqual(sourceBindings,inventory.acceptedSourceBindings);
const char=json(prefix+'evidence/mo1307/phase1/characterization/summary.json');
assert.equal(char.result,'PASS');assert.deepEqual(char.cases.map(c=>c.case),['small','mo1306-shaped','maximum']);
assert.equal(char.repeats,2);assert.equal(char.limitsChanged,false);
for(const c of char.cases){
  assert.ok(c.pureDurationMs<10000);assert.ok(c.observerDurationMs<30000);assert.ok(c.sampledPeakRssBytes<=536870912&&c.sampledPeakRssBytes>0);
  for(const e of c.evidence)checkRow(e);checkRow(c.inputBinding);
  const location=prefix+'evidence/mo1307/phase1/characterization/'+c.case+'/';
  const child=json(location+'child.stdout.json'),observer=json(location+'observer.json');
  checkCharacterization(c.case,child,observer,json(c.inputBinding.path));
  assert.equal(c.readinessIdentity,child.worker.identities.readiness);assert.equal(c.proofIdentity,child.worker.identities.proof);
  assert.equal(c.pureDurationMs,child.worker.pureDurationMs);assert.equal(c.inputAndPureDurationMs,child.worker.inputAndPureDurationMs);
  assert.equal(c.supervisorDurationMs,child.supervisorElapsedMs);assert.equal(c.observerDurationMs,observer.elapsedMs);
  assert.equal(c.sampledPeakRssBytes,observer.peakAggregateWorkingSetBytes);assert.equal(c.samples,observer.samples);
  assert.deepEqual(c.counts,child.worker.counts);assert.deepEqual(c.sizes,child.worker.sizes);
}
checkPackage();assert.equal(git('rev-parse',freeze+'^'),'cd8221d13a3d130c92d3993f481987d2095a824c');
assert.equal(git('rev-parse','refs/tags/memoryos-1.3-mo1306'),'9dd37b7757314b8cecbfc018ff7cdd8c2aa0cab8');
assert.equal(git('rev-parse','memoryos-1.3-mo1306^{}'),'332ab0d2c35643ea8d155bcbea9c5019b304bbe3');
if(mode!=='--inventory'){
  const binding=json(bindingPath),i1=binding.implementation.commit;
  assert.equal(binding.freezeCommit,freeze);assert.equal(git('rev-parse',i1+'^'),freeze);
  assert.equal(git('show','-s','--format=%s',i1),'feat(memoryos-1.3): implement MO-1307 readiness foundation');
  assert.equal(git('rev-parse',i1+'^{tree}'),binding.implementation.tree);
  const implementationPaths=git('diff','--name-only',freeze,i1).split('\n');
  const inventoriedPaths=new Set(inventory.artifacts.map(r=>r.path));
  for(const p of implementationPaths)assert.ok(p===inventoryPath||inventoriedPaths.has(p),'Uninventoried I1 change '+p);
  for(const p of implementationPaths)assert.ok(p==='.gitattributes'||p==='docs/mo1307-phase1-foundation.md'||p==='repositories/cca-conformance/mo1307-conformance-inventory.json'||p.startsWith('repositories/memoryos-readiness/')||p.startsWith(prefix+'evidence/mo1307/')||p.startsWith(prefix+'fixtures/mo1307/')||p.startsWith(prefix+'tools/mo1307-phase1/')||/^repositories\/cca-conformance\/tests\/mo1307_phase1_(core|fixtures|native|package)_test\.mjs$/u.test(p),'Unexpected I1 path '+p);
  assert.equal(hash(read(inventoryPath)),binding.inventory.sha256);
  const committed=execFileSync('git',['show',i1+':'+inventoryPath],{cwd:root,encoding:null,windowsHide:true,maxBuffer:16*1024*1024});
  assert.equal(hash(committed),binding.inventory.sha256);
  assert.equal(git('diff','--name-only',freeze,i1,'--','repositories/cca-core','repositories/memoryos','repositories/memoryos-ci','repositories/memoryos-rest','repositories/cca-conformance/evidence/mo1301','repositories/cca-conformance/evidence/mo1302','repositories/cca-conformance/evidence/mo1303','repositories/cca-conformance/evidence/mo1304','repositories/cca-conformance/evidence/mo1305','repositories/cca-conformance/evidence/mo1306'),'');
  if(mode==='--bound'){
    assert.equal(git('rev-parse','HEAD^'),i1);assert.equal(git('show','-s','--format=%s','HEAD'),'conformance(memoryos-1.3): bind MO-1307 phase 1 foundation');
    const changed=git('diff','--name-only',i1,'HEAD').split('\n');
    assert.deepEqual(changed.sort(),['ROADMAP.md',bindingPath].sort());
    assert.equal(git('status','--porcelain'),'');assert.equal(git('branch','--show-current'),'main');
  }else assert.equal(git('rev-parse','HEAD'),i1);
}
process.stdout.write(JSON.stringify({kind:'MemoryOSReadinessPhase1BindingCheck',mode,result:'PASS',artifacts:inventory.artifacts.length,head:git('rev-parse','HEAD'),freezeCommit:freeze,package:checkPackage(),characterizationCases:char.cases.length})+'\n');
