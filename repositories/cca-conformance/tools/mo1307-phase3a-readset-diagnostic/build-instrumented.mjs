// ENGINEERING ONLY. Build a measured copy; never execute it or modify production.
import fs from 'node:fs';
import path from 'node:path';
import crypto from 'node:crypto';
import { fileURLToPath } from 'node:url';

const here = path.dirname(fileURLToPath(import.meta.url));
const root = path.resolve(here, '../../../..');
const sourcePath = path.join(root, 'repositories/memoryos-readiness/helpers/windows-inspect.ps1');
const args = Object.fromEntries(process.argv.slice(2).reduce((out, x, i, a) => {
  if (x.startsWith('--')) out.push([x.slice(2), a[i + 1]]);
  return out;
}, []));
for (const key of ['telemetry', 'output', 'delta']) {
  if (!args[key] || !path.isAbsolute(args[key])) throw new Error(`--${key} must be absolute`);
}
const permitted = path.join(root, 'repositories/cca-conformance');
for (const p of Object.values(args)) {
  const rel = path.relative(permitted, p);
  if (rel.startsWith('..') || path.isAbsolute(rel)) throw new Error('Output must remain under cca-conformance');
}
if (fs.existsSync(args.output) || fs.existsSync(args.delta) || fs.existsSync(args.telemetry)) {
  throw new Error('Refuse to overwrite existing engineering evidence or telemetry');
}
const sourceBytes = fs.readFileSync(sourcePath);
const source = sourceBytes.toString('utf8');
const nl = source.includes('\r\n') ? '\r\n' : '\n';
const sha = x => crypto.createHash('sha256').update(x).digest('hex');
const edits = [];
const stages = [];
const stageByName = new Map();
const stage = (name, meaning = 'Measured enclosing operation; see nesting metadata') => {
  if (!stageByName.has(name)) {
    stageByName.set(name, stages.length);
    stages.push({ index: stages.length, name, meaning });
  }
  return stageByName.get(name);
};
const stamp = '[Diagnostics.Stopwatch]::GetTimestamp()';
const timer = name => '$engT_' + name.replaceAll(/[^a-zA-Z0-9]/g, '_');
const start = name => `${timer(name)} = ${stamp}`;
const end = name => {
  const i = stage(name);
  return `$script:engTicks[${i}] += (${stamp}) - ${timer(name)}; $script:engCalls[${i}]++`;
};
function locate(text) {
  const at = source.indexOf(text);
  if (at < 0 || source.indexOf(text, at + 1) >= 0) throw new Error('Anchor missing or not unique: ' + text);
  return at;
}
function add(at, code, description, remove = 0) {
  edits.push({ at, code, description, remove, ordinal: edits.length });
}
function before(anchor, code, description) { add(locate(anchor), code, description ?? anchor); }
function after(anchor, code, description) { add(locate(anchor) + anchor.length, code, description ?? anchor); }
function span(first, last, name) {
  stage(name);
  before(first, start(name), name + ': begin');
  after(last, end(name), name + ': end');
}
function wrapFunction(name, measureName) {
  stage(measureName);
  const at = locate('function ' + name + '(');
  const body = source.indexOf(nl, at) + nl.length;
  const next = source.indexOf(nl + 'function ', body);
  const tail = next < 0 ? source.indexOf(nl + '\n# Save redirected', body) : next;
  const close = source.lastIndexOf(nl + '}', tail) + nl.length;
  if (close < body) throw new Error('Cannot wrap function ' + name);
  add(body, `${start(measureName)}${nl}try {`, measureName + ': inclusive begin');
  add(close, `} finally { ${end(measureName)} }`, measureName + ': inclusive end');
}
function wrapNoArgFunction(name, nextName, measureName) {
  stage(measureName);
  const at = locate('function ' + name + ' {');
  const body = source.indexOf(nl, at) + nl.length;
  const next = locate('function ' + nextName);
  const close = source.lastIndexOf(nl + '}', next) + nl.length;
  add(body, `${start(measureName)}${nl}try {`, measureName + ': inclusive begin');
  add(close, `} finally { ${end(measureName)} }`, measureName + ': inclusive end');
}
function returnSpan(first, last, name) {
  stage(name);
  before(first, `${start(name)}${nl}try {`, name + ': return construction begin');
  after(last, `} finally { ${end(name)} }`, name + ': return construction end');
}

