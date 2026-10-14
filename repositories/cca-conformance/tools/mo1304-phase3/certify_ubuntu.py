"""Fresh Ubuntu-only certification; no source checkout, rebuild, Git, or tag operations."""
import datetime,hashlib,json,os,platform,re,shutil,subprocess,sys,tempfile,time,tarfile,stat
from pathlib import Path
from package_verify import ARCHIVE,ARCHIVE_ID,IDENTITIES,canonical,identity,require,verify_archive,verify_installed
from validate_receipt import validate,I2,B2,NODE_SHA,INPUT_SHA,SOURCE_SHA,PENDING
BASE=Path('/home/mo1304/mo1304-cert')
NODE='/opt/memoryos-cert/node-v24.21.0-linux-x64/bin/node'
NPM='/opt/memoryos-cert/node-v24.21.0-linux-x64/lib/node_modules/npm/bin/npm-cli.js'
HERE=Path(__file__).resolve().parent
FILTER=['/usr/bin/python3',str(HERE/'linux_network_deny.py')]
REQUIRED=sorted(['allocation_worker.mjs','boundary_guard.mjs','boundary_process.mjs','boundary_worker.mjs','certify_ubuntu.py','idle_worker.mjs','installed_boundaries.mjs','linux_network_deny.py','package_adversarial.py','package_verify.py','receipt.schema.json','test-catalog.json','ubuntu_driver.mjs','validate_receipt.py'])

def run(command,timeout=180,env=None):
 result=subprocess.run(command,env={} if env is None else env,capture_output=True,timeout=timeout)
 require(len(result.stdout)+len(result.stderr)<=4*1024*1024,'PROCESS_OUTPUT_BOUND')
 if result.returncode:
  sys.stdout.buffer.write(result.stdout[-12000:]);sys.stderr.buffer.write(result.stderr[-8000:]);raise RuntimeError('CERTIFICATION_COMMAND_FAILED:'+str(result.returncode))
 return result

