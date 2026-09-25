"""Phase 3D identities and read-only Git/artifact operations."""
from pathlib import Path
import hashlib, json, os, subprocess, sys

if sys.flags.optimize:
    raise RuntimeError('PYTHON_OPTIMIZATION_FORBIDDEN')
sys.dont_write_bytecode = True
ROOT = Path(__file__).resolve().parents[4]
T = 'repositories/cca-conformance/tools/mo1305-phase3d/'
E = 'repositories/cca-conformance/evidence/mo1305-phase3d/'
D = 'repositories/cca-conformance/evidence/'
P = 'repositories/memoryos-rest/'
INVENTORY = 'repositories/cca-conformance/mo1305-conformance-inventory.json'
C3 = '62a70cafac68e89366740ec197074bd13fbce934'
C3B = '4ac43c4368f41ec14ea443aa303bf3a69503f2de'
B2 = '2fcc588979675462d30c582f24f42fa9ec3ec729'
A3 = '9bb679532b90016b9cc30bf5e1cdb41d376e2ff7'
I3_SUBJECT = 'cert(memoryos-1.3): integrate MO-1305 phase 3 certification'
BF_SUBJECT = 'conformance(memoryos-1.3): close MO-1305 REST Gateway certification'
NODE = ROOT / '.cache/mo1304-phase3-toolchain/node-v24.21.0-win-x64/node.exe'
ARCHIVE = {'byteLength':191823,'sha256':'faac95f7ad8939bcf7bbc33952efabebc1468d0c5654ea3eaac03f40402a7382'}
SOURCES = {
    '3A-R': {'commit':'bf82f7e48c6f45fb563b10de9f9167e2f6950a7a','branch':'mo1305/phase3a-refresh','workspace':'cca-mo1305-3a-refresh','subject':'cert(memoryos-1.3): refresh MO-1305 Windows certification','directory':'mo1305-phase3a-refresh','receipt':D+'mo1305-phase3a-refresh/windows-refresh-receipt.json','report':'docs/mo1305-phase3a-windows-refresh.md'},
    '3B-R': {'commit':'fac48362719dbc98cc10bc90c7099dfaf64a6037','branch':'mo1305/phase3b-refresh','workspace':'cca-mo1305-3b-refresh','subject':'cert(memoryos-1.3): certify corrected MO-1305 release artifact','directory':'mo1305-phase3br','receipt':D+'mo1305-phase3br/receipt.json','report':D+'mo1305-phase3br/report.md'},
    '3C-R': {'commit':'a150e7c39361e3273b6ecde96709be7ab07bfa6b','branch':'mo1305/phase3c-refresh','workspace':'cca-mo1305-3c-refresh','subject':'audit(memoryos-1.3): refresh MO-1305 REST release review','directory':'mo1305-phase3c-refresh','receipt':D+'mo1305-phase3c-refresh/receipt.json','report':'docs/mo1305-phase3c-refresh.md'},
}
REGISTRATION = ['.gitattributes','repositories/cca-conformance/CMakeLists.txt','repositories/cca-conformance/package.json','repositories/cca-conformance/tools/run-js-conformance.mjs']
BF_PATHS = sorted([INVENTORY,E+'binding.json',E+'binding-graph.json',E+'binding-validation.json'])

def need(value, code):
    if not value: raise ValueError(code)

def j(value):
    return json.dumps(value,ensure_ascii=False,sort_keys=True,separators=(',',':'),allow_nan=False).encode()

def identity(data): return {'byteLength':len(data),'sha256':hashlib.sha256(data).hexdigest()}
def parse(data):
    def pairs(rows):
        result={}
        for k,v in rows:
            need(k not in result,'DUPLICATE_KEY'); result[k]=v
        return result
    value=json.loads(data,object_pairs_hook=pairs,parse_constant=lambda _:need(False,'NONFINITE'))
    need(j(value)==data,'NONCANONICAL_JSON')
    return value
def read(path): return parse((ROOT/path).read_bytes())
def save(path,value):
    target=ROOT/path; target.parent.mkdir(parents=True,exist_ok=True); target.write_bytes(j(value))
