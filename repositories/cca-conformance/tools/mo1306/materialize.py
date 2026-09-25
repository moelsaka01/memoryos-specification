"""Materialize Phase 1 schemas and exact released closure; no dependency resolution.

Run from the workspace. This engineering builder never edits predecessor files.
"""
import hashlib
import json
import re
from pathlib import Path

ROOT = Path(__file__).resolve().parents[4]
PKG = ROOT / 'repositories/memoryos-ci'
FREEZE = ROOT / 'docs/mo1306-contract-freeze-1.md'

def j(value):
    return (json.dumps(value, sort_keys=True, separators=(',', ':'), ensure_ascii=False) + '\n').encode()

def sha(data):
    return 'sha256:' + hashlib.sha256(data).hexdigest()

def put(path, value):
    target = PKG / path
    target.parent.mkdir(parents=True, exist_ok=True)
    target.write_bytes(j(value))

def obj(properties, optional=()):
    return dict(type='object', properties=properties, required=sorted(set(properties)-set(optional)), additionalProperties=False)

def const(value): return {'const': value}
def enum(*values): return {'enum': list(values)}
def integer(low=0, high=9007199254740991): return dict(type='integer', minimum=low, maximum=high)
def string(maximum, pattern=None, minimum=1):
    result = dict(type='string', minLength=minimum, maxLength=maximum)
    if pattern: result['pattern'] = pattern
    return result
def nullable(schema): return {'oneOf': [schema, {'type': 'null'}]}
def array(schema, maximum, minimum=0): return dict(type='array', items=schema, minItems=minimum, maxItems=maximum)
def ref(name): return {'$ref': '#/$defs/' + name}
def base(kind, properties, optional=()): return obj({'kind':const('MemoryOSCICD'+kind), 'version':const('1.0.0'), **properties}, optional)

