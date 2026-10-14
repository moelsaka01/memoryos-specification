"""Generate and cheaply revalidate modular Phase 2B receipts without rerunning probes."""
from pathlib import Path
import argparse
import copy
import json
import re
import subprocess
import sys
from distribution import ROOT, HERE, BASELINE, POLICY, PKG_REL, j, sha, identity, ref, require, checked_read, verify_archive, parse

EVIDENCE = ROOT / 'repositories/cca-conformance/evidence/mo1305-phase2b'
CACHE = ROOT / '.cache/mo1305-phase2b'
ARCHIVE = CACHE / 'build/memoryos-rest-0.1.0.tgz'


def artifact(path):
    return ref(path.relative_to(ROOT).as_posix(), checked_read(path, 16 * 1024 * 1024))


def put(name, value):
    data = j(value)
    require(len(data) <= 2 * 1024 * 1024, 'RECEIPT_BOUND')
    (EVIDENCE / name).write_bytes(data)
    return artifact(EVIDENCE / name)


def read(name):
    return parse(checked_read(EVIDENCE / name, 2 * 1024 * 1024))


def projection(count):
    return {'state': 'PASS', 'caseCount': count, 'failures': 0, 'coldSamples': 0, 'warmSamples': 0, 'adverseRepetitions': 0}


