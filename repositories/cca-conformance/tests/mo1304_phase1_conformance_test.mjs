import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { createHash } from 'node:crypto';
import { execFileSync } from 'node:child_process';
import { resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { verifyRuntime,verifyDependencies,contractIdentityPin } from '../../memoryos-mcp/src/integrity.mjs';
import { verifyFoundation } from '../../memoryos-mcp/scripts/inventory.mjs';
import { loadLimits } from '../../memoryos-mcp/src/limits.mjs';
import { catalog,names,discoveryResult,listingResult } from '../../memoryos-mcp/src/contracts.mjs';
const workspace=fileURLToPath(new URL('../../../',import.meta.url));
const read=async path=>JSON.parse(await readFile(resolve(workspace,path)));
const hash=bytes=>createHash('sha256').update(bytes).digest('hex');
const inventory=await read('repositories/cca-conformance/mo1304-conformance-inventory.json');
const git=(...args)=>execFileSync('git',args,{cwd:workspace,encoding:'utf8',windowsHide:true,env:{...process.env,GIT_OPTIONAL_LOCKS:'0'}}).trim();
test('MO-1304 correction is a documentation-only child of the original authority',()=>{
 const authority=inventory.authority;assert.equal(authority.baseline,'ed4632fc81a6e90835233a848a9a3a118184c02e');
 assert.equal(git('rev-parse',`${authority.cacheCorrection}^`),authority.baseline);
 assert.equal(git('show','-s','--format=%s',authority.cacheCorrection),'docs(memoryos-1.3): correct MO-1304 MCP cache directives');
 assert.deepEqual(git('diff-tree','--no-commit-id','--name-only','-r',authority.cacheCorrection).split('\n'),[
 'docs/mo1304-contract-freeze-1-cache-correction.md','docs/mo1304-mcp-server-agent-integration.md']);
});
test('MO-1304 frozen catalog, mandatory cache fields and authority boundaries remain exact',async()=>{
 const frozen=inventory.frozenContract;assert.deepEqual(frozen.tools,names);assert.equal(names.length,6);
 assert.deepEqual(discoveryResult(),{resultType:'complete',ttlMs:0,cacheScope:'private',supportedVersions:['2026-07-28'],
 capabilities:{tools:{listChanged:false}},_meta:{'io.modelcontextprotocol/serverInfo':{name:'memoryos-mcp',version:'0.1.0'}}});
 const listing=listingResult(catalog(await contractIdentityPin()));assert.equal(listing.ttlMs,0);assert.equal(listing.cacheScope,'private');
 assert.deepEqual(Object.keys(listing).sort(),['_meta','cacheScope','resultType','tools','ttlMs']);
 for(const field of ['semanticCache','clientFilesystem','network','credentials'])assert.equal(frozen[field],false);
 assert.deepEqual([frozen.semanticOperations,frozen.semanticQueue,frozen.subscriptions,frozen.controlSlots,frozen.outputFrames],[1,0,1,1,2]);
});
test('MO-1304 runtime, contract and distribution foundations bind actual bytes',async()=>{
 assert.equal((await verifyRuntime()).files.length,25);assert.equal((await verifyDependencies()).packages.length,3);
 await verifyFoundation();
 for(const entry of inventory.identities){const bytes=await readFile(resolve(workspace,entry.path));assert.equal(bytes.length,entry.byteLength,entry.path);assert.equal(hash(bytes),entry.sha256,entry.path);}
});
test('MO-1304 resource constants are reviewed against all 420 operation and 60 transport samples',async()=>{
 const review=await read(inventory.measured.resourceReview);const measurement=await read('repositories/memoryos-mcp/measurements/resource-measurement.json');
 assert.equal(review.status,'REVIEWED_PHASE1');assert.deepEqual(review.values,await loadLimits());
 assert.equal(measurement.observations.length,420);assert.equal(measurement.transportObservations.length,60);
 assert.ok(measurement.observations.every(x=>x.status==='ok'&&x.heapSamples>0));
 assert.equal(review.maximalValidInputs.evaluationIdentityBytes,1186);assert.equal(review.maximalValidInputs.outcomeBytes,4060);
 assert.equal(measurement.analytical.worstEscapingFactor,6);
});
test('MO-1304 retains affected embedded fast-uri advisories and limited applicability evidence',async()=>{
 const review=await read('repositories/memoryos-mcp/measurements/advisory-disposition.json');
 assert.equal(review.disposition,'AFFECTED_COMPONENT_PRESENT_NO_APPLICABLE_PATH_IN_FROZEN_SURFACE');
 const source=await read('repositories/memoryos-mcp/measurements/advisory-source-review.json');
 assert.ok(JSON.stringify(source).includes('GHSA-f65p-4m7j-42xc'));assert.ok(JSON.stringify(source).includes('GHSA-v39h-62p7-jpjc'));
 const deps=await read('repositories/memoryos-mcp/measurements/dependency-review.json');
 assert.equal(deps.installedPackageCount,14);assert.equal(deps.productionPackageCount,3);
 assert.ok(deps.packages.every(x=>!x.native&&!x.optional&&!x.platformDownload));
});
test('MO-1304 binding is non-self-referential and Phase 2/3/release/tag values remain pending',async()=>{
 assert.equal(inventory.kind,'MemoryOSMO1304ConformanceInventory');assert.equal(inventory.phase,'phase1Foundation');
 const binding=inventory.implementationBinding;
 assert.equal(binding.parent,inventory.authority.cacheCorrection);
 if(binding.status==='BOUND') {
  assert.match(binding.revision,/^[0-9a-f]{40}$/u);assert.equal(git('rev-parse',`${binding.revision}^`),binding.parent);
  assert.equal(git('show','-s','--format=%s',binding.revision),'feat(memoryos-1.3): implement MO-1304 protocol and delegation foundation');
  assert.equal(git('diff',binding.revision,'--','repositories/memoryos-mcp/bin','repositories/memoryos-mcp/src','repositories/memoryos-mcp/runtime','repositories/memoryos-mcp/contracts','repositories/memoryos-mcp/distribution'),'');
  const evidence=inventory.implementedPhase1.evidence;assert.equal(evidence.status,'PASS');
  const bytes=await readFile(resolve(workspace,evidence.path));assert.equal(hash(bytes),evidence.sha256);
  assert.ok(JSON.parse(bytes).runs.every(x=>x.exitCode===0));
 } else {assert.equal(binding.status,'PENDING');assert.equal(binding.revision,null);}
 for(const key of ['phase2','phase3','releaseBinding','tagState'])assert.equal(inventory[key].status,'PENDING');
 assert.equal(inventory.phase2.archiveSha256,null);assert.equal(inventory.phase3.platformParity,null);
 assert.equal(inventory.releaseBinding.revision,null);assert.equal(inventory.tagState.object,null);
});
test('MO-1304 registration adds one isolated harness entry without changing predecessor tag targets',async()=>{
 const pkg=await read('repositories/cca-conformance/package.json');assert.equal(pkg.scripts['test:mo1304-phase1'],'node --test tests/mo1304_phase1_conformance_test.mjs');
 for(const [tag,revision] of [['mo1301','af6a405b3cd9097ce469b16a854a0568b8acee1f'],['mo1302','7e07bd0db9ab10146f2e0e0bbd67a4c5850cf41d'],['mo1303','49aa80fa76bffc03e36335be8ab805bb5dc38f9c']])
  assert.equal(git('rev-parse',`memoryos-1.3-${tag}^{commit}`),revision);
});
