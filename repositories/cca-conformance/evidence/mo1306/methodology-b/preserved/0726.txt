"""Close the evidence-only blocked resolution; never executes a product or remote mutation."""
import argparse,copy,datetime,hashlib,json,os,subprocess,sys,uuid
from pathlib import Path
sys.dont_write_bytecode=True
ROOT=Path(__file__).resolve().parents[4]
HERE=Path(__file__).resolve().parent
OUT=ROOT/'repositories/cca-conformance/evidence/mo1306/phase3ar-resolution'
OLD=OUT.parent/'phase3ar'
CHECKPOINT='f236c4a2f94d8cd8e763aaa4bd6c52d703429692'
C3AB='9e1bbff99c23cdbc4c80f11e87eadb89a36e8f44'
MAIN='5955af062152a84c10de17860ba0bcabe8b3555f'
CERT='3096139e0108be22528859e4f462356dddf6ef29'
END='MO-1306 PHASE 3A NATIVE DEADLINE BLOCKED'
START=datetime.datetime.fromisoformat('2026-09-27T10:39:44+00:00')
def rawjson(p):return json.loads(p.read_bytes())
def encode(v):return (json.dumps(v,sort_keys=True,separators=(',',':'))+'\n').encode()
def sha(b):return 'sha256:'+hashlib.sha256(b).hexdigest()
def row(p):
 p=Path(p);b=p.read_bytes();return {'path':p.relative_to(ROOT).as_posix(),'byteLength':len(b),'sha256':sha(b)}
def put(name,value):
 p=OUT/name;b=encode(value)
 if p.exists():assert p.read_bytes()==b,'Refusing to overwrite retained evidence: '+name
 else:p.write_bytes(b)
 return row(p)
def run(argv,env=None):
 p=subprocess.run(argv,cwd=ROOT,env=env,capture_output=True,timeout=90)
 return {'argv':argv,'exitCode':p.returncode,'stdout':p.stdout.decode('utf-8','replace'),'stderr':p.stderr.decode('utf-8','replace')}
def git(*args):
 r=run(['git',*args]);assert r['exitCode']==0,r;return r['stdout'].strip()
def verify_receipt(r):
 assert r['status']=='NATIVE_DEADLINE_BLOCKED'
 assert r['startingHead']==r['finalHead']==CHECKPOINT and r['productionAuthority']==C3AB
 assert all(r[k] is False for k in ['allCertificationGatesPassed','nativeCertified','githubHostedCertified','releaseReady','labelsPromoted','completionCommitCreated'])
 assert r['completionCommit'] is None and r['completionCommitParent'] is None
 assert r['frozenHelperDeadlineMs']==2000 and r['observationCount']==7
 assert r['original2032Classification']=='MEASUREMENT_DEFECT' and r['nativeClassification']=='PRODUCT_DEADLINE_VIOLATION'
 assert r['helperKernelRuntimeOverrunClaim'] is False and r['controlledCloseDeliveryPause'] is True
 assert r['remote']['defaultBranch']=='main' and r['remote']['main']==MAIN and r['remote']['certification']==CERT
 assert r['remote']['mutations']==[] and r['remote']['dispatches']==[] and not r['remote']['defaultBranchChanged']
 assert r['hosted']['runs']==[] and r['hosted']['artifacts']==[] and r['hosted']['parity']=='NOT_RUN_NATIVE_STOP'
 assert r['labels']==rawjson(OLD/'execution-receipt.json')['labels']
 assert r['requiredEnding']==END
 for ref in r['inputs'].values():assert row(ROOT/ref['path'])==ref
 return True
def negatives(receipt):
 tests=[]
 mutations=[('false-native-certification',lambda v:v.update(nativeCertified=True)),('false-label-promotion',lambda v:v.update(labelsPromoted=True)),('hidden-deadline-grace',lambda v:v.update(frozenHelperDeadlineMs=2032)),('original-restamped-as-product-failure',lambda v:v.update(original2032Classification='PRODUCT_DEADLINE_VIOLATION')),('dropped-observation',lambda v:v.update(observationCount=6)),('fake-completion-commit',lambda v:v.update(completionCommitCreated=True)),('remote-default-left-changed',lambda v:v['remote'].update(defaultBranch='mo1306-certification')),('fabricated-hosted-artifact',lambda v:v['hosted']['artifacts'].append({'name':'memoryos-ci-result.json'}))]
 for name,mutate in mutations:
  changed=copy.deepcopy(receipt);mutate(changed)
  try:verify_receipt(changed)
  except AssertionError:tests.append({'name':name,'status':'REJECTED'})
  else:raise AssertionError('Negative accepted: '+name)
 return tests
