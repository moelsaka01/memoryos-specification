"""Five bounded exact helper observations; stop on any actual accepted late result."""
import copy,hashlib,json,os,platform,subprocess,sys,time,uuid
from pathlib import Path
sys.dont_write_bytecode=True
ROOT=Path(__file__).resolve().parents[4];HERE=Path(__file__).resolve().parent
OUT=ROOT/'repositories/cca-conformance/evidence/mo1306/phase3ar-resolution/native'
OUT.mkdir(parents=True,exist_ok=True)
CACHE=ROOT/'.cache/mo1306-phase3ar';NODE=CACHE/'node-v24.21.0-win-x64/node.exe';PKG=CACHE/'install/node_modules/memoryos-ci'
sys.path.insert(0,str(HERE.parent/'mo1306-phase2d'))
import observer
from trace_phase2d import validate_trace
sha=lambda b:'sha256:'+hashlib.sha256(b).hexdigest()
def row(p):
 b=p.read_bytes();return {'path':p.relative_to(ROOT).as_posix(),'byteLength':len(b),'sha256':sha(b)}
def put(p,v):
 p.parent.mkdir(parents=True,exist_ok=True)
 with p.open('x',encoding='utf-8',newline='\n') as f:json.dump(v,f,sort_keys=True,separators=(',',':'));f.write('\n')
 return row(p)
def members():return [{'path':p.relative_to(PKG).as_posix(),'sha256':sha(p.read_bytes()),'byteLength':p.stat().st_size} for p in sorted(PKG.rglob('*')) if p.is_file()]
def compact(r):
 r=copy.deepcopy(r);dictionary={}
 for p in r['lifetimes']+[p for sample in r['observation']['samples'] for p in sample['processes']]:
  if isinstance(p.get('commandLine'),str):key=sha(p['commandLine'].encode());dictionary[key]=p['commandLine'];p['commandLine']={'sha256':key}
 r['traceEncoding']={'kind':'LosslessCommandLineDictionary','version':'1.0.0','commandLines':dictionary};return r
