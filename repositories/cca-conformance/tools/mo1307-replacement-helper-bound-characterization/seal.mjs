// PRE-LAUNCH PLAN SEAL. This program launches zero native helpers and zero workers.
import fs from 'node:fs';
import path from 'node:path';
import assert from 'node:assert/strict';
import {spawnSync} from 'node:child_process';
import {
  root,evidence,tools,baseline,productionTree,helperSha,nodeExe,authorizationSource,
  authorizationSha,powershellExe,read,record,hash,writeBytes,writeJson,str,
  assertAuthority,captureHost,
} from './common.mjs';
import {buildFixtures,buildSequenceControls,buildFixtureLedger,bindFullExpectedIdentities,verifyFixtureLedger} from './fixtures.mjs';
import {createEngineeringSupervisor} from './engineering-supervisor.mjs';
import {helperLaunchSpecification} from '../../../memoryos-readiness/src/helper-transport.mjs';

assertAuthority();
assert.equal(str('branch','--show-current'),'codex/mo1307-helper-bound-characterization');
assert.equal(fs.existsSync(path.join(root,evidence)),false,'evidence namespace already exists');
assert.equal(str('diff','--name-only',baseline,'--','repositories/memoryos-readiness'),'','production differs from baseline');
const createdAtUtc=new Date().toISOString();
const authorization=writeBytes(evidence+'/authorization.txt',read(authorizationSource));assert.equal(authorization.sha256,authorizationSha);
const authorityDecision=writeJson(evidence+'/authority-decision.json',{kind:'MO1307ReplacementHelperBoundAuthority',version:'1.0.0',result:'AUTHORIZED_EVIDENCE_ONLY',
  decision:'NUMERIC_HELPER_BOUND_CORRECTION_REQUIRED',source:authorization,productionTree,helperSha,phase3A:'FAILED_INCOMPLETE',
  phase3B:{status:'ACCEPTED',commit:'702c1b6381f6112a50ac844831d195275dac3350'},phase3C:{status:'ACCEPTED',commit:'b02fc0226a1a2d800185a02071674ca80bdf4a1d'},
  productionChanges:false,contractChanges:false,certification:false,push:false,tag:false});

const baselineReceipt=writeJson(evidence+'/baseline.json',{kind:'MO1307ReplacementBoundBaseline',createdAtUtc,commit:baseline,tree:str('rev-parse','HEAD^{tree}'),
  branch:str('branch','--show-current'),parents:str('show','-s','--format=%P','HEAD').split(' '),subject:str('show','-s','--format=%s','HEAD'),
  productionTree:str('rev-parse','HEAD:repositories/memoryos-readiness'),helper:record('repositories/memoryos-readiness/helpers/windows-inspect.ps1'),
  accepted:{phase3B:'702c1b6381f6112a50ac844831d195275dac3350',phase3C:'b02fc0226a1a2d800185a02071674ca80bdf4a1d'},
  productionDiffFromBaseline:str('diff','--name-only',baseline,'--','repositories/memoryos-readiness'),noHelpersLaunched:true,noWorkersLaunched:true});

const r3a='C:/Users/melsa/Documents/Codex/r3a';
function externalGit(cwd,...args){const r=spawnSync('git',args,{cwd,env:{...process.env,GIT_OPTIONAL_LOCKS:'0'},windowsHide:true,encoding:'utf8',timeout:120000,maxBuffer:64*1024*1024});assert.ifError(r.error);assert.equal(r.status,0,r.stderr);return r.stdout.trim();}
const historicalBinding=writeJson(evidence+'/historical-binding.json',{kind:'MO1307ReplacementBoundHistoricalBinding',result:'PRESERVED',
  acceptedPhase3B:{commit:'702c1b6381f6112a50ac844831d195275dac3350',type:str('cat-file','-t','702c1b6381f6112a50ac844831d195275dac3350')},
  acceptedPhase3C:{commit:'b02fc0226a1a2d800185a02071674ca80bdf4a1d',type:str('cat-file','-t','b02fc0226a1a2d800185a02071674ca80bdf4a1d')},
  phase3A:{worktree:r3a,head:externalGit(r3a,'rev-parse','HEAD'),expectedHead:'defe93989efc6501b1a730b82e79e705884b269b',statusPorcelain:externalGit(r3a,'status','--porcelain=v1','--untracked-files=all'),evidenceIntentionallyUntouched:true},
  deadlineCharacterizationCommit:{commit:'6d444e323f8048712908eaff22712eeac8a4e6b3',type:str('cat-file','-t','6d444e323f8048712908eaff22712eeac8a4e6b3')},
  noHistoricalCleanup:true,noHistoricalRewrite:true});
