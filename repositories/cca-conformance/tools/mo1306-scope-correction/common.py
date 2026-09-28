"""S3 offline evidence and Git readers; no product/provider execution."""
import hashlib,json,os,subprocess,sys
from pathlib import Path
sys.dont_write_bytecode=True
ROOT=Path(__file__).resolve().parents[4]
TOOLS=Path(__file__).resolve().parent
OUT=ROOT/'repositories/cca-conformance/evidence/mo1306/scope-correction'
AUTH=ROOT/'repositories/cca-conformance/mo1306-hosted-scope-correction.json'
DOC=ROOT/'docs/mo1306-hosted-certification-scope-correction.md'
C3CB='701d48ee2012675966360dda775ab13013c09ab9'
M3='85a0f85c1ebd013c545ccf2b3efe58a760e6cf37'
C3AB='9e1bbff99c23cdbc4c80f11e87eadb89a36e8f44'
B3='b47f624c26badd54ee5724e8fe384c80ea083952'
C3='20aa4e4245643e1c3a7b3f676622c5d2d36015b2'
PEERS={'3A':ROOT.parent/'cca-mo1306-3a-refresh','3B-R2':ROOT.parent/'cca-mo1306-3b-refresh2','3C-R':ROOT.parent/'cca-mo1306-3c-refresh'}
PREFIX='repositories/cca-conformance/evidence/mo1306/'
SCAFFOLD='0d98a5453298df3d8bcf48bfd317ed436e78e1d3'
REMOTE_MAIN='5955af062152a84c10de17860ba0bcabe8b3555f'
DIST='sha256:b41d024d8ec1c588ca3fc919f8e3ac59a622aebc7cff3377f6a20ce7fc2ca4f3'
ARCHIVE='sha256:7649f6df77c3f6163eb94b343974abaeccebbd5bcb8a2208cc889128904ce45d'
PINS={'checkout':'3d3c42e5aac5ba805825da76410c181273ba90b1','upload-artifact':'043fb46d1a93c77aae656e7c1c64a875d1fc6a0a'}
ALLOWED=['ROADMAP.md','docs/mo1306-hosted-certification-scope-correction.md','repositories/cca-conformance/mo1306-hosted-scope-correction.json','repositories/cca-conformance/tools/mo1306-scope-correction/','repositories/cca-conformance/evidence/mo1306/scope-correction/']
def need(v,code):
    if not v:raise AssertionError(code)
def sha(b):return 'sha256:'+hashlib.sha256(b).hexdigest()
def enc(v):return (json.dumps(v,sort_keys=True,indent=2,ensure_ascii=False)+'\n').encode('utf-8')
def read(p):return json.loads(p.read_bytes())
def save(p,v):p.parent.mkdir(parents=True,exist_ok=True);p.write_bytes(enc(v))
def ref(p):
    b=p.read_bytes();return {'path':p.relative_to(ROOT).as_posix(),'byteLength':len(b),'sha256':sha(b)}
def check(r):
    need(set(r)=={'path','byteLength','sha256'},'REFERENCE_FIELDS');p=(ROOT/r['path']).resolve();need(ROOT in p.parents and not p.is_symlink(),'REFERENCE_ROOT');b=p.read_bytes();need(len(b)==r['byteLength'] and sha(b)==r['sha256'],'REFERENCE_BYTES '+r['path']);return b
def git(*args,root=ROOT,input=None):
    return subprocess.run(['git','-c','safe.directory='+str(root),'-C',str(root),*args],input=input,capture_output=True,check=True,timeout=60,env={**os.environ,'GIT_OPTIONAL_LOCKS':'0'}).stdout
def blobs(specs):
    """One Git process; exact length-framed immutable/index object reads."""
    need(len(specs)==len(set(specs)),'DUPLICATE_GIT_SPEC');data=git('cat-file','--batch',input=('\n'.join(specs)+'\n').encode());pos=0;out={}
    for spec in specs:
        end=data.index(b'\n',pos);header=data[pos:end].split();need(len(header)==3 and header[1]==b'blob','GIT_BLOB_REQUIRED '+spec);size=int(header[2]);start=end+1;b=data[start:start+size];need(len(b)==size and data[start+size:start+size+1]==b'\n','GIT_FRAME');out[spec]=b;pos=start+size+1
    need(pos==len(data),'GIT_TRAILING_DATA');return out
def snapshot(root):
    idx=Path(git('rev-parse','--git-path','index',root=root).decode().strip());idx=idx if idx.is_absolute() else root/idx
    return {'root':str(root),'head':git('rev-parse','HEAD',root=root).decode().strip(),'branch':git('branch','--show-current',root=root).decode().strip(),'indexSha256':sha(idx.read_bytes()),'status':git('status','--porcelain=v1','--untracked-files=all',root=root).decode()}
def permitted(p):return any(p==a or a.endswith('/') and p.startswith(a) for a in ALLOWED)
