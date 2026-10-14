// MO-1308 Phase 3 protocol: the allowed path set for stream 3B case A3. Every path changed between the MO-1307 release (BF
// 1dd1e8c8) and the candidate must fall in one of these classes; a path in none is a finding. The classes follow Freeze
// sections 5.1, 16 and 18.1 and Amendments A1-A7. Patterns: an exact path, `dir/**` (a prefix), or a name with `*` (one segment).
export const ALLOWED_CHANGE_RULES = Object.freeze([
  { class: 'DOCUMENTS', patterns: [
    'ARCHITECTURE.md', 'ROADMAP.md', 'README.md', 'KNOWN_ISSUES.md', 'RELEASE_NOTES.md', 'CHANGELOG.md', '.gitattributes',
    'repositories/memoryos-cli/README.md', 'repositories/memoryos-cli/docs/**', 'docs/ambiguity-register.md', 'docs/mo1308-*.md',
    'docs/mo1302-vendored-runtime-check-correction.md', 'docs/mo1307-v2-stale-test-correction.md'] },
  { class: 'APPEND_ONLY_EVIDENCE', patterns: [
    'repositories/cca-conformance/evidence/mo1308/**', 'repositories/cca-conformance/evidence/mo1307/v2-stale-test-correction/**'] },
  { class: 'CONFORMANCE_TOOLS_AND_TESTS', patterns: [
    'repositories/cca-conformance/tools/mo1308-*/**', 'repositories/cca-conformance/tests/mo1308_*', 'repositories/cca-conformance/tests/support/mo1308-*',
    'repositories/cca-conformance/mo1308-phase3-*.json'] },
  { class: 'AUTHORIZED_TEST_CORRECTIONS', patterns: [
    'repositories/cca-conformance/tests/compatibility_conformance_test.mjs', 'repositories/cca-conformance/tests/mo1301_integration_conformance_test.mjs',
    'repositories/cca-conformance/tests/mo1307_phase2c_correction_test.mjs', 'repositories/cca-conformance/tests/mo1307_phase2c_native_runtime_test.mjs',
    'repositories/cca-conformance/tests/mo1307_phase2c_runtime_test.mjs', 'repositories/cca-conformance/tests/normative_vectors_conformance_test.mjs',
    // Amendment A9.1: released-bundle checks pinned to their release
    'repositories/memoryos-vscode/tests/runtime_foundation.test.mjs', 'repositories/memoryos-vscode/tests/support/released-runtime-pins.mjs',
    'repositories/memoryos-mcp/tests/integrity.test.mjs'] },
  { class: 'HISTORY_AUTHORITY_AND_SDK', patterns: [
    'repositories/cca-studio/web/js/memoryos-history-*.js', 'repositories/cca-studio/web/js/memoryos-sdk.js', 'repositories/cca-studio/package.json',
    'repositories/cca-studio/scripts/generate-memoryos-history-fixtures.mjs', 'repositories/cca-studio/tests/memoryos_*',
    'repositories/cca-studio/tests/fixtures/memoryos-history/**'] },
  { class: 'CLI_HISTORY_NAMESPACE', patterns: [
    'repositories/memoryos-cli/CMakeLists.txt', 'repositories/memoryos-cli/package.json', 'repositories/memoryos-cli/src/*.js',
    // Amendment A10 (section 37) / A8.9: the stream-error handling correction of the CLI entry
    'repositories/memoryos-cli/bin/memoryos.js',
    'repositories/memoryos-cli/tests/**'] },
  { class: 'WORKSPACE_CHECK_CORRECTION', patterns: ['tools/verify_workspace.py'] },
]);

const toRegex = (pattern) => {
  const deep = pattern.endsWith('/**');
  const base = deep ? pattern.slice(0, -3) : pattern;
  const body = base.replace(/[.+?^${}()|[\]\\]/g, '\\$&').replace(/\*/g, '[^/]*');
  return new RegExp(deep ? `^${body}/.*$` : `^${body}$`);
};

export const classifyChangedPath = (file) => ALLOWED_CHANGE_RULES.find((rule) => rule.patterns.some((pattern) => toRegex(pattern).test(file)))?.class ?? null;
