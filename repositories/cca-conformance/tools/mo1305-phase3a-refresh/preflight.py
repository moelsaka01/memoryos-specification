"""Fail-fast Phase 3A refresh structural gate; no gateway or installation runs.

The original correction gate assumes main and historical cache locations. This
refresh-owned gate preserves its evidence/graph/content checks using named Git
objects; it never changes an existing correction file or another worktree.
"""
from pathlib import Path
import argparse
import copy
import hashlib
import json
import os
import re
import subprocess
import sys

sys.dont_write_bytecode = True
ROOT = Path(__file__).resolve().parents[4]
TOOLS = 'repositories/cca-conformance/tools/mo1305-phase3-correction/'
EVIDENCE = 'repositories/cca-conformance/evidence/mo1305-phase3-correction/accepted/'
REFRESH = 'repositories/cca-conformance/evidence/mo1305-phase3a-refresh/'
PKG = 'repositories/memoryos-rest/'
B2 = '2fcc588979675462d30c582f24f42fa9ec3ec729'
C3 = '62a70cafac68e89366740ec197074bd13fbce934'
C3B = '4ac43c4368f41ec14ea443aa303bf3a69503f2de'
A3 = '9bb679532b90016b9cc30bf5e1cdb41d376e2ff7'
NODE_SHA = 'ba4e6d110e8c1592a1ecd390f6b05f3da124b13871a5be62b341a07a853c6c32'
NPM_SHA = '3ce7cba6f5128dd5f54c98b6a5036b0f850496878cc2e21044b675fe3c594e3e'
ARCHIVE = {'byteLength': 191823, 'sha256': 'faac95f7ad8939bcf7bbc33952efabebc1468d0c5654ea3eaac03f40402a7382'}
OPENAPI = {'byteLength': 114491, 'sha256': '36ed9f1dac58007881ebd8f666c930e7fb1ae767c2be2d5b6be28f5fb0cae03a'}
SBOM = {'byteLength': 44094, 'sha256': 'ab0a60fc4273390fe353df5c8464571b581043c2ddc90587039afa1299ad3b7b'}
ORIGINAL_RECEIPT = {'byteLength': 9846, 'sha256': '638d79cbb37fccc2f770f44198e64c99611c4441f88f0462dab8b5826937dc8f'}


def require(value, code):
    if not value:
        raise ValueError(code)


def canonical(value):
    return json.dumps(value, ensure_ascii=False, sort_keys=True, separators=(',', ':'), allow_nan=False).encode('utf-8')


def identity(data):
    return {'byteLength': len(data), 'sha256': hashlib.sha256(data).hexdigest()}


def read(name):
    return json.loads((ROOT / name).read_bytes())


def git(*args, data=None):
    return subprocess.check_output(['git', '-c', 'safe.directory=' + ROOT.as_posix(), '-C', str(ROOT), *args], input=data, env={**os.environ, 'GIT_OPTIONAL_LOCKS': '0'})


def blobs(revision, names):
    names = list(names)
    if not names:
        return {}
    raw = git('cat-file', '--batch', data=''.join(revision + ':' + n + '\n' for n in names).encode())
    result, offset = {}, 0
    for name in names:
        end = raw.index(b'\n', offset)
        head = raw[offset:end].split()
        require(len(head) == 3 and head[1] == b'blob', 'GIT_BLOB:' + name)
        size = int(head[2])
        offset = end + 1
        result[name] = raw[offset:offset + size]
        offset += size + 1
    return result


def reference(name):
    require(not Path(name).is_absolute() and '..' not in Path(name).parts, 'REFERENCE_PATH')
    return {'path': name, **identity((ROOT / name).read_bytes())}


def refs(rows):
    for row in rows:
        require(reference(row['path']) == row, 'REFERENCE_DRIFT:' + row['path'])


