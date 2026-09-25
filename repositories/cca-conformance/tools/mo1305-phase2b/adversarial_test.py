"""Bounded Phase 2B package attacks against independent archive/file constraints."""
from pathlib import Path
import argparse
import copy
import gzip
import hashlib
import io
import json
import os
import subprocess
import tarfile
import tempfile

from distribution import serialize_archive, verify_archive, verify_files

NODE_SHA256 = 'ba4e6d110e8c1592a1ecd390f6b05f3da124b13871a5be62b341a07a853c6c32'
MANIFEST = 'distribution-manifest.json'
MAX_COMPRESSED = 16 * 1024 * 1024
MAX_EXPANDED = 64 * 1024 * 1024
MAX_MEMBER = 8 * 1024 * 1024


def canonical(value):
    return json.dumps(value, ensure_ascii=False, sort_keys=True, separators=(',', ':')).encode('utf-8')


def identity(data):
    return {'byteLength': len(data), 'sha256': hashlib.sha256(data).hexdigest()}


def rebound(files):
    """Give tampered bytes a coherent manifest, so a self-hash check cannot suffice."""
    result = dict(files)
    # Keep the complete SPDX file inventory coherent too; metadata policy and
    # frozen authority checks must reject changes independently of stale hashes.
    if 'sbom.spdx.json' in result:
        sbom = json.loads(result['sbom.spdx.json'])
        for row in sbom.get('files', []):
            name = row.get('fileName', '')[2:]
            if name in result and name not in {'sbom.spdx.json', MANIFEST}:
                row['checksums'] = [{'algorithm': 'SHA256', 'checksumValue': identity(result[name])['sha256']}]
        result['sbom.spdx.json'] = canonical(sbom)
    manifest = json.loads(result[MANIFEST])
    manifest['files'] = [dict(path=name, **identity(data)) for name, data in sorted(result.items()) if name != MANIFEST]
    result[MANIFEST] = canonical(manifest)
    return result


def mutated_json(files, name, edit):
    result = dict(files)
    value = json.loads(result[name])
    edit(value)
    result[name] = canonical(value)
    return rebound(result)


def compressed(raw, *, filename='', mtime=0):
    stream = io.BytesIO()
    with gzip.GzipFile(fileobj=stream, mode='wb', filename=filename, mtime=mtime, compresslevel=9) as writer:
        writer.write(raw)
    return stream.getvalue()


def raw_archive(files, change=None, extra=None):
    """Construct arbitrary headers without invoking the production serializer."""
    stream = io.BytesIO()
    entries = []
    for name, data in sorted(files.items()):
        member = tarfile.TarInfo('package/' + name)
        member.uid = member.gid = member.mtime = 0
        member.uname = member.gname = ''
        member.mode = 0o755 if name == 'bin/memoryos-rest.mjs' else 0o644
        member.size = len(data)
        entries.append((member, data))
    if change:
        change(entries)
    if extra:
        entries.extend(extra)
    for member, data in entries:
        stream.write(member.tobuf(format=tarfile.USTAR_FORMAT))
        stream.write(data)
        stream.write(bytes((-len(data)) % 512))
    stream.write(bytes(1024))
    stream.write(bytes((-stream.tell()) % 10240))
    return stream.getvalue()


