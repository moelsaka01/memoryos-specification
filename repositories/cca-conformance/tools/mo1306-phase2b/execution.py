"""Offline Windows execution of independently decoded, generated launch scripts."""
import base64, hashlib, json, os, shutil, socket, subprocess, sys, tempfile, time
from pathlib import Path
from prepare import ROOT, CACHE, EVIDENCE, j, sha
sys.path.insert(0,str(ROOT/'.cache/mo1306/validators'))
from gitlab_validator import validate_gitlab
from jenkins_validator import validate_jenkins

def denied(*args,**kwargs): raise RuntimeError('Engineering validation network denied')
socket.socket=denied
socket.create_connection=denied
socket.getaddrinfo=denied
STATE=json.loads((CACHE/'active-stage.json').read_bytes())
STAGE=Path(STATE['stage'])
NODE=STATE['nodePath']
TOOLS=Path(__file__).parent
FIX=ROOT/'repositories/cca-conformance/fixtures/mo1306'
PS=str(Path(os.environ['SystemRoot'])/'System32/WindowsPowerShell/v1.0/powershell.exe')
PWSH=str(Path(sys.executable).parents[1]/'native/powershell/pwsh.exe')
ENV={name:os.environ[name] for name in ('SystemRoot','WINDIR')}
ENV['PATHEXT']='.EXE'
ATTEMPT=Path(tempfile.mkdtemp(prefix='execution-',dir=CACHE))
RECORDS=[]
CASE_RESULTS=[]
def invoke(name,args,expected=0,env=None,input_data=None,timeout=90):
    start=time.perf_counter()
    proc=subprocess.run(list(map(str,args)),input=input_data,stdout=subprocess.PIPE,stderr=subprocess.PIPE,
                        env=env or ENV,cwd=ROOT,timeout=timeout,creationflags=subprocess.CREATE_NO_WINDOW)
    record=dict(id=name,command=list(map(str,args)),exitCode=proc.returncode,expectedExitCode=expected,
                elapsedMs=round((time.perf_counter()-start)*1000),stdout=proc.stdout.decode('utf8',errors='replace'),
                stderr=proc.stderr.decode('utf8',errors='replace'),status='PASS' if proc.returncode==expected else 'FAIL')
    RECORDS.append(record)
    (ATTEMPT/'records.json').write_bytes(j(RECORDS))
    assert proc.returncode==expected, record
    return proc
def generated(config,provider):
    proc=invoke(provider+'-pure-generation',[NODE,TOOLS/'bridge.mjs',STAGE],input_data=j(dict(config=config,provider=provider)))
    data=json.loads(proc.stdout)
    primary='.gitlab-ci.yml' if provider=='gitlab' else 'Jenkinsfile'
    artifact=base64.b64decode(next(f['base64'] for f in data['files'] if f['path']==primary))
    validator=validate_gitlab if provider=='gitlab' else validate_jenkins
    descriptor=validator(artifact,'windows_2022',data['configurationDigest'],data['distributionDigest'])
    assert descriptor['provider']==provider
    return data,artifact,descriptor['script']
