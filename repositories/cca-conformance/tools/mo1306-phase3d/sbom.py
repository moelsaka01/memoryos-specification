"""Final SPDX metadata reconciliation with the full pinned schema."""
import importlib.metadata, zipfile
from support import *
from package import files_of
SCHEMA_SHA='sha256:239208b7ac287b3cf5d9a9af23f9d69863971102a5e1587a27a398b43490b89b'
def expected_sbom(e, files):
    old=obj(e,'phase3b-r2/sbom-candidate.spdx.json','3B-R2');v=copy.deepcopy(old)
    v['name']='memoryos-ci-0.1.0-qualified-phase3d-release-artifact'
    v['documentNamespace']='https://memoryos.invalid/spdx/memoryos-ci/0.1.0/qualified-phase3d/'+ARCHIVE.split(':')[1]
    v['creationInfo']={'created':load('baseline.json')['startUtc'],'creators':['Tool: memoryos-mo1306-phase3d-sbom-1.0.0']}
    v['comment']='Final C3CB '+C3CB+' artifact identity reconciliation; M3 '+M3+'; S3 '+S3+'. Unchanged 3B-R2 external supply components and all relationships retained. 69 product and 25 SDK files are separately owned. Only filesystem.mjs and distribution-manifest.json file identities changed since 3B-R2. Hosted execution is not certified. No new advisory research or risk acceptance. SHA1 supports SPDX verification codes; SHA256 binds integrity. NOASSERTION licensing is unchanged.'
    changed=[]
    for f in v['files']:
        raw=files[f['fileName'][2:]]
        checks=[{'algorithm':a,'checksumValue':hashlib.new(a.lower(),raw).hexdigest()} for a in ('SHA1','SHA256')]
        if checks!=f['checksums']:changed.append(f['fileName'][2:])
        f['checksums']=checks
    need(sorted(changed)==['distribution-manifest.json','src/filesystem.mjs'],'SBOM_DELTA_NOT_JUSTIFIED')
    p=next(p for p in v['packages'] if p['SPDXID']=='SPDXRef-memoryos-ci')
    p['checksums']=[{'algorithm':'SHA256','checksumValue':ARCHIVE.split(':')[1]}]
    owned=[b for n,b in files.items() if not n.startswith('runtime/authoritative/')]
    need(len(owned)==69,'OWNERSHIP_COUNT')
    p['packageVerificationCode']={'packageVerificationCodeValue':hashlib.sha1(''.join(sorted(hashlib.sha1(b).hexdigest() for b in owned)).encode()).hexdigest()}
    p['sourceInfo']='Production C3CB '+C3CB+'; methodology M3 '+M3+'; qualified scope S3 '+S3+'; directly owned analyzed files: 69. No supplier or copyright ownership assertion is inferred.'
    need(v['packages'][1:]==old['packages'][1:] and v['relationships']==old['relationships'],'EXTERNAL_SUPPLY_CHANGED')
    return v
def prepare_runtime(e):
    supply=obj(e,'phase3b-r2/supply-identities.json','3B-R2');vendor=CACHE/'validators';rows=[]
    for wheel in supply['engineeringWheels']:
        raw=Path(wheel['retainedWheelPath']).read_bytes();need(identity(raw)=={k:wheel[k] for k in ('byteLength','sha256')},'WHEEL_IDENTITY')
        expected={r['path']:r for r in wheel['currentInstalledPayloads']}
        with zipfile.ZipFile(Path(wheel['retainedWheelPath'])) as z:
            actual={x.filename for x in z.infolist() if not x.is_dir()};need(actual==set(expected),'WHEEL_CLOSED_SET')
            for name in sorted(actual):
                target=(vendor/name).resolve();need(vendor.resolve() in target.parents,'WHEEL_PATH')
                b=z.read(name);need(identity(b)=={k:expected[name][k] for k in ('byteLength','sha256')},'WHEEL_PAYLOAD')
                target.parent.mkdir(parents=True,exist_ok=True);target.write_bytes(b);rows.append(ref(target))
    schema=source(e,'repositories/cca-conformance/tools/mo1306-phase3b-r2/sbom-spdx-2.3-schema.json','3B-R2')
    b=check(schema);need(len(b)==45312 and sha(b)==SCHEMA_SHA,'SCHEMA_IDENTITY')
    (OUT/'spdx-2.3.schema.json').write_bytes(b)
    put('validator-runtime.json',{'vendor':str(vendor.relative_to(ROOT)).replace('\\','/'),'wheels':[{k:w[k] for k in ('name','version','filename','byteLength','sha256')} for w in supply['engineeringWheels']],'files':rows,'source':source(e,'phase3b-r2/supply-identities.json','3B-R2'),'schemaSource':schema,'schema':ref(OUT/'spdx-2.3.schema.json')})
