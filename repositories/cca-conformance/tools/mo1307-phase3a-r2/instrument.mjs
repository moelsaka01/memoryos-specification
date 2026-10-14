// Engineering observation only. This module neither reads files nor launches a process.
import { createHash } from 'node:crypto';

export const PRODUCTION = Object.freeze({
  commit: 'defe93989efc6501b1a730b82e79e705884b269b',
  path: 'repositories/memoryos-readiness/helpers/windows-inspect.ps1',
  byteLength: 30210,
  sha256: '35381850f1ef8c322e528156ebd8779071ad3288cdccd4d0ebab51ce6f9c6ac8',
});
const sha256 = bytes => createHash('sha256').update(bytes).digest('hex');
const stamp = '[Diagnostics.Stopwatch]::GetTimestamp()';
const prefix = '# MO1307-R2-OBSERVATION';
const counters = Object.freeze([
  'file_checked_acquisition_before_buffer',
  'file_buffer_and_stream_preparation',
  'file_stream_read_and_disposal',
  'file_post_read_size_and_security_validation',
  'file_base64_chunking_and_response_row',
  'file_chain_close',
]);

/** Remove only hash-bound observation blocks and prove exact original recovery. */
export function restore(value, manifest) {
  const bytes = Buffer.isBuffer(value) ? value : Buffer.from(value, 'utf8');
  if (sha256(bytes) !== manifest.engineeringCopy.sha256 || bytes.length !== manifest.engineeringCopy.byteLength) {
    throw new Error('Engineering copy differs from its insertion manifest');
  }
  let text = bytes.toString('utf8');
  for (const edit of manifest.insertions) {
    const start = text.indexOf(edit.begin);
    const end = text.indexOf(edit.end, start + edit.begin.length);
    if (start < 0 || end < 0 || text.indexOf(edit.begin, start + 1) >= 0) {
      throw new Error(`Missing or repeated observation block ${edit.id}`);
    }
    const after = end + edit.end.length;
    const inserted = Buffer.from(text.slice(start, after), 'utf8');
    if (inserted.length !== edit.byteLength || sha256(inserted) !== edit.sha256) {
      throw new Error(`Observation block differs: ${edit.id}`);
    }
    text = text.slice(0, start) + text.slice(after);
  }
  const recovered = Buffer.from(text, 'utf8');
  if (recovered.length !== PRODUCTION.byteLength || sha256(recovered) !== PRODUCTION.sha256 || text.includes(prefix)) {
    throw new Error('Exact production-byte recovery failed');
  }
  return recovered;
}