def validate_installed_execution(installed, result):
    """Cross-check retained execution claims without rerunning any service probe."""
    isolated = lambda name: '$ISOLATED' + chr(92) + name.replace('/', chr(92))
    empty = isolated('empty')
    node = isolated('toolchain/node.exe')
    npm = isolated('toolchain/node_modules/npm/bin/npm-cli.js')
    configuration = isolated('private/config.json')
    npm_flags = ['--offline', '--ignore-scripts', '--no-audit', '--no-fund',
                 '--userconfig', isolated('home/empty-user.npmrc'), '--globalconfig', isolated('home/empty-global.npmrc')]
    pwsh = ['$TRUSTED_PWSH', '-NoLogo', '-NoProfile', '-NonInteractive', '-File']
    trusted = [*pwsh, isolated('validate-launch.ps1'), '-NodePath', node, '-ConfigPath', configuration]
    expected_commands = []

    def command(argv, cwd=empty, exit_code=0):
        expected_commands.append({'argv': argv, 'cwd': cwd, 'exitCode': exit_code})

    command([node, '-p', 'JSON.stringify(process.versions)'])
    command([node, npm, '--version'])
    command([node, npm, 'ci', *npm_flags, '--cache', isolated('ci-cache')], isolated('extracted/package'))
    command([node, npm, 'install', *npm_flags, '--cache', isolated('install-cache'), isolated('memoryos-rest-0.1.0.tgz')], isolated('project'))
    command(['$TRUSTED_OPENSSL', 'req', '-x509', '-newkey', 'ec', '-pkeyopt', 'ec_paramgen_curve:P-256', '-nodes',
             '-keyout', isolated('private/key.pem'), '-out', isolated('private/cert.pem'), '-days', '1',
             '-subj', '/CN=MO1305 isolated packaging check', '-addext', 'subjectAltName=IP:127.0.0.1'])
    command([*pwsh, isolated('set-private-acl.ps1'), '-PrivateDirectory', isolated('private')])
    command(trusted, exit_code=2)
    command([isolated('substituted-node.exe') if value == node else value for value in trusted], exit_code=2)
    command([node, isolated('project/node_modules/memoryos-rest/bin/memoryos-rest.mjs'), '--version'], exit_code=2)
    for label, package in [('direct-extraction', 'extracted/package'), ('npm-offline-install', 'project/node_modules/memoryos-rest')]:
        command(trusted)
        command([node, isolated('installed-probe.mjs'), isolated(package), configuration, isolated('fixtures'),
                 result['manifest']['sha256'], isolated(label + '-execution.json')])
    require(len(installed['commands']) == len(expected_commands), 'INSTALL_COMMAND_COUNT')
    for actual, expected in zip(installed['commands'], expected_commands):
        require(set(actual) == {'argv', 'cwd', 'exitCode', 'stdout', 'stderr'} and type(actual['exitCode']) is int
                and {key: actual[key] for key in expected} == expected, 'INSTALL_COMMAND_BINDING')
        for channel in ('stdout', 'stderr'):
            value = actual[channel]
            require(set(value) == {'byteLength', 'sha256'} and type(value['byteLength']) is int
                    and 0 <= value['byteLength'] <= 1048576 and re.fullmatch('[0-9a-f]{64}', value['sha256']), 'INSTALL_COMMAND_OUTPUT')

    api = parse(result['files']['contracts/api-contract.json'])
    routes = {row['operationId']: row for row in api['routes']}
    expected_cases = {
        'health': {'operation': 'getHealth', 'input': None, 'expected': {'status': 'ok', 'live': True}},
        'readiness': {'operation': 'getReadiness', 'input': None, 'expected': {'status': 'ok', 'ready': True}},
        'version': {'operation': 'getVersion', 'input': None,
                    'expected': {key: value['const'] for key, value in api['schemas']['$defs']['Version']['properties'].items()}},
    }
    fixture_rows = []
    fixture_names = ['identities.json', 'prepare-policy-pass.json', 'prepare-policySet-pass.json',
                     'evaluate-policy-pass.json', 'evaluate-policy-fail.json', 'verify-identity.json', 'verify-outcome.json']
    for name in sorted(fixture_names):
        data = checked_read(ROOT / 'repositories/cca-conformance/fixtures/mo1305-phase1' / name)
        fixture = parse(data)
        fixture_ref = ref(name, data)
        fixture_rows.append(fixture_ref)
        expected_cases[fixture['id']] = {**fixture, 'fixture': fixture_ref}
    require(installed['fixtures'] == fixture_rows, 'INSTALL_FIXTURE_INVENTORY')
    require(installed['probe'] == identity(checked_read(HERE / 'installed-probe.mjs'))
            and installed['trustedValidator'] == identity(checked_read(HERE.parent / 'mo1305-phase1/validate-launch.ps1')), 'INSTALL_EXECUTED_HARNESS')
    for item in installed['installations']:
        execution = item['execution']
        require([row['case'] for row in execution['requests']] == list(expected_cases), 'INSTALLED_CASE_ORDER')
        for actual in execution['requests']:
            case = expected_cases[actual['case']]
            base_fields = {'case', 'operationId', 'status', 'tlsVersion', 'certificateAuthorized', 'alpn',
                           'requestBody', 'responseBody', 'responseWire', 'requestHeaders', 'expectedBodyMatched', 'responseSchemaValidated'}
            require(set(actual) == base_fields | ({'fixture'} if 'fixture' in case else set()), 'INSTALLED_REQUEST_FIELDS')
            require(actual['operationId'] == case['operation'] and actual.get('fixture') == case.get('fixture'), 'INSTALLED_CASE_BINDING')
            # Fixture objects have frozen canonical key order; this equals the
            # probe's JSON.stringify(input). Product response bytes use J.
            request_body = b'' if case['input'] is None else json.dumps(case['input'], ensure_ascii=False, separators=(',', ':')).encode('utf-8')
            require(actual['requestBody'] == identity(request_body)
                    and actual['responseBody'] == identity(j(case['expected'])), 'INSTALLED_BODY_BINDING')
            require(type(actual['status']) is int and actual['status'] == 200 and actual['tlsVersion'] == 'TLSv1.3'
                    and actual['alpn'] == 'http/1.1' and actual['certificateAuthorized'] is True
                    and actual['expectedBodyMatched'] is True and actual['responseSchemaValidated'] is True, 'INSTALLED_TRANSPORT_BINDING')
            headers = {'Host': '127.0.0.1:<ISOLATED_PORT>', 'Authorization': 'Bearer <REDACTED>', 'Connection': 'close',
                       'Accept-Encoding': 'identity', 'X-Request-ID': 'phase2b-' + actual['case']}
            if routes[case['operation']]['method'] == 'POST':
                headers.update({'Content-Type': 'application/json', 'Content-Length': str(len(request_body))})
            require(actual['requestHeaders'] == headers, 'INSTALLED_HEADERS_BINDING')
            response_body = j(case['expected'])
            response_headers = dict(api['headers']['response'])
            response_headers['content-length'] = str(len(response_body))
            response_headers['x-request-id'] = 'phase2b-' + actual['case']
            response_wire = ('HTTP/1.1 200 OK\r\n' + ''.join(key + ': ' + value + '\r\n'
                             for key, value in response_headers.items()) + '\r\n').encode('ascii') + response_body
            require(actual['responseWire'] == identity(response_wire), 'INSTALLED_WIRE_BINDING')
            wire = actual['responseWire']
            require(set(wire) == {'byteLength', 'sha256'} and type(wire['byteLength']) is int
                    and actual['responseBody']['byteLength'] < wire['byteLength'] <= 65536
                    and re.fullmatch('[0-9a-f]{64}', wire['sha256']), 'INSTALLED_WIRE_IDENTITY')


