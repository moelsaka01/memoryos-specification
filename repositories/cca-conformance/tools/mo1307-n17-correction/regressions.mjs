// One current-source generation: N17 once, twelve publication callbacks once, ninety-four remaining callbacks.
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import {fileURLToPath} from 'node:url';
import {spawn} from 'node:child_process';
import {performance} from 'node:perf_hooks';
import {root,absolute,toolRoot,evidenceRoot,record,write,regressionCases,beginCampaign,verifyBindings,finishCampaign} from './validation-bindings.mjs';
export const n17Id='native-foundation-018';
export const publicationIds=[...Array.from({length:6},(_,i)=>'native-foundation-'+String(i+19).padStart(3,'0')),...Array.from({length:5},(_,i)=>'protocol-publication-correction-'+String(i+20).padStart(3,'0')),'timer-lifetime-001'];
export const requiredEvents=['stdin-finish','stdin-close','stdout-end','stdout-close','stderr-end','stderr-close','exit','close'];
const errorRecord=e=>({name:e.name,code:e.code??null,message:e.message,stack:e.stack});
const escapePattern = value => value.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');

export function inventory() {
  const relative = toolRoot + '/regression-inventory.json';
  const value = JSON.parse(fs.readFileSync(absolute(relative), 'utf8'));
  assert.equal(value.kind, 'MO1307N17CorrectionExactRegressionInventory');
  assert.equal(value.total, 107); assert.equal(value.suites.length, regressionCases.length);
  for (const [index, suite] of value.suites.entries()) {
    const [id, file, expected] = regressionCases[index];
    assert.equal(suite.id, id); assert.equal(suite.file, 'repositories/cca-conformance/tests/' + file);
    assert.equal(suite.expectedTests, expected); assert.equal(suite.names.length, expected);
    assert.equal(new Set(suite.names).size, expected); assert.deepEqual(record(suite.file), suite.source);
    for (const name of suite.names) {
      assert.equal(typeof name, 'string'); assert.ok(name.length > 0 && !/[\r\n]/u.test(name));
      const pattern = new RegExp('^' + escapePattern(name) + '$');
      assert.deepEqual(suite.names.filter(candidate => pattern.test(candidate)), [name]);
    }
  }
  const cases = value.suites.flatMap(suite => suite.names.map((name, index) => ({
    id: suite.id + '-' + String(index + 1).padStart(3, '0'), suite: suite.id, file: suite.file,
    testName: name, suiteNames: suite.names, sourceSuiteTests: suite.expectedTests,
  })));
  assert.equal(cases.length, 107); assert.equal(new Set(cases.map(row => row.id)).size, 107);
  assert.equal(cases.find(row => row.id === n17Id)?.testName, 'N17 native CLI evaluates and publishes exact integrated result');
  return { relative, value, cases };
}

