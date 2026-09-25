"""Fresh, bounded Phase 3B-R structural, assembly and adversarial certificates."""
from pathlib import Path
import argparse,copy,gzip,hashlib,io,json,os,subprocess,sys,tarfile,uuid
sys.dont_write_bytecode=True
HERE=Path(__file__).resolve().parent;ROOT=HERE.parents[3]
sys.path.insert(0,str(HERE));import wrapper
sys.path.insert(0,str(ROOT/wrapper.TOOL_REL))
from distribution import PATHS,PKG_REL,verify_archive,verify_files,serialize_archive,identity,j,ref,toolchain,metadata
from schema_validation import verify_schema,field_inventory
from spdx import verify_spdx
E=ROOT/'repositories/cca-conformance/evidence/mo1305-phase3br';CACHE=ROOT/'.cache/mo1305-phase3br'
NODE=CACHE/'toolchain/node-v24.21.0-win-x64/node.exe';NPM=NODE.parent/'node_modules/npm/bin/npm-cli.js'
ARCHIVE=ROOT/'.cache/mo1305-phase3-correction/accepted-build/memoryos-rest-0.1.0.tgz'
SHA=wrapper.ARCHIVE['sha256']
def save(name,value):
    p=E/name;p.parent.mkdir(parents=True,exist_ok=True);p.write_bytes(j(value));return ref(p.relative_to(ROOT).as_posix(),p.read_bytes())
def run(argv,cwd=ROOT,env=None,timeout=60):
    r=subprocess.run([str(x) for x in argv],cwd=cwd,env=env,capture_output=True,timeout=timeout,creationflags=subprocess.CREATE_NO_WINDOW)
    if r.returncode:raise RuntimeError(r.stderr.decode(errors='replace')[:8000])
    return {'argv':[str(x).replace(str(ROOT),'$WORKSPACE') for x in argv],'exitCode':r.returncode,'stdout':r.stdout.decode(),'stderr':r.stderr.decode()}
def cheap():
    context=wrapper.validate_context();inventory=wrapper.check_validator_inventory()
    verified=verify_archive(ARCHIVE,SHA);assert verified['archive']==wrapper.ARCHIVE
    f=verified['files'];s=json.loads(f['sbom.spdx.json']);schema=verify_schema(s);fields=field_inventory(s);semantic=verify_spdx(s,f)
    node=toolchain(NODE,NPM)
    projection="""import assert from 'node:assert/strict';import {readFileSync} from 'node:fs';import {verifyContracts,expectedOpenAPI,verifyOpenAPI} from './repositories/memoryos-rest/scripts/verify-contracts.mjs';import {J} from './repositories/memoryos-rest/src/serialization.mjs';verifyContracts();const api=JSON.parse(readFileSync('repositories/memoryos-rest/contracts/api-contract.json'));assert.equal(api.deployment.defaultMode,'local');let v=expectedOpenAPI();assert.deepEqual(v['x-memoryos-http'].behavior.remoteMode,{mode:'remote',implemented:true,explicitOptIn:true,bindAddressPolicy:'assigned RFC1918 IPv4'});assert.ok(!readFileSync('repositories/memoryos-rest/contracts/openapi.json','utf8').includes('PHASE_2_PENDING'));v['x-memoryos-http'].behavior.remoteMode='PHASE_2_PENDING';assert.throws(()=>verifyOpenAPI(Buffer.from(J(v))),/OPENAPI_RUNTIME_DRIFT/);console.log('OpenAPI, local default, remote mode, contract consistency and stale negative PASS');"""
    api=run([NODE,'--input-type=module','-e',projection])
    # Shipped distribution verifier expects exactly the package, not source tests.
    stage=CACHE/('cheap-package-'+uuid.uuid4().hex);stage.mkdir(parents=True)
    for name,data in f.items():p=stage/name;p.parent.mkdir(parents=True,exist_ok=True);p.write_bytes(data)
    shipped=run([NODE,stage/'scripts/verify-distribution.mjs'],cwd=stage)
    correction=wrapper.validate()
    refs=[save('validator-inventory.json',inventory),save('schema-validation.json',schema),save('generated-fields.json',fields),save('spdx-semantics.json',semantic),save('package-inventory.json',{'files':verified['inventory'],'count':58,'archive':verified['archive']}),save('runtime-closure.json',{'files':[r for r in verified['inventory'] if r['path'].startswith('runtime/authoritative/')],'count':25}),save('refresh-wrapper.json',correction),save('openapi-validation.json',api),save('shipped-distribution-validation.json',shipped)]
    result={'kind':'MemoryOSRESTPhase3BRCheapStructuralGate','state':'PASS','context':context,'archive':verified['archive'],'schema':schema,'semantic':semantic,'generatedFields':'PASS','openapi':'PASS','staleRemoteModeNegative':'PASS','packageDistribution':'PASS','archiveIdentity':'PASS','correctionConformance':'PASS','wrapper':'PASS','evidence':refs}
    save('cheap-gate.json',result);return result