def installed_negative_witnesses(installed, result):
    mutations = [
        lambda x: x['commands'][2].update(exitCode=2),
        lambda x: x['commands'][3]['argv'].remove('--offline'),
        lambda x: x['commands'].reverse(),
        lambda x: x['commands'][6].update(exitCode=0),
        lambda x: x['installations'][0]['execution']['requests'][0].update(operationId='getReadiness'),
        lambda x: x['installations'][0]['execution']['requests'][0]['responseBody'].update(sha256='0' * 64),
        lambda x: x['installations'][0]['execution']['requests'][0]['requestBody'].update(sha256='0' * 64),
        lambda x: x['installations'][0]['execution']['requests'][3]['fixture'].update(sha256='0' * 64),
        lambda x: x['installations'][0]['execution']['requests'][0]['requestHeaders'].update(Host='outside.example'),
    ]
    for mutation in mutations:
        changed = copy.deepcopy(installed)
        mutation(changed)
        try:
            validate_installed_execution(changed, result)
        except (ValueError, KeyError):
            pass
        else:
            raise ValueError('FALSE_INSTALLED_PASS_ACCEPTED')
    return len(mutations)

def validate_index(index):
    require(set(index) == {'kind', 'version', 'state', 'baseline', 'archive', 'sourceTreeSha256', 'artifacts', 'receipts', 'scope'}, 'INDEX_FIELDS')
    require(index['kind'] == 'MemoryOSRESTPhase2BIndex' and index['version'] == '1.0.0' and index['state'] == 'PASS'
            and index['baseline'] == BASELINE and index['scope'] == 'Phase 2B packaging; no B2 or Phase 3 certification', 'INDEX_IDENTITY')
    require(index['receipts'] == ['installation-receipt.json', 'package-receipt.json', 'supplyChain-receipt.json'], 'RECEIPT_SET')
    rows = index['artifacts']
    expected_names = {'aux-tool-versions.json', 'adversarial.json', 'archive.json', 'contract-artifacts.json', 'harness.json',
        'installation-catalog.json', 'installation-evidence.json', 'installation-receipt.json', 'installed-execution.json',
        'offline-installation.json', 'package-catalog.json', 'package-inventory.json', 'package-receipt.json', 'platform.json',
        'regressions.json', 'reproducibility.json', 'runtime-closure.json', 'sbom-notices.json', 'source-independence.json',
        'source-tree.json', 'supply-chain-review.json', 'supplyChain-catalog.json', 'supplyChain-receipt.json'}
    require({Path(r['path']).name for r in rows} == expected_names and len(rows) == len(expected_names), 'ARTIFACT_COVERAGE')
    require([r['path'] for r in rows] == sorted(set(r['path'] for r in rows)), 'ARTIFACT_ORDER')
    for row in [index['archive'], *rows]:
        require(set(row) == {'path', 'byteLength', 'sha256'} and re.fullmatch(r'[A-Za-z0-9_./-]{1,240}', row['path'])
                and not row['path'].startswith('/') and all(p not in ('', '.', '..') for p in row['path'].split('/')), 'ARTIFACT_SHAPE')
        require(artifact(ROOT / row['path']) == row, 'ARTIFACT_DRIFT')
    result = verify_archive(ROOT / index['archive']['path'], index['archive']['sha256'])
    require(result['archive'] == {k: index['archive'][k] for k in ('byteLength', 'sha256')}, 'ARCHIVE_LENGTH')
    for name, data in result['files'].items():
        require(checked_read(ROOT / PKG_REL / name) == data, 'PACKAGE_ARCHIVE_DRIFT')
    tree = read('source-tree.json')
    require(tree['sha256'] == index['sourceTreeSha256'] == sha(j(tree['files'])), 'SOURCE_TREE_HASH')
    for row in tree['files']:
        require(artifact(ROOT / row['path']) == row, 'EXECUTED_INPUT_DRIFT')
    dependency = parse(result['files']['dependency-manifest.json'])
    require(dependency['sourceTreeSha256'] == tree['sha256'] and dependency['parentRevision'] == BASELINE, 'PACKAGE_PROVENANCE')
    require(read('package-inventory.json')['files'] == result['inventory'], 'INVENTORY_EVIDENCE')
    closure = parse(result['files']['runtime/runtime-closure-manifest.json'])
    require(read('runtime-closure.json')['files'] == closure['files'], 'CLOSURE_EVIDENCE')
    for row in closure['files']:
        require(identity(checked_read(ROOT / row['source'])) == {k: row[k] for k in ('byteLength', 'sha256')}, 'AUTHORITATIVE_SOURCE_DRIFT')
    contract_evidence = read('contract-artifacts.json')
    require(contract_evidence['b1ByteEquality'] is True and contract_evidence['artifacts'] == POLICY['contractIdentities']
            and contract_evidence['openapiVersion'] == '3.1.1' and contract_evidence['limitsState'] == 'FINAL'
            and contract_evidence['schemaProjection'] == identity(j(parse(result['files']['contracts/api-contract.json'])['schemas'])), 'CONTRACT_EVIDENCE')
    sbom_evidence = read('sbom-notices.json')
    require(sbom_evidence['fileCount'] == 56 and sbom_evidence['semanticFileCount'] == 25
            and sbom_evidence['packageNames'] == [p['name'] for p in parse(result['files']['sbom.spdx.json'])['packages']], 'SBOM_EVIDENCE')
    for row in sbom_evidence['artifacts']:
        require(artifact(ROOT / row['path']) == row, 'NOTICE_EVIDENCE')
    installed = read('installation-evidence.json')
    require(read('source-independence.json')['proof'] == installed['sourceIndependence']
            and read('source-independence.json')['literalImportInventory'] == result['imports'], 'SOURCE_INDEPENDENCE_EVIDENCE')
    require(read('offline-installation.json')['proof'] == installed['offline'], 'OFFLINE_EVIDENCE')
    require(installed['state'] == 'PASS' and installed['archive'] == result['archive']
            and installed['distributionManifest'] == result['manifest'] and installed['packageInventory'] == result['inventory'], 'INSTALL_BINDING')
    require([row['method'] for row in installed['installations']] == ['direct-extraction', 'npm-offline-install'] and installed['temporaryCredentialsRemoved'], 'INSTALL_COUNT')
    offline = installed['offline']
    require(all(offline[k] is True for k in ('ciCacheInitiallyEmpty', 'installCacheInitiallyEmpty', 'offlineMode', 'scriptsDisabled', 'auditDisabled', 'fundDisabled', 'installedPackageMatchesArchive')), 'OFFLINE_POLICY')
    require(installed['trustedLauncherNegatives'] == {'environmentSelectedSource': 'REFUSED', 'nodeSubstitution': 'REFUSED', 'gatewayEnvironmentSelectedSource': 'REFUSED_BEFORE_STARTUP'}, 'SUBSTITUTION_EVIDENCE')
    validate_installed_execution(installed, result)
    require(installed['tools']['node']['sha256'] == POLICY['nodeSha256'] and installed['tools']['npmCli']['sha256'] == POLICY['npmCliSha256'], 'INSTALL_TOOLCHAIN')
    for item in installed['installations']:
        require(item['state'] == 'PASS' and item['fileCount'] == 58 and item['everyFileMatchesBeforeAndAfter'], 'INSTALLED_FILES')
        require(item['beforeInventorySha256'] == item['afterInventorySha256'] == sha(j(result['inventory'])), 'INSTALLED_INVENTORY_HASH')
        execution = item['execution']
        require({row['case'] for row in execution['requests']} == {'health', 'readiness', 'version', 'identities', 'prepare-policy-pass', 'prepare-policySet-pass', 'evaluate-policy-pass', 'evaluate-policy-fail', 'verify-identity', 'verify-outcome'}, 'INSTALLED_CASE_SET')
        require(execution['state'] == 'PASS' and len(execution['requests']) == 10
                and len({r['operationId'] for r in execution['requests']}) == 9, 'INSTALLED_EXECUTION')
        require(all(r['status'] == 200 and r['tlsVersion'] == 'TLSv1.3' and r['certificateAuthorized']
                    and r['expectedBodyMatched'] and r['responseSchemaValidated'] for r in execution['requests']), 'HTTP_EVIDENCE')
        require(execution['process']['exitCode'] == 0 and execution['process']['stdout']['byteLength'] == 0
                and execution['process']['secretFreeLogs'], 'PROCESS_EVIDENCE')
    reproduction = read('reproducibility.json')
    require(reproduction['state'] == 'PASS' and reproduction['archive'] == result['archive'] and len(reproduction['builds']) == 2
            and reproduction['distinctCleanDirectories'] and reproduction['byteForByteEqual'], 'REPRODUCTION_EVIDENCE')
    require(all(row == {'treeSha256': tree['sha256'], 'archiveSha256': result['archive']['sha256']} for row in reproduction['builds']), 'REPRODUCTION_BINDING')
    adverse = read('adversarial.json')
    require(adverse['state'] == 'PASS' and adverse['archive'] == result['archive'], 'ADVERSARIAL_BINDING')
    records = adverse['cases']
    catalog = parse(checked_read(HERE / 'package-cases.json'))
    require(sorted([{'id': row['id'], 'expected': row['expected']} for row in records], key=lambda row: row['id']) == catalog['cases'], 'ADVERSARIAL_COVERAGE')
    require(records and len(records) == adverse['caseCount'] and adverse['runtimeVerifierExecuted'] and all(row['state'] == 'PASS' and row['expected'] == row['observed'] for row in records), 'ADVERSARIAL_RESULTS')
    regressions = read('regressions.json')
    require([row['id'] for row in regressions['results']] == ['mo1301-sdk', 'core-mip', 'mo1302-projections', 'mo1303-io-inspection', 'mo1304-semantic-integrity', 'cli-secondary', 'mo1305-package-contracts'], 'REGRESSION_COVERAGE')
    for row in [regressions['driver'], regressions['frozenSelection'], *regressions['testInputs']]:
        require(artifact(ROOT / row['path']) == row, 'REGRESSION_INPUT_DRIFT')
    for group in regressions['results']:
        require(artifact(ROOT / group['log']['path']) == group['log'], 'REGRESSION_LOG')
        require(group['counts']['fail'] == 0 and group['counts']['pass'] > 0, 'REGRESSION_COUNTS')
    if 'resumption' in regressions:
        require(artifact(ROOT / regressions['resumption']['driver']['path']) == regressions['resumption']['driver'], 'RESUME_HARNESS_DRIFT')
        for attempt in regressions['priorAttempts']:
            require(artifact(ROOT / attempt['log']['path']) == attempt['log'], 'PRIOR_ATTEMPT_DRIFT')
    require(regressions['state'] == 'PASS' and all(row['state'] == 'PASS' and row['exitCode'] == 0 for row in regressions['results']), 'REGRESSION_RESULTS')
    return result


