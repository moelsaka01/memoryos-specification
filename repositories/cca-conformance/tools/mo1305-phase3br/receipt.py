"""Canonical, non-self-referential Phase 3B-R release-artifact receipt validator."""
from pathlib import Path
import argparse,copy,datetime,hashlib,json,sys,zipfile
sys.dont_write_bytecode=True
HERE=Path(__file__).resolve().parent;sys.path.insert(0,str(HERE));import wrapper,certify
ROOT=wrapper.ROOT;E=certify.E
REQUIRED=['cheap-gate.json','wrapper-tests.json','correction-conformance.json','schema-validation.json','generated-fields.json','spdx-semantics.json','package-inventory.json','package-allowlist-evaluation.json','runtime-closure.json','reproducibility.json','installed.json','execution.json','installed-execution.log','installed-harness-test.json','adversarial.json','metadata-negatives.json','toolchain.json','node-authenticode.json','provenance.json','licenses-components.json','advisory-snapshot.json','advisory-review.md','validator-inventory.json','validator-permissions-before.json','validator-permissions-after.json','validator-permissions-final.json','validator-inventory-diagnostic.json','validator-cache-restoration.json','historical-cache-preparation.json','openapi-validation.json','shipped-distribution-validation.json','workspace-verification.json','contract-openapi-tests.json','advisory-validation.json','final-wrapper-validation.json','history/attempt-1-blocked.md']
def need(ok,why):
    if not ok:raise ValueError('RECEIPT_'+why)
def read(name):return json.loads((E/name).read_bytes())
def evidence_ref(path):
    p=ROOT/path;return certify.ref(path,p.read_bytes())
def verify_toolchain_inventory(tool):
    zip_pin={'byteLength':37618919,'sha256':'158f7685b44de51f6c0df1d153526cbcd3e1bc739a8dfc607721cef75de9e541'}
    sums_pin={'byteLength':3171,'sha256':'f410428039e2c922a14058df067a4482691c9304a5c01a75847f9f3f2d3307f6'}
    for key,pin in [('archive',zip_pin),('officialChecksums',sums_pin)]:
        row=tool[key];need({k:row[k] for k in pin}==pin,'OFFICIAL_TOOLCHAIN_PIN');need(evidence_ref(row['path'])==row,'OFFICIAL_TOOLCHAIN_BYTES')
    sums=(ROOT/tool['officialChecksums']['path']).read_text()
    need([line.split()[0] for line in sums.splitlines() if line.endswith(' node-v24.21.0-win-x64.zip')]==[zip_pin['sha256']],'OFFICIAL_CHECKSUM')
    expected={}
    with zipfile.ZipFile(ROOT/tool['archive']['path']) as archive:
        for member in archive.infolist():
            if member.is_dir():continue
            need(member.filename.startswith('node-v24.21.0-win-x64/'),'TOOLCHAIN_MEMBER')
            name=member.filename.split('/',1)[1];need(name not in expected,'TOOLCHAIN_DUPLICATE');expected[name]=certify.ref(name,archive.read(member))
    actual={};folder=certify.NODE.parent
    for path in folder.rglob('*'):
        need(not path.is_symlink() and not (getattr(path.lstat(),'st_file_attributes',0)&0x400),'TOOLCHAIN_LINK')
        if path.is_file():
            name=path.relative_to(folder).as_posix();actual[name]=certify.ref(name,path.read_bytes())
    need(actual==expected and len(actual)==tool['toolchainFileCount']==1994,'TOOLCHAIN_EXTRACTION')
    need(hashlib.sha256(certify.j(sorted(actual.values(),key=lambda r:r['path']))).hexdigest()==tool['toolchainInventorySha256'],'TOOLCHAIN_INVENTORY')
