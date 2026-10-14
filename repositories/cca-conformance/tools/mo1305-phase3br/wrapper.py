"""Read-only Phase 3B-R context adapter for the unchanged correction validator.

The real branch and commit graph are checked before the historical validator is
called. Only its branch/HEAD queries receive the explicitly reported C3B view;
all content, evidence, archive, ancestor and identity checks remain unchanged.
Historical cache restoration is a separate opt-in preparation operation and is
never fresh assembly or certification evidence.
"""
from pathlib import Path
import argparse
import hashlib
import importlib.util
import json
import os
import subprocess
import sys

sys.dont_write_bytecode = True
HERE = Path(__file__).resolve().parent
ROOT = HERE.parents[3]
EXPECTED_ROOT = Path(r'C:\Users\melsa\Documents\Codex\cca-mo1305-3b-refresh')
BRANCH = 'mo1305/phase3b-refresh'
B2 = '2fcc588979675462d30c582f24f42fa9ec3ec729'
C3 = '62a70cafac68e89366740ec197074bd13fbce934'
C3B = '4ac43c4368f41ec14ea443aa303bf3a69503f2de'
CERT_SUBJECT = 'cert(memoryos-1.3): certify corrected MO-1305 release artifact'
TOOL_REL = 'repositories/cca-conformance/tools/mo1305-phase3-correction/'
HISTORY = 'repositories/cca-conformance/evidence/mo1305-phase3-correction/'
ACCEPTED = HISTORY + 'accepted/'
PKG_REL = 'repositories/memoryos-rest/'
ALLOWED = ('repositories/cca-conformance/tools/mo1305-phase3br/',
           'repositories/cca-conformance/evidence/mo1305-phase3br/')
ARCHIVE_NAME = 'memoryos-rest-0.1.0.tgz'
ARCHIVE = {'byteLength': 191823, 'sha256': 'faac95f7ad8939bcf7bbc33952efabebc1468d0c5654ea3eaac03f40402a7382'}
MANIFEST_ID = {'byteLength': 22489, 'sha256': 'dfd658d188212e96a74c9258683edad5c97217aaeeca75ee5030692ad00ccbf0'}
SCHEMA_ID = {'byteLength': 45312, 'sha256': '239208b7ac287b3cf5d9a9af23f9d69863971102a5e1587a27a398b43490b89b'}
OPENAPI_ID = {'byteLength': 114491, 'sha256': '36ed9f1dac58007881ebd8f666c930e7fb1ae767c2be2d5b6be28f5fb0cae03a'}
SBOM_ID = {'byteLength': 44094, 'sha256': 'ab0a60fc4273390fe353df5c8464571b581043c2ddc90587039afa1299ad3b7b'}


def require(ok, code):
    if not ok:
        raise ValueError(code)


def identity(data):
    return {'byteLength': len(data), 'sha256': hashlib.sha256(data).hexdigest()}


def canonical(value):
    return json.dumps(value, ensure_ascii=False, sort_keys=True, separators=(',', ':'), allow_nan=False).encode()


def git(*args):
    return subprocess.check_output(['git', '-c', 'safe.directory=' + ROOT.as_posix(), '-C', str(ROOT), *args],
                                   env={**os.environ, 'GIT_OPTIONAL_LOCKS': '0'})


def read(path):
    return json.loads((ROOT / path).read_bytes())


def text_git(*args):
    return git(*args).decode().strip()


