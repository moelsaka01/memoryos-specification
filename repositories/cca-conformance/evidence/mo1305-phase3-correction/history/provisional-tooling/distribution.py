"""Phase 3 correction trusted, bounded distribution builder/verifier (stdlib only).

Run from trusted engineering media before any installed JavaScript. The expected
archive digest must come from an independently trusted Phase 3 correction receipt. This is
integrity under that trust root, not signing or hostile-administrator isolation.
"""
from pathlib import Path
import argparse
import importlib.util
import gzip
import hashlib
import io
import json
import os
import re
import stat
import subprocess
import tarfile
import zlib

HERE = Path(__file__).resolve().parent
ROOT = HERE.parents[3]
PKG_REL = 'repositories/memoryos-rest'
BASELINE = '2fcc588979675462d30c582f24f42fa9ec3ec729'
MAX_ARCHIVE = 16 * 1024 * 1024
MAX_EXPANDED = 64 * 1024 * 1024
MAX_MEMBER = 8 * 1024 * 1024
GENERATED = {'dependency-manifest.json', 'sbom.spdx.json', 'distribution-manifest.json'}


def require(ok, code):
    if not ok:
        raise ValueError(code)


def j(value):
    return json.dumps(value, ensure_ascii=False, sort_keys=True, separators=(',', ':'), allow_nan=False).encode('utf-8')


def sha(data):
    return hashlib.sha256(data).hexdigest()


def identity(data):
    return {'byteLength': len(data), 'sha256': sha(data)}


def ref(path, data):
    return {'path': path, **identity(data)}


def parse(data):
    def pairs(items):
        obj = {}
        for key, value in items:
            require(key not in obj, 'DUPLICATE_JSON_KEY')
            obj[key] = value
        return obj
    value = json.loads(data, object_pairs_hook=pairs)
    require(j(value) == data, 'NONCANONICAL_JSON')
    return value


POLICY = parse((HERE / 'package-allowlist.json').read_bytes())
PATHS = POLICY['paths']


def safe_path(name):
    require(isinstance(name, str) and 0 < len(name.encode('utf-8')) <= 240, 'PATH_LENGTH')
    require(re.fullmatch(r'[A-Za-z0-9_./-]+', name) is not None, 'PATH_ALPHABET')
    for part in name.split('/'):
        require(part not in ('', '.', '..') and not part.endswith(('.', ' ')), 'PATH_SEGMENT')
        require(re.fullmatch(r'(con|prn|aux|nul|com[1-9]|lpt[1-9])(?:\..*)?', part, re.I) is None, 'WINDOWS_DEVICE_PATH')


def checked_read(path, limit=MAX_MEMBER):
    path = Path(path).absolute()
    for parent in [path, *path.parents]:
        st = parent.lstat()
        require(not stat.S_ISLNK(st.st_mode) and not (getattr(st, 'st_file_attributes', 0) & 0x400), 'LINK_OR_REPARSE')
    before = path.stat()
    require(stat.S_ISREG(before.st_mode) and before.st_nlink == 1 and before.st_size <= limit, 'FILE_TYPE_SIZE_LINK')
    with path.open('rb') as stream:
        opened = os.fstat(stream.fileno())
        data = stream.read(limit + 1)
        after = os.fstat(stream.fileno())
    final = path.stat()
    signature = lambda s: (s.st_dev, s.st_ino, s.st_size, s.st_mtime_ns)
    # Python 3.12 Windows path stat reports creation time as ctime, while
    # descriptor stat can report change time. Compare each clock to itself.
    require(signature(before) == signature(opened) == signature(after) == signature(final)
            and before.st_ctime_ns == final.st_ctime_ns and opened.st_ctime_ns == after.st_ctime_ns
            and len(data) == before.st_size, 'FILE_RACE')
    return data