def require_current_cheap_gate():
    if sys.flags.optimize:raise ValueError('PYTHON_OPTIMIZATION_FORBIDDEN')
    wrapper.validate_context();wrapper.check_validator_inventory()
    gate=json.loads((E/'cheap-gate.json').read_bytes())
    if gate['state']!='PASS' or gate['archive']!=wrapper.ARCHIVE:raise ValueError('CHEAP_GATE_REQUIRED')
    for row in gate['evidence']:
        if ref(row['path'],(ROOT/row['path']).read_bytes())!=row:raise ValueError('CHEAP_GATE_EVIDENCE_DRIFT')

def reproduce():
    require_current_cheap_gate()
    tree=json.loads((ROOT/wrapper.ACCEPTED/'source-tree.json').read_bytes());assemblies=[]
    for label in ('clean-a','clean-b'):
        stage=CACHE/('assembly-'+label);assert not stage.exists(),'FRESH_ASSEMBLY_REQUIRED';stage.mkdir(parents=True)
        for row in tree['files']:
            data=(ROOT/row['path']).read_bytes();assert ref(row['path'],data)==row
            p=stage/row['path'];p.parent.mkdir(parents=True,exist_ok=True);p.write_bytes(data)
        command=[sys.executable,'-B','-X','utf8',stage/wrapper.TOOL_REL/'distribution.py','build','--root',stage,'--node',NODE,'--npm',NPM,'--output',stage/'output','--write-metadata']
        outcome=run(command,cwd=stage,env={**os.environ,'MO1305_SCHEMA_RUNTIME':str(ROOT/'.cache/mo1305-phase3-correction/schema-runtime')})
        archive=stage/'output/memoryos-rest-0.1.0.tgz';verified=verify_archive(archive,SHA);assert verified['archive']==wrapper.ARCHIVE
        assert (stage/'output/source-tree.json').read_bytes()==j(tree)
        assemblies.append({'root':stage.relative_to(ROOT).as_posix(),'archive':ref(archive.relative_to(ROOT).as_posix(),archive.read_bytes()),'command':outcome,'inventorySha256':hashlib.sha256(j(verified['inventory'])).hexdigest(),'sourceTree':identity(j(tree))})
    assert (ROOT/assemblies[0]['archive']['path']).read_bytes()==(ROOT/assemblies[1]['archive']['path']).read_bytes()==ARCHIVE.read_bytes()
    r={'kind':'MemoryOSRESTPhase3BRReproducibility','state':'PASS','freshIndependentCleanRoots':True,'separateBuilderProcesses':True,'byteForByteEqual':True,'historicalCacheCopiesExcluded':True,'assemblies':assemblies,'archive':wrapper.ARCHIVE};save('reproducibility.json',r);return r

