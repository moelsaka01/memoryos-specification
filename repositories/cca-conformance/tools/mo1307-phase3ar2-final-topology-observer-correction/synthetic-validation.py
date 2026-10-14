"""Zero-product synthetic validation for corrected topology identity semantics."""
import ast
from copy import deepcopy
from datetime import datetime, timezone
from hashlib import sha256
import importlib.util
import json
from pathlib import Path
import sys

ROOT = Path(__file__).resolve().parents[4]
TOOL = Path(__file__).resolve().parent
EVIDENCE = ROOT/'repositories/cca-conformance/evidence/mo1307/phase3ar2-final-topology-observer-correction'
AUTHORIZATION = Path(r'C:\Users\melsa\.codex\attachments\68250150-4313-40fa-84f8-a172c13d7516\Pasted text.txt')
AUTHORIZATION_SHA256 = '7604a8ea29a2423fd99a49a34724158e2ae9121531ea8e256f85bf44610f71a6'
PYTHON_SHA256 = '4278cf2a296f31737cae77cafeeb3dc71683094cf3b8fd6f3f02c968687e771c'
C3VB = '17fa84efe46d30e6f4be85fd2427485677a222a3'
C3V = '98b766f9218b209f52251147213839b9775f6da3'
PRODUCTION_TREE = 'b9dabf54572e06c96bb5e48c4e20671f2cc24053'


def digest(data):
    return 'sha256:'+sha256(data).hexdigest()


def record(path):
    data = path.read_bytes()
    return {'path': path.relative_to(ROOT).as_posix(), 'byteLength': len(data), 'sha256': digest(data)}


def write_once(name, value):
    target = EVIDENCE/name
    target.parent.mkdir(parents=True, exist_ok=True)
    data = (json.dumps(value, indent=2, sort_keys=True, separators=(',', ': '))+'\n').encode()
    with target.open('xb') as stream:
        stream.write(data)
    return record(target)


def put_once(name, data):
    target = EVIDENCE/name
    target.parent.mkdir(parents=True, exist_ok=True)
    with target.open('xb') as stream:
        stream.write(data)
    return record(target)


def base_rows():
    observer_session = 'synthetic-observer-session-1'
    parent_identity = {'pid': 50, 'creationTime100ns': 500, 'executable': r'C:\pinned\node.exe'}
    parent = {'identity': parent_identity, 'role': 'supervisor', 'parentIdentity': None, 'times': {'creationTime100ns': 500, 'exitTime100ns': 0}, 'signaledAt': None, 'firstObservedAt': {'qpc': 1, 'nativeUtc100ns': 500}, 'lastSeenAt': {'qpc': 200, 'nativeUtc100ns': 1900}, 'observerSession': observer_session}
    helper = {'identity': {'pid': 100, 'creationTime100ns': 1000, 'executable': r'C:\Windows\System32\WindowsPowerShell\v1.0\powershell.exe'}, 'role': 'helper', 'parentIdentity': parent_identity, 'times': {'creationTime100ns': 1000, 'exitTime100ns': 2000}, 'signaledAt': {'qpc': 300, 'nativeUtc100ns': 2100}, 'firstObservedAt': {'qpc': 100, 'nativeUtc100ns': 1100}, 'lastSeenAt': {'qpc': 200, 'nativeUtc100ns': 1900}, 'observerSession': observer_session}
    return parent, helper


def query_context():
    parent, helper = base_rows()
    return {'pid': 100, 'snapshotEntry': {'pid': 100, 'parentPid': 50, 'imageName': 'powershell.exe', 'snapshotTime100ns': 1950}, 'error': {'operation': 'QueryFullProcessImageNameW', 'winerror': 31, 'pid': 100, 'partialObjectProof': 'OPEN_PROCESS_HANDLE_AND_GET_PROCESS_TIMES', 'nativeTimes': {'creationTime100ns': 1000, 'exitTime100ns': 2000}}, 'knownRows': [parent, helper], 'requeryAt': {'qpc': 301, 'nativeUtc100ns': 2200}, 'observerSession': 'synthetic-observer-session-1'}