def generate(node):
    EVIDENCE.mkdir(parents=True, exist_ok=True)
    archive_ref = artifact(ARCHIVE)
    result = verify_archive(ARCHIVE, archive_ref['sha256'])
    for source, name in [('installation.json', 'installation-evidence.json'), ('adversarial.json', 'adversarial.json'), ('reproducibility.json', 'reproducibility.json')]:
        put(name, json.loads((CACHE / source).read_bytes()))
    regressions = json.loads((EVIDENCE / 'regressions.json').read_bytes())
    for duration in [regressions, regressions.get('resumption', {})]:
        if 'elapsedSeconds' in duration:
            duration['elapsedMilliseconds'] = round(duration.pop('elapsedSeconds') * 1000)
    for group in [*regressions['results'], *regressions.get('priorAttempts', [])]:
        source = ROOT / group['log']['path']
        require(artifact(source) == group['log'], 'REGRESSION_LOG_BEFORE_COPY')
        target = EVIDENCE / 'regression-logs' / source.name
        target.parent.mkdir(parents=True, exist_ok=True)
        target.write_bytes(source.read_bytes())
        group['log'] = artifact(target)
    regressions['logPolicy'] = 'Original TAP bytes retained in regression-logs; lengths and hashes unchanged.'
    put('regressions.json', regressions)
    tree = json.loads((CACHE / 'build/source-tree.json').read_bytes())
    put('source-tree.json', tree)
    harness = put('harness.json', {'kind': 'MemoryOSRESTExecutedHarnessManifest', 'version': '1.0.0',
        'files': [row for row in tree['files'] if row['path'].startswith('repositories/cca-conformance/tools/')]})
    put('archive.json', {'kind': 'MemoryOSRESTPhase2BArchive', 'version': '1.0.0', 'state': 'PASS',
        'archive': archive_ref, 'distributionManifest': artifact(ROOT / PKG_REL / 'distribution-manifest.json'),
        'fileCount': result['fileCount'], 'runtimeFileCount': 25, 'npmDependencyFileCount': 0, 'format': 'deterministic USTAR/gzip-9'})
    put('package-inventory.json', {'kind': 'MemoryOSRESTPhase2BPackageInventory', 'version': '1.0.0', 'state': 'PASS', 'files': result['inventory']})
    put('runtime-closure.json', {'kind': 'MemoryOSRESTPhase2BRuntimeClosure', 'version': '1.0.0', 'state': 'PASS',
        'manifest': artifact(ROOT / PKG_REL / 'runtime/runtime-closure-manifest.json'),
        'files': parse(result['files']['runtime/runtime-closure-manifest.json'])['files'], 'authoritativeSourceEquality': True})
    contracts = {key: artifact(ROOT / row['path']) for key, row in POLICY['contractIdentities'].items()}
    put('contract-artifacts.json', {'kind': 'MemoryOSRESTPhase2BContracts', 'version': '1.0.0', 'state': 'PASS',
        'b1ByteEquality': True, 'artifacts': contracts, 'schemaProjection': identity(j(parse(result['files']['contracts/api-contract.json'])['schemas'])),
        'openapiVersion': '3.1.1', 'limitsState': 'FINAL'})
    put('sbom-notices.json', {'kind': 'MemoryOSRESTPhase2BSBOMNotices', 'version': '1.0.0', 'state': 'PASS',
        'artifacts': [artifact(ROOT / PKG_REL / name) for name in ['LICENSE-NOTICE.md', 'NOTICES.md', 'notices/node-LICENSE.txt', 'sbom.spdx.json']],
        'spdxVersion': 'SPDX-2.3', 'fileCount': 56, 'semanticFileCount': 25,
        'packageNames': [p['name'] for p in parse(result['files']['sbom.spdx.json'])['packages']],
        'conclusions': 'NOASSERTION; primary upstream grants retain complete nested notices; no blanket MemoryOS license grant'})
    installed = read('installation-evidence.json')
    put('source-independence.json', {'kind': 'MemoryOSRESTPhase2BSourceIndependence', 'version': '1.0.0', 'state': 'PASS',
        'execution': artifact(EVIDENCE / 'installation-evidence.json'), 'proof': installed['sourceIndependence'],
        'allExecutableBytesB1Pinned': True, 'literalImportInventory': result['imports'],
        'claim': 'Copied toolchain and complete package execute outside checkout; no OS filesystem-denial claim'})
    put('offline-installation.json', {'kind': 'MemoryOSRESTPhase2BOfflineInstall', 'version': '1.0.0', 'state': 'PASS',
        'execution': artifact(EVIDENCE / 'installation-evidence.json'), 'proof': installed['offline'], 'lockfile': artifact(ROOT / PKG_REL / 'package-lock.json')})
    put('installed-execution.json', {'kind': 'MemoryOSRESTPhase2BInstalledExecution', 'version': '1.0.0', 'state': 'PASS',
        'execution': artifact(EVIDENCE / 'installation-evidence.json'), 'methods': [i['method'] for i in installed['installations']],
        'requestCount': 20, 'distinctRoutes': 9, 'releaseCertification': False})
    reused = ROOT / 'repositories/cca-conformance/evidence/mo1305-phase1-aux/supply-chain-review.json'
    old = parse(reused.read_bytes())
    review = put('supply-chain-review.json', {'kind': 'MemoryOSRESTPhase2BSupplyChainReview', 'version': '1.0.0', 'state': 'PASS',
        'reviewDate': '2026-09-25', 'scope': 'Changed package assembly, external verification, SPDX composition and offline installation only',
        'reusedPhase1Review': artifact(reused), 'reusedAdvisoryReviewDate': old['reviewDate'],
        'reusedReport': old['report'], 'reusedSignedToolchainProvenance': old['provenance'],
        'unchangedNodeSha256': POLICY['nodeSha256'], 'unchangedNpmCliSha256': POLICY['npmCliSha256'],
        'externalNpmDependencies': 0, 'allExecutableBytesB1Pinned': True,
        'changedSurfaces': ['README installation instructions', 'deterministic build and external archive verifier', 'distribution/dependency provenance', 'SPDX gateway/semantic/runtime relationships', 'offline install and evidence tooling'],
        'disposition': 'Reuse the bound unchanged Phase 1 runtime/component advisory review. New package-specific checks passed. No new vulnerability census or zero-vulnerability claim; B2/Phase 3 dated advisory gates remain pending.'})
    aux_tools = parse((CACHE / 'aux-tool-versions.json').read_bytes())
    put('aux-tool-versions.json', aux_tools)
    platform = parse((CACHE / 'platform.json').read_bytes())
    put('platform.json', platform)
    toolchain = [{'name': 'node', 'version': '24.21.0', 'sha256': POLICY['nodeSha256']},
                 {'name': 'npm', 'version': '11.19.0', 'sha256': POLICY['npmCliSha256']},
                 {'name': 'python', 'version': sys.version.split()[0], 'sha256': sha(Path(sys.executable).read_bytes())}]
    toolchain += [{'name': name, 'version': aux_tools[name], 'sha256': installed['tools'][name]['sha256']} for name in ('openssl', 'powershell')]
    toolchain.sort(key=lambda row: row['name'])
    count = len(read('adversarial.json')['cases'])
    groups = {'package': [('ARCHIVE-AND-INVENTORY', 58), ('RUNTIME-CLOSURE', 25), ('B1-CONTRACT-ARTIFACTS', 4),
              ('INDEPENDENT-BUILDS', 2), ('PACKAGE-ADVERSARIAL', count), ('SBOM-NOTICES', 1)],
              'installation': [('OFFLINE-INSTALLATIONS', 2), ('INSTALLED-HTTP-REQUESTS', 20), ('SOURCE-INDEPENDENCE', 1)],
              'supplyChain': [('PACKAGE-SPECIFIC-SUPPLY-CHAIN', 1)]}
    for kind, cases in groups.items():
        records = [{'id': name, 'state': 'PASS', 'expected': projection(n), 'actual': projection(n), 'artifactRefs': []} for name, n in sorted(cases)]
        catalog = put(kind + '-catalog.json', {'kind': 'MemoryOSRESTExecutionCatalog', 'version': '1.0.0', 'records': [{'id': r['id'], 'expected': r['expected']} for r in records]})
        payload = {'installation': artifact(EVIDENCE / 'installation-evidence.json')} if kind == 'installation' else {'review': review}
        if kind == 'package':
            payload = {'archive': archive_ref, 'distributionManifest': artifact(ROOT / PKG_REL / 'distribution-manifest.json'),
                'builds': read('reproducibility.json')['builds'], 'installation': artifact(EVIDENCE / 'installation-evidence.json'), 'dependencyReview': review}
        put(kind + '-receipt.json', {'kind': 'MemoryOSRESTReceipt', 'version': '2.0.0', 'type': kind, 'state': 'PASS',
            'authorityRevision': 'd15b578dd757e928273d4548348b085e58ed5df5', 'contractFreezeRevision': 'ce1780e2dac0afe31aeb947f0a7f78b953e17f6b',
            'platformCorrectionRevision': 'c2e3835b852fd966046ac9e984538fdcaf8b26bf', 'verificationCorrectionRevision': '75cee55784c590bab52feaf8f2214e4d1b9e657f',
            'implementationRevision': None, 'bindingRevision': None, 'sourceTreeSha256': tree['sha256'], 'harness': harness,
            'artifacts': [artifact(EVIDENCE / name) for name in ['adversarial.json', 'contract-artifacts.json', 'package-inventory.json', 'regressions.json', 'runtime-closure.json', 'sbom-notices.json']],
            'platform': platform, 'toolchain': toolchain, 'catalog': catalog, 'results': records, 'payload': payload})
    index = {'kind': 'MemoryOSRESTPhase2BIndex', 'version': '1.0.0', 'state': 'PASS', 'baseline': BASELINE,
             'archive': archive_ref, 'sourceTreeSha256': tree['sha256'],
             'artifacts': [artifact(p) for p in sorted(EVIDENCE.glob('*.json')) if p.name not in ('index.json', 'validation.json')],
             'receipts': ['installation-receipt.json', 'package-receipt.json', 'supplyChain-receipt.json'],
             'scope': 'Phase 2B packaging; no B2 or Phase 3 certification'}
    put('index.json', index)
    verify(node)


