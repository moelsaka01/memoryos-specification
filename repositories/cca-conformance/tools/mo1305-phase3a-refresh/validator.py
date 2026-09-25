"""Read-only C3/C3B Windows refresh receipt gate; never installs or runs a gateway."""
from pathlib import Path
import argparse,copy,hashlib,ipaddress,json,math,os,re,subprocess,sys
sys.dont_write_bytecode=True
HERE=Path(__file__).resolve().parent
ROOT=HERE.parents[3]
sys.path.insert(0,str(HERE))
import preflight as authority
E='repositories/cca-conformance/evidence/mo1305-phase3a-refresh/'
T='repositories/cca-conformance/tools/mo1305-phase3a-refresh/'
PKG=authority.PKG
C3=authority.C3
C3B=authority.C3B
A3=authority.A3
ARCHIVE=authority.ARCHIVE
NAMES=('preflight','windows','runtime','installation','installed-files','execution','probe','post-integrity','cleanup','harness')
EMPTY={'byteLength':0,'sha256':hashlib.sha256(b'').hexdigest()}
DEFAULT_NODE=ROOT/'.cache/mo1304-phase3-toolchain/node-v24.21.0-win-x64/node.exe'


def require(ok,code):
 if not ok:raise ValueError(code)


def canonical(value):return authority.canonical(value)
def identity(value):return authority.identity(value)


def parse(data):
 require(len(data)<=16*1024*1024,'JSON_BOUND')
 def pairs(rows):
  result={}
  for k,v in rows:
   require(k not in result,'DUPLICATE_JSON_KEY');result[k]=v
  return result
 value=json.loads(data,object_pairs_hook=pairs,parse_constant=lambda _:(_ for _ in ()).throw(ValueError('NONFINITE_JSON')))
 require(canonical(value)==data,'NONCANONICAL_JSON')
 return value


def read(name):return parse((ROOT/name).read_bytes())
def reference(name):
 require(isinstance(name,str) and not Path(name).is_absolute() and '..' not in Path(name).parts and '\\' not in name and ':' not in name,'REFERENCE_PATH')
 require((ROOT/name).resolve().is_relative_to(ROOT.resolve()),'REFERENCE_ESCAPE')
 return {'path':name,**identity((ROOT/name).read_bytes())}


def digest(value,maximum=2**24):
 require(type(value)==dict and set(value)=={'byteLength','sha256'},'DIGEST_SHAPE')
 require(type(value['byteLength'])==int and 0<=value['byteLength']<=maximum,'DIGEST_LENGTH')
 require(isinstance(value['sha256'],str) and re.fullmatch('[0-9a-f]{64}',value['sha256']),'DIGEST_HASH')


def refs(value):
 if isinstance(value,dict):
  if set(value)=={'path','byteLength','sha256'}:require(reference(value['path'])==value,'ARTIFACT_DRIFT:'+value['path'])
  for child in value.values():refs(child)
 elif isinstance(value,list):
  for child in value:refs(child)


def evidence():return {n:read(E+n+'.json') for n in NAMES}


def current_inputs():
 candidate=read(authority.EVIDENCE+'candidate.json')
 expected=candidate['inventory']
 require(len(expected)==58 and len({r['path'] for r in expected})==58,'CANDIDATE_MEMBERS')
 frozen=authority.blobs(C3B,[PKG+r['path'] for r in expected])
 for row in expected:
  name=PKG+row['path'];actual=(ROOT/name).read_bytes()
  require(actual==frozen[name] and identity(actual)=={k:row[k] for k in ('byteLength','sha256')},'PRODUCTION_CHANGED:'+name)
 require(not authority.git('diff','--name-only',C3B,'--','repositories/memoryos-rest').strip(),'PRODUCT_DIFF')
 return expected


