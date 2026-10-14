"""Bounded, offline Windows provider execution and public generator witnesses.

This harness uses the real common runner and published bundle verifier. It does
not mock MemoryOS outcomes or execute any provider service.
"""
import argparse,base64,datetime,hashlib,json,os,shutil,subprocess,sys,time,uuid
from pathlib import Path
ROOT=Path(__file__).resolve().parents[4]
PKG=ROOT/'repositories/memoryos-ci'
TOOLS=Path(__file__).parent
CACHE=ROOT/'.cache/mo1306-phase2c'
OUT=ROOT/'repositories/cca-conformance/evidence/mo1306/phase2c'
FIX=ROOT/'repositories/cca-conformance/fixtures/mo1306'
NODE=CACHE/'node.exe'
PS=Path(os.environ['SystemRoot'])/'System32/WindowsPowerShell/v1.0/powershell.exe'
ENV={k:os.environ[k] for k in ('SystemRoot','WINDIR')}
ENV['PATHEXT']='.COM;.EXE;.BAT;.CMD'
B1='dbafc0061aa493da2517ee5564f9ea6adb90f52d'
ORIGINAL='e1c990bf65d0c7925a68eea8222cd304f8ce6db6'
def j(value):return (json.dumps(value,sort_keys=True,separators=(',',':'))+'\n').encode()
def sha(data):return 'sha256:'+hashlib.sha256(data).hexdigest()
def put(name,value):
    OUT.mkdir(parents=True,exist_ok=True)
    target=OUT/name
    target.parent.mkdir(parents=True,exist_ok=True)
    if target.exists() and name.startswith('native-') or target.exists() and json.loads(target.read_bytes()).get('status')=='FAIL':
        history=OUT/'attempts';history.mkdir(exist_ok=True)
        shutil.copyfile(target,history/(target.stem+'-'+uuid.uuid4().hex[:8]+'.json'))
    (OUT/name).write_bytes(j(value))
def run(name,argv,expected=0,env=None,input=None,timeout=90,cwd=ROOT):
    started=time.perf_counter()
    completed=subprocess.run([str(x) for x in argv],cwd=cwd,env=env or ENV,input=input,capture_output=True,timeout=timeout,creationflags=subprocess.CREATE_NO_WINDOW)
    record={'id':name,'command':[str(x) for x in argv],'exitCode':completed.returncode,'expectedExitCode':expected,'elapsedMs':round((time.perf_counter()-started)*1000),'stdout':completed.stdout.decode('utf-8','replace'),'stderr':completed.stderr.decode('utf-8','replace'),'status':'PASS' if completed.returncode==expected else 'FAIL'}
    put(name+'.json',record)
    assert completed.returncode==expected,record
    return record
def refresh():
    result=run('branch-package-inventory',[sys.executable,ROOT/'repositories/cca-conformance/tools/mo1306/build.py'])
    return json.loads(result['stdout'])
def protected(work,config,provider,metadata_id='101'):
    env={**ENV,'MEMORYOS_CI_NODE':str(NODE),'MEMORYOS_CI_HOME':str(PKG),'MEMORYOS_CI_CONFIG':str(config)}
    if provider=='azure':env.update(BUILD_SOURCESDIRECTORY=str(work),BUILD_REPOSITORY_NAME='owner/repo',BUILD_SOURCEVERSION='a'*40,BUILD_BUILDID=metadata_id,SYSTEM_JOBID='memoryos_policy',SYSTEM_JOBATTEMPT='1',BUILD_REASON='Manual',SYSTEM_PULLREQUEST_PULLREQUESTID='7')
    else:env.update(GITHUB_REPOSITORY='owner/repo',GITHUB_SHA='a'*40,GITHUB_RUN_ID=metadata_id,GITHUB_JOB='memoryos_ci',GITHUB_RUN_ATTEMPT='1',GITHUB_EVENT_NAME='workflow_dispatch')
    env.update(GITHUB_TOKEN='SECRET-SENTINEL',GITHUB_ACTOR='SECRET-SENTINEL',NODE_OPTIONS='--no-warnings',NODE_PATH='SECRET-SENTINEL',HTTP_PROXY='http://127.0.0.1:1')
    if metadata_id=='202':
        if provider=='azure':
            env.update(BUILD_REPOSITORY_NAME='other/project',BUILD_SOURCEVERSION='B'*40,SYSTEM_JOBID='other_job',SYSTEM_JOBATTEMPT='3',BUILD_REASON='Schedule',SYSTEM_PULLREQUEST_PULLREQUESTID='19',BUILD_SOURCEBRANCH='DIAGNOSTIC-SENTINEL',BUILD_REQUESTEDFOR='DIAGNOSTIC-SENTINEL',AGENT_NAME='DIAGNOSTIC-SENTINEL')
        else:
            env.update(GITHUB_REPOSITORY='other/project',GITHUB_SHA='B'*40,GITHUB_JOB='other_job',GITHUB_RUN_ATTEMPT='3',GITHUB_EVENT_NAME='schedule',GITHUB_REF='DIAGNOSTIC-SENTINEL',GITHUB_ACTOR='DIAGNOSTIC-SENTINEL',RUNNER_NAME='DIAGNOSTIC-SENTINEL')
    return env
