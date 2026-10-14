import assert from 'node:assert/strict';
import { readFile,writeFile } from 'node:fs/promises';
import { resolve } from 'node:path';
import { execFileSync } from 'node:child_process';
import { PACKAGE_ROOT,sha256,exactFiles } from '../src/integrity.mjs';
const B1='0c8b8a35ff0f92a28fe4be85d60ee460208443de',I1='6ab8ed0abb105f90cf44220b1798341133f2716d';
const workspace=resolve(PACKAGE_ROOT,'../..'),destination=resolve(workspace,'repositories/cca-conformance/mo1304-conformance-inventory.json');
const git=(...args)=>execFileSync('git',args,{cwd:workspace,windowsHide:true,maxBuffer:16*1024*1024,env:{...process.env,GIT_OPTIONAL_LOCKS:'0'}});
const historical=git('show',`${B1}:repositories/cca-conformance/mo1304-conformance-inventory.json`);
const original=JSON.parse(historical),current=JSON.parse(await readFile(destination));
const identity=async path=>{const bytes=await readFile(resolve(workspace,path));return {path,byteLength:bytes.length,sha256:sha256(bytes)};};
const identities=await Promise.all(original.identities.map(x=>identity(x.path)));
const receipt=JSON.parse(await readFile(resolve(PACKAGE_ROOT,'measurements/phase2-package-receipt.json')));
const binding=current.phase2.binding??{strategy:'postCommitConformanceCommit',status:'PENDING',revision:null,parent:B1};
if(process.argv.includes('--bind')){
 const revision=git('rev-parse','HEAD').toString().trim();
 assert.equal(git('show','-s','--format=%s',revision).toString().trim(),'feat(memoryos-1.3): complete MO-1304 tools and MCP integration');
 assert.equal(git('rev-parse',`${revision}^`).toString().trim(),B1);Object.assign(binding,{status:'BOUND',revision});
}
const receipts={};for(const key of ['package-receipt','integration','offline','advisory-review','dependency-assembly','license-sources','validation']){
 const path=`repositories/memoryos-mcp/measurements/phase2-${key}.json`;
 try {receipts[key]=await identity(path);}catch(error){if(key!=='validation'||error.code!=='ENOENT')throw error;receipts[key]=null;}
}
const tests=(await exactFiles(resolve(PACKAGE_ROOT,'tests'))).filter(x=>x.endsWith('.test.mjs')).map(x=>`repositories/memoryos-mcp/tests/${x}`);
const inventory={...original,phase:'phase2Integration',identities,
 phase1Snapshot:{revision:B1,implementationRevision:I1,inventorySha256:sha256(historical)},
 phase2:{status:'IMPLEMENTED',phase1Implementation:I1,phase1Binding:B1,
 implementationScope:{productionModules:['repositories/memoryos-mcp/bin/memoryos-mcp.mjs',...['dispatcher','integrity','server','transport'].map(x=>`repositories/memoryos-mcp/src/${x}.mjs`)],
 publication:'Generation-correlated supervisor, cancellation checkpoint, owned stdout pipe descriptor with cancellable native writes, callback plus drain, bounded control backpressure and EOF cleanup including unread native pipes',
 packageCorrection:'Exclude exactly 198 published Zod development test files; preserve all 748 retained dependency bytes and all locked versions. Regenerate dependency pin, closure and foundation identities. Add private license notice and required embedded third-party notices.',
 semanticContractChanged:false,resourceLimitsChanged:false,deterministicAssemblies:2},
 archiveSha256:receipt.archive.sha256,archiveByteLength:receipt.archive.byteLength,archiveFileCount:receipt.archiveFileCount,
 distributionManifest:receipt.distributionManifest,operationalTestCatalog:tests,
 operationalCertification:'PHASE2_LOCAL_IMPLEMENTATION',clientInterop:'OFFICIAL_2.0.0_SOURCE_AND_INSTALLED_OS_PIPES',
 offline:'INSTRUMENTED_PARENT_AND_SEVEN_WORKER_PATHS_OS_DENIAL_PENDING_PHASE3',
 supplyChain:'AFFECTED_FAST_URI_3.1.0_8_HIGH_1_MODERATE_NO_APPLICABLE_PRODUCT_PATH',receipts,binding}};
await writeFile(destination,JSON.stringify(inventory,null,2)+'\n');
process.stdout.write(JSON.stringify({identities:identities.length,tests:tests.length,binding:binding.status,archive:receipt.archive.sha256})+'\n');
