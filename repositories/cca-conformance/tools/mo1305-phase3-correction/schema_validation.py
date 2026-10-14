"""Complete pinned SPDX Draft-7 validation with engineering-only jsonschema.

The schema and validator runtime are integrity-pinned. No validation dependency
is added to the shipped MemoryOS package. MO1305_SCHEMA_RUNTIME selects copied
engineering tools for independent clean assemblies, never service imports.
"""
from pathlib import Path
from functools import cache
import hashlib,json,os,sys
ROOT=Path(__file__).resolve().parents[4]
HERE=Path(__file__).resolve().parent
SCHEMA_REL='repositories/cca-conformance/evidence/mo1305-phase3-correction/spdx-2.3-schema.json'
SCHEMA_SHA='239208b7ac287b3cf5d9a9af23f9d69863971102a5e1587a27a398b43490b89b'

@cache
def validator():
    vendor=Path(os.environ.get('MO1305_SCHEMA_RUNTIME',ROOT/'.cache/mo1305-phase3-correction/schema-runtime')).resolve(strict=True)
    manifest=json.loads((HERE/'schema-runtime.json').read_bytes())
    expected={r['path']:r for r in manifest['files']}
    actual={p.relative_to(vendor).as_posix():p for p in vendor.rglob('*') if p.is_file() and '__pycache__' not in p.parts}
    if set(actual)!=set(expected):raise ValueError('SPDX_VALIDATOR_INVENTORY')
    for name,path in actual.items():
        data=path.read_bytes();row=expected[name]
        if path.is_symlink() or len(data)!=row['byteLength'] or hashlib.sha256(data).hexdigest()!=row['sha256']:raise ValueError('SPDX_VALIDATOR_INTEGRITY:'+name)
    sys.dont_write_bytecode=True
    sys.path.insert(0,str(vendor))
    import jsonschema
    import importlib.metadata
    if not Path(jsonschema.__file__).resolve().is_relative_to(vendor) or importlib.metadata.version('jsonschema')!='4.25.1':raise ValueError('SPDX_VALIDATOR_VERSION')
    raw=(ROOT/SCHEMA_REL).read_bytes()
    if hashlib.sha256(raw).hexdigest()!=SCHEMA_SHA:raise ValueError('SPDX_SCHEMA_IDENTITY')
    schema=json.loads(raw);jsonschema.Draft7Validator.check_schema(schema)
    return jsonschema.Draft7Validator(schema),schema

def schema_errors(document):
    engine,_=validator()
    return sorted([{'path':'/'+'/'.join(map(str,e.absolute_path)),'schemaPath':'/'+'/'.join(map(str,e.absolute_schema_path)),'keyword':e.validator,'message':e.message} for e in engine.iter_errors(document)],key=lambda x:(x['path'],x['schemaPath'],x['message']))

def verify_schema(document):
    errors=schema_errors(document)
    if errors:raise ValueError('SPDX_SCHEMA:'+json.dumps(errors,separators=(',',':')))
    return {'state':'PASS','schemaSha256':SCHEMA_SHA,'validator':'jsonschema.Draft7Validator','validatorVersion':'4.25.1','rootErrors':0,'packageErrors':0,'fileErrors':0,'relationshipErrors':0,'otherErrors':0,'totalErrors':0}

def field_inventory(document):
    verify_schema(document);_,schema=validator();locations={}
    def visit(value,rule,path):
        if isinstance(value,dict):
            allowed=rule.get('properties',{})
            if not set(value)<=set(allowed):raise ValueError('SPDX_FIELD_INVENTORY:'+path)
            locations.setdefault(path,{'instances':0,'properties':set(),'schemaProperties':sorted(allowed)})
            locations[path]['instances']+=1;locations[path]['properties'].update(value)
            for key,child in value.items():visit(child,allowed[key],path.rstrip('/')+'/'+key)
        elif isinstance(value,list):
            for child in value:visit(child,rule['items'],path+'/*')
    visit(document,schema,'/')
    return {'state':'PASS','schemaSha256':SCHEMA_SHA,'externalReferencesPresent':any('externalRef' in p for p in locations),'locations':[{'path':p,'instances':v['instances'],'properties':sorted(v['properties']),'allowed':v['schemaProperties']} for p,v in sorted(locations.items())]}
