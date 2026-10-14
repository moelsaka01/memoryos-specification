// Final finite N15-candidate security/native subset; stage L or M, no semantic evaluations. No production edits, synthetic helper frames, or retries.
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { spawnSync, spawn } from 'node:child_process';
import { pathToFileURL } from 'node:url';
import { performance } from 'node:perf_hooks';
import { randomBytes } from 'node:crypto';
import { root, E, packageRoot, HEAD, C3RB, C3R, env, hash, record, inventory, write, put, git, identity } from './common.mjs';

identity();
const mode=process.argv[2];assert.ok(['L','M'].includes(mode));
const evidence = path.join(E, 'security-'+mode);
const scratch = path.join(root, '.cache/m7n1/security-'+mode);
assert.equal(fs.existsSync(evidence), false, 'One-shot evidence destination already exists');
assert.equal(fs.existsSync(scratch), false, 'One-shot fixture destination already exists');
fs.mkdirSync(evidence); fs.mkdirSync(scratch);
const importPart = leaf => import(pathToFileURL(path.join(packageRoot, 'src', leaf)).href);
const [protocol, transport, runtime, paths, publication, args, canonical, constants] = await Promise.all(
  ['helper-protocol.mjs','helper-transport.mjs','runtime.mjs','windows-paths.mjs','publication.mjs','cli-args.mjs','canonical.mjs','constants.mjs'].map(importPart));
const D = constants.DEFINITIONS;
const launch = transport.helperLaunchSpecification();
assert.equal(launch.executable, 'C:\\Windows\\System32\\WindowsPowerShell\\v1.0\\powershell.exe');
assert.deepEqual(launch.args, ['-NoLogo','-NoProfile','-NonInteractive','-ExecutionPolicy','Bypass','-File',path.join(packageRoot,'helpers/windows-inspect.ps1')]);
assert.deepEqual(launch.options.env, env);
const before = inventory(packageRoot);
assert.equal(before.length, 89);
const helperPin = before.find(x=>x.path==='helpers/windows-inspect.ps1');
assert.ok(helperPin,'Installed candidate helper required');
const save=(name,value)=>write('security-'+mode+'/'+name,value);
const binary=(name,value)=>put('security-'+mode+'/'+name,value);
const rows=[], invocations=[], cliInvocations=[];
const started=performance.now();
let failure=null;
// Prospective provenance gate only; all L/M case bodies below remain inherited.
const candidateGatePath=path.join(E,'candidate-validation-gate.json'),candidateGate=JSON.parse(fs.readFileSync(candidateGatePath,'utf8'));
assert.equal(candidateGate.result,'PASS');assert.equal(candidateGate.candidate,HEAD);assert.deepEqual(before,candidateGate.sourceMembers);
assert.equal(git('rev-parse',HEAD+':repositories/memoryos-readiness').toString().trim(),candidateGate.packageTree);
const productionSource=before.map(p=>record(path.join(root,'repositories/memoryos-readiness',p.path)));
for(let i=0;i<before.length;i++){assert.equal(before[i].sha256,productionSource[i].sha256,before[i].path);assert.equal(before[i].byteLength,productionSource[i].byteLength,before[i].path);}
const changed=git('diff','--name-only',C3RB,HEAD,'--','repositories/memoryos-readiness').toString().trim().split(/\r?\n/);
for(const binding of [...candidateGate.correctionAuthority,...candidateGate.validationReceipts,...candidateGate.validationSupport]){const bytes=fs.readFileSync(binding.absolutePath);assert.equal(bytes.length,binding.byteLength);assert.equal(hash(bytes),binding.sha256);}
save('dependency-analysis.json',{
 kind:'MO1307Phase3AN15SecurityDependencyAnalysis',result:'PASS',candidate:HEAD,productionBaseline:C3RB,olderBaseline:C3R,
 inspectedAt:new Date().toISOString(),installedBefore:before,source:productionSource,changedProduction:changed,
 candidateGate:record(candidateGatePath),exactInstalledCandidateValidatedSourceEquality:true,
 correctionAuthority:candidateGate.correctionAuthority,validationReceipts:candidateGate.validationReceipts,
 provenanceGateAdaptation:'Removed obsolete fixed C3RB helper hash and B2 executable-equality premise. Exact new candidate package tree and all89 installed/source/validated members are now mandatory. No L22/M18 case or expected outcome changed.',
 proof:{wire:'2.0.0',limits:{helper:D.limits.helperDeadlineMs,aggregate:D.limits.helperAggregateDeadlineMs,cli:D.limits.cliDeadlineMs,worker:D.limits.apiDeadlineMs,cleanup:D.limits.cleanupAllowanceMs}},
 historicalResultsPromoted:false,productionEdits:false,network:false,
 preservedLimitations:['Private immutable roots and trusted runtime remain required. No unidentified console-host death or OS-wide isolation is claimed.']
});
save('campaign.json',{kind:'MO1307Phase3ARefreshSecurityCampaign',candidate:HEAD,productionBaseline:C3RB,C3R,startedAt:new Date().toISOString(),
  installedPackage:packageRoot,helper:helperPin,launch,sourceTool:record(new URL(import.meta.url).pathname.replace(/^\/([A-Z]:)/i,'$1')),
  method:'Finite ordered real native helper and actual installed publication/launch-policy cases, stop on first unexpected result, no retry.',
  freshScope:['native filesystem/refusal subset','actual publication collision and replacement','representative environment poison'],
  allowedScratch:scratch,productionEdits:false,network:false});
