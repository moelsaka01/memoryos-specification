// Preparation only: create one reversible diagnostic helper copy. Never launches PowerShell or the helper.
import fs from 'node:fs';
import path from 'node:path';
import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import { fileURLToPath } from 'node:url';

const root = fileURLToPath(new URL('../../../../', import.meta.url));
const toolRoot = path.dirname(fileURLToPath(import.meta.url));
const evidence = path.join(root, 'repositories/cca-conformance/evidence/mo1307/missing-leaf-lifecycle/diagnostic-preparation-2');
const preflightFailure = path.join(root, 'repositories/cca-conformance/evidence/mo1307/missing-leaf-lifecycle/diagnostic-preflight-1.json');
const helper = path.join(root, 'repositories/memoryos-readiness/helpers/windows-inspect.ps1');
const retainedRoot = path.join(root, 'repositories/cca-conformance/evidence/mo1307/slot5-deadline-correction/native-filesystem');
const expectedRoot = path.join(root, 'repositories/cca-conformance/evidence/mo1307/n15-correction/native-filesystem');
const requestSource = path.join(retainedRoot, '018.request.bin');
const expectedResponseSource = path.join(expectedRoot, '018.response.bin');
const fixtureRoot = path.join(root, '.cache/mo1307-slot5-deadline-correction/filesystem-28180/input');
const hash = bytes => 'sha256:' + createHash('sha256').update(bytes).digest('hex');
const record = file => { const bytes = fs.readFileSync(file); return { path: path.relative(root, file).replaceAll('\\', '/'), byteLength: bytes.length, sha256: hash(bytes) }; };
const write = (name, value) => fs.writeFileSync(path.join(evidence, name), Buffer.isBuffer(value) ? value : Buffer.from(typeof value === 'string' ? value : JSON.stringify(value, null, 2) + '\n'), { flag: 'wx' });
const walk = (base, prefix = '') => fs.readdirSync(path.join(base, prefix), { withFileTypes: true }).sort((a, b) => a.name < b.name ? -1 : 1).flatMap(entry => {
  const relative = prefix ? prefix + '/' + entry.name : entry.name;
  const stat = fs.lstatSync(path.join(base, relative));
  assert.equal(stat.isSymbolicLink(), false);
  return stat.isDirectory() ? walk(base, relative) : [{ ...record(path.join(base, relative)), relative }];
});
const topology = (base, prefix = '') => fs.readdirSync(path.join(base, prefix), { withFileTypes: true }).sort((a, b) => a.name < b.name ? -1 : 1).flatMap(entry => {
  const relative = prefix ? prefix + '/' + entry.name : entry.name;
  const stat = fs.lstatSync(path.join(base, relative));
  assert.equal(stat.isSymbolicLink(), false);
  return [{ relative, type: stat.isDirectory() ? 'directory' : 'file' }, ...(stat.isDirectory() ? topology(base, relative) : [])];
});

assert.equal(process.argv.length, 2, 'No alternate preparation input');
assert.equal(path.resolve(root).toLowerCase(), 'c:\\m7fix');
assert.equal(process.platform, 'win32');
assert.equal(process.arch, 'x64');
assert.equal(process.version, 'v24.21.0');
assert.equal(fs.existsSync(evidence), false, 'The append-only diagnostic preparation already exists');
assert.equal(fs.existsSync(fixtureRoot), true);
assert.equal(fs.existsSync(path.join(fixtureRoot, 'missing.bin')), false);

const original = fs.readFileSync(helper);
const source = original.toString('utf8');
assert.deepEqual(Buffer.from(source), original);
assert.equal(source.includes('\r'), false);
assert.equal(hash(original), 'sha256:97ef5ae9ce7ab390548b04a2aefba9f922c3e1c6b9b80581c6c274f0b21f0127');