assert.equal(JSON.parse(read(historicalBinding.path)).phase3A.head,'defe93989efc6501b1a730b82e79e705884b269b');

const fixtureSet=buildFixtures(),sequenceSet=buildSequenceControls(),ledgerValue=buildFixtureLedger(fixtureSet.classes,sequenceSet),expectedIdentityValue=bindFullExpectedIdentities(ledgerValue);
const expectedIdentityBinding=writeJson(evidence+'/expected-identity-binding.json',expectedIdentityValue),fixtureLedger=writeJson(evidence+'/fixture-ledger.json',ledgerValue),ledgerVerification=verifyFixtureLedger(ledgerValue);
const fixtureManifest=writeJson(evidence+'/fixture-manifest.json',{kind:'MO1307ReplacementBoundFixtureManifest',createdAtUtc,cacheRoot:fixtureSet.cache,
  classes:fixtureSet.classes,history:fixtureSet.history,pendingPayload:fixtureSet.pendingPayload,fixtureLedger,
  interpretations:{roundIndex:'Rounds are zero-based r=0..79; class number is ((r mod 18)+1).',
    class7:'The refusal target is an NTFS directory junction at the deepest request path admitted jointly by 180 relative characters, 240 full-path code units and 120 chain components.',
    publicationRoots:'Classes 11-18 use separate immutable roots because their required absent/present states conflict.',
    class12:'The exact authoritative retained slot-5 frame supplies operation=CHECK_OUTPUT, sequence=5, no files and ABSENT semantics. Section 5 requires the newly sealed deepest output root; only session and output root are transformed.',
    completeSequenceMaximum:'Maximum-admitted controls use the retained deterministic valid Phase-1 maximum bundle: 128 manifest files, exactly 8 MiB aggregate evidence, 2 MiB largest source, 262144-byte largest envelope and 1024 candidate components. Standalone classes 8-10 separately exercise exact byte caps.'},
  frozenCaps:{requestPaths:128,aggregateEvidenceBytes:8388608,rawSourceBytes:2097152,resultBytes:4194304,decisionBytes:8192,relativePathChars:180,fullPathCodeUnits:240,chainComponents:120}});
const requestManifest=writeJson(evidence+'/request-manifest.json',{kind:'MO1307ReplacementBoundRequestManifest',fixtureLedger,classRequests:fixtureSet.classes.map(c=>({id:c.id,name:c.name,request:c.request,operation:c.operation,sequence:c.sequence,expected:c.expected})),
  sequenceRequests:sequenceSet.controls.map(c=>({id:c.id,kind:c.kind,helpers:c.helpers.map(h=>({ordinal:h.ordinal,sequence:h.sequence,operation:h.operation,request:h.request,expected:h.expected}))})),counts:{classRequests:18,sequenceRequestFrames:104,total:122}});

const rounds=[],order=[];
for(let r=0;r<80;r++){const start=r%18,dir=r%2===0?1:-1,classes=[];for(let k=0;k<18;k++){const id=((start+dir*k)%18+18)%18+1;classes.push(id);const phase=r<60?'derivation':'holdout',phaseOrdinal=(r<60?r:r-60)*18+k+1;order.push({globalOrdinal:order.length+1,phase,phaseOrdinal,round:r,classId:id,sampleId:(phase==='derivation'?'d':'h')+'-r'+String(r).padStart(2,'0')+'-c'+String(id).padStart(2,'0')});}rounds.push({round:r,startClass:start+1,direction:dir===1?'FORWARD':'BACKWARD',classes});}
assert.equal(order.length,1440);assert.equal(order.filter(x=>x.phase==='derivation').length,1080);assert.equal(order.filter(x=>x.phase==='holdout').length,360);
const samplePlan=writeJson(evidence+'/sample-plan.json',{kind:'MO1307ReplacementBoundSamplePlan',version:'1.0.0',createdAtUtc,rounds,order,
  counts:{classes:18,rounds:80,derivationPerClass:60,derivation:1080,holdoutPerClass:20,holdout:360},
  noRetry:{warmups:0,cacheFlushes:0,retries:0,replacements:0,discardedOutliers:0,adaptiveExpansion:false,secondChanceRuns:0,manualSubstitutions:0},
  derivationGuardMs:20000,cleanupMs:2000,formula:{floorNs:'5021030400',U:'max derivation S_j',L:'max(U,5021030400)',V:'max over classes(max S-min S)',Q:'max over derivations max(0,E-S)',R:'L+V+Q',Hms:'500*ceil(Rns/500000000)',percentiles:false,averages:false,medians:false,confidenceIntervals:false,manualMargin:false},stopOnFirst:true});
