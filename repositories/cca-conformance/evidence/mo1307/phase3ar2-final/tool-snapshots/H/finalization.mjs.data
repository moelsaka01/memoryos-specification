// Engineering-only native finalization certification; no production modification.
import fs from 'node:fs';
import fsp from 'node:fs/promises';
import path from 'node:path';
import assert from 'node:assert/strict';
import { pathToFileURL, fileURLToPath } from 'node:url';
import { performance } from 'node:perf_hooks';
import { spawn } from 'node:child_process';
import { setTimeout as sleep, setImmediate as nextTurn } from 'node:timers/promises';
import { root, E, cache, packageRoot, env, hash, record, inventory, write, identity } from './common.mjs';

identity();
const moduleAt = name => import(pathToFileURL(path.join(packageRoot, 'src', name + '.mjs')).href);
const { createSupervisorForTesting } = await moduleAt('runtime');
const { DEFINITIONS } = await moduleAt('constants');
const { createHelperTransport, helperLaunchSpecification } = await moduleAt('helper-transport');
const { createHelperSequence, createPublicationInspection, decodeHelperRequest } = await moduleAt('helper-protocol');
const { parseCliArgs } = await moduleAt('cli-args');
const { acquireCliInputs } = await moduleAt('acquisition');
const { createPublication, stagePublication, finalizePublication, publicationStatus, publicationTransportCheckpoint } = await moduleAt('publication');
const { writeSummary } = await moduleAt('output');
const { summaryProjection } = await moduleAt('projections');
const { ReadinessError } = await moduleAt('errors');

const names = ['timely', 'pre-admission-timeout', 'pre-admission-cancel', 'post-admission-timeout', 'post-admission-cancel', 'native-rename-failure', 'post-commit-stdout-failure'];
const output = path.join(E, 'finalization'), scratch = path.join(cache, 'finalization');
assert.equal(fs.existsSync(output), false, 'Attempt evidence must be fresh');
assert.equal(fs.existsSync(scratch), false, 'Scratch must be fresh');
const fixture = path.join(root, 'repositories/cca-conformance/fixtures/mo1307/bundles/ready');
const pins = JSON.parse(fs.readFileSync(path.join(fixture, 'pins.json')));
const acceptedResultPath=path.resolve(root,process.argv[2]??'');assert.ok(process.argv[2],'Previously accepted primary READY result path is required');
const expected=fs.readFileSync(acceptedResultPath);assert.deepEqual(expected,fs.readFileSync(path.join(fixture,'expected-result.json')));
const before = inventory(packageRoot);
fs.mkdirSync(output, {recursive:true}); fs.mkdirSync(scratch, {recursive:true});
const inputs = new Map();
for (const name of names) {
  const base = path.join(scratch, name); fs.mkdirSync(base);
  const input = path.join(base, 'i'), parent = path.join(base, 'p');
  fs.mkdirSync(input);for(const leaf of ['authority','config','candidate','manifest','evidence'])fs.writeFileSync(path.join(input,leaf+'.bin'),'{}'+String.fromCharCode(10),{flag:'wx'}); fs.mkdirSync(parent);
  fs.writeFileSync(path.join(parent, 'owned-parent.data'), 'Private finalization witness parent.\n', {flag:'wx'});
  inputs.set(name, {base, input, destination:path.join(parent,'r')});
}
const errorRow = e => ({name:e?.name??null,code:e?.code??null,stage:e?.stage??null,message:String(e?.message??e)});
const phase = (token, label) => ({label,at:performance.now(),...publicationStatus(token)});
const namespace = item => ({pendingExists:fs.existsSync(item.pending),finalExists:fs.existsSync(item.final),names:fs.readdirSync(item.destination).sort(),
  pending:fs.existsSync(item.pending)?record(item.pending):null,final:fs.existsSync(item.final)?record(item.final):null});
