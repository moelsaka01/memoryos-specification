"""Resume only uncompleted Phase 2B regression groups, preserving prior attempts."""
from pathlib import Path
import argparse
import ast
import hashlib
import importlib.util
import json
import os
import re
import subprocess
import time

ROOT = Path(__file__).resolve().parents[4]
spec = importlib.util.spec_from_file_location('phase2b_regressions', ROOT / 'repositories/cca-conformance/tools/mo1305-phase2b/regressions.py')
driver = importlib.util.module_from_spec(spec)
spec.loader.exec_module(driver)
parser = argparse.ArgumentParser(description=__doc__)
parser.add_argument('--node', required=True, type=Path)
parser.add_argument('--output', required=True, type=Path)
args = parser.parse_args()
output = args.output.resolve()
output.relative_to(ROOT)
node = args.node.resolve()
node.relative_to(ROOT)
receipt = json.loads(output.read_text(encoding='utf-8'))
if receipt['state'] == 'RUNNING':
    raise ValueError('Initial regression runner is still active')
for item in [receipt['driver'], receipt['frozenSelection'], *receipt['testInputs']]:
    if driver.identity(ROOT / item['path']) != item:
        raise ValueError('A bound driver or source input changed before resumption')
if driver.identity(node)['sha256'] != driver.NODE_SHA256:
    raise ValueError('Trusted Node executable changed')
selected = dict(driver.groups)
selected['mo1305-package-contracts'] = [
    'repositories/memoryos-rest/tests/contracts.test.mjs',
    'repositories/memoryos-rest/tests/openapi.test.mjs',
    'repositories/memoryos-rest/tests/integrity-race.test.mjs',
]
completed = {row['id']: row for row in receipt['results'] if row['state'] == 'PASS'}
for row in completed.values():
    if driver.identity(ROOT / row['log']['path']) != row['log']:
        raise ValueError('Completed group log changed before resumption')
failed_attempts = [row for row in receipt['results'] if row['state'] != 'PASS']
receipt.setdefault('priorAttempts', []).extend(failed_attempts)
receipt['results'] = list(completed.values())
receipt['resumption'] = {
    'driver': driver.identity(Path(__file__).resolve()),
    'budgetSeconds': 600,
    'reason': 'Bounded initial attempt exceeded its runtime budget; completed PASS groups are reused.',
    'completedPassGroupsReused': sorted(completed),
    'sourceInputIdentitiesUnchanged': True,
    'completedLogIdentitiesVerified': True,
}
receipt['state'] = 'RUNNING'
receipt.pop('failure', None)
driver.save(output, receipt)
env = {key: value for key, value in os.environ.items()
       if not re.match(r'^(NODE_|OPENSSL_|SSL_CERT_|UV_|HTTP_PROXY$|HTTPS_PROXY$|ALL_PROXY$|NO_PROXY$)', key, re.I)}
env['TEMP'] = env['TMP'] = str(driver.LOG_ROOT / 'tmp')
env['PATH'] = str(node.parent) + os.pathsep + env.get('PATH', '')
start = time.monotonic()
for name, files in selected.items():
    if name in completed:
        continue
    remaining = 600 - (time.monotonic() - start)
    if remaining <= 0:
        receipt['state'] = 'FAIL'
        receipt['failure'] = 'resumption-runtime-budget-exhausted'
        driver.save(output, receipt)
        raise SystemExit(1)
    command = [str(node), '--test', '--test-concurrency=1', '--test-reporter=tap', *files]
    process = subprocess.Popen(command, cwd=ROOT, env=env, stdout=subprocess.PIPE, stderr=subprocess.STDOUT)
    timed_out = False
    try:
        data, _ = process.communicate(timeout=min(420, remaining))
    except subprocess.TimeoutExpired:
        timed_out = True
        subprocess.run(['taskkill', '/PID', str(process.pid), '/T', '/F'],
                       stdout=subprocess.DEVNULL, stderr=subprocess.DEVNULL, timeout=10, check=False)
        data, _ = process.communicate(timeout=10)
    log = driver.LOG_ROOT / (name + '-resume.tap')
    log.write_bytes(data)
    counts = {key.decode(): int(value) for key, value in
              re.findall(rb'^# (tests|pass|fail|cancelled|skipped|todo) (\d+)\r?$', data, re.M)}
    passed = (process.returncode == 0 and not timed_out and counts.get('fail') == 0
              and counts.get('cancelled') == 0 and counts.get('tests', 0) > 0)
    row = {'id': name, 'state': 'PASS' if passed else 'FAIL', 'exitCode': process.returncode,
           'timedOut': timed_out, 'command': ['node', *command[1:]], 'counts': counts,
           'log': driver.identity(log), 'attempt': 'resume'}
    receipt['results'].append(row)
    receipt['commandCount'] += 1
    print(json.dumps(row, sort_keys=True), flush=True)
    driver.save(output, receipt)
    if not passed:
        receipt['state'] = 'FAIL'
        driver.save(output, receipt)
        raise SystemExit(1)
receipt['state'] = 'PASS'
receipt['completedGroupCount'] = len(receipt['results'])
receipt['totals'] = {key: sum(row['counts'].get(key, 0) for row in receipt['results'])
                    for key in ['tests', 'pass', 'fail', 'cancelled', 'skipped', 'todo']}
receipt['resumption']['elapsedSeconds'] = round(time.monotonic() - start, 3)
driver.save(output, receipt)
