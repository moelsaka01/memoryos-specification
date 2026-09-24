"""Installed final-budget confirmation with archive and command/log provenance."""
from pathlib import Path
import hashlib,json,os,subprocess,sys,time,ctypes
ROOT=Path(__file__).resolve().parents[3];TOOLS=Path(__file__).parent/'mo1305-phase1'
NODE=ROOT/'.cache/mo1304-phase3-toolchain/node-v24.21.0-win-x64/node.exe'
post_binding=sys.argv[1:]==['post-binding'];assert not sys.argv[1:] or post_binding
OUT=ROOT/'.cache/mo1305-resource-review'/('post-b1-host-resume' if post_binding else 'final-validation')
assert not OUT.exists(),'FINAL_VALIDATION_ALREADY_EXISTS'
OUT.mkdir(parents=True)
def j(v):return json.dumps(v,ensure_ascii=False,sort_keys=True,separators=(',',':')).encode()
def ref(p):
 b=p.read_bytes();return {'path':p.relative_to(ROOT).as_posix(),'byteLength':len(b),'sha256':hashlib.sha256(b).hexdigest()}
archive=ROOT/'.cache/mo1305-resume/build/memoryos-rest-0.1.0.tgz';manifest=ROOT/'repositories/memoryos-rest/distribution-manifest.json'
binding={'archive':ref(archive),'distributionManifest':ref(manifest),'sourceTreeSha256':json.loads((ROOT/'repositories/memoryos-rest/dependency-manifest.json').read_bytes())['sourceTreeSha256']}
commands=[('install',[sys.executable,'-B',str(TOOLS/'fresh_install.py')]),('units',[str(NODE),'--test','--test-concurrency=1','--test-reporter=tap',*[str(p) for p in sorted((ROOT/'repositories/memoryos-rest/tests').glob('*.test.mjs'))]])]
commands[1:1]=[(name,[str(NODE),str(Path(__file__).parent/('mo1305-host-functional.mjs' if name=='functional' else 'mo1305-host-adverse.mjs')),'bounded','.cache/mo1305-host-resume/'+name+'-plan.json']) for name in ['functional','adverse-functional','stress-confirmation']]
commands += [('host-interruption-guard',[str(NODE),'--test','--test-reporter=tap',str(ROOT/'repositories/cca-conformance/tests/mo1305_host_guard_test.mjs')])]
commands += [('monitor-synchronization',[str(NODE),'--test','--test-reporter=tap',str(Path(__file__).parent/'mo1305-monitor-tests.mjs')])]
commands += [(name,[str(NODE),str(TOOLS/(name+'.mjs'))]) for name in ['startup-extra','lifecycle','faults','clients','adversarial','integration','startup','final-boundaries']]
commands += [('boundary-matrix',[str(NODE),str(Path(__file__).parent/'mo1305-boundary-matrix.mjs')]),('signals',[sys.executable,'-B',str(TOOLS/'signals.py')]),('independent-builds',[sys.executable,'-B',str(TOOLS/'independent_builds.py')]),('regressions',[sys.executable,'-B',str(TOOLS/'regressions.py')]),('workspace',[sys.executable,'-B',str(ROOT/'tools/verify_workspace.py'),'--root',str(ROOT)]),('whitespace',[r'C:/Program Files/Git/cmd/git.exe','diff','--check'])]
if post_binding:
 assert subprocess.check_output([r'C:/Program Files/Git/cmd/git.exe','show','-s','--format=%s','HEAD'],cwd=ROOT,text=True).strip()=='conformance(memoryos-1.3): bind MO-1305 phase 1 foundation'
 commands=[('conformance',[str(NODE),'--test','--test-concurrency=1','--test-reporter=tap',str(ROOT/'repositories/cca-conformance/tests/mo1305_phase1_conformance_test.mjs')]),('workspace',[sys.executable,'-B',str(ROOT/'tools/verify_workspace.py'),'--root',str(ROOT)]),('whitespace',[r'C:/Program Files/Git/cmd/git.exe','diff','--check','HEAD^','HEAD']),('clean-status',[r'C:/Program Files/Git/cmd/git.exe','status','--porcelain'])]
start=json.loads((ROOT/'.cache/mo1305-host-resume/task-start.json').read_text(encoding='utf-8-sig'))
def remaining():
 counter=ctypes.c_longlong();ctypes.windll.kernel32.QueryPerformanceCounter(ctypes.byref(counter));return 3600-start['startupAllowanceSeconds']-(counter.value-start['timestamp'])/start['frequency']
records=[]
for name,command in commands:
 assert ref(archive)==binding['archive'] and ref(manifest)==binding['distributionManifest'],'FINAL_INPUT_DRIFT'
 log=OUT/(name+'.log');env={k:v for k,v in os.environ.items() if k.upper() in ['SYSTEMROOT','WINDIR','TEMP','TMP']}
 env['GIT_OPTIONAL_LOCKS']='0'
 env['PATH']=str(NODE.parent)+os.pathsep+r'C:\Program Files\Git\cmd'+os.pathsep+r'C:\Windows\System32'+os.pathsep+r'C:\Windows\System32\WindowsPowerShell\v1.0'
 assert remaining()>120,'TASK_BUDGET_CHECKPOINT_DECOMPOSITION_REQUIRED'
 with log.open('wb') as stream:done=subprocess.run(command,cwd=ROOT,env=env,stdout=stream,stderr=subprocess.STDOUT,timeout=min(900,remaining()-90))
 if name=='clean-status':assert log.read_bytes()==b'','POST_B1_TREE_NOT_CLEAN'
 row={'id':name,'state':'PASS' if done.returncode==0 else 'FAIL','exitCode':done.returncode,'log':ref(log),'command':[Path(command[0]).name,*[str(x).replace(str(ROOT),'WORKSPACE') for x in command[1:]]]};records.append(row)
 (OUT/'results.json').write_bytes(j({'kind':'MemoryOSRESTFinalValidation','state':'PASS' if len(records)==len(commands) and all(r['state']=='PASS' for r in records) else 'FAIL' if done.returncode else 'RUNNING','binding':binding,'records':records}));print(json.dumps(row),flush=True)
 if done.returncode:print(log.read_text(errors='replace')[-5000:],flush=True);raise SystemExit(done.returncode)
