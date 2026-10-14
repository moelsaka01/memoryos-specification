"""Derive release limits from all preserved samples; never edits a sample."""
from pathlib import Path
import hashlib,json,math,sys
ROOT=Path(__file__).resolve().parents[3]
PKG=ROOT/'repositories/memoryos-rest'
EVIDENCE=ROOT/'repositories/cca-conformance/evidence'
AUX=EVIDENCE/'mo1305-phase1-aux'
CACHE=ROOT/'.cache/mo1305-resource-review'
FROZEN=ROOT/'.cache/mo1305-bounded-r6/frozen-measured'
BUILD=ROOT/'.cache/mo1305-resume/build'
def j(value):return json.dumps(value,ensure_ascii=False,sort_keys=True,separators=(',',':')).encode()
def read(path):return json.loads(path.read_bytes())
def put(path,value):path.parent.mkdir(parents=True,exist_ok=True);path.write_bytes(j(value));return ref(path)
def ref(path):
 data=path.read_bytes();return {'path':path.relative_to(ROOT).as_posix(),'byteLength':len(data),'sha256':hashlib.sha256(data).hexdigest()}
def copied(source,name):
 path=AUX/name;path.parent.mkdir(parents=True,exist_ok=True);path.write_bytes(source.read_bytes());return ref(path)
def derive():
 bounded=ROOT/'.cache/mo1305-bounded-r6'
 resume=EVIDENCE/'mo1305-phase1-resume'
 completion=read(resume/'measurement-completion.json');assert completion['state']=='PASS'
 resource=read(resume/'resource-aggregate.json');stress=read(resume/'stress-validation.json')
 assert resource['state']==stress['state']=='PASS' and not resource['extensionRequired']
 assert resource['cases']==15 and resource['cold']==150 and resource['warm']==300 and resource['samples']==450
 assert stress['scenarios']==9 and stress['repetitions']==18
 preliminary=read(FROZEN/'preliminary-limits.json');assert preliminary['state']=='PRELIMINARY' and preliminary['measured']['operationMs']==60000
 maxima=dict(resource['maxima']);maxima['operations']={name:resource['operations'].get(name,{'requestBytes':0,'responseBytes':0}) for name in preliminary['measured']['operations']}
 for key,value in stress['maxima'].items():maxima[key]=max(maxima[key],value)
 final=read(FROZEN/'preliminary-limits.json');final['state']='FINAL'
 for budget,metric,minimum in [('workerOldMiB','workerOldBytes',32),('workerYoungMiB','workerYoungBytes',8),('workerExternalMiB','workerExternalBytes',8),('parentHeapMiB','parentHeapBytes',32),('parentExternalMiB','parentExternalBytes',8),('processRssMiB','processRssBytes',128)]:
  value=max(minimum,math.ceil(3*maxima[metric]/(2*1048576)));assert value<=preliminary['measured'][budget],f'CEILING_EXCEEDED {budget}: {value}';final['measured'][budget]=value
 final['measured']['operationMs']=((max(1000000,4*maxima['operationUs'])+99999)//100000)*100
 assert final['measured']['operationMs']<=60000,'DEADLINE_CEILING_EXCEEDED'
 analytical=read(ROOT/'repositories/cca-conformance/fixtures/mo1305-phase1/analytical-bounds.json')
 for name,budget in final['measured']['operations'].items():
  a=analytical['operations'][name];m=maxima['operations'][name]
  budget['requestBytes']=math.ceil(1.25*max(a['requestSchemaBytes'],m['requestBytes'])/1024)*1024 if a['requestSchemaBytes'] else 0
  budget['responseBytes']=math.ceil(1.25*max(a['responseSchemaBytes'],m['responseBytes'],maxima['earlyErrorBytes'])/1024)*1024
  assert budget['requestBytes']<=1048576 and budget['responseBytes']<=65536
 final['measured']['earlyErrorBytes']=math.ceil(1.25*maxima['earlyErrorBytes']/1024)*1024
 for filename in ['source-tree.json','distribution-manifest.json','preliminary-limits.json','inputs.json','external-inputs.json','input-checks.json']:copied(FROZEN/filename,'measured-'+filename)
 copied(resume/'measurement-completion.json','measured-completion.json')
 progress=resource;adverse=read(resume/'stress/index.json')
 chunks=resource['vectors']+[ref(resume/'stress'/f"{r['name']}-{r['repeat']}.json") for r in adverse['completed']]
 put(AUX/'maxima.json',maxima);put(AUX/'sample-chunks.json',sorted(chunks,key=lambda r:r['path']))
 copied(resume/'resource-aggregate.json','resource-validation.json');copied(resume/'stress-validation.json','measured-stress-validation.json')
 put(AUX/'measured-archive-location.json',{'original':progress['binding']['archive'],'preserved':ref(FROZEN/'memoryos-rest-0.1.0.tgz'),'reason':'Preserved before final derivation; original build output path is reused by the deterministic final build. Raw measurement identities are immutable.'})
 put(PKG/'contracts/limits.json',final);print(json.dumps({'state':'FINAL_DERIVED','methodologyVersion':'2.0.0','maxima':maxima,'limits':ref(PKG/'contracts/limits.json')}))
def adjustment():
 before=read(AUX/'measured-source-tree.json');after=read(BUILD/'source-tree.json')
 def changes(left,right):
  assert [r['path'] for r in left]==[r['path'] for r in right]
  return [a['path'] for a,b in zip(left,right) if a!=b]
 source=changes(before['files'],after['files']);assert source==['repositories/memoryos-rest/contracts/limits.json','repositories/memoryos-rest/contracts/openapi.json'],source
 old=read(AUX/'measured-distribution-manifest.json');new=read(PKG/'distribution-manifest.json');distribution=changes(old['files'],new['files'])
 assert distribution==['contracts/limits.json','contracts/openapi.json','dependency-manifest.json','sbom.spdx.json'],distribution
 record={'kind':'MemoryOSRESTDerivedLimitsAdjustment','state':'PASS','measuredSourceTree':ref(AUX/'measured-source-tree.json'),'finalSourceTree':copied(BUILD/'source-tree.json','final-source-tree.json'),'measuredDistribution':ref(AUX/'measured-distribution-manifest.json'),'finalDistribution':ref(PKG/'distribution-manifest.json'),'changedSourcePaths':source,'changedDistributionPaths':distribution,'limitsBefore':ref(AUX/'measured-preliminary-limits.json'),'limitsAfter':ref(PKG/'contracts/limits.json'),'reason':'The frozen selected-vector campaign derives downward budgets under verification methodology 2.0.0. Only limits, their OpenAPI projection and generated provenance change. Installed confirmation and final boundaries execute the derived limits; measured sample identities remain unchanged.'}
 put(AUX/'final-adjustment.json',record);print(json.dumps(record))
if __name__=='__main__':
 assert len(sys.argv)==2 and sys.argv[1] in ['derive','adjustment']
 globals()[sys.argv[1]]()
