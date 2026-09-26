"""Read-only independent verifier for retained Phase 2B acceptance evidence.

Standard library only. No imports from the generator, finalizer, product or
validator libraries; no heavy suites, provider calls, or evidence writes.
"""
from collections import Counter
from datetime import datetime
import copy
import hashlib
import json
import os
from pathlib import Path
import re
import socket
import subprocess
import sys
import unittest

ROOT = Path(__file__).resolve().parents[4]
PREFIX = 'repositories/cca-conformance/evidence/mo1306/phase2b/'
B1 = 'dbafc0061aa493da2517ee5564f9ea6adb90f52d'
INITIAL = '1d43584cef532ebcdf1e87b0cba277d2d7180a63'
SUBJECT = 'test(memoryos-1.3): validate MO-1306 GitLab and Jenkins adapters'
HISTORY = {
    'revision': B1, 'tree': '0dfc97058c5d5f060c2dbb5a31fd66a706a7786d',
    'evidenceTree': 'e5e606f918fe19fe40fc799ba6c0178089c4b2d3',
    'packageTree': 'a3db70be7c37fa0fb74d13f41dd0f2b8cc356f86',
    'contractsTestBlob': 'ded32e1c738389272ec51f3c7dd5d3f4555d9a5a',
    'contractsTestSha256': 'sha256:ce87d84971a749ae1d932891039e7137a9a24b98226e7cbc2e475c28d2c5da78',
    'providers': {'generic': 'FOUNDATION_IMPLEMENTED', 'github': 'NOT_IMPLEMENTED',
                  'gitlab': 'NOT_IMPLEMENTED', 'jenkins': 'NOT_IMPLEMENTED', 'azure': 'NOT_IMPLEMENTED'},
}
COUNTS = {'current-contract': 152, 'historical-B1': 3, 'adapters': 466,
          'test_gitlab': 91, 'test_jenkins': 110, 'launcher': 67}
AUXILIARY = {'generated', 'workspace', 'whitespace', 'full-2020-12', 'evidence-negative'}
PRESERVED = {'repositories/memoryos-ci/' + name for name in
             ['distribution-manifest.json', 'contracts/contract.json', 'package.json', 'package-lock.json', 'sbom.spdx.json']}
OUTCOMES = {
    'evaluate-policy-pass': 0, 'evaluate-policy-fail': 6, 'evaluate-policy-cne': 7,
    'evaluate-policySet-pass': 0, 'evaluate-policySet-fail': 6, 'evaluate-policySet-cne': 7,
    'regression': 0, 'metadata-variation': 0, 'invalid-config': 10,
    'missing-input': 11, 'policy-pin': 15, 'invalid-metadata': 10, 'bootstrap-pin': 15,
}
CLASSIFICATIONS = {0: 'PASS', 6: 'FAIL', 7: 'COULD_NOT_EVALUATE',
                   10: 'CONFIGURATION_ERROR', 11: 'INPUT_ERROR', 15: 'INTEGRITY_ERROR'}


class EvidenceError(ValueError):
    pass


def require(condition, message):
    if not condition:
        raise EvidenceError(message)


def j(value):
    return (json.dumps(value, sort_keys=True, separators=(',', ':'), ensure_ascii=False, allow_nan=False) + '\n').encode('utf-8')


def sha(data):
    return 'sha256:' + hashlib.sha256(data).hexdigest()


def digest(value):
    return isinstance(value, str) and re.fullmatch(r'sha256:[0-9a-f]{64}', value) is not None


def integer(value, expected=None):
    return type(value) is int and value >= 0 and (expected is None or value == expected)


def strict_json(data, canonical=True):
    def pairs(items):
        result = {}
        for key, value in items:
            require(key not in result, 'duplicate JSON key')
            result[key] = value
        return result
    def reject_constant(value):
        raise EvidenceError('non-finite JSON number')
    try:
        value = json.loads(data.decode('utf-8', errors='strict'), object_pairs_hook=pairs,
                           parse_constant=reject_constant)
        require(isinstance(value, dict), 'JSON envelope is not an object')
        if canonical:
            require(j(value) == data, 'JSON envelope is not canonical UTF-8/LF')
        return value
    except (UnicodeError, json.JSONDecodeError, TypeError, OverflowError) as error:
        raise EvidenceError('invalid JSON envelope') from error


def safe_path(value):
    require(isinstance(value, str) and 0 < len(value) <= 512, 'invalid manifest path length')
    require(re.fullmatch(r'[A-Za-z0-9_. -]+(?:/[A-Za-z0-9_. -]+)*', value), 'unsafe manifest path')
    parts = value.split('/')
    require(all(part not in ('.', '..') and not part.startswith(' ') and not part.endswith((' ', '.'))
                and not re.fullmatch(r'(?i:con|prn|aux|nul|com[1-9]|lpt[1-9])(?:\..*)?', part) for part in parts),
            'unsafe manifest path component')
    return value


