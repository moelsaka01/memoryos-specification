from common import *
r=command([NODE,TOOLS/'dispatch.mjs',ROOT,PKG/'bin/memoryos-ci.mjs','b2'],timeout=45)
put('dispatch-b2.json',r)
assert r['exitCode']==0,r['stderr']
s=json.loads(r['stdout']);print(json.dumps({'mode':'b2','counts':s['counts'],'failed':[(x['group'],x['name']) for x in s['results'] if x['status']=='FAIL']}))
