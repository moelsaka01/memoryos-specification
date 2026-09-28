"""Offline final integration helpers. Historical worktrees are read only."""
import copy, hashlib, importlib.util, json, os, subprocess, sys, time
from pathlib import Path
sys.dont_write_bytecode = True
ROOT = Path(__file__).resolve().parents[4]
TOOLS = Path(__file__).resolve().parent
OUT = ROOT / 'repositories/cca-conformance/evidence/mo1306/phase3d'
CACHE = ROOT / '.cache/mo1306-phase3d'
PKG = ROOT / 'repositories/memoryos-ci'
SCOPE_TOOLS = ROOT / 'repositories/cca-conformance/tools/mo1306-scope-correction'
sys.path.insert(0, str(SCOPE_TOOLS))
from common import need, sha, enc, read, save, ref, check, git, blobs, snapshot, PEERS, C3CB, M3, C3AB, B3, C3, PINS, ARCHIVE, DIST
from evidence import Evidence
from policy import validate_policy, WORDING
sys.path.remove(str(SCOPE_TOOLS))
S3 = '6e562c578f86022ee28911f7b91a8b3aa209da17'
B2 = '0e35ffe70919d77b1db530929093826410b805f9'
C3A = '90b9ac914e477fb90fe317d0de9ba310aae37f60'
C3C = '39d83316f7c72d6cb49f8b6cde36c1bfa833112a'
CHAIN = {'B2':B2,'C3A':C3A,'C3AB':C3AB,'C3C':C3C,'C3CB':C3CB,'M3':M3,'S3':S3}
E = ROOT / 'repositories/cca-conformance/evidence/mo1306'
SCOPE = ROOT / 'repositories/cca-conformance/mo1306-hosted-scope-correction.json'
FINAL = ROOT / 'repositories/cca-conformance/mo1306-final-release-inventory.json'
NODE = ROOT / '.cache/mo1305-phase3br/toolchain/node-v24.21.0-win-x64/node.exe'
NPM = NODE.parent / 'node_modules/npm/bin/npm-cli.js'
I3_SUBJECT = 'conformance(memoryos-1.3): integrate MO-1306 final certification'
BF_SUBJECT = 'conformance(memoryos-1.3): close MO-1306 provider-neutral CI/CD certification'
ENV = {k:os.environ[k] for k in ('SystemRoot','WINDIR')}
ENV.update(NODE_DISABLE_COMPILE_CACHE='1')
BF_FILES = ['repositories/cca-conformance/mo1306-final-release-inventory.json'] + [f'repositories/cca-conformance/evidence/mo1306/phase3d/{s}.json' for s in ('binding','binding-graph','binding-validation')]
def command(argv, timeout=60, cwd=ROOT):
    start=time.monotonic()
    argv=list(map(str,argv));environment=ENV
    if argv[0]=='git':
        argv=['git','-c','safe.directory='+str(cwd),'-C',str(cwd)]+argv[1:]
        environment={**os.environ,'GIT_OPTIONAL_LOCKS':'0'}
    r=subprocess.run(argv,cwd=cwd,env=environment,stdin=subprocess.DEVNULL,capture_output=True,timeout=timeout,creationflags=subprocess.CREATE_NO_WINDOW)
    return {'argv':argv,'cwd':str(cwd),'exitCode':r.returncode,'stdout':r.stdout.decode('utf-8'),'stderr':r.stderr.decode('utf-8'),'elapsedMs':round((time.monotonic()-start)*1000)}
def put(name, value): save(OUT/name,value)
def load(name): return read(OUT/name)
def graph():
    rows=[]
    previous=None
    for role,rev in CHAIN.items():
        fields=git('rev-list','--parents','-n','1',rev).decode().split()
        need(len(fields)==2,'SINGLE_PARENT_'+role)
        if previous: need(fields[1]==previous,'PARENT_'+role)
        rows.append({'role':role,'commit':rev,'parent':fields[1],'subject':git('show','-s','--format=%s',rev).decode().strip()})
        previous=rev
    return rows
def inventory(folder): return sorted([ref(p) for p in folder.rglob('*') if p.is_file()],key=lambda x:x['path'])
def source(e,suffix,owner='3A'):
    return e.rows[(owner,suffix)]['file'] if suffix.startswith(('repositories/','docs/','.github/','.cache/')) else e.local(suffix,owner)
def obj(e,suffix,owner='3A'): return json.loads(check(source(e,suffix,owner)))
def identity(raw):return {'byteLength':len(raw),'sha256':sha(raw)}
def s3_snapshot():
    inv=read(E/'scope-correction/inventory.json')
    refs=inv['files']+[ref(E/'scope-correction/inventory.json')]
    old=blobs([S3+':'+r['path'] for r in refs])
    for r in refs:
        b=old[S3+':'+r['path']];need(identity(b)=={k:r[k] for k in ('byteLength','sha256')},'S3_SNAPSHOT_IDENTITY')
        if r['path']!='ROADMAP.md':need(check(r)==b,'S3_HISTORY_CHANGED')
    return {'commit':S3,'files':len(refs),'roadmapHistoricalBlob':identity(old[S3+':ROADMAP.md']),'status':'PASS'}