def checked_rows(rows, read, expected_paths=None, sorted_required=True):
    require(isinstance(rows, list) and 0 < len(rows) <= 10000, 'invalid row count')
    names, folded = [], set()
    for row in rows:
        require(isinstance(row, dict) and set(row) == {'path', 'byteLength', 'sha256'}, 'closed manifest row')
        name = safe_path(row['path'])
        require(name.casefold() not in folded, 'duplicate/case-colliding manifest path')
        folded.add(name.casefold())
        names.append(name)
        require(integer(row['byteLength']) and row['byteLength'] <= 64 * 1024 * 1024 and digest(row['sha256']), 'invalid row identity')
        try:
            data = read(name)
        except (OSError, KeyError) as error:
            raise EvidenceError('missing manifest member: ' + name) from error
        require(type(data) is bytes and len(data) == row['byteLength'] and sha(data) == row['sha256'], 'manifest member identity mismatch: ' + name)
    require(not sorted_required or names == sorted(names), 'manifest rows not ASCII path-sorted')
    if expected_paths is not None:
        require(set(names) == set(expected_paths), 'missing/extra manifest coverage')
    return set(names)


def validate_header(acceptance):
    require(acceptance.get('kind') == 'MemoryOSPhase2BAcceptance' and acceptance.get('version') == '1.0.0'
            and acceptance.get('status') == 'PASS', 'acceptance identity/status')
    require(acceptance.get('baseline') == B1 and acceptance.get('implementationRevision') == INITIAL
            and acceptance.get('intendedCompletionParent') == INITIAL, 'historical revision pins')
    require(digest(acceptance.get('stageDigest')) and digest(acceptance.get('contentManifestSha256')), 'acceptance digests')
    budget = acceptance.get('budget', {})
    require(budget.get('started') == '2026-09-26T09:36:52+00:00'
            and integer(budget.get('hardStopSeconds'), 5400)
            and type(budget.get('elapsedSeconds')) in (int, float)
            and 0 <= budget['elapsedSeconds'] <= 5400, 'continuation budget identity/bound')
    try:
        elapsed = (datetime.fromisoformat(budget['validated']) - datetime.fromisoformat(budget['started'])).total_seconds()
    except (KeyError, TypeError, ValueError) as error:
        raise EvidenceError('invalid budget timestamps') from error
    require(0 <= elapsed <= 5400 and abs(elapsed - budget['elapsedSeconds']) <= 0.001, 'inconsistent budget timestamps')
    providers = acceptance.get('providers')
    require(isinstance(providers, dict) and set(providers) == {'gitlab', 'jenkins'}, 'exact Phase 2B providers')
    for value in providers.values():
        require(value == {'implementation': 'IMPLEMENTED', 'validation': 'CONTRACT_VALIDATED', 'liveProviderCertified': False}
                and value['liveProviderCertified'] is False, 'false provider status/live claim')


def validate_graph(branch, head, parents, subject, initial_parents):
    require(branch == 'mo1306/phase2b', 'wrong work branch')
    require(initial_parents == [B1], 'implementation parent differs from B1')
    if head == INITIAL:
        require(parents == [B1], 'precommit graph')
        return 'PRECOMMIT'
    require(re.fullmatch(r'[0-9a-f]{40}', head) and parents == [INITIAL] and subject == SUBJECT,
            'completion graph/message must be one exact child of implementation')
    return 'COMPLETION_COMMIT'


def validate_committed_blobs(names, read, tree_bytes):
    """Compare every acceptance-bound byte to one batched HEAD tree listing."""
    committed = {}
    for entry in tree_bytes.split(b'\0'):
        if not entry:
            continue
        header, separator, raw_path = entry.partition(b'\t')
        require(separator == b'\t', 'malformed Git tree listing')
        name = raw_path.decode('utf-8', errors='strict')
        if name not in names:
            continue
        fields = header.decode('ascii').split(' ')
        require(len(fields) == 3 and fields[0] in ('100644', '100755')
                and fields[1] == 'blob' and re.fullmatch(r'[0-9a-f]{40}', fields[2]), 'bound HEAD member is not a regular Git blob')
        require(name not in committed, 'duplicate bound HEAD member')
        committed[name] = fields[2]
    require(set(committed) == set(names), 'bound file missing from committed HEAD')
    for name in sorted(names):
        data = read(name)
        actual = hashlib.sha1(b'blob ' + str(len(data)).encode('ascii') + b'\0' + data).hexdigest()
        require(actual == committed[name], 'working bytes differ from committed HEAD blob: ' + name)