/** Build the sole authorized D-workload engineering copy by insertions only. */
export function instrument(value) {
  const sourceBytes = Buffer.isBuffer(value) ? Buffer.from(value) : Buffer.from(value, 'utf8');
  if (sourceBytes.length !== PRODUCTION.byteLength || sha256(sourceBytes) !== PRODUCTION.sha256) {
    throw new Error('STOP: expected exact C3RB production helper bytes');
  }
  const source = sourceBytes.toString('utf8');
  if (!Buffer.from(source, 'utf8').equals(sourceBytes) || source.includes(prefix)) {
    throw new Error('Source is not the expected uninstrumented UTF-8 helper');
  }
  const nl = source.includes('\r\n') ? '\r\n' : '\n';
  const edits = [];
  function location(anchor) {
    const at = source.indexOf(anchor);
    if (at < 0 || source.indexOf(anchor, at + 1) >= 0) throw new Error(`Nonunique observation anchor: ${anchor}`);
    return at;
  }
  function insert(at, code, description) {
    edits.push({ at, ordinal: edits.length, code: code.replaceAll('\n', nl), description });
  }
  const before = (anchor, code, description) => insert(location(anchor), code, description);
  const after = (anchor, code, description) => insert(location(anchor) + anchor.length, code, description);
  const begin = slot => `$script:r2Begin[${slot}] = ${stamp}`;
  const end = slot => `$script:r2Ticks[${slot}] += (${stamp}) - $script:r2Begin[${slot}]`;
  const line = text => text + nl;

  // Captured before the product FreeConsole call. ASCII rows contain only fixed
  // labels, counters and clocks; no input IDs, paths, contents or environments.
  insert(0, `$script:r2Zero = ${stamp}
$script:r2Frequency = [Diagnostics.Stopwatch]::Frequency
$script:r2Ticks = [long[]]::new(6)
$script:r2Begin = [long[]]::new(6)
$script:r2Files = 0; $script:r2Bytes = 0L
$script:r2Written = 0; $script:r2Rows = 0; $script:r2Suppressed = 0; $script:r2ObserverFailed = $false
$script:r2ErrorStream = $null
try { $script:r2ErrorStream = [Console]::OpenStandardError() } catch { $script:r2ObserverFailed = $true }
function Write-R2Observation([string] $Label, [bool] $Progress = $false) {
    try {
        if ($script:r2ObserverFailed -or $null -eq $script:r2ErrorStream) { return }
        $r2Tick = ${stamp}
        $r2Row = 'R2 ' + $Label + ' ' + $r2Tick.ToString([Globalization.CultureInfo]::InvariantCulture)
        if ($Label -ceq 'ENTRY') {
            $r2Row += ' ' + $script:r2Zero.ToString([Globalization.CultureInfo]::InvariantCulture) + ' ' + $script:r2Frequency.ToString([Globalization.CultureInfo]::InvariantCulture)
        } elseif ($Progress) {
            $r2Row += ' ' + $script:r2Files + ' ' + $script:r2Bytes
            foreach ($r2Value in $script:r2Ticks) { $r2Row += ' ' + $r2Value.ToString([Globalization.CultureInfo]::InvariantCulture) }
        }
        $r2Encoded = [Text.Encoding]::ASCII.GetBytes($r2Row + "\u0060n")
        if ($script:r2Rows -ge 50 -or $script:r2Written + $r2Encoded.Length -gt 4096) { $script:r2Suppressed++; return }
        $script:r2Written += $r2Encoded.Length; $script:r2Rows++
        $script:r2ErrorStream.Write($r2Encoded, 0, $r2Encoded.Length)
        $script:r2ErrorStream.Flush()
    } catch { $script:r2ObserverFailed = $true }
}
Write-R2Observation 'ENTRY'`, 'First script clock, bounded saved stderr, observation-only function and counters');

  before(line('# Save redirected byte transports before detaching the private console. Every'),
    "Write-R2Observation 'DEFINITIONS'", 'Original declarations/functions completed');
  before(line('    Initialize-Native'), "Write-R2Observation 'NATIVE_BEGIN'", 'Before original native initialization');
  after(line('    Initialize-Native'), "Write-R2Observation 'NATIVE_END'", 'Original native initialization and console proof returned');
  before(line('    Confirm-ConsoleQuiescence'), "Write-R2Observation 'CONSOLE_BEGIN'", 'Fixed native signatures created; before original console proof');
  after(line('    Confirm-ConsoleQuiescence'), "Write-R2Observation 'CONSOLE_END'", 'Original console proof returned, including already-detached branch');
  before(line('    $header = [byte[]]::new(4)'), "Write-R2Observation 'REQUEST_BEGIN'", 'Before original framed request reads');
  after(line('    if ($stdin.ReadByte() -ne -1) { Reject-Protocol }'),
    "Write-R2Observation 'REQUEST_READ'", 'Original complete request frame/EOF accepted');
  before(line('    $nativeMode = $true'), "Write-R2Observation 'REQUEST_VALID'", 'Original parsing/canonical/path/schema validation completed');

  before(line('        foreach ($root in $Request.roots) {'), "Write-R2Observation 'ROOT_BEGIN'", 'Before original root-chain acquisition');
  before(line('        foreach ($file in $Request.files) {'), "Write-R2Observation 'ROOT_END'", 'All original root chains acquired');
  after(line('        foreach ($file in $Request.files) {'), begin(0), 'Start per-file checked acquisition counter');
  before(line('                $data = [byte[]]::new($file.maxBytes + 1)'),
    `${end(0)}\n${begin(1)}`, 'End checked acquisition; begin original allocation/stream setup');
  after(line('                $stream = [IO.FileStream]::new($borrowed, [IO.FileAccess]::Read, 65536, $false)'),
    `${end(1)}\n${begin(2)}`, 'End allocation/stream setup; begin original bounded read');
  after(line('                } finally { $stream.Dispose(); $borrowed.Dispose() }'),
    `${end(2)}\n${begin(3)}`, 'Read and borrowed stream disposal completed; begin size/security checks');
  after(line('                Assert-ChainStable $chain'),
    `${end(3)}\n${begin(4)}`, 'Original held/reopened post-read checks completed; begin base64/chunking');
  after(line('                $responseFiles.Add([pscustomobject] @{ id = $file.id; identity = $leaf.identity; bytes = $chunks.ToArray() })'),
    `${end(4)}\n${begin(5)}`, 'Original response file row completed; begin chain close');
  after(line('            } finally { Close-Chain $chain }'),
    `${end(5)}\n$script:r2Files++; $script:r2Bytes += $used\nWrite-R2Observation 'FILE' $true`,
    'Closed file chain; emit cumulative counters only after complete original file processing');
  before(line('        foreach ($chain in $rootChains.Values) { Assert-ChainStable $chain }'),
    "Write-R2Observation 'FINAL_ROOT_BEGIN'", 'Before original final root held/reopened checks');
  after(line('        foreach ($chain in $rootChains.Values) { Assert-ChainStable $chain }'),
    "Write-R2Observation 'FINAL_ROOT_END'", 'Original final root held/reopened checks completed');
  after(line('    else { $nativeResult = Invoke-Inspection $request $roots }'),
    "Write-R2Observation 'ALGORITHM_END'", 'Original operation returned, including its original finally disposal');
  before(line('    $replyBytes = [Text.UTF8Encoding]::new($false, $true).GetBytes((Encode-Value $response) + "`n")'),
    "Write-R2Observation 'ENCODE_BEGIN'", 'Before unchanged canonical response and UTF-8 expression');
  after(line('    $replyBytes = [Text.UTF8Encoding]::new($false, $true).GetBytes((Encode-Value $response) + "`n")'),
    "Write-R2Observation 'ENCODE_END'", 'Unchanged canonical response and UTF-8 expression completed');
  before(line('$stdout.Write($replyHeader, 0, 4)'), "Write-R2Observation 'PREWRITE'", 'Immediately before original first stdout write');
  after(line('$stdout.Flush()'), "Write-R2Observation 'FLUSHED'", 'Original final stdout flush returned');

  let generated = source;
  const insertions = [];
  for (const edit of [...edits].sort((a, b) => b.at - a.at || b.ordinal - a.ordinal)) {
    const id = String(edit.ordinal + 1).padStart(3, '0');
    const opening = `${prefix} BEGIN ${id}${nl}`;
    const closing = `${prefix} END ${id}${nl}`;
    const block = opening + edit.code + nl + closing;
    generated = generated.slice(0, edit.at) + block + generated.slice(edit.at);
    insertions.push({ id, sourceByteOffset: Buffer.byteLength(source.slice(0, edit.at)),
      begin: opening, end: closing, byteLength: Buffer.byteLength(block), sha256: sha256(block), description: edit.description });
  }
  const bytes = Buffer.from(generated, 'utf8');
  const manifest = {
    kind: 'MO1307Phase3AR2InsertOnlyInstrumentation', version: '1.0.0', engineeringOnly: true,
    production: PRODUCTION,
    engineeringCopy: { byteLength: bytes.length, sha256: sha256(bytes) },
    insertionOnly: true, removedOriginalBytes: 0, reorderedOriginalBytes: 0,
    expressionSplits: 0, maximumStderrBytes: 4096, maximumMarkerRows: 50,
    authorizedWorkload: 'helper-deadline-characterization/requests/D.request.bin; 19 files; exactly one root-owned execution',
    successfulDExpectedRows: 37,
    markerFormat: {
      encoding: 'ASCII with one LF per row', clock: 'absolute Stopwatch.GetTimestamp ticks, same helper process',
      ordinary: 'R2 LABEL absoluteTick', entry: 'R2 ENTRY absoluteTick firstScriptTick StopwatchFrequency',
      file: 'R2 FILE absoluteTick filesCompleted bytesCompleted cumulativeTick[0] ... cumulativeTick[5]',
      counters,
      labels: ['ENTRY', 'DEFINITIONS', 'NATIVE_BEGIN', 'CONSOLE_BEGIN', 'CONSOLE_END', 'NATIVE_END',
        'REQUEST_BEGIN', 'REQUEST_READ', 'REQUEST_VALID', 'ROOT_BEGIN', 'ROOT_END', 'FILE',
        'FINAL_ROOT_BEGIN', 'FINAL_ROOT_END', 'ALGORITHM_END', 'ENCODE_BEGIN', 'ENCODE_END', 'PREWRITE', 'FLUSHED'],
    },
    limitations: [
      'Engineering timestamps/counters and synchronous bounded stderr writes add uncalibrated overhead; no mathematical overhead subtraction is authorized.',
      'Script entry is after process launch, PowerShell startup and script parsing. Parent transport observations are needed for the earlier/later lifecycle.',
      'ENCODE is the original unsplit expression: canonical serialization plus UTF-8 construction/encoding. It does not isolate either cost.',
      'FILE rows preserve only completed per-file cumulative counters; interrupted spans and unreported current-file work are incomplete, never zero.',
      'Counter intervals exclude some marker/counter bookkeeping; milestone differences include observer effects. Counters and enclosing spans must not be double-counted.',
      'Marker write failure or bounds exhaustion silently stops/suppresses markers only; missing markers do not establish that the production operation did not happen.',
      'No per-identity instrumentation, native-call substitution, observation caching, reordered checks, early response, deadline change or cleanup change.',
      'One D-workload engineering execution cannot establish historical Step G cause, latency distribution, reliability, replacement H, or certification compliance.',
    ],
    insertions: insertions.sort((a, b) => a.sourceByteOffset - b.sourceByteOffset || a.id.localeCompare(b.id)),
    exactOriginalBytesRecovered: true, restoredSha256: PRODUCTION.sha256,
  };
  if (!restore(bytes, manifest).equals(sourceBytes)) throw new Error('Insert-only exact-byte recovery failed');
  return { bytes, manifest };
}
