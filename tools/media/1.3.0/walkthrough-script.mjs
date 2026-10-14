// Storyboard of the 3 to 6 minute walkthrough. Captions are the only authored text; every terminal line and dashboard pixel is real output.
// Every statement is taken from RELEASE_NOTES.md, the MO-1308 history guide or the MO-1309 dashboard page itself.
const NODE = 'Node v24.14.0 · Windows 11';
const TITLE_DEMO = 'scratch workspace (outside the repository)';
const TITLE_REPO = 'MemoryOS v1.3.0 checkout';
const FILES_NOTE = 'Shipped file contents, read with grep/ls';
const CLI_NOTE = 'Real output · v1.3.0 checkout';

const term = (id, scene, chapter, note, captions, extra = {}) => ({ id, kind: 'term', scene, chapter, note, captions, nodeLabel: NODE, titleLabel: extra.repo ? TITLE_REPO : TITLE_DEMO, ...extra });

export const BEATS = [
  { id: 'b00-title', kind: 'title', fullbleed: true, duration: 6, subtitle: 'Release walkthrough', line: 'Nine milestones · MO-1301 to MO-1309',
    fine: 'Tag v1.3.0 · commit 889f99e7 · github.com/moelsaka01/memoryos-specification' },
  { id: 'b01-map', kind: 'map', duration: 12, chapter: { code: '', title: 'What is in 1.3', current: [] }, note: 'From RELEASE_NOTES.md',
    caption: 'Nine milestones, each at its own annotated tag. The history ledger and the dashboard are the headline.' },

  term('b02-policy', ['version', 'policy'], { code: 'MO-1301', title: 'Investigation Policies', current: ['1301'] }, CLI_NOTE, [
    { step: 0, text: 'MemoryOS 1.3 ships SDK and CLI 1.2.0, additively over the 1.2.1 baseline.' },
    { step: 1, text: 'Policies are closed, validated artifacts that evaluate deterministically.' },
    { step: 2, text: 'PASS exits 0.' },
    { step: 3, text: 'FAIL exits 6.' },
    { step: 4, text: 'COULD_NOT_EVALUATE exits 7: a completed outcome, not an error.' }], { speed: 55, gap: 0.9, hold: 2.5 }),

  term('b03-ci', ['ci'], { code: 'MO-1302 · MO-1306', title: 'CI/CD policy gates', current: ['1302', '1306'] }, FILES_NOTE, [
    { step: 0, text: 'One provider-neutral core. Provider files for GitHub, GitLab, Jenkins and Azure, plus a native Windows generic runner.' },
    { step: 1, text: 'The GitHub integration is implemented and offline-validated. Hosted GitHub certification is not claimed.' },
    { step: 2, text: 'A completed run bundle records the Policy decision. Exit codes: 0 PASS, 6 FAIL, 7 COULD_NOT_EVALUATE.' }], { repo: true, speed: 50, gap: 1.2, hold: 3 }),

  term('b04-vscode', ['vscode'], { code: 'MO-1303', title: 'VS Code extension', current: ['1303'] }, FILES_NOTE, [
    { at: 0.3, text: 'Five commands over the bundled CLI and SDK. Evaluation stays in MemoryOS, not in the editor.' },
    { at: 6, text: 'Hosted certification passed on Ubuntu and Windows. macOS was not executed (external runner restriction).' }], { repo: true, speed: 50, hold: 6 }),

  term('b05-mcp', ['mcp'], { code: 'MO-1304', title: 'MCP server and agent integration', current: ['1304'] }, FILES_NOTE, [
    { at: 0.3, text: 'Six tools over the public SDK, served over local stdio.' },
    { at: 6, text: 'Certified for Windows 11 x64 and Ubuntu 24.04 LTS x64. macOS is unsupported.' }], { repo: true, speed: 50, hold: 6 }),

  term('b06-rest', ['rest'], { code: 'MO-1305', title: 'REST gateway', current: ['1305'] }, FILES_NOTE, [
    { at: 0.3, text: 'Six SDK-backed semantic operations and three operational endpoints under /v1.' },
    { at: 6, text: 'Native TLS, bearer authentication, bounded execution. Certified on the Windows 11 x64 host only.' }], { repo: true, speed: 50, hold: 6 }),

  term('b07-readiness', ['readiness'], { code: 'MO-1307', title: 'Release governance and readiness', current: ['1307'] }, 'Recorded readiness results (released fixtures)', [
    { at: 0.3, text: 'An evidence-backed readiness assessment of an exact candidate: READY, NOT_READY and more.' },
    { at: 6, text: 'Computed readiness is not a release approval. Final authorization remains human.' }], { speed: 45, hold: 5 }),

  { id: 'b08-history-card', kind: 'title', fullbleed: true, duration: 4.5, subtitle: 'MO-1308 · Investigation History', line: 'A local, append-only, hash-chained ledger',
    fine: 'Records below come from the released test-fixture corpus. Local single-user v1 on native Windows 11 x64.' },

  term('b09-init', ['h-init'], { code: 'MO-1308', title: 'Investigation History', current: ['1308'] }, CLI_NOTE, [
    { step: 0, text: 'Create a ledger directory for one Workspace.' }], { speed: 50, hold: 1.5 }),
  term('b10-append', ['h-append'], { code: 'MO-1308', title: 'Investigation History', current: ['1308'] }, CLI_NOTE, [
    { step: 0, text: 'Append records that existing authorities produced. Each one is verified first; a refused record changes nothing.' },
    { step: 4, text: 'Packages, checkpoints, Policy evaluations, regression reports, CI/CD runs, readiness results and human decision claims.' },
    { step: 9, text: 'A decision claim is accepted only if its readiness result is already in the same ledger.' }], { speed: 90, gap: 0.3, maxReveal: 0.3, hold: 1.5 }),
  term('b11-verify', ['h-verify'], { code: 'MO-1308', title: 'Investigation History', current: ['1308'] }, CLI_NOTE, [
    { step: 0, text: 'Verify recomputes every identity and the chain. It is an integrity check: not authenticated, signed or encrypted.' }], { speed: 50, hold: 4 }),
  term('b12-query', ['h-query'], { code: 'MO-1308', title: 'Investigation History', current: ['1308'] }, CLI_NOTE, [
    { step: 0, text: 'Query deterministically. decisionConsistency is informational: it is not an approval and does not change any readiness result.' }], { speed: 50, hold: 6 }),
  term('b13-tombstone', ['h-tombstone'], { code: 'MO-1308', title: 'Investigation History', current: ['1308'] }, CLI_NOTE, [
    { step: 0, text: 'A tombstone purges a record’s member bytes. The entry and the chain stay.' },
    { step: 1, text: 'One record purged, one tombstone, and the ledger still verifies.' }], { speed: 50, hold: 3.5 }),
  term('b14-export', ['h-export'], { code: 'MO-1308', title: 'Investigation History', current: ['1308'] }, CLI_NOTE, [
    { step: 0, text: 'Export a self-contained bundle to a new directory.' },
    { step: 1, text: 'And verify the export on its own, without the ledger.' }], { speed: 50, hold: 3 }),
  term('b15-tamper', ['h-tamper'], { code: 'MO-1308', title: 'Investigation History', current: ['1308'] }, CLI_NOTE, [
    { step: 0, text: 'Change one byte of a stored entry on a copy of the ledger…' },
    { step: 1, text: '…and verification fails with exit 3. Truncation or rollback needs a head digest recorded elsewhere.' }], { speed: 50, hold: 6 }),

  term('b16-dash-gen', ['dash-gen'], { code: 'MO-1309', title: 'Cloud Dashboard', current: ['1309'] }, CLI_NOTE, [
    { step: 0, text: 'The generator verifies the export, then writes one self-contained static HTML file.' }], { speed: 70, hold: 3.5 }),

  { id: 'b17-dashboard', kind: 'dash', chapter: { code: 'MO-1309', title: 'Cloud Dashboard', current: ['1309'] }, note: 'Real page, opened in Microsoft Edge' },

  { id: 'b18-close', kind: 'close', fullbleed: true, duration: 12, subtitle: 'Released as v1.3.0',
    points: ['Static, offline and strictly read-only dashboard. No hosting, accounts or network access.', 'Integrity checks, not approvals. Certified scale: 10,000 entries.', 'Local single-user v1 on native Windows 11 x64.'],
    url: 'github.com/moelsaka01/memoryos-specification', fine: 'Read KNOWN_ISSUES.md before relying on a milestone’s certification.' },
];