def validate_reports(acceptance, reports):
    stage = acceptance['stageDigest']
    suites, execution, cli = (reports[name] for name in ('suites', 'execution', 'cli-generation'))
    require(all(report.get('status') == 'PASS' for report in reports.values()), 'failed report')
    require(suites.get('stageDigest') == execution.get('stageDigest') == cli.get('stageDistributionDigest') == stage, 'report stage digest mismatch')
    suite_rows = suites.get('records', [])
    require(len(suite_rows) == len(COUNTS) + len(AUXILIARY)
            and Counter(row.get('id') for row in suite_rows) == Counter({name: 1 for name in set(COUNTS) | AUXILIARY}), 'suite IDs missing/duplicate/extra')
    for row in suite_rows:
        require(row.get('status') == 'PASS' and row.get('exitCode', 0) == 0
                and row.get('failed', 0) == 0 and row.get('skipped', 0) == 0, 'suite failure/skip')
        if row['id'] in COUNTS:
            require(integer(row.get('tests'), COUNTS[row['id']]), 'suite count mismatch: ' + row['id'])
        elif row['id'] == 'full-2020-12':
            require(integer(row.get('instances'), 116) and integer(row.get('negativeControls'), 8), 'full Draft202012 gate counts')
    require(execution.get('kind') == 'MemoryOSPhase2BWindowsEquivalence'
            and execution.get('liveProviderExecution') is False
            and integer(execution.get('caseCount'), 26) and integer(execution.get('commandCount'), 78), 'execution scope/count')
    cases, commands = execution.get('cases', []), execution.get('commands', [])
    expected_cases = {provider + '-' + name: (provider, name, code)
                      for provider in ('gitlab', 'jenkins') for name, code in OUTCOMES.items()}
    require(len(cases) == 26 and Counter(case.get('id') for case in cases) == Counter({name: 1 for name in expected_cases}), 'execution case IDs/count')
    expected_commands = Counter()
    for case in cases:
        provider, name, code = expected_cases[case['id']]
        require(case.get('provider') == provider and case.get('status') == 'PASS'
                and case.get('actualExitCode') == case.get('expectedExitCode') == code
                and case.get('distributionDigest') == stage, 'execution case result/pin')
        for field in ('artifactSha256', 'scriptSha256', 'configurationDigest'):
            require(digest(case.get(field)), 'execution artifact/script/configuration identity')
        summary = case.get('summary')
        if name in ('invalid-config', 'bootstrap-pin'):
            require(summary is None, 'prelaunch failure unexpectedly claims a summary')
        else:
            require(isinstance(summary, dict) and summary.get('publication') == 'COMPLETE'
                    and summary.get('exitCode') == code and summary.get('classification') == CLASSIFICATIONS[code],
                    'required complete execution summary')
        expected_commands[provider + '-pure-generation'] += 1
        expected_commands[case['id'] + '-powershell-ast'] += 1
        expected_commands[case['id']] += 1
    require(len(commands) == 78 and Counter(row.get('id') for row in commands) == expected_commands, 'execution command count/IDs')
    require(all(row.get('status') == 'PASS' and row.get('exitCode') == row.get('expectedExitCode') for row in commands), 'execution command failure')
    require(cli.get('kind') == 'MemoryOSPhase2BCLIGenerationValidation' and cli.get('liveProviderExecution') is False
            and integer(cli.get('caseCount'), 17) and integer(cli.get('successfulGenerations'), 6)
            and integer(cli.get('noOverwriteRejections'), 8) and integer(cli.get('unsupportedProviderRejections'), 3)
            and cli.get('exactRepeatedBytes') is True and cli.get('stageUnchanged') is True, 'CLI scope/count/determinism')
    expected_cli = {}
    for provider in ('gitlab', 'jenkins'):
        expected_cli.update({provider + '-fresh-' + str(index): 0 for index in range(3)})
        expected_cli.update({provider + '-no-overwrite-' + name: 17 for name in ('generated', 'empty', 'dirty', 'file')})
    expected_cli.update({provider + '-unsupported': 10 for provider in ('unknown', 'azure', 'github')})
    cli_rows = cli.get('cases', [])
    require(len(cli_rows) == 17 and Counter(row.get('id') for row in cli_rows) == Counter({name: 1 for name in expected_cli}), 'CLI case IDs/count')
    for row in cli_rows:
        expected = expected_cli[row['id']]
        require(row.get('status') == 'PASS' and row.get('exitCode') == row.get('expectedExitCode') == expected
                and row.get('stdoutByteLength') == 0 and row.get('stdout') == '', 'CLI case result/stdout')
        if expected == 17:
            require(row.get('unchanged') is True, 'no-overwrite claim missing')
        elif expected == 10:
            require(row.get('outputAbsent') is True, 'unsupported provider output')
    providers = cli.get('providers', [])
    require(len(providers) == 2 and {row.get('provider') for row in providers} == {'gitlab', 'jenkins'}, 'CLI provider coverage')
    for row in providers:
        require(row.get('status') == 'PASS' and integer(row.get('repetitions'), 3)
                and integer(row.get('noOverwriteCases'), 4), 'CLI provider result')