const input=path.join(scratch,'input');fs.mkdirSync(input);
for(const leaf of ['authority','config','candidate','manifest','evidence']) fs.writeFileSync(path.join(input,leaf+'.bin'),'{}\n');
const pending=D.filenames.pendingResult,final=D.filenames.result;
function request({rootPath=input,relative='evidence.bin',sequence=3,operation='READ_SET',session=randomBytes(32).toString('hex'),empty=false}={}){
  const file=(id,maxBytes,relativePath=id+'.bin')=>({id,maxBytes,path:relativePath,root:'input'});
  return {kind:'MemoryOSReadinessHelperRequest',version:'2.0.0',session,sequence,operation,
    roots:[{id:operation==='READ_SET'?'input':'output',path:rootPath}],
    files:operation!=='READ_SET'||empty?[]:sequence===1?[file('authority',D.limits.authorityBytes),file('config',D.limits.configurationBytes)]
      :sequence===2?[file('candidate',D.limits.candidateBytes),file('manifest',D.limits.manifestBytes)]
      :[file('evidence',D.limits.rawSourceBytes,relative)]};
}
function rawFrame(object){const body=canonical.canonicalBytes(object),prefix=Buffer.alloc(4);prefix.writeUInt32BE(body.length);return Buffer.concat([prefix,body]);}
function nativeFrame(frame,label,validatedRequest=null){
  const ordinal=String(invocations.length+1).padStart(3,'0');
  binary(ordinal+'.request.bin',frame);
  const start=performance.now();
  const child=spawnSync(launch.executable,[...launch.args],{...launch.options,env:{...launch.options.env},input:frame,timeout:D.limits.helperDeadlineMs,maxBuffer:D.limits.helperResponseBytes,encoding:null});
  const row={ordinal,label,pid:child.pid,elapsedMs:performance.now()-start,exit:child.status,signal:child.signal,error:child.error?.code??null,
    requestBytes:frame.length,responseBytes:child.stdout?.length??0,stderrBytes:child.stderr?.length??0,requestDigest:hash(frame),responseDigest:hash(child.stdout??Buffer.alloc(0))};
  invocations.push(row);binary(ordinal+'.response.bin',child.stdout??Buffer.alloc(0));binary(ordinal+'.stderr.bin',child.stderr??Buffer.alloc(0));
  assert.ifError(child.error);assert.equal(child.status,0,label);assert.equal(child.stderr.length,0,label);assert.ok(row.elapsedMs<5000,label);
  const response=validatedRequest?protocol.decodeHelperResponse(child.stdout,validatedRequest):JSON.parse(child.stdout.subarray(4));
  assert.equal(child.stdout.readUInt32BE(0),child.stdout.length-4);
  assert.deepEqual(child.stdout.subarray(4),canonical.canonicalBytes(response));
  row.status=response.status;row.code=response.code;row.nativeConsoleProof='Valid unmodified helper response follows authorized sole-helper membership and self-detachment; no unidentified console-host death is claimed.';
  return {responseBytes:child.stdout,exitConfirmed:true,response};
}
function observe(req,label,expected='OK',code=null,raw=false){
  const response=nativeFrame(raw?rawFrame(req):protocol.encodeHelperRequest(req),label,raw?null:req).response;
  assert.equal(response.status,expected,label);assert.equal(response.code,code,label);
  if(code){assert.deepEqual(response.roots,[]);assert.deepEqual(response.files,[]);}
  return response;
}
async function check(name,action){
  const start=performance.now(),firstInvocation=invocations.length+1;
  try{const detail=await action();rows.push({name,result:'PASS',elapsedMs:performance.now()-start,firstInvocation,lastInvocation:invocations.length,detail:detail??null});}
  catch(error){rows.push({name,result:'FAIL',elapsedMs:performance.now()-start,firstInvocation,lastInvocation:invocations.length,error:String(error.stack)});throw error;}
}
function rejectIdentity(beforeIdentity,afterIdentity){
  assert.throws(()=>paths.assertStableIdentity(beforeIdentity,afterIdentity),e=>e.code==='MO1307_FILESYSTEM_BOUNDARY');
}
async function publicationCase(name,action){
  const output=path.join(scratch,name),sequence=protocol.createHelperSequence('evaluate');
  for(let slot=1;slot<=4;slot++){
    const req=request({sequence:slot,session:sequence.session,rootPath:slot===4?output:input,operation:slot===4?'CHECK_OUTPUT':'READ_SET'});
    const result=nativeFrame(sequence.begin(req),name+'-acquisition-'+slot,req);
    assert.notEqual(sequence.complete(result.responseBytes).status,'ERROR');sequence.helperExited();
  }
  // Actual empty-environment worker ends before native publication. Canned result
  // tests publication machinery only, never claims readiness semantic authority.
  sequence.beginWorker();
  const supervisor=runtime.createSupervisorForTesting({kind:'api'},{workerURL:new URL('./security-worker.mjs',import.meta.url)});
  try{await supervisor.runWorker({});}finally{await supervisor.dispose();}
  sequence.endWorker();
  const inspection=protocol.createPublicationInspection(sequence,output,{checkpoint:()=>sequence.checkpoint(),exchange:async frame=>{
    const req=protocol.decodeHelperRequest(frame),answer=nativeFrame(frame,name+'-'+req.operation,req);
    return {responseBytes:answer.responseBytes,exitConfirmed:answer.exitConfirmed};
  }});
  await action({output,inspection});
}
const outputReject=action=>assert.rejects(action,e=>e.code==='MO1307_OUTPUT');
const poison={NODE_OPTIONS:'--no-warnings',NODE_PATH:path.join(scratch,'bad-modules'),HTTP_PROXY:'http://127.0.0.1:1',
  HTTPS_PROXY:'http://127.0.0.1:1',ALL_PROXY:'http://127.0.0.1:1',NO_PROXY:'invalid',
  AWS_ACCESS_KEY_ID:'MO1307_NONSECRET_SENTINEL',AWS_SECRET_ACCESS_KEY:'MO1307_NONSECRET_SENTINEL',GITHUB_TOKEN:'MO1307_NONSECRET_SENTINEL',
  PATH:path.join(scratch,'bad-path'),PATHEXT:'.BAD',SystemRoot:path.join(scratch,'bad-windows'),WINDIR:path.join(scratch,'bad-windows'),
  POWERSHELL_EXECUTION_POLICY:'Restricted',PSExecutionPolicyPreference:'Restricted'};
