"""Read-only candidate verification; no package rebuild or old evidence writes."""
from pathlib import Path
from datetime import datetime,timezone
import hashlib,json,os,subprocess,sys,tarfile,time
ROOT=Path(__file__).resolve().parents[4];OUT=ROOT/'repositories/cca-conformance/evidence/mo1306/phase3ar-resolution';OLD=ROOT/'repositories/cca-conformance/evidence/mo1306/phase3ar';SOURCE=ROOT/'repositories/memoryos-ci'
CHECKPOINT='f236c4a2f94d8cd8e763aaa4bd6c52d703429692';C3AB='9e1bbff99c23cdbc4c80f11e87eadb89a36e8f44';C3A='90b9ac914e477fb90fe317d0de9ba310aae37f60';B2='0e35ffe70919d77b1db530929093826410b805f9'
def sha(b):return 'sha256:'+hashlib.sha256(b).hexdigest()
def row(p):
 b=p.read_bytes();return dict(path=p.relative_to(ROOT).as_posix(),byteLength=len(b),sha256=sha(b))
def git(*args):return subprocess.check_output(['git','--no-optional-locks',*args],cwd=ROOT,env={**os.environ,'GIT_OPTIONAL_LOCKS':'0'}).decode().strip()
def put(n,v):
 p=OUT/n;assert not p.exists();p.write_text(json.dumps(v,sort_keys=True,separators=(',',':'))+'\n',encoding='utf8')
assert git('rev-parse','HEAD')==CHECKPOINT and git('branch','--show-current')=='mo1306/phase3a-refresh'
for child,parent in [(CHECKPOINT,C3AB),(C3AB,C3A),(C3A,B2)]:assert git('show','-s','--format=%P',child)==parent
assert not git('diff','--name-only',C3AB,'--','repositories/memoryos-ci','.github/actions/memoryos-policy-gate')
old=json.loads((OLD/'package.json').read_bytes());archive=ROOT/old['archive']['path'];assert row(archive)==old['archive']
assert archive.stat().st_size==197172 and sha(archive.read_bytes())=='sha256:2f1e9424ce64e44b7b1587ce206fe5f7ae72579652ca1fc891c489bc1a21925d'
package=Path(old['installedRoot']);manifest=json.loads((SOURCE/'distribution-manifest.json').read_bytes());expected={e['path'] for e in manifest['files']}|{'distribution-manifest.json'};assert len(expected)==94
with tarfile.open(archive) as t:
 members=t.getmembers();assert len(members)==94 and len({m.name.casefold() for m in members})==94
 assert {m.name for m in members}=={'package/'+p for p in expected}
 for m in members:
  rel=m.name[8:];raw=t.extractfile(m).read();assert m.isfile() and raw==(SOURCE/rel).read_bytes()==(package/rel).read_bytes()
assert {p.relative_to(package).as_posix() for p in package.rglob('*') if p.is_file()}==expected
closure=json.loads((SOURCE/'runtime/runtime-closure-manifest.json').read_bytes());assert len(closure['files'])==25
for e in closure['files']:
 p=SOURCE/'runtime'/e['path'];assert p.stat().st_size==e['byteLength'] and sha(p.read_bytes())=='sha256:'+e['sha256']
metadata=json.loads((SOURCE/'package.json').read_bytes());assert metadata['name']=='memoryos-ci' and metadata['version']=='0.1.0' and not metadata.get('dependencies')
env=json.loads((OLD/'environment.json').read_bytes());node=ROOT/env['nodeIdentity']['path'];assert row(node)==env['nodeIdentity'] and sha(node.read_bytes())=='sha256:ba4e6d110e8c1592a1ecd390f6b05f3da124b13871a5be62b341a07a853c6c32'
r=subprocess.run([str(node),'-p','JSON.stringify({version:process.version,architecture:process.arch,platform:process.platform,execPath:process.execPath})'],capture_output=True,check=True,cwd=ROOT)
actual=json.loads(r.stdout);assert actual['version']=='v24.21.0' and actual['architecture']=='x64'
put('candidate.json',dict(status='PASS',observedUtc=datetime.now(timezone.utc).isoformat(),observationMonotonicNs=time.perf_counter_ns(),startingHead=CHECKPOINT,productAuthority=C3AB,correction=C3A,B2=B2,exactGraph=True,archive=row(archive),memberCount=94,sdkClosureFiles=25,productionDependencies=0,rebuildPerformed=False,sourceMatchesC3AB=True,installedMembers=[row(package/p) for p in sorted(expected)],node=actual,nodeIdentity=row(node),priorPackageReceipt=row(OLD/'package.json'),priorBlockedReceipt=row(OLD/'execution-receipt.json'),priorTiming=row(OLD/'github/raw-helper-timing.json'),prior404=row(OLD/'github/dispatch-pass.json'),oldEvidenceRewritten=False))
print('Candidate exact: existing corrected archive/94 installed members/25SDK/zero deps; exact graph and pinned Node verified; no rebuild.')