def run(archive, output, node=None):
    source = archive.read_bytes()
    trusted_sha = identity(source)['sha256']
    verified = verify_archive(archive, trusted_sha)
    files = verified['files']
    records = []

    def check(name, action, rejection=True):
        try:
            action()
        except ValueError as error:
            if not rejection:
                raise AssertionError('VALID_INPUT_REJECTED:' + name) from error
            records.append({'id': name, 'state': 'PASS', 'expected': 'reject', 'observed': 'reject'})
        else:
            if rejection:
                raise AssertionError('ATTACK_ACCEPTED:' + name)
            records.append({'id': name, 'state': 'PASS', 'expected': 'accept', 'observed': 'accept'})

    with tempfile.TemporaryDirectory(prefix='memoryos-rest-phase2b-adversarial-') as directory:
        temporary = Path(directory).resolve()
        assert temporary.parent == Path(tempfile.gettempdir()).resolve()
        candidate = temporary / 'candidate.tgz'

        def archive_check(name, data, *, expected=None, rejection=True):
            candidate.write_bytes(data)
            # Structural attacks get their own correct outer hash deliberately.
            check(name, lambda: verify_archive(candidate, expected or identity(data)['sha256']), rejection)

        check('files-original', lambda: verify_files(files), False)
        archive_check('archive-original', source, rejection=False)
        archive_check('archive-serializer-roundtrip', serialize_archive(files), rejection=False)

        changed = dict(files)
        changed['README.md'] += b'\nCoherent substitution witness.\n'
        changed = rebound(changed)
        check('files-coherent-permitted-document-change', lambda: verify_files(changed), False)
        archive_check('archive-original-trust-rejects-coherent-substitution', serialize_archive(changed), expected=trusted_sha)

        for name in ['package-lock.json', 'scripts/verify-distribution.mjs', 'src/integrity.mjs',
                     'runtime/authoritative/web/js/memoryos-sdk.js']:
            missing = dict(files)
            del missing[name]
            check('files-missing-' + name, lambda value=rebound(missing): verify_files(value))
        for name in ['unexpected.mjs', 'src/extra.mjs', 'node_modules/unexpected/index.js', 'native.node', 'loader.mjs']:
            extra = rebound(dict(files, **{name: b'UNEXPECTED'}))
            check('files-extra-' + name, lambda value=extra: verify_files(value))
        case = dict(files)
        case['Package.json'] = case.pop('package.json')
        check('files-case-substitution', lambda: verify_files(rebound(case)))
        for name in ['package.json', 'package-lock.json', 'scripts/verify-distribution.mjs', 'src/integrity.mjs',
                     'contracts/api-contract.json', 'contracts/limits.json', 'contracts/openapi.json',
                     'contracts/policy-contract-identities-1.0.0.json', 'runtime/runtime-closure-manifest.json']:
            changed = dict(files)
            changed[name] += b' '
            check('files-unrebound-change-' + name, lambda value=changed: verify_files(value))
        for name in ['contracts/api-contract.json', 'contracts/limits.json', 'contracts/openapi.json',
                     'contracts/policy-contract-identities-1.0.0.json', 'runtime/runtime-closure-manifest.json',
                     'runtime/authoritative/web/js/memoryos-sdk.js', 'runtime/authoritative/package.json',
                     'notices/node-LICENSE.txt', 'LICENSE-NOTICE.md', 'package-lock.json']:
            changed = dict(files)
            changed[name] += b' '
            check('files-rebound-immutable-change-' + name, lambda value=rebound(changed): verify_files(value))

        for field in ['dependencies', 'devDependencies', 'optionalDependencies', 'peerDependencies', 'overrides']:
            changed = mutated_json(files, 'package.json', lambda value, field=field: value.__setitem__(field, {'unexpected': '1.0.0'}))
            check('metadata-injected-' + field, lambda value=changed: verify_files(value))
        for field in ['bundleDependencies', 'bundledDependencies']:
            changed = mutated_json(files, 'package.json', lambda value, field=field: value.__setitem__(field, ['unexpected']))
            check('metadata-injected-' + field, lambda value=changed: verify_files(value))
        for hook in ['preinstall', 'install', 'postinstall', 'prepare', 'prepublish', 'prepack', 'postpack']:
            changed = mutated_json(files, 'package.json', lambda value, hook=hook: value.setdefault('scripts', {}).__setitem__(hook, 'node injected.mjs'))
            check('metadata-lifecycle-' + hook, lambda value=changed: verify_files(value))
        for field, value in [('name', 'substituted'), ('version', '9.9.9'), ('private', False),
                             ('type', 'commonjs'), ('packageManager', 'npm@0.0.0'),
                             ('engines', {'node': '>=24'}), ('bin', {'memoryos-rest': 'src/server.mjs'})]:
            changed = mutated_json(files, 'package.json', lambda obj, field=field, value=value: obj.__setitem__(field, value))
            check('metadata-changed-' + field, lambda value=changed: verify_files(value))
        changed = mutated_json(files, 'package-lock.json', lambda value: value['packages'].__setitem__('node_modules/unexpected', {'version': '1.0.0'}))
        check('lock-injected-package', lambda: verify_files(changed))
        changed = mutated_json(files, 'runtime/runtime-closure-manifest.json', lambda value: value['files'][0].__setitem__('source', 'repositories/memoryos-mcp/substitution.js'))
        check('closure-substituted-source-authority', lambda: verify_files(changed))
        for label, suffix in [('source-checkout', b'\n// C:/Users/operator/cca-workspace/runtime.js\n'),
                              ('external-package', b'\nimport "unexpected-dependency";\n'),
                              ('comment-import', b'\nimport/*comment*/"unexpected-dependency";\n'),
                              ('compact-from-import', b'\nimport value from"unexpected-dependency";\n'),
                              ('missing-local-import', b'\nimport "./missing-module.mjs";\n'),
                              ('out-of-root-import', b'\nimport "../../outside.mjs";\n')]:
            changed = dict(files)
            changed['src/server.mjs'] += suffix
            check('source-' + label, lambda value=rebound(changed): verify_files(value))
        for field in ['directCount', 'transitiveCount', 'developmentCount']:
            changed = mutated_json(files, 'dependency-manifest.json', lambda value, field=field: value.__setitem__(field, 1))
            check('dependency-manifest-' + field, lambda value=changed: verify_files(value))
        changed = mutated_json(files, 'dependency-manifest.json', lambda value: value['runtime'].__setitem__('version', '24.0.0'))
        check('dependency-manifest-runtime-substitution', lambda: verify_files(changed))

        changed = mutated_json(files, 'dependency-manifest.json', lambda value: value.__setitem__('parentRevision', 'f' * 40))
        check('dependency-manifest-future-parent', lambda: verify_files(changed))
        for label, edit in [
            ('host-namespace', lambda value: value.__setitem__('documentNamespace', 'file:///C:/host/path')),
            ('wrong-namespace-binding', lambda value: value.__setitem__('documentNamespace', 'https://memoryos.invalid/spdx/' + 'f' * 40 + '/' + 'e' * 64 + '/0.1.0')),
            ('node-checksum', lambda value: next(p for p in value['packages'] if p['name'] == 'node')['checksums'][0].__setitem__('checksumValue', '0' * 64)),
            ('node-version', lambda value: next(p for p in value['packages'] if p['name'] == 'node').__setitem__('versionInfo', '0.0.0')),
            ('first-party-license', lambda value: next(p for p in value['packages'] if p['name'] == 'memoryos-rest').__setitem__('licenseConcluded', 'MIT')),
            ('dangling-package-id', lambda value: next(p for p in value['packages'] if p['name'] == 'memoryos-rest').__setitem__('SPDXID', 'SPDXRef-Dangling')),
            ('missing-relationships', lambda value: value.__setitem__('relationships', []))]:
            changed = mutated_json(files, 'sbom.spdx.json', edit)
            check('sbom-' + label, lambda value=changed: verify_files(value))
        changed = dict(files)
        sbom = json.loads(changed['sbom.spdx.json'])
        for row in sbom['files']:
            row['checksums'][0]['algorithm'] = 'SHA1'
        changed['sbom.spdx.json'] = canonical(sbom)
        manifest = json.loads(changed[MANIFEST])
        manifest['files'] = [dict(path=name, **identity(data)) for name, data in sorted(changed.items()) if name != MANIFEST]
        changed[MANIFEST] = canonical(manifest)
        check('sbom-wrong-file-checksum-algorithm', lambda: verify_files(changed))

        for field, value in [('kind', 'OtherManifest'), ('version', '9.0.0'), ('package', 'other'), ('packageVersion', '9.0.0'), ('unexpected', True)]:
            changed = dict(files)
            manifest = json.loads(changed[MANIFEST])
            manifest[field] = value
            changed[MANIFEST] = canonical(manifest)
            check('manifest-invalid-' + field, lambda value=changed: verify_files(value))
        for label, edit in [('duplicate', lambda rows: rows.append(copy.deepcopy(rows[0]))),
                            ('case-collision', lambda rows: rows.append(dict(rows[0], path=rows[0]['path'].upper()))),
                            ('unsorted', lambda rows: rows.reverse()),
                            ('bad-sha', lambda rows: rows[0].__setitem__('sha256', '0' * 64)),
                            ('bad-length', lambda rows: rows[0].__setitem__('byteLength', rows[0]['byteLength'] + 1))]:
            changed = dict(files)
            manifest = json.loads(changed[MANIFEST])
            edit(manifest['files'])
            changed[MANIFEST] = canonical(manifest)
            check('manifest-' + label, lambda value=changed: verify_files(value))

        raw = gzip.decompress(source)
        for label, data in [('truncated-gzip', source[:-10]), ('truncated-header', source[:7]),
                            ('crc', source[:-8] + bytes([source[-8] ^ 1]) + source[-7:]),
                            ('concatenated-gzip', source + source), ('trailing-garbage', source + b'X'),
                            ('not-gzip', b'not an archive'), ('gzip-filename', compressed(raw, filename='host-path.tgz')),
                            ('gzip-mtime', compressed(raw, mtime=1)), ('truncated-tar', compressed(raw[:513])),
                            ('tar-trailing-garbage', compressed(raw + b'X'))]:
            archive_check('archive-' + label, data)
        for label, path in [('traversal', 'package/../outside'), ('absolute', '/outside'),
                            ('drive-absolute', 'C:/outside'), ('wrong-prefix', 'other/file'),
                            ('backslash', 'package/a\\b'), ('ads', 'package/a:stream'),
                            ('device', 'package/CON.txt'), ('trailing-dot', 'package/a.'),
                            ('trailing-space', 'package/a '), ('dot', 'package/./a'),
                            ('empty-segment', 'package//a'), ('long-path', 'package/' + 'a' * 70 + '/' + 'b' * 70 + '/' + 'c' * 99)]:
            archive_check('archive-path-' + label, compressed(raw_archive(files, lambda entries, path=path: setattr(entries[0][0], 'name', path))))
        for label, kind in [('symlink', tarfile.SYMTYPE), ('hardlink', tarfile.LNKTYPE),
                            ('directory', tarfile.DIRTYPE), ('fifo', tarfile.FIFOTYPE),
                            ('device', tarfile.CHRTYPE), ('pax', tarfile.XHDTYPE),
                            ('global-pax', tarfile.XGLTYPE), ('gnu-longname', tarfile.GNUTYPE_LONGNAME)]:
            archive_check('archive-type-' + label, compressed(raw_archive(files, lambda entries, kind=kind: setattr(entries[0][0], 'type', kind))))
        for label, field, value in [('mode', 'mode', 0o777), ('uid', 'uid', 1), ('gid', 'gid', 1),
                                    ('mtime', 'mtime', 1), ('uname', 'uname', 'host'),
                                    ('gname', 'gname', 'host'), ('linkname', 'linkname', 'outside')]:
            archive_check('archive-header-' + label, compressed(raw_archive(files, lambda entries, field=field, value=value: setattr(entries[0][0], field, value))))
        archive_check('archive-duplicate', compressed(raw_archive(files, lambda entries: entries.insert(1, copy.deepcopy(entries[0])))))
        def collision(entries):
            member, data = copy.deepcopy(entries[0])
            member.name = 'package/' + member.name[8:].upper()
            entries.insert(1, (member, data))
        archive_check('archive-case-collision', compressed(raw_archive(files, collision)))
        archive_check('archive-unsorted', compressed(raw_archive(files, lambda entries: entries.reverse())))
        archive_check('archive-member-size', compressed(raw_archive(files, lambda entries: setattr(entries[0][0], 'size', MAX_MEMBER + 1))))
        def many(entries):
            for index in range(257):
                member = tarfile.TarInfo('package/excess-' + str(index).zfill(3))
                member.mode = 0o644
                entries.append((member, b''))
            entries.sort(key=lambda pair: pair[0].name)
        archive_check('archive-member-count', compressed(raw_archive(files, many)))
        oversized = io.BytesIO()
        with gzip.GzipFile(fileobj=oversized, mode='wb', filename='', mtime=0, compresslevel=9) as writer:
            chunk = bytes(64 * 1024)
            for _ in range(MAX_EXPANDED // len(chunk)):
                writer.write(chunk)
            writer.write(b'X')
        archive_check('archive-expanded-size', oversized.getvalue())
        with candidate.open('wb') as stream:
            stream.truncate(MAX_COMPRESSED + 1)
        with candidate.open('rb') as stream:
            oversized_sha = hashlib.file_digest(stream, 'sha256').hexdigest()
        check('archive-compressed-size', lambda: verify_archive(candidate, oversized_sha))

        if node is not None:
            node = node.resolve(strict=True)
            if identity(node.read_bytes())['sha256'] != NODE_SHA256:
                raise ValueError('UNTRUSTED_TEST_NODE')
            installed = temporary / 'installed'
            installed.mkdir()
            empty = temporary / 'empty'
            empty.mkdir()
            for name, data in files.items():
                target = installed / name
                target.parent.mkdir(parents=True, exist_ok=True)
                target.write_bytes(data)
            environment = {k: v for k, v in os.environ.items() if k.upper() in ['SYSTEMROOT', 'WINDIR', 'TEMP', 'TMP']}
            def runtime_verify():
                result = subprocess.run([str(node), str(installed / 'scripts/verify-distribution.mjs')], cwd=empty,
                                        env=environment, capture_output=True, timeout=30)
                if result.returncode:
                    raise ValueError('INSTALLED_VERIFIER_REFUSAL')
            check('runtime-installed-original-foreign-cwd', runtime_verify, False)
            for name in ['package.json', 'package-lock.json', 'contracts/api-contract.json', 'contracts/limits.json',
                         'contracts/openapi.json', 'runtime/authoritative/web/js/memoryos-sdk.js']:
                target = installed / name
                target.write_bytes(files[name] + b' ')
                try:
                    check('runtime-installed-changed-' + name, runtime_verify)
                finally:
                    target.write_bytes(files[name])
            target = installed / 'runtime/authoritative/web/js/memoryos-sdk.js'
            target.unlink()
            try:
                check('runtime-installed-missing-no-source-fallback', runtime_verify)
            finally:
                target.write_bytes(files['runtime/authoritative/web/js/memoryos-sdk.js'])
            target = installed / 'unexpected.mjs'
            target.write_bytes(b'UNEXPECTED')
            try:
                check('runtime-installed-extra-executable', runtime_verify)
            finally:
                target.unlink()
            target = installed / 'package.json'
            alias = temporary / 'hardlink-alias'
            os.link(target, alias)
            try:
                check('runtime-installed-hardlink', runtime_verify)
            finally:
                alias.unlink()
            if os.name == 'nt':
                junction = installed / 'unexpected-junction'
                result = subprocess.run([str(node), '--input-type=module', '-e',
                    'import {symlinkSync} from "node:fs";symlinkSync(process.argv[1],process.argv[2],"junction");',
                    str(installed / 'contracts'), str(junction)], cwd=empty, env=environment, capture_output=True, timeout=10)
                if result.returncode:
                    raise ValueError('JUNCTION_WITNESS_CREATION_FAILED')
                try:
                    check('runtime-installed-junction-reparse', runtime_verify)
                finally:
                    os.rmdir(junction)
            check('runtime-installed-restored', runtime_verify, False)
        # TemporaryDirectory removes only this known task-owned resolved directory.
        assert temporary.parent == Path(tempfile.gettempdir()).resolve()

    result = {'kind': 'MemoryOSRESTPhase2BPackageAdversarial', 'version': '1.0.0', 'state': 'PASS',
              'archive': identity(source), 'structuralAttacksUseCurrentDigest': True,
              'coherentManifestSubstitutions': True, 'runtimeVerifierExecuted': node is not None,
              'caseCount': len(records), 'cases': records}
    output.parent.mkdir(parents=True, exist_ok=True)
    output.write_bytes(canonical(result))
    print(json.dumps({'state': 'PASS', 'caseCount': len(records), 'output': str(output)}))
    return result


if __name__ == '__main__':
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument('--archive', type=Path, required=True)
    parser.add_argument('--output', type=Path, required=True)
    parser.add_argument('--node', type=Path)
    arguments = parser.parse_args()
    run(arguments.archive.resolve(strict=True), arguments.output.resolve(), arguments.node)