wrapNoArgFunction('Initialize-Native', 'Confirm-ConsoleQuiescence', 'initialize_native_inclusive');
wrapNoArgFunction('Confirm-ConsoleQuiescence', 'Open-Native', 'console_quiescence_inclusive');
wrapFunction('Assert-Root', 'assert_root_inclusive');
wrapFunction('Assert-Relative', 'assert_relative_inclusive');
wrapFunction('Open-Native', 'open_native_inclusive');
wrapFunction('Read-Identity', 'read_identity_inclusive');
wrapFunction('Open-Chain', 'open_chain_inclusive');
wrapFunction('Assert-ChainStable', 'assert_chain_stable_inclusive');
wrapFunction('Invoke-ReadSet', 'readset_inclusive');

span("    $handle = $script:native::CreateFileW($Path, $access, $sharing, [IntPtr]::Zero, 3, 0x02200000, [IntPtr]::Zero)" + nl,
  "    $nativeError = [Runtime.InteropServices.Marshal]::GetLastWin32Error()" + nl + "    if ($handle.IsInvalid) {", 'create_file_and_error_capture');
// The anchor above includes the if-opening line: its timer end is moved before
// that branch, maintaining native-call / GetLastWin32Error adjacency exactly.
const createEnd = edits.at(-1);
createEnd.at = locate("    $nativeError = [Runtime.InteropServices.Marshal]::GetLastWin32Error()" + nl + "    if ($handle.IsInvalid) {") +
  ("    $nativeError = [Runtime.InteropServices.Marshal]::GetLastWin32Error()" + nl).length;
span("        if (-not $script:native::GetFileInformationByHandle($Handle, $buffer)) { Reject-Protocol 'MO1307_FILESYSTEM_BOUNDARY' }" + nl,
  "        if (-not $script:native::GetFileInformationByHandle($Handle, $buffer)) { Reject-Protocol 'MO1307_FILESYSTEM_BOUNDARY' }" + nl,
  'get_file_information_native_and_branch');
span("        $raw = [byte[]]::new(52)" + nl,
  "        $fileId = [BitConverter]::ToUInt32($raw, 44).ToString('x8') + [BitConverter]::ToUInt32($raw, 48).ToString('x8')" + nl,
  'identity_buffer_and_field_decode');
span("        if (($attributes -band 0x400) -ne 0 -or (($attributes -band 0x10) -ne 0) -ne $Directory -or" + nl,
  "            $script:native::GetFileType($Handle) -ne 1) { Reject-Protocol 'MO1307_FILESYSTEM_BOUNDARY' }" + nl,
  'identity_attributes_and_get_file_type');
span("        $final = [Text.StringBuilder]::new(512)" + nl,
  "        if ($count -eq 0 -or $count -ge 512) { Reject-Protocol 'MO1307_FILESYSTEM_BOUNDARY' }" + nl,
  'get_final_path_native_buffer_and_count_check');
span("        $observed = $final.ToString()" + nl,
  "        if (-not [string]::Equals($observed, $Path, [StringComparison]::OrdinalIgnoreCase)) { Reject-Protocol 'MO1307_FILESYSTEM_BOUNDARY' }" + nl,
  'identity_final_path_validation_inclusive');
returnSpan("        return [pscustomobject] @{ attributes = $attributes; byteLength = $length; fileId = $fileId;" + nl,
  "            finalPath = $observed; isDirectory = $Directory; linkCount = $links; volumeSerial = $volume.ToString('x8') }" + nl,
  'identity_result_construction');
span("    Assert-Root $Path" + nl,
  "    Assert-Root $Path" + nl, 'open_chain_root_lexical_validation');
span("    $paths = [Collections.Generic.List[string]]::new()" + nl,
  "    $entries = [Collections.Generic.List[object]]::new()" + nl, 'open_chain_ancestor_preparation');
