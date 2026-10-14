from common import *
from native import observe
import re
assert json.loads((OUT/'cheap-base.json').read_bytes())['status']=='PASS'
assert json.loads((OUT/'source-focused.json').read_bytes())['status']=='PASS'
v=json.loads((OUT/'native/source-filesystem-preflight.json').read_bytes())['report'];assert v['status']=='PASS'
for mode,pkg in [('baseline',CACHE/'c3ab-package'),('corrected',PKG)]:
 r=command([NODE,TOOLS/'boundary.mjs',pkg,mode]);put('boundary-'+mode+'.json',r);assert r['exitCode']==0,r
pin=sha((CACHE/'c3ab-package/distribution-manifest.json').read_bytes());results=[]
for pkg in [CACHE/'c3ab-package',PKG]:
 r=command([NODE,TOOLS/'providers.mjs',pkg,ROOT,pin,CACHE/'c3ab-package']);assert r['exitCode']==0,r;results.append(json.loads(r['stdout']))
assert results[0]==results[1]
# Prove no provider/generator input closure changed before using the historical
# verified installation identity for this pure in-memory generation comparison.
def closure(entry,seen=None):
 seen=set() if seen is None else seen
 if entry in seen:return seen
 seen.add(entry);raw=(PKG/entry).read_text()
 for dep in re.findall(r"(?:from\s*|import\s*)['\"]([^'\"]+)['\"]",raw):
  if dep.startswith('.'):
   target=(PKG/entry).parent.joinpath(dep).resolve().relative_to(PKG.resolve()).as_posix();closure(target,seen)
 return seen
members=sorted(set.union(closure('src/generator.mjs'),*[closure('src/providers/'+p+'.mjs') for p in ['generic','gitlab','jenkins','azure','github']])|set(p.relative_to(PKG).as_posix() for p in (PKG/'templates').iterdir()))
assert 'src/filesystem.mjs' not in members
for p in members:assert (PKG/p).read_bytes()==(CACHE/'c3ab-package'/p).read_bytes()
put('provider-cheap.json',{'status':'PASS','closure':members,'sameInputGeneration':results[1],'allFiveByteIdentical':True,'historicalVerifiedIdentityUsedOnlyForUnchangedGeneratorClosure':True})
put('cheap-gate.json',{'status':'PASS','beforePackageRegeneration':True,'base':row(OUT/'cheap-base.json'),'boundary':row(OUT/'boundary-corrected.json'),'native':row(OUT/'source-focused.json'),'filesystem':row(OUT/'native/source-filesystem-preflight.json'),'providers':row(OUT/'provider-cheap.json'),'diffCheck':git('diff','--check')})
print('All cheap gates PASS')
