from common import *
import shutil
assert json.loads((OUT/'installed-regression.json').read_bytes())['status']=='PASS'
for case in json.loads((OUT/'semantic-smoke.json').read_bytes())['cases']:
 shutil.copytree(Path(case['work']),OUT/'oracles'/case['id'])
preserve=json.loads((OUT/'preservation.json').read_bytes())
for peer in preserve['peers']:
 p=Path(peer['workspace']);assert git('-c','safe.directory='+p.as_posix(),'-C',str(p),'rev-parse','HEAD')==peer['head']
 assert git('-c','safe.directory='+p.as_posix(),'-C',str(p),'status','--porcelain=v1','--untracked-files=all')==peer['status']
for e in preserve['files']:
 p=ROOT.parent/'cca-mo1306-3a-refresh'/e['original']['path'];assert row(p,ROOT.parent/'cca-mo1306-3a-refresh')==e['original']
package=json.loads((OUT/'package.json').read_bytes());archive=package['archive'];catalog=json.loads((PKG/'contracts/errors.json').read_bytes())
put('candidate-provenance.json',{'kind':'MemoryOSHelperDeadlineCorrectionProvenance','version':'1.0.0','status':'PASS','baseline':C3AB,'sourceFiles':inventory(PKG),'archive':archive,'assemblies':package['assemblies'],'runtimeClosure':row(PKG/'runtime/runtime-closure-manifest.json'),'SBOM':row(PKG/'sbom.spdx.json'),'packageLock':row(PKG/'package-lock.json'),'toolchain':row(NODE),'productionDependencies':json.loads((PKG/'package.json').read_bytes()).get('dependencies',{}),'subjectScope':'Pre-commit corrected package bytes. Actual correction revision is supplied only by its binding child. Historical expanded 3B SBOM/provenance remain unchanged; later identity refresh is required.'})
put('error-contract.json',{'status':'PASS','catalog':row(PKG/'contracts/errors.json'),'helperDeadline':catalog['errors']['MO1306_FILESYSTEM_BOUNDARY'],'overallDeadline':catalog['errors']['MO1306_OVERALL_TIMEOUT'],'cancellation':catalog['errors']['MO1306_CANCELLED'],'cleanupFailure':catalog['errors']['MO1306_CLEANUP_FAILED'],'unchangedFromBaseline':(PKG/'contracts/errors.json').read_bytes()==(CACHE/'c3ab-package/contracts/errors.json').read_bytes(),'observation7NoContinuation':row(OUT/'native/installed-core-late.json')})
put('harness-development.json',{'status':'RESOLVED','diagnostics':[{'issue':'Initial VM objects failed the unchanged strict serializer prototype identity check.','classification':'HARNESS_DEFECT','resolution':'Compile the exact extracted checkPaths function in the same realm with injected clock/child dependencies. Old and corrected source use the same function harness; baseline late success is demonstrated.'}],'noProductEvidenceReclassified':True,'original2032':'MEASUREMENT_DEFECT','controlledObservation7':'PRODUCT_DEADLINE_VIOLATION'})
text=f'''# MO-1306 Phase 3 helper deadline correction

Baseline main is C3AB `9e1bbff99c23cdbc4c80f11e87eadb89a36e8f44`, child of C3A `90b9ac914e477fb90fe317d0de9ba310aae37f60`, child of B2 `0e35ffe70919d77b1db530929093826410b805f9`.

The earlier 2032 ms outer Python stopwatch observation remains **MEASUREMENT_DEFECT**. Phase 3A-R observation 7 is a separate **PRODUCT_DEADLINE_VIOLATION**: genuine safe:true and exit 0 occurred before the armed 2000 ms deadline, but delayed close delivery led to supervisor acceptance at 2064.1369 ms after timer registration. The pending timer had not run. All 126 latest resolution index/member files are retained byte-for-byte with original path/hash mappings. The historical disposition remains **MO-1306 PHASE 3A NATIVE DEADLINE BLOCKED**.

The independent baseline reproduction uses the exact historical close-delivery harness, unchanged C3AB package and pinned Node 24.21.0. On its process clock, helper exit was 634.2347 ms, the armed deadline upper bound was 2101.351 ms, and acceptance was 2155.0572 ms: 53.7062 ms late. Actual safe response and exit status were forwarded unchanged; no timer fired during the controlled synchronous pause. These times are comparable only within that process and do not show helper kernel-runtime overrun.

## Product correction

Only `src/filesystem.mjs` changes executable behavior. At each invocation it stores `helperDeadline = performance.now() + 2000` and `effectiveDeadline = min(helperDeadline, overallDeadline)`, including synchronous spawn time in the helper interval. It rejects exhausted budget before spawn, arms interruption against the remaining absolute interval, and checks that deadline before parsing close output and immediately before resolving success. Cancellation is checked at acceptance too. The timer remains an active interruption mechanism.

Success requires `performance.now() < effectiveDeadline`. Equality rejects, consistent with the freeze's “At a deadline” language and existing semantic supervisor `>=` guards. Tests use the adjacent IEEE-754 representable values before/after 2000; no rounding tolerance or grace is introduced. Separate 2000 ms cleanup/reap time only confirms termination or produces CLEANUP_FAILED. Helper expiry remains FILESYSTEM_BOUNDARY (INPUT_ERROR / ACQUISITION / exit 11); stricter overall expiry remains OVERALL_TIMEOUT (TIMEOUT / CLEANUP / exit 13). Cancellation remains exit 14; cleanup failure remains exit 16. Limits, error catalog, exit projections, process argv and environment are unchanged.

## Focused validation

Evidence: `repositories/cca-conformance/evidence/mo1306/phase3-helper-correction/`. Tooling: the matching `tools/mo1306-phase3-helper-correction/` directory. This is correction engineering evidence, not Phase 3 recertification.

- 22 deterministic cases cover exact boundaries, delayed delivery, success/failure produced before late delivery, timer already fired, stricter/equal overall deadline, preparation exhaustion, validation crossing the deadline, five cancellation orderings, terminal-state monotonicity and reap expiry. Old source demonstrates late success; corrected source passes with exactly one terminal result per case.
- Ten source native controls retain all four timely controls and reject late success/failure, short overall budget, event-loop delay, helper timeout and cancellation. Seven installed controls include full `run` late-close rejection: exit 11, no semantic child, no result digest, no publication or completion marker. The real helper status/response is never fabricated. Native sampling verifies at most three attributable roles, no remaining owned process and cleanup within its separate reserve.
- Focused filesystem tests cover contained paths, traversal, UNC, device paths, ADS, symlink and junction/reparse paths. No full 3C campaign was rerun.
- C3A preservation: 191 dispatch/provider/projection/error checks, 44 public CLI negative cases, installed constructor/toString/__proto__/ordinary unknown rejection, plus valid installed run/generate/verify.
- Nine Policy / Policy Set / Regression cases cover PASS, FAIL and COULD_NOT_EVALUATE. Installed normative identity/outcome bytes match the independently invoked SDK oracle exactly. Unchanged SDK 1.1.0 remains the sole semantic authority.
- Five providers produce identical bytes for identical inputs. New distribution pins cause only mechanical generation identity changes. Adapter/generator closures, labels, schemas, Jenkins parser, workflow structure and Action pins remain unchanged.

The audit inventories 63 sites across first-party modules, PowerShell and templates. The old helper close is the sole TIMER_ONLY_AFFECTED site. Semantic worker success already checks both overall and semantic monotonic deadlines after verification. Publication checks the overall deadline immediately before the completion marker. Validators consume completed bundles; wrapper job/network timers are outside helper success authority. All checkPaths callers naturally inherit this correction. No additional independent production deadline defect was established.

## Package and evidence graph

`memoryos-ci@0.1.0` remains 94 members with zero external production dependencies. The distribution manifest updates only its filesystem source row. Contracts, the 25-file SDK closure, component-level SBOM (`filesAnalyzed:false`), lockfile, notices and provider closures remain unchanged. New candidate provenance and inventory bind the changed source/archive; historical C3AB and peer certification evidence is unchanged.

Archive: `{archive['path']}`, {archive['byteLength']} bytes, `{archive['sha256']}`.
Distribution identity: `{package['distribution']['sha256']}`.
Two independent clean assemblies are byte-identical. A fresh isolated install used an initially empty explicit cache and `--offline --ignore-scripts --no-audit --no-fund`. Installed files are unchanged before/after tests. Evidence commits the archive identity; the unchanged archive bytes remain a local build artifact.

The closed correction inventory includes product, document, tools, preserved history and current evidence. Negative controls reject omissions, drift, old identities, widened scope and unsupported claims. C3C contains no future self-reference. Its binding child adds only actual C3C graph identity and links to the inventory, package, blocker, regressions and recertification impact. Neither commit is amended.

## Later recertification

Mechanical comparison verifies each read-only peer's entire 94-file package equals C3AB, then identifies only filesystem source and distribution manifest as changed. Peer receipts, expanded SBOM/provenance, audit matrix and source/package references are retained with hashes.

- **3A-R: TARGETED_REFRESH_REQUIRED.** Refresh affected installed native deadline, cancellation, cleanup, topology and package bindings. Native certification was blocked; hosted certification never ran and remains a separate later authorized task.
- **3B-R2: TARGETED_IDENTITY_REFRESH_REQUIRED.** Refresh archive/source/distribution, expanded SBOM/provenance and installed artifact identities. Reuse unchanged Action/advisory evidence: Undici remains NOT_REACHABLE_IN_FROZEN_USAGE; fast-xml-parser remains REACHABLE_NOT_ATTACKER_CONTROLLED. No Action update or new advisory research is required by this source change.
- **3C-R: TARGETED_REFRESH_REQUIRED.** Refresh only affected generic filesystem/helper deadline, overall/cancellation/publication dependencies and candidate identity. Unchanged semantic, CLI, provider/schema/parser/label/Action-pin evidence is eligible for exact-byte reuse. Its prior zero-BLOCKED audit is historical and does not certify the corrected bytes.

No recertification, hosted workflow, remote operation, push, tag, Linux/Ubuntu/WSL, VM or provider-account work occurs here. Last retained remote observations report default `main`, remote main `5955af062152a84c10de17860ba0bcabe8b3555f`, and `mo1306-certification` at `3096139e0108be22528859e4f462356dddf6ef29`. These are historical, not fresh verification. The certification branch contains the pre-correction candidate and needs a later authorized refresh before hosted certification.
'''
(ROOT/'docs/mo1306-phase3-helper-deadline-correction.md').write_text(text,encoding='utf-8',newline='\n')
checks=[]
for name,args in [('workspace',[sys.executable,'-B','-X','utf8',ROOT/'tools/verify_workspace.py','--root',ROOT]),('diff',['git','diff','--check'])]:
 r=command(args,env={**os.environ,'GIT_OPTIONAL_LOCKS':'0','PYTHONDONTWRITEBYTECODE':'1'},timeout=90);assert r['exitCode']==0,r;checks.append({'id':name,'result':r})
assert git('branch','--show-current')=='main' and git('rev-parse','HEAD')==C3AB
put('final-gates.json',{'status':'PASS','checks':checks,'source':row(PKG/'src/filesystem.mjs'),'peerWorkspacesUnchanged':True,'phase3RecertificationPerformed':False,'productionDelta':git('diff','--name-only','--','repositories/memoryos-ci').splitlines(),'document':row(ROOT/'docs/mo1306-phase3-helper-deadline-correction.md'),'gates':['root cause','late/timely','fail-closed controls','deadline audit','Correction A','cancellation','overall','terminal state','filesystem','CLI','semantic','provider','package','reproducibility','offline install','installed deadline','installed integrity','preservation','workspace','diff'],'tagRefs':git('show-ref','--tags'),'remoteTrackingRefs':git('for-each-ref','--format=%(refname) %(objectname)','refs/remotes')})
print('Final gates PASS; document and current provenance complete')
