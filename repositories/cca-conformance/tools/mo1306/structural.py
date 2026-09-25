"""Full offline Draft 2020-12 validation plus frozen cross-file checks."""
import sys,json,re,hashlib
from pathlib import Path
from materialize import ROOT,PKG,j,sha
sys.path.insert(0,str(ROOT/'.cache/mo1306/validators'))
from jsonschema import Draft202012Validator
from referencing import Registry
def load(path):return json.loads(path.read_bytes())
def main():
 freeze=(ROOT/'docs/mo1306-contract-freeze-1.md').read_text(encoding='utf-8')
 errors=json.loads(re.search(r'\x60\x60\x60json\n(\{\n  "kind": "MemoryOSCICDErrorCatalog".*?\n\})\n\x60\x60\x60',freeze,re.S)[1])
 assert load(PKG/'contracts/errors.json')==errors and len(errors['errors'])==28
 fixed={k:int(v) for k,v in re.findall(r'(\w+):(\d+)',re.search(r'configBytes:.*?fullPathCodeUnits:240',freeze,re.S)[0])}
 assert load(PKG/'contracts/limits.json')['fixed']==fixed
 schemas={}
 for p in sorted((PKG/'schemas').glob('*.json')):
  schema=load(p);Draft202012Validator.check_schema(schema)
  # Empty registry forbids remote resolution; all selected product refs are local.
  schemas[p.name]=Draft202012Validator(schema,registry=Registry())
  for ref in re.findall(r'"\$ref":"([^"]+)"',p.read_text()):assert ref.startswith('#/$defs/')
 assert len(schemas)==11
 contract=load(PKG/'contracts/contract.json');distribution=load(PKG/'distribution-manifest.json')
 for manifest in [contract,distribution]:
  assert manifest['files']==sorted(manifest['files'],key=lambda r:r['path'])
  assert len({r['path'].lower() for r in manifest['files']})==len(manifest['files'])
  for row in manifest['files']:
   data=(PKG/row['path']).read_bytes();assert len(data)==row['byteLength'] and sha(data)==row['sha256'],row['path']
 actual=sorted(p.relative_to(PKG).as_posix() for p in PKG.rglob('*') if p.is_file())
 assert actual==sorted(['distribution-manifest.json']+[r['path'] for r in distribution['files']])
 closure=load(PKG/'runtime/runtime-closure-manifest.json')
 assert len(closure['files'])==25 and closure['kind']=='MemoryOSCICDRuntimeClosureManifest'
 for row in closure['files']:
  data=(ROOT/row['source']).read_bytes();assert data==(PKG/'runtime'/row['path']).read_bytes()
  assert len(data)==row['byteLength'] and hashlib.sha256(data).hexdigest()==row['sha256']
 package=load(PKG/'package.json');lock=load(PKG/'package-lock.json')
 assert package['name']=='memoryos-ci' and package['version']=='0.1.0' and package['private'] is True and package['type']=='module'
 assert not package.get('dependencies') and not package.get('optionalDependencies') and not package.get('scripts')
 assert list(lock['packages'])==['']
 metadata=load(PKG/'contracts/metadata.json')['classifications']
 assert len(metadata)==14 and list(metadata.values()).count('OPERATIONAL')==8 and list(metadata.values()).count('DIAGNOSTIC')==4 and list(metadata.values()).count('FORBIDDEN')==2
 for row in load(ROOT/'repositories/cca-conformance/fixtures/mo1306/vectors.json')['vectors']:
  directory=ROOT/row['directory'];config=load(directory/'memoryos-ci.json')
  schemas['configuration-1.0.0.schema.json'].validate(config)
  bad={**config,'unknown':True};assert not schemas['configuration-1.0.0.schema.json'].is_valid(bad)
  assert sha((ROOT/row['source']).read_bytes())==row['sourceSha256']
 lock=load(ROOT/'repositories/cca-conformance/fixtures/mo1306/engineering-validator-lock.json')
 for row in lock['dependencies']:
  wheel=ROOT/'.cache/mo1306/wheels'/row['filename']
  assert wheel.stat().st_size==row['byteLength'] and sha(wheel.read_bytes())==row['sha256']
  assert row['notices']
 print(json.dumps(dict(status='PASS',schemas=len(schemas),errorCodes=28,closureFiles=25,packageFiles=len(actual),validators=len(lock['dependencies']))))
if __name__=='__main__':main()