def expected_coverage(root):
    directories = ['repositories/cca-conformance/tools/mo1306-phase2b',
                   'repositories/cca-conformance/fixtures/mo1306/phase2b',
                   PREFIX.rstrip('/'), 'repositories/memoryos-ci']
    names = {path.relative_to(root).as_posix() for name in directories for path in (root / name).rglob('*')
             if path.is_file() and '__pycache__' not in path.parts
             and path.name not in ('acceptance.json', 'content-manifest.json')}
    names.update(['docs/mo1306-phase2b-validation.md',
                  'repositories/cca-conformance/tools/mo1306/contracts.test.mjs',
                  'repositories/cca-conformance/fixtures/mo1306/gitlab-ci-schema-a725331f22234d3078d7300944b9454da103e73c.json'])
    return names


def validate_history(capabilities):
    require(capabilities.get('baseline') == HISTORY and capabilities.get('implementationRevision') == INITIAL
            and capabilities.get('phase') == '2B', 'historical B1 capability pins')
    require({provider: item['state'] for provider, item in capabilities['generation'].items()} ==
            {'generic': 'IMPLEMENTED', 'gitlab': 'IMPLEMENTED', 'jenkins': 'IMPLEMENTED', 'github': 'NOT_IMPLEMENTED', 'azure': 'NOT_IMPLEMENTED'},
            'unimplemented providers falsely promoted')


def validate_schema_report(report, expected):
    require(report.get('id') == 'full-2020-12' and report.get('status') == 'PASS'
            and integer(report.get('instances'), 116) and integer(report.get('negativeControls'), 8)
            and report.get('engine') == 'jsonschema 4.26.0 Draft202012Validator', 'full schema report identity/count')
    rows = report.get('validated', [])
    require(len(rows) == 116 and len(expected) == 116, 'schema instance list count')
    seen = set()
    for row in rows:
        require(set(row) == {'schema', 'source', 'sha256'}, 'schema instance row keys')
        key = (row['schema'], row['source'])
        require(key not in seen and key in expected, 'duplicate/unexpected schema instance')
        seen.add(key)
        require(digest(row['sha256']) and sha(j(expected[key])) == row['sha256'], 'schema instance digest')
    require(seen == set(expected), 'missing schema instance')
    require(Counter(schema for schema, _ in seen) == Counter(configuration=2, deployment=2, generation=2,
            summary=22, result=22, evidence=22, artifacts=22, complete=22), 'schema family counts')


