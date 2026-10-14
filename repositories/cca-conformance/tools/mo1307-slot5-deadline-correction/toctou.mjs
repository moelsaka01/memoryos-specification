// Two existing native mutation-window controls, using only reversible copies of the repaired helper.
import fs from 'node:fs';
import path from 'node:path';
import assert from 'node:assert/strict';
import { spawnSync } from 'node:child_process';
import { performance } from 'node:perf_hooks';
import { helperLaunchSpecification } from '../../../memoryos-readiness/src/helper-transport.mjs';
import { encodeHelperRequest, encodeHelperResponse, decodeHelperResponse } from '../../../memoryos-readiness/src/helper-protocol.mjs';
import { root, absolute, record, write, beginCampaign, verifyBindings, finishCampaign } from './validation-bindings.mjs';

const context = beginCampaign('toctou');
const ids = ['before-read-replacement', 'held-to-fresh-replacement'];
assert.deepEqual(context.manifest.toctouCases, ids);
const candidatePath = 'repositories/memoryos-readiness/helpers/windows-inspect.ps1';
const candidateBytes = fs.readFileSync(absolute(candidatePath));
const specification = helperLaunchSpecification();
const scratch = path.join(root, '.cache', 'mo1307-slot5-deadline-correction', 'toctou-' + process.pid);
fs.mkdirSync(scratch, { recursive: true });
const rows = []; let failure = null;
const quote = s => "'" + s.replaceAll("'", "''") + "'";
write(context.output + '/plan.json', {
  origin: { commit: 'b02fc0226a1a2d800185a02071674ca80bdf4a1d', path: 'repositories/cca-conformance/tools/mo1307-phase3c-c3rb-cert3/toctou-boundaries.mjs' },
  ids, runsPerCase: 1, candidate: record(candidatePath), launch: specification,
  helperDeadlineMs: 5000, responseBytes: 16777216,
  historicalHelperExecution: false, expected: { helperCode: 'MO1307_FILESYSTEM_BOUNDARY', exitCode: 0, stderrBytes: 0, mutationCount: 1 },
  limitation: 'Each reversible engineering copy releases its held leaf sharing restriction solely to inject one actual native filesystem replacement. Original native checks remain; no claim that production sharing permits the adversary.',
});
try {
  for (const id of ids) {
    verifyBindings(context);
    const folder = context.output + '/' + id;
    fs.mkdirSync(absolute(folder), { recursive: false });
    const dir = path.join(scratch, id); fs.mkdirSync(dir);
    const leaf = path.join(dir, 'leaf.data'); fs.writeFileSync(leaf, 'same content and length\n', { flag: 'wx' });
    const request = { kind: 'MemoryOSReadinessHelperRequest', version: '2.0.0', operation: 'READ_SET', sequence: 3, session: 'e'.repeat(64),
      roots: [{ id: 'input', path: dir }], files: [{ id: 'leaf', root: 'input', path: 'leaf.data', maxBytes: 256 }] };
    const requestBytes = encodeHelperRequest(request);
    const expectedResponse = { kind: 'MemoryOSReadinessHelperResponse', version: '2.0.0', session: request.session, sequence: 3, operation: 'READ_SET',
      status: 'ERROR', code: 'MO1307_FILESYSTEM_BOUNDARY', roots: [], files: [] };
    const expectedBytes = encodeHelperResponse(expectedResponse, request);
    write(folder + '/request.bin', requestBytes); write(folder + '/expected-response.bin', expectedBytes);
    let source = candidateBytes.toString('utf8'); const blocks = [];
    function insert(anchor, body) {
      assert.equal(source.split(anchor).length, 2, 'Unique reviewed instrumentation anchor: ' + anchor);
      const block = '# SLOT5-DEADLINE-CORRECTION-BEGIN-' + blocks.length + '\n' + body + '\n# SLOT5-DEADLINE-CORRECTION-END-' + blocks.length + '\n';
      blocks.push(block); source = source.replace(anchor, block + anchor);
    }
    insert('function Reject-Protocol', '$script:RefreshMutations = 0');
    const replace = entry => `${entry}.handle.Dispose()\n[IO.File]::Move(${entry}.path, ${entry}.path + '.original')\n[IO.File]::Copy(${entry}.path + '.original', ${entry}.path)\n$script:RefreshMutations++`;
    if (id === 'before-read-replacement') {
      insert('                $borrowed = [Microsoft.Win32.SafeHandles.SafeFileHandle]::new($leaf.handle.DangerousGetHandle(), $false)', replace('$leaf') + '\n$leaf.handle = Open-Native $leaf.path $false $true');
    } else {
      insert('        $fresh = Open-Native $entry.path $entry.directory', `        if (-not $entry.directory -and $script:RefreshMutations -eq 0) {\n${replace('$entry')}\n        }`);
    }
    const telemetry = folder + '/mutation.json';
    insert('exit 0', `[IO.File]::WriteAllText(${quote(absolute(telemetry))}, ('{"mutations":' + $script:RefreshMutations + '}'), [Text.UTF8Encoding]::new($false))`);
    let recovered = source; for (const block of blocks) recovered = recovered.replace(block, '');
    assert.deepEqual(Buffer.from(recovered, 'utf8'), candidateBytes, 'Removing only instrumentation restores exact candidate bytes');
    const helperCopy = folder + '/instrumented.ps1'; write(helperCopy, Buffer.from(source, 'utf8'));
    write(folder + '/instrumentation.json', { original: record(candidatePath), copy: record(helperCopy), reversibleAdditions: true, blocks,
      sharingRestrictionReleasedOnlyInEngineeringCopy: true, productionHooks: false, historicalHelperExecution: false });
    const args = [...specification.args]; assert.equal(path.resolve(args.at(-1)), path.resolve(absolute(candidatePath))); args[args.length - 1] = absolute(helperCopy);
    verifyBindings(context);
    const started = performance.now();
    const child = spawnSync(specification.executable, args, { ...specification.options, env: { ...specification.options.env }, stdio: [...specification.options.stdio],
      input: requestBytes, encoding: null, timeout: 5000, maxBuffer: 16777216 });
    const elapsedMs = performance.now() - started;
    write(folder + '/stdout.bin', child.stdout ?? Buffer.alloc(0)); write(folder + '/stderr.bin', child.stderr ?? Buffer.alloc(0));
    const invocation = { executable: specification.executable, args, options: specification.options, pid: child.pid, exitCode: child.status, signal: child.signal,
      error: child.error ? { code: child.error.code ?? null, message: child.error.message } : null, elapsedMs,
      request: record(folder + '/request.bin'), stdout: record(folder + '/stdout.bin'), stderr: record(folder + '/stderr.bin'), helperCopy: record(helperCopy) };
    write(folder + '/invocation.json', invocation);
    assert.ifError(child.error); assert.equal(child.status, 0); assert.equal(child.signal, null); assert.ok(elapsedMs < 5000);
    assert.equal(child.stderr.length, 0); assert.ok(child.stdout.length >= 4 && child.stdout.length <= 16777216);
    assert.equal(child.stdout.readUInt32BE(0), child.stdout.length - 4);
    assert.deepEqual(decodeHelperResponse(child.stdout, request), decodeHelperResponse(expectedBytes, request));
    assert.deepEqual(child.stdout, expectedBytes, 'Exact frozen filesystem-boundary response frame');
    assert.equal(JSON.parse(fs.readFileSync(absolute(telemetry), 'utf8')).mutations, 1);
    rows.push({ id, result: 'PASS', expectedCode: 'MO1307_FILESYSTEM_BOUNDARY', mutationCount: 1, invocation: record(folder + '/invocation.json'), telemetry: record(telemetry) });
    write(folder + '/receipt.json', rows.at(-1));
  }
} catch (error) {
  failure = { name: error.name, message: error.message, stack: error.stack };
  rows.push({ id: ids[rows.length], result: 'FAIL', failure });
} finally {
  finishCampaign(context, { suite: 'native-toctou', result: failure === null && rows.length === 2 ? 'PASS' : 'FAIL', rows, failure,
    notRun: ids.filter(id => !rows.some(row => row.id === id)), historicalHelperExecution: false,
    scope: 'Two standalone engineering component controls; no Phase3C campaign or acceptance is executed.' });
}
