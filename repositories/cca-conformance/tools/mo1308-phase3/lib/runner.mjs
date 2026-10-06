// MO-1308 Phase 3 shared library: the seal / run / close campaign runner (pure, platform-independent).
//
// A generation is sealed once, run once per segment and closed once. The runner enforces the one-shot rules the protocol
// states: no resume (a segment or step that has a start record can never be started again), no case retry, stop at the first
// mandatory failure, a hard stop from the segment budget, per-step guards, and write-once evidence. It knows nothing about
// Windows or the product: the executors it is given do the work; every executor in this repository's first Phase 3 step is a
// test double. Platform-specific harnesses (Windows-only) come in later steps and plug into the same `ctx.runCase` API.
import { performance } from 'node:perf_hooks';
import { exists, fileSha256, readJson, writeOnce } from './evidence.mjs';
import { walkRecords, digestOfJson } from './hashing.mjs';
import { stableValue, stableBytes, stableStringify } from './stable-json.mjs';
import { check } from './shape.mjs';
import { MAX_OBSERVED_BYTES, QUALIFICATION_OUTCOMES, validate, STREAM_RECEIPT_SHAPE } from './receipts.mjs';
import { CampaignError, fail, loadSeal, verifyBindings } from './seal.mjs';
import { allCases, inventoryBytes } from './inventory.mjs';
import { sha256Hex } from './hashing.mjs';

export class HarnessError extends Error {
  constructor(code, message) { super(message ?? code); this.name = 'HarnessError'; this.code = code; }
}

const clip = (text, limit) => String(text).slice(0, limit);
const describe = (error) => ({
  name: clip(error?.name ?? 'Error', 200),
  code: error?.code === undefined || error?.code === null ? null : clip(error.code, 200),
  message: clip(error?.message ?? String(error), 1000),
});
const roundMs = (value) => Math.max(0, Math.round(value));

function stepSpec(seal, stepId) {
  const spec = seal.steps.find((step) => step.id === stepId);
  if (spec === undefined) fail('UNKNOWN_STEP', stepId);
  return spec;
}

function notRunCase(spec) {
  return { id: spec.id, result: 'NOT_RUN', mode: spec.mode, mandatory: spec.mandatory, elapsedMs: 0, escalation: null, outcome: null, observed: {}, failure: null };
}

// ---- run ----

export async function runSegment({ root, evidenceDir, segmentId, executors, now = () => new Date(), monotonic = () => performance.now(), checkBindings = true }) {
  const seal = loadSeal(evidenceDir);
  if (checkBindings) {
    const problems = verifyBindings(root, seal);
    if (problems.length > 0) fail('BINDINGS_CHANGED', problems[0]);
  }
  if (exists(evidenceDir, 'stream-receipt.json')) fail('GENERATION_CLOSED', 'the generation is closed');
  const segmentIndex = seal.segments.findIndex((segment) => segment.id === segmentId);
  if (segmentIndex === -1) fail('UNKNOWN_SEGMENT', segmentId);
  const segment = seal.segments[segmentIndex];
  if (exists(evidenceDir, `segments/${segmentId}-start.json`)) fail('SEGMENT_ALREADY_STARTED', `segment ${segmentId} was started; a generation never resumes`);
  for (const earlier of seal.segments.slice(0, segmentIndex)) {
    if (!exists(evidenceDir, `segments/${earlier.id}-finish.json`) || readJson(evidenceDir, `segments/${earlier.id}-finish.json`).result !== 'PASS') {
      fail('PREVIOUS_SEGMENT_NOT_PASSED', `segment ${earlier.id} has not finished with PASS`);
    }
  }
  for (const stepId of segment.steps) if (typeof executors[stepId] !== 'function') fail('EXECUTOR_MISSING', stepId);

  const sealSha256 = fileSha256(evidenceDir, 'seal.json');
  const startedClock = monotonic();
  const startedAt = now();
  const hardStopAt = startedClock + segment.budgetMs;
  const start = {
    kind: 'MO1308Phase3SegmentStart', version: '1.0.0', stream: seal.stream, generation: seal.generation.id, segment: segmentId,
    startedAt: startedAt.toISOString(), budgetMs: segment.budgetMs, sealSha256,
  };
  writeOnce(evidenceDir, `segments/${segmentId}-start.json`, start);

  let stoppedReason = null;
  for (const stepId of segment.steps) {
    const spec = stepSpec(seal, stepId);
    if (stoppedReason !== null) { recordNotRun(evidenceDir, seal, spec, null, 'NOT_RUN', now); continue; }
    const remaining = hardStopAt - monotonic();
    if (remaining <= 0) {
      stoppedReason = 'BUDGET_EXHAUSTED';
      recordNotRun(evidenceDir, seal, spec, 'BUDGET_EXHAUSTED', 'NOT_RUN', now);
      writeStopped(evidenceDir, seal, segmentId, stepId, stoppedReason, now);
      continue;
    }
    const outcome = await runStep({ evidenceDir, seal, spec, executor: executors[stepId], effectiveGuardMs: Math.min(spec.guardMs, Math.floor(remaining)), now, monotonic });
    if (outcome.result !== 'PASS') {
      stoppedReason = outcome.failureCode ?? `STEP_${outcome.result}`;
      writeStopped(evidenceDir, seal, segmentId, stepId, stoppedReason, now);
    }
  }
  const result = segmentResultOf(segment.steps.map((id) => readJson(evidenceDir, `steps/${id}.json`)));
  const finishedAt = now();
  writeOnce(evidenceDir, `segments/${segmentId}-finish.json`, {
    kind: 'MO1308Phase3SegmentFinish', version: '1.0.0', stream: seal.stream, generation: seal.generation.id, segment: segmentId,
    result, reason: stoppedReason, finishedAt: finishedAt.toISOString(), elapsedMs: roundMs(monotonic() - startedClock),
  });
  return { result, reason: stoppedReason };
}