span("        Assert-SameIdentity $entry.identity (Read-Identity $entry.handle $entry.path $entry.directory)" + nl,
  "        Assert-SameIdentity $entry.identity (Read-Identity $entry.handle $entry.path $entry.directory)" + nl, 'stable_chain_held_identity_inclusive');
span("        $fresh = Open-Native $entry.path $entry.directory" + nl,
  "        $fresh = Open-Native $entry.path $entry.directory" + nl, 'stable_chain_fresh_open_inclusive');
span("        try { Assert-SameIdentity $entry.identity (Read-Identity $fresh $entry.path $entry.directory) }" + nl,
  "        finally { $fresh.Dispose() }" + nl, 'stable_chain_fresh_identity_and_dispose_inclusive');
span("        if ($script:native::WaitForSingleObject($consoleHandle, 1000) -ne 0) { Reject-Protocol 'MO1307_INTERNAL' }" + nl,
  "        if ($script:native::WaitForSingleObject($consoleHandle, 1000) -ne 0) { Reject-Protocol 'MO1307_INTERNAL' }" + nl,
  'console_final_native_wait');
after("        if ($remaining -ne 0 -or $nativeError -ne 6) { Reject-Protocol 'MO1307_INTERNAL' }" + nl,
  `Write-Engineering 'console_quiescence_proved' ('"consolePid":' + $owner + ',"heldHandleWaitConfirmed":true,"remainingConsoleProcesses":0')`,
  'Record native held-handle confirmation only after original checks passed');

// Top-level READ_SET regions form a disjoint timeline; nested function counters
// above provide attribution and must never be added to their parent regions.
span("    $rootChains = [Collections.Generic.Dictionary[string,object]]::new([StringComparer]::Ordinal)" + nl,
  "    $total = 0L" + nl, 'readset_collection_initialization');
before("        foreach ($root in $Request.roots) {" + nl, start('readset_root_acquisition'), 'root acquisition begin');
before("        foreach ($file in $Request.files) {" + nl, end('readset_root_acquisition'), 'root acquisition end');
after("        foreach ($file in $Request.files) {" + nl,
  `$script:engOrdinal++${nl}$engFileStart = ${stamp}${nl}$engFileBaseTicks = $script:engTicks.Clone()${nl}$engFileBaseCalls = $script:engCalls.Clone()${nl}Write-Engineering 'file_start' ('"ordinal":' + $script:engOrdinal + ',"id":"' + $file.id + '","stableIdentifier":"file-' + $script:engOrdinal + '"')`,
  'Per-file identity and timing baseline (IDs already lexically validated)');
span("            $full = $Roots[$file.root].TrimEnd('\\') + '\\' + $file.path.Replace('/', '\\')" + nl,
  "            $full = $Roots[$file.root].TrimEnd('\\') + '\\' + $file.path.Replace('/', '\\')" + nl, 'file_path_preparation');
span("            $chain = Open-Chain $full $false $true" + nl,
  "            $chain = Open-Chain $full $false $true" + nl, 'file_open_chain_inclusive');
span("                $rootChain = $rootChains[$file.root]" + nl,
  "                if ($Request.sequence -eq 3 -and $total + $leaf.identity.byteLength -gt 8388608) { Reject-Protocol 'MO1307_RESOURCE_LIMIT' }" + nl,
  'file_pre_read_identity_and_limits');
span("                $data = [byte[]]::new($file.maxBytes + 1)" + nl,
  "                $stream = [IO.FileStream]::new($borrowed, [IO.FileAccess]::Read, 65536, $false)" + nl, 'file_buffer_and_stream_preparation');
before("                try {" + nl + "                    $used = 0", start('file_stream_read_and_dispose'), 'file read begin');
after("                } finally { $stream.Dispose(); $borrowed.Dispose() }" + nl,
  end('file_stream_read_and_dispose'), 'file read end');
span("                if ($used -gt $file.maxBytes) { Reject-Protocol 'MO1307_RESOURCE_LIMIT' }" + nl,
  "                $total += $used" + nl, 'file_post_read_size_checks');
span("                Assert-ChainStable $chain" + nl,
  "                Assert-ChainStable $chain" + nl, 'file_post_read_chain_verification_inclusive');