const patches = [];
function add(label, before, after) {
  assert.equal(source.split(before).length, 2, 'Unique instrumentation anchor: ' + label);
  patches.push({ label, offset: source.indexOf(before), before, after });
}

add('T1-entry-tick',
  '# Fixed MemoryOS readiness wire 2.0 checked native acquisition; PowerShell 5.1.\n',
  '# Fixed MemoryOS readiness wire 2.0 checked native acquisition; PowerShell 5.1.\n$script:diagEntryTick = [Diagnostics.Stopwatch]::GetTimestamp()\n');

const preamble = [
  '$script:diagStream = $null',
  '$script:diagFrequency = [Diagnostics.Stopwatch]::Frequency',
  '$script:diagTicks = [long[]]::new(14)',
  '$script:diagRootValidations = 0L',
  '$script:diagRelativeValidations = 0L',
  '$script:diagSegmentValidations = 0L',
  '$script:diagOpenChains = 0L',
  '$script:diagChainComponents = 0L',
  '$script:diagFilesAttempted = 0L',
  '$script:diagFilesProcessed = 0L',
  '$script:diagCreateFileW = 0L',
  '$script:diagLastErrorReads = 0L',
  '$script:diagGetFileInformationByHandle = 0L',
  '$script:diagGetFinalPathNameByHandleW = 0L',
  '$script:diagGetFileType = 0L',
  '$script:diagGetStdHandle = 0L',
  '$script:diagGetConsoleProcessList = 0L',
  '$script:diagFreeConsole = 0L',
  '$script:diagStablePasses = 0L',
  '$script:diagHeldChecks = 0L',
  '$script:diagFreshReopens = 0L',
  '$script:diagHandleDisposals = 0L',
  '$script:diagSuccessfulHandles = 0L',
  '$script:diagResponseBytes = 0L',
  'function Write-DiagnosticMark([string] $Stage, [long] $Tick = -1) {',
  '    if ($Tick -lt 0) { $Tick = [Diagnostics.Stopwatch]::GetTimestamp() }',
  '    $index = [int] $Stage.Substring(1)',
  '    $script:diagTicks[$index] = $Tick',
  '    if ($null -eq $script:diagStream) { return }',
  '    try {',
  "        $line = 'MO1307D|' + $Stage + '|' + $Tick.ToString([Globalization.CultureInfo]::InvariantCulture) + '|' + $script:diagFrequency.ToString([Globalization.CultureInfo]::InvariantCulture) + [char]10",
  '        $bytes = [Text.Encoding]::ASCII.GetBytes($line)',
  '        $script:diagStream.Write($bytes, 0, $bytes.Length)',
  '        $script:diagStream.Flush()',
  '    } catch { }',
  '}',
  'function Get-DiagnosticCountsText {',
  '        $counts = @(',
  "            'rootValidations=' + $script:diagRootValidations, 'relativeValidations=' + $script:diagRelativeValidations,",
  "            'segmentValidations=' + $script:diagSegmentValidations, 'openChains=' + $script:diagOpenChains,",
  "            'chainComponents=' + $script:diagChainComponents, 'filesAttempted=' + $script:diagFilesAttempted,",
  "            'filesProcessed=' + $script:diagFilesProcessed, 'createFileW=' + $script:diagCreateFileW,",
  "            'lastErrorReads=' + $script:diagLastErrorReads, 'getFileInformationByHandle=' + $script:diagGetFileInformationByHandle,",
  "            'getFinalPathNameByHandleW=' + $script:diagGetFinalPathNameByHandleW, 'getFileType=' + $script:diagGetFileType,",
  "            'getStdHandle=' + $script:diagGetStdHandle, 'getConsoleProcessList=' + $script:diagGetConsoleProcessList,",
  "            'freeConsole=' + $script:diagFreeConsole, 'stablePasses=' + $script:diagStablePasses,",
  "            'heldChecks=' + $script:diagHeldChecks, 'freshReopens=' + $script:diagFreshReopens,",
  "            'handleDisposals=' + $script:diagHandleDisposals, 'successfulHandles=' + $script:diagSuccessfulHandles,",
  "            'responseBytes=' + $script:diagResponseBytes",
  '        )',
  "        return [string]::Join(',', $counts)",
  '}',
  'function Write-DiagnosticSnapshot([string] $Stage) {',
  '    if ($null -eq $script:diagStream) { return }',
  '    try {',
  "        $line = 'MO1307D|SNAPSHOT|' + $Stage + '|' + (Get-DiagnosticCountsText) + [char]10",
  '        $bytes = [Text.Encoding]::ASCII.GetBytes($line)',
  '        $script:diagStream.Write($bytes, 0, $bytes.Length)',
  '        $script:diagStream.Flush()',
  '    } catch { }',
  '}',
].join('\n') + '\n';
add('diagnostic-preamble', '$nativeResult = $null\n', '$nativeResult = $null\n' + preamble);