def validate_context(baseline=C3B, c3=C3, c3b=C3B):
    """Validate actual Git state; accept only C3B or its sole certification child."""
    require(sys.flags.optimize == 0, 'PYTHON_OPTIMIZATION_FORBIDDEN')
    require(baseline == C3B, 'REFRESH_BASELINE')
    require(c3 == C3, 'REFRESH_C3')
    require(c3b == C3B, 'REFRESH_C3B')
    require(ROOT == EXPECTED_ROOT.resolve(), 'REFRESH_WORKSPACE')
    branch = text_git('branch', '--show-current')
    require(branch == BRANCH, 'REFRESH_BRANCH')
    require(not text_git('tag', '--list', 'memoryos-1.3-mo1305'), 'REFRESH_RELEASE_TAG')
    for revision, parent, subject, label in (
        (C3, B2, 'fix(memoryos-1.3): correct MO-1305 release metadata', 'C3'),
        (C3B, C3, 'conformance(memoryos-1.3): bind MO-1305 release metadata correction', 'C3B')):
        require(text_git('rev-parse', revision + '^{commit}') == revision, 'REFRESH_' + label + '_IDENTITY')
        require(text_git('show', '-s', '--format=%P', revision) == parent, 'REFRESH_' + label + '_PARENT')
        require(text_git('show', '-s', '--format=%s', revision) == subject, 'REFRESH_' + label + '_SUBJECT')
    require(text_git('diff', '--name-only', C3, C3B).splitlines() == [ACCEPTED + 'binding.json'], 'REFRESH_C3B_SCOPE')
    binding = read(ACCEPTED + 'binding.json')
    require(binding['implementation'] == C3 and binding['baseline'] == B2, 'REFRESH_BINDING')
    head = text_git('rev-parse', 'HEAD')
    if head != C3B:
        require(text_git('show', '-s', '--format=%P', head) == C3B, 'REFRESH_HEAD_PARENT')
        require(text_git('show', '-s', '--format=%s', head) == CERT_SUBJECT, 'REFRESH_HEAD_SUBJECT')
        committed = text_git('diff', '--name-only', C3B, head).splitlines()
        require(bool(committed) and all(p.startswith(ALLOWED) for p in committed), 'REFRESH_COMMIT_SCOPE')
        require(not git('status', '--porcelain', '--untracked-files=all').strip(), 'REFRESH_CERTIFICATION_DIRTY')
    changes = text_git('diff', '--name-only', C3B).splitlines()
    untracked = text_git('ls-files', '--others', '--exclude-standard').splitlines()
    require(all(p.startswith(ALLOWED) for p in changes + untracked), 'REFRESH_WORKTREE_SCOPE')
    # No existing baseline file may be rewritten, even under an allowed new prefix.
    existing = set(text_git('ls-tree', '-r', '--name-only', C3B).splitlines())
    require(not existing.intersection(changes), 'REFRESH_BASELINE_CONTENT')
    return {'state': 'PASS', 'workspace': str(ROOT), 'branch': branch, 'head': head,
            'baseline': C3B, 'C3': C3, 'C3B': C3B, 'correctionBaseline': B2,
            'role': 'BASELINE' if head == C3B else 'CERTIFICATION_CHILD', 'releaseTag': 'ABSENT'}


def historical():
    """Load only the committed, byte-identical historical implementation."""
    for name in ('check.py', 'distribution.py', 'spdx.py', 'schema_validation.py', 'schema-runtime.json', 'package-allowlist.json'):
        path = TOOL_REL + name
        require((ROOT / path).read_bytes() == git('show', C3B + ':' + path), 'HISTORICAL_TOOL_CHANGED:' + name)
    sys.path.insert(0, str(ROOT / TOOL_REL))
    spec = importlib.util.spec_from_file_location('_mo1305_historical_check', ROOT / TOOL_REL / 'check.py')
    module = importlib.util.module_from_spec(spec)
    spec.loader.exec_module(module)
    for name in ('distribution', 'spdx', 'schema_validation'):
        require(Path(sys.modules[name].__file__).resolve() == (ROOT / TOOL_REL / (name + '.py')).resolve(), 'HISTORICAL_IMPORT:' + name)
    return module


