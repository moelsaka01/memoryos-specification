from pathlib import Path
import json
ROOT=Path(__file__).resolve().parents[4]
OUT=ROOT/'repositories/cca-conformance/schema'
def obj(props):return {'type':'object','additionalProperties':False,'properties':props,'required':sorted(props)}
def arr(items):return {'type':'array','items':items,'maxItems':4096}
def string(pattern=None,maximum=4096):
 v={'type':'string','minLength':1,'maxLength':maximum}
 if pattern:v['pattern']=pattern
 return v
def enum(*items):return {'enum':list(items)}
digest=string('^sha256:[0-9a-f]{64}$',71);revision=string('^[0-9a-f]{40}$',40);identifier=string('^[A-Za-z0-9_.-]+$',128)
relative=string('^(?!/)(?!.*(?:^|/)\\.\\.(?:/|$))[A-Za-z0-9_./-]+$',240)
number={'type':'integer','minimum':0,'maximum':9007199254740991}
artifact=obj({'path':relative,'byteLength':number,'sha256':digest})
status=enum('PENDING','PASS','FAIL','NOT_EXECUTED','ENVIRONMENT_BLOCKED','FOUNDATION_IMPLEMENTED','NOT_IMPLEMENTED','REAL_EXECUTION_CERTIFIED','HOSTED_EXECUTION_CERTIFIED','CONTRACT_VALIDATED')
hosted=obj({'repository':string(maximum=201),'revision':revision,'runId':identifier,'attempt':number,'jobIds':arr(identifier)})
receipt=obj({
 'kind':{'const':'MemoryOSCICDConformanceReceipt'},'version':{'const':'1.0.0'},'id':identifier,
 'implementationRevision':revision,'harnessRevision':revision,'contractDigest':digest,'distributionDigest':digest,'runtimeClosureDigest':digest,
 'scope':obj({'provider':enum('generic','github','gitlab','jenkins','azure'),'platform':enum('windows-11-x64','windows-2022-x64'),'validationMode':enum('REAL_EXECUTION','HOSTED_EXECUTION','CONTRACT_VALIDATION','PACKAGE','SUPPLY_CHAIN','BINDING')}),
 'environment':obj({'os':string(),'osBuild':string(),'architecture':{'const':'x64'},'nodeVersion':{'const':'24.21.0'},'nodeSha256':digest,'hostedRun':{'oneOf':[{'type':'null'},hosted]}}),
 'cases':arr(obj({'id':identifier,'status':enum('PASS','FAIL','NOT_EXECUTED','HOST_INTERRUPTED','ENVIRONMENT_BLOCKED'),'command':arr(string()),'exitCode':{'oneOf':[number,{'type':'null'}]},'elapsedMs':number,'evidencePaths':arr(relative)})),
 'artifacts':arr(artifact),'reusedEvidence':arr(obj({'receiptId':identifier,'sha256':digest,'reason':string(),'unchangedArtifactDigests':arr(digest)})),
 'limitations':arr(string()),'status':enum('PASS','FAIL','INCOMPLETE')
})
inventory=obj({
 'kind':{'const':'MemoryOSCICDConformanceInventory'},'version':{'const':'1.0.0'},
 'contract':obj({'authorityRevision':revision,'freezeRevision':revision,'contractDigest':digest}),
 'implementation':obj({'revision':revision,'distributionDigest':digest,'runtimeClosureDigest':digest}),
 'categories':arr(obj({'id':identifier,'status':status,'requiredCaseIds':arr(identifier),'receiptIds':arr(identifier)})),
 'providers':arr(obj({'id':enum('generic','github','gitlab','jenkins','azure'),'status':status,'scope':string(),'receiptIds':arr(identifier)})),
 'platforms':arr(obj({'id':enum('windows-11-x64','windows-2022-x64'),'status':status,'scope':string(),'receiptIds':arr(identifier)})),
 'artifacts':arr(artifact),'receipts':arr(obj({'id':identifier,'path':relative,'sha256':digest})),
 'exclusions':arr(string()),'releaseState':enum('IN_PROGRESS','BLOCKED','READY_TO_TAG')
})
for name,schema in [('mo1306-receipt-1.0.0.json',receipt),('mo1306-inventory-1.0.0.json',inventory)]:
 schema={'$schema':'https://json-schema.org/draft/2020-12/schema','$id':'urn:memoryos:cicd:conformance:'+name,**schema}
 (OUT/name).write_bytes((json.dumps(schema,sort_keys=True,separators=(',',':'))+'\n').encode())
print('Two closed Draft 2020-12 engineering schemas materialized')
