"""One fresh C3/C3B installation; no production code is changed."""
from pathlib import Path
import hashlib,ipaddress,json,os,secrets,shutil,socket,subprocess,sys,tempfile,time
sys.dont_write_bytecode=True
HERE=Path(__file__).resolve().parent
ROOT=HERE.parents[3]
E=ROOT/'repositories/cca-conformance/evidence/mo1305-phase3a-refresh'
CACHE=ROOT/'.cache/mo1305-phase3a-refresh'
BASE='4ac43c4368f41ec14ea443aa303bf3a69503f2de'
SHA='faac95f7ad8939bcf7bbc33952efabebc1468d0c5654ea3eaac03f40402a7382'
NODE=ROOT/'.cache/mo1304-phase3-toolchain/node-v24.21.0-win-x64/node.exe'
PWSH=Path('C:/Users/melsa/.cache/codex-runtimes/codex-primary-runtime/dependencies/native/powershell/pwsh.exe')
OPENSSL=Path('C:/Program Files/Git/usr/bin/openssl.exe')
CURL=Path('C:/Windows/System32/curl.exe')
sys.path.insert(0,str(HERE.parent/'mo1305-phase3-correction'))
from distribution import verify_archive,verify_files
from install import identity,inventory,package_inventory,canonical

def write(path,value):
 path.parent.mkdir(parents=True,exist_ok=True);path.write_bytes(canonical(value))

