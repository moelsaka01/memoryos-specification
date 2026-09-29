"""Read-only authority extraction; writes only this task's new evidence directory."""
import datetime
import hashlib
import json
import math
import os
from pathlib import Path
import subprocess
import sys

ROOT = Path(__file__).resolve().parents[4]
OUT = ROOT / 'repositories/cca-conformance/evidence/mo1307/helper-deadline-design'
OLD = ROOT / 'repositories/cca-conformance/evidence/mo1307/helper-deadline-characterization'
R3A = ROOT.parent / 'r3a'
R3B = ROOT.parent / 'r3b'
R3C = ROOT.parent / 'r3c'
EV = 'repositories/cca-conformance/evidence/mo1307/'
LIMITS = {'helperDeadlineMs': 5000, 'helperAggregateDeadlineMs': 20000,
          'cliDeadlineMs': 30000, 'apiDeadlineMs': 10000, 'cleanupAllowanceMs': 2000,
          'evaluateHelperInvocations': 9, 'verifyHelperInvocations': 4}


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


def row(path, base):
    name = path.relative_to(base).as_posix()
    if path.is_symlink():
        return {'path': name, 'type': 'symlink', 'target': os.readlink(path)}
    data = path.read_bytes()
    return {'path': name, 'type': 'file', 'byteLength': len(data),
            'sha256': 'sha256:' + hashlib.sha256(data).hexdigest()}