function writeStopped(evidenceDir, seal, segment, step, reason, now) {
  writeOnce(evidenceDir, 'generation-stopped.json', {
    kind: 'MO1308Phase3GenerationStopped', version: '1.0.0', stream: seal.stream, generation: seal.generation.id,
    segment, step, reason, stoppedAt: now().toISOString(),
  });
}

// A step that did not run. `failureCode` is null when an earlier mandatory failure stopped the generation (the reason is in
// generation-stopped.json) or the step was never reached, and a code when the step itself failed (budget, interruption).
function recordNotRun(evidenceDir, seal, spec, failureCode, result, now) {
  const at = now().toISOString();
  writeOnce(evidenceDir, `steps/${spec.id}.json`, {
    kind: 'MO1308Phase3StepReceipt', version: '1.0.0', stream: seal.stream, generation: seal.generation.id, step: spec.id,
    segment: spec.segment, result, failureCode, startedAt: null, finishedAt: at, elapsedMs: 0,
    cases: spec.cases.map(notRunCase),
  });
}

async function runStep({ evidenceDir, seal, spec, executor, effectiveGuardMs, now, monotonic }) {
  const startedAt = now();
  const clock = monotonic();
  writeOnce(evidenceDir, `steps/${spec.id}-start.json`, {
    kind: 'MO1308Phase3StepStart', version: '1.0.0', stream: seal.stream, generation: seal.generation.id, step: spec.id,
    segment: spec.segment, startedAt: startedAt.toISOString(), guardMs: spec.guardMs, effectiveGuardMs,
  });
  const controller = new AbortController();
  const specs = new Map(spec.cases.map((item) => [item.id, item]));
  const results = new Map();
  const state = { stopped: false, closed: false, current: null };

  const ctx = Object.freeze({
    stream: seal.stream, generation: seal.generation.id, step: spec.id, signal: controller.signal, now,
    async runCase(id, body) {
      const item = specs.get(id);
      if (item === undefined) throw new HarnessError('UNKNOWN_CASE', `${id} is not a case of step ${spec.id}`);
      if (state.closed) throw new HarnessError('STEP_CLOSED', `step ${spec.id} is closed`);
      if (results.has(id) || state.current === id) throw new HarnessError('DUPLICATE_CASE', `${id} was already run: cases are never retried`);
      if (state.current !== null) throw new HarnessError('CASE_OVERLAP', `${id} started while ${state.current} is running: cases run one at a time`);
      if (state.stopped) { results.set(id, notRunCase(item)); return results.get(id); }
      state.current = id;
      const observed = {};
      let escalation = null;
      let failure = null;
      const caseClock = monotonic();
      const handle = Object.freeze({
        signal: controller.signal,
        observe(values) { Object.assign(observed, values); },
        escalate(reason) { escalation = clip(reason, 200); },
      });
      try { await body(handle); } catch (error) { failure = describe(error); }
      if (state.closed) return null; // the step guard already expired; its record wins
      state.current = null;
      let observedValue = {};
      try {
        observedValue = stableValue(observed);
        if (stableBytes(observedValue).length > MAX_OBSERVED_BYTES) throw new HarnessError('OBSERVATION_TOO_LARGE');
      } catch (error) {
        failure ??= { name: 'HarnessError', code: error.code ?? 'OBSERVATION_INVALID', message: clip(error.message, 1000) };
        observedValue = {};
      }
      if (failure === null && escalation === null && item.mode === 'record' && Object.keys(observedValue).length === 0) {
        failure = { name: 'HarnessError', code: 'RECORD_WITHOUT_OBSERVATION', message: 'a record case must observe something' };
      }
      let outcome = null;
      if (item.mode === 'record' && item.qualifications.length > 0 && failure === null) {
        if (QUALIFICATION_OUTCOMES.includes(observedValue.outcome)) outcome = observedValue.outcome;
        else failure = { name: 'HarnessError', code: 'QUALIFICATION_OUTCOME_INVALID', message: 'a qualification case must observe outcome CONFIRMED or NOT_CONFIRMED' };
      }
      const result = failure !== null ? 'FAIL' : escalation !== null ? 'ESCALATE' : 'PASS';
      const row = {
        id, result, mode: item.mode, mandatory: item.mandatory, elapsedMs: roundMs(monotonic() - caseClock),
        escalation, outcome, observed: observedValue, failure,
      };
      results.set(id, row);
      if (result !== 'PASS' && item.mandatory) state.stopped = true;
      return row;
    },
  });

  let failureCode = null;
  const execution = Promise.resolve().then(() => executor(ctx)).then(() => 'DONE', (error) => ({ error }));
  let timer;
  const guard = new Promise((resolve) => { timer = setTimeout(() => resolve('EXPIRED'), effectiveGuardMs); });
  const raced = await Promise.race([execution, guard]);
  clearTimeout(timer);
  if (raced === 'EXPIRED') {
    state.closed = true;
    controller.abort();
    failureCode = 'STEP_GUARD_EXPIRED';
    if (state.current !== null && !results.has(state.current)) {
      const item = specs.get(state.current);
      results.set(state.current, {
        id: item.id, result: 'FAIL', mode: item.mode, mandatory: item.mandatory, elapsedMs: effectiveGuardMs, escalation: null,
        observed: {}, failure: { name: 'CampaignError', code: 'STEP_GUARD_EXPIRED', message: 'the step guard expired while the case was running' },
      });
    }
  } else if (raced !== 'DONE') {
    state.closed = true;
    failureCode = 'STEP_EXCEPTION';
    if (state.current !== null && !results.has(state.current)) {
      const item = specs.get(state.current);
      results.set(state.current, { ...notRunCase(item), result: 'FAIL', failure: describe(raced.error) });
    } else {
      // The executor threw outside a case: keep the error on the first case that has no result, so it is not lost.
      const first = spec.cases.find((item) => !results.has(item.id));
      if (first !== undefined) results.set(first.id, { ...notRunCase(first), result: 'FAIL', failure: describe(raced.error) });
    }
  } else {
    controller.abort();
  }
  state.closed = true;
  const missing = spec.cases.filter((item) => !results.has(item.id));
  if (missing.length > 0) {
    if (failureCode === null && !state.stopped) failureCode = 'CASES_NOT_REPORTED';
    for (const item of missing) results.set(item.id, notRunCase(item));
  }
  const rows = spec.cases.map((item) => results.get(item.id));
  const mandatory = rows.filter((row) => row.mandatory);
  const result = failureCode !== null || mandatory.some((row) => row.result === 'FAIL') ? 'FAIL'
    : mandatory.some((row) => row.result === 'ESCALATE') ? 'ESCALATE' : 'PASS';
  const finishedAt = now();
  writeOnce(evidenceDir, `steps/${spec.id}.json`, {
    kind: 'MO1308Phase3StepReceipt', version: '1.0.0', stream: seal.stream, generation: seal.generation.id, step: spec.id,
    segment: spec.segment, result, failureCode, startedAt: startedAt.toISOString(), finishedAt: finishedAt.toISOString(),
    elapsedMs: roundMs(monotonic() - clock), cases: rows,
  });
  return { result, failureCode };
}