def verify(root):
    root = root.resolve(strict=True)
    def read(name):
        safe_path(name)
        target = root / name
        require(target.resolve(strict=True).is_relative_to(root), 'bound file escapes repository')
        current = root
        for part in name.split('/'):
            current /= part
            require(not current.is_symlink() and not (hasattr(current, 'is_junction') and current.is_junction()), 'bound path is a link/reparse junction')
        require(target.is_file(), 'bound path not regular file')
        return target.read_bytes()
    acceptance = strict_json(read(PREFIX + 'acceptance.json'))
    validate_header(acceptance)
    manifest_bytes = read(PREFIX + 'content-manifest.json')
    require(sha(manifest_bytes) == acceptance['contentManifestSha256'], 'content manifest digest mismatch')
    manifest = strict_json(manifest_bytes)
    require(manifest.get('kind') == 'MemoryOSPhase2BContentManifest' and manifest.get('version') == '1.0.0'
            and set(manifest) == {'kind', 'version', 'files'}, 'content manifest identity/keys')
    names = checked_rows(manifest['files'], read, expected_coverage(root))
    reports = {name: strict_json(read(PREFIX + name + '.json')) for name in ('suites', 'execution', 'cli-generation')}
    validate_reports(acceptance, reports)
    stage = strict_json(read(PREFIX + 'stage.json'))
    require(stage.get('kind') == 'MemoryOSPhase2BEngineeringStage' and stage.get('version') == '1.0.0'
            and stage.get('distributionDigest') == acceptance['stageDigest'], 'stage identity/digest')
    checked_rows(stage['sourceFiles'], lambda name: read('repositories/memoryos-ci/' + safe_path(name)))
    active = root / '.cache/mo1306/phase2b/active-stage.json'
    if active.exists():
        active_stage = strict_json(active.read_bytes())
        require(active_stage == stage, 'retained evidence does not bind current active stage')
    capabilities = strict_json(read('repositories/cca-conformance/fixtures/mo1306/phase2b/generation-capabilities.json'), canonical=False)
    validate_history(capabilities)
    schema_instances = {}
    for provider in ('gitlab', 'jenkins'):
        for name, filename in [('configuration', 'memoryos-ci.json'), ('deployment', 'deployment.json'), ('generation', 'memoryos-ci-generation.json')]:
            source = PREFIX + 'generated/' + provider + '/' + filename
            # Deployment is a retained input, not a canonical generated artifact.
            schema_instances[(name, source)] = strict_json(read(source), canonical=name != 'deployment')
    for case in reports['execution']['cases']:
        if case['summary'] is not None:
            schema_instances[('summary', case['id'])] = case['summary']
    for filename, name in [('memoryos-ci-result.json', 'result'), ('memoryos-ci-evidence.json', 'evidence'),
                           ('memoryos-ci-artifacts.json', 'artifacts'), ('memoryos-ci-complete.json', 'complete')]:
        for path in (root / PREFIX / 'bundles').rglob(filename):
            source = path.relative_to(root).as_posix()
            schema_instances[(name, source)] = strict_json(read(source))
    validate_schema_report(strict_json(read(PREFIX + 'json-schema.json')), schema_instances)
    def git(*args):
        result = subprocess.run(['git', *args], cwd=root, capture_output=True, check=True,
                                timeout=20, creationflags=subprocess.CREATE_NO_WINDOW if os.name == 'nt' else 0)
        return result.stdout
    def line(*args):
        return git(*args).decode('utf-8').strip()
    head = line('rev-parse', 'HEAD')
    state = validate_graph(line('rev-parse', '--abbrev-ref', 'HEAD'), head,
                           line('rev-list', '--parents', '-n', '1', 'HEAD').split()[1:],
                           line('show', '-s', '--format=%B', 'HEAD'),
                           line('rev-list', '--parents', '-n', '1', INITIAL).split()[1:])
    committed_names = names | {PREFIX + 'acceptance.json', PREFIX + 'content-manifest.json'}
    if state == 'COMPLETION_COMMIT':
        # One Git read, including envelopes excluded from their own manifest.
        tree = git('ls-tree', '-r', '-z', 'HEAD', '--',
                   'repositories/cca-conformance/tools/mo1306-phase2b',
                   'repositories/cca-conformance/fixtures/mo1306/phase2b', PREFIX.rstrip('/'),
                   'repositories/memoryos-ci', 'docs/mo1306-phase2b-validation.md',
                   'repositories/cca-conformance/tools/mo1306/contracts.test.mjs',
                   'repositories/cca-conformance/fixtures/mo1306/gitlab-ci-schema-a725331f22234d3078d7300944b9454da103e73c.json')
        validate_committed_blobs(committed_names, read, tree)
    specs = {'tree': B1 + '^{tree}', 'evidenceTree': B1 + ':repositories/cca-conformance/evidence/mo1306',
             'packageTree': B1 + ':repositories/memoryos-ci',
             'contractsTestBlob': B1 + ':repositories/cca-conformance/tools/mo1306/contracts.test.mjs'}
    for key, spec in specs.items():
        require(line('rev-parse', spec) == HISTORY[key], 'B1 Git object pin mismatch')
    require(sha(git('show', B1 + ':repositories/cca-conformance/tools/mo1306/contracts.test.mjs')) == HISTORY['contractsTestSha256'], 'historical test byte pin')
    preserved = acceptance.get('preservedSourceManifests')
    checked_rows(preserved, read, PRESERVED, sorted_required=False)
    for name in PRESERVED:
        require(read(name) == git('show', INITIAL + ':' + name), 'source release manifest changed: ' + name)
    # Check reported counts against retained raw logs rather than only JSON claims.
    for name, count in COUNTS.items():
        if name.startswith('test_'):
            output = read(PREFIX + name + '.txt').decode('utf-8')
            require(re.search(r'Ran ' + str(count) + r' tests? in ', output) and output.rstrip().endswith('OK'), 'unittest log does not substantiate count/result')
        else:
            output = read(PREFIX + name + '.stdout.txt').decode('utf-8')
            for field, number in [('tests', count), ('pass', count), ('fail', 0), ('skipped', 0)]:
                require(re.search(r'^# ' + field + ' ' + str(number) + r'\s*$', output, re.M), 'TAP log does not substantiate ' + name + '/' + field)
    self_tests = strict_json(read(PREFIX + 'evidence-negative.stdout.txt'), canonical=False)
    require(self_tests == {'status': 'PASS', 'tests': 45} and integer(self_tests['tests'], 45), 'evidence checker self-test count/result')
    self_log = read(PREFIX + 'evidence-negative.stderr.txt').decode('utf-8')
    require(re.search(r'Ran 45 tests in ', self_log) and self_log.rstrip().endswith('OK'), 'evidence checker self-test log')
    for provider in reports['cli-generation']['providers']:
        primary = '.gitlab-ci.yml' if provider['provider'] == 'gitlab' else 'Jenkinsfile'
        prefix = PREFIX + 'generated/' + provider['provider'] + '/'
        checked_rows(provider['artifactRows'], lambda name: read(prefix + name),
                     [primary, 'memoryos-ci.json', 'memoryos-ci-generation.json'])
    return dict(status='PASS', boundFiles=len(names), graphState=state, head=head,
                committedBlobChecks=len(committed_names) if state == 'COMPLETION_COMMIT' else 0,
                stageDigest=acceptance['stageDigest'], activeStageChecked=active.exists(),
                suites=COUNTS, schemaInstances=116, schemaNegativeControls=8,
                executionCases=26, executionCommands=78, cliCases=17)


