from common import *
from native import observe
phase=sys.argv[1];pkg=PKG if phase=='source' else Path(json.loads((OUT/'package.json').read_bytes())['installRoot'])
cases=['installation-first48-a','installation-first48-b','installation-first48-c','original-single-config','late','failure-late','remaining-overall-100ms','timer-first-delay','timeout','cancel'] if phase=='source' else ['installation-first48','original-single-config','late','remaining-overall-100ms','timeout','cancel','core-late']
results=[]
for case in cases:
 v=observe(phase+'-'+case,pkg,'helper-observe.mjs',[case])
 expected=None if case.startswith('installation-first48') or case=='original-single-config' else 'MO1306_OVERALL_TIMEOUT' if case=='remaining-overall-100ms' else 'MO1306_CANCELLED' if case=='cancel' else 'MO1306_FILESYSTEM_BOUNDARY'
 assert v['result']=={'accepted':expected is None,'code':expected},(case,v['result'])
 assert not v['lateAccepted']
 if case in ['late','core-late']:
  ev=v['events'];arm=next(e for e in ev if e['event']=='timerArmed');ended=next(e for e in ev if e['event']=='childEventBefore' and e['name']=='exit')
  assert ended['args'][0]==0 and ended['atMs']<arm['dueLowerMs'] and v['terminalAtMs']>arm['dueUpperMs']
  assert not any(e['event']=='timerFire' for e in ev)
 if case=='core-late':
  core=next(e for e in v['events'] if e['event']=='coreResult');assert core['summary']['publication']=='NONE' and core['summary']['exitCode']==11 and core['summary']['resultSha256'] is None
 results.append({'case':case,'result':v['result'],'report':row(OUT/('native/'+phase+'-'+case+'.json'))})
put(phase+'-focused.json',{'status':'PASS','cases':results,'count':len(results),'scope':'Focused engineering witnesses, not Phase 3 recertification.'})
