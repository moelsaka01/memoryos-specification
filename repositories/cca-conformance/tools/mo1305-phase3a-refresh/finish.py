"""Verify post-execution installed integrity and remove only task temporary credentials."""
from pathlib import Path
import hashlib,json,shutil,sys
from prepare import ROOT,HERE,E,CACHE,write,identity,inventory,package_inventory,canonical

def finish():
 state=json.loads((CACHE/'state.json').read_bytes());stage=Path(state['stage']).resolve(strict=True)
 assert stage.name.startswith('memoryos-rest-phase3a-refresh-') and not stage.is_relative_to(ROOT)
 assert not stage.is_symlink() and not stage.is_junction()
 expected=json.loads((E/'installed-files.json').read_bytes())['files']
 actual=package_inventory(Path(state['packagePath']),expected)
 before=json.loads((E/'installation.json').read_bytes())['preIntegrity']['files']
 assert actual==before==expected
 assert not list((stage/'empty').iterdir()),'GATEWAY_CWD_PERSISTENCE'
 assert not list((stage/'results/empty').iterdir()),'PROBE_GATEWAY_CWD_PERSISTENCE'
 assert not list((stage/'results/tmp').iterdir()),'PROBE_GATEWAY_TEMP_PERSISTENCE'
 record={'kind':'MemoryOSRESTWindowsRefreshInstalledIntegrity','state':'PASS','fileCount':58,'before':before,'after':actual,'inventorySha256':hashlib.sha256(canonical(actual)).hexdigest(),'unchanged':True,'gatewayCwdEmpty':True,'gatewayTempEmpty':True}
 write(E/'post-integrity.json',record)
 # Delete only this verified task-created private-material directory, retaining
 # non-secret isolated install for review without performing another installation.
 private=(stage/'private').resolve(strict=True)
 assert private.parent==stage and private.name=='private' and not private.is_symlink() and not private.is_junction()
 token=(private/'token').read_bytes();key=(private/'key.pem').read_bytes()
 scanned=[]
 for scan_root in [E,stage/'results']:
  for path in scan_root.rglob('*'):
   if path.is_file():
    data=path.read_bytes();assert token not in data and key not in data,'SECRET_PERSISTENCE';scanned.append(str(path.relative_to(scan_root)))
 shutil.rmtree(private)
 # Probe refusal configs contain only now-deleted credential paths, no tokens.
 assert not private.exists()
 write(E/'cleanup.json',{'state':'PASS','temporaryCredentialsRemoved':True,'credentialDirectoryAbsent':True,'secretScan':'PASS','scannedFileCount':len(scanned),'isolatedInstallRetained':True,'scope':'task-owned external private directory only; installed package remains available for review'})
 print(json.dumps({'state':'PASS','fileCount':58,'unchanged':True,'temporaryCredentialsRemoved':True}))
if __name__=='__main__':finish()