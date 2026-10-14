import { DEFINITIONS } from './constants.mjs';
import { canonicalDigest } from './canonical.mjs';
import { fail } from './errors.mjs';
import { selectPhaseError, sortedUnique, validateRecord } from './foundation.mjs';
import { structurallyEqual } from './schema.mjs';

const stage = 'EVALUATION';
const compare = (a, b) => a < b ? -1 : a > b ? 1 : 0;
const equal = structurallyEqual;
const gateDefinitions = new Map(DEFINITIONS.gateDefinitions.map(gate => [gate.id, gate]));
const active = (gate, profile, assessmentStage) => gate.applicability === 'ALWAYS'
  || gate.applicability === 'REST_ONLY' && profile === 'rest'
  || gate.applicability === 'CICD_ONLY' && profile === 'cicd'
  || gate.applicability === 'PRE_TAG' && assessmentStage === 'PRE_TAG_READINESS'
  || gate.applicability === 'POST_TAG' && assessmentStage === 'POST_TAG_VERIFICATION';
const badQualification = reference => fail('QUALIFICATION_MISMATCH', stage, reference);
const badHistory = reference => fail('HISTORY_MISMATCH', stage, reference);
const validate = (type, value, code, reference) => validateRecord(type, value, { code, stage, reference });

function verifyProvider(detail, qualifications, reference) {
  validate('ProviderDetail', detail, 'QUALIFICATION_MISMATCH', reference);
  const bad = () => badQualification(reference);
  const { provider, implementation, validation, execution, sourceExecutionLabel, support, hostedCases } = detail;
  if (sourceExecutionLabel !== execution && !(provider === 'github'
    && sourceExecutionLabel === 'NOT_CERTIFIED' && execution === 'HOSTED_EXECUTION_NOT_CERTIFIED')) bad();
  if (provider !== 'github' && hostedCases !== null) bad();
  if (provider === 'github' && execution === 'HOSTED_EXECUTION_CERTIFIED'
    && (hostedCases === null || !Object.values(hostedCases).every(value => value === true) || support !== 'SUPPORTED')) bad();
  const relevant = qualifications.filter(q => q.provider === provider);
  const minimum = provider === 'generic' ? 'REAL_EXECUTION_CERTIFIED'
    : provider === 'github' ? 'OFFLINE_VALIDATED' : 'CONTRACT_VALIDATED';
  // Known unsupported, lower-minimum facts are valid inputs for 2A's blocker
  // calculation. They do not become certificates or qualification-based waivers.
  if (implementation !== 'IMPLEMENTED' || validation !== minimum) {
    // These are independent reviewed axes, not a universal strength ranking.
    // Source/claim/grant identity, verified before this seam, prevents a caller
    // from turning an offline fact into an invented execution certificate.
    return;
  }
  if (provider === 'generic') {
    if (relevant.length || !['REAL_EXECUTION_CERTIFIED', 'NOT_CERTIFIED'].includes(execution)) bad();
    // Missing real execution and UNSUPPORTED are known minimum failures, not
    // malformed evidence. 2A alone decides the gate outcome.
    if (!['SUPPORTED', 'UNSUPPORTED'].includes(support)) bad();
    return;
  }
  const reason = provider === 'github' ? 'HOSTED_NOT_CERTIFIED' : 'PROVIDER_NOT_LIVE_CERTIFIED';
  const certified = provider === 'github' ? 'HOSTED_EXECUTION_CERTIFIED' : 'LIVE_PROVIDER_CERTIFIED';
  const uncertified = provider === 'github' ? ['HOSTED_EXECUTION_NOT_CERTIFIED', 'NOT_CERTIFIED'] : ['NOT_LIVE_PROVIDER_CERTIFIED'];
  if (execution === certified) {
    if (support !== 'SUPPORTED' || relevant.length) bad();
    if (provider === 'github' && (hostedCases === null || !Object.values(hostedCases).every(value => value === true))) bad();
  } else if (uncertified.includes(execution)) {
    if (support !== (provider === 'github' ? 'SUPPORTED_WITH_HOSTED_CERTIFICATION_LIMITATION' : 'SUPPORTED_WITH_CONTRACT_VALIDATION_ONLY')) bad();
    if (relevant.length !== 1 || relevant[0].reasonCode !== reason) bad();
  } else if (!(support === 'UNSUPPORTED' && execution === 'NOT_CERTIFIED' && relevant.length === 0)) bad();
}

/**
 * Private post-authority seam. selections MUST come from complete verification
 * of the independently operator-pinned root, exact source/envelope bytes,
 * manifest, grants and candidate/dependency closure. This function grants no
 * authority and does not parse or heuristically reinterpret opaque legacy data.
 * It verifies cross-record semantics and returns detached facts for 2A, never
 * gate states, blockers, certification promotion or an aggregate readiness.
 */
