"""Mechanical Phase 2C acceptance binding and read-only post-commit validation."""
import argparse,hashlib,json,subprocess,sys,re,posixpath
from pathlib import Path
ROOT=Path(__file__).resolve().parents[4]
HERE=Path(__file__).parent
OUT=ROOT/'repositories/cca-conformance/evidence/mo1306/phase2c'
PKG=ROOT/'repositories/memoryos-ci'
ORIGINAL='e1c990bf65d0c7925a68eea8222cd304f8ce6db6'
B1='dbafc0061aa493da2517ee5564f9ea6adb90f52d'
SUBJECT='test(memoryos-1.3): validate MO-1306 Azure and GitHub adapters'
FIX=ROOT/'repositories/cca-conformance/fixtures/mo1306-phase2c'
def sha(data):return 'sha256:'+hashlib.sha256(data).hexdigest()
def j(value):return (json.dumps(value,sort_keys=True,separators=(',',':'))+'\n').encode()
def git(*args):return subprocess.check_output(['git','-c','safe.directory='+ROOT.as_posix(),*args],cwd=ROOT).decode().strip()
def row(path):
    data=path.read_bytes();return {'path':path.relative_to(ROOT).as_posix(),'byteLength':len(data),'sha256':sha(data)}
def read(name):return json.loads((OUT/name).read_bytes())
def scoped(relative,base):
    value=Path(relative);assert not value.is_absolute() and '..' not in value.parts
    target=ROOT/value
    assert target.resolve().is_relative_to(base.resolve()) and not target.is_symlink()
    return target
def binding(member,base=ROOT):
    relative=member['path'];assert not Path(relative).is_absolute() and '..' not in Path(relative).parts
    data=(base/relative).read_bytes()
    assert len(data)==member['byteLength'] and sha(data).removeprefix('sha256:')==member['sha256'].removeprefix('sha256:'),relative
