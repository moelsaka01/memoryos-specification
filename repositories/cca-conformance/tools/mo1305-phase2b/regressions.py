"""Bounded Phase 2B package regressions; frozen predecessor groups run once."""
from pathlib import Path
import argparse
import ast
import hashlib
import json
import os
import re
import subprocess
import time

ROOT = Path(__file__).resolve().parents[4]
BASELINE = 'b6c397b99e1f8bfcd04be972f35069f8737a4137'
NODE_SHA256 = 'ba4e6d110e8c1592a1ecd390f6b05f3da124b13871a5be62b341a07a853c6c32'
FROZEN = ROOT / 'repositories/cca-conformance/tools/mo1305-phase1/regressions.py'
LOG_ROOT = ROOT / '.cache/mo1305-phase2b/regressions'
BUDGET_SECONDS = 540

groups={
 'mo1301-sdk':['repositories/cca-studio/tests/'+x for x in ['memoryos_policy_sdk_test.mjs','investigation_policy_test.mjs','investigation_policy_contracts_test.mjs','investigation_policy_engine_test.mjs','policy_canonical_test.mjs','policy_fact_context_test.mjs','regression_policy_fact_source_test.mjs','memoryos_sdk_test.mjs']],
 'core-mip':[p.relative_to(ROOT).as_posix() for p in sorted((ROOT/'repositories/cca-studio/tests').glob('mip_*test.mjs'))]+['repositories/cca-studio/tests/investigation_core_test.mjs'],
 'mo1302-projections':['--test-name-pattern=CLI transport|real bundled orchestration|valid MO-1301 evaluation failures|artifact verifier rejections|wrong decision/exit','repositories/cca-conformance/tests/mo1302_action_foundation_conformance_test.mjs'],
 'mo1303-io-inspection':['--test-name-pattern=secure input|exact bytes|inspection|Policy|policy|artifact|verification','repositories/memoryos-vscode/tests/runtime_foundation.test.mjs'],
 'mo1304-semantic-integrity':['repositories/memoryos-mcp/tests/'+x for x in ['contracts.test.mjs','delegation.test.mjs','integrity.test.mjs','dispatcher.test.mjs']],
 'cli-secondary':['repositories/memoryos-cli/tests/policy-cli.test.mjs'],
}


def identity(path):
    data = path.read_bytes()
    return {'path': path.relative_to(ROOT).as_posix(), 'byteLength': len(data),
            'sha256': hashlib.sha256(data).hexdigest()}


def selection_ast(path):
    tree = ast.parse(path.read_text(encoding='utf-8'))
    assignments = [node for node in tree.body if isinstance(node, ast.Assign)
                   and any(isinstance(target, ast.Name) and target.id == 'groups'
                           for target in node.targets)]
    if len(assignments) != 1:
        raise ValueError('Expected one frozen group declaration')
    return ast.dump(assignments[0].value)


def save(output, receipt):
    output.parent.mkdir(parents=True, exist_ok=True)
    output.write_text(json.dumps(receipt, sort_keys=True, separators=(',', ':')) + '\n',
                      encoding='utf-8')