span("                $encoded = [Convert]::ToBase64String($data, 0, $used)" + nl,
  "                $encoded = [Convert]::ToBase64String($data, 0, $used)" + nl, 'file_base64_encoding');
before("                $chunks = [Collections.Generic.List[string]]::new()" + nl, start('file_base64_chunking'), 'chunking begin');
before("                $responseFiles.Add([pscustomobject] @{ id = $file.id; identity = $leaf.identity; bytes = $chunks.ToArray() })" + nl,
  end('file_base64_chunking'), 'chunking end');
span("                $responseFiles.Add([pscustomobject] @{ id = $file.id; identity = $leaf.identity; bytes = $chunks.ToArray() })" + nl,
  "                $responseFiles.Add([pscustomobject] @{ id = $file.id; identity = $leaf.identity; bytes = $chunks.ToArray() })" + nl,
  'file_result_construction');
span("            } finally { Close-Chain $chain }" + nl,
  "            } finally { Close-Chain $chain }" + nl, 'file_chain_close');
after("            } finally { Close-Chain $chain }" + nl,
  `$engFileEnd = ${stamp}${nl}$script:engFilesCompleted++; $script:engBytesCompleted += $used${nl}$engLogStart = ${stamp}${nl}$engDeltas = [long[]]::new($script:engTicks.Length); $engCallDeltas = [long[]]::new($script:engCalls.Length)${nl}for ($engI = 0; $engI -lt $engDeltas.Length; $engI++) { $engDeltas[$engI] = $script:engTicks[$engI] - $engFileBaseTicks[$engI]; $engCallDeltas[$engI] = $script:engCalls[$engI] - $engFileBaseCalls[$engI] }${nl}Write-Engineering 'file_complete' ('"ordinal":' + $script:engOrdinal + ',"id":"' + $file.id + '","stableIdentifier":"file-' + $script:engOrdinal + '","byteLength":' + $used + ',"startTick":' + $engFileStart + ',"endTick":' + $engFileEnd + ',"filesCompleted":' + $script:engFilesCompleted + ',"bytesCompleted":' + $script:engBytesCompleted + ',"stageTicks":[' + [string]::Join(',', $engDeltas) + '],"stageCalls":[' + [string]::Join(',', $engCallDeltas) + ']')${nl}$script:engLogPreparationTicks += (${stamp}) - $engLogStart`,
  'Per-file stage delta row and compatible progress counters');
span("        foreach ($chain in $rootChains.Values) { Assert-ChainStable $chain }" + nl,
  "        foreach ($chain in $rootChains.Values) { Assert-ChainStable $chain }" + nl, 'readset_final_root_verification_inclusive');
returnSpan("        return [pscustomobject] @{ roots = $responseRoots.ToArray(); files = $responseFiles.ToArray(); status = 'OK' }" + nl,
  "        return [pscustomobject] @{ roots = $responseRoots.ToArray(); files = $responseFiles.ToArray(); status = 'OK' }" + nl,
  'readset_aggregate_result_construction');
// The original inline finally remains untouched. Root Close-Chain time belongs
// to readset_inclusive residual; inserting a timer after its return is invalid.

before("    $header = [byte[]]::new(4)" + nl,
  `Write-Engineering 'request_framing_started' ''${nl}${start('request_framing_and_read')}`, 'request framing begin');
after("    if ($stdin.ReadByte() -ne -1) { Reject-Protocol }" + nl,
  `${end('request_framing_and_read')}${nl}Write-Engineering 'request_framing_completed' ''`, 'request framing end');
span("    $utf8 = [System.Text.UTF8Encoding]::new($false, $true)" + nl,
  "    $text = $utf8.GetString($body)" + nl, 'request_utf8_decode');
before("    $depth = 0; $quoted = $false; $escaped = $false" + nl, start('request_depth_scan'), 'depth scan begin');
before("    $request = ConvertFrom-Json -InputObject $text" + nl, end('request_depth_scan'), 'depth scan end');
span("    $request = ConvertFrom-Json -InputObject $text" + nl,
  "    $request = ConvertFrom-Json -InputObject $text" + nl, 'request_json_decode');