def case(provider,name,vector,expected,mutation=None,poison=False):
    work=ATTEMPT/(provider+'-'+name);work.mkdir()
    source=FIX/vector
    for filename in ('memoryos-ci.json','policy.json','candidate.mip'):
        shutil.copyfile(source/filename,work/filename)
    config=json.loads((work/'memoryos-ci.json').read_bytes())
    if mutation: mutation(config,work)
    # Invalid config cases use a valid generated pin followed by a substituted config.
    original=json.loads((source/'memoryos-ci.json').read_bytes())
    gen_config=original if name=='invalid-config' else config
    data,artifact,script=generated(gen_config,provider)
    (work/'memoryos-ci.json').write_bytes(j(config))
    script_file=work/'launch.ps1';script_file.write_bytes(script.encode('utf8'))
    parser_source=(TOOLS/'check-powershell.ps1').read_text().split('\n',1)[1]
    parser_source='$Path=$env:MO1306_PARSE_PATH\n$Provider=$env:MO1306_PARSE_PROVIDER\n'+parser_source
    parse_encoded=base64.b64encode(parser_source.encode('utf-16le')).decode()
    invoke(provider+'-'+name+'-powershell-ast',[PS,'-NoProfile','-NonInteractive','-EncodedCommand',parse_encoded],
           env={**ENV,'MO1306_PARSE_PATH':str(script_file),'MO1306_PARSE_PROVIDER':provider})
    env={**ENV,'MEMORYOS_CI_NODE':NODE,'MEMORYOS_CI_HOME':str(STAGE),'MEMORYOS_CI_CONFIG':str(work/'memoryos-ci.json'),
         ('CI_PROJECT_DIR' if provider=='gitlab' else 'WORKSPACE'):str(work)}
    meta=({'CI_PROJECT_PATH':'group/project','CI_COMMIT_SHA':'A'*40,'CI_PIPELINE_ID':'10','CI_JOB_ID':'11','CI_PIPELINE_SOURCE':'web','CI_MERGE_REQUEST_IID':'12'}
          if provider=='gitlab' else {'JOB_NAME':'folder/job','GIT_COMMIT':'B'*40,'BUILD_NUMBER':'10','BUILD_TAG':'jenkins-job-11','CHANGE_ID':'12'})
    if poison:
        meta={k: ('C'*40 if 'SHA' in k or k=='GIT_COMMIT' else '99' if k in ('CI_PIPELINE_ID','CI_JOB_ID','CI_MERGE_REQUEST_IID','BUILD_NUMBER','CHANGE_ID') else 'changed') for k in meta}
        env.update({'CI_COMMIT_REF_NAME':'SECRET-SENTINEL','GIT_AUTHOR_NAME':'SECRET-SENTINEL','HTTP_PROXY':'SECRET-SENTINEL',
                    'JENKINS_URL':'SECRET-SENTINEL','NODE_OPTIONS':'--require SECRET-SENTINEL','NODE_PATH':'SECRET-SENTINEL'})
    env.update(meta)
    if name=='invalid-metadata': env['CI_PROJECT_PATH' if provider=='gitlab' else 'JOB_NAME']='../SECRET-SENTINEL'
    if name=='bootstrap-pin': env['MEMORYOS_CI_NODE']=str(work/'missing-node.exe')
    encoded=base64.b64encode(script.encode('utf-16le')).decode()
    result=invoke(provider+'-'+name,[PWSH,'-NoProfile','-NonInteractive','-EncodedCommand',encoded],expected,env)
    assert b'SECRET-SENTINEL' not in result.stdout+result.stderr
    if expected in (0,6,7,11) or name in ('invalid-metadata','policy-pin'):
        assert result.stdout.strip(), 'Required execution summary is missing'
    summary=None
    if result.stdout.strip():
        summary=json.loads(result.stdout)
        assert result.stdout==j(summary), 'Summary must retain exact canonical UTF-8/LF bytes'
        assert summary['exitCode']==expected
        assert summary['classification']=={0:'PASS',6:'FAIL',7:'COULD_NOT_EVALUATE',10:'CONFIGURATION_ERROR',11:'INPUT_ERROR',15:'INTEGRITY_ERROR'}[expected]
        assert summary['publication']=='COMPLETE'
        if summary['publication']=='COMPLETE':
            bundle=work/'.memoryos-ci/out'/summary['runId']
            actual=json.loads((bundle/'memoryos-ci-result.json').read_bytes())
            evidence=json.loads((bundle/'memoryos-ci-evidence.json').read_bytes())
            assert actual['provider']==provider and evidence['metadata']['provider']==provider
            assert evidence['adapter']['id']=='memoryos.cicd.adapter.'+provider
            if name!='invalid-metadata':
                mapping=({'repository':'CI_PROJECT_PATH','revision':'CI_COMMIT_SHA','runId':'CI_PIPELINE_ID','jobId':'CI_JOB_ID','attempt':None,'event':'CI_PIPELINE_SOURCE','changeRequest':'CI_MERGE_REQUEST_IID'}
                         if provider=='gitlab' else {'repository':'JOB_NAME','revision':'GIT_COMMIT','runId':'BUILD_NUMBER','jobId':'BUILD_TAG','attempt':None,'event':None,'changeRequest':'CHANGE_ID'})
                expected_metadata={'provider':provider,**{field:(meta[key].lower() if field=='revision' else meta[key]) if key else None for field,key in mapping.items()}}
                assert evidence['metadata']==expected_metadata
            assert all(b'SECRET-SENTINEL' not in p.read_bytes() for p in bundle.iterdir())
            if actual['semantic']:
                reference=(ROOT/'repositories/cca-conformance/evidence/mo1306/phase1-resume-validated/bundles/real-regression'
                           if name=='regression' else source)
                if name=='regression': reference=next(reference.iterdir())
                for filename in ('evaluation-identity.json','policy-outcome.json'):
                    assert (bundle/filename).read_bytes()==(reference/filename).read_bytes(),(provider,name,filename)
                assert len(list(bundle.iterdir()))==6
            else:
                assert actual['semantic'] is None and len(list(bundle.iterdir()))==4
            saved=ATTEMPT/'bundles'/(provider+'-'+name)/summary['runId']
            saved.parent.mkdir(parents=True,exist_ok=True);shutil.copytree(bundle,saved)
    else:
        assert name in ('invalid-config','bootstrap-pin')
    CASE_RESULTS.append(dict(id=provider+'-'+name,provider=provider,status='PASS',expectedExitCode=expected,
                             actualExitCode=result.returncode,artifactSha256=sha(artifact),scriptSha256=sha(script.encode()),
                             configurationDigest=data['configurationDigest'],distributionDigest=data['distributionDigest'],
                             summary=summary,metadataVaried=poison))
    print(provider,name,'PASS',flush=True)