def required_gates():
    distribution=sha((PKG/'distribution-manifest.json').read_bytes())
    manifest=json.loads((PKG/'distribution-manifest.json').read_bytes())
    assert len({x['path'] for x in manifest['files']})==len(manifest['files'])
    assert {p.relative_to(PKG).as_posix() for p in PKG.rglob('*') if p.is_file()}=={x['path'] for x in manifest['files']}|{'distribution-manifest.json'}
    for member in manifest['files']:binding(member,PKG)
    package=json.loads((PKG/'package.json').read_bytes())
    assert not any(package.get(key) for key in ('dependencies','optionalDependencies','peerDependencies'))
    azure=read('azure-validation.json');assert azure['result']=='PASS'
    assert azure['negativeCount']==len(azure['negatives'])==59 and all(x['result']=='REJECTED' for x in azure['negatives'])
    assert len({x['id'] for x in azure['negatives']})==59
    assert azure['ordinaryValidationNetwork']=='DISABLED'
    assert all(azure['positive'][key]=='PASS' for key in ('schemaValidation','scriptAst','subsetValidation'))
    assert azure['schema']['localReferenceCount']==698 and azure['schema']['remoteResolution']=='FORBIDDEN'
    ag=azure['generation'];assert ag['deterministicCalls']==13 and ag['metadataNegativeCount']==ag['deploymentNegativeCount']==10
    assert len(ag['projectionCases'])==11 and ag['templateAgreement']==ag['keyPermutation']==ag['normalizedDefaults']=='PASS'
    provenance=json.loads((FIX/'azure/schema-provenance.json').read_bytes())
    assert provenance['commit']=='9e40e814abd20917f273dd587497086f0476a563' and provenance['path']=='service-schema.json'
    assert provenance['byteLength']==1640523 and provenance['sha256']=='sha256:f00a9630f6550204148634d9a13f634b5750a225559886effe09a751482f0459'
    binding({'path':'upstream/service-schema.json','byteLength':provenance['byteLength'],'sha256':provenance['sha256']},FIX/'azure')
    binding({'path':provenance['licensePath'],'byteLength':provenance['licenseByteLength'],'sha256':provenance['licenseSha256']},FIX/'azure')
    github=read('github-contract.json');assert github['status']==github['contract']['status']=='PASS'
    assert github['negativeCount']==len(github['negatives'])==50 and all(x['status']=='REJECTED' for x in github['negatives'])
    assert len({x['id'] for x in github['negatives']})==50
    assert github['astNegativeCount']==len(github['astNegatives'])==3 and all(x['status']=='REJECTED' for x in github['astNegatives'])
    assert github['metadata']['rejected']==5 and github['metadata']['varyRunId']
    assert github['determinism']['repetitions']==12 and all(github['determinism'][k] for k in ('goldenByteEquality','keyOrderPermutation','normalizedDefaults','spacedConfigEscaping'))
    assert github['originalDiagnostic']['revision']==ORIGINAL and github['originalDiagnostic']['validator']=='REJECTED' and all(github['originalDiagnostic']['confirmedDeficiencies'].values())
    for member in github['sourceBindings']:binding(member)
    actions=json.loads((FIX/'actions/inventory.json').read_bytes())['actions']
    assert {(x['action'],x['revision']) for x in actions}=={('actions/checkout','3d3c42e5aac5ba805825da76410c181273ba90b1'),('actions/upload-artifact','043fb46d1a93c77aae656e7c1c64a875d1fc6a0a')}
    for member in actions:binding(member)
    bootstrap=read('github-bootstrap.json');assert bootstrap['passed']==len(bootstrap['cases'])==14 and all(x['status']=='PASS' for x in bootstrap['cases'])
    assert not bootstrap['networkExecuted'] and not bootstrap['hostedExecuted']
    assert bootstrap['sourceSha256']==sha((PKG/'scripts/Initialize-GitHubCI.ps1').read_bytes()).removeprefix('sha256:')
    wrapper=read('github-wrapper.json');assert wrapper['productionDigest']==distribution and wrapper['passed']==len(wrapper['cases'])>=20 and all(x['status']=='PASS' for x in wrapper['cases'])
    assert not wrapper['networkExecuted'] and not wrapper['hostedExecuted']
    assert wrapper['status']=='PASS' and wrapper['harness']['sha256']==sha((ROOT/wrapper['harness']['path']).read_bytes())
    for member in wrapper['artifacts']:binding(member,OUT)
    for case in (x for x in wrapper['cases'] if 'bundle' in x):
        root=scoped((OUT/'github-wrapper'/case['bundle']).relative_to(ROOT),OUT/'github-wrapper')
        result=json.loads((root/'memoryos-ci-result.json').read_bytes())
        assert result['provider']=='github' and result['process']['exitCode']==case['exitCode']
        assert len(list(root.iterdir()))==case['fileCount']
        outputs=(OUT/'github-wrapper'/case['id']/'outputs.txt').read_bytes()
        assert outputs==('complete=true\nexit-code='+str(case['exitCode'])+'\nrun-id='+root.name+'\n').encode()
    suites=read('final-suites.json');assert suites['status']=='PASS'
    expected={'common-contract','common-security','adapter-api','github-transport','azure-generation','azure-contract','github-contract','mo1302-regression','workspace','production-structure'}
    assert len(suites['suites'])==len(expected) and {x['id'] for x in suites['suites']}==expected
    assert all(x['status']=='PASS' and x['exitCode']==0 for x in suites['suites'])
    counts={'common-contract':152,'common-security':37,'adapter-api':50,'github-transport':33,'production-structure':39,'azure-generation':31,'azure-contract':59,'github-contract':53,'mo1302-regression':4,'workspace':1}
    assert {x['id']:x['assertions'] for x in suites['suites']}==counts
    assert suites['distributionDigest']==distribution
    for member in suites['sourceBindings']:binding(member)
    reparse=read('github-reparse.json');assert reparse['status']=='PASS' and reparse['passed']==1 and reparse['productionDigest']==distribution
    assert len(reparse['cases'])==1 and reparse['cases'][0]['actualExitCode']==15 and reparse['cases'][0]['status']=='PASS'
    assert not reparse['networkExecuted'] and not reparse['hostedExecuted']
    assert reparse['harnessSha256']==sha((HERE/'github-reparse.test.mjs').read_bytes())
    engineering=read('engineering-inputs.json');assert engineering['status']=='PASS' and engineering['dependencyCount']==7 and engineering['pythonVersion']=='3.12.14'
    assert engineering['lock']['matchesB1'];binding(engineering['lock'])
    locked=json.loads((ROOT/engineering['lock']['path']).read_bytes())['dependencies']
    assert {x['name'] for x in locked}=={x['name'] for x in engineering['dependencies']}
    for dependency in engineering['dependencies']:
        expected_dependency=next(x for x in locked if x['name']==dependency['name'])
        assert dependency['status']=='PASS' and dependency['installedVersion']==dependency['version']
        assert all(dependency[k]==expected_dependency[k] for k in ('name','version','filename','byteLength','sha256'))
    assert engineering['source']['sha256']==sha((ROOT/engineering['source']['path']).read_bytes())
    generation=read('cli-generation.json');assert generation['status']=='PASS' and {x['provider'] for x in generation['cases']}=={'azure','github'}
    assert all(x['status']=='PASS' and x['byteIdenticalFreshRoots'] and x['noOverwriteExit']==17 for x in generation['cases'])
    return {'githubWorkflowNegatives':50,'githubAstNegatives':3,'githubMetadataNegatives':5,'githubBootstrap':14,'githubWrapper':wrapper['passed'],'azureCorpusNegatives':59,'azureMetadataNegatives':10,'azureDeploymentNegatives':10,'azureProjections':11,'affectedSuites':len(expected),'distributionDigest':distribution}
