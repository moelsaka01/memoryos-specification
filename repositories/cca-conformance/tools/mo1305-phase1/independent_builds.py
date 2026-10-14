"""Rebuild from two freshly copied input trees; compare every archive byte."""
from pathlib import Path
import hashlib,json,os,shutil,subprocess,sys,tempfile
ROOT=Path(__file__).resolve().parents[4];OUT=ROOT/'.cache/mo1305-resource-review/independent-builds';OUT.mkdir(exist_ok=True)
parent=subprocess.check_output([r'C:/Program Files/Git/cmd/git.exe','rev-parse','HEAD'],cwd=ROOT,text=True).strip()
reference=(ROOT/'.cache/mo1305-resume/build/memoryos-rest-0.1.0.tgz').read_bytes();records=[]
for index in range(2):
 stage=Path(tempfile.mkdtemp(prefix='memoryos-rest-independent-build-'))
 for relative in ['repositories/memoryos-rest','repositories/cca-conformance/tools/mo1305-phase1','repositories/cca-conformance/fixtures/mo1305-phase1']:
  shutil.copytree(ROOT/relative,stage/relative,ignore=shutil.ignore_patterns('__pycache__','sbom.spdx.json','dependency-manifest.json','distribution-manifest.json'))
 node=Path('.cache/mo1304-phase3-toolchain/node-v24.21.0-win-x64/node.exe');(stage/node).parent.mkdir(parents=True);shutil.copyfile(ROOT/node,stage/node)
 clean={k:v for k,v in os.environ.items() if k.upper() in ['SYSTEMROOT','WINDIR','TEMP','TMP']}
 done=subprocess.run([sys.executable,'-B',str(stage/'repositories/cca-conformance/tools/mo1305-phase1/build.py'),'--parent',parent],cwd=stage,env=clean,capture_output=True,text=True,timeout=120)
 assert done.returncode==0,done.stderr
 built=(stage/'.cache/mo1305-resume/build/memoryos-rest-0.1.0.tgz').read_bytes();assert built==reference,'INDEPENDENT_BUILD_DRIFT'
 tree=json.loads((stage/'.cache/mo1305-resume/build/source-tree.json').read_bytes())['sha256'];records.append({'treeSha256':tree,'archiveSha256':hashlib.sha256(built).hexdigest()});(OUT/('build-'+str(index)+'.tgz')).write_bytes(built)
 print(json.dumps({'build':index,'state':'PASS','byteLength':len(built),**records[-1]}),flush=True)
(OUT/'results.json').write_text(json.dumps({'kind':'MemoryOSRESTIndependentBuilds','state':'PASS','builds':records},sort_keys=True,separators=(',',':')),encoding='utf-8')
