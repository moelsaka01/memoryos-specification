"""Fresh installed-package certification on physical Windows; never rebuilds or repacks."""
import datetime,hashlib,json,os,platform,shutil,subprocess,sys,tempfile,tarfile,winreg
from pathlib import Path
from package_verify import ARCHIVE,canonical,identity,require,verify_archive
from windows_package import verify_windows_installed
from validate_windows import validate,I2,B2,NODE_SHA,INPUT_SHA,SOURCE_SHA,PENDING
from manifest_files import REQUIRED
HERE=Path(__file__).resolve().parent
WORKSPACE=HERE.parents[3]
BASE=WORKSPACE/'.cache/mo1304-windows-cert'
NODE=BASE/'runtime/node.exe'
NPM=NODE.parent/'node_modules/npm/bin/npm-cli.js'

def run(command,timeout=180,env=None):
 r=subprocess.run(list(map(str,command)),env=env,capture_output=True,timeout=timeout)
 require(len(r.stdout)+len(r.stderr)<=4*1024*1024,'PROCESS_OUTPUT_BOUND')
 if r.returncode:
  sys.stdout.buffer.write(r.stdout[-6000:]);sys.stderr.buffer.write(r.stderr[-6000:]);raise RuntimeError('CERTIFICATION_COMMAND_FAILED:'+str(r.returncode))
 return r