def certify_dependencies():
    wrapper.validate_context();wrapper.check_validator_inventory();verified=certify.verify_archive(certify.ARCHIVE,certify.SHA)
    gate=read('cheap-gate.json');need(gate['state']=='PASS' and gate['archive']==wrapper.ARCHIVE,'CHEAP_GATE')
    for row in gate['evidence']:need(evidence_ref(row['path'])==row,'CHEAP_EVIDENCE_DRIFT')
    s=read('schema-validation.json');need(s==certify.verify_schema(json.loads(verified['files']['sbom.spdx.json'])),'SCHEMA')
    need(all(s[k]==0 for k in ['rootErrors','packageErrors','fileErrors','relationshipErrors','otherErrors','totalErrors']),'SCHEMA_ERRORS')
    need(read('package-inventory.json')['files']==verified['inventory'],'PACKAGE_INVENTORY')
    closure=[r for r in verified['inventory'] if r['path'].startswith('runtime/authoritative/')]
    need(len(closure)==25 and read('runtime-closure.json')['files']==closure,'CLOSURE')
    repro=read('reproducibility.json');need(repro['state']=='PASS' and repro['freshIndependentCleanRoots'] and repro['separateBuilderProcesses'] and repro['byteForByteEqual'] and len(repro['assemblies'])==2,'REPRODUCIBILITY')
    need(len({r['root'] for r in repro['assemblies']})==2,'CLEAN_ROOTS')
    for assembly in repro['assemblies']:
        need(evidence_ref(assembly['archive']['path'])==assembly['archive'],'ASSEMBLY_IDENTITY');need({k:assembly['archive'][k] for k in wrapper.ARCHIVE}==wrapper.ARCHIVE,'ALTERNATE_ARCHIVE');need(assembly['command']['exitCode']==0,'BUILD_EXIT')
    installed=read('installed.json');execution=read('execution.json')
    need(installed['state']=='PASS' and execution['state']=='PASS','INSTALLED_EXECUTION')
    need(execution['result']['code']==0 and not execution['timeout'] and execution['inputsUnchanged'],'EXECUTION_RESULT')
    need(execution['host']['observation']['classification']=='NORMAL' and execution['host']['observation']['evidenceState']=='AVAILABLE','HOST')
    for row in execution['inputs']+[execution['log'],execution['installed']]:need(evidence_ref(row['path'])==row,'EXECUTION_INPUT_DRIFT')
    need(installed['archive']==wrapper.ARCHIVE and len(installed['installations'])==1 and installed['temporaryCredentialsRemoved'],'INSTALL_SCOPE')
    offline=installed['offline'];need(all(offline[k] is True for k in ['installCacheInitiallyEmpty','offlineMode','scriptsDisabled','auditDisabled','fundDisabled','installedPackageMatchesArchive']),'OFFLINE_FLAGS')
    need(offline['externalProductionDependencies']==0 and offline['projectLockPackages']==['','node_modules/memoryos-rest'],'NPM_GRAPH')
    item=installed['installations'][0];need(item['state']=='PASS' and item['fileCount']==58 and item['everyFileMatchesBeforeAndAfter'],'INTEGRITY')
    need(item['beforeInventory']==item['afterInventory']==verified['inventory'],'INSTALLED_BYTES')
    need(item['prohibitedPersistence'] is False and item['persistenceBeforeSha256']==item['persistenceAfterSha256'],'PERSISTENCE')
    need(item['execution']['state']=='PASS' and len(item['execution']['requests'])==6,'SMOKE')
    requests={r['case']:r for r in item['execution']['requests']}
    need(set(requests)=={'health','readiness','version','identities','evaluate-policy-pass','missing-auth'},'SMOKE_CASES')
    need(all(r['expectedBodyMatched'] is True and r['status']==(401 if name=='missing-auth' else 200) and r['tlsVersion']=='TLSv1.3' for name,r in requests.items()),'SMOKE_RESULTS')
    need(all(r.get('responseSchemaValidated') is True for name,r in requests.items() if name!='missing-auth'),'SMOKE_SCHEMAS')
    need(installed['sourceIndependence']['gatewayCwdRemainedEmpty'],'SERVICE_CWD')
    adverse=read('adversarial.json');metadata=read('metadata-negatives.json');tests=read('wrapper-tests.json')
    need(adverse['state']=='PASS' and adverse['caseCount']==len(adverse['cases'])==19 and all(x['state']=='PASS' for x in adverse['cases']),'ADVERSARIAL')
    need(metadata['state']=='PASS' and metadata['caseCount']==len(metadata['cases'])==34 and all(x['state']=='PASS' for x in metadata['cases']),'METADATA_NEGATIVES')
    need(tests['state']=='PASS' and tests['caseCount']==len(tests['cases']) and tests['caseCount']==18 and all(x['state']=='PASS' for x in tests['cases']),'WRAPPER_TESTS')
    tool=read('toolchain.json');need(tool['state']=='PASS' and tool['nodeVersion']=='24.21.0' and tool['npmVersion']=='11.19.0' and tool['officialZipMembersMatchExtraction'],'TOOLCHAIN')
    need(tool['node']==certify.identity(certify.NODE.read_bytes()) and tool['npmCli']==certify.identity(certify.NPM.read_bytes()),'TOOLCHAIN_BYTES')
    need(tool['authenticode']['status']=='Valid','NODE_SIGNATURE')
    verify_toolchain_inventory(tool)
    need(read('provenance.json')['state']=='PASS','PROVENANCE')
    need(read('licenses-components.json')['state']=='PASS','LICENSE_COMPONENTS')
    need(read('package-allowlist-evaluation.json')['state']=='PASS','ALLOWLIST')
    advisory=read('advisory-snapshot.json');need(advisory['state']=='PASS','ADVISORY_REVIEW')
    need(read('workspace-verification.json')['exitCode']==0,'WORKSPACE')
    return verified