def synthetic():
    pin = 'sha256:' + '1' * 64
    acceptance = dict(kind='MemoryOSPhase2BAcceptance', version='1.0.0', status='PASS',
                      baseline=B1, implementationRevision=INITIAL, intendedCompletionParent=INITIAL,
                      stageDigest=pin, contentManifestSha256=pin,
                      budget=dict(started='2026-09-26T09:36:52+00:00', validated='2026-09-26T09:36:53+00:00', elapsedSeconds=1, hardStopSeconds=5400),
                      providers={name: dict(implementation='IMPLEMENTED', validation='CONTRACT_VALIDATED', liveProviderCertified=False)
                                 for name in ('gitlab', 'jenkins')})
    cases, commands = [], []
    for provider in ('gitlab', 'jenkins'):
        for name, code in OUTCOMES.items():
            case_id = provider + '-' + name
            summary = None if name in ('invalid-config', 'bootstrap-pin') else dict(publication='COMPLETE', exitCode=code, classification=CLASSIFICATIONS[code])
            cases.append(dict(id=case_id, provider=provider, status='PASS', expectedExitCode=code, actualExitCode=code,
                              distributionDigest=pin, artifactSha256=pin, scriptSha256=pin, configurationDigest=pin, summary=summary))
            commands.extend([dict(id=key, status='PASS', exitCode=value, expectedExitCode=value)
                             for key, value in [(provider + '-pure-generation', 0), (case_id + '-powershell-ast', 0), (case_id, code)]])
    cli_cases = []
    for provider in ('gitlab', 'jenkins'):
        cli_cases.extend([dict(id=provider + '-fresh-' + str(index), status='PASS', exitCode=0, expectedExitCode=0, stdout='', stdoutByteLength=0) for index in range(3)])
        cli_cases.extend([dict(id=provider + '-no-overwrite-' + name, status='PASS', exitCode=17, expectedExitCode=17, stdout='', stdoutByteLength=0, unchanged=True) for name in ('generated', 'empty', 'dirty', 'file')])
    cli_cases.extend([dict(id=provider + '-unsupported', status='PASS', exitCode=10, expectedExitCode=10, stdout='', stdoutByteLength=0, outputAbsent=True) for provider in ('unknown', 'azure', 'github')])
    reports = {
        'suites': dict(status='PASS', stageDigest=pin, records=[dict(id=name, status='PASS', tests=count) for name, count in COUNTS.items()]
                       + [dict(id=name, status='PASS', exitCode=0, **({'instances': 116, 'negativeControls': 8} if name == 'full-2020-12' else {})) for name in sorted(AUXILIARY)]),
        'execution': dict(kind='MemoryOSPhase2BWindowsEquivalence', status='PASS', stageDigest=pin, liveProviderExecution=False,
                          caseCount=26, commandCount=78, cases=cases, commands=commands),
        'cli-generation': dict(kind='MemoryOSPhase2BCLIGenerationValidation', status='PASS', stageDistributionDigest=pin, liveProviderExecution=False,
                               caseCount=17, successfulGenerations=6, noOverwriteRejections=8, unsupportedProviderRejections=3,
                               exactRepeatedBytes=True, stageUnchanged=True, cases=cli_cases,
                               providers=[dict(provider=name, status='PASS', repetitions=3, noOverwriteCases=4) for name in ('gitlab', 'jenkins')]),
    }
    return acceptance, reports


