// Finite helper dependency-closure regressions; prior evidence and tools are immutable.
import fs from 'node:fs';
import path from 'node:path';
import assert from 'node:assert/strict';
import { spawnSync } from 'node:child_process';
import { performance } from 'node:perf_hooks';
import { root, evidence, hash, record, check, write } from './common.mjs';
import { packageFiles } from '../mo1307-phase1/package.mjs';
const pin='sha256:ba4e6d110e8c1592a1ecd390f6b05f3da124b13871a5be62b341a07a853c6c32';
assert.equal(process.version,'v24.21.0');assert.equal(process.platform,'win32');assert.equal(process.arch,'x64');assert.equal(hash(fs.readFileSync(process.execPath)),pin);
const args=process.argv.slice(2);assert.equal(args.length,4);assert.equal(args[0],'--group');assert.equal(args[2],'--output');
const group=args[1],output=args[3].replaceAll('\\','/'),absolute=path.resolve(root,output);
assert.ok(['cheap','package','phase1-native','phase2c','phase2d','vectors'].includes(group));
assert.ok([evidence+'/regressions/','.cache/mo1307/phase3a-readset-correction/post-binding/'].some(prefix=>absolute.startsWith(path.resolve(root,prefix)+path.sep)));
assert.ok(!fs.existsSync(absolute),'attempt directories are single-use');fs.mkdirSync(absolute,{recursive:true});
const testRoot='repositories/cca-conformance/tests/';
const tests=group==='package'?[testRoot+'mo1307_phase1_package_test.mjs']:
 group==='phase1-native'?[testRoot+'mo1307_phase1_native_test.mjs']:
 group==='phase2c'?['runtime','publication','finalization','publication_wait','correction','surfaces','supplement','api_bootstrap','launch_policy','timer_lifetime'].map(n=>testRoot+'mo1307_phase2c_'+n+'_test.mjs'):
 group==='phase2d'?[testRoot+'mo1307_phase2d_semantic_test.mjs']:[];
const expected={package:8,'phase1-native':25,phase2c:219,phase2d:58}[group];const inputs=new Set([...packageFiles.map(p=>'repositories/memoryos-readiness/'+p),...tests,
 'repositories/cca-conformance/tools/mo1307-phase3a-readset-correction/common.mjs','repositories/cca-conformance/tools/mo1307-phase3a-readset-correction/regression.mjs','repositories/cca-conformance/tools/mo1307-phase3a-readset-correction/selected-vectors.mjs']);
