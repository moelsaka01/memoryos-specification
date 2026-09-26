"""Reproduce the exact-B2 Phase 3C stop; never modifies production or old evidence."""
import argparse
import copy
import hashlib
import json
import os
from pathlib import Path
import subprocess
import sys
import time

ROOT = Path(__file__).resolve().parents[4]
OUT = ROOT / 'repositories/cca-conformance/evidence/mo1306/phase3c'
BASELINE = '0e35ffe70919d77b1db530929093826410b805f9'
NODE_SHA = 'ba4e6d110e8c1592a1ecd390f6b05f3da124b13871a5be62b341a07a853c6c32'
SELECTORS = ['invalid-command', 'constructor', 'toString', '__proto__']
SOURCE_PATHS = [
    'repositories/memoryos-ci/bin/memoryos-ci.mjs',
    'repositories/memoryos-ci/src/errors.mjs',
    'repositories/memoryos-ci/contracts/errors.json',
    'docs/mo1306-contract-freeze-1.md',
    'repositories/cca-conformance/tools/mo1306-phase3c/blocked-command-audit.py',
]


def canonical(value):
    return (json.dumps(value, sort_keys=True, separators=(',', ':'), ensure_ascii=True) + '\n').encode()


def sha(raw):
    return 'sha256:' + hashlib.sha256(raw).hexdigest()


def identity(relative):
    raw = (ROOT / relative).read_bytes()
    return {'path': relative, 'byteLength': len(raw), 'sha256': sha(raw)}


def git(*args):
    return subprocess.check_output(['git', *args], cwd=ROOT).decode().strip()


def validate(report):
    assert set(report) == {'kind', 'version', 'baseline', 'branch', 'status', 'blockerCount', 'integrationAllowed', 'runtime', 'environmentKeys', 'sources', 'cases', 'counts', 'scope', 'elapsedMs'}
    assert report['kind'] == 'MemoryOSPhase3CBlockedAudit' and report['version'] == '1.0.0'
    assert report['baseline'] == BASELINE and report['branch'] == 'mo1306/phase3c'
    assert report['status'] == 'BLOCKED' and report['blockerCount'] == 1
    assert report['integrationAllowed'] is False
    assert report['environmentKeys'] == ['SystemRoot', 'WINDIR']
    assert report['runtime']['sha256'] == 'sha256:' + NODE_SHA
    assert report['runtime']['version'] == 'v24.21.0'
    assert report['runtime']['byteLength'] == 93580104
    assert report['runtime']['path'] == '.cache/mo1305-phase3br/toolchain/node-v24.21.0-win-x64/node.exe'
    assert report['sources'] == [identity(p) for p in SOURCE_PATHS]
    assert report['counts'] == {'cases': 4, 'conformant': 1, 'nonconformant': 3}
    assert report['scope'] == 'Bounded public-command rejection witness only; full Phase 3C certification stopped.'
    assert isinstance(report['elapsedMs'], int) and report['elapsedMs'] >= 0
    assert len(report['cases']) == 4
    for index, case in enumerate(report['cases']):
        assert set(case) == {'selector', 'expected', 'observed', 'conforms', 'command'}
        assert case['selector'] == SELECTORS[index]
        assert case['expected'] == {'exitCode': 10, 'code': 'MO1306_USAGE', 'stage': 'LAUNCH'}
        assert case['command'] == [report['runtime']['path'], '--max-old-space-size=128', SOURCE_PATHS[0], SELECTORS[index]]
        observed = case['observed']
        assert set(observed) == {'exitCode', 'stdout', 'stderr'} and observed['stdout'] == ''
        diagnostic = json.loads(observed['stderr'])
        assert observed['stderr'].encode() == canonical(diagnostic)
        expected = case['expected'] if index == 0 else {'exitCode': 16, 'code': 'MO1306_INTERNAL_FAILURE', 'stage': 'INTERNAL'}
        assert observed['exitCode'] == expected['exitCode']
        assert diagnostic == {'kind': 'MemoryOSCICDDiagnostic', 'version': '1.0.0', 'code': expected['code'], 'stage': expected['stage'], 'message': 'The requested operation could not complete.'}
        assert case['conforms'] is (index == 0)
    return True


