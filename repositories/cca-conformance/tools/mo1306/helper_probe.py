import os,subprocess,json
from pathlib import Path
from materialize import ROOT,j
from observe import execute
node=ROOT/'.cache/mo1305-phase3br/toolchain/node-v24.21.0-win-x64/node.exe'
for mode in ['attached','detached']:
 result=execute([str(node),'--max-old-space-size=128',str(Path(__file__).with_name('helper-probe.mjs')),mode],str(ROOT),env={'SystemRoot':os.environ['SystemRoot'],'WINDIR':os.environ['WINDIR']},timeout=8,creationflags=subprocess.DETACHED_PROCESS|subprocess.CREATE_NEW_PROCESS_GROUP)
 target=ROOT/'repositories/cca-conformance/evidence/mo1306/phase1'/('helper-probe-'+mode+'.json')
 target.write_bytes(j(result))
 print(mode,result['stdout'],{k:v for k,v in result['observation'].items() if k!='samples'})
 print(max(result['observation']['samples'],key=lambda s:len(s['processes'])))