def validate_installation(x,expected,runtime):
 require(x['kind']=='MemoryOSRESTWindowsRefreshInstallation' and x['version']=='1.0.0' and x['state']=='PASS' and 'failure' not in x,'INSTALLATION_STATE')
 require(x['bindingRevision']==C3B and x['archive']==ARCHIVE and x['installCount']==1,'INSTALLATION_BINDING')
 require(x['offline']=={'cacheInitiallyEmpty':True,'offline':True,'ignoreScripts':True,'noAudit':True,'noFund':True,'externalProductionDependencies':0,'packageLockPackages':['','node_modules/memoryos-rest']},'OFFLINE_POLICY')
 require(x['sourceIndependence']=={'outsideCheckout':True,'freshDirectory':True,'emptyServiceCwd':True,'copiedArchive':True,'copiedToolchain':True,'copiedFixturesAndHarness':True,'closedVerifiedImports':True,'checkoutHiddenByOS':False},'SOURCE_INDEPENDENCE')
 commands=x['commands'];install=[r for r in commands if 'install' in r['argv']]
 require(len(install)==1,'ONE_INSTALL_COMMAND')
 row=install[0]
 require(row['exitCode']==0 and row['argv'][:3]==['$ISOLATED\\toolchain\\node.exe','$ISOLATED\\toolchain\\node_modules\\npm\\bin\\npm-cli.js','install'],'INSTALL_COMMAND_NODE')
 for flag in ('--offline','--ignore-scripts','--no-audit','--no-fund','--cache','--userconfig','--globalconfig'):require(flag in row['argv'],'INSTALL_FLAG:'+flag)
 require(row['argv'][row['argv'].index('--cache')+1]=='$ISOLATED\\install-cache','EXPLICIT_EMPTY_CACHE')
 require(row['argv'][-1]=='$ISOLATED\\memoryos-rest-0.1.0.tgz','INSTALL_ARCHIVE')
 require([r['exitCode'] for r in commands]==[0]*9+[2]*5,'INSTALL_COMMAND_EXITS')
 for row in commands:digest(row['stdout'],2**20);digest(row['stderr'],2**20)
 require(x['preIntegrity']=={'fileCount':58,'files':expected,'inventorySha256':identity(canonical(expected))['sha256']},'PRE_INTEGRITY')
 metadata={r['path']:r for r in expected if r['path'].startswith('contracts/') or r['path'] in ('dependency-manifest.json','distribution-manifest.json','sbom.spdx.json','runtime/runtime-closure-manifest.json')}
 require(x['installedMetadata']==metadata,'INSTALLED_METADATA')
 require(x['installedValidation']=={'fileCount':58,'closureFileCount':25,'spdxFullSchema':'PASS','spdxSemantics':'PASS','distribution':'PASS','sourceProvenance':'PASS'},'INSTALLED_VALIDATION')
 closure=read(PKG+'runtime/runtime-closure-manifest.json')['files']
 oracle=[{'source':r['source'],'path':r['path'],'byteLength':r['byteLength'],'sha256':r['sha256']} for r in closure]
 require(x['oracle']['count']==25 and x['oracle']['files']==oracle and 'independent authoritative' in x['oracle']['source'],'ORACLE_INDEPENDENCE')
 for row in oracle:require(identity((ROOT/row['source']).read_bytes())=={k:row[k] for k in ('byteLength','sha256')},'ORACLE_SOURCE')
 fixture_names=['index','identities','prepare-policy-pass','prepare-policySet-pass','evaluate-policy-pass','evaluate-policy-fail','evaluate-policy-cne','evaluate-policySet-pass','verify-identity','verify-outcome']
 fixtures=sorted([{'path':n+'.json',**identity((ROOT/'repositories/cca-conformance/fixtures/mo1305-phase1'/(n+'.json')).read_bytes())} for n in fixture_names],key=lambda r:r['path'])
 require(x['fixtures']==fixtures,'FIXTURE_IDENTITIES')
 require({r['path'] for r in x['harness']}=={'common.mjs','bounded-fetch-client.mjs','probe.mjs'},'EXECUTED_PROBE_MEMBERS')
 for row in x['harness']:require(row=={'path':row['path'],**identity((HERE/row['path']).read_bytes())},'EXECUTED_PROBE_HARNESS')
 launcher=x['trustedLauncher'];require(launcher['valid']=='PASS' and launcher['runtimeSubstitution']=='REFUSED_BEFORE_NODE_START','TRUSTED_LAUNCHER')
 require([r['variable'] for r in launcher['environment']]==['NODE_PATH','NODE_OPTIONS','NODE_OPTIONS','NODE_OPTIONS'] and all(r['state']=='REFUSED_BEFORE_NODE_START' for r in launcher['environment']),'LAUNCH_ENVIRONMENT')
 require(runtime['node']=={'byteLength':93580104,'sha256':authority.NODE_SHA} and runtime['nodeVersion']=='24.21.0' and runtime['npmVersion']=='11.19.0' and runtime['npmCli']['sha256']==authority.NPM_SHA,'TOOLCHAIN_VERSION_HASH')
 require(runtime['platform']=='win32' and runtime['architecture']=='x64' and runtime['executable']=='$ISOLATED/toolchain/node.exe','TOOLCHAIN_PLATFORM')
 require(runtime['toolchainFileCount']==1994 and runtime['toolchainInventorySha256']=='8576929965bf577960cfe6b9d1e6fe9d46f0cf4d7ad10d3a4c6c7ac039996c34','TOOLCHAIN_INVENTORY')
 require(runtime['processVersions']==read(PKG+'dependency-manifest.json')['runtime']['components'],'TOOLCHAIN_COMPONENTS')
 require(runtime['curl']['executable']=='C:\\Windows\\System32\\curl.exe' and runtime['curl']['byteLength']>0 and runtime['curl']['versionOutput'].startswith('curl '),'CURL_IDENTITY')
 if x['remote']['available']:
  address=ipaddress.IPv4Address(x['remote']['address'])
  require(any(address in ipaddress.IPv4Network(n) for n in ('10.0.0.0/8','172.16.0.0/12','192.168.0.0/16')),'REMOTE_RFC1918')
 else:require(x['remote']['address']=='','REMOTE_ABSENCE')


def validate_platform(x):
 require(x['kind']=='MemoryOSRESTWindowsHostIdentity' and x['version']=='1.0.0','HOST_KIND')
 require(x['osName']=='Windows 11' and 'Windows 11' in x['osEdition'] and x['architecture']=='x64' and x['osArchitecture']=='64-bit','SUPPORTED_HOST')
 require(x['processorArchitecture'] and all(n==9 for n in x['processorArchitecture']) and all(n==64 for n in x['processorAddressWidth']),'HOST_CPU')
 require(re.fullmatch(r'[0-9]+\.[0-9]+',x['osBuild']) and int(x['osBuild'].split('.')[0])>=22000 and x['osRelease'],'HOST_BUILD')