def preservation(phase):
    inventory_path = OLD / 'authority-source-before.json'
    inventory = read(inventory_path)
    sources = []
    inputs = []
    for source in inventory['sources']:
        root = Path(source['root'])
        paths = sorted(set(filter(None, git(root, 'ls-files', '--cached', '--others', '--exclude-standard', '-z').split('\0'))))
        expected = sorted(source['files'], key=lambda x: x['path'])
        actual = [row(root / p, root) for p in paths]
        assert actual == expected, source['id'] + ': source inventory differs'
        metadata = {
            'head': git(root, 'rev-parse', 'HEAD').strip(),
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
        actual = [row(p, root) for p in paths]
        assert actual == sorted(source['files'], key=lambda x: x['path']), source['case'] + ': input differs'
        inputs.append({'case': source['case'], 'root': str(root), 'fileCount': len(actual),
                       'filesChecked': len(actual), 'fileNamesUnchanged': True, 'allFilesUnchanged': True})
    result = {'kind': 'MO1307HelperDeadlineDesignAuthoritySourcePreservation', 'version': '1.0.0',
              'phase': phase, 'result': 'PASS', 'capturedAtUtc': now(),
              'inventory': pin(inventory_path), 'priorAfter': pin(OLD / 'authority-source-after.json'),
              'sources': sources, 'inputRoots': inputs,
              'sourceFilesChecked': sum(x['fileCount'] for x in sources),
              'inputFilesChecked': sum(x['fileCount'] for x in inputs),
              'allInventoriedFilesAndGitStatusUnchanged': True, 'sourceWorktreeWrites': False,
              'scope': 'Same complete nonignored source inventory and original B/C/D input-root inventory as the immutable characterization snapshot; no native process launched.'}
    if phase == 'AFTER':
        result['before'] = pin(OUT / 'authority-source-before.json')
    write('authority-source-' + phase.lower() + '.json', result)


def derived(run):
    rows = run['requests']
    assert len(rows) == 9 and [r['sequence'] for r in rows] == list(range(1, 10))
    total = sum(x['chargedSupervisorActiveMs'] for x in rows)
    assert math.isclose(total, run['supervisorHelperActiveMs'], abs_tol=1e-8)
    other = sum(x['chargedSupervisorActiveMs'] for x in rows if x['sequence'] != 3)
    worker = run['workerStartEventToQuiescentMs']
    run['derived'] = {
        'sumChargesMatchesRecordedSupervisorTotal': True,
        'acquisitionRequests1Through4Ms': sum(x['chargedSupervisorActiveMs'] for x in rows[:4]),
        'publicationInspectionRequests5Through9Ms': sum(x['chargedSupervisorActiveMs'] for x in rows[4:]),
        'request3ChargeMs': rows[2]['chargedSupervisorActiveMs'],
        'otherEightHelperChargesMs': other,
        'aggregateRemainingMs': 20000 - total,
        'request3ReplacementCeilingWithOtherEightObservedChargesMs': 20000 - other,
        'cliRemainingAtLifecycleFinishMs': 30000 - run['lifecycleMs'],
        'lifecycleMinusHelperChargesMinusWorkerEventIntervalMs': run['lifecycleMs'] - total - worker,
        'residualInterpretation': 'Arithmetic remainder includes orchestration, parsing, staging, exact byte reads, rename, output and clock endpoint differences; it is not an isolated publication or CPU measurement.',
        'replacementInterpretation': 'Counterfactual arithmetic only: observed other-eight durations held fixed. No reservation, future performance guarantee or new measured execution.'}
    return run


def analyses():
    loc = R3A / (EV + 'phase3a-refresh-localization')
    final = R3A / (EV + 'phase3a-refresh-final')
    timings = read(loc / 'per-request-timing.json')['timings']
    clocks = read(loc / 'clock-determination.json')['runs']
    runs = []
    for timing, clock in zip(timings, clocks):
        assert timing['execution'] == clock['execution']
        runs.append(derived({
            'id': 'localization-diagnostic-' + str(timing['execution']),
            'scope': 'DIAGNOSTIC_ONLY_NOT_CERTIFICATION', 'externalSampler': timing['externalSampler'],
            'sources': [pin(loc / 'per-request-timing.json', R3A), pin(loc / 'clock-determination.json', R3A),
                        pin(loc / ('diagnostic-' + str(timing['execution']) + '/receipt.json'), R3A)],
            'lifecycleMs': timing['lifecycleMs'],
            'workerStartEventToQuiescentMs': clock['workerStartEventToQuiescentMs'],
            'supervisorHelperActiveMs': clock['supervisorHelperActiveMs'],
            'publication': clock['publication'], 'requests': timing['requests'],
            'sequenceAggregateExactDuration': clock['sequenceAggregateExactDuration']}))
    for name, identity in [('A-mo1306-qualified', 'final-generation-primary-mo1306'), ('B-ready', 'final-generation-ready')]:
        base = final / ('semantics/' + name + '/evaluate')
        observation = read(base / 'observation.json')
        receipt = read(base / 'receipt.json')
        sup = observation['supervisors'][0]['snapshot']
        starts = [e for e in sup['events'] if e['type'] == 'start' and e.get('role') == 'worker']
        ends = [e for e in sup['events'] if e['type'] == 'quiescent' and e.get('role') == 'worker']
        requests = [{'sequence': q['sequence'], 'operation': q['operation'], 'fileCount': q['fileCount'],
                     'requestBytes': q['requestBytes'], 'requestSha256': q['requestSha256'],
                     'exchangeDurationMs': q['durationMs'],
                     'chargedSupervisorActiveMs': q['chargedThisExchangeMs'],
                     'disposition': q['disposition'], 'responseAcceptedByTransport': q['responseAcceptedByTransport']}
                    for q in observation['requests']]
        runs.append(derived({'id': identity, 'scope': 'OBSERVED_PASS_INSIDE_RETAINED_BLOCKED_FINAL_CERTIFICATION',
                            'sources': [pin(base / 'observation.json', R3A), pin(base / 'receipt.json', R3A)],
                            'lifecycleMs': receipt['productLifecycleElapsedMs'], 'parentWallMs': receipt['elapsedMs'],
                            'workerStartEventToQuiescentMs': ends[0]['at'] - starts[0]['at'],
                            'supervisorHelperActiveMs': receipt['helperUsedMs'],
                            'publication': sup['publication'], 'requests': requests,
                            'sequenceAggregateExactDuration': 'NOT_EXPOSED; production sequence checks passed'}))
    aggregate = {
        'kind': 'MO1307HelperDeadlineDesignAggregateAnalysis', 'version': '1.0.0',
        'result': 'ANALYSIS_COMPLETE_NO_NORMATIVE_CHANGE', 'capturedAtUtc': now(), 'currentLimits': LIMITS,
        'scope': 'Existing successful nine-request observations only; all original failed and blocked certification states remain unchanged. READY is a distinct 19-file workload and not pooled with MO1306.',
        'runs': runs,
        'model': {
            'perInvocationAdmission': 'min(CLI absolute deadline, helper launch + H, helper launch + (20000 - prior charged helper-active time))',
            'aggregateMeaning': '20,000ms remains a shared budget across up to nine evaluate invocations or four verify invocations; raising H does not authorize 9*H or 4*H active time.',
            'clocks': 'Supervisor measures helper launch through accepted completion and required quiescence; private sequence clock begins before framing and confirms helperExited. These are overlapping distinct enforcement clocks, not additive charges.',
            'terminalFailure': 'Failed current intervals need not enter successful helperUsedMs. The effective active deadline still constrains them; timeout is terminal and cannot provide a free replacement invocation.',
            'coherence': 'Keeping the 20,000ms aggregate limit is mathematically coherent with a higher finite H because every admission remains clipped to remaining aggregate and CLI time. It does not guarantee all admitted workloads finish.',
            'multiSlowInvocation': 'Nine invocations cannot each consume a raised H unless their sum remains below 20,000ms; slow preceding calls can make aggregate time the next effective bound.',
            'evidenceLimit': 'No new nine-helper aggregate campaign is authorized here. Four retained complete traces expose supervisor totals; only three are MO1306. Finite observations do not establish a worst-case or tail bound.'},
        'productionEdits': False, 'newNativeExecutions': 0}
    write('aggregate-analysis.json', aggregate)
    smokes = []
    for name in ['mo1306', 'ready']:
        path = ROOT / (EV + 'phase3a-readset-correction/cli-smoke/' + name + '/receipt.json')
        receipt = read(path)
        smokes.append({'case': name, 'source': pin(path), 'recordedReceipt': receipt,
                       'helperActiveTotal': 'NOT_EXPOSED_BY_THIS_RECEIPT',
                       'interpretation': 'CLI wall time is not helper-active time; a successful nine-helper smoke establishes completion under unchanged controls only.'})
    cli = {'kind': 'MO1307HelperDeadlineDesignCLIAnalysis', 'version': '1.0.0',
           'result': 'ANALYSIS_COMPLETE_NO_NORMATIVE_CHANGE', 'capturedAtUtc': now(), 'currentLimits': LIMITS,
           'sources': [pin(ROOT / 'repositories/memoryos-readiness/src/runtime.mjs'),
                       pin(ROOT / 'repositories/memoryos-readiness/src/helper-protocol.mjs'),
                       pin(ROOT / 'repositories/memoryos-readiness/src/publication.mjs'),
                       pin(ROOT / 'repositories/memoryos-readiness/src/index.mjs')],
           'nineHelperRuns': [{'id': r['id'], 'lifecycleMs': r['lifecycleMs'],
                               'supervisorHelperActiveMs': r['supervisorHelperActiveMs'],
                               'workerEventToQuiescenceMs': r['workerStartEventToQuiescentMs'],
                               'derived': r['derived'], 'publication': r['publication']} for r in runs],
           'standalonePackagedCLISmokes': smokes,
           'budgetAnalysis': {
               'sequencing': 'Evaluate: acquisition helper requests 1-4; exactly one worker; publication inspection helper requests 5-9. Verify-decision: four helper requests and one worker. Helpers and worker do not overlap.',
               'arithmetic': '20000 + 10000 = 30000 leaves zero separately reserved time for all other work if both maxima are consumed. Independent maxima are ceilings, not reservations or simultaneous entitlements.',
               'coherence': 'CLI admission remains coherent because the worker and every helper are clipped to the same absolute 30000ms deadline. Successful completion at each component maximum is not promised.',
               'worker': 'Worker keeps its existing 10000ms cap and remaining CLI cap; public API keeps a separate 10000ms supervisor deadline and invokes no native helper.',
               'cleanup': 'A terminal failure fixes a single 2000ms cleanup allowance; changing H does not refresh that allowance, authorize retry, or convert unconfirmed cleanup into success.',
               'publication': 'Before finalization admission, deadline or cancellation prevents rename. After the sole non-cancellable rename has been submitted, actual settlement must be awaited; this existing exception is not bounded by CLI30000. Following observed settlement, one shared 2000ms read-only confirmation/disposition allowance applies. There is no reset, rollback, second rename or success-stdout extension. A late committed namespace is retained and yields OUTPUT21.',
               'stdout': 'Timely verified publication may transport the exact summary only within the original CLI deadline; output failure after commit retains the namespace.',
               'HOnlyChange': 'A later separately authorized numeric helper-bound correction alone must not silently alter aggregate, CLI, API, worker, cleanup, cancellation, finalization-admission or post-admission settlement rules.',
               'unresolvedPerformance': 'These observed traces leave positive helper and CLI slack, but no measured guarantee covers simultaneous slow calls, worst-case worker work, OS contention, or finalization settlement.'},
           'newNativeExecutions': 0, 'productionEdits': False}
    write('cli-analysis.json', cli)


def authority():
    prior = read(OLD / 'authority-binding.json')
    bindings = {}
    for binding in prior['sourceBindings']:
        actual = pin(Path(binding['sourceRoot']) / binding['path'], Path(binding['sourceRoot']))
        assert actual == binding, 'Prior authority binding changed: ' + binding['path']
        bindings[(actual['sourceRoot'], actual['path'])] = actual
    additions = [
        (ROOT, 'docs/mo1307-helper-deadline-characterization.md'),
        (ROOT, 'docs/mo1307-phase2d-integration.md'),
        (ROOT, 'docs/mo1307-phase3a-readset-correction.md'),
        (ROOT, 'docs/mo1307-contract-freeze-1.md'),
        (ROOT, 'docs/mo1307-phase1-foundation.md'),
        (ROOT, 'docs/mo1307-phase2c-publication-inspection-correction.md'),
        (ROOT, 'docs/mo1307-phase2c-finalization-boundary-correction.md'),
        (ROOT, 'repositories/memoryos-readiness/src/runtime.mjs'),
        (ROOT, 'repositories/memoryos-readiness/src/helper-protocol.mjs'),
        (ROOT, 'repositories/memoryos-readiness/src/publication.mjs'),
        (ROOT, 'repositories/memoryos-readiness/src/index.mjs'),
        (ROOT, 'repositories/memoryos-readiness/contracts/definitions.json'),
        (ROOT, EV + 'helper-deadline-characterization/statistics.json'),
        (ROOT, EV + 'helper-deadline-characterization/campaign.json'),
        (ROOT, EV + 'helper-deadline-characterization/decision.json'),
        (ROOT, EV + 'helper-deadline-characterization/deadline-source-analysis.json'),
        (ROOT, EV + 'helper-deadline-characterization/security-analysis.json'),
        (R3A, EV + 'phase3a-refresh-localization/per-request-timing.json'),
        (R3A, EV + 'phase3a-refresh-localization/clock-determination.json'),
        (R3A, EV + 'phase3a-refresh-localization/diagnostic-1/receipt.json'),
        (R3A, EV + 'phase3a-refresh-localization/diagnostic-2/receipt.json'),
        (R3A, EV + 'phase3a-refresh-final/semantics/A-mo1306-qualified/evaluate/observation.json'),
        (R3A, EV + 'phase3a-refresh-final/semantics/A-mo1306-qualified/evaluate/receipt.json'),
        (R3A, EV + 'phase3a-refresh-final/semantics/B-ready/evaluate/observation.json'),
        (R3A, EV + 'phase3a-refresh-final/semantics/B-ready/evaluate/receipt.json'),
    ]
    for root, relative in additions:
        actual = pin(root / relative, root)
        bindings[(actual['sourceRoot'], actual['path'])] = actual
    assert git(ROOT, 'rev-parse', 'HEAD').strip() == '6d444e323f8048712908eaff22712eeac8a4e6b3'
    dispositions = []
    for source in prior['acceptedCertificationSources']:
        copied = dict(source)
        copied['currentApplicability'] = 'UNCHANGED_FOR_EXACT_C3RB_BYTES_ONLY'
        copied['futureNumericHelperBoundCorrection'] = 'TARGETED_REFRESH_REQUIRED'
        copied['designDoesNotRefreshOrPromoteCertification'] = True
        dispositions.append(copied)
    write('authority-binding.json', {
        'kind': 'MO1307HelperDeadlineDesignAuthorityBinding', 'version': '1.0.0',
        'result': 'BOUND_READ_ONLY_AUTHORITY', 'capturedAtUtc': now(),
        'baseline': {'commit': '6d444e323f8048712908eaff22712eeac8a4e6b3',
                     'parent': 'defe93989efc6501b1a730b82e79e705884b269b',
                     'subject': 'docs(memoryos-1.3): characterize MO-1307 helper deadline',
                     'baselineGateOwner': 'Parent agent; initial clean-main gate retained separately'},
        'priorAuthorityBinding': pin(OLD / 'authority-binding.json'),
        'priorSourceInventory': pin(OLD / 'authority-source-before.json'),
        'newSourcePreservationBefore': pin(OUT / 'authority-source-before.json'),
        'sourceBindings': sorted(bindings.values(), key=lambda x: (x['sourceRoot'], x['path'])),
        'analyses': [pin(OUT / 'aggregate-analysis.json'), pin(OUT / 'cli-analysis.json')],
        'readingScope': {
            'completeReports': ['r3a refresh', 'r3a refresh localization', 'r3a refresh final',
                                'r3b accepted refresh', 'r3c accepted refresh',
                                'main Phase2D integration', 'main READ_SET correction',
                                'main helper-deadline characterization'],
            'completeReceipts': ['r3a initial/final blocked receipts and localization observations',
                                 'r3b accepted artifact receipt', 'r3c accepted security receipt'],
            'traceExtraction': 'Both localization nine-request observations and final-generation MO1306/READY complete evaluation observations; packaged correction CLI smoke receipts; runtime and publication enforcement sources.',
            'otherAuthorityReview': 'Freeze and both contract corrections are source-bound here; the design team also reviews their complete normative scope.'},
        'historicalStatesPreserved': {
            'oldReadSetDiagnostic': 'ROOT_CAUSE_ESTABLISHED; historical failed native campaign is not restamped',
            'first3ARefresh': 'CERTIFICATION_BLOCKED',
            'localization': 'Two diagnostic successes are not certification',
            'final3ARefresh': 'BLOCKED at Step G post-tag-absent evaluate; later finite gates and final MO1306 confirmation remain unexecuted',
            'finalStepG': {'request': 3, 'operation': 'READ_SET', 'fileCount': 19,
                           'transportDurationMs': 5063.5788, 'terminalAfterEffectiveDeadlineMs': 7.8233,
                           'cleanupConfirmed': False},
            'characterization': 'Exactly25 retained samples:24 successes and one natural CaseC timeout; no retry or silent sample removal',
            'characterizationNaturalTimeout': {'sample': '20-C', 'wholeInvocationDurationMs': 5024.6567,
                                               'transportExchangeDurationMs': 5026.5788,
                                               'terminalAfterEffectiveDeadlineMs': 3.4001,
                                               'productCleanupConfirmed': False,
                                               'externalHeldHelperAndConsoleHandlesSignaled': True,
                                               'externalObservationDoesNotPromoteProductCleanupFlag': True},
            'untracedEarlierTimeouts': 'Exact limiting interval and complete cleanup are unknown where the retained receipt does not expose them; no cause is invented'},
        'requestReconstructionBoundary': {
            'finalGenerationBCDExactFrames': 'NOT_RETAINED; request hashes/lengths and descriptors remain recorded, but original sessions/frame buffers were deleted by the observer serializer',
            'priorCharacterizationReplay': 'Declared new sessions and reconstructed requests using exact original roots and manifest/file bytes; not exact historical frame replay',
            'BD': 'Identical ordered19-file READ_SET descriptors and19711 source bytes, but distinct original roots; D has an extra ancestor and remains a workload surrogate for its unavailable exact historical frame',
            'C': 'Exact declared65-file2004208-byte MO1306 workload is distinct from B/D',
            'olderDiagnosticFrames': 'Separately retained older exact frames are valid only for their original sessions, paths, generation and pins; not substituted for unavailable final-generation frames'},
        'acceptedCertificationSources': dispositions,
        'certificationImpact': {
            'currentDesign': 'No production bytes, normative limits, package metadata or certification dispositions change.',
            'future3A': 'A separately authorized implementation and runtime recertification must rerun its finite declared gate set, preserve failures, and establish actual new-bound native, aggregate, CLI, worker, cleanup and publication behavior.',
            'future3B': 'Changed definitions/constants and their manifest/SBOM/distribution closure invalidate exact artifact identity. Refresh archive hashes/integrity, checksums and package verification code, independent deterministic assemblies, offline install/provenance and exact receipt binding. Affected dependency reuse must be explicit.',
            'future3C': 'Refresh numerical boundary, equality, late-helper rejection, aggregate/CLI admission, DoS occupancy, terminal mapping, cleanup and exact source identity controls. Preserve cancellation/finalization behavior and unchanged semantic controls only through exact dependency analysis.',
            'release': '3D integration, outstanding Node advisory applicability/risk disposition, UNLICENSED/NOASSERTION boundaries and human release authority remain separate; this evidence grants no release approval.'},
        'nativeLaunchesByAuthorityAgent': 0, 'productionEdits': False, 'sourceWorktreeWrites': False})


if __name__ == '__main__':
    if len(sys.argv) != 2 or sys.argv[1] not in ['before', 'after', 'analyses', 'authority']:
        raise SystemExit('Usage: authority-evidence.py before|after|analyses|authority')
    if sys.argv[1] == 'analyses':
        analyses()
    elif sys.argv[1] == 'authority':
        authority()
    else:
        preservation(sys.argv[1].upper())