// ---- close ----

export function deriveStreamReceipt({ seal, sealSha256, inventory, stepReceipts, segmentResults, finishedAt }) {
  const rows = seal.steps.flatMap((step) => stepReceipts.get(step.id).receipt.cases);
  const counts = { total: rows.length, PASS: 0, FAIL: 0, ESCALATE: 0, NOT_RUN: 0 };
  for (const row of rows) counts[row.result] += 1;
  const mandatoryNotPassed = rows.filter((row) => row.mandatory && row.result !== 'PASS').map((row) => row.id);
  const nonMandatoryNotPassed = rows.filter((row) => !row.mandatory && row.result !== 'PASS').map((row) => row.id);
  const stepFailures = seal.steps.filter((step) => stepReceipts.get(step.id).receipt.failureCode !== null);
  const mandatoryRows = rows.filter((row) => row.mandatory);
  const allSegmentsPass = [...segmentResults.values()].every((result) => result === 'PASS');
  const accepted = mandatoryNotPassed.length === 0 && stepFailures.length === 0 && allSegmentsPass;
  const escalated = !accepted && mandatoryRows.some((row) => row.result === 'ESCALATE')
    && !mandatoryRows.some((row) => row.result === 'FAIL') && stepFailures.length === 0;
  let result;
  if (seal.certifying) result = accepted ? 'ACCEPTED' : escalated ? 'ESCALATED_PRESERVED' : 'FAILED_PRESERVED';
  else result = accepted ? 'REHEARSAL_COMPLETED' : 'REHEARSAL_FAILED';
  const byId = new Map(rows.map((row) => [row.id, row.result]));
  const outcomeById = new Map(rows.map((row) => [row.id, row.outcome]));
  const qualifications = inventory.qualifications.map(({ id }) => ({
    id,
    cases: allCases(inventory).filter((item) => item.stream === seal.stream && item.qualifications.includes(id))
      .map((item) => ({ id: item.id, result: byId.get(item.id), outcome: outcomeById.get(item.id) ?? null })),
  })).filter((item) => item.cases.length > 0);
  return {
    kind: 'MO1308Phase3StreamReceipt', version: '1.0.0', stream: seal.stream, generation: seal.generation.id,
    certifying: seal.certifying, promotable: seal.certifying, result,
    outcome: `PHASE${seal.stream}_${result}`, sealSha256,
    segments: seal.segments.map((segment) => ({ id: segment.id, result: segmentResults.get(segment.id) })),
    steps: seal.steps.map((step) => ({ id: step.id, result: stepReceipts.get(step.id).receipt.result, receiptSha256: stepReceipts.get(step.id).sha256 })),
    counts, mandatoryNotPassed, nonMandatoryNotPassed, qualifications, finishedAt,
  };
}