def process_record(row):
 require(row['entry']=='installed/bin/memoryos-rest.mjs' and type(row['pid'])==int and row['pid']>0,'GATEWAY_PROCESS')
 require(row['exitCode'] in (0,2) and row['signal'] is None and type(row['elapsedMs'])==int and row['elapsedMs']>=0,'PROCESS_EXIT')
 require(row['stdout']==EMPTY and row['logCount']>=1 and row['secretFreeLogs'] is True and row['cwdRemainedEmpty'] is True,'PROCESS_DIAGNOSTICS')
 digest(row['stderr'],262144)
 require(row['startupObserved'] is (row['exitCode']==0) and row['shutdownObserved'] is (row['exitCode']==0),'PROCESS_LIFECYCLE')


def validate_integrity(post,cleanup,expected):
 require(post['kind']=='MemoryOSRESTWindowsRefreshInstalledIntegrity' and post['state']=='PASS' and post['fileCount']==58,'POST_INTEGRITY_KIND')
 require(post['before']==post['after']==expected and post['inventorySha256']==identity(canonical(expected))['sha256'],'POST_INTEGRITY_ROWS')
 require(post['unchanged'] is True and post['gatewayCwdEmpty'] is True and post['gatewayTempEmpty'] is True,'POST_PERSISTENCE')
 require(cleanup['state']=='PASS' and cleanup['temporaryCredentialsRemoved'] is True and cleanup['credentialDirectoryAbsent'] is True and cleanup['isolatedInstallRetained'] is True,'CREDENTIAL_CLEANUP')
 require(cleanup['secretScan']=='PASS' and type(cleanup['scannedFileCount'])==int and cleanup['scannedFileCount']>0,'CLEANUP_SECRET_SCAN')


def validate_harness(harness):
 rows=harness['files']
 require(rows==sorted(rows,key=lambda r:r['path']) and len(rows)==len({r['path'] for r in rows}),'HARNESS_MEMBERSHIP')
 required={T+n for n in ['prepare.py','preflight.py','execute.mjs','probe.mjs','common.mjs','bounded-fetch-client.mjs','windows.ps1','private-acl.ps1','finish.py']}
 required|={'repositories/cca-conformance/tools/'+n for n in ['mo1305-host-guard.mjs','mo1305-host-guard-policy.json','mo1305-host-events.ps1','mo1305-phase1/validate-launch.ps1']}
 require(required<={r['path'] for r in rows},'HARNESS_REQUIRED_INPUTS')
 refs(rows)
 frozen_names=[n for n in required if n not in {T+x for x in ['prepare.py','preflight.py','execute.mjs','probe.mjs','common.mjs','bounded-fetch-client.mjs','windows.ps1','private-acl.ps1','finish.py']}]
 frozen=authority.blobs(C3B,frozen_names)
 for name,data in frozen.items():require((ROOT/name).read_bytes()==data,'FROZEN_GUARD:'+name)


def normalize_stamp(stamp,domain):
 return {'domain':stamp.get('domain',domain),'ns':stamp.get('ns',stamp.get('monotonicNs')),'utcMs':stamp['utcMs']}


def validate_execution(x,probe,node):
 require(x['kind']=='MemoryOSRESTWindowsRefreshExecution' and x['version']=='1.0.0' and x['state']=='PASS','EXECUTION_STATE')
 require(x['result']=={'code':0,'signal':None} and x['timeout'] is False and x['overflow'] is False,'EXECUTION_RESULT')
 require(x['probe']==reference(E+'probe.json') and x['harness']==reference(E+'harness.json'),'EXECUTION_INPUT_BINDING')
 digest(x['stdout'],2**20);digest(x['stderr'],2**20)
 require(x['stderr']==EMPTY,'PROBE_STDERR')
 require(type(x['pid'])==int and x['pid']>0,'PROBE_PROCESS_ID')
 remote_address=probe['remote'].get('address','')
 require(x['command']=={'node':'$ISOLATED/toolchain/node.exe','argv':['$ISOLATED\\harness\\probe.mjs','$ISOLATED\\project\\node_modules\\memoryos-rest','$ISOLATED\\private\\config.json','$ISOLATED\\fixtures','$ISOLATED\\oracle','$ISOLATED\\results','C:\\Windows\\System32\\curl.exe',remote_address]},'INSTALLED_EXECUTION_COMMAND')
 host=x['host'];observation=host['observation']
 require(observation['classification']=='NORMAL' and observation['evidenceState']=='AVAILABLE' and observation['overlaps']==[] and observation['reason'] is None,'HOST_ACCEPTANCE')
 require(host['events']['state']=='AVAILABLE','HOST_EVENTS')
 base={'attemptId':'targeted-refresh-1','candidateId':ARCHIVE['sha256'],'phase':'phase3a-refresh','index':0}
 windows=[{**base,'start':x['start'],'end':x['end'],'caseId':'bounded-installed-refresh','sampleId':'targeted-refresh-1'}]
 for index,row in enumerate(probe['records']):
  windows.append({**base,'index':index,'start':normalize_stamp(row['start'],probe['timestampDomain']),'end':normalize_stamp(row['end'],probe['timestampDomain']),'caseId':row['id'],'sampleId':row['id']})
 for window in windows:
  start,end=window['start'],window['end']
  require(start['domain']==end['domain'] and start['domain'].startswith('MONOTONIC_') and re.fullmatch('[0-9]+',start['ns']) and re.fullmatch('[0-9]+',end['ns']),'MONOTONIC_WINDOW')
  elapsed=(int(end['ns'])-int(start['ns']))/1e6
  require(elapsed>=0 and abs(end['utcMs']-start['utcMs']-elapsed)<=250,'CLOCK_CORRELATION')
 guard=ROOT/'repositories/cca-conformance/tools/mo1305-host-guard.mjs'
 source="import {readFileSync} from 'node:fs';const x=JSON.parse(readFileSync(0));const {classify,policySha256}=await import(x.guard);process.stdout.write(JSON.stringify({policySha256,rows:x.windows.map(w=>classify(w,x.events))}));"
 args={'guard':guard.as_uri(),'windows':windows,'events':host['events']}
 clean={k:v for k,v in os.environ.items() if k.upper() in ('SYSTEMROOT','WINDIR','TEMP','TMP')}
 result=subprocess.run([str(node),'--input-type=module','-e',source],input=canonical(args),capture_output=True,cwd=ROOT,env=clean,timeout=30,creationflags=getattr(subprocess,'CREATE_NO_WINDOW',0))
 require(result.returncode==0 and result.stderr==b'','HOST_RECOMPUTATION_PROCESS')
 actual=json.loads(result.stdout)
 require(host['policySha256']==actual['policySha256'] and observation==actual['rows'][0] and host['caseObservations']==actual['rows'][1:],'HOST_RECOMPUTATION')
 require(all(r['classification']=='NORMAL' and r['evidenceState']=='AVAILABLE' and r['overlaps']==[] for r in actual['rows']),'HOST_CASE_ACCEPTANCE')


