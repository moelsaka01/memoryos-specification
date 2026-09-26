"""Bounded Phase 2C affected-suite runner; ordinary reruns never rewrite receipts.

Use --record before the completion commit to retain final-suites.json. Run
without --record after commit. Native execution/bootstrap/wrapper campaigns are
separately retained and intentionally are not repeated by this runner.
"""
import argparse
import hashlib
import json
import os
from pathlib import Path
import re
import subprocess
import sys
import time

HERE = Path(__file__).resolve().parent
ROOT = HERE.parents[3]
CACHE = ROOT / '.cache/mo1306-phase2c'
OUT = ROOT / 'repositories/cca-conformance/evidence/mo1306/phase2c/final-suites.json'
ORIGINAL = 'e1c990bf65d0c7925a68eea8222cd304f8ce6db6'
NODE_SHA = 'ba4e6d110e8c1592a1ecd390f6b05f3da124b13871a5be62b341a07a853c6c32'
FLAGS = subprocess.CREATE_NO_WINDOW if os.name == 'nt' else 0
MAX_OUTPUT = 2 * 1024 * 1024


def sha(data):
    return 'sha256:' + hashlib.sha256(data).hexdigest()


def source_row(relative):
    path = ROOT / relative
    data = path.read_bytes()
    return {'path': path.relative_to(ROOT).as_posix(), 'byteLength': len(data), 'sha256': sha(data)}


def tap_counts(stdout, expected):
    counts = {name: int(value) for name, value in re.findall(r'^# (tests|pass|fail|cancelled|skipped|todo) (\d+)\s*$', stdout, re.M)}
    actual = counts.get('tests')
    assert isinstance(actual, int) and counts.get('pass') == actual, counts
    assert actual == expected if expected is not None else actual >= 12, counts
    assert all(counts.get(name) == 0 for name in ('fail', 'cancelled', 'skipped', 'todo')), counts
    return {'assertions': actual, 'counts': counts}


def json_output(stdout):
    return json.loads(stdout.strip())


def details(identity, stdout):
    expected = {'common-contract': 152, 'common-security': 37, 'github-transport': 33, 'mo1302-regression': 4, 'production-structure': None}
    if identity in expected:
        return tap_counts(stdout, expected[identity])
    if identity == 'workspace':
        assert 'CCA workspace verification passed:' in stdout
        return {'assertions': 1}
    value = json_output(stdout)
    if identity == 'adapter-api':
        assert value['status'] == 'PASS' and value['checks'] == 50
        return {'assertions': 50}
    if identity == 'azure-generation':
        assert value['deterministicCalls'] == 13 and len(value['projectionCases']) == 11
        assert all(value[key] == 'PASS' for key in ('keyPermutation', 'normalizedDefaults', 'templateAgreement'))
        assert value['metadataNegativeCount'] == 10 and value['deploymentNegativeCount'] == 10
        return {'assertions': 31, 'projectionCases': 11, 'metadataNegativeCount': 10, 'deploymentNegativeCount': 10, 'deterministicCalls': 13}
    if identity == 'azure-contract':
        assert value['result'] == 'PASS' and value['negativeCount'] == 59
        assert all(row['result'] == 'REJECTED' for row in value['negatives'])
        return {'assertions': 59, 'negativeCount': 59, 'schema': value['schema']}
    if identity == 'github-contract':
        assert value['status'] == 'PASS' and value['negativeCount'] == 50 and value['astNegativeCount'] == 3 and value['originalRejected'] is True
        return {'assertions': 53, 'negativeCount': 50, 'astNegativeCount': 3, 'originalRejected': True, 'workflowSha256': value['workflowSha256']}
    raise AssertionError('Unknown suite identity')


