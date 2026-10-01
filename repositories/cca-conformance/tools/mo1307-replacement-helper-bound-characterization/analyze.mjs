// Offline analysis only. Launches zero helpers and zero workers.
import fs from 'node:fs';
import path from 'node:path';
import assert from 'node:assert/strict';
import {root,evidence,json,record,writeJson,str,hash,read,baseline,productionTree,helperSha} from './common.mjs';

const campaign=json(evidence+'/campaign.json'),independent=json(evidence+'/independent-recomputation.json'),historical=json(evidence+'/historical-binding.json');
const list=dir=>fs.existsSync(path.join(root,dir))?fs.readdirSync(path.join(root,dir),{recursive:true}).filter(x=>String(x).endsWith('.json')).map(x=>path.join(dir,String(x)).replaceAll('\\','/')).sort():[];
const derivationFiles=list(evidence+'/derivation'),holdoutFiles=list(evidence+'/holdout'),sequenceHelperFiles=list(evidence+'/sequence-controls').filter(x=>x.includes('/helpers/')),
  derivation=derivationFiles.map(json),holdout=holdoutFiles.map(json),helpers=sequenceHelperFiles.map(json),all=[...derivation,...holdout,...helpers];
assert.equal(all.length,campaign.counts.actualHelperLaunches);
const ledger=writeJson(evidence+'/raw-sample-ledger.json',{kind:'MO1307ReplacementBoundRawLedger',campaignResult:campaign.result,
  receipts:[...derivationFiles,...holdoutFiles,...sequenceHelperFiles].map(p=>record(p)),counts:{derivation:derivation.length,holdout:holdout.length,sequenceHelpers:helpers.length,total:all.length},fixedPrefix:all.map(r=>r.planRef??{controlId:r.controlId,helperOrdinal:r.helperOrdinal,sequence:r.sequence})});
const perClass=[];for(let id=1;id<=18;id++){const d=derivation.filter(r=>r.planRef?.classId===id),h=holdout.filter(r=>r.planRef?.classId===id),summary=rows=>rows.length?{count:rows.length,passes:rows.filter(r=>r.result==='PASS').length,minMs:Math.min(...rows.filter(r=>r.Sms!==null).map(r=>r.Sms)),maxMs:Math.max(...rows.filter(r=>r.Sms!==null).map(r=>r.Sms))}:{count:0,passes:0,minMs:null,maxMs:null};perClass.push({classId:id,derivation:summary(d),holdout:summary(h)});}
const statistics=writeJson(evidence+'/statistics.json',{kind:'MO1307ReplacementBoundStatistics',campaignResult:campaign.result,disposition:independent.disposition,
  campaign:record(evidence+'/campaign.json'),H:fs.existsSync(path.join(root,evidence,'h-freeze.json'))?json(evidence+'/h-freeze.json'):null,perClass,
  counts:{planned:1544,actual:campaign.counts.actualHelperLaunches,derivation:derivation.length,holdout:holdout.length,sequenceHelpers:helpers.length,sequenceControls:campaign.counts.sequenceControlsAttempted,workerThreads:campaign.counts.workerThreads},
  noPercentile:true,noAverage:true,noMedian:true,noAdaptiveMargin:true});
const passSecurity=row=>row.result==='PASS'&&row.security?.freshProcess&&row.security?.oneCanonicalFrame&&row.security?.eofAndAllPipes&&row.security?.stderrZero&&row.security?.noRetry&&row.security?.noOverlap&&row.security?.transportSelfDetachAndQuiescence&&row.security?.humanAuthoritySeparated&&
  (row.kind==='MO1307ReplacementBoundLaunch'?(row.security?.failClosed&&row.security?.cleanupWithin2000):row.security?.sameProspectiveSupervisorOwnership);
const securityPasses=all.filter(passSecurity).length,securityFailures=all.length-securityPasses;
const securityResult=all.length===0?'NOT_EXECUTED':securityFailures===0&&independent.disposition==='H_ESTABLISHED'&&all.length===1544?'PASS':securityFailures===0?'PASS_FOR_EXECUTED_PREFIX':'STOPPED_WITH_RETAINED_FIRST_FAILURE';
const security=writeJson(evidence+'/security-identity-summary.json',{kind:'MO1307ReplacementBoundSecurityIdentitySummary',result:securityResult,
  successfulLaunches:securityPasses,failedOrIncompleteLaunches:securityFailures,productionTransportQuiescence:'Each qualifying response requires the unchanged transport to validate one canonical response, process exit, EOF, stdin/stdout/stderr terminal states and helper self-detachment.',
  helperSha,productionTree,noHelperReuse:true,noRetry:true,noOverlap:true,realProductionWorkers:campaign.counts.workerThreads,frozenPathAndByteCaps:true,toctouAndCheckedHandleUnchanged:true,cleanupMs:2000,humanAuthoritySeparated:true});