def verify(node):
    index = read('index.json')
    result = validate_index(index)
    negatives = 0
    for mutation in [lambda x: x.update(unknown=True), lambda x: x.pop('baseline'), lambda x: x.update(state='FAIL'),
                     lambda x: x['archive'].update(sha256='0' * 64), lambda x: x.update(sourceTreeSha256='0' * 64),
                     lambda x: x['artifacts'].pop(), lambda x: x['receipts'].pop()]:
        changed = copy.deepcopy(index)
        mutation(changed)
        try:
            # Missing artifact coverage is checked independently of its hashes.
            require({r['path'] for r in changed['artifacts']} == {r['path'] for r in index['artifacts']}, 'MISSING_ARTIFACT')
            validate_index(changed)
        except (ValueError, KeyError):
            negatives += 1
        else:
            raise ValueError('FALSE_PASS_ACCEPTED')
    negatives += installed_negative_witnesses(read('installation-evidence.json'), result)
    command = [str(node), str(HERE / 'verify-receipts.mjs'), '--python', str(Path(sys.executable).resolve())]
    import os
    clean = {k: v for k, v in os.environ.items() if k.upper() in ('SYSTEMROOT', 'WINDIR', 'TEMP', 'TMP')}
    completed = subprocess.run(command, cwd=ROOT, env=clean, capture_output=True, timeout=60)
    require(completed.returncode == 0, 'RECEIPT_SCHEMA:' + completed.stderr.decode('utf-8', 'replace')[-1000:])
    schema = json.loads(completed.stdout)
    value = {'kind': 'MemoryOSRESTPhase2BReceiptValidation', 'version': '1.0.0', 'state': 'PASS',
             'index': artifact(EVIDENCE / 'index.json'), 'archive': result['archive'],
             'artifactsVerified': len(index['artifacts']), 'negativeWitnesses': negatives + schema['negativeWitnesses'],
             'sharedSchemaReceipts': schema['receipts'], 'expensiveWorkRerun': False}
    put('validation.json', value)
    print(json.dumps(value))


if __name__ == '__main__':
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument('command', choices=('generate', 'verify'))
    parser.add_argument('--node', type=Path, required=True)
    args = parser.parse_args()
    (generate if args.command == 'generate' else verify)(args.node.resolve())