function parseTap(stdout, command) {
  const tap = stdout.toString('utf8');
  const count = key => Number(new RegExp('^# ' + key + ' (\\d+)\\r?$', 'm').exec(tap)?.[1] ?? NaN);
  const tests = Object.fromEntries(['tests', 'pass', 'fail', 'cancelled', 'skipped', 'todo'].map(key => [key, count(key)]));
  const testNames = [...tap.matchAll(/^# Subtest: (.+)\r?$/gm)].map(match => match[1].trimEnd());
  const outcomes = [...tap.matchAll(/^(ok|not ok) \d+ - (.+)\r?$/gm)].map(match => {
    const detail = match[2].trimEnd(), directive = /\s+#\s+(SKIP|TODO)\b.*$/iu.exec(detail);
    return { status: match[1], name: directive ? detail.slice(0, directive.index) : detail, directive: directive?.[1].toUpperCase() ?? null };
  });
  const selected = outcomes.filter(outcome => outcome.name === command.testName);
  const excludedRegistrations = outcomes.filter(outcome => outcome.name !== command.testName);
  const selectedPass = selected.length === 1 && selected[0].status === 'ok' && selected[0].directive === null;
  const excludedOnly = excludedRegistrations.every(outcome => command.suiteNames.includes(outcome.name) && outcome.status === 'ok' && outcome.directive === 'SKIP');
  const countsMatch = tests.pass === 1 && tests.tests === outcomes.length && tests.skipped === excludedRegistrations.length && ['fail', 'cancelled', 'todo'].every(key => tests[key] === 0);
  const registrationsMatch = testNames.length === outcomes.length && new Set(testNames).size === testNames.length && new Set(outcomes.map(outcome => outcome.name)).size === outcomes.length && testNames.every(name => command.suiteNames.includes(name)) && testNames.includes(command.testName);
  return { tests, testNames, selected, excludedRegistrations, passed: selectedPass && excludedOnly && countsMatch && registrationsMatch };
}


export async function observeCommand(command) {
  const events=[],out=[],err=[];let outBytes=0,errBytes=0,closed=false,exitCode=null,signal=null,child,timer,cleanupTimer;
  let failure=null,guardExpired=false,cleanupExpired=false;
  const begin=performance.now(),event=(name,extra={})=>events.push({event:name,elapsedMs:performance.now()-begin,...extra});
  const collect=(chunks,key,bytes)=>{if(key==='stdout')outBytes+=bytes.length;else errBytes+=bytes.length;const total=key==='stdout'?outBytes:errBytes;if(total<=16*1024*1024)chunks.push(Buffer.from(bytes));else failure??={name:'CaptureLimitError',message:'Outer capture exceeded16MiB'};};
  try {
    child=spawn(process.execPath,command.args,{cwd:root,windowsHide:true,shell:false,stdio:['pipe','pipe','pipe'],...(command.env?{env:command.env}:{})});
    child.stdout.on('data',b=>collect(out,'stdout',b));child.stderr.on('data',b=>collect(err,'stderr',b));
    for(const name of ['stdin','stdout','stderr']){child[name].once('close',()=>event(name+'-close'));child[name].on('error',e=>{event(name+'-error',{code:e.code??null});failure??=errorRecord(e);});}
    child.stdin.once('finish',()=>event('stdin-finish'));
    for(const name of ['stdout','stderr'])child[name].once('end',()=>event(name+'-end'));
    child.once('exit',(code,sig)=>{exitCode=code;signal=sig;event('exit',{code,signal:sig});});
    await new Promise(resolve=>{
      child.once('error',e=>{failure??=errorRecord(e);event('error',{code:e.code??null});});
      child.once('close',(code,sig)=>{closed=true;exitCode=code;signal=sig;event('close',{code,signal:sig});resolve();});
      timer=setTimeout(()=>{
        guardExpired=true;event('outer-guard-expired');failure??={name:'OuterGuardError',message:'Engineering outer process guard expired'};
        child.stdin.destroy();if(!closed)child.kill();
        cleanupTimer=setTimeout(()=>{cleanupExpired=true;event('outer-cleanup-unconfirmed');child.stdout.destroy();child.stderr.destroy();child.unref();resolve();},2000);
      },command.outerGuardMs);
      child.stdin.end();
    });
  }catch(e){failure??=errorRecord(e);}
  finally{clearTimeout(timer);clearTimeout(cleanupTimer);}
  const allRequiredObserved=requiredEvents.every(name=>events.some(row=>row.event===name));
  return {pid:child?.pid??null,exitCode,signal,error:failure,elapsedMs:performance.now()-begin,stdout:Buffer.concat(out),stderr:Buffer.concat(err),
    settlement:{observed:true,scope:'Actual outer spawned process only; no inner CLI/helper/worker event telemetry',requiredEvents,events,allRequiredObserved,guardExpired,cleanupExpired,closed,cleanupAllowanceMs:2000}};
}
export function selectedCommand(row,mode){
  return {...row,args:['--test','--test-reporter=tap','--test-concurrency=1',...(mode==='n17'?['--test-isolation=none']:[]),'--test-name-pattern=^'+escapePattern(row.testName)+'$',row.file],expectedTests:1,outerGuardMs:90000};
}
function captureN17(context,pid){
  assert.ok(Number.isSafeInteger(pid)&&pid>0);
  const directory=path.join(root,'.cache','mo1307','phase1','native-foundation-'+pid),out=path.join(directory,'cli-integrated-ready'),finalName='memoryos-readiness-result.json';
  const capture={kind:'MO1307N17PublicationCapture',result:'FAIL',fixtureProcessPid:pid,directory,output:out,files:[],nativeTelemetry:false,
    expectedSuccessfulProtocolSlots:9,perHelperTelemetryCaptured:false,
    innerCliSettlementBasis:'Original selected callback spawnSync returns with status0 and complete stdout/stderr; original exact summary/result/final-only assertions pass. Bound CLI finally awaits supervisor.dispose. This is source-supported inner settlement, not serialized native child events.'};
  try{
    assert.deepEqual(fs.readdirSync(directory),['cli-integrated-ready']);assert.equal(fs.lstatSync(out).isSymbolicLink(),false);
    assert.deepEqual(fs.readdirSync(out),[finalName]);assert.equal(fs.lstatSync(path.join(out,finalName)).isFile(),true);assert.equal(fs.lstatSync(path.join(out,finalName)).isSymbolicLink(),false);
    const fixture='repositories/cca-conformance/fixtures/mo1307/bundles/ready';
    const result=fs.readFileSync(path.join(out,finalName)),expected=fs.readFileSync(absolute(fixture+'/expected-result.json'));
    assert.deepEqual(result,expected);capture.finalOnly=true;capture.exactResult=true;
    for(const [name,bytes]of [[finalName,result],['expected-result.json',expected],['expected-summary.json',fs.readFileSync(absolute(fixture+'/expected-summary.json'))]]){
      const target=context.output+'/'+name;write(target,bytes);capture.files.push(record(target));
    }
    const cli='repositories/memoryos-readiness/src/cli.mjs',source=fs.readFileSync(absolute(cli),'utf8');
    assert.ok(source.includes('await writeSummary(stdout, summary, supervisor'));assert.ok(source.includes('finally { if (supervisor) await supervisor.dispose(); }'));
    capture.sourceGates=[record(cli),record('repositories/memoryos-readiness/src/runtime.mjs'),record('repositories/memoryos-readiness/src/helper-transport.mjs'),record('repositories/cca-conformance/tests/mo1307_phase1_native_test.mjs')];
    capture.result='PASS';
  }catch(e){capture.failure=errorRecord(e);throw e;}
  finally{write(context.output+'/publication-capture.json',capture);}
  return capture;
}
export async function executeSelected(context,command,{capture=false}={}){
  verifyBindings(context);const result=await observeCommand(command);
  const out=context.output+'/'+command.id+'.stdout.txt',err=context.output+'/'+command.id+'.stderr.txt';
  write(out,result.stdout);write(err,result.stderr);
  const row={...command,executable:process.execPath,pid:result.pid,exitCode:result.exitCode,signal:result.signal,error:result.error,elapsedMs:result.elapsedMs,stdout:record(out),stderr:record(err),settlement:result.settlement,result:'FAIL'};
  try{
    assert.equal(result.error,null);assert.equal(result.exitCode,0);assert.equal(result.signal,null);assert.equal(result.settlement.allRequiredObserved,true);assert.equal(result.settlement.guardExpired,false);assert.equal(result.settlement.cleanupExpired,false);
    if(command.expectedTests===1){const parsed=parseTap(result.stdout,command);Object.assign(row,parsed);assert.equal(parsed.passed,true);}
    else{row.packageCheck=JSON.parse(result.stdout);assert.equal(row.packageCheck.members,89);assert.equal(row.packageCheck.contractMembers,53);assert.equal(row.packageCheck.externalProductionDependencies,0);}
    if(capture){captureN17(context,result.pid);row.publicationCapture=record(context.output+'/publication-capture.json');}
    verifyBindings(context);row.result='PASS';
  }catch(e){row.failure=errorRecord(e);}
  finally{write(context.output+'/'+command.id+'.receipt.json',row);}
  return row;
}
export async function runSelectedRegressionStage(mode){
  assert.ok(['n17','regressions'].includes(mode));const declared=inventory(),context=beginCampaign(mode);
  const selectedCases=mode==='n17'?declared.cases.filter(row=>row.id===n17Id):declared.cases.filter(row=>row.id!==n17Id&&!publicationIds.includes(row.id));
  assert.equal(selectedCases.length,mode==='n17'?1:94);const rows=[];let failure=null,priorIds=[],sameGeneration=[];
  try{
    if(mode==='regressions'){
      for(const stage of ['n17','publication']){
        const file=evidenceRoot+'/'+stage+'/receipt.json',prior=JSON.parse(fs.readFileSync(absolute(file)));
        assert.equal(prior.result,'PASS');assert.equal(prior.sourcesUnchanged,true);assert.equal(prior.sourceIdentity,context.manifest.sourceIdentity);assert.deepEqual(prior.source,context.manifestBinding);
        assert.deepEqual(prior.completedSelectedIds,stage==='n17'?[n17Id]:publicationIds);
        priorIds.push(...prior.completedSelectedIds);sameGeneration.push(record(file));
      }
    }
    const commands=[...(mode==='regressions'?[{id:'package-check',args:['repositories/cca-conformance/tools/mo1307-phase1/package.mjs','check'],expectedTests:null,outerGuardMs:60000}]:[]),...selectedCases.map(row=>selectedCommand(row,mode))];
    write(context.output+'/plan.json',{mode,commands,inventory:record(declared.relative),freshSelectedTests:selectedCases.length,total:107,n17Once:true,publicationCallbacksOnce:true,historicalResultsPromoted:0,stopBoundary:'After every selected callback, before the next command',productDeadlinesUnchanged:true});
    for(const command of commands){const row=await executeSelected(context,command,{capture:mode==='n17'});rows.push(row);console.log(JSON.stringify({stage:mode,id:row.id,result:row.result}));assert.equal(row.result,'PASS','Required selected test failed: '+command.id);}
  }catch(e){failure=errorRecord(e);}
  finally{
    const freshIds=rows.filter(row=>row.expectedTests===1&&row.result==='PASS').map(row=>row.id),combinedIds=[...priorIds,...freshIds];
    if(failure===null){try{assert.deepEqual([...combinedIds].sort(),(mode==='n17'?selectedCases:declared.cases).map(row=>row.id).sort());}catch(e){failure=errorRecord(e);}}
    finishCampaign(context,{suite:mode==='n17'?'N17-first':'existing107-completed',result:failure?'FAIL':'PASS',expectedTests:mode==='n17'?1:107,freshSelectedTests:selectedCases.length,freshSelectedTestPasses:freshIds.length,selectedTestPasses:combinedIds.length,completedSelectedIds:combinedIds,sameGeneration,sameGenerationN17:mode==='regressions'?record(evidenceRoot+'/n17/receipt.json'):null,sameGenerationPublication:mode==='regressions'?record(evidenceRoot+'/publication/receipt.json'):null,historicalResultsPromoted:0,commands:rows,notRun:selectedCases.filter(row=>!rows.some(done=>done.id===row.id)).map(row=>row.id),failure,scope:'N17 once +12 publication callbacks once +94 other fresh callbacks =107. Supplemental negatives/nativeFS/security/TOCTOU separately mandatory.'});
  }
}
if(process.argv[1]&&path.resolve(process.argv[1])===fileURLToPath(import.meta.url))await runSelectedRegressionStage('regressions');
