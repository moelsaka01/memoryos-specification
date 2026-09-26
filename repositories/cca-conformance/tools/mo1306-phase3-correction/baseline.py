"""Capture and independently reproduce the immutable B2 defect before editing."""
from common import *
assert ROOT==Path(r'C:\Users\melsa\Documents\Codex\cca-workspace')
assert git('rev-parse','HEAD')==B2 and git('branch','--show-current')=='main'
assert git('rev-parse','HEAD^')==I2
assert git('diff','--name-only')=='' and git('diff','--cached','--name-only')==''
assert git('log','-1','--format=%s')=='conformance(memoryos-1.3): bind MO-1306 phase 2 integration'
assert sha(NODE.read_bytes())=='sha256:ba4e6d110e8c1592a1ecd390f6b05f3da124b13871a5be62b341a07a853c6c32'
runtime=command([NODE,'-p','JSON.stringify({version:process.version,arch:process.arch,platform:process.platform})'])
assert json.loads(runtime['stdout'])=={'version':'v24.21.0','arch':'x64','platform':'win32'}
tags=json.loads((ROOT/'repositories/cca-conformance/evidence/mo1306/predecessors/immutable.json').read_bytes())['tags']
for tag in tags:
 assert git('rev-parse',tag['tag'])==tag['object']
 assert git('rev-parse',tag['tag']+'^{}')==tag['commit']
states=[]
for name in ['3a','3b','3c']:
 wt=ROOT.parent/('cca-mo1306-'+name)
 args=['-c','safe.directory='+wt.as_posix(),'-C',str(wt)]
 states.append({'workstream':name,'root':str(wt),'head':git(*args,'rev-parse','HEAD'),'status':git(*args,'status','--porcelain=v1','--untracked-files=all')})
wt=ROOT.parent/'cca-mo1306-3c'
paths=['docs/mo1306-phase3c-blocker.md','repositories/cca-conformance/evidence/mo1306/phase3c/command-selector-blocker.json','repositories/cca-conformance/evidence/mo1306/phase3c/stop-validation.json','repositories/cca-conformance/tools/mo1306-phase3c/blocked-command-audit.py']
blocker=[row(wt/p,wt) for p in paths]
assert len(states[2]['status'].splitlines())==4
for p in paths:
 target=OUT/'original-3c'/p;target.parent.mkdir(parents=True,exist_ok=True);assert not target.exists();target.write_bytes((wt/p).read_bytes())
cases=[]
for name in ['constructor','toString','__proto__','invalid-command']:
 r=command([NODE,'--max-old-space-size=128',PKG/'bin/memoryos-ci.mjs',name],timeout=10)
 expected=10 if name=='invalid-command' else 16
 code='MO1306_USAGE' if expected==10 else 'MO1306_INTERNAL_FAILURE'
 assert r['exitCode']==expected and r['stdout']=='' and json.loads(r['stderr'])['code']==code
 cases.append({**r,'command':name,'machineCode':code,'handlerInvoked':False,'executionBypass':False,'handlerEvidence':'argv throws before it returns, before every handler call; additionally witnessed by isolated source instrumentation in regression tests.'})
CACHE.mkdir(parents=True,exist_ok=True)
put('baseline.json',{'baseline':B2,'parent':I2,'branch':'main','root':str(ROOT),'initialTrackedState':'CLEAN','runtime':{**row(NODE),'probe':runtime},'tags':tags,'worktrees':states,'blockerDisposition':'BLOCKED / PRODUCTION_DEFECT','blockerFiles':blocker,'source':row(PKG/'bin/memoryos-ci.mjs'),'cases':cases})
print(json.dumps({'baseline':B2,'reproduction':'PASS','cases':[(c['command'],c['exitCode'],c['machineCode']) for c in cases]}))
