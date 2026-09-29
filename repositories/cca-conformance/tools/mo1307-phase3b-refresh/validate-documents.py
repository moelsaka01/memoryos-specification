"""Bounded Phase 3B-R document validation; launch retained Python with -I -S -B.

Adapted from the verified Phase 1 wheel loader. Retained caches are read-only;
no fixtures, production writes, dependency acquisition, or remote schema lookup.
"""
import hashlib
import importlib.machinery
import io
import json
import sys
import subprocess
from datetime import datetime, timezone
import zipfile
from pathlib import Path

ROOT = Path(__file__).resolve().parents[4]
LOCK = ROOT / 'repositories/cca-conformance/fixtures/mo1306/engineering-validator-lock.json'
CACHE_ROOT = Path(r'C:\Users\melsa\Documents\Codex\cca-workspace\.cache\mo1306')
VALIDATORS = CACHE_ROOT / 'validators'
OLD_ROOT = Path(r'C:\Users\melsa\Documents\Codex\cca-mo1307-3b')
C3RB = 'defe93989efc6501b1a730b82e79e705884b269b'
OLD_3B = '85dea823385e1ccaddcd9997c3918b1312175eba'
STARTED = datetime.now(timezone.utc).isoformat()

def network_guard(event, args):
    if event.startswith('socket.') or event == 'urllib.Request':
        raise RuntimeError('Network use denied: ' + event)

sys.addaudithook(network_guard)

def git_head(root):
    return subprocess.check_output(['git', '-C', str(root), 'rev-parse', 'HEAD'], text=True).strip()

assert git_head(ROOT) == C3RB, 'C3RB baseline differs; stop'
assert git_head(OLD_ROOT) == OLD_3B, 'Historical Phase 3B differs; stop'


def sha(data):
    return 'sha256:' + hashlib.sha256(data).hexdigest()


def identity(path):
    data = path.read_bytes()
    try:
        display = path.relative_to(ROOT).as_posix()
    except ValueError:
        display = path.as_posix()
    return {'path': display, 'byteLength': len(data), 'sha256': sha(data)}


assert sha(LOCK.read_bytes()) == 'sha256:bac0215dd7a6776b9e87451fa75b19fe0ca07adfe2fcf4eb65eb148c9478ebed', 'Pinned validator lock'
lock = json.loads(LOCK.read_text(encoding='utf-8'))
assert sys.version.split()[0] == lock['python'], 'Pinned engineering Python required'
assert sys.flags.isolated and sys.flags.no_site and sys.dont_write_bytecode, 'Use Python -I -S -B'
wheel_records = []
verified = {}
for row in lock['dependencies']:
    wheel = CACHE_ROOT / 'wheels' / row['filename']
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
    preimport_origins.append({'module': name, 'path': path.as_posix(), 'sha256': verified[relative]})


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
# Bound schema sanity only. The unchanged fixture campaign is reused by the
# parent certification after its complete dependency-byte check.
failures = []
assert len(documents) == 52, 'Unexpected shipped schema count; stop'
old_schema_dir = OLD_ROOT / 'repositories/memoryos-readiness/schemas'
assert sorted(p.name for p in old_schema_dir.glob('*.json')) == sorted(documents), 'Schema set changed; stop'
schema_equality = []
for name in sorted(documents):
    current = schema_dir / name
    old = old_schema_dir / name
    equal = current.read_bytes() == old.read_bytes()
    schema_equality.append({'current': identity(current), 'historical': identity(old), 'byteEqual': equal})
    assert equal, 'Schema bytes unexpectedly changed: ' + name

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
old_sbom_path = OLD_ROOT / 'repositories/memoryos-readiness/sbom.spdx.json'
old_sbom = json.loads(old_sbom_path.read_text(encoding='utf-8'))
sbom_check = {**identity(sbom_path), 'schema': identity(spdx_path), 'dialect': 'DRAFT7', 'formatChecking': True,
              'packages': len(sbom.get('packages', [])), 'files': len(sbom.get('files', [])), 'relationships': len(sbom.get('relationships', [])),
              'result': 'FAIL' if spdx_errors else 'PASS'}
if spdx_errors:
    failures.append({'id': 'spdx-sbom', 'expected': True, 'actual': False, 'diagnostics': [e.message[:200] for e in spdx_errors[:2]]})
