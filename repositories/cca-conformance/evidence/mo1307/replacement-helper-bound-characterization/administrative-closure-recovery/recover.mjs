// Post-seal administrative recovery for the MO-1307 characterization evidence inventory.
// This procedure launches zero helpers and zero workers and does not alter sealed campaign artifacts.
import fs from 'node:fs';
import path from 'node:path';
import crypto from 'node:crypto';
import assert from 'node:assert/strict';
import {spawnSync} from 'node:child_process';

const root=process.cwd();
const evidence='repositories/cca-conformance/evidence/mo1307/replacement-helper-bound-characterization';
const sealedTools='repositories/cca-conformance/tools/mo1307-replacement-helper-bound-characterization';
const recoverySource=evidence+'/administrative-closure-recovery/recover.mjs';
const attempt1Status=evidence+'/final-validation/attempt-1/status-before-recovery.bin';
const attempt1Validation=evidence+'/final-validation/attempt-1/receipt.json';
const recoveryReceipt=evidence+'/administrative-closure-recovery/receipt.json';
const inventoryPath=evidence+'/changed-file-inventory.json';
const preservationPath=evidence+'/preservation-binding.json';
const baseline='b82ecc778e3b1abdb7aa5384e01280b28a000874';
const productionTree='6a0bf13aaf40e20b68e469989b5a34ef74cf2903';
const helperSha='sha256:97ef5ae9ce7ab390548b04a2aefba9f922c3e1c6b9b80581c6c274f0b21f0127';
const attempt1StatusSha='sha256:5650f577afd68a78ba90167cc19bc58aa350e88c77002a223ba165c2e8e8ca3e';
const attempt1ValidationSha='sha256:d89a1223bf4ce23643f2379cba2272b4ed4690a9ee58f9daeb7b557bf2c4efad';
const mode=process.argv[2]??'execute';
assert.ok(mode==='execute'||mode==='--preflight',`unsupported mode: ${mode}`);

function absolute(p){return path.join(root,p);}
function sha(data){return 'sha256:'+crypto.createHash('sha256').update(data).digest('hex');}
function read(p){return fs.readFileSync(absolute(p));}
function json(p){return JSON.parse(read(p).toString('utf8'));}
function record(p){const data=read(p);return {path:p,byteLength:data.length,sha256:sha(data)};}
function writeJsonExclusive(p,value){
  const target=absolute(p);
  fs.mkdirSync(path.dirname(target),{recursive:true});
  fs.writeFileSync(target,JSON.stringify(value,null,2)+'\n',{encoding:'utf8',flag:'wx'});
  return record(p);
}
function run(command,args,{encoding=null,maxBuffer=64*1024*1024,timeout=120000}={}){
  const result=spawnSync(command,args,{cwd:root,windowsHide:true,encoding,maxBuffer,timeout});
  assert.ifError(result.error);
  assert.equal(result.status,0,result.stderr?.toString?.('utf8')??String(result.stderr??''));
  return result;
}
function gitBuffer(...args){return run('git',args).stdout;}
function gitText(...args){return gitBuffer(...args).toString('utf8').trim();}
function parsePorcelainZ(buffer){
  const fields=buffer.toString('utf8').split('\0');
  assert.equal(fields.at(-1),'','porcelain -z output must terminate with NUL');
  fields.pop();
  return fields.map(field=>{
    assert.ok(field.length>=4,JSON.stringify(field));
    const status=field.slice(0,2);
    assert.equal(field[2],' ',JSON.stringify(field.slice(0,20)));
    assert.equal(/[RC]/.test(status),false,'rename/copy status is outside this recovery');
    return {status,path:field.slice(3).replaceAll('\\','/')};
  });
}
function allowedPath(p){
  return p==='.gitattributes'||
    p==='docs/mo1307-replacement-helper-bound-characterization.md'||
    p.startsWith(sealedTools+'/')||
    p.startsWith(evidence+'/');
}

assert.equal(gitText('rev-parse','HEAD'),baseline);
assert.equal(gitText('rev-parse','HEAD:repositories/memoryos-readiness'),productionTree);
assert.equal(sha(read('repositories/memoryos-readiness/helpers/windows-inspect.ps1')),helperSha);
assert.equal(gitText('diff','--name-only',baseline,'--','repositories/memoryos-readiness'),'');
assert.equal(fs.existsSync(absolute(inventoryPath)),false,'inventory must not already exist');
assert.equal(fs.existsSync(absolute(preservationPath)),false,'preservation binding must not already exist');
assert.equal(fs.existsSync(absolute(recoveryReceipt)),false,'recovery receipt must be write-once');

