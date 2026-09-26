"""Bounded post-binding checks; only writes an ignored engineering receipt."""
from conformance import *
inv=json.loads(INV.read_bytes());binding=json.loads(BIND.read_bytes());validate_binding(binding,inv,post=True)
checks=[]
r=command([NODE,TOOLS/'dispatch.mjs',ROOT,PKG/'bin/memoryos-ci.mjs','corrected'],timeout=45);assert r['exitCode']==0,r;checks.append({'id':'dispatch-provider-projection-errors','result':r})
for key in ['constructor','toString','__proto__','invalid-command']:
 r=command([NODE,'--max-old-space-size=128',PKG/'bin/memoryos-ci.mjs',key],timeout=10);assert r['exitCode']==10 and json.loads(r['stderr'])['code']=='MO1306_USAGE' and r['stdout']=='',r;checks.append({'id':'public-cli-'+key,'result':r})
for c in read('semantic-native.json')['cases']:
 r=command([NODE,TOOLS/'semantic-smoke.mjs',ROOT,OUT/'oracles'/c['id']],timeout=20);assert r['exitCode']==0 and json.loads(r['stdout'])['decision']==c['decision'],r;checks.append({'id':'semantic-'+c['id'],'result':r})
r=command([NODE,TOOLS/'providers.mjs',PKG,ROOT,sha((PKG/'distribution-manifest.json').read_bytes())],timeout=30);assert r['exitCode']==0 and json.loads(r['stdout'])==read('provider-preservation.json')['newPin'],r;checks.append({'id':'all-five-provider-preservation','result':r})
for name,args in [('workspace',[sys.executable,'-B','-X','utf8',ROOT/'tools/verify_workspace.py','--root',ROOT]),('diff',['git','diff','--check','HEAD^','HEAD'])]:
 r=command(args,env={**os.environ,'GIT_OPTIONAL_LOCKS':'0','PYTHONDONTWRITEBYTECODE':'1'},timeout=60);assert r['exitCode']==0,r;checks.append({'id':name,'result':r})
assert git('status','--porcelain=v1')=='' and git('branch','--show-current')=='main'
value={'status':'PASS','head':git('rev-parse','HEAD'),'parent':git('rev-parse','HEAD^'),'checks':checks,'negativeConformanceControls':negatives(inv),'finalStatus':git('status'),'diff':git('diff','--stat','HEAD^','HEAD'),'package':inv['package']['archive'],'readOnlyTrackedFiles':True}
target=CACHE/'post-c3ab.json';assert not target.exists();target.write_bytes(j(value));print(json.dumps({'postC3AB':'PASS','head':value['head'],'checks':len(checks),'clean':True}))