def build_receipt(data=None):
 data=evidence() if data is None else data
 p=data['preflight'];probe=data['probe'];runtime=data['runtime'];host=data['windows']
 return {'kind':'MemoryOSRESTWindowsRefreshReceipt','version':'1.0.0','state':'PASS','implementationRevision':C3,'bindingRevision':C3B,'historicalRevision':A3,
  'archive':ARCHIVE,'openapi':authority.OPENAPI,'sbom':authority.SBOM,'spdxFullSchemaErrors':0,
  'platform':{k:host[k] for k in ('osName','osEdition','osRelease','osVersion','osBuild','architecture')},
  'toolchain':{'node':{'version':'24.21.0',**runtime['node']},'npm':{'version':'11.19.0',**runtime['npmCli']},'curl':{k:runtime['curl'][k] for k in ('byteLength','sha256','versionOutput')}},
  'package':{'name':'memoryos-rest','version':'0.1.0','fileCount':58,'authoritativeClosureCount':25,'externalProductionDependencies':0,'installedInventorySha256':data['post-integrity']['inventorySha256']},
  'runtimeReuse':{'state':'BYTE_IDENTICAL','unchangedPackageMembers':52,'executableRuntimeMembers':42,'authoritativeClosureMembers':25,'historicalReceipt':p['historicalEvidence']['receipt'],'historicalState':'PASS','freshRuntimeCampaign':'bounded targeted confirmation','historicalCasesCountedAsFresh':False},
  'results':{'state':'PASS','recordCount':len(probe['records']),'caseIds':sorted(r['id'] for r in probe['records']),'semanticCapabilities':probe['semantic']['capabilities'],'decisions':probe['semantic']['decisions'],'clients':['curl','node-fetch','raw-tls'],'remote':probe['remote'],'hostInterruptionCount':0,'prePostInstalledIntegrity':'PASS'},
  'limits':p['limits'],
  'evidence':{n:reference(E+n+'.json') for n in NAMES},
  'validationTooling':[reference(T+'validator.py')],
  'limitations':['Historical certification remains bound to the original B2 archive; only mechanically identical runtime evidence is reused.','Windows certification covers the actual supported Windows 11 x64 host and same-host assigned RFC1918 mode where available.','FINAL deadline 31400 ms is unchanged; 60000 ms is the absolute authority ceiling. Resource characterization was not repeated.','This receipt does not complete Phase 3B-R, Phase 3C-R or Phase 3D integration.']}


def validate_receipt(receipt,data):
 require(receipt==build_receipt(data),'REFRESH_RECEIPT_CONTENT')
 refs(receipt['evidence']);refs(receipt['validationTooling'])


def validate_all(node,*,recheck_preflight=True):
 node=node.resolve(strict=True)
 require(identity(node.read_bytes())=={'byteLength':93580104,'sha256':authority.NODE_SHA},'VALIDATOR_TRUSTED_NODE')
 data=evidence();expected=current_inputs()
 if recheck_preflight:require(authority.validate(node)==data['preflight'],'FRESH_PREFLIGHT_DRIFT')
 require(data['installed-files']=={'files':expected},'INSTALLED_FILES_CATALOG')
 validate_platform(data['windows']);validate_installation(data['installation'],expected,data['runtime'])
 validate_harness(data['harness']);validate_integrity(data['post-integrity'],data['cleanup'],expected)
 validate_probe(data['probe'],data['installation'],data['runtime'])
 validate_execution(data['execution'],data['probe'],node)
 validate_receipt(read(E+'windows-refresh-receipt.json'),data)
 return data,expected