def check_validator_inventory(vendor=None):
    """Independently check every pinned file before importing the validator."""
    manifest_raw = (ROOT / TOOL_REL / 'schema-runtime.json').read_bytes()
    require(identity(manifest_raw) == MANIFEST_ID, 'REFRESH_VALIDATOR_MANIFEST')
    manifest = json.loads(manifest_raw)
    rows = manifest['files']
    expected = {r['path']: r for r in rows}
    require(len(rows) == len(expected) == 150, 'SPDX_VALIDATOR_INVENTORY')
    vendor = Path(vendor or os.environ.get('MO1305_SCHEMA_RUNTIME', ROOT / '.cache/mo1305-phase3-correction/schema-runtime'))
    require(vendor.is_dir() and not vendor.is_symlink() and not (getattr(vendor.lstat(), 'st_file_attributes', 0) & 0x400), 'SPDX_VALIDATOR_DIRECTORY')
    actual = {}
    for path in vendor.rglob('*'):
        if '__pycache__' in path.parts:
            continue
        require(not path.is_symlink() and not (getattr(path.lstat(), 'st_file_attributes', 0) & 0x400), 'SPDX_VALIDATOR_LINK')
        if path.is_file():
            actual[path.relative_to(vendor).as_posix()] = path
    require(set(actual) == set(expected), 'SPDX_VALIDATOR_INVENTORY')
    for name, path in actual.items():
        require(identity(path.read_bytes()) == {k: expected[name][k] for k in ('byteLength', 'sha256')}, 'SPDX_VALIDATOR_INTEGRITY:' + name)
    require(identity((ROOT / HISTORY / 'spdx-2.3-schema.json').read_bytes()) == SCHEMA_ID, 'SPDX_SCHEMA_IDENTITY')
    return {'state': 'PASS', 'path': str(vendor.resolve()), 'expectedFiles': 150, 'visibleFiles': len(actual),
            'readableFiles': len(actual), 'manifest': MANIFEST_ID, 'schema': SCHEMA_ID,
            'filesSha256': hashlib.sha256(canonical(rows)).hexdigest()}


def check_archive(path=None):
    candidate = read(ACCEPTED + 'candidate.json')
    require({k: candidate['archive'][k] for k in ARCHIVE} == ARCHIVE, 'REFRESH_CANDIDATE_ARCHIVE')
    path = Path(path) if path is not None else ROOT / candidate['archive']['path']
    require(path.name == ARCHIVE_NAME and identity(path.read_bytes()) == ARCHIVE, 'REFRESH_ARCHIVE_IDENTITY')
    check = historical()
    verified = check.verify_archive(path, ARCHIVE['sha256'])
    require(verified['fileCount'] == 58 and verified['runtimeFileCount'] == 25, 'REFRESH_PACKAGE_COUNTS')
    require(identity(verified['files']['contracts/openapi.json']) == OPENAPI_ID, 'REFRESH_OPENAPI_IDENTITY')
    require(identity(verified['files']['sbom.spdx.json']) == SBOM_ID, 'REFRESH_SBOM_IDENTITY')
    return verified


