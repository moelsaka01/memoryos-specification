from common import *
import copy
sys.path.insert(0,str(TOOLS.parent/'mo1306-phase2d'))
import observer
from trace_phase2d import validate_trace
def observe(name,pkg,program,arguments,expected=0):
 work=CACHE/name;work.mkdir(parents=True)
 argv=list(map(str,[NODE,'--max-old-space-size=128',TOOLS/program,pkg,NODE,ROOT/'repositories/cca-conformance/fixtures/mo1306/evaluate-policy-pass/memoryos-ci.json',*arguments,work]))
 trace=observer.execute(argv,pkg,env=ENV,timeout=15,interval=.1)
 value=json.loads(trace.pop('stdout'));stderr=trace.pop('stderr')
 identities={'node':str(NODE),'powershell':str(Path(ENV['SystemRoot'])/'System32/WindowsPowerShell/v1.0/powershell.exe'),'conhost':str(Path(ENV['SystemRoot'])/'System32/conhost.exe')}
 trace['topologyValidation']=validate_trace(trace,identities,pkg)
 dictionary={}
 for p in trace['lifetimes']+[p for sample in trace['observation']['samples'] for p in sample['processes']]:
  if isinstance(p.get('commandLine'),str):key=sha(p['commandLine'].encode());dictionary[key]=p['commandLine'];p['commandLine']={'sha256':key}
 trace['traceEncoding']={'kind':'LosslessCommandLineDictionary','version':'1.0.0','commandLines':dictionary}
 put('native/'+name+'.json',{'report':value,'trace':trace,'stderr':stderr,'source':row(pkg/'src/filesystem.mjs'),'helper':row(pkg/'scripts/check-paths.ps1')})
 assert trace['exitCode']==expected and stderr=='',(trace['exitCode'],stderr)
 assert value['filesystem']['unchanged'] and not value['filesystem']['completeMarkerPresent']
 print(json.dumps({'case':name,'result':value['result'],'peakRoles':trace['observation']['peakProcessCount'],'remainingPids':trace['cleanup']['remainingPids']}),flush=True)
 return value
if __name__=='__main__':
 v=observe('c3ab-reproduction',CACHE/'c3ab-package','helper-close-boundary.mjs',['boundary-close-delay'],2)
 ev=v['events'];arm=next(e for e in ev if e['event']=='timerArmed');out=next(e for e in ev if e['event']=='stdoutData');ended=next(e for e in ev if e['event']=='childEventBefore' and e['name']=='exit');forward=next(e for e in ev if e['event']=='boundaryCloseForwardedToProduct')
 assert json.loads(out['text'])['safe'] is True and ended['args'][0]==0
 assert out['atMs']<ended['atMs']<arm['dueLowerMs']<forward['atMs']<v['terminalAtMs']
 assert not any(e['event']=='timerFire' for e in ev) and v['lateAccepted'] and v['result']['accepted']
 put('reproduction.json',{'status':'PASS','classification':'PRODUCT_DEADLINE_VIOLATION','source':row(CACHE/'c3ab-package/src/filesystem.mjs'),'observation':row(OUT/'native/c3ab-reproduction.json'),'helperExitAtMs':ended['atMs'],'armedDeadlineUpperMs':arm['dueUpperMs'],'acceptanceAtMs':v['terminalAtMs'],'lateByMs':v['terminalAtMs']-arm['dueUpperMs'],'timerFired':False})
