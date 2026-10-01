// Single-use serial executor for the sealed MO-1307 Phase 3CR2 C3TB campaign.
// Preflight is separate: this file consumes and validates its plan/seal, then
// stops at the first mandatory stage failure without retry or alternate output.
import assert from 'node:assert/strict';
import crypto from 'node:crypto';
import fs from 'node:fs';
import path from 'node:path';
import {spawn,spawnSync} from 'node:child_process';
import {fileURLToPath} from 'node:url';

const root=fileURLToPath(new URL('../../../../',import.meta.url));
const toolRelative='repositories/cca-conformance/tools/mo1307-phase3cr2-c3tb';
const evidenceRelative='repositories/cca-conformance/evidence/mo1307/phase3cr2-c3tb';
const toolRoot=path.join(root,toolRelative),evidenceRoot=path.join(root,evidenceRelative);
const planRelative=`${evidenceRelative}/campaign-plan.json`,sealRelative=`${evidenceRelative}/pre-execution-seal.json`;
const failedPreflightRelative=`${evidenceRelative}/failed-preflight-attempt-1.json`;
const ledgerRelative=`${evidenceRelative}/execution-ledger.json`,startRelative=`${evidenceRelative}/execution-start.json`;
const logRelative=`${evidenceRelative}/stage-logs`,ledgerPath=path.join(root,ledgerRelative),logRoot=path.join(root,logRelative);
const GIT='C:/Program Files/Git/cmd/git.exe';
const BRANCH='codex/mo1307-phase3cr2-c3tb',C3TB='119e68bdcf0ffc906b4ca03a912aadcb25908346';
const C3TB_TREE='5e0088965d4eac4002165fe0190f275c257985ba',C3T='65e24b2debdd70ecb8e52fbccbd6c101621f1917';
const PRODUCTION_TREE='324bf600b6cbfaa8564db27fce2d999711270cb8';
const NODE={version:'v24.21.0',platform:'win32',arch:'x64',byteLength:93580104,sha256:'sha256:ba4e6d110e8c1592a1ecd390f6b05f3da124b13871a5be62b341a07a853c6c32'};
const EXPECTED_NODE_PATH=path.join(root,'.cache/mo1307-phase3cr2-runtime/node.exe');
const FIXED_ENV=Object.freeze({SystemRoot:'C:\\Windows',WINDIR:'C:\\Windows'});
const slash=value=>value.replaceAll('\\','/');
const canonical=value=>value===null||typeof value!=='object'?JSON.stringify(value):Array.isArray(value)?`[${value.map(canonical).join(',')}]`:`{${Object.keys(value).sort().map(key=>`${JSON.stringify(key)}:${canonical(value[key])}`).join(',')}}`;
const canonicalBytes=value=>Buffer.from(`${canonical(value)}\n`);
const sha256=bytes=>`sha256:${crypto.createHash('sha256').update(bytes).digest('hex')}`;
const gitBlob=bytes=>crypto.createHash('sha1').update(Buffer.from(`blob ${bytes.length}\0`)).update(bytes).digest('hex');
const errorRecord=error=>({name:error?.name??'Error',code:error?.code??null,message:error?.message??String(error),stack:error?.stack??null});

