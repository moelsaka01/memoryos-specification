import { spawn,execFileSync } from 'node:child_process';
import { readFile,writeFile,mkdir } from 'node:fs/promises';
import { resolve,dirname,delimiter } from 'node:path';
import { PACKAGE_ROOT,sha256,exactFiles } from '../src/integrity.mjs';
const workspace=resolve(PACKAGE_ROOT,'../..'),conformance=resolve(PACKAGE_ROOT,'../cca-conformance');
if(process.versions.node!=='24.21.0')throw new Error('WRONG_RUNTIME');
const npm=resolve(dirname(process.execPath),'node_modules/npm/bin/npm-cli.js');
if(execFileSync(process.execPath,[npm,'--version'],{encoding:'utf8',windowsHide:true}).trim()!=='11.19.0')throw new Error('WRONG_NPM');
const python=process.env.MEMORYOS_CONFORMANCE_PYTHON;if(!python)throw new Error('PYTHON_REQUIRED');
const env={...process.env,PATH:dirname(process.execPath)+delimiter+process.env.PATH,GIT_OPTIONAL_LOCKS:'0',NO_COLOR:'1',TZ:'UTC'};
delete env.NODE_TEST_CONTEXT;delete env.FORCE_COLOR;
const focused=['mip_canonical','memory_investigation_package','mip_schema_conformance','mip_adversarial_conformance','mip_ordering_conformance','mip_derived_edge_conformance','mip_pipeline_conformance','investigation_core','memoryos_sdk'];
const runs=[
 ['phase2-package',process.execPath,['--test','--test-concurrency=1','--test-reporter=tap','tests/*.test.mjs'],PACKAGE_ROOT],
 ...['mo1301','mo1302-phase3','mo1303-phase3'].map(name=>[name,process.execPath,[npm,'run',`test:${name}`],conformance]),
 ['focused-sdk-core-mip',process.execPath,['--test','--test-concurrency=1','--test-reporter=tap',...focused.map(name=>`tests/${name}_test.mjs`)],resolve(PACKAGE_ROOT,'../cca-studio')],
 ['workspace',python,['tools/verify_workspace.py','--root','.'],workspace],
 ['diff-check','git',['diff','--check'],workspace],
];
const packageReceipt=JSON.parse(await readFile(resolve(PACKAGE_ROOT,'measurements/phase2-package-receipt.json')));
const code=[];for(const directory of ['tests','scripts'])for(const path of await exactFiles(resolve(PACKAGE_ROOT,directory))){const full=`${directory}/${path}`,bytes=await readFile(resolve(PACKAGE_ROOT,full));code.push({path:full,byteLength:bytes.length,sha256:sha256(bytes)});}
const receipt={kind:'MemoryOSMO1304Phase2Validation',version:'1.0.0',node:process.versions.node,nodeExecutableSha256:sha256(await readFile(process.execPath)),npm:'11.19.0',archiveSha256:packageReceipt.archive.sha256,platformCertification:'PENDING_PHASE3',code,status:'RUNNING',runs:[]};
const logs=resolve(workspace,'.cache/mo1304-phase2-validation');await mkdir(logs,{recursive:true});
const destination=resolve(PACKAGE_ROOT,'measurements/phase2-validation.json');
async function run([label,command,args,cwd]){
 const start=performance.now();const result=await new Promise((done,reject)=>{
  const child=spawn(command,args,{cwd,env,windowsHide:true,stdio:['ignore','pipe','pipe']});let stdout='',stderr='',oversize=false;
  const timer=setTimeout(()=>{child.kill();reject(new Error(`VALIDATION_TIMEOUT:${label}`));},1800000);
  const collect=key=>chunk=>{if(key==='stdout')stdout+=chunk;else stderr+=chunk;if(Buffer.byteLength(stdout)+Buffer.byteLength(stderr)>8*1024*1024){oversize=true;child.kill();}};
  child.stdout.on('data',collect('stdout'));child.stderr.on('data',collect('stderr'));
  child.on('error',error=>{clearTimeout(timer);reject(error);});child.on('close',exitCode=>{clearTimeout(timer);done({exitCode:oversize?1:exitCode,stdout,stderr});});
 });
 const count=name=>Number([...result.stdout.matchAll(new RegExp(`^(?:#|ℹ) ${name} ([0-9]+)$`,'gmu'))].at(-1)?.[1]??0);
 const entry={label,arguments:args.map(x=>x===npm?'npm-cli.js':x),exitCode:result.exitCode,durationMs:performance.now()-start,tests:count('tests'),pass:count('pass'),fail:count('fail'),cancelled:count('cancelled'),skipped:count('skipped'),todo:count('todo'),stdout:{byteLength:Buffer.byteLength(result.stdout),sha256:sha256(Buffer.from(result.stdout))},stderr:{byteLength:Buffer.byteLength(result.stderr),sha256:sha256(Buffer.from(result.stderr))}};
 if(!['workspace','diff-check'].includes(label)&&(!entry.tests||entry.tests!==entry.pass||entry.fail||entry.cancelled||entry.skipped||entry.todo))entry.exitCode=entry.exitCode||1;
 await writeFile(resolve(logs,`${label}.stdout.txt`),result.stdout);await writeFile(resolve(logs,`${label}.stderr.txt`),result.stderr);
 process.stdout.write(JSON.stringify(entry)+'\n');
 if(entry.exitCode!==0)process.stdout.write(result.stdout.slice(-16000)+result.stderr.slice(-4000));return entry;
}
const generate=script=>execFileSync(process.execPath,[`scripts/${script}.mjs`],{cwd:PACKAGE_ROOT,env,windowsHide:true,stdio:'pipe'});
for(const spec of runs){
 if(spec[0]==='mo1301'){generate('review-phase2-supply-chain');generate('phase2-inventory');}
 const entry=await run(spec);receipt.runs.push(entry);receipt.status=entry.exitCode===0?'RUNNING':'FAIL';await writeFile(destination,JSON.stringify(receipt,null,2)+'\n');
 if(entry.exitCode!==0){process.exitCode=1;break;}
}
if(receipt.runs.length===runs.length&&receipt.runs.every(x=>x.exitCode===0)){
 receipt.status='PASS';await writeFile(destination,JSON.stringify(receipt,null,2)+'\n');generate('phase2-inventory');
 const results=[];for(const phase of ['phase1','phase2'])results.push(await run([`mo1304-${phase}`,process.execPath,['--test','--test-reporter=tap',`tests/mo1304_${phase}_conformance_test.mjs`],conformance]));
 const check={kind:'MemoryOSMO1304Phase2ConformanceValidation',version:'1.0.0',node:process.versions.node,archiveSha256:receipt.archiveSha256,status:results.every(x=>x.exitCode===0)?'PASS':'FAIL',runs:results,platformCertification:'PENDING_PHASE3'};
 await writeFile(resolve(PACKAGE_ROOT,'measurements/phase2-conformance-validation.json'),JSON.stringify(check,null,2)+'\n');if(check.status!=='PASS')process.exitCode=1;
}
