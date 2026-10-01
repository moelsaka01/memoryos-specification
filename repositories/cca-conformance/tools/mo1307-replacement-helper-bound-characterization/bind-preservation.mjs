// Run exactly once after the complete evidence commit. Launches zero helpers.
import fs from 'node:fs';
import path from 'node:path';
import assert from 'node:assert/strict';
import {root,evidence,json,writeJson,record,str,baseline,productionTree,helperSha,hash,read} from './common.mjs';
const evidenceCommit=process.argv[2];assert.match(evidenceCommit??'',/^[a-f0-9]{40}$/);assert.equal(str('rev-parse','HEAD'),evidenceCommit);assert.equal(str('status','--porcelain=v1','--untracked-files=all'),'');
const historical=json(evidence+'/historical-binding.json');assert.equal(str('-C',historical.phase3A.worktree,'rev-parse','HEAD'),historical.phase3A.head);assert.equal(str('-C',historical.phase3A.worktree,'status','--porcelain=v1','--untracked-files=all'),historical.phase3A.statusPorcelain);
const decision=json(evidence+'/decision.json'),paths=[evidence+'/plan-seal.json',evidence+'/campaign.json',evidence+'/independent-recomputation.json',evidence+'/decision.json',evidence+'/final-validation/attempt-1/receipt.json',evidence+'/changed-file-inventory.json','docs/mo1307-replacement-helper-bound-characterization.md'];
for(const p of paths)assert.equal(fs.existsSync(path.join(root,p)),true,p);
const inventory=json(evidence+'/changed-file-inventory.json'),inventoryPath=evidence+'/changed-file-inventory.json',commitPaths=str('diff-tree','--no-commit-id','--name-only','-r',evidenceCommit).split(/\r?\n/).filter(Boolean).map(p=>p.replaceAll('\\','/')).sort(),expectedPaths=[...inventory.entries.map(x=>x.path),inventoryPath].sort();
assert.deepEqual(commitPaths,expectedPaths,'evidence commit differs from changed-file inventory');
assert.equal(inventory.entries.every(x=>x.path==='.gitattributes'||x.path==='docs/mo1307-replacement-helper-bound-characterization.md'||x.path.startsWith('repositories/cca-conformance/tools/mo1307-replacement-helper-bound-characterization/')||x.path.startsWith(evidence+'/')),true);
for(const entry of inventory.entries)if(entry.file){const current=record(entry.path);assert.deepEqual(current,entry.file,entry.path);assert.equal(str('rev-parse',`${evidenceCommit}:${entry.path}`),str('hash-object',`--path=${entry.path}`,entry.path),entry.path);}
assert.equal(str('show','-s','--format=%P',evidenceCommit),baseline);
const binding=writeJson(evidence+'/preservation-binding.json',{kind:'MO1307ReplacementBoundPreservationBinding',version:'1.0.0',result:'BOUND',createdAtUtc:new Date().toISOString(),
  disposition:decision.result,Hms:decision.Hms,evidenceCommit,evidenceTree:str('rev-parse',`${evidenceCommit}^{tree}`),parent:str('show','-s','--format=%P',evidenceCommit),expectedParent:baseline,
  productionTree:str('rev-parse',`${evidenceCommit}:repositories/memoryos-readiness`),expectedProductionTree:productionTree,helperSha:hash(read('repositories/memoryos-readiness/helpers/windows-inspect.ps1')),expectedHelperSha:helperSha,
  artifacts:paths.map(p=>({path:p,blob:str('rev-parse',`${evidenceCommit}:${p}`),record:record(p)})),humanReleaseAuthorization:'SEPARATE_AND_NOT_PERFORMED',
  productionChanges:false,contractChanges:false,certification:false,phase3A:false,phase3B:false,phase3C:false,phase3D:false,push:false,tag:false});
assert.equal(json(binding.path).productionTree,productionTree);assert.equal(json(binding.path).helperSha,helperSha);
console.log(JSON.stringify({result:'BOUND',binding,disposition:decision.result,Hms:decision.Hms,evidenceCommit}));
