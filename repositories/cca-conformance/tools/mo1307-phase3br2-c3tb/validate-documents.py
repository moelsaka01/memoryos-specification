"""Fresh Phase 3BR2 C3TB document validation; use retained Python -I -S -B.

Adapted from accepted 3B-R's verified wheel loader and complete SPDX validator.
All dependency caches and historical Git objects are read-only. The first
mandatory failure exits immediately and emits a diagnostic for the parent log.
No fixtures, production writes, dependency acquisition, or remote schema lookup.
"""
import hashlib
import importlib.machinery
import io
import json
import subprocess
import sys
import traceback
from datetime import datetime, timezone
from pathlib import Path
import zipfile

ROOT = Path(__file__).resolve().parents[4]
LOCK = ROOT / 'repositories/cca-conformance/fixtures/mo1306/engineering-validator-lock.json'
CACHE_ROOT = Path(r'C:\Users\melsa\Documents\Codex\cca-workspace\.cache\mo1306')
VALIDATORS = CACHE_ROOT / 'validators'
C3TB = '119e68bdcf0ffc906b4ca03a912aadcb25908346'
C3T = '65e24b2debdd70ecb8e52fbccbd6c101621f1917'
C3RB = 'defe93989efc6501b1a730b82e79e705884b269b'
ACCEPTED_3B = '702c1b6381f6112a50ac844831d195275dac3350'
STARTED = datetime.now(timezone.utc).isoformat()
ACTIVE_CHECK = 'initialize'


def failure_diagnostic(exc_type, exc_value, exc_traceback):
    print(json.dumps({
        'kind': 'MO1307Phase3BR2C3TBDocumentValidationFailure',
        'version': '1.0.0', 'phase': 'PHASE3BR2_C3TB', 'result': 'FAIL',
        'candidateBinding': C3TB, 'productionCandidate': C3T, 'startedUtc': STARTED,
        'failedUtc': datetime.now(timezone.utc).isoformat(),
        'check': ACTIVE_CHECK, 'errorType': exc_type.__name__,
        'message': str(exc_value), 'stopRule': 'FIRST_MANDATORY_FAILURE',
        'subsequentMandatoryChecksExecuted': False,
    }, sort_keys=True, indent=2), flush=True)
    traceback.print_exception(exc_type, exc_value, exc_traceback, file=sys.stderr)


sys.excepthook = failure_diagnostic


def require(condition, message):
    if not condition:
        raise RuntimeError(message)


def network_guard(event, args):
    if event.startswith('socket.') or event == 'urllib.Request':
        raise RuntimeError('Network use denied: ' + event)


sys.addaudithook(network_guard)


def git_head():
    return subprocess.check_output(['C:/Program Files/Git/cmd/git.exe', '-c', 'safe.directory=' + str(ROOT).replace(chr(92), '/'), '-C', str(ROOT), 'rev-parse', 'HEAD'], text=True).strip()


def git_bytes(commit, relative):
    return subprocess.check_output(['C:/Program Files/Git/cmd/git.exe', '-c', 'safe.directory=' + str(ROOT).replace(chr(92), '/'), '-C', str(ROOT), 'show', commit + ':' + relative])


def sha(data):
    return 'sha256:' + hashlib.sha256(data).hexdigest()


def data_identity(relative, data):
    return {'path': relative, 'byteLength': len(data), 'sha256': sha(data)}


def identity(path):
    data = path.read_bytes()
    try:
        display = path.relative_to(ROOT).as_posix()
    except ValueError:
        display = path.as_posix()
    return data_identity(display, data)


def candidate_identity(path):
    relative = path.relative_to(ROOT).as_posix()
    data = path.read_bytes()
    require(data == git_bytes(C3T, relative), 'C3T Git bytes differ: ' + relative)
    return data_identity(relative, data)


def binding_identity(path):
    relative = path.relative_to(ROOT).as_posix()
    data = path.read_bytes()
    require(data == git_bytes(C3TB, relative), 'C3TB Git bytes differ: ' + relative)
    return data_identity(relative, data)


def historical_identity(relative):
    return {**data_identity(relative, git_bytes(ACCEPTED_3B, relative)), 'commit': ACCEPTED_3B}


