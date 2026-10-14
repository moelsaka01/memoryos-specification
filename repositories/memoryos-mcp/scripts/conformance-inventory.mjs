import { readFile,writeFile } from 'node:fs/promises';
import { resolve } from 'node:path';
import { execFileSync } from 'node:child_process';
import { PACKAGE_ROOT,sha256 } from '../src/integrity.mjs';
const correction='9d12ea46c6971efd01619bcfdba804431b4149f3';
const destination=resolve(PACKAGE_ROOT,'../cca-conformance/mo1304-conformance-inventory.json');
const paths=['package-lock.json','contracts/limits.json','contracts/policy-contract-identities-1.0.0.json',
'runtime/runtime-closure-manifest.json','distribution/dependency-closure.json','distribution/dependency-lock.json',
'distribution/foundation-inventory.json','measurements/dependency-review.json','measurements/advisory-disposition.json',
'measurements/advisory-source-review.json','measurements/resource-measurement.json','measurements/resource-review.json'];
const identities=[];for(const path of paths){const bytes=await readFile(resolve(PACKAGE_ROOT,path));identities.push({path:`repositories/memoryos-mcp/${path}`,byteLength:bytes.length,sha256:sha256(bytes)});}
let prior;try{prior=JSON.parse(await readFile(destination));}catch{}
const binding=prior?.implementationBinding??{strategy:'postCommitConformanceCommit',status:'PENDING',revision:null,parent:correction};
if(process.argv.includes('--bind')){
 const git=(...args)=>execFileSync('git',args,{cwd:PACKAGE_ROOT,encoding:'utf8',windowsHide:true,env:{...process.env,GIT_OPTIONAL_LOCKS:'0'}}).trim();
 const revision=git('rev-parse','HEAD');
 if(git('show','-s','--format=%s',revision)!=='feat(memoryos-1.3): implement MO-1304 protocol and delegation foundation'||git('rev-parse',`${revision}^`)!==correction)throw new Error('NOT_I1');
 Object.assign(binding,{status:'BOUND',revision});
}
const inventory={kind:'MemoryOSMO1304ConformanceInventory',version:'1.0.0',phase:'phase1Foundation',
 authority:{baseline:'ed4632fc81a6e90835233a848a9a3a118184c02e',cacheCorrection:correction,correctionDocument:'docs/mo1304-contract-freeze-1-cache-correction.md'},
 frozenContract:{protocol:'2026-07-28',serverInfo:{name:'memoryos-mcp',version:'0.1.0'},cache:{methods:['server/discover','tools/list'],placement:'result',ttlMs:0,cacheScope:'private'},
 tools:['memoryos_contract_identities','memoryos_evaluate_policy','memoryos_prepare_policy','memoryos_prepare_policy_set','memoryos_verify_evaluation_identity','memoryos_verify_policy_outcome'],
 semanticOperations:1,semanticQueue:0,subscriptions:1,controlSlots:1,outputFrames:2,semanticCache:false,clientFilesystem:false,network:false,credentials:false},
 implementedPhase1:{transport:'official modern stdio SDK plus bounded transport interface',delegation:'fresh worker -> public MemoryOS SDK -> authoritative runtime',runtimeFiles:25,
 testFiles:['contracts','delegation','dispatcher','integrity','json-limits','process','protocol','security'].map(x=>`repositories/memoryos-mcp/tests/${x}.test.mjs`),
 evidence:prior?.implementedPhase1?.evidence??{status:'PENDING',path:null,sha256:null}},
 measured:{resourceReview:'repositories/memoryos-mcp/measurements/resource-review.json',operationSamples:420,transportSamples:60},identities,implementationBinding:binding,
 phase2:{status:'PENDING',archiveSha256:null,archiveByteLength:null,operationalCertification:null,clientInterop:null},
 phase3:{status:'PENDING',windows11_24H2_x64:null,ubuntu24_04_x64:null,node:'24.21.0',macos:'UNSUPPORTED',platformParity:null},
 releaseBinding:{status:'PENDING',revision:null},tagState:{status:'PENDING',name:'memoryos-1.3-mo1304',object:null}};
await writeFile(destination,JSON.stringify(inventory,null,2)+'\n');process.stdout.write(JSON.stringify({identities:identities.length,binding:binding.status})+'\n');
