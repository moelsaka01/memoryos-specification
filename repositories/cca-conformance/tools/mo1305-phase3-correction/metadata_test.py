"""Focused metadata regressions; no server, resource, or certification campaign."""
import argparse,copy,json
from pathlib import Path
from distribution import verify_files,verify_archive,identity,j,ref
from spdx import verify_spdx
from schema_validation import verify_schema,field_inventory


def run(archive):
    data=archive.read_bytes();verified=verify_archive(archive,identity(data)['sha256']);files=verified['files'];sbom=json.loads(files['sbom.spdx.json']);cases=[]
    def accept(name,action):
        action();cases.append({'name':name,'state':'PASS'})
    def reject(name,action,code):
        try:action()
        except ValueError as error:
            assert str(error).startswith(code),(name,str(error),code)
            cases.append({'name':name,'state':'PASS','rejectedBy':str(error)});return
        raise AssertionError('ACCEPTED_INVALID:'+name)
    accept('corrected package and canonical archive',lambda:verify_files(files))
    accept('corrected SPDX analysis and required fields',lambda:verify_spdx(sbom,files))
    for name in ('memoryos-rest','memoryos-authoritative-closure'):
        for label,mutation,code in (
            ('false with files',lambda p:p.update(filesAnalyzed=False),'SPDX_FALSE_WITH_FILES'),
            ('missing verification code',lambda p:p.pop('packageVerificationCode'),'SPDX_VERIFICATION_CODE_REQUIRED'),
            ('wrong verification code',lambda p:p['packageVerificationCode'].update(packageVerificationCodeValue='0'*40),'SPDX_VERIFICATION_CODE:'),
            ('missing analyzed licenses',lambda p:p.pop('licenseInfoFromFiles'),'SPDX_ANALYZED_LICENSES'),
            ('false code exclusion',lambda p:p['packageVerificationCode'].update(packageVerificationCodeExcludedFiles=['./src/config.mjs']),'SPDX_ANALYSIS_EXCLUSIONS')):
            value=copy.deepcopy(sbom);mutation(next(p for p in value['packages'] if p['name']==name))
            # Rebind the distribution manifest: rejection must come from semantic validation, not a stale hash.
            altered=dict(files);altered['sbom.spdx.json']=j(value);manifest=json.loads(altered['distribution-manifest.json']);manifest['files']=[ref(n,b) for n,b in sorted(altered.items()) if n!='distribution-manifest.json'];altered['distribution-manifest.json']=j(manifest)
            reject(name+': '+label,lambda:verify_files(altered),code)
    value=copy.deepcopy(sbom);value['files'][0]['checksums']=[c for c in value['files'][0]['checksums'] if c['algorithm']!='SHA1']
    reject('mandatory SHA1 missing',lambda:verify_spdx(value,files),'SPDX_FILE_SHA1_REQUIRED')
    value=copy.deepcopy(sbom);value['files'][0]['checksums'][1]['checksumValue']='0'*40
    reject('wrong file SHA1',lambda:verify_spdx(value,files),'SPDX_FILE_CHECKSUM')
    value=copy.deepcopy(sbom);next(p for p in value['packages'] if p['name']=='npm')['packageVerificationCode']={'packageVerificationCodeValue':'0'*40}
    reject('unanalyzed tool with verification code',lambda:verify_spdx(value,files),'SPDX_UNANALYZED_FIELDS')
    value=copy.deepcopy(sbom);value['relationships'].append({'spdxElementId':'SPDXRef-absent','relationshipType':'CONTAINS','relatedSpdxElement':value['files'][0]['SPDXID']})
    reject('unknown relationship source',lambda:verify_spdx(value,files),'SPDX_RELATIONSHIP_REFERENCES')
    value=dict(files);value['extra.txt']=b'extra';reject('extra shipped member',lambda:verify_files(value),'EXACT_ALLOWLIST')
    value=dict(files);value.pop('src/config.mjs');reject('missing runtime member',lambda:verify_files(value),'EXACT_ALLOWLIST')
    value=dict(files);value['src/config.mjs']+=b'\n';reject('runtime tamper',lambda:verify_files(value),'MANIFEST_CONTENT')
    value=dict(files);value['contracts/openapi.json']+=b'\n';reject('OpenAPI member tamper',lambda:verify_files(value),'MANIFEST_CONTENT')
    reject('wrong trusted archive digest',lambda:verify_archive(archive,'0'*64),'ARCHIVE_IDENTITY')
    accept('complete pinned official SPDX Draft-7 schema',lambda:verify_schema(sbom))
    accept('exhaustive emitted-field inventory',lambda:field_inventory(sbom))
    def external_positive():
        external=[p for p in sbom['packages'] if not p['filesAnalyzed']]
        assert len(external)==23
        assert all('packageVerificationCode' not in p and 'licenseInfoFromFiles' not in p and not p.get('hasFiles') for p in external)
        verify_spdx(sbom,files)
    accept('23 external metadata packages legitimately unanalyzed',external_positive)
    structural=[
        ('legacy documentComment root',lambda v:v.update(documentComment=v.pop('comment'))),
        ('arbitrary unknown root',lambda v:v.update(unexpected=True)),
        ('legacy licenseInfoInFile field',lambda v:v['files'][0].update(licenseInfoInFile=v['files'][0].pop('licenseInfoInFiles'))),
        ('unknown package property',lambda v:v['packages'][0].update(unexpected=True)),
        ('unknown file property',lambda v:v['files'][0].update(unexpected=True)),
        ('unknown relationship property',lambda v:v['relationships'][0].update(unexpected=True)),
        ('unknown checksum property',lambda v:v['files'][0]['checksums'][0].update(unexpected=True)),
        ('invalid file license array type',lambda v:v['files'][0].update(licenseInfoInFiles='NOASSERTION'))]
    for label,mutation in structural:
        value=copy.deepcopy(sbom);mutation(value)
        reject(label,lambda:verify_spdx(value,files),'SPDX_SCHEMA:')
    for label,mutation,code in [
        ('unanalyzed external with file license info',lambda p:p.update(licenseInfoFromFiles=['NOASSERTION']),'SPDX_UNANALYZED_FIELDS'),
        ('unanalyzed external with hasFiles',lambda p:p.update(hasFiles=[sbom['files'][0]['SPDXID']]),'SPDX_FALSE_WITH_FILES')]:
        value=copy.deepcopy(sbom);mutation(next(p for p in value['packages'] if p['name']=='npm'))
        reject(label,lambda:verify_spdx(value,files),code)
    return {'kind':'MemoryOSRESTReleaseMetadataTests','version':'1.0.0','state':'PASS','archive':identity(data),'caseCount':len(cases),'cases':cases,'spdx':verify_spdx(sbom,files),'schema':verify_schema(sbom),'generatedFields':field_inventory(sbom)}

if __name__=='__main__':
    p=argparse.ArgumentParser();p.add_argument('--archive',type=Path,required=True);p.add_argument('--output',type=Path,required=True);a=p.parse_args();result=run(a.archive);a.output.write_bytes(j(result));print(json.dumps(result))
