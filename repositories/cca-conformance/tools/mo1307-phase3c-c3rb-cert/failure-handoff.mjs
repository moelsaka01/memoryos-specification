// Post-failure preservation and reporting only. Never launches certification or product code.
import fs from 'node:fs';import path from 'node:path';import assert from 'node:assert/strict';import {createHash} from 'node:crypto';import {execFileSync} from 'node:child_process';
const root=process.cwd(),ev='repositories/cca-conformance/evidence/mo1307/phase3c-c3rb-cert',td='repositories/cca-conformance/tools/mo1307-phase3c-c3rb-cert',report='docs/mo1307-phase3c-c3rb-certification.md';
const read=p=>fs.readFileSync(p),json=p=>JSON.parse(read(p)),sha=b=>'sha256:'+createHash('sha256').update(b).digest('hex'),pin=p=>{const b=read(p);return{path:p,byteLength:b.length,sha256:sha(b)}};
const save=(p,v)=>fs.writeFileSync(p,typeof v==='string'?v:JSON.stringify(v,null,2)+'\n',{flag:'wx'});
const git=(base,...a)=>execFileSync('git',['-c','core.longpaths=true',...a],{cwd:base,windowsHide:true,encoding:'utf8',maxBuffer:32*1024*1024}).trim();
const ledger=json(ev+'/execution-ledger.json'),plan=json(ev+'/campaign-plan.json'),binding=json(ev+'/binding.json');
assert.equal(ledger.result,'FAILED/INCOMPLETE');assert.equal(ledger.firstFailure.stage,'02-native-source-review');assert.equal(ledger.stages.filter(s=>s.status==='FAIL').length,1);assert.equal(ledger.stages.filter(s=>s.status==='NOT_RUN').length,8);
const stderr=read(ledger.firstFailure.stderr).toString();assert.ok(stderr.includes("The term 'git' is not recognized"));
const corpus=json(ev+'/frozen-authoritative-corpus.json').inventory;
const statusRows=corpus.rows.map(r=>{const semantic=/^(?:root:|trust-graph:|governance:)/.test(r.id),selected=semantic||r.classification!=='REUSED';return{id:r.id,historicalIds:r.historicalIds,negative:r.negative,historicalResult:r.result,historicalClassification:r.classification,historicalWitnesses:r.witnesses,selectedForFreshExecution:selected,currentStatus:selected?'NOT_RUN_AFTER_MANDATORY_STOP':'REUSE_ELIGIBLE_NOT_ADOPTED_GENERATION_FAILED',currentExpectedActual:null,reason:'No later campaign executed after mandatory source-review failure; no historical PASS converted into a fresh observation.'}});
assert.equal(statusRows.length,551);
save(ev+'/remaining-inventory.json',{kind:'MO1307Phase3CRemainingInventory',candidate:plan.candidate,result:'FAILED/INCOMPLETE',stopStage:ledger.firstFailure.stage,counts:{allControls:statusRows.length,negativeControls:statusRows.filter(r=>r.negative).length,selectedFreshNotRun:statusRows.filter(r=>r.selectedForFreshExecution).length,reuseEligibleNotAdopted:statusRows.filter(r=>!r.selectedForFreshExecution).length,freshControlsExecuted:0,currentControlsAccepted:0},stages:ledger.stages.filter(s=>s.status==='NOT_RUN'),controls:statusRows,exactExpectedOutcomes:pin(ev+'/frozen-execution-cases.json'),originalExpectedActual:pin(ev+'/original-authoritative-corpus.json')});
const preservation={kind:'MO1307Phase3CPostStopPreservation',purpose:'Post-stop preservation only; not further certification execution',checkedAt:new Date().toISOString(),candidate:plan.candidate,result:'PASS',currentFiles:0,historical:[],changesOutsideNewEvidence:false};
for(const r of json(ev+'/preexisting-worktree.json').files){const b=read(r.path);assert.equal(b.length,r.byteLength,r.path);assert.equal(sha(b),r.sha256,r.path);preservation.currentFiles++;}
for(const b of json(ev+'/historical-proof-bindings.json').bindings){assert.equal(git(b.root,'rev-parse','HEAD'),b.commit);assert.equal(git(b.root,'status','--porcelain=v1','--untracked-files=all'),'');for(const r of b.files){const raw=fs.readFileSync(path.join(b.root,r.path));assert.equal(raw.length,r.byteLength,r.path);assert.equal(sha(raw),r.sha256,r.path);}preservation.historical.push({root:b.root,commit:b.commit,files:b.files.length,gitStatus:'CLEAN',unchanged:true});}
assert.equal(git(root,'diff','--name-only'),'');assert.equal(git(root,'rev-parse','HEAD'),plan.candidate);save(ev+'/preservation.json',preservation);
const nativeSource={status:'INCOMPLETE',failedGate:'02-native-source-review',expected:{exitCode:0,completedMechanicalSourceReview:true},actual:{exitCode:1,completedMechanicalSourceReview:false,errorType:'CommandNotFoundException',unresolvedCommand:'git',source:'repositories/cca-conformance/tools/mo1307-phase3c-c3rb-cert/helper-review.ps1:22'},classification:'CERTIFICATION_HARNESS_LAUNCH_ENVIRONMENT_FAILURE',causalLimit:'The observed failure is Git command resolution in the engineering review PowerShell. No product security defect established; no root-cause repair, environment change or retry performed after failure.',stderr:pin(ledger.firstFailure.stderr),stdout:pin(ledger.firstFailure.stdout),exactError:stderr};
save(ev+'/first-failure.json',nativeSource);
const sourceScope=binding.rows.find(r=>r.id==='package-helper-source-binding').detail;
const receipt={kind:'MO1307Phase3CC3RBCertificationFailureReceipt',version:'1.0.0',createdAt:new Date().toISOString(),result:'FAILED/INCOMPLETE',candidate:plan.candidate,candidateTree:'54c8ca8acc388d8dcb5d8d76e119b434dcc1a9bb',mainIntegrationAuthority:plan.integrationAuthority,historical3CR:plan.historical3CR,historical3CRRewritten:false,worktree:root,branch:plan.branch,firstFailure:nativeSource,stages:{passed:1,failed:1,notRun:8},bindingSubchecksPassed:6,controls:json(ev+'/remaining-inventory.json').counts,acceptedCurrentSecurityControls:0,productionSecurityDefectEstablished:false,productionChanged:false,historicalReceiptState:'PRESERVED_ACCEPTED_FOR_ITS_EXACT_CANDIDATE_AND_SCOPE',freshCertificationAccepted:false,helperLimitMs:5000,H:'NOT_ESTABLISHED',trustResult:'Exact candidate/receipt/source/fixture integrity and dependency equality verified; no organizational authentication inferred.',sourceBinding:{shippedMembers:89,distributionRows:88,fixtureFiles:583,reviewedDependencies:181,helper:sourceScope.helper,distribution:sourceScope.distribution,sbom:sourceScope.sbom},nativeFilesystemFreshnessTOCTOU:'NOT_CERTIFIED_CURRENT_GENERATION_SOURCE_REVIEW_INCOMPLETE_AND_EXECUTIONS_NOT_RUN',protocol:'NOT_RUN',processTopology:'NOT_RUN_PRODUCT_HELPER_NOT_LAUNCHED',deadlinesCancellationCleanup:'NOT_RUN',environmentNetworkSecrets:'STATIC_OBSERVATIONS_ONLY_NOT_CERTIFIED_CURRENT_GENERATION',resources:'NOT_RUN',governance:'NOT_RUN',failurePolicy:{stoppedAtFirstMandatoryFailure:true,retries:0,failureConvertedToHistoricalQualification:false,additionalCertificationAfterFailure:false},preservation:pin(ev+'/preservation.json'),remaining:pin(ev+'/remaining-inventory.json'),executionLedger:pin(ev+'/execution-ledger.json'),planSeal:pin(ev+'/pre-execution-seal.json'),commit:{soleParent:plan.candidate,scope:'Conformance-only failed-generation evidence, tools and report',identity:'Containing commit; exact hash reported externally after creation to avoid self-reference.'},phase3DHandoff:null,phase3DDisposition:'NO_ACCEPTED_HANDOFF; do not consume this failed generation as accepted Phase 3C input.',prohibitions:{C3S:false,F22:false,phase3A:false,phase3B:false,phase3D:false,productionChange:false,push:false,tag:false,merge:false,publish:false,deploy:false,approval:false}};
save(ev+'/certification-receipt.json',receipt);
const c=receipt.controls;
const text=`# MO-1307 restarted Phase 3C C3RB security certification

**Phase 3C FAILED/INCOMPLETE.** The single current generation stopped at its first mandatory failed gate. This is a certification harness failure; no product security defect was established. There is no accepted Phase 3D handoff.

The authority/dependency binding gate passed. The next mandatory native source-review gate exited **1**, expected **0**, when fixed Windows PowerShell could not resolve the engineering command 'git' at 'helper-review.ps1:22'. Its stdout is empty; the complete 533-byte stderr is retained unchanged. The review did not produce its source-review receipts. No product native helper, negative-control campaign, or subsequent certification stage was launched. No retry, repair of the failed gate, weakening, or replacement by historical evidence occurred after this failure.

The relevant captured error is:

> The term 'git' is not recognized as the name of a cmdlet, function, script file, or operable program.

This observes a tool-resolution failure in the engineering review environment. It does not demonstrate a failed product filesystem check, an unsafe product launch, a deadline defect, or any other product security defect. The precise underlying environment cause was not investigated after stop.

## Required final-report register

| # | Requested item | Result |
|---|---|---|
| 1 | Candidate | C3RB '${plan.candidate}'; tree '54c8ca8acc388d8dcb5d8d76e119b434dcc1a9bb'. Main integration/evidence authority '${plan.integrationAuthority}'. |
| 2 | Worktree/branch | 'C:\\m7c'; '${plan.branch}'; exact C3RB parent. |
| 3 | Security inventory | Frozen repository Freeze §§17–21 plus accepted historical 3C-R finite union: 551 controls, 426 rejection controls. Finite order and exact expected outcomes sealed before execution. |
| 4 | Trust/authority | Binding PASS: exact candidate/tree, Node 24.21.0 hash, accepted original/refresh commits and unchanged C3RB product closure. Integrity is not organizational authentication. Fresh trust negatives NOT_RUN. |
| 5 | Evidence/graph/history | Historical receipts/evidence verified against committed blobs and manifests; 583 fixture files and 181 reviewed dependencies matched. Fresh graph/history negatives NOT_RUN. Historical accepted failures and qualifications retained. |
| 6 | Filesystem/native | Mandatory mechanical source-review gate INCOMPLETE after Git lookup failure; independent read-only source observations are not certification. Native negative execution NOT_RUN. |
| 7 | Freshness/TOCTOU | NOT_RUN; frozen held-handle, reopened-path, same-handle, final-path and replacement controls remain unexecuted. |
| 8 | Protocol | NOT_RUN; wire 2.0.0, framing/session/sequence/operation/EOF/ERROR/response-bound controls remain in the inventory. |
| 9 | Process topology | Product topology NOT_RUN. Only engineering binding and source-review child processes executed and their close events returned exit codes. No product helper or persistent service launched. |
| 10 | Deadline/cancellation | NOT_RUN. Helper 5000 ms, aggregate 20000 ms, worker/API 10000 ms, CLI 30000 ms, cleanup 2000 ms remain unchanged. H is NOT_ESTABLISHED. |
| 11 | Cleanup security | Product cleanup controls NOT_RUN. Generation stopped; no later stage launched. No product helper needed termination. |
| 12 | Environment isolation | Product controls NOT_RUN. Engineering source-review environment failed Git lookup. Do not relabel this as a product environment-refusal PASS. |
| 13 | Network/offline | Product network/offline controls NOT_RUN; no product/provider/network acquisition performed by this task. Static absence findings alone do not certify egress isolation. |
| 14 | Secret/log boundary | Runtime sentinel/error controls NOT_RUN. Exact harness stdout/stderr preserved; no product evidence bodies or real credentials acquired. |
| 15 | Resource checks | NOT_RUN. No limit changes or new hard RSS enforcement claim. |
| 16 | Package/helper binding | PASS source binding only: 89 shipped members, 88 distribution entries, helper SPDX SHA-1/SHA-256 and exact C3RB helper. No Phase 3B assembly/install certification. |
| 17 | Negative controls | Zero executed. ${c.selectedFreshNotRun} selected fresh controls NOT_RUN; ${c.reuseEligibleNotAdopted} unchanged controls eligible for dependency reuse but not adopted into an accepted current generation. All 551 current rows remain unaccepted. |
| 18 | Governance separation | Fresh governance controls NOT_RUN; no computed/historical readiness converted into human authorization. No push, tag, merge, publication, deployment or approval. |
| 19 | Receipt | 'repositories/cca-conformance/evidence/mo1307/phase3c-c3rb-cert/certification-receipt.json', result FAILED/INCOMPLETE. |
| 20 | Phase 3C status | **FAILED/INCOMPLETE**. |
| 21 | Commit | One conformance-only containing commit; hash supplied after creation. Sole parent is C3RB. No self/future commit hash embedded. |
| 22 | Repository status | 12,035 preexisting checkout files rehashed unchanged; both historical 3C worktrees remain clean and byte-preserved. Only this generation's evidence/tools/report added. Final clean status verified after commit. |
| 23 | Phase 3D handoff | **None accepted.** This failed generation must not serve as accepted 3C evidence. No Phase 3D work performed. |

## Authority and finite scope

The Phase 1 'mo1307-conformance-inventory.json' still says Phase 3 NOT_STARTED and is not substituted for the Phase 3C inventory. This generation uses Freeze 1, the scoped publication/finalization corrections, original accepted 3C '191f34748141afca2027e8e9db0c6f1b6a9c84c0', and accepted C3RB 3C-R '${plan.historical3CR}'. Their inventory and exact expected/actual outcomes are preserved with source commit identities.

The 551-control union comprises root 157, trust/graph 96, governance 115, runtime boundary 127, and refresh 56. It includes 426 rejection controls. The run planned fresh root/trust/governance plus existing native/protocol/deadline witnesses, with explicit dependency reuse for unaffected unselected controls. No adaptive corpus expansion occurred. Because the mandatory review failed before these campaigns, historical PASS rows remain historical and no current security control is accepted. All eight later stages retain NOT_RUN.

The binding gate established exact C3RB equality to historical 3C-R shipped source and committed main integration source. It checked all 89 package members, helper/distribution/SBOM identities, historical source/evidence and fixtures. It did not authenticate the organization or human issuing prior decisions. Original 'r3c' and accepted 3C-R evidence were read only, rehashed after the stop, and remain unchanged.

## Preparation and failure preservation

Managed worktree creation failed before certification because retained historical paths exceeded its path length. Git then created the requested isolated checkout at 'C:\\m7c' with a command-scoped long-path option. A pre-freeze source-port anchor was corrected before any certification execution; that setup error is disclosed in 'setup.json'. Independent pre-run review added immediate stop behavior to root/governance runners, a durable orchestration failure ledger, and bounded owned-driver cleanup to the observer. Prior source bytes, port manifest, preparation seal and final seal are retained. These changes affect engineering orchestration only.

Inherited 'attempt2' output spellings were frozen as names for the sole planned new attempt; those campaigns never executed. No current failed observation was converted into a historical qualification. The stopped tools, exact command arguments, process IDs/times, raw outputs, source bindings and full remaining inventory are retained.

The helper remains 30,210 bytes, SHA-256 '35381850f1ef8c322e528156ebd8779071ad3288cdccd4d0ebab51ce6f9c6ac8'. The accepted historical receipt remains valid for its exact scope; it does not make this failed fresh generation accepted. Physical cross-volume coverage, OS-wide network isolation, hard RSS sandboxing and organizational/human authentication are not newly established. Private immutable-root/trusted-host assumptions and conservative cleanup flags remain unchanged.

Evidence links: [failure receipt](../${ev}/certification-receipt.json), [exact first failure](../${ev}/first-failure.json), [raw stderr](../${ev}/02-native-source-review.stderr.txt), [execution ledger](../${ev}/execution-ledger.json), [remaining inventory](../${ev}/remaining-inventory.json), [binding gate](../${ev}/binding.json), [preservation](../${ev}/preservation.json).
`;
save(report,text);console.log(JSON.stringify({result:receipt.result,report,counts:c,preservedCurrentFiles:preservation.currentFiles,historical:preservation.historical.map(r=>({commit:r.commit,files:r.files}))}));
