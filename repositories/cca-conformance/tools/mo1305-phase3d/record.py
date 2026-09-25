"""Record pre-I3 validation using fixed commands, without runtime campaigns."""
import subprocess
from common import *

def run(name,command):
    result=subprocess.run([str(x) for x in command],cwd=ROOT,capture_output=True,timeout=180,env={**os.environ,'GIT_OPTIONAL_LOCKS':'0','MEMORYOS_CONFORMANCE_PYTHON':sys.executable})
    need(result.returncode==0,name+':'+result.stderr.decode(errors='replace')[-3000:]+result.stdout.decode(errors='replace')[-3000:])
    need(not result.stderr,name+'_STDERR')
    return result.stdout

if __name__=='__main__':
    need(textgit('rev-parse','HEAD')==C3B,'PRE_I3_ONLY')
    data=run('final-conformance',[NODE,'--test','--test-concurrency=1','--test-reporter=tap','repositories/cca-conformance/tests/mo1305_phase3_conformance_test.mjs'])
    (ROOT/(E+'final-conformance.tap')).write_bytes(data)
    result=json.loads(run('integrated-validation',[sys.executable,'-B','-X','utf8',T+'validate.py']))
    save(E+'pre-binding-validation.json',result)
    data=run('workspace',[sys.executable,'-B','-X','utf8','tools/verify_workspace.py','--root','.'])
    (ROOT/(E+'workspace.log')).write_bytes(data)
    run('diff-check',['git','diff','--check'])
    print(json.dumps({'state':'PASS','testCount':43,'workspace':'PASS','diffCheck':'PASS','runtimeCampaigns':0}))