def prepare():
 assert subprocess.check_output(['git','rev-parse','HEAD'],cwd=ROOT).decode().strip()==BASE
 assert subprocess.check_output(['git','branch','--show-current'],cwd=ROOT).decode().strip()=='mo1305/phase3a-refresh'
 subprocess.run([sys.executable,'-B',HERE/'preflight.py','--check'],cwd=ROOT,check=True)
 assert not (E/'installation.json').exists() and not (CACHE/'state.json').exists(),'ONE_FRESH_INSTALL_ONLY'
 archive=ROOT/'.cache/mo1305-phase3-correction/accepted-build/memoryos-rest-0.1.0.tgz'
 verified=verify_archive(archive,SHA);assert verified['archive']=={'byteLength':191823,'sha256':SHA}
 assert identity(NODE)=={'byteLength':93580104,'sha256':'ba4e6d110e8c1592a1ecd390f6b05f3da124b13871a5be62b341a07a853c6c32'}
 E.mkdir(parents=True,exist_ok=True);CACHE.mkdir(parents=True,exist_ok=True)
 temp_parent=Path(tempfile.gettempdir()).resolve();stage=Path(tempfile.mkdtemp(prefix='memoryos-rest-phase3a-refresh-',dir=temp_parent)).resolve()
 assert stage.parent==temp_parent and not stage.is_relative_to(ROOT),'ISOLATION'
 write(CACHE/'state.json',{'stage':str(stage),'createdUtcMs':int(time.time()*1000)})
 for name in ['empty','private','fixtures','tmp','home','project','install-cache','oracle','harness','results']:(stage/name).mkdir()
 clean={k:v for k,v in os.environ.items() if k.upper() in ['SYSTEMROOT','WINDIR']}
 clean.update(TEMP=str(stage/'tmp'),TMP=str(stage/'tmp'))
 record={'kind':'MemoryOSRESTWindowsRefreshInstallation','version':'1.0.0','state':'RUNNING','bindingRevision':BASE,'archive':identity(archive),'installCount':0,'commands':[],
 'sourceIndependence':{'outsideCheckout':True,'freshDirectory':True,'emptyServiceCwd':True,'copiedArchive':True,'copiedToolchain':True,'copiedFixturesAndHarness':True,'closedVerifiedImports':True,'checkoutHiddenByOS':False}}
 def run(args,cwd=stage/'empty',env=clean,expected=0,timeout=60):
  r=subprocess.run([str(x) for x in args],cwd=cwd,env=env,capture_output=True,timeout=timeout,creationflags=subprocess.CREATE_NO_WINDOW)
  assert len(r.stdout)<2**20 and len(r.stderr)<2**20
  def red(x):return str(x).replace(str(stage),'$ISOLATED').replace(str(ROOT),'$CHECKOUT')
  record['commands'].append({'argv':[red(x) for x in args],'exitCode':r.returncode,'stdout':{'byteLength':len(r.stdout),'sha256':hashlib.sha256(r.stdout).hexdigest()},'stderr':{'byteLength':len(r.stderr),'sha256':hashlib.sha256(r.stderr).hexdigest()}})
  assert r.returncode==expected,'COMMAND_EXIT:'+Path(args[0]).name+':'+str(r.returncode)
  return r
 try:
  run([PWSH,'-NoProfile','-NonInteractive','-File',HERE/'windows.ps1','-OutputPath',E/'windows.json'])
  detected=json.loads((E/'windows.json').read_bytes());write(E/'windows.json',detected)
  tool_inventory=inventory(NODE.parent)
  assert hashlib.sha256(canonical(tool_inventory)).hexdigest()=='8576929965bf577960cfe6b9d1e6fe9d46f0cf4d7ad10d3a4c6c7ac039996c34','TOOLCHAIN_INVENTORY'
  shutil.copytree(NODE.parent,stage/'toolchain');assert inventory(stage/'toolchain')==tool_inventory
  node=stage/'toolchain/node.exe';npm=stage/'toolchain/node_modules/npm/bin/npm-cli.js'
  versions=json.loads(run([node,'-p','JSON.stringify(process.versions)']).stdout)
  assert versions['node']=='24.21.0' and run([node,npm,'--version']).stdout.strip()==b'11.19.0'
  write(E/'runtime.json',{'node':identity(node),'nodeVersion':'24.21.0','npmVersion':'11.19.0','npmCli':identity(npm),'platform':'win32','architecture':'x64','executable':'$ISOLATED/toolchain/node.exe','toolchainFileCount':len(tool_inventory),'toolchainInventorySha256':hashlib.sha256(canonical(tool_inventory)).hexdigest(),'processVersions':versions,'curl':{'executable':str(CURL),**identity(CURL),'versionOutput':run([CURL,'--version']).stdout.decode().strip()},'powershell':identity(PWSH),'openssl':identity(OPENSSL)})
  shutil.copyfile(archive,stage/archive.name);assert identity(stage/archive.name)==identity(archive)
  expected=verified['inventory'];assert len(expected)==58
  write(E/'installed-files.json',{'files':expected})
  for name in ['empty-user.npmrc','empty-global.npmrc']:(stage/'home'/name).write_bytes(b'')
  npm_env={**clean,**{k:str(stage/'home') for k in ['USERPROFILE','HOME','APPDATA','LOCALAPPDATA']}}
  flags=['--offline','--ignore-scripts','--no-audit','--no-fund','--userconfig',stage/'home/empty-user.npmrc','--globalconfig',stage/'home/empty-global.npmrc']
  write(stage/'project/package.json',{'name':'mo1305-windows-refresh-isolated','version':'1.0.0','private':True})
  assert not list((stage/'install-cache').iterdir())
  record['installCount']=1
  run([node,npm,'install',*flags,'--cache',stage/'install-cache',stage/archive.name],stage/'project',npm_env,timeout=180)
  package=stage/'project/node_modules/memoryos-rest';package_inventory(package,expected)
  lock=json.loads((stage/'project/package-lock.json').read_bytes());assert set(lock['packages'])=={'','node_modules/memoryos-rest'}
  assert {x.name for x in (stage/'project/node_modules').iterdir()}=={'.bin','.package-lock.json','memoryos-rest'}
  files={row['path']:(package/row['path']).read_bytes() for row in expected};installed=verify_files(files)
  record['offline']={'cacheInitiallyEmpty':True,'offline':True,'ignoreScripts':True,'noAudit':True,'noFund':True,'externalProductionDependencies':0,'packageLockPackages':sorted(lock['packages'])}
  record['installedMetadata']={row['path']:row for row in expected if row['path'].startswith('contracts/') or row['path'] in ['dependency-manifest.json','distribution-manifest.json','sbom.spdx.json','runtime/runtime-closure-manifest.json']}
  assert b'PHASE_2_PENDING' not in files['contracts/openapi.json']
  record['installedValidation']={'fileCount':installed['fileCount'],'closureFileCount':installed['runtimeFileCount'],'spdxFullSchema':'PASS','spdxSemantics':'PASS','distribution':'PASS','sourceProvenance':'PASS'}
  fixture_root=ROOT/'repositories/cca-conformance/fixtures/mo1305-phase1'
  for name in ['index.json','identities.json','prepare-policy-pass.json','prepare-policySet-pass.json','evaluate-policy-pass.json','evaluate-policy-fail.json','evaluate-policy-cne.json','evaluate-policySet-pass.json','verify-identity.json','verify-outcome.json']:
   shutil.copyfile(fixture_root/name,stage/'fixtures'/name)
  record['fixtures']=inventory(stage/'fixtures')
  closure=json.loads(files['runtime/runtime-closure-manifest.json']);oracle=[]
  for row in closure['files']:
   source=ROOT/row['source'];assert identity(source)=={k:row[k] for k in ['byteLength','sha256']}
   destination=stage/'oracle'/row['path'];destination.parent.mkdir(parents=True,exist_ok=True);shutil.copyfile(source,destination)
   oracle.append({'source':row['source'],'path':row['path'],**identity(destination)})
  record['oracle']={'source':'independent authoritative source files; not installed REST modules','files':oracle,'count':len(oracle)}
  for name in ['probe.mjs','common.mjs','bounded-fetch-client.mjs']:shutil.copyfile(HERE/name,stage/'harness'/name)
  record['harness']=inventory(stage/'harness')
  interfaces=json.loads(run([node,'-p','JSON.stringify(Object.values(require("node:os").networkInterfaces()).flat())']).stdout)
  networks=[ipaddress.IPv4Network(x) for x in ['10.0.0.0/8','172.16.0.0/12','192.168.0.0/16']]
  addresses=[x['address'] for x in interfaces if x['family']=='IPv4' and not x['internal'] and x.get('cidr') and any(ipaddress.IPv4Address(x['address']) in n for n in networks) and ipaddress.IPv4Interface(x['cidr']).network.prefixlen<=30]
  remote=addresses[0] if addresses else ''
  record['remote']={'available':bool(remote),'address':remote,'scope':'same-host assigned RFC1918 only'}
  private=stage/'private';(private/'token').write_text(secrets.token_hex(32),encoding='ascii')
  run([OPENSSL,'req','-x509','-newkey','ec','-pkeyopt','ec_paramgen_curve:P-256','-nodes','-keyout',private/'key.pem','-out',private/'cert.pem','-days','1','-subj','/CN=MO1305 Windows refresh','-addext','subjectAltName=IP:127.0.0.1'+''.join(',IP:'+x for x in addresses)])
  with socket.socket() as s:s.bind(('127.0.0.1',0));port=s.getsockname()[1]
  config={'version':'1.0.0','port':port,'tokenFile':str(private/'token'),'privateKeyFile':str(private/'key.pem'),'certificateFile':str(private/'cert.pem')}
  write(private/'config.json',config);write(private/'remote.json',{**config,'mode':'remote','bindAddress':remote or '192.168.1.1'})
  run([PWSH,'-NoProfile','-NonInteractive','-File',HERE/'private-acl.ps1','-PrivateDirectory',private])
  shutil.copyfile(HERE.parent/'mo1305-phase1/validate-launch.ps1',stage/'validate-launch.ps1')
  trusted=[PWSH,'-NoProfile','-NonInteractive','-File',stage/'validate-launch.ps1','-NodePath',node,'-ConfigPath',private/'config.json']
  assert run(trusted).stdout.strip()==b'MO1305_TRUSTED_LAUNCH_PRECONDITIONS_PASS'
  negatives=[]
  for key,value in [('NODE_PATH',str(stage/'untrusted')),('NODE_OPTIONS','--require='+str(stage/'untrusted.cjs')),('NODE_OPTIONS','--loader='+str(stage/'untrusted.mjs')),('NODE_OPTIONS','--inspect=127.0.0.1:0')]:
   assert run(trusted,env={**clean,key:value},expected=2).stdout.strip()==b'MO1305_TRUSTED_LAUNCH_REFUSED:ENVIRONMENT'
   negatives.append({'variable':key,'influence':value.replace(str(stage),'$ISOLATED'),'state':'REFUSED_BEFORE_NODE_START'})
  fake=stage/'substituted-node.exe';fake.write_bytes(b'not the trusted runtime')
  assert run([fake if str(x)==str(node) else x for x in trusted],expected=2).stdout.strip()==b'MO1305_TRUSTED_LAUNCH_REFUSED:RUNTIME'
  record['trustedLauncher']={'valid':'PASS','environment':negatives,'runtimeSubstitution':'REFUSED_BEFORE_NODE_START'}
  record['preIntegrity']={'fileCount':58,'files':package_inventory(package,expected),'inventorySha256':hashlib.sha256(canonical(expected)).hexdigest()}
  write(CACHE/'state.json',{'stage':str(stage),'createdUtcMs':int(time.time()*1000),'node':str(node),'packagePath':str(package),'remoteAddress':remote,'curlPath':str(CURL),'port':port})
  record['state']='PASS'
 except Exception as error:
  record['state']='FAIL';record['failure']={'type':type(error).__name__,'reason':str(error).replace(str(stage),'$ISOLATED')[:512]};raise
 finally:write(E/'installation.json',record)
 print(json.dumps({'state':record['state'],'installCount':record['installCount'],'fileCount':58,'remoteAddressAvailable':bool(remote)}))
if __name__=='__main__':prepare()