ACTIVE_CHECK = 'baseline-and-validator-runtime'
require(git_head() == C3TB, 'C3TB baseline differs; stop')
require(sys.flags.isolated and sys.flags.no_site and sys.dont_write_bytecode and not sys.flags.optimize,
        'Use pinned Python -I -S -B without optimization')
lock_identity = candidate_identity(LOCK)
require(lock_identity['sha256'] == 'sha256:bac0215dd7a6776b9e87451fa75b19fe0ca07adfe2fcf4eb65eb148c9478ebed', 'Pinned validator lock')
lock = json.loads(LOCK.read_text(encoding='utf-8'))
require(sys.version.split()[0] == lock['python'], 'Pinned engineering Python required')
python_identity = identity(Path(sys.executable))
require(python_identity['byteLength'] == 107312 and
        python_identity['sha256'] == 'sha256:4278cf2a296f31737cae77cafeeb3dc71683094cf3b8fd6f3f02c968687e771c',
        'Engineering Python differs from accepted exact executable')
require(len(lock['dependencies']) == 7, 'Seven pinned engineering validator wheels required')
wheel_records = []
verified = {}
for row in lock['dependencies']:
    ACTIVE_CHECK = 'validator-wheel:' + row['filename']
    wheel = CACHE_ROOT / 'wheels' / row['filename']
    data = wheel.read_bytes()
    require(len(data) == row['byteLength'] and sha(data) == row['sha256'], row['filename'])
    members = 0
    with zipfile.ZipFile(io.BytesIO(data)) as archive:
        for info in archive.infolist():
            if info.is_dir():
                continue
            name = info.filename
            require(not name.startswith('/') and '..' not in Path(name).parts and not Path(name).is_absolute(), name)
            if '.data/' in name:
                prefix, category, name = name.split('/', 2)
                require(category in ('purelib', 'platlib'), info.filename)
            installed = VALIDATORS / name
            expected = archive.read(info)
            require(installed.is_file() and installed.read_bytes() == expected, 'Installed wheel bytes differ: ' + name)
            require(name not in verified or verified[name] == sha(expected), 'Conflicting wheel member: ' + name)
            verified[name] = sha(expected)
            members += 1
    wheel_records.append({'name': row['name'], 'version': row['version'], **identity(wheel), 'installedMembersVerified': members})

ACTIVE_CHECK = 'validator-cache-members'
for installed in VALIDATORS.rglob('*'):
    if not installed.is_file() or '__pycache__' in installed.parts:
        continue
    name = installed.relative_to(VALIDATORS).as_posix()
    require(name in verified, 'Unpinned installed validator member: ' + name)

modules = ('attr', 'attrs', 'jsonschema', 'jsonschema_specifications', 'referencing', 'rpds', 'typing_extensions', 'yaml', '_yaml')
preimport_origins = []
for name in modules:
    ACTIVE_CHECK = 'validator-preimport:' + name
    require(name not in sys.modules, 'Third-party module loaded before verification: ' + name)
    spec = importlib.machinery.PathFinder.find_spec(name, [str(VALIDATORS)])
    require(spec is not None and spec.origin is not None, 'Missing pinned module: ' + name)
    path = Path(spec.origin).resolve()
    relative = path.relative_to(VALIDATORS.resolve()).as_posix()
    require(relative in verified and sha(path.read_bytes()) == verified[relative], 'Unpinned module origin: ' + name)
    preimport_origins.append({'module': name, 'path': path.as_posix(), 'sha256': verified[relative]})


class VerifiedSourceLoader(importlib.machinery.SourceFileLoader):
    """Compile verified wheel source directly; never trust cached pyc."""
    def get_code(self, fullname):
        path = Path(self.path).resolve()
        relative = path.relative_to(VALIDATORS.resolve()).as_posix()
        data = path.read_bytes()
        require(relative in verified and sha(data) == verified[relative], fullname)
        return self.source_to_code(data, str(path))