def engine():
    runtime=load('validator-runtime.json')
    for r in runtime['files']:check(r)
    sys.path.insert(0,str(ROOT/runtime['vendor']))
    import jsonschema
    from referencing import Registry
    need(Path(jsonschema.__file__).resolve().is_relative_to((ROOT/runtime['vendor']).resolve()),'VALIDATOR_ORIGIN')
    need(importlib.metadata.version('jsonschema')=='4.26.0','VALIDATOR_VERSION')
    raw=check(runtime['schema']);need(len(raw)==45312 and sha(raw)==SCHEMA_SHA,'FULL_SPDX_SCHEMA')
    schema=json.loads(raw)
    def deny(uri):raise ValueError('REMOTE_REFERENCE_DENIED '+uri)
    jsonschema.Draft7Validator.check_schema(schema)
    return jsonschema.Draft7Validator(schema,registry=Registry(retrieve=deny),format_checker=jsonschema.FormatChecker())
def verify_sbom(v,e,files,validator):
    validator.validate(v);need(v==expected_sbom(e,files),'STALE_OR_INVALID_SBOM')
    need((len(v['packages']),len(v['files']),len(v['relationships']))==(161,94,255),'SBOM_COUNTS')
    ids=[p['SPDXID'] for p in v['packages']]+[p['SPDXID'] for p in v['files']]+[v['SPDXID']]
    need(len(ids)==len(set(ids)),'SPDX_DUPLICATE_ID')
    need(all(r['spdxElementId'] in ids and r['relatedSpdxElement'] in ids for r in v['relationships']),'SPDX_REFERENCES')
    for f in v['files']:
        owners=[r['spdxElementId'] for r in v['relationships'] if r['relationshipType']=='CONTAINS' and r['relatedSpdxElement']==f['SPDXID']]
        need(owners==['SPDXRef-SDK' if f['fileName'].startswith('./runtime/authoritative/') else 'SPDXRef-memoryos-ci'],'SPDX_OWNERSHIP')
    validator.validate(json.loads(files['sbom.spdx.json']))
    return {'status':'PASS','fullAuthoritativeSchema':ref(OUT/'spdx-2.3.schema.json'),'validator':'jsonschema 4.26.0 Draft7 with format checking','remoteReferences':'DENIED','embeddedSBOM':'PASS','packages':161,'files':94,'relationships':255,'productFiles':69,'sdkFiles':25,'unchangedExternalPackages':160,'changedProductFileChecksums':['distribution-manifest.json','src/filesystem.mjs']}
if __name__=='__main__':
    e=Evidence();prepare_runtime(e);files=files_of();v=expected_sbom(e,files)
    (OUT/'sbom.spdx.json').write_bytes((json.dumps(v,sort_keys=True,separators=(',',':'))+'\n').encode())
    result=verify_sbom(v,e,files,engine());result['sbom']=ref(OUT/'sbom.spdx.json');put('sbom-validation.json',result);print(json.dumps(result))
