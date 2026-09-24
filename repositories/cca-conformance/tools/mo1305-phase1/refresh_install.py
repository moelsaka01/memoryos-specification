"""Refresh the local development install before measurements; not a release installer."""
from pathlib import Path
import tarfile
root=Path(__file__).resolve().parents[4]
base=Path((root/'.cache/mo1305-resume/installed-path.txt').read_text())
assert base.name.startswith('memoryos-rest-p1-') and base.parent.name=='Temp'
with tarfile.open(root/'.cache/mo1305-resume/build/memoryos-rest-0.1.0.tgz','r:gz') as tar:
 for member in tar.getmembers():
  assert member.isfile() and member.name.startswith('package/') and '..' not in Path(member.name).parts
  p=base/member.name;p.parent.mkdir(parents=True,exist_ok=True);p.write_bytes(tar.extractfile(member).read())
print('Development install refreshed; no execution receipt generated')
