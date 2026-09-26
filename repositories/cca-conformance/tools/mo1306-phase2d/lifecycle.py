"""Affected generic lifecycle witnesses retain the unchanged frozen supervisor."""
from native import observed,IDS,DISTRIBUTION,FIX
from common import *
import shutil
batch=CACHE/('lifecycle-'+uuid.uuid4().hex[:6]);batch.mkdir();cases=[]
for mode,expected,worker in [('helper-cancel','MO1306_CANCELLED',None),('worker-timeout','MO1306_TIMEOUT','process.stdin.resume();setInterval(()=>{},1000);'),('worker-cancel','MO1306_CANCELLED','process.stdin.resume();setInterval(()=>{},1000);')]:
 package=PKG
 if worker:
  package=batch/mode;shutil.copytree(PKG,package);(package/'src/worker.mjs').write_bytes(worker.encode())
  assert (package/'src/supervisor.mjs').read_bytes()==(PKG/'src/supervisor.mjs').read_bytes()
 result=observed('lifecycle-'+mode,[NODE,'--max-old-space-size=128',TOOLS.parent/'mo1306/lifecycle-driver.mjs',mode,package,FIX/'evaluate-policy-pass'],package=package,timeout=12)
 assert json.loads(result['stdout'])['result']==expected
 cases.append({'id':mode,'status':'PASS','expected':expected,'faultInjection':worker,'trace':row(OUT/'native'/('lifecycle-'+mode+'.json'))})
put('lifecycle.json',{'status':'PASS','distributionDigest':DISTRIBUTION,'cases':cases,'supervisor':row(PKG/'src/supervisor.mjs'),'filesystem':row(PKG/'src/filesystem.mjs'),'helper':row(PKG/'scripts/check-paths.ps1'),'scope':'Focused helper cancellation / worker timeout / worker cancellation with actual children and strict role-bound topology. Unaffected Phase 1 resource characterization is reused by exact source identity.'})