const metadata = {kind:'MO1307Phase3AR2FinalNativeFinalization',stage:'K',additionalSemanticEvaluations:0,acceptedResult:record(acceptedResultPath),version:'1.0.0',startedAt:new Date().toISOString(),cases:[],result:'INCOMPLETE',
  source:'Exact C3VB installed modules',installedPackage:packageRoot,launch:helperLaunchSpecification(),
  scope:'Installed private production primitives, actual native helper observations, actual engineering worker and native filesystem; trusted engineering interruption/rename-forwarding and closed-pipe seams. No semantic evaluations; staging uses previously accepted primary READY bytes. Not ordinary standalone CLI certification for injected cases.',
  limits:{helperMs:9000,aggregateHelperMs:28000,cliAdmissionMs:30000,workerMs:10000,cleanupMs:2000},
  deadlineClock:'Actual performance.now and production 30000ms timer; no clock or limit override',
  noSyntheticHelperFrames:true,noProductEdits:true,noRetries:true,finiteRenameSettlementClaim:false,engineeringHoldGuardMs:35000,
  tools:[record(fileURLToPath(import.meta.url)),record(path.join(path.dirname(fileURLToPath(import.meta.url)), 'finalization-lock.ps1'))],
  intendedCases:names,fixtureBindings:inventory(fixture),installedBefore:before};
write('finalization/campaign.json',metadata);

async function closedPipe() {
  const child = spawn(process.execPath, ['-e', 'process.stdin.destroy(); process.stdout.write("engineering-pipe-closed\\n");'],
    {cwd:scratch,env,windowsHide:true,shell:false,stdio:['pipe','pipe','pipe']});
  let stdout='',stderr=''; child.stdout.on('data',b=>stdout+=b); child.stderr.on('data',b=>stderr+=b);
  const ended = new Promise((resolve,reject)=>{child.once('error',reject);child.once('close',(code,signal)=>resolve({code,signal}));});
  const result = await ended;
  assert.equal(result.code,0); assert.equal(result.signal,null); assert.equal(child.stdin.destroyed,true);
  return {stream:child.stdin,receipt:{...result,pid:child.pid,stdout,stderr,pipeClosed:true,engineeringProcess:true}};
}
async function holdDenyDelete(pending) {
  const tool = path.join(path.dirname(fileURLToPath(import.meta.url)), 'finalization-lock.ps1');
  const child = spawn('C:\\Windows\\System32\\WindowsPowerShell\\v1.0\\powershell.exe',
    ['-NoLogo','-NoProfile','-NonInteractive','-ExecutionPolicy','Bypass','-File',tool,'-Pending',pending],
    {cwd:scratch,env,windowsHide:true,shell:false,stdio:['pipe','pipe','pipe']});
  let stdout='',stderr='',settled=false; child.stderr.on('data',b=>stderr+=b);
  const ended = new Promise((resolve,reject)=>{child.once('error',reject);child.once('close',(code,signal)=>{settled=true;resolve({code,signal});});});
  const ready = new Promise((resolve,reject)=>{child.stdout.on('data',b=>{stdout+=b;if(/(?:^|\r?\n)LOCK_READY\r?\n/.test(stdout))resolve();});child.once('error',reject);child.once('exit',()=>reject(new Error('Lock process exited before ready: '+stderr)));});
  let timer;
  try { await Promise.race([ready,new Promise((_,reject)=>{timer=setTimeout(()=>reject(new Error('Lock acquisition engineering guard')),10000);})]); }
  catch(error){child.stdin.end();child.kill();await ended.catch(()=>{});throw error;} finally{clearTimeout(timer);}
  return {receipt:{pid:child.pid,kind:'ENGINEERING_FILESHARE_READ_NO_DELETE',pending,ready:true,productRole:false},
    async close(){child.stdin.end('release\n');let guard;try{const result=await Promise.race([ended,new Promise((_,reject)=>{guard=setTimeout(()=>{child.kill();reject(new Error('Lock release engineering guard'));},5000);})]);assert.equal(result.code,0);assert.equal(result.signal,null);return {...result,stdout,stderr,closed:settled};}finally{clearTimeout(guard);}}};
}

