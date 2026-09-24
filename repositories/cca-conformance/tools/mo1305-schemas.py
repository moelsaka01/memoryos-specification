"""Closed Phase 1 evidence schemas derived from frozen sections 13.1/13.2."""
from pathlib import Path
import json
ROOT=Path(__file__).resolve().parents[3]
OUT=ROOT/'repositories/cca-conformance/schema'

def obj(properties):return {'type':'object','additionalProperties':False,'properties':properties,'required':list(properties)}
def arr(items,maximum=256,minimum=0):return {'type':'array','items':items,'minItems':minimum,'maxItems':maximum}
def text(maximum=1024,pattern=None):
 result={'type':'string','maxLength':maximum}
 if pattern:result['pattern']=pattern
 return result
def integer(maximum=9007199254740991,minimum=0):return {'type':'integer','minimum':minimum,'maximum':maximum}
def const(value):return {'const':value}
def enum(*values):return {'enum':list(values)}
def nullable(schema):return {'anyOf':[schema,{'type':'null'}]}
def ref(name):return {'$ref':'#/$defs/'+name}
def output(name,defs):
 OUT.mkdir(exist_ok=True);(OUT/name).write_text(json.dumps({'$schema':'https://json-schema.org/draft/2020-12/schema','$id':'urn:memoryos:rest:'+name,'$defs':defs},ensure_ascii=False,sort_keys=True,separators=(',',':')),encoding='utf-8')
A='d15b578dd757e928273d4548348b085e58ed5df5';F='ce1780e2dac0afe31aeb947f0a7f78b953e17f6b';C='c2e3835b852fd966046ac9e984538fdcaf8b26bf';V='75cee55784c590bab52feaf8f2214e4d1b9e657f'
sha=text(64,'^[0-9a-f]{64}$');revision=text(40,'^[0-9a-f]{40}$');state=enum('PASS','FAIL','BLOCKED','NOT_EXECUTED')
artifact=obj({'path':text(240,'^[A-Za-z0-9_.\\/-]+$'),'byteLength':integer(67108864),'sha256':sha})
platform=obj({'target':const('windows-11-x64'),'osName':text(128),'osEdition':text(128),'osRelease':text(128),'osVersion':text(128),'osBuild':text(128),'kernel':const(None),'architecture':const('x64')})
projection=obj({'state':state,'caseCount':integer(100000),'coldSamples':integer(100000),'warmSamples':integer(100000),'adverseRepetitions':integer(100000),'failures':integer(100000)})
result=obj({'id':text(96,'^[ -~]{1,96}$'),'state':state,'expected':projection,'actual':projection,'artifactRefs':arr(ref('Artifact'),256)})
metrics=['workerYoungBytes','workerOldBytes','workerExternalBytes','parentHeapBytes','parentExternalBytes','processRssBytes','operationUs','parentHeapDeltaBytes','parentExternalDeltaBytes']
operations=['evaluatePolicy','getContractIdentities','getHealth','getReadiness','getVersion','preparePolicy','preparePolicySet','verifyEvaluationIdentity','verifyPolicyOutcome']
maxima=obj({**{k:integer() for k in metrics},'operations':obj({k:obj({'requestBytes':integer(),'responseBytes':integer()}) for k in operations}),'earlyErrorBytes':integer()})
derivation=obj({'formulaVersion':const('1.0.0'),'methodologyVersion':const('2.0.0'),'selection':ref('Artifact'),'memoryNumerator':const(3),'memoryDenominator':const(2),'wireNumerator':const(5),'wireDenominator':const(4),'deadlineMultiplier':const(4),'memoryRoundingBytes':const(1048576),'wireRoundingBytes':const(1024),'deadlineRoundingMs':const(100),'analyticalBounds':ref('Artifact'),'campaign':ref('Artifact'),'adverse':ref('Artifact'),'measuredSourceTree':ref('Artifact'),'measuredDistribution':ref('Artifact'),'preliminaryLimits':ref('Artifact'),'finalAdjustment':ref('Artifact')})
payloads={
 'resource':obj({'samples':arr(ref('Artifact')),'maxima':maxima,'derivation':derivation,'limits':ref('Artifact'),'boundaries':arr(ref('Artifact'))}),
 'package':obj({'archive':ref('Artifact'),'distributionManifest':ref('Artifact'),'builds':arr(obj({'treeSha256':sha,'archiveSha256':sha}),2,2),'installation':ref('Artifact'),'dependencyReview':ref('Artifact')}),
 'http':obj({'clients':arr(obj({'name':enum('node-fetch','curl'),'cases':ref('Artifact')}),2,2),'local':ref('Artifact'),'remote':obj({'state':const('PENDING'),'receipt':const(None)}),'framing':ref('Artifact')}),
 'security':obj({'adversarial':arr(ref('Artifact')),'networkDenial':obj({'mechanism':text(),'coverage':ref('Artifact'),'osNetworkDenial':const('NOT_CLAIMED')}),'advisories':ref('Artifact')}),
 'functional':obj({'campaign':ref('Artifact'),'validation':ref('Artifact')}),
 'boundary':obj({'records':arr(ref('Artifact'))}),
 'stress':obj({'functional':ref('Artifact'),'measured':ref('Artifact'),'confirmation':ref('Artifact'),'selection':ref('Artifact')}),
 'parity':obj({'cases':ref('Artifact')}),
 'installation':obj({'installation':ref('Artifact')}),
 'supplyChain':obj({'review':ref('Artifact')}),
 'platform':obj({k:ref('Artifact') for k in ['resource','package','http','security','semanticVectors']}),
 'finalBinding':obj({'validatedEvidenceRevision':revision,'inventory':ref('Artifact'),'receipts':arr(ref('Artifact')),'graph':ref('Artifact'),'validation':ref('Artifact')})}