export function verifyHistoryQualificationsProviders({ candidate, candidateDigest, authority, selections }) {
  const assessment = authority.assessment;
  const slots = new Map(assessment.slots.map(slot => [slot.gateId, slot]));
  const byGrant = new Map();
  for (const selection of selections) {
    if (byGrant.has(selection.grant.id)) fail('INPUT', stage, selection.grant.envelopeId);
    byGrant.set(selection.grant.id, selection);
  }
  const selected = gateId => {
    const slot = slots.get(gateId);
    return slot?.availability === 'AVAILABLE' && slot.grantIds.length ? byGrant.get(slot.grantIds[0]) : null;
  };
  const historySelection = selected('history');
  const scopeSelection = selected('scope');
  const historyAvailable = Boolean(historySelection);
  const scopeAvailable = Boolean(scopeSelection);
  const ordered = [...selections].sort((a, b) => compare(a.grant.id, b.grant.id));

  // Shape/identity validation is complete before cross-record dereferencing.
  // The pin and source checks belong to the preceding AUTHORITY phase; these
  // defensive checks prevent accidental use of altered selections internally.
  selectPhaseError(ordered.map(selection => () => {
    const { claim, grant, claimDigest } = selection;
    const reference = grant.envelopeId;
    if (canonicalDigest(claim) !== claimDigest || grant.claimDigest !== claimDigest
      || !assessment.grants.some(rootGrant => equal(rootGrant, grant))) fail('EVIDENCE_AUTHORITY', stage, reference);
    if (claim.qualifications.length > DEFINITIONS.limits.qualifications) fail('RESOURCE_LIMIT', stage, reference);
    sortedUnique(claim.qualifications, row => row.id, { code: 'QUALIFICATION_MISMATCH', stage, reference });
    for (const qualification of claim.qualifications) {
      validate('Qualification', qualification, 'QUALIFICATION_MISMATCH', reference);
      if (qualification.scopeId !== claim.scopeId || qualification.scopeId !== assessment.scopeId) badQualification(reference);
    }
    if (claim.type === 'HISTORICAL_DISPOSITION') {
      if (claim.detail.records.length > DEFINITIONS.limits.historyRecords) fail('RESOURCE_LIMIT', stage, reference);
      sortedUnique(claim.detail.records, row => row.id, { code: 'HISTORY_MISMATCH', stage, reference });
      for (const history of claim.detail.records) validate('History', history, 'HISTORY_MISMATCH', reference);
    }
  }), stage);

  const qualificationRecords = new Map();
  const historyRecords = new Map();
  const conditions = new Map();
  const checks = [];
  for (const selection of ordered) {
    const { claim, grant, claimDigest, grantDigest } = selection;
    const reference = grant.envelopeId;
    for (const qualification of claim.qualifications) {
      const prior = qualificationRecords.get(qualification.id);
      if (prior && !equal(prior.record, qualification)) checks.push(() => badQualification(reference));
      else if (prior) {
        prior.claims.add(claimDigest);
        prior.grants.add(grantDigest);
      } else qualificationRecords.set(qualification.id, { record: qualification, claims: new Set([claimDigest]), grants: new Set([grantDigest]) });
    }
    if (claim.type !== 'HISTORICAL_DISPOSITION') continue;
    for (const record of claim.detail.records) {
      if (historyRecords.has(record.id)) checks.push(() => badHistory(reference));
      else historyRecords.set(record.id, { record, claimDigest, grantDigest, reference });
      // A condition may be referenced by several immutable history rows; each
      // row must keep its own identity/disposition and exact affected gate set.
      const rows = conditions.get(record.conditionId) ?? [];
      rows.push(record);
      conditions.set(record.conditionId, rows);
      checks.push(() => {
        if (record.sourceIds.some(id => !grant.sourceIds.includes(id))
          || record.authoritySourceIds.some(id => !grant.authoritySourceIds.includes(id))) badHistory(reference);
      });
    }
  }
  if (qualificationRecords.size > DEFINITIONS.limits.qualifications || historyRecords.size > DEFINITIONS.limits.historyRecords) fail('RESOURCE_LIMIT', stage);
  const qualifications = [...qualificationRecords.values()].map(row => row.record);
  const qualificationIds = [...qualificationRecords.keys()].sort();
  const conditionIds = [...conditions.keys()].sort();
  const scope = scopeSelection?.claim.detail;
  if (scopeAvailable) checks.push(() => {
    if (!equal(scope.qualificationIds, qualificationIds)) badQualification(scopeSelection.grant.envelopeId);
    if (historyAvailable && !equal(scope.conditionIds, conditionIds)) badHistory(scopeSelection.grant.envelopeId);
  });
  for (const { record, reference } of historyRecords.values()) checks.push(() => {
    if (scopeAvailable && !scope.conditionIds.includes(record.conditionId)) badHistory(reference);
    if (record.disposition === 'PRESERVED_WITH_QUALIFICATION') {
      const matching = qualifications.filter(q => q.reasonCode === 'HISTORICAL_UNRESOLVED_PRESERVED'
        && q.conditionIds[0] === record.conditionId && equal(q.gateIds, record.affectedGateIds));
      if (matching.length !== 1) badQualification(reference);
    }
  });

  for (const row of qualificationRecords.values()) checks.push(() => {
    const qualification = row.record;
    const reference = ordered.find(selection => selection.claim.qualifications.some(q => q.id === qualification.id)).grant.envelopeId;
    for (const conditionId of qualification.conditionIds) {
      if (scopeAvailable && !scope.conditionIds.includes(conditionId)) badQualification(reference);
      if (historyAvailable && !conditions.has(conditionId)) badQualification(reference);
    }
    if (qualification.reasonCode === 'HISTORICAL_UNRESOLVED_PRESERVED' && historyAvailable) {
      if (!conditions.get(qualification.conditionIds[0])?.some(record => record.disposition === 'PRESERVED_WITH_QUALIFICATION'
        && equal(record.affectedGateIds, qualification.gateIds))) badQualification(reference);
    }
    if (qualification.provider !== null && !candidate.providers.some(provider => provider.id === qualification.provider)) badQualification(reference);
    if (qualification.reasonCode === 'SAME_HOST_REMOTE_ONLY' && candidate.profile.id !== 'rest') badQualification(reference);
    if (qualification.reasonCode === 'BOUNDED_ADVISORY_REVIEW') {
      const supply = selected('supply');
      if (supply && supply.claim.detail.reviewScope !== 'BOUNDED_SNAPSHOT') badQualification(reference);
    }
  });

  const supplySelection = selected('supply');
  if (supplySelection?.claim.detail.reviewScope === 'BOUNDED_SNAPSHOT') checks.push(() => {
    if (qualifications.filter(q => q.reasonCode === 'BOUNDED_ADVISORY_REVIEW').length !== 1) badQualification(supplySelection.grant.envelopeId);
  });
  const restSelection = selected('rest.contract');
  if (candidate.profile.id === 'rest' && restSelection) checks.push(() => {
    if (qualifications.filter(q => q.reasonCode === 'SAME_HOST_REMOTE_ONLY').length !== 1) badQualification(restSelection.grant.envelopeId);
  });
  const providers = [];
  for (const provider of candidate.providers) {
    const selection = selected(`provider.${provider.id}`);
    if (!selection) continue;
    providers.push(selection.claim.detail);
    checks.push(() => {
      if (selection.claim.detail.provider !== provider.id) badQualification(selection.grant.envelopeId);
      verifyProvider(selection.claim.detail, qualifications, selection.grant.envelopeId);
    });
  }
  selectPhaseError(checks, stage);

  const history = [...historyRecords.values()].map(({ record, claimDigest, grantDigest }) => {
    const { sourceIds, authoritySourceIds, ...projection } = record;
    return { ...projection, claimDigest, grantDigest };
  }).sort((a, b) => compare(a.id, b.id));
  const historicalApplicability = [];
  for (const row of history) {
    if (row.disposition !== 'CURRENT_APPLICABLE' && row.recurrence !== 'OBSERVED') continue;
    for (const gateId of row.affectedGateIds) {
      const gate = gateDefinitions.get(gateId);
      if (gate.mandatory && active(gate, candidate.profile.id, assessment.stage)) historicalApplicability.push({
        historyId: row.id, conditionId: row.conditionId, gateId, claimDigest: row.claimDigest, grantDigest: row.grantDigest,
      });
    }
  }
  historicalApplicability.sort((a, b) => compare(a.gateId, b.gateId) || compare(a.conditionId, b.conditionId) || compare(a.historyId, b.historyId));
  return structuredClone({
    history,
    historicalApplicability,
    qualifications: [...qualificationRecords.values()].map(({ record, claims, grants }) => ({
      ...record, candidateDigest, evidenceClaimDigests: [...claims].sort(), grantDigests: [...grants].sort(),
    })).sort((a, b) => compare(a.id, b.id)),
    providers: providers.sort((a, b) => compare(a.provider, b.provider)),
  });
}
