"""Offline pinned engineering validation; launch retained Python with -I -S -B."""
import hashlib
import importlib.machinery
import io
import json
import sys
import zipfile
from pathlib import Path

ROOT = Path(__file__).resolve().parents[4]
LOCK = ROOT / 'repositories/cca-conformance/fixtures/mo1306/engineering-validator-lock.json'
VALIDATORS = ROOT / '.cache/mo1306/validators'


def sha(data):
    return 'sha256:' + hashlib.sha256(data).hexdigest()


def identity(path):
    data = path.read_bytes()
    return {'path': path.relative_to(ROOT).as_posix(), 'byteLength': len(data), 'sha256': sha(data)}


lock = json.loads(LOCK.read_text(encoding='utf-8'))
assert sys.version.split()[0] == lock['python'], 'Pinned engineering Python required'
assert sys.flags.isolated and sys.flags.no_site and sys.dont_write_bytecode, 'Use Python -I -S -B'
wheel_records = []
verified = {}
for row in lock['dependencies']:
    wheel = ROOT / '.cache/mo1306/wheels' / row['filename']
    data = wheel.read_bytes()
    assert len(data) == row['byteLength'] and sha(data) == row['sha256'], row['filename']
    members = 0
    with zipfile.ZipFile(io.BytesIO(data)) as archive:
        for info in archive.infolist():
            if info.is_dir():
                continue
            name = info.filename
            assert not name.startswith('/') and '..' not in Path(name).parts, name
            if '.data/' in name:
                prefix, category, name = name.split('/', 2)
                assert category in ('purelib', 'platlib'), info.filename
            installed = VALIDATORS / name
            expected = archive.read(info)
            assert installed.is_file() and installed.read_bytes() == expected, 'Installed wheel bytes differ: ' + name
            assert name not in verified or verified[name] == sha(expected), 'Conflicting wheel member: ' + name
            verified[name] = sha(expected)
            members += 1
    wheel_records.append({'name': row['name'], 'version': row['version'], **identity(wheel), 'installedMembersVerified': members})

# The retained cache is extracted wheel content. Foreign source/data files are
# rejected. Cached pyc files are never used by the verified loader below.
for installed in VALIDATORS.rglob('*'):
    if not installed.is_file() or '__pycache__' in installed.parts:
        continue
    name = installed.relative_to(VALIDATORS).as_posix()
    assert name in verified, 'Unpinned installed validator member: ' + name

modules = ('attr', 'attrs', 'jsonschema', 'jsonschema_specifications', 'referencing', 'rpds', 'typing_extensions', 'yaml', '_yaml')
preimport_origins = []
for name in modules:
    assert name not in sys.modules, 'Third-party module loaded before verification: ' + name
    spec = importlib.machinery.PathFinder.find_spec(name, [str(VALIDATORS)])
    assert spec is not None and spec.origin is not None, 'Missing pinned module: ' + name
    path = Path(spec.origin).resolve()
    relative = path.relative_to(VALIDATORS.resolve()).as_posix()
    assert relative in verified and sha(path.read_bytes()) == verified[relative], 'Unpinned module origin: ' + name
    preimport_origins.append({'module': name, 'path': path.relative_to(ROOT).as_posix(), 'sha256': verified[relative]})


class VerifiedSourceLoader(importlib.machinery.SourceFileLoader):
    """Compile verified wheel source directly; never trust cached pyc."""
    def get_code(self, fullname):
        path = Path(self.path).resolve()
        relative = path.relative_to(VALIDATORS.resolve()).as_posix()
        data = path.read_bytes()
        assert relative in verified and sha(data) == verified[relative], fullname
        return self.source_to_code(data, str(path))


class VerifiedExtensionLoader(importlib.machinery.ExtensionFileLoader):
    def create_module(self, spec):
        path = Path(self.path).resolve()
        relative = path.relative_to(VALIDATORS.resolve()).as_posix()
        assert relative in verified and sha(path.read_bytes()) == verified[relative], spec.name
        return super().create_module(spec)


