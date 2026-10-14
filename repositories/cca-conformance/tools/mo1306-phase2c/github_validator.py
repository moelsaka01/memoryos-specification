"""Independent Contract Freeze 1 section 16.5 YAML/PowerShell validator.

This module does not import or call the product renderer. Bindings are trusted
review inputs, never extracted from the submitted workflow. The YAML parser
rejects unsafe constructs before this closed ordered grammar is checked.
"""
import argparse
import json
import re
import subprocess
import tempfile
from pathlib import Path

from safe_yaml import parse_yaml

CHECKOUT = 'actions/checkout@3d3c42e5aac5ba805825da76410c181273ba90b1'
UPLOAD = 'actions/upload-artifact@043fb46d1a93c77aae656e7c1c64a875d1fc6a0a'
BASENAMES = ['evaluation-identity.json', 'memoryos-ci-artifacts.json',
             'memoryos-ci-complete.json', 'memoryos-ci-evidence.json',
             'memoryos-ci-result.json', 'policy-outcome.json']
HERE = Path(__file__).resolve().parent
FIXTURES = HERE.parent.parent / 'fixtures' / 'mo1306-phase2c' / 'github'
POWERSHELL = Path('C:/Windows/System32/WindowsPowerShell/v1.0/powershell.exe')


class ContractError(ValueError):
    pass


def require(condition, message):
    if not condition:
        raise ContractError(message)


def keys(value, expected, where):
    require(type(value) is dict and list(value) == expected,
            f'{where}: closed ordered keys differ')


def exact(value, expected, where):
    # Python bool subclasses int, so independently enforce scalar kind.
    require(type(value) is type(expected) and value == expected,
            f'{where}: unexpected scalar kind or value')


def script_for(step, binding):
    helper = 'Initialize-GitHubCI' if step == 'bootstrap' else 'Invoke-GitHubCI'
    mode = '' if step == 'bootstrap' else f"-Mode '{'Evaluate' if step == 'evaluate' else 'Gate'}' "
    config_path = binding['deployment']['options']['configPath'].replace('/', '\\')
    return '\n'.join([
        "$ErrorActionPreference = 'Stop'",
        "$env:MEMORYOS_CI_HOME = [IO.Path]::Combine($env:GITHUB_WORKSPACE, '_memoryos\\tool\\repositories\\memoryos-ci')",
        f"$env:MEMORYOS_CI_CONFIG = [IO.Path]::Combine($env:GITHUB_WORKSPACE, '_memoryos\\tool\\{config_path}')",
        f"& ([IO.Path]::Combine($env:MEMORYOS_CI_HOME, 'scripts\\{helper}.ps1')) {mode}-WorkspaceRoot $env:GITHUB_WORKSPACE -ConfigurationDigest '{binding['configurationDigest']}' -DistributionDigest '{binding['deployment']['distributionDigest']}'",
        'exit $LASTEXITCODE',
        '',
    ])


def validate_ast(scripts):
    scratch = HERE.parents[3] / '.cache' / 'mo1306-phase2c'
    scratch.mkdir(parents=True, exist_ok=True)
    with tempfile.TemporaryDirectory(prefix='github-ast-', dir=scratch) as temp:
        request = Path(temp) / 'request.json'
        request.write_text(json.dumps({'scripts': scripts}), encoding='utf-8')
        process = subprocess.run([str(POWERSHELL), '-NoLogo', '-NoProfile', '-NonInteractive',
                                  '-ExecutionPolicy', 'Bypass', '-File', str(HERE / 'check-github-powershell.ps1'),
                                  '-InputPath', str(request)], capture_output=True, text=True, timeout=30,
                                 creationflags=subprocess.CREATE_NO_WINDOW)
        require(process.returncode == 0, 'PowerShell AST/argv rejected: ' + process.stderr.strip())
        return json.loads(process.stdout)


