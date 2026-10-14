"""Bounded correction evidence; never writes historical evidence or other worktrees."""
import hashlib,json,os,subprocess,sys,time
from pathlib import Path
ROOT=Path(__file__).resolve().parents[4]
TOOLS=Path(__file__).parent
PKG=ROOT/'repositories/memoryos-ci'
OUT=ROOT/'repositories/cca-conformance/evidence/mo1306/phase3-helper-correction'
CACHE=ROOT/'.cache/c3c'
NODE=ROOT/'.cache/mo1305-phase3br/toolchain/node-v24.21.0-win-x64/node.exe'
NPM=NODE.parent/'node_modules/npm/bin/npm-cli.js'
B2='0e35ffe70919d77b1db530929093826410b805f9'
I2='58b7b8cc90fe798fafe6d09bf04db45ceea29f6d'
ENV={k:os.environ[k] for k in ('SystemRoot','WINDIR')}
def j(value):return (json.dumps(value,sort_keys=True,separators=(',',':'),ensure_ascii=True)+'\n').encode()
def sha(raw):return 'sha256:'+hashlib.sha256(raw).hexdigest()
def row(p,base=ROOT):
 raw=p.read_bytes();return {'path':p.relative_to(base).as_posix(),'byteLength':len(raw),'sha256':sha(raw)}
def put(name,value):
 p=OUT/name;p.parent.mkdir(parents=True,exist_ok=True);raw=j(value)
 assert len(raw)<4*1024*1024
 if p.exists():assert p.read_bytes()==raw,'Refusing to replace retained evidence: '+name
 else:p.write_bytes(raw)
def git(*args):
 return subprocess.check_output(['git','-c','core.longpaths=true',*args],cwd=ROOT,env={**os.environ,'GIT_OPTIONAL_LOCKS':'0'},stdin=subprocess.DEVNULL).decode().strip()
def command(argv,cwd=ROOT,env=None,timeout=90):
 argv=list(map(str,argv));start=time.monotonic()
 r=subprocess.run(argv,cwd=cwd,env=ENV if env is None else env,stdin=subprocess.DEVNULL,capture_output=True,timeout=timeout,creationflags=subprocess.CREATE_NO_WINDOW)
 return {'argv':argv,'cwd':str(cwd),'exitCode':r.returncode,'stdout':r.stdout.decode('utf8'),'stderr':r.stderr.decode('utf8'),'elapsedMs':round((time.monotonic()-start)*1000)}
def inventory(root):return sorted((row(p,root) for p in root.rglob('*') if p.is_file()),key=lambda x:x['path'])

C3A='90b9ac914e477fb90fe317d0de9ba310aae37f60'
C3AB='9e1bbff99c23cdbc4c80f11e87eadb89a36e8f44'
