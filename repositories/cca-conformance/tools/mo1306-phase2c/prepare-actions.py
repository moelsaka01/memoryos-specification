"""Explicit immutable public input acquisition; never called by validation."""
import hashlib,json,urllib.request,datetime
from pathlib import Path
ROOT=Path(__file__).resolve().parents[4]
OUT=ROOT/'repositories/cca-conformance/fixtures/mo1306-phase2c/actions'
PINS={'checkout':'3d3c42e5aac5ba805825da76410c181273ba90b1','upload-artifact':'043fb46d1a93c77aae656e7c1c64a875d1fc6a0a'}
OUT.mkdir(parents=True,exist_ok=True)
rows=[]
for name,revision in PINS.items():
    url=f'https://raw.githubusercontent.com/actions/{name}/{revision}/action.yml'
    with urllib.request.urlopen(url,timeout=30) as response:data=response.read(131073)
    assert len(data)<=131072
    (OUT/(name+'-action.yml')).write_bytes(data)
    rows.append({'action':'actions/'+name,'revision':revision,'sourceUrl':url,'path':(OUT/(name+'-action.yml')).relative_to(ROOT).as_posix(),'byteLength':len(data),'sha256':hashlib.sha256(data).hexdigest()})
(OUT/'inventory.json').write_text(json.dumps({'kind':'MemoryOSPhase2CActionPins','version':'1.0.0','acquiredUtc':datetime.datetime.now(datetime.timezone.utc).isoformat(),'scope':'Immutable action metadata only; fresh complete runtime/advisory review remains Phase 3B. No action executed.','actions':rows},sort_keys=True,indent=2)+'\n',encoding='utf-8',newline='\n')
print(json.dumps(rows))
