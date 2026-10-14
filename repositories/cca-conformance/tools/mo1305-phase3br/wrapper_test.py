"""Focused refresh-context and identity rejection tests; no service campaign."""
from pathlib import Path
import argparse
import json
import shutil
import subprocess
import sys
import tempfile
import wrapper


def run():
    cases = []

    def accept(name, action):
        action()
        cases.append({'name': name, 'state': 'PASS'})

    def reject(name, action, code):
        try:
            action()
        except ValueError as error:
            wrapper.require(str(error).startswith(code), 'WRONG_REJECTION:' + name + ':' + str(error))
            cases.append({'name': name, 'state': 'PASS', 'rejectedBy': str(error)})
            return
        raise AssertionError('ACCEPTED_INVALID:' + name)

    def optimized_python_rejected():
        process = subprocess.run(
            [sys.executable, '-O', '-B', '-X', 'utf8', '-c',
             "import sys;sys.path.insert(0,'repositories/cca-conformance/tools/mo1305-phase3br');import wrapper;wrapper.validate_context()"],
            cwd=wrapper.ROOT, capture_output=True, text=True, timeout=30,
            creationflags=subprocess.CREATE_NO_WINDOW)
        wrapper.require(process.returncode != 0 and not process.stdout
                        and 'ValueError: PYTHON_OPTIMIZATION_FORBIDDEN' in process.stderr,
                        'OPTIMIZED_PYTHON_WAS_NOT_REJECTED')

    accept('optimized Python refuses assertion-dependent historical gates', optimized_python_rejected)
    accept('authorized refresh branch and real pinned C3/C3B graph', wrapper.validate_context)
    reject('wrong baseline', lambda: wrapper.validate_context(baseline='0' * 40), 'REFRESH_BASELINE')
    reject('wrong C3', lambda: wrapper.validate_context(c3='0' * 40), 'REFRESH_C3')
    reject('wrong C3B', lambda: wrapper.validate_context(c3b='0' * 40), 'REFRESH_C3B')
    actual_git = wrapper.git
    try:
        def wrong_branch(*args):
            return b'main\n' if args == ('branch', '--show-current') else actual_git(*args)
        wrapper.git = wrong_branch
        reject('main is not an authorized refresh branch', wrapper.validate_context, 'REFRESH_BRANCH')
    finally:
        wrapper.git = actual_git
    try:
        def wrong_head(*args):
            return (wrapper.C3 + '\n').encode() if args == ('rev-parse', 'HEAD') else actual_git(*args)
        wrapper.git = wrong_head
        reject('wrong actual baseline HEAD', wrapper.validate_context, 'REFRESH_HEAD_PARENT')
    finally:
        wrapper.git = actual_git
    certified_head = 'a' * 40
    certified_path = 'repositories/cca-conformance/evidence/mo1305-phase3br/receipt.json'

    def certified_context(status):
        def certified_git(*args):
            values = {
                ('rev-parse', 'HEAD'): (certified_head + '\n').encode(),
                ('show', '-s', '--format=%P', certified_head): (wrapper.C3B + '\n').encode(),
                ('show', '-s', '--format=%s', certified_head): (wrapper.CERT_SUBJECT + '\n').encode(),
                ('diff', '--name-only', wrapper.C3B, certified_head): (certified_path + '\n').encode(),
                ('status', '--porcelain', '--untracked-files=all'): status,
            }
            return values[args] if args in values else actual_git(*args)
        try:
            wrapper.git = certified_git
            return wrapper.validate_context()
        finally:
            wrapper.git = actual_git

    accept('authorized clean certification child', lambda: certified_context(b''))
    for label, prefix in [('working tree modification', ' M '), ('staged modification', 'M  '), ('untracked evidence', '?? ')]:
        reject('certification child rejects ' + label,
               lambda prefix=prefix: certified_context((prefix + certified_path + '\n').encode()),
               'REFRESH_CERTIFICATION_DIRTY')
    accept('all 150 pinned validator files', wrapper.check_validator_inventory)
    candidate = wrapper.read(wrapper.ACCEPTED + 'candidate.json')
    archive = wrapper.ROOT / candidate['archive']['path']
    cache = wrapper.ROOT / '.cache/mo1305-phase3br/wrapper-tests'
    cache.mkdir(parents=True, exist_ok=True)
    with tempfile.TemporaryDirectory(prefix='negative-', dir=cache) as directory:
        temp = Path(directory)
        wrapper.require(temp.resolve().is_relative_to(cache.resolve()), 'TEST_CACHE_PATH')
        changed_archive = temp / wrapper.ARCHIVE_NAME
        data = bytearray(archive.read_bytes())
        data[-1] ^= 1
        changed_archive.write_bytes(data)
        reject('wrong archive bytes', lambda: wrapper.check_archive(changed_archive), 'REFRESH_ARCHIVE_IDENTITY')
        vendor = Path(wrapper.check_validator_inventory()['path'])
        copied = temp / 'validator'
        copied.mkdir()
        rows = wrapper.read(wrapper.TOOL_REL + 'schema-runtime.json')['files']
        for row in rows:
            source = vendor / row['path']
            destination = copied / row['path']
            destination.parent.mkdir(parents=True, exist_ok=True)
            shutil.copyfile(source, destination)
        accept('independent pinned validator fixture', lambda: wrapper.check_validator_inventory(copied))
        selected = copied / rows[0]['path']
        original = selected.read_bytes()
        selected.unlink()
        reject('validator inventory missing file', lambda: wrapper.check_validator_inventory(copied), 'SPDX_VALIDATOR_INVENTORY')
        selected.write_bytes(original)
        extra = copied / 'unexpected-file.txt'
        extra.write_bytes(b'extra')
        reject('validator inventory extra file', lambda: wrapper.check_validator_inventory(copied), 'SPDX_VALIDATOR_INVENTORY')
        extra.unlink()
        selected.write_bytes(original + b'\n')
        reject('validator inventory modified file', lambda: wrapper.check_validator_inventory(copied), 'SPDX_VALIDATOR_INTEGRITY:')
    accept('unchanged historical correction semantics through explicit context adapter', wrapper.correction_conformance)
    return {'kind': 'MemoryOSRESTPhase3BRRefreshWrapperTests', 'version': '1.0.0', 'state': 'PASS',
            'baseline': wrapper.C3B, 'caseCount': len(cases), 'cases': cases}


if __name__ == '__main__':
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument('--output', type=Path)
    args = parser.parse_args()
    result = run()
    if args.output:
        args.output.write_bytes(wrapper.canonical(result))
    print(json.dumps(result))
