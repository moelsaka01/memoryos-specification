"""Bounded Phase 2D engineering commands and content identities."""
import hashlib,json,os,re,subprocess,sys,time,uuid
from pathlib import Path
ROOT=Path(__file__).resolve().parents[4]
TOOLS=Path(__file__).parent
PKG=ROOT/'repositories/memoryos-ci'
OUT=ROOT/'repositories/cca-conformance/evidence/mo1306/phase2d'
CACHE=ROOT/'.cache/mo1306-phase2d-retry'
NODE=ROOT/'.cache/mo1305-phase3br/toolchain/node-v24.21.0-win-x64/node.exe'
NPM=NODE.parent/'node_modules/npm/bin/npm-cli.js'
B1='dbafc0061aa493da2517ee5564f9ea6adb90f52d'
ENV={k:os.environ[k] for k in ('SystemRoot','WINDIR')}
ENV['PATHEXT']='.COM;.EXE;.BAT;.CMD'
ENV['GIT_OPTIONAL_LOCKS']='0'
ENV['PYTHONDONTWRITEBYTECODE']='1'
ENV['PYTHONPATH']=str(ROOT/'.cache/mo1306/validators')
STARTED='2026-09-26T15:36:50Z'
SOURCES={'2a':'688caf42eff085bbc37d861a61a3948105d2af6e','2b-implementation':'1d43584cef532ebcdf1e87b0cba277d2d7180a63','2b':'7ff57e2a5ec8573dcb2b9624fc5fb3925804d886','2c-original':'e1c990bf65d0c7925a68eea8222cd304f8ce6db6','2c':'9ae367fdebbef3c72cc124a803cd00b9b353c2b1'}
OUT.mkdir(parents=True,exist_ok=True)
CACHE.mkdir(parents=True,exist_ok=True)
def j(value):return (json.dumps(value,sort_keys=True,separators=(',',':'))+'\n').encode()
def sha(data):return 'sha256:'+hashlib.sha256(data).hexdigest()
def row(path,base=ROOT):
 data=path.read_bytes();return {'path':path.relative_to(base).as_posix(),'byteLength':len(data),'sha256':sha(data)}
def put(name,value):
 target=OUT/name;target.parent.mkdir(parents=True,exist_ok=True)
 raw=j(value);assert len(raw)<=2*1024*1024,'engineering JSON cap'
 if target.exists() and target.read_bytes()!=raw:
  prior=OUT/'attempts'/(target.stem+'-'+uuid.uuid4().hex[:8]+target.suffix);prior.parent.mkdir(exist_ok=True);prior.write_bytes(target.read_bytes())
 target.write_bytes(raw)
def git(*args):return subprocess.check_output(['git','-c','core.longpaths=true',*args],cwd=ROOT,env={**os.environ,'GIT_OPTIONAL_LOCKS':'0'}).decode().strip()
def command(name,argv,expected=0,env=None,cwd=ROOT,timeout=90,tests=None):
 start=time.monotonic();argv=list(map(str,argv))
 try:
  result=subprocess.run(argv,cwd=cwd,env=env or ENV,capture_output=True,stdin=subprocess.DEVNULL,timeout=timeout,creationflags=subprocess.CREATE_NO_WINDOW)
  stdout=result.stdout;stderr=result.stderr;code=result.returncode;failure=None
 except subprocess.TimeoutExpired as error:
  stdout=error.stdout or b'';stderr=error.stderr or b'';code=None;failure='TIMEOUT'
 records=OUT/'commands';records.mkdir(exist_ok=True)
 paths=[]
 for stream,raw in [('stdout',stdout),('stderr',stderr)]:
  target=records/(name+'.'+stream+'.txt')
  if target.exists() and target.read_bytes()!=raw:
   prior=OUT/'attempts'/(target.name+'-'+uuid.uuid4().hex[:8]);prior.parent.mkdir(exist_ok=True);prior.write_bytes(target.read_bytes())
  target.write_bytes(raw);paths.append(row(target))
 record={'id':name,'command':argv,'cwd':str(cwd),'expectedExitCode':expected,'exitCode':code,'elapsedMs':round((time.monotonic()-start)*1000),'status':'PASS' if code==expected else 'FAIL','streams':paths,'failure':failure}
 if tests is not None:
  counts={k:int(v) for k,v in re.findall(r'^# (tests|pass|fail|cancelled|skipped|todo) (\d+)\s*$',stdout.decode('utf8'),re.M)}
  record['counts']=counts
  if counts!={'tests':tests,'pass':tests,'fail':0,'cancelled':0,'skipped':0,'todo':0}:record['status']='FAIL'
 put('commands/'+name+'.json',record)
 print(name,record['status'],record['elapsedMs'],'ms',flush=True)
 assert record['status']=='PASS',(name,code,stdout.decode('utf8','replace')[-6000:],stderr.decode('utf8','replace')[-3000:])
 return record,stdout
