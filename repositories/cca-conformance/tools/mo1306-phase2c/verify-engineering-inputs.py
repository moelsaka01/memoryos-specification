"""Offline wheel/extraction/import verification; --record is pre-commit only."""
import argparse
import hashlib
import importlib
import importlib.metadata
import importlib.util
import json
import marshal
import os
from pathlib import Path, PurePosixPath
import subprocess
import sys
import zipfile

sys.dont_write_bytecode = True
ROOT = Path(__file__).resolve().parents[4]
CACHE = ROOT / '.cache/mo1306-phase2c'
INSTALLED = CACHE / 'validators'
LOCK_PATH = 'repositories/cca-conformance/fixtures/mo1306/engineering-validator-lock.json'
OUT = ROOT / 'repositories/cca-conformance/evidence/mo1306/phase2c/engineering-inputs.json'
B1 = 'dbafc0061aa493da2517ee5564f9ea6adb90f52d'
ORIGINAL = 'e1c990bf65d0c7925a68eea8222cd304f8ce6db6'
MODULES = {'attrs':'attrs', 'jsonschema':'jsonschema', 'jsonschema-specifications':'jsonschema_specifications',
           'PyYAML':'yaml', 'referencing':'referencing', 'rpds-py':'rpds', 'typing-extensions':'typing_extensions'}


def sha(data):
    return 'sha256:' + hashlib.sha256(data).hexdigest()


def git(*args):
    return subprocess.check_output(['git', *args], cwd=ROOT, creationflags=subprocess.CREATE_NO_WINDOW)


def regular(path):
    assert path.resolve().is_relative_to(INSTALLED.resolve()), 'installed member escapes validator root'
    stat = path.lstat()
    assert path.is_file() and not path.is_symlink() and not (stat.st_file_attributes & 1024), 'nonregular installed member'
    return path.read_bytes()


def main():
    parser = argparse.ArgumentParser()
    parser.add_argument('--record', action='store_true')
    args = parser.parse_args()
    assert os.name == 'nt' and sys.version_info[:3] == (3,12,14), 'Python 3.12.14 Windows required'
    if args.record:
        assert git('rev-parse','HEAD').decode().strip() == ORIGINAL, 'omit --record after completion commit'
    locked = (ROOT/LOCK_PATH).read_bytes()
    assert locked == git('show', B1+':'+LOCK_PATH), 'engineering lock differs from immutable B1'
    lock = json.loads(locked)
    assert lock['python'] == '3.12.14' and len(lock['dependencies']) == 7
    expected_files = {}
    dependencies = []
    for item in lock['dependencies']:
        wheel_path = CACHE/'wheels'/item['filename']
        raw = wheel_path.read_bytes()
        assert len(raw) == item['byteLength'] and sha(raw) == item['sha256'], 'wheel identity: '+item['name']
        members = []
        with zipfile.ZipFile(wheel_path) as archive:
            for entry in archive.infolist():
                name = entry.filename
                path = PurePosixPath(name)
                assert not path.is_absolute() and '..' not in path.parts and '\\' not in name and ':' not in name
                if entry.is_dir(): continue
                assert name.casefold() not in expected_files and entry.file_size <= 8*1024*1024, 'duplicate/oversized wheel member'
                data = archive.read(entry)
                assert regular(INSTALLED/Path(*path.parts)) == data, 'installed bytes differ: '+name
                identity = {'path': name, 'byteLength': len(data), 'sha256': sha(data)}
                expected_files[name.casefold()] = identity
                members.append(identity)
        dependencies.append({'name': item['name'], 'version': item['version'], 'filename': item['filename'],
                             'byteLength': len(raw), 'sha256': sha(raw), 'memberCount': len(members),
                             'membersSha256': sha((json.dumps(members, sort_keys=True, separators=(',',':'))+'\n').encode()),
                             'status': 'PASS'})
    # Existing caches are derived, not wheel members. Verify their executable
    # code against freshly compiled, already verified source before any import.
    bytecode_count = 0
    for path in INSTALLED.rglob('*'):
        assert not path.is_symlink() and not (path.lstat().st_file_attributes & 1024), 'validator reparse entry'
        if not path.is_file(): continue
        name = path.relative_to(INSTALLED).as_posix()
        if name.casefold() in expected_files: continue
        assert path.suffix == '.pyc' and path.parent.name == '__pycache__', 'unexpected installed file: '+name
        data = regular(path)
        assert data[:4] == importlib.util.MAGIC_NUMBER and len(data) <= 8*1024*1024, 'bytecode identity'
        code = marshal.loads(data[16:])
        source = Path(importlib.util.source_from_cache(str(path)))
        assert source.relative_to(INSTALLED).as_posix().casefold() in expected_files, 'cache lacks verified source'
        assert Path(code.co_filename).resolve() == source.resolve(), 'cache source path mismatch'
        assert code == compile(regular(source), code.co_filename, 'exec'), 'cache executable code differs from source'
        bytecode_count += 1
    sys.path.insert(0, str(INSTALLED))
    for item in dependencies:
        distribution = importlib.metadata.distribution(item['name'])
        assert distribution.version == item['version'], 'installed version mismatch'
        assert Path(distribution.locate_file('')).resolve() == INSTALLED.resolve(), 'metadata origin mismatch'
        module = importlib.import_module(MODULES[item['name']])
        origin = Path(module.__file__).resolve()
        assert origin.is_relative_to(INSTALLED.resolve()), 'module origin outside verified environment'
        relative = origin.relative_to(INSTALLED).as_posix()
        assert relative.casefold() in expected_files and sha(regular(origin)) == expected_files[relative.casefold()]['sha256']
        item.update({'installedVersion': distribution.version, 'importModule': module.__name__,
                     'importOrigin': origin.relative_to(ROOT).as_posix(), 'importSha256': sha(regular(origin))})
    report = {'kind':'MemoryOSPhase2CEngineeringInputs', 'version':'1.0.0', 'status':'PASS', 'offline':True,
              'baseline':B1, 'pythonVersion':'.'.join(map(str,sys.version_info[:3])),
              'lock':{'path':LOCK_PATH,'byteLength':len(locked),'sha256':sha(locked),'matchesB1':True},
              'validatorRoot':INSTALLED.relative_to(ROOT).as_posix(), 'dependencyCount':len(dependencies),
              'installedMemberCount':len(expected_files), 'verifiedBytecodeCaches':bytecode_count,
              'dependencies':dependencies, 'source':{'path':Path(__file__).relative_to(ROOT).as_posix(),'sha256':sha(Path(__file__).read_bytes())}}
    if args.record:
        OUT.parent.mkdir(parents=True,exist_ok=True)
        OUT.write_text(json.dumps(report,sort_keys=True,separators=(',',':'))+'\n',encoding='utf-8',newline='\n')
    print(json.dumps({'status':'PASS','dependencyCount':len(dependencies),'installedMemberCount':len(expected_files),'verifiedBytecodeCaches':bytecode_count,'recorded':args.record},sort_keys=True))


if __name__ == '__main__':
    main()
