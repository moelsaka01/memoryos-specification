"""Offline independent GitHub workflow grammar and retained negative witnesses."""
import argparse
import base64
import hashlib
import importlib.metadata
import json
from pathlib import Path
import subprocess
import sys
import yaml

from github_validator import FIXTURES, HERE, validate_workflow, validate_ast
from safe_yaml import parse_yaml

ROOT = HERE.parents[3]


def mutation(base, case):
    text = base.decode('utf-8')
    operation = case.get('op', 'replace')
    if operation == 'replace':
        assert case['old'] in text, 'stale witness: ' + case['id']
        return text.replace(case['old'], case['new'], 1).encode('utf-8')
    if operation == 'remove-step':
        start = text.index("      - id: '" + case['step'] + "'")
        end = text.index('      - id:', start + 10)
        return (text[:start] + text[end:]).encode('utf-8')
    if operation == 'directory-upload':
        start = text.index('          path: |\n')
        end = text.index('          if-no-files-found:', start)
        return (text[:start] + '          path: _memoryos/data/.memoryos-ci/out/${{ steps.evaluate.outputs.run-id }}\n' + text[end:]).encode('utf-8')
    if operation == 'append-step':
        return base + b"      - id: 'injected'\n        run: 'Write-Output injected'\n"
    if operation == 'crlf': return base.replace(b'\n', b'\r\n')
    if operation == 'bom': return b'\xef\xbb\xbf' + base
    if operation == 'invalid-utf8': return base.replace(b'MemoryOS', b'\xed\xa0\x80', 1)
    if operation == 'extra-lf': return base + b'\n'
    raise AssertionError('unknown mutation ' + operation)