def build_cases():
    a = query_context();a['knownRows'] = a['knownRows'][:1]
    b = query_context()
    c = query_context();c['snapshotEntry']['parentPid'] = 51
    d = query_context();d['snapshotEntry']['imageName'] = 'conhost.exe'
    e = query_context();e['error']['nativeTimes']['creationTime100ns'] = 3000
    parent, helper = base_rows();f = {'prior': helper, 'knownRows': [parent, helper], 'observedAt': {'qpc': 302, 'nativeUtc100ns': 2300}, 'observerSession': 'synthetic-observer-session-1', 'snapshotSucceeded': True, 'snapshotPids': [50]}
    g = query_context();g['error']['operation'] = 'OpenProcess';g['error'].pop('partialObjectProof')
    return [
        {'id': 'A', 'description': 'unknown process plus identity query failure', 'method': 'query', 'context': a, 'expectedAccepted': False, 'expectedClassification': 'NO_PRIOR_POSITIVE_IDENTITY'},
        {'id': 'B', 'description': 'authenticated helper plus post-signal image re-query failure', 'method': 'query', 'context': b, 'expectedAccepted': True, 'expectedClassification': 'POST_IDENTITY_REQUERY_UNAVAILABLE'},
        {'id': 'C', 'description': 'same PID with contradictory parent', 'method': 'query', 'context': c, 'expectedAccepted': False, 'expectedClassification': 'PARENT_CONTRADICTION'},
        {'id': 'D', 'description': 'same PID with contradictory image', 'method': 'query', 'context': d, 'expectedAccepted': False, 'expectedClassification': 'IMAGE_CONTRADICTION'},
        {'id': 'E', 'description': 'same PID with replacement creation identity', 'method': 'query', 'context': e, 'expectedAccepted': False, 'expectedClassification': 'PID_REUSE_OR_REPLACEMENT_EVIDENCE'},
        {'id': 'F', 'description': 'authenticated process cleanly exited and absent after signal', 'method': 'absence', 'context': f, 'expectedAccepted': True, 'expectedClassification': 'TERMINATED_KNOWN_IDENTITY'},
        {'id': 'G', 'description': 'unrelated observation error', 'method': 'query', 'context': g, 'expectedAccepted': False, 'expectedClassification': 'INELIGIBLE_UNRELATED_OBSERVATION_ERROR'},
    ]