async function runCase(name) {
  const item=inputs.get(name); item.pending=path.join(item.destination,'memoryos-readiness-result.json.pending');item.final=path.join(item.destination,'memoryos-readiness-result.json');
  const started=performance.now(), controller=new AbortController();
  const supervisor=createSupervisorForTesting({kind:'cli',signal:controller.signal,started},{workerURL:new URL('./security-worker.mjs',import.meta.url)});
  const sequence=createHelperSequence('evaluate'), transport=createHelperTransport(supervisor);
  const row={name,result:'FAIL',startedAt:new Date().toISOString(),requests:[],states:[],injection:null,renameCalls:0,nativeRenameCalls:0,stdoutBytes:0};
  const originalRename=fsp.rename;
  let token=null, renamePending=null, releaseRename=null, lock=null, cleanupFailure=null;
  const exchange=async frame=>{const request=decodeHelperRequest(frame), at=performance.now();
    const entry={sequence:request.sequence,operation:request.operation,session:request.session,requestBytes:frame.length,requestSha256:hash(frame),startedAt:at};row.requests.push(entry);
    try{const answer=await transport.exchange(frame);entry.elapsedMs=performance.now()-at;entry.responseBytes=answer.responseBytes.length;entry.responseSha256=hash(answer.responseBytes);entry.exitConfirmed=answer.exitConfirmed;assert.equal(entry.exitConfirmed,true);assert.ok(entry.elapsedMs<9000);return answer;}
    catch(e){entry.elapsedMs=performance.now()-at;entry.error=errorRow(e);throw e;}};
  let caught=null;
  try {
    // Small engineering byte inputs exercise native acquisition slots without a semantic evaluation.
    const file=(id,maxBytes)=>({id,path:id+'.bin',root:'input',maxBytes});
    for(let slot=1;slot<=4;slot++){
      const request={kind:'MemoryOSReadinessHelperRequest',version:'2.0.0',session:sequence.session,sequence:slot,
        operation:slot===4?'CHECK_OUTPUT':'READ_SET',roots:[{id:slot===4?'output':'input',path:slot===4?item.destination:item.input}],
        files:slot===1?[file('authority',DEFINITIONS.limits.authorityBytes),file('config',DEFINITIONS.limits.configurationBytes)]:
          slot===2?[file('candidate',DEFINITIONS.limits.candidateBytes),file('manifest',DEFINITIONS.limits.manifestBytes)]:
          slot===3?[file('evidence',DEFINITIONS.limits.rawSourceBytes)]:[]};
      const nativeAnswer=await exchange(sequence.begin(request));
      const nativeResponse=sequence.complete(nativeAnswer.responseBytes);assert.notEqual(nativeResponse.status,'ERROR');
      sequence.helperExited();
    }
    sequence.beginWorker();const engineeringAnswer=await supervisor.runWorker({});sequence.endWorker();
    assert.equal(engineeringAnswer.resultBytes.length,1);
    row.engineeringWorker={semanticEvaluation:false,threadCount:supervisor.snapshot().workers};
    row.resultBytes={...record(acceptedResultPath),scope:'Previously accepted primary READY result bytes; no new semantic evaluation'};
    const inspection=createPublicationInspection(sequence,item.destination,{exchange,checkpoint:()=>supervisor.checkpoint('PUBLICATION')});
    token=await supervisor.waitOperation(createPublication(item.destination,{inspection}));
    row.states.push(phase(token,'created'));
    await supervisor.waitOperation(stagePublication(token,expected),{publicationToken:token});
    row.states.push(phase(token,'staged'));
    assert.deepEqual(fs.readFileSync(item.pending),expected);
    fsp.rename=async(from,to)=>{row.renameCalls++;row.nativeRenameCalls++;return originalRename(from,to);};
    if(name==='pre-admission-timeout'||name==='pre-admission-cancel') {
      row.injection=name==='pre-admission-timeout'?'Bounded engineering idle after actual native staging until unchanged production30s deadline':'Actual AbortController cancellation after actual native staging before admission';
      if(name.endsWith('timeout')) await sleep(Math.max(1,supervisor.deadline-performance.now()+10)); else controller.abort();
      row.beforeFinalization={at:performance.now(),deadline:supervisor.deadline,snapshot:supervisor.snapshot()};
      try{await finalizePublication(token);}catch(e){caught=e;}
      assert.equal(caught?.code,name.endsWith('timeout')?'MO1307_TIMEOUT':'MO1307_CANCELLED');
      assert.equal(row.renameCalls,0);assert.equal(publicationStatus(token).admitted,false);assert.equal(publicationStatus(token).phase,'FAILED');
      assert.equal(fs.existsSync(item.final),false);assert.deepEqual(fs.readFileSync(item.pending),expected);
      row.expectedOperationalCode=caught.code;
    } else if(name==='post-admission-timeout'||name==='post-admission-cancel'||name==='native-rename-failure') {
      row.injection='Trusted engineering forwarding barrier at fs.promises.rename: product admission occurs normally; hold forwarding, observe actual signal/deadline, then forward exactly one real native rename. Not ordinary OS latency proof.';
      let entered,resolveBarrier,rejectBarrier,barrierTimer;
      const admission=new Promise(resolve=>entered=resolve);
      fsp.rename=(from,to)=>{row.renameCalls++;row.renameArgs={from,to};entered();return new Promise((resolve,reject)=>{resolveBarrier=resolve;rejectBarrier=reject;
        releaseRename=async()=>{assert.ok(releaseRename);releaseRename=null;clearTimeout(barrierTimer);row.nativeRenameCalls++;row.nativeRenameStartedAt=performance.now();
          try{const value=await originalRename(from,to);row.nativeRenameSettledAt=performance.now();row.nativeRenameOutcome='SUCCESS';resolve(value);}
          catch(e){row.nativeRenameSettledAt=performance.now();row.nativeRenameOutcome='FAILURE';row.nativeRenameError=errorRow(e);reject(e);}};
        barrierTimer=setTimeout(()=>{row.engineeringGuardExpired=true;releaseRename=null;reject(new Error('Engineering rename hold guard expired'));},35000);});};
      let completed=false;
      renamePending=supervisor.waitFinalization(token,()=>finalizePublication(token));
      renamePending.then(()=>{completed=true;},()=>{completed=true;});
      await Promise.race([admission,renamePending.then(()=>{throw new Error('Finalization settled before rename admission');})]);
      row.states.push(phase(token,'admitted-barrier'));assert.equal(publicationStatus(token).phase,'COMMIT_IN_PROGRESS');assert.equal(publicationStatus(token).dispositionDeadline,null);
      if(name==='post-admission-timeout') await sleep(Math.max(1,supervisor.deadline-performance.now()+10));
      else if(name==='post-admission-cancel') controller.abort();
      else {lock=await holdDenyDelete(item.pending);row.nativeLock=lock.receipt;row.injection+=' Actual Windows FileStream FileShare.Read denies delete on pending during native rename, after all helper inspections.';}
      await nextTurn();
      row.duringBarrier={at:performance.now(),completed,namespace:namespace(item),status:publicationStatus(token),supervisor:supervisor.snapshot()};
      assert.equal(completed,false);assert.equal(fs.existsSync(item.final),false);assert.equal(fs.existsSync(item.pending),true);
      assert.equal(supervisor.snapshot().terminalCode,null,'No terminal timeout/cancellation while rename outstanding');
      if(name==='post-admission-timeout')assert.equal(publicationStatus(token).deadlineExpiredAfterAdmission,true);
      if(name==='post-admission-cancel')assert.equal(publicationStatus(token).cancelledAfterAdmission,true);
      await releaseRename();
      try{await renamePending;}catch(e){caught=e;}
      if(lock){row.nativeLock.release=await lock.close();lock=null;}
      if(name==='native-rename-failure') {
        assert.equal(row.nativeRenameOutcome,'FAILURE');assert.ok(['EPERM','EACCES','EBUSY'].includes(row.nativeRenameError?.code));
        assert.equal(caught?.code,'MO1307_OUTPUT');assert.equal(publicationStatus(token).phase,'FAILED');assert.equal(publicationStatus(token).admitted,true);
        assert.equal(fs.existsSync(item.final),false);assert.deepEqual(fs.readFileSync(item.pending),expected);
      }else{
        assert.equal(caught,null);assert.equal(publicationStatus(token).phase,'COMMITTED');assert.equal(publicationStatus(token).namespaceVerified,true);
        assert.deepEqual(fs.readFileSync(item.final),expected);assert.equal(fs.existsSync(item.pending),false);
        try{supervisor.beginPublicationTransport(token);}catch(e){caught=e;}
        assert.equal(caught?.code,'MO1307_OUTPUT');
      }
      row.expectedOperationalCode='MO1307_OUTPUT';assert.equal(row.renameCalls,1);assert.equal(row.nativeRenameCalls,1);
    } else {
      await supervisor.waitFinalization(token,()=>finalizePublication(token));
      row.states.push(phase(token,'settled'));
      assert.equal(publicationStatus(token).phase,'COMMITTED');assert.equal(publicationStatus(token).namespaceVerified,true);
      supervisor.beginPublicationTransport(token);
      if(name==='post-commit-stdout-failure') {
        row.injection='Production writeSummary writes to an actually closed OS child-stdin pipe; engineering sink only, after actual native commit.';
        const pipe=await closedPipe();row.closedPipe=pipe.receipt;
        try{await writeSummary(pipe.stream,summaryProjection(JSON.parse(expected),'evaluate',null),supervisor,{checkpoint:()=>publicationTransportCheckpoint(token)});}catch(e){caught=e;}
        assert.equal(caught?.code,'MO1307_OUTPUT');row.expectedOperationalCode='MO1307_OUTPUT';
      }else{
        publicationTransportCheckpoint(token);row.expectedOperationalCode=null;
      }
      assert.equal(row.renameCalls,1);assert.equal(row.nativeRenameCalls,1);assert.deepEqual(fs.readFileSync(item.final),expected);assert.equal(fs.existsSync(item.pending),false);
    }
    row.states.push(phase(token,'terminal-observation'));row.namespace=namespace(item);
    row.observedError=caught?errorRow(caught):null;
    assert.equal(row.requests.length,name.startsWith('pre-')?8:9);
    assert.equal(supervisor.snapshot().workers,1);assert.ok(row.requests.every(r=>r.exitConfirmed===true));
    assert.ok(row.requests.every(r=>r.elapsedMs<9000));
    if(caught)await supervisor.terminate(caught);
    row.finalSnapshot=supervisor.snapshot();assert.equal(row.finalSnapshot.activeRole,null);assert.equal(row.finalSnapshot.cleanupConfirmed,true);
    row.result='PASS';
  }catch(e){row.failure=errorRow(e);row.failureStack=String(e?.stack??'');if(token){row.states.push(phase(token,'failure-observation'));row.namespace=namespace(item);}throw e;}
  finally{
    if(releaseRename){try{await releaseRename();}catch{} }
    if(renamePending)await renamePending.catch(()=>{});
    if(lock){try{row.nativeLockRelease=await lock.close();}catch(e){cleanupFailure=e;row.lockCleanupError=errorRow(e);row.result='FAIL';}}
    fsp.rename=originalRename;sequence.abort();await supervisor.dispose();
    row.afterDispose=supervisor.snapshot();row.elapsedMs=performance.now()-started;
    write('finalization/'+name+'.json',row);metadata.cases.push(row);if(cleanupFailure)throw cleanupFailure;
  }
}
let failure=null;
try{for(const name of names)await runCase(name);assert.deepEqual(metadata.cases.map(row=>row.name),names);assert.ok(metadata.cases.every(row=>row.result==='PASS'));metadata.result='PASS';}
catch(e){failure=e;metadata.result='FAIL';metadata.failure=errorRow(e);}
finally{
  const after=inventory(packageRoot);metadata.installedAfter=after;metadata.installedIntegrityUnchanged=JSON.stringify(before)===JSON.stringify(after);
  if(!metadata.installedIntegrityUnchanged){metadata.result='FAIL';failure??=new Error('Installed mutation');}
  metadata.stoppedAt=new Date().toISOString();metadata.completedCases=metadata.cases.length;
  metadata.maxHelperMs=Math.max(0,...metadata.cases.flatMap(c=>c.requests.map(r=>r.elapsedMs??0)));
  metadata.historicalFilesWritten=false;metadata.productionFilesWritten=false;
  write('finalization/receipt.json',metadata);
}
if(failure)throw failure;
process.stdout.write(JSON.stringify({result:metadata.result,cases:metadata.completedCases,maxHelperMs:metadata.maxHelperMs})+'\n');
