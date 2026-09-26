"""Build graph-aware receipts; I2 bytes are frozen before binding actual revision."""
from conformance import *
import argparse
parser=argparse.ArgumentParser();parser.add_argument('--i2');args=parser.parse_args()
revision=args.i2
if revision:
 assert git('rev-parse','HEAD')==revision and git('show','-s','--format=%P',revision)==B1
 previous=json.loads(INV.read_bytes());paths=[r['path'] for r in previous['artifacts']]
else:
 paths=set(git('diff','--name-only',B1).splitlines())|set(git('ls-files','--others','--exclude-standard').splitlines())
 paths|={p.relative_to(ROOT).as_posix() for p in PKG.rglob('*') if p.is_file()}
 paths|={'docs/mo1306-provider-neutral-cicd.md','docs/mo1306-contract-freeze-1.md','docs/mo1306-contract-freeze-1-process-correction.md','repositories/cca-conformance/mo1306-phase2-interfaces.json'}
 paths=sorted(p for p in paths if p and p!=relative(INV) and not p.startswith(relative(BIND)+'/'))
assert all(p.startswith(('docs/','repositories/memoryos-ci/','repositories/cca-conformance/')) or p=='.gitattributes' for p in paths)
rows=[row(ROOT/p) for p in paths];artifacts(rows)
package=json.loads((OUT/'package.json').read_bytes());identities={'contract':package['contractDigest'],'distribution':package['distributionDigest'],'runtimeClosure':package['runtimeClosureDigest'],'archive':package['archive']['sha256']}
groups={k:[] for k in GATES}
for r in rows:
 p=r['path']
 if '/phase2d/' in p:
  if any(t in p for t in ['/native/','/native-cases/','/bundles/','/launcher','/parity-','/github-wrapper']):group='execution'
  elif '/installed-' in p or '/generated/' in p:group='package'
  elif '/first-attempt/' in p:group='sources'
  else:group='handoff'
 elif p.startswith('repositories/memoryos-ci/'):group='package'
 elif '/phase2' in p or '/evidence/' in p:group='sources'
 else:group='contracts'
 groups[group].append(r)
for group,gates in GATES.items():
 for file in gates.values():
  r=row(OUT/file)
  if r not in groups[group]:groups[group].append(r)
receipts={};refs=[]
for group,gates in GATES.items():
 receipt={'kind':'MemoryOSCICDPhase2Receipt','version':'1.0.0','id':group,'status':'PASS','implementationRevision':revision,'identities':identities,'artifacts':sorted(groups[group],key=lambda r:r['path']),'cases':[{'id':k,'status':'PASS','evidencePaths':[relative(OUT/v)]} for k,v in gates.items()],'requires':[{'receiptId':d,'sha256':sha(j(receipts[d]))} for d in DEPS[group]]}
 receipts[group]=receipt;refs.append({'id':group,'path':relative(BIND/(group+'.json')),'sha256':sha(j(receipt))})
inv={'kind':'MemoryOSCICDPhase2Inventory','version':'1.0.0','baseline':B1,'authorities':{'roadmap':AUTH,'freeze':F1,'correctionA':F1A,'I1':I1,'B1':B1},'sources':SOURCES,'implementation':{'state':'BOUND' if revision else 'PRE_I2','revision':revision,'parent':B1},'releaseState':'PHASE_2_COMPLETE_FINAL_CERTIFICATION_PENDING' if revision else 'PHASE_2_ACCEPTED_BINDING_PENDING','identities':identities,'providers':LABELS,'hostedExecuted':False,'platform':'windows-11-x64','requiredGates':GATES,'artifacts':rows,'receipts':refs,'phase3Interfaces':row(BASE/'mo1306-phase3-interfaces.json')}
BIND.mkdir(exist_ok=True)
for key,value in receipts.items():assert len(j(value))<=2097152;(BIND/(key+'.json')).write_bytes(j(value))
assert len(j(inv))<=2097152;INV.write_bytes(j(inv))
print(json.dumps({'inventoryArtifacts':len(rows),'receiptCount':len(refs),'implementation':revision}))
