// Preparation only: build one reversible INSPECT_PENDING diagnostic helper copy. Never launches PowerShell.
import fs from 'node:fs';
import path from 'node:path';
import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import { spawnSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';

const root = fileURLToPath(new URL('../../../../', import.meta.url));
const toolRoot = path.dirname(fileURLToPath(import.meta.url));
const baseRel = 'repositories/cca-conformance/evidence/mo1307/phase3ar2-c3ub-b-inspect-pending';
const toolRel = 'repositories/cca-conformance/tools/mo1307-phase3ar2-b-inspect-pending';
const preservedGeneration = '789d92f94638ddbe63d38dc957746bf1f7d308c2';
const base = path.join(root, baseRel);
const evidence = path.join(base, 'diagnostic-preparation');
const helper = path.join(root, 'repositories/memoryos-readiness/helpers/windows-inspect.ps1');
const installedManifestPath = path.join(root, 'repositories/cca-conformance/evidence/mo1307/phase3ar2-c3ub/installed-before.json');
const installedRoot = path.join(root, '.cache/phase3ar2-c3ub/install/node_modules/memoryos-readiness');
const fixtureRoot = path.join(root, '.cache/phase3ar2-c3ub/v1/p/primary');
const pendingPath = path.join(fixtureRoot, 'memoryos-readiness-result.json.pending');
const finalPath = path.join(fixtureRoot, 'memoryos-readiness-result.json');
const authorizationSource = 'C:/Users/melsa/.codex/attachments/2e05b9be-e7df-4be8-a9bc-c63a5c13d781/Pasted text.txt';
const preservedInvocation = path.join(root, 'repositories/cca-conformance/evidence/mo1307/phase3ar2-c3ub/semantics/B-ready/evaluate/invocation.json');
const preservedObservation = path.join(root, 'repositories/cca-conformance/evidence/mo1307/phase3ar2-c3ub/semantics/B-ready/evaluate/observation.json');
const preservedReceipt = path.join(root, 'repositories/cca-conformance/evidence/mo1307/phase3ar2-c3ub/semantics/B-ready/evaluate/receipt.json');
const hash = bytes => 'sha256:' + createHash('sha256').update(bytes).digest('hex');
const record = file => { const bytes = fs.readFileSync(file); return { path: path.relative(root, file).replaceAll('\\', '/'), byteLength: bytes.length, sha256: hash(bytes) }; };
const evidenceBytes = value => Buffer.isBuffer(value) ? value : Buffer.from(JSON.stringify(value, null, 2) + '\n');
const bindBytes = (file, bytes) => ({ path: path.relative(root, file).replaceAll('\\', '/'), byteLength: bytes.length, sha256: hash(bytes) });
const walk = (directory, prefix = '') => fs.readdirSync(path.join(directory, prefix), { withFileTypes: true }).sort((a, b) => a.name < b.name ? -1 : 1).flatMap(entry => {
  const relative = prefix ? prefix + '/' + entry.name : entry.name;
  const stat = fs.lstatSync(path.join(directory, relative));
  assert.equal(stat.isSymbolicLink(), false);
  return stat.isDirectory() ? walk(directory, relative) : [{ ...record(path.join(directory, relative)), relative }];
});
const topology = (directory, prefix = '') => fs.readdirSync(path.join(directory, prefix), { withFileTypes: true }).sort((a, b) => a.name < b.name ? -1 : 1).flatMap(entry => {
  const relative = prefix ? prefix + '/' + entry.name : entry.name;
  const stat = fs.lstatSync(path.join(directory, relative));
  assert.equal(stat.isSymbolicLink(), false);
  return [{ relative, type: stat.isDirectory() ? 'directory' : 'file' }, ...(stat.isDirectory() ? topology(directory, relative) : [])];
});
function git(...args) {
  const result = spawnSync('C:/Program Files/Git/cmd/git.exe', args, { cwd: root, windowsHide: true, encoding: 'utf8', timeout: 30000, maxBuffer: 4 * 1024 * 1024 });
  assert.ifError(result.error); assert.equal(result.status, 0, result.stderr); return result.stdout.trim();
}

assert.equal(process.argv.length, 2, 'No alternate preparation input');
assert.equal(path.resolve(root).toLowerCase(), 'c:\\users\\melsa\\documents\\codex\\3ar2');
assert.equal(process.platform, 'win32');
assert.equal(process.arch, 'x64');
assert.equal(process.version, 'v24.21.0');
assert.equal(hash(fs.readFileSync(process.execPath)), 'sha256:ba4e6d110e8c1592a1ecd390f6b05f3da124b13871a5be62b341a07a853c6c32');
const diagnosticToolchainCommit = git('rev-parse', 'HEAD');
assert.equal(git('rev-parse', 'HEAD^'), preservedGeneration);
assert.equal(git('branch', '--show-current'), 'codex/mo1307-phase3ar2-c3ub');
assert.equal(git('rev-parse', '91c07b1e93f65ab6252024984073c171ff5d7648:repositories/memoryos-readiness'), '302cf1a506e974b2102a78be1b9c920ac80105b2');
assert.equal(git('rev-parse', 'HEAD:repositories/memoryos-readiness'), '302cf1a506e974b2102a78be1b9c920ac80105b2');
assert.equal(git('status', '--short', '--', 'repositories/memoryos-readiness'), '', 'Production package must be unmodified');
assert.equal(git('status', '--short', '--', toolRel), '', 'Committed diagnostic toolchain must be unmodified');
assert.deepEqual(git('diff-tree', '--no-commit-id', '--name-only', '-r', 'HEAD').split(/\r?\n/u).filter(Boolean).sort(), [
  toolRel + '/classification-rules.json', toolRel + '/instrument.mjs', toolRel + '/observe.mjs',
]);
assert.equal(git('status', '--short', '--', 'repositories/cca-conformance/evidence/mo1307/phase3ar2-c3ub'), '', 'Preserved failed generation must be unmodified');
assert.equal(fs.existsSync(base), false, 'The append-only diagnostic namespace already exists');
assert.equal(fs.existsSync(fixtureRoot), true);
assert.equal(fs.existsSync(pendingPath), true);
assert.equal(fs.existsSync(finalPath), false);

const authorization = fs.readFileSync(authorizationSource);
assert.equal(hash(authorization), 'sha256:46ecb2b7a2ca88709a040ca203e68b7eb40d13c554161ab9bfd951dfd094c179');
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
  '$script:diagTicks = [long[]]::new(13)',
  '$script:diagSnapshots = [string[]]::new(13)',
  '$script:diagRootValidations = 0L',
  '$script:diagRelativeValidations = 0L',
  '$script:diagSegmentValidations = 0L',
  '$script:diagOpenChains = 0L',
  '$script:diagChainComponents = 0L',
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
  '$script:diagRequestBytes = 0L',
  '$script:diagPendingBytes = 0L',
  '$script:diagPathDepth = 0L',
  '$script:diagResponseBytes = 0L',
  'function Write-DiagnosticMark([string] $Stage, [long] $Tick = -1) {',
  '    if ($Tick -lt 0) { $Tick = [Diagnostics.Stopwatch]::GetTimestamp() }',
  '    $index = [int] $Stage.Substring(1)',
  '    $script:diagTicks[$index] = $Tick',
  '}',
  'function Get-DiagnosticCountsText {',
  '    $counts = @(',
  "        'rootValidations=' + $script:diagRootValidations, 'relativeValidations=' + $script:diagRelativeValidations,",
  "        'segmentValidations=' + $script:diagSegmentValidations, 'openChains=' + $script:diagOpenChains,",
  "        'chainComponents=' + $script:diagChainComponents, 'createFileW=' + $script:diagCreateFileW,",
  "        'lastErrorReads=' + $script:diagLastErrorReads, 'getFileInformationByHandle=' + $script:diagGetFileInformationByHandle,",
  "        'getFinalPathNameByHandleW=' + $script:diagGetFinalPathNameByHandleW, 'getFileType=' + $script:diagGetFileType,",
  "        'getStdHandle=' + $script:diagGetStdHandle, 'getConsoleProcessList=' + $script:diagGetConsoleProcessList,",
  "        'freeConsole=' + $script:diagFreeConsole, 'stablePasses=' + $script:diagStablePasses,",
  "        'heldChecks=' + $script:diagHeldChecks, 'freshReopens=' + $script:diagFreshReopens,",
  "        'handleDisposals=' + $script:diagHandleDisposals, 'successfulHandles=' + $script:diagSuccessfulHandles,",
  "        'requestBytes=' + $script:diagRequestBytes, 'pendingBytes=' + $script:diagPendingBytes,",
  "        'pathDepth=' + $script:diagPathDepth, 'responseBytes=' + $script:diagResponseBytes",
  '    )',
  "    return [string]::Join(',', $counts)",
  '}',
  'function Write-DiagnosticSnapshot([string] $Stage) {',
  '    $index = [int] $Stage.Substring(1)',
  '    $script:diagSnapshots[$index] = Get-DiagnosticCountsText',
  '}',
  'function Write-DiagnosticReport {',
  '    if ($null -eq $script:diagStream) { return }',
  '    try {',
  '        $lines = [Collections.Generic.List[string]]::new()',
  '        for ($index = 1; $index -le 12; $index++) {',
  "            $lines.Add('MO1307D|T' + $index + '|' + $script:diagTicks[$index].ToString([Globalization.CultureInfo]::InvariantCulture) + '|' + $script:diagFrequency.ToString([Globalization.CultureInfo]::InvariantCulture))",
  '        }',
  '        foreach ($index in @(2, 6, 7, 12)) {',
  "            $lines.Add('MO1307D|SNAPSHOT|T' + $index + '|' + $script:diagSnapshots[$index])",
  '        }',
  "        $bytes = [Text.Encoding]::ASCII.GetBytes(([string]::Join([char]10, $lines)) + [char]10)",
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
  '        if ($standardHandle -eq [IntPtr]::Zero -or $standardHandle -eq [IntPtr]::new(-1)) { Reject-Protocol \'MO1307_INTERNAL\' }',
  '        $script:diagGetFileType++',
  "        if ($script:native::GetFileType($standardHandle) -ne 3) { Reject-Protocol 'MO1307_INTERNAL' }",
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
add('successful-handle-count', '    return $handle\n', '    $script:diagSuccessfulHandles++\n    return $handle\n');
add('identity-information-count', "        if (-not $script:native::GetFileInformationByHandle($Handle, $buffer)) { Reject-Protocol 'MO1307_FILESYSTEM_BOUNDARY' }\n", "        $script:diagGetFileInformationByHandle++\n        if (-not $script:native::GetFileInformationByHandle($Handle, $buffer)) { Reject-Protocol 'MO1307_FILESYSTEM_BOUNDARY' }\n");
add('identity-file-type-count', [
  '        if (($attributes -band 0x400) -ne 0 -or (($attributes -band 0x10) -ne 0) -ne $Directory -or',
  '            $links -lt 1 -or (-not $Directory -and $links -ne 1) -or $length -gt 9007199254740991 -or',
  "            $script:native::GetFileType($Handle) -ne 1) { Reject-Protocol 'MO1307_FILESYSTEM_BOUNDARY' }",
].join('\n'), [
  '        if (($attributes -band 0x400) -ne 0 -or (($attributes -band 0x10) -ne 0) -ne $Directory -or',
  "            $links -lt 1 -or (-not $Directory -and $links -ne 1) -or $length -gt 9007199254740991) { Reject-Protocol 'MO1307_FILESYSTEM_BOUNDARY' }",
  '        $script:diagGetFileType++',
  "        if ($script:native::GetFileType($Handle) -ne 1) { Reject-Protocol 'MO1307_FILESYSTEM_BOUNDARY' }",
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

add('T6-inspect-pending-acquisition', '    $chain = Open-Chain $path (-not $pending)\n', "    Write-DiagnosticMark 'T6'\n    Write-DiagnosticSnapshot 'T6'\n    $chain = Open-Chain $path (-not $pending)\n");
add('T7-inspect-pending-complete', [
  '        $identities = @($chain | ForEach-Object { $_.identity })',
  '        return [pscustomobject]',
].join('\n'), [
  '        $identities = @($chain | ForEach-Object { $_.identity })',
  '        $script:diagPathDepth = $chain.Count',
  '        $script:diagPendingBytes = $chain[$chain.Count - 1].identity.byteLength',
  "        Write-DiagnosticMark 'T7'",
  "        Write-DiagnosticSnapshot 'T7'",
  '        return [pscustomobject]',
].join('\n'));
add('T1-stream-and-T2-native', [
  '    $savedStderr = [Console]::OpenStandardError()',
  '    if ([object]::ReferenceEquals($stdin, [IO.Stream]::Null) -or',
].join('\n'), [
  '    $savedStderr = [Console]::OpenStandardError()',
  '    $script:diagStream = $savedStderr',
  "    Write-DiagnosticMark 'T1' $script:diagEntryTick",
  '    if ([object]::ReferenceEquals($stdin, [IO.Stream]::Null) -or',
].join('\n'));
add('T2-native-complete', '    Initialize-Native\n} catch { exit 22 }\n', "    Initialize-Native\n    Write-DiagnosticMark 'T2'\n    Write-DiagnosticSnapshot 'T2'\n} catch { exit 22 }\n");
add('T3-request-read', '    if ($stdin.ReadByte() -ne -1) { Reject-Protocol }\n', "    if ($stdin.ReadByte() -ne -1) { Reject-Protocol }\n    $script:diagRequestBytes = [long] $size + 4\n    Write-DiagnosticMark 'T3'\n");
add('T4-parse-schema', '    $roots = [System.Collections.Generic.Dictionary[string,string]]::new([StringComparer]::Ordinal)\n', "    Write-DiagnosticMark 'T4'\n    $roots = [System.Collections.Generic.Dictionary[string,string]]::new([StringComparer]::Ordinal)\n");
add('T5-validation-complete', '    $nativeMode = $true\n', "    Write-DiagnosticMark 'T5'\n    $nativeMode = $true\n");
add('T8-response-object', [
  '    if ($null -eq $code -and $null -ne $nativeResult) {',
  '        $response.files = $nativeResult.files; $response.roots = $nativeResult.roots; $response.status = $nativeResult.status',
  '    }',
  '    $replyBytes =',
].join('\n'), [
  '    if ($null -eq $code -and $null -ne $nativeResult) {',
  '        $response.files = $nativeResult.files; $response.roots = $nativeResult.roots; $response.status = $nativeResult.status',
  '    }',
  "    Write-DiagnosticMark 'T8'",
  '    $replyBytes =',
].join('\n'));
add('T9-serialization', '$stdout = $savedStdout\n', "$script:diagResponseBytes = [long] $replyBytes.Length + 4\nWrite-DiagnosticMark 'T9'\n$stdout = $savedStdout\n");
add('T10-T12-output-exit', [
  '$stdout.Write($replyHeader, 0, 4)',
  '$stdout.Write($replyBytes, 0, $replyBytes.Length)',
  '$stdout.Flush()',
  'exit 0',
].join('\n'), [
  '$stdout.Write($replyHeader, 0, 4)',
  "Write-DiagnosticMark 'T10'",
  '$stdout.Write($replyBytes, 0, $replyBytes.Length)',
  '$stdout.Flush()',
  "Write-DiagnosticMark 'T11'",
  "Write-DiagnosticSnapshot 'T12'",
  "Write-DiagnosticMark 'T12'",
  'Write-DiagnosticReport',
  'exit 0',
].join('\n'));

patches.sort((a, b) => a.offset - b.offset);
for (let index = 1; index < patches.length; index++) assert.ok(patches[index - 1].offset + patches[index - 1].before.length <= patches[index].offset, 'Patches must not overlap');
let copy = source;
for (const patch of [...patches].reverse()) copy = copy.slice(0, patch.offset) + patch.after + copy.slice(patch.offset + patch.before.length);
let inverse = copy;
for (const patch of [...patches].reverse()) {
  assert.equal(inverse.split(patch.after).length, 2, 'Unique inverse anchor: ' + patch.label);
  inverse = inverse.replace(patch.after, patch.before);
}
assert.deepEqual(Buffer.from(inverse), original);

const fixtureFiles = walk(fixtureRoot);
const fixtureTopology = topology(fixtureRoot);
assert.equal(fixtureFiles.length, 1);
assert.equal(fixtureFiles[0].relative, 'memoryos-readiness-result.json.pending');
assert.equal(fixtureFiles[0].byteLength, 59987);
assert.equal(fixtureFiles[0].sha256, 'sha256:8ec1375f09103b8d1b791985065c3589bdf8ba2a4ed661dcc081d48468049fa7');
assert.deepEqual(fixtureTopology, [{ relative: 'memoryos-readiness-result.json.pending', type: 'file' }]);
const pathDepth = 1 + pendingPath.slice(3).split(path.sep).length;
assert.equal(pathDepth, 12);

const installedManifest = JSON.parse(fs.readFileSync(installedManifestPath));
assert.equal(installedManifest.result, 'PASS');
assert.equal(installedManifest.members.length, 89);
assert.equal(installedManifest.packageIdentity, 'sha256:7d11eb0347c284d7acb9197bfdec4f8c36347e4019bdbbd87c3a58e2832aefba');
const installedMembers = walk(installedRoot);
assert.deepEqual(installedMembers.map(row => ({ path: row.relative, byteLength: row.byteLength, sha256: row.sha256 })), installedManifest.members);
const sourceRoot = path.join(root, 'repositories/memoryos-readiness');
const sourceMembers = walk(sourceRoot);
assert.equal(sourceMembers.length, 89);
assert.deepEqual(sourceMembers.map(row => ({ path: row.relative, byteLength: row.byteLength, sha256: row.sha256 })), installedManifest.members);

const { encodeHelperRequest } = await import('../../../memoryos-readiness/src/helper-protocol.mjs');
const session = '46ecb2b7a2ca88709a040ca203e68b7eb40d13c554161ab9bfd951dfd094c179';
const requestObject = { kind: 'MemoryOSReadinessHelperRequest', version: '2.0.0', session, sequence: 8,
  operation: 'INSPECT_PENDING', roots: [{ id: 'output', path: fixtureRoot }], files: [] };
const request = encodeHelperRequest(requestObject);
assert.equal(request.length, 311);
assert.equal(request.readUInt32BE(0), 307);

const preserved = JSON.parse(fs.readFileSync(preservedObservation));
const invocation = JSON.parse(fs.readFileSync(preservedInvocation));
const preservedResult = JSON.parse(fs.readFileSync(preservedReceipt));
assert.equal(hash(fs.readFileSync(preservedInvocation)), 'sha256:25c0fa4ba53e5f66fc51b513df8477087bcb6e1d9c09a0a5175b146196862b6f');
assert.equal(hash(fs.readFileSync(preservedObservation)), 'sha256:2d54aff20768e005e6826bcdbacfa0633aa95f1be41305e8debf2146865d17fe');
assert.equal(hash(fs.readFileSync(preservedReceipt)), 'sha256:43055070edbd604e611a093e9e41021c996492f694c3ef11bfc62afa75febc29');
assert.equal(invocation.step, 'B'); assert.equal(invocation.name, 'ready'); assert.equal(invocation.operation, 'evaluate');
assert.equal(path.resolve(invocation.productArgs.at(-1)).toLowerCase(), fixtureRoot.toLowerCase());
assert.equal(preservedResult.step, 'B'); assert.equal(preservedResult.name, 'ready'); assert.equal(preservedResult.operation, 'evaluate');
assert.equal(preservedResult.result, 'FAIL'); assert.equal(preservedResult.exit, 29); assert.equal(preservedResult.signal, null);
assert.equal(preservedResult.stdout.byteLength, 0);
const failed = preserved.requests[7];
assert.equal(failed.ordinal, 8);
assert.equal(failed.operation, 'INSPECT_PENDING');
assert.equal(failed.sequence, 8);
assert.equal(failed.requestBytes, 311);
assert.equal(failed.requestSha256, 'sha256:9b577cba71ad249f85cc142588f3795f26afbda419cd500c7e9a5883a516c78f');
assert.equal(failed.priorChargedMs, 19297.744300000002);
assert.equal(failed.disposition, 'REJECTED');
assert.equal(failed.error.code, 'MO1307_TIMEOUT');
assert.equal(failed.responseAcceptedByTransport, false);
assert.equal(failed.responseArrived, false);
assert.equal(failed.responseComplete, false);
assert.equal(failed.responseSha256, null);
assert.equal(path.resolve(failed.launch.args.at(-1)).toLowerCase(), path.join(installedRoot, 'helpers/windows-inspect.ps1').toLowerCase());
const helperStart = preserved.supervisors[0].snapshot.events.find(event => event.type === 'start' && event.role === 'helper' && event.ordinal === 8);
assert.ok(helperStart);
const effectiveLeaseMs = helperStart.deadline - helperStart.at;
assert.ok(Math.abs(effectiveLeaseMs - 702.2263) < 0.001);
const t0PreSpawnWindowMs = helperStart.deadline - failed.spawnAt;
assert.ok(Math.abs(t0PreSpawnWindowMs - 702.1707) < 0.001);

const authorizationTarget = path.join(base, 'authorization.txt');
const diagnosticTarget = path.join(evidence, 'instrumented.ps1');
const inverseTarget = path.join(evidence, 'inverse-reconstruction.ps1.data');
const requestTarget = path.join(evidence, 'request.bin');
const ledgerTarget = path.join(evidence, 'replacement-ledger.json');
const preparationTarget = path.join(evidence, 'preparation.json');
const diagnosticBytes = Buffer.from(copy), inverseBytes = Buffer.from(inverse), ledgerBytes = evidenceBytes(patches);
const preparationPayload = {
  kind: 'MO1307Phase3AR2BInspectPendingDiagnosticPreparation', result: 'PASS', helperExecutions: 0,
  diagnosticToolchainCommit, authorization: bindBytes(authorizationTarget, authorization), source: record(helper),
  installedHelper: record(path.join(installedRoot, 'helpers/windows-inspect.ps1')),
  generator: record(fileURLToPath(import.meta.url)), observer: record(path.join(toolRoot, 'observe.mjs')),
  rules: record(path.join(toolRoot, 'classification-rules.json')), diagnosticCopy: bindBytes(diagnosticTarget, diagnosticBytes),
  inverse: bindBytes(inverseTarget, inverseBytes), exactInverseEquality: true,
  replacements: patches.length, ledger: bindBytes(ledgerTarget, ledgerBytes),
  request: bindBytes(requestTarget, request), requestObject,
  originalRequestLimitation: { rawFrameRetained: false, byteIdenticalReplay: false, originalSha256: failed.requestSha256,
    diagnosticSha256: hash(request),
    reason: 'The preserved observer deleted raw request/session bytes after recording metadata. The diagnostic request is semantically exact and the same 311-byte size, but has a fixed fresh session and a different SHA-256.' },
  fixtureRoot, pendingPath, finalPath, fixtureFiles, fixtureTopology, pathDepth,
  sourceMembers, installedMembers, installedManifest: record(installedManifestPath),
  preservedFailure: { invocation: record(preservedInvocation), observation: record(preservedObservation), receipt: record(preservedReceipt),
    priorHelperActiveMs: failed.priorChargedMs, remainingAggregateMs: 20000 - failed.priorChargedMs,
    supervisorLeaseMs: effectiveLeaseMs, t0PreSpawnWindowMs, disposition: failed.disposition, error: failed.error.code,
    responseAccepted: failed.responseAcceptedByTransport },
  instrumentation: {
    stages: Array.from({ length: 12 }, (_, index) => 'T' + (index + 1)), t0External: true, t13External: true,
    rawClock: 'System.Diagnostics.Stopwatch.GetTimestamp/Frequency', stderrPrefix: 'MO1307D',
    stderrMaximumBytes: 4096, stdoutInstrumentation: false, productionMutation: false,
    liveEvidence: 'T1-T12 monotonic ticks and T2/T6/T7/T12 counter snapshots are buffered in memory, then emitted in one bounded diagnostic-stderr write after the unchanged response bytes are fully flushed. The only insertion between the unchanged four-byte header and body writes is the in-memory T10 timestamp required to establish first-byte completion.'
  },
  expectedCounts: { rootValidations: 1, relativeValidations: 0, segmentValidations: 10, openChains: 1,
    chainComponents: 12, createFileW: 24, lastErrorReads: 24, getFileInformationByHandle: 36,
    getFinalPathNameByHandleW: 36, getFileType: 39, getStdHandle: 3, getConsoleProcessList: 1,
    freeConsole: 1, stablePasses: 1, heldChecks: 12, freshReopens: 12, handleDisposals: 24,
    successfulHandles: 24, requestBytes: 311, pendingBytes: 59987, pathDepth: 12, nativeImportedCalls: 140 },
  candidate: { C3UB: '91c07b1e93f65ab6252024984073c171ff5d7648', C3U: '34f42c50abfa1c440416c4cdf7f643f784585588',
    preservedGeneration, productionTree: '302cf1a506e974b2102a78be1b9c920ac80105b2',
    authority: 'PROSPECTIVE_HELPER_BOUND@2.0.0' },
  certification: false, retries: 0, alternateFixtures: 0
};
const preparationBytes = evidenceBytes(preparationPayload);
const staging = base + '.preparing';
assert.equal(fs.existsSync(staging), false, 'Stale diagnostic preparation staging namespace');
fs.mkdirSync(path.join(staging, 'diagnostic-preparation'), { recursive: true });
try {
  const stagePreparation = path.join(staging, 'diagnostic-preparation');
  fs.writeFileSync(path.join(staging, 'authorization.txt'), authorization, { flag: 'wx' });
  fs.writeFileSync(path.join(stagePreparation, 'instrumented.ps1'), diagnosticBytes, { flag: 'wx' });
  fs.writeFileSync(path.join(stagePreparation, 'inverse-reconstruction.ps1.data'), inverseBytes, { flag: 'wx' });
  fs.writeFileSync(path.join(stagePreparation, 'request.bin'), request, { flag: 'wx' });
  fs.writeFileSync(path.join(stagePreparation, 'replacement-ledger.json'), ledgerBytes, { flag: 'wx' });
  fs.writeFileSync(path.join(stagePreparation, 'preparation.json'), preparationBytes, { flag: 'wx' });
  fs.renameSync(staging, base);
} catch (error) {
  if (fs.existsSync(staging)) fs.rmSync(staging, { recursive: true, force: true });
  throw error;
}
for (const binding of [preparationPayload.authorization, preparationPayload.diagnosticCopy, preparationPayload.inverse,
  preparationPayload.ledger, preparationPayload.request]) assert.deepEqual(record(path.join(root, binding.path)), binding);
assert.deepEqual(JSON.parse(fs.readFileSync(preparationTarget)), preparationPayload);
console.log(JSON.stringify({ result: 'PREPARED_ONLY', helperExecutions: 0, evidence, requestBytes: request.length,
  fixtureBytes: fixtureFiles[0].byteLength, pathDepth, diagnosticCopy: record(diagnosticTarget) }));
