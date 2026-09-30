// Preservation and reporting only: no certification or product execution.
import fs from 'node:fs';
import path from 'node:path';
import assert from 'node:assert/strict';
import {createHash} from 'node:crypto';
import {execFileSync} from 'node:child_process';
const root=process.cwd(),ev='repositories/cca-conformance/evidence/mo1307/phase3c-c3rb-cert2',td='repositories/cca-conformance/tools/mo1307-phase3c-c3rb-cert2',report='docs/mo1307-phase3c-c3rb-cert2.md';
const read=p=>fs.readFileSync(p),json=p=>JSON.parse(read(p)),sha=b=>'sha256:'+createHash('sha256').update(b).digest('hex');
const pin=p=>{const b=read(p);return{path:p,byteLength:b.length,sha256:sha(b)}};
const save=(p,v)=>fs.writeFileSync(p,typeof v==='string'?v:JSON.stringify(v,null,2)+'\n',{flag:'wx'});
const verify=(base,r)=>{const b=read(path.resolve(base,r.path));assert.equal(b.length,r.byteLength,r.path);assert.equal(sha(b),r.sha256,r.path);};
const plan=json(ev+'/campaign-plan.json'),ledger=json(ev+'/execution-ledger.json'),mapping=json(ev+'/current-control-map.json'),binding=json(ev+'/binding.json'),harness=json(ev+'/harness-validation/receipt.json'),toolchain=json(ev+'/git-resolution.json');
// Direct absolute Git below is used only to preserve and record repository state.
// The failed certification wrapper is never invoked again.
assert.equal(sha(read(toolchain.git.absolute)),toolchain.git.sha256);
assert.equal(sha(read(toolchain.core.absolute)),toolchain.core.sha256);
const git=(base,...args)=>execFileSync(toolchain.git.absolute,['-c','core.longpaths=true',...args],{cwd:base,encoding:'utf8',windowsHide:true,maxBuffer:32*1024*1024}).trim();
assert.equal(ledger.result,'FAILED/INCOMPLETE');assert.equal(ledger.firstFailure.stage,'02-native-source-review');
assert.deepEqual(ledger.stages.map(s=>s.status),['PASS','FAIL',...Array(11).fill('NOT_RUN')]);
assert.equal(mapping.rows.length,551);assert.equal(new Set(mapping.rows.map(r=>r.id)).size,551);assert.equal(mapping.rows.filter(r=>r.negative).length,426);assert.ok(mapping.rows.every(r=>r.currentStatus==='NOT_RUN'&&r.newExecutionRequired));
assert.equal(binding.rows.length,6);assert.ok(binding.rows.every(r=>r.result==='PASS'));
assert.equal(harness.cases.length,8);assert.ok(harness.cases.every(r=>r.result==='PASS_ENGINEERING_ONLY'));assert.equal(harness.negativeCases,6);
const stderr=read(ledger.firstFailure.stderr).toString();assert.ok(stderr.includes('ENGINEERING_GIT_EXIT:'));assert.equal(read(ledger.firstFailure.stdout).length,0);
const seal=json(ev+'/pre-execution-seal.json');for(const r of seal.members)verify(root,r);
const rows=mapping.rows.map(r=>({...r,currentStatus:'NOT_RUN',stopReason:'NOT_RUN_AFTER_MANDATORY_STOP',currentObservation:null,historicalOutcomeAdopted:false}));
const counts={allControls:551,negativeControls:426,behavioralControls:125,freshControlsExecuted:0,currentControlsPassed:0,currentControlsFailed:0,currentControlsNotRun:551,negativeControlsExecuted:0,negativeControlsNotRun:426,historicalResultsAdopted:0};
save(ev+'/remaining-inventory.json',{kind:'MO1307Phase3CCert2RemainingInventory',result:'FAILED/INCOMPLETE',candidate:plan.candidate,stopStage:ledger.firstFailure.stage,counts,stages:ledger.stages.filter(s=>s.status==='NOT_RUN'),frozenMapping:pin(ev+'/current-control-map.json'),rows});
const preservation={kind:'MO1307Phase3CCert2PostStopPreservation',purpose:'Evidence preservation only; no further certification execution',checkedAt:new Date().toISOString(),result:'PASS',candidate:plan.candidate,currentPreexistingFiles:0,preExecutionSealMembers:seal.members.length,preExecutionSealedBytesUnchanged:true,historical:[],previousFailedGeneration:null};
for(const r of json(ev+'/preexisting-worktree.json').files){verify(root,r);preservation.currentPreexistingFiles++;}
for(const h of json(ev+'/historical-proof-bindings.json').bindings){assert.equal(git(h.root,'rev-parse','HEAD'),h.commit);assert.equal(git(h.root,'status','--porcelain=v1','--untracked-files=all'),'');for(const r of h.files)verify(h.root,r);preservation.historical.push({root:h.root,commit:h.commit,files:h.files.length,status:'CLEAN',byteIdentical:true});}
const prior=json(ev+'/previous-failure-preservation-baseline.json');assert.equal(git(prior.root,'rev-parse','HEAD'),prior.commit);assert.equal(git(prior.root,'status','--porcelain=v1','--untracked-files=all'),'');for(const r of prior.files)verify(prior.root,r);
preservation.previousFailedGeneration={root:prior.root,commit:prior.commit,files:prior.files.length,status:'CLEAN',byteIdentical:true,receiptRewritten:false};
assert.equal(git(root,'rev-parse','HEAD'),plan.candidate);assert.equal(git(root,'branch','--show-current'),plan.branch);assert.equal(git(root,'diff','--name-only'),'');assert.equal(git(root,'diff','--cached','--name-only'),'');
preservation.productionChanged=false;preservation.trackedFilesChanged=false;save(ev+'/preservation.json',preservation);
const failure={kind:'MO1307Phase3CCert2FirstFailure',classification:'CERTIFICATION_HARNESS_ENGINEERING_GIT_EXIT_STATUS_FAILURE',stage:ledger.firstFailure.stage,source:td+'/git-toolchain.ps1:22',expected:{outerPowerShellExitCode:0,completedSourceReview:true},actual:{outerPowerShellExitCode:1,signal:null,completedSourceReview:false,error:'ENGINEERING_GIT_EXIT:',gitExitValueReported:false},startedAt:ledger.stages[1].startedAt,finishedAt:ledger.stages[1].finishedAt,command:ledger.stages[1].command,pid:ledger.stages[1].pid,stdout:pin(ledger.firstFailure.stdout),stderr:pin(ledger.firstFailure.stderr),exactStderr:stderr,interpretation:'The mandatory engineering wrapper raised ENGINEERING_GIT_EXIT with an empty suffix. Exit 1 is the outer PowerShell stage exit, not an established Git process exit. The underlying cause was not investigated or repaired after stop.',productDefectEstablished:false,retry:false,repairAfterStop:false};
save(ev+'/first-failure.json',failure);
const receipt={kind:'MO1307Phase3CC3RBSecondGenerationFailureReceipt',version:'1.0.0',createdAt:new Date().toISOString(),result:'FAILED/INCOMPLETE',accepted:false,candidate:plan.candidate,candidateTree:'54c8ca8acc388d8dcb5d8d76e119b434dcc1a9bb',integrationAuthority:plan.integrationAuthority,worktree:root,branch:plan.branch,previousFailedGeneration:prior.commit,previousFailurePreserved:true,engineeringGit:toolchain.git,engineeringHarnessValidation:{receipt:pin(ev+'/harness-validation/receipt.json'),passed:8,negativeCasesPassed:6,productCertification:false},campaign:{executions:1,stages:{passed:1,failed:1,notRun:11},bindingSubchecksPassed:6,firstFailure:failure,controls:counts,stopPolicyObserved:true,retries:0,replacements:0,corpusExpansion:0,repairWithinCampaign:false,certificationContinuedAfterFailure:false},limits:plan.limits,productionChanged:false,productionSecurityDefectEstablished:false,productHelperExecuted:false,areas:{filesystemNative:'SOURCE_REVIEW_INCOMPLETE; CORPUS_NOT_RUN',freshnessTOCTOU:'NOT_RUN',protocolTopology:'NOT_RUN',deadlinesCancellation:'NOT_RUN',cleanup:'NOT_RUN',environmentNetwork:'NOT_RUN',secretsLogs:'NOT_RUN',resources:'NOT_RUN',governance:'NOT_RUN'},bindingScope:'Exact source/package/helper, candidate, historical evidence and fixture/dependency integrity only; no organizational authentication or full security certification inferred.',historicalResultsAdopted:false,preservation:pin(ev+'/preservation.json'),remaining:pin(ev+'/remaining-inventory.json'),executionLedger:pin(ev+'/execution-ledger.json'),preExecutionSeal:pin(ev+'/pre-execution-seal.json'),commit:{identity:'Containing commit; exact hash reported externally after commit creation to avoid self-reference.',soleParent:plan.candidate,scope:'Only new conformance engineering tools, evidence and report'},phase3B:{acceptedCommit:plan.accepted3B,modified:false,rerun:false},phase3A:false,phase3D:false,phase3DHandoff:null,phase3DDisposition:'NO_ACCEPTED_HANDOFF',prohibitions:{productionChanges:false,C3S:false,hostedProviders:false,networkAcquisition:false,push:false,tag:false}};
save(ev+'/certification-receipt.json',receipt);
const lines=[
'# MO-1307 Phase 3C: second fresh C3RB certification generation',
'',
'**Phase 3C FAILED/INCOMPLETE.** Certification stopped at its first mandatory failed gate. All 551 primary corpus controls, including 426 rejection controls, remain NOT_RUN. No product defect is established and no accepted Phase 3D handoff exists.',
'',
'Eight separate engineering validation checks passed before sealing. During the single sealed campaign, the authority/dependency binding stage passed six checks. The following native source-review stage failed: expected outer PowerShell exit 0, observed 1. Its wrapper emitted ENGINEERING_GIT_EXIT with no value after the colon at git-toolchain.ps1:22. This does not establish that Git itself exited 1. No diagnosis, repair, retry, replacement case or later certification stage followed the failure.',
'',
'## Required final report',
'',
'| # | Requested item | Result |',
'|---|---|---|',
'| 1 | Original harness failure | Prior failed commit '+prior.commit+' at C:/m7c is preserved. PowerShell could not resolve bare git at helper-review.ps1:22 (expected 0, actual outer exit 1). Classification: engineering harness/tool-resolution failure; no product defect established. |',
'| 2 | Exact Git resolution | C:/Program Files/Git/cmd/git.exe; '+toolchain.git.version+'; 46,920 bytes; SHA-256 '+toolchain.git.sha256.slice(7)+'. Resolved before harness edits from the literal path already observed in repository tool inventory; direct file/hash/Authenticode and absolute version/exec-path probes. No ambient lookup, download, network requirement or global PATH change. |',
'| 3 | Harness correction | Required explicit GitExecutable argument to helper-review.ps1; pinned launcher/core length and SHA-256; safe absolute argument-array invocation; pre/post identity checks and exact version check; shared explicit Node wrapper. Validate-only exits before source review. Certification child environment carries no inherited PATH. Product source is unchanged. The later wrapper failure means full source review remains unverified. |',
'| 4 | Fail-closed harness validation | 8/8 PASS_ENGINEERING_ONLY: PowerShell and Node each accepted the exact tool and rejected missing path, wrong hash, and correctly hashed non-executable fixture. All six negative checks returned expected failure, with no poisoned-PATH fallback marker and no product/source-review execution. These are separate from the 426 product rejection controls. |',
'| 5 | Candidate/worktree | C3RB '+plan.candidate+'; tree 54c8ca8acc388d8dcb5d8d76e119b434dcc1a9bb; integration/evidence '+plan.integrationAuthority+'. New C:/m7c2 on '+plan.branch+'. |',
'| 6 | Sealed security inventory | 551 unique primary controls, 426 rejection and 125 behavioral controls. Every control requires fresh execution; zero historical PASS/NOT_RUN rows adopted. New mapping, exact expected outcomes, tool bytes, finite 13-stage order and limits sealed before the campaign. |',
'| 7 | Executed controls | 1 campaign stage PASS (6 binding checks), 1 mandatory stage FAIL, 11 later stages NOT_RUN. Primary corpus: 0 executed, 0 PASS, 0 FAIL, 551 NOT_RUN. Engineering preparation checks are reported separately. |',
'| 8 | Negative-control results | Product corpus: 0/426 executed, all 426 NOT_RUN. Engineering preparation: 6/6 expected rejections passed; these do not certify product negatives. |',
'| 9 | Filesystem/native | Source/package/helper binding passed; native source-review gate INCOMPLETE. Native identities, validated/final paths, held handles, reparse/junction/symlink, hardlink and filesystem-boundary execution NOT_RUN. |',
'| 10 | Freshness/TOCTOU | All current controls NOT_RUN, including held/reopened/same-handle identity and final-path replacement protections. No defect or PASS inferred. |',
'| 11 | Protocol/topology | Wire 2.0.0, framing/session/sequence, one-helper and worker topology, and product quiescence NOT_RUN. No product native helper was launched by the stopped campaign. |',
'| 12 | Deadlines/cancellation | NOT_RUN. Helper 5000 ms; aggregate helper-active 20000 ms; worker/API 10000 ms; CLI 30000 ms; cleanup 2000 ms. H remains NOT_ESTABLISHED; no characterization or redesign. |',
'| 13 | Cleanup | Product cleanup controls NOT_RUN. Both launched engineering stages returned exit observations; no later campaign stage launched. This is not a product cleanup/quiescence PASS. |',
'| 14 | Environment/network | Product trusted-launch, environment and offline/network controls NOT_RUN. Toolchain resolution and preparations used existing local tooling; no hosted provider, network acquisition, download or global PATH change. |',
'| 15 | Secrets/logs | Product secret/log and error-boundary controls NOT_RUN. Raw engineering stdout/stderr retained unchanged; no runtime secret/log certification claim. Resource controls likewise NOT_RUN. |',
'| 16 | Governance | Fresh governance negatives NOT_RUN. Binding established byte/dependency equality, not organizational authentication or human authorization. Accepted Phase 3B '+plan.accepted3B+' remains untouched and was not rerun; no Phase 3A or 3D performed. |',
'| 17 | First failure | 02-native-source-review; '+failure.source+'; ENGINEERING_GIT_EXIT with empty suffix; outer PowerShell expected 0, observed 1; stdout empty, stderr '+failure.stderr.byteLength+' bytes. Underlying cause unconfirmed. |',
'| 18 | Certification receipt | '+ev+'/certification-receipt.json: FAILED/INCOMPLETE. Raw failure, complete remaining inventory, ledger, preparation validation and preservation records accompany it. |',
'| 19 | Certification commit | The containing conformance-only commit has exact C3RB as sole parent. Its generated hash is supplied in the delivery response; no self-referential future hash is embedded here. |',
'| 20 | Phase 3C status | **FAILED/INCOMPLETE**, not accepted. |',
'| 21 | Repository status | Post-stop verification: '+preservation.currentPreexistingFiles+' preexisting checkout files unchanged, '+seal.members.length+' pre-execution sealed members unchanged; both accepted historical 3C worktrees and all 57 files of C:/m7c failed generation byte-preserved and clean. Only new generation tools/evidence/report are to be committed. Final clean status is checked after commit and reported in delivery. |',
'| 22 | Phase 3D handoff | **None accepted.** Do not consume this failed generation as accepted Phase 3C input. Stop after Phase 3C; no Phase 3D started. |',
'',
'## Tool identity and authorization',
'',
'The preexisting Git for Windows installation is authorized repository engineering tooling for local worktree and evidence operations under the user request. Authenticode status was Valid, signer '+toolchain.discovery.authenticode.signer+', thumbprint '+toolchain.discovery.authenticode.thumbprint+'. This identity evidence does not authenticate MemoryOS organizational approval.',
'',
'Git core: '+toolchain.core.absolute+'; '+toolchain.core.byteLength+' bytes; SHA-256 '+toolchain.core.sha256.slice(7)+'. Reported exec-path: '+toolchain.discovery.execPath+'. Node '+toolchain.node.version+' is bound at '+toolchain.node.absolute+'; SHA-256 '+toolchain.node.sha256.slice(7)+'. These were existing local tools, with no acquisition.',
'',
'The missing-path, wrong-identity and non-executable checks ran once per implementation under a poisoned PATH. Validation-only receipts show no fallback and no certification execution. They establish those finite preparation results; they do not establish that the full PowerShell source-review path works. The subsequent sealed failure is retained separately and supersedes any implication of campaign readiness.',
'',
'## Finite inventory and evidence preservation',
'',
'The authoritative union was recovered mechanically from accepted original 3C '+preservation.historical[1].commit+' and accepted 3C-R '+preservation.historical[0].commit+'. Frozen current primary coverage is listed below; overlapping auxiliary witnesses are not counted again.',
'',
'| Current suite | Primary controls | Rejection controls | Current result |',
'|---|---:|---:|---|',
...mapping.summary.map(s=>'| '+s.suite+' | '+s.controls+' | '+s.negative+' | NOT_RUN |'),
'| Total | 551 | 426 | NOT_RUN |',
'',
'Binding verified candidate/runtime identity, exact historical and integration product equality, 89 shipped source members and 88 distribution entries plus helper/SBOM identities, committed historical evidence, 583 fixture files, 181 reviewed dependencies, and the current checkout baseline. These are limited integrity/binding results, not primary corpus results. File names such as reuse-dependencies.json and historical PASS values preserve provenance only; this fresh campaign adopts no historical control outcome.',
'',
'Managed worktree creation failed on retained historical long paths before certification. The requested new short C:/m7c2 checkout was then created with explicit Git and command-scoped core.longpaths=true. C:/m7c was not overwritten. Preparation records preserve original tool bytes, the narrow Git correction, independent complete fresh runtime mappings, and pre-seal output-name adjustments. No expected negative outcome was weakened.',
'',
'All post-stop operations are limited to reading preserved observations, rehashing evidence, reporting, and the conformance-only commit. They do not rerun certification. The pre-execution seal remains byte-exact. All 11 unexecuted stages and 551 current controls remain NOT_RUN. The original failed receipt remains byte-identical; accepted historical receipts remain preserved for their own exact scope.',
'',
'The failure occurred between '+failure.startedAt+' and '+failure.finishedAt+'. Raw stderr is the authoritative observation. The wrapper emitted no Git exit value; the classification describes the observed engineering failure without asserting its root cause. Product filesystem, trusted-launch, deadline, TOCTOU and protocol defects are not established.',
'',
'Evidence: [receipt](../'+ev+'/certification-receipt.json), [first failure](../'+ev+'/first-failure.json), [raw stderr](../'+ev+'/02-native-source-review.stderr.txt), [execution ledger](../'+ev+'/execution-ledger.json), [all remaining controls](../'+ev+'/remaining-inventory.json), [harness validation](../'+ev+'/harness-validation/receipt.json), [tool resolution](../'+ev+'/git-resolution.json), [binding](../'+ev+'/binding.json), [preservation](../'+ev+'/preservation.json), [pre-execution seal](../'+ev+'/pre-execution-seal.json).',
''
];
save(report,lines.join('\n'));
console.log(JSON.stringify({result:receipt.result,report,counts,preservedCurrentFiles:preservation.currentPreexistingFiles,sealedMembers:seal.members.length,previousFailedGeneration:preservation.previousFailedGeneration,historical:preservation.historical}));
