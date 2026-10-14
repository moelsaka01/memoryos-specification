"""Record final audit/closure/receipt/correction/workspace/whitespace gates."""
from pathlib import Path
import json,subprocess,sys
from context import *
F='repositories/cca-conformance/evidence/mo1305-phase3c-refresh/'
T='repositories/cca-conformance/tools/mo1305-phase3c-refresh/'
NODE=ROOT/'.cache/mo1304-phase3-toolchain/node-v24.21.0-win-x64/node.exe'
def main():
    assert identity(NODE.read_bytes())['sha256']==read('repositories/cca-conformance/tools/mo1305-phase3-correction/package-allowlist.json')['nodeSha256'],'NODE_IDENTITY'
    commands=[('audit-closure-receipt',[sys.executable,'-B','-X','utf8',T+'audit.py','validate']),
              ('correction-final',[str(NODE),'--test','--test-concurrency=1','--test-reporter=tap',T+'correction.test.mjs']),
              ('workspace',[sys.executable,'-B','-X','utf8','tools/verify_workspace.py','--root','.']),
              ('diff-check',['git','diff','--check'])]
    results=[]
    for name,command in commands:
        result=subprocess.run(command,cwd=ROOT,capture_output=True,timeout=240)
        path=F+name+'.log';(ROOT/path).write_bytes(result.stdout+result.stderr)
        if result.returncode:raise AssertionError('FINAL_GATE_FAILED:'+name+':'+str(result.returncode))
        results.append({'name':name,'command':command,'exitCode':0,'log':reference(path)})
    audit_context()
    value={'kind':'MemoryOSRESTPhase3CRefreshValidation','version':'1.0.0','state':'PASS','candidate':C3B,'results':results,'receipt':reference(F+'receipt.json'),'productionUnchanged':True,'releaseTag':'ABSENT','stagedAndPostCommitChecks':'Reported from final Git state; not self-embedded'}
    (ROOT/F/'validation.json').write_bytes(j(value))
    print(json.dumps({'state':'PASS','gates':[x[0] for x in commands],'receipt':value['receipt']}))
if __name__=='__main__':main()
