"""Zero-product synthetic validation of the MO-1307 H2 fixture-isolation correction.

Reads the product's identity tuple components with the same Win32 call the
fixed helper uses (GetFileInformationByHandle). Synthetic writes happen only in
a fresh operating-system temporary sandbox that is removed afterwards. The real
sealed fixture chain is opened read-only for attributes. No product, helper,
worker, CLI, API, or native observer is started. Output is one JSON document.
"""
import ctypes as C
import hashlib
import json
import shutil
import sys
import tempfile
from ctypes import wintypes as W
from pathlib import Path

ROOT = Path(__file__).resolve().parents[4]
AGGREGATE = ROOT / 'repositories/cca-conformance/fixtures/mo1307/phase3ar2-final-h2-corrected'
INPUT = ROOT / 'repositories/cca-conformance/fixtures/mo1307/phase3ar2-final-h2-corrected-input'
K = C.WinDLL('kernel32', use_last_error=True)
K.CreateFileW.restype = W.HANDLE
K.CreateFileW.argtypes = [W.LPCWSTR, W.DWORD, W.DWORD, C.c_void_p, W.DWORD, W.DWORD, W.HANDLE]
K.GetFileInformationByHandle.argtypes = [W.HANDLE, C.c_void_p]
K.CloseHandle.argtypes = [W.HANDLE]
INVALID = W.HANDLE(-1).value
FILE_SHARE_ALL = 0x1 | 0x2 | 0x4
OPEN_EXISTING = 3
FILE_FLAG_BACKUP_SEMANTICS = 0x02000000
FILE_READ_ATTRIBUTES = 0x80


class Info(C.Structure):
    _fields_ = [('attributes', W.DWORD), ('creation', W.FILETIME), ('access', W.FILETIME), ('write', W.FILETIME),
                ('volumeSerial', W.DWORD), ('sizeHigh', W.DWORD), ('sizeLow', W.DWORD), ('links', W.DWORD),
                ('indexHigh', W.DWORD), ('indexLow', W.DWORD)]


def identity(path):
    """Product identity components except finalPath/isDirectory, read without modification."""
    handle = K.CreateFileW(str(path), FILE_READ_ATTRIBUTES, FILE_SHARE_ALL, None, OPEN_EXISTING, FILE_FLAG_BACKUP_SEMANTICS, None)
    if handle in (None, INVALID):
        raise OSError(C.get_last_error(), str(path))
    try:
        info = Info()
        if not K.GetFileInformationByHandle(handle, C.byref(info)):
            raise OSError(C.get_last_error(), str(path))
        return {'attributes': info.attributes, 'byteLength': info.sizeHigh * 4294967296 + info.sizeLow,
                'fileId': '%08x%08x' % (info.indexHigh, info.indexLow), 'linkCount': info.links,
                'volumeSerial': '%08x' % info.volumeSerial}
    finally:
        K.CloseHandle(handle)


def chain(path):
    path = Path(path)
    parts = [path] + list(path.parents)
    return [{'path': str(item), **identity(item)} for item in reversed(parts)]


def snapshot(root):
    """Same member rule as the H2 runtime fixture snapshot: sealed files only."""
    rows = []
    for item in sorted(Path(root).iterdir(), key=lambda entry: entry.name):
        if item.is_dir():
            rows.append({'name': item.name, 'directory': True})
            continue
        data = item.read_bytes()
        rows.append({'name': item.name, 'byteLength': len(data), 'sha256': 'sha256:' + hashlib.sha256(data).hexdigest()})
    return rows


result = {'identityComponents': ['attributes', 'byteLength', 'fileId', 'linkCount', 'volumeSerial'], 'cases': {}}

# Read-only pre-seal identity of the real fixture chains.
result['realFixtureChains'] = {'aggregate': chain(AGGREGATE), 'input': chain(INPUT)}
result['realFixtureMembers'] = {'aggregate': snapshot(AGGREGATE), 'input': snapshot(INPUT)}
result['realAggregateTargetAbsent'] = not (AGGREGATE / 'absent-output').exists()
assert result['realAggregateTargetAbsent']