function readRegular(absolute){
 const stat=fs.lstatSync(absolute);assert.equal(stat.isSymbolicLink(),false,`Symlink is forbidden: ${absolute}`);assert.equal(stat.isFile(),true,`Expected regular file: ${absolute}`);return fs.readFileSync(absolute);
}
function artifactRecord(absolute){const bytes=readRegular(absolute);return{path:slash(path.relative(root,absolute)),byteLength:bytes.length,sha256:sha256(bytes)};}
function toolRecord(absolute){const record=artifactRecord(absolute),bytes=fs.readFileSync(absolute);return{...record,gitBlob:gitBlob(bytes)};}
function writeJson(relative,value){const absolute=path.join(root,relative);fs.writeFileSync(absolute,`${JSON.stringify(value,null,2)}\n`,{flag:'wx'});return artifactRecord(absolute);}
function walkTools(){
 const files=[];
 const walk=directory=>{
  const stat=fs.lstatSync(directory);assert.equal(stat.isSymbolicLink(),false,`Tool directory is a symlink: ${directory}`);assert.equal(stat.isDirectory(),true,`Expected tool directory: ${directory}`);
  for(const entry of fs.readdirSync(directory,{withFileTypes:true}).sort((a,b)=>a.name.localeCompare(b.name,'en'))){
   const absolute=path.join(directory,entry.name);assert.equal(entry.isSymbolicLink(),false,`Tool input is a symlink: ${absolute}`);
   if(entry.isDirectory())walk(absolute);else{assert.equal(entry.isFile(),true,`Tool input is not a regular file: ${absolute}`);files.push(absolute);}
  }
 };
 walk(toolRoot);return files.sort((a,b)=>slash(a).localeCompare(slash(b),'en')).map(toolRecord);
}
function git(args,{input=null,encoding='utf8'}={}){
 const result=spawnSync(GIT,['-c','core.longpaths=true','-c',`safe.directory=${slash(root).replace(/\/$/,'')}`,...args],{cwd:root,input,encoding,windowsHide:true,maxBuffer:64*1024*1024});
 assert.ifError(result.error);assert.equal(result.status,0,`${GIT} ${args.join(' ')} failed (${result.status}): ${String(result.stderr)}`);return result.stdout;
}
const gitText=args=>String(git(args)).trim();
function gitRecord(commit,relative){const bytes=git(['show',`${commit}:${relative}`],{encoding:null});return{path:relative,byteLength:bytes.length,sha256:sha256(bytes),gitBlob:gitText(['rev-parse',`${commit}:${relative}`])};}
function assertObjectRecord(record){
 const bytes=git(['cat-file','blob',record.gitBlob],{encoding:null});assert.equal(bytes.length,record.byteLength,record.path);assert.equal(sha256(bytes),record.sha256,record.path);assert.equal(gitBlob(bytes),record.gitBlob,record.path);
}

assert.deepEqual(process.argv.slice(2),[]);
assert.equal(process.platform,NODE.platform);assert.equal(process.arch,NODE.arch);assert.equal(process.version,NODE.version);
assert.equal(path.resolve(process.execPath).toLowerCase(),path.resolve(EXPECTED_NODE_PATH).toLowerCase(),'Run with the provisioned Phase 3CR2 runtime.');
const runtime=artifactRecord(process.execPath);assert.equal(runtime.byteLength,NODE.byteLength);assert.equal(runtime.sha256,NODE.sha256);
assert.equal(gitText(['branch','--show-current']),BRANCH);assert.equal(gitText(['rev-parse','HEAD']),C3TB);
assert.equal(gitText(['show','-s','--format=%T',C3TB]),C3TB_TREE);assert.equal(gitText(['show','-s','--format=%P',C3TB]),C3T);
assert.equal(gitText(['rev-parse','HEAD:repositories/memoryos-readiness']),PRODUCTION_TREE);
assert.equal(gitText(['status','--porcelain=v1','--untracked-files=all','--','repositories/memoryos-readiness']),'');

