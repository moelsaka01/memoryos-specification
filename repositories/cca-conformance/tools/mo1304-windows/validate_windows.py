"""Strict offline Windows-only evidence validator. Parity requires separate validation."""
import json,re,sys,math
from pathlib import Path
from package_verify import ARCHIVE,ARCHIVE_ID,IDENTITIES,canonical,identity,require
I2='18453aa6d0d347acece20598cf5b1bc3d174c5af'
B2='461a67f3dbb7a32132f9c76e0ea40358e6776583'
NODE_SHA='ba4e6d110e8c1592a1ecd390f6b05f3da124b13871a5be62b341a07a853c6c32'
INPUT_SHA='43880741e664d70042d5d5b8fe09b7fb25fa0cef0c5bd0b914f86febf20915ae'
SOURCE_SHA='38bf30335eb53dd873cedf2fe8abda228d212d54643dfbbf210c2a2fe2d9a554'
PENDING={'crossPlatformParity':'PENDING','parityReceipt':None,'finalReleaseBinding':'PENDING','tag':'ABSENT','macos':'UNSUPPORTED'}
KEYS={'kind','version','platform','supportedPlatform','certifiedEnvironment','architecture','os','node','npm','implementationRevision','phase2Binding','candidate','harness','testCatalog','artifacts','semanticVectors','supplyChain','coverage','pending','overall','nonNormative'}
ARTIFACT_KEYS={'execution','packageAdversarial','mechanismsStdout','mechanismsStderr','inputs','supplyChainSources','installation','harnessManifest','testCatalog','toolingManifest','toolingVerification','networkControl'}

def pairs(items):
 result={}
 for k,v in items:
  require(k not in result,'DUPLICATE_JSON_KEY');result[k]=v
 return result

def read_json(path,maximum=4*1024*1024,canonical_required=False):
 path=Path(path);require(path.stat().st_size<=maximum,'EVIDENCE_SIZE')
 raw=path.read_bytes();value=json.loads(raw.decode('utf-8'),object_pairs_hook=pairs,parse_constant=lambda x:(_ for _ in ()).throw(ValueError('NONFINITE_JSON')))
 if canonical_required:require(canonical(value)==raw,'NONCANONICAL_JSON')
 return value

def artifact(directory,entry):
 require(set(entry)=={'file','byteLength','sha256'},'ARTIFACT_KEYS')
 require(re.fullmatch(r'[a-zA-Z0-9_.-]+',entry['file']) is not None and not entry['file'].startswith('.'),'ARTIFACT_PATH')
 path=Path(directory)/entry['file'];require(path.is_file() and not path.is_symlink(),'ARTIFACT_FILE')
 require(path.stat().st_size<=4*1024*1024,'ARTIFACT_SIZE')
 raw=path.read_bytes();require(identity(raw)=={k:entry[k] for k in ['byteLength','sha256']},'ARTIFACT_IDENTITY')
 return path,raw