class VerifiedExtensionLoader(importlib.machinery.ExtensionFileLoader):
    def create_module(self, spec):
        path = Path(self.path).resolve()
        relative = path.relative_to(VALIDATORS.resolve()).as_posix()
        require(relative in verified and sha(path.read_bytes()) == verified[relative], spec.name)
        return super().create_module(spec)


def verified_path_hook(path):
    candidate = Path(path).resolve()
    if candidate != VALIDATORS.resolve() and VALIDATORS.resolve() not in candidate.parents:
        raise ImportError(path)
    return importlib.machinery.FileFinder(path,
        (VerifiedSourceLoader, importlib.machinery.SOURCE_SUFFIXES),
        (VerifiedExtensionLoader, importlib.machinery.EXTENSION_SUFFIXES))


ACTIVE_CHECK = 'verified-validator-import'
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
    ACTIVE_CHECK = 'validator-metadata:' + row['name']
    distribution = importlib.metadata.distribution(row['name'])
    require(distribution.version == row['version'], row['name'])
    metadata_path = Path(distribution._path) / 'METADATA'
    relative = metadata_path.relative_to(VALIDATORS).as_posix()
    require(relative in verified and sha(metadata_path.read_bytes()) == verified[relative], row['name'])

ACTIVE_CHECK = 'shipped-schema-set'
schema_dir = ROOT / 'repositories/memoryos-readiness/schemas'
documents = {}
schema_equality = []
for path in sorted(schema_dir.glob('*.json')):
    ACTIVE_CHECK = 'shipped-schema-identity:' + path.name
    current = candidate_identity(path)
    historical = historical_identity(current['path'])
    equal = all(current[k] == historical[k] for k in ('path', 'byteLength', 'sha256'))
    require(equal, 'Schema bytes differ from accepted 3B-R: ' + path.name)
    schema_equality.append({'current': current, 'historical': historical, 'byteEqual': equal})
    documents[path.name] = json.loads(path.read_text(encoding='utf-8'))
require(len(documents) == 52, 'Unexpected shipped schema count; stop')
historical_schemas = subprocess.check_output([
    'C:/Program Files/Git/cmd/git.exe', '-c', 'safe.directory=' + str(ROOT).replace(chr(92), '/'), '-C', str(ROOT), 'ls-tree', '-r', '--name-only', ACCEPTED_3B,
    'repositories/memoryos-readiness/schemas'], text=True).splitlines()
require(sorted(Path(name).name for name in historical_schemas) == sorted(documents), 'Historical schema set differs')


def retrieve(uri):
    name = uri.rsplit('/', 1)[-1]
    if name not in documents or not (uri.startswith('urn:memoryos:readiness:') or uri.startswith('https://memoryos.local/') or uri == name):
        raise NoSuchResource(ref=uri)
    return Resource.from_contents(documents[name])


registry = Registry(retrieve=retrieve)
for name, document in documents.items():
    ACTIVE_CHECK = 'schema-metaschema:' + name
    jsonschema.Draft202012Validator.check_schema(document)
    registry = registry.with_resource(name, Resource.from_contents(document))
    if '$id' in document:
        registry = registry.with_resource(document['$id'], Resource.from_contents(document))

package_documents = []
for relative, schema_name in (
    ('repositories/memoryos-readiness/contracts/contract.json', 'contract-manifest'),
    ('repositories/memoryos-readiness/distribution-manifest.json', 'distribution-manifest'),
):
    ACTIVE_CHECK = 'package-document:' + relative
    path = ROOT / relative
    current = candidate_identity(path)
    validator = jsonschema.Draft202012Validator(documents[schema_name + '-1.0.0.schema.json'], registry=registry)
    error = next(validator.iter_errors(json.loads(path.read_text(encoding='utf-8'))), None)
    if error is not None:
        raise RuntimeError(relative + ': ' + error.message + '; instance path=' + str(list(error.absolute_path)))
    package_documents.append({**current, 'schema': schema_name, 'result': 'PASS'})

ACTIVE_CHECK = 'pinned-spdx-schema'
spdx_path = ROOT / 'repositories/cca-conformance/evidence/mo1306/phase3d/spdx-2.3.schema.json'
spdx_identity = candidate_identity(spdx_path)
require(spdx_identity['byteLength'] == 45312 and spdx_identity['sha256'] == 'sha256:239208b7ac287b3cf5d9a9af23f9d69863971102a5e1587a27a398b43490b89b', 'Pinned SPDX schema')
spdx_schema = json.loads(spdx_path.read_text(encoding='utf-8'))
jsonschema.Draft7Validator.check_schema(spdx_schema)


