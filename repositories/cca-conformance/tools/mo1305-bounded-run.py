"""Bounded R6 measurement orchestration; fresh identities and immutable checkpoints."""
from pathlib import Path
import ctypes,hashlib,json,os,shutil,subprocess,sys,time,uuid
ROOT=Path.cwd();OUT=ROOT/'.cache/mo1305-bounded-r6';TOOLS=ROOT/'repositories/cca-conformance/tools/mo1305-phase1';PKG=ROOT/'repositories/memoryos-rest';NODE=ROOT/'.cache/mo1304-phase3-toolchain/node-v24.21.0-win-x64/node.exe';BUILD=ROOT/'.cache/mo1305-resume/build';FROZEN=OUT/'frozen-measured'
V='75cee55784c590bab52feaf8f2214e4d1b9e657f'
def j(v):return json.dumps(v,sort_keys=True,separators=(',',':')).encode()
def read(p):return json.loads(p.read_bytes())
def ref(p):
 b=p.read_bytes();return {'path':p.relative_to(ROOT).as_posix(),'byteLength':len(b),'sha256':hashlib.sha256(b).hexdigest()}
def write(p,v):p.parent.mkdir(parents=True,exist_ok=True);p.write_bytes(j(v))
start=read(OUT/'task-start.json');frequency=ctypes.c_longlong();ctypes.windll.kernel32.QueryPerformanceFrequency(ctypes.byref(frequency));assert frequency.value==start['frequency']
def elapsed():
 counter=ctypes.c_longlong();ctypes.windll.kernel32.QueryPerformanceCounter(ctypes.byref(counter));return (counter.value-start['timestamp'])/frequency.value+start['startupAllowanceSeconds']
def remaining():return 5400-elapsed()
write(OUT/'task-clock-proof.json',{'source':'Windows QueryPerformanceCounter; .NET Stopwatch start and direct kernel32 QPC share the documented system-wide counter/frequency. No release sample clocks are compared.','frequency':frequency.value,'pythonPerfCounter':'QueryPerformanceCounter','taskElapsedSeconds':elapsed(),'class':'B/E_TASK_BUDGET_ONLY'})
records=[];env={k:v for k,v in os.environ.items() if k.upper() in ['SYSTEMROOT','WINDIR','TEMP','TMP']};env['GIT_OPTIONAL_LOCKS']='0';env['PATH']=str(NODE.parent)+os.pathsep+r'C:\Program Files\Git\cmd'+os.pathsep+r'C:\Windows\System32'
def run(name,command,maximum=300,minimum=0):
 assert remaining()>minimum+90,'TASK_BUDGET_CHECKPOINT_DECOMPOSITION_REQUIRED'
 timeout=min(maximum,remaining()-90);begin=time.perf_counter_ns();log=OUT/(name+'.log')
 with log.open('wb') as stream:
  try:done=subprocess.run(command,cwd=ROOT,env=env,stdout=stream,stderr=subprocess.STDOUT,timeout=timeout)
  except subprocess.TimeoutExpired:
   write(OUT/'budget-stop.json',{'state':'INCOMPLETE','command':name,'elapsedSeconds':elapsed(),'reason':'MONOTONIC_TASK_BUDGET_OR_PLANNED_STAGE_LIMIT'});raise
 row={'id':name,'state':'PASS' if done.returncode==0 else 'FAIL','exitCode':done.returncode,'durationNs':str(time.perf_counter_ns()-begin),'clockDomain':'MONOTONIC_ORCHESTRATOR:'+str(os.getpid()),'log':ref(log)};records.append(row);write(OUT/'measurement-steps.json',records);print(json.dumps(row),flush=True)
 if done.returncode:print(log.read_text(errors='replace')[-6000:],flush=True);raise SystemExit(done.returncode)

def snapshot():
 paths={p for base in [PKG,TOOLS,ROOT/'repositories/cca-conformance/fixtures/mo1305-phase1'] for p in base.rglob('*') if p.is_file() and '__pycache__' not in p.parts}
 paths.update(ROOT/r['source'] for r in read(PKG/'runtime/runtime-closure-manifest.json')['files'])
 paths.update(ROOT/p for p in ['docs/mo1305-contract-freeze-1.md','docs/mo1305-contract-freeze-1-platform-correction.md','docs/mo1305-contract-freeze-1-verification-methodology-correction.md','repositories/cca-conformance/tools/mo1305-platforms/verification-policy.json','repositories/cca-conformance/tools/mo1305-monitor-tests.mjs'])
 return [ref(p) for p in sorted(paths)]
assert subprocess.check_output(['git','rev-parse','HEAD'],cwd=ROOT,env=env,text=True).strip()==V
assert not FROZEN.exists(),'FROZEN_INPUTS_ALREADY_EXIST'
for row in read(OUT/'historical-evidence-before.json'):assert ref(ROOT/row['path'])==row
run('catalog',[str(NODE),str(TOOLS/'prepare-catalog.mjs')])
run('build',[sys.executable,'-B',str(TOOLS/'build.py'),'--parent',V])
run('install',[sys.executable,'-B',str(TOOLS/'fresh_install.py')])
run('clock-regressions',[str(NODE),'--test','--test-reporter=tap',str(ROOT/'repositories/cca-conformance/tools/mo1305-monitor-tests.mjs')])
FROZEN.mkdir();inputs=snapshot();write(FROZEN/'inputs.json',inputs)
for row in inputs:
 p=FROZEN/'inputs'/row['path'];p.parent.mkdir(parents=True,exist_ok=True);shutil.copyfile(ROOT/row['path'],p)
