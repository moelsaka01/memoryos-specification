from pathlib import Path
import json,hashlib,re,subprocess
from materialize import ROOT,PKG,j,sha
OUT=ROOT/'repositories/cca-conformance/evidence/mo1306'
# Audit every shipped import, including the literal dynamic imports.
node=ROOT/'.cache/mo1305-phase3br/toolchain/node-v24.21.0-win-x64/node.exe'
parsed=json.loads(subprocess.check_output([str(node),str(Path(__file__).with_name('imports.mjs')),str(PKG)],text=True))
imports=[]
for row in parsed['imports']:
 p=PKG/row['module'];spec=row['specifier']
 if spec.startswith('node:'):target=spec
 else:
  assert spec.startswith('.'),(p,spec)
  target=(p.parent/spec).resolve();assert target.is_relative_to(PKG.resolve()) and target.is_file(),(p,spec)
  target=target.relative_to(PKG).as_posix()
 imports.append({**row,'target':target})
assert not any('memoryos-cli' in row['target'] or 'memoryos-rest' in row['target'] or 'memoryos-mcp' in row['target'] for row in imports)
(OUT/'import-audit.json').write_bytes(j({'status':'PASS','imports':imports,'scope':'All shipped static and literal dynamic ESM imports resolve to shipped members or Node builtins. No developer sibling, .git, node_modules or remote import.'}))
# Compare every original dirty file; keep original blocked artifacts unchanged.
baseline=json.loads((OUT/'correction-a/dirty-baseline.json').read_bytes());rows=[]
for r in baseline['files']:
 p=ROOT/r['path'];b=p.read_bytes();current=sha(b)
 if r['classification']=='blocker evidence/report':assert current==r['sha256'],r['path']
 rows.append({**r,'currentSha256':current,'disposition':'REUSED_UNCHANGED' if current==r['sha256'] else 'RECONCILED','review':'Released-source equality / closed structural validators / affected native tests / source audit' if r['classification']!='blocker evidence/report' else 'Original historical FAIL preserved'})
(OUT/'partial-file-review.json').write_bytes(j({'status':'PASS','originalFiles':len(rows),'unchanged':sum(r['disposition']=='REUSED_UNCHANGED' for r in rows),'files':rows}))
# Hash the complete installed npm tool closure, independently of product dependencies.
node=ROOT/'.cache/mo1305-phase3br/toolchain/node-v24.21.0-win-x64/node.exe';npm=node.parent/'node_modules/npm'
files=[];packages=[]
for p in sorted(npm.rglob('*')):
 if not p.is_file():continue
 b=p.read_bytes();files.append({'path':p.relative_to(npm).as_posix(),'byteLength':len(b),'sha256':sha(b)})
 if p.name=='package.json':
  try:v=json.loads(b)
  except ValueError:continue
  if isinstance(v,dict) and isinstance(v.get('name'),str) and isinstance(v.get('version'),str):packages.append({'name':v['name'],'version':v['version'],'path':p.relative_to(npm).as_posix(),'license':v.get('license','NOASSERTION')})
v={'status':'PASS','scope':'Engineering npm 11.19.0 from pinned Node ZIP; not product runtime','rootPackageSha256':sha((npm/'package.json').read_bytes()),'fileCount':len(files),'packages':packages,'files':files}
(OUT/'npm-closure.json').write_bytes(j(v))
versions=json.loads(subprocess.check_output([str(node),'-p','JSON.stringify(process.versions)'],text=True))
(OUT/'runtime-versions.json').write_bytes(j({'status':'PASS','nodeSha256':sha(node.read_bytes()),'versions':versions}))
# Frozen Phase 2 interfaces; provider completion is gated by B1, not claimed here.
interfaces={
 'configuration':('src/contracts.mjs',['configuration','deployment','validate','checkResult']),
 'generic':('src/generic.mjs',['run']),
 'generator':('src/generator.mjs',['generate']),
 'supervisor':('src/supervisor.mjs',['supervise','workerArguments']),
 'publication':('src/publication.mjs',['prepareOutput','publish']),
 'verification':('src/verification.mjs',['verifyBundle','verifySemantic']),
 'metadata':('src/metadata.mjs',['metadata','readMetadataEnvironment'])
}
entries=[]
for key,(rel,names) in sorted(interfaces.items()):
 text=(PKG/rel).read_text()
 for name in names:assert re.search(r'\bexport\s+(?:async\s+)?function\s+'+name+r'\b',text) or re.search(r'\bexport\s*\{[^}]*\b'+name+r'\b',text), (rel,name)
 entries.append({'id':key,'path':rel,'exports':names,'sha256':sha((PKG/rel).read_bytes())})
manifest={'kind':'MemoryOSCICDPhase2Interfaces','version':'1.0.0','status':'INTERFACES_VALIDATED_BINDING_REQUIRED','correctionRevision':'769e277966868b819f6640d9456589523ee26ddf','contractDigest':sha((PKG/'contracts/contract.json').read_bytes()),'distributionDigest':sha((PKG/'distribution-manifest.json').read_bytes()),'interfaces':entries,'schemas':[{'path':p.relative_to(PKG).as_posix(),'sha256':sha(p.read_bytes())} for p in sorted((PKG/'schemas').glob('*.json'))],'workstreams':{'2A':['core','generic','filesystem','process lifecycle'],'2B':['GitLab','Jenkins','shared grammar tests'],'2C':['Azure','GitHub compatibility','security']},'providers':{'generic':'FOUNDATION_IMPLEMENTED only after successful B1','github':'NOT_IMPLEMENTED','gitlab':'NOT_IMPLEMENTED','jenkins':'NOT_IMPLEMENTED','azure':'NOT_IMPLEMENTED'},'noBranchesCreated':True}
(ROOT/'repositories/cca-conformance/mo1306-phase2-interfaces.json').write_bytes(j(manifest))
print(json.dumps({'status':'PASS','imports':len(imports),'originalFiles':len(rows),'reused':sum(r['disposition']=='REUSED_UNCHANGED' for r in rows),'npmFiles':len(files),'npmPackages':len(packages),'interfaces':len(entries)}))
