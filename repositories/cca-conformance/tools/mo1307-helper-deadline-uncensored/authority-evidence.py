"""Read-only authority and timing analysis; never launches the native helper."""
import datetime
import hashlib
import json
import math
import os
from pathlib import Path
import subprocess
import sys

ROOT = Path(__file__).resolve().parents[4]
EV = 'repositories/cca-conformance/evidence/mo1307/'
OUT = ROOT / (EV + 'helper-deadline-uncensored')
DESIGN = ROOT / (EV + 'helper-deadline-design')
CHARACTERIZATION = ROOT / (EV + 'helper-deadline-characterization')
R3A = ROOT.parent / 'r3a'
BASELINE = '1e78a9a963ea945847a9192f8ec3a9ce2b4e7cc5'
C3RB = 'defe93989efc6501b1a730b82e79e705884b269b'


def read(path):
    return json.loads(Path(path).read_text(encoding='utf-8-sig'))


def pin(path, root=ROOT):
    path = Path(path)
    data = path.read_bytes()
    return {'sourceRoot': str(root), 'path': path.relative_to(root).as_posix(),
            'byteLength': len(data), 'sha256': 'sha256:' + hashlib.sha256(data).hexdigest()}


def write(name, value):
    OUT.mkdir(parents=True, exist_ok=True)
    path = OUT / name
    if path.exists():
        raise RuntimeError('Refusing to overwrite retained evidence: ' + str(path))
    path.write_text(json.dumps(value, ensure_ascii=False, indent=2) + '\n', encoding='utf-8', newline='\n')
    print(json.dumps(pin(path)))


def now():
    return datetime.datetime.now(datetime.timezone.utc).isoformat()


def git(root, *args):
    env = dict(os.environ, GIT_OPTIONAL_LOCKS='0')
    return subprocess.check_output(['git', '-c', 'safe.directory=' + str(root), '-C', str(root), *args],
                                   env=env).decode('utf-8')


def file_row(path, base):
    name = path.relative_to(base).as_posix()
    if path.is_symlink():
        return {'path': name, 'type': 'symlink', 'target': os.readlink(path)}
    data = path.read_bytes()
    return {'path': name, 'type': 'file', 'byteLength': len(data),
            'sha256': 'sha256:' + hashlib.sha256(data).hexdigest()}


def preservation(phase):
    inventory_path = CHARACTERIZATION / 'authority-source-before.json'
    inventory = read(inventory_path)
    sources = []
    inputs = []
    for source in inventory['sources']:
        root = Path(source['root'])
        paths = sorted(set(filter(None, git(root, 'ls-files', '--cached', '--others', '--exclude-standard', '-z').split('\0'))))
        actual = [file_row(root / p, root) for p in paths]
        assert actual == sorted(source['files'], key=lambda x: x['path']), source['id'] + ': source differs'
        metadata = {'head': git(root, 'rev-parse', 'HEAD').strip(),
                    'parents': git(root, 'show', '-s', '--format=%P', 'HEAD').strip().split(),
                    'subject': git(root, 'show', '-s', '--format=%s', 'HEAD').strip(),
                    'branch': git(root, 'branch', '--show-current').strip(),
                    'statusPorcelain': git(root, 'status', '--porcelain=v1', '--untracked-files=all')}
        for key, value in metadata.items():
            assert value == source[key], source['id'] + ': Git ' + key + ' differs'
        sources.append({'id': source['id'], 'root': str(root), **metadata,
                        'fileCount': len(actual), 'filesChecked': len(actual),
                        'fileNamesUnchanged': True, 'allFilesUnchanged': True,
                        'gitMetadataAndStatusUnchanged': True})
    for source in inventory['inputRoots']:
        root = Path(source['root'])
        paths = sorted((p for p in root.rglob('*') if p.is_file() or p.is_symlink()),
                       key=lambda p: p.relative_to(root).as_posix())
        actual = [file_row(p, root) for p in paths]
        assert actual == sorted(source['files'], key=lambda x: x['path']), source['case'] + ': input differs'
        inputs.append({'case': source['case'], 'root': str(root), 'fileCount': len(actual),
                       'filesChecked': len(actual), 'fileNamesUnchanged': True, 'allFilesUnchanged': True})
    result = {'kind': 'MO1307UncensoredAuthoritySourcePreservation', 'version': '1.0.0',
              'phase': phase, 'result': 'PASS', 'capturedAtUtc': now(), 'baseline': BASELINE,
              'inventory': pin(inventory_path), 'priorAfter': pin(DESIGN / 'authority-source-after.json'),
              'sources': sources, 'inputRoots': inputs,
              'sourceFilesChecked': sum(x['fileCount'] for x in sources),
              'inputFilesChecked': sum(x['fileCount'] for x in inputs),
              'allInventoriedFilesAndGitStatusUnchanged': True, 'sourceWorktreeWrites': False,
              'scope': 'All tracked/untracked nonignored files and symlink targets in exact accepted r3a/r3b/r3c source states; all original B/C/D input-root files. Git administrative and unrelated ignored caches excluded. No native launch.'}
    if phase == 'AFTER':
        result['before'] = pin(OUT / 'source-before.json')
    write('source-' + phase.lower() + '.json', result)


