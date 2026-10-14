"""Reproducible offline suites and content-bound, fail-closed acceptance gate."""
import io,json,os,re,socket,subprocess,sys,tempfile,time,unittest
from pathlib import Path
from datetime import datetime,timezone
from prepare import ROOT,CACHE,EVIDENCE,j,sha,row
TOOLS=Path(__file__).parent
sys.path[:0]=[str(TOOLS),str(ROOT/'.cache/mo1306/validators')]
def denied(*args,**kwargs): raise RuntimeError('Offline validation forbids network')
class OfflineSocket(socket.socket):
    def __new__(cls,*args,**kwargs): denied()
socket.socket=OfflineSocket
socket.create_connection=socket.getaddrinfo=denied
STATE=json.loads((CACHE/'active-stage.json').read_bytes())
NODE=STATE['nodePath']
ATTEMPT=Path(tempfile.mkdtemp(prefix='validation-',dir=CACHE))
def command(name,args,count=None):
    started=time.perf_counter()
    result=subprocess.run(list(map(str,args)),cwd=ROOT,capture_output=True,timeout=300,
                          creationflags=subprocess.CREATE_NO_WINDOW)
    stdout=result.stdout.decode('utf8',errors='strict');stderr=result.stderr.decode('utf8',errors='strict')
    (ATTEMPT/(name+'.stdout.txt')).write_bytes(result.stdout)
    (ATTEMPT/(name+'.stderr.txt')).write_bytes(result.stderr)
    (EVIDENCE/(name+'.stdout.txt')).write_bytes(result.stdout)
    (EVIDENCE/(name+'.stderr.txt')).write_bytes(result.stderr)
    assert result.returncode==0,(name,result.returncode,stdout,stderr)
    if count:
        for key,value in [('tests',count),('pass',count),('fail',0),('skipped',0)]:
            assert re.search(r'# '+key+r' '+str(value)+r'\b',stdout),(name,key,value)
    print(name,'PASS',flush=True)
    return dict(id=name,command=list(map(str,args)),exitCode=result.returncode,status='PASS',
                tests=count,elapsedMs=round((time.perf_counter()-started)*1000))
def suites():
    records=[]
    for name,file,count in [('current-contract','mo1306/contracts.test.mjs',152),
                            ('historical-B1','mo1306-phase2b/history.test.mjs',3),
                            ('adapters','mo1306-phase2b/adapters.test.mjs',466),
                            ('launcher','mo1306-phase2b/launcher.test.mjs',None)]:
        if name=='launcher' and not (TOOLS/'launcher.test.mjs').exists(): continue
        args=[NODE,'--import',(TOOLS/'offline-preload.mjs').as_uri(),'--test','--test-reporter=tap',TOOLS.parent/file]
        record=command(name,args,count)
        if name=='launcher':
            text=(EVIDENCE/'launcher.stdout.txt').read_text()
            count=int(re.search(r'# tests (\d+)',text)[1])
            assert f'# pass {count}' in text and '# fail 0' in text and '# skipped 0' in text
            record['tests']=count
        records.append(record)
    for name,count in [('test_gitlab',91),('test_jenkins',110)]:
        suite=unittest.defaultTestLoader.loadTestsFromName(name)
        stream=io.StringIO()
        result=unittest.TextTestRunner(stream=stream,verbosity=2).run(suite)
        (EVIDENCE/(name+'.txt')).write_text(stream.getvalue(),encoding='utf8',newline='\n')
        assert result.wasSuccessful() and result.testsRun==count and not result.skipped
        records.append(dict(id=name,status='PASS',tests=count,failed=0,skipped=0))
        print(name,count,'PASS',flush=True)
    import test_gitlab as gl,test_jenkins as jk
    gitlab=[]
    for case in json.loads(gl.CORPUS.read_bytes())['cases']:
        data=gl.mutate(gl.GOLDEN.read_bytes(),case)
        try: gl.validate_gitlab(data,gl.LABEL,gl.CONFIG,gl.DISTRIBUTION)
        except gl.GitLabValidationError as error:
            gitlab.append(dict(id=case['id'],category=case['category'],status='PASS',
                               diagnostic=str(error),byteLength=len(data),sha256=sha(data)))
        else: raise AssertionError('Accepted GitLab negative '+case['id'])
    (EVIDENCE/'gitlab-negatives.json').write_bytes(j(dict(status='PASS',count=len(gitlab),cases=gitlab)))
    (EVIDENCE/'jenkins-parser.json').write_bytes(j(jk.report()))
    records.append(command('generated',[NODE,'--import',(TOOLS/'offline-preload.mjs').as_uri(),TOOLS/'generate-fixtures.mjs',ROOT,STATE['stage']]))
    records.append(schema_gate())
    records.append(command('workspace',[sys.executable,'-B','-X','utf8',ROOT/'tools/verify_workspace.py','--root',ROOT]))
    records.append(command('evidence-negative',[sys.executable,'-B',TOOLS/'verify-evidence.py','--self-test']))
    records.append(command('whitespace',['git','diff','--check']))
    (EVIDENCE/'suites.json').write_bytes(j(dict(status='PASS',stageDigest=STATE['distributionDigest'],
        offline='Python socket/DNS denial and fixed Node network-denial preload; local installed dependencies only',
        records=records)))