add('segment-validation-count', 'function Assert-Segment([string] $Value) {\n', 'function Assert-Segment([string] $Value) {\n    $script:diagSegmentValidations++\n');
add('root-validation-count', 'function Assert-Root($Value) {\n', 'function Assert-Root($Value) {\n    $script:diagRootValidations++\n');
add('relative-validation-count', 'function Assert-Relative($Value) {\n', 'function Assert-Relative($Value) {\n    $script:diagRelativeValidations++\n');

add('startup-standard-native-counts', [
  '    foreach ($selector in @(-10, -11, -12)) {',
  '        $standardHandle = $script:native::GetStdHandle($selector)',
  '        if ($standardHandle -eq [IntPtr]::Zero -or $standardHandle -eq [IntPtr]::new(-1) -or',
  "            $script:native::GetFileType($standardHandle) -ne 3) { Reject-Protocol 'MO1307_INTERNAL' }",
].join('\n'), [
  '    foreach ($selector in @(-10, -11, -12)) {',
  '        $script:diagGetStdHandle++',
  '        $standardHandle = $script:native::GetStdHandle($selector)',
  '        $script:diagGetFileType++',
  '        $standardType = $script:native::GetFileType($standardHandle)',
  '        if ($standardHandle -eq [IntPtr]::Zero -or $standardHandle -eq [IntPtr]::new(-1) -or',
  "            $standardType -ne 3) { Reject-Protocol 'MO1307_INTERNAL' }",
].join('\n'));
add('startup-console-list-count', '        $count = $script:native::GetConsoleProcessList($buffer, 1)\n', '        $script:diagGetConsoleProcessList++\n        $count = $script:native::GetConsoleProcessList($buffer, 1)\n');
add('startup-free-console-count', "        if (-not $script:native::FreeConsole()) { Reject-Protocol 'MO1307_INTERNAL' }\n", "        $script:diagFreeConsole++\n        if (-not $script:native::FreeConsole()) { Reject-Protocol 'MO1307_INTERNAL' }\n");

add('open-native-call-count', [
  '    $handle = $script:native::CreateFileW($Path, $access, $sharing, [IntPtr]::Zero, 3, 0x02200000, [IntPtr]::Zero)',
  '    $nativeError = [Runtime.InteropServices.Marshal]::GetLastWin32Error()',
].join('\n'), [
  '    $script:diagCreateFileW++',
  '    $handle = $script:native::CreateFileW($Path, $access, $sharing, [IntPtr]::Zero, 3, 0x02200000, [IntPtr]::Zero)',
  '    $nativeError = [Runtime.InteropServices.Marshal]::GetLastWin32Error()',
  '    $script:diagLastErrorReads++',
].join('\n'));
add('missing-leaf-decision-and-handle-counts', [
  '    if ($handle.IsInvalid) {',
  '        $handle.Dispose()',
  "        if ($InputLeaf -and $nativeError -eq 2) { Reject-Protocol 'MO1307_INPUT' }",
  "        Reject-Protocol 'MO1307_FILESYSTEM_BOUNDARY'",
  '    }',
  '    return $handle',
].join('\n'), [
  '    if ($handle.IsInvalid) {',
  "        if ($InputLeaf -and $nativeError -eq 2) {",
  "            Write-DiagnosticMark 'T7'; Write-DiagnosticSnapshot 'T7'",
  '            $handle.Dispose(); $script:diagHandleDisposals++',
  "            Reject-Protocol 'MO1307_INPUT'",
  '        }',
  '        $handle.Dispose(); $script:diagHandleDisposals++',
  "        Reject-Protocol 'MO1307_FILESYSTEM_BOUNDARY'",
  '    }',
  '    $script:diagSuccessfulHandles++',
  '    return $handle',
].join('\n'));

