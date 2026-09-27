"""Offline methodology support. No product, provider or network execution."""
import hashlib,json,os,subprocess,sys
from pathlib import Path
sys.dont_write_bytecode=True
ROOT=Path(__file__).resolve().parents[4]
TOOLS=Path(__file__).resolve().parent
OUT=ROOT/'repositories/cca-conformance/evidence/mo1306/methodology-b'
AUTHORITY=ROOT/'repositories/cca-conformance/mo1306-unresolved-observation-methodology.json'
DOC=ROOT/'docs/mo1306-phase3-unresolved-observation-methodology.md'
BASE='701d48ee2012675966360dda775ab13013c09ab9'
GRAPH=['90b9ac914e477fb90fe317d0de9ba310aae37f60','9e1bbff99c23cdbc4c80f11e87eadb89a36e8f44','39d83316f7c72d6cb49f8b6cde36c1bfa833112a',BASE]
PEER=Path(r'C:\Users\melsa\Documents\Codex\cca-mo1306-3a-refresh')
PREFIX='repositories/cca-conformance/evidence/mo1306/'
DIST='sha256:b41d024d8ec1c588ca3fc919f8e3ac59a622aebc7cff3377f6a20ce7fc2ca4f3'
NODE_SHA='sha256:ba4e6d110e8c1592a1ecd390f6b05f3da124b13871a5be62b341a07a853c6c32'
ARCHIVE_SHA='sha256:7649f6df77c3f6163eb94b343974abaeccebbd5bcb8a2208cc889128904ce45d'
HIST='phase3a-final/native/20260927T120240-b3df86/'
FAITHFUL=['20260927T205808-b8cd68','20260927T210033-e28397','20260927T210127-639d33']
ENHANCED='20260927T212537-f27c81'
GROUPS=['corrected-cli-dispatch','late-helper','late-terminal','policy-cne','policy-fail','policy-pass','timely-helper','valid-generate']
ALLOWED=['docs/mo1306-phase3-unresolved-observation-methodology.md','repositories/cca-conformance/mo1306-unresolved-observation-methodology.json','repositories/cca-conformance/tools/mo1306-methodology-b/','repositories/cca-conformance/evidence/mo1306/methodology-b/']
def need(v,code):
    if not v: raise AssertionError(code)
def sha(b): return 'sha256:'+hashlib.sha256(b).hexdigest()
def encode(v): return (json.dumps(v,indent=2,sort_keys=True,ensure_ascii=False)+'\n').encode('utf-8')
def save(path,v): path.parent.mkdir(parents=True,exist_ok=True);path.write_bytes(encode(v))
def read(path): return json.loads(path.read_bytes())
def ref(path):
    b=path.read_bytes();return {'path':path.relative_to(ROOT).as_posix(),'byteLength':len(b),'sha256':sha(b)}
def check_ref(r):
    need(set(r)=={'path','byteLength','sha256'},'REFERENCE_FIELDS')
    p=(ROOT/r['path']).resolve();need(ROOT in p.parents and not p.is_symlink(),'REFERENCE_ROOT')
    b=p.read_bytes();need(len(b)==r['byteLength'] and sha(b)==r['sha256'],'REFERENCE_BYTES '+r['path']);return b
def git(*args):
    env={**os.environ,'GIT_OPTIONAL_LOCKS':'0','GIT_CONFIG_COUNT':'2','GIT_CONFIG_KEY_0':'safe.directory','GIT_CONFIG_VALUE_0':str(ROOT),'GIT_CONFIG_KEY_1':'safe.directory','GIT_CONFIG_VALUE_1':str(PEER)}
    return subprocess.run(['git','-C',str(ROOT),*args],env=env,check=True,capture_output=True,timeout=60).stdout
def permitted(p): return any(p==a or a.endswith('/') and p.startswith(a) for a in ALLOWED)