def verified_path_hook(path):
    candidate = Path(path).resolve()
    if candidate != VALIDATORS.resolve() and VALIDATORS.resolve() not in candidate.parents:
        raise ImportError(path)
    return importlib.machinery.FileFinder(path,
        (VerifiedSourceLoader, importlib.machinery.SOURCE_SUFFIXES),
        (VerifiedExtensionLoader, importlib.machinery.EXTENSION_SUFFIXES))


sys.path_hooks.insert(0, verified_path_hook)
for path in list(sys.path_importer_cache):
    resolved = Path(path).resolve()
    if resolved == VALIDATORS.resolve() or VALIDATORS.resolve() in resolved.parents:
        del sys.path_importer_cache[path]
sys.path.insert(0, str(VALIDATORS))
import importlib.metadata
import jsonschema
from referencing import Registry, Resource
from referencing.exceptions import NoSuchResource

for row in lock['dependencies']:
    distribution = importlib.metadata.distribution(row['name'])
    assert distribution.version == row['version'], row['name']
    metadata_path = Path(distribution._path) / 'METADATA'
    relative = metadata_path.relative_to(VALIDATORS).as_posix()
    assert relative in verified and sha(metadata_path.read_bytes()) == verified[relative], row['name']

schema_dir = ROOT / 'repositories/memoryos-readiness/schemas'
documents = {p.name: json.loads(p.read_text(encoding='utf-8')) for p in sorted(schema_dir.glob('*.json'))}


def retrieve(uri):
    # Explicit local shipped basenames only; there is no network retrieval path.
    name = uri.rsplit('/', 1)[-1]
    if name not in documents or not (uri.startswith('urn:memoryos:readiness:') or uri.startswith('https://memoryos.local/') or uri == name):
        raise NoSuchResource(ref=uri)
    return Resource.from_contents(documents[name])


registry = Registry(retrieve=retrieve)
for name, document in documents.items():
    jsonschema.Draft202012Validator.check_schema(document)
    registry = registry.with_resource(name, Resource.from_contents(document))
    if '$id' in document:
        registry = registry.with_resource(document['$id'], Resource.from_contents(document))
fixture_root = ROOT / 'repositories/cca-conformance/fixtures/mo1307'
catalog = json.loads((fixture_root / 'catalog.json').read_text(encoding='utf-8'))
positive = negative = 0
parser_skipped = []
failures = []
for row in catalog['entries']:
    if 'schema' not in row:
        continue
    if row.get('schemaValid') is None:
        assert row.get('layer') == 'PARSER', 'Unclassified null schema expectation: ' + row['id']
        parser_skipped.append(row['id'])
        continue
    document = documents[row['schema'] + '-1.0.0.schema.json']
    value = json.loads((fixture_root / row['path']).read_text(encoding='utf-8'))
    validator = jsonschema.Draft202012Validator(document, registry=registry)
    valid = validator.is_valid(value)
    if valid != row['schemaValid']:
        errors = list(validator.iter_errors(value))
        failures.append({'id': row['id'], 'expected': row['schemaValid'], 'actual': valid, 'diagnostics': [e.message[:200] for e in errors[:2]]})
    if row['schemaValid']:
        positive += 1
    else:
        negative += 1

package_documents = []
for relative, schema_name in (
    ('repositories/memoryos-readiness/contracts/contract.json', 'contract-manifest'),
    ('repositories/memoryos-readiness/distribution-manifest.json', 'distribution-manifest'),
):
    path = ROOT / relative
    document = documents[schema_name + '-1.0.0.schema.json']
    validator = jsonschema.Draft202012Validator(document, registry=registry)
    errors = list(validator.iter_errors(json.loads(path.read_text(encoding='utf-8'))))
    package_documents.append({**identity(path), 'schema': schema_name, 'result': 'FAIL' if errors else 'PASS'})
    if errors:
        failures.append({'id': relative, 'expected': True, 'actual': False, 'diagnostics': [e.message[:200] for e in errors[:2]]})