function loadStepReceipts(evidenceDir, seal) {
  const map = new Map();
  for (const step of seal.steps) {
    const receipt = readJson(evidenceDir, `steps/${step.id}.json`);
    const problems = validate('stepReceipt', receipt);
    if (problems.length > 0) fail('STEP_RECEIPT_INVALID', `${step.id}: ${problems[0]}`);
    map.set(step.id, { receipt, sha256: fileSha256(evidenceDir, `steps/${step.id}.json`) });
  }
  return map;
}

// A segment passes only if every step passed. A step that itself failed (guard, budget, exception, interruption) or a
// failed mandatory case makes it FAIL; a mandatory escalation alone makes it ESCALATE; nothing run is NOT_RUN.
function segmentResultOf(receipts) {
  if (receipts.every((receipt) => receipt.result === 'PASS')) return 'PASS';
  if (receipts.some((receipt) => receipt.result === 'FAIL' || receipt.failureCode !== null)) return 'FAIL';
  return receipts.some((receipt) => receipt.result === 'ESCALATE') ? 'ESCALATE' : 'NOT_RUN';
}

// The inventory handed to close and verify must be the sealed one, not merely a file that happens to exist.
function assertSealedInventory(seal, inventory) {
  if (sha256Hex(inventoryBytes(inventory)) !== seal.inventory.sha256) fail('INVENTORY_MISMATCH', 'the inventory is not the one the seal binds');
}