def transfer_brackets():
    loc = R3A / (EV + 'phase3a-refresh-localization/per-request-timing.json')
    rows = []
    for timing in read(loc)['timings']:
        q2, q3, q4 = timing['requests'][1:4]
        origin = q3['effectiveSupervisorDeadline'] - 5000
        next_origin = q4['effectiveSupervisorDeadline'] - 5000
        before = origin - q2['supervisorQuiescentAt']
        after = next_origin - q3['supervisorQuiescentAt']
        rows.append({'id': 'localization-diagnostic-' + str(timing['execution']),
                     'source': pin(loc, R3A),
                     'previousQuiescenceToSlot3SupervisorOriginMs': before,
                     'slot3QuiescenceToNextSupervisorOriginMs': after,
                     'combinedObservedBracketMs': before + after,
                     'slot3TransportEntryToSupervisorOriginMs': origin - q3['exchangeStart']})
    final = R3A / (EV + 'phase3a-refresh-final/semantics/A-mo1306-qualified/evaluate/observation.json')
    observation = read(final)
    events = observation['supervisors'][0]['snapshot']['events']
    starts = {e['ordinal']: e for e in events if e['type'] == 'start' and e.get('role') == 'helper'}
    ends = {e['ordinal']: e for e in events if e['type'] == 'quiescent' and e.get('role') == 'helper'}
    before = starts[3]['deadline'] - 5000 - ends[2]['at']
    after = starts[4]['deadline'] - 5000 - ends[3]['at']
    rows.append({'id': 'final-generation-primary-mo1306', 'source': pin(final, R3A),
                 'previousQuiescenceToSlot3SupervisorOriginMs': before,
                 'slot3QuiescenceToNextSupervisorOriginMs': after,
                 'combinedObservedBracketMs': before + after,
                 'slot3TransportEntryToSupervisorOriginMs': starts[3]['deadline'] - 5000 - observation['requests'][2]['enteredAt']})
    assert all(x['combinedObservedBracketMs'] > 0 for x in rows)
    return {'rows': rows, 'maximumCombinedObservedBracketMs': max(x['combinedObservedBracketMs'] for x in rows),
            'interpretation': 'Each observed bracket surrounds actual slot3 sequence work before/after the supervisor interval, but also contains unrelated prior/current snapshot parsing and next-request setup. It is a loose containment interval for that recorded run, not pure sequence time or a future upper bound.',
            'notAdditiveToOfflineCalibration': True,
            'noQBound': 'These brackets and offline calibration measure overlapping work. Do not add them together or convert the maximum into a population or scheduling bound.'}


