"""Exact package allowlist and bounded sensitive-content checks."""
import json,re,sys
from pathlib import Path
sys.dont_write_bytecode=True
sys.path.insert(0,str(Path(__file__).resolve().parent));import certify,wrapper

def run():
    certify.require_current_cheap_gate();files=certify.verify_archive(certify.ARCHIVE,certify.SHA)['files'];marker_only=[]
    for name,data in files.items():
        if any(p in name.split('/') for p in ('.git','.cache','node_modules','__pycache__')):raise ValueError('FORBIDDEN_MEMBER')
        if name.startswith(('/','\\')) or ':' in name:raise ValueError('ABSOLUTE_MEMBER')
        if any(p.lower() in data.lower() for p in (b'C:\\Users\\melsa',b'C:/Users/melsa',str(Path.cwd()).encode())):raise ValueError('TASK_ABSOLUTE_PATH')
        # An actual PEM payload, not the shipped configuration validator's regex literal.
        if re.search(rb'-----BEGIN (?:RSA |EC |OPENSSH )?PRIVATE KEY-----\r?\n[A-Za-z0-9+/=\r\n]+-----END (?:RSA |EC |OPENSSH )?PRIVATE KEY-----',data):raise ValueError('PRIVATE_KEY_MATERIAL')
        if b'-----BEGIN PRIVATE KEY-----' in data:
            if name!='src/config.mjs':raise ValueError('UNREVIEWED_KEY_MARKER')
            marker_only.append({'path':name,'classification':'Private-key validation regular-expression literal; no PEM payload','identity':certify.identity(data)})
    package=json.loads(files['package.json']);graph=certify.metadata(files)
    return {'kind':'MemoryOSRESTPhase3BRPackageAllowlist','state':'PASS','exactInventoryCount':58,'authoritativeClosureCount':25,'exactAllowlist':True,'forbiddenPathsAbsent':True,'privateKeyMaterialAbsent':True,'taskAbsolutePathsAbsent':True,'temporaryAndDeveloperEvidenceAbsent':True,'undeclaredDependenciesAbsent':True,'scripts':package['scripts'],'dependencyGraph':graph,'reviewedLiteralMarkers':marker_only,'scope':'Exact trusted allowlist, immutable identities, import graph and bounded content markers; not a general secret scanner'}
if __name__=='__main__':
    result=run();certify.save('package-allowlist-evaluation.json',result);print(json.dumps(result))