def main():
    parser = argparse.ArgumentParser()
    parser.add_argument('--record', nargs='?', const=str(OUT), type=Path)
    args = parser.parse_args()
    assert os.name == 'nt' and sys.version_info[:3] == (3, 12, 14), 'pinned native Python 3.12.14 required'
    if args.record:
        assert args.record.resolve() == OUT.resolve(), 'only the fixed Phase 2C suite receipt may be recorded'
        head = subprocess.check_output(['git', 'rev-parse', 'HEAD'], cwd=ROOT, creationflags=FLAGS).decode().strip()
        assert head == ORIGINAL, 'receipts cannot be refreshed after the completion commit; omit --record'
    node = CACHE / 'node.exe'
    node_bytes = node.read_bytes()
    assert len(node_bytes) == 93580104 and hashlib.sha256(node_bytes).hexdigest() == NODE_SHA, 'frozen Node identity required'
    scratch = CACHE / 'final-suite-temp'
    scratch.mkdir(parents=True, exist_ok=True)
    env = dict(os.environ)
    env.update({'PYTHONPATH': str(CACHE / 'validators'), 'PYTHONDONTWRITEBYTECODE': '1',
                'PATHEXT': '.COM;.EXE;.BAT;.CMD', 'TMP': str(scratch), 'TEMP': str(scratch), 'TMPDIR': str(scratch)})
    for key in ('NODE_OPTIONS', 'NODE_PATH', 'NODE_INSPECT_RESUME_ON_START', 'NODE_REPL_EXTERNAL_MODULE'):
        env.pop(key, None)
    python = sys.executable
    node_test = [str(node), '--test', '--test-reporter=tap']
    specs = [
        ('common-contract', node_test + ['repositories/cca-conformance/tools/mo1306/contracts.test.mjs'], 'repositories/cca-conformance/tools/mo1306/contracts.test.mjs'),
        ('common-security', node_test + ['repositories/cca-conformance/tools/mo1306/security.test.mjs'], 'repositories/cca-conformance/tools/mo1306/security.test.mjs'),
        ('adapter-api', [str(node), str(HERE / 'adapter-contract.test.mjs')], 'repositories/cca-conformance/tools/mo1306-phase2c/adapter-contract.test.mjs'),
        ('production-structure', node_test + [str(HERE / 'generated-structure.test.mjs')], 'repositories/cca-conformance/tools/mo1306-phase2c/generated-structure.test.mjs'),
        ('github-transport', node_test + [str(HERE / 'github-transport.test.mjs')], 'repositories/cca-conformance/tools/mo1306-phase2c/github-transport.test.mjs'),
        ('azure-generation', [str(node), str(HERE / 'azure-render.mjs')], 'repositories/cca-conformance/tools/mo1306-phase2c/azure-render.mjs'),
        ('azure-contract', [python, str(HERE / 'test_azure.py')], 'repositories/cca-conformance/tools/mo1306-phase2c/test_azure.py'),
        ('github-contract', [python, str(HERE / 'test_github.py')], 'repositories/cca-conformance/tools/mo1306-phase2c/test_github.py'),
        ('mo1302-regression', node_test + ['--test-name-pattern=Action metadata, bootstrap exports|CLI transport accepts|PortablePath and action-input|outputs are exactly nineteen', 'repositories/cca-conformance/tests/mo1302_action_foundation_conformance_test.mjs'], 'repositories/cca-conformance/tests/mo1302_action_foundation_conformance_test.mjs'),
        ('workspace', [python, 'tools/verify_workspace.py', '--root', '.'], 'tools/verify_workspace.py'),
    ]
    source_paths = {source for _, _, source in specs}
    source_paths.update(['repositories/cca-conformance/tools/mo1306-phase2c/final-suites.py',
                         'repositories/cca-conformance/tools/mo1306-phase2c/safe_yaml.py',
                         'repositories/cca-conformance/tools/mo1306-phase2c/github_validator.py',
                         'repositories/cca-conformance/tools/mo1306-phase2c/azure_validator.py',
                         'repositories/cca-conformance/tools/mo1306-phase2c/check-github-powershell.ps1',
                         'repositories/cca-conformance/tools/mo1306-phase2c/github-fixture-bridge.mjs',
                         'repositories/cca-conformance/tests/support/mo1302-action-foundation-support.mjs',
                         'repositories/cca-conformance/fixtures/mo1306/engineering-validator-lock.json'])
    bindings = [source_row(path) for path in sorted(source_paths)]
    results = []
    deadline = time.monotonic() + 600
    for identity, command, source in specs:
        started = time.monotonic()
        remaining = deadline - started
        assert remaining > 0, 'suite runner deadline exceeded'
        row = {'id': identity, 'status': 'FAIL', 'exitCode': None, 'source': source_row(source)}
        process = None
        try:
            process = subprocess.run(command, cwd=ROOT, env=env, stdout=subprocess.PIPE, stderr=subprocess.PIPE,
                                     timeout=min(120, remaining), creationflags=FLAGS)
            row.update({'exitCode': process.returncode, 'elapsedMs': round((time.monotonic()-started)*1000),
                        'stdoutByteLength': len(process.stdout), 'stdoutSha256': sha(process.stdout),
                        'stderrByteLength': len(process.stderr), 'stderrSha256': sha(process.stderr)})
            assert len(process.stdout) <= MAX_OUTPUT and len(process.stderr) <= MAX_OUTPUT, 'suite output bound exceeded'
            assert process.returncode == 0, 'nonzero suite exit'
            assert not process.stderr, 'unexpected stderr'
            row.update(details(identity, process.stdout.decode('utf-8-sig')))
            row['status'] = 'PASS'
        except Exception as error:
            row['diagnostic'] = str(error)[:1000]
            results.append(row)
            print(json.dumps({'status': 'FAIL', 'suite': row, 'completedSuites': len(results)-1}, sort_keys=True), flush=True)
            if process is not None:
                print(process.stdout.decode('utf-8', errors='replace')[-4096:], file=sys.stderr)
                print(process.stderr.decode('utf-8', errors='replace')[-4096:], file=sys.stderr)
            return 1
        results.append(row)
        print(json.dumps({'id': identity, 'status': 'PASS', 'exitCode': 0, 'assertions': row['assertions']}, sort_keys=True), flush=True)
    assert bindings == [source_row(path) for path in sorted(source_paths)], 'suite sources changed during validation'
    report = {'kind': 'MemoryOSPhase2CFinalSuites', 'version': '1.0.0', 'status': 'PASS',
              'scope': 'Affected offline contract suites, targeted MO-1302 regression and workspace verification; native/bootstrap wrappers retained separately',
              'runtime': {'nodeVersion': '24.21.0', 'nodeByteLength': len(node_bytes), 'nodeSha256': 'sha256:'+NODE_SHA, 'pythonVersion': '3.12.14'},
              'distributionDigest': sha((ROOT/'repositories/memoryos-ci/distribution-manifest.json').read_bytes()),
              'sourceBindings': bindings, 'suiteCount': len(results), 'suites': results}
    if args.record:
        OUT.parent.mkdir(parents=True, exist_ok=True)
        OUT.write_text(json.dumps(report, sort_keys=True, separators=(',', ':'))+'\n', encoding='utf-8', newline='\n')
    print(json.dumps({'status': 'PASS', 'suiteCount': len(results), 'recorded': bool(args.record)}, sort_keys=True), flush=True)
    return 0


if __name__ == '__main__':
    raise SystemExit(main())