span('    if (((Encode-Value $request) + "`n") -cne $text) { Reject-Protocol }' + nl,
  '    if (((Encode-Value $request) + "`n") -cne $text) { Reject-Protocol }' + nl, 'request_canonical_reencode_and_equality');
after('    if (((Encode-Value $request) + "`n") -cne $text) { Reject-Protocol }' + nl,
  `Write-Engineering 'request_decoded' ''${nl}${start('request_semantic_validation_inclusive')}`, 'decoded milestone');
before("    foreach ($root in $request.roots) {" + nl + "        Assert-Keys", start('request_roots_validation'), 'root request validation begin');
before("    $prior = $null" + nl + "    $seen =", end('request_roots_validation'), 'root request validation end');
before("    foreach ($file in $request.files) {" + nl + "        Assert-Keys", start('request_paths_validation'), 'paths request validation begin');
before("        Assert-Keys $file @('id', 'maxBytes', 'path', 'root')" + nl,
  `$engValidationStart = ${stamp}`, 'Per-path lexical/semantic validation start');
after("        $prior = $file.id" + nl,
  `$engValidationEnd = ${stamp}${nl}$script:engValidationOrdinal++${nl}Write-Engineering 'path_validated' ('"ordinal":' + $script:engValidationOrdinal + ',"id":"' + $file.id + '","stableIdentifier":"file-' + $script:engValidationOrdinal + '","startTick":' + $engValidationStart + ',"endTick":' + $engValidationEnd + ',"durationTicks":' + ($engValidationEnd - $engValidationStart))`,
  'Per-path safe identity and validated lexical/semantic duration');
before("    $ids = @($request.files | ForEach-Object { $_.id }) -join ','" + nl, end('request_paths_validation'), 'paths request validation end');
before("    $nativeMode = $true" + nl,
  `${end('request_semantic_validation_inclusive')}${nl}Write-Engineering 'request_validated' ('"sequence":' + $sequence + ',"fileCount":' + $request.files.Length)`,
  'request validated milestone');
after("    else { $nativeResult = Invoke-Inspection $request $roots }" + nl,
  `Write-Engineering 'algorithm_complete' ('"filesCompleted":' + $script:engFilesCompleted + ',"bytesCompleted":' + $script:engBytesCompleted)`,
  'algorithm completed milestone');
before("    $response = [pscustomobject] @{ code = $code; files = @(); kind = 'MemoryOSReadinessHelperResponse';" + nl,
  start('response_envelope_construction'), 'response envelope begin');
const serialization = '    $replyBytes = [Text.UTF8Encoding]::new($false, $true).GetBytes((Encode-Value $response) + "`n")' + nl;
const serializationReplacement = `${end('response_envelope_construction')}${nl}Write-Engineering 'response_constructed' ''${nl}$engResponseUtf8 = [Text.UTF8Encoding]::new($false, $true)${nl}${start('response_canonical_serialization')}${nl}$engSerialized = (Encode-Value $response) + "\u0060n"${nl}${end('response_canonical_serialization')}${nl}Write-Engineering 'serialization_completed' ''${nl}${start('response_utf8_encoding')}${nl}$replyBytes = $engResponseUtf8.GetBytes($engSerialized)${nl}${end('response_utf8_encoding')}${nl}Write-Engineering 'utf8_encoded' ('"responseBodyBytes":' + $replyBytes.Length)`;
add(locate(serialization), serializationReplacement,
  'Measurement-only expression split; UTF8 constructor still precedes canonical encode then GetBytes; exact inverse stored', serialization.length);
span("$length = [uint32] $replyBytes.Length" + nl,
  "$stdout = $savedStdout" + nl, 'response_frame_header_encoding');
span("$stdout.Write($replyHeader, 0, 4)" + nl,
  "$stdout.Flush()" + nl, 'stdout_write_and_flush');
