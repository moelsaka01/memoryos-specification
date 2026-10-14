// Final finite Phase 3AR2 C3VB security/native subset; stage L or M, no semantic evaluations. No production edits, synthetic helper frames, or retries.
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { spawnSync, spawn } from 'node:child_process';
import { pathToFileURL } from 'node:url';
import { performance } from 'node:perf_hooks';
import { randomBytes } from 'node:crypto';
import { root, E, packageRoot, C3VB, C3V, env, hash, record, inventory, canonical as canonicalEvidence, write, put, git, identity } from './common.mjs';

identity();
const mode=process.argv[2];assert.ok(['L','M'].includes(mode));
const evidence = path.join(E, 'security-'+mode);
const scratch = path.join(root, '.cache/phase3ar2-final-h3-corrected/security-'+mode);
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
assert.equal(helperPin.sha256, 'sha256:97ef5ae9ce7ab390548b04a2aefba9f922c3e1c6b9b80581c6c274f0b21f0127');
const save=(name,value)=>write('security-'+mode+'/'+name,value);
const binary=(name,value)=>put('security-'+mode+'/'+name,value);
const rows=[], invocations=[], cliInvocations=[];
const started=performance.now();
let failure=null;
const productionTree='b9dabf54572e06c96bb5e48c4e20671f2cc24053';
const packageIdentity='sha256:0890ca4893ef76118eefbb2b5676ad084c60c70408d9e489f92aa33b74ba45b7';
const authorityIdentity='PROSPECTIVE_HELPER_AGGREGATE_BOUND@2.0.0';
const helperAuthorityIdentity='PROSPECTIVE_HELPER_BOUND@2.0.0';
const prospectiveRelative='repositories/cca-conformance/evidence/mo1307/prospective-helper-aggregate-bound-v2-candidate';
const helperAuthorityRelative='repositories/cca-conformance/evidence/mo1307/prospective-helper-bound-v2-candidate/authority.json';
const prospectivePath=leaf=>path.join(root,prospectiveRelative,leaf);
const candidateAuthority=JSON.parse(fs.readFileSync(prospectivePath('candidate.json'),'utf8'));
const bindingVerification=JSON.parse(fs.readFileSync(prospectivePath('binding-verification.json'),'utf8'));
const prospectiveAuthority=JSON.parse(fs.readFileSync(prospectivePath('authority.json'),'utf8'));
const helperAuthority=JSON.parse(fs.readFileSync(path.join(root,helperAuthorityRelative),'utf8'));
const prospectiveRecords={candidate:record(prospectivePath('candidate.json')),bindingVerification:record(prospectivePath('binding-verification.json')),authority:record(prospectivePath('authority.json'))};
assert.equal(git('rev-parse','HEAD').toString().trim(),C3VB);
assert.equal(git('show','-s','--format=%P',C3VB).toString().trim(),C3V);
assert.equal(git('show','-s','--format=%s',C3VB).toString().trim(),bindingVerification.bindingSubject);
assert.equal(git('rev-parse',C3V+'^{tree}').toString().trim(),bindingVerification.candidateRootTree);
assert.equal(git('rev-parse',C3V+':repositories/memoryos-readiness').toString().trim(),productionTree);
assert.equal(git('rev-parse',C3VB+':repositories/memoryos-readiness').toString().trim(),productionTree);
const changedProduction=git('diff','--name-only',C3V,C3VB,'--','repositories/memoryos-readiness').toString().trim().split(/\r?\n/).filter(Boolean);
assert.deepEqual(changedProduction,[]);
assert.equal(candidateAuthority.result,'READY_FOR_BINDING');
assert.equal(candidateAuthority.candidateRole,'C3V');
assert.equal(candidateAuthority.package.packageIdentity,packageIdentity);
assert.equal(candidateAuthority.package.packageMemberCount,89);
assert.deepEqual(candidateAuthority.package.members,before);
assert.equal(hash(canonicalEvidence(before)),packageIdentity);
assert.deepEqual(candidateAuthority.authorities.aggregate,prospectiveRecords.authority);
assert.equal(candidateAuthority.authorities.helper,helperAuthorityIdentity);
assert.equal(candidateAuthority.helper.sha256,helperPin.sha256);
assert.equal(candidateAuthority.limits.helperMs,9000);
assert.equal(bindingVerification.result,'PASS');
assert.equal(bindingVerification.candidateCommit,C3V);
assert.equal(bindingVerification.productionTree,productionTree);
assert.equal(bindingVerification.productionChangesInBindingCommit,false);
assert.ok(bindingVerification.checks.includes('C3VB_BINDING_ONLY'));
assert.equal(prospectiveAuthority.identity,authorityIdentity);
assert.equal(prospectiveAuthority.status,'ADOPTED_PROSPECTIVELY');
assert.equal(prospectiveAuthority.appliesFromCandidate,'C3V');
assert.equal(prospectiveAuthority.valueMs,28000);
assert.equal(prospectiveAuthority.limits.aggregateHelperActiveMs,28000);
assert.equal(prospectiveAuthority.relation.accepted,'helperActiveMs < 28000');
assert.equal(prospectiveAuthority.relation.timeout,'helperActiveMs >= 28000');
assert.equal(helperAuthority.identity,helperAuthorityIdentity);
assert.equal(helperAuthority.valueMs,9000);
assert.equal(prospectiveAuthority.limits.helperMs,9000);
assert.equal(helperAuthority.relation.success,'elapsedMs < 9000');
assert.equal(helperAuthority.relation.timeout,'elapsedMs >= 9000');
assert.equal(D.limits.helperDeadlineMs,helperAuthority.valueMs);
assert.equal(D.limits.helperAggregateDeadlineMs,prospectiveAuthority.valueMs);
const productionSource=before.map(p=>record(path.join(root,'repositories/memoryos-readiness',p.path)));
for(let i=0;i<before.length;i++){
  assert.equal(before[i].byteLength,productionSource[i].byteLength,before[i].path);
  assert.equal(before[i].sha256,productionSource[i].sha256,before[i].path);
  assert.deepEqual(fs.readFileSync(path.join(packageRoot,before[i].path)),fs.readFileSync(path.join(root,'repositories/memoryos-readiness',before[i].path)),before[i].path);
}
save('dependency-analysis.json',{
  kind:'MO1307Phase3AR2C3VBSecurityDependencyAnalysis',result:'PASS',candidate:C3VB,productionCommit:C3V,productionTree,authority:authorityIdentity,
  inspectedAt:new Date().toISOString(),installedBefore:before,source:productionSource,installedSourceByteEqual:true,changedProduction,
  packageIdentity,packageMemberCount:before.length,helperSha256:helperPin.sha256,helperDeadlineMs:helperAuthority.valueMs,aggregateHelperActiveMs:prospectiveAuthority.valueMs,
  prospectiveBindings:{...prospectiveRecords,helperAuthority:record(path.join(root,helperAuthorityRelative))},
  bindingConclusion:'C3VB is the current binding-only candidate over the exact C3V production tree; package, preserved 9000 ms helper authority, and final 28000 ms aggregate authority bindings passed.',
  proof:{nativeCallsUnchanged:true,freshnessBoundariesUnchanged:true,noNewCache:true,wire:'2.0.0',
    limits:{helper:D.limits.helperDeadlineMs,aggregate:D.limits.helperAggregateDeadlineMs,cli:D.limits.cliDeadlineMs,worker:D.limits.apiDeadlineMs,cleanup:D.limits.cleanupAllowanceMs},
    locations:{nativeIdentityRead:'helpers/windows-inspect.ps1 Read-Identity',freshFinalPathComparison:'helpers/windows-inspect.ps1 Assert-SameIdentity final-path comparison',
      fullExpectedIdentityEquality:'helpers/windows-inspect.ps1 Assert-SameIdentity seven-field comparison',
      heldAndReopenedStability:'helpers/windows-inspect.ps1 held handle plus fresh reopen verification',postRead:'helpers/windows-inspect.ps1 post-read identity check',finalInspection:'helpers/windows-inspect.ps1 final output/root inspection'}},
  reusableOnlyWithinUnchangedDependencyClosure:[
    {scope:'Readiness precedence, profiles, gates, provider/history/qualification preservation',sources:['src/readiness-core.mjs','src/readiness-result.mjs','src/projections.mjs','contracts/definitions.json']},
    {scope:'Authority/raw lineage/grant/dependency/reuse/DAG semantics',sources:['src/evidence-verifier.mjs','src/evidence-graph.mjs','src/evidence-history.mjs','src/foundation.mjs','src/integration.mjs']},
    {scope:'Canonical parsing, limits and prototype defenses outside native helper acquisition',sources:['src/canonical.mjs','src/api-input.mjs','src/schema.mjs','src/schema-data.mjs']},
    {scope:'Decision/tag semantics and lack of autonomous release authority',sources:['src/readiness-core.mjs','src/readiness-result.mjs','src/integration.mjs']},
    {scope:'Existing source-review evidence for unchanged worker/environment/network/publication controls; user-required fresh witnesses remain separate',sources:['src/runtime.mjs','src/helper-transport.mjs','src/worker-policy.mjs','src/publication.mjs','src/cli-args.mjs']}
  ],
  correctionEvidenceOnly:[
    record('repositories/cca-conformance/evidence/mo1307/phase3a-readset-correction/helper-security-review.json'),
    record('repositories/cca-conformance/evidence/mo1307/phase3a-readset-correction/security-freshness.json'),
    record('repositories/cca-conformance/evidence/mo1307/phase3a-readset-correction/certification-impact.json')
  ],
  reusedEvidenceDisposition:'Historical source-reviewed unaffected scopes retained; no old PASS reclassified as a new native test. This fresh generation executes the critical native subset.',
  preservedLimitations:['Different-volume escape historically rejected at earlier reparse check; downstream native volumeSerial mismatch not established.',
    'Private immutable roots and trusted runtime remain required; no privileged namespace attacker guarantee.',
    'Correction engineering within-read mutation copies remain engineering evidence, not unmodified-helper fresh results.'],
  productionEdits:false,network:false
});
save('campaign.json',{kind:'MO1307Phase3AR2C3VBSecurityCampaign',candidate:C3VB,productionCommit:C3V,productionTree,authority:authorityIdentity,startedAt:new Date().toISOString(),
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
  assert.ifError(child.error);assert.equal(child.status,0,label);assert.equal(child.stderr.length,0,label);assert.ok(row.elapsedMs<9000,label);
  const response=validatedRequest?protocol.decodeHelperResponse(child.stdout,validatedRequest):JSON.parse(child.stdout.subarray(4));
  assert.equal(child.stdout.readUInt32BE(0),child.stdout.length-4);
  assert.deepEqual(child.stdout.subarray(4),canonical.canonicalBytes(response));
  row.status=response.status;row.code=response.code;row.nativeConsoleProof='Valid unmodified helper response follows owned-console native detach/termination confirmation.';
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
  const engineeringGuardMs=35000;
  const child=spawnSync(process.execPath,[...flags,cli,...argv],{cwd:packageRoot,env:{...env,...extraEnv},shell:false,windowsHide:true,timeout:engineeringGuardMs,maxBuffer:16384});
  binary('cli-'+name+'.stdout.bin',child.stdout??Buffer.alloc(0));binary('cli-'+name+'.stderr.bin',child.stderr??Buffer.alloc(0));
  const row={name,flags,environmentKeys:Object.keys(extraEnv).sort(),engineeringGuardMs,elapsedMs:performance.now()-start,exit:child.status,error:child.error?.code??null,stdoutBytes:child.stdout?.length??0,stderrBytes:child.stderr?.length??0};cliInvocations.push(row);
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
  const expectedCaseNames=mode==='L'
    ?['ordinary-read-and-seven-field-native-identity','actual-junction-reparse-refused','actual-hardlink-refused','actual-wrong-type-refused','native-replacement-fresh-identity-and-consumer-refusal','native-size-change-freshness-and-consumer-refusal','native-changed-final-path-and-consumer-refusal','native-short-alias-final-path-mismatch-refused','native-path-refusal-traversal','native-path-refusal-ads','native-path-refusal-reserved','native-path-refusal-trailing-dot','native-path-refusal-trailing-space','native-root-refusal-drive-relative','native-root-refusal-unc','native-root-refusal-device','native-missing-ancestor-refused','native-missing-file-is-input-failure','actual-publication-existing-output-preserved','actual-publication-existing-pending-preserved','actual-publication-existing-final-preserved','actual-publication-same-byte-replacement-refused']
    :['fixed-production-helper-launch-under-combined-environment-poison','actual-worker-empty-environment-execargv-resource-limits','actual-cli-node-options-empty','actual-cli-node-options-option','actual-cli-node-path','actual-cli-preload','actual-cli-import','actual-cli-loader','actual-cli-inspect-config','actual-cli-proxy-credential-path-poison-fixed-helper','launch-guard---require=untrusted','launch-guard---import=untrusted','launch-guard---loader=untrusted','launch-guard---experimental-loader=untrusted','launch-guard---inspect','launch-guard---inspect-brk','launch-guard---debug','launch-guard---debug-brk'];
  assert.deepEqual(rows.map(row=>row.name),expectedCaseNames);assert.ok(rows.every(row=>row.result==='PASS'));
  assert.deepEqual(inventory(packageRoot),before,'Installed package mutated');
}catch(error){failure={message:String(error.message),stack:String(error.stack),code:error.code??null};process.exitCode=1;}
finally{
  const after=inventory(packageRoot),unchanged=JSON.stringify(before)===JSON.stringify(after);
  save('installed-after.json',{result:unchanged?'PASS':'FAIL',files:after});
  save('receipt.json',{kind:'MO1307Phase3AR2C3VBFinalSecurity',stage:mode,semanticEvaluations:0,result:failure||!unchanged?'FAIL':'PASS',candidate:C3VB,productionCommit:C3V,productionTree,authority:authorityIdentity,finishedAt:new Date().toISOString(),
    elapsedMs:performance.now()-started,failure,rows,invocations,cliInvocations,installedUnchanged:unchanged,
    controls:{fixedUnmodifiedInstalledHelper:true,helperWire:'2.0.0',helperAuthority:helperAuthorityIdentity,helperDeadlineMs:9000,aggregateAuthority:authorityIdentity,aggregateHelperActiveMs:28000,noRetries:true,productionEdits:false,network:false,persistentPolicyMutation:false},
    limitations:['Replacement/freshness vectors use actual changes between native observations and exact production rejection; deterministic within-single-read races remain excluded by private immutable-root assumptions.',
      'Publication uses exact installed functions, real native frames, and actual worker with canned bytes solely for lifecycle; semantic readiness remains separately certified.',
      'Native helper responses prove its prior owned-console quiescence; timeout cleanup is a separate dedicated campaign.',
      'Observer/process topology and peak RSS are separate evidence; no OS-wide network isolation or RSS enforcement claimed.',
      'Node bootstrap executes flags before entry; benign builtins/inert loader cover actual guarded CLI refusal. Inspect/debug activation is guarded directly with no network listener.',
      'Synthetic nonsecret credential sentinels only, no real credential read or logged.']});
  process.stdout.write(JSON.stringify({result:failure||!unchanged?'FAIL':'PASS',rows:rows.length,helperInvocations:invocations.length,cliInvocations:cliInvocations.length,elapsedMs:performance.now()-started,failure})+'\n');
}