def validate(node):
    require(git('branch', '--show-current').decode().strip() == 'mo1305/phase3a-refresh', 'REFRESH_BRANCH')
    require(not git('tag', '--list', 'memoryos-1.3-mo1305').strip(), 'RELEASE_TAG_PRESENT')
    head = git('rev-parse', 'HEAD').decode().strip()
    require(head == C3B or (git('show', '-s', '--format=%P', head).decode().strip() == C3B and git('show', '-s', '--format=%s', head).decode().strip() == 'cert(memoryos-1.3): refresh MO-1305 Windows certification'), 'REFRESH_PARENT')
    for revision, parent, subject in [(C3, B2, 'fix(memoryos-1.3): correct MO-1305 release metadata'), (C3B, C3, 'conformance(memoryos-1.3): bind MO-1305 release metadata correction'), (A3, B2, 'cert(memoryos-1.3): certify MO-1305 REST Gateway on Windows')]:
        require(git('show', '-s', '--format=%P', revision).decode().strip() == parent, 'GRAPH_PARENT:' + revision)
        require(git('show', '-s', '--format=%s', revision).decode().strip() == subject, 'GRAPH_SUBJECT:' + revision)
    require(git('diff', '--name-only', B2, C3).decode().splitlines() == read(EVIDENCE + 'c3-scope.json'), 'C3_SCOPE')
    require(git('diff', '--name-only', C3, C3B).decode().splitlines() == [EVIDENCE + 'binding.json'], 'C3B_SCOPE')

    # Validate immutable historical validator inputs before importing any of them.
    historical_names = git('ls-tree', '-r', '--name-only', C3B, '--', TOOLS, 'repositories/cca-conformance/evidence/mo1305-phase3-correction/').decode().splitlines()
    historical = blobs(C3B, historical_names)
    for name, data in historical.items():
        require((ROOT / name).read_bytes() == data, 'CORRECTION_EVIDENCE_CHANGED:' + name)
    refs(read(EVIDENCE + 'validation-tooling.json')['files'])
    sys.path.insert(0, str(ROOT / TOOLS))
    from schema_validation import verify_schema, field_inventory
    from distribution import verify_archive, verify_files, PATHS, toolchain
    from spdx import verify_spdx
    from metadata_test import run as metadata_tests
    import check as correction

    # First complete structural gate: all pinned Draft-7 errors, without filtering.
    require(identity((ROOT / (PKG + 'sbom.spdx.json')).read_bytes()) == SBOM, 'CORRECTED_SBOM_IDENTITY')
    schema = verify_schema(read(PKG + 'sbom.spdx.json'))
    require(schema['totalErrors'] == 0, 'SPDX_SCHEMA_ERRORS')
    candidate = read(EVIDENCE + 'candidate.json')
    require(schema == candidate['schema'], 'SCHEMA_RECEIPT')
    require(field_inventory(read(PKG + 'sbom.spdx.json')) == read(EVIDENCE + 'generated-fields.json'), 'GENERATED_FIELD_INVENTORY')
    package_files = {name: (ROOT / PKG / name).read_bytes() for name in PATHS}
    semantic = verify_spdx(read(PKG + 'sbom.spdx.json'), package_files)
    require(semantic == candidate['spdx'], 'SPDX_SEMANTIC_RECEIPT')
    package = verify_files(package_files)
    archive_path = ROOT / candidate['archive']['path']
    require(identity(archive_path.read_bytes()) == ARCHIVE, 'CORRECTED_ARCHIVE_IDENTITY')
    archive = verify_archive(archive_path, ARCHIVE['sha256'])
    require(archive['files'] == package_files and archive['inventory'] == candidate['inventory'], 'ARCHIVE_PACKAGE_EQUALITY')
    require(package['fileCount'] == 58 and package['runtimeFileCount'] == 25, 'PACKAGE_CLOSURE_COUNTS')
    require(package['dependencyGraph']['direct'] == package['dependencyGraph']['transitive'] == 0, 'EXTERNAL_DEPENDENCIES')
    require(identity(package_files['contracts/openapi.json']) == OPENAPI, 'CORRECTED_OPENAPI_IDENTITY')
    committed = blobs(C3B, [PKG + n for n in PATHS])
    require(all(package_files[n] == committed[PKG + n] for n in PATHS), 'C3B_PRODUCTION_CHANGED')

    # Mechanical comparison connects the corrected archive to both B2 and the
    # original certification's Git objects and installed 58-file inventory.
    runtime = correction.runtime_proof()
    require(runtime == read(EVIDENCE + 'runtime-preservation.json'), 'RUNTIME_PRESERVATION_RECEIPT')
    require(runtime['byteIdenticalCount'] == 52 and runtime['executableRuntimeCount'] == 42, 'RUNTIME_REUSE_COUNTS')
    original = blobs(A3, [PKG + n for n in PATHS])
    b2 = blobs(B2, [PKG + n for n in PATHS])
    installed_path = 'repositories/cca-conformance/evidence/mo1305-phase3a/installed-files.json'
    installed = json.loads(blobs(A3, [installed_path])[installed_path])['files']
    require(len(installed) == 58, 'ORIGINAL_INSTALLED_COUNT')
    installed_by_path = {row['path']: row for row in installed}
    for name in PATHS:
        require(original[PKG + name] == b2[PKG + name], 'ORIGINAL_PRODUCTION_DRIFT:' + name)
        require(installed_by_path[name] == {'path': name, **identity(original[PKG + name])}, 'ORIGINAL_INSTALLED_BINDING:' + name)
    for row in runtime['byteIdentical']:
        require(original[row['path']] == (ROOT / row['path']).read_bytes(), 'RUNTIME_RECERTIFICATION_REQUIRED:' + row['path'])
    closure_names = [n for n in PATHS if n.startswith('runtime/authoritative/')]
    require(len(closure_names) == 25 and all(package_files[n] == original[PKG + n] for n in closure_names), 'CLOSURE_REUSE')

    require(node.is_absolute() and identity(node.read_bytes())['sha256'] == NODE_SHA, 'TRUSTED_NODE')
    npm = node.parent / 'node_modules/npm/bin/npm-cli.js'
    require(identity(npm.read_bytes())['sha256'] == NPM_SHA, 'TRUSTED_NPM')
    versions = toolchain(node, npm)
    js = """import assert from 'node:assert/strict';
import {readFileSync,readdirSync} from 'node:fs';
import {verifyContracts,expectedOpenAPI,verifyOpenAPI} from './repositories/memoryos-rest/scripts/verify-contracts.mjs';
import {schemaValidator} from './repositories/memoryos-rest/src/schema.mjs';
import {J} from './repositories/memoryos-rest/src/serialization.mjs';
verifyContracts();const value=expectedOpenAPI();assert.deepEqual(value['x-memoryos-http'].behavior.remoteMode,{mode:'remote',implemented:true,explicitOptIn:true,bindAddressPolicy:'assigned RFC1918 IPv4'});value['x-memoryos-http'].behavior.remoteMode='PHASE_2_PENDING';assert.throws(()=>verifyOpenAPI(Buffer.from(J(value))),/OPENAPI_RUNTIME_DRIFT/);
const read=p=>JSON.parse(readFileSync(p));const inventory=read('repositories/cca-conformance/mo1305-conformance-inventory.json');assert.equal(schemaValidator(read('repositories/cca-conformance/schema/mo1305-inventory-2.0.0.json'))('Inventory',inventory),true);assert.deepEqual(inventory.blockers,['PHASE3A_REFRESH_REQUIRED','PHASE3B_REFRESH_REQUIRED','PHASE3C_REFRESH_REQUIRED']);assert.equal(inventory.state,'CERTIFICATION_PENDING');
const runner=readFileSync('repositories/cca-conformance/tools/run-js-conformance.mjs','utf8');const expected=runner.match(/const expectedFiles = Object.freeze\\(\\[([\\s\\S]*?)\\]\\);/u)[1];assert.deepEqual([...expected.matchAll(/\"([^\"]+_test.mjs)\"/gu)].map(m=>m[1]),readdirSync('repositories/cca-conformance/tests').filter(n=>n.endsWith('_test.mjs')).sort());assert.ok(runner.includes('mo1305Correction'));assert.equal(read('repositories/cca-conformance/package.json').scripts['test:mo1305-release-metadata-correction'],'node --test tests/mo1305_release_metadata_correction_test.mjs');assert.ok(readFileSync('repositories/cca-conformance/CMakeLists.txt','utf8').includes('tests/mo1305_release_metadata_correction_test.mjs'));
process.stdout.write(JSON.stringify({openapi:'PASS',stalePendingRejection:'PASS',inventorySchema:'PASS',registration:'PASS'}));"""
    clean = {k: v for k, v in os.environ.items() if k.upper() in ('SYSTEMROOT', 'WINDIR', 'TEMP', 'TMP')}
    result = subprocess.run([str(node), '--input-type=module', '-e', js], cwd=ROOT, env=clean, capture_output=True, timeout=60)
    require(result.returncode == 0 and not result.stderr, 'OPENAPI_CONFORMANCE:' + result.stderr.decode(errors='replace')[:2000])
    openapi_checks = json.loads(result.stdout)
    refs([candidate['archive'], *candidate['corrected'].values(), *candidate['evidence']])
    correction.check_binding(read(EVIDENCE + 'binding.json'), C3)
    source = read(EVIDENCE + 'source-tree.json')
    refs(source['files'])
    require(identity(canonical(source['files']))['sha256'] == source['sha256'], 'SOURCE_TREE_DIGEST')
    require(read(PKG + 'dependency-manifest.json')['sourceTreeSha256'] == source['sha256'], 'DEPENDENCY_SOURCE_BINDING')
    require(read(correction.INVENTORY) == correction.expected_inventory(), 'CORRECTION_INVENTORY')
    require(candidate['state'] == 'TARGETED_VALIDATION_PASS' and candidate['finalBinding'] == 'PENDING' and candidate['releaseTag'] == 'ABSENT', 'CORRECTION_STATE')
    execution = read(EVIDENCE + 'execution.json')
    require(execution['state'] == 'PASS' and execution['result']['code'] == 0 and execution['timeout'] is False, 'CORRECTION_EXECUTION')
    require(execution['host']['observation']['classification'] == 'NORMAL' and execution['host']['observation']['evidenceState'] == 'AVAILABLE', 'CORRECTION_HOST')
    refs(execution['inputs'] + [execution['log'], execution['installed']])
    old_install = read(EVIDENCE + 'installed.json')
    require(old_install['state'] == 'PASS' and old_install['archive'] == ARCHIVE and len(old_install['installations']) == 1, 'CORRECTION_INSTALLATION')
    old_result = old_install['installations'][0]
    require(old_result['state'] == 'PASS' and old_result['fileCount'] == 58 and old_result['everyFileMatchesBeforeAndAfter'] and len(old_result['execution']['requests']) == 6 and len(old_result['execution']['remote']['requests']) == 2, 'CORRECTION_SMOKE')
    require(old_install['temporaryCredentialsRemoved'] and all(old_install['offline'][k] for k in ['installCacheInitiallyEmpty', 'offlineMode', 'scriptsDisabled', 'auditDisabled', 'fundDisabled', 'installedPackageMatchesArchive']), 'CORRECTION_OFFLINE_POLICY')
    metadata = metadata_tests(archive_path)
    require(metadata['state'] == 'PASS' and metadata['caseCount'] == 34 and metadata == read(EVIDENCE + 'metadata-tests.json'), 'METADATA_WITNESSES')
    binding_negative = []
    binding = correction.binding(C3)
    for key in ['baseline', 'implementation', 'candidate', 'old', 'provisionalBlocked', 'corrected', 'archive', 'schema', 'runtimePreservation', 'phase3', 'finalBinding', 'releaseTag']:
        changed = copy.deepcopy(binding)
        changed[key] = None
        try:
            correction.check_binding(changed, C3)
        except AssertionError:
            binding_negative.append(key)
        else:
            raise ValueError('FORGED_BINDING_ACCEPTED:' + key)
    historical_receipt_path = 'repositories/cca-conformance/evidence/mo1305-phase3a/windows-receipt.json'
    historical_receipt_bytes = blobs(A3, [historical_receipt_path])[historical_receipt_path]
    require(identity(historical_receipt_bytes) == ORIGINAL_RECEIPT, 'ORIGINAL_RECEIPT_IDENTITY')
    old_receipt = json.loads(historical_receipt_bytes)
    require(old_receipt['state'] == 'PASS' and len(old_receipt['results']) == 6 and all(r['state'] == 'PASS' and r['actual'] == r['expected'] for r in old_receipt['results']), 'ORIGINAL_RECEIPT_PASS')
    historical_refs = []
    def collect_refs(value):
        if isinstance(value, dict):
            if {'path', 'byteLength', 'sha256'} <= set(value):
                historical_refs.append({k: value[k] for k in ['path', 'byteLength', 'sha256']})
            for child in value.values():
                collect_refs(child)
        elif isinstance(value, list):
            for child in value:
                collect_refs(child)
    collect_refs(old_receipt)
    historical_ref_files = blobs(A3, sorted({r['path'] for r in historical_refs}))
    for row in historical_refs:
        require({'path': row['path'], **identity(historical_ref_files[row['path']])} == row, 'ORIGINAL_RECEIPT_REFERENCE:' + row['path'])
    original_names = git('diff', '--name-only', B2, A3).decode().splitlines()
    original_files = blobs(A3, original_names)
    historical_inventory = [{'revision': A3, 'path': n, **identity(original_files[n])} for n in original_names]
    limits = read(PKG + 'contracts/limits.json')
    require(limits['state'] == 'FINAL' and limits['measured']['operationMs'] == 31400, 'FINAL_LIMITS')
    return {'kind': 'MemoryOSRESTWindowsRefreshPreflight', 'version': '1.0.0', 'state': 'PASS', 'baseRevision': C3B, 'implementationRevision': C3, 'originalCertificationRevision': A3, 'historicalBaseline': B2,
            'archive': {'path': candidate['archive']['path'], **ARCHIVE}, 'openapi': OPENAPI, 'sbom': SBOM, 'schema': schema, 'spdx': semantic,
            'package': {k: package[k] for k in ['fileCount', 'runtimeFileCount', 'dependencyGraph', 'manifest', 'inventory']},
            'runtimeEquivalence': {**runtime, 'originalCertificationCompared': True, 'originalInstalledInventoryCompared': True, 'authoritativeClosureCount': 25},
            'node': {'version': versions['node'], 'sha256': NODE_SHA}, 'npm': {'version': '11.19.0', 'sha256': NPM_SHA},
            'openapiChecks': openapi_checks, 'metadataWitnesses': {'state': 'PASS', 'caseCount': 34, 'receipt': reference(EVIDENCE + 'metadata-tests.json')},
            'correctionConformance': {'state': 'PASS', 'exactGitGraph': True, 'immutableCorrectionFiles': len(historical_names), 'bindingNegativeWitnesses': binding_negative, 'sourceTreeSha256': source['sha256'], 'scope': 'branch-neutral correction package/schema/semantic/evidence/graph checks; no parallel worktree access or historical ignored-cache dependency'},
            'historicalEvidence': {'receipt': {'revision': A3, 'path': historical_receipt_path, **ORIGINAL_RECEIPT}, 'receiptReferencesVerified': len(historical_refs), 'files': historical_inventory, 'state': 'HISTORICAL_PASS', 'reusableScope': 'unchanged runtime/security/lifecycle/client/semantic/FINAL-limit evidence; artifact identity and installed integrity require fresh certification', 'newRuntimeClaims': False},
            'limits': {'state': 'FINAL', 'semanticDeadlineMs': 31400, 'absoluteCeilingMs': 60000, 'identity': identity(package_files['contracts/limits.json']), 'newResourceCharacterization': False},
            'tool': reference(Path(__file__).relative_to(ROOT).as_posix()), 'runtimeCampaignExecuted': False}


