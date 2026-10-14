"""Lossless bounded trace encoding; retain original failed oversized records verbatim."""
from pathlib import Path
import json,hashlib,gzip,copy
from materialize import ROOT,j,sha
OUT=ROOT/'repositories/cca-conformance/evidence/mo1306'
rows=[]
for p in sorted(OUT.rglob('*.json')):
 raw=p.read_bytes()
 if len(raw)<=2097152:continue
 record=json.loads(raw);assert 'observation' in record and 'lifetimes' in record
 original=copy.deepcopy(record);dictionary={}
 for row in record['lifetimes']+[row for sample in record['observation']['samples'] for row in sample['processes']]:
  command=row.get('commandLine')
  if command is not None:
   assert isinstance(command,str)
   key=sha(command.encode());dictionary[key]=command;row['commandLine']={'sha256':key}
 archive=OUT/'oversized-trace-history'/(sha(raw)[7:]+'.json.gz');archive.parent.mkdir(exist_ok=True)
 zipped=gzip.compress(raw,mtime=0);archive.write_bytes(zipped)
 record['traceEncoding']={'kind':'LosslessCommandLineDictionary','version':'1.0.0','commandLines':dictionary,'originalJsonSha256':sha(raw),'originalByteLength':len(raw),'archive':{'path':archive.relative_to(ROOT).as_posix(),'byteLength':len(zipped),'sha256':sha(zipped)}}
 compact=j(record);assert len(compact)<=2097152
 expanded=copy.deepcopy(record);encoding=expanded.pop('traceEncoding')
 for row in expanded['lifetimes']+[row for sample in expanded['observation']['samples'] for row in sample['processes']]:
  if isinstance(row.get('commandLine'),dict):row['commandLine']=encoding['commandLines'][row['commandLine']['sha256']]
 assert expanded==original and j(expanded)==raw and gzip.decompress(zipped)==raw
 p.write_bytes(compact);rows.append({'path':p.relative_to(ROOT).as_posix(),'originalSha256':sha(raw),'originalByteLength':len(raw),'derivedSha256':sha(compact),'derivedByteLength':len(compact),'archive':encoding['archive']})
(OUT/'trace-encoding.json').write_bytes(j({'status':'PASS','originalHarnessDefect':'Repeated command-line strings exceeded the 2 MiB engineering-record ceiling. Original records are preserved verbatim as gzip binary historical artifacts; no ceiling was increased.','encoding':'Lossless dictionary, SHA-256-keyed strings; round-trip exact bytes checked for every record. Original embedded hash references resolve via originalJsonSha256 and retained archive.','recordCount':len(rows),'records':rows}))
print('Losslessly encoded',len(rows),'records; all accepted JSON records <=2 MiB.')