def git_check():
 actual_index=Path(git('rev-parse','--git-path','index'))
 if not actual_index.is_absolute():actual_index=ROOT/actual_index
 before=sha(actual_index.read_bytes())
 cache=ROOT/'.cache/mo1306-phase3ar-resolution';cache.mkdir(exist_ok=True)
 temporary=cache/('evidence-index-'+uuid.uuid4().hex)
 env={**os.environ,'GIT_INDEX_FILE':str(temporary)}
 commands=[]
 for argv in [['git','read-tree','HEAD'],['git','add','--',OUT.relative_to(ROOT).as_posix(),HERE.relative_to(ROOT).as_posix()],['git','diff','--cached','--check','HEAD'],['git','diff','--check','HEAD']]:
  result=run(argv,env);commands.append(result);assert result['exitCode']==0,result
 names=run(['git','diff','--cached','--name-only','HEAD'],env);assert names['exitCode']==0
 changed=names['stdout'].splitlines();allowed=[OUT.relative_to(ROOT).as_posix()+'/',HERE.relative_to(ROOT).as_posix()+'/']
 assert changed and all(any(p.startswith(prefix) for prefix in allowed) for p in changed)
 assert sha(actual_index.read_bytes())==before and git('rev-parse','HEAD')==CHECKPOINT
 return {'kind':'MemoryOSPhase3ARResolutionGitValidation','status':'PASS','commands':commands,'temporaryIndex':str(temporary),'realIndexUnchanged':True,'realIndexSha256':before,'changedPathCount':len(changed),'onlyNewResolutionEvidenceAndTools':True,'head':CHECKPOINT,'completionCommitCreated':False}
