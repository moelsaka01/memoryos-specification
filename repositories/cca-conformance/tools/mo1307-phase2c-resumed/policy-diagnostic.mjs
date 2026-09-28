// Single classification diagnostic after failed exact-product acceptance.
// No policy override, argument mutation, native acceptance retry or product fix.
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { spawnSync } from 'node:child_process';
import { performance } from 'node:perf_hooks';
import { createHash } from 'node:crypto';
import { helperLaunchSpecification } from '../../../memoryos-readiness/src/helper-transport.mjs';
import { encodeHelperRequest } from '../../../memoryos-readiness/src/helper-protocol.mjs';
const root = fileURLToPath(new URL('../../../../', import.meta.url));
const base = path.join(root, 'repositories/cca-conformance/evidence/mo1307/phase2c-resumed/native-process');
const evidence = path.join(base, 'policy-diagnostic');
const prior = JSON.parse(fs.readFileSync(path.join(base, 'attempt2/native-surfaces/receipt.json')));
const request = { kind: 'MemoryOSReadinessHelperRequest', version: '2.0.0', session: prior.results[0].requests[0].session,
  sequence: 1, operation: 'READ_SET', roots: [{ id: 'input', path: path.join(root, 'repositories/cca-conformance/fixtures/mo1307/bundles/ready') }],
  files: [{ id: 'authority', path: 'authority.json', root: 'input', maxBytes: 1048576 }, { id: 'config', path: 'configuration.json', root: 'input', maxBytes: 16384 }] };
const bytes = encodeHelperRequest(request), specification = helperLaunchSpecification();
fs.writeFileSync(path.join(evidence, 'request.bin'), bytes, { flag: 'wx' });
const at = performance.now();
const result = spawnSync(specification.executable, [...specification.args], { ...specification.options,
  env: { ...specification.options.env }, stdio: [...specification.options.stdio], input: bytes,
  timeout: 5000, maxBuffer: 16777216 });
const elapsedMs = performance.now() - at;
fs.writeFileSync(path.join(evidence, 'stdout.bin'), result.stdout ?? Buffer.alloc(0), { flag: 'wx' });
fs.writeFileSync(path.join(evidence, 'stderr.txt'), result.stderr ?? Buffer.alloc(0), { flag: 'wx' });
const denial = /running scripts is disabled/.test(result.stderr?.toString() ?? '');
const receipt = { kind: 'MO1307FixedHelperPolicyClassification', classification: denial ? 'ENVIRONMENT_BLOCKER' : 'UNCLASSIFIED',
  acceptanceRetry: false, executable: specification.executable, args: specification.args, options: specification.options,
  status: result.status, signal: result.signal, spawnError: result.error?.code ?? null, elapsedMs,
  stdoutBytes: result.stdout?.length ?? 0, stderrBytes: result.stderr?.length ?? 0,
  requestSha256: createHash('sha256').update(bytes).digest('hex'), requestSession: request.session,
  policyModified: false, bypassSupplied: false,
  statement: 'Exact fixed production executable, args, environment, cwd and same first READ_SET request as preceding attempt. Raw stderr retained solely to classify startup rejection.' };
fs.writeFileSync(path.join(evidence, 'receipt.json'), JSON.stringify(receipt, null, 2) + '\n', { flag: 'wx' });
process.stdout.write(JSON.stringify(receipt) + '\n');