def main():
    parser = argparse.ArgumentParser()
    parser.add_argument('--node', type=Path, default=ROOT / '.cache/mo1306-phase2c/node.exe')
    parser.add_argument('--output', type=Path)
    args = parser.parse_args()
    assert sys.version_info[:2] == (3, 12), 'engineering Python 3.12 required'
    assert importlib.metadata.version('PyYAML') == '6.0.3', 'pinned parser required'
    assert Path(yaml.__file__).resolve().is_relative_to(ROOT / '.cache/mo1306-phase2c/validators'), 'use retained validator environment'
    binding = json.loads((FIXTURES / 'bindings.json').read_text(encoding='utf-8'))
    baseline = (FIXTURES / 'golden.yml').read_bytes()
    validate_workflow(baseline, binding)
    process = subprocess.run([str(args.node), str(HERE / 'github-fixture-bridge.mjs')], cwd=ROOT, capture_output=True, text=True, timeout=30,
                             creationflags=subprocess.CREATE_NO_WINDOW)
    assert process.returncode == 0, process.stderr
    bridge = json.loads(process.stdout)
    assert bridge['configurationDigest'] == binding['configurationDigest'] and bridge['deployment'] == binding['deployment']
    generated = base64.b64decode(next(row['base64'] for row in bridge['files'] if row['path'].endswith('.yml')), validate=True)
    assert generated == baseline, 'production bytes differ from independently authored retained golden'
    corrected = validate_workflow(generated, binding)
    spaced = base64.b64decode(next(row['base64'] for row in bridge['spaced']['files'] if row['path'].endswith('.yml')), validate=True)
    assert spaced == baseline.replace(b'configs\\memoryos-ci.json', b'configs\\review config.json')
    validate_workflow(spaced, bridge['spaced'])
    corpus = json.loads((FIXTURES / 'negative-corpus.json').read_text(encoding='utf-8'))
    outcomes = []
    for case in corpus['cases']:
        bad = mutation(baseline, case)
        assert bad != baseline
        try:
            validate_workflow(bad, binding)
        except Exception as error:
            outcomes.append({'id': case['id'], 'status': 'REJECTED', 'diagnostic': str(error), 'sha256': hashlib.sha256(bad).hexdigest()})
        else:
            raise AssertionError('negative unexpectedly accepted: ' + case['id'])
    # Exercise the AST comparator itself on valid but modified PowerShell.
    original_script = parse_yaml(baseline)['jobs']['memoryos_ci']['steps'][3]['run']
    ast_negatives = []
    for suffix in ["; Write-Output 'injected'", "\nWrite-Output 'injected'", " | Out-Null"]:
        try:
            validate_ast([{'id': 'evaluate-mutated', 'actual': original_script.rstrip('\n') + suffix + '\n', 'expected': original_script}])
        except Exception as error:
            ast_negatives.append({'suffix': suffix, 'status': 'REJECTED', 'diagnostic': str(error)})
        else:
            raise AssertionError('AST injection accepted')
    original = bridge['original']
    old_bytes = base64.b64decode(original['files'][0]['base64'], validate=True)
    # Original immutable bytes deliberately violate the current restricted
    # grammar. BaseLoader permits diagnostic inspection without constructors;
    # this is not acceptance through the strict parser above.
    old_doc = yaml.load(old_bytes.decode('utf-8'), Loader=yaml.BaseLoader)
    old_steps = {step['id']: step for step in old_doc['jobs']['memoryos_ci']['steps']}
    old_eval = old_steps['evaluate']['run']
    findings = {
        'pinned-node-bootstrap': 'Initialize-GitHubCI.ps1' not in old_steps['bootstrap']['run'] and 'MEMORYOS_CI_NODE' not in old_steps['bootstrap']['run'],
        'complete-success-output': "'complete=false'" in old_eval and 'complete=true' not in old_eval,
        'run-id-output': 'run-id=' not in old_eval,
        'upload-basename-allowlist': old_steps['upload']['with']['path'] == '_memoryos/data/.memoryos-ci/out/${{ steps.evaluate.outputs.run-id }}',
    }
    assert all(findings.values()), findings
    try:
        validate_workflow(old_bytes, binding)
    except Exception as error:
        old_rejection = str(error)
    else:
        raise AssertionError('original incomplete workflow unexpectedly accepted')
    actions = json.loads((FIXTURES / 'action-pins.json').read_text(encoding='utf-8'))
    assert [row['repository'] + '@' + row['revision'] for row in actions['actions']] == corrected['actions']
    source_paths = ['repositories/memoryos-ci/src/providers/github.mjs', 'repositories/memoryos-ci/templates/github.yml.tpl', 'repositories/memoryos-ci/scripts/Initialize-GitHubCI.ps1', 'repositories/memoryos-ci/scripts/Invoke-GitHubCI.ps1', 'repositories/memoryos-ci/scripts/github-transport.mjs', 'repositories/memoryos-ci/src/github-transport.mjs', 'repositories/cca-conformance/fixtures/mo1306/engineering-validator-lock.json']
    source_bindings = [{'path': path, 'byteLength': len((ROOT/path).read_bytes()), 'sha256': hashlib.sha256((ROOT/path).read_bytes()).hexdigest()} for path in source_paths]
    report = {'kind': 'MemoryOSPhase2CGitHubContractValidation', 'version': '1.0.0', 'status': 'PASS',
              'scope': 'offline structure/AST/determinism, no hosted execution', 'parser': {'name': 'PyYAML', 'version': importlib.metadata.version('PyYAML')},
              'workflow': {'path': '.github/workflows/memoryos-ci.yml', 'byteLength': len(generated), 'sha256': hashlib.sha256(generated).hexdigest()},
              'contract': corrected, 'sourceBindings': source_bindings, 'negativeCount': len(outcomes), 'negatives': outcomes, 'astNegativeCount': len(ast_negatives), 'astNegatives': ast_negatives,
              'determinism': {**bridge['determinism'], 'spacedConfigEscaping': True, 'goldenByteEquality': True}, 'metadata': bridge['metadata'],
              'originalDiagnostic': {'revision': original['revision'], 'sourceSha256': original['sourceSha256'], 'workflowSha256': hashlib.sha256(old_bytes).hexdigest(), 'workflowBase64': original['files'][0]['base64'], 'confirmedDeficiencies': findings, 'validator': 'REJECTED', 'diagnostic': old_rejection},
              'actions': actions, 'providerStatus': 'IMPLEMENTED', 'hostedCertification': 'HOSTED_EXECUTION_CERTIFICATION_PENDING'}
    if args.output:
        assert args.output.resolve().is_relative_to(ROOT), 'evidence must remain in Phase 2C'
        args.output.parent.mkdir(parents=True, exist_ok=True)
        args.output.write_text(json.dumps(report, indent=2, sort_keys=True) + '\n', encoding='utf-8', newline='\n')
    print(json.dumps({'status': 'PASS', 'negativeCount': len(outcomes), 'astNegativeCount': len(ast_negatives), 'workflowSha256': report['workflow']['sha256'], 'originalRejected': True}, sort_keys=True))


if __name__ == '__main__':
    main()
