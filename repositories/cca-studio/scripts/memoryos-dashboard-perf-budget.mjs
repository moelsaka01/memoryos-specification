// MO-1309 Phase 2D: report validation, summary statistics and budget evaluation (pure; no filesystem, clock or process).
// A budget is an upper bound on a metric's WORST run at the certified scale. Raising a budget or the scale after the Phase 2D
// binding returns to owner review (Freeze section 12).
export const PERF_REPORT_KIND = "MemoryOSDashboardPerfReport";
export const PERF_REPORT_VERSION = "1.0.0";

// Metric name -> unit. Generation metrics come from one child process per run; page metrics from one browser load per run.
export const METRICS = Object.freeze({
  readMs: "ms", viewModelBuildMs: "ms", verifyOnlyMs: "ms", assembleMs: "ms", publishMs: "ms", generationWallMs: "ms",
  generationMaxRssMb: "MB", snapshotBytes: "bytes", loadEventMs: "ms", domContentLoadedMs: "ms", firstPageRows: "rows",
  filterMs: "ms", sortMs: "ms", nextPageMs: "ms", pageHeapMb: "MB", domNodes: "nodes",
});

const isNumber = (value) => typeof value === "number" && Number.isFinite(value) && value >= 0;

export function median(values) {
  const sorted = [...values].sort((a, b) => a - b);
  const middle = Math.floor(sorted.length / 2);
  return sorted.length % 2 === 1 ? sorted[middle] : (sorted[middle - 1] + sorted[middle]) / 2;
}

export function summarize(runs) {
  const summary = {};
  for (const name of Object.keys(METRICS)) {
    const values = runs.map((run) => run[name]).filter(isNumber);
    if (values.length === runs.length && values.length > 0) summary[name] = { min: Math.min(...values), median: median(values), max: Math.max(...values) };
  }
  return summary;
}

export function validateReport(report) {
  const bad = (where) => ({ ok: false, reason: where });
  if (report === null || typeof report !== "object" || report.kind !== PERF_REPORT_KIND || report.version !== PERF_REPORT_VERSION) return bad("$");
  if (report.host === null || typeof report.host !== "object" || typeof report.host.platform !== "string" || typeof report.host.node !== "string") return bad("host");
  if (!Array.isArray(report.results) || report.results.length === 0) return bad("results");
  const seen = new Set();
  for (const [index, result] of report.results.entries()) {
    if (!Number.isSafeInteger(result.entries) || result.entries < 0 || seen.has(result.entries)) return bad(`results[${index}].entries`);
    seen.add(result.entries);
    if (!Array.isArray(result.runs) || result.runs.length === 0) return bad(`results[${index}].runs`);
    for (const run of result.runs) {
      for (const [name, value] of Object.entries(run)) if (!Object.hasOwn(METRICS, name) || !isNumber(value)) return bad(`results[${index}].runs.${name}`);
      if (!Object.hasOwn(run, "generationWallMs") || !Object.hasOwn(run, "loadEventMs")) return bad(`results[${index}].runs`); // generation and load both completed
    }
  }
  return { ok: true };
}

// `budgets` is { scale, maximum: { metric: bound } }. Evaluates the worst run of the report's result at that scale.
export function evaluateBudgets(report, budgets) {
  const checked = validateReport(report);
  if (!checked.ok) return { ok: false, reason: `report ${checked.reason}`, violations: [] };
  const result = report.results.find((candidate) => candidate.entries === budgets.scale);
  if (result === undefined) return { ok: false, reason: "scale not measured", violations: [] };
  const summary = summarize(result.runs);
  const violations = [];
  for (const [name, bound] of Object.entries(budgets.maximum)) {
    if (!Object.hasOwn(METRICS, name) || !isNumber(bound)) return { ok: false, reason: `budget ${name}`, violations: [] };
    if (!Object.hasOwn(summary, name)) violations.push({ metric: name, reason: "not measured" });
    else if (summary[name].max > bound) violations.push({ metric: name, worst: summary[name].max, bound });
  }
  return { ok: violations.length === 0, reason: violations.length === 0 ? "within budget" : "over budget", violations };
}