assert sha(NODE.read_bytes())=='sha256:ba4e6d110e8c1592a1ecd390f6b05f3da124b13871a5be62b341a07a853c6c32'
assert sha((PKG/'distribution-manifest.json').read_bytes())=='sha256:311927a980bd397ab70b95da77d546e4b212968d05973ecf998817764431d773'
before=members();assert len(before)==94
run=time.strftime('%Y%m%dT%H%M%S',time.gmtime())+'-'+uuid.uuid4().hex[:6]
runout=OUT/run;runout.mkdir()
work=ROOT/'.cache/mo1306-phase3ar-resolution'/run;work.mkdir(parents=True)
env={k:os.environ[k] for k in ('SystemRoot','WINDIR')};identities={'node':str(NODE),'powershell':str(Path(env['SystemRoot'])/'System32/WindowsPowerShell/v1.0/powershell.exe'),'conhost':str(Path(env['SystemRoot'])/'System32/conhost.exe')}
bindings={'node':row(NODE),'installedManifest':row(PKG/'distribution-manifest.json'),'filesystem':row(PKG/'src/filesystem.mjs'),'helper':row(PKG/'scripts/check-paths.ps1'),'limits':row(PKG/'contracts/limits.json'),'harness':row(Path(__file__)),'program':row(HERE/'helper-observe.mjs'),'observer':row(HERE.parent/'mo1306-phase2d/observer.py'),'traceValidator':row(HERE.parent/'mo1306-phase2d/trace_phase2d.py'),'roleValidator':row(HERE.parent/'mo1306-correction-a/topology.py')}
clocks={key:{field:getattr(time.get_clock_info(key),field) for field in ('implementation','monotonic','adjustable','resolution')} for key in ('monotonic','perf_counter')}
put(runout/'preflight.json',{'status':'PASS','bindings':bindings,'python':sys.version,'platform':platform.platform(),'clocks':clocks,'installedBefore':before,'sampleIntervalMs':100,'maximumObservations':5})
observations=[];disposition='UNRESOLVED';failure=None
try:
 for index,mode in enumerate(['installation-first48','installation-first48','installation-first48','original-single-config','remaining-overall-100ms'],1):
  workspace=work/('case-'+str(index));workspace.mkdir();name=f'{index:02}-{mode}'
  argv=list(map(str,[NODE,'--max-old-space-size=128',HERE/'helper-observe.mjs',PKG,NODE,ROOT/'repositories/cca-conformance/fixtures/mo1306/evaluate-policy-pass/memoryos-ci.json',mode,workspace]))
  beganUtc=time.strftime('%Y-%m-%dT%H:%M:%SZ',time.gmtime());start=time.perf_counter_ns()
  trace=observer.execute(argv,PKG,env=env,timeout=12,interval=.1)
  trace['utcStartOperationalOnly']=beganUtc;trace['utcEndOperationalOnly']=time.strftime('%Y-%m-%dT%H:%M:%SZ',time.gmtime())
  trace['engineeringOuterPerfCounterNs']=time.perf_counter_ns()-start
  stdout=trace.pop('stdout');stderr=trace.pop('stderr')
  (runout/(name+'.stdout.json')).write_text(stdout,encoding='utf-8',newline='\n');(runout/(name+'.stderr.txt')).write_text(stderr,encoding='utf-8',newline='\n')
  trace['stdout']=row(runout/(name+'.stdout.json'));trace['stderr']=row(runout/(name+'.stderr.txt'))
  topology=validate_trace(trace,identities,PKG);trace['topologyValidation']=topology
  trace_ref=put(runout/(name+'.trace.json'),compact(trace))
  assert stderr=='' and trace['exitCode'] in (0,2)
  value=json.loads(stdout)
  item={'index':index,'mode':mode,'report':row(runout/(name+'.stdout.json')),'trace':trace_ref,'result':value['result'],'lateAccepted':value['lateAccepted'],'deadlineWindow':value['deadlineWindow'],'terminalAtMs':value['terminalAtMs'],'timerEvents':[e for e in value['events'] if e['event'] in ('timerArmed','timerFire','killBefore','killReturn','checkPathsResolved','checkPathsRejected')],'peakProcessCount':trace['observation']['peakProcessCount'],'cleanup':trace['cleanup']}
  observations.append(item);put(runout/(name+'.receipt.json'),item)
  print(json.dumps({'index':index,'mode':mode,'result':value['result'],'lateAccepted':value['lateAccepted'],'delay':value['actualRequestedDelayMs'],'peakRoles':item['peakProcessCount']}),flush=True)
  assert value['filesystem']['unchanged'] and not value['filesystem']['completeMarkerPresent']
  assert not trace['cleanup']['remainingPids'] and trace['observation']['peakProcessCount']<=3
  if value['lateAccepted']:
   disposition='PRODUCT_DEADLINE_VIOLATION';break
  if mode=='remaining-overall-100ms':assert not value['result']['accepted'] and value['result']['code']=='MO1306_OVERALL_TIMEOUT'
  else:assert value['actualRequestedDelayMs']==2000
 assert members()==before,'INSTALLED_CHANGED'
except BaseException as e:
 failure=type(e).__name__+': '+str(e);raise
finally:
 report={'kind':'MemoryOSPhase3ARResolutionFocusedHelperCampaign','version':'1.0.0','run':run,'status':'STOP_PRODUCT_VIOLATION' if disposition=='PRODUCT_DEADLINE_VIOLATION' else 'OBSERVED' if failure is None else 'FAIL','classification':disposition,'failure':failure,'bindings':bindings,'clocks':clocks,'observationCount':len(observations),'observations':observations,'installedUnchanged':members()==before,'scope':'Five bounded observations max. No full native campaign. Raw2032 classification requires separate source/clock audit.'}
 put(runout/'summary.json',report);print(json.dumps({'summary':str(runout/'summary.json'),'status':report['status'],'classification':disposition}),flush=True)
