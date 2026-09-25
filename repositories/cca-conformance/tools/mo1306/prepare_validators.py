"""Separately authorized public dependency preparation; actual validation is offline."""
import sys,json,urllib.request,hashlib,zipfile,email
from pathlib import Path
from pip._vendor.packaging.requirements import Requirement
from pip._vendor.packaging.version import Version
ROOT=Path(__file__).resolve().parents[4]
DEST=ROOT/'.cache/mo1306/wheels'
ENV=ROOT/'.cache/mo1306/validators'
NOTICE=ROOT/'repositories/cca-conformance/fixtures/mo1306/validator-notices'
for p in [DEST,ENV,NOTICE]:p.mkdir(parents=True,exist_ok=True)
queue=[('PyYAML','6.0.3'),('jsonschema','4.26.0')]
resolved={};rows=[]
while queue:
 name,version=queue.pop(0)
 key=name.lower().replace('_','-')
 if key in resolved:continue
 url='https://pypi.org/pypi/'+name+('/'+version if version else '')+'/json'
 with urllib.request.urlopen(url,timeout=15) as response:info=json.load(response)
 version=info['info']['version']
 choices=[r for r in info['urls'] if r['filename'].endswith(('cp312-cp312-win_amd64.whl','py3-none-any.whl','py2.py3-none-any.whl','cp39-abi3-win_amd64.whl','cp310-abi3-win_amd64.whl'))]
 assert choices,(name,version,'No selected Windows or universal wheel')
 selected=sorted(choices,key=lambda r:r['filename'])[0]
 with urllib.request.urlopen(selected['url'],timeout=20) as response:data=response.read(16777217)
 assert len(data)<=16777216 and hashlib.sha256(data).hexdigest()==selected['digests']['sha256']
 wheel=DEST/selected['filename'];wheel.write_bytes(data)
 with zipfile.ZipFile(wheel) as archive:
  metadata_path=next(n for n in archive.namelist() if n.endswith('.dist-info/METADATA'))
  metadata=email.message_from_bytes(archive.read(metadata_path))
  licenses=[]
  for entry in archive.infolist():
   p=Path(entry.filename)
   assert not p.is_absolute() and '..' not in p.parts
   # A wheel is trusted engineering input after the exact hash check; never runtime product content.
   target=ENV/p
   if entry.is_dir():target.mkdir(parents=True,exist_ok=True)
   else:
    target.parent.mkdir(parents=True,exist_ok=True);target.write_bytes(archive.read(entry))
   if any(token in p.name.lower() for token in ('license','copying')):
    notice=NOTICE/(key+'-'+p.name);notice.write_bytes(archive.read(entry));licenses.append(notice.relative_to(ROOT).as_posix())
  requirements=[]
  for raw in metadata.get_all('Requires-Dist',[]):
   requirement=Requirement(raw)
   if requirement.marker and not requirement.marker.evaluate({'extra':''}):continue
   requirements.append(raw)
   dependency_key=requirement.name.lower().replace('_','-')
   if dependency_key in resolved:assert Version(resolved[dependency_key]) in requirement.specifier
   else:queue.append((requirement.name,None))
 resolved[key]=version
 rows.append(dict(name=name,version=version,filename=selected['filename'],sha256='sha256:'+selected['digests']['sha256'],byteLength=len(data),sourceUrl=selected['url'],metadataUrl=url,requires=requirements,license=metadata.get('License-Expression') or info['info'].get('license') or 'See retained notices',notices=licenses))
 print(name,version,flush=True)
lock=dict(kind='MemoryOSCICDEngineeringValidatorLock',version='1.0.0',python='3.12.14',platform='win_amd64',preparation='Public PyPI acquisition; validation uses retained local wheels only',dependencies=sorted(rows,key=lambda r:r['name'].lower()))
target=ROOT/'repositories/cca-conformance/fixtures/mo1306/engineering-validator-lock.json';target.write_text(json.dumps(lock,sort_keys=True,separators=(',',':'))+'\n',encoding='utf-8')
sys.path.insert(0,str(ENV))
import yaml,jsonschema
print('Validated imports',yaml.__version__,jsonschema.__version__)