def metadata(files):
    package = parse(files['package.json'])
    lock = parse(files['package-lock.json'])
    forbidden = {'dependencies', 'devDependencies', 'optionalDependencies', 'peerDependencies', 'peerDependenciesMeta',
                 'overrides', 'bundledDependencies', 'bundleDependencies', 'workspaces', 'gypfile'}
    require(not forbidden.intersection(package), 'PACKAGE_DEPENDENCIES')
    require(set(package) == {'bin', 'description', 'engines', 'files', 'name', 'packageManager', 'private', 'scripts', 'type', 'version'}, 'PACKAGE_FIELDS')
    require(package['name'] == 'memoryos-rest' and package['version'] == '0.1.0' and package['private'] is True
            and package['type'] == 'module' and package['engines'] == {'node': '24.21.0'}
            and package['packageManager'] == 'npm@11.19.0'
            and package['bin'] == {'memoryos-rest': 'bin/memoryos-rest.mjs'}, 'PACKAGE_IDENTITY')
    require(package.get('scripts', {}) == {'test': 'node --test --test-concurrency=1 tests/*.test.mjs'}, 'UNEXPECTED_SCRIPT')
    require(set(lock) == {'lockfileVersion', 'name', 'version', 'requires', 'packages'}
            and lock['lockfileVersion'] == 3 and lock['requires'] is True
            and lock['name'] == 'memoryos-rest' and lock['version'] == '0.1.0'
            and set(lock['packages']) == {''}, 'LOCK_GRAPH')
    require(lock['packages'][''] == {'name': 'memoryos-rest', 'version': '0.1.0',
            'engines': {'node': '24.21.0'}, 'bin': {'memoryos-rest': 'bin/memoryos-rest.mjs'}}, 'LOCK_ROOT')
    # The authoritative nested package is pinned metadata, never an install root.
    return {'lockfileVersion': 3, 'direct': 0, 'transitive': 0, 'development': 0, 'optional': 0,
            'nativeAddons': 0, 'lifecycleHooks': 0, 'npmDependencyFiles': 0}


def import_graph(files):
    edges = []
    for name, content in sorted(files.items()):
        if not name.endswith(('.mjs', '.js')):
            continue
        text = content.decode('utf-8')
        require(not re.search(r'(?<![A-Za-z])[A-Za-z]:[\\/]|file://|cca-workspace|cca-mo1305-2[abc]', text), 'SOURCE_PATH_DEPENDENCY')
        # Supplemental literal-import inventory, not a JavaScript parser.
        # Every executable byte is independently pinned to the explicitly reviewed integrated candidate above.
        for spec in re.findall(r'(?:\bfrom\s+|\bimport\s+|\bimport\s*\(\s*)[\'\"]([^\'\"]+)[\'\"]', text):
            if spec.startswith('node:'):
                edges.append({'from': name, 'to': spec})
            else:
                require(spec.startswith('./') or spec.startswith('../'), 'NONLOCAL_IMPORT')
                parts = name.split('/')[:-1]
                for part in spec.split('/'):
                    if part == '..':
                        require(bool(parts), 'IMPORT_ESCAPES_ROOT')
                        parts.pop()
                    elif part not in ('', '.'):
                        parts.append(part)
                target = '/'.join(parts)
                require(target in files, 'MISSING_IMPORT')
                edges.append({'from': name, 'to': target})
    return edges