def history():
    assert git('rev-parse',ORIGINAL+'^')==B1
    assert git('show','-s','--format=%s',ORIGINAL)=='feat(memoryos-1.3): add MO-1306 Azure and GitHub adapters'
    assert git('branch','--show-current')=='mo1306/phase2c'
    assert git('merge-base','--is-ancestor',ORIGINAL,'HEAD')==''
    preserved=['.github','repositories/cca-conformance/docs/mo1302-github-policy-gate.md','repositories/cca-conformance/tests/mo1302_action_foundation_conformance_test.mjs','repositories/cca-conformance/tests/mo1302_github_product_conformance_test.mjs','repositories/memoryos-ci/runtime','repositories/memoryos-ci/src/providers/gitlab.mjs','repositories/memoryos-ci/src/providers/jenkins.mjs','docs/mo1306-contract-freeze-1.md','docs/mo1306-contract-freeze-1-process-correction.md','repositories/cca-conformance/mo1306-phase2-interfaces.json']
    assert git('diff',B1,'--',*preserved)==''
    return {'status':'PASS','baseline':B1,'original2C':ORIGINAL,'preservedPaths':preserved,'originalCommitUnmodified':True,'noMerge':True,'noPush':True,'noTag':True}
def acceptance_gates():
    gates=required_gates();tests=read('evidence-negative-tests.json')
    assert tests['status']=='PASS' and tests['negativeCount']==len(tests['cases'])==9 and tests['positiveCount']==1
    assert len({x['id'] for x in tests['cases']})==9 and all(x['status']=='REJECTED' for x in tests['cases'])
    assert tests['productionDigest']==gates['distributionDigest']
    for member in tests['sourceBindings']:binding(member)
    gates['evidenceNegativeTests']=tests['negativeCount']
    return gates
def verify_generated():
    from azure_validator import validate as azure_validate
    from github_validator import validate_workflow
    inventory=json.loads((PKG/'distribution-manifest.json').read_bytes())
    members={x['path']:x for x in inventory['files']};closure=set()
    def walk(entry):
        if entry in closure:return
        closure.add(entry)
        for dep in re.findall(r'''(?:from\s*|import\s*)['"]([^'"]+)['"]''',(PKG/entry).read_text(encoding='utf-8')):
            if dep.startswith('node:'):continue
            assert dep.startswith('.')
            walk(posixpath.normpath(posixpath.join(posixpath.dirname(entry),dep)))
    walk('src/generator.mjs')
    generator=sha(j([members[p] for p in sorted(closure|{p for p in members if p.startswith('templates/')} )]))
    rows=[]
    for provider in ('azure','github'):
        root=OUT/'generated'/provider
        manifest=json.loads((root/'memoryos-ci-generation.json').read_bytes())
        assert manifest['provider']==provider
        assert manifest['generator']['sha256']==generator
        config=json.loads((ROOT/'repositories/cca-conformance/fixtures/mo1306/evaluate-policy-pass/memoryos-ci.json').read_bytes())
        config={**config,'timeoutMs':config.get('timeoutMs',60000),'providerExtensions':config.get('providerExtensions',{})}
        assert manifest['configurationSha256']==sha(j(config))
        assert sha((root/'memoryos-ci.json').read_bytes())==manifest['configurationSha256']
        assert sorted(p.relative_to(root).as_posix() for p in root.rglob('*') if p.is_file())==sorted([r['path'] for r in manifest['files']]+['memoryos-ci-generation.json'])
        for member in manifest['files']:
            raw=(root/member['path']).read_bytes();assert sha(raw)==member['sha256'] and len(raw)==member['byteLength']
        deployment={'kind':'MemoryOSCICDDeployment','version':'1.0.0','provider':provider,'distributionDigest':sha((PKG/'distribution-manifest.json').read_bytes()),'options':{'pool':'MemoryOS_Windows'} if provider=='azure' else {'repository':'moelsaka01/cca-workspace','toolRevision':ORIGINAL,'configPath':'repositories/cca-conformance/fixtures/mo1306/evaluate-policy-pass/memoryos-ci.json'}}
        assert manifest['deploymentSha256']==sha(j(deployment))
        if provider=='azure':azure_validate((root/'azure-pipelines.yml').read_bytes(),manifest['configurationSha256'],deployment['distributionDigest'],deployment['options']['pool'])
        else:validate_workflow((root/'.github/workflows/memoryos-ci.yml').read_bytes(),{'configurationDigest':manifest['configurationSha256'],'deployment':deployment})
        rows.append({'provider':provider,'manifest':row(root/'memoryos-ci-generation.json')})
    return rows