def deny_remote(uri):
    raise NoSuchResource(ref=uri)


ACTIVE_CHECK = 'complete-spdx-sbom'
sbom_path = ROOT / 'repositories/memoryos-readiness/sbom.spdx.json'
sbom_identity = candidate_identity(sbom_path)
sbom = json.loads(sbom_path.read_text(encoding='utf-8'))
spdx_validator = jsonschema.Draft7Validator(spdx_schema, registry=Registry(retrieve=deny_remote), format_checker=jsonschema.FormatChecker())
error = next(spdx_validator.iter_errors(sbom), None)
if error is not None:
    raise RuntimeError('spdx-sbom: ' + error.message + '; instance path=' + str(list(error.absolute_path)))
old_sbom = json.loads(git_bytes(ACCEPTED_3B, sbom_identity['path']))
sbom_check = {**sbom_identity, 'schema': spdx_identity, 'dialect': 'DRAFT7', 'formatChecking': True,
              'packages': len(sbom.get('packages', [])), 'files': len(sbom.get('files', [])),
              'relationships': len(sbom.get('relationships', [])), 'result': 'PASS'}
sbom_check['historical'] = {**historical_identity(sbom_identity['path']),
                          'packages': len(old_sbom.get('packages', [])), 'files': len(old_sbom.get('files', [])),
                          'relationships': len(old_sbom.get('relationships', []))}
sbom_check['countsUnchanged'] = all(sbom_check[k] == sbom_check['historical'][k] for k in ('packages', 'files', 'relationships'))
require(sbom_check['countsUnchanged'], 'SPDX counts changed; stop')
require((sbom_check['packages'], sbom_check['files'], sbom_check['relationships']) == (1, 87, 88), 'Unexpected SPDX inventory counts')
sbom_check['completeDocumentValidated'] = True
sbom_check['scope'] = 'Full pinned SPDX 2.3 JSON schema; semantic package/file/checksum closure is separately verified in sbom.json and distribution.json.'

ACTIVE_CHECK = 'loaded-validator-identities'
loaded = []
for name, module in sorted(sys.modules.items()):
    path = getattr(module, '__file__', None)
    if path is None or name.split('.')[0] not in modules:
        continue
    path = Path(path).resolve()
    relative = path.relative_to(VALIDATORS.resolve()).as_posix()
    require(relative in verified and sha(path.read_bytes()) == verified[relative], 'Loaded module outside verified wheel: ' + name)
    loaded.append({'module': name, 'path': path.as_posix(), 'sha256': verified[relative]})

ACTIVE_CHECK = 'c3tb-candidate-binding'
binding_root = ROOT / 'repositories/cca-conformance/evidence/mo1307/prospective-helper-bound-candidate'
binding_path = binding_root / 'binding.json'
binding_record = binding_identity(binding_path)
binding = json.loads(binding_path.read_text(encoding='utf-8'))
require(binding['implementation']['commit'] == C3T, 'C3T implementation binding differs')
require(binding['implementation']['productionTree'] == '324bf600b6cbfaa8564db27fce2d999711270cb8', 'Production tree differs')
require(binding['binding']['soleParent'] == C3T and binding['bindingRole'] == 'C3TB', 'C3TB binding differs')
binding_verification_path = binding_root / 'binding-verification.json'
binding_verification_record = binding_identity(binding_verification_path)
binding_verification = json.loads(binding_verification_path.read_text(encoding='utf-8'))
require(binding_verification['result'] == 'PASS' and binding_verification['candidateCommit'] == C3T, 'Binding verification differs')
consistency_path = binding_root / 'consistency-validation.json'
consistency_record = candidate_identity(consistency_path)
consistency = json.loads(consistency_path.read_text(encoding='utf-8'))
require(consistency['result'] == 'PASS' and consistency['limits'] == {
    'aggregateHelperActiveMs': 20000, 'apiMs': 10000, 'cleanupMs': 2000,
    'cliAdmissionMs': 30000, 'helperMs': 8000, 'workerMs': 10000,
}, 'Consistency/deadline binding differs')
candidate_path = binding_root / 'candidate.json'
candidate_record = candidate_identity(candidate_path)
candidate = json.loads(candidate_path.read_text(encoding='utf-8'))
require(candidate['package']['packageIdentity'] == 'sha256:2869cc0745fc555d5338f35634e7738b49cb628f6693dd92c5868f36ec113729', 'Package identity differs')
require(candidate['distributionManifest']['sha256'] == 'sha256:91dc9624de1b89b5d83bdf795ccbc0f745b41d958fc8c1dd7abb997f0f88d73c', 'Manifest identity differs')
require(candidate['sbom']['sha256'] == 'sha256:1510fdb9c0366023b4e49b81ce20cceeb1527a1dfaa2f7b4ded52a9bff737fda', 'SBOM identity differs')