def execute():
    inventory={'distributionDigest':sha((PKG/'distribution-manifest.json').read_bytes())}
    put('attempts/native-azure-launch-environment-disposition.json',{'kind':'MemoryOSPhase2CHarnessAttemptDisposition','status':'DIAGNOSED_HARNESS_FAILURE','scope':'Original native Azure launcher observation returned outer exit0 with empty stdout; no semantic success was claimed.','cause':'Synthetic outer PowerShell environment omitted PATHEXT, so its native executable resolution did not reproduce the native Windows host environment.','correction':'Retain the bounded Windows host environment required for executable dispatch; product bootstrap identities remain independently pinned.','productChange':False})
    batch=CACHE/('native-'+uuid.uuid4().hex[:8]);batch.mkdir(parents=True)
    cases=[]
    for provider in ('azure','github'):
        vectors=[('pass','evaluate-policy-pass',0),('fail','evaluate-policy-fail',6),('cne','evaluate-policy-cne',7),('set','evaluate-policySet-pass',0),('regression','evaluate-policy-pass',0),('metadata','evaluate-policy-pass',0),('input','evaluate-policy-pass',11),('integrity','evaluate-policy-pass',15)]
        for name,vector,expected in vectors:
            work=batch/(provider+'-'+name);work.mkdir()
            for file in ('policy.json','candidate.mip','memoryos-ci.json'):shutil.copyfile(FIX/vector/file,work/file)
            config=json.loads((work/'memoryos-ci.json').read_bytes())
            if name=='regression':shutil.copyfile(work/'candidate.mip',work/'baseline.mip');config['context']['baselineMip']='baseline.mip'
            if name=='input':config['context']['candidateMip']='missing.mip'
            if name=='integrity':config['policy']['expectedSemanticDigest']='sha256:'+'0'*64
            (work/'memoryos-ci.json').write_bytes(j(config))
            normalized={**config,'timeoutMs':config.get('timeoutMs',60000),'providerExtensions':config.get('providerExtensions',{})}
            config_digest=sha(j(normalized));distribution=inventory['distributionDigest']
            if provider=='azure':
                script=(PKG/'templates/azure.yml.tpl').read_text(encoding='utf-8')
                import yaml
                script=script.replace('{{pool}}','MemoryOS_Windows').replace('{{configurationDigest}}',config_digest).replace('{{distributionDigest}}',distribution)
                command=yaml.safe_load(script)['jobs'][0]['steps'][1]['powershell']
            else:
                command="& (Join-Path $env:MEMORYOS_CI_HOME 'scripts\\Invoke-MemoryOSCI.ps1') -Provider 'github' -Workspace '"+str(work)+"' -ConfigurationDigest '"+config_digest+"' -DistributionDigest '"+distribution+"'\nexit $LASTEXITCODE\n"
            env=protected(work,work/'memoryos-ci.json',provider,'202' if name=='metadata' else '101')
            record=run('native-'+provider+'-'+name,[PS,'-NoProfile','-NonInteractive','-ExecutionPolicy','Bypass','-EncodedCommand',base64.b64encode(command.encode('utf-16le')).decode()],expected,env,cwd=work)
            summary=json.loads(record['stdout']);assert summary['exitCode']==expected and summary['publication']=='COMPLETE'
            bundle=work/'.memoryos-ci/out'/summary['runId']
            verify=run('verify-'+provider+'-'+name,[NODE,'--max-old-space-size=128',PKG/'bin/memoryos-ci.mjs','verify','--bundle',bundle])
            result=json.loads((bundle/'memoryos-ci-result.json').read_bytes());evidence=json.loads((bundle/'memoryos-ci-evidence.json').read_bytes())
            assert result['provider']==provider and evidence['adapter']['id']=='memoryos.cicd.adapter.'+provider
            varied=name=='metadata'
            expected_metadata={'provider':provider,'repository':'other/project' if varied else 'owner/repo','revision':('b' if varied else 'a')*40,'runId':'202' if varied else '101','jobId':'other_job' if varied else ('memoryos_policy' if provider=='azure' else 'memoryos_ci'),'attempt':3 if varied else 1,'event':('Schedule' if varied else 'Manual') if provider=='azure' else ('schedule' if varied else 'workflow_dispatch'),'changeRequest':('19' if varied else '7') if provider=='azure' else None}
            assert evidence['metadata']==expected_metadata
            assert all(b'SECRET-SENTINEL' not in p.read_bytes() for p in bundle.iterdir())
            assert all(b'DIAGNOSTIC-SENTINEL' not in p.read_bytes() for p in bundle.iterdir())
            independent_oracle=None
            if expected in (0,6,7):
                if name=='regression':
                    run('oracle-'+provider+'-regression',[NODE,'--max-old-space-size=128',ROOT/'repositories/cca-conformance/tools/mo1306/oracle.mjs',work])
                    expected_files={'evaluation-identity.json':work/'oracle-identity.json','policy-outcome.json':work/'oracle-outcome.json'}
                    oracle_directory=OUT/'oracles'/(provider+'-regression');oracle_directory.mkdir(parents=True,exist_ok=True)
                    for file,source in expected_files.items():shutil.copyfile(source,oracle_directory/file)
                    independent_oracle=oracle_directory.relative_to(ROOT).as_posix()
                else:
                    expected_files={file:FIX/vector/file for file in ('evaluation-identity.json','policy-outcome.json')}
                    independent_oracle=(FIX/vector).relative_to(ROOT).as_posix()
                for file,oracle in expected_files.items():assert (bundle/file).read_bytes()==oracle.read_bytes(),(provider,name,file)
            target=OUT/'bundles'/(provider+'-'+name)/summary['runId'];target.parent.mkdir(parents=True,exist_ok=True);shutil.copytree(bundle,target)
            cases.append({'id':provider+'-'+name,'status':'PASS','exitCode':expected,'classification':result['classification'],'runId':summary['runId'],'bundle':target.relative_to(ROOT).as_posix(),'semanticByteParity':expected in (0,6,7),'independentOracle':independent_oracle,'expectedMetadata':expected_metadata})
            put('native-execution.json',{'status':'PASS' if len(cases)==16 else 'IN_PROGRESS','network':'No service access; fixed MemoryOS network denial boundary. Not an OS firewall claim.','distributionDigest':distribution,'cases':cases,'caseCount':len(cases)})
            print(provider,name,'PASS',flush=True)