shared={'kind':const('MemoryOSRESTReceipt'),'version':const('2.0.0'),'state':state,'authorityRevision':const(A),'contractFreezeRevision':const(F),'platformCorrectionRevision':const(C),'verificationCorrectionRevision':const(V),'implementationRevision':nullable(revision),'bindingRevision':nullable(revision),'sourceTreeSha256':sha,'harness':ref('Artifact'),'artifacts':arr(ref('Artifact')),'platform':platform,'toolchain':arr(obj({'name':text(128,'^[ -~]{1,128}$'),'version':text(128,'^[ -~]{1,128}$'),'sha256':sha}),32,1),'catalog':ref('Artifact'),'results':arr(result,10000)}
output('mo1305-receipt-2.0.0.json',{'Artifact':artifact,'Receipt':{'oneOf':[obj({**shared,'type':const(kind),'payload':payload}) for kind,payload in payloads.items()]}})
policy=obj({'supported':const(['windows-11-x64']),'measurement':const(['windows-11-x64']),'ubuntu':const('NOT_REQUIRED'),'linux':const('NOT_REQUIRED'),'vm':const('NOT_REQUIRED'),'crossPlatformParity':const('NOT_REQUIRED'),'semanticParity':const('REQUIRED')})
inventory=obj({'kind':const('MemoryOSRESTConformanceInventory'),'version':const('2.0.0'),'state':enum('PHASE1_PENDING','PHASE1_BOUND','PHASE2_PENDING','PHASE2_BOUND','CERTIFICATION_PENDING','CERTIFIED_READY_TO_TAG','BLOCKED'),'authorityRevision':const(A),'contractFreezeRevision':const(F),'platformCorrectionRevision':const(C),'verificationCorrectionRevision':const(V),'implementations':obj({k:nullable(revision) for k in ['I1','B1','I2','B2','I3']}),'package':nullable(obj({'name':const('memoryos-rest'),'version':const('0.1.0'),'archive':ref('Artifact'),'distributionManifest':ref('Artifact'),'sourceTreeSha256':sha})),'contracts':obj({k:nullable(ref('Artifact')) for k in ['apiSchema','openapi','limits','policyIdentities']}),'runtime':nullable(obj({'closure':ref('Artifact'),'sdkVersion':const('1.1.0'),'nodeVersion':const('24.21.0'),'nodeExecutables':arr(obj({'target':const('windows-11-x64'),'sha256':const('ba4e6d110e8c1592a1ecd390f6b05f3da124b13871a5be62b341a07a853c6c32')}),1,1)})),'dependencies':nullable(obj({'directCount':const(0),'transitiveCount':const(0),'developmentCount':const(0),**{k:ref('Artifact') for k in ['lockfile','manifest','sbom','notices','review']}})),'receipts':obj({k:arr(ref('Artifact'),64) for k in ['resource','package','http','security','functional','boundary','stress','parity','installation','supplyChain','platform']}),'platforms':arr(obj({'target':const('windows-11-x64'),'state':state,'receipt':nullable(ref('Artifact'))}),1,1),'platformPolicy':policy,'finalBinding':obj({'state':enum('PENDING','VALIDATED'),'validatedEvidenceRevision':nullable(revision),'receipt':nullable(ref('Artifact'))}),'releaseTag':obj({'name':const('memoryos-1.3-mo1305'),'state':enum('NOT_READY','READY_TO_TAG'),'targetRole':const('finalConformanceBinding')}),'blockers':arr(text(96,'^[A-Z0-9_-]{1,96}$'),64)})
output('mo1305-inventory-2.0.0.json',{'Artifact':artifact,'Inventory':inventory})
print('Closed receipt and inventory schemas generated')
