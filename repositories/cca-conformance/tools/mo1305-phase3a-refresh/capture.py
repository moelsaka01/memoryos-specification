"""Capture exact executed input identities before the one fresh installation."""
from pathlib import Path
import hashlib,json
ROOT=Path(__file__).resolve().parents[4]
HERE=Path(__file__).resolve().parent
E=ROOT/'repositories/cca-conformance/evidence/mo1305-phase3a-refresh'
def capture():
 names=['.gitattributes','common.mjs','fetch-client.mjs','bounded-fetch-client.mjs','historical-harness.json','windows.ps1','private-acl.ps1','preflight.py','capture.py','prepare.py','probe.mjs','execute.mjs','finish.py']
 paths=[HERE/n for n in names]
 paths.extend(HERE.parent/n for n in ['mo1305-host-guard.mjs','mo1305-host-events.ps1','mo1305-host-guard-policy.json','mo1305-phase1/validate-launch.ps1'])
 paths.extend(HERE.parent/'mo1305-phase3-correction'/n for n in ['distribution.py','install.py','spdx.py','schema_validation.py','schema-runtime.json','package-allowlist.json','check.py','metadata_test.py'])
 rows=[]
 for path in sorted(paths):
  raw=path.read_bytes();rows.append({'path':path.relative_to(ROOT).as_posix(),'byteLength':len(raw),'sha256':hashlib.sha256(raw).hexdigest()})
 value={'kind':'MemoryOSRESTWindowsRefreshHarness','version':'1.0.0','files':sorted(rows,key=lambda x:x['path'])}
 with (E/'harness.json').open('xb') as out:out.write(json.dumps(value,sort_keys=True,separators=(',',':')).encode())
 print(json.dumps({'state':'PASS','executedInputFiles':len(rows)}))
if __name__=='__main__':capture()