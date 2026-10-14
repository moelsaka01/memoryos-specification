// Finite correction witness only; never certification or deadline characterization.
import fs from 'node:fs';
import path from 'node:path';
import assert from 'node:assert/strict';
import {spawnSync} from 'node:child_process';
import {performance} from 'node:perf_hooks';
import {root,evidence,hash,record,check,json,write} from './common.mjs';
import {packageFiles,checkPackage} from '../mo1307-phase1/package.mjs';
import {createSupervisor} from '../../../memoryos-readiness/src/runtime.mjs';
import {createHelperTransport,helperLaunchSpecification} from '../../../memoryos-readiness/src/helper-transport.mjs';
import {decodeHelperRequest,decodeHelperResponse} from '../../../memoryos-readiness/src/helper-protocol.mjs';

assert.equal(process.argv.length,2);
assert.equal(process.version,'v24.21.0'); assert.equal(process.platform,'win32'); assert.equal(process.arch,'x64');
assert.equal(hash(fs.readFileSync(process.execPath)),'sha256:ba4e6d110e8c1592a1ecd390f6b05f3da124b13871a5be62b341a07a853c6c32');
const output=evidence+'/performance',absolute=path.resolve(root,output);
assert.equal(fs.existsSync(absolute),false,'single-use witness; no retry');
const gateBindings=[];
for(const p of ['serialization/attempt1/receipt.json','security/attempt1/receipt.json',...['cheap','package','phase1-native','phase2c','phase2d','vectors'].map(g=>'regressions/'+g+'/receipt.json')]) {
 const receiptPath=evidence+'/'+p,receipt=json(receiptPath);assert.equal(receipt.result,'PASS',p);gateBindings.push(record(receiptPath));
 // Some regression receipts store the complete source list in inputs-before.
 const bindings=Array.isArray(receipt.sourceBindings)?receipt.sourceBindings:json(receiptPath.replace('/receipt.json','/inputs-before.json'));
 assert.ok(bindings.some(b=>b.path==='repositories/memoryos-readiness/helpers/windows-inspect.ps1'),'Gate must bind actual helper '+p);
 for(const binding of bindings){check(binding);gateBindings.push(binding);}
}
checkPackage();
const product='repositories/memoryos-readiness/helpers/windows-inspect.ps1';
const oracle=evidence+'/oracle/c3rb-windows-inspect.ps1';
const cases=['ready','mo1306'].map(name=>{
 const base=evidence+'/security/attempt1/'+name+'-exact';
 const request=record(base+'/request.bin'),expected=record(base+'/candidate.stdout.bin');
 const frame=fs.readFileSync(path.resolve(root,request.path)),q=decodeHelperRequest(frame);
 assert.equal(q.operation,'READ_SET'); assert.equal(q.sequence,3); assert.equal(q.files.length,name==='ready'?19:65);
 const expectedBytes=fs.readFileSync(path.resolve(root,expected.path)); assert.equal(decodeHelperResponse(expectedBytes,q).status,'OK');
 assert.deepEqual(expectedBytes,fs.readFileSync(path.resolve(root,base+'/c3rb.stdout.bin')));
 const inputFiles=q.files.map(f=>record(path.join(q.roots.find(r=>r.id===f.root).path,...f.path.split('/'))));
 assert.equal(inputFiles.reduce((n,m)=>n+m.byteLength,0),name==='ready'?19711:2004208);
 return {name,request,expected,inputFiles};
});
const sourceBindings=[...packageFiles.map(p=>record('repositories/memoryos-readiness/'+p)),record(oracle),record('repositories/cca-conformance/tools/mo1307-phase3a-serialization-correction/performance.mjs'),record('repositories/cca-conformance/tools/mo1307-phase3a-serialization-correction/common.mjs'),record(process.execPath),record('C:/Windows/System32/WindowsPowerShell/v1.0/powershell.exe'),...cases.flatMap(c=>[c.request,c.expected,...c.inputFiles]),...gateBindings];
fs.mkdirSync(absolute,{recursive:true});
write(output+'/campaign.json',{kind:'MO1307SerializationCorrectionPerformancePlan',version:'1.0.0',cases,sourceBindings,
 serialization:{order:['c3rb','candidate','candidate','c3rb','c3rb','candidate'],workloads:['ready','mo1306'],totalTimedSerializations:12,warmups:0,scope:'Response writer plus strict UTF8/LF encoding only; excludes acquisition, startup and JSON fixture loading.',acceptance:'Candidate median serialization time must be at least 10 percent lower for each workload; exact frame equality required for every observation. Bounded engineering witness, not statistical reliability.'},
 product:{order:['ready','mo1306'],maximumHelperExecutions:2,launch:helperLaunchSpecification(),limits:{helper:5000,aggregateHelperActive:20000,cliAdmission:30000,apiWorker:10000,failureCleanup:2000},deadlineOverrides:false,expectedFrames:'Exact independently compared C3RB/C3S native oracle frames'},
 stop:'First unexpected result, byte mismatch, unsupported benefit, timeout, cleanup failure or source drift stops; no retry, replacement or campaign expansion.',cacheState:'Ordinary uncontrolled OS cache; no deliberate warmup or flushing.',certification:false,deadlineCharacterization:false,replacementH:'NOT_ESTABLISHED'});