class CheckerSelfTests(unittest.TestCase):
    def test_valid_synthetic_evidence(self):
        acceptance, reports = synthetic()
        validate_header(acceptance)
        validate_reports(acceptance, reports)
        acceptance['budget']['elapsedSeconds'] = 5401
        with self.assertRaises(EvidenceError):
            validate_header(acceptance)

    def test_valid_precommit_and_completion_graphs(self):
        self.assertEqual(validate_graph('mo1306/phase2b', INITIAL, [B1], 'original', [B1]), 'PRECOMMIT')
        self.assertEqual(validate_graph('mo1306/phase2b', 'a' * 40, [INITIAL], SUBJECT, [B1]), 'COMPLETION_COMMIT')

    def test_invalid_graphs(self):
        for head, parents, subject in [('a' * 40, [B1], SUBJECT), ('a' * 40, [INITIAL, B1], SUBJECT), ('a' * 40, [INITIAL], 'wrong'), (INITIAL, ['a' * 40], SUBJECT)]:
            with self.subTest(parents=parents, subject=subject), self.assertRaises(EvidenceError):
                validate_graph('mo1306/phase2b', head, parents, subject, [B1])

    def test_manifest_valid(self):
        data = b'{}\n'
        checked_rows([dict(path='docs/a.json', byteLength=len(data), sha256=sha(data))], lambda name: data, {'docs/a.json'})
        blob = hashlib.sha1(b'blob 3\0' + data).hexdigest()
        tree = ('100644 blob ' + blob + '\tdocs/a.json\0').encode()
        validate_committed_blobs({'docs/a.json'}, lambda name: data, tree)
        for changed, listing in [(b'{}\r\n', tree), (data, b''), (data, tree + tree)]:
            with self.subTest(data=changed, listing=listing), self.assertRaises(EvidenceError):
                validate_committed_blobs({'docs/a.json'}, lambda name: changed, listing)

    def test_noncanonical_and_duplicate_json(self):
        for data in [b'{ }\n', b'{}\r\n', b'{}', b'{"x":1,"x":1}\n', b'{"x":NaN}\n', b'\xef\xbb\xbf{}\n']:
            with self.subTest(data=data), self.assertRaises(EvidenceError):
                strict_json(data)

    def test_manifest_missing_file(self):
        def missing(name):
            raise FileNotFoundError(name)
        with self.assertRaises(EvidenceError):
            checked_rows([dict(path='docs/a', byteLength=3, sha256=sha(b'{}\n'))], missing)

    def test_historical_tree_and_provider_tampering(self):
        capability = dict(phase='2B', baseline=copy.deepcopy(HISTORY), implementationRevision=INITIAL,
                          generation={name: {'state': state} for name, state in
                            {'generic': 'IMPLEMENTED', 'gitlab': 'IMPLEMENTED', 'jenkins': 'IMPLEMENTED', 'github': 'NOT_IMPLEMENTED', 'azure': 'NOT_IMPLEMENTED'}.items()})
        validate_history(capability)
        for field in ('tree', 'evidenceTree', 'packageTree', 'contractsTestBlob', 'contractsTestSha256'):
            changed = copy.deepcopy(capability)
            changed['baseline'][field] = 'incorrect'
            with self.subTest(field=field), self.assertRaises(EvidenceError):
                validate_history(changed)
        changed = copy.deepcopy(capability)
        changed['baseline']['providers']['gitlab'] = 'IMPLEMENTED'
        with self.assertRaises(EvidenceError):
            validate_history(changed)

    def test_schema_instance_tampering(self):
        expected = {}
        for schema, count in dict(configuration=2, deployment=2, generation=2, summary=22, result=22, evidence=22, artifacts=22, complete=22).items():
            expected.update({(schema, schema + '-' + str(index)): {'index': index} for index in range(count)})
        report = dict(id='full-2020-12', status='PASS', instances=116, negativeControls=8,
                      engine='jsonschema 4.26.0 Draft202012Validator',
                      validated=[dict(schema=key[0], source=key[1], sha256=sha(j(value))) for key, value in expected.items()])
        validate_schema_report(report, expected)
        changed = copy.deepcopy(report)
        changed['validated'][0]['sha256'] = 'sha256:' + '0' * 64
        with self.assertRaises(EvidenceError):
            validate_schema_report(changed, expected)
        changed = copy.deepcopy(report)
        changed['validated'][-1] = changed['validated'][0]
        with self.assertRaises(EvidenceError):
            validate_schema_report(changed, expected)