def main():
    assert sys.version_info[:3] == (3, 12, 14)
    assert sha256(Path(sys.executable).read_bytes()).hexdigest() == PYTHON_SHA256
    assert sha256(AUTHORIZATION.read_bytes()).hexdigest() == AUTHORIZATION_SHA256
    assert not EVIDENCE.exists(), 'Synthetic correction evidence must be fresh'
    EVIDENCE.mkdir(parents=True)
    forbidden_events = []
    forbidden_prefixes = ('subprocess.Popen', 'os.system', 'os.startfile', 'os.spawn', 'os.exec', 'os.posix_spawn', 'ctypes.dlopen')
    def audit(event, _args):
        if event.startswith(forbidden_prefixes):
            forbidden_events.append(event)
            raise RuntimeError('Forbidden synthetic-validation audit event: '+event)
    sys.addaudithook(audit)
    policy_path = TOOL/'topology_identity_policy.py'
    observer_path = TOOL/'runtime-controls-observer.py'
    forbidden_imports = {'subprocess', 'ctypes', 'multiprocessing'}
    ast_audit = []
    for source in (policy_path, Path(__file__)):
        tree = ast.parse(source.read_text(encoding='utf-8'), filename=str(source))
        imports = set()
        for node in ast.walk(tree):
            if isinstance(node, ast.Import):
                imports.update(alias.name.split('.')[0] for alias in node.names)
            elif isinstance(node, ast.ImportFrom) and node.module:
                imports.add(node.module.split('.')[0])
        imports = sorted(imports)
        rejected = sorted(forbidden_imports.intersection(imports))
        assert not rejected, (source, rejected)
        launch_names = {'Popen','run','call','check_call','check_output','system','startfile','spawnl','spawnle','spawnlp','spawnlpe','spawnv','spawnve','spawnvp','spawnvpe','execl','execle','execlp','execlpe','execv','execve','execvp','execvpe'}
        calls = sorted({node.func.id if isinstance(node.func, ast.Name) else node.func.attr for node in ast.walk(tree) if isinstance(node, ast.Call) and isinstance(node.func, (ast.Name, ast.Attribute)) and (node.func.id if isinstance(node.func, ast.Name) else node.func.attr) in launch_names})
        assert not calls, (source, calls)
        ast_audit.append({'source': record(source), 'imports': imports, 'forbiddenImports': rejected, 'forbiddenLaunchCalls': calls})
    observer_text = observer_path.read_text(encoding='utf-8')
    observer_tree = ast.parse(observer_text, filename=str(observer_path))
    observer_imports = set()
    for node in ast.walk(observer_tree):
        if isinstance(node, ast.Import):
            observer_imports.update(alias.name.split('.')[0] for alias in node.names)
        elif isinstance(node, ast.ImportFrom) and node.module:
            observer_imports.add(node.module.split('.')[0])
    assert not {'subprocess','multiprocessing'}.intersection(observer_imports)
    required_integration_tokens = ['partialObjectProof', 'classify_identity_query_failure', 'classify_terminated_known_identity', 'post_identity_requery_unavailable', 'terminated_known_identity', 'candidate_bound_identity_contradiction', 'candidate_pid_reuse_or_replacement', 'unresolvedIdentityFailures']
    assert all(token in observer_text for token in required_integration_tokens)
    ast_audit.append({'source': record(observer_path), 'imports': sorted(observer_imports), 'forbiddenProcessImports': [], 'requiredIntegrationTokens': required_integration_tokens})
    spec = importlib.util.spec_from_file_location('mo1307_topology_identity_policy', policy_path)
    policy = importlib.util.module_from_spec(spec);spec.loader.exec_module(policy)
    cases = build_cases()
    cases_before = json.dumps(cases, sort_keys=True, separators=(',', ':'))
    results = []
    for case in cases:
        evaluator = policy.classify_identity_query_failure if case['method'] == 'query' else policy.classify_terminated_known_identity
        first = evaluator(deepcopy(case['context']))
        second = evaluator(deepcopy(case['context']))
        assert json.dumps(first, sort_keys=True, separators=(',', ':')) == json.dumps(second, sort_keys=True, separators=(',', ':'))
        assert first['accepted'] is case['expectedAccepted']
        assert first['classification'] == case['expectedClassification']
        if first['accepted']:
            assert all(first['checks'].values())
        results.append({'id': case['id'], 'description': case['description'], 'expected': {'accepted': case['expectedAccepted'], 'classification': case['expectedClassification']}, 'actual': first, 'deterministicReplay': True, 'result': 'PASS'})
    assert json.dumps(cases, sort_keys=True, separators=(',', ':')) == cases_before
    assert [row['id'] for row in results if row['actual']['accepted']] == ['B', 'F']
    assert [row['id'] for row in results if not row['actual']['accepted']] == ['A', 'C', 'D', 'E', 'G']
    assert cases[0]['context']['error']['winerror'] == cases[1]['context']['error']['winerror'] == 31
    cross_session = query_context();cross_session['observerSession'] = 'synthetic-observer-session-2'
    cross_session_result = policy.classify_identity_query_failure(cross_session)
    assert cross_session_result['accepted'] is False and cross_session_result['classification'] == 'CROSS_SESSION_IDENTITY_REJECTED'
    post_exit_snapshot = query_context();post_exit_snapshot['snapshotEntry']['snapshotTime100ns'] = 2050
    post_exit_snapshot_result = policy.classify_identity_query_failure(post_exit_snapshot)
    assert post_exit_snapshot_result['accepted'] is True and post_exit_snapshot_result['classification'] == 'POST_IDENTITY_REQUERY_UNAVAILABLE'
    failed_gate_path = ROOT/'repositories/cca-conformance/evidence/mo1307/phase3ar2-final-b-gate/gate-receipt.json'
    failed_topology_path = ROOT/'repositories/cca-conformance/evidence/mo1307/phase3ar2-final-b-gate/topology/receipt.json'
    failed_gate = json.loads(failed_gate_path.read_text(encoding='utf-8'))
    failed_topology = json.loads(failed_topology_path.read_text(encoding='utf-8'))
    assert failed_gate['result'] == 'FAIL' and failed_gate['outcome'] == 'PHASE3AR2_CONCRETE_BLOCKER' and failed_gate['semanticInvocations'] == 1
    assert failed_topology['result'] == 'FAIL' and failed_topology['identityOrSnapshotFailures'] == 1
    assert len(failed_topology['observationErrors']) == 1
    defect = failed_topology['observationErrors'][0]
    assert defect['event'] == 'candidate_identity_unknown' and defect['pid'] == 2540 and defect['parentPid'] == 2140
    assert defect['error'] == {'operation': 'QueryFullProcessImageNameW', 'winerror': 31}
    authorization = put_once('authorization.txt', AUTHORIZATION.read_bytes())
    inputs = write_once('cases.json', cases)
    case_results = write_once('case-results.json', results)
    zero_proof = write_once('zero-execution-proof.json', {'mode': 'PURE_IN_PROCESS_POLICY_EVALUATION', 'semanticProductInvocations': 0, 'productRuns': 0, 'helperRuns': 0, 'nativeObserverRuns': 0, 'subprocessCalls': 0, 'engineeringInterpreterInvocations': 1, 'forbiddenAuditEvents': forbidden_events, 'astAudit': ast_audit, 'python': {'version': sys.version, 'executable': str(Path(sys.executable).resolve()), 'sha256': 'sha256:'+PYTHON_SHA256}})
    sources = write_once('source-bindings.json', {'policy': record(policy_path), 'correctedObserver': record(observer_path), 'validator': record(Path(__file__)), 'historicalFailedGate': record(failed_gate_path), 'historicalFailedTopology': record(failed_topology_path)})
    receipt = {'kind': 'MO1307Phase3AR2TopologyObserverSyntheticValidationReceipt', 'version': '1.0.0', 'result': 'PASS', 'createdAt': datetime.now(timezone.utc).isoformat(), 'candidate': C3VB, 'productionCommit': C3V, 'productionTree': PRODUCTION_TREE, 'policy': policy.POLICY_IDENTITY, 'defect': {'event': defect['event'], 'pid': defect['pid'], 'parentPid': defect['parentPid'], 'operation': defect['error']['operation'], 'winerror': defect['error']['winerror'], 'historicalIdentityOrSnapshotFailures': 1}, 'cases': {'required': ['A','B','C','D','E','F','G'], 'passed': 7, 'allRequiredCasesPassed': True, 'acceptedExactly': ['B','F'], 'failedClosedExactly': ['A','C','D','E','G']}, 'additionalSecurityProbes': [{'id': 'CROSS_SESSION', 'expected': 'CROSS_SESSION_IDENTITY_REJECTED', 'actual': cross_session_result, 'result': 'PASS'},{'id': 'POST_EXIT_SNAPSHOT_CLOCK', 'expected': 'POST_IDENTITY_REQUERY_UNAVAILABLE', 'actual': post_exit_snapshot_result, 'result': 'PASS'}], 'security': {'initialIdentityFailureStillFailsClosed': True, 'win32Error31GloballyIgnored': False, 'requiresPriorPositiveIdentity': True, 'requiresSameObserverSession': True, 'requiresExactCreationAndExitIdentity': True, 'requiresParentImageRoleAndLifetimeConsistency': True, 'pidReuseFailsClosed': True, 'unrelatedErrorsFailClosed': True, 'toolhelpSnapshotClockIsPostCaptureUpperBound': True}, 'execution': {'semanticProductInvocations': 0, 'productRuns': 0, 'helperRuns': 0, 'nativeObserverRuns': 0, 'engineeringInterpreterInvocations': 1, 'retry': False}, 'bindings': {'authorization': authorization, 'inputs': inputs, 'results': case_results, 'zeroExecutionProof': zero_proof, 'sources': sources}, 'productionModified': False, 'budgetsModified': False, 'wireModified': False, 'push': False, 'tag': False}
    write_once('receipt.json', receipt)
    print(json.dumps({'result': 'PASS', 'cases': 7, 'accepted': ['B','F'], 'productRuns': 0, 'helperRuns': 0, 'evidence': str(EVIDENCE)}))


if __name__ == '__main__':
    main()