for name in ['memoryos-rest-0.1.0.tgz','source-tree.json']:shutil.copyfile(BUILD/name,FROZEN/name)
for a,b in [('contracts/limits.json','preliminary-limits.json'),('distribution-manifest.json','distribution-manifest.json')]:shutil.copyfile(PKG/a,FROZEN/b)
stage=Path((ROOT/'.cache/mo1305-resume/installed-path.txt').read_text().strip())
externalPaths=[NODE,Path(sys.executable),Path(r'C:/Users/melsa/.cache/codex-runtimes/codex-primary-runtime/dependencies/native/powershell/pwsh.exe'),NODE.parent/'node_modules/npm/bin/npm-cli.js',*sorted((stage/'private').iterdir())]
def external():return [{'path':p.as_posix(),'byteLength':p.stat().st_size,'sha256':hashlib.sha256(p.read_bytes()).hexdigest()} for p in externalPaths if p.is_file()]
externalInputs=external();assert len(externalInputs)==8;write(FROZEN/'external-inputs.json',externalInputs)
checks=[]
def verify(label):
 assert snapshot()==inputs,'MEASURED_INPUT_DRIFT';assert external()==externalInputs,'EXTERNAL_INPUT_DRIFT'
 assert (FROZEN/'memoryos-rest-0.1.0.tgz').read_bytes()==(BUILD/'memoryos-rest-0.1.0.tgz').read_bytes()
 for r in read(FROZEN/'distribution-manifest.json')['files']:
  b=(stage/'package'/r['path']).read_bytes();assert len(b)==r['byteLength'] and hashlib.sha256(b).hexdigest()==r['sha256']
 checks.append({'label':label,'state':'PASS','inputs':ref(FROZEN/'inputs.json'),'external':ref(FROZEN/'external-inputs.json')});write(FROZEN/'input-checks.json',checks)
selection=read(ROOT/'repositories/cca-conformance/fixtures/mo1305-phase1/bounded/resource-selection.json')
history=read(OUT/'r5-selection-statistics.json');hist={r['id']:r for r in history};estimate=0
for row in selection['vectors']:
 if row['id'] in hist:operation=hist[row['id']]['operationMedianUs']/1e6
 else:
  s=read(ROOT/row['r5PreflightEvidence']['path'])['records'];operation=max(r['metrics'].get('operationUs',0) for r in s)/1e6
 estimate+=30*(operation+1.0)+11*1.5
write(OUT/'execution-plan.json',{'resourceVectors':15,'resourceSamples':450,'estimatedResourceSeconds':round(estimate),'stressMinimumSeconds':180,'stressVectors':9,'remainingAtLaunchSeconds':remaining(),'reservedFinalizationSeconds':1200,'statisticalConfidenceClaim':False})
assert estimate+180+1200<remaining(),'PLANNED_REMAINDER_EXCEEDS_TASK_BUDGET'
try:
 verify('before-resource')
 run('resource',[str(NODE),str(TOOLS/'campaign.mjs'),'bounded','repositories/cca-conformance/fixtures/mo1305-phase1/bounded/resource-plan.json'],2400,estimate)
 verify('after-resource')
 run('validate-resource',[str(NODE),str(TOOLS/'bounded-proof.mjs'),'ordinary','repositories/cca-conformance/evidence/mo1305-phase1-r6/resource/progress.json','.cache/mo1305-bounded-r6/resource-validation.json'])
 if read(OUT/'resource-validation.json')['extensionRequired']:
  write(OUT/'variance-extension-required.json',{'state':'REVIEW_REQUIRED','variance':read(OUT/'resource-validation.json')['variance']});raise SystemExit('TARGETED_VARIANCE_REVIEW_REQUIRED')
 verify('before-stress')
 run('stress',[str(NODE),str(TOOLS/'adverse.mjs'),'bounded','repositories/cca-conformance/fixtures/mo1305-phase1/bounded/stress-plan.json'],600,180)
 verify('after-stress')
 run('validate-stress',[str(NODE),str(TOOLS/'bounded-proof.mjs'),'adverse','repositories/cca-conformance/evidence/mo1305-phase1-r6/stress/index.json','.cache/mo1305-bounded-r6/stress-validation.json'])
 write(FROZEN/'completion.json',{'state':'PASS','checks':checks,'sourceTreeSha256':read(FROZEN/'source-tree.json')['sha256'],'resourceValidation':ref(OUT/'resource-validation.json'),'stressValidation':ref(OUT/'stress-validation.json'),'historicalSamplesUsedForDerivation':False})
finally:
 for row in read(OUT/'historical-evidence-before.json'):assert ref(ROOT/row['path'])==row
 write(OUT/'historical-preservation-check.json',{'state':'PASS','manifest':ref(OUT/'historical-evidence-before.json'),'files':157,'elapsedSeconds':elapsed()})
