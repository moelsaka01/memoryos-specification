// Complete affected foundation regression plus retained first-correction tests.
import fs from 'node:fs';
import path from 'node:path';
import assert from 'node:assert/strict';
import {spawnSync} from 'node:child_process';
import {performance} from 'node:perf_hooks';
import {root,evidence,record,check,hash,write,json} from './common.mjs';
import {packageFiles} from '../mo1307-phase1/package.mjs';
assert.equal(process.platform,'win32');assert.equal(process.version,'v24.21.0');
assert.equal(hash(fs.readFileSync(process.execPath)),'sha256:ba4e6d110e8c1592a1ecd390f6b05f3da124b13871a5be62b341a07a853c6c32');
assert.equal(process.argv.length,4);assert.equal(process.argv[2],'--output');
const output=process.argv[3].replaceAll('\\','/'),absolute=path.resolve(root,output);
assert.ok([evidence+'/shared-regression/','.cache/mo1307/phase2c-finalization-correction/post-binding/'].some(p=>absolute.startsWith(path.resolve(root,p)+path.sep)));
assert.ok(!fs.existsSync(absolute));fs.mkdirSync(absolute,{recursive:true});
const walk=p=>fs.readdirSync(path.join(root,p)).sort().flatMap(n=>{const item=p+'/'+n;return fs.statSync(path.join(root,item)).isDirectory()?walk(item):[item];});
const sources=[...packageFiles.map(p=>'repositories/memoryos-readiness/'+p),
  ...['core','fixtures','native','package'].map(p=>'repositories/cca-conformance/tests/mo1307_phase1_'+p+'_test.mjs'),
  'repositories/cca-conformance/tests/mo1307_phase2c_correction_test.mjs',
  'repositories/cca-conformance/tools/mo1307-phase2c-correction/publication-fixture.mjs',
  ...walk('repositories/cca-conformance/tools/mo1307-phase1'),...walk('repositories/cca-conformance/fixtures/mo1307'),
  'repositories/cca-conformance/tools/mo1307-phase2c-finalization-correction/regression.mjs',
  'repositories/cca-conformance/tools/mo1307-phase2c-finalization-correction/common.mjs'].sort().map(p=>record(p));
write(output+'/campaign.json',{kind:'MO1307FinalizationSharedRegressionCampaign',version:'1.0.0',sources,
  expectedPhase1Tests:105,expectedPriorCorrectionTests:24,retries:0,nativeFinalizationCertification:false});
const commands=[];let okay=true;
function run(id,args,timeout){const started=performance.now();const child=spawnSync(process.execPath,args,{cwd:root,encoding:null,timeout,maxBuffer:8*1024*1024,windowsHide:true});
 const out=child.stdout??Buffer.alloc(0),err=child.stderr??Buffer.alloc(0);
 fs.writeFileSync(path.join(absolute,id+'.stdout.txt'),out,{flag:'wx'});fs.writeFileSync(path.join(absolute,id+'.stderr.txt'),err,{flag:'wx'});
 const row={id,args,status:child.status,error:child.error?.code??null,elapsedMs:performance.now()-started,
   stdout:record(output+'/'+id+'.stdout.txt'),stderr:record(output+'/'+id+'.stderr.txt'),result:child.status===0&&!child.error?'PASS':'FAIL'};
 if(id==='prior-correction'){const text=out.toString('utf8'),number=k=>Number(text.match(new RegExp('^# '+k+' (\\d+)$','m'))?.[1]);row.tests=Object.fromEntries(['tests','pass','fail','cancelled','skipped','todo'].map(k=>[k,number(k)]));
   if(row.tests.tests!==24||row.tests.pass!==24||row.tests.fail||row.tests.cancelled||row.tests.skipped||row.tests.todo)row.result='FAIL';}
 commands.push(row);if(row.result!=='PASS')okay=false;console.log(JSON.stringify(row));}
run('phase1',['repositories/cca-conformance/tools/mo1307-phase1/acceptance.mjs','--output',output+'/phase1'],180000);
if(okay)run('prior-correction',['--test','--test-reporter=tap','--test-concurrency=1','repositories/cca-conformance/tests/mo1307_phase2c_correction_test.mjs'],30000);
let sourcesUnchanged=true;try{for(const source of sources)check(source);}catch{sourcesUnchanged=false;okay=false;}
if(okay){const p=json(output+'/phase1/receipt.json');assert.equal(p.result,'PASS');assert.equal(p.commands.find(c=>c.id==='phase1-tests').tests.pass,105);}
write(output+'/receipt.json',{kind:'MO1307FinalizationSharedRegression',version:'1.0.0',result:okay?'PASS':'FAIL',commands,sourcesUnchanged,
  phase1Receipt:fs.existsSync(path.join(absolute,'phase1/receipt.json'))?record(output+'/phase1/receipt.json'):null});
process.exitCode=okay?0:1;
