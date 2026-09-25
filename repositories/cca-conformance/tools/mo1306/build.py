"""Deterministically inventory the new package; never alter released bytes."""
import json
import hashlib
from pathlib import Path
from materialize import ROOT,PKG,j,sha

def row(path,relative):
    data=path.read_bytes()
    return dict(path=relative,byteLength=len(data),sha256=sha(data))

def main():
    contracts=sorted((p for p in PKG.rglob('*') if p.is_file() and (p.relative_to(PKG).parts[0] in ('schemas','contracts','templates')) and p.name!='contract.json'),key=lambda p:p.relative_to(PKG).as_posix())
    contract=dict(kind='MemoryOSCICDContract',version='1.0.0',id='memoryos.cicd',files=[row(p,p.relative_to(PKG).as_posix()) for p in contracts])
    (PKG/'contracts/contract.json').write_bytes(j(contract))
    files=sorted((p for p in PKG.rglob('*') if p.is_file() and p.name!='distribution-manifest.json'),key=lambda p:p.relative_to(PKG).as_posix())
    manifest=dict(kind='MemoryOSCICDDistributionManifest',version='1.0.0',package='memoryos-ci',packageVersion='0.1.0',files=[row(p,p.relative_to(PKG).as_posix()) for p in files])
    (PKG/'distribution-manifest.json').write_bytes(j(manifest))
    print(json.dumps(dict(contractDigest=sha(j(contract)),distributionDigest=sha(j(manifest)),fileCount=len(files)+1)))

if __name__=='__main__':main()
