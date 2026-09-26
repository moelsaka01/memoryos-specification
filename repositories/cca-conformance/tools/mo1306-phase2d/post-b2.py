"""Bounded read-only post-B2 verification; output is local cache only."""
from conformance import *
import time
started=time.monotonic();result=validate(*load(),post_b2=True);i2=git('rev-parse','HEAD^');b2=git('rev-parse','HEAD')
commands=[]
for name,argv in [
 ('historical-B1-replay',[NODE,'--test','--test-reporter=tap',TOOLS/'history.test.mjs']),
 ('workspace',[sys.executable,'-B','-X','utf8',ROOT/'tools/verify_workspace.py','--root',ROOT]),
 ('diff-check',['git','-c','core.longpaths=true','diff','--check','HEAD^','HEAD'])]:
 r=subprocess.run(list(map(str,argv)),cwd=ROOT,env={**os.environ,**ENV},stdin=subprocess.DEVNULL,capture_output=True,timeout=90,creationflags=subprocess.CREATE_NO_WINDOW)
 (CACHE/('post-b2-'+name+'.stdout.txt')).write_bytes(r.stdout);(CACHE/('post-b2-'+name+'.stderr.txt')).write_bytes(r.stderr)
 assert r.returncode==0,(name,r.stdout[-2000:],r.stderr[-2000:])
 if name=='historical-B1-replay':assert b'# tests 3' in r.stdout and b'# pass 3' in r.stdout and b'"passed":152' in r.stdout
 commands.append({'id':name,'status':'PASS','exitCode':0,'stdoutSha256':sha(r.stdout),'stderrSha256':sha(r.stderr)})
assert sha(NODE.read_bytes())=='sha256:ba4e6d110e8c1592a1ecd390f6b05f3da124b13871a5be62b341a07a853c6c32'
source=[]
for name in ['2a','2b','2c']:
 folder=ROOT.parent/('cca-mo1306-'+name)
 args=['git','-c','core.longpaths=true','-c','safe.directory='+str(folder),'-C',str(folder)]
 head=subprocess.check_output(args+['rev-parse','HEAD'],env={**os.environ,**ENV}).decode().strip();status=subprocess.check_output(args+['status','--porcelain'],env={**os.environ,**ENV}).decode().strip()
 assert head==SOURCES[name] and status=='';source.append({'source':name,'head':head,'clean':True})
assert git('status','--porcelain')==''
report={'status':'PASS','I2':i2,'B2':b2,'I2Parent':B1,'B2Parent':i2,'conformance':result,'commands':commands,'nodeIdentity':'PASS','sources':source,'mainClean':True,'phase3Started':False,'elapsedSeconds':round(time.monotonic()-started,3)}
(CACHE/'post-b2.json').write_bytes(j(report));print(json.dumps(report,sort_keys=True))
