"""Offline staging only. Never finalizes the shared source distribution manifests."""
import hashlib, json, shutil, sys, zipfile
from pathlib import Path

ROOT = Path(__file__).resolve().parents[4]
PKG = ROOT / 'repositories/memoryos-ci'
CACHE = ROOT / '.cache/mo1306/phase2b'
EVIDENCE = ROOT / 'repositories/cca-conformance/evidence/mo1306/phase2b'
PYTHON = Path(sys.executable)
def sha(data): return 'sha256:' + hashlib.sha256(data).hexdigest()
def j(value): return (json.dumps(value, sort_keys=True, separators=(',', ':'), ensure_ascii=False) + '\n').encode()
def row(path, data): return dict(path=path, byteLength=len(data), sha256=sha(data))
def prepare():
    CACHE.mkdir(parents=True, exist_ok=True)
    EVIDENCE.mkdir(parents=True, exist_ok=True)
    lock_path = ROOT / 'repositories/cca-conformance/fixtures/mo1306/engineering-validator-lock.json'
    lock = json.loads(lock_path.read_bytes())
    validators = ROOT / '.cache/mo1306/validators'
    wheels = ROOT / '.cache/mo1306/wheels'
    for dep in lock['dependencies']:
        data = (wheels / dep['filename']).read_bytes()
        assert len(data) == dep['byteLength'] and sha(data) == dep['sha256'], dep['name']
        with zipfile.ZipFile(wheels / dep['filename']) as archive:
            for name in archive.namelist():
                if not name.endswith('/'):
                    assert (validators / name).read_bytes() == archive.read(name), name
    sys.path.insert(0, str(validators))
    import yaml
    from importlib.metadata import version
    assert yaml.__version__ == '6.0.3' and version('jsonschema') == '4.26.0'
    node_source = ROOT.parent / 'cca-workspace/.cache/mo1305-phase3br/toolchain/node-v24.21.0-win-x64/node.exe'
    data = node_source.read_bytes()
    assert len(data) == 93580104 and sha(data) == 'sha256:ba4e6d110e8c1592a1ecd390f6b05f3da124b13871a5be62b341a07a853c6c32'
    node = CACHE / 'node.exe'
    if not node.exists(): shutil.copyfile(node_source, node)
    assert node.read_bytes() == data
    # A unique disposable engineering install; source manifests stay at B1 for 2D.
    import tempfile
    stage = Path(tempfile.mkdtemp(prefix='install-', dir=CACHE))
    manifest = json.loads((PKG / 'distribution-manifest.json').read_bytes())
    additions = ['src/providers/render.mjs', 'scripts/verify-launch-result.mjs',
                 'templates/gitlab.yml.tpl', 'templates/jenkins.groovy.tpl']
    paths = sorted(set([r['path'] for r in manifest['files']] + additions))
    for name in paths:
        target = stage / name
        target.parent.mkdir(parents=True, exist_ok=True)
        shutil.copyfile(PKG / name, target)
    contract = json.loads((stage / 'contracts/contract.json').read_bytes())
    contract['files'] = [row(name,(stage/name).read_bytes()) for name in paths
                         if name.startswith(('schemas/', 'templates/', 'contracts/'))
                         and name != 'contracts/contract.json']
    (stage / 'contracts/contract.json').write_bytes(j(contract))
    manifest['files'] = [row(name,(stage/name).read_bytes()) for name in paths]
    (stage / 'distribution-manifest.json').write_bytes(j(manifest))
    source_rows = [row(name,(PKG/name).read_bytes()) for name in paths]
    evidence = dict(kind='MemoryOSPhase2BEngineeringStage',version='1.0.0',
                    sourceFiles=source_rows, stagedFiles=manifest['files'],
                    distributionDigest=sha(j(manifest)), contractDigest=sha(j(contract)),
                    validatorLock=row(str(lock_path.relative_to(ROOT)).replace('\\','/'),lock_path.read_bytes()),
                    python=sys.version, node=row('node.exe',data),
                    limitation='Engineering install only. Shared source contract/distribution/package/SBOM manifests remain B1; Phase 2D reconciles release distribution.',
                    stage=str(stage), nodePath=str(node), cache=str(CACHE))
    (EVIDENCE/'stage.json').write_bytes(j(evidence))
    (CACHE/'active-stage.json').write_bytes(j(evidence))
    print(json.dumps(dict(stage=str(stage),node=str(node),validators=7,sourceFiles=len(paths))))
    return evidence
if __name__ == '__main__': prepare()
