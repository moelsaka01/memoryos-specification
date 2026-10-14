// The compact real session behind the social ad: flat file names keep the commands short on a phone-sized frame. All steps are executed for real.
const L = 'ledger';
export const STEPS = [
  { scene: 'ad', cli: ['history', 'init', '--ledger', L, '--name', 'investigation', '--workspace', 'workspace-investigation'] },
  { scene: 'ad', cli: ['history', 'append', '--ledger', L, '--kind', 'MIP_PACKAGE', '--record', 'package.mip'] },
  { scene: 'ad', cli: ['history', 'append', '--ledger', L, '--kind', 'READINESS_RESULT', '--record', 'memoryos-readiness-result.json'] },
  { scene: 'ad', cli: ['history', 'append', '--ledger', L, '--kind', 'HUMAN_DECISION_CLAIM', '--record', 'human-decision.json'] },
  { scene: 'ad', cli: ['history', 'append', '--ledger', L, '--kind', 'REGRESSION_REPORT', '--record', 'regression-report.json'] },
  { scene: 'ad', cli: ['history', 'verify', '--ledger', L] },
  { scene: 'ad', cli: ['history', 'query', '--ledger', L, '--kind', 'HUMAN_DECISION_CLAIM', '--retention', 'ANY', '--from', '0', '--limit', '10'] },
  { scene: 'ad', cli: ['history', 'export', '--ledger', L, '--output', 'export'] },
  { scene: 'ad', repoNode: ['repositories/cca-studio/scripts/memoryos-dashboard-generator.mjs', 'export', 'dashboard.html'], display: 'node memoryos-dashboard-generator.mjs export dashboard.html' },
  { scene: 'tamper', repoNode: ['tools/media/tamper-copy.mjs', 'ledger', 'ledger-tampered'], display: 'node tamper-copy.mjs ledger ledger-tampered' },
  { scene: 'tamper', cli: ['history', 'verify', '--ledger', 'ledger-tampered'], allowFail: true },
];