def schema_gate():
    from jsonschema import Draft202012Validator
    from referencing import Registry
    from referencing.exceptions import NoSuchResource
    def no_retrieval(uri): raise NoSuchResource(ref=uri)
    validators={}
    for name in ('result','evidence','artifacts','complete','summary','configuration','deployment','generation'):
        schema=json.loads((Path(STATE['stage'])/'schemas'/(name+'-1.0.0.schema.json')).read_bytes())
        assert schema['$schema']=='https://json-schema.org/draft/2020-12/schema'
        def refs(value):
            if isinstance(value,dict):
                if '$ref' in value: assert value['$ref'].startswith('#/')
                for member in value.values(): refs(member)
            elif isinstance(value,list):
                for member in value: refs(member)
        refs(schema)
        Draft202012Validator.check_schema(schema)
        validators[name]=Draft202012Validator(schema,registry=Registry(retrieve=no_retrieval))
    instances=[]
    for provider in ('gitlab','jenkins'):
        for name,filename in [('configuration','memoryos-ci.json'),('deployment','deployment.json'),('generation','memoryos-ci-generation.json')]:
            path=EVIDENCE/'generated'/provider/filename
            instances.append((name,path.relative_to(ROOT).as_posix(),json.loads(path.read_bytes())))
    execution=json.loads((EVIDENCE/'execution.json').read_bytes())
    assert execution['status']=='PASS' and execution['stageDigest']==STATE['distributionDigest']
    for case in execution['cases']:
        if case['summary'] is not None:
            instances.append(('summary',case['id'],case['summary']))
    for filename,name in [('memoryos-ci-result.json','result'),('memoryos-ci-evidence.json','evidence'),
                          ('memoryos-ci-artifacts.json','artifacts'),('memoryos-ci-complete.json','complete')]:
        for path in (EVIDENCE/'bundles').rglob(filename):
            instances.append((name,path.relative_to(ROOT).as_posix(),json.loads(path.read_bytes())))
    negatives=set()
    for name,source,value in instances:
        validators[name].validate(value)
        if name not in negatives:
            assert not validators[name].is_valid({**value,'unexpected':'SECRET-SENTINEL'})
            negatives.add(name)
    assert len(instances)==116 and len(negatives)==8,(len(instances),len(negatives))
    report=dict(id='full-2020-12',status='PASS',instances=len(instances),negativeControls=len(negatives),
                engine='jsonschema 4.26.0 Draft202012Validator',references='local-only; empty registry with denial callback',
                validated=[dict(schema=name,source=source,sha256=sha(j(value))) for name,source,value in instances])
    (EVIDENCE/'json-schema.json').write_bytes(j(report))
    print('full-2020-12 116 instances + 8 rejection controls PASS',flush=True)
    return {k:v for k,v in report.items() if k!='validated'}
