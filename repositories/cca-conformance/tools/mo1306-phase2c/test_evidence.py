"""Receipt-validator negatives; mutations remain in memory, never on disk."""
import argparse
import copy
import json
from pathlib import Path
import evidence


def rejected(identity, operation):
    try:
        operation()
    except AssertionError:
        return {'id': identity, 'status': 'REJECTED'}
    raise AssertionError('Evidence validator accepted negative: ' + identity)


def main():
    parser = argparse.ArgumentParser()
    parser.add_argument('--record', action='store_true')
    args = parser.parse_args()
    baseline = evidence.required_gates()
    original_read = evidence.read
    mutations = [
        ('bootstrap-count-13', 'github-bootstrap.json', lambda value: value.update(passed=13)),
        ('github-negative-count-49', 'github-contract.json', lambda value: value.update(negativeCount=49)),
        ('azure-subset-failure', 'azure-validation.json', lambda value: value['positive'].update(subsetValidation='FAIL')),
        ('final-suite-failure', 'final-suites.json', lambda value: value['suites'][0].update(status='FAIL')),
        ('wrong-wrapper-distribution', 'github-wrapper.json', lambda value: value.update(productionDigest='sha256:'+'0'*64)),
        ('engineering-wheel-hash', 'engineering-inputs.json', lambda value: value['dependencies'][0].update(sha256='sha256:'+'0'*64)),
        ('overwrite-accepted-exit-zero', 'cli-generation.json', lambda value: value['cases'][0].update(noOverwriteExit=0)),
    ]
    cases = []
    for identity, filename, mutate in mutations:
        changed = copy.deepcopy(original_read(filename))
        mutate(changed)
        try:
            evidence.read = lambda name, selected=filename, value=changed: copy.deepcopy(value) if name == selected else original_read(name)
            cases.append(rejected(identity, evidence.required_gates))
        finally:
            evidence.read = original_read
    traversal = 'repositories/cca-conformance/evidence/mo1306/phase2c/bundles/../oracles'
    cases.append(rejected('scoped-path-traversal', lambda: evidence.scoped(traversal, evidence.OUT/'bundles')))
    member = evidence.row(evidence.PKG/'package.json')
    member['sha256'] = 'sha256:'+'0'*64
    cases.append(rejected('bound-member-hash', lambda: evidence.binding(member)))
    assert evidence.read is original_read and evidence.required_gates() == baseline
    report = {
        'kind': 'MemoryOSPhase2CEvidenceValidatorTests', 'version': '1.0.0', 'status': 'PASS',
        'positiveCount': 1, 'negativeCount': len(cases), 'cases': cases,
        'mutationScope': 'In-memory deep-copy receipts and helper arguments only; no real evidence or package mutation',
        'productionDigest': evidence.sha((evidence.PKG/'distribution-manifest.json').read_bytes()),
        'sourceBindings': [evidence.row(Path(__file__).resolve()), evidence.row(evidence.HERE/'evidence.py')],
    }
    if args.record:
        assert evidence.git('rev-parse', 'HEAD') == evidence.ORIGINAL, 'Use read-only mode after completion commit'
        target = evidence.OUT/'evidence-negative-tests.json'
        target.parent.mkdir(parents=True, exist_ok=True)
        target.write_bytes(evidence.j(report))
    print(json.dumps(report, sort_keys=True))


if __name__ == '__main__':
    main()
