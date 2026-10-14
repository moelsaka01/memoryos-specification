// Storyboard of the release GIF (the key 1.3 flow): append, verify, query, export, dashboard in Edge, filter. Real output only.
const NODE = 'Node v24.14.0 · Windows 11';
export const BEATS = [
  { id: 'g1-flow', kind: 'term', scene: ['g'], chapter: { code: 'MO-1308', title: 'Investigation History', current: ['1308'] }, note: 'Real output · v1.3.0 checkout',
    nodeLabel: NODE, titleLabel: 'scratch workspace (outside the repository)', speed: 85, gap: 0.35, maxReveal: 0.35, hold: 2.0, lead: 0.3,
    captions: [
      { step: 0, text: 'A local, append-only, hash-chained ledger.' },
      { step: 1, text: 'Append the records your authorities produce.' },
      { step: 5, text: 'Verify recomputes every identity and the chain.' },
      { step: 6, text: 'Query deterministically.' },
      { step: 7, text: 'Export a self-contained bundle.' },
      { step: 8, text: 'Generate one static HTML dashboard.' }] },
  { id: 'g2-dashboard', kind: 'dash', chapter: { code: 'MO-1309', title: 'Cloud Dashboard', current: ['1309'] }, note: 'Real page, opened in Microsoft Edge' },
];
export const DASH_TIMELINE = {
  duration: 12,
  steps: [
    { t: 0.0, caption: 'Opened in Microsoft Edge: static, offline, read-only.' },
    { t: 3.0, scroll: { to: '#entries', dur: 0.9 }, caption: 'Every entry in the verified export.' },
    { t: 6.0, select: { id: 'f-kind', value: 'POLICY_EVALUATION' }, caption: 'Filter by record kind.' },
    { t: 9.0, expand: true, caption: 'Digests and member names only. Never contents.' },
  ],
};
