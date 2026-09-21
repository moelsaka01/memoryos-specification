import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { execFileSync } from 'node:child_process';
import { resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { PACKAGE_ROOT,sha256,exactFiles,verifyRuntime,verifyDependencies,contractIdentityPin } from '../../memoryos-mcp/src/integrity.mjs';
import { verifyFoundation } from '../../memoryos-mcp/scripts/inventory.mjs';
import { ARCHIVE,MANIFEST,verifyArchive } from '../../memoryos-mcp/scripts/distribution.mjs';
import { catalog,names,discoveryResult,listingResult } from '../../memoryos-mcp/src/contracts.mjs';
const workspace=fileURLToPath(new URL('../../../',import.meta.url));
const B1='0c8b8a35ff0f92a28fe4be85d60ee460208443de',I1='6ab8ed0abb105f90cf44220b1798341133f2716d';
const raw=path=>readFile(resolve(workspace,path)),read=async path=>JSON.parse(await raw(path));
const local=async path=>JSON.parse(await readFile(resolve(PACKAGE_ROOT,path)));
const gitBytes=(...args)=>execFileSync('git',args,{cwd:workspace,windowsHide:true,maxBuffer:16*1024*1024,env:{...process.env,GIT_OPTIONAL_LOCKS:'0'}});
const git=(...args)=>gitBytes(...args).toString().trim();
const historical=path=>gitBytes('show',`${B1}:${path}`);
const inventory=await read('repositories/cca-conformance/mo1304-conformance-inventory.json');
const old=JSON.parse(historical('repositories/cca-conformance/mo1304-conformance-inventory.json'));
const phase=inventory.phase2,receipt=await local('measurements/phase2-package-receipt.json');
const archive=await readFile(resolve(PACKAGE_ROOT,'out/phase2',ARCHIVE));
const checked=verifyArchive(archive,receipt);
async function identity(entry){const bytes=await raw(entry.path);assert.equal(bytes.length,entry.byteLength,entry.path);assert.equal(sha256(bytes),entry.sha256,entry.path);return bytes;}
test('Phase 2 binds the exact roadmap, correction, I1 and immutable B1 graph',()=>{
 assert.equal(inventory.phase,'phase2Integration');assert.equal(phase.status,'IMPLEMENTED');
 const graph=['ed4632fc81a6e90835233a848a9a3a118184c02e','9d12ea46c6971efd01619bcfdba804431b4149f3',I1,B1];
 for(let i=1;i<graph.length;i++)assert.equal(git('rev-parse',`${graph[i]}^`),graph[i-1]);
 assert.equal(git('show','-s','--format=%s',B1),'conformance(memoryos-1.3): bind MO-1304 phase 1 foundation');
 assert.equal(phase.phase1Implementation,I1);assert.equal(phase.phase1Binding,B1);
 assert.deepEqual(inventory.implementationBinding,old.implementationBinding);assert.deepEqual(inventory.implementedPhase1,old.implementedPhase1);
 assert.equal(inventory.phase1Snapshot.inventorySha256,sha256(historical('repositories/cca-conformance/mo1304-conformance-inventory.json')));
 assert.equal(inventory.phase1Snapshot.revision,B1);assert.equal(inventory.phase1Snapshot.implementationRevision,I1);
 for(const entry of old.identities){const bytes=historical(entry.path);assert.equal(bytes.length,entry.byteLength);assert.equal(sha256(bytes),entry.sha256);}
});
test('six tools, SDK delegation, metadata/cache directives, runtime and finite limits preserve frozen bytes',async()=>{
 assert.deepEqual(inventory.frozenContract,old.frozenContract);assert.deepEqual(names,old.frozenContract.tools);
 for(const path of ['src/contracts.mjs','src/delegation.mjs','contracts/limits.json','contracts/policy-contract-identities-1.0.0.json','package-lock.json','distribution/dependency-lock.json',...(await exactFiles(resolve(PACKAGE_ROOT,'runtime'))).map(x=>'runtime/'+x)])
  assert.deepEqual(await readFile(resolve(PACKAGE_ROOT,path)),historical('repositories/memoryos-mcp/'+path),path);
 assert.equal((await verifyRuntime()).files.length,25);assert.equal(phase.implementationScope.resourceLimitsChanged,false);assert.equal(phase.implementationScope.semanticContractChanged,false);
 for(const result of [discoveryResult(),listingResult(catalog(await contractIdentityPin()))]){assert.equal(result.ttlMs,0);assert.equal(result.cacheScope,'private');assert.equal(result.resultType,'complete');}
 assert.deepEqual(discoveryResult().capabilities,{tools:{listChanged:false}});
});
test('all regenerated source identities and deterministic external package identity bind actual bytes',async()=>{
 assert.equal(inventory.identities.length,12);for(const entry of inventory.identities)await identity(entry);
 const foundation=await verifyFoundation();assert.equal(foundation.files.length,50);assert.equal(foundation.productionDependencyFileCount,748);
 assert.equal(receipt.kind,'MemoryOSMCPPhase2PackageReceipt');assert.equal(receipt.identicalAssemblyRuns,2);assert.equal(receipt.archiveFileCount,798);
 assert.equal(receipt.archiveFilename,ARCHIVE);assert.equal(receipt.node,'24.21.0');assert.equal(receipt.npm,'11.19.0');assert.equal(receipt.protocol,'2026-07-28');
 assert.equal(phase.archiveSha256,receipt.archive.sha256);assert.equal(phase.archiveByteLength,receipt.archive.byteLength);assert.equal(phase.archiveFileCount,checked.members.size);
 assert.deepEqual(phase.distributionManifest,receipt.distributionManifest);assert.ok(!checked.manifest.files.some(x=>x.path===MANIFEST));
 for(const name of ['runtimeManifest','dependencyLock','dependencyClosure','contractPin','limits']){const entry=receipt[name],bytes=checked.members.get(entry.path).bytes;assert.equal(bytes.length,entry.byteLength);assert.equal(sha256(bytes),entry.sha256);}
 for(const path of checked.members.keys())assert.ok(!/(^|\/)(?:tests|fixtures|measurements|\.git|\.github|\.cache)(\/|$)/u.test(path),path);
 assert.equal(receipt.platformCertification,'PENDING_PHASE3');assert.equal(checked.summary.runtimeFiles,25);assert.equal(checked.summary.dependencies,3);
});
test('Phase 2 production dependency selection removes only the 198 reviewed development files',async()=>{
 const deps=await verifyDependencies(),selection=await local('scripts/dependency-selection.json');
 const prior=JSON.parse(historical('repositories/memoryos-mcp/distribution/dependency-closure.json'));
 assert.equal(sha256(historical('repositories/memoryos-mcp/distribution/dependency-closure.json')),selection.sourceClosureSha256);
 assert.equal(prior.files.length,946);assert.equal(selection.excludedFiles.length,198);assert.equal(deps.files.length,748);assert.deepEqual(deps.packages,prior.packages);
 const removed=new Set(selection.excludedFiles.map(x=>x.path));assert.equal(removed.size,198);
 for(const entry of selection.excludedFiles){assert.match(entry.path,/^node_modules\/zod\/src\/.*\/tests\//u);assert.deepEqual(entry,prior.files.find(x=>x.path===entry.path));}
 assert.deepEqual(deps.files,prior.files.filter(x=>!removed.has(x.path)));
 const pkg=await local('package.json');assert.deepEqual(pkg.dependencies,{'@modelcontextprotocol/core':'2.0.0','@modelcontextprotocol/server':'2.0.0',zod:'4.6.5'});assert.deepEqual(pkg.devDependencies,{'@modelcontextprotocol/client':'2.0.0'});
 assert.ok(![...checked.members.keys()].some(x=>x.startsWith('node_modules/@modelcontextprotocol/client/')));
 const assembly=await local('measurements/phase2-dependency-assembly.json');assert.equal(assembly.retainedFileBytesChanged,false);assert.equal(assembly.versionsChanged,false);
 assert.equal(assembly.selectionSha256,sha256(await readFile(resolve(PACKAGE_ROOT,'scripts/dependency-selection.json'))));
});
test('official client receipt proves source and offline installed six-tool parity, cancellation and restart',async()=>{
 const client=await local('measurements/phase2-integration.json');assert.equal(client.status,'PASS');assert.equal(client.archiveSha256,receipt.archive.sha256);
 assert.deepEqual(client.results.map(x=>x.mode),['source','installed']);
 for(const result of client.results){assert.equal(result.status,'PASS');assert.deepEqual(result.tools,names);assert.deepEqual(result.decisions,['PASS','FAIL','COULD_NOT_EVALUATE','PASS']);
  for(const key of ['busy','cancellation','canonicalSDKAndCLIParity','processesReaped','restart','stableMemoryOSErrorParity'])assert.equal(result[key],true,key);assert.equal(result.stderrBytes,0);}
 const installed=client.results[1];assert.equal(installed.installedOutsideCheckout,true);assert.deepEqual(installed.offlineInstall,{audit:false,emptyExplicitCache:true,fund:false,ignoreScripts:true,offline:true,verifiedFiles:798});
 assert.equal(client.platformCertification,'PENDING_PHASE3');
});
test('installed boundary receipt covers parent and all seven workers without claiming OS isolation',async()=>{
 const offline=await local('measurements/phase2-offline.json');assert.equal(offline.status,'PASS');assert.equal(offline.archiveSha256,receipt.archive.sha256);
 assert.equal(offline.installedOutsideCheckout,true);assert.equal(offline.officialClient,true);assert.equal(offline.processesReaped,true);assert.equal(offline.sourceCheckoutFallback,false);assert.equal(offline.persistence,false);
 assert.equal(offline.osLevelNetworkDenial,'PENDING_PHASE3');assert.equal(offline.platformCertification,'PENDING_PHASE3');assert.equal(offline.workerOperations,7);assert.equal(offline.audit.workers.length,7);
 for(const audit of [offline.audit.parent,...offline.audit.workers]){for(const key of ['network','filesystem','writes','shell','moduleFallback','validators'])assert.equal(audit[key],0,key);assert.ok(audit.reads>0);assert.ok(audit.modules.length>0);for(const path of audit.modules)assert.ok(checked.members.has(path),path);}
});
test('advisory recheck preserves affected Phase 1 truth and current eight-high/one-moderate exposure',async()=>{
 for(const path of ['advisory-disposition','advisory-source-review'])assert.deepEqual(await readFile(resolve(PACKAGE_ROOT,`measurements/${path}.json`)),historical(`repositories/memoryos-mcp/measurements/${path}.json`));
 const review=await local('measurements/phase2-advisory-review.json');assert.equal(review.status,'REVIEWED_PHASE2');assert.equal(review.phase1DispositionPreserved,true);assert.equal(review.component.version,'3.1.0');
 assert.equal(review.affectedHigh,8);assert.equal(review.affectedModerate,1);assert.equal(review.applicableHigh,0);assert.equal(review.compatiblePatchedPublishedSDKAvailable,false);
 assert.equal(review.disposition,'AFFECTED_COMPONENT_PRESENT_NO_APPLICABLE_PATH_IN_FROZEN_INSTALLED_SURFACE');assert.equal(review.evidence.archiveSha256,receipt.archive.sha256);
 const source=await readFile(resolve(PACKAGE_ROOT,review.sourceEvidence.path));assert.equal(source.length,review.sourceEvidence.byteLength);assert.equal(sha256(source),review.sourceEvidence.sha256);
 assert.equal(review.evidence.offlineReceiptSha256,sha256(await readFile(resolve(PACKAGE_ROOT,'measurements/phase2-offline.json'))));
 const previous=await local('measurements/advisory-disposition.json');for(const record of previous.records)assert.ok(review.records.some(x=>x.ghsaId===record.ghsaId&&x.severity==='high'&&x.affectedInstalledVersion&&!x.applicableProductPath));
 assert.ok(review.npmAuditLimitation.includes('omits code embedded'));assert.equal(review.platformCertification,'PENDING_PHASE3');
});
test('bounded harness receipts, test catalog and fresh predecessor runs bind their actual code',async()=>{
 for(const value of Object.values(phase.receipts)){assert.ok(value);await identity(value);}
 const expected=(await exactFiles(resolve(PACKAGE_ROOT,'tests'))).filter(x=>x.endsWith('.test.mjs')).map(x=>`repositories/memoryos-mcp/tests/${x}`);assert.deepEqual(phase.operationalTestCatalog,expected);
 const validation=await local('measurements/phase2-validation.json');assert.equal(validation.status,'PASS');assert.equal(validation.archiveSha256,receipt.archive.sha256);assert.equal(validation.node,'24.21.0');assert.equal(validation.npm,'11.19.0');
 assert.deepEqual(validation.runs.map(x=>x.label),['phase2-package','mo1301','mo1302-phase3','mo1303-phase3','focused-sdk-core-mip','workspace','diff-check']);
 for(const run of validation.runs){assert.equal(run.exitCode,0,run.label);assert.equal(run.reusedFrom,undefined);if(run.tests){assert.equal(run.pass,run.tests);assert.equal(run.fail+run.cancelled+run.skipped+run.todo,0);}}
 for(const entry of validation.code){const bytes=await readFile(resolve(PACKAGE_ROOT,entry.path));assert.equal(bytes.length,entry.byteLength,entry.path);assert.equal(sha256(bytes),entry.sha256,entry.path);}
 assert.equal(validation.platformCertification,'PENDING_PHASE3');
});
test('I2/B2 binding permits only an actual existing implementation revision and evidence-only child',async()=>{
 const binding=phase.binding;assert.equal(binding.parent,B1);assert.equal(binding.strategy,'postCommitConformanceCommit');
 const head=git('rev-parse','HEAD'),subject='feat(memoryos-1.3): complete MO-1304 tools and MCP integration';
 if(binding.status==='PENDING'){assert.equal(binding.revision,null);if(head!==B1){assert.equal(git('rev-parse','HEAD^'),B1);assert.equal(git('show','-s','--format=%s'),subject);}return;}
 assert.equal(binding.status,'BOUND');assert.match(binding.revision,/^[a-f0-9]{40}$/u);assert.equal(git('rev-parse',`${binding.revision}^`),B1);assert.equal(git('show','-s','--format=%s',binding.revision),subject);
 if(binding.validationReceipt){const bytes=await identity(binding.validationReceipt),evidence=JSON.parse(bytes);assert.equal(evidence.implementationRevision,binding.revision);assert.equal(evidence.parent,B1);assert.equal(evidence.status,'PASS');assert.equal(evidence.archiveSha256,receipt.archive.sha256);assert.ok(evidence.runs.every(x=>x.exitCode===0));}
 if(head!==binding.revision){assert.equal(git('rev-parse','HEAD^'),binding.revision);assert.equal(git('show','-s','--format=%s'),'conformance(memoryos-1.3): bind MO-1304 phase 2 integration');assert.ok(binding.validationReceipt);
  assert.deepEqual(git('diff','--name-only',binding.revision,head).split('\n'),['repositories/cca-conformance/evidence/mo1304-phase2-binding-validation.json','repositories/cca-conformance/mo1304-conformance-inventory.json']);}
 assert.equal(git('diff',binding.revision,'--','repositories/memoryos-mcp','tools/verify_workspace.py'),'');
});
test('Phase 3, release binding, tag and unsupported macOS state remain mechanically pending',async()=>{
 assert.deepEqual(inventory.phase3,old.phase3);assert.equal(inventory.phase3.status,'PENDING');assert.equal(inventory.phase3.macos,'UNSUPPORTED');
 for(const key of ['windows11_24H2_x64','ubuntu24_04_x64','platformParity'])assert.equal(inventory.phase3[key],null);
 assert.deepEqual(inventory.releaseBinding,{status:'PENDING',revision:null});assert.deepEqual(inventory.tagState,{status:'PENDING',name:'memoryos-1.3-mo1304',object:null});
 assert.equal(git('tag','--list','memoryos-1.3-mo1304'),'');
 for(const [tag,object,target] of [['mo1301','2cda15d8ab056ac8f2971c5cd9a22cb89fc4821e','af6a405b3cd9097ce469b16a854a0568b8acee1f'],['mo1302','773dd03829dd6b3632bf43a45578925b1498515d','7e07bd0db9ab10146f2e0e0bbd67a4c5850cf41d'],['mo1303','f3891cbac8a6ab804887a3d95a595c7bd1523af9','49aa80fa76bffc03e36335be8ab805bb5dc38f9c']]){assert.equal(git('rev-parse',`memoryos-1.3-${tag}`),object);assert.equal(git('rev-parse',`memoryos-1.3-${tag}^{commit}`),target);}
 const pkg=await read('repositories/cca-conformance/package.json');assert.equal(pkg.scripts['test:mo1304-phase2'],'node --test tests/mo1304_phase2_conformance_test.mjs');
});