def analyses():
    aggregate_source = DESIGN / 'aggregate-analysis.json'
    cli_source = DESIGN / 'cli-analysis.json'
    prior_aggregate = read(aggregate_source)
    prior_cli = read(cli_source)
    definitions_path = ROOT / 'repositories/memoryos-readiness/contracts/definitions.json'
    limits = read(definitions_path)['limits']
    assert limits['helperDeadlineMs'] == 5000
    assert limits['helperAggregateDeadlineMs'] == 20000
    assert limits['cliDeadlineMs'] == 30000
    assert limits['apiDeadlineMs'] == 10000
    assert limits['cleanupAllowanceMs'] == 2000
    calibration_path = OUT / 'private-sequence-transfer.json'
    calibration = read(calibration_path)
    assert calibration['iterations'] == 10 and calibration['nativeLaunches'] == 0
    assert calibration['Q']['numericBoundMs'] is None
    for row in calibration['rows']:
        t = row['timestamps']
        assert math.isclose(row['totalMeasuredTransferMs'], t['afterHelperExited'] - t['beforeBegin'], abs_tol=1e-9)
    runs = prior_aggregate['runs']
    for run in runs:
        assert len(run['requests']) == 9
        assert math.isclose(sum(q['chargedSupervisorActiveMs'] for q in run['requests']), run['supervisorHelperActiveMs'], abs_tol=1e-8)
    common = {'version': '1.0.0', 'baseline': BASELINE, 'productBaseline': C3RB,
              'capturedAtUtc': now(), 'scope': 'READ_ONLY_CONDITIONAL_C1_ANALYSIS',
              'candidateHMs': None, 'numericHSelectedByThisAnalysis': False,
              'productionChanges': False, 'freezeChanges': False, 'certification': False}
    write('aggregate-analysis.json', {
        **common, 'kind': 'MO1307UncensoredAggregateAnalysis', 'result': 'C1_CONDITIONALLY_COHERENT',
        'sourceBindings': [pin(aggregate_source), pin(definitions_path), pin(calibration_path)],
        'currentAggregateMs': 20000, 'runs': runs, 'retainedTransferBrackets': transfer_brackets(),
        'conditionalFormula': 'At supervisor launch S, effective deadline=min(original CLI deadline D,S+H,S+(20000-prior charged helper-active time)). Private sequence separately enforces its earlier interval and own aggregate.',
        'noNineTimesH': True,
        'conditionalAssessment': 'For every finite H in the permitted analysis domain, aggregate admission still clips to the remaining 20000ms budget. This is mathematically coherent without reserving H for each slot. It does not guarantee nine requests can all consume H or that a measured standalone success passes the private sequence.',
        'tightestRetainedMO1306OtherEightMs': max(r['derived']['otherEightHelperChargesMs'] for r in runs if 'ready' not in r['id']),
        'tightestRetainedMO1306Slot3ReplacementCeilingMs': min(r['derived']['request3ReplacementCeilingWithOtherEightObservedChargesMs'] for r in runs if 'ready' not in r['id']),
        'counterfactualLimit': 'A replacement calculation holds the other eight observed durations fixed. No fresh full CLI/nine-helper campaign occurs here, no unknown duration is substituted, and successful-charge totals omit the current failed interval rather than granting a retry.',
        'C1FailureCriterion': 'If a later selected H requires an aggregate increase to satisfy the declared operational claim, this conditional C1 assessment is insufficient and a separately authorized broader design is required.',
        'currentDisposition': 'Retain20000. No evidence in this read-only analysis proves it must increase.',
        'nativeLaunchesByThisAnalysis': 0})
    write('cli-analysis.json', {
        **common, 'kind': 'MO1307UncensoredCLIAnalysis', 'result': 'RETAIN_EXISTING_ADMISSION_AND_RELATED_LIMITS',
        'sourceBindings': [pin(cli_source), pin(definitions_path), pin(calibration_path),
                           pin(ROOT / 'repositories/memoryos-readiness/src/runtime.mjs'),
                           pin(ROOT / 'repositories/memoryos-readiness/src/index.mjs'),
                           pin(ROOT / 'repositories/memoryos-readiness/src/publication.mjs')],
        'currentLimits': {'cliAdmissionMs': 30000, 'apiMs': 10000, 'workerMs': 10000, 'cleanupMs': 2000},
        'retainedNineHelperRuns': prior_cli['nineHelperRuns'],
        'budgetAnalysis': prior_cli['budgetAnalysis'],
        'transfer': {'offlineCalibration': pin(calibration_path), 'observedMaximumMs': calibration['summary']['totalMeasuredTransferMs']['max'],
                     'globalOrFutureQBoundMs': None, 'retainedLiveBrackets': transfer_brackets(),
                     'unknowns': calibration['unmeasured'],
                     'rounding': 'A500ms deterministic grid does not by itself establish coverage of numerically unbounded residual uncertainty; no new admission clock or padding is inferred.'},
        'separateEngineeringClock': 'An authorized20000ms engineering observation guard observes the unchanged helper beyond5000; it is not the product CLI supervisor or an API/worker deadline change.',
        'currentDisposition': 'Retain30000 CLI admission,10000 API/worker and2000 cleanup. The existing one-rename post-admission settlement exception is not broadened.',
        'nativeLaunchesByThisAnalysis': 0})
    write('security-analysis.json', {
        **common, 'kind': 'MO1307UncensoredSecurityAnalysis', 'result': 'PARAMETERIZED_SECURITY_REVIEW_NO_NUMERIC_BOUND',
        'sourceBindings': [pin(DESIGN / 'security-dos-analysis.json'), pin(definitions_path),
                           pin(ROOT / 'repositories/memoryos-readiness/helpers/windows-inspect.ps1'),
                           pin(ROOT / 'repositories/memoryos-readiness/src/helper-protocol.mjs'),
                           pin(ROOT / 'repositories/memoryos-readiness/src/helper-transport.mjs'),
                           pin(ROOT / 'repositories/memoryos-readiness/src/runtime.mjs')],
        'allCurrentDefinitionLimits': limits,
        'candidateOccupancy': {'domain': '5000 < H <=20000, only if later established and separately authorized',
                               'nonClippedAdditionalSingleHelperMs': 'H-5000',
                               'actualAdditionalPermittedIntervalMs': 'max(0,min(H,remainingAggregate,remainingCLI))-max(0,min(5000,remainingAggregate,remainingCLI))',
                               'aggregate': 'No independent increase; active work remains clipped by20000 shared budget.',
                               'cli': 'No independent admission increase; original30000 deadline remains. It is not a universal process-lifetime ceiling after timely admitted non-cancellable rename.',
                               'cleanupStart': 'A larger H may postpone refusal and the start of the original terminal+2000 cleanup; no extension/reset or late-success rescue is permitted.'},
        'threatAssessment': [
            {'control': 'Attacker-influenced bounded workload', 'finding': 'Explicit manifest paths and untrusted file content, path depth/layout and local I/O can consume work before semantic rejection.128 files,2097152 bytes per raw source,8388608 aggregate bytes and all full path/frame/JSON/identity-chain caps remain unchanged.'},
            {'control': 'PowerShell/process occupancy', 'finding': 'One fresh fixed helper and possible attributable console only; no service/pool/persistence/additional product role or helper/worker overlap. Longer H would allow longer finite occupancy only after separate authority.'},
            {'control': 'Native boundary checks', 'finding': 'Exact unchanged C3RB helper preserves regular-file, reparse, hardlink, volume/final-path, held/fresh identity and cap+1 checks. No helper instrumentation/copy/optimization or changed request algorithm is authorized.'},
            {'control': 'Protocol and late response', 'finding': 'Exact framing/session/sequence/order/content validation, exit0/EOF/closed pipes and required console quiescence remain success requirements. Production still rejects at its strict effective deadline; engineering later completion cannot restore production success.'},
            {'control': 'Terminal and cleanup', 'finding': 'Failure is terminal, no replacement/retry/reset. At engineering20000 guard, owned cleanup is bounded2000 and campaign stops; unconfirmed proof remains unconfirmed. Product cleanup semantics are unchanged.'},
            {'control': 'Observer and uncertainty', 'finding': 'Ten offline actual-sequence measurements quantify only a finite local transfer window. Scheduler/async continuation/GC/timer/console-attribution uncertainties are not numerically bounded by their maximum; no guessed subtraction or arbitrary padding.'},
            {'control': 'Publication and external authority', 'finding': 'No publication or certification is performed by this evidence task. Existing rename admission/actual settlement/disposition truth, human authenticity and release-authority boundaries remain.'},
            {'control': 'Memory and concurrency', 'finding': 'Existing worker heap bounds and all parser/frame allocation ceilings remain. The512MiB engineering RSS acceptance figure is not a hard whole-process sandbox; host-level independent API concurrency remains outside this single-invocation control.'}],
        'engineeringClassification': {'atMost5000': 'WITHIN_PRODUCT_BOUND per authorized observation terminology; exact equality is still rejected by the unchanged strict production checkpoint',
                                      'greaterThan5000AtMost20000': 'SUCCESSFUL_COMPLETION_BEYOND_PRODUCT_BOUND / PRODUCT_DEADLINE_EXCEEDED; never a product PASS',
                                      'noValidCompletionBy20000': 'ENGINEERING_GUARD_EXCEEDED; campaign stop and design blocker'},
        'numericSecurityAcceptance': 'NOT_EVALUATED_WITHOUT_ESTABLISHED_H',
        'nativeLaunchesByThisAnalysis': 0})
    prior_impact = read(DESIGN / 'recertification-impact.json')
    write('recertification-impact.json', {
        **common, 'kind': 'MO1307UncensoredRecertificationImpact', 'result': 'CURRENT_ACCEPTED_SCOPES_PRESERVED',
        'sourceBindings': [pin(DESIGN / 'recertification-impact.json'), *prior_impact['sourceBindings']],
        'acceptedSources': prior_impact['acceptedSources'],
        'currentDisposition': prior_impact['currentDisposition'],
        'onFutureNumericCorrection': prior_impact['onFutureNumericCorrection'],
        'phase3BR': prior_impact['phase3BR'], 'phase3CR': prior_impact['phase3CR'],
        'phase3AR': {'state': 'BLOCKED', 'future': 'Fresh separately authorized certification of the existing finite gate set is required, including original StepG and unexecutedH-O; old failures/cleanup limitations remain historical.'},
        'limitationsPreserved': prior_impact['limitationsPreserved'],
        'noNewCertification': 'Uncensored engineering completion, including a future selected proposed H, is not runtime/package/security certification or release approval.3D, push and tag remain unauthorized.',
        'minimalFutureNumericCorrection': 'If separately authorized, the prior design identifies five shipped members affected by definitions/constants and contract/SPDX/distribution closure. Exact new package/archive/provenance binding and targeted artifact/security refresh remain required even with unchanged helper bytes.',
        'nativeLaunchesByThisAnalysis': 0})