def main():
 require(platform.system()=='Windows' and platform.machine()=='AMD64','PHYSICAL_WINDOWS_X64')
 detected=json.loads((BASE/'detected.json').read_bytes())
 with winreg.OpenKey(winreg.HKEY_LOCAL_MACHINE,r'SOFTWARE\Microsoft\Windows NT\CurrentVersion') as key:
  for name,field in [('DisplayVersion','displayVersion'),('CurrentBuildNumber','buildNumber'),('UBR','ubr')]:require(winreg.QueryValueEx(key,name)[0]==detected[field],'ACTUAL_ENVIRONMENT_CHANGED')
 require(platform.version()=='10.0.'+detected['buildNumber'],'OS_BUILD')
 require(identity(NODE.read_bytes())['sha256']==NODE_SHA,'NODE_IDENTITY')
 require(run([NODE,'--version']).stdout.strip()==b'v24.21.0','NODE_VERSION');require(run([NODE,NPM,'--version']).stdout.strip()==b'11.19.0','NPM_VERSION')
 manifest={'kind':'MemoryOSMO1304WindowsHarnessManifest','version':'1.0.0','files':[{'path':name,**identity((HERE/name).read_bytes())} for name in REQUIRED]}
 manifest_bytes=canonical(manifest);(HERE/'harness-manifest.json').write_bytes(manifest_bytes)
 archive=WORKSPACE/'repositories/memoryos-mcp/out/phase2'/ARCHIVE;verified=verify_archive(archive)
 require(identity((BASE/'supply-chain-sources.json').read_bytes())['sha256']==SOURCE_SHA,'REVIEWED_SUPPLY_CHAIN_SNAPSHOT')
 start=datetime.datetime.now(datetime.timezone.utc).isoformat();(BASE/'runs').mkdir(exist_ok=True)
 destination=Path(tempfile.mkdtemp(prefix='windows-',dir=BASE/'runs'));install=destination/'install';cache=destination/'npm-cache';evidence=destination/'evidence';tooling=destination/'tooling'
 for path in [install,cache,evidence,tooling]:path.mkdir()
 config={'root':str(install/'node_modules/memoryos-mcp'),'run':str(destination),'tooling':str(tooling),'evidence':str(evidence),'node':str(NODE),'python':sys.executable,'harness':str(HERE),'base':str(BASE),'archive':str(archive)}
 (BASE/'current-run.json').write_bytes(canonical(config));print(json.dumps({'freshRun':str(destination),'state':'INSTALLING'}),flush=True)
 env={**os.environ,'PATH':str(NODE.parent),'MO1304_CERT_ROOT':str(BASE),'MO1304_PYTHON':sys.executable,'MO1304_NODE':str(NODE),'MO1304_ARCHIVE':str(archive)}
 command=[str(NODE),str(NPM),'install','--offline','--ignore-scripts','--no-audit','--no-fund','--no-save','--omit=dev','--cache',str(cache),'--prefix',str(install),str(archive)]
 installed=run(command,env=env);root=Path(config['root']);actual=verify_windows_installed(root);require(actual==verified,'INSTALL_IDENTITY')
 (evidence/'installation.json').write_bytes(canonical({'command':command,'exitCode':installed.returncode,'networkDenied':False,'npmOffline':True,'verified':actual,'stdout':installed.stdout.decode(),'stderr':installed.stderr.decode(),'nonNormative':{'installationRoot':str(root),'networkScope':'Inherited host process sandbox blocks observed external TCP; no complete OS network-denial claim.'}}))
 # Reference generation invokes the authoritative SDK plus ten actual CLI commands.
 oracle=run([NODE,WORKSPACE/'repositories/cca-conformance/tools/mo1304-phase3/build_inputs.mjs'],env=env)
 stage=WORKSPACE/'.cache/mo1304-phase3-stage';require(identity((stage/'inputs/inputs.json').read_bytes())['sha256']==INPUT_SHA,'FRESH_SDK_CLI_REFERENCE')
 for src,name in [(stage/'inputs/inputs.json','inputs.json'),(BASE/'supply-chain-sources.json','supply-chain-sources.json'),(HERE/'harness-manifest.json','harness-manifest.json'),(HERE/'test-catalog.json','test-catalog.json')]:shutil.copyfile(src,evidence/name)
 manifest_path=stage/'tooling/tooling-manifest.json';require(identity(manifest_path.read_bytes())=={'byteLength':3860,'sha256':'2c720b5621539a62723ff13364481e89cc083a0126e6cd2420a3a0910eeea5f2'},'TOOLING_MANIFEST');records=[]
 for item in json.loads(manifest_path.read_bytes())['files']:
  tarball=stage/'tooling'/item['file'];require(identity(tarball.read_bytes())=={k:item[k] for k in ['byteLength','sha256']},'TOOLING_TARBALL');dest=tooling/'node_modules'/item['package'];expected={}
  with tarfile.open(tarball,'r:gz') as tar:
   for member in tar.getmembers():
    require(member.name.startswith('package/') and member.isfile() and member.size<=16*1024*1024,'TOOLING_MEMBER')
    name=member.name[8:];require(name and '..' not in name.split('/') and not name.startswith('/') and '\\' not in name,'TOOLING_MEMBER_PATH');data=tar.extractfile(member).read();target=dest/name;target.parent.mkdir(parents=True,exist_ok=True);target.write_bytes(data);expected[name]=data
  files={f.relative_to(dest).as_posix():f.read_bytes() for f in dest.rglob('*') if f.is_file()};require(files==expected,'TOOLING_INSTALLED_BYTES')
  records.append({'name':item['package'],'version':item['version'],'tarballSha256':item['sha256'],'fileCount':len(files),'closure':identity(canonical([{'path':k,**identity(v)} for k,v in sorted(files.items())]))})
 shutil.copyfile(manifest_path,evidence/'tooling-manifest.json')
 (evidence/'network-control.json').write_bytes(canonical(json.loads((BASE/'network-control.json').read_bytes())))
 (evidence/'tooling-verification.json').write_bytes(canonical({'kind':'MemoryOSMO1304CertificationToolingVerification','version':'1.0.0','status':'PASS','productionDependency':False,'source':'Fresh extraction of original integrity-verified npm tooling tarballs; no copied development node_modules','packages':records}))
 print(json.dumps({'state':'NATIVE_PIPE_CERTIFICATION','installedFiles':actual['archiveFiles']}),flush=True)
 with (evidence/'native.stdout.txt').open('wb') as out,(evidence/'native.stderr.txt').open('wb') as err:
  native=subprocess.run([str(NODE),str(HERE/'windows_driver.mjs'),str(root),str(tooling),str(evidence/'inputs.json'),str(evidence/'execution.json')],env=env,stdout=out,stderr=err,timeout=900)
 require(native.returncode==0,'NATIVE_PIPE_CERTIFICATION_FAILED: '+str(evidence))
 print(json.dumps({'state':'PACKAGE_ADVERSARIAL'}),flush=True)
 run([sys.executable,'-B',HERE/'package_adversarial.py',root,evidence/'package-adversarial.json'],env=env)
 print(json.dumps({'state':'INSTALLED_MECHANISM_TESTS'}),flush=True)
 mechanisms=run([NODE,'--test','--test-concurrency=1','--test-reporter=tap',HERE/'installed_boundaries.mjs'],timeout=300,env={**env,'MO1304_INSTALLED_ROOT':str(root)})
 (evidence/'mechanisms.stdout.txt').write_bytes(mechanisms.stdout);(evidence/'mechanisms.stderr.txt').write_bytes(mechanisms.stderr)
 require(verify_windows_installed(root)==verified and verify_archive(archive)==verified,'POST_EXECUTION_IDENTITY')
 for file,length,digest in [('ajvProvider-CEoC__sr.mjs',273658,'218157a99879a59cdea0b720a484dfe9989fa768f3d05318c2803b61705373fa'),('ajvProvider-ZaoO9afR.cjs',275410,'289d945a40218fdd3da0a020f2d0a636e5378d36287a4d7d59b32515817cb03b')]:require(identity((root/'node_modules/@modelcontextprotocol/server/dist'/file).read_bytes())=={'byteLength':length,'sha256':digest},'EMBEDDED_FAST_URI_BYTES')
 files={'execution':'execution.json','packageAdversarial':'package-adversarial.json','mechanismsStdout':'mechanisms.stdout.txt','mechanismsStderr':'mechanisms.stderr.txt','inputs':'inputs.json','supplyChainSources':'supply-chain-sources.json','installation':'installation.json','harnessManifest':'harness-manifest.json','testCatalog':'test-catalog.json','toolingManifest':'tooling-manifest.json','toolingVerification':'tooling-verification.json','networkControl':'network-control.json'}
 execution=json.loads((evidence/'execution.json').read_bytes());catalog=json.loads((evidence/'test-catalog.json').read_bytes())
 ubuntu=json.loads((WORKSPACE/'repositories/cca-conformance/evidence/mo1304-phase3-ubuntu/ubuntu-receipt.json').read_bytes())
 value={'kind':'MemoryOSMO1304WindowsCertification','version':'1.0.0','platform':'windows-11','supportedPlatform':'Windows 11 x64','certifiedEnvironment':{'os':'Windows 11','release':detected['displayVersion'],'build':detected['buildNumber']+'.'+str(detected['ubr']),'architecture':'x64','detected':detected},'architecture':'x64','os':{'prettyName':detected['caption'],'versionId':detected['displayVersion'],'kernel':platform.version(),'build':detected['buildNumber']+'.'+str(detected['ubr'])},'node':{'version':'v24.21.0','executableSha256':NODE_SHA},'npm':'11.19.0','implementationRevision':I2,'phase2Binding':B2,
 'candidate':{'archiveFilename':ARCHIVE,'archive':identity(archive.read_bytes()),**verified},'harness':identity(manifest_bytes),'testCatalog':identity((evidence/'test-catalog.json').read_bytes()),'artifacts':{k:{'file':f,**identity((evidence/f).read_bytes())} for k,f in files.items()},'semanticVectors':execution['vectors'],'supplyChain':ubuntu['supplyChain'],
 'coverage':{'nativePipeTests':len(catalog['nativePipeTests']),'packageVerifierTests':len(catalog['packageVerifierTests']),'supplementalInstalledModuleTests':catalog['supplementalInstalledModuleTests'],'network':'WINDOWS_SANDBOX_TCP_EGRESS_DENIAL_AND_INSTRUMENTED_NODE_API_DENIAL','filesystem':'INSTRUMENTED_INSTALLED_PARENT_AND_WORKERS','windowsSpecificFilesystemClaims':True},'pending':PENDING,'overall':'PASS',
 'nonNormative':{'startedAt':start,'completedAt':datetime.datetime.now(datetime.timezone.utc).isoformat(),'installationRoot':str(root),'trustedNodePath':str(NODE),'physicalHost':'Dell Inc. Inspiron 5406 2n1; detected with Win32_ComputerSystem','sdkCLIReferenceGeneration':json.loads(oracle.stdout),'networkScope':'Inherited host process sandbox demonstrated external TCP EACCES (IPv4 and IPv4-mapped IPv6). Loopback allowed; UDP send accepted by local API; no OS UDP/DNS denial claim. Supplemental unchanged installed parent and workers reject all observed Node network APIs. Temporary zero-capability AppContainer probe denied TCP but failed entry-point resolution with EPERM at C:\\; profile deleted. No global firewall/network or ancestor ACL changes.'}}
 result=validate(value,evidence);raw=canonical(value);require(len(raw)<=1024*1024,'RECEIPT_BOUND');(evidence/'windows-receipt.json').write_bytes(raw)
 print(json.dumps({'validation':result,'receipt':str(evidence/'windows-receipt.json'),**identity(raw)}),flush=True)
if __name__=='__main__':main()
