// One bounded, metadata-only reflection of the exact C3TB native bindings.
// No emitted native method is invoked and no helper request is constructed.
import assert from 'node:assert/strict';
import crypto from 'node:crypto';
import fs from 'node:fs';
import path from 'node:path';
import { spawnSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';

const ROOT = fileURLToPath(new URL('../../../../', import.meta.url));
const EXPECTED_ROOT = 'C:/Users/melsa/Documents/Codex/3cr2';
const EVIDENCE_RELATIVE = 'repositories/cca-conformance/evidence/mo1307/phase3cr2-c3tb-g2/native-last-error';
const EVIDENCE = path.join(ROOT, EVIDENCE_RELATIVE);
const SOURCE_RELATIVE = 'repositories/memoryos-readiness/helpers/windows-inspect.ps1';
const SOURCE = path.join(ROOT, SOURCE_RELATIVE);
const SELF = fileURLToPath(import.meta.url);
const GIT = 'C:/Program Files/Git/cmd/git.exe';
const POWERSHELL = 'C:/Windows/System32/WindowsPowerShell/v1.0/powershell.exe';
const C3T = '65e24b2debdd70ecb8e52fbccbd6c101621f1917';
const C3TB = '119e68bdcf0ffc906b4ca03a912aadcb25908346';
const C3TB_TREE = '5e0088965d4eac4002165fe0190f275c257985ba';
const PRODUCTION_TREE = '324bf600b6cbfaa8564db27fce2d999711270cb8';
const BRANCH = 'codex/mo1307-phase3cr2-c3tb';
const SOURCE_EXPECTED = Object.freeze({
  path: SOURCE_RELATIVE,
  byteLength: 29153,
  sha256: 'sha256:97ef5ae9ce7ab390548b04a2aefba9f922c3e1c6b9b80581c6c274f0b21f0127',
});
const SOURCE_BLOB = '7ca55b8713108465099ecfce9796e06e3db67bd2';
const NODE = Object.freeze({
  path: '.cache/mo1307-phase3cr2-runtime/node.exe',
  version: 'v24.21.0',
  platform: 'win32',
  arch: 'x64',
  byteLength: 93580104,
  sha256: 'sha256:ba4e6d110e8c1592a1ecd390f6b05f3da124b13871a5be62b341a07a853c6c32',
});
const CASE_ID = 'createfile-setlasterror-effective-metadata-and-source-semantics';
const FIXED_ENV = Object.freeze({ SystemRoot: 'C:\\Windows', WINDIR: 'C:\\Windows' });

const sha256 = bytes => `sha256:${crypto.createHash('sha256').update(bytes).digest('hex')}`;
const slash = value => value.replaceAll('\\', '/');
const relative = value => slash(path.relative(ROOT, value));
const bytes = value => fs.readFileSync(value);
const record = value => {
  const content = bytes(value);
  return { path: relative(value), byteLength: content.length, sha256: sha256(content) };
};
const put = (name, content) => {
  const target = path.join(EVIDENCE, name);
  fs.writeFileSync(target, content, { flag: 'wx' });
  return record(target);
};
const write = (name, value) => put(name, Buffer.from(`${JSON.stringify(value, null, 2)}\n`));
const git = (args, options = {}) => {
  const result = spawnSync(GIT, ['-c', 'core.longpaths=true', '-c', `safe.directory=${slash(path.resolve(ROOT)).replace(/\/$/, '')}`, ...args], {
    cwd: ROOT,
    env: FIXED_ENV,
    windowsHide: true,
    shell: false,
    encoding: Object.hasOwn(options, 'encoding') ? options.encoding : 'utf8',
    timeout: 30000,
    maxBuffer: options.maxBuffer ?? 64 * 1024 * 1024,
  });
  assert.ifError(result.error);
  assert.equal(result.signal, null);
  assert.equal(result.status, 0, Buffer.isBuffer(result.stderr) ? result.stderr.toString('utf8') : result.stderr);
  return result.stdout;
};
const gitText = args => git(args).trim();
const occurrenceCount = (source, pattern) => source.match(pattern)?.length ?? 0;
const sourceLine = (source, offset) => source.slice(0, offset).split(/\r?\n/).length;

const EXPECTED_METADATA = Object.freeze([
  {
    key: 'CreateFileW:System.String,System.UInt32,System.UInt32,System.IntPtr,System.UInt32,System.UInt32,System.IntPtr',
    name: 'CreateFileW',
    returnType: 'Microsoft.Win32.SafeHandles.SafeFileHandle',
    parameterTypes: ['System.String', 'System.UInt32', 'System.UInt32', 'System.IntPtr', 'System.UInt32', 'System.UInt32', 'System.IntPtr'],
    library: 'kernel32.dll', entryPoint: 'CreateFileW', charSet: 3, callingConvention: 1,
    preserveSig: true, setLastError: true, exactSpelling: true, pinvokeImpl: true, implementationFlags: 128,
  },
  {
    key: 'FreeConsole:', name: 'FreeConsole', returnType: 'System.Boolean', parameterTypes: [],
    library: 'kernel32.dll', entryPoint: 'FreeConsole', charSet: 3, callingConvention: 1,
    preserveSig: true, setLastError: false, exactSpelling: false, pinvokeImpl: true, implementationFlags: 128,
  },
  {
    key: 'GetConsoleProcessList:System.IntPtr,System.UInt32', name: 'GetConsoleProcessList', returnType: 'System.UInt32', parameterTypes: ['System.IntPtr', 'System.UInt32'],
    library: 'kernel32.dll', entryPoint: 'GetConsoleProcessList', charSet: 3, callingConvention: 1,
    preserveSig: true, setLastError: false, exactSpelling: false, pinvokeImpl: true, implementationFlags: 128,
  },
  {
    key: 'GetFileInformationByHandle:Microsoft.Win32.SafeHandles.SafeFileHandle,System.IntPtr', name: 'GetFileInformationByHandle', returnType: 'System.Boolean', parameterTypes: ['Microsoft.Win32.SafeHandles.SafeFileHandle', 'System.IntPtr'],
    library: 'kernel32.dll', entryPoint: 'GetFileInformationByHandle', charSet: 3, callingConvention: 1,
    preserveSig: true, setLastError: false, exactSpelling: false, pinvokeImpl: true, implementationFlags: 128,
  },
  {
    key: 'GetFileType:Microsoft.Win32.SafeHandles.SafeFileHandle', name: 'GetFileType', returnType: 'System.UInt32', parameterTypes: ['Microsoft.Win32.SafeHandles.SafeFileHandle'],
    library: 'kernel32.dll', entryPoint: 'GetFileType', charSet: 3, callingConvention: 1,
    preserveSig: true, setLastError: false, exactSpelling: false, pinvokeImpl: true, implementationFlags: 128,
  },
  {
    key: 'GetFileType:System.IntPtr', name: 'GetFileType', returnType: 'System.UInt32', parameterTypes: ['System.IntPtr'],
    library: 'kernel32.dll', entryPoint: 'GetFileType', charSet: 3, callingConvention: 1,
    preserveSig: true, setLastError: false, exactSpelling: false, pinvokeImpl: true, implementationFlags: 128,
  },
  {
    key: 'GetFinalPathNameByHandleW:Microsoft.Win32.SafeHandles.SafeFileHandle,System.Text.StringBuilder,System.UInt32,System.UInt32', name: 'GetFinalPathNameByHandleW', returnType: 'System.UInt32', parameterTypes: ['Microsoft.Win32.SafeHandles.SafeFileHandle', 'System.Text.StringBuilder', 'System.UInt32', 'System.UInt32'],
    library: 'kernel32.dll', entryPoint: 'GetFinalPathNameByHandleW', charSet: 3, callingConvention: 1,
    preserveSig: true, setLastError: false, exactSpelling: false, pinvokeImpl: true, implementationFlags: 128,
  },
  {
    key: 'GetStdHandle:System.Int32', name: 'GetStdHandle', returnType: 'System.IntPtr', parameterTypes: ['System.Int32'],
    library: 'kernel32.dll', entryPoint: 'GetStdHandle', charSet: 3, callingConvention: 1,
    preserveSig: true, setLastError: false, exactSpelling: false, pinvokeImpl: true, implementationFlags: 128,
  },
]);
const EXPECTED_KEYS = EXPECTED_METADATA.map(row => row.key);

const reflectTail = String.raw`Initialize-Native
$c3rRows = @()
foreach ($c3rMethod in $script:native.GetMethods([Reflection.BindingFlags] 'Public, Static, DeclaredOnly')) {
    $c3rAttributes = @($c3rMethod.GetCustomAttributes([Runtime.InteropServices.DllImportAttribute], $false))
    if ($c3rAttributes.Length -ne 1) { throw 'Exactly one live DllImport mapping required' }
    $c3rAttribute = $c3rAttributes[0]
    $c3rTypes = @($c3rMethod.GetParameters() | ForEach-Object { $_.ParameterType.FullName })
    $c3rRows += [pscustomobject] @{
        key = $c3rMethod.Name + ':' + ($c3rTypes -join ',')
        name = $c3rMethod.Name
        returnType = $c3rMethod.ReturnType.FullName
        parameterTypes = $c3rTypes
        library = $c3rAttribute.Value
        entryPoint = $c3rAttribute.EntryPoint
        charSet = [int] $c3rAttribute.CharSet
        callingConvention = [int] $c3rAttribute.CallingConvention
        preserveSig = [bool] $c3rAttribute.PreserveSig
        setLastError = [bool] $c3rAttribute.SetLastError
        exactSpelling = [bool] $c3rAttribute.ExactSpelling
        pinvokeImpl = [bool] (($c3rMethod.Attributes -band [Reflection.MethodAttributes]::PinvokeImpl) -ne 0)
        implementationFlags = [int] $c3rMethod.GetMethodImplementationFlags()
    }
}
ConvertTo-Json -InputObject $c3rRows -Depth 5 -Compress
`;

assert.equal(process.argv.length, 2);
assert.equal(slash(path.resolve(ROOT)).toLowerCase(), EXPECTED_ROOT.toLowerCase());
assert.equal(process.version, NODE.version);
assert.equal(process.platform, NODE.platform);
assert.equal(process.arch, NODE.arch);
assert.equal(slash(path.resolve(process.execPath)).toLowerCase(), slash(path.resolve(ROOT, NODE.path)).toLowerCase());
assert.deepEqual(record(process.execPath), { path: NODE.path, byteLength: NODE.byteLength, sha256: NODE.sha256 });
assert.equal(gitText(['branch', '--show-current']), BRANCH);
assert.equal(gitText(['rev-parse', 'HEAD']), C3TB);
assert.equal(gitText(['show', '-s', '--format=%T', C3TB]), C3TB_TREE);
assert.equal(gitText(['show', '-s', '--format=%P', C3TB]), C3T);
assert.equal(gitText(['rev-parse', 'HEAD:repositories/memoryos-readiness']), PRODUCTION_TREE);
assert.equal(gitText(['rev-parse', `${C3TB}:${SOURCE_RELATIVE}`]), SOURCE_BLOB);
assert.equal(gitText(['status', '--porcelain=v1', '--untracked-files=all', '--', 'repositories/memoryos-readiness']), '');
const sourceBytes = bytes(SOURCE);
assert.deepEqual(record(SOURCE), SOURCE_EXPECTED);
assert.deepEqual(git(['show', `${C3TB}:${SOURCE_RELATIVE}`], { encoding: null }), sourceBytes);
assert.equal(fs.existsSync(EVIDENCE), false, 'Native last-error evidence is one append-only generation.');
fs.mkdirSync(EVIDENCE, { recursive: false });

const caseAccounting = [{ ordinal: 1, id: CASE_ID, status: 'NOT_RUN' }];
const driver = record(SELF);
const runtime = { node: record(process.execPath), powershell: record(POWERSHELL) };
write('case-plan.json', {
  kind: 'MO1307Phase3CR2NativeLastErrorCasePlan', version: '1.0.0', candidate: C3TB,
  count: 1, cases: structuredClone(caseAccounting), maximumMetadataProcesses: 1,
  nativeApiInvocations: 0, helperRequests: 0, engineeringOnly: true,
});

let failure = null;
let generatedScript = null;
let metadataProcess = null;
let sourceAssertions = null;
let sourceUnchanged = false;
try {
  caseAccounting[0].status = 'RUNNING';
  const source = sourceBytes.toString('utf8');
  const extract = (name, nextName) => {
    const token = `function ${name}`;
    const nextToken = `function ${nextName}`;
    assert.equal(source.split(token).length, 2, `Exactly one ${name} function required`);
    const start = source.indexOf(token);
    const end = source.indexOf(nextToken, start);
    assert.ok(start >= 0 && end > start, `${name} extraction boundary`);
    return { name, start, body: source.slice(start, end) };
  };
  const initialize = extract('Initialize-Native', 'Confirm-ConsoleQuiescence');
  assert.equal(occurrenceCount(initialize.body, /^\s+Confirm-ConsoleQuiescence\s*$/gm), 1);
  assert.equal(occurrenceCount(initialize.body, /\$script:native::/g), 0);
  assert.equal(occurrenceCount(initialize.body, /CreateFileW/g), 3);

  const immediateCapture = block => {
    const lines = block.body.split(/\r?\n/);
    const createLines = lines.map((line, index) => ({ line, index })).filter(row => row.line.includes('$script:native::CreateFileW('));
    assert.equal(createLines.length, 1, `${block.name}: one CreateFileW call`);
    const create = createLines[0];
    assert.equal(lines[create.index + 1].trim(), '$nativeError = [Runtime.InteropServices.Marshal]::GetLastWin32Error()');
    assert.equal(occurrenceCount(block.body, /GetLastWin32Error\(\)/g), 1);
    return {
      function: block.name,
      createFileWLine: sourceLine(source, block.start) + create.index,
      getLastWin32ErrorLine: sourceLine(source, block.start) + create.index + 1,
      adjacentPhysicalLines: true,
    };
  };
  const openNative = extract('Open-Native', 'Read-Identity');
  const assertNativeAbsent = extract('Assert-NativeAbsent', 'Invoke-ReadSet');
  const openChain = extract('Open-Chain', 'Close-Chain');
  const captureSites = [immediateCapture(openNative), immediateCapture(assertNativeAbsent)];
  assert.equal(occurrenceCount(source, /GetLastWin32Error\(\)/g), 2);
  assert.equal(occurrenceCount(source, /\$nativeError\s+-eq\s+2/g), 1);
  assert.equal(occurrenceCount(source, /\$nativeError\s+-ne\s+2/g), 1);
  assert.ok(openNative.body.includes("if ($InputLeaf -and $nativeError -eq 2) { Reject-Protocol 'MO1307_INPUT' }"));
  assert.ok(openNative.body.includes("Reject-Protocol 'MO1307_FILESYSTEM_BOUNDARY'"));
  assert.equal(occurrenceCount(openNative.body, /MO1307_INPUT/g), 1);
  assert.equal(occurrenceCount(assertNativeAbsent.body, /MO1307_INPUT/g), 0);
  assert.ok(assertNativeAbsent.body.includes("if (-not $handle.IsInvalid -or $nativeError -ne 2) { Reject-Protocol 'MO1307_FILESYSTEM_BOUNDARY' }"));
  assert.ok(openChain.body.includes('$handle = Open-Native $paths[$index] $isDirectory ($InputLeaf -and -not $isDirectory)'));
  sourceAssertions = {
    exactInitializeNativeExtraction: true,
    inertConfirmConsoleQuiescenceStub: true,
    extractedNativeApiInvocations: 0,
    immediateLastErrorCaptureCallSites: captureSites,
    allGetLastWin32ErrorCallSitesCovered: true,
    error2Comparisons: 2,
    error2OnlyMissingLeafSemantics: true,
    openNativeMissingInputLeafMapsTo: 'MO1307_INPUT',
    openNativeMissingAncestorMapsTo: 'MO1307_FILESYSTEM_BOUNDARY',
    assertNativeAbsentAcceptsOnlyErrorFileNotFound: true,
    allOtherOpenFailuresMapTo: 'MO1307_FILESYSTEM_BOUNDARY',
  };

  const scriptText = "$ErrorActionPreference = 'Stop'\n$ProgressPreference = 'SilentlyContinue'\nfunction Confirm-ConsoleQuiescence { }\n" + initialize.body + reflectTail;
  assert.equal(occurrenceCount(scriptText, /\$script:native::/g), 0);
  assert.equal(occurrenceCount(scriptText, /MemoryOSReadinessHelperRequest/g), 0);
  sourceAssertions.generatedScriptNativeApiInvocationCallSites = 0;
  sourceAssertions.generatedScriptHelperRequestConstructions = 0;
  const scriptBytes = Buffer.from(scriptText);
  generatedScript = put('initialize-native.metadata.ps1', scriptBytes);
  const args = ['-NoLogo', '-NoProfile', '-NonInteractive', '-ExecutionPolicy', 'Bypass', '-File', path.join(ROOT, generatedScript.path)];
  const started = performance.now();
  const run = spawnSync(POWERSHELL, args, {
    cwd: ROOT, env: FIXED_ENV, windowsHide: true, shell: false, encoding: null,
    timeout: 10000, maxBuffer: 131072,
  });
  const stdout = run.stdout ?? Buffer.alloc(0);
  const stderr = run.stderr ?? Buffer.alloc(0);
  metadataProcess = {
    executable: POWERSHELL, args, env: FIXED_ENV, boundedMs: 10000,
    exit: run.status, signal: run.signal,
    error: run.error ? { name: run.error.name, code: run.error.code ?? null, message: run.error.message } : null,
    elapsedMs: performance.now() - started,
    stdout: put('powershell.stdout.data', stdout),
    stderr: put('powershell.stderr.data', stderr),
    result: 'FAIL', metadata: null,
  };
  assert.ifError(run.error);
  assert.equal(run.status, 0);
  assert.equal(run.signal, null);
  assert.equal(stderr.length, 0);
  const metadata = JSON.parse(stdout.toString('utf8'));
  assert.equal(metadata.length, 8);
  metadata.sort((left, right) => left.key < right.key ? -1 : left.key > right.key ? 1 : 0);
  assert.deepEqual(metadata.map(row => row.key), EXPECTED_KEYS);
  assert.deepEqual(metadata, EXPECTED_METADATA);
  const createFile = metadata.find(row => row.name === 'CreateFileW');
  assert.equal(createFile.setLastError, true);
  assert.equal(createFile.exactSpelling, true);
  assert.equal(metadata.filter(row => row.name !== 'CreateFileW').every(row => row.setLastError === false && row.exactSpelling === false), true);
  metadataProcess.metadata = metadata;
  metadataProcess.result = 'PASS';
  caseAccounting[0].status = 'PASS';
} catch (error) {
  failure = { name: error.name, code: error.code ?? null, message: error.message, stack: error.stack };
  if (caseAccounting[0].status === 'RUNNING') caseAccounting[0].status = 'FAIL';
} finally {
  try {
    assert.deepEqual(bytes(SOURCE), sourceBytes);
    assert.deepEqual(record(SOURCE), SOURCE_EXPECTED);
    assert.deepEqual(record(SELF), driver);
    assert.deepEqual(record(process.execPath), runtime.node);
    assert.deepEqual(record(POWERSHELL), runtime.powershell);
    sourceUnchanged = true;
  } catch (error) {
    failure ??= { name: error.name, code: error.code ?? null, message: error.message, stack: error.stack };
    if (caseAccounting[0].status === 'RUNNING' || caseAccounting[0].status === 'PASS') caseAccounting[0].status = 'FAIL';
  }
  const result = failure ? 'FAIL' : 'PASS';
  const receipt = {
    kind: 'MO1307Phase3CR2NativeLastErrorReceipt', version: '1.0.0', candidate: C3TB,
    candidateTree: C3TB_TREE, implementation: C3T, productionTree: PRODUCTION_TREE,
    result, failure, count: 1, caseAccounting, source: SOURCE_EXPECTED,
    sourceGit: { commit: C3TB, blob: SOURCE_BLOB }, driver, runtime, generatedScript,
    metadataProcess, reflectedMethodCount: metadataProcess?.metadata?.length ?? 0,
    exactMethodKeys: EXPECTED_KEYS, exactExpectedMetadata: true,
    createFileW: metadataProcess?.metadata?.find(row => row.name === 'CreateFileW') ?? null,
    otherSevenExpectedUnchangedMetadata: metadataProcess?.result === 'PASS'
      && metadataProcess.metadata.filter(row => row.name !== 'CreateFileW').length === 7
      && metadataProcess.metadata.filter(row => row.name !== 'CreateFileW').every(row => row.setLastError === false && row.exactSpelling === false),
    sourceAssertions, sourceUnchanged, nativeApiInvocations: 0, helperRequests: 0,
    engineeringMetadataProcesses: metadataProcess ? 1 : 0, retries: 0, certification: false,
    scope: 'Exact current C3TB Initialize-Native metadata reflection with an inert Confirm-ConsoleQuiescence stub, plus static call-site proof. No emitted native API is invoked and no helper request is constructed.',
  };
  write('receipt.json', receipt);
  console.log(JSON.stringify({ result, cases: 1, metadataProcesses: receipt.engineeringMetadataProcesses, nativeApiInvocations: 0, receipt: `${EVIDENCE_RELATIVE}/receipt.json` }));
  process.exitCode = failure ? 1 : 0;
}