def install_tamper_tests():
    header_mutations = {
        'wrong_baseline': lambda a: a.update(baseline='0' * 40),
        'wrong_implementation': lambda a: a.update(implementationRevision='0' * 40),
        'wrong_parent_pin': lambda a: a.update(intendedCompletionParent='0' * 40),
        'false_live_certification': lambda a: a['providers']['gitlab'].update(liveProviderCertified=True),
        'wrong_provider_status': lambda a: a['providers']['jenkins'].update(validation='NOT_IMPLEMENTED'),
        'extra_provider': lambda a: a['providers'].update(github=a['providers']['gitlab']),
        'bad_digest': lambda a: a.update(stageDigest='sha256:bad'),
    }
    for name, mutate in header_mutations.items():
        def run(self, mutate=mutate):
            acceptance, _ = synthetic()
            mutate(acceptance)
            with self.assertRaises(EvidenceError):
                validate_header(acceptance)
        setattr(CheckerSelfTests, 'test_header_tamper_' + name, run)
    report_mutations = {
        'stage_digest': lambda r: r['execution'].update(stageDigest='sha256:' + '2' * 64),
        'execution_count': lambda r: r['execution'].update(caseCount=25),
        'command_count': lambda r: r['execution'].update(commandCount=77),
        'cli_count': lambda r: r['cli-generation'].update(caseCount=16),
        'suite_count': lambda r: r['suites']['records'][0].update(tests=151),
        'schema_instance_count': lambda r: next(row for row in r['suites']['records'] if row['id'] == 'full-2020-12').update(instances=115),
        'schema_negative_count': lambda r: next(row for row in r['suites']['records'] if row['id'] == 'full-2020-12').update(negativeControls=7),
        'missing_suite': lambda r: r['suites']['records'].pop(),
        'duplicate_suite': lambda r: r['suites']['records'].append(r['suites']['records'][0]),
        'execution_live': lambda r: r['execution'].update(liveProviderExecution=True),
        'cli_live': lambda r: r['cli-generation'].update(liveProviderExecution=True),
        'missing_case': lambda r: r['execution']['cases'].pop(),
        'case_status': lambda r: r['execution']['cases'][0].update(status='FAIL'),
        'missing_summary': lambda r: r['execution']['cases'][0].update(summary=None),
        'semantic_class': lambda r: r['execution']['cases'][2]['summary'].update(classification='PASS'),
        'incomplete_summary': lambda r: r['execution']['cases'][0]['summary'].update(publication='PARTIAL'),
        'command_failure': lambda r: r['execution']['commands'][0].update(exitCode=1),
        'overwrite_claim': lambda r: r['cli-generation']['cases'][3].update(unchanged=False),
    }
    for name, mutate in report_mutations.items():
        def run(self, mutate=mutate):
            acceptance, reports = synthetic()
            mutate(reports)
            with self.assertRaises(EvidenceError):
                validate_reports(acceptance, reports)
        setattr(CheckerSelfTests, 'test_report_tamper_' + name, run)
    row_mutations = {
        'wrong_hash': lambda rows: rows[0].update(sha256='sha256:' + '0' * 64),
        'wrong_length': lambda rows: rows[0].update(byteLength=4),
        'boolean_length': lambda rows: rows[0].update(byteLength=True),
        'missing_row': lambda rows: rows.pop(),
        'duplicate_row': lambda rows: rows.append(dict(rows[0])),
        'unsafe_parent': lambda rows: rows[0].update(path='../docs/a'),
        'absolute_path': lambda rows: rows[0].update(path='C:/docs/a'),
        'backslash_path': lambda rows: rows[0].update(path='docs\\a'),
        'unc_path': lambda rows: rows[0].update(path='//host/share'),
        'device_path': lambda rows: rows[0].update(path='docs/NUL'),
        'unsorted': lambda rows: rows.reverse(),
        'case_collision': lambda rows: rows[1].update(path='DOCS/A'),
    }
    for name, mutate in row_mutations.items():
        def run(self, mutate=mutate):
            data = b'{}\n'
            rows = [dict(path=path, byteLength=len(data), sha256=sha(data)) for path in ('docs/a', 'docs/b')]
            mutate(rows)
            with self.assertRaises(EvidenceError):
                checked_rows(rows, lambda name: data, {'docs/a', 'docs/b'})
        setattr(CheckerSelfTests, 'test_manifest_tamper_' + name, run)


install_tamper_tests()


def main():
    def deny_network(*args, **kwargs):
        raise EvidenceError('evidence checker is offline')
    socket.socket = socket.create_connection = socket.getaddrinfo = deny_network
    if sys.argv[1:] == ['--self-test']:
        result = unittest.TextTestRunner(verbosity=2).run(unittest.defaultTestLoader.loadTestsFromTestCase(CheckerSelfTests))
        print(json.dumps(dict(status='PASS' if result.wasSuccessful() else 'FAIL', tests=result.testsRun)))
        return 0 if result.wasSuccessful() else 1
    require(not sys.argv[1:], 'usage: verify-evidence.py [--self-test]')
    print(json.dumps(verify(ROOT), sort_keys=True))
    return 0


if __name__ == '__main__':
    try:
        raise SystemExit(main())
    except (EvidenceError, OSError, KeyError, TypeError, subprocess.SubprocessError) as error:
        print(json.dumps(dict(status='FAIL', errorType=type(error).__name__, error=str(error))), file=sys.stderr)
        raise SystemExit(1)