const seal=json(evidence+'/plan-seal.json');
const campaign=json(evidence+'/campaign.json');
const decision=json(evidence+'/decision.json');
const independent=json(evidence+'/independent-recomputation.json');
const stopped=json(evidence+'/generation-stopped.json');
const validation=json(attempt1Validation);
assert.equal(seal.result,'SEALED');
assert.equal(decision.result,'H_NOT_ESTABLISHED');
assert.equal(decision.Hms,null);
assert.equal(campaign.result,'H_NOT_ESTABLISHED');
assert.equal(campaign.counts.actualHelperLaunches,4);
assert.equal(campaign.counts.workerThreads,0);
assert.equal(independent.result,'PASS');
assert.equal(independent.disposition,'H_NOT_ESTABLISHED');
assert.deepEqual(independent.errors,[]);
assert.equal(stopped.noRetry,true);
assert.equal(validation.result,'PASS');
assert.equal(validation.disposition,'H_NOT_ESTABLISHED');
assert.equal(validation.closureNativeHelperExecutions,0);
assert.equal(validation.closureWorkerThreads,0);
assert.equal(record(attempt1Validation).sha256,attempt1ValidationSha);

const rawAttempt1=read(attempt1Status);
assert.equal(sha(rawAttempt1),attempt1StatusSha);
const attempt1Fields=rawAttempt1.toString('utf8').split('\0');
assert.equal(attempt1Fields.at(-1),'');
attempt1Fields.pop();
assert.equal(attempt1Fields[0],' M .gitattributes');
const flawedFields=[...attempt1Fields];
flawedFields[0]=flawedFields[0].trimStart();
flawedFields[flawedFields.length-1]=flawedFields.at(-1).trimEnd();
const flawedEntries=flawedFields.map(line=>({status:line.slice(0,2),path:line.slice(3).replaceAll('\\','/')}));
const invalidFlawedEntries=flawedEntries.filter(entry=>!allowedPath(entry.path));
assert.deepEqual(invalidFlawedEntries,[{status:'M ',path:'gitattributes'}]);

const closureBinding=seal.sourceBindings.find(x=>x.path===sealedTools+'/closure.mjs');
const commonBinding=seal.sourceBindings.find(x=>x.path===sealedTools+'/common.mjs');
assert.ok(closureBinding);
assert.ok(commonBinding);
assert.deepEqual(record(closureBinding.path),closureBinding);
assert.deepEqual(record(commonBinding.path),commonBinding);

const syntax=run(process.execPath,['--check',recoverySource],{encoding:'utf8'});
const verifier=run(process.execPath,[sealedTools+'/verify-evidence.mjs'],{encoding:'utf8'});
const verifierValue=JSON.parse(verifier.stdout.trim());
assert.equal(verifierValue.result,'PASS');
assert.equal(verifierValue.disposition,'H_NOT_ESTABLISHED');
assert.equal(verifierValue.nativeHelperExecutions,0);
assert.equal(verifierValue.workerThreads,0);
const diffCheck=run('git',['diff','--check'],{encoding:'utf8'});

const preReceiptStatus=parsePorcelainZ(gitBuffer('status','--porcelain=v1','-z','--untracked-files=all'));
assert.equal(preReceiptStatus.every(entry=>allowedPath(entry.path)),true,JSON.stringify(preReceiptStatus.filter(entry=>!allowedPath(entry.path))));
assert.equal(preReceiptStatus.some(entry=>entry.path===recoverySource),true);
assert.equal(preReceiptStatus.some(entry=>entry.path===attempt1Status),true);
assert.equal(preReceiptStatus.some(entry=>entry.path===attempt1Validation),true);
if(mode==='--preflight'){
  console.log(JSON.stringify({result:'PASS',mode:'PREFLIGHT',disposition:'H_NOT_ESTABLISHED',Hms:null,changedPaths:preReceiptStatus.length,attempt1Status:record(attempt1Status),attempt1Validation:record(attempt1Validation),sealedClosure:closureBinding,sealedCommon:commonBinding,nativeHelperExecutions:0,workerThreads:0}));
  process.exit(0);
}

