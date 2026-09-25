from pathlib import Path
import json,subprocess,shutil,sys,hashlib,os
R=Path.cwd();T=R/'repositories/cca-conformance/tools/mo1305-phase3-correction';E=R/'repositories/cca-conformance/evidence/mo1305-phase3-correction/accepted';sys.path.insert(0,str(T))
from distribution import assemble,serialize_archive,j,identity,GENERATED,PKG_REL
node=R/'.cache/mo1304-phase3-toolchain/node-v24.21.0-win-x64/node.exe';npm=node.parent/'node_modules/npm/bin/npm-cli.js'
# Discovery is not an accepted assembly. The two accepted builds execute separately in clean roots.
_,tree=assemble(R,node,npm);outputs=[]
for label in ['accepted-clean-a','accepted-clean-b']:
 root=R/'.cache/mo1305-phase3-correction'/label;assert not root.exists();root.mkdir()
 for row in tree['files']:
  source=R/row['path'];dest=root/row['path'];dest.parent.mkdir(parents=True,exist_ok=True);shutil.copyfile(source,dest)
 out=root/'output'
 command=[sys.executable,'-B','-X','utf8',str(root/'repositories/cca-conformance/tools/mo1305-phase3-correction/distribution.py'),'build','--root',str(root),'--node',str(node),'--npm',str(npm),'--output',str(out),'--write-metadata']
 result=subprocess.run(command,capture_output=True,timeout=60,env={**os.environ,"MO1305_SCHEMA_RUNTIME":str(R/".cache/mo1305-phase3-correction/schema-runtime")});assert result.returncode==0,result.stderr.decode();print(result.stdout.decode().strip());outputs.append(out)
a=(outputs[0]/'memoryos-rest-0.1.0.tgz').read_bytes();b=(outputs[1]/'memoryos-rest-0.1.0.tgz').read_bytes();assert a==b
assert (outputs[0]/'source-tree.json').read_bytes()==(outputs[1]/'source-tree.json').read_bytes()==j(tree)
final=R/'.cache/mo1305-phase3-correction/accepted-build';final.mkdir()
shutil.copyfile(outputs[0]/'memoryos-rest-0.1.0.tgz',final/'memoryos-rest-0.1.0.tgz');shutil.copyfile(outputs[0]/'source-tree.json',E/'source-tree.json')
for name in GENERATED:shutil.copyfile(outputs[0].parent/PKG_REL/name,R/PKG_REL/name)
(E/'reproducibility.json').write_bytes(j({'state':'PASS','independentCleanRoots':True,'separateBuilderProcesses':True,'byteIdentical':True,'assemblies':[{'path':str(x.relative_to(R))+'/memoryos-rest-0.1.0.tgz',**identity((x/'memoryos-rest-0.1.0.tgz').read_bytes())} for x in outputs],'packageInventoriesIdentical':(outputs[0].parent/PKG_REL/'distribution-manifest.json').read_bytes()==(outputs[1].parent/PKG_REL/'distribution-manifest.json').read_bytes(),'sourceTree':identity(j(tree)),'archive':{'path':str((final/'memoryos-rest-0.1.0.tgz').relative_to(R)).replace('\\','/'),**identity(a)}}))
print('TWO CLEAN INDEPENDENT ASSEMBLIES IDENTICAL')