const sequencePlan=writeJson(evidence+'/sequence-plan.json',{kind:'MO1307ReplacementBoundSequencePlan',version:'1.0.0',createdAtUtc,
  controls:sequenceSet.controls,totalControls:16,totalHelperLaunches:104,totalWorkerThreads:16,fixedOrder:sequenceSet.controls.map(c=>c.id),
  implementation:'SOURCE_DERIVED_PROSPECTIVE_H_SEQUENCE_RUNTIME_AND_PUBLICATION_WITH_REAL_PRODUCTION_SEMANTIC_WORKER',
  invariantLimitsMs:{helper:'FROZEN_H',helperAggregate:20000,cliAdmission:30000,workerApi:10000,cleanup:2000},certification:false});

const launch=helperLaunchSpecification(),host=captureHost(),environment=writeJson(evidence+'/runtime-environment.json',{kind:'MO1307ReplacementBoundRuntimeEnvironment',capturedAtUtc:new Date().toISOString(),
  node:{version:process.version,platform:process.platform,arch:process.arch,executable:record(process.execPath)},powershell:{executable:record(powershellExe),...host},
  helperLaunch:{executable:launch.executable,args:[...launch.args],options:{...launch.options,env:{...launch.options.env},stdio:[...launch.options.stdio]}},
  selectedEnvironment:{SystemRoot:process.env.SystemRoot,WINDIR:process.env.WINDIR,processorArchitecture:process.env.PROCESSOR_ARCHITECTURE,numberOfProcessors:process.env.NUMBER_OF_PROCESSORS,tempVolume:path.parse(process.env.TEMP??'').root},
  ordinaryWindowsVarianceIncluded:true,noWarmup:true,noCacheFlush:true});
assert.equal(host.powershell.startsWith('5.1.'),true);assert.equal(host.volume.filesystem,'NTFS');
let prior=process.hrtime.bigint();for(let i=0;i<100000;i++){const at=process.hrtime.bigint();assert.ok(at>=prior);prior=at;}
const clockValidation=writeJson(evidence+'/clock-validation.json',{kind:'MO1307ReplacementBoundClockValidation',result:'PASS',source:'process.hrtime.bigint',monotonicObservations:100000,nativeHelperExecutions:0});

let terminations=0;const double=createEngineeringSupervisor(1_000_000_000n,{phase:'offline-seal-double'});const doubleValue=await double.runOwned('helper',()=>({completion:Promise.resolve('OK'),closed:Promise.resolve(),quiescence:()=>true,terminate:()=>{terminations++;}}));assert.equal(doubleValue,'OK');assert.equal(terminations,0);assert.equal(double.snapshot().transportCleanupConfirmed,true);
const offlineValidation=writeJson(evidence+'/offline-harness-validation.json',{kind:'MO1307ReplacementBoundOfflineHarnessValidation',result:'PASS',nativeHelperExecutions:0,workerThreads:0,
  engineeringSupervisorDouble:double.snapshot(),schedule:{rounds:rounds.length,rows:order.length,derivation:1080,holdout:360},sequence:{controls:16,helperLaunches:104,workerThreads:16},classCount:18,fixtureLedger:ledgerVerification});