def expected(created):
    verified=certify_dependencies()
    need(datetime.datetime.fromisoformat(created.replace('Z','+00:00')).tzinfo is not None,'CREATION_TIME')
    rows=[evidence_ref((E/name).relative_to(ROOT).as_posix()) for name in REQUIRED]
    # Bind all preserved installation diagnostics in addition to the named baseline failure.
    bound={r['path'] for r in rows}
    for p in sorted((E/'history').rglob('*')):
        if p.is_file() and p.relative_to(ROOT).as_posix() not in bound:rows.append(evidence_ref(p.relative_to(ROOT).as_posix()))
    tools=[evidence_ref(p.relative_to(ROOT).as_posix()) for p in sorted(HERE.iterdir()) if p.is_file() and (p.suffix in ('.py','.mjs','.md') or p.name=='.gitattributes')]
    artifacts={name:certify.ref('repositories/memoryos-rest/'+name,verified['files'][name]) for name in ['package.json','package-lock.json','contracts/api-contract.json','contracts/openapi.json','contracts/limits.json','contracts/policy-contract-identities-1.0.0.json','runtime/runtime-closure-manifest.json','dependency-manifest.json','distribution-manifest.json','sbom.spdx.json','LICENSE-NOTICE.md','NOTICES.md','notices/node-LICENSE.txt']}
    return {'kind':'MemoryOSRESTPhase3BReleaseArtifactRecertification','version':'1.0.0','state':'PASS','attempt':'continuation-2','createdUtc':created,'baseline':wrapper.C3B,'C3':wrapper.C3,'C3B':wrapper.C3B,'branch':wrapper.BRANCH,'archive':{'filename':wrapper.ARCHIVE_NAME,**wrapper.ARCHIVE},'package':{'name':'memoryos-rest','version':'0.1.0','files':58,'authoritativeRuntimeFiles':25,'externalProductionNpmDependencies':0},'artifacts':artifacts,'schema':read('schema-validation.json'),'validatorEnvironment':read('validator-inventory.json'),'evidence':sorted(rows,key=lambda r:r['path']),'tooling':tools,'productionUnchanged':True,'scope':{'offlineInstall':'fresh empty explicit cache, copied tools/fixtures, no checkout source imports','sourceIsolation':'isolated subtree inside dedicated workspace; checkout not hidden by OS','installedExecution':'bounded loopback TLS smoke; no duplicate Windows certification','supplyChain':'bounded dated authoritative review; no zero-vulnerability claim','historicalCorrection':'unchanged content checks through explicitly recorded C3B context adapter'},'finalReleaseBinding':'PENDING_PHASE_3D','releaseTag':'ABSENT','noMerge':True,'noPush':True,'noTag':True}

def validate(value):
    need(not sys.flags.optimize,'PYTHON_OPTIMIZATION_FORBIDDEN')
    need(isinstance(value,dict) and isinstance(value.get('createdUtc'),str),'FORMAT')
    need(value.get('baseline')==wrapper.C3B and value.get('C3')==wrapper.C3 and value.get('C3B')==wrapper.C3B,'ANCESTRY')
    need(value.get('archive')=={'filename':wrapper.ARCHIVE_NAME,**wrapper.ARCHIVE},'ARCHIVE')
    need(value==expected(value['createdUtc']),'CONTENT')
    return {'kind':'MemoryOSRESTPhase3BRReceiptValidation','state':'PASS','archive':wrapper.ARCHIVE,'C3':wrapper.C3,'C3B':wrapper.C3B,'evidenceCount':len(value['evidence']),'toolingCount':len(value['tooling'])}

def tests(value):
    cases=[]
    for key,code in [('C3','RECEIPT_ANCESTRY'),('archive','RECEIPT_ARCHIVE')]:
        bad=copy.deepcopy(value);bad[key]=None
        try:validate(bad)
        except ValueError as error:
            need(str(error)==code,'WRONG_NEGATIVE_REJECTION');cases.append({'name':'forged '+key,'state':'PASS','rejectedBy':str(error)})
        else:raise ValueError('RECEIPT_ACCEPTED_TAMPER')
    return {'state':'PASS','caseCount':len(cases),'cases':cases,'scope':'Actual receipt validator rejects forged ancestry and archive identity'}
if __name__=='__main__':
    p=argparse.ArgumentParser();p.add_argument('mode',choices=['create','verify']);a=p.parse_args();path=E/'receipt.json'
    if a.mode=='create':
        need(not path.exists(),'ALREADY_EXISTS');value=expected(datetime.datetime.now(datetime.timezone.utc).isoformat().replace('+00:00','Z'));path.write_bytes(certify.j(value))
    raw=path.read_bytes();value=json.loads(raw);need(raw==certify.j(value),'CANONICAL');result=validate(value);result['receipt']=certify.ref(path.relative_to(ROOT).as_posix(),raw);result['negativeTests']=tests(value)
    if a.mode=='create':certify.save('receipt-validation.json',result)
    print(json.dumps(result))