sandbox = Path(tempfile.mkdtemp(prefix='mo1307-h2-fixture-sandbox-'))
try:
    common = sandbox / 'cca-conformance'
    fixture = common / 'fixtures' / 'mo1307' / 'fixture-root'
    inputs = common / 'fixtures' / 'mo1307' / 'fixture-root-input'
    evidence = common / 'evidence' / 'mo1307' / 'generation' / 'runtime-H'
    for directory in (fixture, inputs, evidence):
        directory.mkdir(parents=True)
    (fixture / 'fixture-root.json').write_bytes((AGGREGATE / 'fixture-root.json').read_bytes())
    for name in ('authority', 'config', 'candidate', 'manifest', 'small'):
        (inputs / (name + '.bin')).write_bytes(b'{}\n')
    fixture_chain_before = chain(fixture)
    input_chain_before = chain(inputs)
    evidence_before = identity(evidence)
    fixture_members_before = snapshot(fixture)
    input_members_before = snapshot(inputs)
    # B: live evidence writes beside the sealed fixture roots (shared ancestor = common).
    for index in range(400):
        (evidence / ('%03d.request.bin' % index)).write_bytes(b'x' * 426)
    evidence_after = identity(evidence)
    fixture_chain_after = chain(fixture)
    input_chain_after = chain(inputs)
    b_pass = (fixture_chain_after == fixture_chain_before and input_chain_after == input_chain_before
              and snapshot(fixture) == fixture_members_before and snapshot(inputs) == input_members_before)
    result['cases']['B'] = {'title': 'evidence writes cannot mutate aggregate fixture identity', 'expected': 'PASS',
                            'actual': 'PASS' if b_pass else 'FAIL', 'evidenceWrites': 400,
                            'evidenceDirectoryByteLengthBefore': evidence_before['byteLength'],
                            'evidenceDirectoryByteLengthAfter': evidence_after['byteLength'],
                            'fixtureChainUnchanged': fixture_chain_after == fixture_chain_before,
                            'inputChainUnchanged': input_chain_after == input_chain_before}
    # D: byteLength is a live identity component: the written directory's byteLength changed.
    d_pass = evidence_after['byteLength'] != evidence_before['byteLength'] and evidence_after['fileId'] == evidence_before['fileId']
    result['cases']['D'] = {'title': 'byteLength remains an enforced identity component', 'expected': 'PASS',
                            'actual': 'PASS' if d_pass else 'FAIL',
                            'sameFileIdDifferentByteLength': d_pass,
                            'before': evidence_before, 'after': evidence_after}
    # C: synthetic mutation inside the fixture root is detected.
    (fixture / 'absent-output').mkdir()
    (fixture / 'harness-write.bin').write_bytes(b'{}\n')
    members_after_mutation = snapshot(fixture)
    detected = members_after_mutation != fixture_members_before and (fixture / 'absent-output').exists()
    result['cases']['C'] = {'title': 'synthetic mutation inside fixture root', 'expected': 'FAIL',
                            'actual': 'FAIL' if detected else 'PASS', 'detected': detected,
                            'membersBefore': fixture_members_before, 'membersAfter': members_after_mutation,
                            'nativeFixtureIdentityBefore': fixture_chain_before[-1], 'nativeFixtureIdentityAfter': identity(fixture)}
finally:
    shutil.rmtree(sandbox)
result['sandboxRemoved'] = not sandbox.exists()
result['allCasesMatchExpected'] = all(row['actual'] == row['expected'] for row in result['cases'].values())
assert result['sandboxRemoved'] and result['allCasesMatchExpected'], result['cases']
result['execution'] = {'productRuns': 0, 'helperRuns': 0, 'workerRuns': 0, 'nativeObserverRuns': 0, 'repositoryWrites': 0, 'sandboxOnlyWrites': True}
result['result'] = 'PASS'
sys.stdout.write(json.dumps(result, indent=2, sort_keys=True) + '\n')