def validate_probe(x,installation,runtime):
 import base64
 require(x['kind']=='MemoryOSRESTPhase3ARefreshProbe' and x['version']=='1.0.0' and x['state']=='PASS' and x['selectedGroup'] is None and 'failure' not in x,'PROBE_STATE')
 fixture_names=['identities','prepare-policy-pass','prepare-policySet-pass','evaluate-policy-pass','evaluate-policy-fail','evaluate-policy-cne','evaluate-policySet-pass','verify-identity','verify-outcome']
 fixtures={n:read('repositories/cca-conformance/fixtures/mo1305-phase1/'+n+'.json') for n in fixture_names}
 semantic_ids=['raw-'+n for n in fixture_names]
 security_ids='auth-missing auth-wrong missing-host missing-host-missing-auth bad-host-invalid-auth host-alias tls12-refused filesystem-field command-field opaque-filesystem-path opaque-file-uri calibrated-url-no-acquisition url-field-no-fetch opaque-url-no-fetch sentinel-prepare-policy-pass private-input-rejected secret-safe-diagnostics'.split()
 refusal_ids='remote-without-opt-in remote-wildcard-refused remote-public-refused environment-node-options environment-node-path environment-http-proxy runtime-inspect-argument runtime-closure-substitution'.split()
 limit_ids=['body-prepare-4096','body-prepare-4097','header-count-33','header-value-1025','target-257']
 remote_ids=['remote-explicit-opt-in-start','remote-auth-required','remote-identities','remote-shutdown-cleanup'] if installation['remote']['available'] else []
 groups={'semantic':['health','readiness','version']+semantic_ids,'clients':['node-fetch-bounded','curl-bounded'],'security':security_ids,'limits':limit_ids,'lifecycle':['shutdown-partial-socket-and-rebind'],'startup':refusal_ids+['post-refusal-recovery'],'remote':remote_ids}
 expected_ids={'independent-oracle-and-final-limits'}|{n for group in groups.values() for n in group}
 rows=x['records'];require(len(rows)==len(expected_ids) and {r['id'] for r in rows}==expected_ids,'PROBE_CASE_MEMBERSHIP')
 require(all(r['state']=='PASS' and 'failure' not in r for r in rows),'PROBE_CASE_PASS')
 by_id={r['id']:r for r in rows}
 require(len(x['groups'])==7 and [r['id'] for r in x['groups']]==list(groups),'PROBE_GROUP_MEMBERSHIP')
 for group in x['groups']:
  require(group['state']=='PASS' and len(group['caseIds'])==len(groups[group['id']]) and set(group['caseIds'])==set(groups[group['id']]),'GROUP_CASE_MEMBERSHIP')
  require(all(by_id[name]['group']==group['id'] for name in group['caseIds']),'CASE_GROUP')
 for row in rows+x['groups']:
  start,end=row['start'],row['end']
  require(type(start['utcMs'])==type(end['utcMs'])==int and re.fullmatch('[0-9]+',start['monotonicNs']) and re.fullmatch('[0-9]+',end['monotonicNs']),'PROBE_WINDOW')
  elapsed=(int(end['monotonicNs'])-int(start['monotonicNs']))/1e6
  require(elapsed>=0 and abs(end['utcMs']-start['utcMs']-elapsed)<=250,'PROBE_CLOCK_CORRELATION')
 require(x['timestampDomain']=='MONOTONIC_PROCESS_HRTIME','PROBE_CLOCK_DOMAIN')
 closure=read(PKG+'runtime/runtime-closure-manifest.json')
 oracle=x['oracle']
 require(oracle['source']=='independent authoritative/web/js/memoryos-sdk.js' and oracle['sdkVersion']=='1.1.0' and oracle['closureFileCount']==25,'PROBE_ORACLE_IDENTITY')
 require(oracle['closureManifest']==identity((ROOT/(PKG+'runtime/runtime-closure-manifest.json')).read_bytes()) and oracle['files']==installation['oracle']['files'],'PROBE_ORACLE_CLOSURE')
 require(oracle['freshlyComputed'] is True and oracle['ownerPerOperation'] is True and oracle['restAsOracle'] is False and oracle['retainedFixtureExpectedUsedOnlyForDriftCheck'] is True,'PROBE_ORACLE_PROVENANCE')
 require(x['fixtureIndex']==identity((ROOT/'repositories/cca-conformance/fixtures/mo1305-phase1/index.json').read_bytes()),'PROBE_FIXTURE_INDEX')
 require(x['limits']=={'identity':identity((ROOT/(PKG+'contracts/limits.json')).read_bytes()),'state':'FINAL','operationMs':31400,'absoluteCeilingMs':60000,'liveDeadlineCampaignRepeated':False},'PROBE_FINAL_LIMITS')
 api=read(PKG+'contracts/api-contract.json')
 capabilities=sorted(r['operationId'] for r in api['routes'] if r['category']=='semantic')
 decisions=['COULD_NOT_EVALUATE','FAIL','PASS']
 require(x['semantic']=={'state':'PASS','capabilities':capabilities,'decisions':decisions,'fixtureCount':9,'independentSdkParity':True},'SEMANTIC_COVERAGE')
 raw_transport={'tlsVersion':'TLSv1.3','alpn':'http/1.1','certificateAuthorized':True}
 def response(row,expected,raw=False):
  require(row['httpStatus']==(200 if expected['status']=='ok' else 422),'RESPONSE_STATUS:'+row.get('id',row.get('caseId','client')))
  require(row['responseBody']==row['expectedBody']==identity(canonical(expected)) and row['exactCanonicalResponse'] is True,'EXACT_RESPONSE_BODY')
  require(row['decision']==expected.get('decision'),'SEMANTIC_DECISION')
  products={k:expected[k] for k in ('documentDigest','semanticDigest','evaluationIdentityDigest','outcomeDigest') if k in expected}
  for key in ('canonicalArtifactBase64','evaluationIdentityBase64','outcomeBase64'):
   if key in expected:products[key.replace('Base64','')]=identity(base64.b64decode(expected[key],validate=True))
  require(row['normativeProducts']==products,'NORMATIVE_PRODUCTS')
  if raw:require(row['transport']==raw_transport,'RAW_TLS_TRANSPORT')
 def semantic(row,name):
  item=fixtures[name]
  require(row['operation']==item['operation'] and row['independentSdkParity'] is True,'SEMANTIC_OPERATION')
  require(row['fixture']=={'path':name+'.json',**identity((ROOT/('repositories/cca-conformance/fixtures/mo1305-phase1/'+name+'.json')).read_bytes())},'SEMANTIC_FIXTURE')
  response(row,item['expected'],True)
 for name in fixture_names:semantic(by_id['raw-'+name],name)
 require(sorted({by_id[n]['operation'] for n in semantic_ids})==capabilities and sorted({by_id['raw-evaluate-policy-'+n]['decision'] for n in ('pass','fail','cne')})==decisions,'DERIVED_SEMANTIC_COVERAGE')
 semantic(by_id['sentinel-prepare-policy-pass'],'prepare-policy-pass')
 for name,expected in [('health',{'status':'ok','live':True}),('readiness',{'status':'ok','ready':True}),('version',{k:v['const'] for k,v in api['schemas']['$defs']['Version']['properties'].items()}),('post-refusal-recovery',{'status':'ok','live':True})]:response(by_id[name],expected,True)
 fetch=by_id['node-fetch-bounded'];require(fetch['client']=='node-fetch' and fetch['certificateVerification'] is True and fetch['customCaConfiguredAtProcessStartup'] is True,'FETCH_CERTIFICATE_POLICY')
 require([r['caseId'] for r in fetch['checks']]==['identities','evaluate-policy-pass'],'FETCH_CASE_MEMBERSHIP')
 for row in fetch['checks']:
  require(row['operation']==fixtures[row['caseId']]['operation'] and row['independentSdkParity'] is True,'FETCH_OPERATION')
  response(row,fixtures[row['caseId']]['expected'])
 curl=by_id['curl-bounded'];require(curl['client']=='curl' and curl['caseId']=='prepare-policySet-pass' and curl['operation']=='preparePolicySet' and curl['independentSdkParity'] is True,'CURL_CASE')
 require(curl['executable']=={k:runtime['curl'][k] for k in ('byteLength','sha256')} and curl['version']==runtime['curl']['versionOutput'].splitlines()[0],'CURL_EXECUTABLE')
 require(curl['transport']=={'httpVersion':'1.1','minimumTls':'1.3','maximumTls':'1.3','sslVerifyResult':0},'CURL_TLS_POLICY')
 response(curl,fixtures['prepare-policySet-pass']['expected'])
 for row in [fetch['process'],curl['process']]:
  require(type(row['pid'])==int and row['pid']>0 and row['exitCode']==0 and row['signal'] is None,'CLIENT_PROCESS_EXIT');digest(row['stdout'],262144);digest(row['stderr'],65536)
 require(fetch['process']['stderr']==EMPTY,'FETCH_STDERR')
 expected_curl_stderr=identity(b'HTTP_VERSION=1.1\nSSL_VERIFY_RESULT=0\n')
 require(curl['process']['stderr'] in [expected_curl_stderr,identity(b'HTTP_VERSION=1.1\r\nSSL_VERIFY_RESULT=0\r\n')],'CURL_VERIFICATION_OUTPUT')
 errors={n:(401,'UNAUTHENTICATED') for n in ['auth-missing','auth-wrong','missing-host-missing-auth','bad-host-invalid-auth']}
 errors.update({n:(403,'FORBIDDEN') for n in ['missing-host','host-alias']})
 errors.update({n:(400,'REQUEST_SCHEMA') for n in ['filesystem-field','command-field','url-field-no-fetch','private-input-rejected']})
 errors.update({'body-prepare-4097':(413,'INPUT_LIMIT'),'header-count-33':(431,'HEADER_LIMIT'),'header-value-1025':(431,'HEADER_LIMIT'),'target-257':(414,'TARGET_LIMIT')})
 if remote_ids:errors['remote-auth-required']=(401,'UNAUTHENTICATED')
 for name,(status,code) in errors.items():
  row=by_id[name];code='MO1305_'+code
  require(row['httpStatus']==status and row['code']==code and row['responseBody']==identity(canonical({'status':'error','error':{'code':code,'semantic':None}})),'SECURITY_ERROR_BODY:'+name)
  require(row['tlsVersion']=='TLSv1.3' and row['alpn']=='http/1.1' and row['certificateAuthorized'] is True,'SECURITY_TLS')
 body=by_id['body-prepare-4096'];require(body['httpStatus']==200 and body['code'] is None and body['responseBody']==identity(canonical(fixtures['prepare-policy-pass']['expected'])),'EXACT_BOUNDARY_ACCEPTANCE')
 tls=by_id['tls12-refused'];require(tls['secureConnection'] is False and tls['httpBytes']==0 and isinstance(tls['errorCode'],str) and tls['errorCode'],'TLS12_REFUSAL')
 for name in ['opaque-filesystem-path','opaque-file-uri','opaque-url-no-fetch']:
  row=by_id[name];require(row['httpStatus']==422 and row['code']=='MO1305_SEMANTIC_REJECTED' and row['inputHandledAsInlineArtifact'] is True,'OPAQUE_AUTHORITY');digest(row['responseBody'],65536)
 sentinel=by_id['calibrated-url-no-acquisition']
 require(sentinel['positiveCalibration']=={'requests':1,'connections':1} and sentinel['attackRequests']==sentinel['attackConnections']==0 and sentinel['commandMarkerCreated'] is False,'CALIBRATED_NONACQUISITION')
 require(sentinel['fileUnchanged']==identity(base64.b64decode(fixtures['prepare-policy-pass']['input']['policyBase64'],validate=True)),'FILESYSTEM_NONMUTATION')
 logs=by_id['secret-safe-diagnostics'];require(logs['rawLogsPersisted'] is False and logs['secretFreeLogs'] is True,'SECRET_SAFE_DIAGNOSTICS');process_record(logs['process'])
 fatal=identity(canonical({'code':'MO1305_UNAVAILABLE','event':'fatal','operationId':None,'requestId':None})+b'\n')
 for name in refusal_ids:
  row=by_id[name];require(row['exitCode']==2 and row['startupObserved'] is False and row['secretFreeLogs'] is True and row['diagnostic']==fatal,'STARTUP_REFUSAL:'+name)
 recovery=by_id['post-refusal-recovery'];require(recovery['isolatedAlteredCopy'] is True and recovery['originalInstallationModified'] is False,'ISOLATED_NEGATIVE_COPY')
 lifecycle=by_id['shutdown-partial-socket-and-rebind']
 require(type(lifecycle['shutdownMs'])==int and 0<=lifecycle['shutdownMs']<lifecycle['shutdownLimitMs']==15000 and lifecycle['listenerAbsent'] is True and lifecycle['socketClosed'] is True and lifecycle['unpublishedResponseBytes']==0 and lifecycle['immediateRebind'] is True and lifecycle['rebindReadiness']==200,'SHUTDOWN_SOCKET_CLEANUP')
 process_record(lifecycle['process'])
 remote=x['remote']
 if remote_ids:
  require(remote['state']=='PASS' and remote['address']==installation['remote']['address'] and remote['scope']=='same-host assigned RFC1918' and remote['explicitOptIn'] is True,'REMOTE_ASSIGNED_MODE')
  interface=ipaddress.IPv4Interface(remote['cidr']);require(str(interface.ip)==remote['address'] and interface.network.prefixlen<=30,'REMOTE_ASSIGNMENT')
  start=by_id['remote-explicit-opt-in-start'];require(start['address']==remote['address'] and start['sameHost'] is True and start['explicitOptIn'] is True,'REMOTE_STARTUP');response(start,{'status':'ok','ready':True},True)
  semantic(by_id['remote-identities'],'identities')
  cleanup=by_id['remote-shutdown-cleanup'];require(cleanup['listenerAbsent'] is True,'REMOTE_LISTENER_CLEANUP');process_record(cleanup['process'])
 else:require(remote=={'state':'NOT_AVAILABLE','reason':'No eligible assigned RFC1918 IPv4 address supplied by host inventory.'},'REMOTE_DISPOSITION')
 require([r['exitCode'] for r in x['processes']]==[0]*6+[2]*8+[0]*(2 if remote_ids else 1),'GATEWAY_PROCESS_MEMBERSHIP')
 for row in x['processes']:process_record(row)
 require(len({r['pid'] for r in x['processes']})==len(x['processes']),'GATEWAY_DISTINCT_PROCESSES')
 for row in [logs['process'],lifecycle['process']]+([by_id['remote-shutdown-cleanup']['process']] if remote_ids else []):require(row in x['processes'],'NESTED_PROCESS_PROVENANCE')
 for row in x['processes']:
  if row['exitCode']==2:require(row['stderr']==fatal,'FATAL_PROCESS_DIAGNOSTIC')
 require(x['coverage']=={'loopback':True,'semanticCapabilities':capabilities,'decisions':decisions,'nodeFetch':True,'curl':True,'rawTls':True,'groups':list(groups)},'DERIVED_COVERAGE')
 harness=x['harness'];require(harness['historicalCommit']==A3 and harness['oracleProjectionSource']=='repositories/cca-conformance/tools/mo1305-phase3a/clients.mjs','HARNESS_ORACLE_PROVENANCE')
 for key,name in [('common','common.mjs'),('probe','probe.mjs'),('fetchHelper','bounded-fetch-client.mjs')]:require(harness[key]==identity((HERE/name).read_bytes()),'PROBE_SOURCE_IDENTITY')
 require(isinstance(x['limitations'],list) and len(x['limitations'])>=4,'SCOPE_LIMITATIONS')