def ref(path):
    need(isinstance(path,str) and '\\' not in path and ':' not in path and not Path(path).is_absolute() and '..' not in Path(path).parts,'REFERENCE_PATH')
    need((ROOT/path).resolve().is_relative_to(ROOT.resolve()),'REFERENCE_ESCAPE')
    return {'path':path,**identity((ROOT/path).read_bytes())}
def refs(value):
    if isinstance(value,dict):
        if set(value)=={'path','byteLength','sha256'}: need(ref(value['path'])==value,'REFERENCE_DRIFT:'+value['path'])
        for child in value.values(): refs(child)
    elif isinstance(value,list):
        for child in value: refs(child)
def git(*args,cwd=ROOT,data=None):
    return subprocess.check_output(['git','-c','safe.directory='+cwd.as_posix(),'-C',str(cwd),*args],input=data,env={**os.environ,'GIT_OPTIONAL_LOCKS':'0'})
def textgit(*args,cwd=ROOT): return git(*args,cwd=cwd).decode().strip()
def blobs(revision,names):
    names=list(names)
    if not names:return {}
    raw=git('cat-file','--batch',data=''.join(revision+':'+n+'\n' for n in names).encode()); result={}; offset=0
    for name in names:
        end=raw.index(b'\n',offset); header=raw[offset:end].split(); need(len(header)==3 and header[1]==b'blob','GIT_BLOB:'+name)
        size=int(header[2]); offset=end+1; result[name]=raw[offset:offset+size]; offset+=size+1
    return result
def source_paths(source):
    rows=git('diff','--name-status',C3B,source['commit']).decode().splitlines()
    need(all(r.startswith('A\t') for r in rows),'SOURCE_MODIFIED_BASELINE')
    names=[r[2:] for r in rows]
    allowed=[D+source['directory']+'/', 'repositories/cca-conformance/tools/'+source['directory']+'/']
    need(all(n==source['report'] or any(n.startswith(p) for p in allowed) for n in names),'SOURCE_RUNTIME_OR_SCOPE_CHANGE')
    need(textgit('show','-s','--format=%P',source['commit'])==C3B,'SOURCE_PARENT')
    need(textgit('show','-s','--format=%s',source['commit'])==source['subject'],'SOURCE_SUBJECT')
    return names
def source_integrity():
    rows=[];seen=set()
    for role,s in SOURCES.items():
        names=source_paths(s);need(not seen.intersection(names),'SOURCE_PATH_OVERLAP');seen.update(names)
        data=blobs(s['commit'],names)
        for name,payload in data.items():need((ROOT/name).read_bytes()==payload,'SOURCE_ARTIFACT_CHANGED:'+name)
        rows.append({'role':role,**s,'files':[ref(n) for n in names]})
    return rows
def context():
    need(ROOT==Path('C:/Users/melsa/Documents/Codex/cca-workspace'),'WORKSPACE')
    need(textgit('branch','--show-current')=='main','BRANCH')
    need(not git('tag','--list','memoryos-1.3-mo1305').strip(),'TAG_PRESENT')
    need(not git('diff','--name-only',C3B,'--',P).strip(),'PRODUCT_CHANGED')
    source_integrity()
    return {'state':'PASS','workspace':str(ROOT),'branch':'main','head':textgit('rev-parse','HEAD')}

def worktrees():
    result=[]
    for suffix in ['2a','2b','2c','3a','3b','3c','3a-refresh','3b-refresh','3c-refresh']:
        w=ROOT.parent/('cca-mo1305-'+suffix)
        names=sorted(set(filter(None,git('ls-files','-co','--exclude-standard','-z',cwd=w).decode().split('\0'))))
        files=[{'path':n,**identity((w/n).read_bytes())} for n in names if (w/n).is_file()]
        row={'workspace':str(w),'head':textgit('rev-parse','HEAD',cwd=w),'branch':textgit('branch','--show-current',cwd=w),'status':git('status','--porcelain',cwd=w).decode(),'fileCount':len(files),'filesSha256':identity(j(files))['sha256']}
        if suffix.endswith('-refresh'):
            s=next(s for s in SOURCES.values() if s['workspace']==w.name)
            need(row['head']==s['commit'] and row['branch']==s['branch'] and row['status']=='','SOURCE_WORKTREE_BASELINE')
        result.append(row)
    return result