def verify_bundles():
    execution=json.loads((OUT/'native-execution.json').read_bytes());assert execution['status']=='PASS' and execution['caseCount']==len(execution['cases'])>=16
    expected={p+'-'+c for p in ('azure','github') for c in ('pass','fail','cne','set','regression','metadata','input','integrity')}
    assert len(execution['cases'])==len(expected) and {x['id'] for x in execution['cases']}==expected
    distribution=sha((PKG/'distribution-manifest.json').read_bytes());assert execution['distributionDigest']==distribution
    for case in execution['cases']:
        assert case['status']=='PASS'
        command=read('native-'+case['id']+'.json');assert command['status']=='PASS' and command['exitCode']==command['expectedExitCode']==case['exitCode']
        summary=json.loads(command['stdout']);assert summary['publication']=='COMPLETE' and summary['runId']==case['runId'] and summary['exitCode']==case['exitCode']
        public_verify=read('verify-'+case['id']+'.json');assert public_verify['status']=='PASS' and public_verify['exitCode']==0
        root=scoped(case['bundle'],OUT/'bundles')
        assert all(p.is_file() and not p.is_symlink() for p in root.iterdir())
        files={p.name:p.read_bytes() for p in root.iterdir()}
        assert len(files)==(6 if case['semanticByteParity'] else 4)
        result=json.loads(files['memoryos-ci-result.json']);evidence=json.loads(files['memoryos-ci-evidence.json']);marker=json.loads(files['memoryos-ci-complete.json']);manifest=json.loads(files['memoryos-ci-artifacts.json'])
        assert root.name==case['runId']==result['runId']==evidence['runId']==marker['runId']==manifest['runId']
        assert result['process']['exitCode']==case['exitCode'] and result['classification']==case['classification']
        provider,name=case['id'].split('-',1);assert result['provider']==provider and evidence['adapter']['id']=='memoryos.cicd.adapter.'+provider
        assert summary['classification']==case['classification']=={'pass':'PASS','fail':'FAIL','cne':'COULD_NOT_EVALUATE','set':'PASS','regression':'PASS','metadata':'PASS','input':'INPUT_ERROR','integrity':'INTEGRITY_ERROR'}[name]
        assert evidence['metadata']==case['expectedMetadata']
        assert case['exitCode']=={'pass':0,'fail':6,'cne':7,'set':0,'regression':0,'metadata':0,'input':11,'integrity':15}[name]
        assert case['semanticByteParity']==(name not in ('input','integrity'))
        assert sha(files['memoryos-ci-result.json'])==evidence['resultSha256'] and evidence['distributionSha256']==distribution
        assert summary['resultSha256']==evidence['resultSha256']
        assert sha(files['memoryos-ci-artifacts.json'])==marker['manifestSha256']
        assert set(files)=={r['path'] for r in manifest['files']}|{'memoryos-ci-artifacts.json','memoryos-ci-complete.json'}
        for member in manifest['files']:assert sha(files[member['path']])==member['sha256'] and len(files[member['path']])==member['byteLength']
        if case['semanticByteParity']:
            if name=='regression':
                oracle=scoped(case['independentOracle'],OUT/'oracles')
            else:
                vector={'pass':'evaluate-policy-pass','metadata':'evaluate-policy-pass','fail':'evaluate-policy-fail','cne':'evaluate-policy-cne','set':'evaluate-policySet-pass'}[name]
                oracle=ROOT/'repositories/cca-conformance/fixtures/mo1306'/vector
            for name in ('evaluation-identity.json','policy-outcome.json'):assert files[name]==(oracle/name).read_bytes()
    return execution['caseCount']