def adversarial():
    require_current_cheap_gate()
    verified=verify_archive(ARCHIVE,SHA);files=verified['files'];cases=[];stage=CACHE/'adversarial';stage.mkdir(exist_ok=False)
    def reject(name,action,prefix):
        try:action()
        except (ValueError,AssertionError) as err:
            assert str(err).startswith(prefix),(name,str(err),prefix)
            cases.append({'name':name,'state':'PASS','expectedRejection':prefix,'actualRejection':str(err)[:1200]});return
        raise AssertionError('ACCEPTED_INVALID:'+name)
    def rebound(f):
        f=dict(f);m=json.loads(f['distribution-manifest.json']);m['files']=[ref(n,b) for n,b in sorted(f.items()) if n!='distribution-manifest.json'];f['distribution-manifest.json']=j(m);return f
    f=dict(files);f.pop('src/server.mjs');reject('missing file',lambda:verify_files(f),'EXACT_ALLOWLIST')
    f=dict(files);f['extra.txt']=b'extra';reject('extra file',lambda:verify_files(f),'EXACT_ALLOWLIST')
    mutations=[('modified runtime','src/server.mjs'),('modified contract','contracts/policy-contract-identities-1.0.0.json'),('modified schema','contracts/api-contract.json'),('modified OpenAPI','contracts/openapi.json'),('modified SBOM','sbom.spdx.json'),('modified FINAL limits','contracts/limits.json')]
    for name,path in mutations:
        f=dict(files);f[path]+=b' ';reject(name,lambda:verify_files(f),'MANIFEST_CONTENT')
    f=dict(files);m=json.loads(f['distribution-manifest.json']);m['files'][0]['sha256']='0'*64;f['distribution-manifest.json']=j(m);reject('modified manifest',lambda:verify_files(f),'MANIFEST_CONTENT')
    f=dict(files);f['runtime/authoritative/web/js/policy-canonical.js']=b'export default null;\n';f=rebound(f);reject('runtime substitution with rebound manifest',lambda:verify_files(f),'INTEGRATED_IMMUTABLE')
    badnode=stage/'node.exe';badnode.write_bytes(b'not a Node executable');reject('Node substitution rejected before execution',lambda:toolchain(badnode,NPM),'NODE_SUBSTITUTION')
    f=dict(files);p=json.loads(f['package.json']);p['dependencies']={'injected':'1.0.0'};f['package.json']=j(p);reject('dependency injection',lambda:metadata(f),'PACKAGE_DEPENDENCIES')
    f=dict(files);p=json.loads(f['package.json']);p['scripts']['postinstall']='node downloader.js';f['package.json']=j(p);reject('lifecycle downloader injection',lambda:metadata(f),'UNEXPECTED_SCRIPT')
    data=ARCHIVE.read_bytes()
    for label,mutated in [('archive truncation',data[:-8]),('archive corruption',data[:50]+bytes([data[50]^1])+data[51:])]:
        p=stage/(label.replace(' ','-')+'.tgz');p.write_bytes(mutated);reject(label,lambda:verify_archive(p,SHA),'ARCHIVE_IDENTITY')
    p=stage/'truncated-parser.tgz';p.write_bytes(data[:-8]);reject('truncated gzip parser with untrusted self-digest',lambda:verify_archive(p,hashlib.sha256(p.read_bytes()).hexdigest()),'GZIP_BOUND_END')
    f=dict(files);f['.git/config']=b'junk';reject('source checkout junk',lambda:verify_files(f),'EXACT_ALLOWLIST')
    f=dict(files);f['private-key.pem']=b'-----BEGIN PRIVATE KEY-----\n';reject('unsafe private-key content',lambda:verify_files(f),'EXACT_ALLOWLIST')
    raw=io.BytesIO()
    with tarfile.open(fileobj=raw,mode='w',format=tarfile.USTAR_FORMAT) as tar:
        member=tarfile.TarInfo('package/../escape');member.size=1;member.mode=0o644;tar.addfile(member,io.BytesIO(b'x'))
    out=io.BytesIO()
    with gzip.GzipFile(fileobj=out,mode='wb',filename='',mtime=0,compresslevel=9) as stream:stream.write(raw.getvalue())
    p=stage/'unsafe-path.tgz';p.write_bytes(out.getvalue());reject('unsafe archive path parser',lambda:verify_archive(p,hashlib.sha256(p.read_bytes()).hexdigest()),'PATH_SEGMENT')
    from metadata_test import run as metadata_tests
    metadata_result=metadata_tests(ARCHIVE);save('metadata-negatives.json',metadata_result)
    r={'kind':'MemoryOSRESTPhase3BRArtifactAdversarial','state':'PASS','archive':wrapper.ARCHIVE,'caseCount':len(cases),'cases':cases,'metadataCaseCount':metadata_result['caseCount'],'fourCorrectionRegressions':{'PHASE_2_PENDING':'openapi-validation.json','filesAnalyzedFalse':'metadata-negatives.json','documentComment':'metadata-negatives.json','licenseInfoInFile':'metadata-negatives.json'},'trustBoundary':'Trusted fixed archive digest plus independent content/parser checks; no attacker-controlled digest accepted as release authority'};save('adversarial.json',r);return r
if __name__=='__main__':
    p=argparse.ArgumentParser();p.add_argument('mode',choices=['cheap','reproduce','adversarial']);a=p.parse_args();r=globals()[a.mode]();print(json.dumps({'mode':a.mode,'state':r['state']}))