add('identity-information-count', "        if (-not $script:native::GetFileInformationByHandle($Handle, $buffer)) { Reject-Protocol 'MO1307_FILESYSTEM_BOUNDARY' }\n", "        $script:diagGetFileInformationByHandle++\n        if (-not $script:native::GetFileInformationByHandle($Handle, $buffer)) { Reject-Protocol 'MO1307_FILESYSTEM_BOUNDARY' }\n");
add('identity-file-type-count', [
  '        if (($attributes -band 0x400) -ne 0 -or (($attributes -band 0x10) -ne 0) -ne $Directory -or',
  '            $links -lt 1 -or (-not $Directory -and $links -ne 1) -or $length -gt 9007199254740991 -or',
  "            $script:native::GetFileType($Handle) -ne 1) { Reject-Protocol 'MO1307_FILESYSTEM_BOUNDARY' }",
].join('\n'), [
  '        $script:diagGetFileType++',
  '        $identityFileType = $script:native::GetFileType($Handle)',
  '        if (($attributes -band 0x400) -ne 0 -or (($attributes -band 0x10) -ne 0) -ne $Directory -or',
  '            $links -lt 1 -or (-not $Directory -and $links -ne 1) -or $length -gt 9007199254740991 -or',
  "            $identityFileType -ne 1) { Reject-Protocol 'MO1307_FILESYSTEM_BOUNDARY' }",
].join('\n'));
add('identity-final-path-count', '        $count = $script:native::GetFinalPathNameByHandleW($Handle, $final, 512, 0)\n', '        $script:diagGetFinalPathNameByHandleW++\n        $count = $script:native::GetFinalPathNameByHandleW($Handle, $final, 512, 0)\n');

add('open-chain-count', 'function Open-Chain([string] $Path, [bool] $Directory, [bool] $InputLeaf = $false) {\n', 'function Open-Chain([string] $Path, [bool] $Directory, [bool] $InputLeaf = $false) {\n    $script:diagOpenChains++\n');
add('chain-component-count', '        for ($index = 0; $index -lt $paths.Count; $index++) {\n', '        for ($index = 0; $index -lt $paths.Count; $index++) {\n            $script:diagChainComponents++\n');
add('identity-failure-disposal-count', '            catch { $handle.Dispose(); throw }\n', '            catch { $handle.Dispose(); $script:diagHandleDisposals++; throw }\n');
add('open-chain-unwind-disposal-count', '    } catch { foreach ($entry in $entries) { $entry.handle.Dispose() }; throw }\n', '    } catch { foreach ($entry in $entries) { $entry.handle.Dispose(); $script:diagHandleDisposals++ }; throw }\n');
add('close-chain-disposal-count', 'function Close-Chain($Entries) { foreach ($entry in $Entries) { $entry.handle.Dispose() } }\n', 'function Close-Chain($Entries) { foreach ($entry in $Entries) { $entry.handle.Dispose(); $script:diagHandleDisposals++ } }\n');
add('stable-pass-count', 'function Assert-ChainStable($Entries) {\n', 'function Assert-ChainStable($Entries) {\n    $script:diagStablePasses++\n');
add('held-and-fresh-counts', [
  '    foreach ($entry in $Entries) {',
  '        Assert-SameIdentity $entry.identity (Read-Identity $entry.handle $entry.path $entry.directory)',
  '        # A fresh handle proves the path still names the original identity.',
  '        $fresh = Open-Native $entry.path $entry.directory',
].join('\n'), [
  '    foreach ($entry in $Entries) {',
  '        $script:diagHeldChecks++',
  '        Assert-SameIdentity $entry.identity (Read-Identity $entry.handle $entry.path $entry.directory)',
  '        # A fresh handle proves the path still names the original identity.',
  '        $script:diagFreshReopens++',
  '        $fresh = Open-Native $entry.path $entry.directory',
].join('\n'));
add('fresh-disposal-count', '        finally { $fresh.Dispose() }\n', '        finally { $fresh.Dispose(); $script:diagHandleDisposals++ }\n');