def build():
    baseline=history();OUT.mkdir(parents=True,exist_ok=True)
    source=Path('C:/Users/melsa/Documents/Codex/cca-workspace/.cache/mo1306-phase2d-source-gate')
    source_rows=[]
    for name in ('phase2c-source-gate.json','preflight.json'):
        data=(source/name).read_bytes();target=OUT/('original-'+name);target.write_bytes(data)
        source_rows.append({'sourcePath':str(source/name),**row(target)})
    (OUT/'preservation.json').write_bytes(j(baseline))
    generated=verify_generated();native_count=verify_bundles();gates=acceptance_gates()
    changes=set(git('diff','--name-only',ORIGINAL).splitlines())|set(git('ls-files','--others','--exclude-standard').splitlines())
    changes.update((OUT/name).relative_to(ROOT).as_posix() for name in ('changed-files.json','acceptance.json'))
    permitted=['repositories/memoryos-ci/','repositories/cca-conformance/tools/mo1306-phase2c/','repositories/cca-conformance/fixtures/mo1306-phase2c/','repositories/cca-conformance/evidence/mo1306/phase2c/']
    assert all(p in ('.gitattributes','docs/mo1306-phase2c-correction.md','repositories/cca-conformance/tools/mo1306/contracts.test.mjs') or any(p.startswith(prefix) for prefix in permitted) for p in changes)
    (OUT/'changed-files.json').write_bytes(j({'kind':'MemoryOSPhase2CChangedFiles','baseline':ORIGINAL,'count':len(changes),'paths':sorted(changes)}))
    # Bound every test/tool/fixture and shipped file; never include this future index.
    roots=[PKG,HERE,ROOT/'repositories/cca-conformance/fixtures/mo1306-phase2c',OUT]
    files={p for folder in roots for p in folder.rglob('*') if p.is_file() and '__pycache__' not in p.parts and p!=OUT/'acceptance.json'}
    files.update([ROOT/'docs/mo1306-phase2c-correction.md',ROOT/'repositories/cca-conformance/tools/mo1306/contracts.test.mjs',ROOT/'.gitattributes'])
    files.update([ROOT/'repositories/cca-conformance/fixtures/mo1306/engineering-validator-lock.json'])
    receipt={'kind':'MemoryOSPhase2CAcceptance','version':'1.0.0','status':'PASS','baseline':B1,'original2C':ORIGINAL,'completionParent':ORIGINAL,'completionSubject':SUBJECT,'sourceGate':source_rows,'generated':generated,'nativeCases':native_count,'providers':{'azure':['IMPLEMENTED','CONTRACT_VALIDATED','NOT_LIVE_PROVIDER_CERTIFIED'],'github':['IMPLEMENTED','HOSTED_EXECUTION_CERTIFICATION_PENDING']},'scope':'Offline contract validation and native Windows adapter execution; no hosted services or final integrated release package claim.','files':[row(p) for p in sorted(files,key=lambda p:p.relative_to(ROOT).as_posix())]}
    receipt['gates']=gates
    (OUT/'acceptance.json').write_bytes(j(receipt));print('Phase2C acceptance bound',len(files),'files')
def verify(post_commit=False):
    history();receipt=json.loads((OUT/'acceptance.json').read_bytes());assert receipt['status']=='PASS' and receipt['baseline']==B1 and receipt['completionParent']==ORIGINAL
    seen=set()
    for member in receipt['files']:
        path=member['path'];assert path not in seen and '..' not in Path(path).parts and not Path(path).is_absolute();seen.add(path)
        assert row(ROOT/path)==member,path
    assert receipt['nativeCases']==verify_bundles();verify_generated();assert receipt['gates']==acceptance_gates()
    if post_commit:
        assert git('rev-parse','HEAD^')==ORIGINAL
        assert git('show','-s','--format=%s','HEAD')==SUBJECT
        assert git('status','--porcelain')==''
        assert git('diff','--name-only','HEAD^','HEAD').splitlines()==read('changed-files.json')['paths']
    assert git('diff','--check')==''
    print('Phase2C retained evidence validation PASS:',len(seen),'bound files')
if __name__=='__main__':
    parser=argparse.ArgumentParser();parser.add_argument('mode',choices=['build','verify']);parser.add_argument('--post-commit',action='store_true');args=parser.parse_args()
    build() if args.mode=='build' else verify(args.post_commit)