const quote=s=>"'"+s.replaceAll("'","''")+"'";
const driver=String.raw`$ErrorActionPreference = 'Stop'
Set-StrictMode -Version 2.0
$plan = Get-Content -Raw -LiteralPath ${quote(path.resolve(root,output+'/campaign.json'))} | ConvertFrom-Json
$sources = @{}
foreach ($pair in @(@('c3rb',${quote(path.resolve(root,oracle))}),@('candidate',${quote(path.resolve(root,product))}))) {
    $source = [IO.File]::ReadAllText($pair[1])
    $definitions = $source.Substring(0, $source.IndexOf('# Fixed Win32 signatures'))
    $encoder = if ($pair[0] -eq 'c3rb') { 'Encode-Value' } else { 'Encode-Response' }
    $body = 'param($fixture)' + [char]10 + $definitions + [char]10 + '$watch = [Diagnostics.Stopwatch]::StartNew()' + [char]10 +
        '$bodyBytes = [Text.UTF8Encoding]::new($false,$true).GetBytes((' + $encoder + ' $fixture) + "\x60n")' + [char]10 +
        '$watch.Stop(); return [pscustomobject] @{ bytes = $bodyBytes; elapsedMs = $watch.Elapsed.TotalMilliseconds }'
    $body = $body.Replace('\x60', [string][char]96)
    $sources[$pair[0]] = [scriptblock]::Create($body)
}
$rows = [Collections.Generic.List[object]]::new()
foreach ($case in $plan.cases) {
    $expected = [IO.File]::ReadAllBytes((Join-Path ${quote(root)} $case.expected.path))
    $fixture = [Text.UTF8Encoding]::new($false,$true).GetString($expected,4,$expected.Length-4) | ConvertFrom-Json
    foreach ($side in $plan.serialization.order) {
        $answer = & $sources[$side] $fixture
        if ($answer.bytes.Length -ne $expected.Length-4) { throw 'serialized length differs' }
        $actual = [byte[]]::new($answer.bytes.Length+4)
        $length = [uint32]$answer.bytes.Length
        $actual[0]=[byte](($length-shr 24)-band 255); $actual[1]=[byte](($length-shr 16)-band 255)
        $actual[2]=[byte](($length-shr 8)-band 255); $actual[3]=[byte]($length-band 255)
        [Array]::Copy($answer.bytes,0,$actual,4,$answer.bytes.Length)
        if ([Convert]::ToBase64String($actual) -cne [Convert]::ToBase64String($expected)) { throw 'serialized frame differs' }
        $rows.Add([pscustomobject] @{ case=$case.name; side=$side; elapsedMs=$answer.elapsedMs; exactFrame=$true; byteLength=$actual.Length })
    }
}
$rows.ToArray() | ConvertTo-Json -Depth 5 -Compress
`;
fs.writeFileSync(path.join(absolute,'serializer-driver.ps1'),driver,{flag:'wx'});
write(output+'/execution-claimed.json',{kind:'MO1307SerializationCorrectionPerformanceExecutionClaim',driver:record(output+'/serializer-driver.ps1'),campaign:record(output+'/campaign.json'),maximumProductExecutions:2,maximumTimedSerializations:12,retries:0});
let result='PASS',failure=null;const productRows=[];let serialization=[];let comparison=[];
try {
 const child=spawnSync('C:/Windows/System32/WindowsPowerShell/v1.0/powershell.exe',['-NoLogo','-NoProfile','-NonInteractive','-ExecutionPolicy','Bypass','-File',path.join(absolute,'serializer-driver.ps1')],{cwd:root,windowsHide:true,encoding:null,timeout:60000,maxBuffer:1024*1024});
 fs.writeFileSync(path.join(absolute,'serializer.stdout.txt'),child.stdout??Buffer.alloc(0),{flag:'wx'});fs.writeFileSync(path.join(absolute,'serializer.stderr.txt'),child.stderr??Buffer.alloc(0),{flag:'wx'});
 assert.ifError(child.error);assert.equal(child.status,0,(child.stderr??Buffer.alloc(0)).toString());assert.equal(child.stderr.length,0);
 serialization=JSON.parse(child.stdout.toString('utf8').replace(/^\uFEFF/,''));assert.equal(serialization.length,12);
 const median=values=>values.toSorted((a,b)=>a-b)[1];
 comparison=cases.map(c=>{const old=serialization.filter(r=>r.case===c.name&&r.side==='c3rb'),next=serialization.filter(r=>r.case===c.name&&r.side==='candidate');assert.equal(old.length,3);assert.equal(next.length,3);for(const r of [...old,...next]){assert.equal(r.exactFrame,true);assert.ok(Number.isFinite(r.elapsedMs)&&r.elapsedMs>0);}const baselineMedianMs=median(old.map(r=>r.elapsedMs)),candidateMedianMs=median(next.map(r=>r.elapsedMs));return {case:c.name,baselineMedianMs,candidateMedianMs,reductionPercent:100*(1-candidateMedianMs/baselineMedianMs),result:candidateMedianMs<=baselineMedianMs*0.9?'PASS':'FAIL'};});
 write(output+'/serialization.json',{result:comparison.every(r=>r.result==='PASS')?'PASS':'FAIL',rows:serialization,comparison});
 assert.ok(comparison.every(r=>r.result==='PASS'),'predeclared material benefit not established');
 for(const item of sourceBindings)check(item);
 for(const c of cases){
  const supervisor=createSupervisor({kind:'cli'}),transport=createHelperTransport(supervisor),started=performance.now();let response=null,exchangeMs=null,caseFailure=null;
  try {const answer=await transport.exchange(fs.readFileSync(path.resolve(root,c.request.path)));exchangeMs=performance.now()-started;assert.equal(answer.exitConfirmed,true);fs.writeFileSync(path.join(absolute,c.name+'.response.bin'),answer.responseBytes,{flag:'wx'});response=record(output+'/'+c.name+'.response.bin');assert.deepEqual(answer.responseBytes,fs.readFileSync(path.resolve(root,c.expected.path)));assert.ok(exchangeMs<5000,'whole exchange must remain below frozen5000ms');}
  catch(error){exchangeMs??=performance.now()-started;caseFailure={code:error.code??null,stage:error.stage??null,message:error.message};}
  finally{try{await supervisor.dispose();}catch(error){caseFailure??={code:error.code??null,message:error.message};}}
  const snapshot=supervisor.snapshot();
  try{assert.equal(snapshot.helpers,1);assert.equal(snapshot.workers,0);assert.equal(snapshot.activeRole,null);assert.equal(snapshot.cleanupConfirmed,true);assert.ok(snapshot.helperUsedMs<5000);for(const b of sourceBindings)check(b);}catch(error){caseFailure??={code:error.code??null,message:error.message};}
  const row={case:c.name,result:caseFailure?'FAIL':'PASS',failure:caseFailure,request:c.request,response,exchangeMs,helperActiveMs:snapshot.helperUsedMs,snapshot,deadlineMs:5000};productRows.push(row);write(output+'/'+c.name+'.receipt.json',row);assert.equal(row.result,'PASS',JSON.stringify(caseFailure));
 }
 for(const item of sourceBindings)check(item);
}catch(error){result='FAIL';failure={message:error.message,code:error.code??null,stack:error.stack};}
const preservationFailures=[];for(const item of sourceBindings){try{check(item);}catch(error){result='FAIL';preservationFailures.push({path:item.path,message:error.message});}}
write(output+'/receipt.json',{kind:'MO1307SerializationCorrectionPerformance',version:'1.0.0',result,failure,sourceBindings,sourceBindingsUnchanged:preservationFailures.length===0,preservationFailures,campaign:record(output+'/campaign.json'),claim:record(output+'/execution-claimed.json'),serialization,comparison,productRows,productExecutions:productRows.reduce((n,row)=>n+row.snapshot.helpers,0),retries:0,certification:false,deadlineCharacterization:false,H:'NOT_ESTABLISHED'});
console.log(JSON.stringify({result,failure,comparison,productRows}));process.exitCode=result==='PASS'?0:1;