add('T1-stream-and-T2-native', [
  '    $savedStderr = [Console]::OpenStandardError()',
  '    if ([object]::ReferenceEquals($stdin, [IO.Stream]::Null) -or',
].join('\n'), [
  '    $savedStderr = [Console]::OpenStandardError()',
  '    $script:diagStream = $savedStderr',
  "    Write-DiagnosticMark 'T1' $script:diagEntryTick",
  '    if ([object]::ReferenceEquals($stdin, [IO.Stream]::Null) -or',
].join('\n'));
add('T2-native-complete', '    Initialize-Native\n} catch { exit 22 }\n', "    Initialize-Native\n    Write-DiagnosticMark 'T2'\n} catch { exit 22 }\n");
add('T3-request-read', '    if ($stdin.ReadByte() -ne -1) { Reject-Protocol }\n', "    if ($stdin.ReadByte() -ne -1) { Reject-Protocol }\n    Write-DiagnosticMark 'T3'\n");
add('T4-parse-schema', "    $ids = @($request.files | ForEach-Object { $_.id }) -join ','\n", "    Write-DiagnosticMark 'T4'\n    $ids = @($request.files | ForEach-Object { $_.id }) -join ','\n");
add('T5-validation-complete', '    $nativeMode = $true\n', "    Write-DiagnosticMark 'T5'\n    $nativeMode = $true\n");
add('T6-file-acquisition', '        foreach ($file in $Request.files) {\n            $full =', "        foreach ($file in $Request.files) {\n            $script:diagFilesAttempted++\n            Write-DiagnosticMark 'T6'\n            $full =");
add('files-processed-count', '                $responseFiles.Add([pscustomobject] @{ id = $file.id; identity = $leaf.identity; bytes = $chunks.ToArray() })\n', '                $responseFiles.Add([pscustomobject] @{ id = $file.id; identity = $leaf.identity; bytes = $chunks.ToArray() })\n                $script:diagFilesProcessed++\n');
add('T8-acquisition-unwound', [
  "    if ($operation -ceq 'READ_SET') { $nativeResult = Invoke-ReadSet $request $roots }",
  '    else { $nativeResult = Invoke-Inspection $request $roots }',
  '    $code = $null',
  '} catch {',
].join('\n'), [
  "    if ($operation -ceq 'READ_SET') { $nativeResult = Invoke-ReadSet $request $roots }",
  '    else { $nativeResult = Invoke-Inspection $request $roots }',
  "    Write-DiagnosticMark 'T8'",
  "    Write-DiagnosticSnapshot 'T8'",
  '    $code = $null',
  '} catch {',
  "    Write-DiagnosticMark 'T8'",
  "    Write-DiagnosticSnapshot 'T8'",
].join('\n'));
add('T9-response-object', [
  '    if ($null -eq $code -and $null -ne $nativeResult) {',
  '        $response.files = $nativeResult.files; $response.roots = $nativeResult.roots; $response.status = $nativeResult.status',
  '    }',
  '    $replyBytes =',
].join('\n'), [
  '    if ($null -eq $code -and $null -ne $nativeResult) {',
  '        $response.files = $nativeResult.files; $response.roots = $nativeResult.roots; $response.status = $nativeResult.status',
  '    }',
  "    Write-DiagnosticMark 'T9'",
  '    $replyBytes =',
].join('\n'));
add('T10-serialization', [
  '    $replyBytes = [Text.UTF8Encoding]::new($false, $true).GetBytes($reply)',
  '}',
  '$length = [uint32] $replyBytes.Length',
].join('\n'), [
  '    $replyBytes = [Text.UTF8Encoding]::new($false, $true).GetBytes($reply)',
  '}',
  '$script:diagResponseBytes = [long] $replyBytes.Length + 4',
  "Write-DiagnosticMark 'T10'",
  "Write-DiagnosticSnapshot 'T10'",
  '$length = [uint32] $replyBytes.Length',
].join('\n'));
add('T11-T13-output-exit', [
  '$stdout.Write($replyHeader, 0, 4)',
  '$stdout.Write($replyBytes, 0, $replyBytes.Length)',
  '$stdout.Flush()',
  'exit 0',
].join('\n'), [
  '$stdout.Write($replyHeader, 0, 4)',
  "Write-DiagnosticMark 'T11'",
  '$stdout.Write($replyBytes, 0, $replyBytes.Length)',
  '$stdout.Flush()',
  "Write-DiagnosticMark 'T12'",
  "Write-DiagnosticMark 'T13'",
  'exit 0',
].join('\n'));