// Finalizes the generation: steps and segments that were never finished become NOT_RUN or INTERRUPTED records, the stream
// receipt is derived, and an evidence seal binds every file. Closing is once: nothing is rewritten.
export function closeGeneration({ root, evidenceDir, inventory, now = () => new Date(), checkBindings = true }) {
  const seal = loadSeal(evidenceDir);
  if (checkBindings) {
    const problems = verifyBindings(root, seal);
    if (problems.length > 0) fail('BINDINGS_CHANGED', problems[0]);
  }
  if (exists(evidenceDir, 'stream-receipt.json')) fail('GENERATION_CLOSED', 'the generation is already closed');
  assertSealedInventory(seal, inventory);
  const sealSha256 = fileSha256(evidenceDir, 'seal.json');
  for (const spec of seal.steps) {
    if (exists(evidenceDir, `steps/${spec.id}.json`)) continue;
    // A start record without a receipt: the process died or was killed. The step is a failure, never a pass.
    if (exists(evidenceDir, `steps/${spec.id}-start.json`)) recordNotRun(evidenceDir, seal, spec, 'INTERRUPTED', 'FAIL', now);
    else recordNotRun(evidenceDir, seal, spec, null, 'NOT_RUN', now);
  }
  const stepReceipts = loadStepReceipts(evidenceDir, seal);
  const segmentResults = new Map();
  for (const segment of seal.segments) {
    const result = segmentResultOf(segment.steps.map((id) => stepReceipts.get(id).receipt));
    segmentResults.set(segment.id, result);
    if (exists(evidenceDir, `segments/${segment.id}-start.json`) && !exists(evidenceDir, `segments/${segment.id}-finish.json`)) {
      writeOnce(evidenceDir, `segments/${segment.id}-finish.json`, {
        kind: 'MO1308Phase3SegmentFinish', version: '1.0.0', stream: seal.stream, generation: seal.generation.id, segment: segment.id,
        result: result === 'PASS' ? 'FAIL' : result, reason: 'INTERRUPTED', finishedAt: now().toISOString(), elapsedMs: 0,
      });
    }
  }
  const receipt = deriveStreamReceipt({ seal, sealSha256, inventory, stepReceipts, segmentResults, finishedAt: now().toISOString() });
  const problems = check(STREAM_RECEIPT_SHAPE, receipt);
  if (problems.length > 0) fail('STREAM_RECEIPT_INVALID', problems[0]);
  writeOnce(evidenceDir, 'stream-receipt.json', receipt);
  const files = walkRecords(evidenceDir);
  writeOnce(evidenceDir, 'evidence-seal.json', {
    kind: 'MO1308Phase3EvidenceSeal', version: '1.0.0', stream: seal.stream, generation: seal.generation.id, files, rootDigest: digestOfJson(files),
  });
  return receipt;
}

// Independent re-derivation of a closed generation: shapes, write-once files, the evidence seal, and the stream receipt
// recomputed from the step receipts. Returns the problems (empty when the evidence is intact and consistent).
export function verifyEvidence({ root, evidenceDir, inventory, checkBindings = true }) {
  const problems = [];
  let seal;
  try { seal = loadSeal(evidenceDir); } catch (error) { return { problems: [`seal: ${error.message}`] }; }
  if (checkBindings) problems.push(...verifyBindings(root, seal));
  try { assertSealedInventory(seal, inventory); } catch (error) { return { problems: [...problems, error.message], seal }; }
  for (const required of ['stream-receipt.json', 'evidence-seal.json']) {
    if (!exists(evidenceDir, required)) return { problems: [...problems, `${required}: missing`], seal };
  }
  const evidenceSeal = readJson(evidenceDir, 'evidence-seal.json');
  problems.push(...validate('evidenceSeal', evidenceSeal));
  const actual = walkRecords(evidenceDir).filter((row) => row.path !== 'evidence-seal.json');
  if (stableStringify(actual) !== stableStringify(evidenceSeal.files)) problems.push('evidence-seal: the evidence files differ from the seal');
  if (evidenceSeal.rootDigest !== digestOfJson(evidenceSeal.files)) problems.push('evidence-seal: rootDigest mismatch');
  let receipt;
  try {
    const stepReceipts = loadStepReceipts(evidenceDir, seal);
    for (const step of seal.steps) {
      const ids = stepReceipts.get(step.id).receipt.cases.map((row) => row.id);
      if (JSON.stringify(ids) !== JSON.stringify(step.cases.map((item) => item.id))) problems.push(`steps/${step.id}: case list differs from the seal`);
    }
    const segmentResults = new Map(seal.segments.map((segment) => [segment.id, segmentResultOf(segment.steps.map((id) => stepReceipts.get(id).receipt))]));
    receipt = readJson(evidenceDir, 'stream-receipt.json');
    problems.push(...validate('streamReceipt', receipt));
    const expected = deriveStreamReceipt({
      seal, sealSha256: fileSha256(evidenceDir, 'seal.json'), inventory, stepReceipts, segmentResults, finishedAt: receipt.finishedAt,
    });
    if (stableStringify(expected) !== stableStringify(receipt)) problems.push('stream-receipt: differs from the receipt derived from the step receipts');
  } catch (error) { problems.push(`derivation: ${error.message}`); }
  return { problems, seal, receipt };
}

export { CampaignError };
