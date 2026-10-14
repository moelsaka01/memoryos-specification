"""Independent SPDX 2.3 file-analysis validation against actual shipped bytes.

SHA-1 is the SPDX identifier algorithm, not a security trust root. SHA-256 and
an externally trusted archive identity continue to provide integrity binding.
"""
import hashlib
import re


def need(ok, code):
    if not ok:
        raise ValueError('SPDX_' + code)


def verify_spdx(document, files):
    need(document.get('spdxVersion') == 'SPDX-2.3' and document.get('dataLicense') == 'CC0-1.0', 'DOCUMENT')
    need(document.get('SPDXID') == 'SPDXRef-DOCUMENT' and isinstance(document.get('name'), str), 'DOCUMENT_ID')
    info = document.get('creationInfo', {})
    need(bool(info.get('creators')) and all(re.fullmatch(r'(Person|Organization|Tool): .+', x) for x in info['creators']) and re.fullmatch(r'\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}Z', info.get('created', '')), 'CREATION')
    by_id = {}
    names = set()
    for file in document.get('files', []):
        need(set(file) == {'SPDXID', 'fileName', 'checksums', 'licenseConcluded', 'licenseInfoInFile', 'copyrightText'}, 'FILE_FIELDS')
        need(re.fullmatch(r'SPDXRef-[A-Za-z0-9.-]+', file['SPDXID']) and file['SPDXID'] not in by_id, 'FILE_ID')
        name = file['fileName']
        need(name.startswith('./') and name[2:] in files and name not in names, 'FILE_PATH')
        checksums = file['checksums']
        need(len(checksums) == 2 and {c['algorithm'] for c in checksums} == {'SHA1', 'SHA256'}, 'FILE_SHA1_REQUIRED')
        for c in checksums:
            expected = hashlib.new(c['algorithm'].lower(), files[name[2:]]).hexdigest()
            need(c['checksumValue'] == expected, 'FILE_CHECKSUM')
        need(file['licenseConcluded'] == file['copyrightText'] == 'NOASSERTION' and file['licenseInfoInFile'] == ['NOASSERTION'], 'FILE_LICENSE')
        names.add(name)
        by_id[file['SPDXID']] = file
    need(names == {'./' + p for p in files if p not in ('sbom.spdx.json', 'distribution-manifest.json')}, 'FILE_COVERAGE')
    results = []
    package_ids = set()
    for package in document.get('packages', []):
        pid = package.get('SPDXID')
        need(isinstance(pid, str) and pid not in by_id and pid not in package_ids and re.fullmatch(r'SPDXRef-[A-Za-z0-9.-]+', pid), 'PACKAGE_ID')
        package_ids.add(pid)
        need(all(k in package for k in ('name', 'downloadLocation', 'filesAnalyzed', 'licenseConcluded', 'licenseDeclared', 'copyrightText')), 'PACKAGE_FIELDS')
        need(type(package['filesAnalyzed']) is bool, 'FILES_ANALYZED_TYPE')
        targets = [r['relatedSpdxElement'] for r in document['relationships'] if r['spdxElementId'] == pid and r['relationshipType'] == 'CONTAINS' and r['relatedSpdxElement'] in by_id]
        need(len(set(targets)) == len(targets), 'DUPLICATE_CONTAINMENT')
        if not package['filesAnalyzed']:
            need(not targets, 'FALSE_WITH_FILES:' + package['name'])
            need('packageVerificationCode' not in package and 'licenseInfoFromFiles' not in package, 'UNANALYZED_FIELDS')
            continue
        need(bool(targets), 'EMPTY_ANALYZED_SCOPE')
        code = package.get('packageVerificationCode', {})
        need(isinstance(code, dict) and 'packageVerificationCodeValue' in code and not set(code) - {'packageVerificationCodeValue', 'packageVerificationCodeExcludedFiles'}, 'VERIFICATION_CODE_REQUIRED')
        # Re-read payload bytes and compute independently of the builder/file checksums.
        hashes = [hashlib.sha1(files[by_id[target]['fileName'][2:]]).hexdigest() for target in targets]
        expected = hashlib.sha1(''.join(sorted(hashes)).encode('ascii')).hexdigest()
        need(code['packageVerificationCodeValue'] == expected, 'VERIFICATION_CODE:' + package['name'])
        excluded = ['./distribution-manifest.json', './sbom.spdx.json'] if package['name'] == 'memoryos-rest' else []
        need(code.get('packageVerificationCodeExcludedFiles', []) == excluded, 'ANALYSIS_EXCLUSIONS')
        need(package.get('licenseInfoFromFiles') == ['NOASSERTION'], 'ANALYZED_LICENSES')
        results.append({'package': package['name'], 'filesAnalyzed': True, 'fileCount': len(targets), 'verificationCode': expected, 'excludedAnalysisFiles': excluded})
    need({r['package']: r['fileCount'] for r in results} == {'memoryos-rest': 31, 'memoryos-authoritative-closure': 25}, 'ANALYZED_SCOPES')
    need(len(package_ids) == len(document['packages']), 'PACKAGE_DUPLICATES')
    ids = set(by_id) | package_ids | {'SPDXRef-DOCUMENT'}
    need(all(r.get('spdxElementId') in ids and r.get('relatedSpdxElement') in ids and r.get('relationshipType') in {'CONTAINS', 'DESCRIBES', 'DEPENDS_ON'} for r in document['relationships']), 'RELATIONSHIP_REFERENCES')
    return {'state': 'PASS', 'packageCount': len(document['packages']), 'fileCount': len(by_id), 'relationshipCount': len(document['relationships']), 'analyzedPackages': results}