sbom_check['historical'] = {**identity(old_sbom_path), 'packages': len(old_sbom.get('packages', [])), 'files': len(old_sbom.get('files', [])), 'relationships': len(old_sbom.get('relationships', []))}
sbom_check['countsUnchanged'] = all(sbom_check[k] == sbom_check['historical'][k] for k in ('packages', 'files', 'relationships'))
assert sbom_check['countsUnchanged'], 'SPDX counts changed; stop'
sbom_check['completeDocumentValidated'] = True
sbom_check['scope'] = 'Full pinned SPDX 2.3 JSON schema; semantic package/file/checksum closure is separately verified in sbom.json and distribution.json.'

loaded = []
for name, module in sorted(sys.modules.items()):
    path = getattr(module, '__file__', None)
    if path is None or name.split('.')[0] not in modules:
        continue
    path = Path(path).resolve()
    relative = path.relative_to(VALIDATORS.resolve()).as_posix()
    assert relative in verified and sha(path.read_bytes()) == verified[relative], 'Loaded module outside verified wheel: ' + name
    loaded.append({'module': name, 'path': path.as_posix(), 'sha256': verified[relative]})

binding_path = ROOT / 'repositories/cca-conformance/evidence/mo1307/phase3a-readset-correction/binding.json'
binding = json.loads(binding_path.read_text(encoding='utf-8'))
assert binding['implementation']['commit'] == '58c98b7eb0aa2d07bab78753ce66b564066aafeb'
correction_members = {row['path']: row for row in binding['members']}
for path in (sbom_path, ROOT / 'repositories/memoryos-readiness/distribution-manifest.json'):
    row = identity(path)
    assert row == correction_members[row['path']], 'Exact correction artifact differs: ' + row['path']

# Record the schema source identities and prove no input changed during this run.
schema_rows = [row['current'] for row in schema_equality]
for row in schema_rows + package_documents + [sbom_check]:
    now = identity(ROOT / row['path'])
    assert now['sha256'] == row['sha256'] and now['byteLength'] == row['byteLength'], 'Validation input mutated'
assert git_head(ROOT) == C3RB and git_head(OLD_ROOT) == OLD_3B, 'Baseline changed during validation; stop'

result = {
    'kind': 'MO1307Phase3BRefreshDocumentValidation', 'version': '1.0.0', 'phase': 'PHASE3B_R',
    'startedUtc': STARTED, 'finishedUtc': datetime.now(timezone.utc).isoformat(),
    'c3rb': C3RB, 'original3B': OLD_3B, 'correctionBinding': identity(binding_path),
    'schemas': len(documents), 'schemaDefinitions': len(documents['shared-1.0.0.schema.json']['$defs']),
    'schemaMetaschema': 'DRAFT202012', 'schemaMetaschemaResult': 'PASS',
    'schemaEquality': schema_equality, 'schemaReuse': '52_OF_52_EXACT_BYTES_UNCHANGED',
    'checkedFixtures': 0, 'fixtureDisposition': 'NO_FIXTURE_REEXECUTION; original 464-positive/12-negative validation requires separate exact dependency binding in reuse-matrix.json.',
    'validator': 'jsonschema@4.26.0', 'python': sys.version.split()[0],
    'pythonExecutable': identity(Path(sys.executable)),
    'isolatedLaunch': {'isolated': bool(sys.flags.isolated), 'noSite': bool(sys.flags.no_site), 'noBytecodeWrites': bool(sys.dont_write_bytecode), 'cachedBytecodeUsed': False},
    'lock': identity(LOCK), 'tool': identity(Path(__file__).resolve()), 'adaptedFrom': identity(ROOT / 'repositories/cca-conformance/tools/mo1307-phase1/validate-schemas.py'),
    'wheelChecks': wheel_records, 'installedMembersVerified': len(verified), 'preimportOrigins': preimport_origins,
    'loadedVerifiedModules': loaded, 'schemaFiles': schema_rows,
    'packageDocuments': package_documents, 'spdxSBOM': sbom_check,
    'network': False, 'networkGuard': 'Python audit hook rejects socket.* and urllib.Request events',
    'remoteSchemaRetrieval': 'DENIED', 'cacheAccess': 'READ_ONLY; verified wheel members before import; bytecode writes disabled',
    'productionChanges': False, 'failures': failures, 'result': 'PASS' if not failures else 'FAIL',
}
print(json.dumps(result, sort_keys=True, indent=2))
sys.exit(0 if not failures else 1)