def prepare_historical_cache():
    """Restore missing exact historical bytes; never overwrite an existing file."""
    context = validate_context()
    check = historical()
    distribution = sys.modules['distribution']
    names = [PKG_REL + name for name in check.PATHS]
    current = {name[len(PKG_REL):]: data for name, data in check.blobs(C3B, names).items()}
    old = {name[len(PKG_REL):]: data for name, data in check.blobs(B2, names).items()}
    provisional = dict(current)
    provisional['sbom.spdx.json'] = (ROOT / HISTORY / 'history/provisional-sbom.spdx.json').read_bytes()
    dependency = json.loads(provisional['dependency-manifest.json'])
    dependency['sourceTreeSha256'] = read(HISTORY + 'source-tree.json')['sha256']
    provisional['dependency-manifest.json'] = canonical(dependency)
    manifest = json.loads(provisional['distribution-manifest.json'])
    manifest['files'] = [distribution.ref(n, b) for n, b in sorted(provisional.items()) if n != 'distribution-manifest.json']
    provisional['distribution-manifest.json'] = canonical(manifest)
    baseline = read(HISTORY + 'baseline.json')
    candidate = read(ACCEPTED + 'candidate.json')
    rows = [(dict(path='.cache/mo1305-phase2d/build/' + ARCHIVE_NAME, **baseline['old']['archive']), old),
            (candidate['archive'], current),
            *[(r, current) for r in read(ACCEPTED + 'reproducibility.json')['assemblies']],
            (read(HISTORY + 'final/dirty-tree-audit.json')['provisional']['archive'], provisional)]
    prepared = []
    for row, files in rows:
        data = distribution.serialize_archive(files)
        require(identity(data) == {k: row[k] for k in ARCHIVE}, 'HISTORICAL_CACHE_RECONSTRUCTION:' + row['path'])
        path = ROOT / row['path']
        require(path.resolve().is_relative_to((ROOT / '.cache').resolve()), 'HISTORICAL_CACHE_PATH')
        existed = path.exists()
        if existed:
            require(path.read_bytes() == data, 'HISTORICAL_CACHE_EXISTING_MISMATCH:' + row['path'])
        else:
            path.parent.mkdir(parents=True, exist_ok=True)
            with path.open('xb') as stream:
                stream.write(data)
        prepared.append({**row, 'action': 'verified-existing' if existed else 'restored-from-pinned-git-and-evidence'})
    return {'state': 'PASS', 'baseline': context['baseline'], 'purpose': 'Historical identity prerequisites only; not fresh reproducibility or installation evidence', 'files': prepared}


def correction_conformance():
    context = validate_context()
    check = historical()
    original_git = check.git
    adaptations = []
    mapping = {('branch', '--show-current'): None,
               ('rev-parse', 'HEAD'): ('rev-parse', C3B),
               ('log', '-1', '--format=%s'): ('log', '-1', '--format=%s', C3B),
               ('rev-parse', 'HEAD^'): ('rev-parse', C3B + '^')}

    def correction_git(*args, cwd=ROOT):
        require(Path(cwd).resolve() == ROOT, 'REFRESH_EXTERNAL_WORKTREE_FORBIDDEN')
        if args in mapping:
            translated = mapping[args]
            result = b'main\n' if translated is None else original_git(*translated, cwd=cwd)
            adaptations.append({'query': list(args), 'correctionView': 'main' if translated is None else list(translated), 'reason': 'Validated refresh context; historical correction evaluated at pinned C3B'})
            return result
        return original_git(*args, cwd=cwd)

    try:
        check.git = correction_git
        result = check.validate(require_binding=True, parallel=False)
    finally:
        check.git = original_git
    require(result['graph']['head'] == C3B and result['graph']['implementation'] == C3, 'REFRESH_CORRECTION_GRAPH')
    return {'state': 'PASS', 'realContext': context, 'historicalValidation': result,
            'adapter': {'historicalFilesModified': False, 'historicalCliExecutedLiterally': False,
                        'contentChecksUnchanged': True, 'adaptedQueries': adaptations}}


def validate():
    context = validate_context()
    inventory = check_validator_inventory()
    check = historical()
    sbom = read(PKG_REL + 'sbom.spdx.json')
    schema = check.verify_schema(sbom)
    fields = check.field_inventory(sbom)
    archive = check_archive()
    conformance = correction_conformance()
    return {'kind': 'MemoryOSRESTPhase3BRRefreshWrapper', 'version': '1.0.0', 'state': 'PASS',
            'context': context, 'validatorInventory': inventory, 'schema': schema,
            'generatedFields': fields, 'archive': archive['archive'], 'fileCount': archive['fileCount'],
            'runtimeFileCount': archive['runtimeFileCount'], 'correctionConformance': conformance}


if __name__ == '__main__':
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument('--prepare-cache', action='store_true', help='Restore only missing pinned historical archive bytes')
    parser.add_argument('--output', type=Path)
    args = parser.parse_args()
    result = prepare_historical_cache() if args.prepare_cache else validate()
    if args.output:
        args.output.write_bytes(canonical(result))
    print(json.dumps(result))