def main():
    freeze = FREEZE.read_text(encoding='utf-8')
    errors = json.loads(re.search(r'```json\n(\{\n  "kind": "MemoryOSCICDErrorCatalog".*?\n\})\n```', freeze, re.S)[1])
    put('contracts/errors.json', errors)
    fixed_text = re.search(r'```text\n(configBytes:.*?)\n```', freeze, re.S)[1]
    fixed = {name:int(value) for name,value in re.findall(r'(\w+):(\d+)', fixed_text)}
    limits_path=PKG/'contracts/limits.json'
    limits=json.loads(limits_path.read_bytes()) if limits_path.exists() else dict(kind='MemoryOSCICDResourceLimits',version='1.0.0',state='PRELIMINARY',fixed=fixed,engineering={'aggregateRssMiB':768})
    assert limits['fixed']==fixed
    put('contracts/limits.json', limits)
    classes = ['PASS','FAIL','COULD_NOT_EVALUATE','CONFIGURATION_ERROR','INPUT_ERROR','SEMANTIC_ERROR','TIMEOUT','CANCELLED','INTEGRITY_ERROR','INTERNAL_ERROR','ARTIFACT_ERROR']
    exits=[0,6,7,10,11,12,13,14,15,16,17]
    pclasses=['SUCCESS','POLICY_FAIL','NOT_EVALUATED','ADAPTER_ERROR','ADAPTER_ERROR','ADAPTER_ERROR','TIMEOUT','CANCELLED','ADAPTER_ERROR','ADAPTER_ERROR','ADAPTER_ERROR']
    projections={name:dict(exitCode=exit_code,projection={'class':pc,'jobStatus':'SUCCESS' if name=='PASS' else 'CANCELLED' if name=='CANCELLED' else 'FAILURE'}) for name,exit_code,pc in zip(classes,exits,pclasses)}
    put('contracts/projection.json',dict(kind='MemoryOSCICDProjection',version='1.0.0',classifications=projections))
    providers=['generic','github','gitlab','jenkins','azure']
    classifications={'provider':'OPERATIONAL','repository':'OPERATIONAL','revision':'OPERATIONAL','ref':'DIAGNOSTIC','pipeline/run ID':'OPERATIONAL','job ID':'OPERATIONAL','attempt':'OPERATIONAL','event type':'OPERATIONAL','actor':'DIAGNOSTIC','pull/merge request identity':'OPERATIONAL','workspace path':'FORBIDDEN','runner identity':'DIAGNOSTIC','timestamp':'DIAGNOSTIC','provider URL':'FORBIDDEN'}
    put('contracts/metadata.json',dict(kind='MemoryOSCICDMetadata',version='1.0.0',classifications=classifications))
    defs={
        'Digest':string(71,r'^sha256:[0-9a-f]{64}$'),
        'Revision':string(40,r'^[0-9a-f]{40}$'),
        'RunId':string(36,r'^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$'),
        'Provider':enum(*providers), 'Classification':enum(*classes),
        'RelativeFile':string(240,r'^[A-Za-z0-9_. -]+(?:/[A-Za-z0-9_. -]+)*$'),
        'Label':string(64,r'^[A-Za-z0-9_-]+$'),
        'RepositorySlug':string(201,r'^[A-Za-z0-9_-][A-Za-z0-9_.-]{0,99}/[A-Za-z0-9_-][A-Za-z0-9_.-]{0,99}$'),
        'Projection':obj({'class':enum(*sorted(set(pclasses))),'jobStatus':enum('SUCCESS','FAILURE','CANCELLED')}),
        'Error':obj({'code':enum(*errors['errors']),'stage':enum(*sorted({v[2] for v in errors['errors'].values()})),'semanticCode':nullable(string(128,r'^[A-Z][A-Z0-9_]*$'))}),
        'Semantic':obj({'artifactKind':enum('policy','policySet'),'documentDigest':ref('Digest'),'semanticDigest':ref('Digest'),'decision':enum('PASS','FAIL','COULD_NOT_EVALUATE'),'evaluationIdentityDigest':ref('Digest'),'outcomeDigest':ref('Digest')}),
        'Metadata':obj({'provider':ref('Provider'),'repository':nullable(string(256,r'^[A-Za-z0-9_./:@-]+$')),'revision':nullable(ref('Revision')),'runId':nullable(string(128,r'^[A-Za-z0-9_./:@-]+$')),'jobId':nullable(string(128,r'^[A-Za-z0-9_./:@-]+$')),'attempt':nullable(integer(1,1000)),'event':nullable(string(64,r'^[A-Za-z0-9_./:@-]+$')),'changeRequest':nullable(string(20,r'^[0-9]+$'))}),
        'InputDescriptor':obj({'role':enum('policy','policySet','candidateMip','baselineMip'),'byteLength':integer(0,524288),'sha256':ref('Digest')}),
        'File':obj({'path':ref('RelativeFile'),'byteLength':integer(),'sha256':ref('Digest')}),
    }
    selected=obj({'path':ref('RelativeFile'),'expectedSemanticDigest':ref('Digest')})
    config_common={'context':obj({'candidateMip':ref('RelativeFile'),'baselineMip':ref('RelativeFile')},['baselineMip']),'output':obj({'directory':const('.memoryos-ci/out')}),'timeoutMs':integer(1000,60000),'providerExtensions':obj({})}
    defs['Configuration']={'oneOf':[base('Configuration',{'operation':const(op),key:selected,**config_common},['timeoutMs','providerExtensions']) for op,key in [('evaluatePolicy','policy'),('evaluatePolicySet','policySet')]]}
    normalized=json.loads(json.dumps(defs['Configuration']))
    for variant in normalized['oneOf']:
        variant['required']=sorted(variant['properties'])
    defs['NormalizedConfiguration']=normalized
    options={'generic':obj({}),'gitlab':obj({'runnerTag':ref('Label')}),'jenkins':obj({'agentLabel':ref('Label')}),'azure':obj({'pool':ref('Label')}),'github':obj({'repository':ref('RepositorySlug'),'toolRevision':ref('Revision'),'configPath':ref('RelativeFile')})}
    defs['Deployment']={'oneOf':[base('Deployment',{'provider':const(p),'distributionDigest':ref('Digest'),'options':options[p]}) for p in providers]}
    def b64(maximum): return {**string(4*((maximum+2)//3),r'^(?:[A-Za-z0-9+/]{4})*(?:[A-Za-z0-9+/]{2}==|[A-Za-z0-9+/]{3}=)?$',0),'x-memoryos-base64-max-bytes':maximum}
    defs['Invocation']=base('Invocation',{'runId':ref('RunId'),'provider':ref('Provider'),'configuration':ref('NormalizedConfiguration'),'configurationDigest':ref('Digest'),'inputs':obj({'policy':nullable(b64(2048)),'policySet':nullable(b64(4096)),'candidateMip':b64(524288),'baselineMip':nullable(b64(524288))}),'metadata':ref('Metadata'),'identities':obj({k:ref('Digest') for k in ['contractDigest','limitsDigest','distributionDigest','adapterDigest','runtimeClosureDigest','nodeDigest']})})
    defs['Result']=base('Result',{'runId':ref('RunId'),'provider':ref('Provider'),'classification':ref('Classification'),'semantic':nullable(ref('Semantic')),'error':nullable(ref('Error')),'process':obj({'exitCode':enum(*exits),'termination':enum('NORMAL','TIMEOUT','CANCELLED','ABNORMAL')}),'projection':ref('Projection'),'configurationDigest':nullable(ref('Digest')),'inputDigest':nullable(ref('Digest')),'contractDigest':ref('Digest'),'limitsDigest':ref('Digest'),'adapterDigest':ref('Digest')})
    defs['Evidence']=base('Evidence',{'runId':ref('RunId'),'contract':obj({'id':const('memoryos.cicd'),'version':const('1.0.0'),'sha256':ref('Digest'),'limitsSha256':ref('Digest')}),'configurationSha256':nullable(ref('Digest')),'adapter':obj({'id':enum(*['memoryos.cicd.adapter.'+p for p in providers]),'version':const('1.0.0'),'sha256':ref('Digest')}),'distributionSha256':ref('Digest'),'runtimeClosureSha256':ref('Digest'),'semanticContractSha256':ref('Digest'),'inputs':array(ref('InputDescriptor'),3),'runtime':obj({'nodeVersion':const('24.21.0'),'nodeSha256':ref('Digest'),'platform':const('win32'),'architecture':const('x64'),'osRelease':string(64,r'^[ -~]+$')}),'metadata':ref('Metadata'),'resultSha256':ref('Digest'),'projectionSha256':ref('Digest')})
    defs['Artifacts']=base('Artifacts',{'runId':ref('RunId'),'files':array(ref('File'),4,2)})
    defs['Complete']=base('Complete',{'runId':ref('RunId'),'manifestSha256':ref('Digest')})
    defs['Generation']=base('Generation',{'generator':obj({'id':const('memoryos.cicd.generator'),'version':const('1.0.0'),'sha256':ref('Digest')}),'configurationSha256':ref('Digest'),'deploymentSha256':ref('Digest'),'provider':ref('Provider'),'files':array(ref('File'),2,1)})
    defs['Summary']=base('Summary',{'runId':ref('RunId'),'classification':ref('Classification'),'exitCode':enum(*exits),'resultSha256':nullable(ref('Digest')),'publication':enum('COMPLETE','NONE')})
    defs['WorkerRequest']=base('WorkerRequest',{'runId':ref('RunId'),'operation':enum('evaluatePolicy','evaluatePolicySet'),'expectedSemanticDigest':ref('Digest'),'policyBase64':nullable(b64(2048)),'policySetBase64':nullable(b64(4096)),'candidateMipBase64':b64(524288),'baselineMipBase64':nullable(b64(524288))})
    worker_semantic=obj({**defs['Semantic']['properties'],'evaluationIdentityBase64':b64(4060),'outcomeBase64':b64(4060)})
    defs['WorkerResponse']=base('WorkerResponse',{'runId':ref('RunId'),'semantic':nullable(worker_semantic),'error':nullable(ref('Error'))})
    for name in ['Configuration','Deployment','Invocation','Result','Evidence','Artifacts','Complete','Generation','Summary','WorkerRequest','WorkerResponse']:
        # Include only reachable definitions, keeping schema inventories bounded.
        reachable={}
        def collect(schema):
            if isinstance(schema,dict):
                if '$ref' in schema:
                    key=schema['$ref'].split('/')[-1]
                    if key not in reachable:
                        reachable[key]=defs[key]; collect(defs[key])
                for value in schema.values(): collect(value)
            elif isinstance(schema,list):
                for value in schema: collect(value)
        collect(ref(name))
        filename=re.sub(r'(?<!^)(?=[A-Z])','-',name).lower()+'-1.0.0.schema.json'
        put('schemas/'+filename,{'$schema':'https://json-schema.org/draft/2020-12/schema','$id':'urn:memoryos:cicd:'+name+':1.0.0','$ref':'#/$defs/'+name,'$defs':reachable})
    closure=json.loads((ROOT/'repositories/memoryos-rest/runtime/runtime-closure-manifest.json').read_bytes())
    for row in closure['files']:
        data=(ROOT/row['source']).read_bytes()
        assert len(data)==row['byteLength'] and hashlib.sha256(data).hexdigest()==row['sha256']
        target=PKG/'runtime'/row['path']; target.parent.mkdir(parents=True,exist_ok=True);target.write_bytes(data)
    closure['kind']='MemoryOSCICDRuntimeClosureManifest'
    put('runtime/runtime-closure-manifest.json',closure)
    identity=(ROOT/'repositories/memoryos-rest/contracts/policy-contract-identities-1.0.0.json').read_bytes()
    assert len(identity)==933 and hashlib.sha256(identity).hexdigest()=='d81c0b8aece4a106324131d4d356c7d0aac0e8618fac080c6b8b5e3a2381ee65'
    (PKG/'contracts/policy-contract-identities-1.0.0.json').write_bytes(identity)
    package=dict(name='memoryos-ci',version='0.1.0',private=True,type='module',description='Provider-neutral offline MemoryOS CI foundation',engines={'node':'24.21.0'},packageManager='npm@11.19.0',bin={'memoryos-ci':'bin/memoryos-ci.mjs'},files=['bin','src','schemas','contracts','runtime','scripts','distribution-manifest.json','sbom.spdx.json','README.md','NOTICES.md','LICENSE-NOTICE.md','notices'])
    put('package.json',package)
    put('package-lock.json',dict(name='memoryos-ci',version='0.1.0',lockfileVersion=3,requires=True,packages={'':{'name':'memoryos-ci','version':'0.1.0','bin':package['bin'],'engines':package['engines']}}))
    print(json.dumps({'schemas':11,'closureFiles':len(closure['files']),'errors':len(errors['errors']),'limits':len(fixed)}))

if __name__=='__main__': main()
