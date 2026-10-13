// MemoryOS 1.3.1: a suite that fails by design at the baseline is pinned by the EXACT NAMES of its failing tests (never by a count alone).
// `failingTestNames` reads the failing-test summary that `node --test` prints (the spec reporter: a `✖ failing tests:` heading, then one
// unindented `✖ <name> (<duration>ms)` line per failing test). `matchKnownFailures` is the whole rule: the set of failing names must equal
// the pinned set exactly (an extra failure and a missing pinned failure are both findings).
export function failingTestNames(logText) {
  const lines = String(logText).replace(/^\uFEFF/u, "").split(/\r?\n/u);
  const heading = lines.map((line, i) => (line.trimEnd() === "✖ failing tests:" ? i : -1)).filter((i) => i >= 0).pop();
  if (heading === undefined) return [];
  const names = [];
  for (const line of lines.slice(heading + 1)) {
    const match = /^✖ (.+?) \(\d+(?:\.\d+)?ms\)$/u.exec(line.trimEnd());
    if (match) names.push(match[1]);
  }
  return names;
}

export function matchKnownFailures({ row, logText, names }) {
  const found = failingTestNames(logText);
  const pinned = [...names].sort();
  const actual = [...found].sort();
  const unexpected = actual.filter((n) => !pinned.includes(n));
  const missing = pinned.filter((n) => !actual.includes(n));
  const ok = row.exitCode !== 0 && row.fail === pinned.length && row.pass > 0 && row.tests === row.pass + row.fail && unexpected.length === 0 && missing.length === 0 && actual.length === pinned.length;
  return { ok, unexpected, missing };
}