def finalize():
    started=datetime.fromisoformat('2026-09-26T09:36:52+00:00')
    now=datetime.now(timezone.utc)
    elapsed=(now-started).total_seconds()
    assert 0<=elapsed<=5400,'90-minute continuation budget exhausted'
    reports={key:json.loads((EVIDENCE/(key+'.json')).read_bytes()) for key in ('suites','execution','cli-generation')}
    assert all(report['status']=='PASS' for report in reports.values())
    assert reports['suites']['stageDigest']==STATE['distributionDigest']
    assert reports['execution']['stageDigest']==STATE['distributionDigest']
    assert reports['execution']['caseCount']==26 and reports['execution']['commandCount']==78
    assert reports['cli-generation']['stageDistributionDigest']==STATE['distributionDigest']
    assert reports['cli-generation']['caseCount']==17
    assert all(case['status']=='PASS' for case in reports['execution']['cases'])
    assert all(case['status']=='PASS' for case in reports['cli-generation']['cases'])
    assert any(r['id']=='launcher' and r['tests']>0 for r in reports['suites']['records'])
    # Check all staged source bytes against the present engineering tree.
    for entry in STATE['sourceFiles']:
        data=(ROOT/'repositories/memoryos-ci'/entry['path']).read_bytes()
        assert len(data)==entry['byteLength'] and sha(data)==entry['sha256'],entry['path']
    generated=json.loads((EVIDENCE/'generated.stdout.txt').read_bytes())
    assert generated['identities']['distributionDigest']==STATE['distributionDigest']
    for provider in ('gitlab','jenkins'):
        primary='.gitlab-ci.yml' if provider=='gitlab' else 'Jenkinsfile'
        record=next(item for item in reports['cli-generation']['providers'] if item['provider']==provider)
        for entry in record['artifactRows']:
            data=(EVIDENCE/'generated'/provider/entry['path']).read_bytes()
            assert len(data)==entry['byteLength'] and sha(data)==entry['sha256']
        assert primary in [entry['path'] for entry in record['artifactRows']]
    def git(*args):
        result=subprocess.run(['git',*args],cwd=ROOT,capture_output=True,check=True)
        return result.stdout
    head=git('rev-parse','HEAD').decode().strip()
    assert head=='1d43584cef532ebcdf1e87b0cba277d2d7180a63'
    assert git('rev-parse','--abbrev-ref','HEAD').decode().strip()=='mo1306/phase2b'
    assert git('rev-parse','HEAD^').decode().strip()=='dbafc0061aa493da2517ee5564f9ea6adb90f52d'
    preserved=['distribution-manifest.json','contracts/contract.json','package.json','package-lock.json','sbom.spdx.json']
    manifests=[]
    for name in preserved:
        rel='repositories/memoryos-ci/'+name
        assert (ROOT/rel).is_file(),rel
        data=(ROOT/rel).read_bytes()
        assert data==git('show','HEAD:'+rel),rel
        manifests.append(row(rel,data))
    roots=[ROOT/'repositories/cca-conformance/tools/mo1306-phase2b',
           ROOT/'repositories/cca-conformance/fixtures/mo1306/phase2b',
           EVIDENCE,ROOT/'repositories/memoryos-ci']
    paths={p for directory in roots for p in directory.rglob('*') if p.is_file()
           and '__pycache__' not in p.parts and p.name not in ('acceptance.json','content-manifest.json')}
    paths.update([ROOT/'docs/mo1306-phase2b-validation.md',ROOT/'repositories/cca-conformance/tools/mo1306/contracts.test.mjs',
                  ROOT/'repositories/cca-conformance/fixtures/mo1306/gitlab-ci-schema-a725331f22234d3078d7300944b9454da103e73c.json'])
    manifest=dict(kind='MemoryOSPhase2BContentManifest',version='1.0.0',
                  files=[row(p.relative_to(ROOT).as_posix(),p.read_bytes()) for p in sorted(paths,key=lambda p:p.relative_to(ROOT).as_posix())])
    (EVIDENCE/'content-manifest.json').write_bytes(j(manifest))
    acceptance=dict(kind='MemoryOSPhase2BAcceptance',version='1.0.0',status='PASS',
       baseline='dbafc0061aa493da2517ee5564f9ea6adb90f52d',implementationRevision=head,
       intendedCompletionParent=head,stageDigest=STATE['distributionDigest'],
       budget=dict(started=started.isoformat(),validated=now.isoformat(),elapsedSeconds=round(elapsed,3),hardStopSeconds=5400),
       contentManifestSha256=sha(j(manifest)),preservedSourceManifests=manifests,
       providers={p:dict(implementation='IMPLEMENTED',validation='CONTRACT_VALIDATED',liveProviderCertified=False) for p in ('gitlab','jenkins')},
       claims=['official-schema and restricted-subset validation','independent Jenkins lexer/AST grammar',
               'current 152-test generation contract','exact B1 152-test replay and unchanged historical evidence',
               'common frozen projections','actual Windows local semantic execution','no-overwrite and deterministic generation',
               'offline engineering validation; no GitLab/Jenkins service, runner, plugin, account, Linux, WSL or VM'],
       sourceDistributionState='B1 manifests intentionally retained; final release reconciliation belongs to Phase 2D',
       note='The completion commit binds this content manifest; no circular claim of its own commit hash.')
    (EVIDENCE/'acceptance.json').write_bytes(j(acceptance))
    print(json.dumps(dict(status='PASS',boundFiles=len(manifest['files']),stageDigest=STATE['distributionDigest'])))
if __name__=='__main__':
    if sys.argv[1:]==['--finalize']: finalize()
    else: suites()