const productionFiles=str('ls-tree','-r','--name-only',baseline,'--','repositories/memoryos-readiness').split(/\r?\n/).filter(Boolean).sort();
assert.ok(productionFiles.length>0);assert.equal(str('status','--porcelain=v1','--untracked-files=all','--','repositories/memoryos-readiness'),'','production worktree has tracked or untracked changes');
const toolFiles=['analyze.mjs','bind-preservation.mjs','campaign.mjs','closure.mjs','common.mjs','engineering-supervisor.mjs','fixtures.mjs','independent-recompute.py','prospective-cli.mjs','prospective-publication.mjs','prospective-runtime.mjs','prospective-sequence.mjs','retained-generate-fixtures.mjs','seal.mjs','verify-evidence.mjs','write-report.mjs'];
const actualToolFiles=fs.readdirSync(path.join(root,tools)).filter(x=>fs.statSync(path.join(root,tools,x)).isFile()).sort();assert.deepEqual(actualToolFiles,toolFiles);
const sourceText=p=>read(p).toString('utf8').replaceAll('\r\n','\n').trimEnd();
let expectedPublication=sourceText('repositories/memoryos-readiness/src/publication.mjs')
  .replace("import { performance } from 'node:perf_hooks';", "import { performance } from 'node:perf_hooks';\n// Evidence-only source-derived copy of production publication.mjs. The sole\n// dependency substitution is the prospective-H sequence brand; all filesystem\n// and publication behavior remains the bound production implementation.")
  .replace("from './constants.mjs'","from '../../../memoryos-readiness/src/constants.mjs'").replace("from './errors.mjs'","from '../../../memoryos-readiness/src/errors.mjs'")
  .replace("from './helper-protocol.mjs'","from './prospective-sequence.mjs'").replace("from './windows-paths.mjs'","from '../../../memoryos-readiness/src/windows-paths.mjs'");
assert.equal(sourceText(tools+'/prospective-publication.mjs'),expectedPublication,'prospective publication has an unapproved source delta');
let expectedRuntime=sourceText('repositories/memoryos-readiness/src/runtime.mjs')
  .replace("import { Worker } from 'node:worker_threads';", "import { Worker } from 'node:worker_threads';\n// Evidence-only source-derived copy of production runtime.mjs. The prospective\n// helper bound is injected explicitly; CLI, aggregate, worker and cleanup\n// limits and all ownership/termination behavior remain unchanged.")
  .replace("from './constants.mjs'","from '../../../memoryos-readiness/src/constants.mjs'").replace("from './errors.mjs'","from '../../../memoryos-readiness/src/errors.mjs'")
  .replace("from './publication.mjs'","from './prospective-publication.mjs'").replace("new URL('./worker-entry.mjs', import.meta.url)","new URL('../../../memoryos-readiness/src/worker-entry.mjs', import.meta.url)")
  .replace('export function createSupervisor(options)', 'export function createProspectiveSupervisor(options)')
  .replace('function buildSupervisor({ kind, signal, started, now = () => performance.now() } = {}, dependencies) {','function buildSupervisor({ kind, signal, started, now = () => performance.now(), helperBoundMs } = {}, dependencies) {')
  .replace("  if (!['api', 'cli'].includes(kind) || typeof now !== 'function'\n      || (signal !== undefined", "  if (!['api', 'cli'].includes(kind) || typeof now !== 'function'\n      || !Number.isFinite(helperBoundMs) || helperBoundMs <= L.helperDeadlineMs || helperBoundMs > L.helperAggregateDeadlineMs\n      || (signal !== undefined")
  .replace('Math.min(deadline, launch + L.helperDeadlineMs, launch + L.helperAggregateDeadlineMs - helperUsedMs)','Math.min(deadline, launch + helperBoundMs, launch + L.helperAggregateDeadlineMs - helperUsedMs)')
  .replace('snapshot: () => ({ kind, deadline, helpers, workers, helperUsedMs, activeRole:', 'snapshot: () => ({ kind, deadline, helperBoundMs, helpers, workers, helperUsedMs, activeRole:');
