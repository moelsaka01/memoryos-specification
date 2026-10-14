from common import *
import shutil,tarfile
assert json.loads((OUT/'cheap-gate.json').read_bytes())['status']=='PASS'
manifest_path=PKG/'distribution-manifest.json';before=manifest_path.read_bytes();manifest=json.loads(before)
changed=[]
for entry in manifest['files']:
 current=row(PKG/entry['path'],PKG)
 if current!=entry:changed.append({'before':entry.copy(),'after':current});entry.update(current)
assert [c['before']['path'] for c in changed]==['src/filesystem.mjs']
manifest_path.write_bytes(j(manifest))
put('metadata-impact.json',{'status':'PASS','beforeDistribution':sha(before),'afterDistribution':sha(j(manifest)),'changes':changed,'productionVersion':'0.1.0','changedPackageFiles':['src/filesystem.mjs','distribution-manifest.json'],'unchanged':['contracts and contract inventory','all 11 schemas','all four templates','28 machine errors and truncation','SDK runtime 25-file closure and source provenance','component-level SBOM (filesAnalyzed:false, same two components)','package dependencies and lockfile','adapter and generator closures','historical B2 conformance inventory, capabilities and phase3 interfaces'],'newAuthority':'Separate phase3-helper-correction inventory and actual C3C binding; historical B2 identity stays intact.'})
# Independent clean assemblies start from separate full copies and verify each input.
assemblies=[];expected=inventory(PKG)
for name in ['assembly-a','assembly-b']:
 folder=CACHE/name;copy=folder/'package';shutil.copytree(PKG,copy);assert inventory(copy)==expected
 archive=folder/'memoryos-ci-0.1.0.tgz';r=command([NODE,copy/'scripts/pack.mjs',archive]);assert r['exitCode']==0,r
 with tarfile.open(archive) as tar:
  members=tar.getmembers();assert len(members)==len(expected)==94
  assert len({m.name.casefold() for m in members})==94
  for m in members:
   assert m.isfile() and m.uid==m.gid==m.mtime==0 and m.name.startswith('package/')
   raw=tar.extractfile(m).read();p=m.name[8:];assert next(e for e in expected if e['path']==p)=={'path':p,'byteLength':len(raw),'sha256':sha(raw)}
 assemblies.append({'archive':row(archive),'command':r,'inputFiles':inventory(copy)})
assert (CACHE/'assembly-a/memoryos-ci-0.1.0.tgz').read_bytes()==(CACHE/'assembly-b/memoryos-ci-0.1.0.tgz').read_bytes()
install=CACHE/'install';install.mkdir();npmcache=CACHE/'empty-npm-cache';npmcache.mkdir();assert not list(npmcache.iterdir())
(install/'package.json').write_bytes(j({'name':'mo1306-correction-offline','version':'1.0.0','private':True,'dependencies':{'memoryos-ci':'file:../assembly-a/memoryos-ci-0.1.0.tgz'}}))
user=CACHE/'user.npmrc';glob=CACHE/'global.npmrc';user.write_bytes(b'');glob.write_bytes(b'')
r=command([NODE,NPM,'install','--offline','--ignore-scripts','--no-audit','--no-fund','--cache',npmcache,'--userconfig',user,'--globalconfig',glob],cwd=install,env={**ENV,'PATH':str(NODE.parent)},timeout=120)
put('offline-install-command.json',r);assert r['exitCode']==0,r
installed=install/'node_modules/memoryos-ci';before_install=inventory(installed);assert before_install==expected
put('installed-before.json',{'files':before_install,'root':str(installed)})
put('package.json',{'status':'PASS','archive':assemblies[0]['archive'],'filename':'memoryos-ci-0.1.0.tgz','name':'memoryos-ci','version':'0.1.0','memberCount':94,'assemblies':assemblies,'byteIdentical':True,'initialExplicitCacheEmpty':True,'offlineInstall':row(OUT/'offline-install-command.json'),'installRoot':str(installed),'distribution':row(manifest_path),'contract':row(PKG/'contracts/contract.json'),'runtimeClosure':row(PKG/'runtime/runtime-closure-manifest.json'),'sbom':row(PKG/'sbom.spdx.json'),'scope':'Two bounded clean assemblies and one fresh offline install; no full Phase3B supply-chain recertification.'})
print(json.dumps({'package':'PASS','archive':assemblies[0]['archive'],'distribution':sha(j(manifest))}))