async function poisoned(action){
  const saved=new Map(Object.keys(poison).map(k=>[k,process.env[k]]));Object.assign(process.env,poison);
  try{return await action();}finally{for(const [key,value]of saved){if(value===undefined)delete process.env[key];else process.env[key]=value;}}
}
function realCli(name,flags=[],extraEnv={},expected='MO1307_USAGE',exit=10){
  const cli=path.join(packageRoot,'bin/memoryos-readiness.mjs'),start=performance.now();
  const argv=['evaluate','--input-root',input,'--config','missing-config.json','--authority','missing-authority.json',
    '--authority-sha256','sha256:'+'1'.repeat(64),'--candidate-sha256','sha256:'+'2'.repeat(64),'--output-root',path.join(scratch,'cli-'+name)];
  const child=spawnSync(process.execPath,[...flags,cli,...argv],{cwd:packageRoot,env:{...env,...extraEnv},shell:false,windowsHide:true,timeout:7000,maxBuffer:16384});
  binary('cli-'+name+'.stdout.bin',child.stdout??Buffer.alloc(0));binary('cli-'+name+'.stderr.bin',child.stderr??Buffer.alloc(0));
  const row={name,flags,environmentKeys:Object.keys(extraEnv).sort(),elapsedMs:performance.now()-start,exit:child.status,error:child.error?.code??null,stdoutBytes:child.stdout?.length??0,stderrBytes:child.stderr?.length??0};cliInvocations.push(row);
  assert.ifError(child.error);assert.equal(child.status,exit);assert.equal(child.stdout.length,0);
  const lines=child.stderr.toString().trimEnd().split('\n');row.diagnostic=JSON.parse(lines.at(-1));row.bootstrapWarningLines=lines.length-1;
  assert.equal(row.diagnostic.code,expected);assert.ok(!child.stderr.includes('MO1307_NONSECRET_SENTINEL'));
}
try{
  if(mode==='L'){
  await check('ordinary-read-and-seven-field-native-identity',()=>{
    const result=observe(request(),'ordinary');assert.deepEqual(Buffer.from(result.files[0].bytes.join(''),'base64'),Buffer.from('{}\n'));
    assert.deepEqual(Object.keys(result.files[0].identity).sort(),['attributes','byteLength','fileId','finalPath','isDirectory','linkCount','volumeSerial']);
    return result.files[0].identity;
  });
  fs.mkdirSync(path.join(input,'target'));fs.writeFileSync(path.join(input,'target','data.bin'),'native');
  fs.symlinkSync(path.join(input,'target'),path.join(input,'junction'),'junction');
  await check('actual-junction-reparse-refused',()=>observe(request({relative:'junction/data.bin'}),'junction','ERROR','MO1307_FILESYSTEM_BOUNDARY'));
  fs.writeFileSync(path.join(input,'link-source.bin'),'link');
  fs.linkSync(path.join(input,'link-source.bin'),path.join(input,'hard.bin'));
  await check('actual-hardlink-refused',()=>observe(request({relative:'hard.bin'}),'hardlink','ERROR','MO1307_FILESYSTEM_BOUNDARY'));
  fs.mkdirSync(path.join(input,'directory.bin'));
  await check('actual-wrong-type-refused',()=>observe(request({relative:'directory.bin'}),'wrong-type','ERROR','MO1307_FILESYSTEM_BOUNDARY'));
  await check('native-replacement-fresh-identity-and-consumer-refusal',()=>{
    const before=observe(request(),'replacement-before').files[0].identity;
    fs.renameSync(path.join(input,'evidence.bin'),path.join(input,'evidence.old'));
    fs.writeFileSync(path.join(input,'evidence.bin'),'{}\n',{flag:'wx'});
    const after=observe(request(),'replacement-after').files[0].identity;
    assert.notEqual(before.fileId,after.fileId);rejectIdentity(before,after);
    return {before,after,rejection:'MO1307_FILESYSTEM_BOUNDARY',scope:'Real replacement between two native observations, exact production identity-consumer rejection; no concurrent same-read mutation claimed.'};
  });
  await check('native-size-change-freshness-and-consumer-refusal',()=>{
    const before=observe(request(),'size-before').files[0].identity;fs.appendFileSync(path.join(input,'evidence.bin'),'changed');
    const after=observe(request(),'size-after').files[0].identity;assert.notEqual(before.byteLength,after.byteLength);rejectIdentity(before,after);
    return {before,after,rejection:'MO1307_FILESYSTEM_BOUNDARY'};
  });
  await check('native-changed-final-path-and-consumer-refusal',()=>{
    const before=observe(request(),'path-before').files[0].identity;
    fs.renameSync(path.join(input,'evidence.bin'),path.join(input,'renamed.bin'));
    const after=observe(request({relative:'renamed.bin'}),'path-after').files[0].identity;
    assert.equal(before.fileId,after.fileId);assert.notEqual(before.finalPath,after.finalPath);rejectIdentity(before,after);
    fs.renameSync(path.join(input,'renamed.bin'),path.join(input,'evidence.bin'));return {before,after,rejection:'MO1307_FILESYSTEM_BOUNDARY'};
  });
  await check('native-short-alias-final-path-mismatch-refused',()=>{
    const alias='C:\\PROGRA~1';assert.ok(fs.existsSync(alias),'Mandatory final-path alias witness unavailable');
    const resolved=fs.realpathSync.native(alias);assert.notEqual(alias.toLowerCase(),resolved.toLowerCase());
    observe(request({rootPath:resolved,empty:true}),'canonical-final-path');
    observe(request({rootPath:alias,empty:true}),'alias-final-path','ERROR','MO1307_FILESYSTEM_BOUNDARY');
    return {alias,resolved};
  });
  for(const [name,relative]of [['traversal','../evidence.bin'],['ads','evidence.bin:stream'],['reserved','CON'],['trailing-dot','evidence.'],['trailing-space','evidence ']]){
    await check('native-path-refusal-'+name,()=>observe(request({relative}),name,'ERROR','MO1307_FILESYSTEM_BOUNDARY',true));
  }
  for(const [name,rootPath]of [['drive-relative','C:relative'],['unc','\\\\server\\share'],['device','\\\\?\\C:\\data']]){
    await check('native-root-refusal-'+name,()=>observe(request({rootPath}),name,'ERROR','MO1307_FILESYSTEM_BOUNDARY',true));
  }
  await check('native-missing-ancestor-refused',()=>observe(request({relative:'missing/evidence.bin'}),'missing-ancestor','ERROR','MO1307_FILESYSTEM_BOUNDARY'));
  await check('native-missing-file-is-input-failure',()=>observe(request({relative:'absent.bin'}),'missing-leaf','ERROR','MO1307_INPUT'));
  await check('actual-publication-existing-output-preserved',()=>publicationCase('existing-output',async({output,inspection})=>{
    fs.mkdirSync(output);fs.writeFileSync(path.join(output,'sentinel'),'retained');
    await outputReject(()=>publication.createPublication(output,{inspection}));assert.deepEqual(fs.readdirSync(output),['sentinel']);
  }));
  await check('actual-publication-existing-pending-preserved',()=>publicationCase('existing-pending',async({output,inspection})=>{
    const token=await publication.createPublication(output,{inspection});fs.writeFileSync(path.join(output,pending),'retained',{flag:'wx'});
    await outputReject(()=>publication.stagePublication(token,Buffer.from('{}\n')));assert.equal(fs.readFileSync(path.join(output,pending),'utf8'),'retained');assert.equal(fs.existsSync(path.join(output,final)),false);
  }));
  await check('actual-publication-existing-final-preserved',()=>publicationCase('existing-final',async({output,inspection})=>{
    const token=await publication.createPublication(output,{inspection});await publication.stagePublication(token,Buffer.from('{}\n'));
    fs.writeFileSync(path.join(output,final),'retained',{flag:'wx'});await outputReject(()=>publication.finalizePublication(token));
    assert.equal(fs.readFileSync(path.join(output,final),'utf8'),'retained');assert.equal(fs.readFileSync(path.join(output,pending),'utf8'),'{}\n');
  }));
  await check('actual-publication-same-byte-replacement-refused',()=>publicationCase('pending-replacement',async({output,inspection})=>{
    const token=await publication.createPublication(output,{inspection});await publication.stagePublication(token,Buffer.from('{}\n'));
    fs.renameSync(path.join(output,pending),path.join(output,pending+'.old'));fs.writeFileSync(path.join(output,pending),'{}\n',{flag:'wx'});
    await outputReject(()=>publication.finalizePublication(token));assert.equal(fs.existsSync(path.join(output,final)),false);
    assert.equal(fs.readFileSync(path.join(output,pending),'utf8'),'{}\n');
  }));
  }
  if(mode==='M'){
  await check('fixed-production-helper-launch-under-combined-environment-poison',()=>poisoned(async()=>{
    const supervisor=runtime.createSupervisor({kind:'cli'});let observed=null;const frames=[];
    try{
      const helper=transport.createHelperTransportForTesting(supervisor,(executable,argv,options)=>{
        assert.equal(executable,launch.executable);assert.deepEqual(argv,[...launch.args]);assert.deepEqual(options.env,env);
        assert.equal(options.shell,false);assert.equal(options.windowsHide,true);
        observed={executable,args:argv,env:options.env,windowsHide:options.windowsHide,shell:options.shell};
        const child=spawn(executable,argv,options);child.stdout.on('data',data=>frames.push(Buffer.from(data)));return child;
      });
      const req=request(),frame=protocol.encodeHelperRequest(req);binary('environment-helper.request.bin',frame);
      const answer=await helper.exchange(frame);binary('environment-helper.response.bin',answer.responseBytes);
      assert.equal(protocol.decodeHelperResponse(answer.responseBytes,req).status,'OK');assert.equal(answer.exitConfirmed,true);
      assert.ok(!answer.responseBytes.includes('MO1307_NONSECRET_SENTINEL'));
      return {observed,actualNativeResponse:true,snapshot:supervisor.snapshot()};
    }finally{await supervisor.dispose();if(frames.length)binary('environment-helper.observed.bin',Buffer.concat(frames));}
  }));
  await check('actual-worker-empty-environment-execargv-resource-limits',()=>poisoned(async()=>{
    const supervisor=runtime.createSupervisorForTesting({kind:'api'},{workerURL:new URL('./security-worker.mjs',import.meta.url)});
    try{await supervisor.runWorker({});return supervisor.snapshot();}finally{await supervisor.dispose();}
  }));
  for(const [name,extra]of [['node-options-empty',{NODE_OPTIONS:''}],['node-options-option',{NODE_OPTIONS:'--no-warnings'}],['node-path',{NODE_PATH:path.join(scratch,'bad-modules')}]]){
    await check('actual-cli-'+name,()=>realCli(name,[],extra));
  }
  for(const [name,flags]of [['preload',['--require=node:path']],['import',['--import=node:path']],['loader',['--experimental-loader=data:text/javascript,export%20%7B%7D']],['inspect-config',['--inspect-port=0']]]){
    await check('actual-cli-'+name,()=>realCli(name,flags));
  }
  await check('actual-cli-proxy-credential-path-poison-fixed-helper',()=>{
    const cliPoison={...poison,...env};delete cliPoison.NODE_OPTIONS;delete cliPoison.NODE_PATH;
    realCli('combined-poison',[],cliPoison,'MO1307_INPUT',12);
  });
  for(const flag of ['--require=untrusted','--import=untrusted','--loader=untrusted','--experimental-loader=untrusted','--inspect','--inspect-brk','--debug','--debug-brk']){
    await check('launch-guard-'+flag,()=>{assert.throws(()=>args.validateLaunch({platform:'win32',arch:'x64',version:'v24.21.0',execArgv:[flag],environment:env}),e=>e.code==='MO1307_USAGE');return {scope:'Direct unchanged production launch guard; inspector/debug listener not opened.'};});
  }
  }
  assert.deepEqual(inventory(packageRoot),before,'Installed package mutated');
}catch(error){failure={message:String(error.message),stack:String(error.stack),code:error.code??null};process.exitCode=1;}
finally{
  const after=inventory(packageRoot),unchanged=JSON.stringify(before)===JSON.stringify(after);
  save('installed-after.json',{result:unchanged?'PASS':'FAIL',files:after});
  save('receipt.json',{kind:'MO1307Phase3AFinalSecurity',stage:mode,semanticEvaluations:0,result:failure||!unchanged?'FAIL':'PASS',candidate:HEAD,productionBaseline:C3RB,C3R,finishedAt:new Date().toISOString(),
    elapsedMs:performance.now()-started,failure,rows,invocations,cliInvocations,installedUnchanged:unchanged,
    controls:{fixedUnmodifiedInstalledHelper:true,helperWire:'2.0.0',helperDeadlineMs:5000,noRetries:true,productionEdits:false,network:false,persistentPolicyMutation:false},
    limitations:['Replacement/freshness vectors use actual changes between native observations and exact production rejection; deterministic within-single-read races remain excluded by private immutable-root assumptions.',
      'Publication uses exact installed functions, real native frames, and actual worker with canned bytes solely for lifecycle; semantic readiness remains separately certified.',
      'Validated helper responses prove the authorized sole-helper/self-detach success path; no unidentified console-host death is claimed. Timeout cleanup is separate.',
      'Observer/process topology and peak RSS are separate evidence; no OS-wide network isolation or RSS enforcement claimed.',
      'Node bootstrap executes flags before entry; benign builtins/inert loader cover actual guarded CLI refusal. Inspect/debug activation is guarded directly with no network listener.',
      'Synthetic nonsecret credential sentinels only, no real credential read or logged.']});
  process.stdout.write(JSON.stringify({result:failure||!unchanged?'FAIL':'PASS',rows:rows.length,helperInvocations:invocations.length,cliInvocations:cliInvocations.length,elapsedMs:performance.now()-started,failure})+'\n');
}