assert.equal(sourceText(tools+'/prospective-runtime.mjs'),expectedRuntime,'prospective runtime has an unapproved source delta');
const sourceDerivation=writeJson(evidence+'/source-derivation.json',{kind:'MO1307ReplacementBoundSourceDerivation',result:'PASS',
  prospectiveSequence:{tool:record(tools+'/prospective-sequence.mjs'),productionSource:record('repositories/memoryos-readiness/src/helper-protocol.mjs'),delta:'Copy of private sequence/publication-inspection owner; request/response validation imported unchanged; helperDeadlineMs replaced only by sealed helperBoundMs; event snapshots and a synchronous evidence hook added after helperExited has charged the exact endpoint.'},
  prospectiveRuntime:{tool:record(tools+'/prospective-runtime.mjs'),productionSource:record('repositories/memoryos-readiness/src/runtime.mjs'),mechanicallyVerifiedTransformation:true,delta:'Source-derived runtime; imports redirected to bound production/evidence publication modules; worker entry remains production; helperDeadlineMs replaced only by sealed helperBoundMs; snapshot records the bound.'},
  prospectivePublication:{tool:record(tools+'/prospective-publication.mjs'),productionSource:record('repositories/memoryos-readiness/src/publication.mjs'),mechanicallyVerifiedTransformation:true,delta:'Byte-for-byte production publication body with imports redirected to bound production modules and prospective sequence brand.'},
  prospectiveCli:{tool:record(tools+'/prospective-cli.mjs'),productionSource:record('repositories/memoryos-readiness/src/cli.mjs'),delta:'Production orchestrateCli body with deterministic sealed session, prospective sequence/publication imports, post-helper evidence hook forwarding and evidence return projection.'},
  prohibitedDeltas:['protocol','security','path caps','byte caps','aggregate 20000','CLI 30000','worker/API 10000','cleanup 2000','worker entry','semantic evaluator']});

const integrityBefore=writeJson(evidence+'/integrity-before.json',{kind:'MO1307ReplacementBoundIntegrityBefore',result:'PASS',createdAtUtc:new Date().toISOString(),baseline,productionTree,
  helper:record('repositories/memoryos-readiness/helpers/windows-inspect.ps1'),productionBindings:productionFiles.map(p=>record(p)),authority:authorization,
  acceptedPhase3BObjectType:str('cat-file','-t','702c1b6381f6112a50ac844831d195275dac3350'),acceptedPhase3CObjectType:str('cat-file','-t','b02fc0226a1a2d800185a02071674ca80bdf4a1d'),nativeHelperExecutions:0,workerThreads:0});
const sourceBindings=[...productionFiles.map(p=>record(p)),...toolFiles.map(p=>record(tools+'/'+p)),record('.gitattributes'),record(process.execPath),record(powershellExe),
  authorization,authorityDecision,baselineReceipt,historicalBinding,expectedIdentityBinding,fixtureLedger,fixtureManifest,requestManifest,samplePlan,sequencePlan,environment,clockValidation,offlineValidation,sourceDerivation,integrityBefore];
const seal=writeJson(evidence+'/plan-seal.json',{kind:'MO1307ReplacementBoundPlanSeal',version:'1.0.0',result:'SEALED',sealedAtUtc:new Date().toISOString(),baseline:baselineReceipt,
  authority:authorityDecision,historicalBinding,sourceBindings,fixtureLedger,fixtureManifest,requestManifest,samplePlan,sequencePlan,environment,clockValidation,offlineValidation,sourceDerivation,
  counts:{derivation:1080,holdout:360,sequenceControls:16,sequenceHelperLaunches:104,sequenceWorkerThreads:16,totalHelperLaunches:1544},
  limitsMs:{productHistorical:5000,derivationObservationGuard:20000,prospectiveHDomain:{strictLower:5000,inclusiveUpper:20000},helperAggregate:20000,cliAdmission:30000,workerApi:10000,cleanup:2000},
  strictNoRetry:true,stopOnFirst:true,productionChanges:false,contractChanges:false,freezeChanges:false,certification:false,phase3A:false,phase3B:false,phase3C:false,phase3D:false,push:false,tag:false});
const anchor=writeJson(evidence+'/plan-seal-anchor.json',{kind:'MO1307ReplacementBoundPlanSealAnchor',record:seal,campaignInvocation:`${nodeExe} ${tools}/campaign.mjs ${seal.sha256}`,nativeHelperExecutions:0});
console.log(JSON.stringify({result:'SEALED',seal,anchor,counts:{derivation:1080,holdout:360,sequenceHelperLaunches:104,total:1544},nativeHelperExecutions:0,workerThreads:0}));
