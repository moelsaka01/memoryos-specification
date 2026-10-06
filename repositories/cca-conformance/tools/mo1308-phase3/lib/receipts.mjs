// MO-1308 Phase 3 shared library: the closed shapes of every campaign record (seal, step start and receipt, segment records,
// stream receipt, evidence seal, review). Section "Receipt schemas" of the protocol document names the same members.
import { any, arrayOf, bool, check, closedObject, fileRecord, int, isDigest, isIsoTime, isPrefixedDigest, lit, nullable, oneOf, str } from './shape.mjs';

export const STREAM_IDS = Object.freeze(['3A', '3B', '3C', '3D']);
export const CASE_RESULTS = Object.freeze(['PASS', 'FAIL', 'ESCALATE', 'NOT_RUN']);
export const STEP_RESULTS = CASE_RESULTS;
export const SEGMENT_RESULTS = Object.freeze(['PASS', 'FAIL', 'ESCALATE', 'NOT_RUN']);
export const CERTIFYING_RESULTS = Object.freeze(['ACCEPTED', 'FAILED_PRESERVED', 'ESCALATED_PRESERVED']);
export const REHEARSAL_RESULTS = Object.freeze(['REHEARSAL_COMPLETED', 'REHEARSAL_FAILED']);
export const GENERATION_ID = /^phase3[abcd](-g[2-9][0-9]*|-rehearsal-r[1-9][0-9]*)?$/;
export const MAX_OBSERVED_BYTES = 65536;
// A qualification case (record mode with a Qnn tag) must observe exactly one of these (A8 decision 6); anything else fails.
export const QUALIFICATION_OUTCOMES = Object.freeze(['CONFIRMED', 'NOT_CONFIRMED']);

export const EXECUTION_RULES = Object.freeze({
  once: true, caseRetry: false, warmup: false, adaptiveExpansion: false, diagnosticPromotion: false,
  lateSuccessRecovery: false, stopAtFirstMandatoryFailure: true,
});
const executionShape = closedObject(Object.fromEntries(Object.keys(EXECUTION_RULES).map((key) => [key, lit(EXECUTION_RULES[key])])));

const supersedes = closedObject({ id: str(1, 64), evidenceSealSha256: isDigest, dispositionSha256: isDigest });
const generation = closedObject({ id: str(1, 64), ordinal: int(0, 99), supersedes: nullable(supersedes) });

export const SEAL_SHAPE = closedObject({
  kind: lit('MO1308Phase3Seal'),
  version: lit('1.0.0'),
  stream: oneOf(STREAM_IDS),
  generation,
  certifying: bool,
  protocol: closedObject({ path: str(1, 512), sha256: isDigest, status: str(1, 200) }),
  inventory: closedObject({ path: str(1, 512), sha256: isDigest }),
  candidate: closedObject({ identityPath: str(1, 512), identitySha256: isDigest, baseCommit: str(40, 40), productionTreeDigest: isPrefixedDigest }),
  corpus: nullable(closedObject({ manifestPath: str(1, 512), manifestSha256: isDigest, corpusDigest: isPrefixedDigest })),
  harnessReview: nullable(fileRecord),
  tools: arrayOf(fileRecord),
  inputs: arrayOf(fileRecord),
  segments: arrayOf(closedObject({
    id: str(1, 16), budgetMs: int(1), extended: nullable(closedObject({ rationale: str(1, 1000) })), steps: arrayOf(str(1, 16)),
  })),
  steps: arrayOf(closedObject({
    id: str(1, 16), segment: str(1, 16), guardMs: int(1), cases: arrayOf(closedObject({ id: str(1, 32), mandatory: bool, mode: oneOf(['assert', 'record']), qualifications: arrayOf(str(3, 3)) })),
  })),
  execution: executionShape,
  sealedAt: isIsoTime,
});

export const SEGMENT_START_SHAPE = closedObject({
  kind: lit('MO1308Phase3SegmentStart'), version: lit('1.0.0'), stream: oneOf(STREAM_IDS), generation: str(1, 64), segment: str(1, 16),
  startedAt: isIsoTime, budgetMs: int(1), sealSha256: isDigest,
});
export const SEGMENT_FINISH_SHAPE = closedObject({
  kind: lit('MO1308Phase3SegmentFinish'), version: lit('1.0.0'), stream: oneOf(STREAM_IDS), generation: str(1, 64), segment: str(1, 16),
  result: oneOf(SEGMENT_RESULTS), reason: nullable(str(1, 64)), finishedAt: isIsoTime, elapsedMs: int(),
});
export const STEP_START_SHAPE = closedObject({
  kind: lit('MO1308Phase3StepStart'), version: lit('1.0.0'), stream: oneOf(STREAM_IDS), generation: str(1, 64), step: str(1, 16),
  segment: str(1, 16), startedAt: isIsoTime, guardMs: int(1), effectiveGuardMs: int(1),
});