def record():
    assert git('rev-parse', 'HEAD') == BASELINE
    assert git('branch', '--show-current') == 'mo1306/phase3c'
    assert git('diff', '--name-only', BASELINE, '--', 'repositories/memoryos-ci') == ''
    node_relative = '.cache/mo1305-phase3br/toolchain/node-v24.21.0-win-x64/node.exe'
    node = ROOT / node_relative
    assert hashlib.sha256(node.read_bytes()).hexdigest() == NODE_SHA
    env = {key: os.environ[key] for key in ['SystemRoot', 'WINDIR']}
    version = subprocess.check_output([str(node), '--version'], env=env).decode().strip()
    started = time.monotonic()
    cases = []
    for selector in SELECTORS:
        command = [node_relative, '--max-old-space-size=128', SOURCE_PATHS[0], selector]
        execution = [str(node), command[1], str(ROOT / command[2]), selector]
        result = subprocess.run(execution, cwd=ROOT, env=env, stdin=subprocess.DEVNULL, capture_output=True, timeout=10)
        diagnostic = json.loads(result.stderr)
        conforms = result.returncode == 10 and diagnostic['code'] == 'MO1306_USAGE' and diagnostic['stage'] == 'LAUNCH'
        cases.append({'selector': selector, 'expected': {'exitCode': 10, 'code': 'MO1306_USAGE', 'stage': 'LAUNCH'}, 'observed': {'exitCode': result.returncode, 'stdout': result.stdout.decode('utf8'), 'stderr': result.stderr.decode('utf8')}, 'conforms': conforms, 'command': command})
    report = {'kind': 'MemoryOSPhase3CBlockedAudit', 'version': '1.0.0', 'baseline': BASELINE, 'branch': 'mo1306/phase3c', 'status': 'BLOCKED', 'blockerCount': 1, 'integrationAllowed': False, 'runtime': {**identity(node_relative), 'version': version}, 'environmentKeys': list(env), 'sources': [identity(p) for p in SOURCE_PATHS], 'cases': cases, 'counts': {'cases': len(cases), 'conformant': sum(c['conforms'] for c in cases), 'nonconformant': sum(not c['conforms'] for c in cases)}, 'scope': 'Bounded public-command rejection witness only; full Phase 3C certification stopped.', 'elapsedMs': round((time.monotonic() - started) * 1000)}
    validate(report)
    OUT.mkdir(parents=True, exist_ok=True)
    with (OUT / 'command-selector-blocker.json').open('xb') as stream:
        stream.write(canonical(report))
    print(json.dumps({'status': report['status'], 'counts': report['counts']}))


def verification():
    report = json.loads((OUT / 'command-selector-blocker.json').read_bytes())
    validate(report)
    mutations = [
        ('forged-pass', lambda r: r.update(status='PASS')),
        ('wrong-baseline', lambda r: r.update(baseline='0' * 40)),
        ('hidden-blocker', lambda r: r.update(blockerCount=0)),
        ('unsafe-integration', lambda r: r.update(integrationAllowed=True)),
        ('omitted-case', lambda r: r['cases'].pop()),
        ('forged-outcome', lambda r: r['cases'][1]['observed'].update(exitCode=10)),
        ('wrong-runtime', lambda r: r['runtime'].update(sha256='sha256:' + '0' * 64)),
        ('source-drift', lambda r: r['sources'][0].update(byteLength=0)),
    ]
    rejected = []
    for name, mutate in mutations:
        altered = copy.deepcopy(report)
        mutate(altered)
        try:
            validate(altered)
        except (AssertionError, ValueError, KeyError):
            rejected.append(name)
        else:
            raise AssertionError('Mutation accepted: ' + name)
    print(json.dumps({'evidenceValidation': 'PASS', 'candidateStatus': 'BLOCKED', 'positiveEvidenceChecks': 1, 'negativeEvidenceChecks': len(rejected), 'rejected': rejected}))


if __name__ == '__main__':
    parser = argparse.ArgumentParser()
    parser.add_argument('mode', choices=['record', 'verify'])
    args = parser.parse_args()
    record() if args.mode == 'record' else verification()
