"""Post-binding validation writes only an ignored receipt and empty test folders."""
from conformance import *
sys.path.insert(0,str(TOOLS.parent/'mo1306-phase2d'))
import observer
from trace_phase2d import validate_trace
inv=json.loads(INV.read_bytes());binding=json.loads(BIND.read_bytes());validate_binding(binding,inv,post=True)
checks=[]
r=command([NODE,TOOLS/'boundary.mjs',PKG,'corrected'],timeout=15);assert r['exitCode']==0,r;checks.append({'id':'boundary-cancellation-overall-terminal','result':r})
identities={'node':str(NODE),'powershell':str(Path(ENV['SystemRoot'])/'System32/WindowsPowerShell/v1.0/powershell.exe'),'conhost':str(Path(ENV['SystemRoot'])/'System32/conhost.exe')}
for case in ['installation-first48-a','installation-first48-b','installation-first48-c','original-single-config','late','cancel','remaining-overall-100ms']:
 work=CACHE/'post'/case;work.mkdir(parents=True)
 argv=list(map(str,[NODE,'--max-old-space-size=128',TOOLS/'helper-observe.mjs',PKG,NODE,ROOT/'repositories/cca-conformance/fixtures/mo1306/evaluate-policy-pass/memoryos-ci.json',case,work]))
 trace=observer.execute(argv,PKG,env=ENV,timeout=15,interval=.1);topology=validate_trace(trace,identities,PKG);value=json.loads(trace.pop('stdout'));assert trace['exitCode']==0 and not trace['stderr']
 expected=None if case.startswith('installation-first48') or case=='original-single-config' else 'MO1306_CANCELLED' if case=='cancel' else 'MO1306_OVERALL_TIMEOUT' if case=='remaining-overall-100ms' else 'MO1306_FILESYSTEM_BOUNDARY'
 assert value['result']=={'accepted':expected is None,'code':expected} and not value['lateAccepted'] and value['filesystem']['unchanged'] and not value['filesystem']['completeMarkerPresent']
 checks.append({'id':'native-'+case,'report':value,'topology':topology,'peakRoles':trace['observation']['peakProcessCount'],'cleanup':trace['cleanup']});print('post native',case,'PASS',flush=True)
r=command([NODE,TOOLS/'dispatch.mjs',ROOT,PKG/'bin/memoryos-ci.mjs','corrected'],timeout=45);assert r['exitCode']==0,r;checks.append({'id':'CLI-dispatch-191','result':r})
for key in ['constructor','toString','__proto__','invalid-command']:
 r=command([NODE,'--max-old-space-size=128',PKG/'bin/memoryos-ci.mjs',key],timeout=10);assert r['exitCode']==10 and json.loads(r['stderr'])['code']=='MO1306_USAGE' and not r['stdout'],r;checks.append({'id':'public-cli-'+key,'result':r})
for c in read('semantic-native.json')['cases']:
 r=command([NODE,TOOLS/'semantic-smoke.mjs',ROOT,OUT/'oracles'/c['id']],timeout=20);assert r['exitCode']==0 and json.loads(r['stdout'])['decision']==c['decision'],r;checks.append({'id':'semantic-'+c['id'],'result':r})
r=command([NODE,TOOLS/'providers.mjs',PKG,ROOT,sha((PKG/'distribution-manifest.json').read_bytes())],timeout=30);assert r['exitCode']==0 and json.loads(r['stdout'])==read('provider-preservation.json')['newPin'],r;checks.append({'id':'five-providers','result':r})
for name,args in [('workspace',[sys.executable,'-B','-X','utf8',ROOT/'tools/verify_workspace.py','--root',ROOT]),('diff',['git','diff','--check','HEAD^','HEAD'])]:
 r=command(args,env={**os.environ,'GIT_OPTIONAL_LOCKS':'0','PYTHONDONTWRITEBYTECODE':'1'},timeout=60);assert r['exitCode']==0,r;checks.append({'id':name,'result':r})
assert git('status','--porcelain=v1')=='' and git('branch','--show-current')=='main'
value={'status':'PASS','head':git('rev-parse','HEAD'),'parent':git('rev-parse','HEAD^'),'checks':checks,'negativeConformanceControls':negatives(inv),'finalStatus':git('status'),'bindingDiff':git('diff','--stat','HEAD^','HEAD'),'package':inv['package']['archive'],'readOnlyTrackedFiles':True}
target=CACHE/'post-c3cb.json';assert not target.exists();target.write_bytes(j(value));print(json.dumps({'postC3CB':'PASS','head':value['head'],'checks':len(checks),'clean':True}))