def main():
    parser = argparse.ArgumentParser()
    parser.add_argument('--node', type=Path, default=ROOT / '.cache/mo1304-phase3-toolchain/node-v24.21.0-win-x64/node.exe')
    parser.add_argument('--output', type=Path, default=ROOT / REFRESH / 'preflight.json')
    parser.add_argument('--check', action='store_true', help='Recompute and compare the existing receipt without writing files.')
    args = parser.parse_args()
    try:
        result = validate(args.node.resolve(strict=True))
        payload = canonical(result)
        if args.check:
            require(args.output.read_bytes() == payload, 'PREFLIGHT_RECEIPT_DRIFT')
        else:
            require(args.output.resolve().is_relative_to(ROOT / REFRESH), 'OUTPUT_SCOPE')
            args.output.parent.mkdir(parents=True, exist_ok=True)
            args.output.write_bytes(payload)
        print(json.dumps({'state': 'PASS', 'schemaErrors': 0, 'metadataCases': 34, 'packageFiles': 58, 'runtimeIdentical': 52, 'executableRuntime': 42, 'closureFiles': 25, 'receipt': str(args.output), 'checkOnly': args.check}))
    except Exception as error:
        print(json.dumps({'state': 'FAIL', 'gate': 'cheap-structural-preflight', 'error': type(error).__name__, 'message': str(error)}))
        raise SystemExit(1)


if __name__ == '__main__':
    main()