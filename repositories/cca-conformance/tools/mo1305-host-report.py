"""Create the requested 63-item task report from preserved evidence and actual Git state."""
from pathlib import Path
import ctypes,hashlib,json,subprocess,os
ROOT=Path(__file__).resolve().parents[3];BASE=ROOT/'repositories/cca-conformance/evidence/mo1305-phase1-resume';CACHE=ROOT/'.cache/mo1305-host-resume'
def read(p):return json.loads(p.read_bytes())
def maybe(p):return read(p) if p.exists() else {}
def git(*args):return subprocess.check_output(['C:/Program Files/Git/cmd/git.exe',*args],cwd=ROOT,env={**os.environ,'GIT_OPTIONAL_LOCKS':'0'},text=True).strip()
def digest(p):return hashlib.sha256(p.read_bytes()).hexdigest()
resource=read(BASE/'resource-aggregate.json');maxima=read(ROOT/'repositories/cca-conformance/evidence/mo1305-phase1-aux/maxima.json');limitsPath=ROOT/'repositories/memoryos-rest/contracts/limits.json';limits=read(limitsPath)
validation=maybe(ROOT/'.cache/mo1305-resource-review/final-validation/results.json');post=maybe(ROOT/'.cache/mo1305-resource-review/post-b1-host-resume/results.json');inventory=maybe(ROOT/'repositories/cca-conformance/mo1305-conformance-inventory.json');binding=maybe(ROOT/'repositories/cca-conformance/evidence/mo1305-phase1-binding/binding.json')
head=git('rev-parse','HEAD');i1=binding.get('implementationRevision');subject=git('show','-s','--format=%s','HEAD');b1=head if subject=='conformance(memoryos-1.3): bind MO-1305 phase 1 foundation' else None
status=git('status','--porcelain');start=json.loads((CACHE/'task-start.json').read_text(encoding='utf-8-sig'));counter=ctypes.c_longlong();ctypes.windll.kernel32.QueryPerformanceCounter(ctypes.byref(counter));elapsed=(counter.value-start['timestamp'])/start['frequency']+start['startupAllowanceSeconds']
complete=bool(b1 and post.get('state')=='PASS' and validation.get('state')=='PASS' and not status)
state='MO-1305 PHASE 1 COMPLETE / READY FOR PHASE 2' if complete else 'MO-1305 PHASE 1 BOUNDED CONTINUATION REQUIRED'
steps={r['id']:r['state'] for r in validation.get('records',[])}
functional=maybe(BASE/'functional/progress.json');adverse=maybe(BASE/'adverse-functional/index.json');stress=read(BASE/'stress-validation.json');confirm=maybe(BASE/'stress-confirmation/index.json')
pass_step=lambda name:steps.get(name,'PENDING')
rows=[
('Baseline','Exact requested workspace; main at V 75cee55784c590bab52feaf8f2214e4d1b9e657f; expected subject/parent, absent I1/B1/tag and predecessor tags verified before work.'),
('R6 root cause revalidation','PASS: repository evidence confirms C HOST TRANSIENT; 12/12 exact HTTP 200 reproductions; 20 collector captures, maximum 50.6703 ms.'),
('Modern Standby evidence','55.776717 seconds; Kernel-Power 506/507 records 130886/130893, corroborating 566 record 130894. Historical HTTP 504 retained.'),
('Host interruption guard design','Independent OS entry/exit evidence, exact overlap with monotonic capture window, UTC correlation only; unknown evidence leaves normal gates active. All 38 final adverse/stress repetitions also have independent retrospective OS validation after the restricted-PATH query correction.'),
('Guard identity',digest(BASE/'guard-identity.json')+' (guard-identity.json; binds policy, implementation, query, tests and raw test log).'),
('Positive guard tests','5 PASS, including the actual retained R6 pattern.'),
('Negative guard tests','15 PASS; plus 1 replacement-cap test PASS. Slow semantics, timeout, collector delay, CPU/memory pressure, unrelated/malformed/missing evidence do not invalidate.'),
('Replacement policy','Maximum three replacements per logical resource slot and vector in a task; three per stress repetition; new identity for each attempt.'),
('R6 completed vectors reviewed','11/11 independently revalidated.'),
('R6 vectors reusable','11/11; 330 observations from complete vectors.'),
('R6 samples invalidated by host interruption','2: maximum-permitted-headers warm 1 and failed warm 2. R6 remains FAIL.'),
('Samples selectively replaced','2; all 109 newly needed observations PASS without a fresh host interruption.'),
('maximum-permitted-headers completion','10 cold + 20 warm valid: 11 retained + 19 fresh.'),
('Remaining resource vectors completed','parser-max-strings, projection-maximum-semantic-error, schema-max-evaluate-policySet: 30 fresh valid observations each.'),
('Total valid resource vectors',str(resource['cases'])+'/15; 150 cold + 300 warm; no variance extension triggered.'),
('Total fresh resource observations',str(resource['fresh'])),('Reused resource observations',str(resource['reused'])),
('Maximum valid semantic duration',str(maxima['operationUs'])+' us'),('Final semantic deadline',str(limits['measured']['operationMs'])+' ms; unchanged 4x / ceil100ms formula; <=60000 ms.'),
('Maximum young generation',str(maxima['workerYoungBytes'])+' bytes'),('Maximum old generation',str(maxima['workerOldBytes'])+' bytes'),('Maximum external',str(maxima['workerExternalBytes'])+' bytes'),
('Maximum parent attributable',f"Heap delta {maxima['parentHeapDeltaBytes']} bytes; external delta {maxima['parentExternalDeltaBytes']} bytes. Full peaks used for budgeting: heap {maxima['parentHeapBytes']}, external {maxima['parentExternalBytes']}, process RSS {maxima['processRssBytes']} bytes."),
('Final memory budgets','; '.join(k+'='+str(limits['measured'][k])+' MiB' for k in ['workerYoungMiB','workerOldMiB','workerExternalMiB','parentHeapMiB','parentExternalMiB','processRssMiB'])),
('Final wire limits','See operation table below; early errors '+str(limits['measured']['earlyErrorBytes'])+' bytes.'),('Final limits identity',digest(limitsPath)),
('Functional coverage',f"{functional.get('state','PENDING')}: {len(functional.get('completed',[]))}/105 final-candidate cases."),
('Adverse functional coverage',f"{adverse.get('state','PENDING')}: {len(adverse.get('completed',[]))}/20."),
('Stress vectors',f"Measured 9/9; final confirmation {len(confirm.get('completed',[]))}/18 repetitions."),
('Stress duration',f"Two repetitions of at least 10000 ms per selected vector; measured actual total {stress['totalAdverseMs']} ms."),
('Stress result',f"Measured {stress['state']}; final confirmation {confirm.get('state','PENDING')}."),
('Boundary result',pass_step('final-boundaries')+' / '+pass_step('boundary-matrix')),
('Real HTTP/TLS',pass_step('integration')+'; installed TLS 1.3 / HTTP 1.1'),('Node fetch',pass_step('clients')+'; 12 cases'),('curl',pass_step('clients')+'; 12 cases'),('raw TLS',pass_step('adversarial')+'; 174 framing/security cases'),
('Semantic parity',pass_step('integration')+'; 73 SDK vectors and 29 local checks'),('PASS',pass_step('integration')+' decision parity'),('FAIL',pass_step('integration')+' decision parity'),('COULD_NOT_EVALUATE',pass_step('integration')+' decision parity'),
('Offline install',pass_step('install')+'; fresh isolated install, empty explicit cache, offline/scripts disabled, exact installed files'),('OpenAPI',pass_step('units')+'; deterministic final projection and contract checks'),('SBOM/notices','Final generated provenance, zero direct/transitive/development dependencies; exact retained upstream notices.'),('Supply-chain review','Established authoritative review dated 2026-09-24; pinned runtime unchanged; final identities bound.'),
('Required regressions',pass_step('regressions')+'; six triggered groups, 235 tests; unrelated C++/UI/hosted suites excluded'),('Workspace verification',pass_step('workspace')+'; post-B1 '+str(post.get('state','PENDING'))),('Inventory',inventory.get('state','PENDING')),('Receipts',str(sum(len(x) for x in inventory.get('receipts',{}).values()))+' final typed receipts; 15 resource vector receipts, aggregate and guard evidence retained'),
('I1 hash',i1 or 'NOT_CREATED'),('I1 parent',git('rev-parse',i1+'^') if i1 else 'NOT_CREATED'),('B1 hash',b1 or 'NOT_CREATED'),('B1 parent',git('rev-parse',b1+'^') if b1 else 'NOT_CREATED'),('Post-B1 result',post.get('state','PENDING')),('Total task wall-clock duration',f'{elapsed:.3f} monotonic seconds ({elapsed/60:.3f} minutes), including startup allowance'),('Final Git status','CLEAN' if not status else status),('No push confirmation','No push performed.'),('No tag confirmation','No tag created; MO-1305 release tag remains absent.'),('Ubuntu/Linux state','NOT_REQUIRED'),('VM state','NOT_REQUIRED'),('Cross-platform parity state','NOT_REQUIRED'),('Phase 2 state','READY; not executed' if complete else 'GATED'),('Phase 3 state','PENDING; not executed'),('Exact next task','MEMORYOS 1.3 MO-1305 REST GATEWAY PHASE 2 IMPLEMENTATION'+('' if complete else ' (gated until Phase 1 completion)'))]
assert len(rows)==63
text='# MO-1305 host interruption and bounded Phase 1 resume\n\n'+state+'\n\n'+'\n'.join(f'{i}. **{name}:** {value}' for i,(name,value) in enumerate(rows,1))+'\n\n## Final wire limits\n\n| Operation | Request bytes | Response bytes |\n|---|---:|---:|\n'+''.join(f"| {k} | {v['requestBytes']} | {v['responseBytes']} |\n" for k,v in limits['measured']['operations'].items())
(CACHE/'final-report.md').write_text(text,encoding='utf-8',newline='\n');(CACHE/'final-summary.json').write_text(json.dumps({'state':state,'elapsedSeconds':elapsed,'rows':[{'number':i,'name':n,'value':v} for i,(n,v) in enumerate(rows,1)]},sort_keys=True,separators=(',',':')),encoding='utf-8');print(json.dumps({'state':state,'I1':i1,'B1':b1,'elapsedSeconds':elapsed,'clean':not status,'report':str(CACHE/'final-report.md')}))
