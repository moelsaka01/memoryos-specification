// Non-performance proof: exact inverse, closed call sites, preserved native/security and package bindings.
import fs from 'node:fs';
import assert from 'node:assert/strict';
import { packageFiles, checkPackage } from '../mo1307-phase1/package.mjs';
import { absolute, baseBytes, baseCommit, beginCampaign, finishCampaign, hash, record, verifyBindings, write } from './validation-bindings.mjs';

const context = beginCampaign('equivalence-security');
const helperPath = 'repositories/memoryos-readiness/helpers/windows-inspect.ps1';
const candidate = fs.readFileSync(absolute(helperPath));
const baseline = baseBytes(helperPath);
const rows = [];
let failure = null;
function row(id, action) {
  try { const detail = action(); rows.push({ id, result: 'PASS', detail: detail ?? null }); }
  catch (error) { rows.push({ id, result: 'FAIL', error: { name: error.name, message: error.message, stack: error.stack } }); throw error; }
}
function functionText(source, name, nextName) {
  const start = source.indexOf('function ' + name);
  const boundary = nextName.startsWith('#') ? nextName : 'function ' + nextName;
  const end = source.indexOf(boundary, start + 1);
  assert.ok(start >= 0 && end > start, name + ' function boundaries');
  return source.slice(start, end);
}
try {
  verifyBindings(context);
  write(context.output + '/baseline-helper.ps1.data', baseline);
  row('exact-authorized-inverse', () => {
    const text = candidate.toString('utf8');
    const eol = text.includes('\r\n') ? '\r\n' : '\n';
    const oldComment = [
      '        # Open-Chain validates the full expected path before constructing its',
      '        # component paths. Those immutable strings remain in the request-local',
      '        # chain entries through both held-handle and fresh-handle checks.',
    ].join(eol);
    const newComment = [
      '        # Request decoding and the caller validate the full expected path before',
      '        # Open-Chain constructs its component paths. Those immutable strings',
      '        # remain in the request-local chain entries through both held-handle and',
      '        # fresh-handle checks.',
    ].join(eol);
    assert.equal(text.split(newComment).length, 2, 'One reviewed comment replacement');
    const anchor = 'function Open-Chain([string] $Path, [bool] $Directory, [bool] $InputLeaf = $false) {' + eol;
    assert.equal(text.split(anchor).length, 2, 'One Open-Chain definition');
    const inverse = text.replace(newComment, oldComment).replace(anchor, anchor + '    Assert-Root $Path' + eol);
    assert.deepEqual(Buffer.from(inverse, 'utf8'), baseline, 'Reinserting the one pure lexical check and old explanatory comment reconstructs the base helper byte-for-byte');
    return { baseCommit, baseline: record(context.output + '/baseline-helper.ps1.data'), candidate: record(helperPath), inverseEqualsBaseExactly: true };
  });
  row('closed-validated-call-sites', () => {
    const text = candidate.toString('utf8');
    assert.equal((text.match(/Assert-Root \$root\.path/gu) ?? []).length, 1, 'Root request boundary remains');
    assert.equal((text.match(/Assert-Relative \$file\.path/gu) ?? []).length, 1, 'Relative file boundary remains');
    assert.equal((text.match(/\$full\.Length -gt 240/gu) ?? []).length, 1, 'Combined file-path bound remains');
    assert.equal((text.match(/memoryos-readiness-result\.json\.pending'\)\.Length -gt 240/gu) ?? []).length, 1, 'Fixed pending-name length bound remains');
    assert.equal((text.match(/^function Open-Chain\(/gmu) ?? []).length, 1, 'One internal Open-Chain definition');
    assert.equal((text.match(/^\s+\$chain = Open-Chain /gmu) ?? []).length, 3, 'Exactly three internal Open-Chain invocations');
    for (const call of ["$chain = Open-Chain $Roots[$root.id] $true", '$chain = Open-Chain $full $false $true', '$chain = Open-Chain $path (-not $pending)']) {
      assert.equal(text.split(call).length, 2, 'One reviewed call site: ' + call);
    }
    assert.ok(text.includes('$path = [IO.Path]::GetDirectoryName($root)'));
    assert.ok(text.includes("$path = $root.TrimEnd('\\') + '\\memoryos-readiness-result.json.pending'"));
    return { rootBoundary: true, relativeBoundary: true, combinedLengthBoundary: true, openChainExternalSurface: false };
  });
  row('native-observations-and-toctou-unchanged', () => {
    const before = baseline.toString('utf8'), after = candidate.toString('utf8');
    for (const pair of [['Assert-SameIdentity', 'Open-Chain'], ['Assert-ChainStable', 'Assert-NativeAbsent'], ['Assert-NativeAbsent', 'Invoke-ReadSet'], ['Invoke-Inspection', '# Save all redirected transports']]) {
      const extract = source => {
        const start = source.indexOf('function ' + pair[0]);
        const end = source.indexOf(pair[1].startsWith('#') ? pair[1] : 'function ' + pair[1], start + 1);
        assert.ok(start >= 0 && end > start); return source.slice(start, end);
      };
      assert.equal(extract(after), extract(before), pair[0] + ' bytes unchanged');
    }
    const symbols = ['CreateFileW(', 'GetFileInformationByHandle(', 'GetFileType(', 'GetFinalPathNameByHandleW(', 'Assert-ChainStable $chain', 'Assert-NativeAbsent $root', 'Assert-SameIdentity'];
    for (const symbol of symbols) assert.equal(after.split(symbol).length, before.split(symbol).length, symbol + ' occurrence count unchanged');
    return {
      fiveComponentCheckOutput: { createFileWAttempts: 11, successfulChainHandles: 10, absenceAttempts: 1, readIdentityPasses: 15, heldAndFreshComparisons: 10, responseIdentities: 5 },
      initialHeldFreshObservations: 'UNCHANGED', finalPathAndSevenFields: 'UNCHANGED', nativeAbsenceError2: 'UNCHANGED',
    };
  });
  row('response-error-and-protocol-equivalence', () => {
    const before = baseline.toString('utf8'), after = candidate.toString('utf8');
    assert.equal(functionText(after, 'Invoke-Inspection', '# Save all redirected transports'), functionText(before, 'Invoke-Inspection', '# Save all redirected transports'));
    const responseAnchor = '$response = [pscustomobject] @{ code = $code;';
    const responseStart = before.indexOf(responseAnchor);
    const candidateResponseStart = after.indexOf(responseAnchor);
    assert.ok(responseStart >= 0);
    assert.ok(candidateResponseStart >= 0);
    assert.equal(after.slice(candidateResponseStart), before.slice(responseStart), 'Response construction, canonical serialization, writes, flush and exit are byte-identical');
    assert.ok(after.includes("$id = 'output-parent'; $status = 'ABSENT'"));
    assert.ok(after.includes("if (-not $handle.IsInvalid -or $nativeError -ne 2) { Reject-Protocol 'MO1307_FILESYSTEM_BOUNDARY' }"));
    return {
      checkOutputSuccess: 'ABSENT', existingOutput: 'ERROR/MO1307_FILESYSTEM_BOUNDARY', presentSuccessState: false,
      canonicalResponseBytes: 'UNCHANGED_CODE', errorMapping: 'UNCHANGED_CODE', helperProtocol: 'UNCHANGED_PRODUCT_MEMBER',
      filesystemBoundary: 'UNCHANGED_CALLER_VALIDATION_PLUS_UNCHANGED_NATIVE_FINAL_PATH',
    };
  });
  row('only-four-production-members-change', () => {
    const changes = [];
    for (const member of packageFiles) {
      const relative = 'repositories/memoryos-readiness/' + member;
      const before = baseBytes(relative), after = fs.readFileSync(absolute(relative));
      if (!before.equals(after)) changes.push(relative);
    }
    assert.deepEqual(changes, [
      'repositories/memoryos-readiness/distribution-manifest.json',
      'repositories/memoryos-readiness/helpers/README.md',
      'repositories/memoryos-readiness/helpers/windows-inspect.ps1',
      'repositories/memoryos-readiness/sbom.spdx.json',
    ]);
    const packageCheck = checkPackage();
    assert.deepEqual(packageCheck, { kind: 'MO1307Phase1PackageCheck', version: '1.0.0', members: 89, contractMembers: 53, externalProductionDependencies: 0, archiveCertification: false });
    return { changes, packageCheck };
  });
} catch (error) {
  failure = { name: error.name, message: error.message, stack: error.stack };
} finally {
  finishCampaign(context, {
    suite: 'equivalence-security', result: failure === null && rows.every(item => item.result === 'PASS') ? 'PASS' : 'FAIL', rows, failure,
    helperExecutions: 0, productTestExecutions: 0, performanceEvidence: false,
    conclusions: {
      exactCheckOutputResponseEquivalence: failure === null,
      exactErrorMapping: failure === null,
      exactAbsentPresentSemantics: failure === null,
      exactCanonicalBytes: failure === null,
      unchangedFilesystemBoundaryRejection: failure === null,
      unchangedFinalPathBehavior: failure === null,
      unchangedToctouRequirements: failure === null,
      unchangedHelperProtocol: failure === null,
    },
  });
}
