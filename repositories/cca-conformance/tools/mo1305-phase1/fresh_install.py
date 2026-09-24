"""Fresh USTAR materialization and real npm ci with an initially empty offline cache."""
from pathlib import Path
import hashlib,json,os,secrets,subprocess,sys,tarfile,tempfile
ROOT=Path(__file__).resolve().parents[4]
NODE=ROOT/'.cache/mo1304-phase3-toolchain/node-v24.21.0-win-x64/node.exe'
NPM=NODE.parent/'node_modules/npm/bin/npm-cli.js'
PYTHON=Path(sys.executable)
PWSH=Path(r'C:/Users/melsa/.cache/codex-runtimes/codex-primary-runtime/dependencies/native/powershell/pwsh.exe')
def identity(path):
 b=path.read_bytes();return {'byteLength':len(b),'sha256':hashlib.sha256(b).hexdigest()}
def install(archive):
 stage=Path(tempfile.mkdtemp(prefix='memoryos-rest-p1-final-'))
 assert stage.parent.resolve()==Path(tempfile.gettempdir()).resolve()
 compressed=archive.read_bytes();assert len(compressed)<=16777216 and compressed[:4]==bytes([31,139,8,0]) and compressed[4:8]==bytes(4)
 with tarfile.open(archive) as tar:
  members=tar.getmembers();assert len(members)<=256 and sum(m.size for m in members)<=67108864
  assert [m.name for m in members]==sorted(m.name for m in members) and len(set(m.name.casefold() for m in members))==len(members)
  for member in members:
   name=member.name;assert member.isfile() and name.startswith('package/') and len(name)<=248 and member.size<=8388608
   assert all(x not in ['', '.', '..'] for x in name.split('/')) and all(c.isascii() and (c.isalnum() or c in '_./-') for c in name)
   assert member.uid==member.gid==member.mtime==0 and not member.uname and not member.gname and not member.pax_headers
   assert member.mode==(0o755 if name.startswith('package/bin/') else 0o644)
   target=stage/name;target.parent.mkdir(parents=True,exist_ok=True);target.write_bytes(tar.extractfile(member).read())
 for name in ['private','empty','npm-cache']:(stage/name).mkdir()
 cache=stage/'npm-cache';assert list(cache.iterdir())==[]
 clean={k:v for k,v in os.environ.items() if k.upper() in ['SYSTEMROOT','WINDIR','TEMP','TMP']}
 npm_command=[str(NODE),str(NPM),'ci','--offline','--ignore-scripts','--no-audit','--no-fund','--cache',str(cache)]
 completed=subprocess.run(npm_command,cwd=stage/'package',env=clean,capture_output=True,text=True,timeout=60)
 assert completed.returncode==0,(completed.returncode,completed.stdout,completed.stderr)
 manifest=json.loads((stage/'package/distribution-manifest.json').read_bytes())
 actual=sorted(p.relative_to(stage/'package').as_posix() for p in (stage/'package').rglob('*') if p.is_file())
 assert actual==sorted([row['path'] for row in manifest['files']]+['distribution-manifest.json']),(actual,manifest)
 for row in manifest['files']:assert identity(stage/'package'/row['path'])=={k:row[k] for k in ['byteLength','sha256']},row['path']
 private=stage/'private';(private/'token').write_text(secrets.token_hex(32),encoding='ascii')
 subprocess.run([r'C:/Program Files/Git/usr/bin/openssl.exe','req','-x509','-newkey','ec','-pkeyopt','ec_paramgen_curve:P-256','-nodes','-keyout',str(private/'key.pem'),'-out',str(private/'cert.pem'),'-days','3','-subj','/CN=MO1305 installed campaign','-addext','subjectAltName=IP:127.0.0.1'],check=True,capture_output=True,env=clean)
 configuration={'version':'1.0.0','port':13050,'tokenFile':str(private/'token'),'privateKeyFile':str(private/'key.pem'),'certificateFile':str(private/'cert.pem')}
 (private/'config.json').write_text(json.dumps(configuration,separators=(',',':')),encoding='ascii')
 script="""param([string]$PrivateDirectory)
 $ErrorActionPreference='Stop'
 $serviceSid=[System.Security.Principal.WindowsIdentity]::GetCurrent().User
 foreach($name in @('token','key.pem','config.json')){
  $acl=[System.Security.AccessControl.FileSecurity]::new();$acl.SetOwner($serviceSid);$acl.SetAccessRuleProtection($true,$false)
  foreach($sid in @($serviceSid.Value,'S-1-5-18','S-1-5-32-544')){$acl.AddAccessRule([System.Security.AccessControl.FileSystemAccessRule]::new([System.Security.Principal.SecurityIdentifier]::new($sid),'FullControl','Allow'))}
  Set-Acl -LiteralPath (Join-Path $PrivateDirectory $name) -AclObject $acl
 }
 """
 acl_script=stage/'set-private-acl.ps1';acl_script.write_text(script,encoding='utf-8')
 subprocess.run([str(PWSH),'-NoProfile','-NonInteractive','-File',str(acl_script),'-PrivateDirectory',str(private)],check=True,capture_output=True,env=clean)
 (ROOT/'.cache/mo1305-resume/installed-path.txt').write_text(str(stage),encoding='utf-8')
 record={'kind':'MemoryOSRESTOfflineInstallation','state':'PASS','archive':identity(archive),'distributionManifest':identity(stage/'package/distribution-manifest.json'),'stage':str(stage),'cacheInitiallyEmpty':True,'npm':'11.19.0','node':'24.21.0','command':['npm',*npm_command[2:]],'exitCode':completed.returncode,'stdout':completed.stdout,'stderr':completed.stderr,'installedFileCount':len(actual),'postInstallEveryFileMatches':True}
 return record
if __name__=='__main__':
 result=install(Path(sys.argv[1]) if len(sys.argv)>1 else ROOT/'.cache/mo1305-resume/build/memoryos-rest-0.1.0.tgz')
 out=ROOT/'.cache/mo1305-resource-review/offline-install.json';out.write_text(json.dumps(result,sort_keys=True,separators=(',',':')),encoding='utf-8')
 print(json.dumps(result))