const failure = closedObject({ name: str(0, 200), code: nullable(str(0, 200)), message: str(0, 1000) });
const caseResult = closedObject({
  id: str(1, 32), result: oneOf(CASE_RESULTS), mode: oneOf(['assert', 'record']), mandatory: bool, elapsedMs: int(),
  escalation: nullable(str(1, 200)), outcome: nullable(oneOf(QUALIFICATION_OUTCOMES)), observed: any, failure: nullable(failure),
});
export const STEP_RECEIPT_SHAPE = closedObject({
  kind: lit('MO1308Phase3StepReceipt'), version: lit('1.0.0'), stream: oneOf(STREAM_IDS), generation: str(1, 64), step: str(1, 16),
  segment: str(1, 16), result: oneOf(STEP_RESULTS), failureCode: nullable(str(1, 64)),
  startedAt: nullable(isIsoTime), finishedAt: isIsoTime, elapsedMs: int(), cases: arrayOf(caseResult),
});

export const STOPPED_SHAPE = closedObject({
  kind: lit('MO1308Phase3GenerationStopped'), version: lit('1.0.0'), stream: oneOf(STREAM_IDS), generation: str(1, 64),
  segment: str(1, 16), step: str(1, 16), reason: str(1, 64), stoppedAt: isIsoTime,
});

export const STREAM_RECEIPT_SHAPE = closedObject({
  kind: lit('MO1308Phase3StreamReceipt'), version: lit('1.0.0'), stream: oneOf(STREAM_IDS), generation: str(1, 64),
  certifying: bool, promotable: bool, result: oneOf([...CERTIFYING_RESULTS, ...REHEARSAL_RESULTS]), outcome: str(1, 64),
  sealSha256: isDigest,
  segments: arrayOf(closedObject({ id: str(1, 16), result: oneOf(SEGMENT_RESULTS) })),
  steps: arrayOf(closedObject({ id: str(1, 16), result: oneOf(STEP_RESULTS), receiptSha256: isDigest })),
  counts: closedObject({ total: int(), PASS: int(), FAIL: int(), ESCALATE: int(), NOT_RUN: int() }),
  mandatoryNotPassed: arrayOf(str(1, 32)),
  nonMandatoryNotPassed: arrayOf(str(1, 32)),
  qualifications: arrayOf(closedObject({ id: str(3, 3), cases: arrayOf(closedObject({ id: str(1, 32), result: oneOf(CASE_RESULTS), outcome: nullable(oneOf(QUALIFICATION_OUTCOMES)) })) })),
  finishedAt: isIsoTime,
});

export const EVIDENCE_SEAL_SHAPE = closedObject({
  kind: lit('MO1308Phase3EvidenceSeal'), version: lit('1.0.0'), stream: oneOf(STREAM_IDS), generation: str(1, 64),
  files: arrayOf(fileRecord), rootDigest: isPrefixedDigest,
});

export const REVIEW_SHAPE = closedObject({
  kind: lit('MO1308Phase3Review'), version: lit('1.0.0'),
  subject: arrayOf(fileRecord),
  reviewer: closedObject({ role: oneOf(['INDEPENDENT_SUB_AGENT', 'HUMAN']), identity: str(1, 200) }),
  scope: str(1, 2000),
  findings: arrayOf(closedObject({
    id: str(1, 32), severity: oneOf(['BLOCKING', 'NON_BLOCKING', 'NOTE']), summary: str(1, 2000),
    disposition: oneOf(['FIXED', 'ACCEPTED_WITH_DISCLOSURE', 'REJECTED_WITH_REASON', 'OPEN']), note: str(0, 2000),
  })),
  conclusion: oneOf(['NO_BLOCKING_FINDINGS', 'BLOCKING_FINDINGS_OPEN']),
  reviewedAt: isIsoTime,
});

export function validateReview(value) {
  const problems = check(REVIEW_SHAPE, value);
  if (problems.length > 0) return problems;
  const open = value.findings.filter((finding) => finding.severity === 'BLOCKING' && finding.disposition === 'OPEN');
  if (value.conclusion === 'NO_BLOCKING_FINDINGS' && open.length > 0) problems.push('$.conclusion: blocking findings are still open');
  if (value.conclusion === 'BLOCKING_FINDINGS_OPEN' && open.length === 0) problems.push('$.conclusion: no blocking finding is open');
  return problems;
}

export const validators = Object.freeze({
  seal: SEAL_SHAPE, segmentStart: SEGMENT_START_SHAPE, segmentFinish: SEGMENT_FINISH_SHAPE, stepStart: STEP_START_SHAPE, stopped: STOPPED_SHAPE,
  stepReceipt: STEP_RECEIPT_SHAPE, streamReceipt: STREAM_RECEIPT_SHAPE, evidenceSeal: EVIDENCE_SEAL_SHAPE,
});
export function validate(kind, value) {
  const shape = validators[kind];
  if (shape === undefined) throw new Error(`unknown receipt kind ${kind}`);
  return check(shape, value);
}