const planPath=path.join(root,planRelative),sealPath=path.join(root,sealRelative),failedPreflightPath=path.join(root,failedPreflightRelative);
assert.equal(fs.existsSync(planPath),true,'Preflight campaign plan is required.');assert.equal(fs.existsSync(sealPath),true,'Pre-execution seal is required.');
assert.equal(fs.existsSync(failedPreflightPath),true,'Failed preflight history is required.');
const plan=JSON.parse(readRegular(planPath)),seal=JSON.parse(readRegular(sealPath)),failedPreflight=JSON.parse(readRegular(failedPreflightPath)),planRecord=artifactRecord(planPath),failedPreflightRecord=toolRecord(failedPreflightPath);
assert.equal(plan.kind,'MO1307Phase3CR2C3TBCampaignPlan');assert.equal(plan.version,'1.0.0');assert.equal(plan.status,'SEALED_NOT_EXECUTED');
assert.equal(seal.kind,'MO1307Phase3CR2C3TBPreExecutionSeal');assert.equal(seal.version,'1.0.0');assert.equal(seal.result,'SEALED_NOT_EXECUTED');assert.deepEqual(seal.campaignPlan,planRecord);
assert.deepEqual(plan.candidate,seal.candidate);assert.equal(plan.candidate.role,'C3TB');assert.equal(plan.candidate.commit,C3TB);assert.equal(plan.candidate.tree,C3TB_TREE);assert.equal(plan.candidate.soleParent,C3T);assert.equal(plan.candidate.productionTree,PRODUCTION_TREE);assert.equal(plan.candidate.branch,BRANCH);
assert.deepEqual(plan.generation,seal.generation);assert.deepEqual(plan.priorFailedPreflight,seal.priorFailedPreflight);assert.deepEqual(plan.pinCorrection,seal.pinCorrection);assert.deepEqual(plan.zeroExecutionPreflight,seal.zeroExecutionPreflight);
assert.deepEqual(plan.generation,{mode:'FRESH_AFTER_FAILED_PREFLIGHT',preflightAttempt:2,resumesPriorAttempt:false,priorAttempt:{status:'FAILED_SETUP',outcome:'PHASE3CR2_FAILED_INCOMPLETE',resumable:false,evidence:failedPreflightRecord}});
assert.deepEqual(plan.priorFailedPreflight,{evidence:failedPreflightRecord,record:failedPreflight});
assert.equal(failedPreflight.kind,'MO1307Phase3CR2C3TBFailedPreflightHistory');assert.equal(failedPreflight.status,'FAILED_SETUP');assert.equal(failedPreflight.result,'FAIL');assert.equal(failedPreflight.previousStopRewrittenAsPass,false);assert.equal(failedPreflight.execution.campaignExecutionStarted,false);assert.equal(failedPreflight.execution.freshControlsExecuted,0);assert.equal(failedPreflight.execution.reuseControlsCertified,0);assert.equal(failedPreflight.execution.candidateSpecificControls,'NOT_RUN');assert.equal(failedPreflight.execution.certificationClaims,0);assert.deepEqual(failedPreflight.claims,[]);
assert.equal(plan.pinCorrection.result,'PASS');assert.equal(plan.pinCorrection.scope,'CERTIFICATION_TOOLING_IDENTITY_PIN_ONLY');assert.equal(plan.pinCorrection.oldExpectedSha256,'sha256:9131759b75fc9407fd25467ef7656b0d6948711daecdf58234f1c4b09f9b9433');assert.equal(plan.pinCorrection.correctedExpectedSha256,'sha256:0c490f5d4afa76b673c64d320308a2d1ca841a4330072b532964b0054d027131');assert.equal(plan.pinCorrection.historicalControlMap.gitBlob,'bf6bbaeb118fcfc38384530cee3d2942ac39fc47');assert.equal(plan.pinCorrection.staleExpectedResolvedTo.gitBlob,'50551f4cde0c1f5107126f9459c8b4e447226dfd');assert.equal(plan.pinCorrection.objectBytesChanged,false);assert.equal(plan.pinCorrection.controlIdsChanged,false);assert.equal(plan.pinCorrection.expectedOutcomesChanged,false);assert.equal(plan.pinCorrection.selectionChanged,false);assert.equal(plan.pinCorrection.dependencyMappingsChanged,false);
assert.deepEqual(plan.zeroExecutionPreflight,{result:'PASS',historicalControlMapIdentity:'PASS',acceptedPhase3CAuthorityChain:'PASS',c3tbIdentity:'PASS',productionTreeIdentity:'PASS',helperIdentity:'PASS',refreshMapCardinality:'PASS',selectedFreshHistoricalControls:{expected:89,accounted:89},dependencyReuseCandidates:{expected:462,accounted:462},candidateSpecificControls:{expected:2,accounted:2},historicalInventory:{expected:551,accounted:551},exactIdDuplicates:0,caseSensitiveControlIds:true,caseFoldDistinctAuthorityPairCount:1,selectedReuseOverlap:0,omissions:0,productExecutions:0,securityExecutions:0,certificationClaims:0});
assert.deepEqual(plan.accounting,seal.accounting);assert.deepEqual(plan.limits,seal.limits);assert.deepEqual(plan.officialBindingCheck,seal.officialBindingCheck);assert.deepEqual(plan.inputRecords,seal.inputRecords);
assert.deepEqual(plan.finalizedToolInputs,seal.finalizedToolInputs);assert.equal(plan.finalizedToolInputCount,seal.finalizedToolInputCount);assert.equal(plan.finalizedToolSetDigest,seal.finalizedToolSetDigest);
assert.deepEqual(plan.stageOrder,['DEPENDENCY_REUSE_PROOF_462','HEADLESS_SMOKE','HEADLESS_SECURITY_A_TO_S_19','DEADLINE_CLEANUP_SELECTED_7','EQUIVALENCE_SELECTED_67','NATIVE_LAST_ERROR_METADATA','PROTOCOL_SELECTED_12','TOCTOU_BOUNDARIES_SELECTED_2','CASE_SENSITIVE_RECONCILIATION','INDEPENDENT_FINAL_REVIEW','FINAL_APPEND_ONLY_SEAL']);
assert.deepEqual(plan.limits,{aggregateHelperActiveMs:20000,apiMs:10000,cleanupMs:2000,cliAdmissionMs:30000,helperMs:8000,workerMs:10000,success:'elapsedMs < 8000',timeout:'elapsedMs >= 8000',H:'NOT_ESTABLISHED'});
assert.deepEqual(plan.accounting.historical,{inventory:551,selectedFresh:89,dependencyReuse:462,omitted:0,rejections:426,behavioral:125,selectedRejections:74,selectedBehavioral:15,reuseRejections:352,reuseBehavioral:110,selectedBySuite:plan.accounting.historical.selectedBySuite,reuseBySuite:plan.accounting.historical.reuseBySuite});
assert.deepEqual(plan.accounting.historical.selectedBySuite,{'deadline-cleanup':{controls:7,rejections:6,behavioral:1},equivalence:{controls:67,rejections:55,behavioral:12},protocol:{controls:12,rejections:11,behavioral:1},'runtime-main':{controls:1,rejections:0,behavioral:1},toctou:{controls:2,rejections:2,behavioral:0}});
assert.equal(plan.accounting.candidateSpecificSupplementalControls.count,2);assert.equal(plan.accounting.headlessCorrectionCases.count,19);assert.equal(plan.accounting.requiredSourceAndSecurityReviews.count,12);
assert.deepEqual(plan.executionPolicy,{firstMandatoryFailureStopsGeneration:true,retries:0,inCampaignRepair:false,adaptiveExpansion:false,historicalOutcomeFallbackAfterMismatch:false,dependencyReuseRequiresFieldLevelEquality:true,caseSensitiveControlIds:true,productExecutionPerformedByPreflight:false,certificationExecutionPerformedByPreflight:false});
assert.deepEqual(plan.outputs,[planRelative,sealRelative]);assert.deepEqual(plan.evidenceNamespaceBeforePreflight,seal.appendOnly.evidenceNamespaceBeforePreflight);
assert.deepEqual(plan.prohibitions,{productChange:false,phase3A:false,phase3B:false,phase3D:false,networkAcquisition:false,hostedProviders:false,push:false,tag:false});
assert.equal(seal.appendOnly.writesUseExclusiveCreate,true);assert.equal(seal.appendOnly.historicalArtifactsModified,false);assert.equal(seal.appendOnly.productModified,false);assert.equal(seal.appendOnly.selfReference,false);assert.equal(seal.productControlsExecutedBeforeSeal,false);assert.equal(seal.certificationExecutedBeforeSeal,false);
assert.equal(seal.officialBindingCheck.result,'PASS');assert.equal(seal.officialBindingCheck.runtime.version,NODE.version);assert.equal(seal.officialBindingCheck.runtime.byteLength,NODE.byteLength);assert.equal(seal.officialBindingCheck.runtime.sha256,NODE.sha256);assert.equal(path.resolve(seal.officialBindingCheck.runtime.executable),path.resolve(process.execPath));
const selection=gitRecord(C3TB,'repositories/cca-conformance/evidence/mo1307/prospective-helper-bound-candidate/phase3c-refresh-map.json');
const binding=gitRecord(C3TB,'repositories/cca-conformance/evidence/mo1307/prospective-helper-bound-candidate/binding.json');
const verification=gitRecord(C3TB,'repositories/cca-conformance/evidence/mo1307/prospective-helper-bound-candidate/binding-verification.json');
assert.deepEqual(plan.authority.selection,selection);assert.deepEqual(plan.authority.binding,binding);assert.deepEqual(plan.authority.bindingVerification,verification);
assert.deepEqual(seal.selectionMap,selection);assert.deepEqual(seal.binding,binding);assert.deepEqual(seal.bindingVerification,verification);
for(const record of seal.inputRecords)assertObjectRecord(record);
const currentTools=walkTools();assert.deepEqual(currentTools,seal.finalizedToolInputs,'Tool set differs from the pre-execution seal.');
assert.equal(sha256(canonicalBytes(currentTools)),seal.finalizedToolSetDigest);assert.equal(currentTools.length,seal.finalizedToolInputCount);