def main():
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument('--node', required=True, type=Path)
    parser.add_argument('--output', required=True, type=Path)
    args = parser.parse_args()
    node = args.node.resolve()
    output = args.output.resolve()
    output.relative_to(ROOT)
    node.relative_to(ROOT)
    if selection_ast(Path(__file__)) != selection_ast(FROZEN):
        raise ValueError('Predecessor group selection differs from Phase 1')
    node_identity = identity(node)
    if node_identity['sha256'] != NODE_SHA256:
        raise ValueError('Node executable differs from frozen trusted runtime')
    node_identity['path'] = 'node.exe'
    node_identity['version'] = '24.21.0'
    env = {key: value for key, value in os.environ.items()
           if not re.match(r'^(NODE_|OPENSSL_|SSL_CERT_|UV_|HTTP_PROXY$|HTTPS_PROXY$|ALL_PROXY$|NO_PROXY$)', key, re.I)}
    scratch = LOG_ROOT / 'tmp'
    scratch.mkdir(parents=True, exist_ok=True)
    env['TEMP'] = env['TMP'] = str(scratch)
    env['PATH'] = str(node.parent) + os.pathsep + env.get('PATH', '')
    actual_version = subprocess.check_output([str(node), '--version'], env=env, text=True, timeout=10).strip()
    if actual_version != 'v24.21.0':
        raise ValueError('Unexpected Node version')
    selected = dict(groups)
    selected['mo1305-package-contracts'] = [
        'repositories/memoryos-rest/tests/contracts.test.mjs',
        'repositories/memoryos-rest/tests/openapi.test.mjs',
        'repositories/memoryos-rest/tests/integrity-race.test.mjs',
    ]
    test_inputs = sorted({item for files in selected.values() for item in files if not item.startswith('--')})
    receipt = {
        'kind': 'MemoryOSRESTPhase2BRegressions', 'version': '1.0.0', 'state': 'RUNNING',
        'baseline': BASELINE, 'node': node_identity, 'driver': identity(Path(__file__).resolve()),
        'frozenSelection': identity(FROZEN), 'frozenGroupSelectionUnchanged': True,
        'testInputs': [identity(ROOT / name) for name in test_inputs],
        'plannedCommandCount': len(selected), 'commandCount': 0,
        'budgetSeconds': BUDGET_SECONDS, 'results': [],
        'excluded': ['Phase 1 resource characterization', 'unrelated lifecycle tests',
                     'unrelated broad security and Phase 2C acceptance tests',
                     'unchanged C++/UI and historical hosted/certification workflows'],
        'logPolicy': 'Raw TAP remains in ignored .cache; portable receipt binds lengths and hashes.',
    }
    start = time.monotonic()
    save(output, receipt)
    for name, files in selected.items():
        remaining = BUDGET_SECONDS - (time.monotonic() - start)
        if remaining <= 0:
            receipt['state'] = 'FAIL'
            receipt['failure'] = 'total-runtime-budget-exhausted'
            save(output, receipt)
            return 1
        command = [str(node), '--test', '--test-concurrency=1', '--test-reporter=tap', *files]
        process = subprocess.Popen(command, cwd=ROOT, env=env, stdout=subprocess.PIPE, stderr=subprocess.STDOUT)
        timed_out = False
        try:
            data, _ = process.communicate(timeout=min(240, remaining))
        except subprocess.TimeoutExpired:
            timed_out = True
            if os.name == 'nt':
                subprocess.run(['taskkill', '/PID', str(process.pid), '/T', '/F'],
                               stdout=subprocess.DEVNULL, stderr=subprocess.DEVNULL, timeout=10, check=False)
            else:
                process.kill()
            data, _ = process.communicate(timeout=10)
        log = LOG_ROOT / (name + '.tap')
        log.write_bytes(data)
        counts = {key.decode(): int(value) for key, value in
                  re.findall(rb'^# (tests|pass|fail|cancelled|skipped|todo) (\d+)\r?$', data, re.M)}
        passed = (process.returncode == 0 and not timed_out and counts.get('fail') == 0
                  and counts.get('cancelled') == 0 and counts.get('tests', 0) > 0)
        row = {'id': name, 'state': 'PASS' if passed else 'FAIL', 'exitCode': process.returncode,
               'timedOut': timed_out, 'command': ['node', *command[1:]],
               'counts': counts, 'log': identity(log)}
        receipt['results'].append(row)
        receipt['commandCount'] += 1
        print(json.dumps(row, sort_keys=True), flush=True)
        save(output, receipt)
        if not passed:
            receipt['state'] = 'FAIL'
            save(output, receipt)
            return 1
    receipt['state'] = 'PASS'
    receipt['totals'] = {key: sum(row['counts'].get(key, 0) for row in receipt['results'])
                         for key in ['tests', 'pass', 'fail', 'cancelled', 'skipped', 'todo']}
    receipt['elapsedSeconds'] = round(time.monotonic() - start, 3)
    save(output, receipt)
    return 0


if __name__ == '__main__':
    raise SystemExit(main())