def verify_files(files):
    require(isinstance(files, dict) and sorted(files) == PATHS, 'EXACT_ALLOWLIST')
    for name, content in files.items():
        safe_path(name)
        require(isinstance(content, bytes) and len(content) <= MAX_MEMBER, 'MEMBER_SIZE')
    manifest = parse(files['distribution-manifest.json'])
    require(set(manifest) == {'files', 'kind', 'package', 'packageVersion', 'version'}
            and manifest['kind'] == 'MemoryOSRESTDistributionManifest' and manifest['version'] == '1.0.0'
            and manifest['package'] == 'memoryos-rest' and manifest['packageVersion'] == '0.1.0', 'MANIFEST_SHAPE')
    inventory = [ref(name, files[name]) for name in PATHS if name != 'distribution-manifest.json']
    require(manifest['files'] == inventory, 'MANIFEST_CONTENT')
    for row in POLICY['immutable']:
        require(ref(row['path'], files[row['path']]) == row, 'INTEGRATED_IMMUTABLE:' + row['path'])
    graph = metadata(files)
    closure = parse(files['runtime/runtime-closure-manifest.json'])
    require(len(closure['files']) == 25, 'CLOSURE_COUNT')
    for row in closure['files']:
        require(identity(files['runtime/' + row['path']]) == {k: row[k] for k in ('byteLength', 'sha256')}, 'CLOSURE_CONTENT')
    edges = import_graph(files)
    dependency = parse(files['dependency-manifest.json'])
    require(set(dependency) == {'kind', 'version', 'directCount', 'transitiveCount', 'developmentCount', 'lockfile', 'runtime', 'sourceTreeSha256', 'parentRevision'} and dependency['kind'] == 'MemoryOSRESTDependencyManifest' and dependency['version'] == '1.0.0', 'DEPENDENCY_FIELDS')
    require(all(type(dependency[k]) is int and dependency[k] == 0 for k in ('directCount', 'transitiveCount', 'developmentCount')), 'DEPENDENCY_COUNTS')
    require(dependency['lockfile'] == ref('package-lock.json', files['package-lock.json']), 'DEPENDENCY_LOCK')
    require(dependency['runtime']['components'] == POLICY['runtimeComponents'], 'DEPENDENCY_COMPONENTS')
    require(dependency['runtime']['version'] == '24.21.0' and dependency['runtime']['npm'] == '11.19.0'
            and dependency['runtime']['sha256'] == POLICY['nodeSha256'], 'DEPENDENCY_RUNTIME')
    require(dependency['parentRevision'] == BASELINE and re.fullmatch('[0-9a-f]{64}', dependency['sourceTreeSha256']), 'DEPENDENCY_PROVENANCE')
    sbom = parse(files['sbom.spdx.json'])
    require(sbom['documentNamespace'] == 'https://memoryos.invalid/spdx/' + BASELINE + '/' + dependency['sourceTreeSha256'] + '/0.1.0', 'SBOM_NAMESPACE')
    require(sbom['spdxVersion'] == 'SPDX-2.3' and sbom['dataLicense'] == 'CC0-1.0', 'SBOM_VERSION')
    # Every non-self-referential shipped file is enumerated and hashed in SPDX.
    expected_sbom_files = {name: sha(data) for name, data in files.items() if name not in {'sbom.spdx.json', 'distribution-manifest.json'}}
    actual_sbom_files = {row['fileName'][2:]: row['checksums'][0]['checksumValue'] for row in sbom['files']}
    require(actual_sbom_files == expected_sbom_files and len(sbom['files']) == len(expected_sbom_files), 'SBOM_FILES')
    expected_packages = {'memoryos-rest', 'memoryos-authoritative-closure', 'npm'} | {
        k for k, v in dependency['runtime']['components'].items() if v and k not in ('modules', 'napi', 'cldr', 'tz', 'unicode')}
    require({p['name'] for p in sbom['packages']} == expected_packages and len(sbom['packages']) == len(expected_packages), 'SBOM_PACKAGES')
    expected_versions = {'memoryos-rest': '0.1.0', 'memoryos-authoritative-closure': '1.1.0', 'npm': '11.19.0', **dependency['runtime']['components']}
    ids = {'SPDXRef-DOCUMENT'}
    for row in sbom['packages']:
        require(row['SPDXID'] == 'SPDXRef-Package-' + row['name'] and row['SPDXID'] not in ids and row['versionInfo'] == expected_versions[row['name']], 'SBOM_PACKAGE_IDENTITY')
        require(row['licenseConcluded'] == 'NOASSERTION', 'SBOM_LICENSE_CONCLUSION')
        if row['name'] == 'node':
            require(row['checksums'] == [{'algorithm': 'SHA256', 'checksumValue': POLICY['nodeSha256']}], 'SBOM_NODE_CHECKSUM')
        if row['name'] in ('memoryos-rest', 'memoryos-authoritative-closure'):
            require(row['licenseDeclared'] == 'NOASSERTION', 'SBOM_FIRST_PARTY_RIGHTS')
        ids.add(row['SPDXID'])
    expected_relationships = [{'spdxElementId': 'SPDXRef-DOCUMENT', 'relationshipType': 'DESCRIBES', 'relatedSpdxElement': 'SPDXRef-Package-memoryos-rest'}]
    for row in sbom['files']:
        require(row['SPDXID'] not in ids and row['licenseConcluded'] == 'NOASSERTION', 'SBOM_FILE_IDENTITY')
        require(row['checksums'] == [{'algorithm': 'SHA256', 'checksumValue': sha(files[row['fileName'][2:]])}, {'algorithm': 'SHA1', 'checksumValue': hashlib.sha1(files[row['fileName'][2:]]).hexdigest()}], 'SBOM_FILE_CHECKSUM')
        ids.add(row['SPDXID'])
        owner = 'memoryos-authoritative-closure' if row['fileName'].startswith('./runtime/authoritative/') else 'memoryos-rest'
        expected_relationships.append({'spdxElementId': 'SPDXRef-Package-' + owner, 'relationshipType': 'CONTAINS', 'relatedSpdxElement': row['SPDXID']})
    for row in sbom['packages']:
        name = row['name']
        if name != 'memoryos-rest':
            expected_relationships.append({'spdxElementId': 'SPDXRef-Package-memoryos-rest' if name in ('node', 'npm', 'memoryos-authoritative-closure') else 'SPDXRef-Package-node',
                'relationshipType': 'DEPENDS_ON' if name in ('node', 'npm') else 'CONTAINS', 'relatedSpdxElement': row['SPDXID']})
    require(sbom['relationships'] == expected_relationships, 'SBOM_RELATIONSHIPS')
    from spdx import verify_spdx
    verify_spdx(sbom, files)
    return {'manifest': identity(files['distribution-manifest.json']), 'inventory': [ref(n, files[n]) for n in PATHS],
            'runtimeFileCount': 25, 'fileCount': len(files), 'dependencyGraph': graph, 'imports': edges}


