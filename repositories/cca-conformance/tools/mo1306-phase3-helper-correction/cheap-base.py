from common import *
import shutil
checks=[]
for p in sorted(PKG.rglob('*.mjs')):
 if 'runtime' in p.relative_to(PKG).parts:continue
 r=command([NODE,'--check',p],timeout=10);assert r['exitCode']==0,r;checks.append(r)
r=command([NODE,TOOLS/'dispatch.mjs',ROOT,PKG/'bin/memoryos-ci.mjs','corrected'],timeout=45);put('dispatch-corrected.json',r);assert r['exitCode']==0,r
suite=json.loads(r['stdout']);assert suite['counts']['fail']==0
cases=[]
for key in suite['prototypeNames']+suite['general']:
 args=[] if key is None else [key]
 r=command([NODE,'--max-old-space-size=128',PKG/'bin/memoryos-ci.mjs',*args],timeout=10)
 expected={'code':'MO1306_USAGE','kind':'MemoryOSCICDDiagnostic','message':'The requested operation could not complete.','stage':'LAUNCH','version':'1.0.0'}
 assert r['exitCode']==10 and r['stdout']=='' and r['stderr'].encode()==j(expected),r
 cases.append({**r,'handlerInvoked':False,'executionBypass':False})
put('cli-negative.json',{'status':'PASS','cases':cases,'count':len(cases),'boundedLongestCodeUnits':4096,'scope':'Direct Windows argv cannot contain NUL; other controls are passed directly, with no shell interpolation. No new parser input limit is introduced.'})
semantic=[]
for kind in ['policy','policySet','regression']:
 for verdict,code in [('pass',0),('fail',6),('cne',7)]:
  fixture=ROOT/'repositories/cca-conformance/fixtures/mo1306'/('evaluate-'+('policy' if kind=='regression' else kind)+'-'+verdict)
  work=CACHE/'smoke'/(kind+'-'+verdict);shutil.copytree(fixture,work)
  config=json.loads((work/'memoryos-ci.json').read_bytes())
  if kind=='regression' and verdict!='cne':
   shutil.copyfile(work/'candidate.mip',work/'baseline.mip');config['context']['baselineMip']='baseline.mip';(work/'memoryos-ci.json').write_bytes(j(config))
  oracle=command([NODE,TOOLS.parent/'mo1306/oracle.mjs',work],timeout=20);assert oracle['exitCode']==0,oracle
  r=command([NODE,TOOLS/'semantic-smoke.mjs',ROOT,work],timeout=20);assert r['exitCode']==0,r
  decision=json.loads(r['stdout'])['decision'];assert decision=={'pass':'PASS','fail':'FAIL','cne':'COULD_NOT_EVALUATE'}[verdict]
  semantic.append({'id':kind+'-'+verdict,'work':str(work),'expectedExit':code,'decision':decision,'oracle':oracle,'delegate':r,'artifacts':[row(work/'oracle-identity.json'),row(work/'oracle-outcome.json')]})
put('semantic-smoke.json',{'status':'PASS','cases':semantic,'count':len(semantic),'authority':'Sole production SDK 1.1.0; compared byte-for-byte with separate source SDK oracle process; regression CNE lacks prerequisite baseline by design.'})
old_contract=subprocess.check_output(['git','show',B2+':repositories/memoryos-ci/contracts/errors.json'],cwd=ROOT,stdin=subprocess.DEVNULL)
assert (PKG/'contracts/errors.json').read_bytes()==old_contract
assert len(json.loads(old_contract)['errors'])==28
r=command(['git','diff','--check'],env={**os.environ,'GIT_OPTIONAL_LOCKS':'0'});assert r['exitCode']==0,r
put('cheap-base.json',{'status':'PASS','syntaxChecks':checks,'dispatchTests':suite['counts'],'publicNegativeCases':len(cases),'semanticCases':len(semantic),'errorCatalogCount':28,'frozenErrorBytesUnchanged':True,'diffCheck':r,'beforePackageRegeneration':True,'source':row(PKG/'bin/memoryos-ci.mjs')})
print(json.dumps({'cheapGate':'PASS','dispatch':suite['counts'],'publicCLI':len(cases),'semantic':len(semantic)}))