const recovery=writeJsonExclusive(recoveryReceipt,{
  kind:'MO1307ReplacementBoundAdministrativeClosureRecovery',
  version:'1.0.0',
  result:'PASS',
  status:'POST_SEAL_ADMINISTRATIVE_INVENTORY_RECOVERY',
  createdAtUtc:new Date().toISOString(),
  disposition:'H_NOT_ESTABLISHED',
  Hms:null,
  scope:'Evidence packaging only after the sealed closure completed validation and failed while parsing Git porcelain for its changed-file inventory.',
  attempt1:{
    command:'C:/Users/melsa/Documents/Codex/cca-workspace/.cache/mo1304-phase3-toolchain/node-v24.21.0-win-x64/node.exe '+sealedTools+'/closure.mjs',
    exitCode:1,
    completedValidation:record(attempt1Validation),
    rawStatusBeforeRecovery:record(attempt1Status),
    failure:{
      code:'ERR_ASSERTION',
      source:sealedTools+'/closure.mjs:19-21',
      commonSource:sealedTools+'/common.mjs:28',
      cause:'common.str() trimmed the leading worktree-status space before closure.mjs applied fixed-column porcelain parsing.',
      firstRawEntry:' M .gitattributes',
      derivedInvalidEntry:invalidFlawedEntries[0],
      assertionDiagnosticEntries:flawedEntries.filter(x=>!x.path.startsWith(evidence+'/')).slice(0,20)
    },
    closureSource:closureBinding,
    commonSource:commonBinding,
    changedFileInventoryWritten:false,
    validationReceiptPreservedByteForByte:true
  },
  recovery:{
    source:record(recoverySource),
    method:'Parse NUL-terminated git status --porcelain=v1 -z bytes without trimming, validate the unchanged sealed evidence, write this recovery receipt, then write the self-excluding inventory last.',
    readOnlyEvidenceVerifier:verifierValue,
    recoverySourceSyntax:{result:'PASS',stdout:syntax.stdout,stderr:syntax.stderr},
    gitDiffCheck:{result:'PASS',stdout:diffCheck.stdout,stderr:diffCheck.stderr},
    inventoryPath,
    inventorySelfExclusion:'The inventory is written last and excludes only its own hash to keep the binding acyclic.'
  },
  counts:{campaignNativeHelperExecutions:4,recoveryNativeHelperExecutions:0,campaignWorkerThreads:0,recoveryWorkerThreads:0},
  campaignRerun:false,
  helperRetry:false,
  manualSampleSubstitution:false,
  HRecomputed:false,
  campaignResultChanged:false,
  sealedCampaignArtifactsChanged:false,
  sealedToolSourcesChanged:false,
  productionChanges:false,
  contractChanges:false,
  certification:false,
  phase3A:false,
  phase3B:false,
  phase3C:false,
  phase3D:false,
  push:false,
  tag:false
});

const entries=parsePorcelainZ(gitBuffer('status','--porcelain=v1','-z','--untracked-files=all'));
assert.equal(entries.every(entry=>allowedPath(entry.path)),true,JSON.stringify(entries.filter(entry=>!allowedPath(entry.path))));
assert.equal(entries.some(entry=>entry.path===inventoryPath),false);
assert.equal(entries.some(entry=>entry.path===recoveryReceipt),true);
const recorded=entries.map(entry=>({...entry,...(entry.status.includes('D')?{}:{file:record(entry.path)})}));
const inventory=writeJsonExclusive(inventoryPath,{
  kind:'MO1307ReplacementBoundChangedFileInventory',
  version:'1.0.0',
  result:'PASS',
  createdAtUtc:new Date().toISOString(),
  disposition:'H_NOT_ESTABLISHED',
  entries:recorded,
  self:{path:inventoryPath,reason:'Written last and therefore intentionally excluded from its own hash inventory.'},
  allowedRoots:['.gitattributes','docs/mo1307-replacement-helper-bound-characterization.md',sealedTools+'/',evidence+'/'],
  administrativeRecovery:{receipt:recovery,source:record(recoverySource),sealedClosureValidation:record(attempt1Validation),rawAttempt1Status:record(attempt1Status)},
  productionMembersChanged:0,
  campaignNativeHelperExecutions:4,
  recoveryNativeHelperExecutions:0,
  campaignWorkerThreads:0,
  recoveryWorkerThreads:0
});

const after=parsePorcelainZ(gitBuffer('status','--porcelain=v1','-z','--untracked-files=all'));
assert.equal(after.length,entries.length+1);
assert.equal(after.some(entry=>entry.path===inventoryPath),true);
assert.equal(after.every(entry=>allowedPath(entry.path)),true);
console.log(JSON.stringify({result:'PASS',status:'POST_SEAL_ADMINISTRATIVE_INVENTORY_RECOVERY',disposition:'H_NOT_ESTABLISHED',Hms:null,recovery,inventory,campaignNativeHelperExecutions:4,recoveryNativeHelperExecutions:0,workerThreads:0}));