const stages=[
 {id:'DEPENDENCY_REUSE_PROOF_462',tool:'reuse-proof.mjs',args:[]},
 {id:'HEADLESS_SMOKE',tool:'headless-smoke.mjs',args:[]},
 {id:'HEADLESS_SECURITY_A_TO_S_19',tool:'headless-security.mjs',args:[]},
 {id:'DEADLINE_CLEANUP_SELECTED_7',tool:'deadline-cleanup.mjs',args:['attempt-1'],prepare:()=>{const parent=path.join(evidenceRoot,'deadline-cleanup');assert.equal(fs.existsSync(parent),false);fs.mkdirSync(parent,{recursive:false});}},
 {id:'EQUIVALENCE_SELECTED_67',tool:'equivalence.mjs',args:['--output',`${evidenceRelative}/equivalence/attempt1`]},
 {id:'NATIVE_LAST_ERROR_METADATA',tool:'native-last-error.mjs',args:[]},
 {id:'PROTOCOL_SELECTED_12',tool:'protocol.mjs',args:[]},
 {id:'TOCTOU_BOUNDARIES_SELECTED_2',tool:'toctou-boundaries.mjs',args:[]},
 {id:'CASE_SENSITIVE_RECONCILIATION',tool:'reconcile.mjs',args:[]},
];
const requiredTools=['preflight.mjs','run.mjs',...stages.map(stage=>stage.tool)];
assert.equal(new Set(requiredTools).size,requiredTools.length);
for(const name of requiredTools){const relative=`${toolRelative}/${name}`;assert.ok(currentTools.some(record=>record.path===relative),`Unsealed or missing required tool: ${relative}`);}
const expectedRootEntries=new Set([path.basename(planRelative),path.basename(sealRelative)]);
const placeholder=seal.appendOnly.evidenceNamespaceBeforePreflight.placeholder;if(placeholder)expectedRootEntries.add(path.basename(placeholder.path));
const preservedFailedPreflight=seal.appendOnly.evidenceNamespaceBeforePreflight.priorFailedPreflight;assert.deepEqual(preservedFailedPreflight,failedPreflightRecord);expectedRootEntries.add(path.basename(preservedFailedPreflight.path));
assert.deepEqual(fs.readdirSync(evidenceRoot).sort(),[...expectedRootEntries].sort(),'Evidence namespace changed after preflight.');
assert.equal(fs.existsSync(ledgerPath),false,'Execution ledger already exists.');assert.equal(fs.existsSync(path.join(root,startRelative)),false,'Execution already started.');assert.equal(fs.existsSync(logRoot),false,'Stage logs already exist.');

