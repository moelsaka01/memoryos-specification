import json,os
from pathlib import Path
from materialize import ROOT,j
from observe import execute
node=ROOT/'.cache/mo1305-phase3br/toolchain/node-v24.21.0-win-x64/node.exe'
env={**os.environ,'PATH':'SYNTHETIC-PATH-SENTINEL','TEMP':'SYNTHETIC-TEMP-SENTINEL','USERPROFILE':'SYNTHETIC-PROFILE-SENTINEL'}
for mode in ['attached','detached']:
 result=execute([str(node),'--max-old-space-size=128',str(Path(__file__).with_name('process-probe.mjs')),mode],str(ROOT),env=env,timeout=8)
 destination=ROOT/'repositories/cca-conformance/evidence/mo1306/phase1'/('process-probe-'+mode+'.json')
 destination.write_bytes(j(result))
 observation=result['observation']
 print(mode,result['stdout'],{k:v for k,v in observation.items() if k!='samples'})
 for sample in observation['samples']:
  if len(sample['processes'])==observation['peakProcessCount']:
   print('peak',sample);break