def validate(value,directory):
 require(set(value)==KEYS,'RECEIPT_KEYS')
 require(value['kind']=='MemoryOSMO1304WindowsCertification' and value['version']=='1.0.0','SCHEMA')
 require(value['platform']=='windows-11' and value['architecture']=='x64','PLATFORM')
 sys.path.insert(0,str(Path(__file__).resolve().parents[1]/'mo1304-platforms'))
 from support_contract import windows_environment
 windows_environment(value)
 env=value['certifiedEnvironment'];detected=env['detected']
 require(value['os']=={'prettyName':detected['caption'],'versionId':env['release'],'kernel':'10.0.'+str(detected['buildNumber']),'build':env['build']},'ACTUAL_OS')
 require(value['node']=={'version':'v24.21.0','executableSha256':NODE_SHA},'NODE')
 require(value['npm']=='11.19.0','NPM')
 require(value['implementationRevision']==I2 and value['phase2Binding']==B2,'REVISION')
 require(value['candidate']=={'archiveFilename':ARCHIVE,'archive':{'byteLength':ARCHIVE_ID[0],'sha256':ARCHIVE_ID[1]},'archiveFiles':798,'runtimeFiles':25,'dependencyFiles':748,'identities':{p:{'byteLength':n,'sha256':h} for p,(n,h) in IDENTITIES.items()}},'CANDIDATE')
 require(value['pending']==PENDING,'PENDING_PLATFORM_OR_RELEASE_STATE')
 require(value['overall']=='PASS','OVERALL')
 require(set(value['artifacts'])==ARTIFACT_KEYS,'ARTIFACT_SET')
 paths={k:artifact(directory,v) for k,v in value['artifacts'].items()}
 require(len({v['file'] for v in value['artifacts'].values()})==len(ARTIFACT_KEYS),'DUPLICATE_ARTIFACT')
 catalog=read_json(paths['testCatalog'][0],canonical_required=True)
 local_catalog=read_json(Path(__file__).with_name('test-catalog.json'),canonical_required=True)
 require(catalog==local_catalog,'TEST_CATALOG')
 require(value['testCatalog']==identity(paths['testCatalog'][1]),'TEST_CATALOG_IDENTITY')
 require(identity(paths['inputs'][1])['sha256']==INPUT_SHA,'INPUT_IDENTITY')
 inputs=read_json(paths['inputs'][0]);require(inputs['implementation']==I2 and inputs['binding']==B2,'INPUT_REVISION')
 require(inputs['provenance'].endswith('not Windows certification'),'ORACLE_SCOPE')
 execution=read_json(paths['execution'][0]);require(execution['kind']=='MemoryOSMO1304WindowsExecutionAttempt' and execution['status']=='PASS_EXECUTED_SUBSET','ACTUAL_EXECUTION')
 require(execution['implementation']==I2 and execution['binding']==B2 and execution['inputSha256']==INPUT_SHA and execution['node']=='24.21.0' and execution['nodeExecutableSha256']==NODE_SHA,'EXECUTION_IDENTITY')
 results=execution['results'];require([r['id'] for r in results]==catalog['nativePipeTests'],'EXACT_REQUIRED_TESTS')
 require(all(r['status']=='PASS' and isinstance(r['durationMs'],(int,float)) and math.isfinite(r['durationMs']) and r['durationMs']>=0 for r in results),'FAILED_REQUIRED_TEST')
 by_id={r['id']:r for r in results};require(len(by_id)==len(results),'DUPLICATE_TEST')
 require(by_id['official-protocol-catalog']['details']['catalogSha256']==identity(canonical(inputs['catalog']).removesuffix(b'\n'))['sha256'] and by_id['official-protocol-catalog']['details']['tools']==[t['name'] for t in inputs['catalog']],'TOOL_CATALOG')
 require([v['id'] for v in execution['vectors']]==catalog['semanticVectors'],'EXACT_VECTORS')
 expected={v['id']:v['expected'] for v in inputs['vectors']}
 for v in execution['vectors']:
  # The canonical product carries unmodified artifact Base64 and normative digests.
  text=canonical(expected[v['id']]).decode().removesuffix('\n')
  require(set(v)=={'id','canonicalProduct','sha256'} and v['canonicalProduct']==text and v['sha256']==identity(text.encode())['sha256'],'SEMANTIC_BYTES_OR_DIGEST')
 require(value['semanticVectors']==execution['vectors'],'RECEIPT_VECTORS')
 require(by_id['native-controls-during-active-semantic-operation']['details']=={'busy':True,'discoveryDuringSemantic':True,'listingDuringSemantic':True,'cancelledBeforePublication':True,'semanticAndSubscriptionIdsReused':True},'ACTIVE_CONTROL_COVERAGE')
 repeated=by_id['native-repeated-worker-cleanup-memory']['details'];require(repeated['operations']==30 and len(repeated['samples'])==30 and repeated['retainedGrowth']<500170752 and repeated['frozenParentBound']==500170752 and repeated['allResponsesVerified'] is True and all(s['threads']<=repeated['settledThreads']+1 for s in repeated['samples']),'REPEATED_CLEANUP')
 require(read_json(paths['networkControl'][0],canonical_required=True)=={'outsideSandbox':True,'kind':'TCP','host':'1.1.1.1','port':443,'result':'CONNECTED','payloadBytesSent':0},'OUTSIDE_SANDBOX_CONTROL')
 network=by_id['os-tcp-egress-denial']['details']
 require(network['mechanism']=='HOST_PROVIDED_WINDOWS_PROCESS_SANDBOX_TCP_EGRESS_DENIAL' and network['loopbackDenied'] is False and network['dnsDeniedByOSClaimed'] is False and network['udpDeniedByOSClaimed'] is False,'HONEST_OS_DENIAL_SCOPE')
 require(network['probes']==[{'kind':'TCP','family':4,'host':'1.1.1.1','code':'EACCES'},{'kind':'TCP','family':6,'host':'::ffff:1.1.1.1','code':'EACCES'},{'kind':'udp4','host':'1.1.1.1','code':'SENT'},{'kind':'udp6','host':'::ffff:1.1.1.1','code':'SENT'}],'OS_DENIAL_PROBES')
 require(by_id['network-guard-denial']['details']=={'mechanism':'INSTRUMENTED_NODE_API_DENIAL','osDenial':False,'probes':['TCP','listener','DNS lookup','DNS resolve','HTTP','HTTPS','TLS','UDP','fetch'],'rejected':9},'GUARD_DENIAL_PROBES')
 audit=by_id['installed-filesystem-and-supply-chain-boundary']['details']['audit']
 require(audit['code']==0 and len(audit['workers'])==19,'BOUNDARY_WORKERS')
 for a in [audit['parent'],*audit['workers']]:
  require(all(a[k]==0 for k in ['network','filesystem','writes','shell','moduleFallback','validators']) and a['reads']>0 and len(a['modules'])>0 and all(not m.startswith('..') for m in a['modules']),'BOUNDARY_VIOLATION')
 for key in [r['id'] for r in results if r['id'].startswith('maximal-')]:
  d=by_id[key]['details'];require(d['baselineRss']>0 and d['peakRss']>=d['baselineRss'] and d['attributablePeak']==d['peakRss']-d['baselineRss'] and d['attributablePeak']<=500170752 and d['frozenParentBound']==500170752 and d['durationMs']<20000,'RESOURCE_BOUND')
 package=read_json(paths['packageAdversarial'][0]);require(package['kind']=='MemoryOSMO1304WindowsPackageAdversarial' and package['status']=='PASS','PACKAGE_VERIFIER')
 require([r['id'] for r in package['results']]==catalog['packageVerifierTests'] and all(r['status']=='PASS' for r in package['results']),'PACKAGE_TEST_SET')
 require(package['archive']==value['candidate']['archive'] and package['filesystemPlatform']=='win32' and package['windowsReparseOrADSClaimed'] is True,'PACKAGE_TEST_PLATFORM')
 tap=paths['mechanismsStdout'][1].decode('utf-8');require(paths['mechanismsStderr'][1]==b'','MECHANISM_STDERR')
 for name,number in [('tests',catalog['supplementalInstalledModuleTests']),('pass',catalog['supplementalInstalledModuleTests']),('fail',0),('cancelled',0),('skipped',0),('todo',0)]:
  require(re.findall(r'^# '+name+r' (\d+)$',tap,re.M)==[str(number)],'MECHANISM_'+name)
 require(not re.search(r'^not ok ',tap,re.M),'MECHANISM_FAILURE')
 require(re.findall(r'^ok \d+ - (.+)$',tap,re.M)==catalog['supplementalInstalledModuleTestNames'],'EXACT_MECHANISM_TESTS')
 install=read_json(paths['installation'][0]);require(install['exitCode']==0 and install['networkDenied'] is False and install['npmOffline'] is True and install['verified']['archiveFiles']==798,'OFFLINE_INSTALL')
 cmd=install['command'];require(cmd[0].endswith('\\.cache\\mo1304-windows-cert\\runtime\\node.exe') and cmd[1]==str(Path(cmd[0]).parent/'node_modules/npm/bin/npm-cli.js'),'INSTALL_TOOLCHAIN')
 require(all(x in cmd for x in ['--offline','--ignore-scripts','--no-audit','--no-fund','--no-save','--omit=dev','--cache','--prefix']) and cmd[-1].endswith('repositories\\memoryos-mcp\\out\\phase2\\'+ARCHIVE),'INSTALL_COMMAND')
 require(identity(paths['supplyChainSources'][1])['sha256']==SOURCE_SHA,'SUPPLY_CHAIN_SOURCES')
 sources=read_json(paths['supplyChainSources'][0]);records=sources['records']
 require(all(sorted(v for v in r['value']['versions'] if '-' not in v)==['2.0.0'] for r in records[:3]),'SDK_GRAPH_CHANGED')
 require(all(r['value']==[] for r in records[5:]),'NEW_COMPONENT_ADVISORY')
 affected={'GHSA-f65p-4m7j-42xc','GHSA-jqff-g426-hqxp','GHSA-7p8r-x3mc-p8w7','GHSA-v2hh-gcrm-f6hx','GHSA-4c8g-83qw-93j6','GHSA-q3j6-qgpj-74h6','GHSA-v39h-62p7-jpjc','GHSA-qw65-cvwx-89v3','GHSA-hrr3-gc8f-f4qj'}
 selected=[a for a in records[4]['value'] if a['ghsa_id'] in affected]
 require(len(selected)==9 and sum(a['severity']=='high' for a in selected)==8 and sum(a['severity']=='medium' for a in selected)==1,'ADVISORY_COUNTS')
 require(value['supplyChain']=={'component':'fast-uri','version':'3.1.0','patched':False,'affectedHigh':8,'affectedModerate':1,'applicableHigh':0,'compatiblePatchedStableSDKAvailable':False,'disposition':'AFFECTED_COMPONENT_PRESENT_NO_APPLICABLE_PATH_IN_FROZEN_INSTALLED_SURFACE','residualRisk':'Accepted only for the frozen surface under the existing policy; validators/URI schema paths remain unreachable in observed installed parent and worker execution. Not patched; not zero vulnerabilities.'},'SUPPLY_CHAIN_DISPOSITION')
 require(value['coverage']=={'nativePipeTests':len(catalog['nativePipeTests']),'packageVerifierTests':len(catalog['packageVerifierTests']),'supplementalInstalledModuleTests':catalog['supplementalInstalledModuleTests'],'network':'WINDOWS_SANDBOX_TCP_EGRESS_DENIAL_AND_INSTRUMENTED_NODE_API_DENIAL','filesystem':'INSTRUMENTED_INSTALLED_PARENT_AND_WORKERS','windowsSpecificFilesystemClaims':True},'COVERAGE')

 require(identity(paths['toolingManifest'][1])=={'byteLength':3860,'sha256':'2c720b5621539a62723ff13364481e89cc083a0126e6cd2420a3a0910eeea5f2'},'TOOLING_MANIFEST')
 tooling_manifest=read_json(paths['toolingManifest'][0]);tooling=read_json(paths['toolingVerification'][0])
 require(tooling['kind']=='MemoryOSMO1304CertificationToolingVerification' and tooling['version']=='1.0.0' and tooling['status']=='PASS' and tooling['productionDependency'] is False,'TOOLING_VERIFICATION')
 require(len(tooling['packages'])==13,'TOOLING_PACKAGE_SET')
 for original,installed in zip(tooling_manifest['files'],tooling['packages']):
  require(installed['name']==original['package'] and installed['version']==original['version'] and installed['tarballSha256']==original['sha256'] and installed['fileCount']>0 and re.fullmatch(r'[0-9a-f]{64}',installed['closure']['sha256']) is not None,'TOOLING_IDENTITY')
 require(value['harness']==identity(paths['harnessManifest'][1]),'HARNESS_IDENTITY')
 manifest=read_json(paths['harnessManifest'][0],canonical_required=True)
 require(manifest['kind']=='MemoryOSMO1304WindowsHarnessManifest' and manifest['version']=='1.0.0','HARNESS_MANIFEST')
 from manifest_files import REQUIRED
 names=[f['path'] for f in manifest['files']];require(names==REQUIRED,'HARNESS_FILE_SET')
 # When source is present, each trusted transferred file must match the bound run.
 for entry in manifest['files']:
  require(re.fullmatch(r'[a-zA-Z0-9_.-]+',entry['path']) is not None,'HARNESS_PATH')
  local=Path(__file__).with_name(entry['path']);require(local.is_file() and identity(local.read_bytes())=={k:entry[k] for k in ['byteLength','sha256']},'HARNESS_FILE_IDENTITY')
 require(isinstance(value['nonNormative'],dict),'METADATA')
 return {'status':'PASS','platform':'windows-11','nativePipeTests':len(results),'packageTests':len(package['results']),'mechanismTests':catalog['supplementalInstalledModuleTests'],'windows':'PASS','parity':'PENDING'}

if __name__=='__main__':
 require(len(sys.argv)==2,'USAGE')
 path=Path(sys.argv[1]);v=read_json(path,canonical_required=True)
 print(json.dumps(validate(v,path.parent),sort_keys=True))
