// REVIEWED ENGINEERING DOUBLE: selects committed fixture bytes by BOTH pins.
// This tests 2C transport and never asserts production authority verification.
import fs from 'node:fs';
import { parentPort, workerData } from 'node:worker_threads';
import { inspectFoundationInputs, checkDecisionBinding } from '../../../memoryos-readiness/src/foundation.mjs';
import { parseCanonical } from '../../../memoryos-readiness/src/canonical.mjs';
import { ReadinessError, operationalError } from '../../../memoryos-readiness/src/errors.mjs';
try {
  const { input, verify } = workerData;
  inspectFoundationInputs(input, verify);
  let computed;
  for (const name of ['ready', 'qualified', 'not-ready', 'could-not-evaluate', 'pre-tag-present', 'post-tag-ready']) {
    const root = new URL('../../fixtures/mo1307/bundles/' + name + '/', import.meta.url);
    const pins = JSON.parse(fs.readFileSync(new URL('pins.json', root)));
    if (pins.trustedAuthorityDigest === input.trustedAuthorityDigest && pins.expectedCandidateDigest === input.expectedCandidateDigest) {
      const resultBytes = fs.readFileSync(new URL('expected-result.json', root));
      const result = parseCanonical(resultBytes);
      computed = { result, resultBytes };
      break;
    }
  }
  if (!computed) throw new ReadinessError('INTERNAL', 'EVALUATION');
  if (verify && !Buffer.from(input.resultBytes).equals(computed.resultBytes)) throw new ReadinessError('RESULT_MISMATCH', 'VERIFICATION', 'result');
  const value = { resultBytes: computed.resultBytes, readinessDigest: computed.result.readinessDigest, proofBindingDigest: computed.result.proofBindingDigest };
  if (verify) value.decision = input.decisionBytes === null ? null : checkDecisionBinding(parseCanonical(input.decisionBytes), computed.result);
  parentPort.postMessage({ status: 'OK', value });
} catch (error) {
  const safe = operationalError(error);
  parentPort.postMessage({ status: 'ERROR', code: safe.code, stage: safe.stage, reference: safe.reference });
} finally { parentPort.close(); }