after("$stdout.Flush()" + nl,
  `Write-Engineering 'stdout_written_flushed' ('"responseBodyBytes":' + $replyBytes.Length)${nl}Write-Engineering 'totals' ('"stageTicks":[' + [string]::Join(',', $script:engTicks) + '],"stageCalls":[' + [string]::Join(',', $script:engCalls) + '],"filesCompleted":' + $script:engFilesCompleted + ',"bytesCompleted":' + $script:engBytesCompleted + ',"logWriteTicks":' + $script:engLogWriteTicks + ',"fileLogPreparationInclusiveTicks":' + $script:engLogPreparationTicks)${nl}Write-Engineering 'script_exit_ready' ''${nl}$script:engWriter.Dispose()`,
  'Final engineering telemetry; no protocol bytes altered');

const escapePS = s => s.replaceAll("'", "''");
const prolog = `# This copied helper is ENGINEERING ONLY and cannot certify any gate.
$script:engZero = [Diagnostics.Stopwatch]::GetTimestamp()
$script:engTicks = [long[]]::new(${stages.length})
$script:engCalls = [long[]]::new(${stages.length})
$script:engOrdinal = 0; $script:engFilesCompleted = 0; $script:engBytesCompleted = 0L
$script:engValidationOrdinal = 0
$script:engLogWriteTicks = 0L; $script:engLogPreparationTicks = 0L
$script:engWriter = [IO.StreamWriter]::new('${escapePS(args.telemetry)}', $false, [Text.UTF8Encoding]::new($false))
function Write-Engineering([string] $Label, [string] $Fields) {
    $engWriteStart = [Diagnostics.Stopwatch]::GetTimestamp()
    $engRow = '{"kind":"' + $Label + '","tick":' + $engWriteStart
    if ($Fields.Length -gt 0) { $engRow += ',' + $Fields }
    $engRow += '}'
    $script:engWriter.WriteLine($engRow)
    $script:engWriter.Flush()
    $script:engLogWriteTicks += ([Diagnostics.Stopwatch]::GetTimestamp()) - $engWriteStart
}
Write-Engineering 'meta' ('"engineeringOnly":true,"pid":' + $PID + ',"frequency":' + [Diagnostics.Stopwatch]::Frequency + ',"firstScriptTick":' + $script:engZero + ',"utc":"' + [DateTime]::UtcNow.ToString('o') + '","sourceSha256":"${sha(sourceBytes)}","stageNames":${JSON.stringify(stages.map(x => x.name))}')
`;
// Place first-tick capture at script entry, before product initialization.
add(0, prolog.replaceAll('\n', nl).replace(new RegExp(nl + '$'), ''), 'Engineering-only telemetry initialization');