def main():
    for provider in ('gitlab','jenkins'):
        for operation in ('policy','policySet'):
            for suffix,code in (('pass',0),('fail',6),('cne',7)):
                vector='evaluate-'+operation+'-'+suffix
                case(provider,vector,vector,code)
        def regression(c,w):
            shutil.copyfile(w/'candidate.mip',w/'baseline.mip');c['context']['baselineMip']='baseline.mip'
        case(provider,'regression','evaluate-policy-pass',0,regression)
        case(provider,'metadata-variation','evaluate-policy-pass',0,poison=True)
        case(provider,'invalid-config','evaluate-policy-pass',10,lambda c,w:c.update(unknown=True))
        case(provider,'missing-input','evaluate-policy-pass',11,lambda c,w:(w/'candidate.mip').rename(w/'missing.mip'))
        case(provider,'policy-pin','evaluate-policy-pass',15,lambda c,w:c['policy'].update(expectedSemanticDigest='sha256:'+'0'*64))
        case(provider,'invalid-metadata','evaluate-policy-pass',10)
        case(provider,'bootstrap-pin','evaluate-policy-pass',15)
    report=dict(status='PASS',kind='MemoryOSPhase2BWindowsEquivalence',version='1.0.0',
                caseCount=len(CASE_RESULTS),commandCount=len(RECORDS),cases=CASE_RESULTS,commands=RECORDS,network='Python socket/DNS denial; shipped Node network denial; no provider calls',
                liveProviderExecution=False,stageDigest=STATE['distributionDigest'],attempt=str(ATTEMPT),
                shellScope='Windows PowerShell 5.1 parse-only; actual fixed scripts execute in PowerShell 7.6.5 under existing RemoteSigned policy; no execution-policy changes')
    (EVIDENCE/'execution.json').write_bytes(j(report))
    shutil.copytree(ATTEMPT/'bundles',EVIDENCE/'bundles')
    print(json.dumps(dict(status='PASS',cases=len(RECORDS),attempt=str(ATTEMPT))))
if __name__=='__main__': main()