def generation():
    inventory={'distributionDigest':sha((PKG/'distribution-manifest.json').read_bytes())};batch=CACHE/('generation-'+uuid.uuid4().hex[:8]);batch.mkdir(parents=True)
    cases=[]
    for provider in ('azure','github'):
        config=batch/(provider+'-config.json');shutil.copyfile(FIX/'evaluate-policy-pass/memoryos-ci.json',config)
        deployment={'kind':'MemoryOSCICDDeployment','version':'1.0.0','provider':provider,'distributionDigest':inventory['distributionDigest'],'options':{'pool':'MemoryOS_Windows'} if provider=='azure' else {'repository':'moelsaka01/cca-workspace','toolRevision':ORIGINAL,'configPath':'repositories/cca-conformance/fixtures/mo1306/evaluate-policy-pass/memoryos-ci.json'}}
        deploy=batch/(provider+'-deployment.json');deploy.write_bytes(j(deployment))
        outputs=[]
        for index in (1,2):
            output=batch/(provider+str(index));run('generation-'+provider+str(index),[NODE,'--max-old-space-size=128',PKG/'bin/memoryos-ci.mjs','generate','--config',config,'--deployment',deploy,'--output',output])
            rows={p.relative_to(output).as_posix():p.read_bytes() for p in output.rglob('*') if p.is_file()};outputs.append(rows)
            assert len(rows)==3 and all(b'\r' not in b and not b.startswith(b'\xef\xbb\xbf') and b.endswith(b'\n') and not b.endswith(b'\n\n') for b in rows.values())
        assert outputs[0]==outputs[1]
        run('generation-'+provider+'-no-overwrite',[NODE,'--max-old-space-size=128',PKG/'bin/memoryos-ci.mjs','generate','--config',config,'--deployment',deploy,'--output',batch/(provider+'1')],17)
        assert {p.relative_to(batch/(provider+'1')).as_posix():p.read_bytes() for p in (batch/(provider+'1')).rglob('*') if p.is_file()}==outputs[0]
        target=OUT/'generated'/provider
        for file,data in outputs[0].items():(target/file).parent.mkdir(parents=True,exist_ok=True);(target/file).write_bytes(data)
        cases.append({'provider':provider,'status':'PASS','byteIdenticalFreshRoots':True,'noOverwriteExit':17,'files':[{'path':p,'byteLength':len(b),'sha256':sha(b)} for p,b in sorted(outputs[0].items())]})
    put('cli-generation.json',{'status':'PASS','cases':cases,'deploymentNote':'Retained workflow is contract fixture pinned to existing original2C revision; deployment must select a reviewed commit containing corrected artifacts and matching integrated pins in Phase2D/3A.'})
def regressions():
    for name,args in [('common-contract',['--test','repositories/cca-conformance/tools/mo1306/contracts.test.mjs']),('common-security',['--test','repositories/cca-conformance/tools/mo1306/security.test.mjs']),('mo1302-regression',['--test','--test-name-pattern=Action metadata, bootstrap exports|CLI transport accepts|PortablePath and action-input|outputs are exactly nineteen','repositories/cca-conformance/tests/mo1302_action_foundation_conformance_test.mjs'])]:
        run(name,[NODE,*args],timeout=120)
    run('workspace',[sys.executable,ROOT/'tools/verify_workspace.py','--root',ROOT],timeout=60)
if __name__=='__main__':
    parser=argparse.ArgumentParser();parser.add_argument('mode',choices=['refresh','execute','generation','regressions']);args=parser.parse_args()
    {'refresh':refresh,'execute':execute,'generation':generation,'regressions':regressions}[args.mode]()
