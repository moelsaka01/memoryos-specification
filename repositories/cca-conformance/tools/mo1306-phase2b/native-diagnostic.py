"""Fixed-code diagnostics for native launcher boundaries (not acceptance)."""
import base64,json,os,subprocess,sys
from pathlib import Path
from prepare import ROOT,CACHE,EVIDENCE,j
state=json.loads((CACHE/'active-stage.json').read_bytes())
stage=Path(state['stage'])
work=CACHE/'execution-7n66sap5/gitlab-evaluate-policy-pass'
env={k:os.environ[k] for k in ('SystemRoot','WINDIR')}
env['PATHEXT']='.EXE'
env.update(MEMORYOS_CI_NODE=state['nodePath'],MEMORYOS_CI_HOME=str(stage),MEMORYOS_CI_CONFIG=str(work/'memoryos-ci.json'),CI_PROJECT_DIR=str(work))
script=(work/'launch.ps1').read_text()
pwsh=Path(sys.executable).parents[1]/'native/powershell/pwsh.exe'
records=[]
for label,code in [
 ('generated-markers',"[Console]::Out.WriteLine('BEFORE')\n"+script),
 ('nested-no-exit',"[Console]::Out.WriteLine('BEFORE')\n"+script.replace('exit $status',"[Console]::Out.WriteLine('AFTER '+$status)")),
 ('node-direct',"[Console]::Out.WriteLine('BEFORE'); & $env:MEMORYOS_CI_NODE '-e' 'console.log(123);process.exit(23)'; [Console]::Out.WriteLine('AFTER '+$LASTEXITCODE); exit 24"),
 ('hash-only',"[Console]::Out.WriteLine('BEFORE'); (Get-FileHash -LiteralPath $env:MEMORYOS_CI_NODE).Hash; [Console]::Out.WriteLine('AFTER'); exit 25"),
 ]:
 args=[str(pwsh),'-NoProfile','-NonInteractive','-EncodedCommand',base64.b64encode(code.encode('utf-16le')).decode()]
 r=subprocess.run(args,capture_output=True,env=env,cwd=ROOT,creationflags=subprocess.CREATE_NO_WINDOW,timeout=40)
 records.append(dict(id=label,exitCode=r.returncode,stdout=r.stdout.decode(errors='replace'),stderr=r.stderr.decode(errors='replace')))
(EVIDENCE/'native-diagnostic.json').write_bytes(j(records))
print(json.dumps(records))