const stageRows=stages.map((stage,index)=>({ordinal:index+1,id:stage.id,mandatory:true,tool:`${toolRelative}/${stage.tool}`,args:[...stage.args],status:'NOT_RUN'}));
const ledger={kind:'MO1307Phase3CR2C3TBExecutionLedger',version:'1.0.0',candidate:plan.candidate,generation:plan.generation,preflight:{campaignPlan:planRecord,seal:artifactRecord(sealPath),failedPreflightEvidence:failedPreflightRecord,pinCorrection:plan.pinCorrection,zeroExecution:plan.zeroExecutionPreflight,finalizedToolSetDigest:seal.finalizedToolSetDigest},runtime,startedAt:new Date().toISOString(),result:'RUNNING',firstFailure:null,stages:stageRows};
fs.mkdirSync(logRoot,{recursive:false});
writeJson(startRelative,{kind:'MO1307Phase3CR2C3TBExecutionStart',version:'1.0.0',candidate:plan.candidate,generation:plan.generation,startedAt:ledger.startedAt,preflight:ledger.preflight,runtime,policy:{once:true,retries:0,ordered:true,stopOnFirstMandatoryFailure:true},stages:stageRows.map(row=>({ordinal:row.ordinal,id:row.id,status:row.status,tool:row.tool,args:row.args}))});