ACTIVE_CHECK = 'input-persistence'
schema_rows = [row['current'] for row in schema_equality]
for row in schema_rows + package_documents + [sbom_check, spdx_identity, lock_identity, binding_record, binding_verification_record, consistency_record, candidate_record]:
    now = identity(ROOT / row['path'])
    require(now['sha256'] == row['sha256'] and now['byteLength'] == row['byteLength'], 'Validation input mutated: ' + row['path'])
require(git_head() == C3TB, 'Baseline changed during validation; stop')

result = {
    'kind': 'MO1307Phase3BR2C3TBDocumentValidation', 'version': '1.0.0', 'phase': 'PHASE3BR2_C3TB',
    'startedUtc': STARTED, 'finishedUtc': datetime.now(timezone.utc).isoformat(),
    'candidateBinding': C3TB, 'productionCandidate': C3T, 'historicalAcceptedPhase3B': ACCEPTED_3B,
    'binding': binding_record, 'bindingVerification': binding_verification_record,
    'consistencyValidation': consistency_record, 'candidateRecord': candidate_record,
    'schemas': len(documents), 'schemaDefinitions': len(documents['shared-1.0.0.schema.json']['$defs']),
    'schemaMetaschema': 'DRAFT202012', 'schemaMetaschemaResult': 'PASS',
    'schemaEquality': schema_equality, 'schemaReuse': '52_OF_52_EXACT_BYTES_UNCHANGED_FROM_ACCEPTED_3B',
    'checkedFixtures': 0,
    'fixtureDisposition': 'NO_FIXTURE_REEXECUTION_OR_REUSE; generated definitions/constants changed and fixtures are outside the selected artifact refresh. Fresh package documents are fully validated here.',
    'validator': 'jsonschema@4.26.0', 'python': sys.version.split()[0], 'pythonExecutable': python_identity,
    'isolatedLaunch': {'isolated': bool(sys.flags.isolated), 'noSite': bool(sys.flags.no_site), 'noBytecodeWrites': bool(sys.dont_write_bytecode), 'cachedBytecodeUsed': False},
    'lock': lock_identity, 'tool': identity(Path(__file__).resolve()),
    'adaptedFrom': historical_identity('repositories/cca-conformance/tools/mo1307-phase3b-c3rb-cert/validate-documents.py'),
    'wheelChecks': wheel_records, 'installedMembersVerified': len(verified), 'preimportOrigins': preimport_origins,
    'loadedVerifiedModules': loaded, 'schemaFiles': schema_rows,
    'packageDocuments': package_documents, 'spdxSBOM': sbom_check,
    'network': False, 'networkGuard': 'Python audit hook rejects socket.* and urllib.Request events',
    'remoteSchemaRetrieval': 'DENIED',
    'cacheAccess': 'READ_ONLY; verified wheel members before import; bytecode writes disabled',
    'historicalAccess': 'READ_ONLY_EXACT_GIT_OBJECTS', 'stopRule': 'FIRST_MANDATORY_FAILURE',
    'productionChanges': False, 'failures': [], 'result': 'PASS',
}
print(json.dumps(result, sort_keys=True, indent=2))