def main():
 require(platform.system()=='Linux' and platform.machine()=='x86_64','UNSUPPORTED_OS')
 require(Path('/etc/hostname').read_text().strip()=='mo1304-ubuntu','HOSTNAME')
 os_release={line.split('=',1)[0]:line.split('=',1)[1].strip('"') for line in Path('/etc/os-release').read_text().splitlines() if '=' in line}
 require(os_release['PRETTY_NAME']=='Ubuntu 24.04.5 LTS' and os_release['VERSION_ID']=='24.04','UBUNTU_RELEASE')
 require(hashlib.sha256(Path(NODE).read_bytes()).hexdigest()==NODE_SHA,'NODE_EXECUTABLE')
 require(run([NODE,'--version']).stdout.strip()==b'v24.21.0','NODE_VERSION')
 require(run([NODE,NPM,'--version']).stdout.strip()==b'11.19.0','NPM_VERSION')
 manifest_path=HERE/'harness-manifest.json';manifest=json.loads(manifest_path.read_bytes())
 require([f['path'] for f in manifest['files']]==REQUIRED,'HARNESS_FILES')
 for f in manifest['files']:require(identity((HERE/f['path']).read_bytes())=={k:f[k] for k in ['byteLength','sha256']},'HARNESS_IDENTITY')
 require(identity((BASE/'incoming/inputs.json').read_bytes())['sha256']==INPUT_SHA,'INPUTS')
 require(identity((BASE/'incoming/supply-chain-sources.json').read_bytes())['sha256']==SOURCE_SHA,'ADVISORY_SOURCES')
 verified=verify_archive(BASE/'incoming'/ARCHIVE)
 start=datetime.datetime.now(datetime.timezone.utc).isoformat()
 destination=Path(tempfile.mkdtemp(prefix='ubuntu-final-',dir=BASE/'runs'));install=destination/'install';cache=destination/'npm-cache';evidence=destination/'evidence'
 for path in [install,cache,evidence]:path.mkdir()
 print(json.dumps({'freshRun':str(destination),'state':'INSTALLING'}),flush=True)
 command=[NODE,NPM,'install','--offline','--ignore-scripts','--no-audit','--no-fund','--no-save','--omit=dev','--cache',str(cache),'--prefix',str(install),str(BASE/'incoming'/ARCHIVE)]
 installed=run(FILTER+command,timeout=120,env={'PATH':str(Path(NODE).parent),'HOME':str(destination)})
 root=install/'node_modules/memoryos-mcp';actual=verify_installed(root);require(actual==verified,'INSTALL_IDENTITY')
 (evidence/'installation.json').write_bytes(canonical({'command':command,'exitCode':installed.returncode,'networkDenied':True,'verified':actual,'stdout':installed.stdout.decode(),'stderr':installed.stderr.decode(),'nonNormative':{'installationRoot':str(root)}}))
 for src,name in [(BASE/'incoming/inputs.json','inputs.json'),(BASE/'incoming/supply-chain-sources.json','supply-chain-sources.json'),(manifest_path,'harness-manifest.json'),(HERE/'test-catalog.json','test-catalog.json')]:shutil.copyfile(src,evidence/name)

 tooling_manifest=BASE/'incoming/tooling/tooling-manifest.json'
 require(identity(tooling_manifest.read_bytes())=={'byteLength':3860,'sha256':'2c720b5621539a62723ff13364481e89cc083a0126e6cd2420a3a0910eeea5f2'},'TOOLING_MANIFEST')
 tooling_records=[]
 for item in json.loads(tooling_manifest.read_bytes())['files']:
  tarball=BASE/'incoming/tooling'/item['file'];raw=tarball.read_bytes();require(identity(raw)=={k:item[k] for k in ['byteLength','sha256']},'TOOLING_TARBALL')
  expected={}
  with tarfile.open(tarball,'r:gz') as tar:
   for member in tar.getmembers():
    require(member.name.startswith('package/') and member.isfile() and member.size<=16*1024*1024,'TOOLING_MEMBER')
    name=member.name[8:];require(name and '..' not in name.split('/') and not name.startswith('/') and '\\' not in name,'TOOLING_MEMBER_PATH');expected[name]=tar.extractfile(member).read()
  package=BASE/'tooling/node_modules'/item['package'];files={}
  for file in package.rglob('*'):
   info=file.lstat();require(not stat.S_ISLNK(info.st_mode),'TOOLING_LINK')
   if file.is_dir():continue
   require(stat.S_ISREG(info.st_mode) and info.st_nlink==1,'TOOLING_FILE')
   files[file.relative_to(package).as_posix()]=file.read_bytes()
  require(files==expected,'TOOLING_INSTALLED_BYTES')
  tooling_records.append({'name':item['package'],'version':item['version'],'tarballSha256':item['sha256'],'fileCount':len(files),'closure':identity(canonical([{'path':k,**identity(v)} for k,v in sorted(files.items())]))})
 shutil.copyfile(tooling_manifest,evidence/'tooling-manifest.json')
 (evidence/'tooling-verification.json').write_bytes(canonical({'kind':'MemoryOSMO1304CertificationToolingVerification','version':'1.0.0','status':'PASS','productionDependency':False,'source':'Original B2-lock-integrity-verified cache tarballs; no copied Windows node_modules','packages':tooling_records}))
 print(json.dumps({'state':'NATIVE_PIPE_CERTIFICATION','installedFiles':actual['archiveFiles']}),flush=True)
 native=run(FILTER+[NODE,str(HERE/'ubuntu_driver.mjs'),str(root),str(BASE/'tooling'),str(evidence/'inputs.json'),str(evidence/'execution.json')],timeout=900)
 (evidence/'native.stdout.txt').write_bytes(native.stdout);(evidence/'native.stderr.txt').write_bytes(native.stderr)
 print(json.dumps({'state':'PACKAGE_ADVERSARIAL'}),flush=True)
 run(FILTER+['/usr/bin/python3',str(HERE/'package_adversarial.py'),str(root),str(evidence/'package-adversarial.json')])
 print(json.dumps({'state':'INSTALLED_MECHANISM_TESTS'}),flush=True)
 mechanisms=run(FILTER+[NODE,'--test','--test-concurrency=1','--test-reporter=tap',str(HERE/'installed_boundaries.mjs')],timeout=240,env={'MO1304_INSTALLED_ROOT':str(root)})
 (evidence/'mechanisms.stdout.txt').write_bytes(mechanisms.stdout);(evidence/'mechanisms.stderr.txt').write_bytes(mechanisms.stderr)
 require(verify_installed(root)==verified,'POST_RUN_INSTALLED_IDENTITY')
 require(verify_archive(BASE/'incoming'/ARCHIVE)==verified,'POST_RUN_ARCHIVE_IDENTITY')
 # Explicitly recheck both unchanged embedded fast-uri occurrences on Ubuntu.
 for file,length,sha in [('ajvProvider-CEoC__sr.mjs',273658,'218157a99879a59cdea0b720a484dfe9989fa768f3d05318c2803b61705373fa'),('ajvProvider-ZaoO9afR.cjs',275410,'289d945a40218fdd3da0a020f2d0a636e5378d36287a4d7d59b32515817cb03b')]:
  require(identity((root/'node_modules/@modelcontextprotocol/server/dist'/file).read_bytes())=={'byteLength':length,'sha256':sha},'EMBEDDED_COMPONENT_CHANGED')
 files={'execution':'execution.json','packageAdversarial':'package-adversarial.json','mechanismsStdout':'mechanisms.stdout.txt','mechanismsStderr':'mechanisms.stderr.txt','inputs':'inputs.json','supplyChainSources':'supply-chain-sources.json','installation':'installation.json','harnessManifest':'harness-manifest.json','testCatalog':'test-catalog.json','toolingManifest':'tooling-manifest.json','toolingVerification':'tooling-verification.json'}
 execution=json.loads((evidence/'execution.json').read_bytes());catalog=json.loads((evidence/'test-catalog.json').read_bytes())
 value={'kind':'MemoryOSMO1304UbuntuCertification','version':'1.0.0','platform':'ubuntu-24.04','architecture':'x64','os':{'prettyName':os_release['PRETTY_NAME'],'versionId':os_release['VERSION_ID'],'kernel':platform.release()},'node':{'version':'v24.21.0','executableSha256':NODE_SHA},'npm':'11.19.0','implementationRevision':I2,'phase2Binding':B2,
 'candidate':{'archiveFilename':ARCHIVE,'archive':{'byteLength':ARCHIVE_ID[0],'sha256':ARCHIVE_ID[1]},**verified},
 'harness':identity(manifest_path.read_bytes()),'testCatalog':identity((evidence/'test-catalog.json').read_bytes()),'artifacts':{k:{'file':f,**identity((evidence/f).read_bytes())} for k,f in files.items()},'semanticVectors':execution['vectors'],
 'supplyChain':{'component':'fast-uri','version':'3.1.0','patched':False,'affectedHigh':8,'affectedModerate':1,'applicableHigh':0,'compatiblePatchedStableSDKAvailable':False,'disposition':'AFFECTED_COMPONENT_PRESENT_NO_APPLICABLE_PATH_IN_FROZEN_INSTALLED_SURFACE','residualRisk':'Accepted only for the frozen surface under the existing policy; validators/URI schema paths remain unreachable in observed installed parent and worker execution. Not patched; not zero vulnerabilities.'},
 'coverage':{'nativePipeTests':len(catalog['nativePipeTests']),'packageVerifierTests':len(catalog['packageVerifierTests']),'supplementalInstalledModuleTests':catalog['supplementalInstalledModuleTests'],'network':'LINUX_SECCOMP_PROCESS_TREE_DENIAL','filesystem':'INSTRUMENTED_INSTALLED_PARENT_AND_WORKERS','windowsSpecificFilesystemClaims':False},'pending':PENDING,'overall':'PASS',
 'nonNormative':{'hostname':'mo1304-ubuntu','virtualization':run(['/usr/bin/systemd-detect-virt']).stdout.decode().strip(),'virtualBoxVendor':Path('/sys/class/dmi/id/sys_vendor').read_text().strip(),'virtualBoxProduct':Path('/sys/class/dmi/id/product_name').read_text().strip(),'startedAt':start,'completedAt':datetime.datetime.now(datetime.timezone.utc).isoformat(),'installationRoot':str(root),'trustedNodePath':NODE,'management':'SSH management process is outside the seccomp-filtered certification process tree.','referenceGeneration':'SDK and CLI reference vectors generated in Windows checkout; no Windows platform certification.'}}
 result=validate(value,evidence)
 path=evidence/'ubuntu-receipt.json';raw=canonical(value);require(len(raw)<=1024*1024,'RECEIPT_BOUND');path.write_bytes(raw)
 print(json.dumps({'validation':result,'receipt':str(path),**identity(raw)}),flush=True)

if __name__=='__main__':main()