let generated = source;
const deltaEdits = [];
for (const edit of [...edits].sort((a, b) => b.at - a.at || b.ordinal - a.ordinal)) {
  const id = String(edit.ordinal + 1).padStart(3, '0');
  const insert = `# ENGINEERING-ONLY BEGIN ${id}${nl}${edit.code}${nl}# ENGINEERING-ONLY END ${id}${nl}`;
  const original = source.slice(edit.at, edit.at + edit.remove);
  deltaEdits.push({ id, sourceOffset: edit.at, removedBytesBase64: Buffer.from(original).toString('base64'), description: edit.description,
    insertedSha256: sha(insert), removesOriginalExpression: edit.remove > 0 });
  generated = generated.slice(0, edit.at) + insert + generated.slice(edit.at + edit.remove);
}
let restored = generated;
for (const edit of deltaEdits) {
  const begin = `# ENGINEERING-ONLY BEGIN ${edit.id}${nl}`;
  const endMarker = `# ENGINEERING-ONLY END ${edit.id}${nl}`;
  const a = restored.indexOf(begin), b = restored.indexOf(endMarker, a);
  if (a < 0 || b < 0) throw new Error('Restoration marker missing');
  restored = restored.slice(0, a) + Buffer.from(edit.removedBytesBase64, 'base64').toString('utf8') + restored.slice(b + endMarker.length);
}
if (!Buffer.from(restored).equals(sourceBytes)) throw new Error('Instrumentation inverse failed exact-byte proof');
for (const p of [args.output, args.delta]) fs.mkdirSync(path.dirname(p), { recursive: true });
fs.writeFileSync(args.output, generated, { flag: 'wx' });
const delta = {
  kind: 'MO1307EngineeringOnlyInstrumentationDelta', engineeringOnly: true,
  source: path.relative(root, sourcePath).replaceAll('\\', '/'), sourceSha256: sha(sourceBytes), sourceBytes: sourceBytes.length,
  helper: path.relative(root, args.output).replaceAll('\\', '/'), helperSha256: sha(generated), helperBytes: Buffer.byteLength(generated),
  exactInverseSha256: sha(restored), exactOriginalBytesRecovered: true,
  productionAlgorithmStatementsPreserved: true, expressionSplits: deltaEdits.filter(x => x.removesOriginalExpression),
  stages,
  nesting: {
    rule: 'Inclusive parent and child stage values overlap. Do not add the entire stage array. Top-level region sums and exclusive residual subtraction must use the named hierarchy.',
    identity: { parent: 'read_identity_inclusive', children: ['get_file_information_native_and_branch', 'identity_buffer_and_field_decode', 'identity_attributes_and_get_file_type', 'get_final_path_native_buffer_and_count_check', 'identity_final_path_validation_inclusive', 'identity_result_construction'] },
    identityPath: { parent: 'identity_final_path_validation_inclusive', child: 'assert_root_inclusive', caveat: 'Global assert_root also includes Open-Chain root lexical checks; subtract open_chain_root_lexical_validation before estimating identity path-only root cost.' },
    openNative: { parent: 'open_native_inclusive', child: 'create_file_and_error_capture' },
    openChain: { parent: 'open_chain_inclusive', children: ['open_chain_root_lexical_validation', 'open_chain_ancestor_preparation', 'open_native_inclusive', 'read_identity_inclusive'], caveat: 'Global native/identity totals include post-read calls; do not subtract global totals from open_chain.' },
    stable: { parent: 'assert_chain_stable_inclusive', children: ['stable_chain_held_identity_inclusive', 'stable_chain_fresh_open_inclusive', 'stable_chain_fresh_identity_and_dispose_inclusive'] },
    perFileDisjointRegions: ['file_path_preparation', 'file_open_chain_inclusive', 'file_pre_read_identity_and_limits', 'file_buffer_and_stream_preparation', 'file_stream_read_and_dispose', 'file_post_read_size_checks', 'file_post_read_chain_verification_inclusive', 'file_base64_encoding', 'file_base64_chunking', 'file_result_construction', 'file_chain_close'],
    topLevelDisjointRegions: ['initialize_native_inclusive', 'request_framing_and_read', 'request_utf8_decode', 'request_depth_scan', 'request_json_decode', 'request_canonical_reencode_and_equality', 'request_semantic_validation_inclusive', 'readset_inclusive', 'response_envelope_construction', 'response_canonical_serialization', 'response_utf8_encoding', 'response_frame_header_encoding', 'stdout_write_and_flush']
  },
  limitations: [
    'Engineering timing includes timestamp/counter/try-finally overhead; it is not an uninstrumented product deadline measurement.',
    'Native substage timings include unchanged managed expression, branch and error-capture overhead; they do not establish pure kernel service latency.',
    'GetFileType remains inside original short-circuit validation; attributes-and-type is a bounded composite stage.',
    'Partial aborted spans without finally may lack a completed delta; file_start and prior rows retain progress.',
    'logWriteTicks measures telemetry construction inside writer plus writes/flushes; fileLogPreparationInclusiveTicks includes writer time for file-complete rows and must not be added without removing overlap.',
    'Counter updates, timestamp operations, stage-array cloning, expression argument construction and startup instrumentation add uncalibrated observer overhead.',
    'Stable file-N identifiers and validated logical IDs are emitted, never full paths or file contents.',
    'Native held-handle console quiescence is recorded before request reading, matching original behavior.'
  ],
  edits: deltaEdits.sort((a, b) => a.sourceOffset - b.sourceOffset || a.id.localeCompare(b.id))
};
fs.writeFileSync(args.delta, JSON.stringify(delta, null, 2) + '\n', { flag: 'wx' });
console.log(JSON.stringify({ sourceSha256: delta.sourceSha256, helperSha256: delta.helperSha256, stages: stages.length, insertionBlocks: edits.length, originalExpressionSplits: delta.expressionSplits.length, exactOriginalBytesRecovered: true }));