async function execute(stage,row){
 const prefix=`${String(row.ordinal).padStart(2,'0')}-${stage.id.toLowerCase().replaceAll('_','-')}`;
 const stdoutRelative=`${logRelative}/${prefix}.stdout.txt`,stderrRelative=`${logRelative}/${prefix}.stderr.txt`;
 const invocationRelative=`${logRelative}/${prefix}.invocation.json`,resultRelative=`${logRelative}/${prefix}.result.json`;
 const script=path.join(toolRoot,stage.tool),args=[script,...stage.args],command={executable:process.execPath,args,cwd:root,env:FIXED_ENV};
 row.status='RUNNING';row.startedAt=new Date().toISOString();row.command=command;
 writeJson(invocationRelative,{kind:'MO1307Phase3CR2StageInvocation',version:'1.0.0',candidate:C3TB,ordinal:row.ordinal,id:stage.id,mandatory:true,startedAt:row.startedAt,command,runtime,tool:toolRecord(script)});
 const stdoutPath=path.join(root,stdoutRelative),stderrPath=path.join(root,stderrRelative);
 const stdout=fs.openSync(stdoutPath,'wx'),stderr=fs.openSync(stderrPath,'wx');let actual;
 try{
  stage.prepare?.();
  actual=await new Promise(resolve=>{
   let settled=false;const finish=value=>{if(!settled){settled=true;resolve(value);}};
   const child=spawn(process.execPath,args,{cwd:root,windowsHide:true,shell:false,env:{...FIXED_ENV},stdio:['ignore',stdout,stderr]});row.pid=child.pid??null;
   child.once('error',error=>finish({code:null,signal:null,error:errorRecord(error)}));child.once('close',(code,signal)=>finish({code,signal,error:null}));
  });
  if(actual.error)fs.writeSync(stderr,Buffer.from(`${JSON.stringify(actual.error)}\n`));
 }catch(error){actual={code:null,signal:null,error:errorRecord(error)};fs.writeSync(stderr,Buffer.from(`${JSON.stringify(actual.error)}\n`));}
 finally{fs.closeSync(stdout);fs.closeSync(stderr);}
 row.finishedAt=new Date().toISOString();row.actual=actual;row.stdout=artifactRecord(stdoutPath);row.stderr=artifactRecord(stderrPath);row.status=actual.code===0&&actual.signal===null&&!actual.error?'PASS':'FAIL';row.expected={exitCode:0,signal:null,mandatoryOutcome:'PASS'};
 row.resultRecord=writeJson(resultRelative,{kind:'MO1307Phase3CR2StageResult',version:'1.0.0',candidate:C3TB,ordinal:row.ordinal,id:stage.id,mandatory:true,status:row.status,startedAt:row.startedAt,finishedAt:row.finishedAt,pid:row.pid??null,command,expected:row.expected,actual,stdout:row.stdout,stderr:row.stderr});
 process.stdout.write(`${JSON.stringify({stage:stage.id,status:row.status,actual})}\n`);return row.status;
}

try{
 for(let index=0;index<stages.length;index+=1){
  const status=await execute(stages[index],stageRows[index]);
  if(status!=='PASS'){
   ledger.firstFailure={stage:stageRows[index].id,ordinal:stageRows[index].ordinal,actual:stageRows[index].actual,stdout:stageRows[index].stdout,stderr:stageRows[index].stderr,resultRecord:stageRows[index].resultRecord};ledger.result='FAILED_INCOMPLETE';break;
  }
 }
}catch(error){
 const running=stageRows.find(row=>row.status==='RUNNING');if(running)running.status='FAIL';ledger.firstFailure={stage:running?.id??'RUNNER',ordinal:running?.ordinal??null,actual:{code:null,signal:null,error:errorRecord(error)}};ledger.result='FAILED_INCOMPLETE';
}
if(!ledger.firstFailure)ledger.result='EXECUTION_PASSED_PENDING_INDEPENDENT_FINAL_REVIEW_AND_SEAL';
ledger.finishedAt=new Date().toISOString();
writeJson(ledgerRelative,ledger);
process.exitCode=ledger.firstFailure?1:0;
