"""Bounded, full SPDX Draft-7 diagnostic using the pinned engineering-only validator.

No package files are written. The optional root rename is in-memory diagnosis.
"""
from pathlib import Path
import argparse,copy,hashlib,importlib.metadata,json,sys
ROOT=Path(__file__).resolve().parents[4]
VENDOR=ROOT/'.cache/mo1305-phase3-correction/schema-runtime'
sys.path.insert(0,str(VENDOR))
from jsonschema import Draft7Validator
SCHEMA=ROOT/'repositories/cca-conformance/evidence/mo1305-phase3-correction/spdx-2.3-schema.json'
SCHEMA_SHA='239208b7ac287b3cf5d9a9af23f9d69863971102a5e1587a27a398b43490b89b'

def identity(data):return {'byteLength':len(data),'sha256':hashlib.sha256(data).hexdigest()}
def inspect(document,rename_root=False):
    schema_bytes=SCHEMA.read_bytes();assert identity(schema_bytes)['sha256']==SCHEMA_SHA
    schema=json.loads(schema_bytes);Draft7Validator.check_schema(schema)
    value=copy.deepcopy(document)
    if rename_root:value['comment']=value.pop('documentComment')
    errors=[{'instancePath':'/'+ '/'.join(str(p) for p in e.absolute_path),'schemaPath':'/'+ '/'.join(str(p) for p in e.absolute_schema_path),'keyword':e.validator,'message':e.message} for e in Draft7Validator(schema).iter_errors(value)]
    errors.sort(key=lambda e:(e['instancePath'],e['schemaPath'],e['message']))
    return {'state':'FAIL' if errors else 'PASS','validator':'jsonschema.Draft7Validator','validatorVersion':importlib.metadata.version('jsonschema'),'schema':identity(schema_bytes),'inMemoryRootRename':rename_root,'rootCount':1,'packageCount':len(value['packages']),'fileCount':len(value['files']),'relationshipCount':len(value['relationships']),'errorCount':len(errors),'errors':errors}

if __name__=='__main__':
    p=argparse.ArgumentParser();p.add_argument('--sbom',type=Path,required=True);p.add_argument('--output',type=Path,required=True);p.add_argument('--diagnose-root-rename',action='store_true');a=p.parse_args();data=a.sbom.read_bytes();result=inspect(json.loads(data),a.diagnose_root_rename);result['input']=identity(data);a.output.write_text(json.dumps(result,ensure_ascii=False,sort_keys=True,separators=(',',':')),encoding='utf8');print(json.dumps({k:v for k,v in result.items() if k!='errors'}));sys.exit(0 if result['state']=='PASS' else 1)