def write():
 assert ROOT.name=='cca-mo1306-3a-refresh' and git('branch','--show-current')=='mo1306/phase3a-refresh'
 assert git('rev-parse','HEAD')==CHECKPOINT and git('show','-s','--format=%P','HEAD')==C3AB
 assert git('diff','--name-only','HEAD')=='' and git('diff','--cached','--name-only')==''
 attrs=OUT/'.gitattributes'
 if not attrs.exists():attrs.write_bytes(b'* -text whitespace=trailing-space,space-before-tab,cr-at-eol\n')
 d=rawjson(OUT/'native/timing-diagnosis.json');remote=rawjson(OUT/'github/final-state.json')
 assert d['status']=='NATIVE_DEADLINE_BLOCKED' and d['observationCount']==7 and d['stopPolicy']['furtherProductExecutions']==0
 assert remote['status']=='PASS' and remote['defaultBranch']=='main' and remote['remoteMain']==MAIN and remote['certificationCommit']==CERT
 assert remote['defaultBranchChanged'] is False and remote['remoteMutations']==remote['dispatches']==[] and remote['settingsUnchanged'] is True
 assert remote['certificationRunCount']==remote['artifactCount']==0
 independent=rawjson(OUT/'validation.json');negative=rawjson(OUT/'validation-negatives.json')
 assert independent['status']=='PASS' and independent['resolutionStatus']=='NATIVE_DEADLINE_BLOCKED' and negative['controlCount']==9
 now=datetime.datetime.now(datetime.timezone.utc);seconds=(now-START).total_seconds();assert seconds<10800
 inputs={name:row(OUT/name) for name in ['candidate.json','preservation/before.json','preservation/peer-dispositions.json','native/timing-diagnosis.json','native/measurement-regression.json','native/installed-integrity-after.json','host-events/original-native-module-path.json','host-events/focused-seven-observations.json','github/preflight-20260927T104420Z/preflight.json','github/final-state.json','github/remote-campaign-offline-validation.json','validation.json','validation-negatives.json','workspace-verification.json']}
 inputs['blockedCheckpointReceipt']=row(OLD/'execution-receipt.json');inputs['oldMO1302']=row(OLD/'check-mo1302.json');inputs['finalizer']=row(Path(__file__))
 receipt={'kind':'MemoryOSPhase3ARBlockerResolutionReceipt','version':'1.0.0','status':'NATIVE_DEADLINE_BLOCKED','startingHead':CHECKPOINT,'finalHead':CHECKPOINT,'productionAuthority':C3AB,'allCertificationGatesPassed':False,'nativeCertified':False,'githubHostedCertified':False,'releaseReady':False,'labelsPromoted':False,'labels':rawjson(OLD/'execution-receipt.json')['labels'],'completionCommitCreated':False,'completionCommit':None,'completionCommitParent':None,'frozenHelperDeadlineMs':2000,'observationCount':7,'original2032Classification':'MEASUREMENT_DEFECT','nativeClassification':'PRODUCT_DEADLINE_VIOLATION','controlledCloseDeliveryPause':True,'helperKernelRuntimeOverrunClaim':False,'observedPromiseAfterDeadlineMs':64.1369,'lateAcceptanceLowerBoundMs':62.4682,'remote':{'defaultBranch':'main','main':MAIN,'certification':CERT,'mutations':[],'dispatches':[],'defaultBranchChanged':False,'restoration':'NOT_APPLICABLE_NEVER_CHANGED'},'hosted':{'status':'NOT_RUN_NATIVE_STOP','runs':[],'artifacts':[],'parity':'NOT_RUN_NATIVE_STOP'},'nativeDependentGates':{key:'NOT_COMPLETED_NATIVE_STOP' for key in ['FAIL','COULD_NOT_EVALUATE','generate','publication']},'constraints':{'productionChanged':False,'oldEvidenceChanged':False,'peerWorktreesChanged':False,'pushesPerformed':0,'tagsCreated':False,'releasesCreated':False,'linuxUbuntuWslUsed':False,'vmUsed':False,'otherProviderAccountsUsed':False},'inputs':inputs,'timeBudget':{'firstExplicitClockUtc':START.isoformat(),'receiptUtc':now.isoformat(),'elapsedSecondsAtReceipt':seconds,'targetMinutes':60,'normalCeilingMinutes':90,'hardStopMinutes':180,'withinTarget':seconds<=3600,'withinHardStop':True,'over90MinuteJustification':None,'clockScope':'UTC operational task accounting only; product enforcement uses its own monotonic domain.'},'phase3DRecommendation':'Do not integrate or promote certification labels. Obtain a separately authorized production correction for late helper success acceptance, preserve the frozen2000ms requirement and Action pins, establish a new corrected authority/package, then rerun affected native gates and actual hosted PASS/FAIL/CNE plus artifacts/parity with verified default-branch restoration before Phase3D. Historical3B-R2/3C-R scope remains unchanged.','requiredEnding':END}
 verify_receipt(receipt);put('execution-receipt.json',receipt)
 tests=negatives(receipt);put('receipt-negatives.json',{'kind':'MemoryOSPhase3ARResolutionReceiptNegatives','status':'PASS','controlCount':len(tests),'controls':tests,'scope':'In-memory negative mutations only; no source, evidence, or product execution changes.'})
 fields=[
 ('Starting HEAD',CHECKPOINT),('C3AB authority',C3AB),('Blocked checkpoint preservation','All321 checkpoint files match their committed blobs. The prior blocked receipt,2032ms record,404 response,workflows,remote identity,and absence of runs/artifacts are retained unchanged.'),
 ('Corrected archive identity','memoryos-ci@0.1.0; memoryos-ci-0.1.0.tgz;197172bytes; SHA-256 2f1e9424ce64e44b7b1587ce206fe5f7ae72579652ca1fc891c489bc1a21925d;94members;SDK25;production dependencies0. No rebuild.'),
 ('3B-R2 status','Read-only commit b47f624c26badd54ee5724e8fe384c80ea083952; releaseReady=true within3B-R2 scope. Undici NOT_REACHABLE_IN_FROZEN_USAGE; fast-xml-parser REACHABLE_NOT_ATTACKER_CONTROLLED; no Action update required.'),
 ('3C-R status','Read-only commit20aa4e4245643e1c3a7b3f676622c5d2d36015b2; historical audit0 BLOCKED requirements. No3C rerun; this is not clearance of the newly discovered native defect.'),
 ('Exact native failed operation','Original CLI evaluate-policy-pass failed in verifyInstallation/checkPaths before configuration acquisition with MO1306_FILESYSTEM_BOUNDARY,INPUT_ERROR/11,no publication. First48 bootstrap paths are inferred from original control flow; old stdin/timer signaling were not captured. The separate2032ms probe directly ran the fixed helper against the single evaluate-policy-pass/memoryos-ci.json path. New observations record exact stdin and product events.'),
 ('Frozen2000ms semantics','Freeze requires helper execution<=2000ms. On deadline/cancellation mark terminal,close input,kill,and await close/reap within a separate reserved2000ms allowance. Cleanup is not success grace. Request section16 also expressly forbids acceptance of late helper success. Contract text and source hashes are bound in timing diagnosis/initial audit.'),
 ('Clock domain','Product/forwarding events: same-process Node performance.now and unchanged native setTimeout. Due time is bracketed before/after timer registration. Original Python3.12 time.monotonic uses GetTickCount64 with15.625ms resolution; external observer uses QueryPerformanceCounter with100ns reported resolution. UTC is only operational/event-log correlation. No cross-domain duration arithmetic.'),
 ('Original2032ms interpretation','MEASUREMENT_DEFECT in using an outer subprocess stopwatch to infer product deadline behavior.2031.9999999992433ms is retained; no rounding or overhead subtraction. Raw subprocess.run used a5000ms engineering cap and never invoked checkPaths or its timer. Internal runtime,kill/exit ordering,and overhead split cannot be reconstructed.'),
 ('Quiet safe:true meaning','Read-only path/ancestor/reparse validation succeeded for one config path and the raw helper returned exit0. It proves neither semantic execution nor product timing. No publication or product acceptance occurred in that raw probe; no surviving process was reported. Original per-process lifecycle timestamps were absent.'),
 ('Focused repetition count/results','Seven total; all retained. First48 x3 and exact original single path x1 accepted within the armed deadline at611.5422,621.8558,608.1634,535.3742ms. Short remaining-overall control rejected MO1306_OVERALL_TIMEOUT; explicit supervisor suspension rejected MO1306_FILESYSTEM_BOUNDARY. Seventh controlled close-delivery pause accepted success64.1369ms late and triggered STOP.'),
 ('Host interruption evidence','Retained System log covers original and focused windows; no relevant recorded power/sleep/clock transition or selected critical/error event. Disabled/unavailable channels are documented. This does not rule out unlogged scheduling delays; no Windows cause is asserted. Controls6/7 deliberately impose pauses.'),
 ('Native timing classification','New finding PRODUCT_DEADLINE_VIOLATION: late supervisor acceptance under an explicit scheduling control. The actual helper responded at598.2782ms and exit0 was observed at631.1144ms; the timer due upper bound was2093.504ms. No helper kernel-runtime overrun is claimed.'),
 ('Deadline fail-closed behavior','Controls5/6 reject and clean up; control7 fails late-success rejection. Genuine close delivery was paused,forwarded at2155.9722ms,then product cleared its pending timer at2156.3518ms and resolved at2157.6409ms without an elapsed guard. No timeout callback fired in7. No files,completion marker,or publication appeared; no owned processes remained. Full CLI continuation was intentionally stopped.'),
 ('Correction A topology','All seven external sampled traces validate at most3 attributable roles: supervisor,one helper,optional owned console host. No fourth role or helper/worker overlap observed; no remaining owned processes. Sampling is not a kernel-level containment proof.'),
 ('Native FAIL','Not completed; mandatory native STOP.'),('Native CNE','Not completed; mandatory native STOP.'),('Native generate','Not completed; mandatory native STOP.'),('Native publication','Remaining dependent completion checks not run. Existing accepted publication negatives retained; isolated new helper probes published nothing.'),('Native certification result','NATIVE_DEADLINE_BLOCKED; no certification.'),
 ('Initial remote state','Default main; main='+MAIN+'; mo1306-certification='+CERT+'; certification parent='+C3AB+'. Verified via authenticated GETs.'),
 ('First404 interpretation','Original POST repos/moelsaka01/memoryos-specification/actions/workflows/mo1306-certification-pass.yml/dispatches with ref mo1306-certification was correctly addressed.404 is preserved. Current authenticated identity,admin role and classic repo scope plus missing registry/default files support missing registration;404 alone cannot prove credential sufficiency.'),
 ('GitHub registration requirement','GitHub manual-run documentation requires a workflow_dispatch workflow file on the default branch. Registry/content/API checks confirm these three workflows are absent there. No standalone registration endpoint is documented.'),
 ('Registration mechanism selected','Conditional temporary default_branch PATCH main->mo1306-certification,registry/byte verification,bounded runs/retrieval,and restoration to main. Guarded tool and24 offline checks prepared. NOT EXECUTED because native STOP; no assertion that an external API restoration can be guaranteed against host/service loss.'),
 ('Whether default branch changed','No.'),('Pre-change default branch','main; no change was attempted.'),('Workflow registration result','Not performed; three certification workflows remain unregistered.'),('Workflow ID','None for the three certification workflows; no hosted identity fabricated.'),('Certification branch SHA',CERT),
 ('Action pins','checkout3d3c42e5aac5ba805825da76410c181273ba90b1; upload-artifact043fb46d1a93c77aae656e7c1c64a875d1fc6a0a. Unchanged.'),
 ('Node bootstrap','Frozen Node24.21.0 win-x64; ZIP37618919bytes,SHA-256158f7685b44de51f6c0df1d153526cbcd3e1bc739a8dfc607721cef75de9e541. Local pinned runtime verified. Actual hosted bootstrap was not run.'),
 ('Hosted PASS run ID/result','None; NOT_RUN_NATIVE_STOP.'),('Hosted FAIL run ID/result','None; NOT_RUN_NATIVE_STOP.'),('Hosted CNE run ID/result','None; NOT_RUN_NATIVE_STOP.'),('Actual hosted runner identity','None. windows-2022 remains configured,not observed execution.'),
 ('Hosted artifact sets','No actual certification artifacts. Four/six-file allowlists remain unexercised in hosted execution; no local substitute used.'),('Hosted completion/run-id','Not verified; no actual hosted run or bundle.'),('Native/hosted parity','Not run; no actual hosted evidence.'),('Default branch restoration','Not applicable; default branch never changed.'),('Final default branch','main.'),('Final remote main SHA',MAIN),('Final certification branch SHA',CERT+'; retained.'),
 ('Remote settings preservation','No remote writes. Final GET comparisons confirm default,refs,reviewed workflow bytes,and observed relevant settings unchanged. No changes to protection,Actions permissions,visibility,secrets,variables,environments,webhooks,collaborators,checks,merge/security settings,or billing were attempted.'),
 ('MO-1302','Product bytes unchanged. No registration mechanics executed; targeted regression rerun not required by section39. Existing4 passing checks preserved and bound.'),('Evidence','New sibling phase3ar-resolution directories contain diagnosis,all7observations,host logs,original probe transcript,candidate/preservation,read-only GitHub snapshots,validators,receipt,and closed SHA-256 index. Earlier phase3ar files remain unchanged.'),
 ('Labels','Unchanged: Generic IMPLEMENTED/REAL_EXECUTION_VALIDATED/FINAL_CERTIFICATION_PENDING; GitHub IMPLEMENTED/HOSTED_EXECUTION_CERTIFICATION_PENDING. No REAL_EXECUTION_CERTIFIED or HOSTED_EXECUTION_CERTIFIED promotion.'),
 ('Test counts','7 actual focused observations:4 timely acceptances,2 timeout rejections,1 late-acceptance failure.9 timing-analysis regressions,9 independent evidence negatives,24 remote-tool offline controls,8 final receipt negatives pass.50 retained-data/offline checks total; these are not hosted or full native certification.'),
 ('Workspace verification','PASS; saved workspace-verification.json.'),('git diff --check','PASS for all new evidence/tools via a temporary Git index and for tracked HEAD changes; real index unchanged. Final closed inventory rechecked.'),('Completion commit hash','None; all-gates condition failed.'),('Completion commit parent','Not applicable. HEAD remains the blocked checkpoint; no amend or new commit.'),
 ('Final local status','Only the new phase3ar-resolution evidence and tools directories are untracked. Existing tracked tree and real Git index are unchanged.'),('Pushes performed','None in this blocker-resolution task. The prior certification-branch push is preserved as historical evidence.'),('Tag state','No tags or releases created; protected local refs unchanged.'),('Linux/Ubuntu state','Not used; no WSL.'),('VM state','Not used.'),('Other provider accounts','No GitLab,Jenkins,Azure,or other provider execution/account use.'),
 ('Duration',f'{seconds/60:.2f}minutes from first explicit clock{START.isoformat()} to receipt{now.isoformat()}; final integrity checks follow immediately.'),('>90-minute justification','Not applicable.'),('3-hour hard-stop compliance','Yes; within60-minute target at evidence closure.'),('Exact Phase3D recommendation',receipt['phase3DRecommendation'])]
 assert len(fields)==62
 observations='\n'.join(f"| {i} | {o['mode']} | {o['requestedDelayMs']:.4f} | {o['timerArmToTerminalMs']:.4f} | {o['classification']} |" for i,o in enumerate(d['observations'],1))
 text='# MO-1306 Phase3A-R blocker resolution\n\n**'+END+'**\n\nThe seventh focused observation proves a late-success acceptance gap under a deliberately imposed close-delivery pause. The installed helper and product source bytes are unchanged. The helper exited early; the failure is the supervisor accepting success after the armed deadline. The original2032ms raw stopwatch measurement is separately classified as a measurement/comparison defect and is preserved unchanged.\n\nNo certification label is promoted. No completion commit,remote mutation,or hosted dispatch was made.\n\n| Observation | Input/control | Requested timer ms | Timer-arm to terminal ms | Result |\n|---:|---|---:|---:|---|\n'+observations+'\n\nTimes in this table are supervisor acceptance/rejection observations,not helper kernel runtimes. Control5 legitimately uses the remaining overall budget,without altering the2000ms helper ceiling. Control6 proves timeout rejection on resume; it does not establish that a valid helper response was already queued. Control7 independently records genuine safe:true and exit0 before its deliberate pause.\n\n| # | Requested final field | Result |\n|---:|---|---|\n'+'\n'.join(f'| {i} | {name} | {value} |' for i,(name,value) in enumerate(fields,1))+'\n\nGitHub sources: [Manual workflow dispatch](https://docs.github.com/en/actions/how-tos/manage-workflow-runs/manually-run-a-workflow), [Workflows REST API](https://docs.github.com/en/rest/actions/workflows), [Repository update](https://docs.github.com/en/rest/repos/repos#update-a-repository).\n\nRead `execution-receipt.json`, `native/timing-diagnosis.json`, `validation.json`, `github/final-state.json`, and `evidence-index.json` alongside this report. Recheck with the new `validate.py --check` and `finalize.py --check`; these execute no product or remote campaign.\n\n'+END+'\n'
 # Human-readable spacing corrections; these do not affect retained raw evidence.
 import re
 text=re.sub(r',(?=\S)', ', ', text)
 text=re.sub(r';(?=\S)', '; ', text)
 for a,b in [('Phase3','Phase 3'),('within3B','within 3B'),('No3C','No 3C'),('All321','All 321'),('old321','old 321'),('First48','First 48'),('First48','First 48'),('first48','first 48'),('single2032','single 2032'),('original2032','original 2032'),('Original2032','Original 2032'),('separate2032','separate 2032'),('Control5','Control 5'),('Control6','Control 6'),('Control7','Control 7'),('control7','control 7'),('Controls5/6','Controls 5/6'),('Controls6/7','Controls 6/7'),('execution<=','execution <= '),('reserved2000','reserved 2000'),('separate2000','separate 2000'),('frozen2000','frozen 2000'),('uses GetTickCount64 with15','uses GetTickCount64 with 15'),('with100ns','with 100 ns'),('a5000','a 5000'),('exit0','exit 0'),('at611','at 611'),('success64','success 64'),('at598','at 598'),('at631','at 631'),('was2093','was 2093'),('at2155','at 2155'),('at2156','at 2156'),('at2157','at 2157'),('in7.','in 7.'),('most3','most 3'),('and24','and 24'),('the2000','the 2000'),('section16','section 16'),('section39','section 39'),('Existing4','Existing 4'),('all7observations','all 7 observations'),('within60','within 60'),('clock2026','clock 2026'),('receipt2026','receipt 2026'),('checkout3d3','checkout 3d3'),('upload-artifact043','upload-artifact 043'),('Node24.21','Node 24.21'),('ZIP37618919','ZIP 37618919'),('SHA-256158f','SHA-256 158f'),('commit20aa','commit 20aa'),('audit0','audit 0'),('SDK25','SDK closure 25 files'),('dependencies0','dependencies 0'),('deadline.2031','deadline. 2031')]:
  text=text.replace(a,b)
 text=re.sub(r'(?<=\d)(ms|minutes|members|bytes)\b', r' \1', text)
 for a,b in [('2000 ms','2,000 ms'),('2032 ms','2,032 ms'),('5000 ms','5,000 ms'),('197172 bytes','197,172 bytes'),('37618919 bytes','37,618,919 bytes')]:text=text.replace(a,b)
 report=OUT/'REPORT.md';assert not report.exists();report.write_text(text,encoding='utf-8',newline='\n')
 git_receipt=git_check();put('git-validation.json',git_receipt)
 result=run([sys.executable,'-B',str(HERE/'validate.py'),'--check']);assert result['exitCode']==0,result
 put('final-validation.json',{'kind':'MemoryOSPhase3ARResolutionFinalValidation','status':'PASS','meaning':'Truthful blocked receipt and immutable evidence validated; certification remains blocked.','receipt':row(OUT/'execution-receipt.json'),'report':row(report),'git':row(OUT/'git-validation.json'),'receiptNegativeControls':row(OUT/'receipt-negatives.json'),'independentReadOnlyRecheck':result,'validators':{'nativeBlockerResolution':'PASS_DIAGNOSIS_VALIDATED','hostedEvidence':'BLOCKED_NO_HOSTED_EXECUTION','artifact':'BLOCKED_NO_HOSTED_ARTIFACTS','parity':'BLOCKED_NO_HOSTED_EXECUTION','receipt':'PASS_TRUTHFUL_BLOCKED_DISPOSITION','remoteState':'PASS_UNCHANGED_READ_ONLY_STATE','workspace':'PASS','gitDiffCheck':'PASS'}})
 files=sorted((p for base in [OUT,HERE] for p in base.rglob('*') if p.is_file() and p!=OUT/'evidence-index.json'),key=lambda p:p.relative_to(ROOT).as_posix())
 put('evidence-index.json',{'kind':'MemoryOSPhase3ARResolutionClosedEvidenceIndex','version':'1.0.0','status':'NATIVE_DEADLINE_BLOCKED','scope':'Only new resolution tools/evidence; excludes this index itself. Historical checkpoint has its unchanged separate closed index.','files':[row(p) for p in files]})
 check()
