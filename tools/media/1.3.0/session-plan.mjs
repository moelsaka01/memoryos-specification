// The on-screen sessions of the MemoryOS 1.3.0 release media. Every step is executed for real by run-session.mjs; nothing here is output.
// `memoryos` is the released CLI (repositories/memoryos-cli/bin/memoryos.js, run with `node`); `cwd` is `demo` (the scratch workspace) or `repo` (the v1.3.0 checkout).
const L = 'ledger';
const append = (kind, ...flags) => ({ scene: 'h-append', cli: ['history', 'append', '--ledger', L, '--kind', kind, ...flags] });
export const STEPS = [
  { scene: 'version', cli: ['version'] },

  // MO-1301 Investigation Policies
  { scene: 'policy', cli: ['policy', 'validate', '--policy', 'policy/pass/policy.json'] },
  ...['pass', 'fail', 'cne'].map((k) => ({ scene: 'policy', cli: ['policy', 'evaluate', '--policy', `policy/${k}/policy.json`, '--package', `policy/${k}/candidate.mip`,
    '--outcome', `out/${k}.outcome.json`, '--identity-output', `out/${k}.identity.json`, '--evaluation-identity-digest-output', `out/${k}.identity.sha256`, '--outcome-digest-output', `out/${k}.outcome.sha256`] })),

  // MO-1302 / MO-1306 CI/CD files that ship in the repository (the pinned CI runtime does not run on this host's Node)
  { scene: 'ci', cwd: 'repo', exec: ['ls', 'repositories/memoryos-ci/templates'] },
  { scene: 'ci', cwd: 'repo', exec: ['grep', '-nE', 'runs-on|timeout-minutes|contents:', 'repositories/memoryos-ci/templates/github.yml.tpl'] },
  { scene: 'ci', exec: ['grep', '-o', '"decision":"[A-Z_]*"', 'records/cicd-6/memoryos-ci-result.json'] },

  // MO-1303 VS Code, MO-1304 MCP, MO-1305 REST: shipped contract files
  { scene: 'vscode', cwd: 'repo', exec: ['grep', '-n', '"title"', 'repositories/memoryos-vscode/package.json'] },
  { scene: 'mcp', cwd: 'repo', exec: ['grep', '-o', 'memoryos_[a-z_]*', 'repositories/memoryos-mcp/README.md'], uniq: true },
  { scene: 'rest', cwd: 'repo', exec: ['grep', '-o', '"/v1/[^"]*"', 'repositories/memoryos-rest/contracts/openapi.json'], uniq: true },

  // MO-1307 readiness results recorded as released fixtures
  { scene: 'readiness', exec: ['grep', '-o', '"readiness":"[A-Z_]*"', 'records/readiness-ready/memoryos-readiness-result.json', 'records/readiness-not-ready/memoryos-readiness-result.json'] },

  // MO-1308 Investigation History
  { scene: 'h-init', cli: ['history', 'init', '--ledger', L, '--name', 'release-investigation', '--workspace', 'workspace-investigation'] },
  append('MIP_PACKAGE', '--record', 'records/mip-reference/package.mip'),
  append('INVESTIGATION_CHECKPOINT', '--record', 'records/checkpoint-c00/checkpoint.json'),
  append('INVESTIGATION_CHECKPOINT', '--record', 'records/checkpoint-c01/checkpoint.json'),
  append('INVESTIGATION_CHECKPOINT', '--record', 'records/checkpoint-c02/checkpoint.json'),
  append('POLICY_EVALUATION', '--identity', 'records/policy-0/evaluation-identity.json', '--outcome', 'records/policy-0/policy-outcome.json'),
  append('POLICY_EVALUATION', '--identity', 'records/policy-1/evaluation-identity.json', '--outcome', 'records/policy-1/policy-outcome.json'),
  append('REGRESSION_REPORT', '--record', 'records/regression-reference/regression-report.json'),
  append('CICD_RUN', '--run', 'records/cicd-6'),
  append('READINESS_RESULT', '--record', 'records/readiness-ready/memoryos-readiness-result.json'),
  append('HUMAN_DECISION_CLAIM', '--record', 'records/decision-ready-approve/human-decision.json'),
  append('READINESS_RESULT', '--record', 'records/readiness-not-ready/memoryos-readiness-result.json'),
  append('HUMAN_DECISION_CLAIM', '--record', 'records/decision-not-ready-approve/human-decision.json'),
  { scene: 'h-verify', cli: ['history', 'verify', '--ledger', L] },
  { scene: 'h-query', cli: ['history', 'query', '--ledger', L, '--kind', 'HUMAN_DECISION_CLAIM', '--retention', 'ANY', '--from', '0', '--limit', '10'] },
  { scene: 'h-tombstone', cli: ['history', 'tombstone', '--ledger', L, '--target', '2', '--reason', 'OPERATOR_CORRECTION', '--authority-reference', 'EXAMPLE-REF-001'] },
  { scene: 'h-tombstone', cli: ['history', 'verify', '--ledger', L] },
  { scene: 'h-export', cli: ['history', 'export', '--ledger', L, '--output', 'export'] },
  { scene: 'h-export', cli: ['history', 'verify-export', '--export', 'export'] },
  { scene: 'h-tamper', repoNode: ['tools/media/tamper-copy.mjs', 'ledger', 'ledger-tampered'], display: 'node tools/media/tamper-copy.mjs ledger ledger-tampered' },
  { scene: 'h-tamper', cli: ['history', 'verify', '--ledger', 'ledger-tampered'], allowFail: true },

  // MO-1309 Cloud Dashboard
  { scene: 'dash-gen', repoNode: ['repositories/cca-studio/scripts/memoryos-dashboard-generator.mjs', 'export', 'dashboard.html'], display: 'node repositories/cca-studio/scripts/memoryos-dashboard-generator.mjs export dashboard.html' },
];
