// Finite Phase2D regressions. Original accepted receipts remain immutable.
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
assert.ok(['cheap','phase1','phase2a','phase2b','phase2c'].includes(group));
assert.ok([evidence+'/regressions/','.cache/mo1307/phase2d/post-binding/'].some(prefix=>absolute.startsWith(path.resolve(root,prefix)+path.sep)));
assert.ok(!fs.existsSync(absolute),'attempt directories are single-use');fs.mkdirSync(absolute,{recursive:true});
const testRoot='repositories/cca-conformance/tests/';
const tests=group==='phase1'?['core','fixtures','package','native'].map(n=>testRoot+'mo1307_phase1_'+n+'_test.mjs'):
 group==='phase2a'?['core','result'].map(n=>testRoot+'mo1307_phase2a_'+n+'_test.mjs'):
 group==='phase2b'?fs.readdirSync(path.join(root,testRoot)).filter(n=>/^mo1307_phase2b_.*_test\.mjs$/.test(n)).sort().map(n=>testRoot+n):
 group==='phase2c'?['runtime','publication','finalization','publication_wait','correction','surfaces','supplement','api_bootstrap','launch_policy','timer_lifetime'].map(n=>testRoot+'mo1307_phase2c_'+n+'_test.mjs'):[];
const expected={phase1:105,phase2a:84,phase2b:172,phase2c:219}[group];
const inputs=new Set([...packageFiles.map(p=>'repositories/memoryos-readiness/'+p),...tests,
 'repositories/cca-conformance/tools/mo1307-phase2d/common.mjs','repositories/cca-conformance/tools/mo1307-phase2d/regression.mjs']);
function add(relative){for(const entry of fs.readdirSync(path.join(root,relative),{withFileTypes:true}).sort((a,b)=>a.name<b.name?-1:a.name>b.name?1:0)){const p=relative+'/'+entry.name;if(entry.isDirectory())add(p);else inputs.add(p);}}
for(const relative of ['repositories/cca-conformance/fixtures/mo1307',...['mo1307-phase1','mo1307-phase2a','mo1307-phase2b','mo1307-phase2c-correction','mo1307-phase2c-resumed','mo1307-phase2c-continuation','mo1307-phase2c-finalization-correction'].map(n=>'repositories/cca-conformance/tools/'+n)])add(relative);
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
}else run('tests',process.execPath,['--test','--test-reporter=tap','--test-concurrency=1',...tests],group==='phase1'?90000:60000);
const vectors=[];
if(okay&&group==='phase2a'){
 try{const {bundleNames,loadProjection}=await import('../mo1307-phase2a/fixture-projection.mjs');const {computeReadiness}=await import('../../../memoryos-readiness/src/readiness-core.mjs');const {projectReadinessResult}=await import('../../../memoryos-readiness/src/readiness-result.mjs');
  for(const name of bundleNames){const f=loadProjection(name),a=computeReadiness(f.verified);assert.deepEqual(a.resultBytes,f.expectedBytes);assert.deepEqual(projectReadinessResult(a.result,'json'),f.summaryBytes);const reordered=structuredClone(f.verified);reordered.claims.reverse();reordered.slots.reverse();const b=computeReadiness(reordered);assert.deepEqual(a.resultBytes,b.resultBytes);assert.equal(a.readinessDigest,b.readinessDigest);assert.equal(a.proofBindingDigest,b.proofBindingDigest);vectors.push({name,result:'PASS',resultSha256:hash(a.resultBytes),readinessDigest:a.readinessDigest,proofBindingDigest:a.proofBindingDigest});}assert.equal(vectors.length,16);
 }catch(error){okay=false;write(output+'/vector-failure.json',{message:error.message,stack:error.stack});}
}
if(okay&&group==='phase2b'){
 try{const {loadBundle,inputOf}=await import('../mo1307-phase2b/test-support.mjs');const {verifyEvidence,verifyResultEvidence}=await import('../../../memoryos-readiness/src/evidence-verifier.mjs');const {canonicalBytes}=await import('../../../memoryos-readiness/src/canonical.mjs');
  for(const name of fs.readdirSync(path.join(root,'repositories/cca-conformance/fixtures/mo1307/bundles')).sort()){const b=loadBundle(name),a=verifyEvidence(inputOf(b));verifyResultEvidence(inputOf(b),canonicalBytes(b.result));vectors.push({name,result:'PASS',projectionSha256:hash(canonicalBytes(a.projection)),auditSha256:hash(canonicalBytes(a.audit))});}assert.equal(vectors.length,16);
 }catch(error){okay=false;write(output+'/vector-failure.json',{message:error.message,stack:error.stack});}
}
if(vectors.length)write(output+'/vectors.json',vectors);
let sourcesUnchanged=true;try{for(const item of bindings)check(item);}catch(error){sourcesUnchanged=false;okay=false;write(output+'/source-change.json',{message:error.message});}
write(output+'/inputs-after.json',[...inputs].sort().map(p=>record(p)));
const receipt={kind:'MO1307Phase2DRegression',result:okay?'PASS':'FAIL',group,runtime:{version:process.version,platform:process.platform,arch:process.arch,sha256:pin},commands:rows,expectedTests:expected??null,exactVectors:vectors.length,sourceBindings:bindings.length,sourcesUnchanged,
 scope:group==='phase2c'?'124 runtime/publication +94 surface/inspection/API/CLI +1 timer top-level; subsets57/24/24/7/13 are not added again. Synthetic framed transport and fixed engineering workers remain explicitly engineering; R21 and public API guard replacements execute integrated production semantics. Two queued actual rename cases remain bounded engineering witnesses.':group==='phase1'?'105 retained Phase1 tests with C29/N17 adapted from removed guards to exact integrated results; N15/N16 actual helper and N17 actual CLI.':'Shared deterministic validation and accepted semantic regression only; no native campaign.',network:false,predecessorCampaignsRun:false,sourceWorktreesWritten:false};write(output+'/receipt.json',receipt);console.log(JSON.stringify({group,result:receipt.result,expectedTests:receipt.expectedTests,exactVectors:receipt.exactVectors,sourcesUnchanged}));process.exitCode=okay?0:1;
