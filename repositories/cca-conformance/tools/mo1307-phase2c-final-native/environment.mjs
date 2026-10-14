import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { spawn, spawnSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';
import { createHash } from 'node:crypto';
import { performance } from 'node:perf_hooks';
import { createSupervisor, createSupervisorForTesting } from '../../../memoryos-readiness/src/runtime.mjs';
import { createHelperTransportForTesting, helperLaunchSpecification } from '../../../memoryos-readiness/src/helper-transport.mjs';
import { encodeHelperRequest, decodeHelperResponse } from '../../../memoryos-readiness/src/helper-protocol.mjs';
import { validateLaunch } from '../../../memoryos-readiness/src/cli-args.mjs';
const root = fileURLToPath(new URL('../../../../', import.meta.url));
const [receiptRoot, selection = 'all'] = process.argv.slice(2);
assert.ok(receiptRoot && path.isAbsolute(receiptRoot) && receiptRoot.startsWith(path.join(root, 'repositories/cca-conformance/evidence/mo1307/phase2c-final/')));
fs.mkdirSync(receiptRoot, { recursive: false });
const scratch = path.join(root, '.cache/mo1307-final-native/environment-' + process.pid); fs.mkdirSync(scratch, { recursive: true });
const input = path.join(scratch, 'input'); fs.mkdirSync(input); fs.writeFileSync(path.join(input, 'small.bin'), '{}\n');
const cli = path.join(root, 'repositories/memoryos-readiness/bin/memoryos-readiness.mjs');
const launch = helperLaunchSpecification(); const rows = [], childRows = [];
const hash = bytes => createHash('sha256').update(bytes).digest('hex');
const put = (leaf, bytes) => fs.writeFileSync(path.join(receiptRoot, leaf), bytes, { flag: 'wx' });
const dependencies = ['bin/memoryos-readiness.mjs', 'helpers/windows-inspect.ps1', ...fs.readdirSync(path.join(root, 'repositories/memoryos-readiness/src')).filter(name => name.endsWith('.mjs')).sort().map(name => 'src/' + name)];
const pins = () => dependencies.map(file => ({ file, sha256: hash(fs.readFileSync(path.join(root, 'repositories/memoryos-readiness', file))) }));
const before = pins();
const baselineEnv = { SystemRoot: 'C:\\Windows', WINDIR: 'C:\\Windows' };
// Deliberately synthetic values only. No real credential is read or recorded.
const poison = { HTTP_PROXY: 'http://127.0.0.1:1', HTTPS_PROXY: 'http://127.0.0.1:1', ALL_PROXY: 'http://127.0.0.1:1', NO_PROXY: 'invalid',
  AWS_ACCESS_KEY_ID: 'MO1307_NONSECRET_SENTINEL', AWS_SECRET_ACCESS_KEY: 'MO1307_NONSECRET_SENTINEL', AZURE_CLIENT_SECRET: 'MO1307_NONSECRET_SENTINEL', GITHUB_TOKEN: 'MO1307_NONSECRET_SENTINEL',
  PATH: path.join(scratch, 'untrusted-path'), PATHEXT: '.BAD', HOME: path.join(scratch, 'untrusted-home'), USERPROFILE: path.join(scratch, 'untrusted-profile'),
  SystemRoot: path.join(scratch, 'wrong-windows'), WINDIR: path.join(scratch, 'wrong-windows'), POWERSHELL_EXECUTION_POLICY: 'Restricted', PSExecutionPolicyPreference: 'Restricted' };
put('campaign.json', JSON.stringify({ kind: 'MO1307FinalNativeEnvironmentCampaign', dependencies: before, launch,
  poisonedKeys: Object.keys(poison).sort(), credentialValues: 'Synthetic sentinel only; not logged',
  policy: 'Finite ordered cases; stop on first unexpected result; fixed production helper launch and actual CLI only; no persistent policy change.' }, null, 2) + '\n');
async function check(name, action) { const start = performance.now(); try { const detail = await action(); rows.push({ name, outcome: 'PASS', elapsedMs: performance.now() - start, detail: detail ?? null }); } catch (error) { rows.push({ name, outcome: 'FAIL', elapsedMs: performance.now() - start, error: String(error.stack) }); throw error; } }
const validArgs = ['evaluate', '--input-root', input, '--config', 'config.json', '--authority', 'authority.json', '--authority-sha256', 'sha256:' + '1'.repeat(64), '--candidate-sha256', 'sha256:' + '2'.repeat(64), '--output-root', path.join(scratch, 'absent-output')];
function realCli(name, nodeFlags = [], extraEnv = {}, expected = 'MO1307_USAGE', exit = 10) {
  const started = performance.now(); const child = spawnSync(process.execPath, [...nodeFlags, cli, ...validArgs], {
    cwd: path.dirname(cli), env: { ...baselineEnv, ...extraEnv }, shell: false, windowsHide: true, timeout: 7000, maxBuffer: 16384 });
  put(name + '.stdout.bin', child.stdout ?? Buffer.alloc(0)); put(name + '.stderr.txt', child.stderr ?? Buffer.alloc(0));
  const row = { name, nodeFlags, environmentKeys: Object.keys(extraEnv).sort(), exit: child.status, error: child.error?.code ?? null, stdoutBytes: child.stdout?.length ?? 0, stderrBytes: child.stderr?.length ?? 0, elapsedMs: performance.now() - started }; childRows.push(row);
  assert.ifError(child.error); assert.equal(child.status, exit); assert.equal(child.stdout.length, 0);
  const lines = child.stderr.toString().trimEnd().split('\n'); const diagnostic = JSON.parse(lines.at(-1));
  assert.equal(diagnostic.code, expected); assert.ok(child.stderr.at(-1) === 10); assert.ok(!child.stderr.includes('MO1307_NONSECRET_SENTINEL'));
  row.diagnostic = diagnostic; row.bootstrapWarningLines = lines.length - 1;
}
let failure = null;
try {
  if (selection === 'all') {
  await check('actual-helper-sanitized-environment-under-combined-poison', async () => {
    const saved = new Map(Object.keys(poison).map(key => [key, process.env[key]])); let spawnObserved = false;
    Object.assign(process.env, poison); const supervisor = createSupervisor({ kind: 'cli' });
    try {
      const transport = createHelperTransportForTesting(supervisor, (executable, args, options) => {
        assert.equal(executable, launch.executable); assert.deepEqual(args, [...launch.args]); assert.deepEqual(options.env, baselineEnv);
        assert.equal(options.shell, false); assert.equal(options.windowsHide, true); spawnObserved = true;
        return spawn(executable, args, options);
      });
      const request = { kind: 'MemoryOSReadinessHelperRequest', version: '2.0.0', session: 'ce'.repeat(32), sequence: 3, operation: 'READ_SET', roots: [{ id: 'input', path: input }], files: [{ id: 'small', maxBytes: 2097152, path: 'small.bin', root: 'input' }] };
      const frame = encodeHelperRequest(request), response = await transport.exchange(frame);
      put('native-helper.request.bin', frame); put('native-helper.response.bin', response.responseBytes);
      const decoded = decodeHelperResponse(response.responseBytes, request); assert.equal(decoded.status, 'OK'); assert.equal(response.exitConfirmed, true); assert.ok(spawnObserved);
      assert.deepEqual(Buffer.from(decoded.files[0].bytes.join(''), 'base64'), fs.readFileSync(path.join(input, 'small.bin')));
      return { actualNativeResponse: true, childEnvironmentKeys: Object.keys(baselineEnv), snapshot: supervisor.snapshot() };
    } finally { await supervisor.dispose(); for (const [key, value] of saved) { if (value === undefined) delete process.env[key]; else process.env[key] = value; } }
  });
  await check('actual-worker-empty-environment-argv-and-frozen-resource-limits', async () => {
    const saved = new Map(Object.keys(poison).map(key => [key, process.env[key]])); Object.assign(process.env, poison);
    const supervisor = createSupervisorForTesting({ kind: 'api' }, { workerURL: new URL('./environment-worker.mjs', import.meta.url) });
    try { await supervisor.runWorker({}); return supervisor.snapshot(); }
    finally { await supervisor.dispose(); for (const [key, value] of saved) { if (value === undefined) delete process.env[key]; else process.env[key] = value; } }
  });
  for (const [name, env] of [['NODE_OPTIONS-empty', { NODE_OPTIONS: '' }], ['NODE_OPTIONS-safe-option', { NODE_OPTIONS: '--no-warnings' }], ['NODE_PATH', { NODE_PATH: path.join(scratch, 'node-poison') }]]) await check('actual-cli-' + name, () => realCli(name, [], env));
  for (const [name, flags] of [['preload-builtin', ['--require=node:path']], ['import-builtin', ['--import=node:path']], ['loader-noop', ['--experimental-loader=data:text/javascript,export%20%7B%7D']], ['inspect-configuration', ['--inspect-port=0']]]) await check('actual-cli-' + name, () => realCli(name, flags));
  }
  // Node bootstrap requires trusted Windows installation variables before JS entry.
  // The separate actual helper case already proves post-entry poison cannot select them.
  const cliPoison = { ...poison, ...baselineEnv };
  await check('actual-cli-fixed-helper-under-combined-poison', () => realCli('combined-poison', [], cliPoison, 'MO1307_INPUT', 12));
  for (const flag of ['--require=untrusted', '--import=untrusted', '--loader=untrusted', '--experimental-loader=untrusted', '--inspect', '--inspect-brk', '--debug', '--debug-brk']) await check('launch-guard-' + flag.split('=')[0], () => {
    assert.throws(() => validateLaunch({ platform: 'win32', arch: 'x64', version: 'v24.21.0', execArgv: [flag], environment: baselineEnv }), error => error.code === 'MO1307_USAGE');
    return { coverage: 'Direct final-source launch guard; no unsafe preload module or inspector listener started.' };
  });
  assert.deepEqual(pins(), before, 'Source changed during campaign');
} catch (error) { failure = { message: String(error.message), stack: String(error.stack) }; process.exitCode = 1; }
finally { put('receipt.json', JSON.stringify({ kind: 'MO1307FinalNativeEnvironment', result: failure ? 'FAIL' : 'PASS', dependencies: before, failure, rows, childRows,
  limitations: ['Node executes accepted bootstrap flags before CLI entry; test preload/import use only node:path and loader is fixed inert data source. Product guard refuses any execArgv.',
    'Inspector/debug activation flags are tested at final-source launch guard; actual CLI additionally exercises non-listening inspector configuration. No network listener is opened.',
    'Synthetic nonsecret values only; no provider account, real credential, environment dump or persistent execution policy mutation.'] }, null, 2) + '\n'); console.log(JSON.stringify({ result: failure ? 'FAIL' : 'PASS', cases: rows.length, cliInvocations: childRows.length, receiptRoot })); }