def authority():
    prior_path = DESIGN / 'authority-binding.json'
    prior = read(prior_path)
    bindings = {}
    for descriptor in prior['sourceBindings']:
        actual = pin(Path(descriptor['sourceRoot']) / descriptor['path'], Path(descriptor['sourceRoot']))
        assert actual == descriptor, descriptor['path']
        bindings[(actual['sourceRoot'], actual['path'])] = actual
    for path in ['docs/mo1307-helper-deadline-design.md', EV + 'helper-deadline-design/decision.json',
                 EV + 'helper-deadline-design/candidate-comparison.json', EV + 'helper-deadline-design/characterization-binding.json',
                 EV + 'helper-deadline-design/aggregate-analysis.json', EV + 'helper-deadline-design/cli-analysis.json',
                 EV + 'helper-deadline-design/security-dos-analysis.json', EV + 'helper-deadline-design/recertification-impact.json',
                 EV + 'helper-deadline-design/statistics.json', EV + 'helper-deadline-design/campaign.json',
                 EV + 'helper-deadline-characterization/sample-plan.json',
                 'repositories/memoryos-readiness/helpers/windows-inspect.ps1']:
        actual = pin(ROOT / path)
        bindings[(actual['sourceRoot'], actual['path'])] = actual
    helper = pin(ROOT / 'repositories/memoryos-readiness/helpers/windows-inspect.ps1')
    assert helper['byteLength'] == 30210 and helper['sha256'] == 'sha256:35381850f1ef8c322e528156ebd8779071ad3288cdccd4d0ebab51ce6f9c6ac8'
    assert git(ROOT, 'rev-parse', 'HEAD').strip() == BASELINE
    plan = read(CHARACTERIZATION / 'sample-plan.json')
    cases = [{k: c[k] for k in ['id', 'operation', 'fileCount', 'aggregateBytes', 'requestFrameBytes', 'request', 'root', 'manifest']}
             for c in plan['cases'] if c['id'] in ['C', 'E']]
    for case in cases:
        actual = pin(ROOT / case['request']['path'])
        assert all(actual[k] == case['request'][k] for k in ['path', 'byteLength', 'sha256'])
    write('authority-binding.json', {
        'kind': 'MO1307UncensoredAuthorityBinding', 'version': '1.0.0', 'result': 'BOUND_READ_ONLY_AUTHORITY',
        'capturedAtUtc': now(), 'baseline': BASELINE, 'parent': '6d444e323f8048712908eaff22712eeac8a4e6b3', 'productBaseline': C3RB,
        'priorAuthorityBinding': pin(prior_path), 'sourceBefore': pin(OUT / 'source-before.json'),
        'sourceBindings': sorted(bindings.values(), key=lambda x: (x['sourceRoot'], x['path'])),
        'readingScope': 'Complete prior source-bound authority reads remain applicable to byte-identical Freeze, both corrections, READ_SET correction, Phase2D, characterization, r3a reports/receipts and accepted r3b/r3c reports/receipts. The new design report and current user authorization were read completely; current exact sequence/transport/acquisition code was reread in full.',
        'currentAuthority': {'helperMs': 5000, 'aggregateMs': 20000, 'cliMs': 30000, 'apiMs': 10000, 'workerMs': 10000, 'cleanupMs': 2000,
                             'wholeLifecycle': 'Pre-spawn through startup/request/transport/process settlement and attributable-console quiescence. Private sequence starts earlier and ends later around framing/response decode/exit bookkeeping.'},
        'engineeringAuthority': {'guardMs': 20000, 'cleanupMs': 2000, 'maximumC': 60, 'maximumE': 10, 'maximumTotal': 70,
                                 'scope': 'Separate finite observation mode only, exact production helper and request algorithm. Completions beyond5000 are product-bound exceedances, never production PASS.',
                                 'retries': 0, 'replacementRuns': 0, 'adaptiveExpansion': False},
        'exactCases': cases,
        'requestIdentityBoundary': 'Use the now-retained exact characterization C/E frames, not the unavailable original final3A-R session buffers and not older alternate-root frames. Those older seq1/2 frames are used only in explicitly derived in-memory offline sequence bootstrap calibration.',
        'historicalStatesPreserved': prior['historicalStatesPreserved'],
        'additionalPriorDesignHistory': {'result': 'MORE_CHARACTERIZATION_REQUIRED', 'planned': 25, 'executed': 10, 'C': 8, 'E': 2,
                                         'success': 9, 'naturalTimeout': 1, 'unexecuted': 15, 'cleanupConfirmedAtTimeout': False,
                                         'newEngineeringTaskDoesNotRestampPriorFailure': True},
        'acceptedCertificationSources': prior['acceptedCertificationSources'],
        'privateSequenceCalibration': pin(OUT / 'private-sequence-transfer.json'),
        'productionEdits': False, 'sourceWorktreeWrites': False, 'nativeLaunchesByAuthorityAgent': 0,
        'certification': False, 'phase3AR': 'BLOCKED'})


if __name__ == '__main__':
    if len(sys.argv) != 2 or sys.argv[1] not in ['before', 'after', 'analyses', 'authority']:
        raise SystemExit('Usage: authority-evidence.py before|after|analyses|authority')
    if sys.argv[1] == 'analyses':
        analyses()
    elif sys.argv[1] == 'authority':
        authority()
    else:
        preservation(sys.argv[1].upper())