patches.sort((a, b) => a.offset - b.offset);
for (let i = 1; i < patches.length; i++) assert.ok(patches[i - 1].offset + patches[i - 1].before.length <= patches[i].offset, 'Patches must not overlap');
let copy = source;
for (const patch of [...patches].reverse()) copy = copy.slice(0, patch.offset) + patch.after + copy.slice(patch.offset + patch.before.length);
let inverse = copy;
for (const patch of [...patches].reverse()) {
  assert.equal(inverse.split(patch.after).length, 2, 'Unique inverse anchor: ' + patch.label);
  inverse = inverse.replace(patch.after, patch.before);
}
assert.deepEqual(Buffer.from(inverse), original);

const request = fs.readFileSync(requestSource);
assert.equal(request.length, 370);
assert.equal(request.readUInt32BE(0), 366);
assert.equal(hash(request), 'sha256:bc7fc31df72889016b27af48de1693cddadf3181d2f763d78d1ddec73b24c5ee');
const requestObject = JSON.parse(request.subarray(4).toString('utf8'));
assert.equal(requestObject.operation, 'READ_SET');
assert.equal(requestObject.sequence, 3);
assert.equal(requestObject.files.length, 1);
assert.deepEqual(requestObject.files[0], { id: 'missing', maxBytes: 2097152, path: 'missing.bin', root: 'input' });
assert.equal(path.resolve(requestObject.roots[0].path).toLowerCase(), fixtureRoot.toLowerCase());
const expectedResponse = fs.readFileSync(expectedResponseSource);
assert.equal(expectedResponse.length, 239);
assert.equal(hash(expectedResponse), 'sha256:f613a4ff5e77ede05ac444f4c44670cebd60aa7ac097abb7db1e472511a6f2ea');
const sourceInventoryPath = path.join(root, 'repositories/cca-conformance/evidence/mo1307/slot5-deadline-correction/validation-source.json');
const sourceManifest = JSON.parse(fs.readFileSync(sourceInventoryPath));
assert.equal(sourceManifest.sourceIdentity, 'sha256:8ade4e1b48b1cb4ab990462a2d40a97507a9800dda6c3cab3aded161573d440f');
assert.equal(sourceManifest.packageMembers.length, 89);
for (const member of sourceManifest.packageMembers) assert.deepEqual(record(path.join(root, member.path)), member);
const fixtureFiles = walk(fixtureRoot);
const fixtureTopology = topology(fixtureRoot);
assert.equal(fixtureFiles.length, 1);
assert.equal(fixtureFiles[0].relative, 'a.bin');
assert.deepEqual(fixtureTopology, [{ relative: 'a.bin', type: 'file' }]);

