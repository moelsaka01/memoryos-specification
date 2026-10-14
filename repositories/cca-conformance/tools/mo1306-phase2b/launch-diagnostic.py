"""Bounded fixed-code console diagnostic; no provider or semantic claims."""
import base64,json,os,subprocess,sys,time
from pathlib import Path
from prepare import CACHE,EVIDENCE,j
pwsh=Path(sys.executable).parents[1]/'native/powershell/pwsh.exe'
env={k:os.environ[k] for k in ('SystemRoot','WINDIR')}
code="[Console]::Out.WriteLine('PROBE-OUT'); [Console]::Error.WriteLine('PROBE-ERR'); exit 23"
records=[]
for label,flags in [('no-window',subprocess.CREATE_NO_WINDOW),('detached',subprocess.DETACHED_PROCESS),('ordinary',0)]:
    args=[str(pwsh),'-NoProfile','-NonInteractive','-EncodedCommand',base64.b64encode(code.encode('utf-16le')).decode()]
    result=subprocess.run(args,capture_output=True,env=env,creationflags=flags,timeout=10)
    records.append(dict(profile=label,exitCode=result.returncode,stdout=result.stdout.decode(),stderr=result.stderr.decode()))
(EVIDENCE/'launch-diagnostic.json').write_bytes(j(records))
print(json.dumps(records))
