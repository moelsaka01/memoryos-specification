// The short session behind the GIF and the ads: a small ledger built, queried, exported and turned into a dashboard. All steps are executed for real.
const L = 'ledger';
export const STEPS = [
  { scene: 'g', cli: ['history', 'init', '--ledger', L, '--name', 'release-investigation', '--workspace', 'workspace-investigation'] },
  { scene: 'g', cli: ['history', 'append', '--ledger', L, '--kind', 'MIP_PACKAGE', '--record', 'records/mip-reference/package.mip'] },
  { scene: 'g', cli: ['history', 'append', '--ledger', L, '--kind', 'POLICY_EVALUATION', '--identity', 'records/policy-0/evaluation-identity.json', '--outcome', 'records/policy-0/policy-outcome.json'] },
  { scene: 'g', cli: ['history', 'append', '--ledger', L, '--kind', 'READINESS_RESULT', '--record', 'records/readiness-ready/memoryos-readiness-result.json'] },
  { scene: 'g', cli: ['history', 'append', '--ledger', L, '--kind', 'HUMAN_DECISION_CLAIM', '--record', 'records/decision-ready-approve/human-decision.json'] },
  { scene: 'g', cli: ['history', 'verify', '--ledger', L] },
  { scene: 'g', cli: ['history', 'query', '--ledger', L, '--kind', 'POLICY_EVALUATION', '--retention', 'ANY', '--from', '0', '--limit', '10'] },
  { scene: 'g', cli: ['history', 'export', '--ledger', L, '--output', 'export'] },
  { scene: 'g', repoNode: ['repositories/cca-studio/scripts/memoryos-dashboard-generator.mjs', 'export', 'dashboard.html'], display: 'node repositories/cca-studio/scripts/memoryos-dashboard-generator.mjs export dashboard.html' },
  // for the ads: the tamper check on the same small ledger
  { scene: 'tamper', repoNode: ['tools/media/tamper-copy.mjs', 'ledger', 'ledger-tampered'], display: 'node tools/media/tamper-copy.mjs ledger ledger-tampered' },
  { scene: 'tamper', cli: ['history', 'verify', '--ledger', 'ledger-tampered'], allowFail: true },
];