fs.mkdirSync(evidence, { recursive: false });
write('instrumented.ps1', Buffer.from(copy));
write('inverse-reconstruction.ps1.data', Buffer.from(inverse));
write('request.bin', request);
write('expected-response.bin', expectedResponse);
write('replacement-ledger.json', patches);
write('preparation.json', {
  kind: 'MO1307MissingLeafLifecycleDiagnosticPreparation', result: 'PASS', helperExecutions: 0,
  preflightCorrection: record(preflightFailure), priorPreparation: record(path.join(root, 'repositories/cca-conformance/evidence/mo1307/missing-leaf-lifecycle/diagnostic-preparation/preparation.json')),
  source: record(helper), sourceInventory: record(sourceInventoryPath), sourceIdentity: sourceManifest.sourceIdentity,
  generator: record(fileURLToPath(import.meta.url)), observer: record(path.join(toolRoot, 'observe.mjs')),
  diagnosticCopy: record(path.join(evidence, 'instrumented.ps1')), inverse: record(path.join(evidence, 'inverse-reconstruction.ps1.data')),
  exactInverseEquality: true, replacements: patches.length, ledger: record(path.join(evidence, 'replacement-ledger.json')),
  request: record(path.join(evidence, 'request.bin')), retainedRequest: record(requestSource),
  expectedResponse: record(path.join(evidence, 'expected-response.bin')), retainedExpectedResponse: record(expectedResponseSource),
  fixtureRoot, fixtureFiles, fixtureTopology, missingLeaf: path.join(fixtureRoot, 'missing.bin'), packageMembers: sourceManifest.packageMembers,
  instrumentation: {
    stages: Array.from({ length: 13 }, (_, index) => 'T' + (index + 1)), t14External: true,
    stageDefinitions: { T4: 'canonical request plus nested root/file schema and lexical validation complete',
      T5: 'all operation, root-use, cap, ordering, and admission validation complete',
      T7: 'missing-leaf predicate true before invalid-handle disposal', T13: 'final flushed minimal marker immediately before exit' },
    rawClock: 'System.Diagnostics.Stopwatch.GetTimestamp/Frequency', stderrPrefix: 'MO1307D',
    stderrMaximumBytes: 4096, stdoutInstrumentation: false, productionMutation: false,
    createFileLastErrorAdjacency: 'The CreateFileW counter increments before CreateFileW. The original GetLastWin32Error remains the immediate next statement, and its counter increments only after the captured value is stored.',
    liveEvidence: 'Every stage marker and the T7/T8/T10 counter snapshots are synchronously written and flushed. T13 is the final minimal marker immediately before exit.'
  },
  expectedCounts: { filesAttempted: 1, filesProcessed: 0, createFileW: 13, lastErrorReads: 13,
    getFileInformationByHandle: 12, getFinalPathNameByHandleW: 12, getFileType: 15, getStdHandle: 3,
    getConsoleProcessList: 1, freeConsole: 1, nativeImportedCalls: 57, rootValidations: 1,
    relativeValidations: 1, segmentValidations: 6, openChains: 2, chainComponents: 13,
    stablePasses: 0, heldChecks: 0, freshReopens: 0, handleDisposals: 13, successfulHandles: 12,
    responseBytes: 239 },
  sourceMembers: sourceManifest.packageMembers, certification: false
});
console.log(JSON.stringify({ result: 'PREPARED_ONLY', helperExecutions: 0, evidence, diagnosticCopy: record(path.join(evidence, 'instrumented.ps1')) }));