const dependency=writeJson(evidence+'/dependency-impact.json',{kind:'MO1307ReplacementBoundDependencyImpact',result:'ANALYSIS_ONLY',
  ifHEstablished:{governance:['Prospectively adopt exact H while preserving every historical failure.'],production:['contracts/definitions.json helperDeadlineMs','generated src/constants.mjs','contracts/contract.json','sbom.spdx.json','distribution-manifest.json'],phase3A:'FRESH_COMPLETE_GENERATION_REQUIRED',phase3B:'CANDIDATE_BOUND_TARGETED_PACKAGE_SBOM_DISTRIBUTION_OFFLINE_INSTALL_PROVENANCE_REFRESH',phase3C:['deadline timeout exact mapping','late native success refusal','deadline sequence no partial or late success','dependent equality, limits and raw witnesses selected from the adoption diff'],phase3D:'ONLY_AFTER_FRESH_3A_AND_REFRESHED_3B_AND_3C_ARE_ACCEPTED'},
  currentAcceptedEvidence:{phase3B:'702c1b6381f6112a50ac844831d195275dac3350 exact scope unchanged',phase3C:'b02fc0226a1a2d800185a02071674ca80bdf4a1d exact scope unchanged'},productionModifiedByThisTask:false});
const liveR3aHead=str('-C',historical.phase3A.worktree,'rev-parse','HEAD'),liveR3aStatus=str('-C',historical.phase3A.worktree,'status','--porcelain=v1','--untracked-files=all');
const historicalVerified=historical.result==='PRESERVED'&&historical.acceptedPhase3B.type==='commit'&&historical.acceptedPhase3C.type==='commit'&&historical.phase3A.head===historical.phase3A.expectedHead&&liveR3aHead===historical.phase3A.head&&liveR3aStatus===historical.phase3A.statusPorcelain&&str('cat-file','-t',historical.acceptedPhase3B.commit)==='commit'&&str('cat-file','-t',historical.acceptedPhase3C.commit)==='commit';assert.equal(historicalVerified,true);
let finalStop=campaign.stop;
if(independent.result!=='PASS'){
  const stopRecord=writeJson(evidence+'/independent-recomputation-stop.json',{kind:'MO1307ReplacementBoundIndependentStop',result:'H_NOT_ESTABLISHED',reason:'INDEPENDENT_RECOMPUTATION_MISMATCH',errors:independent.errors,campaign:record(evidence+'/campaign.json'),actualHelperLaunches:campaign.counts.actualHelperLaunches,noRetry:true});
  if(finalStop===null||finalStop===undefined)finalStop={reason:{code:'INDEPENDENT_RECOMPUTATION_MISMATCH',errors:independent.errors},evidence:stopRecord};
  else finalStop={...finalStop,secondaryIndependentMismatch:{errors:independent.errors,evidence:stopRecord}};
}
const result=independent.disposition;
const decision=writeJson(evidence+'/decision.json',{kind:'MO1307ReplacementBoundDecision',version:'1.0.0',result,Hms:result==='H_ESTABLISHED'?independent.derived.H_ms:null,
  candidateHms:campaign.candidateHms,stop:result==='H_NOT_ESTABLISHED'?finalStop:null,counts:campaign.counts,statistics,independent:record(evidence+'/independent-recomputation.json'),security,dependencyImpact:dependency,
  historicalBinding:record(evidence+'/historical-binding.json'),historicalEvidencePreserved:historicalVerified,computedCharacterizationOnly:true,humanReleaseAuthorization:'SEPARATE_AND_NOT_PERFORMED',
  phase3AResumed:false,phase3BRerun:false,phase3CRerun:false,phase3D:false,productionChanges:false,contractChanges:false,freezeChanges:false,push:false,tag:false});
const sourceAfter=writeJson(evidence+'/source-after.json',{kind:'MO1307ReplacementBoundSourceAfter',commit:str('rev-parse','HEAD'),baseline,
  productionTree:str('rev-parse','HEAD:repositories/memoryos-readiness'),helperSha:hash(read('repositories/memoryos-readiness/helpers/windows-inspect.ps1')),productionDiffFromBaseline:str('diff','--name-only',baseline,'--','repositories/memoryos-readiness'),
  acceptedPhase3BObjectType:str('cat-file','-t','702c1b6381f6112a50ac844831d195275dac3350'),acceptedPhase3CObjectType:str('cat-file','-t','b02fc0226a1a2d800185a02071674ca80bdf4a1d'),productionUnchanged:true});
assert.equal(json(sourceAfter.path).productionTree,productionTree);assert.equal(json(sourceAfter.path).helperSha,helperSha);assert.equal(json(sourceAfter.path).productionDiffFromBaseline,'');
writeJson(evidence+'/integrity-after.json',{kind:'MO1307ReplacementBoundIntegrityAfter',result:independent.result==='PASS'?'PASS':'STOPPED_INDEPENDENT_MISMATCH',campaign:record(evidence+'/campaign.json'),ledger,statistics,
  independent:record(evidence+'/independent-recomputation.json'),security,dependency,decision,sourceAfter,historicalBinding:record(evidence+'/historical-binding.json'),productionTree,helperSha});
console.log(JSON.stringify({result,Hms:result==='H_ESTABLISHED'?independent.derived.H_ms:null,counts:campaign.counts,decision}));