spdx_path = ROOT / 'repositories/cca-conformance/evidence/mo1306/phase3d/spdx-2.3.schema.json'
spdx_bytes = spdx_path.read_bytes()
assert len(spdx_bytes) == 45312 and sha(spdx_bytes) == 'sha256:239208b7ac287b3cf5d9a9af23f9d69863971102a5e1587a27a398b43490b89b', 'Pinned SPDX schema'
spdx_schema = json.loads(spdx_bytes)
jsonschema.Draft7Validator.check_schema(spdx_schema)


def deny_remote(uri):
    raise NoSuchResource(ref=uri)


sbom_path = ROOT / 'repositories/memoryos-readiness/sbom.spdx.json'
sbom = json.loads(sbom_path.read_text(encoding='utf-8'))
spdx_validator = jsonschema.Draft7Validator(spdx_schema, registry=Registry(retrieve=deny_remote), format_checker=jsonschema.FormatChecker())
spdx_errors = list(spdx_validator.iter_errors(sbom))
sbom_check = {**identity(sbom_path), 'schema': identity(spdx_path), 'dialect': 'DRAFT7', 'formatChecking': True,
              'packages': len(sbom.get('packages', [])), 'files': len(sbom.get('files', [])), 'relationships': len(sbom.get('relationships', [])),
              'result': 'FAIL' if spdx_errors else 'PASS'}
if spdx_errors:
    failures.append({'id': 'spdx-sbom', 'expected': True, 'actual': False, 'diagnostics': [e.message[:200] for e in spdx_errors[:2]]})

loaded = []
for name, module in sorted(sys.modules.items()):
    path = getattr(module, '__file__', None)
    if path is None or name.split('.')[0] not in modules:
        continue
    path = Path(path).resolve()
    relative = path.relative_to(VALIDATORS.resolve()).as_posix()
    assert relative in verified and sha(path.read_bytes()) == verified[relative], 'Loaded module outside verified wheel: ' + name
    loaded.append({'module': name, 'path': path.relative_to(ROOT).as_posix(), 'sha256': verified[relative]})

result = {
    'kind': 'MemoryOSReadinessPhase1SchemaCheck', 'version': '1.0.0', 'phase': 'FOUNDATION_ONLY',
    'schemas': len(documents), 'schemaDefinitions': len(documents['shared-1.0.0.schema.json']['$defs']),
    'positiveFixtures': positive, 'negativeFixtures': negative, 'checkedFixtures': positive + negative,
    'parserFixturesSkipped': parser_skipped, 'parserFixtureDisposition': 'STRICT_BYTE_PARSER_TESTED_SEPARATELY',
    'validator': 'jsonschema@4.26.0', 'python': sys.version.split()[0],
    'pythonExecutable': {'byteLength': Path(sys.executable).stat().st_size, 'sha256': sha(Path(sys.executable).read_bytes())},
    'isolatedLaunch': {'isolated': bool(sys.flags.isolated), 'noSite': bool(sys.flags.no_site), 'noBytecodeWrites': bool(sys.dont_write_bytecode), 'cachedBytecodeUsed': False},
    'lock': identity(LOCK), 'tool': identity(Path(__file__).resolve()), 'catalog': identity(fixture_root / 'catalog.json'),
    'wheelChecks': wheel_records, 'installedMembersVerified': len(verified), 'preimportOrigins': preimport_origins,
    'loadedVerifiedModules': loaded, 'schemaFiles': [identity(schema_dir / name) for name in sorted(documents)],
    'packageDocuments': package_documents, 'spdxSBOM': sbom_check,
    'network': False, 'remoteSchemaRetrieval': 'DENIED', 'failures': failures, 'result': 'PASS' if not failures else 'FAIL',
}
print(json.dumps(result, sort_keys=True, separators=(',', ':')))
sys.exit(0 if not failures else 1)
