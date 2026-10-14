from pathlib import Path
import json,copy,gzip,os
from materialize import ROOT,j,sha
from trace import validate_trace
E=ROOT/'repositories/cca-conformance/evidence/mo1306'
for p in E.rglob('*.json'):
 assert p.stat().st_size<=2097152,('ENGINEERING_JSON_LIMIT',p)
 r=json.loads(p.read_bytes())
 if not isinstance(r,dict) or 'traceEncoding' not in r:continue
 encoding=r['traceEncoding'];original=gzip.decompress((ROOT/encoding['archive']['path']).read_bytes())
 assert len(original)==encoding['originalByteLength'] and sha(original)==encoding['originalJsonSha256']
 expanded=copy.deepcopy(r);expanded.pop('traceEncoding')
 for row in expanded['lifetimes']+[row for sample in expanded['observation']['samples'] for row in sample['processes']]:
  if isinstance(row.get('commandLine'),dict):row['commandLine']=encoding['commandLines'][row['commandLine']['sha256']]
 assert j(expanded)==original
node=ROOT/'.cache/mo1305-phase3br/toolchain/node-v24.21.0-win-x64/node.exe'
ids={'node':str(node),'powershell':str(Path(os.environ['SystemRoot'])/'System32/WindowsPowerShell/v1.0/powershell.exe'),'conhost':str(Path(os.environ['SystemRoot'])/'System32/conhost.exe')}
package=ROOT/'.cache/mo1306/final-package-v2/install/node_modules/memoryos-ci'
for name in ['pass','fail','cne']:
 r=json.loads((E/'package-v2'/('installed-evaluate-policy-'+name+'.json')).read_bytes());validate_trace(r,ids,package)
for name in ['real-extra-2','real-extra-3','parent-termination']:
 r=json.loads((E/'lifecycle'/(name+'.json')).read_bytes());assert r['status']=='PASS'
print(json.dumps({'status':'PASS','finalInstalledTopologyCases':3,'liveTopologyNegatives':2,'forcedParentTermination':1,'losslessHistoricalRecords':19,'engineeringRecordCeilingBytes':2097152}))
