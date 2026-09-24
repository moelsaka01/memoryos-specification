"""Sequential installed preflight; keep all executed outputs and stop on failure."""
from pathlib import Path
import json,hashlib,os,subprocess,sys
ROOT=Path(__file__).resolve().parents[4];TOOLS=Path(__file__).parent
NODE=ROOT/'.cache/mo1304-phase3-toolchain/node-v24.21.0-win-x64/node.exe'
OUT=ROOT/'.cache/mo1305-resource-review/preflight';OUT.mkdir(exist_ok=True)
commands=[('prepare-catalog',[str(NODE),str(TOOLS/'prepare-catalog.mjs')]),('build',[sys.executable,'-B',str(TOOLS/'build.py')]),('install',[sys.executable,'-B',str(TOOLS/'fresh_install.py')]),('units',[str(NODE),'--test','--test-concurrency=1',*[str(p) for p in sorted((ROOT/'repositories/memoryos-rest/tests').glob('*.test.mjs'))]]),('startup-extra',[str(NODE),str(TOOLS/'startup-extra.mjs')]),('catalog-extra',[str(NODE),str(TOOLS/'campaign.mjs'),'smoke','schema-max|projection-maximum|parser-max-strings']),('adverse-smoke',[str(NODE),str(TOOLS/'adverse.mjs'),'smoke']),('lifecycle',[str(NODE),str(TOOLS/'lifecycle.mjs')]),('faults',[str(NODE),str(TOOLS/'faults.mjs')]),('clients',[str(NODE),str(TOOLS/'clients.mjs')]),('adversarial',[str(NODE),str(TOOLS/'adversarial.mjs')]),('integration',[str(NODE),str(TOOLS/'integration.mjs')]),('startup',[str(NODE),str(TOOLS/'startup.mjs')])]
start=sys.argv[1] if len(sys.argv)>1 else None
results=[]
for name,command in commands:
 if start:
  if name!=start:continue
  start=None
 env={k:v for k,v in os.environ.items() if k.upper() in ['SYSTEMROOT','WINDIR','TEMP','TMP']}
 log=OUT/(name+'.log')
 with log.open('wb') as stream:run=subprocess.run(command,cwd=ROOT,env=env,stdout=stream,stderr=subprocess.STDOUT,timeout=1800)
 b=log.read_bytes();record={'id':name,'state':'PASS' if run.returncode==0 else 'FAIL','exitCode':run.returncode,'log':{'path':log.relative_to(ROOT).as_posix(),'byteLength':len(b),'sha256':hashlib.sha256(b).hexdigest()}}
 results.append(record);(OUT/'results.json').write_text(json.dumps(results,sort_keys=True,separators=(',',':')),encoding='utf-8');print(json.dumps(record),flush=True)
 if run.returncode:print(b.decode('utf-8',errors='replace')[-5000:],flush=True);raise SystemExit(run.returncode)