def check():
 receipt=rawjson(OUT/'execution-receipt.json');verify_receipt(receipt)
 index=rawjson(OUT/'evidence-index.json');expected={p.relative_to(ROOT).as_posix() for base in [OUT,HERE] for p in base.rglob('*') if p.is_file() and p!=OUT/'evidence-index.json'}
 assert {r['path'] for r in index['files']}==expected and len(index['files'])==len(expected)
 for r in index['files']:assert row(ROOT/r['path'])==r
 result=run([sys.executable,'-B',str(HERE/'validate.py'),'--check']);assert result['exitCode']==0,result
 g=git_check();assert g['realIndexUnchanged']
 assert git('status','--porcelain').splitlines()==['?? repositories/cca-conformance/evidence/mo1306/phase3ar-resolution/','?? repositories/cca-conformance/tools/mo1306-phase3ar-resolution/']
 print(json.dumps({'status':'PASS','disposition':END,'closedIndexFiles':len(index['files']),'independentCheck':json.loads(result['stdout']),'finalDiffCheck':'PASS','realGitIndexUnchanged':True,'finalHead':git('rev-parse','HEAD'),'completionCommitCreated':False,'newEvidenceUntracked':True,'receiptNegatives':len(negatives(receipt))}))
if __name__=='__main__':
 parser=argparse.ArgumentParser();parser.add_argument('--check',action='store_true');args=parser.parse_args()
 check() if args.check else write()