function add(relative){for(const entry of fs.readdirSync(path.join(root,relative),{withFileTypes:true}).sort((a,b)=>a.name<b.name?-1:a.name>b.name?1:0)){const p=relative+'/'+entry.name;if(entry.isDirectory())add(p);else inputs.add(p);}}
for(const relative of ['repositories/cca-conformance/fixtures/mo1307',...['mo1307-phase1','mo1307-phase2a','mo1307-phase2b','mo1307-phase2c-correction','mo1307-phase2c-resumed','mo1307-phase2c-continuation','mo1307-phase2c-finalization-correction','mo1307-phase2d'].map(n=>'repositories/cca-conformance/tools/'+n)])add(relative);
for(const p of ['repositories/cca-conformance/evidence/mo1307/phase2a/acceptance/normative-vectors.json','repositories/cca-conformance/evidence/mo1307/phase2b/development/mo1306-source-lineage.json'])inputs.add(p);
const bindings=[...inputs].sort().map(p=>record(p));write(output+'/inputs-before.json',bindings);
const rows=[];let okay=true;
function run(id,exe,argv,timeout=60000){const started=performance.now();const r=spawnSync(exe,argv,{cwd:root,windowsHide:true,encoding:null,timeout,maxBuffer:16*1024*1024});const out=r.stdout??Buffer.alloc(0),err=r.stderr??Buffer.alloc(0);fs.writeFileSync(path.join(absolute,id+'.stdout.txt'),out,{flag:'wx'});fs.writeFileSync(path.join(absolute,id+'.stderr.txt'),err,{flag:'wx'});const row={id,executable:exe,args:argv,exit:r.status,error:r.error?.code??null,elapsedMs:performance.now()-started,stdout:record(output+'/'+id+'.stdout.txt'),stderr:record(output+'/'+id+'.stderr.txt'),result:r.status===0&&!r.error?'PASS':'FAIL'};
 if(id==='tests'){const text=out.toString('utf8'),number=k=>Number(new RegExp('^# '+k+' (\\d+)$','m').exec(text)?.[1]??NaN);row.tests=Object.fromEntries(['tests','pass','fail','cancelled','skipped','todo'].map(k=>[k,number(k)]));row.testNames=[...text.matchAll(/^# Subtest: (.+)$/gm)].map(m=>m[1]);if(row.tests.tests!==expected||row.tests.pass!==expected||row.tests.fail||row.tests.cancelled||row.tests.skipped||row.tests.todo)row.result='FAIL';}
 rows.push(row);if(row.result!=='PASS')okay=false;console.log(JSON.stringify({id,result:row.result,elapsedMs:row.elapsedMs,tests:row.tests}));}
if(group==='cheap'){
 for(const p of packageFiles.filter(p=>p.endsWith('.mjs')))if(okay)run('syntax-'+p.replaceAll('/','_').replace('.mjs',''),process.execPath,['--check','repositories/memoryos-readiness/'+p]);
 if(okay)run('public-import',process.execPath,['--input-type=module','-e',"import * as api from './repositories/memoryos-readiness/src/index.mjs'; if(Object.keys(api).join(',')!=='evaluateReadiness,verifyReadiness')throw Error('exports'); console.log('public import PASS');"]);
 const python='C:/Users/melsa/.cache/codex-runtimes/codex-primary-runtime/dependencies/python/python.exe';
 if(okay)run('schemas',python,['-I','-S','-B','repositories/cca-conformance/tools/mo1307-phase1/validate-schemas.py']);
 if(okay)run('fixtures',process.execPath,['repositories/cca-conformance/tools/mo1307-phase1/generate-fixtures.mjs','--check']);
 if(okay)run('package',process.execPath,['repositories/cca-conformance/tools/mo1307-phase1/package.mjs','check']);
}else if(group==='vectors')run('vectors',process.execPath,['repositories/cca-conformance/tools/mo1307-phase3a-readset-correction/selected-vectors.mjs'],60000);
else run('tests',process.execPath,['--test','--test-reporter=tap','--test-concurrency=1',...tests],90000);
const vectors=group==='vectors'&&okay?JSON.parse(fs.readFileSync(path.join(absolute,'vectors.stdout.txt'),'utf8')).vectors:[];let sourcesUnchanged=true;try{for(const item of bindings)check(item);}catch(error){sourcesUnchanged=false;okay=false;write(output+'/source-change.json',{message:error.message});}
write(output+'/inputs-after.json',[...inputs].sort().map(p=>record(p)));
const receipt={kind:'MO1307ReadSetCorrectionRegression',result:okay?'PASS':'FAIL',group,runtime:{version:process.version,platform:process.platform,arch:process.arch,sha256:pin},commands:rows,expectedTests:expected??null,exactVectors:vectors.length,sourceBindings:bindings.length,sourcesUnchanged,
 scope:group==='phase2c'?'124 runtime/publication plus94 surfaces/inspection/API/CLI plus1 timer; included subsets57/24/24/7/13 are not added again. Engineering synthetic inspection remains explicit.':group==='phase1-native'?'25 original unmodified Phase1 native/helper tests; actual fixed helper and actual packaged CLI; unchanged5s/20s/30s budgets.':group==='phase2d'?'58 original unmodified integrated semantic tests.':'Deterministic shared shape/package checks and exact selected2A/2B vectors; no certification campaign.',network:false,predecessorCampaignsRun:false,sourceWorktreesWritten:false};write(output+'/receipt.json',receipt);console.log(JSON.stringify({group,result:receipt.result,expectedTests:receipt.expectedTests,exactVectors:receipt.exactVectors,sourcesUnchanged}));process.exitCode=okay?0:1;
