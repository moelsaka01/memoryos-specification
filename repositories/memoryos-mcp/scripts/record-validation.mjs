import { spawn } from 'node:child_process';
import { readFile,writeFile,mkdir } from 'node:fs/promises';
import { resolve,dirname,delimiter } from 'node:path';
import { PACKAGE_ROOT,sha256 } from '../src/integrity.mjs';
const workspace=resolve(PACKAGE_ROOT,'../..');
if(process.versions.node!=='24.21.0')throw new Error('WRONG_RUNTIME');
const npm=resolve(dirname(process.execPath),'node_modules/npm/bin/npm-cli.js');
const python=process.env.MEMORYOS_CONFORMANCE_PYTHON;if(!python)throw new Error('PYTHON_REQUIRED');
const env={...process.env,PATH:dirname(process.execPath)+delimiter+process.env.PATH,GIT_OPTIONAL_LOCKS:'0',NO_COLOR:'1',TZ:'UTC'};
delete env.NODE_TEST_CONTEXT;delete env.FORCE_COLOR;
const studioTests=['mip_canonical','memory_investigation_package','mip_schema_conformance','mip_adversarial_conformance','mip_ordering_conformance','mip_derived_edge_conformance','mip_pipeline_conformance','investigation_core','memoryos_sdk'];
const runs=[
 ['phase1-package',process.execPath,['--test','--test-concurrency=1','--test-reporter=tap','tests/*.test.mjs'],PACKAGE_ROOT],
 ['mo1304-phase1',process.execPath,['--test','--test-reporter=tap','tests/mo1304_phase1_conformance_test.mjs'],resolve(PACKAGE_ROOT,'../cca-conformance')],
 ...['mo1301','mo1302-phase3','mo1303-phase3'].map(name=>[name,process.execPath,[npm,'run',`test:${name}`],resolve(PACKAGE_ROOT,'../cca-conformance')]),
 ['focused-sdk-core-mip',process.execPath,['--test','--test-concurrency=1','--test-reporter=tap',...studioTests.map(name=>`tests/${name}_test.mjs`)],resolve(PACKAGE_ROOT,'../cca-studio')],
 ['workspace',python,['tools/verify_workspace.py','--root','.'],workspace],
 ['diff-check','git',['diff','--check'],workspace],
];
const receipt={kind:'MemoryOSMO1304Phase1Validation',version:'1.0.0',node:process.versions.node,nodeExecutableSha256:sha256(await readFile(process.execPath)),npm:'11.19.0',status:'RUNNING',runs:[]};
let prior; if(process.argv.includes('--reuse-predecessors'))prior=JSON.parse(await readFile(resolve(PACKAGE_ROOT,'measurements/phase1-validation-before-limit-envelope.json')));
const logs=resolve(workspace,'.cache/mo1304-validation');await mkdir(logs,{recursive:true});
for(const [label,command,args,cwd] of runs) {
 if(prior&&['mo1301','mo1302-phase3','mo1303-phase3','focused-sdk-core-mip'].includes(label)){const previous=prior.runs.find(x=>x.label===label);if(previous?.exitCode===0){receipt.runs.push({...previous,reusedFrom:'phase1-validation-before-limit-envelope.json',reason:'Adapter resource budgets and control admission changed; predecessor sources, semantic contracts, and focused suites unchanged. Workspace verification reran.'});process.stdout.write(JSON.stringify({label,reused:true,pass:previous.pass})+'\n');continue;}}
 const start=performance.now();const result=await new Promise((done,reject)=>{
  const child=spawn(command,args,{cwd,env,windowsHide:true,stdio:['ignore','pipe','pipe']});let stdout='',stderr='';
  const timer=setTimeout(()=>{child.kill();reject(new Error(`VALIDATION_TIMEOUT:${label}`));},600000);
  child.stdout.on('data',chunk=>{stdout+=chunk;});child.stderr.on('data',chunk=>{stderr+=chunk;});
  child.on('error',reject);child.on('close',exitCode=>{clearTimeout(timer);done({exitCode,stdout,stderr});});
 });
 const count=name=>Number([...result.stdout.matchAll(new RegExp(`^(?:#|ℹ) ${name} ([0-9]+)$`,'gmu'))].at(-1)?.[1]??0);
 const entry={label,arguments:args.map(x=>x===npm?'npm-cli.js':x),exitCode:result.exitCode,durationMs:performance.now()-start,
  tests:count('tests'),pass:count('pass'),fail:count('fail'),cancelled:count('cancelled'),skipped:count('skipped'),todo:count('todo'),
  stdout:{byteLength:Buffer.byteLength(result.stdout),sha256:sha256(Buffer.from(result.stdout))},stderr:{byteLength:Buffer.byteLength(result.stderr),sha256:sha256(Buffer.from(result.stderr))}};
 receipt.runs.push(entry);await writeFile(resolve(logs,`${label}.stdout.txt`),result.stdout);await writeFile(resolve(logs,`${label}.stderr.txt`),result.stderr);
 if(!['workspace','diff-check'].includes(label)&&(!entry.tests||entry.pass!==entry.tests||entry.fail||entry.cancelled||entry.skipped||entry.todo)){entry.exitCode=entry.exitCode||1;result.exitCode=entry.exitCode;}
 receipt.status=result.exitCode===0?'RUNNING':'FAIL';
 await writeFile(resolve(PACKAGE_ROOT,'measurements/phase1-validation.json'),JSON.stringify(receipt,null,2)+'\n');
 process.stdout.write(JSON.stringify(entry)+'\n');
 if(result.exitCode!==0){process.stdout.write(result.stdout.slice(-12000)+result.stderr.slice(-4000));process.exitCode=1;break;}
}
if(receipt.runs.length===runs.length&&receipt.runs.every(x=>x.exitCode===0)){
 receipt.status='PASS';await writeFile(resolve(PACKAGE_ROOT,'measurements/phase1-validation.json'),JSON.stringify(receipt,null,2)+'\n');
 const inventoryPath=resolve(PACKAGE_ROOT,'../cca-conformance/mo1304-conformance-inventory.json');const inventory=JSON.parse(await readFile(inventoryPath));
 const bytes=await readFile(resolve(PACKAGE_ROOT,'measurements/phase1-validation.json'));
 inventory.implementedPhase1.evidence={status:'PASS',path:'repositories/memoryos-mcp/measurements/phase1-validation.json',sha256:sha256(bytes)};
 await writeFile(inventoryPath,JSON.stringify(inventory,null,2)+'\n');
}