def selftest(data,expected,node):
 witnesses=[]
 def reject(label,validator,original,mutation):
  changed=copy.deepcopy(original);mutation(changed)
  try:validator(changed)
  except (ValueError,KeyError,TypeError,AssertionError):witnesses.append({'mutation':label,'state':'REJECTED'})
  else:raise ValueError('MUTATION_ACCEPTED:'+label)
 receipt=read(E+'windows-refresh-receipt.json')
 for key in ('implementationRevision','bindingRevision','historicalRevision','archive','openapi','sbom'):
  reject('receipt-'+key,lambda x:validate_receipt(x,data),receipt,lambda x,k=key:x.update({k:None}))
 reject('unknown-receipt-field',lambda x:validate_receipt(x,data),receipt,lambda x:x.update(unknown=True))
 vi=lambda x:validate_installation(x,expected,data['runtime'])
 reject('wrong-installed-archive',vi,data['installation'],lambda x:x['archive'].update(sha256='0'*64))
 reject('offline-flag-removed',vi,data['installation'],lambda x:next(r for r in x['commands'] if 'install' in r['argv'])['argv'].remove('--offline'))
 reject('installed-file-drift',vi,data['installation'],lambda x:x['preIntegrity']['files'][0].update(sha256='0'*64))
 reject('oracle-substitution',vi,data['installation'],lambda x:x['oracle']['files'][0].update(sha256='0'*64))
 vp=lambda x:validate_probe(x,data['installation'],data['runtime'])
 reject('missing-targeted-case',vp,data['probe'],lambda x:x['records'].pop())
 reject('false-targeted-pass',vp,data['probe'],lambda x:x['records'][0].update(state='FAIL'))
 def case(x,name):return next(r for r in x['records'] if r['id']==name)
 reject('semantic-body-forgery',vp,data['probe'],lambda x:case(x,'raw-evaluate-policy-pass')['responseBody'].update(sha256='0'*64))
 reject('semantic-decision-forgery',vp,data['probe'],lambda x:case(x,'raw-evaluate-policy-fail').update(decision='PASS'))
 reject('normative-artifact-forgery',vp,data['probe'],lambda x:case(x,'raw-prepare-policy-pass')['normativeProducts'].update(documentDigest='0'*64))
 reject('missing-host-precedence-forgery',vp,data['probe'],lambda x:case(x,'missing-host-missing-auth').update(httpStatus=403))
 reject('url-acquisition-forgery',vp,data['probe'],lambda x:case(x,'calibrated-url-no-acquisition').update(attackRequests=1))
 reject('socket-cleanup-forgery',vp,data['probe'],lambda x:case(x,'shutdown-partial-socket-and-rebind').update(socketClosed=False))
 reject('client-certificate-bypass',vp,data['probe'],lambda x:case(x,'node-fetch-bounded').update(certificateVerification=False))
 reject('process-entrypoint-forgery',vp,data['probe'],lambda x:x['processes'][0].update(entry='checkout/bin/memoryos-rest.mjs'))
 reject('process-exit-forgery',vp,data['probe'],lambda x:x['processes'][0].update(exitCode=1))
 reject('deadline-drift',vp,data['probe'],lambda x:x['limits'].update(operationMs=60000))
 ve=lambda x:validate_execution(x,data['probe'],node)
 reject('host-classification-forgery',ve,data['execution'],lambda x:x['host']['observation'].update(classification='HOST_INTERRUPTED'))
 reject('missing-case-host-observation',ve,data['execution'],lambda x:x['host']['caseObservations'].pop())
 reject('execution-failure-as-pass',ve,data['execution'],lambda x:x['result'].update(code=1))
 reject('checkout-execution-substitution',ve,data['execution'],lambda x:x['command']['argv'].__setitem__(1,'$CHECKOUT/repositories/memoryos-rest'))
 reject('post-execution-installed-drift',lambda x:validate_integrity(x,data['cleanup'],expected),data['post-integrity'],lambda x:x['after'][0].update(sha256='0'*64))
 reject('secret-scan-not-performed',lambda x:validate_integrity(data['post-integrity'],x,expected),data['cleanup'],lambda x:x.update(scannedFileCount=0))
 for label,payload in [('duplicate-json-key',b'{"x":1,"x":2}'),('noncanonical-json',b'{ "x":1}'),('nonfinite-json',b'{"x":NaN}')]:
  try:parse(payload)
  except ValueError:witnesses.append({'mutation':label,'state':'REJECTED'})
  else:raise ValueError('INVALID_JSON_ACCEPTED:'+label)
 return {'state':'PASS','negativeWitnesses':len(witnesses),'gatewayCampaignsExecuted':0,'witnesses':witnesses}


def main():
 parser=argparse.ArgumentParser()
 parser.add_argument('--check',action='store_true')
 parser.add_argument('--selftest',action='store_true')
 parser.add_argument('--node',type=Path,default=DEFAULT_NODE)
 args=parser.parse_args()
 try:
  data,expected=validate_all(args.node,recheck_preflight=not args.selftest)
  result=selftest(data,expected,args.node.resolve(strict=True)) if args.selftest else {'state':'PASS','receipt':'windows-refresh-receipt.json','packageFiles':58,'targetedRecords':len(data['probe']['records']),'semanticCapabilities':6,'spdxSchemaErrors':0,'runtimeMembersUnchanged':42,'gatewayCampaignsExecuted':0}
  print(json.dumps(result,sort_keys=True))
 except Exception as error:
  print(json.dumps({'state':'FAIL','gate':'windows-refresh-certification','error':type(error).__name__,'message':str(error)}));raise SystemExit(1)


if __name__=='__main__':main()