// Dashboard interaction, in seconds from the start of the beat. `scroll` targets are CSS selectors; `select`/`click` drive the real controls.
export const DASH_TIMELINE = {
  duration: 61,
  steps: [
    { t: 0.0, caption: 'The generated file, opened in Microsoft Edge. One static file: no server, no network.' },
    { t: 7.0, scroll: { to: 'h2=Source export', dur: 1.0 }, caption: 'The verified export: ledger identifier, entry count and head digest. Record the head digest elsewhere.' },
    { t: 16.0, scroll: { to: 'h2=Counts', dur: 1.0 }, caption: 'Counts by record kind, retention and decision consistency.' },
    { t: 24.0, scroll: { to: '#entries', dur: 1.0 }, caption: 'Every entry in the export. Filter, sort and page: strictly read-only.' },
    { t: 30.0, select: { id: 'f-kind', value: 'HUMAN_DECISION_CLAIM' }, caption: 'Filter by record kind: human decision claims.' },
    { t: 36.0, select: { id: 'f-observation', value: 'CONTRARY_TO_READINESS' }, caption: 'A claim recorded as differing from its readiness result is shown neutrally. Informational only: not an approval, not a block.' },
    { t: 44.0, clear: true, select: { id: 'f-retention', value: 'PURGED' }, caption: 'Filter by retention: the purged record keeps its digests, but its bytes are gone.' },
    { t: 50.0, expand: true, caption: 'Only member names, lengths and digests are listed. Contents are never shown.' },
    { t: 52.5, scroll: { to: '#detail-2', dur: 1.4 } },
  ],
};