def validate_workflow(data, binding, check_ast=True):
    require(type(binding) is dict, 'trusted binding required')
    options = binding['deployment']['options']
    for name, value in [('configuration', binding['configurationDigest']), ('distribution', binding['deployment']['distributionDigest'])]:
        require(bool(re.fullmatch(r'sha256:[0-9a-f]{64}', value)), f'{name} binding digest invalid')
    require(bool(re.fullmatch(r'[A-Za-z0-9_-][A-Za-z0-9_.-]{0,99}/[A-Za-z0-9_-][A-Za-z0-9_.-]{0,99}', options['repository'])) and '..' not in options['repository'], 'repository binding invalid')
    require(bool(re.fullmatch(r'[0-9a-f]{40}', options['toolRevision'])), 'tool revision binding invalid')
    config_path = options['configPath']
    require(type(config_path) is str and 0 < len(config_path) <= 240 and bool(re.fullmatch(r'[A-Za-z0-9_. /-]+', config_path)), 'config path binding alphabet')
    parts = config_path.split('/')
    require(parts[0].lower() != '.memoryos-ci' and all(0 < len(p) <= 100 and p not in ('.', '..') and not p.startswith(' ') and not p.endswith((' ', '.')) and not re.match(r'^(?:con|prn|aux|nul|com[1-9]|lpt[1-9])(?:\.|$)', p, re.I) for p in parts), 'config path binding invalid')
    document = parse_yaml(data)
    keys(document, ['name', 'on', 'permissions', 'jobs'], 'workflow')
    exact(document['name'], 'MemoryOS Provider-Neutral CI', 'workflow identity')
    keys(document['on'], ['workflow_dispatch'], 'triggers')
    exact(document['on']['workflow_dispatch'], {}, 'dispatch inputs')
    keys(document['permissions'], ['contents'], 'permissions')
    exact(document['permissions']['contents'], 'read', 'contents permission')
    keys(document['jobs'], ['memoryos_ci'], 'jobs')
    job = document['jobs']['memoryos_ci']
    keys(job, ['name', 'runs-on', 'timeout-minutes', 'steps'], 'job')
    exact(job['name'], 'MemoryOS CI', 'job display identity')
    exact(job['runs-on'], 'windows-2022', 'runner OS')
    exact(job['timeout-minutes'], 10, 'timeout')
    steps = job['steps']
    require(type(steps) is list and len(steps) == 6, 'exact six steps required')
    require([s.get('id') if type(s) is dict else None for s in steps] == ['tools', 'data', 'bootstrap', 'evaluate', 'upload', 'gate'], 'ordered step identity differs')
    for index, identity in [(0, 'tools'), (1, 'data')]:
        step = steps[index]
        keys(step, ['id', 'uses', 'with'], identity)
        exact(step['uses'], CHECKOUT, identity + ' checkout pin')
        settings = step['with']
        expected_keys = ['repository', 'ref', 'path', 'persist-credentials', 'submodules', 'lfs'] if index == 0 else ['ref', 'path', 'persist-credentials', 'submodules', 'lfs']
        keys(settings, expected_keys, identity + ' checkout')
        if index == 0:
            exact(settings['repository'], options['repository'], 'tool repository')
        exact(settings['ref'], options['toolRevision'] if index == 0 else '${{ github.sha }}', identity + ' revision')
        exact(settings['path'], '_memoryos/tool' if index == 0 else '_memoryos/data', identity + ' path')
        for flag in ['persist-credentials', 'submodules', 'lfs']:
            exact(settings[flag], False, identity + ' ' + flag)
    scripts = []
    for index, identity in [(2, 'bootstrap'), (3, 'evaluate'), (5, 'gate')]:
        step = steps[index]
        expected_keys = ['id', 'shell', 'run'] if identity != 'gate' else ['id', 'if', 'shell', 'env', 'run']
        keys(step, expected_keys, identity)
        exact(step['shell'], 'powershell', identity + ' shell')
        expected = script_for(identity, binding)
        exact(step['run'], expected, identity + ' fixed script and pinned invocation')
        require('${{' not in step['run'], identity + ' shell expressions forbidden')
        scripts.append({'id': identity, 'actual': step['run'], 'expected': expected})
    gate = steps[5]
    exact(gate['if'], 'always()', 'gate condition')
    keys(gate['env'], ['COMPLETE', 'EXIT_CODE', 'RUN_ID', 'EVALUATE_OUTCOME', 'UPLOAD_OUTCOME'], 'gate env')
    for name, expression in [('COMPLETE', 'steps.evaluate.outputs.complete'), ('EXIT_CODE', 'steps.evaluate.outputs.exit-code'),
                             ('RUN_ID', 'steps.evaluate.outputs.run-id'), ('EVALUATE_OUTCOME', 'steps.evaluate.outcome'), ('UPLOAD_OUTCOME', 'steps.upload.outcome')]:
        exact(gate['env'][name], '${{ ' + expression + ' }}', 'gate ' + name)
    upload = steps[4]
    keys(upload, ['id', 'if', 'uses', 'with'], 'upload')
    exact(upload['if'], "always() && steps.evaluate.outputs.complete == 'true'", 'upload completion condition')
    exact(upload['uses'], UPLOAD, 'upload immutable pin')
    keys(upload['with'], ['name', 'path', 'if-no-files-found', 'include-hidden-files', 'retention-days'], 'upload settings')
    exact(upload['with']['name'], 'memoryos-ci-${{ github.run_id }}-${{ github.run_attempt }}', 'artifact operational name')
    expected_paths = ''.join('_memoryos/data/.memoryos-ci/out/${{ steps.evaluate.outputs.run-id }}/' + name + '\n' for name in BASENAMES)
    exact(upload['with']['path'], expected_paths, 'artifact basename allowlist')
    exact(upload['with']['if-no-files-found'], 'error', 'missing artifacts failure')
    exact(upload['with']['include-hidden-files'], True, 'hidden allowlisted files')
    exact(upload['with']['retention-days'], 7, 'bounded artifact retention')
    ast = validate_ast(scripts) if check_ast else None
    return {'status': 'PASS', 'workflow': 'MemoryOS Provider-Neutral CI', 'runner': 'windows-2022',
            'projection': {'provider': 'github', 'workspaceCapability': 'GITHUB_WORKSPACE/_memoryos/data',
                           'configurationDigest': binding['configurationDigest'], 'distributionDigest': binding['deployment']['distributionDigest'],
                           'configurationPath': '_memoryos/tool/' + options['configPath'], 'timeoutMinutes': 10,
                           'trustedLauncher': 'Invoke-GitHubCI.ps1 -> Invoke-MemoryOSCI.ps1',
                           'result': 'verified complete bundle; original common exit projected by final gate',
                           'runId': 'core-generated verified UUID; provider GITHUB_RUN_ID is metadata.runId only'},
            'actions': [CHECKOUT, UPLOAD], 'artifactBasenames': BASENAMES, 'ast': ast}


if __name__ == '__main__':
    parser = argparse.ArgumentParser()
    parser.add_argument('workflow', type=Path)
    parser.add_argument('--bindings', type=Path, default=FIXTURES / 'bindings.json')
    args = parser.parse_args()
    print(json.dumps(validate_workflow(args.workflow.read_bytes(), json.loads(args.bindings.read_text(encoding='utf-8'))), sort_keys=True))