def serialize_archive(files):
    raw = io.BytesIO()
    with tarfile.open(fileobj=raw, mode='w', format=tarfile.USTAR_FORMAT) as tar:
        for name, content in sorted(files.items()):
            safe_path(name)
            require(len(content) <= MAX_MEMBER, 'MEMBER_SIZE')
            info = tarfile.TarInfo('package/' + name)
            info.size = len(content)
            info.mode = 0o755 if name.startswith('bin/') else 0o644
            info.uid = info.gid = info.mtime = 0
            info.uname = info.gname = ''
            tar.addfile(info, io.BytesIO(content))
    require(len(files) <= 256 and len(raw.getvalue()) <= MAX_EXPANDED, 'EXPANDED_BOUND')
    out = io.BytesIO()
    with gzip.GzipFile(fileobj=out, mode='wb', filename='', mtime=0, compresslevel=9) as stream:
        stream.write(raw.getvalue())
    require(len(out.getvalue()) <= MAX_ARCHIVE, 'COMPRESSED_BOUND')
    return out.getvalue()


def verify_archive(path, expected_sha256):
    require(isinstance(expected_sha256, str) and re.fullmatch('[0-9a-f]{64}', expected_sha256), 'EXPECTED_DIGEST_REQUIRED')
    data = checked_read(path, MAX_ARCHIVE)
    require(sha(data) == expected_sha256, 'ARCHIVE_IDENTITY')
    require(data[:10] == bytes([31, 139, 8, 0, 0, 0, 0, 0, 2, 255]), 'GZIP_HEADER')
    try:
        decoder = zlib.decompressobj(31)
        raw = decoder.decompress(data, MAX_EXPANDED + 1)
        require(len(raw) <= MAX_EXPANDED and decoder.eof and not decoder.unconsumed_tail and not decoder.unused_data, 'GZIP_BOUND_END')
    except zlib.error as exc:
        raise ValueError('GZIP_CORRUPTION') from exc
    files = {}
    offset = 0
    last = ''
    # Manual USTAR boundary parsing prevents hidden extension/link headers or
    # oversized allocation before tarfile's convenient member interpretation.
    while offset + 512 <= len(raw) and raw[offset:offset + 512] != bytes(512):
        header = raw[offset:offset + 512]
        require(header[257:265] == b'ustar\x0000' and header[156:157] == b'0', 'USTAR_TYPE')
        require(not header[157:257].strip(b'\0') and not header[265:329].strip(b'\0')
                and not header[345:512].strip(b'\0'), 'USTAR_EXTENSION')
        try:
            member = tarfile.TarInfo.frombuf(header, 'ascii', 'strict')
        except (tarfile.HeaderError, UnicodeError, ValueError) as exc:
            raise ValueError('USTAR_HEADER') from exc
        require(member.name.startswith('package/'), 'ARCHIVE_PREFIX')
        name = member.name[8:]
        safe_path(name)
        require(name > last and name.casefold() not in {x.casefold() for x in files}, 'ARCHIVE_ORDER_COLLISION')
        require(member.size <= MAX_MEMBER and member.size >= 0 and member.uid == member.gid == member.mtime == 0, 'USTAR_SIZE_OWNER_TIME')
        require(member.mode == (0o755 if name.startswith('bin/') else 0o644), 'USTAR_MODE')
        start = offset + 512
        end = start + member.size
        padded = start + ((member.size + 511) // 512) * 512
        require(padded <= len(raw) and not raw[end:padded].strip(b'\0'), 'USTAR_TRUNCATION_PADDING')
        files[name] = raw[start:end]
        require(len(files) <= 256, 'MEMBER_COUNT')
        last = name
        offset = padded
    require(len(raw) - offset >= 1024 and not raw[offset:].strip(b'\0') and len(raw) % 10240 == 0, 'USTAR_END')
    result = verify_files(files)
    # Canonical recomposition additionally closes unused header fields, octal
    # representation, trailing records and gzip compression identity.
    require(serialize_archive(files) == data, 'NONDETERMINISTIC_ARCHIVE')
    return {'files': files, 'archive': identity(data), **result}


def toolchain(node, npm):
    node_data = checked_read(node, 128 * 1024 * 1024)
    require(sha(node_data) == POLICY['nodeSha256'], 'NODE_SUBSTITUTION')
    clean = {k: v for k, v in os.environ.items() if k.upper() in ('SYSTEMROOT', 'WINDIR', 'TEMP', 'TMP')}
    versions = json.loads(subprocess.check_output([str(node), '-p', 'JSON.stringify(process.versions)'], env=clean, timeout=15))
    require(versions == POLICY['runtimeComponents'], 'NODE_COMPONENTS')
    require(sha(checked_read(npm)) == POLICY['npmCliSha256'], 'NPM_CLI_SUBSTITUTION')
    npm_version = subprocess.check_output([str(node), str(npm), '--version'], env=clean, timeout=15).decode().strip()
    require(npm_version == '11.19.0', 'NPM_VERSION')
    package = Path(npm).parents[1] / 'package.json'
    require(json.loads(checked_read(package))['version'] == npm_version, 'NPM_METADATA')
    return versions


def read_package(root):
    package = Path(root) / PKG_REL
    # Source tests are permitted only outside the shipped roots. An unexpected
    # file anywhere inside a shipped root must fail instead of being ignored.
    for folder in ('bin', 'src', 'runtime', 'contracts', 'notices', 'scripts'):
        for path in (package / folder).rglob('*'):
            st = path.lstat()
            require(not (getattr(st, 'st_file_attributes', 0) & 0x400) and not path.is_symlink(), 'SOURCE_LINK')
            if not path.is_dir():
                require(path.relative_to(package).as_posix() in PATHS, 'EXTRA_SOURCE_MEMBER')
    return {name: checked_read(package / name) for name in PATHS if name not in GENERATED}


def assemble(root, node, npm):
    files = read_package(root)
    projection_path = Path(root) / 'repositories/cca-conformance/tools/mo1305-phase1/build.py'
    spec = importlib.util.spec_from_file_location('mo1305_openapi_source', projection_path)
    projection = importlib.util.module_from_spec(spec)
    spec.loader.exec_module(projection)
    generated_openapi = j(projection.make_openapi(parse(files['contracts/api-contract.json']), parse(files['contracts/limits.json'])))
    require(files['contracts/openapi.json'] == generated_openapi, 'OPENAPI_SOURCE_DRIFT')
    versions = toolchain(node, npm)
    metadata(files)
    for row in POLICY['immutable']:
        require(ref(row['path'], files[row['path']]) == row, 'INTEGRATED_BUILD_DRIFT:' + row['path'])
    inputs = [ref(PKG_REL + '/' + name, data) for name, data in sorted(files.items())]
    inputs += [ref('repositories/cca-conformance/tools/mo1305-phase3-correction/' + path.name, checked_read(path))
               for path in [HERE / name for name in ('distribution.py', 'package-allowlist.json', 'spdx.py')]]
    support = ['repositories/cca-conformance/tools/mo1305-phase1/build.py',
               'repositories/cca-conformance/tools/mo1305-phase1/validate-launch.ps1',
               'repositories/cca-conformance/tools/mo1305-phase1/regressions.py',
               'repositories/cca-conformance/schema/mo1305-receipt-2.0.0.json']
    support += ['repositories/cca-conformance/fixtures/mo1305-phase1/' + name for name in
                ('index.json', 'identities.json', 'prepare-policy-pass.json', 'prepare-policySet-pass.json',
                 'evaluate-policy-pass.json', 'evaluate-policy-fail.json', 'verify-identity.json', 'verify-outcome.json')]
    inputs += [ref(name, checked_read(Path(root) / name)) for name in support]
    inputs.sort(key=lambda row: row['path'])
    tree = sha(j(inputs))
    dependency = {'kind': 'MemoryOSRESTDependencyManifest', 'version': '1.0.0', 'directCount': 0, 'transitiveCount': 0,
                  'developmentCount': 0, 'lockfile': ref('package-lock.json', files['package-lock.json']),
                  'runtime': {'name': 'node', 'version': '24.21.0', 'sha256': POLICY['nodeSha256'], 'npm': '11.19.0', 'components': versions},
                  'sourceTreeSha256': tree, 'parentRevision': BASELINE}
    files['dependency-manifest.json'] = j(dependency)
    declared = {'node': 'MIT', 'npm': 'Artistic-2.0', 'acorn': 'MIT', 'ada': 'MIT', 'amaro': 'MIT', 'ares': 'MIT',
                'brotli': 'MIT', 'icu': 'Unicode-3.0', 'llhttp': 'MIT', 'merve': 'MIT', 'nghttp2': 'MIT',
                'openssl': 'Apache-2.0', 'simdjson': 'Apache-2.0', 'simdutf': 'MIT', 'undici': 'MIT',
                'uv': 'MIT', 'uvwasi': 'MIT', 'v8': 'BSD-3-Clause', 'zlib': 'Zlib', 'zstd': 'BSD-3-Clause'}
    components = {k: v for k, v in versions.items() if v and k not in ('modules', 'napi', 'cldr', 'tz', 'unicode')}
    packages = []
    for name, version in [('memoryos-rest', '0.1.0'), ('memoryos-authoritative-closure', '1.1.0'), ('npm', '11.19.0'), *sorted(components.items())]:
        row = {'SPDXID': 'SPDXRef-Package-' + name, 'name': name, 'versionInfo': version, 'downloadLocation': 'NOASSERTION',
               'filesAnalyzed': False, 'licenseConcluded': 'NOASSERTION', 'licenseDeclared': declared.get(name, 'NOASSERTION'),
               'copyrightText': 'NOASSERTION', 'licenseComments': 'Primary grants do not replace complete notices/node-LICENSE.txt. MemoryOS rights remain NOASSERTION. Node and npm are external operator tools; npm tool dependencies are not gateway production dependencies.'}
        if name == 'node':
            row['checksums'] = [{'algorithm': 'SHA256', 'checksumValue': POLICY['nodeSha256']}]
        packages.append(row)
    file_rows = []
    relationships = [{'spdxElementId': 'SPDXRef-DOCUMENT', 'relationshipType': 'DESCRIBES', 'relatedSpdxElement': 'SPDXRef-Package-memoryos-rest'}]
    for index, (name, data) in enumerate(sorted(files.items())):
        spdx = 'SPDXRef-File-' + str(index)
        file_rows.append({'SPDXID': spdx, 'fileName': './' + name, 'checksums': [{'algorithm': 'SHA256', 'checksumValue': sha(data)}, {'algorithm': 'SHA1', 'checksumValue': hashlib.sha1(data).hexdigest()}],
                          'licenseConcluded': 'NOASSERTION', 'licenseInfoInFile': ['NOASSERTION'], 'copyrightText': 'NOASSERTION'})
        owner = 'memoryos-authoritative-closure' if name.startswith('runtime/authoritative/') else 'memoryos-rest'
        relationships.append({'spdxElementId': 'SPDXRef-Package-' + owner, 'relationshipType': 'CONTAINS', 'relatedSpdxElement': spdx})
    for row in packages:
        name = row['name']
        if name != 'memoryos-rest':
            relationships.append({'spdxElementId': 'SPDXRef-Package-memoryos-rest' if name in ('node', 'npm', 'memoryos-authoritative-closure') else 'SPDXRef-Package-node',
                                  'relationshipType': 'DEPENDS_ON' if name in ('node', 'npm') else 'CONTAINS', 'relatedSpdxElement': row['SPDXID']})
    # Direct file scopes remain distinct: gateway payload (31) and closure (25).
    # Both recursive analysis outputs are explicitly excluded from the payload code.
    for package in packages:
        owned = [f for f in file_rows if any(r['spdxElementId'] == package['SPDXID'] and r['relationshipType'] == 'CONTAINS' and r['relatedSpdxElement'] == f['SPDXID'] for r in relationships)]
        if owned:
            package['filesAnalyzed'] = True
            sums = sorted(next(c['checksumValue'] for c in f['checksums'] if c['algorithm'] == 'SHA1') for f in owned)
            package['packageVerificationCode'] = {'packageVerificationCodeValue': hashlib.sha1(''.join(sums).encode('ascii')).hexdigest()}
            package['licenseInfoFromFiles'] = ['NOASSERTION']
            if package['name'] == 'memoryos-rest':
                package['packageVerificationCode']['packageVerificationCodeExcludedFiles'] = ['./distribution-manifest.json', './sbom.spdx.json']
            package['comment'] = 'Verification covers directly CONTAINS file records. The authoritative closure has its own package/code. SPDX and its recursive distribution hash inventory are excluded analysis outputs, bound by the archive receipt.'
    files['sbom.spdx.json'] = j({'spdxVersion': 'SPDX-2.3', 'dataLicense': 'CC0-1.0', 'SPDXID': 'SPDXRef-DOCUMENT',
        'name': 'memoryos-rest-0.1.0', 'documentNamespace': 'https://memoryos.invalid/spdx/' + BASELINE + '/' + tree + '/0.1.0',
        'creationInfo': {'creators': ['Tool: memoryos-rest-phase3-correction-builder-1.0.0'], 'created': '2026-09-25T00:00:00Z'},
        'documentComment': 'Gateway and authoritative closure files are distinct. SPDX and distribution manifest exclude self hashes; archive receipt binds both. Zero npm production dependencies does not mean zero supply-chain surface.',
        'packages': packages, 'files': file_rows, 'relationships': relationships})
    files['distribution-manifest.json'] = j({'kind': 'MemoryOSRESTDistributionManifest', 'version': '1.0.0',
        'package': 'memoryos-rest', 'packageVersion': '0.1.0', 'files': [ref(n, b) for n, b in sorted(files.items())]})
    verify_files(files)
    return files, {'files': inputs, 'sha256': tree}


def main():
    parser = argparse.ArgumentParser(description=__doc__)
    sub = parser.add_subparsers(dest='command', required=True)
    build = sub.add_parser('build')
    build.add_argument('--root', type=Path, default=ROOT)
    build.add_argument('--node', type=Path, required=True)
    build.add_argument('--npm', type=Path, required=True)
    build.add_argument('--output', type=Path, required=True)
    build.add_argument('--write-metadata', action='store_true')
    verify = sub.add_parser('verify')
    verify.add_argument('--archive', type=Path, required=True)
    verify.add_argument('--sha256', required=True)
    args = parser.parse_args()
    if args.command == 'build':
        files, tree = assemble(args.root, args.node, args.npm)
        args.output.mkdir(parents=True, exist_ok=True)
        archive = args.output / 'memoryos-rest-0.1.0.tgz'
        archive.write_bytes(serialize_archive(files))
        (args.output / 'source-tree.json').write_bytes(j(tree))
        if args.write_metadata:
            for name in GENERATED:
                (args.root / PKG_REL / name).write_bytes(files[name])
        result = verify_archive(archive, sha(archive.read_bytes()))
        print(json.dumps({k: v for k, v in result.items() if k not in ('files', 'imports', 'inventory')}))
    else:
        result = verify_archive(args.archive, args.sha256)
        print(json.dumps({k: v for k, v in result.items() if k not in ('files', 'imports', 'inventory')}))


if __name__ == '__main__':
    main()
